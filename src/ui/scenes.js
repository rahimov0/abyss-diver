// Title, level select and play scenes (all drawn on the pixel canvas)
import { drawText, wrap } from '../engine/font.js';
import { songFor } from '../engine/audio.js';
import { LEVELS } from '../level/levels.js';
import { BIOME } from '../gfx/biomes.js';
import { World } from '../game/world.js';
import { buildSprites } from '../gfx/sprites.js';
import { disc, px, mix, hash, tri } from '../gfx/pixel.js';
import { writeSave } from '../game/save.js';
import { DIVERS, totalStars, currentDiver } from '../game/divers.js';

export const VERSION = 'V4.0';

const TIPS = {
  1: 'SWIM WITH ARROWS OR THE LEFT STICK. GRAB EVERY GEM TO OPEN THE PORTAL! TAP THE MINI MAP (OR M) FOR THE FULL MAP.',
  2: 'FISH BITE! PRESS SPACE / DASH TO RAM THROUGH THEM.',
  3: 'CRABS CAN BE DASHED. SPIKY URCHINS CANNOT!',
  4: 'JELLYFISH STING. DASHING WONT HELP - DODGE THEM.',
  5: 'DASH INTO CRACKED ROCK TO FIND SECRET TREASURE.',
  6: 'WATCH YOUR AIR! REFILL AT THE BUBBLE VENTS. CURRENTS PUSH YOU.',
  7: 'PUFFERS PUFF UP WHEN YOU COME CLOSE. HIT THEM WHILE SMALL.',
  8: 'GEYSERS LIFT YOU UPWARD.',
  9: 'LOCKED GATE AHEAD - FIND THE MATCHING KEY.',
  10: 'EELS LUNGE OUT OF THE WALLS.',
  11: 'CLAMS SPIT PEARLS. DASH THEM WHILE OPEN.',
  12: 'NAVAL MINES EXPLODE ON CONTACT.',
  13: 'LOOSE DEBRIS FALLS WHEN YOU PASS BELOW.',
  14: 'SPIKED BALLS SPIN ON CHAINS. TIME YOUR MOVE.',
  18: 'LIGHTS OUT. GEMS AND VENTS GLOW IN THE DARK.',
  24: 'ANGLERFISH HUNT IN THE DARK. DASH THEM!',
  25: 'SHARKS CHARGE ONCE THEY SPOT YOU. STAY OUT OF SIGHT.',
  31: 'THE HEAT RISES. RIDE THE VENTS.',
  43: 'THE MIDNIGHT ZONE. ONLY YOUR LAMP CAN SAVE YOU.',
  50: 'THE LEVIATHAN AWAKENS! EVERY GEM YOU TAKE STUNS IT.',
  51: 'CHAPTER 2: NEON ATLANTIS. ENERGY GATES BLOCK THE WAY - TOUCH THE RED SWITCH, THEN RACE THROUGH BEFORE THE TIMER ENDS!',
  52: 'PURPLE PORTALS ARE LINKED IN PAIRS. SWIM IN TO TELEPORT. ZAPPERS SEND OUT ELECTRIC RINGS.',
  53: 'HARPOON GUN! GRAB HARPOON BUNDLES, THEN FIRE WITH C OR THE FIRE BUTTON. TURRETS NEED TWO HITS.',
  54: 'THE SPIRE IS COLLAPSING! DIVE DOWN FAST - DONT LET THE FALLING ROCK CATCH YOU. THE EXIT IS ALREADY OPEN.',
  55: 'BOSS: THE CRAB KING. HARPOON HIM, AND DASH INTO HIM WHILE HE IS DIZZY AFTER A SLAM.',
  56: 'WHIRLPOOLS PULL YOU IN. SWIM AWAY FROM THE SPINNING CORE!',
  57: 'RESCUE MISSION: FREE EVERY TRAPPED BABY TURTLE AND LEAD THEM TO THE EXIT. SOME ARE BEHIND CRACKED ROCK.',
  59: 'THE TOXIC TRENCH. GREEN ACID POOLS BURN - NEVER TOUCH THEM. SLUDGE BLOBS CAN BE DASHED.',
  60: 'BOSS: THE PUFFER OVERLORD. HIT HIM ONLY WHEN HE IS SMALL. WATCH OUT FOR THE SPINE RINGS!',
  61: 'CRUSHERS SLAM SHUT ON A RHYTHM. WAIT FOR THEM TO OPEN, THEN GO!',
  62: 'TOXIC FLOOD! SWIM RIGHT AS FAST AS YOU CAN.',
  65: 'BOSS: THE HYDRA. KNOCK OUT ALL THREE HEADS - THE BODY IS ARMORED.',
  67: 'THE SUBMARINE BASE. DRONES AIM BEFORE THEY FIRE - KEEP MOVING. RED LASER GATES NEED SWITCHES.',
  69: 'REACTOR MELTDOWN! CLIMB UP BEFORE THE FIRE REACHES YOU.',
  70: 'BOSS: THE MECHA SHARK. MAKE IT CRASH INTO A WALL, THEN DASH ITS CORE. SHOOT DOWN ITS TORPEDOES.',
  71: 'THE LAB IS FULL OF TRAPPED BABIES. SAVE THEM ALL!',
  74: 'THE ABYSS GATE. EVERYTHING YOU LEARNED, ALL AT ONCE.',
  75: 'FINAL BOSS: THE KRAKEN. WAIT FOR ITS EYE TO OPEN, THEN STRIKE. BEWARE THE INK!',
};
const PAGES = Math.ceil(LEVELS.length / 25);

// ---------- shared UI helpers ----------
export function panel(ctx, x, y, w, h, fill = '#0b1430', border = '#3aaee0') {
  x = Math.round(x); y = Math.round(y);
  ctx.fillStyle = '#0b0e1c'; ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = border; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = fill; ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
  ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(x + 1, y + 1, w - 2, 1);
}

class Menu {
  constructor(game, items) { this.game = game; this.items = items; this.sel = 0; this.rects = []; }
  update(input) {
    const n = this.items.length;
    if (input.hit('ArrowUp') || input.hit('KeyW')) { this.sel = (this.sel + n - 1) % n; this.game.audio.play('click'); }
    if (input.hit('ArrowDown') || input.hit('KeyS')) { this.sel = (this.sel + 1) % n; this.game.audio.play('click'); }
    if (input.confirm()) { this.game.audio.play('select'); this.items[this.sel].act(); return; }
    for (const tp of input.taps)
      this.rects.forEach((r, i) => {
        if (tp.x >= r.x && tp.x <= r.x + r.w && tp.y >= r.y && tp.y <= r.y + r.h) { this.sel = i; this.game.audio.play('select'); this.items[i].act(); }
      });
  }
  draw(ctx, cx, y, w = 120, h = 15, gap = 4, t = 0) {
    this.rects = [];
    this.items.forEach((it, i) => {
      const x = Math.round(cx - w / 2), yy = y + i * (h + gap);
      const on = i === this.sel;
      panel(ctx, x, yy, w, h, on ? '#1a3a6a' : '#0b1430', on ? '#ffd23f' : '#3aaee0');
      drawText(ctx, typeof it.label === 'function' ? it.label() : it.label, cx, yy + Math.floor((h - 5) / 2), on ? '#ffd23f' : '#d8f4ff', { align: 'center' });
      if (on && (t >> 4) % 2) drawText(ctx, '>', x + 5, yy + Math.floor((h - 5) / 2), '#ffd23f');
      this.rects.push({ x, y: yy, w, h });
    });
  }
}

