// Enemy types. Positions in pixels. Each: update(W), draw(ctx, W), touches(x,y,r), dashable, harmful
import { TILE } from '../level/grid.js';
import { disc, ellipse, tri, line, px } from '../gfx/pixel.js';

const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

class Base {
  constructor(d, W) {
    this.type = d.type; this.x = d.x; this.y = d.y; this.d = d;
    this.r = 6; this.alive = true; this.t = Math.random() * 1000;
    this.spd = W.spec.speed;
    this.flash = 0;
  }
  get dashable() { return false; }
  get harmful() { return true; }
  touches(x, y, r) { return dist(x, y, this.x, this.y) < r + this.r; }
  update() { this.t++; if (this.flash > 0) this.flash--; }
  light() { return null; }
}

class Fish extends Base {
  constructor(d, W) {
    super(d, W);
    this.x0 = d.x0 * TILE + 8; this.x1 = d.x1 * TILE + 8; this.baseY = this.y;
    this.dir = Math.random() < 0.5 ? -1 : 1; this.r = 5;
  }
  get dashable() { return true; }
  update(W) {
    super.update();
    this.x += this.dir * 0.6 * this.spd;
    if (this.x < this.x0) { this.x = this.x0; this.dir = 1; }
    if (this.x > this.x1) { this.x = this.x1; this.dir = -1; }
    this.y = this.baseY + Math.sin(this.t * 0.05) * 2;
  }
  draw(ctx, W) {
    const S = W.S, f = Math.floor(this.t / 10) % 2;
    const img = this.dir > 0 ? S.fish[f] : S.fishL[f];
    ctx.drawImage(img, Math.round(this.x - 7), Math.round(this.y - 4));
  }
}

class Crab extends Base {
  constructor(d, W) {
    super(d, W);
    this.x0 = d.x0 * TILE + 6; this.x1 = d.x1 * TILE + 10;
    this.y = d.ty * TILE + TILE - 5; this.dir = 1; this.pause = 0; this.r = 5;
  }
  get dashable() { return true; }
  update(W) {
    super.update();
    if (this.pause > 0) { this.pause--; return; }
    this.x += this.dir * 0.5 * this.spd;
    if (this.x < this.x0) { this.x = this.x0; this.dir = 1; this.pause = 30; }
    if (this.x > this.x1) { this.x = this.x1; this.dir = -1; this.pause = 30; }
    if (Math.random() < 0.004) this.pause = 40;
  }
  draw(ctx, W) {
    const f = this.pause > 0 ? 0 : Math.floor(this.t / 6) % 2;
    ctx.drawImage(W.S.crab[f], Math.round(this.x - 7), Math.round(this.y - 4));
  }
}

class Jelly extends Base {
  constructor(d, W) {
    super(d, W);
    this.y0 = d.y0 * TILE + 8; this.y1 = d.y1 * TILE + 8; this.vy = 0; this.r = 5; this.rising = true;
    this.col = W.biome === 7 ? ['#7affe0', '#2ab0a0'] : W.biome === 4 ? ['#e8f6ff', '#90c0e0'] : ['#ff8ad8', '#c04da0'];
  }
  update(W) {
    super.update();
    if (this.rising) {
      if (this.t % 50 === 0) this.vy = -1.4 * this.spd;
      if (this.y < this.y0 + 4) this.rising = false;
    } else {
      this.vy = Math.min(this.vy + 0.02, 0.45 * this.spd);
      if (this.y > this.y1 - 4) this.rising = true;
    }
    this.vy *= 0.97;
    this.y = Math.max(this.y0, Math.min(this.y1, this.y + this.vy));
  }
  light() { return W_LIGHT(this, 18, 0.5); }
  draw(ctx) {
    const pulse = this.vy < -0.5 ? 1 : 0;
    const x = Math.round(this.x), y = Math.round(this.y);
    for (let i = 0; i < 4; i++) {
      const tx = x - 4 + i * 3 - 0;
      for (let s = 0; s < 8; s++) px(ctx, tx + Math.round(Math.sin(this.t * 0.1 + s * 0.7 + i) * 1.2), y + 2 + s, s % 2 ? this.col[1] : this.col[0]);
    }
    ellipse(ctx, x, y, 6 - pulse, 5 + pulse, '#0b0e1c');
    ellipse(ctx, x, y, 5 - pulse, 4 + pulse, this.col[1]);
    ellipse(ctx, x, y - 1, 4 - pulse, 3 + pulse, this.col[0]);
    ctx.fillStyle = this.col[1]; ctx.fillRect(x - 6, y + 1, 13, 4);
    ctx.fillStyle = '#0b0e1c'; ctx.fillRect(x - 6, y + 3, 13, 1);
    px(ctx, x - 2, y - 3, '#ffffff', 2, 1); px(ctx, x - 3, y - 2, '#ffffff');
  }
}

