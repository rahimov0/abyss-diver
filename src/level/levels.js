// 50 hand-designed level specs. Layout is generated from (arch + seed) and validated for solvability.
// biome: 0 Coral Shallows, 1 Kelp Forest, 2 Sunken Wreck, 3 Crystal Grotto,
//        4 Frozen Trench, 5 Volcanic Rift, 6 Sunken Temple, 7 Midnight Abyss
const RAW = [
  // ---- CORAL SHALLOWS ----
  ['First Dive', 0, 'shaft', 22, 44, 5, {}],
  ['Coral Steps', 0, 'zigzag', 22, 48, 6, { e: { fish: 2 } }],
  ['Crab Cove', 0, 'cavern', 34, 40, 6, { e: { crab: 3, urchin: 2, fish: 1 } }],
  ['Jelly Drift', 0, 'islands', 32, 44, 7, { e: { jelly: 4, fish: 2 } }],
  ['Hidden Pearls', 0, 'chambers', 30, 40, 7, { p: { cols: 3, rows: 3 }, secrets: 2, chests: 2, e: { crab: 2, fish: 2, urchin: 2 } }],
  ['Undertow', 0, 'tunnel', 80, 24, 8, { currents: 4, chests: 1, e: { fish: 3, jelly: 2 } }],
  // ---- KELP FOREST ----
  ['Puffer Lane', 1, 'pillars', 36, 44, 8, { chests: 1, e: { puffer: 4, fish: 2, jelly: 2 } }],
  ['Kelp Geysers', 1, 'shaft', 26, 60, 8, { p: { wide: true }, vents: 4, secrets: 1, e: { jelly: 3, crab: 2, urchin: 3 } }],
  ['Locked Grove', 1, 'chambers', 34, 44, 8, { p: { cols: 3, rows: 4 }, doors: 1, chests: 1, e: { fish: 3, puffer: 2, crab: 2 } }],
  ['Eel Hollows', 1, 'tunnel', 84, 26, 9, { secrets: 1, chests: 1, e: { eel: 4, fish: 3, urchin: 2 } }],
  ['Clam Garden', 1, 'cavern', 40, 44, 9, { currents: 2, chests: 2, e: { clam: 4, urchin: 4, puffer: 2 } }],
  ['Minefield', 1, 'islands', 36, 52, 9, { secrets: 1, chests: 1, e: { mine: 8, jelly: 3 } }],
  // ---- SUNKEN WRECK ----
  ['The Wreck', 2, 'wreck', 36, 40, 9, { doors: 1, chests: 2, e: { fish: 3, crab: 3, spike: 3 } }],
  ['Rusty Keel', 2, 'zigzag', 26, 60, 9, { secrets: 2, chests: 2, crackWalls: 1, e: { spinner: 2, eel: 2, fish: 2 } }],
  ['Cargo Hold', 2, 'maze', 37, 37, 10, { doors: 1, chests: 1, e: { crab: 3, clam: 2, jelly: 2 } }],
  ['Bilge Currents', 2, 'spiral', 34, 34, 10, { currents: 6, chests: 1, e: { jelly: 3, mine: 3 } }],
  ["Captain's Vault", 2, 'wreck', 40, 48, 10, { doors: 2, chests: 2, e: { spinner: 2, puffer: 3, clam: 2 } }],
  ['Ghost Ship', 2, 'cavern', 44, 48, 10, { dark: 0.75, secrets: 2, chests: 2, e: { fish: 4, eel: 3, mine: 3 } }],
  // ---- CRYSTAL GROTTO ----
  ['Crystal Mouth', 3, 'shaft', 26, 70, 10, { crackWalls: 2, chests: 1, e: { jelly: 4, spike: 3, urchin: 4 } }],
  ['Prism Maze', 3, 'maze', 41, 41, 10, { secrets: 2, chests: 2, e: { spinner: 3, clam: 2, crab: 2 } }],
  ['Glimmer Falls', 3, 'tunnel', 90, 28, 11, { currents: 3, vents: 3, chests: 1, e: { puffer: 3, eel: 3, fish: 3 } }],
  ['Amethyst Halls', 3, 'chambers', 40, 48, 11, { p: { cols: 4, rows: 4 }, doors: 2, chests: 2, e: { crab: 3, mine: 4, clam: 2 } }],
  ['Shard Storm', 3, 'islands', 40, 56, 11, { chests: 2, e: { spinner: 3, jelly: 4, spike: 4, fish: 2 } }],
  ['Geode Heart', 3, 'spiral', 38, 38, 11, { dark: 0.7, crackWalls: 1, chests: 1, e: { angler: 2, eel: 2, mine: 4 } }],
  // ---- FROZEN TRENCH ----
  ['Frozen Gate', 4, 'zigzag', 28, 64, 11, { chests: 1, secrets: 1, e: { shark: 1, fish: 4, spike: 4 } }],
  ['Icicle Run', 4, 'tunnel', 90, 26, 12, { currents: 3, chests: 1, e: { spike: 8, jelly: 3, fish: 2 } }],
  ['Glacier Vault', 4, 'chambers', 40, 50, 12, { p: { cols: 4, rows: 4 }, doors: 2, chests: 2, e: { shark: 1, puffer: 3, urchin: 4 } }],
  ['Polar Drift', 4, 'islands', 44, 56, 12, { currents: 2, chests: 2, e: { shark: 2, jelly: 4, mine: 4 } }],
  ['Ice Labyrinth', 4, 'maze', 45, 45, 12, { secrets: 2, chests: 2, crackWalls: 1, e: { crab: 3, spinner: 3, clam: 3 } }],
  ['Whiteout', 4, 'cavern', 46, 56, 12, { dark: 0.6, chests: 2, e: { shark: 2, eel: 3, spike: 4, fish: 3 } }],
  // ---- VOLCANIC RIFT ----
  ['Ember Shaft', 5, 'shaft', 28, 80, 12, { p: { wide: true }, vents: 6, chests: 1, secrets: 1, e: { spike: 5, jelly: 3, urchin: 4 } }],
  ['Magma Pillars', 5, 'pillars', 44, 50, 13, { vents: 3, chests: 2, e: { puffer: 4, mine: 5, clam: 3 } }],
  ['Ash Tunnels', 5, 'tunnel', 100, 28, 13, { currents: 4, doors: 1, chests: 1, e: { eel: 4, fish: 5, urchin: 3 } }],
  ['Smoker Chambers', 5, 'chambers', 44, 54, 13, { p: { cols: 4, rows: 5 }, doors: 2, vents: 4, chests: 2, e: { spinner: 3, shark: 1, clam: 2 } }],
  ['Obsidian Coil', 5, 'spiral', 40, 40, 13, { currents: 6, crackWalls: 2, chests: 1, e: { mine: 5, jelly: 3, eel: 3 } }],
  ['Caldera', 5, 'cavern', 50, 56, 13, { secrets: 3, chests: 3, vents: 3, e: { shark: 2, clam: 4, spike: 5, urchin: 5 } }],
  // ---- SUNKEN TEMPLE ----
  ['Temple Steps', 6, 'zigzag', 30, 70, 13, { secrets: 2, chests: 2, e: { spinner: 4, clam: 3, fish: 4 } }],
  ['Hall of Pillars', 6, 'wreck', 44, 52, 13, { doors: 2, chests: 2, e: { eel: 4, puffer: 4, spike: 3 } }],
  ['Serpent Maze', 6, 'maze', 49, 49, 14, { doors: 1, secrets: 2, chests: 2, e: { eel: 5, shark: 1, crab: 3 } }],
  ['Flooded Sanctum', 6, 'islands', 46, 60, 14, { currents: 3, chests: 2, e: { jelly: 6, mine: 5, spinner: 3 } }],
  ['Idol Spiral', 6, 'spiral', 42, 42, 14, { dark: 0.6, crackWalls: 2, chests: 1, e: { angler: 2, clam: 4, spike: 4, mine: 3 } }],
  ['Guardian Halls', 6, 'chambers', 48, 58, 14, { p: { cols: 5, rows: 5 }, doors: 3, chests: 3, e: { shark: 2, spinner: 4, crab: 4 } }],
  // ---- MIDNIGHT ABYSS ----
  ['Twilight Edge', 7, 'shaft', 30, 90, 14, { dark: 0.55, chests: 2, secrets: 1, e: { angler: 3, jelly: 5, urchin: 4 } }],
  ['Lantern Caves', 7, 'cavern', 50, 60, 14, { dark: 0.5, chests: 2, e: { angler: 4, eel: 4, mine: 5 } }],
  ['Black Current', 7, 'tunnel', 110, 30, 15, { dark: 0.5, currents: 6, chests: 2, e: { shark: 2, fish: 6, spike: 5 } }],
  ['Abyssal Maze', 7, 'maze', 49, 53, 15, { dark: 0.45, doors: 2, chests: 2, e: { angler: 3, spinner: 4, clam: 3 } }],
  ['Glowing Reef', 7, 'islands', 50, 64, 15, { dark: 0.45, chests: 2, e: { jelly: 8, puffer: 5, mine: 5, shark: 1 } }],
  ['Pressure Gauntlet', 7, 'zigzag', 32, 90, 15, { dark: 0.42, secrets: 2, chests: 2, crackWalls: 1, e: { spinner: 5, clam: 5, spike: 6, shark: 2 } }],
  ['Last Descent', 7, 'chambers', 50, 64, 16, { p: { cols: 5, rows: 6 }, dark: 0.4, doors: 3, chests: 3, e: { angler: 4, shark: 3, eel: 4, mine: 6 } }],
  ['Leviathan', 7, 'arena', 44, 44, 10, { dark: 0.6, chests: 0, safe: 6, e: { boss: 1, mine: 4 } }],
];