// ---------- settings (shared by the title screen and the pause menu) ----------
export const CONTROL_NAMES = { stick: 'JOYSTICK', dpad: 'ARROWS', swipe: 'SWIPE' };
const CONTROL_HELP = {
  stick: ['LEFT: FIXED JOYSTICK', 'RIGHT: DASH'],
  dpad: ['LEFT: ARROW BUTTONS', 'RIGHT: DASH'],
  swipe: ['LEFT: SLIDE FINGER TO SWIM', 'RIGHT: DASH'],
};
const VIEW_NAMES = { normal: 'NORMAL', wide: 'WIDE', close: 'CLOSE' };
function cycle(list, cur) { return list[(list.indexOf(cur) + 1) % list.length]; }

function settingsMenu(game, back) {
  const s = game.save;
  const save = () => writeSave(s);
  return new Menu(game, [
    { label: () => `CONTROLS  ${CONTROL_NAMES[s.controls]}`, act: () => { s.controls = cycle(['stick', 'dpad', 'swipe'], s.controls); game.input.ctrl = s.controls; save(); } },
    { label: () => `VIEW  ${VIEW_NAMES[s.view]}`, act: () => { s.view = cycle(['normal', 'wide', 'close'], s.view); save(); game.resize(); } },
    { label: () => `MINI MAP  ${s.minimap ? 'ON' : 'OFF'}`, act: () => { s.minimap = !s.minimap; save(); } },
    { label: () => `VIBRATION  ${s.vibrate !== false ? 'ON' : 'OFF'}`, act: () => { s.vibrate = s.vibrate === false; save(); if (s.vibrate) try { navigator.vibrate && navigator.vibrate(40); } catch { /* */ } } },
    { label: () => `SOUND  ${s.sound ? 'ON' : 'OFF'}`, act: () => { s.sound = !s.sound; game.audio.sfxOn = s.sound; save(); } },
    { label: () => `MUSIC  ${s.music ? 'ON' : 'OFF'}`, act: () => { s.music = !s.music; game.audio.setMusic(s.music); save(); } },
    { label: () => accountLabel(game), act: () => accountAction(game) },
    { label: 'BACK', act: back },
  ]);
}

// ---------- cloud account (Google sign-in) ----------
function accountLabel(game) {
  const c = game.cloud;
  if (!c || !c.enabled) return 'CLOUD SAVE  SOON';
  if (c.status === 'loading') return 'CONNECTING...';
  if (c.status === 'signing') return Date.now() - c.signStart > 12000 ? 'TAP TO TRY AGAIN' : 'OPENING GOOGLE...';
  if (c.lastError && Date.now() - c.lastError < 6000 && !c.user) return 'FAILED - TAP TO RETRY';
  if (!c.user) return 'SIGN IN WITH GOOGLE';
  if (c.confirmOut && Date.now() - c.confirmOut < 3000) return 'TAP AGAIN: SIGN OUT';
  return `${c.status === 'error' ? 'SYNC ERROR' : 'SYNCED'}  ${c.name}`;
}
function accountAction(game) {
  const c = game.cloud;
  if (!c || !c.enabled || c.status === 'loading') return;
  if (c.status === 'signing' && Date.now() - c.signStart < 12000) return;
  if (!c.user) { c.signIn(); return; }
  if (c.confirmOut && Date.now() - c.confirmOut < 3000) { c.confirmOut = 0; c.signOut(); return; }
  c.confirmOut = Date.now();
}
export function cloudBadge(game) {
  const c = game.cloud;
  if (!c || !c.enabled || !c.user) return null;
  return c.status === 'error' ? ['CLOUD: ERROR', '#ff6060'] : c.status === 'syncing' ? ['CLOUD: SYNCING', '#ffd23f'] : ['CLOUD: SAVED', '#7affe0'];
}

function drawSettings(ctx, game, menu, t) {
  const v = game.view, s = game.save;
  drawText(ctx, 'SETTINGS', v.w / 2, Math.max(8, v.h / 2 - 92), '#ffd23f', { align: 'center', scale: 2, outline: '#0b0e1c' });
  const y = Math.max(26, v.h / 2 - 70);
  menu.draw(ctx, v.w / 2, y, 140, 15, 4, t);
  // the Google button runs straight from the touch event, otherwise iPhone blocks the sign-in window
  const ai = menu.items.length - 2, ar = menu.rects[ai];
  if (ar) game.input.gestureRects.push({ ...ar, fn: () => { menu.sel = ai; game.audio.play('select'); accountAction(game); } });
  const hy = y + menu.items.length * 19 + 6;
  CONTROL_HELP[s.controls].forEach((l, i) => drawText(ctx, l, v.w / 2, hy + i * 8, '#9aa4b8', { align: 'center', outline: '#0b0e1c' }));
  drawText(ctx, 'VIEW WIDE = SEE MORE OF THE CAVE', v.w / 2, hy + 20, '#5d6478', { align: 'center', outline: '#0b0e1c' });
}

// animated underwater backdrop for menus
function backdrop(ctx, v, t, S, B = BIOME[0]) {
  const g = ctx.createLinearGradient(0, 0, 0, v.h);
  g.addColorStop(0, B.water[0]); g.addColorStop(1, B.water[1]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, v.w, v.h);
  ctx.save(); ctx.globalAlpha = 0.1; ctx.fillStyle = '#fff';
  for (let i = 0; i < 5; i++) {
    const bx = ((i * 83 + Math.sin(t * 0.005 + i) * 20) % (v.w + 120)) - 60;
    ctx.beginPath(); ctx.moveTo(bx, 0); ctx.lineTo(bx + 14, 0); ctx.lineTo(bx + 80, v.h); ctx.lineTo(bx + 46, v.h); ctx.fill();
  }
  ctx.restore();
  // fish school
  for (let i = 0; i < 6; i++) {
    const dir = i % 2 ? 1 : -1, sp = 0.25 + hash(i, 4) * 0.3;
    let x = (hash(i, 1) * 600 + t * sp * dir) % (v.w + 40);
    if (x < 0) x += v.w + 40;
    x -= 20;
    const y = 40 + hash(i, 2) * (v.h - 110) + Math.sin(t * 0.03 + i) * 3;
    ctx.drawImage((dir > 0 ? S.fish : S.fishL)[(t >> 3) % 2], Math.round(x), Math.round(y));
  }
  // bubbles
  ctx.fillStyle = 'rgba(220,245,255,0.6)';
  for (let i = 0; i < 24; i++) {
    const x = hash(i, 7) * v.w + Math.sin(t * 0.03 + i) * 3;
    const y = v.h - ((t * (0.3 + hash(i, 8) * 0.5) + hash(i, 9) * v.h) % (v.h + 10));
    ctx.fillRect(Math.round(x), Math.round(y), 1 + (i % 3 === 0), 1 + (i % 3 === 0));
  }
  // sea floor
  for (let x = 0; x < v.w; x++) {
    const h = 14 + Math.round(Math.sin(x * 0.05) * 4 + Math.sin(x * 0.13) * 2);
    ctx.fillStyle = B.edge; ctx.fillRect(x, v.h - h - 1, 1, h + 1);
    ctx.fillStyle = B.surf[1]; ctx.fillRect(x, v.h - h, 1, 3);
    ctx.fillStyle = B.surf[0]; ctx.fillRect(x, v.h - h, 1, 1);
    ctx.fillStyle = hash(x, 3) < 0.2 ? B.rock[3] : B.rock[1]; ctx.fillRect(x, v.h - h + 3, 1, h - 3);
  }
  for (let i = 0; i < v.w / 14; i++) {
    const x = Math.round(hash(i, 11) * v.w), base = v.h - 14 - Math.round(Math.sin(x * 0.05) * 4);
    const n = 4 + Math.round(hash(i, 12) * 8);
    for (let k = 0; k < n; k++) px(ctx, x + Math.round(Math.sin(t * 0.03 + i + k * 0.4) * k * 0.25), base - k * 2, k % 3 ? B.weed[0] : B.weed[1], 1, 2);
  }
}

