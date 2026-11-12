// Chapter 2 enemies (sentinel, zapper, sludge, gas vent, drone) and the five bosses.
// Registers itself into TYPES of enemies.js.
import { TILE } from '../level/grid.js';
import { disc, ellipse, tri, line, px } from '../gfx/pixel.js';
import { drawText } from '../engine/font.js';
import { Base, TYPES, W_LIGHT } from './enemies.js';

const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const rnd = (a, b) => a + Math.random() * (b - a);

function shoot(W, x, y, tx, ty, speed, o = {}) {
  const a = Math.atan2(ty - y, tx - x);
  W.shots.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life: o.life || 240, col: o.col, r: o.r, killable: o.killable, home: o.home });
}

// ---------- stationary energy turret ----------
class Sentinel extends Base {
  constructor(d, W) {
    super(d, W);
    this.y = d.ty * TILE + TILE - 6; this.r = 6; this.timer = 80 + Math.random() * 80; this.charge = 0; this.hp = 2;
    this.col = W.biome === 10 ? ['#ffd23f', '#a07a10'] : W.biome === 9 ? ['#b6ff3a', '#4a8a10'] : ['#3af0ff', '#1a6a9a'];
  }
  get harmful() { return false; }
  update(W) {
    super.update();
    const p = W.player;
    const sees = dist(p.x, p.y, this.x, this.y) < 150 && !p.dead && W.los(this.x, this.y - 6, p.x, p.y, 6);
    if (this.charge > 0) {
      if (--this.charge === 0) { shoot(W, this.x, this.y - 7, p.x, p.y, 1.25 * this.spd, { col: this.col[0], r: 2.5 }); W.sfx('pearl'); this.timer = 150 / this.spd; }
    } else if (--this.timer <= 0 && sees) this.charge = 30;
  }
  light() { return W_LIGHT({ x: this.x, y: this.y - 6 }, this.charge ? 22 : 12, 0.7); }
  draw(ctx) {
    const x = Math.round(this.x), y = Math.round(this.y), on = this.charge > 0 && (this.charge >> 2) % 2;
    px(ctx, x - 6, y + 1, '#0b0e1c', 13, 5); px(ctx, x - 5, y + 2, '#5d6478', 11, 3);
    px(ctx, x - 2, y - 3, '#0b0e1c', 5, 5); px(ctx, x - 1, y - 2, '#8a96aa', 3, 4);
    disc(ctx, x, y - 7, 4.5, '#0b0e1c'); disc(ctx, x, y - 7, 3.5, on ? '#ffffff' : this.col[1]); disc(ctx, x, y - 7, 2, on ? this.col[0] : this.col[0]);
    if (this.flash > 0) disc(ctx, x, y - 7, 3, '#ffffff');
    px(ctx, x - 1, y - 9, '#ffffff');
  }
}

// ---------- floating electric orb that pulses ----------
class Zapper extends Base {
  constructor(d, W) {
    super(d, W);
    this.y0 = d.y0 * TILE + 8; this.y1 = d.y1 * TILE + 8; this.dir = 1; this.r = 5;
    this.cycle = 0; this.period = Math.round(170 / this.spd); this.cycle = Math.floor(Math.random() * this.period);
  }
  get ring() { const k = this.cycle - (this.period - 24); return k > 0 ? 6 + k * 1.4 : 0; }
  update(W) {
    super.update();
    this.y += this.dir * 0.35 * this.spd;
    if (this.y < this.y0) { this.y = this.y0; this.dir = 1; }
    if (this.y > this.y1) { this.y = this.y1; this.dir = -1; }
    this.cycle++;
    if (this.cycle === this.period - 24 && dist(W.player.x, W.player.y, this.x, this.y) < 160) W.sfx('crack');
    if (this.cycle >= this.period) this.cycle = 0;
  }
  touches(x, y, r) {
    const d = dist(x, y, this.x, this.y);
    if (d < r + this.r) return true;
    const R = this.ring;
    return R > 0 && Math.abs(d - R) < r + 2;
  }
  light() { return W_LIGHT(this, this.ring ? this.ring + 10 : 16, 0.7); }
  draw(ctx, W) {
    const x = Math.round(this.x), y = Math.round(this.y), warn = this.cycle > this.period - 60;
    const R = this.ring;
    if (R) for (let i = 0; i < 20; i++) { const a = (i / 20) * 6.28 + this.t * 0.2; px(ctx, x + Math.cos(a) * R, y + Math.sin(a) * R, i % 2 ? '#ffffff' : '#7affff', 2, 2); }
    for (let i = 0; i < 4; i++) {
      const a = this.t * 0.15 + i * 1.57, l = warn ? 9 : 7;
      line(ctx, x, y, x + Math.cos(a) * l + rnd(-1, 1), y + Math.sin(a) * l + rnd(-1, 1), warn && (this.t >> 1) % 2 ? '#ffffff' : '#7affff');
    }
    disc(ctx, x, y, 5.5, '#0b0e1c'); disc(ctx, x, y, 4.5, warn && (this.t >> 2) % 2 ? '#ffffff' : '#3a8aff'); disc(ctx, x, y, 2.5, '#d8f4ff');
  }
}

