// Cave layout generators. Each one carves a Grid and returns a spawn hint (tile coords).
import { T, clamp } from './grid.js';

function blob(g, rng, cx, cy, R) {
  g.circle(cx, cy, Math.max(1.6, R * 0.75));
  const n = 3 + rng.int(0, 3);
  for (let i = 0; i < n; i++) {
    g.circle(cx + rng.range(-R / 2, R / 2), cy + rng.range(-R / 2, R / 2), rng.range(R * 0.55, R));
  }
}

// small organic bites in walls + bumps in large open spaces
export function roughen(g, rng, amount = 1) {
  const n = Math.floor(g.w * g.h * 0.012 * amount);
  for (let i = 0; i < n; i++) {
    const x = rng.int(2, g.w - 3), y = rng.int(2, g.h - 3);
    if (!g.open(x, y)) continue;
    // count solids around
    let s = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (!g.open(x + dx, y + dy)) s++;
    if (s >= 2 && s <= 4) g.circle(x + rng.range(-1, 1), y + rng.range(-1, 1), rng.range(1, 1.6));
  }
}

// rock bumps on walls of big open areas (never in corridors)
export function bumps(g, rng, amount = 1) {
  const n = Math.floor(g.w * g.h * 0.02 * amount);
  const run = (x, y, dx, dy) => { let k = 0; while (k < 8 && g.open(x + dx * (k + 1), y + dy * (k + 1))) k++; return k; };
  for (let i = 0; i < n; i++) {
    const x = rng.int(2, g.w - 3), y = rng.int(2, g.h - 3);
    if (!g.open(x, y)) continue;
    let wall = null;
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) if (!g.open(x + dx, y + dy)) wall = [dx, dy];
    if (!wall) continue;
    const hr = run(x, y, 1, 0) + run(x, y, -1, 0), vr = run(x, y, 0, 1) + run(x, y, 0, -1);
    if (hr < 7 || vr < 5) continue;
    g.circle(x + 0.5 + wall[0] * 0.5, y + 0.5 + wall[1] * 0.5, rng.range(0.9, 1.4), T.ROCK);
  }
}