// ---------- TITLE ----------
export class TitleScene {
  constructor(game) {
    this.game = game; this.t = 0;
    this.S = buildSprites(BIOME[0], currentDiver(game.save).pal);
    const s = game.save;
    this.menu = new Menu(game, [
      { label: () => (s.unlocked > 1 ? `CONTINUE  LV ${Math.min(s.unlocked, LEVELS.length)}` : 'START DIVE'), act: () => game.play(Math.min(s.unlocked, LEVELS.length)) },
      { label: 'SELECT LEVEL', act: () => game.setScene(new SelectScene(game)) },
      { label: () => `DIVER  ${currentDiver(s).name}`, act: () => game.setScene(new DiverScene(game)) },
      { label: 'SETTINGS', act: () => { this.mode = 'settings'; this.settings.sel = 0; } },
    ]);
    this.mode = 'main';
    this.settings = settingsMenu(game, () => { this.mode = 'main'; });
    game.input.mode = 'menu';
    game.audio.music(8);
  }
  update(input) {
    this.t++;
    if (this.mode === 'settings') { if (input.back()) { this.mode = 'main'; return; } this.settings.update(input); return; }
    this.menu.update(input);
  }
  draw(ctx) {
    const v = this.game.view, t = this.t;
    backdrop(ctx, v, t, this.S);
    const compact = v.h < 300; // landscape phones
    const ty = compact ? 6 : Math.max(18, Math.round(v.h / 2 - 150));
    const ls = compact ? 3 : 4;
    drawText(ctx, 'ABYSS', v.w / 2, ty, '#ffd23f', { scale: ls, align: 'center', outline: '#0b0e1c', wave: t * 0.08 });
    drawText(ctx, 'DIVER', v.w / 2, ty + ls * 6 + 2, '#8ae8ff', { scale: ls, align: 'center', outline: '#0b0e1c', wave: t * 0.08 + 2 });
    // hero
    const hy = compact ? ty + 16 : ty + 62 + Math.round(Math.sin(t * 0.05) * 3);
    if (compact) ctx.drawImage(this.S.player, 6, 6 + Math.round(Math.sin(t * 0.05) * 2));
    else {
      ctx.drawImage(this.S.player, 0, 0, 16, 16, Math.round(v.w / 2 - 16), hy, 32, 32);
      if (t % 20 === 0) this.bub = (this.bub || []).concat([{ x: v.w / 2 + (Math.random() * 10 - 5), y: hy + 30, l: 80 }]);
      this.bub = (this.bub || []).filter((b) => (b.y -= 0.5, b.l--, b.l > 0));
      for (const b of this.bub) px(ctx, b.x + Math.sin(b.l * 0.2), b.y, 'rgba(220,245,255,0.8)', 2, 2);
    }
    if (this.mode === 'settings') {
      ctx.fillStyle = 'rgba(3,5,14,0.75)'; ctx.fillRect(0, 0, v.w, v.h);
      drawSettings(ctx, this.game, this.settings, t);
      drawText(ctx, VERSION, v.w - 4, v.h - 8, '#d8f4ff', { align: 'right', outline: '#0b0e1c' });
      return;
    }
    const my = compact ? ty + ls * 12 + 8 : Math.min(v.h - 118, hy + 46);
    this.menu.draw(ctx, v.w / 2, my, 132, 15, 4, t);
    const s = this.game.save;
    const stars = Object.values(s.best).reduce((a, b) => a + (b.stars || 0), 0);
    drawText(ctx, `STARS ${stars}/${LEVELS.length * 3}`, 4, v.h - 8, '#fff3a0', { outline: '#0b0e1c' });
    const cb = cloudBadge(this.game);
    if (cb) drawText(ctx, cb[0], 4, v.h - 16, cb[1], { outline: '#0b0e1c' });
    drawText(ctx, VERSION, v.w - 4, v.h - 8, '#d8f4ff', { align: 'right', outline: '#0b0e1c' });
    const mb = this.menu.rects.length ? this.menu.rects[this.menu.rects.length - 1].y + 15 : 0;
    if (window.IOS_BROWSER && v.h - 34 > mb + 4) {
      const lines = ['FULL SCREEN: TAP SHARE', 'THEN ADD TO HOME SCREEN'];
      lines.forEach((l, i) => drawText(ctx, l, v.w / 2, v.h - 34 + i * 8, (t >> 5) % 2 ? '#ffffff' : '#fff3a0', { align: 'center', outline: '#0b0e1c' }));
    }
  }
}

