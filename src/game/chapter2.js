// Chapter 2 mechanics (levels 51-75): switch gates, portals, whirlpools, crushers, acid, hatchlings,
// harpoon ammo and the escape wall. The World owns one Ch2 when the level is from chapter 2.
import { T, TILE } from '../level/grid.js';
import { disc, ellipse, tri, px, line } from '../gfx/pixel.js';
import { drawText } from '../engine/font.js';

const rnd = (a, b) => a + Math.random() * (b - a);

export class Ch2 {
  constructor(W) {
    this.W = W;
    const L = W.L;
    this.gates = L.gates.map((g) => ({ ...g, open: false, timer: 0 }));
    this.switches = L.switches.map((s) => ({ ...s, glow: 0 }));
    this.portals = L.portals.map((p) => ({ ...p }));
    this.whirls = L.whirls.map((w) => ({ ...w, a: Math.random() * 6.28 }));
    this.crushers = L.crushers.map((c) => ({ ...c, e: 0, last: 0 }));
    this.acid = L.acid.map((a) => ({ ...a, x: a.tx * TILE, y: a.ty * TILE }));
    this.acidSet = new Set(L.acid.map((a) => a.ty * L.w + a.tx));
    this.pups = L.pups.map((p, i) => ({ ...p, state: 'wait', hx: p.x, hy: p.y, t: i * 20 }));
    this.harpoons = L.harpoons.map((h) => ({ ...h, got: false, cd: 0 }));
    this.portalCD = 0;
    this.escape = L.escape;
    this.wall = null;
    if (this.escape) {
      const sp = L.spawn;
      this.wall = { pos: this.escape === 'right' ? sp.x - 150 : this.escape === 'down' ? sp.y - 150 : sp.y + 150, wait: 90 };
      this.wallSpeed = 0.95 + W.spec.diff * 0.35;
    }
    this.gateHintT = 0;
  }

  get pupsTotal() { return this.pups.length; }
  get pupsWith() { return this.pups.filter((p) => p.state === 'follow').length; }
  get pupsReady() { return this.pups.every((p) => p.state === 'follow'); }

  setGate(g, open) {
    const W = this.W;
    g.open = open;
    for (const c of g.cells) {
      const i = c.ty * W.L.w + c.tx;
      W.tiles[i] = open ? T.WATER : T.GATE;
      W.mapTileChanged(i);
    }
  }

  playerInGate(g) {
    const p = this.W.player, R = 7;
    return g.cells.some((c) => p.x + R > c.tx * TILE && p.x - R < c.tx * TILE + TILE && p.y + R > c.ty * TILE && p.y - R < c.ty * TILE + TILE);
  }

