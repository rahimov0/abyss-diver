// Chapter 2 generator (levels 51-75). Independent pipeline so chapter 1 levels can never change.
// Adds: portals (links), switch-timed gates, whirlpools, crushers, acid pools, hatchlings, harpoon ammo,
// escape tunnels and boss rooms.
import { Grid, RNG, T, TILE, bfs, DIRS } from './grid.js';
import { roughen, bumps } from './archetypes.js';
import { ARCH2 } from './archetypes2.js';
import { removeNarrow, is2x2, nearest2x2, hRun, vRun, boxOpen, bfsDepth, px } from './generate.js';
import { validateLevel } from './validate.js';

const ORGANIC = new Set(['climb', 'hub', 'twin', 'escapeH', 'escapeV']);

export function generateLevel2(spec) {
  let lastErr = null;
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      const L = tryGenerate2(spec, spec.seed + attempt * 7919, attempt >= 20);
      if (!L) continue;
      const v = validateLevel(L);
      if (v.ok) { L.attempt = attempt; return L; }
      lastErr = v.errors.join('; ');
    } catch (e) { lastErr = e.message + ' ' + (e.stack || '').split('\n')[1]; }
  }
  throw new Error(`Level ${spec.id} "${spec.name}" failed to generate: ${lastErr}`);
}

const passOpen = (t) => t !== T.ROCK;