class Urchin extends Base {
  constructor(d, W) {
    super(d, W);
    this.x += (d.ax || 0) * 3; this.y += (d.ay || 0) * 3; this.r = 5;
  }
  draw(ctx) {
    const x = Math.round(this.x), y = Math.round(this.y);
    const p = 3 + Math.round(Math.sin(this.t * 0.08) + 1) * 0.5;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + 0.2;
      line(ctx, x + Math.cos(a) * 3, y + Math.sin(a) * 3, x + Math.cos(a) * (4 + p), y + Math.sin(a) * (4 + p), i % 2 ? '#d0a0ff' : '#8a50c0');
    }
    disc(ctx, x, y, 4.5, '#0b0e1c'); disc(ctx, x, y, 3.5, '#4a1a5a'); disc(ctx, x - 1, y - 1, 1.5, '#8a3aa0');
    px(ctx, x - 2, y - 2, '#e0b0ff');
  }
}

class Puffer extends Base {
  constructor(d, W) { super(d, W); this.ax = this.x; this.ay = this.y; this.inf = 0; this.timer = 0; this.r = 5; }
  get dashable() { return this.inf < 0.3; }
  update(W) {
    super.update();
    this.x = this.ax + Math.sin(this.t * 0.02) * 8; this.y = this.ay + Math.sin(this.t * 0.031) * 5;
    const p = W.player;
    if (dist(p.x, p.y, this.x, this.y) < 44 && this.timer <= 0) { this.timer = 140; W.sfx('bubble'); }
    if (this.timer > 0) { this.timer--; this.inf = Math.min(1, this.inf + 0.08); } else this.inf = Math.max(0, this.inf - 0.03);
    this.r = 5 + this.inf * 5;
    this.dir = p.x < this.x ? -1 : 1;
  }
  draw(ctx) {
    const x = Math.round(this.x), y = Math.round(this.y), r = this.r;
    if (this.inf > 0.2) {
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        line(ctx, x + Math.cos(a) * r, y + Math.sin(a) * r, x + Math.cos(a) * (r + 2), y + Math.sin(a) * (r + 2), '#fff3a0');
      }
      disc(ctx, x, y, r + 0.5, '#0b0e1c'); disc(ctx, x, y, r - 0.5, '#f4d84a'); ellipse(ctx, x, y + r * 0.35, r * 0.7, r * 0.4, '#fff3c0');
    } else {
      tri(ctx, x - this.dir * 5, y, x - this.dir * 9, y - 3, x - this.dir * 9, y + 3, '#c89a20');
      ellipse(ctx, x, y, 6, 4.5, '#0b0e1c'); ellipse(ctx, x, y, 5, 3.5, '#f4d84a'); ellipse(ctx, x, y + 1.5, 4, 1.5, '#fff3c0');
    }
    px(ctx, x - 2, y - 2, '#a06a10'); px(ctx, x + 1, y - 3, '#a06a10');
    const ex = x + this.dir * Math.round(r * 0.5);
    px(ctx, ex, y - 1, '#ffffff', 2, 2); px(ctx, ex + (this.dir > 0 ? 1 : 0), y - 1, '#0b0e1c');
  }
}

