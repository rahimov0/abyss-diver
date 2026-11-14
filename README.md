# Abyss Diver

A retro pixel deep‑sea arcade game inspired by the classic Sony Ericsson / mophun era game **Deep Abyss** (2002).
Original art, code and level design.

▶ **Play:** https://abyss-diver.rahimov.tr/

Pilot a little bathysphere through underwater caves, collect every gem to open the portal, find secret treasure,
manage your oxygen and survive 75 increasingly hard levels.

## Play
```bash
npm install
npm run dev        # local dev server
npm run build      # production build -> dist/
npm run validate   # generates all 75 levels and proves each one is solvable
```

## Controls
| | Keyboard | Touch |
|---|---|---|
| Swim | Arrows / WASD | Left half of the screen (floating stick) |
| Dash (ram enemies, break cracked rock) | Space / X | Right half of the screen |
| Pause | Esc / P | ⏸ button |

## Features
- 75 levels across 11 biomes: Coral Shallows, Kelp Forest, Sunken Wreck, Crystal Grotto, Frozen Trench, Volcanic Rift, Sunken Temple, Midnight Abyss, Neon Atlantis, Toxic Trench, Submarine Base
- 11 layout types (shaft, zigzag shelves, chambers, tunnel, caverns, maze, spiral, wreck decks, pillars, islands, boss arena)
- 17 enemy types + 6 bosses (Leviathan, Crab King, Puffer Overlord, Hydra, Mecha Shark, Kraken)
- Chapter 2 mechanics: switch gates, portals, whirlpools, crushers, acid, escape chases, rescue missions, harpoon gun
- Keys & locked gates, cracked walls with secret chests, currents, geysers, darkness, oxygen
- 3 stars per level (finish · all treasure · no damage), saved progress, chiptune music
- Every level is validated by a flood‑fill solver (`tools/validate-levels.mjs`): all gems, keys, chests and the exit are reachable
- PWA: installable, works offline

## iOS app

The same game is packaged as an iOS/iPadOS app with [Capacitor](https://capacitorjs.com) (`ios/`, `capacitor.config.json`).
`npm run ios:sync` copies the game into the Xcode project; the **iOS build → TestFlight** GitHub Actions workflow builds and uploads it (no Mac needed).
Setup steps (Apple / Firebase / GitHub secrets) are in [`appstore/KURULUM.md`](appstore/KURULUM.md), store texts in [`appstore/LISTING.md`](appstore/LISTING.md).

Privacy: [privacy.html](https://abyss-diver.rahimov.tr/privacy.html) · Terms: [terms.html](https://abyss-diver.rahimov.tr/terms.html) · Support: [support.html](https://abyss-diver.rahimov.tr/support.html)
