import { Input } from './engine/input.js';
import { Audio } from './engine/audio.js';
import { loadSave } from './game/save.js';
import { TitleScene, PlayScene } from './ui/scenes.js';
import { LEVELS } from './level/levels.js';
import { Cloud, NATIVE } from './cloud.js';

class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.view = { w: 216, h: 320 };
    this.save = loadSave();
    this.cloud = new Cloud(this);
    this.audio = new Audio();
    this.audio.sfxOn = this.save.sound;
    this.audio.musicOn = this.save.music;
    this.input = new Input(canvas, this.view);
    this.input.ctrl = this.save.controls || 'stick';
    this.input.onGesture = () => this.audio.unlock();
    addEventListener('keydown', () => this.audio.unlock());
    this.wrap = canvas.parentElement;
    this.resize();
    const rs = () => { this.resize(); setTimeout(() => this.resize(), 250); };
    addEventListener('resize', rs);
    addEventListener('orientationchange', rs);
    if (window.visualViewport) visualViewport.addEventListener('resize', rs);
    document.addEventListener('fullscreenchange', rs);
    this.input.btn = { small: 0.85, normal: 1, big: 1.25 }[this.save.buttons] || 1;
    blockZoom(canvas);
    this.scene = new TitleScene(this);
    // Phone back gesture / browser back button: pause -> main menu instead of leaving the site
    try { history.replaceState({ s: 'root' }, ''); } catch { /* ignore */ }
    addEventListener('popstate', () => this.onBack());
    // dev / testing hook: #level=N jumps straight into a level
    const m = location.hash.match(/level=(\d+)/);
    if (m) this.play(Math.max(1, Math.min(LEVELS.length, +m[1])));
    this.acc = 0; this.last = performance.now();
    requestAnimationFrame((t) => this.frame(t));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.scene instanceof PlayScene) this.scene.pause();
    });
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const r = this.wrap.getBoundingClientRect();
    const vw = r.width, vh = r.height;
    if (vw < 10 || vh < 10) return; // hidden / not laid out yet; the next resize event fixes it
    const pw = vw * dpr, ph = vh * dpr;
    // how many game pixels fit on the short side: phones keep the classic view,
    // tablets and computers see more of the cave instead of getting giant pixels
    const short = Math.min(vw, vh);
    this.device = short < 520 ? 'phone' : COARSE ? 'tablet' : 'desktop';
    const base = { phone: 192, tablet: 248, desktop: 256 }[this.device];
    const target = Math.round(base * ({ normal: 1, wide: 1.25, close: 0.875 }[this.save.view] || 1));
    let s = Math.max(1, Math.floor(Math.min(pw, ph) / target));
    let W = Math.floor(pw / s), H = Math.floor(ph / s);
    while (W > 560 || H > 600) { s++; W = Math.floor(pw / s); H = Math.floor(ph / s); }
    this.canvas.width = W; this.canvas.height = H;
    const cw = (W * s) / dpr, ch = (H * s) / dpr;
    this.canvas.style.width = `${cw}px`;
    this.canvas.style.height = `${ch}px`;
    this.canvas.style.left = `${Math.floor((vw - cw) / 2)}px`;
    this.canvas.style.top = `${Math.floor((vh - ch) / 2)}px`;
    this.view.w = W; this.view.h = H;
    this.ctx.imageSmoothingEnabled = false;
  }

  // mouse: hand cursor over buttons, hidden while playing with the keyboard
  updateCursor() {
    const inp = this.input, h = inp.hover;
    let c = 'default';
    if (h) {
      if (inp.mode === 'play') c = performance.now() - h.t > 2000 ? 'none' : 'default';
      else if (inp.cursorRects.some((r) => h.x >= r.x && h.x <= r.x + r.w && h.y >= r.y && h.y <= r.y + r.h)) c = 'pointer';
    }
    if (c !== this.cursor) { this.cursor = c; this.canvas.style.cursor = c; }
  }

  toggleFullscreen() {
    const d = document, el = d.documentElement;
    try {
      if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen).call(d);
      else {
        const r = (el.requestFullscreen || el.webkitRequestFullscreen).call(el, { navigationUI: 'hide' });
        // phones: try to stay sideways while in full screen (Android only; iPhone ignores it)
        if (r && r.then) r.then(() => { if (this.device === 'phone' && screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); }).catch(() => {});
      }
    } catch { /* not supported */ }
    setTimeout(() => this.resize(), 300);
  }
  get canFullscreen() { const el = document.documentElement; return !NATIVE && !!(el.requestFullscreen || el.webkitRequestFullscreen) && !window.IOS_BROWSER && !/iPhone|iPod/.test(navigator.userAgent); }

  // short buzz: real haptics in the iOS app, navigator.vibrate on Android browsers
  vibrate(ms) {
    if (this.save.vibrate === false) return;
    try {
      if (NATIVE) {
        if (!this.haptics) this.haptics = window.Capacitor.registerPlugin('Haptics');
        this.haptics.impact({ style: ms >= 120 ? 'HEAVY' : ms >= 50 ? 'MEDIUM' : 'LIGHT' }).catch(() => {});
      } else if (navigator.vibrate) navigator.vibrate(ms);
    } catch { /* unsupported */ }
  }

  // privacy / support pages: the website in a browser, Safari from the app
  openLink(page) {
    const url = NATIVE || location.protocol !== 'https:' ? `https://abyss-diver.rahimov.tr/${page}` : new URL(page, location.href).href;
    try { window.open(url, '_blank', 'noopener'); } catch { location.href = url; }
  }
  get isFullscreen() { return !!(document.fullscreenElement || document.webkitFullscreenElement); }

  setScene(s) {
    this.scene = s;
    this.input.clearTouches();
    if (!(s instanceof TitleScene)) this.pushBackGuard();
  }

  pushBackGuard() {
    try { if (!history.state || history.state.s !== 'game') history.pushState({ s: 'game' }, ''); } catch { /* ignore */ }
  }

  onBack() {
    const sc = this.scene;
    if (sc instanceof TitleScene) return; // back from the menu leaves normally next time
    if (sc instanceof PlayScene && sc.world && sc.pause()) { this.pushBackGuard(); return; }
    this.scene = new TitleScene(this);
    this.input.clearTouches();
  }
  play(id) { this.setScene(new PlayScene(this, id)); }

  frame(now) {
    const dt = Math.min(100, now - this.last);
    this.last = now;
    this.acc += dt;
    let steps = 0;
    while (this.acc >= 1000 / 60 && steps < 4) {
      this.scene.update(this.input);
      this.input.endFrame();
      this.acc -= 1000 / 60; steps++;
    }
    if (steps === 4) this.acc = 0;
    this.ctx.imageSmoothingEnabled = false;
    this.input.gestureRects = [];
    this.input.cursorRects = [];
    try { this.scene.draw(this.ctx); } catch (e) { console.error(e); }
    this.updateCursor();
    requestAnimationFrame((t) => this.frame(t));
  }
}