function tryGenerate2(spec, seed, relax) {
  const rng = new RNG(seed);
  const P = { ...(spec.p || {}), dir: spec.escape, links: spec.portals, walls: spec.arch === 'city' ? spec.gates : 0, single: spec.gates > 0 };
  const g = new Grid(spec.w, spec.h);
  const hint = ARCH2[spec.arch](g, rng, P);
  if (ORGANIC.has(spec.arch)) { roughen(g, rng, 1); bumps(g, rng, 1); }
  removeNarrow(g);
  const sp = nearest2x2(g, hint.x, hint.y);
  if (!sp) return null;

  // ---------- portal links ----------
  const links = new Map();
  const portals = [];
  const link = (a, b) => {
    const ia = g.idx(a.x, a.y), ib = g.idx(b.x, b.y);
    links.set(ia, [...(links.get(ia) || []), ib]);
    links.set(ib, [...(links.get(ib) || []), ia]);
    portals.push({ a: { tx: a.x, ty: a.y, x: (a.x + 1) * TILE, y: (a.y + 1) * TILE }, b: { tx: b.x, ty: b.y, x: (b.x + 1) * TILE, y: (b.y + 1) * TILE } });
  };
  for (const l of hint.links || []) {
    const a = nearest2x2(g, l.a.x, l.a.y), b = nearest2x2(g, l.b.x, l.b.y);
    if (!a || !b) return null;
    link(a, b);
  }

  // drop unreachable water (portals count as connections)
  let dist = bfs(g, [sp], (t) => t === T.WATER, links).dist;
  let reach = 0;
  for (let i = 0; i < g.t.length; i++)
    if (g.t[i] === T.WATER) { if (dist[i] < 0) g.t[i] = T.ROCK; else reach++; }
  if (reach < spec.w * spec.h * 0.14) return null;

  const occ = new Uint8Array(g.w * g.h);
  const secret = new Uint8Array(g.w * g.h);
  const mark = (x, y, r = 1) => {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (g.in(x + dx, y + dy)) occ[g.idx(x + dx, y + dy)] = 1;
  };
  mark(sp.x, sp.y, 2); mark(sp.x + 1, sp.y + 1, 2);
  for (const p of portals) { mark(p.a.tx, p.a.ty, 2); mark(p.b.tx, p.b.ty, 2); }

  // ---------- portal vaults: sealed rooms only reachable through a portal ----------
  const vaultCells = [];
  if (spec.arch !== 'twin') {
    for (let v = 0; v < (spec.portals || 0); v++) {
      let made = false;
      const cands = [];
      for (let y = 7; y < g.h - 7; y++) for (let x = 7; x < g.w - 7; x++) cands.push([x, y]);
      rng.shuffle(cands);
      for (const [cx, cy] of cands.slice(0, 400)) {
        let ok = true;
        for (let dy = -5; dy <= 5 && ok; dy++) for (let dx = -5; dx <= 5 && ok; dx++) if (g.get(cx + dx, cy + dy) !== T.ROCK) ok = false;
        if (!ok) continue;
        g.circle(cx + 0.5, cy + 0.5, 3.1);
        g.circle(cx + 0.5 + rng.range(-0.6, 0.6), cy + 0.5 + rng.range(-0.6, 0.6), 2.4);
        for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) if (g.open(cx + dx, cy + dy)) vaultCells.push(g.idx(cx + dx, cy + dy));
        // portal A somewhere far in the main cave
        const d0 = bfs(g, [sp], (t) => t === T.WATER, links).dist;
        let best = null, bd = -1;
        for (let y = 1; y < g.h - 2; y++) for (let x = 1; x < g.w - 2; x++) {
          const j = g.idx(x, y);
          if (d0[j] < 0 || occ[j] || !is2x2(g, x, y)) continue;
          const s = d0[j] * (0.6 + rng.next() * 0.4);
          if (s > bd) { bd = s; best = { x, y }; }
        }
        const b = nearest2x2(g, cx, cy);
        if (!best || !b) { for (const j of vaultCells) g.t[j] = T.ROCK; vaultCells.length = 0; continue; }
        link(best, b);
        mark(best.x, best.y, 2); mark(b.x, b.y, 1);
        made = true;
        break;
      }
      if (!made && !relax) return null;
    }
  }
  dist = bfs(g, [sp], (t) => t === T.WATER, links).dist;

  // ---------- exit ----------
  let ex = null;
  if (hint.exitHint || spec.exitAt === 'center') {
    const h0 = hint.exitHint || { x: Math.floor(g.w / 2), y: Math.floor(g.h / 2) };
    let bd = 1e9;
    for (let y = 1; y < g.h - 2; y++) for (let x = 1; x < g.w - 2; x++) {
      if (dist[g.idx(x, y)] < 0 || !is2x2(g, x, y) || occ[g.idx(x, y)]) continue;
      const d = Math.hypot(x - h0.x, y - h0.y);
      if (d < bd) { bd = d; ex = { x, y }; }
    }
  } else {
    let bestScore = -1;
    for (let y = 1; y < g.h - 2; y++) for (let x = 1; x < g.w - 2; x++) {
      const d = dist[g.idx(x, y)];
      if (d < 0 || !is2x2(g, x, y) || occ[g.idx(x, y)]) continue;
      const floor = !g.open(x, y + 2) && !g.open(x + 1, y + 2);
      const s = d + (floor ? 8 : 0);
      if (s > bestScore) { bestScore = s; ex = { x, y }; }
    }
  }
  if (!ex) return null;
  mark(ex.x, ex.y, 2); mark(ex.x + 1, ex.y + 1, 2);

  // main path (may jump through portals)
  const pr = bfs(g, [sp], (t) => t === T.WATER, links);
  const path = [];
  for (let i = g.idx(ex.x, ex.y); i !== -1; i = pr.parent[i]) path.push({ x: i % g.w, y: (i / g.w) | 0 });
  path.reverse();
  const PL = path.length;
  if (!spec.boss && PL < 20) return null;
  const onPath = new Uint8Array(g.w * g.h);
  for (const q of path) onPath[g.idx(q.x, q.y)] = 1;

  // ---------- gates (cut on the path) + switches ----------
  const gates = [];
  const tryGate = (lo, hi) => {
    const ks = [];
    for (let k = Math.max(4, lo); k <= Math.min(PL - 5, hi); k++) ks.push(k);
    rng.shuffle(ks);
    for (const k of ks.slice(0, 60)) {
      const c = path[k], a = path[k - 1], b = path[k + 1];
      if (Math.abs(a.x - c.x) + Math.abs(a.y - c.y) !== 1 || Math.abs(b.x - c.x) + Math.abs(b.y - c.y) !== 1) continue; // not across a portal
      const horiz = Math.abs(b.x - a.x) >= Math.abs(b.y - a.y);
      const [pdx, pdy] = horiz ? [0, 1] : [1, 0];
      const cells = [c];
      let ok = true;
      for (const s of [1, -1]) {
        let n = 1;
        while (g.open(c.x + pdx * s * n, c.y + pdy * s * n)) { cells.push({ x: c.x + pdx * s * n, y: c.y + pdy * s * n }); n++; if (cells.length > 6) { ok = false; break; } }
        if (!ok) break;
        if (g.get(c.x + pdx * s * n, c.y + pdy * s * n) !== T.ROCK) ok = false;
      }
      if (!ok || cells.length < 2 || cells.some((q) => occ[g.idx(q.x, q.y)])) continue;
      for (const q of cells) g.set(q.x, q.y, T.ROCK);
      const chk = bfs(g, [sp], passOpen, links);
      const separated = chk.dist[g.idx(ex.x, ex.y)] < 0;
      for (const q of cells) g.set(q.x, q.y, T.WATER);
      if (!separated) continue;
      for (const q of cells) { g.set(q.x, q.y, T.GATE); mark(q.x, q.y, 1); }
      gates.push({ k, cells, horiz });
      return true;
    }
    return false;
  };
  const ng = spec.gates || 0;
  for (let i = 0; i < ng; i++) {
    const center = Math.floor((PL * (i + 1)) / (ng + 1)), half = Math.max(3, Math.floor(PL / (ng + 1) / 2) - 2);
    tryGate(center - half, center + half);
  }
  if (!relax && gates.length < ng) return null;
  gates.sort((a, b) => a.k - b.k);
  const switches = [];
  gates.forEach((gt, i) => {
    // region before this gate: gates with index >= i closed (earlier gates assumed opened by their switch)
    gt.id = i;
    const passK = (t) => t === T.WATER || t === T.CRACK;
    for (const o of gates) for (const q of o.cells) g.set(q.x, q.y, o.id !== undefined && o.id < i ? T.WATER : T.GATE);
    const reg = bfs(g, [sp], passK, links).dist;
    for (const o of gates) for (const q of o.cells) g.set(q.x, q.y, T.GATE);
    const gd = bfs(g, gt.cells.map((q) => ({ x: q.x, y: q.y })), (t) => t !== T.ROCK).dist;
    let best = null, bs = 1e9;
    for (let j = 0; j < g.t.length; j++) {
      if (reg[j] < 0 || g.t[j] !== T.WATER || occ[j] || gd[j] < 0) continue;
      const want = 9 + rng.next() * 7; // the switch sits a short swim away from its gate
      const s = Math.abs(gd[j] - want) + (g.get(j % g.w, ((j / g.w) | 0) + 1) === T.ROCK ? 0 : 2);
      if (s < bs) { bs = s; best = j; }
    }
    if (best === null) return;
    const sx = best % g.w, sy = (best / g.w) | 0;
    const tiles = gd[best];
    const time = Math.round((((tiles * TILE) / (2.3 * 60)) * 1.8 + 2.5) * 10) / 10;
    switches.push({ tx: sx, ty: sy, x: px(sx), y: px(sy), gate: i, time });
    mark(sx, sy, 1);
    // a second switch just behind the gate so you can always come back
    const after = path[Math.min(PL - 2, gt.k + 3)];
    if (after && g.open(after.x, after.y) && !occ[g.idx(after.x, after.y)]) {
      switches.push({ tx: after.x, ty: after.y, x: px(after.x), y: px(after.y), gate: i, time: 4, back: true });
      mark(after.x, after.y, 1);
    }
    gt.time = time;
  });

  // reachability with everything open (gates + portals)
  const reachD = bfs(g, [sp], passOpen, links).dist;
  const inVault = new Set(vaultCells);
  const freeCell = (j) => reachD[j] >= 0 && g.t[j] === T.WATER && !occ[j] && !secret[j];

  // ---------- small sealed pockets (cages for hatchlings / chests) ----------
  const carvePocket = () => {
    const cand = [];
    for (let y = 2; y < g.h - 2; y++) for (let x = 2; x < g.w - 2; x++) {
      if (!g.open(x, y) || reachD[g.idx(x, y)] < 8 || occ[g.idx(x, y)]) continue;
      for (const [dx, dy] of DIRS) if (g.get(x + dx, y + dy) === T.ROCK) cand.push([x, y, dx, dy]);
    }
    rng.shuffle(cand);
    for (const [x, y, dx, dy] of cand.slice(0, 600)) {
      const pdx = Math.abs(dy), pdy = Math.abs(dx);
      let ok = true;
      for (let s = 1; s <= 5 && ok; s++) for (let o = -1; o <= 2 && ok; o++) {
        const cx = x + dx * s + pdx * o, cy = y + dy * s + pdy * o;
        if (!g.in(cx, cy) || g.get(cx, cy) !== T.ROCK) ok = false;
        if (s <= 4 && o >= 0 && o <= 1 && !g.inner(cx, cy)) ok = false;
      }
      if (!ok) continue;
      for (let s = 1; s <= 4; s++) for (let o = 0; o <= 1; o++) {
        const cx = x + dx * s + pdx * o, cy = y + dy * s + pdy * o;
        g.set(cx, cy, s === 1 ? T.CRACK : T.WATER);
        secret[g.idx(cx, cy)] = 1; occ[g.idx(cx, cy)] = 1;
      }
      mark(x, y, 1);
      const c = { x: x + dx * 4, y: y + dy * 4 };
      return { tx: c.x, ty: c.y, x: px(c.x), y: px(c.y), secret: true };
    }
    return null;
  };

  // ---------- farthest-point sampling ----------
  const anchors = [{ x: sp.x, y: sp.y }, { x: ex.x, y: ex.y }, ...switches.map((q) => ({ x: q.tx, y: q.ty }))];
  const fps = (n, filter, pts0, jitter = 0.3) => {
    const out = [];
    const cands = [];
    for (let j = 0; j < g.t.length; j++) if (filter(j)) cands.push(j);
    const pts = pts0.slice();
    for (let k = 0; k < n && cands.length; k++) {
      let bj = -1, bs = -1;
      for (const j of cands) {
        if (occ[j]) continue;
        const x = j % g.w, y = (j / g.w) | 0;
        let m = 1e9;
        for (const p of pts) { const d = Math.hypot(p.x - x, p.y - y); if (d < m) m = d; }
        const s = m * (1 - jitter / 2 + rng.next() * jitter) + (inVault.has(j) ? 6 : 0);
        if (s > bs) { bs = s; bj = j; }
      }
      if (bj < 0) break;
      const x = bj % g.w, y = (bj / g.w) | 0;
      out.push({ tx: x, ty: y, x: px(x), y: px(y) });
      pts.push({ x, y }); mark(x, y, 1);
    }
    return out;
  };

  // hatchlings: in rock cages (dash to free) when possible, else waiting in open water
  const pups = [];
  for (let i = 0; i < (spec.pups || 0); i++) {
    const c = i % 2 === 0 ? carvePocket() : null;
    if (c) pups.push(c);
  }
  if (pups.length < (spec.pups || 0)) pups.push(...fps(spec.pups - pups.length, (j) => freeCell(j) && reachD[j] >= 10, anchors.concat(pups.map((q) => ({ x: q.tx, y: q.ty })))));
  if (pups.length < (spec.pups || 0)) return null;

  const gems = fps(spec.gems, (j) => freeCell(j) && reachD[j] >= 4, anchors.concat(pups.map((q) => ({ x: q.tx, y: q.ty }))));
  if (gems.length < spec.gems) return null;

  const chests = [];
  for (let i = 0; i < Math.floor((spec.chests || 0) / 2); i++) { const c = carvePocket(); if (c) chests.push(c); }
  if (chests.length < (spec.chests || 0)) {
    chests.push(...fps((spec.chests || 0) - chests.length, (j) => {
      if (!freeCell(j) || reachD[j] < 8) return false;
      return g.get(j % g.w, ((j / g.w) | 0) + 1) === T.ROCK;
    }, anchors.concat(gems.map((q) => ({ x: q.tx, y: q.ty }))), 0.2));
  }

  // harpoon ammo bundles (4 bolts each); the first one close to the start
  const harpoons = [];
  if (spec.harpoon) {
    const n = Math.ceil(spec.harpoon / 4);
    const near = fps(1, (j) => freeCell(j) && reachD[j] >= 3 && reachD[j] <= 10, [{ x: sp.x, y: sp.y }], 0.1);
    harpoons.push(...near);
    harpoons.push(...fps(n - near.length, (j) => freeCell(j) && reachD[j] >= 6, anchors.concat(gems.map((q) => ({ x: q.tx, y: q.ty })))));
    if (spec.boss) for (const h of harpoons) h.respawn = true;
  }

  // ---------- air (coverage guarantee, portals respected by placing air in every unreached area) ----------
  const air = [];
  const R = spec.airR || 24;
  const covered = new Uint8Array(g.w * g.h);
  const cover = (c) => { for (const q of bfsDepth(g, c, R, passOpen)) covered[g.idx(q.x, q.y)] = 1; };
  cover(sp);
  for (let guard = 0; guard < 220; guard++) {
    let u = -1, ud = 1e9;
    for (let j = 0; j < g.t.length; j++) if (reachD[j] >= 0 && !covered[j] && !secret[j] && reachD[j] < ud) { ud = reachD[j]; u = j; }
    if (u < 0) break;
    const ux = u % g.w, uy = (u / g.w) | 0;
    let v = null, vd = -1;
    for (const q of bfsDepth(g, { x: ux, y: uy }, Math.floor(R / 2), passOpen)) {
      const j = g.idx(q.x, q.y);
      if (g.t[j] !== T.WATER || secret[j] || occ[j]) continue;
      if (reachD[j] > vd) { vd = reachD[j]; v = q; }
    }
    if (!v) v = { x: ux, y: uy };
    for (let s = 0; s < 3 && g.open(v.x, v.y + 1) && !occ[g.idx(v.x, v.y + 1)]; s++) v = { x: v.x, y: v.y + 1 };
    air.push({ tx: v.x, ty: v.y, x: px(v.x), y: px(v.y) });
    mark(v.x, v.y, 1);
    cover(v); covered[u] = 1;
  }

  const goals = [...gems, ...pups, ...chests, ...harpoons, ...air, ...switches];
  const nearGoal = (x, y, r) => goals.some((q) => Math.hypot(q.tx - x, q.ty - y) < r);
  const nearSpawnExit = (x, y, r) => Math.hypot(x - sp.x, y - sp.y) < r || Math.hypot(x - ex.x, y - ex.y) < r;

  // ---------- whirlpools ----------
  const whirls = [];
  if (spec.whirl) {
    const cand = [];
    const openNear = (x, y) => { let n = 0; for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (g.open(x + dx, y + dy)) n++; return n; };
    for (let y = 3; y < g.h - 3; y++) for (let x = 3; x < g.w - 3; x++) if (reachD[g.idx(x, y)] >= 0 && boxOpen(g, x, y, 1) && openNear(x, y) >= 30) cand.push([x, y]);
    rng.shuffle(cand);
    for (const [x, y] of cand) {
      if (whirls.length >= spec.whirl) break;
      if (nearSpawnExit(x, y, 7) || nearGoal(x, y, 3.5) || whirls.some((w) => Math.hypot(w.tx - x, w.ty - y) < 12)) continue;
      if (portals.some((p) => Math.hypot(p.a.tx - x, p.a.ty - y) < 5 || Math.hypot(p.b.tx - x, p.b.ty - y) < 5)) continue;
      whirls.push({ tx: x, ty: y, x: px(x), y: px(y), r: 44, dir: rng.chance(0.5) ? 1 : -1 });
    }
  }

  // ---------- crushers ----------
  const crushers = [];
  if (spec.crush) {
    const cand = [];
    for (let y = 2; y < g.h - 2; y++) for (let x = 2; x < g.w - 2; x++) if (reachD[g.idx(x, y)] >= 0 && g.t[g.idx(x, y)] === T.WATER) cand.push([x, y]);
    rng.shuffle(cand);
    for (const [x, y] of cand) {
      if (crushers.length >= spec.crush) break;
      if (nearSpawnExit(x, y, 7) || nearGoal(x, y, 3) || crushers.some((c) => Math.hypot(c.tx - x, c.ty - y) < 9)) continue;
      const [va, vb] = vRun(g, x, y), [ha, hb] = hRun(g, x, y);
      let c = null;
      if (vb - va >= 2 && vb - va <= 4 && hb - ha >= 5) c = { dir: 'v', a: va * TILE, b: (vb + 1) * TILE, x: px(x), y: (va + vb + 1) * TILE / 2 };
      else if (hb - ha >= 2 && hb - ha <= 4 && vb - va >= 5) c = { dir: 'h', a: ha * TILE, b: (hb + 1) * TILE, x: (ha + hb + 1) * TILE / 2, y: px(y) };
      if (!c) continue;
      // keep crushers out of gate/portal mouths
      let bad = false;
      for (let dy = -2; dy <= 2 && !bad; dy++) for (let dx = -2; dx <= 2; dx++) { const t = g.get(x + dx, y + dy); if (t === T.GATE || t === T.CRACK) { bad = true; break; } }
      if (bad) continue;
      crushers.push({ tx: x, ty: y, ...c, phase: rng.int(0, 200), period: rng.int(150, 210) });
    }
  }

  // ---------- acid pools (never on the route, never cutting anything off) ----------
  const acid = [];
  if (spec.acid) {
    const isAcid = new Uint8Array(g.w * g.h);
    const goalCells = [...goals, { tx: ex.tx ?? ex.x, ty: ex.ty ?? ex.y }];
    const goalsReachable = () => {
      const d = bfs(g, [sp], (t, x, y) => t !== T.ROCK && !isAcid[y * g.w + x], links).dist;
      if (d[g.idx(ex.x, ex.y)] < 0) return false;
      return goalCells.every((q) => d[g.idx(q.tx, q.ty)] >= 0);
    };
    const seeds = [];
    for (let y = 2; y < g.h - 2; y++) for (let x = 2; x < g.w - 2; x++) {
      const j = g.idx(x, y);
      if (g.t[j] === T.WATER && g.get(x, y + 1) === T.ROCK && !onPath[j] && !occ[j] && reachD[j] >= 0) seeds.push([x, y]);
    }
    rng.shuffle(seeds);
    let pools = 0;
    const want = Math.max(3, Math.floor((g.w * g.h) / 260));
    for (const [x, y] of seeds) {
      if (pools >= want) break;
      if (isAcid[g.idx(x, y)] || nearSpawnExit(x, y, 6) || nearGoal(x, y, 2.5)) continue;
      const cells = [];
      for (const dir of [1, -1]) for (let k = dir === 1 ? 0 : 1; k < 6; k++) {
        const cx = x + dir * k, j = g.idx(cx, y);
        if (g.t[j] !== T.WATER || g.get(cx, y + 1) !== T.ROCK || onPath[j] || occ[j] || nearGoal(cx, y, 2.5)) break;
        cells.push(j);
      }
      if (cells.length < 2) continue;
      for (const j of cells) isAcid[j] = 1;
      if (!goalsReachable()) { for (const j of cells) isAcid[j] = 0; continue; }
      acid.push(...cells.map((j) => ({ tx: j % g.w, ty: (j / g.w) | 0 })));
      pools++;
    }
  }

  // ---------- enemies ----------
  const enemies = [];
  const blockers = goals.map((q) => ({ x: q.tx, y: q.ty }));
  const acidSet = new Set(acid.map((a) => g.idx(a.tx, a.ty)));
  const okSpot = (x, y, space) => {
    const j = g.idx(x, y);
    if (!g.open(x, y) || reachD[j] < (spec.safe || 8) || secret[j] || acidSet.has(j)) return false;
    if (Math.hypot(x - ex.x - 0.5, y - ex.y - 0.5) < 4) return false;
    if (blockers.some((b) => Math.hypot(b.x - x, b.y - y) < 1.5)) return false;
    if (enemies.some((e) => Math.hypot(e.tx - x, e.ty - y) < space)) return false;
    if (whirls.some((w) => Math.hypot(w.tx - x, w.ty - y) < 4)) return false;
    if (crushers.some((c) => Math.hypot(c.tx - x, c.ty - y) < 3)) return false;
    return true;
  };
  const floorRun = (x, y) => {
    if (g.get(x, y + 1) !== T.ROCK) return null;
    let a = x, b = x;
    while (g.open(a - 1, y) && g.get(a - 1, y + 1) === T.ROCK) a--;
    while (g.open(b + 1, y) && g.get(b + 1, y + 1) === T.ROCK) b++;
    return [a, b];
  };
  const finders = {
    fish: (x, y) => { const [a, b] = hRun(g, x, y); return b - a >= 5 && { x0: a, x1: b }; },
    drone: (x, y) => { const [a, b] = hRun(g, x, y); return b - a >= 6 && { x0: a, x1: b }; },
    jelly: (x, y) => { const [a, b] = vRun(g, x, y); return b - a >= 5 && { y0: a, y1: b }; },
    zapper: (x, y) => { const [a, b] = vRun(g, x, y); return b - a >= 4 && boxOpen(g, x, y, 1) && { y0: a, y1: b }; },
    crab: (x, y) => { const r = floorRun(x, y); return r && r[1] - r[0] >= 3 && g.open(x, y - 1) && { x0: r[0], x1: r[1] }; },
    sludge: (x, y) => { const r = floorRun(x, y); return r && r[1] - r[0] >= 4 && g.open(x, y - 1) && g.open(x, y - 2) && { x0: r[0], x1: r[1] }; },
    sentinel: (x, y) => { if (g.get(x, y + 1) !== T.ROCK) return false; const [a] = vRun(g, x, y); return y - a >= 3 && {}; },
    gasvent: (x, y) => { if (g.get(x, y + 1) !== T.ROCK) return false; const [a] = vRun(g, x, y); return y - a >= 5 && { top: a }; },
    urchin: (x, y) => {
      for (const [dx, dy] of DIRS) {
        if (g.get(x + dx, y + dy) !== T.ROCK) continue;
        const [a, b] = dx ? hRun(g, x, y) : vRun(g, x, y), [c, d] = dx ? vRun(g, x, y) : hRun(g, x, y);
        if (b - a >= 4 && d - c >= 2) return { ax: dx, ay: dy };
      }
      return false;
    },
    puffer: (x, y) => boxOpen(g, x, y, 1) && {},
    eel: (x, y) => {
      const [a, b] = hRun(g, x, y);
      if (b - a < 6) return false;
      if (x === a && g.get(x - 1, y) === T.ROCK) return { dir: 1, len: Math.min(5, b - a - 1) };
      if (x === b && g.get(x + 1, y) === T.ROCK) return { dir: -1, len: Math.min(5, b - a - 1) };
      return false;
    },
    mine: (x, y) => { if (!boxOpen(g, x, y, 1)) return false; let d = 1; while (d < 9 && g.open(x, y + d)) d++; return { chain: g.open(x, y + d) ? 0 : d }; },
    spinner: (x, y) => { for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (dx * dx + dy * dy <= 6.25 && !g.open(x + dx, y + dy)) return false; return {}; },
    shark: (x, y) => boxOpen(g, x, y, 2) && {},
    angler: (x, y) => boxOpen(g, x, y, 1) && {},
  };
  const space = { spinner: 6, shark: 8, angler: 6, sentinel: 5, gasvent: 4 };
  const cells = [];
  for (let y = 1; y < g.h - 1; y++) for (let x = 1; x < g.w - 1; x++) if (g.open(x, y)) cells.push([x, y]);
  for (const [type, count] of Object.entries(spec.enemies || {})) {
    rng.shuffle(cells);
    let placed = 0;
    for (const [x, y] of cells) {
      if (placed >= count) break;
      if (!finders[type] || !okSpot(x, y, space[type] || 3.2)) continue;
      const data = finders[type](x, y);
      if (!data) continue;
      enemies.push({ type, tx: x, ty: y, x: px(x), y: px(y), ...data });
      placed++;
    }
    if (!relax && placed < count) return null;
  }
  if (spec.boss) enemies.push({ type: 'boss2', kind: spec.boss, tx: Math.floor(g.w / 2), ty: Math.floor(g.h / 2), x: px(Math.floor(g.w / 2)), y: px(Math.floor(g.h / 2)) });

  // ---------- decoration ----------
  const deco = [];
  for (let y = 1; y < g.h - 1; y++) for (let x = 1; x < g.w - 1; x++) {
    const j = g.idx(x, y);
    if (g.t[j] !== T.WATER || acidSet.has(j)) continue;
    if (g.get(x, y + 1) === T.ROCK && rng.chance(0.2)) deco.push({ k: 'floor', v: rng.int(0, 5), x: px(x) + rng.int(-4, 4), y: (y + 1) * TILE, s: rng.next() });
    else if (g.get(x, y - 1) === T.ROCK && rng.chance(0.1)) deco.push({ k: 'ceil', v: rng.int(0, 3), x: px(x) + rng.int(-4, 4), y: y * TILE, s: rng.next() });
  }

  return {
    spec, w: g.w, h: g.h, tiles: g.t,
    spawn: { tx: sp.x, ty: sp.y, x: (sp.x + 1) * TILE, y: (sp.y + 1) * TILE },
    exit: { tx: ex.x, ty: ex.y, x: (ex.x + 1) * TILE, y: (ex.y + 1) * TILE },
    gems, keys: [], chests, air, enemies, currents: [], vents: [], deco,
    // chapter 2
    portals, gates: gates.map((gt) => ({ id: gt.id, cells: gt.cells.map((q) => ({ tx: q.x, ty: q.y })), time: gt.time, horiz: gt.horiz })),
    switches, whirls, crushers, acid, pups, harpoons,
    escape: spec.escape || null, boss: spec.boss || null,
    doorsPlaced: 0, pathLen: PL,
  };
}
