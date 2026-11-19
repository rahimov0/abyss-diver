// "Remove Ads" one-time purchase (App Store, iOS app only).
// Apple keeps the purchase on the player's Apple ID: it comes back with RESTORE PURCHASES
// on a new phone or after reinstalling, and goes away again if Apple refunds it.
import { NATIVE, plugin } from './cloud.js';
import { writeSave } from './game/save.js';
import { canDraw } from './engine/font.js';

export const REMOVE_ADS = 'tr.rahimov.abyssdiver.removeads';

export class Store {
  constructor(game) {
    this.game = game;
    this.enabled = NATIVE;
    this.price = ''; // localized price from the App Store, e.g. "$0.99" / "₺49,99"
    this.busy = null; // 'buying' | 'restoring'
    // resolves once we know whether ads were removed (never blocks longer than 3 s)
    this.ready = !this.enabled ? Promise.resolve() : Promise.race([
      this.init().catch((e) => console.warn('store init failed', e)),
      new Promise((r) => setTimeout(r, 3000)),
    ]);
  }

  get owned() { return !!this.game.save.noAds; }

  setOwned(on) {
    const s = this.game.save;
    if (!!s.noAds === on) return;
    s.noAds = on;
    writeSave(s, { silent: true });
    const ads = this.game.ads;
    try { if (ads) { if (on) ads.stop(); else ads.start(); } } catch (e) { console.warn('ads switch', e); }
  }

  async init() {
    const P = this.P = plugin('NativePurchases');
    if (!P) { this.enabled = false; return; }
    P.addListener('transactionUpdated', (t) => {
      if (t && t.productIdentifier === REMOVE_ADS) this.setOwned(!t.revocationDate);
    });
    P.getProduct({ productIdentifier: REMOVE_ADS, productType: 'inapp' })
      .then(({ product }) => {
        if (!product) return;
        // the pixel font has $ € £ ₺ ¥; any other currency is written with its code instead (e.g. "99 INR")
        const ps = String(product.priceString || '').replace(/\u00a0/g, ' ').trim();
        this.price = ps && canDraw(ps) ? ps : product.price != null ? `${product.price} ${product.currencyCode || ''}`.trim() : ps;
      })
      .catch((e) => console.warn('product', e));
    await this.refresh();
  }

  // what Apple says this Apple ID owns right now (works offline; a refund removes it)
  async refresh() {
    const { purchases } = await this.P.getPurchases({ productType: 'inapp', onlyCurrentEntitlements: true });
    this.setOwned((purchases || []).some((t) => t.productIdentifier === REMOVE_ADS && !t.revocationDate));
  }

  buy() {
    if (!this.enabled || !this.P || this.busy || this.owned) return;
    this.busy = 'buying';
    const say = (t, ms) => this.game.cloud.say(t, ms);
    this.P.purchaseProduct({ productIdentifier: REMOVE_ADS, productType: 'inapp', quantity: 1 })
      .then(() => { this.setOwned(true); say('ADS REMOVED - THANK YOU!', 8000); })
      .catch((e) => {
        const m = String((e && (e.message || e.code)) || e);
        if (/cancel/i.test(m)) say('PURCHASE CANCELLED');
        else if (/pending/i.test(m)) say('PURCHASE PENDING - WAITING FOR APPROVAL', 10000);
        else say(`PURCHASE FAILED: ${m.toUpperCase().replace(/[^A-Z0-9 .:-]/g, '').slice(0, 60)}`, 12000);
      })
      .finally(() => { this.busy = null; });
  }

  restore() {
    if (!this.enabled || !this.P || this.busy) return;
    this.busy = 'restoring';
    const say = (t, ms) => this.game.cloud.say(t, ms);
    this.P.restorePurchases()
      .then(() => this.refresh())
      .then(() => say(this.owned ? 'PURCHASE RESTORED - NO ADS' : 'NO PURCHASE FOUND ON THIS APPLE ID', 8000))
      .catch((e) => say(`RESTORE FAILED: ${String((e && e.message) || e).toUpperCase().slice(0, 50)}`, 12000))
      .finally(() => { this.busy = null; });
  }
}
