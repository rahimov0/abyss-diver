// Chapter 2 (levels 51-75) layout generators. Separate from archetypes.js so chapter 1 never changes.
// Each returns { x, y } spawn hint (tile coords) and may add: links (portal pairs), exitHint.
import { T, clamp } from './grid.js';

function blob(g, rng, cx, cy, R) {
  g.circle(cx, cy, Math.max(1.6, R * 0.75));
  const n = 3 + rng.int(0, 3);
  for (let i = 0; i < n; i++) g.circle(cx + rng.range(-R / 2, R / 2), cy + rng.range(-R / 2, R / 2), rng.range(R * 0.55, R));
}

// winding tunnel between two points (guaranteed connected: steps of < 1 tile)
function tunnel(g, rng, x0, y0, x1, y1, r = 1.6, wiggle = 2) {
  const d = Math.hypot(x1 - x0, y1 - y0);
  const n = Math.max(2, Math.ceil(d));
  const nx = -(y1 - y0) / (d || 1), ny = (x1 - x0) / (d || 1);
  const ph = rng.range(0, 6.28), fr = rng.range(1, 2.2);
  for (let i = 0; i <= n; i++) {
    const k = i / n, off = Math.sin(k * Math.PI * fr + ph) * wiggle * Math.sin(k * Math.PI);
    g.circle(x0 + (x1 - x0) * k + nx * off, y0 + (y1 - y0) * k + ny * off, r);
  }
}

