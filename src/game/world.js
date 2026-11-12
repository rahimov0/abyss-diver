// Runtime of one level: player physics, pickups, enemies, effects and rendering.
import { T, TILE, Grid, bfs } from '../level/grid.js';
import { currentDiver } from './divers.js';
import { generateLevel } from '../level/generate.js';
import { BIOME } from '../gfx/biomes.js';
import { buildSprites } from '../gfx/sprites.js';
import { renderTiles, renderFar } from '../gfx/levelArt.js';
import { makeEnemy } from './enemies.js';
import { trackPlayer } from './enemies2.js';
import { Ch2 } from './chapter2.js';
import { disc, ellipse, tri, line, px, hash, makeCanvas, mix, hexToRgb as hexRgb } from '../gfx/pixel.js';
import { drawText } from '../engine/font.js';
import { songFor } from '../engine/audio.js';

export const PHYS = { G: 0.04, DRAG: 0.965, ACC: 0.13, THRUST: 0.17, DIVE: 0.09, MAX: 2.7, DASH_V: 5.2, DASH_T: 11, DASH_CD: 38, R: 6.5, BOUNCE: 0.42 };

const rnd = (a, b) => a + Math.random() * (b - a);
// enemies a harpoon just bounces off
const NO_HARP = new Set(['urchin', 'spinner', 'spike']);

export class World {
  constructor(spec, game) {
    this.spec = spec; this.game = game;
    const L = (this.L = generateLevel(spec));
    this.biome = spec.biome; this.B = BIOME[spec.biome];
    this.diver = currentDiver(game.save);
    this.S = buildSprites(this.B, this.diver.pal);
    this.tiles = new Uint8Array(L.tiles);
    this.tileCanvas = renderTiles(L, this.B);
    this.far = renderFar(L, this.B, spec.id * 13);
    this.pw = L.w * TILE; this.ph = L.h * TILE;
    this.player = { x: L.spawn.x, y: L.spawn.y, vx: 0, vy: 0, face: 1, dashT: 0, dashCD: 0, inv: 60, dead: false, prop: 0, bump: 0 };
    this.player.charges = this.maxDash = this.diver.dashes || 1;
    this.shellT = 0; // turtle shell recharge
    this.gems = L.gems.map((g) => ({ ...g, got: false, t: Math.random() * 100 }));
    this.keys = L.keys.map((k) => ({ ...k, got: false }));
    this.chests = L.chests.map((c) => ({ ...c, got: false }));
    this.air = L.air.map((a) => ({ ...a, t: Math.random() * 100 }));
    this.enemies = L.enemies.map((d) => makeEnemy(d, this)).filter(Boolean);
    this.boss = this.enemies.find((e) => e.type === 'boss') || null;
    this.boss2 = this.enemies.find((e) => e.boss2) || null;
    this.ammo = spec.boss ? 8 : 0; this.harps = []; this.fireCD = 0; this.inkT = 0; this.exitMsgT = 0;
    this.currents = L.currents.map((c) => ({ ...c, st: Array.from({ length: Math.max(4, Math.floor((c.w * c.h) / 260)) }, () => ({ x: rnd(0, c.w), y: rnd(0, c.h), l: rnd(3, 7) })) }));
    this.vents = L.vents.map((v) => ({ ...v, t: Math.random() * 60 }));
    this.deco = L.deco;
    this.exit = { ...L.exit, open: false, t: 0 };
    this.ch2 = spec.chapter === 2 ? new Ch2(this) : null;
    this.shots = []; this.parts = []; this.popups = [];
    this.held = new Set();
    this.score = 0; this.gemsLeft = this.gems.length; this.chestsGot = 0;
    this.maxHearts = this.diver.hearts || 3;
    this.hearts = this.maxHearts; this.damaged = false; this.o2 = 1; this.lowBeep = 0;
    this.flags = this.placeFlags(); this.checkpoint = null;
    this.time = 0; this.shake = 0; this.state = 'play'; this.stateT = 0; this.flashT = 0;
    this.cam = { x: 0, y: 0 };
    this.darkC = null;
    // minimap: 1 pixel per tile, revealed as you explore
    this.mapC = makeCanvas(L.w, L.h);
    this.mapX = this.mapC.getContext('2d');
    this.mapImg = this.mapX.createImageData(L.w, L.h);
    this.seen = new Uint8Array(L.w * L.h);
    this.mapCols = {
      water: hexRgb(mix(this.B.water[0], '#ffffff', 0.18)), rock: hexRgb(mix(this.B.rock[2], '#000000', 0.2)),
      edge: hexRgb(this.B.surf[1]), crack: hexRgb(this.B.rock[3]), doors: this.S.keyCols.map((k) => hexRgb(k[0])),
      gate: hexRgb(this.biome === 10 ? '#ff4040' : this.biome === 9 ? '#8a6a2a' : '#7affe0'),
    };
    this.revealMap(true);
    if (this.ch2 && (this.ch2.escape || (!this.gems.length && !this.boss2 && !this.ch2.pupsTotal))) this.exit.open = true;
    this.snow = Array.from({ length: 46 }, (_, i) => ({ x: hash(i, 1) * 600, y: hash(i, 2) * 600, s: 0.4 + hash(i, 3) * 0.6 }));
  }

  // ---------- minimap ----------
  mapPixel(i) {
    const t = this.tiles[i], C = this.mapCols, d = this.mapImg.data, o = i * 4;
    let c;
    if (t === T.WATER) c = C.water;
    else if (t === T.CRACK) c = C.crack;
    else if (t === T.GATE) c = C.gate;
    else if (t >= T.DOOR0) c = C.doors[t - T.DOOR0];
    else {
      const x = i % this.L.w, y = (i / this.L.w) | 0;
      c = this.tileAt(x, y - 1) === T.WATER ? C.edge : C.rock;
    }
    d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
  }
  revealMap(force) {
    const p = this.player, w = this.L.w, R = 7;
    const cx = Math.floor(p.x / TILE), cy = Math.floor(p.y / TILE);
    let dirty = force;
    for (let dy = -R; dy <= R; dy++)
      for (let dx = -R; dx <= R; dx++) {
        const x = cx + dx, y = cy + dy;
        if (x < 0 || y < 0 || x >= w || y >= this.L.h || dx * dx + dy * dy > R * R) continue;
        const i = y * w + x;
        if (!this.seen[i]) { this.seen[i] = 1; this.mapPixel(i); dirty = true; }
      }
    if (dirty) this.mapX.putImageData(this.mapImg, 0, 0);
  }
  mapTileChanged(i) { if (this.seen[i]) { this.mapPixel(i); this.mapDirty = true; } }

  // ---------- checkpoints & vibration ----------
  buzz(ms) {
    if (this.game.save.vibrate === false) return;
    try { if (navigator.vibrate) navigator.vibrate(ms); } catch { /* unsupported */ }
  }

  // Checkpoint flags are placed at run time on the existing main route (the level itself is untouched).
  placeFlags() {
    const L = this.L, g = new Grid(L.w, L.h);
    if (L.escape) return [];
    g.t = L.tiles;
    const r = bfs(g, [{ x: L.spawn.tx, y: L.spawn.ty }], (t) => t !== T.ROCK);
    const path = [];
    for (let i = L.exit.ty * L.w + L.exit.tx; i !== -1 && path.length < 5000; i = r.parent[i]) path.push(i);
    path.reverse();
    const n = path.length;
    if (n < 70) return [];
    const count = n >= 170 ? 2 : 1;
    const things = [...L.gems, ...L.keys, ...L.chests, ...L.air];
    const flags = [];
    for (let k = 1; k <= count; k++) {
      const mid = Math.floor((n * k) / (count + 1));
      let pick = null;
      for (let j = 0; j < n / 3 && !pick; j++)
        for (const s of [1, -1]) {
          const i = path[mid + j * s];
          if (i === undefined) continue;
          let x = i % L.w, y = (i / L.w) | 0;
          for (let d = 0; d < 10 && g.get(x, y + 1) === T.WATER; d++) y++; // settle onto the floor
          if (g.get(x, y) !== T.WATER || g.get(x, y + 1) === T.WATER || g.get(x, y - 1) !== T.WATER) continue;
          if (things.some((q) => Math.hypot(q.tx - x, q.ty - y) < 2.5)) continue;
          if (L.enemies.some((e) => Math.hypot(e.tx - x, e.ty - y) < 3)) continue;
          pick = { tx: x, ty: y, x: x * TILE + 8, y: (y + 1) * TILE, on: false };
          break;
        }
      if (pick) flags.push(pick);
    }
    return flags;
  }