// ---------- LEVEL SELECT ----------
export class SelectScene {
  constructor(game) {
    this.game = game; this.t = 0;
    this.S = buildSprites(BIOME[0]);
    this.sel = Math.min(game.save.unlocked, LEVELS.length) - 1;
    this.page = Math.floor(this.sel / 25);
    this.rects = [];
    game.input.mode = 'menu';
  }
  update(input) {
    this.t++;
    const g = this.game, max = Math.min(g.save.unlocked, LEVELS.length);
    const mv = (d) => { this.sel = Math.max(0, Math.min(LEVELS.length - 1, this.sel + d)); this.page = Math.floor(this.sel / 25); g.audio.play('click'); };
    if (input.hit('ArrowLeft') || input.hit('KeyA')) mv(-1);
    if (input.hit('ArrowRight') || input.hit('KeyD')) mv(1);
    if (input.hit('ArrowUp') || input.hit('KeyW')) mv(-5);
    if (input.hit('ArrowDown') || input.hit('KeyS')) mv(5);
    if (input.back()) { g.audio.play('click'); g.setScene(new TitleScene(g)); return; }
    if (input.confirm()) {
      if (this.sel < max) { g.audio.play('select'); g.play(this.sel + 1); } else g.audio.play('bounce');
      return;
    }
    // swipe left/right (or up/down) to change page
    for (const sw of input.swipes) {
      const fwd = Math.abs(sw.dx) > Math.abs(sw.dy) ? sw.dx < 0 : sw.dy < 0;
      this.setPage(this.page + (fwd ? 1 : -1));
    }
    for (const tp of input.taps)
      for (const r of this.rects)
        if (tp.x >= r.x && tp.x <= r.x + r.w && tp.y >= r.y && tp.y <= r.y + r.h) {
          if (r.act === 'prev') this.setPage(this.page - 1);
          else if (r.act === 'next') this.setPage(this.page + 1);
          else if (r.act === 'back') { g.audio.play('click'); g.setScene(new TitleScene(g)); }
          else if (r.act === 'play') { if (this.sel < max) { g.audio.play('select'); g.play(this.sel + 1); } else g.audio.play('bounce'); }
          else { this.sel = r.id; g.audio.play(r.id < max ? 'click' : 'bounce'); } // tapping a level only selects it
          return;
        }
  }
  setPage(p) {
    const np = Math.max(0, Math.min(PAGES - 1, p));
    if (np === this.page) return;
    this.page = np; this.sel = np * 25; this.game.audio.play('click');
  }
  draw(ctx) {
    const v = this.game.view, t = this.t, s = this.game.save;
    const L = LEVELS[this.sel];
    backdrop(ctx, v, t, this.S, BIOME[L.biome]);
    ctx.fillStyle = 'rgba(5,8,20,0.45)'; ctx.fillRect(0, 0, v.w, v.h);
    drawText(ctx, 'SELECT LEVEL', v.w / 2, 8, '#ffd23f', { scale: 2, align: 'center', outline: '#0b0e1c' });
    this.rects = [];
    const land = v.w > v.h * 1.25; // landscape: grid on the left, details on the right
    const gap = 4;
    const cell = land ? Math.min(30, Math.floor((v.h - 32 - gap * 4) / 5)) : Math.min(30, Math.floor((v.w - 8 - gap * 4) / 5));
    const gw = cell * 5 + gap * 4;
    const x0 = land ? Math.max(6, Math.round(v.w / 2 - gw - 8)) : Math.round(v.w / 2 - gw / 2), y0 = 28;
    for (let i = 0; i < 25; i++) {
      const id = this.page * 25 + i;
      const Lv = LEVELS[id];
      if (!Lv) continue;
      const x = x0 + (i % 5) * (cell + gap), y = y0 + Math.floor(i / 5) * (cell + gap);
      const locked = id >= s.unlocked;
      const B = BIOME[Lv.biome];
      const on = id === this.sel;
      panel(ctx, x, y, cell, cell, locked ? '#141828' : mix(B.water[0], B.water[1], 0.4), on ? '#ffd23f' : locked ? '#2a3040' : B.surf[0]);
      if (locked) ctx.drawImage(this.S.lock, 0, 0, 5, 6, x + cell / 2 - 5, y + cell / 2 - 6, 10, 12);
      else {
        drawText(ctx, String(id + 1), x + cell / 2, y + Math.max(3, Math.floor(cell / 2) - 9), on ? '#ffd23f' : '#ffffff', { scale: 2, align: 'center', outline: '#0b0e1c' });
        const st = (s.best[id + 1] || {}).stars || 0;
        for (let k = 0; k < 3; k++) ctx.drawImage(k < st ? this.S.star : this.S.starE, x + Math.floor((cell - 23) / 2) + k * 8, y + cell - 9);
      }
      if (on && (t >> 4) % 2) { ctx.fillStyle = '#ffd23f'; ctx.fillRect(x - 2, y - 2, 3, 1); ctx.fillRect(x - 2, y - 2, 1, 3); ctx.fillRect(x + cell - 1, y + cell + 1, 3, 1); ctx.fillRect(x + cell + 1, y + cell - 1, 1, 3); }
      this.rects.push({ x, y, w: cell, h: cell, id });
    }
    // details column (below the grid in portrait, right of it in landscape)
    const cx0 = land ? x0 + gw + 12 : x0, cw = land ? Math.min(150, v.w - cx0 - 6) : gw;
    let iy = land ? y0 : y0 + 5 * (cell + gap) + 2;
    const mid = cx0 + cw / 2;
    const locked = L.id > s.unlocked;
    panel(ctx, cx0, iy, cw, 30, '#0b1430', BIOME[L.biome].surf[0]);
    drawText(ctx, `${L.id}. ${L.name}`, mid, iy + 5, '#ffffff', { align: 'center' });
    drawText(ctx, BIOME[L.biome].name, mid, iy + 13, BIOME[L.biome].ui, { align: 'center' });
    const best = s.best[L.id];
    drawText(ctx, locked ? 'LOCKED' : best ? `BEST ${best.score}` : 'NEW!', mid, iy + 21, '#9aa4b8', { align: 'center' });
    iy += 34;
    // big PLAY button — starting a level always needs this press
    const pw = Math.min(cw, 110);
    panel(ctx, mid - pw / 2, iy, pw, 19, locked ? '#141828' : (t >> 4) % 2 ? '#3a5a1a' : '#2e4a14', locked ? '#2a3040' : '#7aff5a');
    drawText(ctx, locked ? 'LOCKED' : `PLAY LEVEL ${L.id}`, mid, iy + 7, locked ? '#5d6478' : '#ffffff', { align: 'center' });
    this.rects.push({ x: mid - pw / 2, y: iy, w: pw, h: 19, act: 'play' });
    iy += 25;
    const by = land ? iy : Math.min(v.h - 26, iy);
    const btn = (label, x, w, act) => { panel(ctx, x, by, w, 15); drawText(ctx, label, x + w / 2, by + 5, '#d8f4ff', { align: 'center' }); this.rects.push({ x, y: by, w, h: 15, act }); };
    btn('<', cx0, 24, 'prev');
    btn('BACK', mid - 28, 56, 'back');
    btn('>', cx0 + cw - 24, 24, 'next');
    drawText(ctx, `PAGE ${this.page + 1}/${PAGES}  -  SWIPE TO TURN`, mid, by + 19, '#9aa4b8', { align: 'center' });
  }
}