// iPhone/iPad in the Safari browser (not launched from the home screen)
const COARSE = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
const IS_IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.userAgent.includes('Mac') && 'ontouchend' in document);
const STANDALONE = navigator.standalone === true || matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches;
// the iOS App Store app has no status bar and no browser chrome, so none of the Safari workarounds apply
if (IS_IOS && !NATIVE) document.documentElement.classList.add('ios-browser'); // iOS blurs the strip under the status bar, browser and home-screen app alike
if (NATIVE) document.documentElement.classList.add('native-app');
window.IOS_BROWSER = IS_IOS && !STANDALONE && !NATIVE;
window.NATIVE_APP = NATIVE;

// iOS ignores user-scalable=no: block pinch / double-tap zoom ourselves
function blockZoom(canvas) {
  const stop = (e) => e.preventDefault();
  for (const ev of ['gesturestart', 'gesturechange', 'gestureend', 'dblclick']) document.addEventListener(ev, stop, { passive: false });
  document.addEventListener('touchmove', stop, { passive: false });
  canvas.addEventListener('touchstart', stop, { passive: false });
  let last = 0;
  document.addEventListener('touchend', (e) => { const n = Date.now(); if (n - last < 350) e.preventDefault(); last = n; }, { passive: false });
}

window.game = new Game(document.getElementById('game'));

// Service worker (network-first) + clean up the old Magma Runner worker
if (!NATIVE && 'serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => {
    const u = r.active && r.active.scriptURL;
    if (u && new URL(u).pathname !== new URL('./sw.js', location.href).pathname) r.unregister();
  }));
  addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