  respawn() {
    const p = this.player, c = this.checkpoint;
    p.x = c.x; p.y = c.y; p.vx = 0; p.vy = 0; p.dead = false; p.dashT = 0; p.inv = 150;
    this.hearts = this.maxHearts; this.o2 = 1; this.shots = []; p.charges = this.maxDash;
    if (this.ch2) for (const q of this.ch2.pups) if (q.state === 'follow') { q.x = p.x; q.y = p.y; }
    this.state = 'play'; this.stateT = 0;
    this.snapCam();
    this.game.audio.music(songFor(this.spec.biome, this.spec.boss));
    this.popup('BACK TO CHECKPOINT', p.x, p.y - 18, '#5dff7a');
    this.burst(p.x, p.y, 'bubble', 14);
  }

  // ---------- queries ----------
  tileAt(tx, ty) { return tx < 0 || ty < 0 || tx >= this.L.w || ty >= this.L.h ? T.ROCK : this.tiles[ty * this.L.w + tx]; }
  solidAt(x, y) { return this.tileAt(Math.floor(x / TILE), Math.floor(y / TILE)) !== T.WATER; }
  los(x0, y0, x1, y1, step = 4) {
    const d = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(d / step);
    for (let i = 1; i < n; i++) if (this.solidAt(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n)) return false;
    return true;
  }
  sfx(n) { this.game.audio.play(n); }