export const BIOMES = [
  'CORAL SHALLOWS', 'KELP FOREST', 'SUNKEN WRECK', 'CRYSTAL GROTTO',
  'FROZEN TRENCH', 'VOLCANIC RIFT', 'SUNKEN TEMPLE', 'MIDNIGHT ABYSS',
  'NEON ATLANTIS', 'TOXIC TRENCH', 'SUBMARINE BASE',
];

// ---- Levels 1-50 (LOCKED: never change these rows or this mapping — see tools/level-snapshots.json) ----
const LEVELS_1_50 = RAW.map(([name, biome, arch, w, h, gems, o], i) => {
  const d = i / 49;
  return {
    id: i + 1, name, biome, arch, w, h, gems,
    p: o.p || {},
    doors: o.doors || 0,
    secrets: o.secrets || 0,
    chests: Math.max(o.chests || 0, o.secrets || 0),
    crackWalls: o.crackWalls || 0,
    currents: o.currents || 0,
    vents: o.vents || 0,
    dark: o.dark || 0,
    enemies: o.e || {},
    safe: o.safe ?? Math.round(10 - d * 3),
    diff: d,
    speed: 1 + d * 0.65,
    o2: Math.round(95 - d * 50), // seconds per full tank
    airR: Math.round(30 - d * 8),
    current: +(0.042 + d * 0.016).toFixed(3),
    seed: 1000 + (i + 1) * 7717,
  };
});