// ---------- hopping toxic blob ----------
class Sludge extends Base {
  light() { return W_LIGHT(this, 14, 0.5); }
  constructor(d, W) {
    super(d, W);
    this.x0 = d.x0 * TILE + 6; this.x1 = d.x1 * TILE + 10; this.floor = d.ty * TILE + TILE;
    this.y = this.floor - 5; this.vy = 0; this.vx = 0; this.air = false; this.timer = 40 + Math.random() * 60; this.r = 5;
  }
  get dashable() { return true; }
  update(W) {
    super.update();
    const p = W.player;
    if (!this.air) {
      if (--this.timer <= 0) {
        const near = Math.abs(p.x - this.x) < 90 && Math.abs(p.y - this.y) < 70;
        this.vx = (near ? Math.sign(p.x - this.x) : Math.random() < 0.5 ? -1 : 1) * 0.9 * this.spd;
        this.vy = -(near ? 2.6 : 1.8); this.air = true; this.timer = near ? 40 : 80;
      }
    } else {
      this.vy += 0.09; this.x += this.vx; this.y += this.vy;
      if (this.x < this.x0 || this.x > this.x1) { this.vx = -this.vx; this.x = Math.max(this.x0, Math.min(this.x1, this.x)); }
      if (this.y < this.floor - 40 || W.solidAt(this.x, this.y - 5)) this.vy = Math.max(this.vy, 0.3);
      if (this.y >= this.floor - 5) { this.y = this.floor - 5; this.air = false; this.vx = 0; W.burst(this.x, this.floor - 2, 'spark', 3, '#b6ff3a'); }
    }
  }
  draw(ctx) {
    const x = Math.round(this.x), y = Math.round(this.y), sq = this.air ? -1 : Math.round(Math.sin(this.t * 0.2));
    ellipse(ctx, x, y + 1, 7 - sq, 5 + sq, '#0b0e1c'); ellipse(ctx, x, y + 1, 6 - sq, 4 + sq, '#4a9a14'); ellipse(ctx, x - 1, y, 4 - sq, 2 + sq, '#8ae02a');
    px(ctx, x - 3, y - 1, '#ffffff', 2, 2); px(ctx, x + 1, y - 1, '#ffffff', 2, 2); px(ctx, x - 2, y, '#0b0e1c'); px(ctx, x + 2, y, '#0b0e1c');
    if ((this.t >> 3) % 4 === 0) px(ctx, x + 3, y - 4, '#d0ff6a');
  }
}

// ---------- toxic gas column (indestructible) ----------
class GasVent extends Base {
  constructor(d, W) {
    super(d, W);
    this.y = d.ty * TILE + TILE; this.top = d.top * TILE + 4; this.r = 6;
    this.period = 260; this.cycle = Math.floor(Math.random() * 260);
  }
  get on() { return this.cycle > 120 && this.cycle < 220; }
  get warn() { return this.cycle > 80 && this.cycle <= 120; }
  update(W) {
    super.update();
    this.cycle = (this.cycle + 1) % this.period;
    if (this.cycle === 121 && dist(W.player.x, W.player.y, this.x, this.y) < 200) W.sfx('bubble');
    const h = this.y - this.top;
    if (this.on && this.t % 3 === 0) W.parts.push({ x: this.x + rnd(-5, 5), y: this.y - 3, vx: rnd(-0.2, 0.2), vy: rnd(-2.4, -1.6), life: Math.min(90, h / 1.9), max: 90, type: 'spark', color: Math.random() < 0.5 ? '#b6ff3a' : '#6ac020', sz: 2 });
    if (this.warn && this.t % 6 === 0) W.parts.push({ x: this.x + rnd(-3, 3), y: this.y - 3, vx: 0, vy: -0.4, life: 20, max: 20, type: 'spark', color: '#b6ff3a', sz: 1 });
  }
  touches(x, y, r) { return this.on && Math.abs(x - this.x) < 6 + r && y < this.y && y > this.top; }
  light() { return this.on || this.warn ? { x: this.x, y: this.y - 20, r: 30, a: 0.6 } : { x: this.x, y: this.y - 3, r: 12, a: 0.5 }; }
  draw(ctx) {
    const x = Math.round(this.x), y = this.y;
    if (this.on) { ctx.fillStyle = 'rgba(160,255,60,0.18)'; ctx.fillRect(x - 6, this.top, 12, y - this.top); }
    px(ctx, x - 6, y - 4, '#0b0e1c', 13, 4); px(ctx, x - 5, y - 3, '#6a5a30', 11, 2); px(ctx, x - 3, y - 5, '#0b0e1c', 7, 2);
    px(ctx, x - 2, y - 4, this.on ? '#b6ff3a' : this.warn && (this.t >> 2) % 2 ? '#b6ff3a' : '#2e3a10', 5, 1);
  }
}

// ---------- patrol drone with a blaster ----------
class Drone extends Base {
  constructor(d, W) {
    super(d, W);
    this.x0 = d.x0 * TILE + 8; this.x1 = d.x1 * TILE + 8; this.baseY = this.y; this.dir = Math.random() < 0.5 ? -1 : 1;
    this.aim = 0; this.cool = 60; this.r = 6;
  }
  get dashable() { return true; }
  update(W) {
    super.update();
    const p = W.player;
    if (this.cool > 0) this.cool--;
    if (this.aim > 0) {
      if (--this.aim === 0) { shoot(W, this.x, this.y + 2, p.x, p.y, 1.45 * this.spd, { col: '#ff4040', r: 2 }); W.sfx('pearl'); this.cool = 170 / this.spd; }
    } else {
      this.x += this.dir * 0.55 * this.spd;
      if (this.x < this.x0) { this.x = this.x0; this.dir = 1; }
      if (this.x > this.x1) { this.x = this.x1; this.dir = -1; }
      if (this.cool <= 0 && !p.dead && dist(p.x, p.y, this.x, this.y) < 120 && W.los(this.x, this.y, p.x, p.y, 6)) { this.aim = 32; this.ax = p.x; this.ay = p.y; }
    }
    this.y = this.baseY + Math.sin(this.t * 0.06) * 2;
  }
  light() { return W_LIGHT(this, 16, 0.6); }
  draw(ctx, W) {
    const x = Math.round(this.x), y = Math.round(this.y);
    if (this.aim > 0 && (this.aim >> 1) % 2) line(ctx, x, y + 2, W.player.x, W.player.y, 'rgba(255,60,60,0.5)');
    const r = (this.t >> 1) % 2;
    px(ctx, x - 8, y - 6, '#0b0e1c', 17, 2); px(ctx, x - 7 + r * 2, y - 6, '#c8d0e0', 5, 1); px(ctx, x + 2 - r * 2, y - 6, '#c8d0e0', 5, 1);
    px(ctx, x - 1, y - 5, '#0b0e1c', 3, 2);
    ellipse(ctx, x, y, 7, 4.5, '#0b0e1c'); ellipse(ctx, x, y, 6, 3.5, '#56626e'); ellipse(ctx, x, y - 1, 4, 1.5, '#8a96aa');
    disc(ctx, x + this.dir * 2, y + 1, 2, this.aim ? '#ff4040' : '#ffd23f');
    px(ctx, x - 4, y + 4, '#0b0e1c', 2, 2); px(ctx, x + 3, y + 4, '#0b0e1c', 2, 2);
  }
}

