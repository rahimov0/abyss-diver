// Independent solvability check: simulates key collection / door opening with a flood fill.
import { Grid, T, bfs } from './grid.js';

export function validateLevel(L) {
  const errors = [];
  const g = new Grid(L.w, L.h);
  g.t = L.tiles;
  const sp = L.spawn, ex = L.exit;
  const sq = (p) => [[p.tx, p.ty], [p.tx + 1, p.ty], [p.tx, p.ty + 1], [p.tx + 1, p.ty + 1]];
  if (sq(sp).some(([x, y]) => g.get(x, y) !== T.WATER)) errors.push('spawn blocked');
  if (sq(ex).some(([x, y]) => g.get(x, y) !== T.WATER)) errors.push('exit blocked');

  const opened = new Set();
  const held = new Set();
  let reach;
  for (let guard = 0; guard < 10; guard++) {
    reach = bfs(g, [{ x: sp.tx, y: sp.ty }], (t) => t === T.WATER || t === T.CRACK || (t >= T.DOOR0 && opened.has(t - T.DOOR0))).dist;
    let changed = false;
    for (const k of L.keys) if (reach[g.idx(k.tx, k.ty)] >= 0 && !held.has(k.c)) { held.add(k.c); changed = true; }
    for (const c of held) if (!opened.has(c)) { opened.add(c); changed = true; }
    if (!changed) break;
  }
  const at = (p) => reach[g.idx(p.tx, p.ty)] >= 0;
  if (!at(ex)) errors.push('exit unreachable');
  L.gems.forEach((q, i) => { if (!at(q)) errors.push(`gem ${i} unreachable`); });
  L.chests.forEach((q, i) => { if (!at(q)) errors.push(`chest ${i} unreachable`); });
  L.keys.forEach((q, i) => { if (!at(q)) errors.push(`key ${i} unreachable`); });
  L.air.forEach((q, i) => { if (!at(q)) errors.push(`air ${i} unreachable`); });
  if (L.gems.length !== L.spec.gems) errors.push(`gems ${L.gems.length}/${L.spec.gems}`);

  // every door has a matching key and vice versa
  const doorColors = new Set();
  for (const t of L.tiles) if (t >= T.DOOR0) doorColors.add(t - T.DOOR0);
  for (const c of doorColors) if (!L.keys.some((k) => k.c === c)) errors.push(`door ${c} has no key`);

  for (const e of L.enemies) {
    if (e.type === 'boss') continue;
    if (g.get(e.tx, e.ty) !== T.WATER) errors.push(`${e.type} inside rock`);
    const d = reach[g.idx(e.tx, e.ty)];
    if (d >= 0 && d < 5) errors.push(`${e.type} too close to spawn`);
  }
  for (const c of L.currents) if (Math.abs(c.fx) > 0.075 || Math.abs(c.fy) > 0.075) errors.push('current too strong');
  return { ok: errors.length === 0, errors };
}