class Eel extends Base {
  constructor(d, W) {
    super(d, W);
    this.dir = d.dir; this.len = d.len * TILE;
    this.wx = d.tx * TILE + 8 - d.dir * 8; this.y = d.ty * TILE + 8;
    this.ext = 0; this.state = 0; this.timer = 60 + Math.random() * 60; this.r = 5;
  }
  get dashable() { return this.ext > 10; }
  get hx() { return this.wx + this.dir * this.ext; }
  update(W) {
    super.update();
    const p = W.player;
    this.timer--;
    if (this.state === 0) { // hidden, peeking
      this.ext = 4 + Math.sin(this.t * 0.1) * 2;
      const dx = (p.x - this.wx) * this.dir;
      if (this.timer <= 0 && Math.abs(p.y - this.y) < 16 && dx > 0 && dx < this.len + 24) { this.state = 1; W.sfx('crack'); }
    } else if (this.state === 1) { // lunge
      this.ext = Math.min(this.len, this.ext + 3.2 * this.spd);
      if (this.ext >= this.len) { this.state = 2; this.timer = 26; }
    } else if (this.state === 2) { if (this.timer <= 0) this.state = 3; }
    else { this.ext -= 1.2; if (this.ext <= 4) { this.state = 0; this.timer = 70; } }
    this.x = this.hx;
  }
  touches(x, y, r) {
    if (Math.abs(y - this.y) > r + 4) return false;
    const a = Math.min(this.wx, this.hx), b = Math.max(this.wx, this.hx);
    return x + r > a && x - r < b + 4;
  }
  draw(ctx) {
    const n = Math.max(1, Math.floor(this.ext / 4));
    for (let i = 0; i < n; i++) {
      const xx = this.wx + this.dir * i * 4, yy = this.y + Math.sin(this.t * 0.2 + i) * 1.2;
      disc(ctx, xx, yy, 3.5, '#0b0e1c'); disc(ctx, xx, yy, 2.5, i % 2 ? '#3a8a3a' : '#2e7030'); px(ctx, xx - 1, yy + 1, '#c8c860', 3, 1);
    }
    const hx = Math.round(this.hx), y = Math.round(this.y);
    ellipse(ctx, hx, y, 6, 4.5, '#0b0e1c'); ellipse(ctx, hx, y, 5, 3.5, '#4aa04a');
    ctx.fillStyle = '#d8d870'; ctx.fillRect(hx - 4, y + 1, 9, 2);
    const open = this.state === 1 || this.state === 2;
    if (open) { ctx.fillStyle = '#6a1020'; ctx.fillRect(hx + (this.dir > 0 ? 1 : -5), y, 5, 2); px(ctx, hx + this.dir * 3, y, '#ffffff'); px(ctx, hx + this.dir * 5, y + 1, '#ffffff'); }
    px(ctx, hx + this.dir * 2 - 1, y - 2, '#ffe040', 2, 1); px(ctx, hx + this.dir * 2, y - 2, '#0b0e1c');
  }
}