// ---- Levels 51-75: the world below the abyss ----
// biome 8 Neon Atlantis, 9 Toxic Trench, 10 Submarine Base
// extra options: gates (switch + timed gate), portals (sealed vaults reached by portal), whirl (whirlpools),
// crush (crushers), acid (acid pools), pups (hatchlings to rescue), harpoon (harpoon ammo in the level),
// escape ('down' | 'up' | 'right': a deadly wall chases you, exit open from the start), boss, exitAt
// levels 66-74 were too hard in playtests: they cap the difficulty, give more air time and more air bubbles
const TUNE = { dcap: 0.86, o2min: 58, airR: 17 };
const RAW2 = [
  // ---- NEON ATLANTIS ----
  ['Gates of Atlantis', 8, 'city', 44, 46, 11, { gates: 1, chests: 1, e: { sentinel: 2, fish: 4, jelly: 3 } }],
  ['Drowned Avenue', 8, 'climb', 30, 80, 12, { portals: 1, chests: 1, e: { zapper: 3, eel: 3, urchin: 3 } }],
  ['Hall of Echoes', 8, 'hub', 50, 50, 12, { harpoon: 8, exitAt: 'center', dark: 0.7, chests: 2, e: { sentinel: 3, puffer: 4, crab: 3 } }],
  ['Collapsing Spire', 8, 'escapeV', 28, 110, 10, { escape: 'down', e: { jelly: 4, zapper: 2 } }],
  ['Crab King', 8, 'bossroom', 40, 30, 0, { boss: 'crabking', harpoon: 6, e: {} }],
  ['Temple Rings', 8, 'rings', 46, 46, 13, { p: { thick: 2.2 }, gates: 2, whirl: 2, chests: 2, e: { sentinel: 3, zapper: 3 } }],
  ['Lost Hatchlings', 8, 'city', 50, 54, 10, { pups: 4, chests: 1, e: { zapper: 3, shark: 1, eel: 3 } }],
  ['Twin Reflections', 8, 'twin', 50, 50, 12, { portals: 2, dark: 0.6, chests: 2, e: { angler: 3, sentinel: 2, jelly: 4 } }],
  // ---- TOXIC TRENCH ----
  ['Acid Falls', 9, 'climb', 32, 84, 13, { acid: true, chests: 1, e: { sludge: 4, gasvent: 4 } }],
  ['Puffer Overlord', 9, 'bossroom', 40, 34, 0, { boss: 'pufferking', harpoon: 6, e: {} }],
  ['Sludge Works', 9, 'pipes', 49, 49, 13, { gates: 2, crush: 3, chests: 1, e: { sludge: 4, gasvent: 3, crab: 3 } }],
  ['Rot Canal', 9, 'escapeH', 130, 28, 10, { escape: 'right', e: { sludge: 3, gasvent: 3 } }],
  ['Poison Nursery', 9, 'hub', 52, 52, 10, { pups: 5, acid: true, harpoon: 10, dark: 0.65, chests: 2, e: { sludge: 3, puffer: 3, angler: 2 } }],
  ['Whirlpool Graves', 9, 'rings', 48, 48, 14, { p: { thick: 2.4 }, whirl: 4, portals: 1, chests: 2, e: { gasvent: 4, mine: 5 } }],
  ['Hydra', 9, 'bossroom', 44, 34, 0, { boss: 'hydra', harpoon: 10, e: {} }],
  ['Dead Reef', 9, 'twin', 52, 52, 12, { portals: 2, acid: true, crush: 1, dark: 0.8, chests: 2, tune: { dcap: 0.82, o2min: 62, airR: 15 }, e: { sludge: 3, puffer: 2, gasvent: 2 } }],
  // ---- SUBMARINE BASE ----
  ['Docking Bay', 10, 'city', 52, 48, 14, { gates: 2, harpoon: 10, chests: 2, tune: TUNE, e: { drone: 3, crab: 3, sentinel: 2 } }],
  ['Pressure Pipes', 10, 'pipes', 53, 53, 12, { crush: 3, chests: 1, tune: TUNE, e: { drone: 3, spinner: 2 } }],
  ['Reactor Run', 10, 'escapeV', 28, 116, 10, { escape: 'up', tune: TUNE, e: { drone: 2, mine: 3 } }],
  ['Mecha Shark', 10, 'bossroom', 46, 34, 0, { boss: 'mechashark', harpoon: 10, e: {} }],
  ['Containment', 10, 'hub', 54, 54, 12, { pups: 5, gates: 1, dark: 0.7, harpoon: 10, chests: 2, tune: TUNE, e: { drone: 4, zapper: 2 } }],
  ['Teleport Lab', 10, 'twin', 54, 54, 13, { portals: 3, whirl: 2, chests: 2, tune: TUNE, e: { drone: 3, sentinel: 3 } }],
  ['Crusher Line', 10, 'climb', 34, 90, 14, { crush: 4, gates: 2, chests: 1, tune: TUNE, e: { drone: 3, eel: 3 } }],
  ['Abyss Gate', 10, 'rings', 56, 56, 16, { p: { thick: 2.2 }, gates: 2, portals: 1, crush: 3, whirl: 2, dark: 0.65, harpoon: 12, chests: 3, tune: TUNE, e: { drone: 4, sentinel: 2, zapper: 2 } }],
  // ---- FINAL ----
  ['Kraken', 8, 'bossroom', 50, 40, 0, { boss: 'kraken', harpoon: 14, dark: 0.6, e: {} }],
];

