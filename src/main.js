import { Input } from './engine/input.js';
import { Audio } from './engine/audio.js';
import { loadSave } from './game/save.js';
import { TitleScene, PlayScene } from './ui/scenes.js';
import { LEVELS } from './level/levels.js';

class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.view = { w: 216, h: 320 };
    this.save = loadSave();
    this.audio = new Audio();
    this.audio.sfxOn = this.save.sound;
    this.audio.musicOn = this.save.music;
    this.input = new Input(canvas, this.view);
    this.input.onGesture = () => this.audio.unlock();
    addEventListener('keydown', () => this.audio.unlock());
    this.wrap = canvas.parentElement;
    this.resize();
    const rs = () => { this.resize(); setTimeout(() => this.resize(), 250); };
    addEventListener('resize', rs);
    addEventListener('orientationchange', rs);
    if (window.visualViewport) visualViewport.addEventListener('resize', rs);
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
      if (document.hidden && this.scene instanceof PlayScene && this.scene.mode === 'play') { this.scene.mode = 'pause'; this.input.mode = 'menu'; }
    });
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const r = this.wrap.getBoundingClientRect();
    const vw = r.width, vh = r.height;
    if (vw < 10 || vh < 10) return; // hidden / not laid out yet; the next resize event fixes it
    const pw = vw * dpr, ph = vh * dpr;
    // phone mode: small screens get a closer view (bigger pixels); tablets/desktop see more of the cave
    const phone = Math.min(vw, vh) < 520;
    const m = Math.min(pw, ph);
    let s = Math.max(1, phone ? Math.round(m / 170) : Math.floor(m / 192));
    let W = Math.floor(pw / s), H = Math.floor(ph / s);
    while (W > 440 || H > 540) { s++; W = Math.floor(pw / s); H = Math.floor(ph / s); }
    this.canvas.width = W; this.canvas.height = H;
    const cw = (W * s) / dpr, ch = (H * s) / dpr;
    this.canvas.style.width = `${cw}px`;
    this.canvas.style.height = `${ch}px`;
    this.canvas.style.left = `${Math.floor((vw - cw) / 2)}px`;
    this.canvas.style.top = `${Math.floor((vh - ch) / 2)}px`;
    this.view.w = W; this.view.h = H;
    this.ctx.imageSmoothingEnabled = false;
  }

  setScene(s) {
    this.scene = s;
    this.input.stick = null; this.input.dashTouch = null;
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
    this.input.stick = null; this.input.dashTouch = null;
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
    try { this.scene.draw(this.ctx); } catch (e) { console.error(e); }
    requestAnimationFrame((t) => this.frame(t));
  }
}

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
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => {
    const u = r.active && r.active.scriptURL;
    if (u && new URL(u).pathname !== new URL('./sw.js', location.href).pathname) r.unregister();
  }));
  addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