// ---------- DIVER SELECT ----------
export class DiverScene {
  constructor(game) {
    this.game = game; this.t = 0;
    this.sprites = DIVERS.map((d) => buildSprites(BIOME[0], d.pal));
    this.bg = this.sprites[0];
    this.sel = Math.max(0, DIVERS.findIndex((d) => d.id === currentDiver(game.save).id));
    this.rects = [];
    game.input.mode = 'menu';
  }
  choose(i) {
    const g = this.game, d = DIVERS[i], stars = totalStars(g.save);
    this.sel = i;
    if (stars < d.stars) { g.audio.play('bounce'); return; }
    g.save.diver = d.id; writeSave(g.save); g.audio.play('select');
  }
  update(input) {
    this.t++;
    const g = this.game, n = DIVERS.length;
    if (input.hit('ArrowUp') || input.hit('KeyW')) { this.sel = (this.sel + n - 1) % n; g.audio.play('click'); }
    if (input.hit('ArrowDown') || input.hit('KeyS')) { this.sel = (this.sel + 1) % n; g.audio.play('click'); }
    if (input.confirm()) this.choose(this.sel);
    if (input.back()) { g.audio.play('click'); g.setScene(new TitleScene(g)); return; }
    for (const tp of input.taps)
      for (const r of this.rects)
        if (tp.x >= r.x && tp.x <= r.x + r.w && tp.y >= r.y && tp.y <= r.y + r.h) {
          if (r.act === 'back') { g.audio.play('click'); g.setScene(new TitleScene(g)); } else this.choose(r.id);
          return;
        }
  }
  draw(ctx) {
    const v = this.game.view, t = this.t, s = this.game.save, stars = totalStars(s);
    backdrop(ctx, v, t, this.bg);
    ctx.fillStyle = 'rgba(5,8,20,0.55)'; ctx.fillRect(0, 0, v.w, v.h);
    drawText(ctx, 'CHOOSE DIVER', v.w / 2, 8, '#ffd23f', { scale: 2, align: 'center', outline: '#0b0e1c' });
    drawText(ctx, `YOUR STARS: ${stars}`, v.w / 2, 24, '#fff3a0', { align: 'center', outline: '#0b0e1c' });
    this.rects = [];
    const rw = Math.min(v.w - 12, 190), x0 = Math.round(v.w / 2 - rw / 2);
    const rh = Math.max(26, Math.min(36, Math.floor((v.h - 70) / DIVERS.length) - 4));
    const cur = currentDiver(s).id;
    DIVERS.forEach((d, i) => {
      const y = 34 + i * (rh + 4), locked = stars < d.stars, on = i === this.sel, picked = d.id === cur;
      panel(ctx, x0, y, rw, rh, picked ? '#1a3a6a' : '#0b1430', on ? '#ffd23f' : picked ? '#7affe0' : locked ? '#2a3040' : '#3aaee0');
      const img = this.sprites[i].player;
      const sy = y + Math.round(rh / 2) - 8 + (picked ? Math.round(Math.sin(t * 0.08) * 1) : 0);
      if (locked) { ctx.globalAlpha = 0.35; ctx.drawImage(img, x0 + 6, sy); ctx.globalAlpha = 1; ctx.drawImage(this.sprites[i].lock, x0 + 12, sy + 5); }
      else ctx.drawImage(img, x0 + 6, sy);
      drawText(ctx, d.name, x0 + 28, y + Math.round(rh / 2) - 8, locked ? '#5d6478' : picked ? '#7affe0' : '#ffffff');
      drawText(ctx, locked ? `NEEDS ${d.stars} STARS` : d.perk, x0 + 28, y + Math.round(rh / 2) + 2, locked ? '#5d6478' : '#9aa4b8');
      if (picked) drawText(ctx, 'ON', x0 + rw - 6, y + Math.round(rh / 2) - 8, '#7affe0', { align: 'right' });
      this.rects.push({ x: x0, y, w: rw, h: rh, id: i });
    });
    const by = Math.min(v.h - 20, 34 + DIVERS.length * (rh + 4) + 4);
    panel(ctx, v.w / 2 - 28, by, 56, 15);
    drawText(ctx, 'BACK', v.w / 2, by + 5, '#d8f4ff', { align: 'center' });
    this.rects.push({ x: v.w / 2 - 28, y: by, w: 56, h: 15, act: 'back' });
  }
}

// ---------- PLAY ----------
export class PlayScene {
  constructor(game, id) {
    this.game = game; this.id = id; this.spec = LEVELS[id - 1];
    this.world = null; this.t = 0; this.mode = 'load';
    game.input.mode = 'play';
    this.pauseMenu = new Menu(game, [
      { label: 'RESUME', act: () => { this.mode = 'play'; } },
      { label: 'RESTART', act: () => game.play(id) },
      { label: 'SETTINGS', act: () => { this.mode = 'settings'; this.settings.sel = 0; } },
      { label: 'LEVEL SELECT', act: () => game.setScene(new SelectScene(game)) },
      { label: 'MAIN MENU', act: () => game.setScene(new TitleScene(game)) },
    ]);
    this.settings = settingsMenu(game, () => { this.mode = 'pause'; });
  }

  pause() {
    if (this.mode === 'settings') { this.mode = 'pause'; return true; }
    if (this.mode === 'pause') return false;
    if (this.mode !== 'play' && this.mode !== 'intro' && this.mode !== 'map') return false;
    this.mode = 'pause';
    const i = this.game.input;
    i.mode = 'menu'; i.clearTouches();
    this.pauseMenu.sel = 0;
    this.game.audio.play('click');
    return true;
  }

  build() {
    this.world = new World(this.spec, this.game);
    this.world.snapCam();
    this.mode = 'intro'; this.t = 0;
    this.game.audio.music(songFor(this.spec.biome, this.spec.boss));
  }

  update(input) {
    this.t++;
    const g = this.game;
    if (this.mode === 'load') { if (this.t > 1) this.build(); return; }
    const W = this.world;
    if (this.mode === 'intro') {
      input.mode = 'play';
      if (input.back() || input.hit('KeyP')) { this.pause(); return; }
      const a = input.axis();
      W.updateFx(); W.updateCam(false);
      if (this.t > 30 && (Math.abs(a.x) + Math.abs(a.y) > 0.3 || input.dash() || input.confirm())) this.mode = 'play';
      else if (this.t > 170) this.mode = 'play';
      input.dash();
      return;
    }
    if (this.mode === 'map') {
      input.mode = 'menu';
      if (this.t - this.mapT > 10 && (input.taps.length || input.back() || input.confirm() || input.hit('KeyM') || input.hit('Tab'))) { this.mode = 'play'; input.mode = 'play'; }
      return;
    }
    if (this.mode === 'settings') {
      input.mode = 'menu';
      if (input.back()) { this.mode = 'pause'; return; }
      this.settings.update(input);
      return;
    }
    if (this.mode === 'pause') {
      input.mode = 'menu';
      if (input.back()) { this.mode = 'play'; return; }
      this.pauseMenu.update(input);
      if (this.mode === 'play') input.mode = 'play';
      return;
    }
    if (this.mode === 'play') {
      input.mode = 'play';
      if (input.back() || input.hit('KeyP')) { this.pause(); return; }
      if (input.hit('KeyM') || input.hit('Tab')) { this.mode = 'map'; this.mapT = this.t; input.mode = 'menu'; input.clearTouches(); this.game.audio.play('click'); return; }
      const r = W.update(input);
      if (r === 'won') this.onWin();
      if (r === 'lost') {
        this.mode = 'lost'; this.t = 0; input.mode = 'menu';
        this.endMenu = new Menu(g, [
          { label: 'TRY AGAIN', act: () => g.play(this.id) },
          { label: 'LEVEL SELECT', act: () => g.setScene(new SelectScene(g)) },
          { label: 'MAIN MENU', act: () => g.setScene(new TitleScene(g)) },
        ]);
      }
      return;
    }
    if (this.mode === 'won' || this.mode === 'lost') {
      input.mode = 'menu';
      W.updateFx();
      if (this.t > 30) this.endMenu.update(input);
    }
  }

  onWin() {
    const g = this.game, s = g.save, W = this.world, R = W.result;
    const prev = s.best[this.id] || { score: 0, stars: 0 };
    this.newBest = R.total > prev.score;
    s.best[this.id] = { score: Math.max(prev.score, R.total), stars: Math.max(prev.stars, R.stars) };
    if (s.unlocked < this.id + 1) s.unlocked = Math.min(LEVELS.length + 1, this.id + 1);
    writeSave(s);
    this.mode = 'won'; this.t = 0; g.input.mode = 'menu';
    const last = this.id >= LEVELS.length;
    this.endMenu = new Menu(g, [
      last ? { label: 'THE END', act: () => g.setScene(new EndScene(g)) } : { label: 'NEXT LEVEL', act: () => g.play(this.id + 1) },
      { label: 'REPLAY', act: () => g.play(this.id) },
      { label: 'LEVEL SELECT', act: () => g.setScene(new SelectScene(g)) },
      { label: 'MAIN MENU', act: () => g.setScene(new TitleScene(g)) },
    ]);
  }