// =================== BOSSES ===================
const BOSS_INFO = {
  crabking: { name: 'CRAB KING', hp: 12 },
  pufferking: { name: 'PUFFER OVERLORD', hp: 12 },
  hydra: { name: 'HYDRA', hp: 12 },
  mechashark: { name: 'MECHA SHARK', hp: 14 },
  kraken: { name: 'THE KRAKEN', hp: 14 },
};

class BossBase extends Base {
  constructor(d, W) {
    super(d, W);
    const info = BOSS_INFO[d.kind];
    this.boss2 = true; this.kind = d.kind; this.name = info.name; this.hp = this.maxHp = info.hp;
    this.dying = 0; this.invT = 0; this.awake = 90;
  }
  get harmful() { return this.dying === 0; }
  get armored() { return false; }
  get weak() { return false; }
  get phase2() { return this.hp <= this.maxHp / 2; }
  aimPoint() { return { x: this.x, y: this.y }; }
  hit(W, dmg, x, y) {
    if (this.invT > 0 || this.dying) return;
    this.hp = Math.max(0, this.hp - dmg); this.flash = 14; this.invT = 24;
    W.sfx(this.hp > 0 ? 'kill' : 'boom'); W.shake = Math.max(W.shake, 6); W.buzz(50);
    W.burst(x, y, 'spark', 14, '#ffffff');
    W.popup(dmg > 1 ? `-${dmg} CRITICAL!` : `-${dmg}`, x, y - 10, '#ffd23f');
    if (this.hp <= 0) { this.dying = 1; W.sfx('roar'); W.shots.length = 0; }
  }
  update(W) {
    super.update();
    if (this.invT > 0) this.invT--;
    if (this.awake > 0) this.awake--;
    if (this.dying) {
      this.dying++;
      if (this.dying % 8 === 0) { W.burst(this.x + rnd(-24, 24), this.y + rnd(-16, 16), 'fire', 10); W.sfx('boom'); W.shake = 8; }
      if (this.dying > 130) { this.alive = false; W.bossDefeated(this); }
      return true;
    }
    return this.awake > 0;
  }
  // default player contact: dash the weak spot for 2 damage, otherwise it hurts
  onPlayer(W, p) {
    if (this.dying || !this.touches(p.x, p.y, 5.5)) return;
    if (p.dashT > 0 && this.weak) {
      this.hit(W, 2, p.x, p.y);
      const a = Math.atan2(p.y - this.y, p.x - this.x);
      p.vx = Math.cos(a) * 4; p.vy = Math.sin(a) * 4; p.dashT = 0; p.inv = Math.max(p.inv, 40);
    } else if (this.harmful) W.hurt(this.x, this.y);
  }
  onHarpoon(W, h) {
    if (this.dying || !this.touches(h.x, h.y, 3)) return false;
    if (this.armored) {
      W.sfx('bounce'); W.burst(h.x, h.y, 'spark', 6, '#c8d0e0');
      if (!this.tipT || this.t - this.tipT > 90) { this.tipT = this.t; W.popup({ crabking: 'WAIT TILL HE IS DIZZY', mechashark: 'MAKE IT CRASH FIRST', pufferking: 'WAIT TILL HE SHRINKS' }[this.kind] || 'ARMORED!', h.x, h.y - 8, '#9aa4b8'); }
    }
    else this.hit(W, 1, h.x, h.y);
    return true;
  }
  light() { return { x: this.x, y: this.y, r: 70, a: 0.8 }; }
  fl() { return this.flash > 0 && (this.flash >> 1) % 2; }
  fade(ctx) { if (this.dying) ctx.globalAlpha = Math.max(0.1, 1 - this.dying / 140); }
}

const floorBelow = (W, x, y) => { let yy = y; while (yy < W.ph && !W.solidAt(x, yy)) yy += 2; return yy; };
// the arena's bottom floor under x (skips floating platforms)
const floorBottom = (W, x) => { let yy = W.ph - 2; while (yy > 0 && W.solidAt(x, yy)) yy -= 2; return floorBelow(W, x, yy); };