class Clam extends Base {
  constructor(d, W) { super(d, W); this.y = d.ty * TILE + TILE - 4; this.open = 0; this.timer = 60 + Math.random() * 120; this.r = 6; }
  get dashable() { return this.open > 0.5; }
  get harmful() { return false; }
  update(W) {
    super.update();
    this.timer--;
    const p = W.player;
    const near = dist(p.x, p.y, this.x, this.y) < 130;
    if (this.timer <= 0) {
      if (this.open === 0 && near) { this.opening = true; }
      this.timer = 150 / this.spd;
    }
    if (this.opening) {
      this.open = Math.min(1, this.open + 0.06);
      if (this.open >= 1) {
        this.opening = false; this.holdT = 40;
        if (W.los(this.x, this.y - 6, p.x, p.y)) {
          const a = Math.atan2(p.y - (this.y - 6), p.x - this.x), s = 1.5 * this.spd;
          W.shots.push({ x: this.x, y: this.y - 6, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 260 });
          W.sfx('pearl');
        }
      }
    } else if (this.holdT > 0) this.holdT--;
    else this.open = Math.max(0, this.open - 0.04);
  }
  draw(ctx) {
    const x = Math.round(this.x), y = Math.round(this.y), o = Math.round(this.open * 5);
    ellipse(ctx, x, y, 8, 3.5, '#0b0e1c'); ellipse(ctx, x, y, 7, 2.5, '#8a6aa8');
    ctx.fillStyle = '#0b0e1c'; ctx.fillRect(x - 8, y - 4, 17, 4);
    ctx.fillStyle = '#c8a8e0'; ctx.fillRect(x - 7, y - 1, 15, 1);
    if (o > 0) { ctx.fillStyle = '#ff9ab8'; ctx.fillRect(x - 6, y - 2 - o, 13, o + 1); if (this.open > 0.6) disc(ctx, x, y - 2 - o / 2, 1.5, '#ffffff'); }
    ellipse(ctx, x, y - 3 - o, 8, 3, '#0b0e1c'); ellipse(ctx, x, y - 3 - o, 7, 2, '#a888c8');
    for (let i = -5; i <= 5; i += 3) px(ctx, x + i, y - 4 - o, '#6a4a88');
    px(ctx, x - 3, y - 5 - o, '#f0e0ff', 3, 1);
  }
}

class Mine extends Base {
  constructor(d, W) { super(d, W); this.ay = this.y; this.chainY = d.chain ? d.y + d.chain * TILE - 8 : null; this.r = 6; this.respawn = 0; }
  update(W) {
    super.update();
    if (!this.alive) return;
    this.y = this.ay + Math.sin(this.t * 0.04) * 3;
  }
  draw(ctx) {
    const x = Math.round(this.x), y = Math.round(this.y);
    if (this.chainY) for (let cy = y + 7; cy < this.chainY + 8; cy += 3) px(ctx, x, cy, '#5d6478', 1, 2);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      px(ctx, x + Math.round(Math.cos(a) * 6) - 1, y + Math.round(Math.sin(a) * 6) - 1, '#9aa4b8', 2, 2);
    }
    disc(ctx, x, y, 5.5, '#0b0e1c'); disc(ctx, x, y, 4.5, '#3a3f4a'); disc(ctx, x - 1, y - 1, 2.5, '#545a68');
    px(ctx, x - 2, y - 3, '#9aa4b8', 2, 1);
    px(ctx, x, y, (this.t >> 4) % 2 ? '#ff3030' : '#601010', 1, 1);
  }
  light() { return (this.t >> 4) % 2 ? W_LIGHT(this, 8, 0.6) : null; }
}

