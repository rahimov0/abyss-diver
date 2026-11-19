// AdMob ads, only in the iOS app (the web version has no ads).
// - Banner at the top of the main menu. The game box moves down by the banner's height, so the banner never covers the game.
// - Full-screen (interstitial) ad after every 2nd finished game, when the player taps the next button on the result screen.
import { NATIVE, plugin } from './cloud.js';

const IDS = {
  banner: 'ca-app-pub-6811894230993861/6198482263',
  inter: 'ca-app-pub-6811894230993861/7166455712',
};
const GAMES_PER_AD = 2;

export class Ads {
  constructor(game) {
    this.game = game;
    this.enabled = NATIVE && !/[?&]noads\b/.test(location.search);
    this.ready = false;
    this.games = 0; // finished games since the last full-screen ad
    this.banner = 'none'; // none | shown | hidden
    this.interLoaded = false;
    this.showing = false;
    this.privacyRequired = false;
    if (this.enabled) this.init().catch((e) => console.warn('ads init failed', e));
  }

  async init() {
    const A = this.A = plugin('AdMob');
    if (!A) { this.enabled = false; return; }
    // 1) EU/UK privacy consent (Google's consent form, shown only where the law needs it)
    try {
      const info = await A.requestConsentInfo();
      if (info.isConsentFormAvailable && info.status === 'REQUIRED') await A.showConsentForm();
      const again = await A.requestConsentInfo();
      this.privacyRequired = again.privacyOptionsRequirementStatus === 'REQUIRED';
      if (again.canRequestAds === false) { this.enabled = false; return; }
    } catch (e) { console.warn('consent', e); }
    // 2) Apple's "allow tracking?" question (only asked once; ads still show if the player says no)
    try {
      const t = await A.trackingAuthorizationStatus();
      if (t.status === 'notDetermined') await A.requestTrackingAuthorization();
    } catch (e) { console.warn('att', e); }
    // 3) start the SDK; the game is rated 9+, so keep ads family-friendly
    await A.initialize({ maxAdContentRating: 'ParentalGuidance' });
    A.addListener('bannerAdSizeChanged', (s) => {
      const h = (s && s.height) || 0;
      // a banner that finished loading after the player already left the menu: take it away again
      if (h > 0 && this.banner !== 'shown') { this.A.hideBanner().catch(() => {}); this.setTop(0); return; }
      this.setTop(this.banner === 'shown' ? h : 0);
    });
    A.addListener('interstitialAdLoaded', () => { this.interLoaded = true; });
    A.addListener('interstitialAdFailedToLoad', () => { this.interLoaded = false; setTimeout(() => this.loadInter(), 60000); });
    A.addListener('interstitialAdDismissed', () => this.afterInter());
    A.addListener('interstitialAdFailedToShow', () => this.afterInter());
    this.ready = true;
    this.loadInter();
  }

  // the game box starts below the banner (CSS variable used by #wrap in the app)
  setTop(px) {
    document.documentElement.style.setProperty('--ad-top', `${Math.max(0, Math.round(px))}px`);
  }

  // called every frame with "should the banner be on screen now?"
  wantBanner(on) {
    if (!this.ready || !this.enabled || this.showing) return;
    if (on && this.banner !== 'shown') {
      const first = this.banner === 'none';
      this.banner = 'shown';
      (first
        ? this.A.showBanner({ adId: IDS.banner, adSize: 'ADAPTIVE_BANNER', position: 'TOP_CENTER', margin: 0 })
        : this.A.resumeBanner()
      ).catch((e) => { console.warn('banner', e); this.banner = 'none'; });
    } else if (!on && this.banner === 'shown') {
      this.banner = 'hidden';
      this.setTop(0);
      this.A.hideBanner().catch(() => {});
    }
  }

  loadInter() {
    if (!this.ready || this.interLoaded) return;
    this.A.prepareInterstitial({ adId: IDS.inter }).then(() => { this.interLoaded = true; }).catch(() => {});
  }

  // a game just ended (won or lost)
  gameOver() { this.games++; }

  // run `then` right away, or after a full-screen ad when one is due
  between(then) {
    if (!this.ready || !this.enabled || this.games < GAMES_PER_AD || !this.interLoaded || this.showing) { then(); return; }
    this.showing = true; this.then = then; this.games = 0; this.interLoaded = false;
    const au = this.game.audio && this.game.audio.ctx;
    if (au && au.state === 'running') au.suspend().catch(() => {});
    this.A.showInterstitial().catch(() => this.afterInter());
  }

  afterInter() {
    if (!this.showing) return;
    this.showing = false;
    const au = this.game.audio && this.game.audio.ctx;
    if (au && au.state === 'suspended') au.resume().catch(() => {});
    const then = this.then; this.then = null;
    if (then) then();
    this.loadInter();
  }

  // EU/UK players must be able to change their ad privacy choice later
  openPrivacy() {
    if (this.A) this.A.showPrivacyOptionsForm().catch((e) => console.warn('privacy form', e));
  }
}
