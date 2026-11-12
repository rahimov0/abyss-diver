// Independent solvability check: simulates key collection / door opening with a flood fill.
import { Grid, T, bfs } from './grid.js';

export function validateLevel(L) {
  if (L.spec.chapter === 2) return validateLevel2(L);
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

// Chapter 2: portals are extra edges, a gate opens once one of its switches is reachable,
// acid cells count as walls (every goal must be reachable without touching acid).
export function validateLevel2(L) {
  const errors = [];
  const g = new Grid(L.w, L.h);
  g.t = L.tiles;
  const idx = (q) => q.ty * L.w + q.tx;
  const sq = (p) => [[p.tx, p.ty], [p.tx + 1, p.ty], [p.tx, p.ty + 1], [p.tx + 1, p.ty + 1]];
  if (sq(L.spawn).some(([x, y]) => g.get(x, y) !== T.WATER)) errors.push('spawn blocked');
  if (sq(L.exit).some(([x, y]) => g.get(x, y) !== T.WATER)) errors.push('exit blocked');
  const links = new Map();
  for (const p of L.portals) {
    const a = idx(p.a), b = idx(p.b);
    links.set(a, [...(links.get(a) || []), b]);
    links.set(b, [...(links.get(b) || []), a]);
    if (g.t[a] !== T.WATER || g.t[b] !== T.WATER) errors.push('portal in rock');
  }
  const acid = new Set(L.acid.map(idx));
  const open = new Set();
  let reach;
  for (let guard = 0; guard < 10; guard++) {
    reach = bfs(g, [{ x: L.spawn.tx, y: L.spawn.ty }], (t, x, y) => !acid.has(y * L.w + x) && (t === T.WATER || t === T.CRACK || (t === T.GATE && open.size > 0 && gateOpen(x, y))), links).dist;
    let changed = false;
    for (const s of L.switches) if (!s.back && reach[idx(s)] >= 0 && !open.has(s.gate)) { open.add(s.gate); changed = true; }
    if (!changed) break;
  }
  function gateOpen(x, y) {
    for (const gt of L.gates) if (open.has(gt.id) && gt.cells.some((c) => c.tx === x && c.ty === y)) return true;
    return false;
  }
  const at = (p) => reach[idx(p)] >= 0;
  if (!at(L.exit)) errors.push('exit unreachable');
  const check = (list, name) => list.forEach((q, i) => { if (!at(q)) errors.push(`${name} ${i} unreachable`); });
  check(L.gems, 'gem'); check(L.chests, 'chest'); check(L.pups, 'pup'); check(L.harpoons, 'harpoon'); check(L.air, 'air');
  if (L.gems.length !== L.spec.gems) errors.push(`gems ${L.gems.length}/${L.spec.gems}`);
  if (L.pups.length !== (L.spec.pups || 0)) errors.push(`pups ${L.pups.length}/${L.spec.pups}`);
  for (const gt of L.gates) if (!L.switches.some((s) => s.gate === gt.id && !s.back)) errors.push(`gate ${gt.id} has no switch`);
  for (const e of L.enemies) {
    if (e.type === 'boss2') continue;
    if (g.get(e.tx, e.ty) !== T.WATER) errors.push(`${e.type} inside rock`);
    const d = reach[idx(e)];
    if (d >= 0 && d < 5) errors.push(`${e.type} too close to spawn`);
  }
  if (L.spec.boss && !L.enemies.some((e) => e.type === 'boss2')) errors.push('boss missing');
  return { ok: errors.length === 0, errors };
}
