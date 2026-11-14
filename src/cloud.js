// Cloud save (optional): sign in with Google (web + app) or Apple (iOS app), one Firestore document per player.
// The game never needs it — progress always lives on the device; signing in only backs it up / syncs it.
// Web: Firebase JS SDK loaded lazily from the CDN. iOS app: native Firebase plugins (no web sign-in windows).
import { FIREBASE_CONFIG } from './firebase-config.js';
import { saveHooks, writeSave, mergeProgress, progressOf } from './game/save.js';

const SDK = 'https://www.gstatic.com/firebasejs/11.0.2';
export const NATIVE = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
const COLLECTION = 'abyssDiver';

export class Cloud {
  constructor(game) {
    this.game = game;
    this.enabled = !!FIREBASE_CONFIG;
    this.native = NATIVE;
    this.providers = NATIVE ? ['apple', 'google'] : ['google'];
    this.user = null;
    this.status = this.enabled ? 'loading' : 'off'; // off | loading | signedout | signing | syncing | synced | error | deleting
    this.timer = null;
    this.notice = null; // short message shown in settings, e.g. after deleting the account
    if (!this.enabled) return;
    saveHooks.push(() => this.schedulePush());
    this.ready = (NATIVE ? this.initNative() : this.initWeb()).catch((e) => { console.warn('cloud init failed', e); this.status = 'error'; });
  }

  say(text) { this.notice = { text, t: Date.now() }; }

  // ---------- setup ----------
  async initWeb() {
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
    auth.onAuthStateChanged(this.auth, (u) => this.onUser(u));
  }

  async initNative() {
    const C = window.Capacitor;
    this.FA = C.registerPlugin('FirebaseAuthentication');
    this.FS = C.registerPlugin('FirebaseFirestore');
    await this.FA.addListener('authStateChange', (e) => this.onUser(e && e.user));
    const { user } = await this.FA.getCurrentUser();
    this.onUser(user);
  }

  onUser(u) {
    const was = this.user && this.user.uid;
    this.user = u || null;
    if (this.user) { if (this.user.uid !== was) this.pull(); }
    else if (this.status !== 'signing' && this.status !== 'deleting') this.status = 'signedout';
  }

  get name() {
    const n = (this.user && (this.user.displayName || this.user.email)) || '';
    return n.split(/[ @]/)[0].toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10) || 'PLAYER';
  }

  get providerId() {
    const d = this.user && this.user.providerData;
    return (d && d[0] && d[0].providerId) || 'google.com';
  }

  // ---------- sign in / out ----------
  // Web: must be called straight from a tap/click handler (no await before it), or Safari blocks the window.
  signIn(which = 'google') {
    if (!this.enabled || (!this.auth && !this.FA)) return;
    this.status = 'signing'; this.signStart = Date.now(); this.signWith = which;
    const done = () => { if (this.status === 'signing') this.status = this.user ? 'syncing' : 'signedout'; };
    const fail = (e) => {
      const code = (e && (e.code || e.message)) || '';
      console.warn('sign-in failed', code, e);
      // closing the sign-in sheet is not an error worth shouting about
      if (!/cancel|popup-closed|1001/i.test(String(code))) { this.lastErrorCode = code; this.lastError = Date.now(); }
      this.status = this.user ? 'synced' : 'signedout';
    };
    if (this.native) {
      (which === 'apple' ? this.FA.signInWithApple() : this.FA.signInWithGoogle()).then(done, fail);
      return;
    }
    this.fb.signInWithPopup(this.auth, this.provider).then(done).catch((e) => {
      if (e && (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment')) {
        this.fb.signInWithRedirect(this.auth, this.provider).catch(fail);
        return;
      }
      fail(e);
    });
  }

  async signOut() {
    if (!this.user) return;
    await this.push(); // make sure the latest progress is up there first
    if (this.native) await this.FA.signOut(); else await this.fb.signOut(this.auth);
    this.user = null; this.status = 'signedout';
    this.say('SIGNED OUT');
  }

  // Deletes the cloud save and the account itself. Progress on this device stays.
  // Web: call straight from a tap (the provider asks you to confirm in a window).
  deleteAccount() {
    if (!this.user) return Promise.resolve();
    this.status = 'deleting'; clearTimeout(this.timer);
    const uid = this.user.uid;
    const run = async () => {
      if (this.native) {
        // sign in again with the same provider: Firebase needs a fresh login to delete, Apple wants its token revoked
        if (this.providerId === 'apple.com') {
          const r = await this.FA.signInWithApple();
          const code = r && r.credential && r.credential.authorizationCode;
          if (code) await this.FA.revokeAccessToken({ token: code }).catch((e) => console.warn('revoke failed', e));
        } else await this.FA.signInWithGoogle();
        await this.FS.deleteDocument({ reference: `${COLLECTION}/${uid}` });
        await this.FA.deleteUser();
      } else {
        await this.fb.reauthenticateWithPopup(this.auth.currentUser, this.provider);
        await this.fb.deleteDoc(this.fb.doc(this.db, COLLECTION, uid));
        await this.fb.deleteUser(this.auth.currentUser);
      }
    };
    return run().then(() => {
      this.user = null; this.lastPushed = null; this.status = 'signedout';
      this.say('ACCOUNT DELETED');
    }).catch((e) => {
      console.warn('delete failed', e);
      this.status = this.user ? 'synced' : 'signedout';
      this.say('NOT DELETED - TRY AGAIN');
    });
  }

  // ---------- sync ----------
  async readRemote(uid) {
    if (this.native) {
      const { snapshot } = await this.FS.getDocument({ reference: `${COLLECTION}/${uid}` });
      return snapshot && snapshot.data ? snapshot.data.save || null : null;
    }
    const snap = await this.fb.getDoc(this.fb.doc(this.db, COLLECTION, uid));
    return snap.exists() ? snap.data().save : null;
  }

  async writeRemote(uid, data) {
    const doc = { save: data, updated: Date.now() };
    if (this.native) await this.FS.setDocument({ reference: `${COLLECTION}/${uid}`, data: doc });
    else await this.fb.setDoc(this.fb.doc(this.db, COLLECTION, uid), doc);
  }

  async pull() {
    if (!this.user) return;
    this.status = 'syncing';
    try {
      const remote = await this.readRemote(this.user.uid);
      const s = this.game.save;
      if (mergeProgress(s, remote)) writeSave(s, { silent: true });
      this.lastPushed = remote ? JSON.stringify(progressOf({ unlocked: 1, best: {}, diver: 'bubble', ...remote })) : null;
      await this.push(); // only writes if this device had progress the cloud didn't
      this.status = 'synced';
    } catch (e) { console.warn('cloud pull failed', e); this.status = 'error'; }
  }

  schedulePush() {
    if (!this.user || this.status === 'deleting') return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.push(), 1200);
  }

  // Writes only when progress actually changed (settings like sound/controls never cost a write).
  async push() {
    if (!this.user || this.status === 'deleting') return;
    clearTimeout(this.timer);
    const data = progressOf(this.game.save), json = JSON.stringify(data);
    if (json === this.lastPushed) { this.status = 'synced'; return; }
    try {
      await this.writeRemote(this.user.uid, data);
      this.lastPushed = json;
      this.status = 'synced';
    } catch (e) { console.warn('cloud push failed', e); this.status = 'error'; }
  }
}
