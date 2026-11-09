// node tools/validate-levels.mjs [levelId] — generates every level, validates solvability, prints stats
import { LEVELS } from '../src/level/levels.js';
import { generateLevel } from '../src/level/generate.js';
import { T } from '../src/level/grid.js';

const only = process.argv[2] ? +process.argv[2] : 0;
let fail = 0;
for (const spec of LEVELS) {
  if (only && spec.id !== only) continue;
  const t0 = performance.now();
  try {
    const L = generateLevel(spec);
    const ms = (performance.now() - t0).toFixed(0);
    const want = Object.values(spec.enemies).reduce((a, b) => a + b, 0);
    const warn = [];
    if (L.doorsPlaced < spec.doors) warn.push(`doors ${L.doorsPlaced}/${spec.doors}`);
    if (L.enemies.length < want) warn.push(`enemies ${L.enemies.length}/${want}`);
    if (L.chests.length < spec.chests) warn.push(`chests ${L.chests.length}/${spec.chests}`);
    if (L.currents.length < spec.currents) warn.push(`currents ${L.currents.length}/${spec.currents}`);
    if (L.vents.length < spec.vents) warn.push(`vents ${L.vents.length}/${spec.vents}`);
    let cracks = 0; for (const t of L.tiles) if (t === T.CRACK) cracks++;
    console.log(`${String(spec.id).padStart(2)} ${spec.name.padEnd(18)} ${spec.arch.padEnd(8)} ${L.w}x${L.h} path=${L.pathLen} gems=${L.gems.length} air=${L.air.length} cracks=${cracks} try=${L.attempt} ${ms}ms ${warn.length ? '⚠ ' + warn.join(', ') : ''}`);
    if (only) {
      const rows = [];
      for (let y = 0; y < L.h; y++) {
        let r = '';
        for (let x = 0; x < L.w; x++) {
          const t = L.tiles[y * L.w + x];
          r += t === T.ROCK ? '#' : t === T.CRACK ? '%' : t >= T.DOOR0 ? 'D' : '.';
        }
        rows.push(r.split(''));
      }
      const put = (p, ch) => { rows[p.ty][p.tx] = ch; };
      L.gems.forEach((p) => put(p, 'g')); L.keys.forEach((p) => put(p, 'k')); L.chests.forEach((p) => put(p, 'c'));
      L.air.forEach((p) => put(p, 'o')); L.enemies.forEach((p) => put(p, p.type[0].toUpperCase()));
      put(L.spawn, 'S'); put(L.exit, 'X');
      console.log(rows.map((r) => r.join('')).join('\n'));
    }
  } catch (e) {
    fail++;
    console.log(`${spec.id} FAIL ${e.message}`);
  }
}
console.log(fail ? `\n${fail} level(s) FAILED` : '\nAll levels valid ✔');
process.exit(fail ? 1 : 0);
