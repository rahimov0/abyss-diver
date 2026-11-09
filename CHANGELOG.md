# Changelog

## v3.1
- Phone back gesture / browser back button now pauses the game, a second back returns to the main menu (no more page refresh needed).
- "MAIN MENU" added to the pause, level-clear and game-over menus; bigger pause button.
- Geysers are now short local lifts (max 9 tiles) instead of pushing up a whole shaft.
- Currents slightly softer and never placed next to breakable walls or gates.
- Real stars and a bigger lock icon on the level select screen.
- Every level was played start-to-finish by an automated bot using the real game physics (all gems, keys, chests and the exit).

## v3.0 — Abyss Diver (complete rebuild)
- Rebuilt from scratch as a Deep Abyss style underwater arcade game (replaces Magma Runner v2).
- 50 unique levels, 8 biomes, 11 layout types, difficulty ramps from level 1 to 50.
- New physics: buoyant bouncing bathysphere, dash attack, oxygen system.
- Enemies: fish, crab, jellyfish, urchin, puffer, eel, clam (pearl shooter), mine, falling spikes, spinner, shark, anglerfish, Leviathan boss.
- Mechanics: gems → portal, colored keys & gates, breakable walls, secret chests, currents, geysers, dark levels.
- Pixel-perfect canvas renderer that scales to any phone/desktop screen; touch + keyboard controls.
- Level solvability validator, network-first service worker (old cache-first worker is removed).