export const ARCH = {
  // Winding vertical descent with side grottos
  shaft(g, rng, P) {
    const { w, h } = g;
    let x = w / 2 + rng.range(-3, 3);
    g.circle(x, 3, 2.6);
    let drift = 0;
    for (let y = 3; y < h - 4; y++) {
      if (rng.chance(0.13)) drift = rng.range(-1, 1);
      const rr = P.wide ? rng.range(2.1, 3.6) : rng.range(1.6, 2.6);
      x = clamp(x + drift * 0.85 + rng.range(-0.3, 0.3), rr + 1.6, w - rr - 2.6);
      g.circle(x, y, rr);
      if (y % 9 === 5 && rng.chance(0.8)) {
        const dir = x < w / 2 ? 1 : -1;
        const cx = clamp(x + dir * rng.range(5, 9), 4, w - 5);
        const cy = clamp(y + rng.range(-3, 3), 4, h - 5);
        g.line(x, y, cx, cy, 1.6);
        blob(g, rng, cx, cy, rng.range(2.4, 3.8));
      }
    }
    blob(g, rng, x, h - 5, 3.2);
    return { x: Math.round(w / 2), y: 3 };
  },

  // Horizontal shelves with alternating gaps (classic descent)
  zigzag(g, rng, P) {
    const { w, h } = g;
    let y = 2;
    let band = rng.int(4, 5);
    g.rect(1, y, w - 2, band);
    let gapLeft = rng.chance(0.5);
    const firstGapLeft = gapLeft;
    while (y + band + 7 < h - 2) {
      const shelfY = y + band;
      const s = rng.int(1, 2);
      const gapW = rng.int(3, 4);
      const gx = gapLeft ? rng.int(1, 3) : w - 1 - gapW - rng.int(0, 2);
      g.rect(gx, shelfY, gapW, s);
      if (w > 26 && rng.chance(0.35)) g.rect(rng.int(Math.floor(w / 2) - 2, Math.floor(w / 2) + 1), shelfY, 3, s);
      // bumps on this band's floor
      for (let k = 0; k < 2; k++) {
        const bx = rng.int(4, w - 6);
        if (Math.abs(bx - gx) < 5) continue;
        const bh = rng.int(1, Math.max(1, band - 3));
        g.rect(bx, shelfY - bh, rng.int(1, 2), bh, T.ROCK);
      }
      y = shelfY + s;
      band = rng.int(4, 6);
      g.rect(1, y, w - 2, band);
      gapLeft = !gapLeft;
    }
    g.rect(1, y, w - 2, Math.max(band, h - 2 - y));
    return { x: firstGapLeft ? w - 5 : 4, y: 3 };
  },

  // Rooms connected by corridors (spanning tree + loops)
  chambers(g, rng, P) {
    const { w, h } = g;
    const C = P.cols || 3, R = P.rows || 4;
    const cw = (w - 2) / C, ch = (h - 2) / R;
    const rooms = [];
    for (let j = 0; j < R; j++)
      for (let i = 0; i < C; i++) {
        const cx = 1 + cw * (i + 0.5) + rng.range(-cw * 0.15, cw * 0.15);
        const cy = 1 + ch * (j + 0.5) + rng.range(-ch * 0.15, ch * 0.15);
        const rw = rng.range(cw * 0.28, cw * 0.4), rh = rng.range(ch * 0.28, ch * 0.4);
        rooms.push({ i, j, cx, cy, rw, rh });
        g.rect(Math.round(cx - rw), Math.round(cy - rh), Math.round(rw * 2), Math.round(rh * 2));
        blob(g, rng, cx, cy, Math.min(rw, rh) * 1.05);
      }
    const id = (i, j) => j * C + i;
    const seen = new Set([0]);
    const stack = [0];
    const edges = [];
    while (stack.length) {
      const cur = stack[stack.length - 1];
      const ci = cur % C, cj = Math.floor(cur / C);
      const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]]
        .map(([dx, dy]) => [ci + dx, cj + dy])
        .filter(([a, b]) => a >= 0 && b >= 0 && a < C && b < R && !seen.has(id(a, b)));
      if (!nb.length) { stack.pop(); continue; }
      const [a, b] = rng.pick(nb);
      seen.add(id(a, b)); edges.push([cur, id(a, b)]); stack.push(id(a, b));
    }
    for (let j = 0; j < R; j++)
      for (let i = 0; i < C; i++) {
        if (i + 1 < C && rng.chance(0.22)) edges.push([id(i, j), id(i + 1, j)]);
        if (j + 1 < R && rng.chance(0.18)) edges.push([id(i, j), id(i, j + 1)]);
      }
    for (const [a, b] of edges) {
      const A = rooms[a], B = rooms[b];
      if (rng.chance(0.5)) { g.line(A.cx, A.cy, B.cx, A.cy, 1.5); g.line(B.cx, A.cy, B.cx, B.cy, 1.5); }
      else { g.line(A.cx, A.cy, A.cx, B.cy, 1.5); g.line(A.cx, B.cy, B.cx, B.cy, 1.5); }
    }
    return { x: Math.round(rooms[0].cx), y: Math.round(rooms[0].cy) };
  },

  // Long horizontal tunnel with up/down grottos
  tunnel(g, rng, P) {
    const { w, h } = g;
    let y = h / 2 + rng.range(-2, 2), drift = 0;
    for (let x = 3; x < w - 3; x++) {
      if (rng.chance(0.12)) drift = rng.range(-0.9, 0.9);
      const rr = rng.range(1.6, 2.8);
      y = clamp(y + drift * 0.8 + rng.range(-0.3, 0.3), rr + 2.5, h - rr - 3.5);
      g.circle(x, y, rr);
      if (x % 13 === 7 && rng.chance(0.8)) {
        const dir = y < h / 2 ? 1 : -1;
        const cy = clamp(y + dir * rng.range(5, 8), 4, h - 5);
        const cx = clamp(x + rng.range(-3, 3), 4, w - 5);
        g.line(x, y, cx, cy, 1.6);
        blob(g, rng, cx, cy, rng.range(2.4, 3.6));
      }
    }
    return { x: 3, y: Math.round(h / 2) };
  },

  // Cellular-automata caverns
  cavern(g, rng, P) {
    const { w, h } = g;
    const fill = P.fill || 0.45;
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) g.set(x, y, rng.chance(fill) ? T.ROCK : T.WATER);
    for (let it = 0; it < 5; it++) {
      const nt = new Uint8Array(g.t);
      for (let y = 1; y < h - 1; y++)
        for (let x = 1; x < w - 1; x++) {
          let s = 0;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (g.get(x + dx, y + dy) !== T.WATER) s++;
          nt[y * w + x] = s >= 5 ? T.ROCK : T.WATER;
        }
      g.t = nt;
    }
    // ensure top spawn pocket
    g.circle(w / 2, 3, 2.4);
    // stitch: carve a meandering spine top->bottom so the cave reads as a descent
    let x = w / 2;
    for (let yy = 3; yy < h - 3; yy += 2) {
      x = clamp(x + rng.range(-2.2, 2.2), 4, w - 5);
      g.circle(x, yy, 1.6);
    }
    return { x: Math.round(w / 2), y: 3 };
  },

  // Perfect maze with 3-wide corridors and a few loops / halls
  maze(g, rng, P) {
    const mw = Math.floor((g.w - 1) / 4), mh = Math.floor((g.h - 1) / 4);
    const vis = new Uint8Array(mw * mh);
    const cell = (i, j) => g.rect(1 + i * 4, 1 + j * 4, 3, 3);
    const link = (i, j, a, b) => {
      if (a > i) g.rect(1 + i * 4 + 3, 1 + j * 4, 1, 3);
      else if (a < i) g.rect(1 + a * 4 + 3, 1 + j * 4, 1, 3);
      else if (b > j) g.rect(1 + i * 4, 1 + j * 4 + 3, 3, 1);
      else g.rect(1 + i * 4, 1 + b * 4 + 3, 3, 1);
    };
    for (let j = 0; j < mh; j++) for (let i = 0; i < mw; i++) cell(i, j);
    const stack = [[0, 0]]; vis[0] = 1;
    while (stack.length) {
      const [i, j] = stack[stack.length - 1];
      const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]]
        .map(([dx, dy]) => [i + dx, j + dy])
        .filter(([a, b]) => a >= 0 && b >= 0 && a < mw && b < mh && !vis[b * mw + a]);
      if (!nb.length) { stack.pop(); continue; }
      const [a, b] = rng.pick(nb);
      vis[b * mw + a] = 1; link(i, j, a, b); stack.push([a, b]);
    }
    // loops
    for (let j = 0; j < mh; j++)
      for (let i = 0; i < mw; i++) {
        if (i + 1 < mw && rng.chance(0.1)) link(i, j, i + 1, j);
        if (j + 1 < mh && rng.chance(0.1)) link(i, j, i, j + 1);
      }
    // a few open halls (merge 2x2 blocks)
    const halls = Math.max(1, Math.floor((mw * mh) / 30));
    for (let k = 0; k < halls; k++) {
      const i = rng.int(0, mw - 2), j = rng.int(0, mh - 2);
      g.rect(1 + i * 4, 1 + j * 4, 7, 7);
    }
    return { x: 2, y: 2 };
  },

  // Square spiral toward the center
  spiral(g, rng, P) {
    const { w, h } = g;
    const cw = 3, wt = 2;
    let k = 0;
    for (;;) {
      const x0 = 1 + k * (cw + wt), y0 = 1 + k * (cw + wt);
      const x1 = w - 2 - k * (cw + wt), y1 = h - 2 - k * (cw + wt);
      if (x1 - x0 < cw * 2 + 2 || y1 - y0 < cw * 2 + 2) {
        if (x1 > x0 && y1 > y0) g.rect(x0, y0, x1 - x0 + 1, y1 - y0 + 1);
        break;
      }
      const ny0 = y0 + cw + wt;
      g.rect(x0, y0, x1 - x0 + 1, cw); // top
      g.rect(x1 - cw + 1, y0, cw, y1 - y0 + 1); // right
      g.rect(x0, y1 - cw + 1, x1 - x0 + 1, cw); // bottom
      g.rect(x0, ny0, cw, y1 - ny0 + 1); // left (stops below top band)
      const nx0 = x0 + cw + wt;
      g.rect(x0, ny0, nx0 - x0 + 1, cw); // turn into next ring
      // small bulges
      for (let b = 0; b < 2; b++) {
        const bx = rng.int(x0 + 3, x1 - 3);
        g.circle(bx, y1 - 1, 1.2);
      }
      k++;
      if (k > 12) break;
    }
    return { x: 2, y: 2 };
  },

  // Decks + bulkheads (sunken ship / temple halls)
  wreck(g, rng, P) {
    const { w, h } = g;
    const x0 = 2, x1 = w - 3, y0 = 2, y1 = h - 3;
    g.rect(x0, y0, x1 - x0 + 1, y1 - y0 + 1);
    let y = y0;
    const decks = [];
    while (y < y1 - 4) {
      const dh = rng.int(5, 7);
      const fy = y + dh;
      if (fy >= y1 - 2) break;
      decks.push([y, fy]);
      g.rect(x0, fy, x1 - x0 + 1, 1, T.ROCK);
      // hatches
      const nh = rng.int(1, 2);
      for (let k = 0; k < nh; k++) g.rect(rng.int(x0 + 1, x1 - 4), fy, 3, 1);
      y = fy + 1;
    }
    decks.push([y, y1 + 1]);
    for (const [dy0, dy1] of decks) {
      const nb = rng.int(1, 2);
      for (let k = 0; k < nb; k++) {
        const bx = rng.int(x0 + 4, x1 - 4);
        // bulkhead with doorway at bottom (3 tall), keeps hatch reachable
        g.rect(bx, dy0, 1, dy1 - dy0, T.ROCK);
        const doorH = 3;
        g.rect(bx, dy1 - doorH, 1, doorH);
        if (rng.chance(0.4)) g.rect(bx, dy0, 1, 2); // top gap
      }
    }
    // breaches
    for (let k = 0; k < 4; k++) g.circle(rng.int(x0 + 2, x1 - 2), rng.int(y0 + 2, y1 - 2), rng.range(1.2, 2));
    return { x: x0 + 2, y: y0 + 2 };
  },

  // Open cavern full of columns (kelp forest / magma pillars)
  pillars(g, rng, P) {
    const { w, h } = g;
    g.rect(2, 2, w - 4, h - 4);
    for (let k = 0; k < (w + h) / 2; k++) {
      const side = rng.int(0, 3);
      const x = side < 2 ? (side ? w - 3 : 2) : rng.int(2, w - 3);
      const y = side >= 2 ? (side === 3 ? h - 3 : 2) : rng.int(2, h - 3);
      g.circle(x, y, rng.range(1, 2.2), T.ROCK);
    }
    let x = rng.int(5, 7);
    while (x < w - 5) {
      const pw = rng.int(1, 2);
      const gapTop = rng.int(Math.floor(h * 0.2), Math.floor(h * 0.7));
      const gap = rng.int(5, 8);
      g.rect(x, 2, pw, gapTop, T.ROCK);
      g.rect(x, gapTop + gap, pw, h - 2 - gapTop - gap, T.ROCK);
      // shelf stubs
      if (rng.chance(0.5)) g.rect(x - 2, rng.int(gapTop + gap + 2, h - 4), 2 + pw + 2, 1, T.ROCK);
      x += rng.int(5, 7);
    }
    g.circle(w / 2, 3.5, 2.5);
    return { x: Math.round(w / 2), y: 3 };
  },

  // Open water with floating rock islands
  islands(g, rng, P) {
    const { w, h } = g;
    g.rect(2, 2, w - 4, h - 4);
    for (let k = 0; k < (w + h) / 1.6; k++) {
      const side = rng.int(0, 3);
      const x = side < 2 ? (side ? w - 3 : 2) : rng.int(2, w - 3);
      const y = side >= 2 ? (side === 3 ? h - 3 : 2) : rng.int(2, h - 3);
      g.circle(x, y, rng.range(1, 2.6), T.ROCK);
    }
    const n = Math.floor((w * h) / 70);
    for (let k = 0; k < n; k++) {
      const x = rng.range(5, w - 5), y = rng.range(8, h - 4);
      const r = rng.range(1.1, 2.8);
      g.circle(x, y, r, T.ROCK);
      if (rng.chance(0.4)) g.circle(x + rng.range(-2, 2), y + rng.range(-1, 1), r * 0.7, T.ROCK);
    }
    g.circle(w / 2, 4, 3);
    return { x: Math.round(w / 2), y: 3 };
  },

  // Boss arena
  arena(g, rng, P) {
    const { w, h } = g;
    const cx = w / 2, cy = h / 2;
    for (let y = 1; y < h - 1; y++)
      for (let x = 1; x < w - 1; x++) {
        const dx = (x + 0.5 - cx) / (w / 2 - 2), dy = (y + 0.5 - cy) / (h / 2 - 2);
        if (dx * dx + dy * dy < 1 - rng.range(0, 0.08)) g.carve(x, y);
      }
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + 0.3;
      g.circle(cx + Math.cos(a) * w * 0.25, cy + Math.sin(a) * h * 0.25, rng.range(1.2, 2), T.ROCK);
    }
    return { x: Math.round(cx), y: 4 };
  },
};
