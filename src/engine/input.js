// Keyboard + touch input. Touch: left side = fixed joystick (bottom-left), right side = DASH, taps for menus.
export class Input {
  constructor(canvas, screen) {
    this.canvas = canvas;
    this.screen = screen; // {w,h}
    this.keys = new Set();
    this.pressed = new Set();
    this.taps = [];
    this.mode = 'menu';
    this.touchUI = false;
    this.stick = null; // {id, ox, oy, x, y}
    this.dashTouch = null;
    this.dashQueued = false;
    this.hot = []; // [{x,y,w,h,code}] tappable HUD buttons during play

    addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].includes(e.code)) e.preventDefault();
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => { this.keys.clear(); this.stick = null; this.dashTouch = null; });

    const opts = { passive: false };
    canvas.addEventListener('pointerdown', (e) => this.down(e), opts);
    addEventListener('pointermove', (e) => this.move(e), opts);
    addEventListener('pointerup', (e) => this.up(e), opts);
    addEventListener('pointercancel', (e) => this.up(e), opts);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  toLocal(e) {
    const r = this.canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * this.canvas.width, y: ((e.clientY - r.top) / r.height) * this.canvas.height };
  }

  down(e) {
    e.preventDefault();
    if (e.pointerType === 'touch') this.touchUI = true;
    this.onGesture && this.onGesture();
    const p = this.toLocal(e);
    if (this.mode === 'play') {
      for (const h of this.hot)
        if (p.x >= h.x - 4 && p.x <= h.x + h.w + 4 && p.y >= h.y - 4 && p.y <= h.y + h.h + 4) { this.pressed.add(h.code); return; }
      if (p.x < this.screen.w * 0.5) {
        // fixed joystick: direction is always measured from the same base point
        if (!this.stick) { const b = this.stickBase(); this.stick = { id: e.pointerId, ox: b.x, oy: b.y, x: p.x, y: p.y }; }
      } else {
        this.dashTouch = { id: e.pointerId, x: p.x, y: p.y };
        this.dashQueued = true;
      }
      return;
    }
    this.taps.push(p);
  }

  move(e) {
    if (this.stick && e.pointerId === this.stick.id) {
      const p = this.toLocal(e);
      this.stick.x = p.x; this.stick.y = p.y;
    }
  }

  up(e) {
    if (this.stick && e.pointerId === this.stick.id) this.stick = null;
    if (this.dashTouch && e.pointerId === this.dashTouch.id) this.dashTouch = null;
  }

  stickBase() { return { x: 36, y: this.screen.h - 40, r: 24 }; }

  axis() {
    let x = 0, y = 0;
    const k = this.keys;
    if (k.has('ArrowLeft') || k.has('KeyA')) x -= 1;
    if (k.has('ArrowRight') || k.has('KeyD')) x += 1;
    if (k.has('ArrowUp') || k.has('KeyW')) y -= 1;
    if (k.has('ArrowDown') || k.has('KeyS')) y += 1;
    if (this.stick) {
      const dx = this.stick.x - this.stick.ox, dy = this.stick.y - this.stick.oy;
      const d = Math.hypot(dx, dy);
      if (d > 3) {
        const m = Math.min(1, (d - 3) / 15);
        x = (dx / d) * m; y = (dy / d) * m;
      }
    }
    return { x, y };
  }

  dash() {
    const q = this.dashQueued;
    this.dashQueued = false;
    return q || this.pressed.has('Space') || this.pressed.has('KeyX') || this.pressed.has('KeyJ') || this.pressed.has('KeyK');
  }

  hit(code) { return this.pressed.has(code); }
  confirm() { return this.pressed.has('Enter') || this.pressed.has('Space') || this.pressed.has('KeyZ'); }
  back() { return this.pressed.has('Escape') || this.pressed.has('Backspace'); }

  endFrame() { this.pressed.clear(); this.taps.length = 0; }
}