  update() {
    const W = this.W, p = W.player, t = W.time;
    if (this.portalCD > 0) this.portalCD--;
    if (this.gateHintT > 0) this.gateHintT--;

    // switches -> timed gates
    for (const s of this.switches) {
      if (s.glow > 0) s.glow--;
      const g = this.gates[s.gate];
      if (!g || p.dead) continue;
      if (Math.hypot(p.x - s.x, p.y - s.y) < 12 && (!g.open || g.timer < 40)) {
        if (!g.open) { this.setGate(g, true); W.sfx('door'); W.buzz(30); W.popup(`GATE OPEN ${Math.round(s.time)}S`, s.x, s.y - 16, '#7affe0'); }
        g.timer = Math.round(s.time * 60);
        s.glow = 30;
      }
    }
    for (const g of this.gates) {
      if (!g.open) continue;
      g.timer--;
      if (g.timer > 0 && g.timer <= 180 && g.timer % 60 === 0) W.sfx('click');
      if (g.timer <= 0 && !this.playerInGate(g)) { this.setGate(g, false); W.sfx('door'); }
    }

    // portals
    if (this.portalCD <= 0 && !p.dead)
      for (const pt of this.portals)
        for (const [a, b] of [[pt.a, pt.b], [pt.b, pt.a]])
          if (Math.hypot(p.x - a.x, p.y - a.y) < 11) {
            W.burst(p.x, p.y, 'spark', 14, '#c080ff');
            p.x = b.x; p.y = b.y;
            for (const q of this.pups) if (q.state === 'follow') { q.x = b.x; q.y = b.y; }
            this.portalCD = 60;
            W.sfx('open'); W.buzz(20);
            W.burst(b.x, b.y, 'spark', 14, '#c080ff');
            W.snapCam();
            return;
          }

    // whirlpools: pull + spin, the jagged core hurts
    for (const w of this.whirls) {
      w.a += 0.08 * w.dir;
      const dx = w.x - p.x, dy = w.y - p.y, d = Math.hypot(dx, dy);
      if (d < w.r && d > 0.1 && !p.dead) {
        const k = 1 - d / w.r;
        p.vx += (dx / d) * (0.02 + 0.045 * k) + (-dy / d) * 0.05 * k * w.dir;
        p.vy += (dy / d) * (0.02 + 0.045 * k) + (dx / d) * 0.05 * k * w.dir;
        if (d < 8) W.hurt(w.x, w.y - 1);
      }
      if (t % 5 === 0) {
        const a = Math.random() * 6.28, r = w.r * (0.5 + Math.random() * 0.5);
        W.parts.push({ x: w.x + Math.cos(a) * r, y: w.y + Math.sin(a) * r, vx: -Math.sin(a) * w.dir * 1.2 - Math.cos(a) * 0.4, vy: Math.cos(a) * w.dir * 1.2 - Math.sin(a) * 0.4, life: 30, max: 30, type: 'spark', color: 'rgba(220,245,255,0.8)', sz: 1 });
      }
    }

    // crushers
    for (const c of this.crushers) {
      const k = ((t + c.phase) % c.period) / c.period;
      const e = k < 0.45 ? 0 : k < 0.5 ? (k - 0.45) / 0.05 : k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
      if (c.e < 0.95 && e >= 0.95 && Math.hypot(p.x - c.x, p.y - c.y) < 200) { W.sfx('crack'); W.shake = Math.max(W.shake, 3); }
      c.warn = k > 0.38 && k < 0.45;
      c.e = e;
      const r = this.crusherRect(c);
      if (r && !p.dead && p.x + 6 > r.x && p.x - 6 < r.x + r.w && p.y + 6 > r.y && p.y - 6 < r.y + r.h) {
        if (c.dir === 'v') W.hurt(c.x, p.y); else W.hurt(p.x, c.y);
      }
    }

    // acid
    if (!p.dead) {
      const tx = Math.floor(p.x / TILE), ty = Math.floor((p.y + 6) / TILE);
      if (this.acidSet.has(ty * W.L.w + tx) && p.y + 6 > ty * TILE + TILE - 9) { W.hurt(p.x, p.y + 12); p.vy = Math.min(p.vy, -3); }
    }
    if (t % 7 === 0 && this.acid.length) {
      const a = this.acid[(Math.random() * this.acid.length) | 0];
      W.parts.push({ x: a.x + rnd(2, 14), y: a.y + TILE - 9, vx: 0, vy: -0.3, life: 25, max: 25, type: 'spark', color: '#b6ff3a', sz: 1 });
    }

    // hatchlings: free them, then they follow you in a little line
    let prev = p;
    for (const q of this.pups) {
      q.t++;
      if (q.state === 'wait') {
        if (Math.hypot(p.x - q.x, p.y - q.y) < 14 && !p.dead) {
          q.state = 'follow'; W.sfx('chest'); W.buzz(30);
          W.popup(`SAVED ${this.pupsWith}/${this.pupsTotal}`, q.x, q.y - 14, '#7affe0');
          W.burst(q.x, q.y, 'spark', 14, '#7affe0');
          W.tryOpenExit();
        }
        continue;
      }
      if (q.state === 'follow') {
        const dx = prev.x - q.x, dy = prev.y - q.y, d = Math.hypot(dx, dy);
        if (d > 13) { q.x += (dx / d) * (d - 13) * 0.25; q.y += (dy / d) * (d - 13) * 0.25; }
        q.face = dx < 0 ? -1 : 1;
        prev = q;
      }
    }

    // harpoon ammo
    for (const h of this.harpoons) {
      if (h.got) { if (h.respawn && --h.cd <= 0) h.got = false; continue; }
      if (Math.hypot(p.x - h.x, p.y - h.y) < 12 && !p.dead) {
        h.got = true; h.cd = 420; W.ammo += 4; W.sfx('key');
        W.popup('+4 HARPOONS', h.x, h.y - 14, '#ffd23f');
        if (!W.game.tipHarpoon) { W.game.tipHarpoon = true; W.popup(W.game.input.touchUI ? 'TAP FIRE TO SHOOT' : 'PRESS C TO SHOOT', p.x, p.y - 26, '#ffffff'); }
      }
    }

    // escape wall
    if (this.wall && W.state === 'play') {
      const w = this.wall;
      if (w.wait > 0) w.wait--;
      else {
        const dir = this.escape === 'up' ? -1 : 1;
        // speed up when far behind so the chase stays tense, never faster than the diver
        const gap = this.escape === 'right' ? p.x - w.pos : this.escape === 'down' ? p.y - w.pos : w.pos - p.y;
        const sp = this.wallSpeed * (gap > 220 ? 1.6 : 1);
        w.pos += dir * sp;
      }
      const behind = this.escape === 'right' ? p.x - 7 < w.pos : this.escape === 'down' ? p.y - 7 < w.pos : p.y + 7 > w.pos;
      if (behind && !p.dead) {
        W.hurt(this.escape === 'right' ? p.x - 20 : p.x, this.escape === 'down' ? p.y - 20 : this.escape === 'up' ? p.y + 20 : p.y);
        if (this.escape === 'right') { p.x = Math.max(p.x, w.pos + 30); p.vx = 4; }
        else if (this.escape === 'down') { p.y = Math.max(p.y, w.pos + 30); p.vy = 4; }
        else { p.y = Math.min(p.y, w.pos - 30); p.vy = -4; }
      }
      if (t % 3 === 0) {
        const vw = W.game.view;
        if (this.escape === 'right') W.parts.push({ x: w.pos + rnd(-6, 4), y: W.cam.y + rnd(0, vw.h), vx: rnd(0.3, 1), vy: rnd(-0.6, 0.6), life: 30, max: 30, type: 'spark', color: '#b6ff3a', sz: 2 });
        else W.parts.push({ x: W.cam.x + rnd(0, vw.w), y: w.pos + rnd(-4, 4), vx: rnd(-0.5, 0.5), vy: this.escape === 'down' ? rnd(0.5, 1.5) : rnd(-1.5, -0.5), life: 30, max: 30, type: this.escape === 'down' ? 'debris' : 'fire', color: W.B.rock[2], sz: 2 });
      }
    }
  }

