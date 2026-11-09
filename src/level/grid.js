// Tile grid + seeded RNG + BFS helpers (pure, no DOM — also used by tools/validate.mjs)

export const T = { WATER: 0, ROCK: 1, CRACK: 2, DOOR0: 3, DOOR1: 4, DOOR2: 5 };
export const TILE = 16;

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class RNG {
  constructor(seed) { this.f = mulberry32(seed); }
  next() { return this.f(); }
  range(a, b) { return a + (b - a) * this.f(); }
  int(a, b) { return Math.floor(a + (b - a + 1) * this.f()); }
  pick(arr) { return arr[Math.floor(this.f() * arr.length)]; }
  chance(p) { return this.f() < p; }
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.f() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export class Grid {
  constructor(w, h, fill = T.ROCK) {
    this.w = w; this.h = h;
    this.t = new Uint8Array(w * h).fill(fill);
  }
  in(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  inner(x, y) { return x >= 1 && y >= 1 && x < this.w - 1 && y < this.h - 1; }
  get(x, y) { return this.in(x, y) ? this.t[y * this.w + x] : T.ROCK; }
  set(x, y, v) { if (this.in(x, y)) this.t[y * this.w + x] = v; }
  open(x, y) { return this.get(x, y) === T.WATER; }
  idx(x, y) { return y * this.w + x; }
  carve(x, y) { if (this.inner(x, y)) this.t[y * this.w + x] = T.WATER; }
  put(x, y, v) {
    if (v === T.WATER) this.carve(x, y);
    else if (this.in(x, y)) this.t[y * this.w + x] = v;
  }
  circle(cx, cy, r, v = T.WATER) {
    for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r); y++)
      for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r); x++) {
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
        if (dx * dx + dy * dy <= r * r) this.put(x, y, v);
      }
  }
  rect(x0, y0, w, h, v = T.WATER) {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) this.put(x, y, v);
  }
  line(x0, y0, x1, y1, r, v = T.WATER) {
    const d = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.max(1, Math.ceil(d * 2));
    for (let i = 0; i <= n; i++) {
      const k = i / n;
      this.circle(x0 + (x1 - x0) * k, y0 + (y1 - y0) * k, r, v);
    }
  }
}

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
export { DIRS };

// Breadth-first search. passable(tile, x, y) -> bool. Returns {dist, parent}
export function bfs(g, starts, passable) {
  const dist = new Int32Array(g.w * g.h).fill(-1);
  const parent = new Int32Array(g.w * g.h).fill(-1);
  const q = new Int32Array(g.w * g.h);
  let qh = 0, qt = 0;
  for (const s of starts) {
    const i = g.idx(s.x, s.y);
    if (dist[i] === -1 && passable(g.t[i], s.x, s.y)) { dist[i] = 0; q[qt++] = i; }
  }
  while (qh < qt) {
    const i = q[qh++];
    const x = i % g.w, y = (i / g.w) | 0;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy;
      if (!g.in(nx, ny)) continue;
      const j = ny * g.w + nx;
      if (dist[j] !== -1) continue;
      if (!passable(g.t[j], nx, ny)) continue;
      dist[j] = dist[i] + 1; parent[j] = i; q[qt++] = j;
    }
  }
  return { dist, parent };
}

export const passWater = (t) => t === T.WATER;
export const passNoDoors = (t) => t === T.WATER || t === T.CRACK;
export const passAll = (t) => t !== T.ROCK;