// ---- 55: Crab King. Walks, leaps and slams the floor; flips over dizzy after a slam ----
class CrabKing extends BossBase {
  constructor(d, W) {
    super(d, W);
    this.floor = floorBottom(W, this.x); this.y = this.floor - 12; this.vx = 0; this.vy = 0;
    this.state = 'walk'; this.timer = 120; this.face = 1;
  }
  get weak() { return this.state === 'dizzy'; }
  get armored() { return this.state !== 'dizzy'; } // shell is only open while he's dizzy
  touches(x, y, r) { return Math.abs(x - this.x) < 20 + r && Math.abs(y - this.y) < 11 + r; }
  update(W) {
    if (super.update(W)) return;
    const p = W.player, sp = this.spd * (this.phase2 ? 1.3 : 1);
    this.timer--;
    if (this.state === 'walk') {
      this.face = p.x < this.x ? -1 : 1;
      this.vx = this.face * 0.75 * sp;
      if (this.timer <= 0) { this.state = 'crouch'; this.timer = 24; W.sfx('crack'); }
    } else if (this.state === 'crouch') {
      this.vx = 0;
      if (this.timer <= 0) { this.state = 'jump'; this.vy = -4.6; this.vx = Math.max(-2.4, Math.min(2.4, (p.x - this.x) / 45)); }
    } else if (this.state === 'jump') {
      this.vy += 0.13;
      if (this.vy > 0 && this.y >= floorBelow(W, this.x, this.y - 10) - 12) {
        this.floor = floorBelow(W, this.x, this.y - 10); this.y = this.floor - 12; this.vx = 0; this.vy = 0;
        this.state = 'dizzy'; this.timer = this.phase2 ? 80 : 110; W.shake = 12; W.sfx('boom'); W.buzz(80);
        W.burst(this.x, this.floor, 'debris', 18, W.B.rock[2]);
        for (const s of [-1, 1]) W.shots.push({ x: this.x + s * 22, y: this.floor - 5, vx: s * 2.1, vy: 0, life: 150, col: '#ffffff', r: 3, wave: true });
        if (this.phase2) for (let i = 0; i < 6; i++) { const a = -Math.PI * (0.15 + i * 0.14); W.shots.push({ x: this.x, y: this.y - 8, vx: Math.cos(a) * 1.6, vy: Math.sin(a) * 1.6, life: 200, col: '#ff8a5a', r: 2.5 }); }
      }
    } else if (this.state === 'dizzy') {
      if (this.timer <= 0) { this.state = 'walk'; this.timer = 100 + Math.random() * 60; }
    }
    // move with simple wall checks
    const nx = this.x + this.vx;
    if (!W.solidAt(nx + Math.sign(this.vx) * 22, this.y - 4)) this.x = nx; else this.vx = 0;
    if (this.state === 'jump') { const ny = this.y + this.vy; if (this.vy < 0 && W.solidAt(this.x, ny - 12)) this.vy = 0.5; else this.y = ny; }
    else { this.floor = floorBelow(W, this.x, this.y - 6); const dy = this.floor - 12 - this.y; this.y += Math.max(-2, Math.min(3, dy * 0.3 + (dy > 0 ? 0.5 : 0))); }
  }
  draw(ctx) {
    this.fade(ctx);
    const x = Math.round(this.x), y = Math.round(this.y), f = this.fl(), dz = this.state === 'dizzy';
    const shell = f ? '#ffffff' : '#c8402a', dark = '#7a1a10', walk = Math.floor(this.t / 6) % 2;
    // legs
    for (let i = 0; i < 3; i++) for (const s of [-1, 1]) {
      const lx = x + s * (8 + i * 5), ly = y + 6, up = (walk + i) % 2 && this.state === 'walk' ? -2 : 0;
      line(ctx, lx, ly, lx + s * 5, ly + 6 + up, '#0b0e1c', 3); line(ctx, lx, ly, lx + s * 5, ly + 6 + up, dark);
    }
    // claws
    const cl = this.state === 'crouch' ? 4 : 0;
    for (const s of [-1, 1]) {
      const cx = x + s * 24, cy = y - 6 - cl;
      line(ctx, x + s * 14, y - 2, cx, cy + 4, '#0b0e1c', 3);
      ellipse(ctx, cx, cy, 7, 5, '#0b0e1c'); ellipse(ctx, cx, cy, 6, 4, shell); tri(ctx, cx + s * 2, cy - 1, cx + s * 9, cy - 5, cx + s * 7, cy + 1, '#0b0e1c');
      px(ctx, cx - 2, cy - 2, '#ff9a7a', 3, 1);
    }
    // body + crown
    ellipse(ctx, x, y, 20, 11, '#0b0e1c'); ellipse(ctx, x, y, 19, 10, shell); ellipse(ctx, x, y + 3, 15, 5, dark);
    for (let i = -12; i <= 12; i += 6) px(ctx, x + i, y - 6, '#ff8a6a', 3, 2);
    px(ctx, x - 7, y - 16, '#0b0e1c', 15, 6); px(ctx, x - 6, y - 15, '#ffd23f', 13, 4);
    for (const c of [-6, 0, 6]) px(ctx, x + c, y - 18, '#ffd23f', 1, 3);
    px(ctx, x - 1, y - 14, '#3af0ff', 2, 2);
    // eye stalks
    for (const s of [-1, 1]) {
      line(ctx, x + s * 5, y - 8, x + s * 6, y - 13, '#0b0e1c', 2);
      disc(ctx, x + s * 6, y - 13, 2.5, '#0b0e1c'); disc(ctx, x + s * 6, y - 13, 1.5, '#ffffff');
      if (!dz) px(ctx, x + s * 6 + this.face, y - 13, '#0b0e1c'); else px(ctx, x + s * 6 + Math.round(Math.cos(this.t * 0.3)), y - 13 + Math.round(Math.sin(this.t * 0.3)), '#0b0e1c');
    }
    if (dz) for (let i = 0; i < 3; i++) { const a = this.t * 0.12 + i * 2.1; px(ctx, x + Math.cos(a) * 12, y - 22 + Math.sin(a) * 3, '#fff3a0', 2, 2); }
    if (dz && (this.t >> 3) % 2) drawText(ctx, 'DASH IT!', x, y - 32, '#ffffff', { align: 'center', outline: '#0b0e1c' });
    ctx.globalAlpha = 1;
  }
}