export const ARCH2 = {
  // Sunken city / base blocks: streets between buildings, some buildings hollow with a doorway
  city(g, rng, P) {
    const { w, h } = g;
    g.rect(2, 2, w - 4, h - 4);
    const street = 3;
    let y = 2 + street;
    while (y < h - 2 - street - 3) {
      const bh = rng.int(3, 6);
      let x = 2 + street;
      while (x < w - 2 - street - 3) {
        const bw = rng.int(4, 8);
        const ww = Math.min(bw, w - 2 - street - x), hh = Math.min(bh, h - 2 - street - y);
        if (ww >= 3 && hh >= 3) {
          g.rect(x, y, ww, hh, T.ROCK);
          if (ww >= 6 && hh >= 5 && rng.chance(0.45)) { // hollow building with a doorway
            g.rect(x + 1, y + 1, ww - 2, hh - 2);
            const side = rng.int(0, 3);
            if (side === 0) g.rect(x + 1 + rng.int(0, ww - 4), y, 2, 1);
            else if (side === 1) g.rect(x + 1 + rng.int(0, ww - 4), y + hh - 1, 2, 1);
            else if (side === 2) g.rect(x, y + 1 + rng.int(0, hh - 4), 1, 2);
            else g.rect(x + ww - 1, y + 1 + rng.int(0, hh - 4), 1, 2);
          }
        }
        x += bw + street + rng.int(0, 1);
      }
      y += bh + street + rng.int(0, 1);
    }
    // a few collapsed plazas
    for (let k = 0; k < 3; k++) g.circle(rng.range(6, w - 6), rng.range(6, h - 6), rng.range(2.5, 4));
    // city walls: split the city into districts joined by a single gateway each
    const walls = P.walls || 0;
    for (let k = 1; k <= walls; k++) {
      const y = Math.round((h * k) / (walls + 1));
      g.rect(1, y, w - 2, 2, T.ROCK);
      const gx = rng.int(5, w - 9);
      g.circle(gx + 1.5, y - 1.5, 2.2); g.circle(gx + 1.5, y + 3.5, 2.2); // little plazas on both sides
      g.rect(1, y, w - 2, 2, T.ROCK);
      g.rect(gx, y, 3, 2);
    }
    return { x: 3, y: 3 };
  },

  // Climb: start at the bottom, exit at the top; chambers stacked with offset passages and ledges
  climb(g, rng, P) {
    const { w, h } = g;
    let cx = w / 2, cy = h - 6;
    blob(g, rng, cx, cy, 3.4);
    const spawn = { x: Math.round(cx), y: h - 5 };
    while (cy > 8) {
      const ny = Math.max(5, cy - rng.int(9, 13));
      const nx = clamp(cx + rng.range(-w * 0.3, w * 0.3), 5, w - 6);
      tunnel(g, rng, cx, cy, nx, ny, rng.range(1.5, 2.1), 2.5);
      blob(g, rng, nx, ny, rng.range(3, 4.6));
      // ledges inside the chamber
      if (rng.chance(0.7)) g.rect(Math.round(nx - rng.int(2, 4)), Math.round(ny + 2), rng.int(2, 4), 1, T.ROCK);
      // side grotto
      if (rng.chance(0.6)) {
        const sx = nx < w / 2 ? clamp(nx + rng.range(6, 10), 4, w - 5) : clamp(nx - rng.range(6, 10), 4, w - 5);
        tunnel(g, rng, nx, ny, sx, ny + rng.range(-2, 2), 1.5, 1);
        blob(g, rng, sx, ny, 2.6);
      }
      cx = nx; cy = ny;
    }
    return spawn;
  },

  // Hub: a big central hall with winding wings ending in chambers (exit sits in the hall)
  hub(g, rng, P) {
    const { w, h } = g;
    const cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.17;
    g.circle(cx, cy, R);
    for (let k = 0; k < 3; k++) g.circle(cx + rng.range(-R, R) * 0.6, cy + rng.range(-R, R) * 0.6, R * 0.6);
    const wings = rng.int(4, 5), a0 = rng.range(0, 6.28);
    let spawn = null;
    for (let i = 0; i < wings; i++) {
      const a = a0 + (i / wings) * Math.PI * 2 + rng.range(-0.25, 0.25);
      const L = Math.min(w, h) * rng.range(0.36, 0.42);
      const ex = clamp(cx + Math.cos(a) * L, 5, w - 6), ey = clamp(cy + Math.sin(a) * L, 5, h - 6);
      tunnel(g, rng, cx + Math.cos(a) * R * 0.8, cy + Math.sin(a) * R * 0.8, ex, ey, 1.6, 3);
      blob(g, rng, ex, ey, rng.range(3, 4.2));
      if (rng.chance(0.5)) { // branch off the wing
        const b = a + rng.range(0.6, 1.0) * (rng.chance(0.5) ? 1 : -1);
        const bx = clamp(ex + Math.cos(b) * 7, 4, w - 5), byy = clamp(ey + Math.sin(b) * 7, 4, h - 5);
        tunnel(g, rng, ex, ey, bx, byy, 1.5, 1.5);
        blob(g, rng, bx, byy, 2.6);
      }
      if (!spawn) spawn = { x: Math.round(ex), y: Math.round(ey) };
    }
    return { ...spawn, exitHint: { x: Math.round(cx), y: Math.round(cy) } };
  },

  // Concentric ring corridors; each wall between rings has 1-2 gaps
  rings(g, rng, P) {
    const { w, h } = g;
    const cx = w / 2, cy = h / 2, maxR = Math.min(w, h) / 2 - 2.5 - (P.links ? 5.5 : 0); // leave rock in the corners for a portal vault
    const rings = [];
    for (let r = maxR - (P.thick || 1.5); r > 3; r -= 3 + 2 * (P.thick || 1.5)) rings.push(r);
    for (const r of rings)
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
          if (Math.abs(d - r) <= (P.thick || 1.5)) g.carve(x, y);
        }
    g.circle(cx, cy, 3); // the core chamber
    // gaps between consecutive rings (and into the core)
    const gaps = rings.map((r, i) => (i + 1 < rings.length ? (r + rings[i + 1]) / 2 : r / 2));
    gaps.forEach((gr, i) => {
      const n = P.single ? 1 : rng.int(1, 2);
      for (let k = 0; k < n; k++) {
        const a = rng.range(0, 6.28);
        const r0 = rings[i], r1 = i + 1 < rings.length ? rings[i + 1] : 0;
        g.line(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0, cx + Math.cos(a) * r1, cy + Math.sin(a) * r1, 1.5);
      }
    });
    // chambers bulging off the outer ring
    for (let k = 0; k < 4; k++) {
      const a = rng.range(0, 6.28);
      g.circle(cx + Math.cos(a) * (maxR - 1.5), cy + Math.sin(a) * (maxR - 1.5), rng.range(2.2, 3.2));
    }
    return { x: Math.round(cx), y: Math.round(cy - rings[0]), exitHint: { x: Math.round(cx), y: Math.round(cy) } };
  },

  // Pipe network: long 2-wide pipes on a grid (spanning tree + extras) with pump rooms at some nodes
  pipes(g, rng, P) {
    const step = 8;
    const mw = Math.floor((g.w - 4) / step) + 1, mh = Math.floor((g.h - 4) / step) + 1;
    const node = (i, j) => ({ x: 2 + i * step, y: 2 + j * step });
    const id = (i, j) => j * mw + i;
    const seen = new Set([0]);
    const stack = [[0, 0]];
    const edges = [];
    while (stack.length) {
      const [i, j] = stack[stack.length - 1];
      const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([a, b]) => [i + a, j + b])
        .filter(([a, b]) => a >= 0 && b >= 0 && a < mw && b < mh && !seen.has(id(a, b)));
      if (!nb.length) { stack.pop(); continue; }
      const [a, b] = rng.pick(nb);
      seen.add(id(a, b)); edges.push([[i, j], [a, b]]); stack.push([a, b]);
    }
    for (let j = 0; j < mh; j++) for (let i = 0; i < mw; i++) {
      if (i + 1 < mw && rng.chance(0.18)) edges.push([[i, j], [i + 1, j]]);
      if (j + 1 < mh && rng.chance(0.18)) edges.push([[i, j], [i, j + 1]]);
    }
    for (const [[i, j], [a, b]] of edges) {
      const A = node(i, j), B = node(a, b);
      g.rect(Math.min(A.x, B.x), Math.min(A.y, B.y), Math.abs(A.x - B.x) + 2, Math.abs(A.y - B.y) + 2);
    }
    for (let j = 0; j < mh; j++) for (let i = 0; i < mw; i++) {
      const n = node(i, j);
      if (rng.chance(0.3) || (i === 0 && j === 0)) g.rect(n.x - 2, n.y - 2, 6, 6);
    }
    return { x: 2, y: 2 };
  },

  // Two separate caves joined only by portals (links)
  twin(g, rng, P) {
    const { w, h } = g;
    const half = Math.floor(w / 2);
    const makeSide = (x0, x1) => {
      const pts = [];
      let x = rng.range(x0 + 4, x1 - 4), y = 4;
      pts.push({ x, y });
      blob(g, rng, x, y, 3);
      while (y < h - 7) {
        const ny = Math.min(h - 5, y + rng.range(6, 10)), nx = clamp(x + rng.range(-8, 8), x0 + 4, x1 - 4);
        tunnel(g, rng, x, y, nx, ny, rng.range(1.5, 2.2), 2);
        blob(g, rng, nx, ny, rng.range(2.6, 4));
        x = nx; y = ny; pts.push({ x, y });
      }
      return pts;
    };
    const L = makeSide(2, half - 2), R = makeSide(half + 2, w - 3);
    g.rect(half - 1, 0, 3, h, T.ROCK); // keep the halves apart
    const links = [];
    const n = Math.max(1, P.links || 2);
    for (let k = 0; k < n; k++) {
      const a = L[Math.min(L.length - 1, Math.floor(((k + 1) * L.length) / (n + 1)))];
      const b = R[Math.min(R.length - 1, Math.floor(((n - k) * R.length) / (n + 1)))];
      links.push({ a: { x: Math.round(a.x), y: Math.round(a.y) }, b: { x: Math.round(b.x), y: Math.round(b.y) } });
    }
    return { x: Math.round(L[0].x), y: Math.round(L[0].y), links };
  },

  // Escape tunnels: wide, straight-ish, with pillars to weave around
  escapeH(g, rng, P) {
    const { w, h } = g;
    let y = h / 2;
    for (let x = 3; x < w - 3; x++) {
      y = clamp(y + rng.range(-0.6, 0.6), 6, h - 7);
      g.circle(x, y, rng.range(3, 4.2));
    }
    for (let x = 14; x < w - 8; x += rng.int(7, 11)) g.circle(x, clamp(y + rng.range(-3, 3), 6, h - 7), rng.range(0.9, 1.4), T.ROCK);
    return { x: 4, y: Math.round(h / 2) };
  },
  escapeV(g, rng, P) {
    const { w, h } = g;
    let x = w / 2;
    for (let y = 3; y < h - 3; y++) {
      x = clamp(x + rng.range(-0.6, 0.6), 6, w - 7);
      g.circle(x, y, rng.range(3, 4.2));
    }
    for (let y = 14; y < h - 8; y += rng.int(7, 11)) g.circle(clamp(x + rng.range(-3, 3), 6, w - 7), y, rng.range(0.9, 1.4), T.ROCK);
    return P.dir === 'up' ? { x: Math.round(w / 2), y: h - 5 } : { x: Math.round(w / 2), y: 4 };
  },

  // Boss room: wide hall with a floor, side walls and a couple of floating platforms
  bossroom(g, rng, P) {
    const { w, h } = g;
    g.rect(2, 2, w - 4, h - 4);
    for (let x = 2; x < w - 2; x++) if (rng.chance(0.35)) g.circle(x, h - 3, rng.range(0.8, 1.3), T.ROCK);
    const plats = rng.int(2, 3);
    for (let k = 0; k < plats; k++) {
      const px = Math.round(((k + 1) * w) / (plats + 1)) - 3, py = Math.round(h * rng.range(0.45, 0.6));
      g.rect(px, py, 6, 1, T.ROCK);
    }
    return { x: 4, y: h - 6, exitHint: { x: Math.round(w / 2), y: 4 } };
  },
};