  burst(x, y, type, n, color) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = rnd(0.4, type === 'debris' ? 2.4 : 1.6);
      this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - (type === 'bubble' ? 0.5 : 0), life: rnd(25, 50), max: 50, type, color, sz: Math.random() < 0.3 ? 2 : 1 });
    }
  }
  bubble(x, y, s = 1) {
    this.parts.push({ x, y, vx: rnd(-0.2, 0.2), vy: rnd(-0.6, -0.2) * s, life: rnd(40, 90), max: 90, type: 'bubble', sz: Math.random() < 0.3 ? 2 : 1 });
  }
  popup(text, x, y, color = '#ffffff') { this.popups.push({ text, x, y, t: 50, color }); }
  addScore(n, x, y) { this.score += n; if (x !== undefined) this.popup('+' + n, x, y - 8, '#fff3a0'); }

  // ---------- player ----------
  hurt(sx, sy) {
    const p = this.player;
    if (p.inv > 0 || p.dead || this.state !== 'play') return;
    if (this.diver.shell && this.shellT <= 0) { // turtle shell soaks the hit
      this.shellT = 600; p.inv = 70;
      const a = Math.atan2(p.y - sy, p.x - sx);
      p.vx = Math.cos(a) * 3; p.vy = Math.sin(a) * 3; p.dashT = 0;
      this.sfx('bounce'); this.buzz(30); this.shake = 4;
      this.burst(p.x, p.y, 'spark', 14, '#8ee05a'); this.popup('SHELL BLOCK!', p.x, p.y - 16, '#8ee05a');
      return;
    }
    this.hearts--; this.damaged = true;
    p.inv = 100;
    const a = Math.atan2(p.y - sy, p.x - sx);
    p.vx = Math.cos(a) * 3.6; p.vy = Math.sin(a) * 3.6; p.dashT = 0;
    this.shake = 9; this.flashT = 8;
    this.sfx('hurt'); this.buzz(70);
    this.burst(p.x, p.y, 'bubble', 12);
    if (this.hearts <= 0) { p.dead = true; this.state = 'dying'; this.stateT = 0; this.sfx('lose'); this.game.audio.music(-1); }
  }

  breakCrack(tx, ty) {
    const stack = [[tx, ty]];
    let n = 0;
    while (stack.length && n < 12) {
      const [x, y] = stack.pop();
      if (this.tileAt(x, y) !== T.CRACK) continue;
      this.tiles[y * this.L.w + x] = T.WATER; n++;
      this.mapTileChanged(y * this.L.w + x);
      this.burst(x * TILE + 8, y * TILE + 8, 'debris', 10, this.B.rock[2]);
      this.burst(x * TILE + 8, y * TILE + 8, 'debris', 4, this.B.rock[3]);
      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    if (n) { this.sfx('break'); this.shake = 6; this.addScore(50); this.buzz(25); }
  }

  openDoor(c) {
    let n = 0;
    for (let i = 0; i < this.tiles.length; i++)
      if (this.tiles[i] === T.DOOR0 + c) {
        this.tiles[i] = T.WATER; n++;
        this.mapTileChanged(i);
        const x = (i % this.L.w) * TILE + 8, y = Math.floor(i / this.L.w) * TILE + 8;
        this.burst(x, y, 'spark', 8, this.S.keyCols[c][0]);
      }
    if (n) { this.sfx('door'); this.shake = 5; this.held.delete(c); this.popup('UNLOCKED!', this.player.x, this.player.y - 14, this.S.keyCols[c][0]); }
  }

  movePlayer() {
    const p = this.player, R = PHYS.R;
    const sp = Math.hypot(p.vx, p.vy);
    const n = Math.max(1, Math.ceil(sp / 2.5));
    let impact = 0;
    for (let s = 0; s < n; s++) {
      p.x += p.vx / n; p.y += p.vy / n;
      const tx0 = Math.floor((p.x - R) / TILE), tx1 = Math.floor((p.x + R) / TILE);
      const ty0 = Math.floor((p.y - R) / TILE), ty1 = Math.floor((p.y + R) / TILE);
      for (let ty = ty0; ty <= ty1; ty++)
        for (let tx = tx0; tx <= tx1; tx++) {
          const t = this.tileAt(tx, ty);
          if (t === T.WATER) continue;
          const cx = Math.max(tx * TILE, Math.min(p.x, tx * TILE + TILE));
          const cy = Math.max(ty * TILE, Math.min(p.y, ty * TILE + TILE));
          let dx = p.x - cx, dy = p.y - cy;
          let d2 = dx * dx + dy * dy;
          if (d2 >= R * R) continue;
          if (t === T.CRACK && p.dashT > 0) { this.breakCrack(tx, ty); continue; }
          if (t >= T.DOOR0 && t <= T.DOOR2 && this.held.has(t - T.DOOR0)) { this.openDoor(t - T.DOOR0); continue; }
          let d = Math.sqrt(d2), nx, ny, pen;
          if (d < 0.001) { // center inside tile: push out of nearest face
            const l = p.x - tx * TILE, r = tx * TILE + TILE - p.x, u = p.y - ty * TILE, b = ty * TILE + TILE - p.y;
            const m = Math.min(l, r, u, b);
            [nx, ny] = m === l ? [-1, 0] : m === r ? [1, 0] : m === u ? [0, -1] : [0, 1];
            pen = m + R;
          } else { nx = dx / d; ny = dy / d; pen = R - d; }
          p.x += nx * pen; p.y += ny * pen;
          const vn = p.vx * nx + p.vy * ny;
          if (vn < 0) {
            impact = Math.max(impact, -vn);
            p.vx -= (1 + PHYS.BOUNCE) * vn * nx; p.vy -= (1 + PHYS.BOUNCE) * vn * ny;
            // tangential friction
            const tvx = p.vx - (p.vx * nx + p.vy * ny) * nx, tvy = p.vy - (p.vx * nx + p.vy * ny) * ny;
            p.vx -= tvx * 0.06; p.vy -= tvy * 0.06;
            if (t === T.CRACK && this.game.tipCrack !== true) { this.game.tipCrack = true; this.popup('DASH TO BREAK!', p.x, p.y - 16, '#fff3a0'); }
            if (t === T.GATE && p.bump <= 0) { this.popup('FIND THE SWITCH', p.x, p.y - 16, '#ff6060'); p.bump = 90; }
            if (t >= T.DOOR0 && t <= T.DOOR2 && !this.held.has(t - T.DOOR0) && p.bump <= 0) { this.popup('NEED KEY', p.x, p.y - 16, this.S.keyCols[t - T.DOOR0][0]); p.bump = 90; }
          }
        }
    }
    if (impact > 1.4 && p.bump2 <= 0) { this.sfx('bounce'); p.bump2 = 12; for (let i = 0; i < 3; i++) this.bubble(p.x, p.y + 4); }
  }

  updatePlayer(input) {
    const p = this.player;
    if (p.inv > 0) p.inv--;
    if (p.bump > 0) p.bump--;
    p.bump2 = (p.bump2 || 0) - 1;
    if (p.charges < this.maxDash && --p.dashCD <= 0) { p.charges++; if (p.charges < this.maxDash) p.dashCD = Math.round(PHYS.DASH_CD * (this.diver.dashCD || 1)); }
    const a = input.axis();
    const dashReq = input.dash();
    if (p.dead) { p.vy -= 0.02; p.vx *= 0.95; p.vy *= 0.95; p.y += p.vy; p.x += p.vx; return; }
    if (dashReq && p.charges > 0 && p.dashT < PHYS.DASH_T - 3) {
      let dx = a.x, dy = a.y;
      const m = Math.hypot(dx, dy);
      if (m < 0.2) { dx = p.face; dy = 0; } else { dx /= m; dy /= m; }
      p.vx = dx * PHYS.DASH_V; p.vy = dy * PHYS.DASH_V;
      p.dashT = PHYS.DASH_T;
      if (p.charges === this.maxDash) p.dashCD = Math.round(PHYS.DASH_CD * (this.diver.dashCD || 1));
      p.charges--;
      this.sfx('dash');
      for (let i = 0; i < 6; i++) this.bubble(p.x - dx * 6, p.y - dy * 6, 0.5);
    }
    if (p.dashT > 0) {
      p.dashT--;
      if (this.time % 2 === 0) this.parts.push({ x: p.x, y: p.y, vx: 0, vy: 0, life: 12, max: 12, type: 'ghost', face: p.face });
    } else {
      const spd = this.diver.speed || 1;
      p.vx += a.x * PHYS.ACC * spd;
      p.vy += a.y < 0 ? a.y * PHYS.THRUST * spd : a.y * PHYS.DIVE * spd;
      p.vy += PHYS.G;
      // environment
      for (const c of this.currents) if (p.x > c.x && p.x < c.x + c.w && p.y > c.y && p.y < c.y + c.h) { p.vx += c.fx; p.vy += c.fy; }
      for (const v of this.vents) if (Math.abs(p.x - v.x) < 12 && p.y < v.y && p.y > v.y - v.h) p.vy -= 0.09;
      p.vx *= PHYS.DRAG; p.vy *= PHYS.DRAG;
      const sp = Math.hypot(p.vx, p.vy);
      const MAX = PHYS.MAX * spd;
      if (sp > MAX) { const k = Math.max(MAX / sp, 0.92); p.vx *= k; p.vy *= k; }
      if (a.y < -0.3 && this.time % 5 === 0) this.bubble(p.x + rnd(-3, 3), p.y + 7, 0.6);
    }
    if (Math.abs(a.x) > 0.2) p.face = a.x < 0 ? -1 : 1;
    p.prop += 0.15 + Math.hypot(a.x, a.y) * 0.35;
    this.movePlayer();
    p.x = Math.max(8, Math.min(this.pw - 8, p.x)); p.y = Math.max(8, Math.min(this.ph - 8, p.y));
  }

  // ---------- main update ----------
  update(input) {
    this.time++; this.stateT++;
    if (this.shake > 0) this.shake *= 0.85;
    if (this.flashT > 0) this.flashT--;
    const p = this.player;

    if (this.state === 'won') {
      p.x += (this.exit.x - p.x) * 0.1; p.y += (this.exit.y - p.y) * 0.1;
      input.dash();
      this.updateFx();
      this.updateCam(true);
      return this.stateT > 70 ? 'won' : null;
    }
    this.updatePlayer(input);
    trackPlayer(p);
    if (this.inkT > 0) this.inkT--;
    if (this.shellT > 0 && --this.shellT === 0) { this.popup('SHELL READY', p.x, p.y - 16, '#8ee05a'); }
    if (this.ch2 && this.state === 'play') { this.ch2.update(); this.updateHarpoons(input); }
    if (this.time % 6 === 0 || this.mapDirty) { this.revealMap(this.mapDirty); this.mapDirty = false; }

    if (this.state === 'play') {
      // oxygen
      this.o2 -= 1 / (this.spec.o2 * (this.diver.o2 || 1) * 60);
      let refill = false;
      for (const a of this.air) {
        a.t++;
        if (a.t % 24 === 0) this.bubble(a.x + rnd(-3, 3), a.y - 2, 0.8);
        if (Math.hypot(p.x - a.x, p.y - a.y) < 15) refill = true;
      }
      if (refill && this.o2 < 1) {
        if (this.o2 < 0.95 && this.time % 8 === 0) { this.sfx('bubble'); this.bubble(p.x, p.y); }
        this.o2 = Math.min(1, this.o2 + 0.025);
      }
      if (this.o2 < 0.25 && --this.lowBeep <= 0) { this.lowBeep = 60; this.sfx('low'); }
      if (this.o2 <= 0) { this.o2 = 0.6; this.player.inv = 0; this.hurt(p.x, p.y - 10); this.popup('NO AIR!', p.x, p.y - 16, '#ff6060'); }

      // pickups
      for (const g of this.gems) {
        g.t++;
        if (this.diver.magnet && !g.got) { // golden diver: gems drift towards you
          const dx = p.x - g.x, dy = p.y - g.y, d = Math.hypot(dx, dy);
          if (d < 56 && d > 1) { g.x += (dx / d) * Math.min(d, 1.6); g.y += (dy / d) * Math.min(d, 1.6); }
        }
        if (!g.got && Math.hypot(p.x - g.x, p.y - g.y) < 11) {
          g.got = true; this.gemsLeft--; this.addScore(100, g.x, g.y); this.sfx('gem');
          this.burst(g.x, g.y, 'spark', 10, '#5dff7a');
          if (this.boss && !this.boss.leaving) { this.boss.hurtBy(); this.sfx('roar'); this.shake = 8; }
          if (this.gemsLeft === 0) this.tryOpenExit();
        }
      }
      for (const k of this.keys) if (!k.got && Math.hypot(p.x - k.x, p.y - k.y) < 11) {
        k.got = true; this.held.add(k.c); this.addScore(200, k.x, k.y); this.sfx('key');
        this.burst(k.x, k.y, 'spark', 12, this.S.keyCols[k.c][0]);
        this.popup('KEY FOUND!', k.x, k.y - 18, this.S.keyCols[k.c][0]);
      }
      for (const f of this.flags) if (!f.on && Math.hypot(p.x - f.x, p.y - (f.y - 8)) < 15) {
        for (const o of this.flags) o.on = false;
        f.on = true; this.checkpoint = { x: f.x, y: f.y - 10 };
        this.sfx('key'); this.buzz(40);
        this.popup('CHECKPOINT!', f.x, f.y - 26, '#5dff7a');
        this.burst(f.x, f.y - 12, 'spark', 12, '#5dff7a');
      }
      for (const c of this.chests) if (!c.got && Math.hypot(p.x - c.x, p.y - c.y) < 12) {
        c.got = true; this.chestsGot++; this.addScore(500, c.x, c.y); this.sfx('chest');
        this.burst(c.x, c.y, 'spark', 18, '#ffd23f'); this.popup('TREASURE!', c.x, c.y - 18, '#ffd23f');
      }
      // exit
      this.exit.t++;
      if (this.exitMsgT > 0) this.exitMsgT--;
      if (!this.exit.open && this.exitMsgT <= 0 && Math.hypot(p.x - this.exit.x, p.y - this.exit.y) < 24) {
        this.exitMsgT = 120;
        const why = this.gemsLeft > 0 ? `${this.gemsLeft} GEMS LEFT` : this.boss2 && this.boss2.alive ? 'DEFEAT THE BOSS!' : this.ch2 && !this.ch2.pupsReady ? `RESCUE ${this.ch2.pupsTotal - this.ch2.pupsWith} MORE BABIES` : '';
        if (why) this.popup(why, this.exit.x, this.exit.y - 22, '#ff8ad8');
      }
      if (this.exit.open && Math.hypot(p.x - this.exit.x, p.y - this.exit.y) < 13) {
        this.state = 'won'; this.stateT = 0; this.sfx('win'); this.game.audio.music(-1);
        this.finish();
      }
    }

    // enemies
    for (const e of this.enemies) {
      if (!e.alive) continue;
      e.update(this);
      if (this.state !== 'play' || p.dead) continue;
      if (e.boss2) { e.onPlayer(this, p); continue; }
      if (e.touches(p.x, p.y, 5.5)) {
        if (p.dashT > 0 && e.dashable) {
          e.alive = false; this.addScore(150, e.x, e.y); this.sfx('kill'); this.shake = 4;
          this.burst(e.x, e.y, 'spark', 12, '#ffffff'); this.burst(e.x, e.y, 'bubble', 8);
        } else if (e.type === 'mine') {
          e.alive = false; this.sfx('boom'); this.shake = 12; this.buzz(140);
          this.burst(e.x, e.y, 'fire', 20, '#ffb040'); this.burst(e.x, e.y, 'bubble', 14);
          this.hurt(e.x, e.y);
        } else if (e.harmful) this.hurt(e.x, e.y);
        else if (p.dashT > 0 && p.bump <= 0) { // bounced off a closed clam
          this.sfx('bounce'); p.vx *= -0.6; p.vy *= -0.6; p.dashT = 0; p.bump = 20;
        }
      }
    }
    // projectiles
    for (const s of this.shots) {
      if (s.home && !p.dead) { // slow homing torpedo
        const sp = Math.hypot(s.vx, s.vy), a = Math.atan2(p.y - s.y, p.x - s.x), b = Math.atan2(s.vy, s.vx);
        let da = a - b; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
        const nb = b + Math.max(-s.home, Math.min(s.home, da));
        s.vx = Math.cos(nb) * sp; s.vy = Math.sin(nb) * sp;
        if (this.time % 4 === 0) this.bubble(s.x, s.y, 0.4);
      }
      s.x += s.vx; s.y += s.vy; s.life--;
      if (this.solidAt(s.x, s.y)) { s.life = 0; this.burst(s.x, s.y, 'spark', 4, '#ffffff'); }
      else if (this.state === 'play' && Math.hypot(s.x - p.x, s.y - p.y) < 5 + (s.r || 2)) { s.life = 0; this.hurt(s.x, s.y); }
    }
    this.shots = this.shots.filter((s) => s.life > 0);

    // vents & currents visuals
    for (const v of this.vents) { v.t++; if (v.t % 4 === 0) this.parts.push({ x: v.x + rnd(-5, 5), y: v.y - 2, vx: rnd(-0.15, 0.15), vy: rnd(-2.2, -1.4), life: Math.min(90, v.h / 1.6), max: 90, type: 'bubble', sz: Math.random() < 0.4 ? 2 : 1 }); }
    for (const c of this.currents) for (const s of c.st) {
      s.x += c.fx * 40; s.y += c.fy * 40;
      if (s.x < 0) s.x += c.w; if (s.x > c.w) s.x -= c.w; if (s.y < 0) s.y += c.h; if (s.y > c.h) s.y -= c.h;
    }
    this.updateFx();
    this.updateCam(false);
    if (this.state === 'dying' && this.stateT > 110) {
      if (this.checkpoint) { this.respawn(); return null; }
      return 'lost';
    }
    return null;
  }

  tryOpenExit() {
    if (this.exit.open || this.gemsLeft > 0) return;
    if (this.boss2 && this.boss2.alive) return;
    if (this.ch2 && !this.ch2.pupsReady) { this.popup('NOW RESCUE THE BABIES!', this.player.x, this.player.y - 18, '#7affe0'); return; }
    this.openExit();
  }

  bossDefeated(b) {
    this.addScore(5000, b.x, b.y);
    this.popup('BOSS DEFEATED!', b.x, b.y - 24, '#ffd23f');
    this.burst(b.x, b.y, 'spark', 40, '#ffd23f');
    this.shake = 16; this.buzz(200);
    this.game.audio.music(songFor(this.spec.biome, false));
    this.tryOpenExit();
  }

  // ---------- harpoon gun ----------
  updateHarpoons(input) {
    const p = this.player;
    if (this.fireCD > 0) this.fireCD--;
    if (input.fire() && !p.dead) {
      if (this.ammo <= 0) { if (this.fireCD <= 0) { this.sfx('click'); this.popup('NO HARPOONS', p.x, p.y - 16, '#9aa4b8'); this.fireCD = 30; } }
      else if (this.fireCD <= 0) {
        const a = input.axis();
        let dx = a.x, dy = a.y;
        const m = Math.hypot(dx, dy), stick = m >= 0.3;
        if (!stick) { dx = p.face; dy = 0; } else { dx /= m; dy /= m; }
        // aim assist: lock onto the best target in front of you (or anywhere if you're not steering)
        const tgt = this.harpoonTarget(dx, dy, stick);
        if (tgt) { const pt = tgt.pt(), d = Math.hypot(pt.x - p.x, pt.y - p.y) || 1; dx = (pt.x - p.x) / d; dy = (pt.y - p.y) / d; p.face = dx < 0 ? -1 : 1; }
        this.harps.push({ x: p.x + dx * 8, y: p.y + dy * 8, vx: dx * 5.5, vy: dy * 5.5, life: 52, tgt });
        this.ammo--; this.fireCD = 14; this.sfx('dash');
        p.vx -= dx * 0.6; p.vy -= dy * 0.6;
      }
    }
    for (const h of this.harps) {
      if (h.tgt && h.tgt.alive()) { // gentle homing so a moving target still gets hit
        const pt = h.tgt.pt(), sp = Math.hypot(h.vx, h.vy), b = Math.atan2(h.vy, h.vx);
        let da = Math.atan2(pt.y - h.y, pt.x - h.x) - b; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
        const nb = b + Math.max(-0.12, Math.min(0.12, da));
        h.vx = Math.cos(nb) * sp; h.vy = Math.sin(nb) * sp;
      }
      for (let k = 0; k < 2 && h.life > 0; k++) {
        h.x += h.vx / 2; h.y += h.vy / 2;
        if (this.solidAt(h.x, h.y)) { h.life = 0; this.burst(h.x - h.vx, h.y - h.vy, 'spark', 5, '#c8d0e0'); this.sfx('bounce'); break; }
        for (const s of this.shots) if (s.killable && Math.hypot(s.x - h.x, s.y - h.y) < 6) { s.life = 0; h.life = 0; this.burst(s.x, s.y, 'fire', 12); this.sfx('boom'); this.addScore(50, s.x, s.y); }
        for (const e of this.enemies) {
          if (!e.alive || h.life <= 0) continue;
          if (e.boss2) { if (e.onHarpoon(this, h)) h.life = 0; continue; }
          if (e.type === 'gasvent' || !e.touches(h.x, h.y, 3)) continue;
          h.life = 0;
          if (NO_HARP.has(e.type)) { this.sfx('bounce'); this.burst(h.x, h.y, 'spark', 5, '#c8d0e0'); continue; }
          if (e.hp > 1) { e.hp--; e.flash = 10; this.sfx('bounce'); this.burst(h.x, h.y, 'spark', 6, '#ffffff'); continue; }
          e.alive = false; this.addScore(150, e.x, e.y); this.sfx(e.type === 'mine' ? 'boom' : 'kill'); this.shake = 4;
          this.burst(e.x, e.y, e.type === 'mine' ? 'fire' : 'spark', 14, '#ffffff'); this.burst(e.x, e.y, 'bubble', 8);
        }
      }
      h.life--;
    }
    this.harps = this.harps.filter((h) => h.life > 0);
  }

  harpoonTarget(dx, dy, stick) {
    const p = this.player, list = [];
    for (const e of this.enemies) {
      if (!e.alive || e.type === 'gasvent' || NO_HARP.has(e.type)) continue;
      if (e.boss2) { if (!e.dying) list.push({ pt: () => e.aimPoint(this), alive: () => e.alive && !e.dying, boss: true }); continue; }
      list.push({ pt: () => ({ x: e.x, y: e.y }), alive: () => e.alive });
    }
    for (const s of this.shots) if (s.killable) list.push({ pt: () => ({ x: s.x, y: s.y }), alive: () => s.life > 0 });
    // prefer targets in the direction you're pointing; if there are none, take the closest one anywhere
    const pick = (minCos) => {
      let best = null, bs = 1e9;
      for (const c of list) {
        const pt = c.pt(), vx = pt.x - p.x, vy = pt.y - p.y, d = Math.hypot(vx, vy);
        if (d > 220 || d < 1) continue;
        const cos = (vx * dx + vy * dy) / d;
        if (cos < minCos || !this.los(p.x, p.y, pt.x, pt.y, 6)) continue;
        const score = d * (2 - cos) * (c.boss ? 0.5 : 1);
        if (score < bs) { bs = score; best = c; }
      }
      return best;
    };
    return pick(stick ? 0.5 : -0.2) || pick(-1.01);
  }

  openExit() {
    this.exit.open = true; this.sfx('open');
    this.popup('PORTAL OPEN!', this.player.x, this.player.y - 18, '#7affe0');
    if (this.boss) { this.boss.leaving = true; this.sfx('roar'); }
  }

  finish() {
    const secs = this.time / 60;
    const timeBonus = Math.max(0, Math.round(3000 - secs * 12));
    const heartBonus = Math.min(3, this.hearts) * 300;
    this.result = {
      score: this.score, timeBonus, heartBonus, total: this.score + timeBonus + heartBonus,
      secs, chests: this.chestsGot, chestsMax: this.chests.length, damaged: this.damaged,
      stars: 1 + (this.chestsGot >= this.chests.length ? 1 : 0) + (this.damaged ? 0 : 1),
    };
  }

  updateFx() {
    for (const q of this.parts) {
      q.life--;
      if (q.type === 'bubble') { q.vy -= 0.015; q.vy = Math.max(q.vy, -1.4); q.x += q.vx + Math.sin(q.life * 0.2) * 0.15; q.y += q.vy; if (this.solidAt(q.x, q.y - 2)) q.life = 0; }
      else if (q.type === 'debris') { q.vy += 0.06; q.vx *= 0.97; q.x += q.vx; q.y += q.vy; }
      else if (q.type !== 'ghost') { q.vx *= 0.93; q.vy *= 0.93; q.x += q.vx; q.y += q.vy; }
    }
    this.parts = this.parts.filter((q) => q.life > 0);
    if (this.parts.length > 500) this.parts.splice(0, this.parts.length - 500);
    for (const u of this.popups) { u.t--; u.y -= 0.4; }
    this.popups = this.popups.filter((u) => u.t > 0);
  }

  updateCam(snap) {
    const v = this.game.view, p = this.player;
    const tx = p.x + p.vx * 14 - v.w / 2, ty = p.y + p.vy * 14 - v.h / 2 + 8;
    const k = snap ? 0.2 : 0.1;
    this.cam.x += (tx - this.cam.x) * k; this.cam.y += (ty - this.cam.y) * k;
    this.clampCam();
  }
  clampCam() {
    const v = this.game.view;
    const top = -18; // room for HUD
    this.cam.x = this.pw <= v.w ? (this.pw - v.w) / 2 : Math.max(0, Math.min(this.pw - v.w, this.cam.x));
    this.cam.y = this.ph <= v.h + top ? (this.ph - v.h) / 2 : Math.max(top, Math.min(this.ph - v.h, this.cam.y));
  }
  snapCam() {
    const v = this.game.view;
    this.cam.x = this.player.x - v.w / 2; this.cam.y = this.player.y - v.h / 2;
    this.clampCam();
  }

  // ---------- rendering ----------
  draw(ctx) {
    const v = this.game.view, B = this.B;
    const sh = this.shake > 0.5 ? this.shake : 0;
    const cx = Math.round(this.cam.x + rnd(-sh, sh)), cy = Math.round(this.cam.y + rnd(-sh, sh));
    const t = this.time;

    // water gradient by depth
    const f0 = Math.max(0, Math.min(1, cy / this.ph)), f1 = Math.max(0, Math.min(1, (cy + v.h) / this.ph));
    const grd = ctx.createLinearGradient(0, 0, 0, v.h);
    grd.addColorStop(0, mix(B.water[0], B.water[1], f0)); grd.addColorStop(1, mix(B.water[0], B.water[1], f1));
    ctx.fillStyle = grd; ctx.fillRect(0, 0, v.w, v.h);

    // far parallax layer (half-res, 2x)
    const fx = Math.floor((cx * 0.5) / 2), fy = Math.floor((cy * 0.5) / 2);
    ctx.drawImage(this.far, fx, fy, Math.ceil(v.w / 2) + 1, Math.ceil(v.h / 2) + 1, -((cx * 0.5) % 2) | 0, -((cy * 0.5) % 2) | 0, (Math.ceil(v.w / 2) + 1) * 2, (Math.ceil(v.h / 2) + 1) * 2);

    // god rays
    if (B.rays) {
      const a = Math.max(0, 0.16 - f0 * 0.22);
      if (a > 0.01) {
        ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = '#ffffff';
        for (let i = 0; i < 5; i++) {
          const bx = ((i * 97 - cx * 0.3 + Math.sin(t * 0.004 + i) * 20) % (v.w + 120)) - 60;
          ctx.beginPath(); ctx.moveTo(bx, 0); ctx.lineTo(bx + 14 + i * 3, 0); ctx.lineTo(bx + 70 + i * 6, v.h); ctx.lineTo(bx + 40, v.h); ctx.fill();
        }
        ctx.restore();
      }
    }
    // marine snow
    ctx.fillStyle = B.snow;
    ctx.globalAlpha = 0.45;
    for (const s of this.snow) {
      const x = ((s.x - cx * s.s * 0.6 + Math.sin(t * 0.01 + s.y) * 6) % 600 + 600) % 600;
      const y = ((s.y - cy * s.s * 0.6 + t * 0.12 * s.s) % 600 + 600) % 600;
      if (x < v.w && y < v.h) ctx.fillRect(x | 0, y | 0, 1, 1);
    }
    ctx.globalAlpha = 1;

    ctx.save();
    ctx.translate(-cx, -cy);
    const vis = (x, y, m = 24) => x > cx - m && x < cx + v.w + m && y > cy - m && y < cy + v.h + m;

    // currents
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    for (const c of this.currents) {
      if (!vis(c.x + c.w / 2, c.y + c.h / 2, Math.max(c.w, c.h))) continue;
      for (const s of c.st) {
        const x = c.x + s.x, y = c.y + s.y;
        if (this.solidAt(x, y)) continue;
        if (c.fx) ctx.fillRect(Math.round(x), Math.round(y), Math.round(s.l), 1); else ctx.fillRect(Math.round(x), Math.round(y), 1, Math.round(s.l));
      }
    }
    // decoration (behind)
    for (const d of this.deco) if (vis(d.x, d.y)) drawDeco(ctx, d, t, B, this.biome);

    // tiles
    ctx.drawImage(this.tileCanvas, cx, cy, v.w, v.h, cx, cy, v.w, v.h);
    const tx0 = Math.floor(cx / TILE), ty0 = Math.floor(cy / TILE);
    for (let ty = ty0; ty <= ty0 + Math.ceil(v.h / TILE) + 1; ty++)
      for (let tx = tx0; tx <= tx0 + Math.ceil(v.w / TILE) + 1; tx++) {
        const tt = this.tileAt(tx, ty);
        if (tt === T.CRACK) ctx.drawImage(this.S.crack, tx * TILE, ty * TILE);
        else if (tt >= T.DOOR0 && tt <= T.DOOR2 && tx >= 0 && ty >= 0 && tx < this.L.w && ty < this.L.h) ctx.drawImage(this.S.doors[tt - T.DOOR0], tx * TILE, ty * TILE);
      }

    // vents
    for (const vt of this.vents) if (vis(vt.x, vt.y)) {
      ellipse(ctx, vt.x, vt.y, 7, 3, '#0b0e1c'); ellipse(ctx, vt.x, vt.y, 6, 2, B.rock[2]); ellipse(ctx, vt.x, vt.y - 1, 3, 1, this.biome === 5 ? '#ff7a1a' : '#0b0e1c');
      ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.fillRect(vt.x - 6, vt.y - vt.h, 12, vt.h);
    }
    // checkpoint flags
    for (const f of this.flags) if (vis(f.x, f.y)) {
      const x = Math.round(f.x), y = Math.round(f.y);
      ctx.fillStyle = '#0b0e1c'; ctx.fillRect(x - 1, y - 18, 3, 18);
      ctx.fillStyle = '#c8d0e0'; ctx.fillRect(x, y - 17, 1, 17);
      ellipse(ctx, x, y, 4, 1.5, '#5d6478');
      const wave = Math.round(Math.sin(t * 0.12 + x) * 1.2);
      const col = f.on ? '#5dff7a' : '#9aa4b8', dark = f.on ? '#19b84a' : '#5d6478';
      tri(ctx, x + 1, y - 17, x + 1, y - 9, x + 10, y - 13 + wave, '#0b0e1c');
      tri(ctx, x + 2, y - 16, x + 2, y - 10, x + 9, y - 13 + wave, col);
      px(ctx, x + 2, y - 11, dark, 3, 1);
    }
    // air sources
    for (const a of this.air) if (vis(a.x, a.y)) {
      const y = a.y + 6;
      ellipse(ctx, a.x, y, 7, 4, '#0b0e1c'); ellipse(ctx, a.x, y, 6, 3, '#b0b8c8'); ellipse(ctx, a.x, y - 1, 3, 1.5, '#2a3040');
      const by = a.y - 5 + Math.sin(a.t * 0.06) * 1.5;
      disc(ctx, a.x, by, 4.5, 'rgba(220,250,255,0.9)'); disc(ctx, a.x, by, 3.5, 'rgba(120,200,255,0.55)'); px(ctx, a.x - 2, by - 2, '#ffffff', 2, 1);
      if (this.o2 < 0.5 && (t >> 4) % 2) drawText(ctx, 'AIR', a.x, a.y - 16, '#ffffff', { align: 'center', outline: '#0b0e1c' });
    }
    if (this.ch2) this.ch2.drawBack(ctx, vis);
    // exit portal
    this.drawExit(ctx, t);
    // pickups
    for (const g of this.gems) if (!g.got && vis(g.x, g.y)) {
      const by = Math.round(g.y - 4 + Math.sin(g.t * 0.07) * 1.5);
      ctx.drawImage(this.S.gem, Math.round(g.x - 4), by);
      if ((g.t + g.x) % 90 < 6) px(ctx, g.x + 2, by + 1, '#ffffff');
    }
    for (const k of this.keys) if (!k.got && vis(k.x, k.y)) {
      ctx.drawImage(this.S.keys[k.c], Math.round(k.x - 5), Math.round(k.y - 3 + Math.sin(t * 0.08) * 1.5));
      if ((t >> 3) % 6 === 0) px(ctx, k.x - 3, k.y - 3, '#ffffff');
    }
    for (const c of this.chests) if (!c.got && vis(c.x, c.y)) {
      ctx.drawImage(this.S.chest, Math.round(c.x - 6), Math.round(c.y - 2));
      if ((t + c.x) % 120 < 8) px(ctx, c.x - 3 + ((t >> 1) % 6), c.y + 1, '#ffffff');
    }
    // enemies & shots
    for (const e of this.enemies) if (e.alive && vis(e.x, e.y, e.type === 'boss' ? 200 : 40)) e.draw(ctx, this);
    for (const s of this.shots) {
      const r = s.r || 1.5;
      disc(ctx, s.x, s.y, r + 1, '#0b0e1c'); disc(ctx, s.x, s.y, r, s.col || '#ffffff');
      if (r > 2) px(ctx, s.x - 1, s.y - 1, '#ffffff');
    }
    for (const h of this.harps) {
      const m = Math.hypot(h.vx, h.vy) || 1, ux = h.vx / m, uy = h.vy / m;
      line(ctx, h.x - ux * 9, h.y - uy * 9, h.x, h.y, '#0b0e1c', 3);
      line(ctx, h.x - ux * 9, h.y - uy * 9, h.x, h.y, '#c8d0e0');
      px(ctx, h.x - 1, h.y - 1, '#ffd23f', 2, 2);
    }
    if (this.ch2) this.ch2.drawFront(ctx, 'pups');
    // ghosts (dash trail)
    for (const q of this.parts) if (q.type === 'ghost') {
      ctx.globalAlpha = (q.life / q.max) * 0.4;
      ctx.drawImage(q.face < 0 ? this.S.playerL : this.S.player, Math.round(q.x - 8), Math.round(q.y - 8));
    }
    ctx.globalAlpha = 1;
    this.drawPlayer(ctx, t);
    // particles
    for (const q of this.parts) {
      if (q.type === 'ghost' || !vis(q.x, q.y)) continue;
      const k = q.life / q.max;
      if (q.type === 'bubble') {
        if (q.sz > 1) { ctx.fillStyle = 'rgba(220,245,255,0.8)'; ctx.fillRect(Math.round(q.x) - 1, Math.round(q.y), 3, 1); ctx.fillRect(Math.round(q.x) - 1, Math.round(q.y) - 2, 3, 1); ctx.fillRect(Math.round(q.x) - 2, Math.round(q.y) - 1, 1, 1); ctx.fillRect(Math.round(q.x) + 2, Math.round(q.y) - 1, 1, 1); }
        else { ctx.fillStyle = 'rgba(220,245,255,0.75)'; ctx.fillRect(Math.round(q.x), Math.round(q.y), 1, 1); }
      } else if (q.type === 'fire') {
        px(ctx, q.x, q.y, k > 0.6 ? '#fff3a0' : k > 0.3 ? '#ffb040' : '#c03a1a', q.sz + 1, q.sz + 1);
      } else {
        ctx.globalAlpha = Math.min(1, k * 2);
        px(ctx, q.x, q.y, q.color || '#ffffff', q.sz, q.sz);
        ctx.globalAlpha = 1;
      }
    }
    if (this.ch2) this.ch2.drawFront(ctx, 'wall');
    for (const u of this.popups) drawText(ctx, u.text, u.x, u.y, u.color, { align: 'center', outline: '#0b0e1c' });
    ctx.restore();

    if (this.spec.dark || this.inkT > 0) this.drawDark(ctx, cx, cy);
    if (this.boss2) this.drawBossBar(ctx);
    this.drawIndicators(ctx, cx, cy);
    if (this.flashT > 0) { ctx.fillStyle = `rgba(255,40,40,${this.flashT / 30})`; ctx.fillRect(0, 0, v.w, v.h); }
  }

  drawAccessory(ctx, x, y, f, t) {
    switch (this.diver.acc) {
      case 'fin': tri(ctx, x - f * 4, y - 6, x + f * 2, y - 6, x - f * 4, y - 13, '#0b0e1c'); tri(ctx, x - f * 3, y - 7, x + f, y - 7, x - f * 3, y - 11, '#8a96aa'); break;
      case 'lamp': ctx.fillStyle = '#0b0e1c'; ctx.fillRect(x - 1, y - 12, 3, 5); ctx.fillStyle = '#5d6478'; ctx.fillRect(x, y - 11, 1, 4); disc(ctx, x, y - 13, 2, (t >> 4) % 2 ? '#fff3a0' : '#ffffff'); break;
      case 'crown': ctx.fillStyle = '#0b0e1c'; ctx.fillRect(x - 5, y - 11, 11, 4); ctx.fillStyle = '#ffd23f'; ctx.fillRect(x - 4, y - 10, 9, 2); ctx.fillRect(x - 4, y - 12, 1, 2); ctx.fillRect(x, y - 13, 1, 3); ctx.fillRect(x + 4, y - 12, 1, 2); px(ctx, x, y - 10, '#ff4d4d'); break;
      case 'shell': for (const [dx, dy] of [[-4, 2], [-1, 4], [2, 2], [-3, -1]]) px(ctx, x - f * dx, y + dy, '#1f6a3a', 2, 1); break;
      default:
    }
  }

  drawPlayer(ctx, t) {
    const p = this.player;
    if (this.state === 'won') {
      const s = Math.max(0, 1 - this.stateT / 50);
      if (s <= 0) return;
      ctx.save(); ctx.translate(Math.round(p.x), Math.round(p.y)); ctx.rotate(this.stateT * 0.3); ctx.scale(s, s);
      ctx.drawImage(this.S.player, -8, -8); ctx.restore();
      return;
    }
    if (p.inv > 0 && !p.dead && (p.inv >> 2) % 2) return;
    const x = Math.round(p.x), y = Math.round(p.y);
    // propeller at the back
    const bx = x - p.face * 8, ph = Math.sin(p.prop);
    ctx.fillStyle = '#0b0e1c'; ctx.fillRect(bx - (p.face > 0 ? 1 : 0), y - 1, 2, 3);
    ctx.fillStyle = '#c8d0e0'; ctx.fillRect(bx - p.face * 2 - (p.face > 0 ? 0 : 0), y - Math.round(Math.abs(ph) * 4), 1, Math.max(1, Math.round(Math.abs(ph) * 8)));
    if (p.dead) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(t * 0.1) * 0.4);
      ctx.drawImage(p.face < 0 ? this.S.playerL : this.S.player, -8, -8); ctx.restore();
      return;
    }
    ctx.drawImage(p.face < 0 ? this.S.playerL : this.S.player, x - 8, y - 8);
    this.drawAccessory(ctx, x, y, p.face, t);
    if (this.diver.shell && this.shellT <= 0 && (t >> 5) % 4 === 0) for (let i = 0; i < 10; i++) { const a = (i / 10) * 6.28 + t * 0.05; px(ctx, x + Math.cos(a) * 11, y + Math.sin(a) * 11, '#8ee05a'); }
    if (p.dashT > 0) { ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(x - 6, y - 7, 2, 2); }
  }

  drawExit(ctx, t) {
    const e = this.exit, x = Math.round(e.x), y = Math.round(e.y);
    const B = this.B;
    if (!e.open) {
      disc(ctx, x, y, 14, '#0b0e1c'); disc(ctx, x, y, 13, B.rock[2]); disc(ctx, x, y, 10, '#0b0e1c'); disc(ctx, x, y, 9, '#141828');
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; px(ctx, x + Math.cos(a) * 11.5 - 1, y + Math.sin(a) * 11.5 - 1, i < 8 - Math.min(8, Math.round((this.gemsLeft / (this.gems.length || 1)) * 8)) ? '#5dff7a' : B.rock[0], 2, 2); }
      ctx.drawImage(this.S.lock, x - 2, y - 3);
      return;
    }
    const cols = ['#7affe0', '#3af0ff', '#ffffff', '#5dff7a'];
    disc(ctx, x, y, 15, '#0b0e1c');
    for (let r = 13; r > 0; r -= 2) disc(ctx, x, y, r, cols[(Math.floor(r / 2) + (t >> 3)) % 4]);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + t * 0.05;
      px(ctx, x + Math.cos(a) * 16 - 1, y + Math.sin(a) * 16 - 1, '#ffffff', 2, 2);
    }
    if (t % 6 === 0) this.parts.push({ x: x + rnd(-14, 14), y: y + rnd(-14, 14), vx: 0, vy: -0.3, life: 30, max: 30, type: 'spark', color: '#7affe0', sz: 1 });
  }

  drawBossBar(ctx) {
    const b = this.boss2, v = this.game.view;
    if (!b.alive && !b.dying) return;
    const w = Math.min(120, v.w - 90), x = Math.round((v.w - w) / 2), y = 20;
    drawText(ctx, b.name, v.w / 2, y, '#ffd23f', { align: 'center', outline: '#0b0e1c' });
    ctx.fillStyle = '#0b0e1c'; ctx.fillRect(x - 1, y + 7, w + 2, 6);
    ctx.fillStyle = '#3a0a14'; ctx.fillRect(x, y + 8, w, 4);
    ctx.fillStyle = b.flash > 0 && (b.flash >> 1) % 2 ? '#ffffff' : b.phase2 ? '#ff4d4d' : '#ff8ad8';
    ctx.fillRect(x, y + 8, Math.round((w * b.hp) / b.maxHp), 4);
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(x, y + 8, Math.round((w * b.hp) / b.maxHp), 1);
  }

  drawDark(ctx, cx, cy) {
    const v = this.game.view;
    if (!this.darkC || this.darkC.width !== v.w || this.darkC.height !== v.h) this.darkC = makeCanvas(v.w, v.h);
    const d = this.darkC.getContext('2d');
    d.globalCompositeOperation = 'source-over';
    d.clearRect(0, 0, v.w, v.h);
    d.fillStyle = this.spec.dark ? 'rgba(2,3,12,0.93)' : `rgba(10,4,20,${0.9 * Math.min(1, this.inkT / 20)})`; d.fillRect(0, 0, v.w, v.h);
    d.globalCompositeOperation = 'destination-out';
    const p = this.player;
    const ink = this.inkT > 0 ? Math.min(1, this.inkT / 20) : 0;
    const lights = [{ x: p.x, y: p.y, r: ((34 + (this.spec.dark || 0.4) * 110) * (this.diver.light || 1)) * (1 - ink * 0.45) + Math.sin(this.time * 0.05) * 3, a: 1 }];
    if (this.ch2) lights.push(...this.ch2.lights());
    for (const f of this.flags) lights.push({ x: f.x, y: f.y - 8, r: 18, a: 0.6 });
    for (const g of this.gems) if (!g.got) lights.push({ x: g.x, y: g.y, r: 16, a: 0.7 });
    for (const k of this.keys) if (!k.got) lights.push({ x: k.x, y: k.y, r: 16, a: 0.7 });
    for (const a of this.air) lights.push({ x: a.x, y: a.y, r: 14, a: 0.6 });
    lights.push({ x: this.exit.x, y: this.exit.y, r: this.exit.open ? 46 : 22, a: 0.9 });
    for (const e of this.enemies) if (e.alive) { const l = e.light(); if (l) lights.push(l); }
    for (const l of lights) {
      const x = l.x - cx, y = l.y - cy;
      if (x < -l.r || y < -l.r || x > v.w + l.r || y > v.h + l.r) continue;
      const g = d.createRadialGradient(x, y, 0, x, y, l.r);
      g.addColorStop(0, `rgba(0,0,0,${l.a})`); g.addColorStop(0.55, `rgba(0,0,0,${l.a * 0.75})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      d.fillStyle = g; d.fillRect(x - l.r, y - l.r, l.r * 2, l.r * 2);
    }
    ctx.drawImage(this.darkC, 0, 0);
  }

  drawIndicators(ctx, cx, cy) {
    const v = this.game.view, t = this.time;
    const arrow = (tx, ty, col) => {
      const sx = tx - cx, sy = ty - cy;
      if (sx > 4 && sy > 18 && sx < v.w - 4 && sy < v.h - 4) return;
      const mx = v.w / 2, my = v.h / 2, a = Math.atan2(sy - my, sx - mx);
      const r = 10;
      const ex = Math.max(r + 2, Math.min(v.w - r - 2, mx + Math.cos(a) * 1000));
      const ey = Math.max(r + 20, Math.min(v.h - r - 2, my + Math.sin(a) * 1000));
      const kk = Math.min(Math.abs((ex - mx) / (Math.cos(a) || 1e-6)), Math.abs((ey - my) / (Math.sin(a) || 1e-6)));
      const ax = mx + Math.cos(a) * kk, ay = my + Math.sin(a) * kk;
      const pulse = (t >> 3) % 2 ? 1 : 0;
      const c = Math.cos(a), s = Math.sin(a);
      tri(ctx, ax + c * (5 + pulse), ay + s * (5 + pulse), ax - c * 4 - s * 5, ay - s * 4 + c * 5, ax - c * 4 + s * 5, ay - s * 4 - c * 5, '#0b0e1c');
      tri(ctx, ax + c * (3 + pulse), ay + s * (3 + pulse), ax - c * 3 - s * 3, ay - s * 3 + c * 3, ax - c * 3 + s * 3, ay - s * 3 - c * 3, col);
    };
    if (this.state !== 'play') return;
    if (this.exit.open) arrow(this.exit.x, this.exit.y, '#7affe0');
    else if (this.gemsLeft === 0 && this.ch2 && !this.ch2.pupsReady) {
      const p = this.player;
      let best = null, bd = 1e9;
      for (const q of this.ch2.pups) if (q.state === 'wait') { const d = Math.hypot(q.x - p.x, q.y - p.y); if (d < bd) { bd = d; best = q; } }
      if (best) arrow(best.x, best.y, '#7affe0');
    }
    else if (this.gemsLeft > 0 && this.gemsLeft <= 2) {
      const p = this.player;
      let best = null, bd = 1e9;
      for (const g of this.gems) if (!g.got) { const d = Math.hypot(g.x - p.x, g.y - p.y); if (d < bd) { bd = d; best = g; } }
      if (best) arrow(best.x, best.y, '#5dff7a');
    }
  }
}

// ---------- decoration art ----------
function drawDeco(ctx, d, t, B, biome) {
  const x = d.x, y = d.y, s = d.s;
  if (biome >= 8 && drawDeco2(ctx, d, t, B, biome, x, y, s)) return;
  if (d.k === 'ceil') {
    if (d.v === 1 || biome === 4 || biome === 3) {
      const h = 4 + Math.round(s * 6);
      const col = biome === 4 ? ['#effaff', '#8ac8f0'] : biome === 3 ? ['#ffa0f0', '#8a30a0'] : [B.rock[2], B.rock[0]];
      tri(ctx, x - 3, y, x + 3, y, x, y + h, col[1]); tri(ctx, x - 2, y, x, y, x, y + h - 2, col[0]);
      return;
    }
    const n = 2 + Math.round(s * 5);
    for (let i = 0; i < n; i++) {
      const sw = Math.round(Math.sin(t * 0.03 + x * 0.1 + i * 0.6) * i * 0.3);
      px(ctx, x + sw, y + i * 2, i % 2 ? B.weed[1] : B.weed[0], 1, 2);
      if (d.v === 2 && i % 2) px(ctx, x + sw + 1, y + i * 2, B.rock[0]);
    }
    if (biome === 7 && (t + x) % 160 < 80) px(ctx, x, y + n * 2, '#3af0ff');
    return;
  }
  switch (d.v) {
    case 0: case 1: { // weed / kelp / tube worms
      const tall = biome === 1 ? 8 + Math.round(s * 14) : 3 + Math.round(s * 6);
      if (biome === 4) { tri(ctx, x - 2, y, x + 2, y, x + Math.round(s * 4 - 2), y - 4 - tall, '#c0e8ff'); return; }
      for (let i = 0; i < tall; i++) {
        const sw = Math.round(Math.sin(t * 0.035 + x * 0.13 + i * 0.35) * i * 0.22);
        const c = i % 3 === 0 ? B.weed[1] : B.weed[0];
        px(ctx, x + sw, y - 2 - i * 2, c, biome === 1 ? 2 : 1, 2);
        if (biome === 1 && i % 4 === 2) px(ctx, x + sw + (i % 8 < 4 ? 2 : -1), y - 2 - i * 2, B.weed[1], 1, 1);
      }
      if (biome === 7) px(ctx, x, y - 2 - tall * 2, (t + x) % 100 < 50 ? '#ffffff' : '#3af0ff');
      return;
    }
    case 2: { // coral / crystal
      const c = B.coral[Math.floor(s * 3) % 3];
      if (biome === 3 || biome === 4) {
        tri(ctx, x - 2, y, x + 2, y, x, y - 7 - s * 5, c); tri(ctx, x + 1, y, x + 4, y, x + 4, y - 5, B.coral[1]); px(ctx, x, y - 4, '#ffffff');
        return;
      }
      px(ctx, x, y - 6, c, 2, 6); px(ctx, x - 3, y - 9, c, 2, 5); px(ctx, x - 2, y - 5, c, 2, 1); px(ctx, x + 3, y - 8, c, 2, 4); px(ctx, x + 2, y - 4, c, 2, 1);
      px(ctx, x - 3, y - 9, '#ffffff'); px(ctx, x + 3, y - 8, '#ffffff');
      return;
    }
    case 3: { // biome prop
      if (biome === 2) { px(ctx, x - 4, y - 7, '#0b0e1c', 9, 7); px(ctx, x - 3, y - 6, '#7a5230', 7, 6); px(ctx, x - 3, y - 5, '#5d6478', 7, 1); px(ctx, x - 3, y - 2, '#5d6478', 7, 1); return; }
      if (biome === 6) { ellipse(ctx, x, y - 4, 3.5, 4, '#0b0e1c'); ellipse(ctx, x, y - 4, 2.5, 3, '#b0703a'); px(ctx, x - 1, y - 10, '#b0703a', 3, 3); px(ctx, x - 2, y - 5, '#e0a060', 1, 2); return; }
      if (biome === 5) { ellipse(ctx, x, y - 2, 4, 2.5, '#26181a'); px(ctx, x - 1, y - 3, (t + x) % 60 < 30 ? '#ff7a1a' : '#c03a1a', 2, 1); return; }
      // shell
      ellipse(ctx, x, y - 2, 3.5, 2.5, '#0b0e1c'); ellipse(ctx, x, y - 2, 2.5, 1.5, '#ffd8c0'); px(ctx, x - 1, y - 3, '#d88a60'); px(ctx, x + 1, y - 3, '#d88a60');
      return;
    }
    case 4: { // starfish / glow mushroom / bones
      if (biome === 7) { ellipse(ctx, x, y - 4, 3, 2, (t + x) % 120 < 60 ? '#7affa0' : '#3af0ff'); px(ctx, x, y - 3, '#a0a0c0', 1, 3); return; }
      if (biome === 2 || biome === 5) { px(ctx, x - 4, y - 2, '#e8e0d0', 8, 1); px(ctx, x - 5, y - 3, '#e8e0d0', 2, 2); px(ctx, x + 3, y - 3, '#e8e0d0', 2, 2); return; }
      if (biome === 6) { px(ctx, x - 3, y - 8, '#0b0e1c', 7, 8); px(ctx, x - 2, y - 7, B.rock[2], 5, 7); px(ctx, x - 2, y - 7, B.rock[3], 5, 1); return; }
      const c = '#ff7a5a';
      px(ctx, x - 1, y - 3, c, 3, 3); px(ctx, x, y - 5, c, 1, 2); px(ctx, x - 3, y - 2, c, 2, 1); px(ctx, x + 2, y - 2, c, 2, 1); px(ctx, x - 2, y - 1, c, 1, 1); px(ctx, x + 2, y - 1, c, 1, 1);
      return;
    }
    default: { // anemone
      const c = biome === 7 ? '#ff5ae0' : B.coral[0];
      for (let i = -2; i <= 2; i++) {
        const sw = Math.round(Math.sin(t * 0.05 + i + x) * 1);
        line(ctx, x + i, y - 1, x + i * 2 + sw, y - 5 - (2 - Math.abs(i)), c);
      }
      px(ctx, x - 2, y - 2, B.coral[1], 5, 2);
    }
  }
}

// chapter-2 decoration (Atlantis / Toxic / Base); returns true when handled
function drawDeco2(ctx, d, t, B, biome, x, y, s) {
  const blink = (t + x * 7) % 120 < 60;
  if (d.k === 'ceil') {
    if (biome === 10) { // hanging lamp or pipe
      if (d.v % 2) { px(ctx, x, y, '#3a4450', 1, 4); px(ctx, x - 2, y + 4, '#0b0e1c', 5, 3); px(ctx, x - 1, y + 5, blink ? '#ffd23f' : '#a08020', 3, 1); }
      else { px(ctx, x - 6, y, '#0b0e1c', 13, 4); px(ctx, x - 6, y + 1, '#56626e', 13, 2); px(ctx, x - 3, y, '#ffb020', 1, 4); }
      return true;
    }
    if (biome === 9) { // slime drips
      const len = 2 + Math.round(s * 5) + ((t >> 3) + x) % 4;
      px(ctx, x, y, B.surf[1], 1, len); if (((t >> 2) + x) % 40 < 4) px(ctx, x, y + len + 1, B.surf[0]);
      return true;
    }
    if (biome === 8) { // glowing hanging glyph chains
      const n = 2 + Math.round(s * 4);
      for (let i = 0; i < n; i++) px(ctx, x, y + i * 3, i % 2 ? '#2ab0c8' : '#7affe0', 1, 2);
      return true;
    }
    return false;
  }
  if (biome === 8) {
    if (d.v <= 1) { // glowing sea-grass
      const tall = 4 + Math.round(s * 7);
      for (let i = 0; i < tall; i++) px(ctx, x + Math.round(Math.sin(t * 0.04 + x + i * 0.4) * i * 0.2), y - 2 - i * 2, i % 2 ? '#2ab0c8' : '#7affe0', 1, 2);
      return true;
    }
    if (d.v === 3 || d.v === 4) { // broken pillar with rune
      const h = 6 + Math.round(s * 8);
      px(ctx, x - 3, y - h, '#0b0e1c', 7, h); px(ctx, x - 2, y - h + 1, '#40367a', 5, h - 1); px(ctx, x - 2, y - h + 1, '#5a4ea0', 1, h - 1);
      px(ctx, x - 1, y - h + 3, blink ? '#3af0ff' : '#1a80b0', 3, 1);
      return true;
    }
    return false;
  }
  if (biome === 9) {
    if (d.v <= 1) { // dead weed
      const tall = 2 + Math.round(s * 5);
      for (let i = 0; i < tall; i++) px(ctx, x + (i % 2), y - 2 - i * 2, '#4a5a18', 1, 2);
      return true;
    }
    if (d.v === 3) { // leaking toxic barrel
      px(ctx, x - 4, y - 9, '#0b0e1c', 9, 9); px(ctx, x - 3, y - 8, '#c8b020', 7, 8); px(ctx, x - 3, y - 6, '#0b0e1c', 7, 1); px(ctx, x - 3, y - 3, '#0b0e1c', 7, 1);
      px(ctx, x - 1, y - 5, '#0b0e1c', 3, 1); px(ctx, x + 4, y - 1, '#a6ff2a', 3, 1);
      return true;
    }
    if (d.v === 4) { // bubbling slime mound
      ellipse(ctx, x, y - 2, 4, 2.5, '#3a6a12'); ellipse(ctx, x, y - 2, 3, 1.5, '#6ac020');
      if (((t >> 3) + x) % 6 === 0) px(ctx, x - 1 + (x % 3), y - 6, '#b6ff3a');
      return true;
    }
    return false;
  }
  if (biome === 10) {
    if (d.v <= 1) { // cable bundle
      const tall = 3 + Math.round(s * 6);
      for (let i = 0; i < tall; i++) px(ctx, x + Math.round(Math.sin(i * 0.8 + x) * 1), y - 2 - i * 2, '#2a2f38', 2, 2);
      return true;
    }
    if (d.v === 2 || d.v === 3) { // console with blinking lights
      px(ctx, x - 5, y - 8, '#0b0e1c', 11, 8); px(ctx, x - 4, y - 7, '#3a4450', 9, 7); px(ctx, x - 3, y - 6, '#0e2a20', 7, 3);
      px(ctx, x - 2, y - 5, blink ? '#40ff80' : '#1a6030', 2, 1); px(ctx, x + 1, y - 5, !blink ? '#ff4040' : '#601010', 2, 1);
      return true;
    }
    if (d.v === 4) { // crate
      px(ctx, x - 4, y - 8, '#0b0e1c', 9, 8); px(ctx, x - 3, y - 7, '#6a5030', 7, 7); px(ctx, x - 3, y - 4, '#4a3820', 7, 1); px(ctx, x, y - 7, '#4a3820', 1, 7);
      return true;
    }
    return false;
  }
  return false;
}