  // small radar-style map in the top-right corner (tap it for the full map)
  drawMiniMap(ctx) {
    const v = this.game.view, W = this.world, L = W.L, t = this.t;
    if (!this.game.save.minimap) { // map turned off: keep a small MAP button for the full map
      const r = { x: v.w - 20, y: 19, w: 18, h: 10 };
      ctx.fillStyle = 'rgba(11,14,28,0.5)'; ctx.fillRect(r.x, r.y, r.w, r.h);
      drawText(ctx, 'MAP', r.x + 9, r.y + 3, 'rgba(255,255,255,0.75)', { align: 'center' });
      return r;
    }
    // small and see-through so it never hides the cave; tap for the big map
    const size = 30, x0 = v.w - size - 3, y0 = 20;
    const p = W.player, ptx = Math.floor(p.x / 16), pty = Math.floor(p.y / 16);
    const sx = Math.max(0, Math.min(L.w - size, ptx - size / 2)), sy = Math.max(0, Math.min(L.h - size, pty - size / 2));
    const ox = x0 + Math.max(0, Math.floor((size - L.w) / 2)), oy = y0 + Math.max(0, Math.floor((size - L.h) / 2));
    ctx.fillStyle = 'rgba(4,6,16,0.28)'; ctx.fillRect(x0, y0, size, size);
    ctx.fillStyle = 'rgba(58,174,224,0.5)';
    ctx.fillRect(x0 - 1, y0 - 1, size + 2, 1); ctx.fillRect(x0 - 1, y0 + size, size + 2, 1);
    ctx.fillRect(x0 - 1, y0, 1, size); ctx.fillRect(x0 + size, y0, 1, size);
    const sw = Math.min(size, L.w), sh = Math.min(size, L.h);
    ctx.globalAlpha = 0.5;
    ctx.drawImage(W.mapC, sx, sy, sw, sh, ox, oy, sw, sh);
    ctx.globalAlpha = 1;
    const dot = (tx, ty, col, big) => {
      const x = ox + tx - sx, y = oy + ty - sy;
      if (x < x0 || y < y0 || x >= x0 + size || y >= y0 + size) return;
      ctx.fillStyle = col; ctx.fillRect(x - (big ? 1 : 0), y - (big ? 1 : 0), big ? 2 : 1, big ? 2 : 1);
    };
    this.mapMarkers((tx, ty, col, big) => dot(tx, ty, col, big));
    if ((t >> 3) % 2) dot(ptx, pty, '#ffffff', true);
    else dot(ptx, pty, '#ffd23f', true);
    return { x: x0 - 2, y: y0 - 2, w: size + 4, h: size + 4 };
  }

  mapMarkers(dot) {
    const W = this.world, t = this.t;
    for (const g of W.gems) if (!g.got) dot(g.tx, g.ty, '#5dff7a', false);
    for (const k of W.keys) if (!k.got) dot(k.tx, k.ty, W.S.keyCols[k.c][0], true);
    const reveal = W.diver.reveal; // lantern diver sees hidden treasure
    for (const c of W.chests) if (!c.got && (reveal || W.seen[c.ty * W.L.w + c.tx])) dot(c.tx, c.ty, '#ffd23f', reveal);
    if (W.ch2) W.ch2.markers(dot, W.seen, W.L.w, reveal);
    for (const a of W.air) if (W.seen[a.ty * W.L.w + a.tx]) dot(a.tx, a.ty, '#d8f4ff', false);
    const e = W.exit;
    if (!e.open || (t >> 3) % 2) dot(e.tx + 1, e.ty + 1, e.open ? '#7affe0' : '#ff8ad8', true);
  }

  drawFullMap(ctx) {
    const v = this.game.view, W = this.world, L = W.L, t = this.t;
    ctx.fillStyle = 'rgba(3,5,14,0.92)'; ctx.fillRect(0, 0, v.w, v.h);
    drawText(ctx, 'MAP', v.w / 2, 6, '#ffd23f', { align: 'center', scale: 2, outline: '#0b0e1c' });
    const k = Math.max(1, Math.floor(Math.min((v.w - 12) / L.w, (v.h - 70) / L.h)));
    const mw = L.w * k, mh = L.h * k, x0 = Math.floor((v.w - mw) / 2), y0 = 24;
    ctx.fillStyle = '#3aaee0'; ctx.fillRect(x0 - 1, y0 - 1, mw + 2, mh + 2);
    ctx.fillStyle = '#05070f'; ctx.fillRect(x0, y0, mw, mh);
    ctx.drawImage(W.mapC, 0, 0, L.w, L.h, x0, y0, mw, mh);
    const s = Math.max(2, k);
    this.mapMarkers((tx, ty, col, big) => {
      ctx.fillStyle = col;
      const d = big ? s + 1 : s;
      ctx.fillRect(x0 + tx * k + Math.floor((k - d) / 2), y0 + ty * k + Math.floor((k - d) / 2), d, d);
    });
    const p = W.player;
    const px0 = x0 + Math.floor((p.x / 16) * k), py0 = y0 + Math.floor((p.y / 16) * k);
    ctx.fillStyle = (t >> 3) % 2 ? '#ffffff' : '#ffd23f';
    ctx.fillRect(px0 - 2, py0 - 2, 4, 4);
    const ly = Math.min(v.h - 30, y0 + mh + 6);
    const legend = W.ch2 && W.ch2.pupsTotal ? [['#ffd23f', 'YOU'], ['#5dff7a', 'GEM'], ['#7affe0', 'BABY'], ['#ff8ad8', 'EXIT']]
      : W.ch2 && W.ch2.switches.length ? [['#ffd23f', 'YOU'], ['#5dff7a', 'GEM'], ['#ff4d4d', 'SWITCH'], ['#ff8ad8', 'EXIT']]
        : [['#ffd23f', 'YOU'], ['#5dff7a', 'GEM'], ['#d8f4ff', 'AIR'], ['#ff8ad8', 'EXIT']];
    legend.forEach(([c, l], i) => {
      const lx = Math.floor(v.w / 2 - 82 + i * 42);
      ctx.fillStyle = c; ctx.fillRect(lx, ly + 1, 3, 3);
      drawText(ctx, l, lx + 6, ly, '#d8f4ff');
    });
    if ((t >> 4) % 2) drawText(ctx, 'TAP TO CLOSE', v.w / 2, ly + 12, '#9aa4b8', { align: 'center' });
  }