const LEVELS_51_75 = RAW2.map(([name, biome, arch, w, h, gems, o], k) => {
  const id = 51 + k;
  const t = o.tune || {};
  const d = Math.min(t.dcap || 9, 0.72 + (k / (RAW2.length - 1)) * 0.33); // harder than the first chapter, still climbing
  return {
    id, name, biome, arch, w, h, gems,
    p: o.p || {},
    doors: 0, secrets: o.secrets || 0, crackWalls: 0, currents: 0, vents: 0,
    chests: Math.max(o.chests || 0, o.secrets || 0),
    dark: o.dark || 0,
    enemies: o.e || {},
    safe: 8,
    diff: d,
    speed: 1 + d * 0.62,
    o2: Math.max(t.o2min || 0, Math.round(95 - d * 48)),
    airR: t.airR || Math.round(30 - d * 8),
    current: 0.05,
    seed: 1000 + id * 7717,
    // chapter-2 features
    gates: o.gates || 0, portals: o.portals || 0, whirl: o.whirl || 0, crush: o.crush || 0,
    acid: !!o.acid, pups: o.pups || 0, harpoon: o.harpoon || 0,
    escape: o.escape || null, boss: o.boss || null, exitAt: o.exitAt || null,
    chapter: 2,
  };
});

export const LEVELS = [...LEVELS_1_50, ...LEVELS_51_75];
export const CHAPTER1 = 50;
