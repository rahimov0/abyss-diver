import './style.css';
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
    this.resize();
    addEventListener('resize', () => this.resize());
    this.scene = new TitleScene(this);
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
    const vw = window.innerWidth, vh = window.innerHeight;
    const pw = vw * dpr, ph = vh * dpr;
    let s = Math.max(1, Math.floor(Math.min(pw, ph) / 192));
    let W = Math.ceil(pw / s), H = Math.ceil(ph / s);
    while (W > 440 || H > 540) { s++; W = Math.ceil(pw / s); H = Math.ceil(ph / s); }
    this.canvas.width = W; this.canvas.height = H;
    this.canvas.style.width = `${(W * s) / dpr}px`;
    this.canvas.style.height = `${(H * s) / dpr}px`;
    this.view.w = W; this.view.h = H;
    this.ctx.imageSmoothingEnabled = false;
  }

  setScene(s) { this.scene = s; this.input.stick = null; this.input.dashTouch = null; }
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

window.game = new Game(document.getElementById('game'));

// Service worker (network-first) + clean up the old Magma Runner worker
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => {
    const u = r.active && r.active.scriptURL;
    if (u && new URL(u).pathname !== new URL('./sw.js', location.href).pathname) r.unregister();
  }));
  addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
