// Cloud save: Google sign-in (Firebase Auth) + one Firestore document per player.
// Loaded lazily from the Firebase CDN only when a config is present, so the game works fully offline without it.
import { FIREBASE_CONFIG } from './firebase-config.js';
import { saveHooks, writeSave, mergeProgress, progressOf } from './game/save.js';

const SDK = 'https://www.gstatic.com/firebasejs/11.0.2';

export class Cloud {
  constructor(game) {
    this.game = game;
    this.enabled = !!FIREBASE_CONFIG;
    this.user = null;
    this.status = this.enabled ? 'loading' : 'off'; // off | loading | signedout | signing | syncing | synced | error
    this.timer = null;
    if (!this.enabled) return;
    saveHooks.push(() => this.schedulePush());
    this.ready = this.init().catch((e) => { console.warn('cloud init failed', e); this.status = 'error'; });
  }

  async init() {
    const [app, auth, fs] = await Promise.all([
      import(/* @vite-ignore */ `${SDK}/firebase-app.js`),
      import(/* @vite-ignore */ `${SDK}/firebase-auth.js`),
      import(/* @vite-ignore */ `${SDK}/firebase-firestore-lite.js`),
    ]);
    this.fb = { ...auth, ...fs };
    const a = app.initializeApp(FIREBASE_CONFIG);
    this.auth = auth.getAuth(a);
    this.db = fs.getFirestore(a);
    this.provider = new auth.GoogleAuthProvider();
    this.provider.setCustomParameters({ prompt: 'select_account' });
    auth.getRedirectResult(this.auth).catch(() => {});
    auth.onAuthStateChanged(this.auth, (u) => {
      this.user = u;
      if (u) this.pull(); else this.status = 'signedout';
    });
  }

  get name() {
    const n = (this.user && (this.user.displayName || this.user.email)) || '';
    return n.split(/[ @]/)[0].toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10) || 'PLAYER';
  }

  // Must be called directly from a tap/click handler (no await before it), or Safari blocks the window.
  signIn() {
    if (!this.enabled || !this.auth) return;
    this.status = 'signing'; this.signStart = Date.now();
    this.fb.signInWithPopup(this.auth, this.provider).then(() => {
      if (this.status === 'signing') this.status = 'syncing';
    }).catch((e) => {
      const code = e && e.code;
      console.warn('sign-in failed', code, e);
      this.lastErrorCode = code; this.lastError = Date.now();
      if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
        this.fb.signInWithRedirect(this.auth, this.provider).catch((e2) => { console.warn(e2); this.status = 'signedout'; });
        return;
      }
      this.status = this.user ? 'synced' : 'signedout';
    });
  }

  async signOut() {
    if (!this.auth) return;
    await this.push(); // make sure the latest progress is up there first
    await this.fb.signOut(this.auth);
  }

  ref() { return this.fb.doc(this.db, 'abyssDiver', this.user.uid); }

  async pull() {
    if (!this.user) return;
    this.status = 'syncing';
    try {
      const snap = await this.fb.getDoc(this.ref());
      const remote = snap.exists() ? snap.data().save : null;
      const s = this.game.save;
      if (mergeProgress(s, remote)) writeSave(s, { silent: true });
      this.lastPushed = remote ? JSON.stringify(progressOf({ unlocked: 1, best: {}, diver: 'bubble', ...remote })) : null;
      await this.push(); // only writes if this device had progress the cloud didn't
      this.status = 'synced';
    } catch (e) { console.warn('cloud pull failed', e); this.status = 'error'; }
  }

  schedulePush() {
    if (!this.user) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.push(), 1200);
  }

  // Writes only when progress actually changed (settings like sound/controls never cost a write).
  async push() {
    if (!this.user) return;
    clearTimeout(this.timer);
    const data = progressOf(this.game.save), json = JSON.stringify(data);
    if (json === this.lastPushed) { this.status = 'synced'; return; }
    try {
      await this.fb.setDoc(this.ref(), { save: data, updated: Date.now() });
      this.lastPushed = json;
      this.status = 'synced';
    } catch (e) { console.warn('cloud push failed', e); this.status = 'error'; }
  }
}