  drawHUD(ctx) {
    const v = this.game.view, W = this.world, S = W.S, t = this.t;
    // solid top bar (opaque so the cave never shows through and smears the text)
    ctx.fillStyle = '#070b1a'; ctx.fillRect(0, 0, v.w, 15);
    ctx.fillStyle = '#1f3a6a'; ctx.fillRect(0, 15, v.w, 1);
    ctx.fillStyle = '#02030a'; ctx.fillRect(0, 16, v.w, 1);
    ctx.drawImage(S.gemS, 3, 4);
    drawText(ctx, String(W.gemsLeft).padStart(2, '0'), 12, 5, W.gemsLeft === 0 ? '#7affe0' : '#ffe066');
    ctx.drawImage(S.chestS, 24, 5);
    drawText(ctx, `${W.chestsGot}`, 33, 5, '#ffe066');
    drawText(ctx, String(W.score).padStart(5, '0'), v.w / 2, 5, '#ffffff', { align: 'center' });
    const pr = { x: v.w - 15, y: 1, w: 14, h: 13 };
    panel(ctx, pr.x, pr.y, pr.w, pr.h, '#0b1430', '#ffd23f');
    px(ctx, pr.x + 4, pr.y + 3, '#ffffff', 2, 7); px(ctx, pr.x + 8, pr.y + 3, '#ffffff', 2, 7);
    for (let i = 0; i < W.maxHearts; i++) ctx.drawImage(i < W.hearts ? S.heart : S.heartE, v.w - 17 - (W.maxHearts - i) * 9, 5);
    // oxygen bar
    const low = W.o2 < 0.25;
    const bw = 44;
    drawText(ctx, 'O2', 3, 20, low && (t >> 3) % 2 ? '#ff6060' : '#8ae8ff', { outline: '#0b0e1c' });
    ctx.fillStyle = '#0b0e1c'; ctx.fillRect(12, 20, bw + 2, 5);
    ctx.fillStyle = '#1a2440'; ctx.fillRect(13, 21, bw, 3);
    ctx.fillStyle = low ? ((t >> 3) % 2 ? '#ff4d4d' : '#b3202e') : W.o2 < 0.5 ? '#ffd23f' : '#8ae8ff';
    ctx.fillRect(13, 21, Math.round(bw * W.o2), 3);
    ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillRect(13, 21, Math.round(bw * W.o2), 1);
    let kx = 62;
    for (const c of W.held) { ctx.drawImage(S.keys[c], kx, 20); kx += 13; }
    // chapter 2 counters: harpoons, babies, and diver ability status
    let ry = 28;
    if (W.ch2 && (W.ammo > 0 || W.ch2.harpoons.length)) {
      px(ctx, 4, ry + 2, '#c8d0e0', 7, 1); px(ctx, 10, ry + 1, '#ffd23f', 2, 3);
      drawText(ctx, `${W.ammo}`, 14, ry, W.ammo ? '#ffffff' : '#5d6478', { outline: '#0b0e1c' });
      ry += 8;
    }
    if (W.ch2 && W.ch2.pupsTotal) {
      disc(ctx, 7, ry + 2, 2.5, '#4ab05a');
      drawText(ctx, `${W.ch2.pupsWith}/${W.ch2.pupsTotal}`, 14, ry, W.ch2.pupsReady ? '#7affe0' : '#ffffff', { outline: '#0b0e1c' });
      ry += 8;
    }
    if (W.diver.shell) drawText(ctx, W.shellT > 0 ? `SHELL ${Math.ceil(W.shellT / 60)}` : 'SHELL OK', 3, ry, W.shellT > 0 ? '#5d6478' : '#8ee05a', { outline: '#0b0e1c' });
    else if (W.maxDash > 1) for (let i = 0; i < W.maxDash; i++) px(ctx, 4 + i * 6, ry + 1, i < W.player.charges ? '#ffd23f' : '#3a4050', 4, 3);
    const mr = this.drawMiniMap(ctx);
    this.game.input.hot = [{ ...pr, code: 'Escape' }, { ...mr, code: 'KeyM' }];
    const fireBtn = this.game.input.touchUI && this.mode === 'play' && W.ch2 && (W.ammo > 0 || W.ch2.harpoons.length);
    if (fireBtn) this.game.input.hot.push({ x: v.w - 70, y: v.h - 74, w: 24, h: 24, code: 'KeyC' });
    // dash cooldown + touch controls
    const inp = this.game.input;
    if (inp.touchUI && this.mode === 'play') {
      const b = inp.stickBase();
      if (inp.ctrl === 'dpad') { // four big separate arrow buttons
        const pressed = inp.pressedPads();
        for (const [k, r] of Object.entries(inp.padButtons())) {
          const on = pressed.has(k);
          ctx.fillStyle = 'rgba(11,14,28,0.55)'; ctx.fillRect(r.x - 1, r.y - 1, r.w + 2, r.h + 2);
          ctx.fillStyle = on ? 'rgba(255,210,63,0.65)' : 'rgba(255,255,255,0.15)'; ctx.fillRect(r.x, r.y, r.w, r.h);
          ctx.fillStyle = on ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.08)'; ctx.fillRect(r.x, r.y, r.w, 2);
          const cx = r.x + r.w / 2, cy = r.y + r.h / 2, c = on ? '#ffffff' : 'rgba(255,255,255,0.75)';
          if (r.dx) tri(ctx, cx + r.dx * 6, cy, cx - r.dx * 5, cy - 7, cx - r.dx * 5, cy + 7, c);
          else tri(ctx, cx, cy + r.dy * 6, cx - 7, cy - r.dy * 5, cx + 7, cy - r.dy * 5, c);
        }
      } else if (inp.ctrl === 'swipe') { // slide anywhere on the left half
        if (inp.stick) {
          disc(ctx, inp.stick.ox, inp.stick.oy, 21, 'rgba(255,255,255,0.08)');
          const dx = inp.stick.x - inp.stick.ox, dy = inp.stick.y - inp.stick.oy, d = Math.hypot(dx, dy), m = Math.min(d, 18) / (d || 1);
          disc(ctx, inp.stick.ox + dx * m, inp.stick.oy + dy * m, 7, 'rgba(255,255,255,0.35)');
        } else {
          drawText(ctx, 'SLIDE TO', b.x + 2, b.y - 6, 'rgba(255,255,255,0.35)', { align: 'center' });
          drawText(ctx, 'SWIM', b.x + 2, b.y + 2, 'rgba(255,255,255,0.35)', { align: 'center' });
        }
      } else { // fixed joystick in the bottom-left corner
        disc(ctx, b.x, b.y, b.r + 1, 'rgba(11,14,28,0.45)');
        disc(ctx, b.x, b.y, b.r - 1, inp.stick ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.09)');
        let kx = b.x, ky = b.y;
        if (inp.stick) {
          const dx = inp.stick.x - b.x, dy = inp.stick.y - b.y, d = Math.hypot(dx, dy), m = Math.min(d, b.r - 6) / (d || 1);
          kx += dx * m; ky += dy * m;
        } else drawText(ctx, 'MOVE', b.x, b.y + b.r + 3 > v.h - 6 ? b.y - b.r - 8 : b.y + b.r + 3, 'rgba(255,255,255,0.35)', { align: 'center' });
        disc(ctx, kx, ky, 9, 'rgba(11,14,28,0.5)');
        disc(ctx, kx, ky, 8, inp.stick ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.3)');
      }
      const bx = v.w - 30, by = v.h - 32, cd = W.player.charges <= 0;
      disc(ctx, bx, by, 17, 'rgba(11,14,28,0.5)');
      disc(ctx, bx, by, 15, inp.dashTouch ? 'rgba(255,210,63,0.6)' : cd ? 'rgba(90,100,120,0.45)' : 'rgba(255,210,63,0.35)');
      drawText(ctx, 'DASH', bx, by - 2, '#ffffff', { align: 'center' });
      if (fireBtn) {
        const fx = v.w - 58, fy = v.h - 62;
        disc(ctx, fx, fy, 13, 'rgba(11,14,28,0.5)');
        disc(ctx, fx, fy, 11, W.ammo > 0 ? 'rgba(255,90,90,0.4)' : 'rgba(90,100,120,0.35)');
        drawText(ctx, 'FIRE', fx, fy - 5, '#ffffff', { align: 'center' });
        drawText(ctx, String(W.ammo), fx, fy + 1, W.ammo ? '#ffd23f' : '#9aa4b8', { align: 'center' });
      }
    }
  }

  draw(ctx) {
    const v = this.game.view, t = this.t;
    if (!this.world) {
      ctx.fillStyle = '#05070f'; ctx.fillRect(0, 0, v.w, v.h);
      drawText(ctx, 'DIVING...', v.w / 2, v.h / 2 - 2, '#8ae8ff', { align: 'center', scale: 2 });
      return;
    }
    const W = this.world;
    W.draw(ctx);
    this.drawHUD(ctx);
    const B = BIOME[this.spec.biome];
    if (this.mode === 'intro') {
      const a = Math.min(1, (170 - this.t) / 20);
      ctx.globalAlpha = Math.max(0, a);
      const tip = TIPS[this.id];
      const lines = tip ? wrap(tip, v.w - 40) : [];
      const h = 50 + lines.length * 8;
      const y = Math.round(v.h / 2 - h / 2);
      panel(ctx, 12, y, v.w - 24, h, 'rgba(8,14,34,0.92)', B.surf[0]);
      drawText(ctx, `LEVEL ${this.id}`, v.w / 2, y + 6, B.ui, { align: 'center' });
      drawText(ctx, this.spec.name, v.w / 2, y + 15, '#ffffff', { align: 'center', scale: 2, outline: '#0b0e1c' });
      const goal = this.spec.boss ? 'BOSS FIGHT' : this.spec.escape ? 'ESCAPE!' : this.spec.pups ? `${this.spec.gems} GEMS + ${this.spec.pups} BABIES` : `${this.spec.gems} GEMS`;
      drawText(ctx, `${B.name}  -  ${goal}`, v.w / 2, y + 31, '#9aa4b8', { align: 'center' });
      lines.forEach((l, i) => drawText(ctx, l, v.w / 2, y + 42 + i * 8, '#fff3a0', { align: 'center' }));
      ctx.globalAlpha = 1;
    }
    if (this.mode === 'map') this.drawFullMap(ctx);
    if (this.mode === 'settings') {
      ctx.fillStyle = 'rgba(3,5,14,0.8)'; ctx.fillRect(0, 0, v.w, v.h);
      drawSettings(ctx, this.game, this.settings, t);
    }
    if (this.mode === 'pause') {
      ctx.fillStyle = 'rgba(3,5,14,0.7)'; ctx.fillRect(0, 0, v.w, v.h);
      drawText(ctx, 'PAUSED', v.w / 2, v.h / 2 - 70, '#ffd23f', { align: 'center', scale: 3, outline: '#0b0e1c' });
      this.pauseMenu.draw(ctx, v.w / 2, v.h / 2 - 40, 120, 15, 4, t);
    }
    if (this.mode === 'lost') {
      ctx.fillStyle = `rgba(20,0,6,${Math.min(0.75, this.t / 40)})`; ctx.fillRect(0, 0, v.w, v.h);
      drawText(ctx, 'OUT OF', v.w / 2, v.h / 2 - 60, '#ff6060', { align: 'center', scale: 3, outline: '#0b0e1c' });
      drawText(ctx, 'LIVES', v.w / 2, v.h / 2 - 38, '#ff6060', { align: 'center', scale: 3, outline: '#0b0e1c' });
      if (this.t > 30) this.endMenu.draw(ctx, v.w / 2, v.h / 2, 120, 15, 4, t);
    }
    if (this.mode === 'won') this.drawWin(ctx);
  }

  drawWin(ctx) {
    const v = this.game.view, t = this.t, R = this.world.result, S = this.world.S;
    ctx.fillStyle = `rgba(3,8,20,${Math.min(0.78, t / 30)})`; ctx.fillRect(0, 0, v.w, v.h);
    const y = Math.max(16, Math.round(v.h / 2 - 110));
    drawText(ctx, 'LEVEL CLEAR!', v.w / 2, y, '#7affe0', { align: 'center', scale: 2, outline: '#0b0e1c', wave: t * 0.1 });
    for (let k = 0; k < 3; k++) {
      const show = t > 20 + k * 14;
      const img = show && k < R.stars ? S.star : S.starE;
      if (show && t === 21 + k * 14 && k < R.stars) this.game.audio.play('gem');
      ctx.drawImage(img, 0, 0, 7, 7, Math.round(v.w / 2 - 33 + k * 23), y + 18, 21, 21);
    }
    const rows = [
      ['SCORE', R.score], ['TIME BONUS', R.timeBonus], ['HEART BONUS', R.heartBonus],
      ['TREASURE', `${R.chests}/${R.chestsMax}`], ['TIME', `${Math.floor(R.secs / 60)}:${String(Math.floor(R.secs % 60)).padStart(2, '0')}`],
    ];
    const px0 = Math.round(v.w / 2 - 60);
    panel(ctx, px0, y + 46, 120, 62, 'rgba(8,14,34,0.9)', '#3aaee0');
    rows.forEach(([a, b], i) => {
      if (t < 50 + i * 6) return;
      drawText(ctx, a, px0 + 6, y + 52 + i * 9, '#9aa4b8');
      drawText(ctx, String(b), px0 + 114, y + 52 + i * 9, '#ffffff', { align: 'right' });
    });
    if (t > 85) {
      drawText(ctx, `TOTAL ${R.total}`, v.w / 2, y + 114, '#ffd23f', { align: 'center', scale: 2, outline: '#0b0e1c' });
      if (this.newBest && (t >> 4) % 2) drawText(ctx, 'NEW BEST!', v.w / 2, y + 128, '#ff8ad8', { align: 'center' });
    }
    const my = Math.min(y + 140, v.h - this.endMenu.items.length * 19 - 2);
    if (t > 30) this.endMenu.draw(ctx, v.w / 2, my, 120, 15, 4, t);
  }
}