class Spike extends Base {
  constructor(d, W) {
    super(d, W);
    this.hy = d.ty * TILE + 6; this.y = this.hy; this.y1 = (d.y1 + 1) * TILE; this.state = 0; this.vy = 0; this.timer = 0; this.r = 4;
    this.cols = W.biome === 4 ? ['#effaff', '#8ac8f0'] : W.biome === 3 ? ['#e0a0ff', '#8a50c0'] : [W.B.rock[2], W.B.rock[0]];
  }
  update(W) {
    super.update();
    const p = W.player;
    if (this.state === 0) {
      if (Math.abs(p.x - this.x) < 14 && p.y > this.y && p.y < this.y1 + 8) { this.state = 1; this.timer = 22; W.sfx('crack'); }
    } else if (this.state === 1) { if (--this.timer <= 0) this.state = 2; }
    else if (this.state === 2) {
      this.vy = Math.min(4.5, this.vy + 0.18 * this.spd);
      this.y += this.vy;
      if (W.solidAt(this.x, this.y + 6) || this.y > this.y1) {
        W.burst(this.x, this.y + 4, 'debris', 8, this.cols[0]); W.sfx('crack');
        this.state = 3; this.timer = 260; this.y = this.hy; this.vy = 0; this.grow = 0;
      }
    } else if (--this.timer <= 0) this.state = 0;
  }
  get harmful() { return this.state !== 3; }
  draw(ctx) {
    if (this.state === 3) { const g = 1 - this.timer / 260; if (g < 0.3) return; }
    const sh = this.state === 1 ? ((this.t >> 1) % 2 ? 1 : -1) : 0;
    const x = Math.round(this.x) + sh, y = Math.round(this.y);
    const s = this.state === 3 ? 1 - this.timer / 260 : 1;
    tri(ctx, x - 5, y - 6, x + 5, y - 6, x, y + Math.round(8 * s), '#0b0e1c');
    tri(ctx, x - 4, y - 6, x + 4, y - 6, x, y + Math.round(6 * s), this.cols[1]);
    tri(ctx, x - 3, y - 6, x, y - 6, x, y + Math.round(4 * s), this.cols[0]);
  }
}

class Spinner extends Base {
  constructor(d, W) { super(d, W); this.px = this.x; this.py = this.y; this.ang = Math.random() * 6.28; this.rot = (Math.random() < 0.5 ? -1 : 1) * 0.028; this.len = 29; this.r = 5; }
  update(W) {
    super.update();
    this.ang += this.rot * this.spd;
    this.x = this.px + Math.cos(this.ang) * this.len; this.y = this.py + Math.sin(this.ang) * this.len;
  }
  draw(ctx) {
    for (let i = 0; i <= this.len - 6; i += 5) px(ctx, this.px + Math.cos(this.ang) * i - 1, this.py + Math.sin(this.ang) * i - 1, '#9aa4b8', 2, 2);
    disc(ctx, this.px, this.py, 3, '#0b0e1c'); disc(ctx, this.px, this.py, 2, '#5d6478');
    const x = Math.round(this.x), y = Math.round(this.y);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + this.t * 0.1;
      line(ctx, x + Math.cos(a) * 4, y + Math.sin(a) * 4, x + Math.cos(a) * 8, y + Math.sin(a) * 8, '#d0d8e8');
    }
    disc(ctx, x, y, 5.5, '#0b0e1c'); disc(ctx, x, y, 4.5, '#6a707e'); disc(ctx, x - 1, y - 1, 2, '#a0a8b8');
  }
}