// ---- 60: Puffer Overlord. Swells up, sprays spines; only soft when deflated ----
class PufferKing extends BossBase {
  constructor(d, W) { super(d, W); this.state = 'drift'; this.timer = 150; this.inf = 0; this.vx = 0; this.vy = 0; this.face = 1; }
  get rad() { return 14 + this.inf * 12; }
  get armored() { return this.inf > 0.4; }
  get weak() { return this.inf < 0.3; }
  touches(x, y, r) { return dist(x, y, this.x, this.y) < this.rad + r; }
  update(W) {
    if (super.update(W)) return;
    const p = W.player, sp = this.spd * (this.phase2 ? 1.25 : 1);
    this.timer--;
    if (this.state === 'drift') {
      const a = Math.atan2(p.y - this.y, p.x - this.x);
      this.vx = this.vx * 0.96 + Math.cos(a) * 0.018 * sp; this.vy = this.vy * 0.96 + Math.sin(a) * 0.018 * sp;
      this.inf = Math.max(0, this.inf - 0.03);
      if (this.timer <= 0) { this.state = 'swell'; this.timer = 40; W.sfx('bubble'); }
    } else if (this.state === 'swell') {
      this.vx *= 0.9; this.vy *= 0.9; this.inf = Math.min(1, this.inf + 0.03);
      if (this.timer <= 0) { this.state = 'spray'; this.timer = this.phase2 ? 90 : 50; this.volley = 0; }
    } else if (this.state === 'spray') {
      if (this.timer % 40 === 0 || this.timer === (this.phase2 ? 89 : 49)) {
        const n = this.phase2 ? 14 : 10, off = this.volley++ * 0.3;
        for (let i = 0; i < n; i++) { const a = (i / n) * 6.28 + off; W.shots.push({ x: this.x + Math.cos(a) * this.rad, y: this.y + Math.sin(a) * this.rad, vx: Math.cos(a) * 1.5, vy: Math.sin(a) * 1.5, life: 220, col: '#fff3a0', r: 2 }); }
        W.sfx('pearl');
      }
      if (this.timer <= 0) { this.state = 'drift'; this.timer = this.phase2 ? 120 : 170; }
    }
    const nx = this.x + this.vx, ny = this.y + this.vy, R = this.rad;
    if (!W.solidAt(nx + Math.sign(this.vx) * R, this.y)) this.x = nx; else this.vx *= -0.5;
    if (!W.solidAt(this.x, ny + Math.sign(this.vy) * R)) this.y = ny; else this.vy *= -0.5;
    // push out of walls if swelling made it overlap
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (W.solidAt(this.x + dx * R, this.y + dy * R)) { this.x -= dx * 0.8; this.y -= dy * 0.8; }
    this.face = p.x < this.x ? -1 : 1;
  }
  draw(ctx) {
    this.fade(ctx);
    const x = Math.round(this.x), y = Math.round(this.y), r = this.rad, f = this.fl();
    if (this.inf > 0.2) for (let i = 0; i < 22; i++) { const a = (i / 22) * 6.28; line(ctx, x + Math.cos(a) * r, y + Math.sin(a) * r, x + Math.cos(a) * (r + 4), y + Math.sin(a) * (r + 4), '#fff3a0', 2); }
    else tri(ctx, x - this.face * r, y, x - this.face * (r + 9), y - 7, x - this.face * (r + 9), y + 7, '#c89a20');
    disc(ctx, x, y, r + 1, '#0b0e1c'); disc(ctx, x, y, r, f ? '#ffffff' : '#c8d040'); ellipse(ctx, x, y + r * 0.35, r * 0.75, r * 0.45, '#f0f0b0');
    for (let i = 0; i < 6; i++) px(ctx, x - r * 0.5 + i * r * 0.2, y - r * 0.5 + (i % 2) * 3, '#6a7a10', 2, 2);
    const ex = x + this.face * r * 0.45;
    disc(ctx, ex, y - 3, 4, '#ffffff'); disc(ctx, ex + this.face, y - 3, 2, '#b3202e');
    px(ctx, x + this.face * r * 0.7, y + 3, '#0b0e1c', 3, 2);
    // crown
    px(ctx, x - 6, y - r - 6, '#0b0e1c', 13, 6); px(ctx, x - 5, y - r - 5, '#ffd23f', 11, 4); for (const c of [-5, 0, 5]) px(ctx, x + c, y - r - 8, '#ffd23f', 1, 3);
    if (this.weak && !this.dying && (this.t >> 4) % 3 === 0) drawText(ctx, 'SOFT!', x, y - r - 16, '#ffffff', { align: 'center', outline: '#0b0e1c' });
    ctx.globalAlpha = 1;
  }
}

