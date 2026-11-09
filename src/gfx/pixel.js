// Crisp pixel drawing helpers (integer coordinates only) + noise
export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h));
  return c;
}

export function disc(ctx, cx, cy, r, color) {
  cx = Math.round(cx); cy = Math.round(cy);
  ctx.fillStyle = color;
  const R = Math.round(r);
  for (let dy = -R; dy <= R; dy++) {
    const half = Math.floor(Math.sqrt(Math.max(0, r * r - dy * dy)) + 0.35);
    ctx.fillRect(cx - half, cy + dy, half * 2 + 1, 1);
  }
}

export function ellipse(ctx, cx, cy, rx, ry, color) {
  cx = Math.round(cx); cy = Math.round(cy);
  ctx.fillStyle = color;
  const R = Math.round(ry);
  for (let dy = -R; dy <= R; dy++) {
    const half = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (dy * dy) / (ry * ry))) + 0.35);
    ctx.fillRect(cx - half, cy + dy, half * 2 + 1, 1);
  }
}

export function tri(ctx, ax, ay, bx, by, cx, cy, color) {
  ctx.fillStyle = color;
  const pts = [[ax, ay], [bx, by], [cx, cy]].map(([x, y]) => [Math.round(x), Math.round(y)]).sort((a, b) => a[1] - b[1]);
  const [[x0, y0], [x1, y1], [x2, y2]] = pts;
  const edge = (xa, ya, xb, yb, y) => (yb === ya ? xa : xa + ((xb - xa) * (y - ya)) / (yb - ya));
  for (let y = y0; y <= y2; y++) {
    const xa = edge(x0, y0, x2, y2, y);
    const xb = y < y1 ? edge(x0, y0, x1, y1, y) : edge(x1, y1, x2, y2, y);
    const l = Math.round(Math.min(xa, xb)), r = Math.round(Math.max(xa, xb));
    ctx.fillRect(l, y, r - l + 1, 1);
  }
}

export function line(ctx, x0, y0, x1, y1, color, w = 1) {
  ctx.fillStyle = color;
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    ctx.fillRect(Math.round(x0 + (x1 - x0) * t - (w - 1) / 2), Math.round(y0 + (y1 - y0) * t - (w - 1) / 2), w, w);
  }
}

export function px(ctx, x, y, color, w = 1, h = 1) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}

// sprite from strings + palette; returns canvas
export function sprite(rows, pal) {
  const h = rows.length, w = rows[0].length;
  const c = makeCanvas(w, h);
  const x = c.getContext('2d');
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const ch = rows[j][i];
      if (ch === '.' || ch === ' ') continue;
      const col = pal[ch];
      if (!col) continue;
      x.fillStyle = col;
      x.fillRect(i, j, 1, 1);
    }
  return c;
}

export function flipped(canvas) {
  const c = makeCanvas(canvas.width, canvas.height);
  const x = c.getContext('2d');
  x.translate(canvas.width, 0); x.scale(-1, 1);
  x.drawImage(canvas, 0, 0);
  return c;
}

// tinted copy (all opaque pixels -> color)
export function silhouette(canvas, color) {
  const c = makeCanvas(canvas.width, canvas.height);
  const x = c.getContext('2d');
  x.drawImage(canvas, 0, 0);
  x.globalCompositeOperation = 'source-in';
  x.fillStyle = color; x.fillRect(0, 0, c.width, c.height);
  return c;
}

// ---- noise ----
export function hash(x, y, s = 0) {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
const fade = (t) => t * t * (3 - 2 * t);
export function vnoise(x, y, s = 0) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
  const u = fade(xf), v = fade(yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x, y, s = 0) {
  return vnoise(x, y, s) * 0.55 + vnoise(x * 2.1, y * 2.1, s + 7) * 0.3 + vnoise(x * 4.3, y * 4.3, s + 13) * 0.15;
}

export function hexToRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function mix(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  const c = A.map((v, i) => Math.round(v + (B[i] - v) * t));
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
}
