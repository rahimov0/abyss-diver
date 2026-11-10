// Pixel-art sprites (original designs) built from strings
import { sprite, flipped, makeCanvas, disc, px, line } from './pixel.js';

export const PAL = {
  k: '#0b0e1c', w: '#ffffff', W: '#d8f4ff', c: '#8ae8ff', C: '#3aaee0', b: '#1f5f9e', B: '#143a6a',
  y: '#ffd23f', Y: '#f08c1a', o: '#b5531a', r: '#ff4d4d', R: '#b3202e', g: '#5dff7a', G: '#19b84a', q: '#0a6b2f',
  p: '#ff8ad8', P: '#c04da0', v: '#b48cff', V: '#6a3fc4', s: '#ffc8a0', S: '#d88a60', n: '#9a5f36', N: '#5a3420',
  e: '#9aa4b8', E: '#5d6478', u: '#d0d8e8', l: '#fff3a0', t: '#2a2030',
};

const PLAYER = [
  '......kkkkk.....',
  '....kkcccccCk...',
  '...kcWWccccCCk..',
  '..kcWWyyyyycCCk.',
  '.kcWyyYYYYyyCCk.',
  '.kcyyYkkkkkYyCk.',
  'kcWyYksssssksYCk',
  'kccyYksksksksYCk',
  'kccyYksssssksYCk',
  'kcCyYYkkkkkYYbCk',
  'kcCCyyYYYYYybbCk',
  '.kCCCyyyyyybbbk.',
  '.kbCCCCCCCCbbbk.',
  '..kbbCCCCCbbbk..',
  '...kkbbbbbbkk...',
  '.....kkkkkk.....',
];

const GEM = [
  '...kkk...',
  '..kgggk..',
  '.kgwwgGk.',
  'kgwggGGqk',
  'kggGGGqqk',
  '.kgGGqqk.',
  '..kGqqk..',
  '...kqk...',
  '....k....',
];
const GEM_S = [
  '..kkk..',
  '.kgwgk.',
  'kgwGGqk',
  'kgGGqqk',
  '.kGqqk.',
  '..kqk..',
  '...k...',
];
const CHEST = [
  '.kkkkkkkkkk.',
  'knnnnnnnnnnk',
  'knNnNnnNnNnk',
  'kyyyyyyyyyyk',
  'kNnnnkkknnNk',
  'knnnnkykknnk',
  'knnnnkkknnnk',
  'kNnnnnnnnnNk',
  'kyyyyyyyyyyk',
  '.kkkkkkkkkk.',
];
const CHEST_S = [
  '.kkkkk.',
  'knnnnnk',
  'kyyyyyk',
  'knnynnk',
  'knnnnnk',
  '.kkkkk.',
];
const KEY = [
  '.kkk.......',
  'kyYyk......',
  'kY.Ykkkkkk.',
  'kyYykyyyyyk',
  '.kkk.kykyk.',
  '......k.k..',
];
const HEART = [
  '.kk.kk.',
  'krwkrrk',
  'krrrrrk',
  '.krrrk.',
  '..krk..',
  '...k...',
];
const HEART_E = [
  '.kk.kk.',
  'kEEkEEk',
  'kEEEEEk',
  '.kEEEk.',
  '..kEk..',
  '...k...',
];
const STAR = [
  '...k...',
  '..kyk..',
  'kkkykkk',
  'kyyyyyk',
  '.kyyyk.',
  'kyykyyk',
  'kk...kk',
];
const STAR_E = STAR.map((r) => r.replace(/y/g, 'E'));
const LOCK = [
  '.kkk.',
  'k...k',
  'kkkkk',
  'keeek',
  'kekek',
  'kkkkk',
];
const FISH = [
  '......kkkk....',
  '....kkYYYYk...',
  'k..kYyyyyyYk..',
  'kkkYyyyykwyYk.',
  'kYkyyyyykkyyyk',
  'kkkYyyyyyyyYk.',
  'k..kYYyyyyYk..',
  '....kkYYYYk...',
  '......kkkk....',
];
const CRAB = [
  '.kk........kk.',
  'krrk......krrk',
  'kRrk.k..k.kRrk',
  '.kRk.w..w.kRk.',
  '..kkkkkkkkkk..',
  '.krrrrrrrrrrk.',
  'krRrrkrrkrrRrk',
  '.kRRRRRRRRRRk.',
  '..k.k....k.k..',
];
const CRAB2 = CRAB.slice(0, 8).concat(['.k.k......k.k.']);