// ---- 65: Hydra. Three heads on long necks; each head must be beaten ----
class Hydra extends BossBase {
  constructor(d, W) {
    super(d, W);
    this.floor = floorBottom(W, this.x); this.y = this.floor - 14;
    this.heads = [-1, 0, 1].map((k, i) => ({ k, hp: 4, x: this.x + k * 30, y: this.y - 60, ext: 0, state: 'sway', timer: 60 + i * 50, flash: 0 }));
  }
  get armored() { return true; }
  base(h) { return { x: this.x + h.k * 12, y: this.y - 8 }; }
  aimPoint(W) {
    let best = null, bd = 1e9;
    for (const h of this.heads) if (h.hp > 0) { const d = Math.hypot(h.x - W.player.x, h.y - W.player.y); if (d < bd) { bd = d; best = h; } }
    return best ? { x: best.x, y: best.y } : { x: this.x, y: this.y };
  }
  rest(h) { return { x: this.x + h.k * 38 + Math.sin(this.t * 0.03 + h.k) * 10, y: this.y - 64 + Math.cos(this.t * 0.04 + h.k * 2) * 8 - (h.k === 0 ? 14 : 0) }; }
  touches(x, y, r) {
    if (Math.abs(x - this.x) < 22 + r && Math.abs(y - this.y) < 14 + r) return true;
    for (const h of this.heads) {
      if (h.hp <= 0) continue;
      const b = this.base(h);
      for (let i = 1; i <= 6; i++) { const k = i / 7; if (dist(x, y, b.x + (h.x - b.x) * k, b.y + (h.y - b.y) * k) < 3 + r) return true; }
      if (dist(x, y, h.x, h.y) < 7 + r) return true;
    }
    return false;
  }
  hitHead(W, h, dmg) {
    if (this.invT > 0 || h.hp <= 0) return;
    h.hp -= dmg; h.flash = 14; h.state = 'retreat';
    this.hit(W, dmg, h.x, h.y);
    if (h.hp <= 0) { W.burst(h.x, h.y, 'fire', 16); W.popup('HEAD DOWN!', h.x, h.y - 14, '#ff8ad8'); }
  }
  onPlayer(W, p) {
    if (this.dying) return;
    for (const h of this.heads) if (h.hp > 0 && dist(p.x, p.y, h.x, h.y) < 12) {
      if (p.dashT > 0) { this.hitHead(W, h, 2); const a = Math.atan2(p.y - h.y, p.x - h.x); p.vx = Math.cos(a) * 4; p.vy = Math.sin(a) * 4; p.dashT = 0; p.inv = Math.max(p.inv, 40); }
      else W.hurt(h.x, h.y);
      return;
    }
    if (this.touches(p.x, p.y, 5.5)) W.hurt(this.x, this.y);
  }
  onHarpoon(W, s) {
    if (this.dying) return false;
    for (const h of this.heads) if (h.hp > 0 && dist(s.x, s.y, h.x, h.y) < 11) { this.hitHead(W, h, 1); return true; }
    // only the body blocks harpoons; they slip past the necks
    if (Math.abs(s.x - this.x) < 22 && Math.abs(s.y - this.y) < 13) { W.sfx('bounce'); if (!this.tipT || this.t - this.tipT > 90) { this.tipT = this.t; W.popup('HIT THE HEADS!', s.x, s.y - 8, '#9aa4b8'); } return true; }
    return false;
  }
  update(W) {
    if (super.update(W)) return;
    const p = W.player, sp = this.spd * (this.phase2 ? 1.25 : 1);
    const alive = this.heads.filter((h) => h.hp > 0).length;
    for (const h of this.heads) {
      if (h.flash > 0) h.flash--;
      const b = this.base(h);
      if (h.hp <= 0) { h.x += (b.x + h.k * 6 - h.x) * 0.1; h.y += (b.y - 10 - h.y) * 0.1; continue; }
      h.timer -= alive === 1 ? 1.6 : 1;
      if (h.state === 'sway') {
        const r = this.rest(h); h.x += (r.x - h.x) * 0.06; h.y += (r.y - h.y) * 0.06;
        if (h.timer <= 0) {
          if (Math.random() < 0.5) { h.state = 'aim'; h.timer = 28; h.tx = p.x; h.ty = p.y; W.sfx('roar'); }
          else { h.state = 'spit'; h.timer = 30; }
        }
      } else if (h.state === 'aim') { h.x += rnd(-1, 1); if (h.timer <= 0) { h.state = 'lunge'; h.timer = 26; } }
      else if (h.state === 'lunge') {
        const d = dist(h.tx, h.ty, b.x, b.y), max = 150, k = Math.min(1, max / (d || 1));
        const gx = b.x + (h.tx - b.x) * k, gy = b.y + (h.ty - b.y) * k;
        h.x += (gx - h.x) * 0.18 * sp; h.y += (gy - h.y) * 0.18 * sp;
        if (h.timer <= 0) { h.state = 'retreat'; }
      } else if (h.state === 'spit') {
        if (h.timer === 12) { shoot(W, h.x, h.y, p.x, p.y, 1.6 * sp, { col: '#b6ff3a', r: 3 }); W.sfx('pearl'); if (this.phase2) { shoot(W, h.x, h.y, p.x + 30, p.y, 1.6 * sp, { col: '#b6ff3a', r: 2.5 }); shoot(W, h.x, h.y, p.x - 30, p.y, 1.6 * sp, { col: '#b6ff3a', r: 2.5 }); } }
        if (h.timer <= 0) h.state = 'retreat';
      } else if (h.state === 'retreat') {
        const r = this.rest(h); h.x += (r.x - h.x) * 0.08; h.y += (r.y - h.y) * 0.08;
        if (dist(h.x, h.y, r.x, r.y) < 6) { h.state = 'sway'; h.timer = 90 + Math.random() * 90; }
      }
    }
  }
  draw(ctx) {
    this.fade(ctx);
    const x = Math.round(this.x), y = Math.round(this.y), f = this.fl();
    for (const h of this.heads) {
      const b = this.base(h), dead = h.hp <= 0, hf = h.flash > 0 && (h.flash >> 1) % 2;
      const n = 8;
      for (let i = 0; i <= n; i++) {
        const k = i / n, sw = Math.sin(k * 3.14) * 8 * h.k;
        const nx = b.x + (h.x - b.x) * k + sw, ny = b.y + (h.y - b.y) * k;
        disc(ctx, nx, ny, 4.5 - k, '#0b0e1c'); disc(ctx, nx, ny, 3.5 - k, dead ? '#3a4a20' : i % 2 ? '#4a8a2a' : '#5aa034');
      }
      if (dead) { disc(ctx, h.x, h.y, 4, '#0b0e1c'); disc(ctx, h.x, h.y, 3, '#6a2a1a'); continue; }
      const fx = Math.sign((W_PLAYER.x || 0) - h.x) || 1, hx = Math.round(h.x), hy = Math.round(h.y);
      const open = h.state === 'lunge' || h.state === 'spit' || h.state === 'aim';
      ellipse(ctx, hx, hy, 9, 6, '#0b0e1c'); ellipse(ctx, hx, hy, 8, 5, hf ? '#ffffff' : '#6ab83a');
      tri(ctx, hx - fx * 4, hy - 4, hx - fx * 9, hy - 10, hx - fx * 1, hy - 5, '#3a6a1a');
      if (open) { ctx.fillStyle = '#5a0a14'; ctx.fillRect(hx + (fx > 0 ? 1 : -9), hy, 8, 3); px(ctx, hx + fx * 4, hy, '#ffffff'); px(ctx, hx + fx * 7, hy + 2, '#ffffff'); }
      px(ctx, hx + fx * 3 - 1, hy - 3, '#ff3030', 3, 2);
      for (let i = 0; i < h.hp; i++) px(ctx, hx - 6 + i * 4, hy - 13, '#ff8ad8', 3, 2);
    }
    ellipse(ctx, x, y, 24, 14, '#0b0e1c'); ellipse(ctx, x, y, 23, 13, f ? '#ffffff' : '#3e7a24'); ellipse(ctx, x, y + 4, 18, 7, '#a8c860');
    for (let i = -16; i <= 16; i += 8) tri(ctx, x + i - 3, y - 11, x + i + 3, y - 11, x + i, y - 17, '#2a5a14');
    ctx.globalAlpha = 1;
  }
}
const W_PLAYER = { x: 0 };