// ---------- ENDING ----------
export class EndScene {
  constructor(game) { this.game = game; this.t = 0; this.S = buildSprites(BIOME[7], currentDiver(game.save).pal); game.input.mode = 'menu'; game.audio.music(8); }
  update(input) {
    this.t++;
    if (this.t > 90 && (input.confirm() || input.taps.length || input.back())) this.game.setScene(new TitleScene(this.game));
  }
  draw(ctx) {
    const v = this.game.view, t = this.t, s = this.game.save;
    backdrop(ctx, v, t, this.S, BIOME[7]);
    const total = Object.values(s.best).reduce((a, b) => a + (b.score || 0), 0);
    const stars = Object.values(s.best).reduce((a, b) => a + (b.stars || 0), 0);
    drawText(ctx, 'THE ABYSS', v.w / 2, v.h / 2 - 70, '#3af0ff', { align: 'center', scale: 3, outline: '#0b0e1c', wave: t * 0.06 });
    drawText(ctx, 'IS CONQUERED!', v.w / 2, v.h / 2 - 46, '#ffd23f', { align: 'center', scale: 2, outline: '#0b0e1c' });
    drawText(ctx, `TOTAL SCORE ${total}`, v.w / 2, v.h / 2 - 16, '#ffffff', { align: 'center' });
    drawText(ctx, `STARS ${stars}/${LEVELS.length * 3}`, v.w / 2, v.h / 2 - 6, '#fff3a0', { align: 'center' });
    ctx.drawImage(this.S.player, 0, 0, 16, 16, Math.round(v.w / 2 - 16), Math.round(v.h / 2 + 8 + Math.sin(t * 0.05) * 3), 32, 32);
    if (t > 90 && (t >> 4) % 2) drawText(ctx, 'TAP TO CONTINUE', v.w / 2, v.h / 2 + 52, '#d8f4ff', { align: 'center' });
  }
}