export function recolor(rows, map) {
  return rows.map((r) => r.replace(/./g, (ch) => map[ch] || ch));
}

export function buildSprites(B, diverPal = {}) {
  const pal = { ...PAL };
  const fishPal = { ...pal, y: B.fish[0], Y: B.fish[1] };
  const fish1 = sprite(FISH, fishPal);
  const fish2rows = FISH.map((r, j) => {
    // flap tail: shift first 3 columns down by one row
    const src = FISH[(j + FISH.length - 1) % FISH.length];
    return src.slice(0, 3) + r.slice(3);
  });
  const fish2 = sprite(fish2rows, fishPal);
  const keyCols = [['#ff4d4d', '#b3202e'], ['#4da6ff', '#1f5f9e'], ['#5dff7a', '#19b84a']];
  const S = {
    player: sprite(PLAYER, { ...pal, ...diverPal }),
    gem: sprite(GEM, pal), gemS: sprite(GEM_S, pal),
    chest: sprite(CHEST, pal), chestS: sprite(CHEST_S, pal),
    keys: keyCols.map(([a, b]) => sprite(KEY, { ...pal, y: a, Y: b })),
    heart: sprite(HEART, pal), heartE: sprite(HEART_E, pal),
    star: sprite(STAR, pal), starE: sprite(STAR_E, pal),
    lock: sprite(LOCK, pal),
    fish: [fish1, fish2], fishL: [flipped(fish1), flipped(fish2)],
    crab: [sprite(CRAB, pal), sprite(CRAB2, pal)],
    keyCols,
  };
  S.playerL = flipped(S.player);
  S.crack = crackTile(B);
  S.doors = keyCols.map(([a, b]) => doorTile(a, b));
  return S;
}

function crackTile(B) {
  const c = makeCanvas(16, 16);
  const x = c.getContext('2d');
  x.fillStyle = B.rock[1]; x.fillRect(0, 0, 16, 16);
  for (let i = 0; i < 26; i++) px(x, (i * 7) % 16, (i * 11) % 16, i % 3 ? B.rock[2] : B.rock[0]);
  x.fillStyle = B.edge; x.fillRect(0, 0, 16, 1); x.fillRect(0, 15, 16, 1); x.fillRect(0, 0, 1, 16); x.fillRect(15, 0, 1, 16);
  line(x, 3, 1, 7, 6, B.edge); line(x, 7, 6, 5, 10, B.edge); line(x, 7, 6, 12, 8, B.edge);
  line(x, 12, 8, 14, 13, B.edge); line(x, 5, 10, 2, 14, B.edge); line(x, 9, 12, 12, 8, B.edge);
  px(x, 4, 2, B.rock[3]); px(x, 11, 9, B.rock[3]);
  return c;
}

function doorTile(a, b) {
  const c = makeCanvas(16, 16);
  const x = c.getContext('2d');
  x.fillStyle = '#20242e'; x.fillRect(0, 0, 16, 16);
  for (let i = 0; i < 4; i++) { x.fillStyle = b; x.fillRect(1 + i * 4, 0, 2, 16); x.fillStyle = a; x.fillRect(1 + i * 4, 0, 1, 16); }
  x.fillStyle = '#5d6478'; x.fillRect(0, 3, 16, 2); x.fillRect(0, 11, 16, 2);
  x.fillStyle = '#9aa4b8'; x.fillRect(0, 3, 16, 1); x.fillRect(0, 11, 16, 1);
  disc(x, 8, 8, 3, '#0b0e1c'); disc(x, 8, 8, 2, a); px(x, 8, 8, '#0b0e1c'); px(x, 8, 9, '#0b0e1c');
  return c;
}