  crusherRect(c) {
    if (c.e <= 0.02) return null;
    if (c.dir === 'v') { const len = (c.b - c.a) * c.e; return { x: c.x - 11, y: c.a, w: 22, h: len }; }
    const len = (c.b - c.a) * c.e; return { x: c.a, y: c.y - 11, w: len, h: 22 };
  }

  // ---------- drawing ----------
  drawBack(ctx, vis) {
    const W = this.W, t = W.time, B = W.B, biome = W.biome;
    // gates (closed = barrier, open = faint frame + timer)
    for (const g of this.gates) {
      for (const c of g.cells) {
        const x = c.tx * TILE, y = c.ty * TILE;
        if (!vis(x + 8, y + 8)) continue;
        if (!g.open) this.drawGateTile(ctx, x, y, t, biome, g.horiz);
        else { ctx.fillStyle = 'rgba(122,255,224,0.12)'; ctx.fillRect(x, y, TILE, TILE); }
      }
      if (g.open) {
        const c = g.cells[Math.floor(g.cells.length / 2)];
        const secs = Math.ceil(g.timer / 60);
        drawText(ctx, String(Math.max(0, secs)), c.tx * TILE + 8, c.ty * TILE - 2, secs <= 2 ? '#ff6060' : '#7affe0', { align: 'center', outline: '#0b0e1c' });
      }
    }
    // switches
    for (const s of this.switches) {
      if (!vis(s.x, s.y)) continue;
      const g = this.gates[s.gate], on = g && g.open;
      const x = Math.round(s.x), y = Math.round(s.y) + 4;
      px(ctx, x - 5, y + 1, '#0b0e1c', 11, 4); px(ctx, x - 4, y + 2, '#5d6478', 9, 2);
      disc(ctx, x, y - 2, 4.5, '#0b0e1c');
      disc(ctx, x, y - 2, 3.5, on ? '#7affe0' : (t >> 4) % 2 ? '#ff4d4d' : '#b3202e');
      px(ctx, x - 1, y - 4, '#ffffff', 2, 1);
      if (!on && !s.back) drawText(ctx, 'SWITCH', x, y - 14, (t >> 4) % 2 ? '#ffffff' : '#ffd23f', { align: 'center', outline: '#0b0e1c' });
    }
    // acid pools
    for (const a of this.acid) {
      if (!vis(a.x + 8, a.y + 8)) continue;
      const wave = Math.round(Math.sin(t * 0.08 + a.tx) * 1);
      ctx.fillStyle = '#3a6a12'; ctx.fillRect(a.x, a.y + TILE - 9 + wave, TILE, 9 - wave);
      ctx.fillStyle = '#7ad020'; ctx.fillRect(a.x, a.y + TILE - 9 + wave, TILE, 2);
      ctx.fillStyle = '#d0ff6a'; ctx.fillRect(a.x + ((t >> 2) + a.tx * 5) % 16, a.y + TILE - 9 + wave, 2, 1);
    }
    // portals
    for (const pt of this.portals)
      for (const e of [pt.a, pt.b]) {
        if (!vis(e.x, e.y)) continue;
        disc(ctx, e.x, e.y, 12, '#0b0e1c');
        for (let r = 11; r > 0; r -= 2) disc(ctx, e.x, e.y, r, ['#c080ff', '#6a3fc4', '#ff8ad8', '#2a1a6a'][(Math.floor(r / 2) + (t >> 3)) % 4]);
        for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.28 - t * 0.06; px(ctx, e.x + Math.cos(a) * 13 - 1, e.y + Math.sin(a) * 13 - 1, '#ffffff', 2, 2); }
      }
    // whirlpools
    for (const w of this.whirls) {
      if (!vis(w.x, w.y, 60)) continue;
      ctx.fillStyle = 'rgba(190,235,255,0.07)';
      ctx.beginPath(); ctx.arc(w.x, w.y, w.r, 0, 6.283); ctx.fill();
      ctx.beginPath(); ctx.arc(w.x, w.y, w.r * 0.55, 0, 6.283); ctx.fill();
      for (let arm = 0; arm < 4; arm++)
        for (let i = 0; i < 18; i++) {
          const r = 4 + i * 2.2, a = w.a + arm * 1.571 + i * 0.28 * w.dir;
          const al = 0.25 + (1 - i / 18) * 0.6;
          ctx.fillStyle = `rgba(225,250,255,${al.toFixed(2)})`;
          ctx.fillRect(Math.round(w.x + Math.cos(a) * r), Math.round(w.y + Math.sin(a) * r), i < 9 ? 2 : 1, i < 9 ? 2 : 1);
        }
      disc(ctx, w.x, w.y, 5, '#0b0e1c');
      for (let i = 0; i < 6; i++) { const a = -w.a * 2 + i * 1.05; tri(ctx, w.x + Math.cos(a) * 3, w.y + Math.sin(a) * 3, w.x + Math.cos(a + 0.5) * 8, w.y + Math.sin(a + 0.5) * 8, w.x, w.y, B.rock[2]); }
      disc(ctx, w.x, w.y, 2, '#02030a');
    }
    // crushers
    for (const c of this.crushers) {
      if (!vis(c.x, c.y, 80)) continue;
      const shake = c.warn ? ((t >> 1) % 2 ? 1 : -1) : 0;
      const r = this.crusherRect(c);
      const col = biome === 10 ? ['#56626e', '#3a4450', '#ffd23f'] : biome === 9 ? ['#6a5a30', '#4a3c1c', '#b6ff3a'] : ['#40367a', '#2c2458', '#7affe0'];
      // housing at the wall
      if (c.dir === 'v') { px(ctx, c.x - 13 + shake, c.a - 2, '#0b0e1c', 26, 5); px(ctx, c.x - 12 + shake, c.a - 1, col[1], 24, 3); }
      else { px(ctx, c.a - 2, c.y - 13 + shake, '#0b0e1c', 5, 26); px(ctx, c.a - 1, c.y - 12 + shake, col[1], 3, 24); }
      if (!r) continue;
      ctx.fillStyle = '#0b0e1c'; ctx.fillRect(Math.round(r.x) - 1 + (c.dir === 'v' ? shake : 0), Math.round(r.y) - 1, Math.round(r.w) + 2, Math.round(r.h) + 2);
      ctx.fillStyle = col[0]; ctx.fillRect(Math.round(r.x) + (c.dir === 'v' ? shake : 0), Math.round(r.y), Math.round(r.w), Math.round(r.h));
      ctx.fillStyle = col[1];
      if (c.dir === 'v') for (let yy = r.y + 4; yy < r.y + r.h - 2; yy += 6) ctx.fillRect(Math.round(r.x) + 2, Math.round(yy), Math.round(r.w) - 4, 2);
      else for (let xx = r.x + 4; xx < r.x + r.w - 2; xx += 6) ctx.fillRect(Math.round(xx), Math.round(r.y) + 2, 2, Math.round(r.h) - 4);
      // spiked face
      ctx.fillStyle = col[2];
      if (c.dir === 'v') for (let i = 0; i < 5; i++) tri(ctx, r.x + 1 + i * 4.4, r.y + r.h, r.x + 5 + i * 4.4, r.y + r.h, r.x + 3 + i * 4.4, r.y + r.h + 3, col[2]);
      else for (let i = 0; i < 5; i++) tri(ctx, r.x + r.w, r.y + 1 + i * 4.4, r.x + r.w, r.y + 5 + i * 4.4, r.x + r.w + 3, r.y + 3 + i * 4.4, col[2]);
    }
    // harpoon bundles
    for (const h of this.harpoons) {
      if (h.got || !vis(h.x, h.y)) continue;
      const y = Math.round(h.y + Math.sin(t * 0.07 + h.x) * 1.5);
      for (let i = -1; i <= 1; i++) {
        line(ctx, h.x - 6, y + i * 2 + 3, h.x + 5, y + i * 2 - 3, '#0b0e1c', 2);
        line(ctx, h.x - 6, y + i * 2 + 3, h.x + 5, y + i * 2 - 3, '#c8d0e0');
        px(ctx, h.x + 4, y + i * 2 - 4, '#ffd23f', 2, 2);
      }
      if ((t + h.x) % 90 < 6) px(ctx, h.x, y - 4, '#ffffff');
    }
  }

  drawGateTile(ctx, x, y, t, biome, horiz) {
    if (biome === 10) { // red laser grid
      ctx.fillStyle = 'rgba(255,40,40,0.18)'; ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = (t >> 2) % 2 ? '#ff4040' : '#ff8080';
      for (let i = 2; i < TILE; i += 5) horiz ? ctx.fillRect(x + i, y, 1, TILE) : ctx.fillRect(x, y + i, TILE, 1);
      return;
    }
    if (biome === 9) { // rusty bars
      ctx.fillStyle = '#2e2c1a'; ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = '#8a6a2a';
      for (let i = 1; i < TILE; i += 5) horiz ? ctx.fillRect(x + i, y, 2, TILE) : ctx.fillRect(x, y + i, TILE, 2);
      ctx.fillStyle = '#b6ff3a'; ctx.fillRect(x + ((t >> 3) % 14), y + 7, 2, 2);
      return;
    }
    // atlantis energy field
    ctx.fillStyle = 'rgba(58,240,255,0.22)'; ctx.fillRect(x, y, TILE, TILE);
    ctx.fillStyle = '#7affe0';
    for (let i = 0; i < TILE; i += 4) {
      const o = ((t >> 1) + i * 3) % TILE;
      horiz ? ctx.fillRect(x + i, y + o, 1, 3) : ctx.fillRect(x + o, y + i, 3, 1);
    }
  }

  drawFront(ctx, part) {
    const W = this.W, t = W.time;
    // hatchlings
    if (part === 'pups') for (const q of this.pups) {
      const x = Math.round(q.x), y = Math.round(q.y + Math.sin(q.t * 0.1) * 1.5), f = q.face || 1;
      if (q.state === 'wait') {
        disc(ctx, x, y, 9, 'rgba(200,240,255,0.25)');
        if ((t >> 4) % 2) drawText(ctx, 'HELP!', x, y - 16, '#ffffff', { align: 'center', outline: '#0b0e1c' });
      }
      ellipse(ctx, x, y, 5, 4, '#0b0e1c'); ellipse(ctx, x, y, 4, 3, '#4ab05a'); px(ctx, x - 2, y - 2, '#8ee05a', 3, 1); px(ctx, x - 1, y, '#2a7a3a', 2, 1);
      disc(ctx, x + f * 5, y - 1, 2.5, '#0b0e1c'); disc(ctx, x + f * 5, y - 1, 1.5, '#b8f0a0'); px(ctx, x + f * 6, y - 2, '#0b0e1c');
      px(ctx, x - 4, y + 3, '#2a7a3a', 2, 1); px(ctx, x + 2, y + 3, '#2a7a3a', 2, 1);
    }
    // escape wall
    if (part === 'wall' && this.wall) {
      const v = W.game.view, w = this.wall, cam = W.cam;
      const col = this.escape === 'right' ? ['#2e4c1a', '#6ac020', '#b6ff3a'] : this.escape === 'down' ? [W.B.rock[0], W.B.rock[1], W.B.rock[2]] : ['#5a1a0a', '#e0501a', '#ffb040'];
      if (this.escape === 'right') {
        const x = Math.round(w.pos);
        if (x > cam.x - 4) {
          ctx.fillStyle = col[0]; ctx.fillRect(Math.round(cam.x) - 2, Math.round(cam.y), x - Math.round(cam.x) + 2, v.h);
          for (let yy = Math.floor(cam.y / 4) * 4; yy < cam.y + v.h; yy += 4) {
            const o = Math.round(Math.sin(yy * 0.15 + t * 0.2) * 4);
            px(ctx, x + o, yy, col[1], 4, 4); px(ctx, x + o + 3, yy + 1, col[2], 2, 2);
          }
        }
      } else {
        const y = Math.round(w.pos), down = this.escape === 'down';
        const top = down ? Math.round(cam.y) - 2 : y, h = down ? y - Math.round(cam.y) + 2 : Math.round(cam.y + v.h) - y + 2;
        if (h > 0) {
          ctx.fillStyle = col[0]; ctx.fillRect(Math.round(cam.x), top, v.w, h);
          for (let xx = Math.floor(cam.x / 4) * 4; xx < cam.x + v.w; xx += 4) {
            const o = Math.round(Math.sin(xx * 0.15 + t * 0.2) * 3);
            px(ctx, xx, y + o - 2, col[1], 4, 4); px(ctx, xx + 1, y + o - (down ? -1 : 2), col[2], 2, 2);
          }
        }
      }
    }
  }

  lights() {
    const out = [];
    for (const pt of this.portals) for (const e of [pt.a, pt.b]) out.push({ x: e.x, y: e.y, r: 26, a: 0.8 });
    for (const s of this.switches) out.push({ x: s.x, y: s.y, r: 14, a: 0.6 });
    for (const q of this.pups) out.push({ x: q.x, y: q.y, r: 14, a: 0.5 });
    for (const h of this.harpoons) if (!h.got) out.push({ x: h.x, y: h.y, r: 12, a: 0.5 });
    for (const g of this.gates) if (!g.open) { const c = g.cells[0]; out.push({ x: c.tx * 16 + 8, y: c.ty * 16 + 8, r: 22, a: 0.5 }); }
    // hazards always glow so darkness never hides them
    for (const c of this.acid) out.push({ x: c.x + 8, y: c.y + 12, r: 16, a: 0.55 });
    for (const w of this.whirls) out.push({ x: w.x, y: w.y, r: 30, a: 0.5 });
    for (const c of this.crushers) {
      const r = this.crusherRect(c), mid = (c.a + c.b) / 2;
      out.push(c.dir === 'v' ? { x: c.x, y: r ? r.y + r.h : c.a, r: 24, a: 0.6 } : { x: r ? r.x + r.w : c.a, y: c.y, r: 24, a: 0.6 });
      out.push(c.dir === 'v' ? { x: c.x, y: mid, r: 20, a: 0.3 } : { x: mid, y: c.y, r: 20, a: 0.3 });
    }
    return out;
  }

  markers(dot, seen, w, reveal) {
    const known = (tx, ty) => reveal || seen[ty * w + tx];
    for (const q of this.pups) if (q.state === 'wait') dot(q.tx, q.ty, '#7affe0', true);
    for (const pt of this.portals) for (const e of [pt.a, pt.b]) if (known(e.tx, e.ty)) dot(e.tx, e.ty, '#c080ff', true);
    for (const s of this.switches) if (!s.back && known(s.tx, s.ty)) dot(s.tx, s.ty, '#ff4d4d', true);
    for (const h of this.harpoons) if (!h.got && known(h.tx, h.ty)) dot(h.tx, h.ty, '#ffd23f', false);
  }
}