class Shark extends Base {
  constructor(d, W) {
    super(d, W);
    this.vx = 0.6; this.vy = 0; this.state = 'roam'; this.timer = 0; this.r = 7; this.face = 1;
    this.tx = this.x; this.ty = this.y;
  }
  update(W) {
    super.update();
    const p = W.player;
    const dp = dist(p.x, p.y, this.x, this.y);
    if (this.state === 'roam') {
      if (dist(this.tx, this.ty, this.x, this.y) < 10 || this.timer-- <= 0) {
        for (let k = 0; k < 10; k++) {
          const a = Math.random() * 6.28, r = 30 + Math.random() * 70;
          const nx = this.x + Math.cos(a) * r, ny = this.y + Math.sin(a) * r;
          if (W.los(this.x, this.y, nx, ny, 8)) { this.tx = nx; this.ty = ny; break; }
        }
        this.timer = 180;
      }
      this.steer(this.tx, this.ty, 0.04, 0.8 * this.spd);
      if (dp < 96 && W.los(this.x, this.y, p.x, p.y, 4) && !p.dead) { this.state = 'warn'; this.timer = 26; W.sfx('roar'); }
    } else if (this.state === 'warn') {
      this.vx *= 0.9; this.vy *= 0.9; this.face = p.x < this.x ? -1 : 1;
      if (--this.timer <= 0) { this.state = 'charge'; this.timer = 70; const a = Math.atan2(p.y - this.y, p.x - this.x); this.vx = Math.cos(a) * 2.4 * this.spd; this.vy = Math.sin(a) * 2.4 * this.spd; }
    } else if (this.state === 'charge') {
      if (--this.timer <= 0) { this.state = 'rest'; this.timer = 80; }
    } else if (this.state === 'rest') {
      this.vx *= 0.95; this.vy *= 0.95;
      if (--this.timer <= 0) { this.state = 'roam'; this.timer = 0; }
    }
    const nx = this.x + this.vx, ny = this.y + this.vy;
    if (W.solidAt(nx + Math.sign(this.vx) * 10, this.y)) { this.vx *= -0.5; if (this.state === 'charge') { this.state = 'rest'; this.timer = 80; } this.timer = Math.min(this.timer, 5); }
    else this.x = nx;
    if (W.solidAt(this.x, ny + Math.sign(this.vy) * 6)) { this.vy *= -0.5; }
    else this.y = ny;
    if (Math.abs(this.vx) > 0.1) this.face = this.vx < 0 ? -1 : 1;
  }
  steer(tx, ty, acc, max) {
    const a = Math.atan2(ty - this.y, tx - this.x);
    this.vx += Math.cos(a) * acc; this.vy += Math.sin(a) * acc;
    const s = Math.hypot(this.vx, this.vy);
    if (s > max) { this.vx *= max / s; this.vy *= max / s; }
  }
  touches(x, y, r) { return Math.abs(x - this.x) < r + 12 && Math.abs(y - this.y) < r + 5; }
  draw(ctx) {
    const f = this.face, x = Math.round(this.x), y = Math.round(this.y);
    const wag = Math.round(Math.sin(this.t * (this.state === 'charge' ? 0.5 : 0.2)) * 2);
    tri(ctx, x - f * 12, y, x - f * 19, y - 6 + wag, x - f * 18, y + 5 + wag, '#0b0e1c');
    tri(ctx, x - f * 12, y, x - f * 18, y - 5 + wag, x - f * 17, y + 4 + wag, '#56657e');
    tri(ctx, x - f * 3, y - 4, x + f * 3, y - 4, x - f * 4, y - 11, '#0b0e1c');
    tri(ctx, x - f * 2, y - 4, x + f * 2, y - 4, x - f * 3, y - 9, '#56657e');
    ellipse(ctx, x, y, 14, 6, '#0b0e1c'); ellipse(ctx, x, y, 13, 5, '#6a7a94'); ellipse(ctx, x + f * 1, y + 2, 11, 2.5, '#d0d8e8');
    ctx.fillStyle = '#4a5870'; ctx.fillRect(x - f * 1 - 1, y - 1, 2, 4);
    px(ctx, x + f * 8, y - 2, this.state === 'warn' || this.state === 'charge' ? '#ff3030' : '#0b0e1c', 2, 2);
    const mx = x + f * (this.state === 'charge' ? 7 : 9);
    ctx.fillStyle = '#0b0e1c'; ctx.fillRect(Math.min(mx, x + f * 13), y + 2, 5, 1);
    if (this.state === 'charge' || this.state === 'warn') { px(ctx, mx + f, y + 3, '#ffffff'); px(ctx, mx + f * 3, y + 3, '#ffffff'); }
  }
}