// ---- 70: Mecha Shark. Aims, charges, crashes into walls and sparks; fires torpedoes ----
class MechaShark extends BossBase {
  constructor(d, W) { super(d, W); this.state = 'roam'; this.timer = 120; this.vx = 0; this.vy = 0; this.face = 1; this.cycles = 0; }
  get weak() { return this.state === 'stunned'; }
  get armored() { return this.state !== 'stunned'; } // the core is only exposed after a crash
  touches(x, y, r) { return Math.abs(x - this.x) < 22 + r && Math.abs(y - this.y) < 9 + r; }
  update(W) {
    if (super.update(W)) return;
    const p = W.player, sp = this.spd * (this.phase2 ? 1.2 : 1);
    this.timer--;
    if (this.state === 'roam') {
      const tx = p.x + (this.x < p.x ? -110 : 110), ty = p.y;
      const a = Math.atan2(ty - this.y, tx - this.x);
      this.vx = this.vx * 0.94 + Math.cos(a) * 0.08 * sp; this.vy = this.vy * 0.94 + Math.sin(a) * 0.06 * sp;
      if (this.timer <= 0) {
        this.cycles++;
        if (this.cycles % 3 === 0 || (this.phase2 && this.cycles % 2 === 0)) {
          for (const s of [-1, 1]) W.shots.push({ x: this.x, y: this.y + s * 6, vx: this.face * 1.2, vy: s * 0.6, life: 320, col: '#ffb040', r: 3, killable: true, home: 0.035 });
          W.sfx('dash');
        }
        this.state = 'aim'; this.timer = 40; W.sfx('roar');
      }
    } else if (this.state === 'aim') {
      this.vx *= 0.85; this.vy *= 0.85; this.face = p.x < this.x ? -1 : 1;
      if (this.timer <= 0) { const a = Math.atan2(p.y - this.y, p.x - this.x); this.vx = Math.cos(a) * 4.2 * sp; this.vy = Math.sin(a) * 4.2 * sp; this.state = 'charge'; this.timer = 120; }
    } else if (this.state === 'charge') {
      if (this.timer <= 0) { this.state = 'roam'; this.timer = 100; }
    } else if (this.state === 'stunned') {
      this.vx *= 0.9; this.vy = this.vy * 0.9 + 0.02;
      if (this.t % 5 === 0) W.burst(this.x + rnd(-8, 8), this.y - 6, 'spark', 2, '#ffd23f');
      if (this.timer <= 0) { this.state = 'roam'; this.timer = this.phase2 ? 90 : 130; }
    }
    const nx = this.x + this.vx, ny = this.y + this.vy;
    const hitX = W.solidAt(nx + Math.sign(this.vx) * 22, this.y), hitY = W.solidAt(this.x, ny + Math.sign(this.vy) * 10);
    if (this.state === 'charge' && (hitX || hitY)) {
      this.state = 'stunned'; this.timer = this.phase2 ? 100 : 130; W.shake = 14; W.sfx('boom'); W.buzz(90);
      W.burst(this.x + Math.sign(this.vx) * 22, this.y, 'debris', 16, W.B.rock[2]);
      this.vx = -this.vx * 0.2; this.vy = -this.vy * 0.2;
    }
    if (!hitX) this.x = nx; else this.vx *= -0.3;
    if (!hitY) this.y = ny; else this.vy *= -0.3;
    if (Math.abs(this.vx) > 0.2 && this.state !== 'stunned') this.face = this.vx < 0 ? -1 : 1;
  }
  draw(ctx) {
    this.fade(ctx);
    const f = this.face, x = Math.round(this.x), y = Math.round(this.y), fl = this.fl(), st = this.state === 'stunned';
    const body = fl ? '#ffffff' : '#7a8696', dark = '#3a4450';
    const wag = Math.round(Math.sin(this.t * (this.state === 'charge' ? 0.6 : 0.2)) * 3);
    tri(ctx, x - f * 18, y, x - f * 30, y - 10 + wag, x - f * 28, y + 8 + wag, '#0b0e1c'); tri(ctx, x - f * 18, y, x - f * 28, y - 8 + wag, x - f * 26, y + 6 + wag, dark);
    tri(ctx, x - f * 4, y - 7, x + f * 6, y - 7, x - f * 6, y - 18, '#0b0e1c'); tri(ctx, x - f * 3, y - 7, x + f * 4, y - 7, x - f * 5, y - 15, dark);
    ellipse(ctx, x, y, 23, 10, '#0b0e1c'); ellipse(ctx, x, y, 22, 9, body); ellipse(ctx, x + f * 2, y + 4, 18, 3, '#c8d0e0');
    for (let i = -12; i <= 10; i += 7) px(ctx, x + i, y - 5, dark, 1, 7);
    px(ctx, x - f * 4 - 2, y - 2, '#0b0e1c', 5, 5); px(ctx, x - f * 4 - 1, y - 1, st ? ((this.t >> 2) % 2 ? '#ffd23f' : '#ff4040') : '#3af0ff', 3, 3);
    if (st) { px(ctx, x - f * 4 - 3, y - 6, '#0b0e1c', 7, 2); }
    px(ctx, x + f * 13, y - 3, '#0b0e1c', 4, 3); px(ctx, x + f * 13 + (f > 0 ? 1 : 0), y - 2, this.state === 'aim' || this.state === 'charge' ? '#ff3030' : '#ffd23f', 2, 1);
    ctx.fillStyle = '#0b0e1c'; ctx.fillRect(x + (f > 0 ? 10 : -21), y + 3, 11, 2);
    for (let i = 0; i < 4; i++) px(ctx, x + f * (12 + i * 2), y + 3, '#ffffff');
    if (st && (this.t >> 3) % 2) drawText(ctx, 'DASH THE CORE!', x, y - 26, '#ffffff', { align: 'center', outline: '#0b0e1c' });
    ctx.globalAlpha = 1;
  }
}

