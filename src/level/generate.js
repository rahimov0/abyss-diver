// Turns a level spec into a fully placed, validated level.
import { Grid, RNG, T, TILE, bfs, passWater, passAll, DIRS } from './grid.js';
import { ARCH, roughen, bumps } from './archetypes.js';
import { validateLevel } from './validate.js';

const GEOMETRIC = new Set(['maze', 'spiral', 'wreck']);

export function generateLevel(spec) {
  let lastErr = null;
  for (let attempt = 0; attempt < 24; attempt++) {
    try {
      const L = tryGenerate(spec, spec.seed + attempt * 7919, attempt >= 16);
      if (!L) continue;
      const v = validateLevel(L);
      if (v.ok) { L.attempt = attempt; return L; }
      lastErr = v.errors.join('; ');
    } catch (e) { lastErr = e.message; }
  }
  throw new Error(`Level ${spec.id} "${spec.name}" failed to generate: ${lastErr}`);
}

const px = (c) => c * TILE + TILE / 2;

function removeNarrow(g) {
  const keep = new Uint8Array(g.w * g.h);
  for (let y = 0; y < g.h - 1; y++)
    for (let x = 0; x < g.w - 1; x++)
      if (g.open(x, y) && g.open(x + 1, y) && g.open(x, y + 1) && g.open(x + 1, y + 1)) {
        keep[g.idx(x, y)] = keep[g.idx(x + 1, y)] = keep[g.idx(x, y + 1)] = keep[g.idx(x + 1, y + 1)] = 1;
      }
  for (let i = 0; i < g.t.length; i++) if (g.t[i] === T.WATER && !keep[i]) g.t[i] = T.ROCK;
}

const is2x2 = (g, x, y) => g.open(x, y) && g.open(x + 1, y) && g.open(x, y + 1) && g.open(x + 1, y + 1);

function nearest2x2(g, x, y) {
  for (let r = 0; r < Math.max(g.w, g.h); r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (is2x2(g, x + dx, y + dy)) return { x: x + dx, y: y + dy };
      }
  return null;
}

function hRun(g, x, y) {
  let a = x, b = x;
  while (g.open(a - 1, y)) a--;
  while (g.open(b + 1, y)) b++;
  return [a, b];
}
function vRun(g, x, y) {
  let a = y, b = y;
  while (g.open(x, a - 1)) a--;
  while (g.open(x, b + 1)) b++;
  return [a, b];
}

function boxOpen(g, x, y, r) {
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (!g.open(x + dx, y + dy)) return false;
  return true;
}

function bfsDepth(g, start, maxD, pass) {
  const out = [];
  const seen = new Map();
  const q = [[start.x, start.y, 0]];
  seen.set(g.idx(start.x, start.y), 0);
  while (q.length) {
    const [x, y, d] = q.shift();
    out.push({ x, y, d });
    if (d >= maxD) continue;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy;
      if (!g.in(nx, ny)) continue;
      const j = g.idx(nx, ny);
      if (seen.has(j) || !pass(g.t[j])) continue;
      seen.set(j, d + 1);
      q.push([nx, ny, d + 1]);
    }
  }
  return out;
}