class Angler extends Base {
  constructor(d, W) { super(d, W); this.vx = 0; this.vy = 0; this.r = 6; this.face = 1; this.ax = this.x; this.ay = this.y; }
  get dashable() { return true; }
  update(W) {
    super.update();
    const p = W.player;
    const dp = dist(p.x, p.y, this.x, this.y);
    let tx = this.ax + Math.sin(this.t * 0.01) * 20, ty = this.ay + Math.cos(this.t * 0.013) * 12;
    if (dp < 120 && !p.dead) { tx = p.x; ty = p.y; }
    const a = Math.atan2(ty - this.y, tx - this.x);
    this.vx = this.vx * 0.95 + Math.cos(a) * 0.025 * this.spd;
    this.vy = this.vy * 0.95 + Math.sin(a) * 0.025 * this.spd;
    const nx = this.x + this.vx, ny = this.y + this.vy;
    if (!W.solidAt(nx + Math.sign(this.vx) * 7, this.y)) this.x = nx; else this.vx = 0;
    if (!W.solidAt(this.x, ny + Math.sign(this.vy) * 7)) this.y = ny; else this.vy = 0;
    if (Math.abs(this.vx) > 0.05) this.face = this.vx < 0 ? -1 : 1;
  }
  light() { return { x: this.x + this.face * 9, y: this.y - 10, r: 26, a: 0.9 }; }
  draw(ctx) {
    const f = this.face, x = Math.round(this.x), y = Math.round(this.y);
    line(ctx, x + f * 1, y - 6, x + f * 5, y - 11, '#3a3050');
    line(ctx, x + f * 5, y - 11, x + f * 9, y - 10, '#3a3050');
    disc(ctx, x + f * 9, y - 10, 2.5, '#fff3a0'); px(ctx, x + f * 9, y - 10, '#ffffff');
    tri(ctx, x - f * 6, y, x - f * 11, y - 4, x - f * 11, y + 4, '#2a2440');
    disc(ctx, x, y, 7.5, '#0b0e1c'); disc(ctx, x, y, 6.5, '#2e2848'); disc(ctx, x - f * 2, y - 2, 3, '#3e3660');
    ellipse(ctx, x + f * 4, y + 2, 3.5, 3, '#0b0e1c');
    for (let i = 0; i < 3; i++) { px(ctx, x + f * (2 + i * 2), y, '#ffffff'); px(ctx, x + f * (2 + i * 2), y + 4, '#ffffff'); }
    px(ctx, x + f * 2, y - 3, '#ffd040', 2, 2); px(ctx, x + f * 3, y - 3, '#0b0e1c');
    px(ctx, x - f * 3, y + 3, '#5a4a8a'); px(ctx, x - f * 1, y - 5, '#5a4a8a');
  }
}

