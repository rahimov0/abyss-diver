// 3x5 pixel font, cached per color. Each glyph = 5 rows of 3 pixels.
const ROWS = {
  A: ['.#.', '#.#', '###', '#.#', '#.#'], B: ['##.', '#.#', '##.', '#.#', '##.'], C: ['.##', '#..', '#..', '#..', '.##'],
  D: ['##.', '#.#', '#.#', '#.#', '##.'], E: ['###', '#..', '##.', '#..', '###'], F: ['###', '#..', '##.', '#..', '#..'],
  G: ['.##', '#..', '#.#', '#.#', '.##'], H: ['#.#', '#.#', '###', '#.#', '#.#'], I: ['###', '.#.', '.#.', '.#.', '###'],
  J: ['..#', '..#', '..#', '#.#', '.#.'], K: ['#.#', '#.#', '##.', '#.#', '#.#'], L: ['#..', '#..', '#..', '#..', '###'],
  M: ['#.#', '###', '###', '#.#', '#.#'], N: ['##.', '#.#', '#.#', '#.#', '#.#'], O: ['.#.', '#.#', '#.#', '#.#', '.#.'],
  P: ['##.', '#.#', '##.', '#..', '#..'], Q: ['.#.', '#.#', '#.#', '##.', '.##'], R: ['##.', '#.#', '##.', '#.#', '#.#'],
  S: ['.##', '#..', '.#.', '..#', '##.'], T: ['###', '.#.', '.#.', '.#.', '.#.'], U: ['#.#', '#.#', '#.#', '#.#', '###'],
  V: ['#.#', '#.#', '#.#', '#.#', '.#.'], W: ['#.#', '#.#', '###', '###', '#.#'], X: ['#.#', '#.#', '.#.', '#.#', '#.#'],
  Y: ['#.#', '#.#', '.#.', '.#.', '.#.'], Z: ['###', '..#', '.#.', '#..', '###'],
  0: ['###', '#.#', '#.#', '#.#', '###'], 1: ['.#.', '##.', '.#.', '.#.', '###'], 2: ['##.', '..#', '.#.', '#..', '###'],
  3: ['##.', '..#', '.#.', '..#', '##.'], 4: ['#.#', '#.#', '###', '..#', '..#'], 5: ['###', '#..', '##.', '..#', '##.'],
  6: ['.##', '#..', '###', '#.#', '###'], 7: ['###', '..#', '.#.', '.#.', '.#.'], 8: ['###', '#.#', '###', '#.#', '###'],
  9: ['###', '#.#', '###', '..#', '##.'],
  '.': ['...', '...', '...', '...', '.#.'], ',': ['...', '...', '...', '.#.', '#..'], '!': ['.#.', '.#.', '.#.', '...', '.#.'],
  '?': ['##.', '..#', '.#.', '...', '.#.'], ':': ['...', '.#.', '...', '.#.', '...'], '-': ['...', '...', '###', '...', '...'],
  "'": ['.#.', '.#.', '...', '...', '...'], '/': ['..#', '..#', '.#.', '#..', '#..'], '+': ['...', '.#.', '###', '.#.', '...'],
  '%': ['#.#', '..#', '.#.', '#..', '#.#'], '(': ['.#.', '#..', '#..', '#..', '.#.'], ')': ['.#.', '..#', '..#', '..#', '.#.'],
  '<': ['..#', '.#.', '#..', '.#.', '..#'], '>': ['#..', '.#.', '..#', '.#.', '#..'], '=': ['...', '###', '...', '###', '...'],
  '_': ['...', '...', '...', '...', '###'], '#': ['#.#', '###', '#.#', '###', '#.#'], '*': ['.#.', '###', '.#.', '#.#', '...'],
  '&': ['.#.', '#.#', '.#.', '#.#', '.##'], '"': ['#.#', '#.#', '...', '...', '...'], ' ': ['...', '...', '...', '...', '...'],
};
const CHARS = Object.keys(ROWS);
const INDEX = new Map(CHARS.map((c, i) => [c, i]));
const cache = new Map();

function atlas(color) {
  let c = cache.get(color);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = CHARS.length * 4; c.height = 5;
  const x = c.getContext('2d');
  x.fillStyle = color;
  CHARS.forEach((ch, i) => ROWS[ch].forEach((row, y) => {
    for (let k = 0; k < 3; k++) if (row[k] === '#') x.fillRect(i * 4 + k, y, 1, 1);
  }));
  cache.set(color, c);
  return c;
}

export function textWidth(str, scale = 1) {
  return Math.max(0, String(str).length * 4 - 1) * scale;
}

// o: { scale, align: 'left'|'center'|'right', shadow: color, outline: color, wave: phase }
export function drawText(ctx, str, x, y, color = '#fff', o = {}) {
  str = String(str).toUpperCase();
  const scale = o.scale || 1;
  const w = textWidth(str, scale);
  const sx = Math.round(o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x);
  y = Math.round(y);
  if (o.outline) {
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]])
      drawText(ctx, str, sx + dx * scale, y + dy * scale, o.outline, { scale, wave: o.wave });
  }
  if (o.shadow) drawText(ctx, str, sx + scale, y + scale, o.shadow, { scale, wave: o.wave });
  const a = atlas(color);
  for (let i = 0; i < str.length; i++) {
    const gi = INDEX.get(str[i]);
    if (gi === undefined) continue;
    const dy = o.wave !== undefined ? Math.round(Math.sin(o.wave + i * 0.55) * scale) : 0;
    ctx.drawImage(a, gi * 4, 0, 3, 5, sx + i * 4 * scale, y + dy, 3 * scale, 5 * scale);
  }
  return w;
}

// word-wrap to a max pixel width
export function wrap(str, maxW, scale = 1) {
  const words = String(str).split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (textWidth(t, scale) > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}