// ---- 75: The Kraken. Eight sweeping arms, an eye that opens, ink in the second phase ----
class Kraken extends BossBase {
  constructor(d, W) {
    super(d, W);
    this.hx = this.x; this.hy = this.y - 30; this.y = this.hy;
    this.eye = 0; this.eyeT = 200; this.state = 'idle';
    this.arms = Array.from({ length: 6 }, (_, i) => ({ i, a: Math.PI * (0.15 + (i / 5) * 0.7), len: 70, slam: 0, wind: 0, tx: 0, ty: 0, pts: [] }));
  }
  get weak() { return this.eye > 0.5; }
  get armored() { return this.eye < 0.5; }
  aimPoint() { return { x: this.x, y: this.y + 1 }; }
  armPts(arm) {
    const pts = [], bx = this.x + Math.cos(arm.a) * 14, by = this.y + 10;
    let a = arm.a;
    const n = 12;
    for (let k = 0; k <= n; k++) {
      const f = k / n;
      let x, y;
      if (arm.slam > 0) { x = bx + (arm.tx - bx) * f + Math.sin(f * 6 + this.t * 0.2) * 4 * (1 - f); y = by + (arm.ty - by) * f; }
      else {
        a = arm.a + Math.sin(this.t * 0.035 + arm.i * 1.3 + f * 3) * 0.5 * f;
        x = bx + Math.cos(a) * arm.len * f; y = by + Math.sin(a) * arm.len * f;
        if (arm.wind > 0) { x += rnd(-2, 2) * f; y += rnd(-2, 2) * f; }
      }
      pts.push({ x, y, r: 5 - f * 3.5 });
    }
    return pts;
  }
  touches(x, y, r) {
    if (dist(x, y, this.x, this.y) < 20 + r) return true;
    for (const arm of this.arms) for (const q of arm.pts) if (dist(x, y, q.x, q.y) < q.r + r) return true;
    return false;
  }
  onPlayer(W, p) {
    if (this.dying) return;
    if (dist(p.x, p.y, this.x, this.y - 2) < 18 && p.dashT > 0 && this.weak) {
      this.hit(W, 2, p.x, p.y); const a = Math.atan2(p.y - this.y, p.x - this.x); p.vx = Math.cos(a) * 4.5; p.vy = Math.sin(a) * 4.5; p.dashT = 0; p.inv = Math.max(p.inv, 50);
      return;
    }
    if (this.touches(p.x, p.y, 5.5)) W.hurt(this.x, this.y);
  }
  onHarpoon(W, s) {
    if (this.dying) return false;
    if (dist(s.x, s.y, this.x, this.y - 2) < 22) {
      if (this.weak) this.hit(W, 1, s.x, s.y); else { W.sfx('bounce'); if (!this.tipT || this.t - this.tipT > 90) { this.tipT = this.t; W.popup('WAIT FOR THE EYE!', s.x, s.y - 8, '#9aa4b8'); } }
      return true;
    }
    return false; // harpoons fly through the arms
  }
  light() { return { x: this.x, y: this.y, r: 90, a: 0.85 }; }
  update(W) {
    for (const arm of this.arms) arm.pts = this.armPts(arm);
    if (super.update(W)) return;
    const p = W.player, ph2 = this.phase2, sp = this.spd * (ph2 ? 1.3 : 1);
    // body drifts above the player
    const tx = Math.max(60, Math.min(W.pw - 60, p.x)), ty = this.hy + Math.sin(this.t * 0.02) * 16;
    this.x += (tx - this.x) * 0.006 * sp; this.y += (ty - this.y) * 0.02;
    // eye cycle
    this.eyeT--;
    if (this.eyeT <= 0) { if (this.state === 'idle') { this.state = 'open'; this.eyeT = ph2 ? 170 : 200; W.sfx('roar'); W.popup('THE EYE IS OPEN!', this.x, this.y - 48, '#ffd23f'); } else { this.state = 'idle'; this.eyeT = ph2 ? 130 : 150; } }
    this.eye += ((this.state === 'open' ? 1 : 0) - this.eye) * 0.12;
    // arm slams
    let busy = this.arms.filter((a) => a.slam > 0 || a.wind > 0).length;
    for (const arm of this.arms) {
      if (arm.slam > 0) { arm.slam--; continue; }
      arm.len = 60 + Math.sin(this.t * 0.02 + arm.i) * 14;
      if (arm.wind > 0) { // the arm shakes and glows before it strikes
        if (--arm.wind === 0) { arm.slam = 45; W.sfx('crack'); }
        continue;
      }
      if (busy < (ph2 ? 2 : 1) && Math.random() < (ph2 ? 0.004 : 0.003) * sp && dist(p.x, p.y, this.x, this.y) < 180) {
        arm.wind = 40; busy++; arm.tx = p.x + rnd(-8, 8); arm.ty = p.y + rnd(-8, 8);
        const d = dist(arm.tx, arm.ty, this.x, this.y); if (d > 150) { arm.tx = this.x + (arm.tx - this.x) * 150 / d; arm.ty = this.y + (arm.ty - this.y) * 150 / d; }
      }
    }
    // ink balls in the second phase
    if (ph2 && this.t % 220 === 0) { for (const i of [-1, 1]) shoot(W, this.x, this.y + 8, p.x + i * 24, p.y, 1.2, { col: '#6a3a9a', r: 4, life: 260, killable: true }); W.sfx('bubble'); }
    if (this.t % 600 === 300) { W.inkT = 80; W.burst(this.x, this.y + 10, 'bubble', 20); }
  }
  draw(ctx) {
    this.fade(ctx);
    const x = Math.round(this.x), y = Math.round(this.y), f = this.fl();
    for (const arm of this.arms) {
      const pts = arm.pts;
      for (let k = pts.length - 1; k >= 0; k--) { const q = pts[k]; disc(ctx, q.x, q.y, q.r + 1, '#0b0e1c'); disc(ctx, q.x, q.y, q.r, f ? '#ffffff' : arm.slam ? '#d04a8a' : arm.wind > 0 && (arm.wind >> 2) % 2 ? '#ff6060' : '#a03a7a'); if (k % 2 === 0 && q.r > 2) px(ctx, q.x - 1, q.y + 1, '#ffb0d8', 2, 1); }
    }
    ellipse(ctx, x, y - 6, 22, 26, '#0b0e1c'); ellipse(ctx, x, y - 6, 21, 25, f ? '#ffffff' : '#b04a8a'); ellipse(ctx, x - 6, y - 16, 9, 10, '#c86aa0');
    for (let i = 0; i < 5; i++) px(ctx, x - 12 + i * 6, y - 26 + (i % 2) * 4, '#7a2a5a', 3, 3);
    // the eye
    const e = this.eye;
    ellipse(ctx, x, y + 2, 11, 8, '#0b0e1c');
    if (e > 0.1) {
      ellipse(ctx, x, y + 2, 10, Math.max(1, 7 * e), '#fff3a0');
      ellipse(ctx, x + Math.max(-3, Math.min(3, (W_PLAYER.x - x) / 30)), y + 2, 3, Math.max(1, 6 * e), '#0b0e1c');
    } else { px(ctx, x - 9, y + 2, '#7a2a5a', 19, 2); }
    if (this.weak && !this.dying && (this.t >> 3) % 2) drawText(ctx, 'HIT THE EYE!', x, y - 42, '#ffffff', { align: 'center', outline: '#0b0e1c' });
    ctx.globalAlpha = 1;
  }
}

class Boss2 {
  constructor(d, W) {
    const C = { crabking: CrabKing, pufferking: PufferKing, hydra: Hydra, mechashark: MechaShark, kraken: Kraken }[d.kind] || CrabKing;
    return new C(d, W);
  }
}

// keep a reference to the player for eye/head tracking in draw()
export function trackPlayer(p) { W_PLAYER.x = p.x; }

Object.assign(TYPES, { sentinel: Sentinel, zapper: Zapper, sludge: Sludge, gasvent: GasVent, drone: Drone, boss2: Boss2 });