function tryGenerate(spec, seed, relax) {
  const rng = new RNG(seed);
  const P = spec.p || {};
  const g = new Grid(spec.w, spec.h);
  const hint = ARCH[spec.arch](g, rng, P);
  if (!GEOMETRIC.has(spec.arch)) {
    roughen(g, rng, P.rough ?? 1);
    bumps(g, rng, ['zigzag', 'pillars', 'islands', 'arena'].includes(spec.arch) ? 2.5 : 1);
  }
  removeNarrow(g);
  const sp = nearest2x2(g, hint.x, hint.y);
  if (!sp) return null;

  // drop everything not connected to the spawn
  let { dist } = bfs(g, [sp], passWater);
  let reach = 0;
  for (let i = 0; i < g.t.length; i++)
    if (g.t[i] === T.WATER) { if (dist[i] < 0) g.t[i] = T.ROCK; else reach++; }
  if (reach < spec.w * spec.h * 0.16) return null;

  const occ = new Uint8Array(g.w * g.h); // occupied by placements
  const secret = new Uint8Array(g.w * g.h);
  const mark = (x, y, r = 1) => {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (g.in(x + dx, y + dy)) occ[g.idx(x + dx, y + dy)] = 1;
  };
  mark(sp.x, sp.y, 2); mark(sp.x + 1, sp.y + 1, 2);

  // ---------- exit: farthest 2x2 spot, prefers resting on a floor ----------
  let best = null, bestScore = -1;
  for (let y = 1; y < g.h - 2; y++)
    for (let x = 1; x < g.w - 2; x++) {
      const d = dist[g.idx(x, y)];
      if (d < 0 || !is2x2(g, x, y)) continue;
      const floor = !g.open(x, y + 2) && !g.open(x + 1, y + 2);
      const s = d + (floor ? 8 : 0);
      if (s > bestScore) { bestScore = s; best = { x, y }; }
    }
  if (!best || bestScore < 20) return null;
  const ex = best;
  mark(ex.x, ex.y, 2); mark(ex.x + 1, ex.y + 1, 2);

  // main path spawn -> exit
  const pr = bfs(g, [sp], passWater);
  const path = [];
  for (let i = g.idx(ex.x, ex.y); i !== -1; i = pr.parent[i]) path.push({ x: i % g.w, y: (i / g.w) | 0 });
  path.reverse();

  // ---------- cuts (locked doors + breakable walls on the main path) ----------
  const cuts = [];
  const tryCut = (lo, hi, tile) => {
    const ks = [];
    for (let k = Math.max(2, lo); k <= Math.min(path.length - 3, hi); k++) ks.push(k);
    rng.shuffle(ks);
    for (const k of ks.slice(0, 60)) {
      const c = path[k], a = path[k - 1], b = path[k + 1];
      const horiz = Math.abs(b.x - a.x) >= Math.abs(b.y - a.y);
      const [pdx, pdy] = horiz ? [0, 1] : [1, 0];
      const cells = [c];
      let ok = true;
      for (const s of [1, -1]) {
        let n = 1;
        while (g.open(c.x + pdx * s * n, c.y + pdy * s * n)) {
          cells.push({ x: c.x + pdx * s * n, y: c.y + pdy * s * n });
          n++;
          if (cells.length > 6) { ok = false; break; }
        }
        if (!ok) break;
        if (g.get(c.x + pdx * s * n, c.y + pdy * s * n) !== T.ROCK) ok = false;
      }
      if (!ok || cells.length < 2) continue;
      if (cells.some((q) => occ[g.idx(q.x, q.y)])) continue;
      // keep a clear tile on both sides along the travel axis
      const [tdx, tdy] = horiz ? [1, 0] : [0, 1];
      if (cells.some((q) => !g.open(q.x + tdx, q.y + tdy) && !g.open(q.x - tdx, q.y - tdy))) continue;
      for (const q of cells) g.set(q.x, q.y, T.ROCK);
      const chk = bfs(g, [sp], passAll);
      const separated = chk.dist[g.idx(ex.x, ex.y)] < 0;
      for (const q of cells) g.set(q.x, q.y, T.WATER);
      if (!separated) continue;
      for (const q of cells) { g.set(q.x, q.y, tile); mark(q.x, q.y, 1); }
      cuts.push({ k, tile, cells });
      return true;
    }
    return false;
  };
  const L = path.length;
  const nd = spec.doors || 0;
  for (let d = 0; d < nd; d++) {
    const center = Math.floor((L * (d + 1)) / (nd + 1));
    const half = Math.max(3, Math.floor(L / (nd + 1) / 2) - 2);
    tryCut(center - half, center + half, T.DOOR0 + d);
  }
  for (let c = 0; c < (spec.crackWalls || 0); c++) tryCut(Math.floor(L * 0.15), Math.floor(L * 0.9), T.CRACK);

  // doors actually placed, in path order; re-color sequentially
  const doors = cuts.filter((c) => c.tile !== T.CRACK).sort((a, b) => a.k - b.k);
  if (!relax && doors.length < nd) return null;
  doors.forEach((d, i) => { d.tile = T.DOOR0 + i; for (const q of d.cells) g.set(q.x, q.y, d.tile); });

  // full reachability (doors open)
  const full = bfs(g, [sp], passAll).dist;
  const spawnD = full;

  // ---------- keys (key i lives in the region reachable with doors >= i closed) ----------
  const keys = [];
  let prevRegion = null;
  for (let i = 0; i < doors.length; i++) {
    const passK = (t) => t === T.WATER || t === T.CRACK || (t >= T.DOOR0 && t - T.DOOR0 < i);
    const reg = bfs(g, [sp], passK).dist;
    const door = doors[i].cells[0];
    const dd = bfs(g, [door], (t) => t !== T.ROCK).dist;
    let cands = [];
    for (let j = 0; j < g.t.length; j++) {
      if (reg[j] < 0 || g.t[j] !== T.WATER || occ[j]) continue;
      if (prevRegion && prevRegion[j] >= 0 && rng.chance(0.85)) continue;
      cands.push(j);
    }
    if (!cands.length) for (let j = 0; j < g.t.length; j++) if (reg[j] >= 0 && g.t[j] === T.WATER && !occ[j]) cands.push(j);
    if (!cands.length) return null;
    cands.sort((a, b) => dd[b] - dd[a]);
    const top = cands.slice(0, Math.max(1, Math.floor(cands.length * 0.25)));
    const j = rng.pick(top);
    const kx = j % g.w, ky = (j / g.w) | 0;
    keys.push({ tx: kx, ty: ky, x: px(kx), y: px(ky), c: i });
    mark(kx, ky, 1);
    prevRegion = reg;
  }

  // ---------- secret pockets behind cracked rock ----------
  const chests = [];
  const pockets = spec.secrets || 0;
  if (pockets > 0) {
    const cand = [];
    for (let y = 2; y < g.h - 2; y++)
      for (let x = 2; x < g.w - 2; x++) {
        if (!g.open(x, y) || full[g.idx(x, y)] < 6) continue;
        for (const [dx, dy] of DIRS) if (g.get(x + dx, y + dy) === T.ROCK) cand.push([x, y, dx, dy]);
      }
    rng.shuffle(cand);
    let made = 0;
    for (const [x, y, dx, dy] of cand) {
      if (made >= pockets) break;
      const pdx = Math.abs(dy), pdy = Math.abs(dx);
      let ok = true;
      for (let s = 1; s <= 5 && ok; s++)
        for (let o = -1; o <= 2 && ok; o++) {
          const cx = x + dx * s + pdx * o, cy = y + dy * s + pdy * o;
          if (!g.in(cx, cy) || g.get(cx, cy) !== T.ROCK) ok = false;
          if (s <= 4 && o >= 0 && o <= 1 && !g.inner(cx, cy)) ok = false;
        }
      if (!ok) continue;
      if (occ[g.idx(x, y)]) continue;
      for (let s = 1; s <= 4; s++)
        for (let o = 0; o <= 1; o++) {
          const cx = x + dx * s + pdx * o, cy = y + dy * s + pdy * o;
          g.set(cx, cy, s === 1 ? T.CRACK : T.WATER);
          secret[g.idx(cx, cy)] = 1;
          occ[g.idx(cx, cy)] = 1;
        }
      // chest sits at the back, on the lower cell if possible
      const cxA = x + dx * 4, cyA = y + dy * 4, cxB = cxA + pdx, cyB = cyA + pdy;
      const pickB = cyB > cyA;
      const c = pickB ? { x: cxB, y: cyB } : { x: cxA, y: cyA };
      chests.push({ tx: c.x, ty: c.y, x: px(c.x), y: px(c.y), secret: true });
      mark(x, y, 1);
      made++;
    }
  }

  // reachable set (doors open, cracks passable) — recomputed after pockets
  const reachD = bfs(g, [sp], passAll).dist;
  const freeCell = (j) => reachD[j] >= 0 && g.t[j] === T.WATER && !occ[j] && !secret[j];

  // ---------- gems: farthest-point sampling ----------
  const fps = (n, filter, anchors, jitter = 0.3) => {
    const out = [];
    const cands = [];
    for (let j = 0; j < g.t.length; j++) if (filter(j)) cands.push(j);
    const pts = anchors.slice();
    for (let k = 0; k < n && cands.length; k++) {
      let bj = -1, bs = -1;
      for (const j of cands) {
        if (occ[j]) continue;
        const x = j % g.w, y = (j / g.w) | 0;
        let m = 1e9;
        for (const p of pts) { const d = Math.hypot(p.x - x, p.y - y); if (d < m) m = d; }
        const s = m * (1 - jitter / 2 + rng.next() * jitter);
        if (s > bs) { bs = s; bj = j; }
      }
      if (bj < 0) break;
      const x = bj % g.w, y = (bj / g.w) | 0;
      out.push({ tx: x, ty: y, x: px(x), y: px(y) });
      pts.push({ x, y });
      mark(x, y, 1);
    }
    return out;
  };
  const anchors = [{ x: sp.x, y: sp.y }, { x: ex.x, y: ex.y }, ...keys.map((k) => ({ x: k.tx, y: k.ty }))];
  const gems = fps(spec.gems, (j) => freeCell(j) && reachD[j] >= 4, anchors);
  if (gems.length < spec.gems) return null;

  // extra (non-secret) chests in nooks: cells with floor below, far from everything
  const extra = Math.max(0, (spec.chests || 0) - chests.length);
  if (extra > 0) {
    const ch = fps(extra, (j) => {
      if (!freeCell(j) || reachD[j] < 8) return false;
      const x = j % g.w, y = (j / g.w) | 0;
      return g.get(x, y + 1) === T.ROCK;
    }, anchors.concat(gems.map((q) => ({ x: q.tx, y: q.ty }))), 0.2);
    chests.push(...ch);
  }

  // ---------- air vents (coverage guarantee) ----------
  const air = [];
  const R = spec.airR || 26;
  const covered = new Uint8Array(g.w * g.h);
  const cover = (c) => { for (const q of bfsDepth(g, c, R, (t) => t !== T.ROCK)) covered[g.idx(q.x, q.y)] = 1; };
  cover(sp);
  for (let guard = 0; guard < 200; guard++) {
    let u = -1, ud = 1e9;
    for (let j = 0; j < g.t.length; j++) if (reachD[j] >= 0 && !covered[j] && !secret[j] && reachD[j] < ud) { ud = reachD[j]; u = j; }
    if (u < 0) break;
    const ux = u % g.w, uy = (u / g.w) | 0;
    let v = null, vd = -1;
    for (const q of bfsDepth(g, { x: ux, y: uy }, Math.floor(R / 2), (t) => t !== T.ROCK)) {
      const j = g.idx(q.x, q.y);
      if (g.t[j] !== T.WATER || secret[j] || occ[j]) continue;
      if (reachD[j] > vd) { vd = reachD[j]; v = q; }
    }
    if (!v) v = { x: ux, y: uy };
    // settle onto floor (max 3 cells down)
    for (let s = 0; s < 3 && g.open(v.x, v.y + 1) && !occ[g.idx(v.x, v.y + 1)]; s++) v = { x: v.x, y: v.y + 1 };
    air.push({ tx: v.x, ty: v.y, x: px(v.x), y: px(v.y) });
    mark(v.x, v.y, 1);
    cover(v);
    covered[u] = 1;
  }

  // ---------- currents & vents ----------
  const currents = [];
  const nearSpawn = (x, y, r = 5) => Math.hypot(x - sp.x, y - sp.y) < r;
  const fmag = spec.current || 0.05;
  if (spec.currents) {
    const cand = [];
    for (let y = 1; y < g.h - 1; y++) for (let x = 1; x < g.w - 1; x++) if (g.open(x, y) && reachD[g.idx(x, y)] >= 0 && !secret[g.idx(x, y)]) cand.push([x, y]);
    rng.shuffle(cand);
    for (const [x, y] of cand) {
      if (currents.length >= spec.currents) break;
      if (nearSpawn(x, y, 6)) continue;
      const [ha, hb] = hRun(g, x, y), [va, vb] = vRun(g, x, y);
      let zone = null;
      if (hb - ha >= 7 && vb - va <= 6) {
        const x0 = Math.max(ha, x - 6), x1 = Math.min(hb, x + 6);
        zone = { tx: x0, ty: va, tw: x1 - x0 + 1, th: vb - va + 1, fx: rng.chance(0.5) ? fmag : -fmag, fy: 0 };
      } else if (vb - va >= 7 && hb - ha <= 6) {
        const y0 = Math.max(va, y - 6), y1 = Math.min(vb, y + 6);
        zone = { tx: ha, ty: y0, tw: hb - ha + 1, th: y1 - y0 + 1, fx: 0, fy: rng.chance(0.5) ? fmag : -fmag };
      }
      if (!zone) continue;
      // never put a current right next to a breakable wall or a gate
      let nearSpecial = false;
      for (let yy = zone.ty - 2; yy < zone.ty + zone.th + 2 && !nearSpecial; yy++)
        for (let xx = zone.tx - 2; xx < zone.tx + zone.tw + 2; xx++) { const tt = g.get(xx, yy); if (tt !== T.WATER && tt !== T.ROCK) { nearSpecial = true; break; } }
      if (nearSpecial) continue;
      const overl = currents.some((c) => zone.tx < c.tx + c.tw + 2 && c.tx < zone.tx + zone.tw + 2 && zone.ty < c.ty + c.th + 2 && c.ty < zone.ty + zone.th + 2);
      if (overl) continue;
      if (sp.x >= zone.tx - 1 && sp.x <= zone.tx + zone.tw && sp.y >= zone.ty - 1 && sp.y <= zone.ty + zone.th) continue;
      currents.push({ ...zone, x: zone.tx * TILE, y: zone.ty * TILE, w: zone.tw * TILE, h: zone.th * TILE });
    }
  }
  const vents = [];
  if (spec.vents) {
    const cand = [];
    for (let y = 2; y < g.h - 1; y++)
      for (let x = 1; x < g.w - 1; x++) {
        if (!g.open(x, y) || g.get(x, y + 1) !== T.ROCK || reachD[g.idx(x, y)] < 0 || secret[g.idx(x, y)]) continue;
        const [va] = vRun(g, x, y);
        if (y - va >= 5) cand.push([x, y, va]);
      }
    rng.shuffle(cand);
    for (const [x, y, va] of cand) {
      if (vents.length >= spec.vents) break;
      if (vents.some((v) => Math.abs(v.tx - x) < 4 && Math.abs(v.ty - y) < 8)) continue;
      if (nearSpawn(x, y, 4)) continue;
      const top = Math.max(va, y - 8); // geysers are local lifts, never a whole shaft
      vents.push({ tx: x, ty: y, top, x: px(x), y: (y + 1) * TILE, h: (y + 1 - top) * TILE });
    }
  }

  // ---------- enemies ----------
  const enemies = [];
  const blockers = [...gems, ...keys, ...chests, ...air].map((q) => ({ x: q.tx, y: q.ty }));
  const minSpawnD = spec.safe ?? 9;
  const okSpot = (x, y, space = 3) => {
    const j = g.idx(x, y);
    if (!g.open(x, y) || reachD[j] < minSpawnD || secret[j]) return false;
    if (Math.hypot(x - ex.x - 0.5, y - ex.y - 0.5) < 4) return false;
    if (blockers.some((b) => Math.hypot(b.x - x, b.y - y) < 1.5)) return false;
    if (enemies.some((e) => Math.hypot(e.tx - x, e.ty - y) < space)) return false;
    if (vents.some((v) => v.tx === x && y >= v.top && y <= v.ty)) return false;
    return true;
  };
  const allCells = [];
  for (let y = 1; y < g.h - 1; y++) for (let x = 1; x < g.w - 1; x++) if (g.open(x, y)) allCells.push([x, y]);
  const finders = {
    fish: (x, y) => { const [a, b] = hRun(g, x, y); return b - a >= 5 && { x0: a, x1: b }; },
    jelly: (x, y) => { const [a, b] = vRun(g, x, y); return b - a >= 5 && { y0: a, y1: b }; },
    crab: (x, y) => {
      if (g.get(x, y + 1) !== T.ROCK) return false;
      let a = x, b = x;
      while (g.open(a - 1, y) && g.get(a - 1, y + 1) === T.ROCK) a--;
      while (g.open(b + 1, y) && g.get(b + 1, y + 1) === T.ROCK) b++;
      return b - a >= 3 && g.open(x, y - 1) && { x0: a, x1: b };
    },
    urchin: (x, y) => {
      for (const [dx, dy] of rng.shuffle(DIRS.slice())) {
        if (g.get(x + dx, y + dy) !== T.ROCK) continue;
        const [a, b] = dx ? hRun(g, x, y) : vRun(g, x, y);
        const [c, d] = dx ? vRun(g, x, y) : hRun(g, x, y);
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
    clam: (x, y) => { if (g.get(x, y + 1) !== T.ROCK) return false; const [a] = vRun(g, x, y); return y - a >= 3 && {}; },
    mine: (x, y) => {
      if (!boxOpen(g, x, y, 1)) return false;
      let d = 1;
      while (d < 9 && g.open(x, y + d)) d++;
      return { chain: g.open(x, y + d) ? 0 : d };
    },
    spike: (x, y) => { if (g.get(x, y - 1) !== T.ROCK) return false; const [, b] = vRun(g, x, y); return b - y >= 5 && { y1: b }; },
    spinner: (x, y) => {
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (dx * dx + dy * dy <= 6.25 && !g.open(x + dx, y + dy)) return false;
      return {};
    },
    shark: (x, y) => boxOpen(g, x, y, 2) && {},
    angler: (x, y) => boxOpen(g, x, y, 1) && {},
  };
  const space = { spinner: 6, shark: 8, angler: 6 };
  for (const [type, count] of Object.entries(spec.enemies || {})) {
    if (type === 'boss') {
      enemies.push({ type, tx: Math.floor(g.w / 2), ty: Math.floor(g.h / 2), x: px(Math.floor(g.w / 2)), y: px(Math.floor(g.h / 2)) });
      continue;
    }
    const cells = rng.shuffle(allCells.slice());
    let placed = 0;
    for (const [x, y] of cells) {
      if (placed >= count) break;
      if (!okSpot(x, y, space[type] || 3.2)) continue;
      const data = finders[type](x, y);
      if (!data) continue;
      enemies.push({ type, tx: x, ty: y, x: px(x), y: px(y), ...data });
      placed++;
    }
    if (!relax && placed < count) return null;
  }

  // ---------- decoration ----------
  const deco = [];
  for (let y = 1; y < g.h - 1; y++)
    for (let x = 1; x < g.w - 1; x++) {
      const j = g.idx(x, y);
      if (g.t[j] !== T.WATER) continue;
      if (g.get(x, y + 1) === T.ROCK && rng.chance(0.22)) deco.push({ k: 'floor', v: rng.int(0, 5), x: px(x) + rng.int(-4, 4), y: (y + 1) * TILE, s: rng.next() });
      else if (g.get(x, y - 1) === T.ROCK && rng.chance(0.12)) deco.push({ k: 'ceil', v: rng.int(0, 3), x: px(x) + rng.int(-4, 4), y: y * TILE, s: rng.next() });
    }

  return {
    spec,
    w: g.w, h: g.h, tiles: g.t,
    spawn: { tx: sp.x, ty: sp.y, x: (sp.x + 1) * TILE, y: (sp.y + 1) * TILE },
    exit: { tx: ex.x, ty: ex.y, x: (ex.x + 1) * TILE, y: (ex.y + 1) * TILE },
    gems, keys, chests, air, enemies, currents, vents, deco,
    doorsPlaced: doors.length, pathLen: L,
  };
}
