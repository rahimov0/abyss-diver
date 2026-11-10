// Pre-renders level tiles (organic eroded rock with biome texture) and a parallax far layer.
import { T, TILE } from '../level/grid.js';
import { makeCanvas, hash, vnoise, fbm, hexToRgb, mix } from './pixel.js';

export function renderTiles(L, B) {
  const W = L.w * TILE, H = L.h * TILE;
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(W, H);
  const d = img.data;
  const rock = B.rock.map(hexToRgb), surf = B.surf.map(hexToRgb), edge = hexToRgb(B.edge);
  const dim = hexToRgb(mix(B.rock[3], B.rock[0], 0.65));
  const solid = (x, y) => (x < 0 || y < 0 || x >= L.w || y >= L.h ? true : L.tiles[y * L.w + x] === T.ROCK);

  const interior = (px, py, dd) => {
    const h = hash(px, py, 11);
    switch (B.style) {
      case 'planks': {
        const row = Math.floor(py / 6), ly = py % 6;
        const off = Math.floor(hash(row, 3) * 40);
        if (ly === 0) return rock[4];
        if ((px + off) % 40 === 0) return rock[4];
        if ((px + off) % 40 === 3 && ly === 3) return rock[3];
        const v = vnoise(px * 0.05, row * 5.3 + ly * 0.25, 4) + (h - 0.5) * 0.15 - (dd > 12 ? 0.25 : 0);
        return v < 0.35 ? rock[0] : v < 0.62 ? rock[1] : rock[2];
      }
      case 'bricks': {
        const by = Math.floor(py / 8), off = by % 2 ? 8 : 0;
        const bx = Math.floor((px + off) / 16);
        if (py % 8 === 0 || (px + off) % 16 === 0) return rock[4];
        const s = hash(bx, by, 5) + (h - 0.5) * 0.2 - (dd > 12 ? 0.3 : 0);
        if (h < 0.02) return rock[0];
        return s < 0.3 ? rock[0] : s < 0.7 ? rock[1] : rock[2];
      }
      case 'ice': {
        const v = fbm(px * 0.025, py * 0.05, 2) - (dd > 10 ? 0.22 : 0) - (dd > 18 ? 0.2 : 0);
        if (Math.abs(vnoise(px * 0.06, py * 0.06, 4) - 0.5) < 0.025) return rock[4];
        if (h < 0.006) return rock[3];
        return v < 0.32 ? rock[0] : v < 0.55 ? rock[1] : rock[2];
      }
      case 'basalt': {
        const g = Math.abs(vnoise(px * 0.045, py * 0.045, 8) - 0.5);
        if (g < 0.016) return rock[3];
        if (g < 0.034) return dim;
        const v = fbm(px * 0.07, py * 0.07, 3) + (h - 0.5) * 0.25 - (dd > 12 ? 0.2 : 0);
        return v < 0.42 ? rock[4] : v < 0.6 ? rock[0] : v < 0.75 ? rock[1] : rock[2];
      }
      case 'abyss': {
        if (h < 0.004) return rock[3];
        const v = fbm(px * 0.06, py * 0.06, 6) + (h - 0.5) * 0.2 - (dd > 8 ? 0.3 : 0);
        return v < 0.45 ? rock[4] : v < 0.62 ? rock[0] : v < 0.8 ? rock[1] : rock[2];
      }
      case 'crystal': {
        const s = ((px + py * 0.55) / 19) % 1;
        if (s < 0.05 && vnoise(px * 0.035, py * 0.035, 5) > 0.74) return rock[3];
        // fallthrough to rock look
      }
      // eslint-disable-next-line no-fallthrough
      default: {
        const n = fbm(px * 0.06, py * 0.06, 1);
        const v = n + (h - 0.5) * 0.24 - (dd > 10 ? 0.16 : 0) - (dd > 16 ? 0.14 : 0);
        const h2 = hash(px, py, 29);
        if (h2 < 0.03 && dd > 2) return rock[3];
        if (h2 < 0.07) return rock[4];
        return v < 0.38 ? rock[0] : v < 0.6 ? rock[1] : rock[2];
      }
    }
  };

  const RC = 5.5;
  for (let ty = 0; ty < L.h; ty++)
    for (let tx = 0; tx < L.w; tx++) {
      if (!solid(tx, ty)) continue;
      const U = !solid(tx, ty - 1), D = !solid(tx, ty + 1), Lf = !solid(tx - 1, ty), R = !solid(tx + 1, ty);
      const UL = !solid(tx - 1, ty - 1), UR = !solid(tx + 1, ty - 1), DL = !solid(tx - 1, ty + 1), DR = !solid(tx + 1, ty + 1);
      const any = U || D || Lf || R || UL || UR || DL || DR;
      for (let ly = 0; ly < TILE; ly++)
        for (let lx = 0; lx < TILE; lx++) {
          const px = tx * TILE + lx, py = ty * TILE + ly;
          let dist = 99, top = false;
          if (any) {
            const cand = (v, isTop) => { if (v < dist) { dist = v; top = isTop; } };
            if (U) cand(ly, true);
            if (D) cand(15 - ly, false);
            if (Lf) cand(lx, false);
            if (R) cand(15 - lx, false);
            if (UL && !U && !Lf) cand(Math.hypot(lx + 0.5, ly + 0.5) - 0.5, true);
            if (UR && !U && !R) cand(Math.hypot(15.5 - lx, ly + 0.5) - 0.5, true);
            if (DL && !D && !Lf) cand(Math.hypot(lx + 0.5, 15.5 - ly) - 0.5, false);
            if (DR && !D && !R) cand(Math.hypot(15.5 - lx, 15.5 - ly) - 0.5, false);
            if (U && Lf && lx < RC && ly < RC) cand(RC - Math.hypot(RC - lx - 0.5, RC - ly - 0.5), true);
            if (U && R && 15 - lx < RC && ly < RC) cand(RC - Math.hypot(RC - (15 - lx) - 0.5, RC - ly - 0.5), true);
            if (D && Lf && lx < RC && 15 - ly < RC) cand(RC - Math.hypot(RC - lx - 0.5, RC - (15 - ly) - 0.5), false);
            if (D && R && 15 - lx < RC && 15 - ly < RC) cand(RC - Math.hypot(RC - (15 - lx) - 0.5, RC - (15 - ly) - 0.5), false);
          }
          const geometric = B.style === 'planks' || B.style === 'bricks';
          const e = geometric ? 0.3 + vnoise(px * 0.3, py * 0.3, 3) * 1.2 : 0.4 + vnoise(px * 0.21, py * 0.21, 3) * 3.2;
          if (dist < e) continue;
          const dd = dist - e;
          let col;
          if (dd < 1) col = edge;
          else if (top) {
            const thick = 3 + vnoise(px * 0.15, ty, 9) * 3.5;
            if (dd < 2.2) col = surf[0];
            else if (dd < thick) col = (dd < thick - 1.2 || hash(px, py, 2) < 0.5) ? surf[1] : surf[2];
            else if (dd < thick + 1.5 && hash(px, py, 4) < 0.45) col = surf[2];
            else col = interior(px, py, dd);
          } else if (dd < 2 && !top && (D || DL || DR) && dist === 15 - ly) col = rock[4]; // underside shadow
          else col = interior(px, py, dd);
          const o = (py * W + px) * 4;
          d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = 255;
        }
    }
  ctx.putImageData(img, 0, 0);
  return c;
}

// Half-resolution distant cave silhouettes, drawn at 0.5 parallax and scaled 2x
export function renderFar(L, B, seed) {
  const W = Math.ceil((L.w * TILE * 0.5 + 540) / 2), H = Math.ceil((L.h * TILE * 0.5 + 580) / 2);
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(W, H);
  const d = img.data;
  const far = hexToRgb(B.far), farD = hexToRgb(mix(B.far, '#000000', 0.25)), farL = hexToRgb(mix(B.far, '#ffffff', 0.08));
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const v = fbm(x * 0.022, y * 0.03, seed) + (hash(x, y, seed) - 0.5) * 0.04;
      const v2 = fbm(x * 0.05 + 40, y * 0.05, seed + 3);
      let col = null;
      if (v > 0.58) col = v > 0.64 ? (v2 > 0.55 ? farD : far) : (hash(x, y, 1) < 0.5 ? far : null);
      else if (v > 0.565) col = farL;
      if (!col) continue;
      const o = (y * W + x) * 4;
      d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = 255;
    }
  ctx.putImageData(img, 0, 0);
  return c;
}
