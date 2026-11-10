// Playable diver types, unlocked with stars. Each has its own look and one small perk.
// pal overrides the bathysphere colors of the player sprite (see PLAYER in gfx/sprites.js).
export const DIVERS = [
  { id: 'bubble', name: 'BUBBLE', stars: 0, perk: 'THE CLASSIC. BALANCED.', pal: {} },
  {
    id: 'turtle', name: 'TURTLE', stars: 15, perk: '4 HEARTS, SWIMS A BIT SLOWER',
    hearts: 4, speed: 0.9, acc: 'shell',
    pal: { c: '#b8f0a0', C: '#4ab05a', b: '#1f6a3a', B: '#143a20', W: '#e8ffe0' },
  },
  {
    id: 'sharky', name: 'SHARKY', stars: 40, perk: 'DASH RECHARGES MUCH FASTER',
    dashCD: 0.55, acc: 'fin',
    pal: { c: '#d0d8e8', C: '#8a96aa', b: '#56657e', B: '#3a4458', y: '#ff7a7a', Y: '#b3202e' },
  },
  {
    id: 'lantern', name: 'LANTERN', stars: 75, perk: 'BIGGER LIGHT, 30% MORE AIR',
    light: 1.4, o2: 1.3, acc: 'lamp',
    pal: { c: '#7a6ab0', C: '#4a3a86', b: '#2a2048', B: '#1a1430', W: '#c8b8ff', y: '#fff3a0', Y: '#ffd23f' },
  },
  {
    id: 'golden', name: 'GOLDEN', stars: 120, perk: 'FASTER SWIM AND DASH',
    speed: 1.1, dashCD: 0.8, acc: 'crown',
    pal: { c: '#fff3a0', C: '#ffd23f', b: '#f08c1a', B: '#b5531a', W: '#ffffff', y: '#ffffff', Y: '#d8f4ff' },
  },
];

export function totalStars(save) {
  return Object.values(save.best || {}).reduce((a, b) => a + (b.stars || 0), 0);
}

export function currentDiver(save) {
  const d = DIVERS.find((x) => x.id === save.diver) || DIVERS[0];
  return totalStars(save) >= d.stars ? d : DIVERS[0];
}