// ---------------- BOSS: the Leviathan ----------------
class Boss extends Base {
  constructor(d, W) {
    super(d, W);
    this.r = 12; this.ang = 0; this.speed = 0.9; this.segs = [];
    for (let i = 0; i < 20; i++) this.segs.push({ x: this.x - i * 9, y: this.y });
    this.state = 'hunt'; this.timer = 200; this.stun = 0; this.leaving = false;
  }
  hurtBy() { this.stun = 70; this.flash = 70; }
  update(W) {
    super.update();
    const p = W.player;
    if (this.leaving) {
      this.ang += 0.02; this.x += Math.cos(this.ang) * 1.5; this.y += 1.2;
    } else if (this.stun > 0) {
      this.stun--; this.x += Math.cos(this.ang) * 0.3; this.y += Math.sin(this.ang) * 0.3;
    } else {
      const target = Math.atan2(p.y - this.y, p.x - this.x);
      let da = target - this.ang;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      const turn = this.state === 'lunge' ? 0.012 : 0.035;
      this.ang += Math.max(-turn, Math.min(turn, da));
      let s = this.speed * (0.85 + W.spec.diff * 0.25);
      this.timer--;
      if (this.state === 'hunt' && this.timer <= 0) { this.state = 'wind'; this.timer = 40; W.sfx('roar'); W.shake = 6; }
      else if (this.state === 'wind') { s *= 0.2; if (this.timer <= 0) { this.state = 'lunge'; this.timer = 55; } }
      else if (this.state === 'lunge') { s = 3.1; if (this.timer <= 0) { this.state = 'hunt'; this.timer = 220 + Math.random() * 80; } }
      this.x += Math.cos(this.ang) * s; this.y += Math.sin(this.ang) * s;
      // stay inside arena bounds
      const m = 20;
      this.x = Math.max(m, Math.min(W.L.w * TILE - m, this.x));
      this.y = Math.max(m, Math.min(W.L.h * TILE - m, this.y));
    }
    let prev = { x: this.x, y: this.y };
    for (const sg of this.segs) {
      const dx = sg.x - prev.x, dy = sg.y - prev.y, dd = Math.hypot(dx, dy) || 1;
      if (dd > 8) { sg.x = prev.x + (dx / dd) * 8; sg.y = prev.y + (dy / dd) * 8; }
      prev = sg;
    }
  }
  touches(x, y, r) {
    if (this.leaving) return false;
    if (dist(x, y, this.x, this.y) < r + 11) return true;
    return this.segs.some((s, i) => dist(x, y, s.x, s.y) < r + Math.max(3, 9 - i * 0.35));
  }
  light() { return { x: this.x, y: this.y, r: 40, a: 0.7 }; }
  draw(ctx) {
    const fl = this.flash > 0 && (this.flash >> 2) % 2;
    for (let i = this.segs.length - 1; i >= 0; i--) {
      const s = this.segs[i], r = Math.max(3, 9.5 - i * 0.35);
      disc(ctx, s.x, s.y, r + 1, '#02030a');
      disc(ctx, s.x, s.y, r, fl ? '#ffffff' : i % 2 ? '#1c2e4a' : '#22385a');
      if (i % 2 === 0) px(ctx, s.x - 1, s.y - r + 2, '#3af0ff', 2, 2);
      if (i % 3 === 0) tri(ctx, s.x - 2, s.y - r, s.x + 2, s.y - r, s.x, s.y - r - 4, '#3a5a8a');
    }
    const x = Math.round(this.x), y = Math.round(this.y);
    const ca = Math.cos(this.ang), sa = Math.sin(this.ang);
    const open = this.state === 'lunge' || this.state === 'wind' ? 4 : 1;
    disc(ctx, x, y, 13, '#02030a');
    disc(ctx, x, y, 12, fl ? '#ffffff' : '#22385a');
    disc(ctx, x - ca * 3, y - sa * 3, 8, fl ? '#e0e0ff' : '#2c4670');
    // jaws
    const jx = x + ca * 9, jy = y + sa * 9;
    disc(ctx, jx, jy, 5 + open * 0.5, '#4a0814');
    for (let k = -2; k <= 2; k++) px(ctx, jx + -sa * k * 2.2 - 1, jy + ca * k * 2.2 - 1, '#ffffff', 2, 2);
    // eyes
    px(ctx, x + ca * 4 - sa * 6 - 1, y + sa * 4 + ca * 6 - 1, '#ff3030', 3, 3);
    px(ctx, x + ca * 4 + sa * 6 - 1, y + sa * 4 - ca * 6 - 1, '#ff3030', 3, 3);
    for (let k = 0; k < 5; k++) px(ctx, x - ca * 6 + Math.cos(k * 1.3) * 6, y - sa * 6 + Math.sin(k * 1.3) * 6, '#3af0ff');
  }
}

function W_LIGHT(e, r, a) { return { x: e.x, y: e.y, r, a }; }

const TYPES = { fish: Fish, crab: Crab, jelly: Jelly, urchin: Urchin, puffer: Puffer, eel: Eel, clam: Clam, mine: Mine, spike: Spike, spinner: Spinner, shark: Shark, angler: Angler, boss: Boss };

export function makeEnemy(d, W) {
  const C = TYPES[d.type];
  return C ? new C(d, W) : null;
}
