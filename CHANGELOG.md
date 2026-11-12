# Changelog

## v4.1
- Levels 66–74 made fairer after playtesting (66 Dead Reef most of all): more air time, more air bubbles, slightly slower enemies, fewer crushers/drones, bigger lamp in the dark levels. 66 has no shark anymore and a simpler layout.
- Drone shots are slower than the diver now and come less often.
- Hazards (acid, crushers, whirlpools, gas vents, sludge) glow in dark levels so you can always see them.
- Levels 1–65 and the bosses (70, 75) unchanged.

## v4.0 — Chapter 2: The Deep Cities (levels 51–75)
- 25 brand-new levels in three new worlds: Neon Atlantis, Toxic Trench and the Submarine Base, with new layouts (city blocks with gate walls, vertical climbs, hub rooms, temple rings, pipe mazes, twin halves, escape tunnels, boss arenas).
- New mechanics: timed switch gates, linked teleport portals, whirlpools, crushers/pistons, acid pools, escape levels with a chasing flood/collapse/fire, rescue missions (free trapped baby turtles and bring them to the exit).
- Harpoon gun: collect harpoon bundles, fire with C / the FIRE button.
- New enemies: energy turrets, electric zappers, sludge blobs, toxic gas vents, patrol drones.
- Five bosses with health bars: Crab King (55), Puffer Overlord (60), Hydra (65), Mecha Shark (70) and the Kraken (75).
- Diver abilities: TURTLE shell blocks a hit every 10 s, SHARKY double dash, LANTERN reveals all secrets on the map, GOLDEN gem magnet.
- Level select has 3 pages. Levels 1–50 are unchanged (fingerprint-locked); 51–75 are now locked too.

## v3.9.1
- Google sign-in window now opens straight from the tap (touchend), so iPhone no longer blocks it; the button never stays stuck on CONNECTING (shows TAP TO TRY AGAIN / FAILED - TAP TO RETRY).

## v3.9
- Cloud save: SETTINGS → SIGN IN WITH GOOGLE. Progress (levels, stars, scores, diver) follows you to every device; merging never loses progress.

## v3.8
- ARROWS control: four big separate buttons; each finger presses exactly one direction (two fingers for diagonals).
- Level select: tapping a level only selects it, a big PLAY button starts it; swipe to turn pages; landscape layout.
- Menus register taps on release, so dragging never triggers a button by accident.
- Checkpoint flags on long levels (placed at run time on the main route — level layouts untouched): touch a flag and, if you run out of hearts, you continue from it with full hearts.
- Vibration on hits, explosions and breaking rock (Android; setting VIBRATION ON/OFF).
- Diver types unlocked with stars: BUBBLE, TURTLE (15★, 4 hearts), SHARKY (40★, fast dash recharge), LANTERN (75★, bigger light + more air), GOLDEN (120★, faster swim & dash).
- Compact title screen in landscape.

## v3.7
- SETTINGS menu (title screen + pause): controls (fixed JOYSTICK / ARROW buttons / SWIPE), VIEW (NORMAL / WIDE / CLOSE), mini map on/off, sound, music.
- VIEW WIDE shows much more of the cave, especially in portrait.
- Mini map is smaller and see-through; tap it for the big map. With the mini map off a small MAP button remains.
- Level lock: `npm run validate` now fails if any of the 50 levels changes (fingerprints in tools/level-snapshots.json).

## v3.6
- Touch joystick is now fixed in the bottom-left corner (it no longer follows the finger around); always visible during play.

## v3.5
- iOS home-screen app also blurs the strip under the status bar: the HUD offset now applies there too.

## v3.4
- iPhone Safari: the top bar is moved below Safari's blurred status-bar strip.
- Title screen tip on iPhone/iPad Safari: add to home screen for true full screen (no Safari blur or bottom bar).

## v3.3
- Mini map in the top-right corner: reveals the cave as you explore and shows gems, keys, air vents, treasure you've seen and the exit.
- Tap the mini map (or press M / Tab) for a full-screen map with a legend.
- Top bar is now solid with brighter text (no more blurry look over the cave).
- Camera distance back to the original on phones (phone close-up mode removed); safe-area layout and zoom blocking kept.

## v3.2
- Phone mode: on small screens the camera is closer (bigger pixels, bigger text and buttons); tablets/desktop unchanged.
- The game now stays inside the phone's safe area — HUD (oxygen, score, pause) is no longer hidden under the notch / status bar, and nothing sits under the home bar.
- Pinch-zoom and double-tap zoom are blocked during play (iOS ignores the viewport setting).
- Level select grid adapts to narrow screens.

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
