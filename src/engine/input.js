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
    this.ctrl = 'stick'; // 'stick' (fixed joystick) | 'dpad' (arrow buttons) | 'swipe' (slide anywhere)
    this.dashTouch = null;
    this.dashQueued = false;
    this.hot = []; // [{x,y,w,h,code}] tappable HUD buttons during play
    this.pads = new Map(); // dpad: pointerId -> 'up'|'down'|'left'|'right'|null
    this.swipes = []; // menu swipes [{dx, dy}]
    this.menuPtr = new Map(); // menu pointers: id -> {sx, sy, x, y}
    // buttons that must run inside the real touch event (e.g. opening the Google sign-in window on iPhone)
    this.gestureRects = [];

    addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].includes(e.code)) e.preventDefault();
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => { this.keys.clear(); this.clearTouches(); });

    const opts = { passive: false };
    canvas.addEventListener('pointerdown', (e) => this.down(e), opts);
    addEventListener('pointermove', (e) => this.move(e), opts);
    addEventListener('pointerup', (e) => this.up(e), opts);
    addEventListener('pointercancel', (e) => this.up(e), opts);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('touchend', () => {
      const fn = this.pendingGesture;
      if (fn) { this.pendingGesture = null; fn(); }
    }, { passive: true });
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
        if (this.ctrl === 'dpad') { this.pads.set(e.pointerId, this.padAt(p)); return; }
        // fixed joystick: direction is always measured from the same base point
        if (!this.stick) {
          const b = this.ctrl === 'swipe' ? p : this.stickBase();
          this.stick = { id: e.pointerId, ox: b.x, oy: b.y, x: p.x, y: p.y };
        }
      } else {
        this.dashTouch = { id: e.pointerId, x: p.x, y: p.y };
        this.dashQueued = true;
      }
      return;
    }
    // menus: a tap is registered on release, a drag becomes a swipe (scroll pages without opening things)
    this.menuPtr.set(e.pointerId, { sx: p.x, sy: p.y, x: p.x, y: p.y });
  }

  move(e) {
    if (this.pads.has(e.pointerId)) this.pads.set(e.pointerId, this.padAt(this.toLocal(e)));
    const m = this.menuPtr.get(e.pointerId);
    if (m) { const p = this.toLocal(e); m.x = p.x; m.y = p.y; }
    if (this.stick && e.pointerId === this.stick.id) {
      const p = this.toLocal(e);
      this.stick.x = p.x; this.stick.y = p.y;
      if (this.ctrl === 'swipe') { // the start point follows the finger so direction changes feel instant
        const dx = p.x - this.stick.ox, dy = p.y - this.stick.oy, d = Math.hypot(dx, dy), max = 20;
        if (d > max) { this.stick.ox = p.x - (dx / d) * max; this.stick.oy = p.y - (dy / d) * max; }
      }
    }
  }

  up(e) {
    this.pads.delete(e.pointerId);
    const m = this.menuPtr.get(e.pointerId);
    if (m) {
      this.menuPtr.delete(e.pointerId);
      const dx = m.x - m.sx, dy = m.y - m.sy;
      if (e.type === 'pointerup') {
        if (Math.hypot(dx, dy) < 10) {
          const g = this.gestureRects.find((r) => m.sx >= r.x && m.sx <= r.x + r.w && m.sy >= r.y && m.sy <= r.y + r.h);
          if (g) {
            if (e.pointerType === 'touch') { // run it in the touchend that follows (Safari's trusted gesture)
              this.pendingGesture = g.fn;
              setTimeout(() => { if (this.pendingGesture === g.fn) { this.pendingGesture = null; g.fn(); } }, 120);
            } else g.fn();
            return;
          }
          this.taps.push({ x: m.sx, y: m.sy });
        }
        else if (Math.max(Math.abs(dx), Math.abs(dy)) > 24) this.swipes.push({ dx, dy });
      }
    }
    if (this.stick && e.pointerId === this.stick.id) this.stick = null;
    if (this.dashTouch && e.pointerId === this.dashTouch.id) this.dashTouch = null;
  }

  stickBase() { return { x: 36, y: this.screen.h - 40, r: 24 }; }

  // arrow buttons: a cross of four big separate buttons
  padCenter() { return { x: 46, y: this.screen.h - 50 }; }
  padButtons() {
    const c = this.padCenter(), s = 24, g = 25;
    return {
      up: { x: c.x - s / 2, y: c.y - g - s / 2, w: s, h: s, dx: 0, dy: -1 },
      down: { x: c.x - s / 2, y: c.y + g - s / 2, w: s, h: s, dx: 0, dy: 1 },
      left: { x: c.x - g - s / 2, y: c.y - s / 2, w: s, h: s, dx: -1, dy: 0 },
      right: { x: c.x + g - s / 2, y: c.y - s / 2, w: s, h: s, dx: 1, dy: 0 },
    };
  }
  padAt(p) { // only the button under (or nearest to) the finger — one direction per finger
    let best = null, bd = 30;
    for (const [k, b] of Object.entries(this.padButtons())) {
      const d = Math.hypot(p.x - (b.x + b.w / 2), p.y - (b.y + b.h / 2));
      if (d < bd) { bd = d; best = k; }
    }
    return best;
  }

  axis() {
    let x = 0, y = 0;
    const k = this.keys;
    if (k.has('ArrowLeft') || k.has('KeyA')) x -= 1;
    if (k.has('ArrowRight') || k.has('KeyD')) x += 1;
    if (k.has('ArrowUp') || k.has('KeyW')) y -= 1;
    if (k.has('ArrowDown') || k.has('KeyS')) y += 1;
    if (this.pads.size) {
      const B = this.padButtons();
      let px = 0, py = 0;
      for (const k of this.pads.values()) if (k) { px += B[k].dx; py += B[k].dy; }
      px = Math.max(-1, Math.min(1, px)); py = Math.max(-1, Math.min(1, py));
      if (px || py) { const m = Math.hypot(px, py); x = px / m; y = py / m; }
    }
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

  fire() { return this.pressed.has('KeyC') || this.pressed.has('KeyF') || this.pressed.has('KeyL'); }

  hit(code) { return this.pressed.has(code); }
  confirm() { return this.pressed.has('Enter') || this.pressed.has('Space') || this.pressed.has('KeyZ'); }
  back() { return this.pressed.has('Escape') || this.pressed.has('Backspace'); }

  pressedPads() { return new Set(this.pads.values()); }
  clearTouches() { this.stick = null; this.dashTouch = null; this.pads.clear(); }
  endFrame() { this.pressed.clear(); this.taps.length = 0; this.swipes.length = 0; }
}
