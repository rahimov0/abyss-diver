# Abyss Diver

A retro pixel deep‑sea arcade game inspired by the classic Sony Ericsson / mophun era game **Deep Abyss** (2002).
Original art, code and level design.

▶ **Play:** https://abyss-diver.rahimov.tr/

Pilot a little bathysphere through underwater caves, collect every gem to open the portal, find secret treasure,
manage your oxygen and survive 50 increasingly hard levels.

## Play
```bash
npm install
npm run dev        # local dev server
npm run build      # production build -> dist/
npm run validate   # generates all 50 levels and proves each one is solvable
```

## Controls
| | Keyboard | Touch |
|---|---|---|
| Swim | Arrows / WASD | Left half of the screen (floating stick) |
| Dash (ram enemies, break cracked rock) | Space / X | Right half of the screen |
| Pause | Esc / P | ⏸ button |

## Features
- 50 levels across 8 biomes: Coral Shallows, Kelp Forest, Sunken Wreck, Crystal Grotto, Frozen Trench, Volcanic Rift, Sunken Temple, Midnight Abyss
- 11 layout types (shaft, zigzag shelves, chambers, tunnel, caverns, maze, spiral, wreck decks, pillars, islands, boss arena)
- 12 enemy types + the Leviathan boss (level 50)
- Keys & locked gates, cracked walls with secret chests, currents, geysers, darkness, oxygen
- 3 stars per level (finish · all treasure · no damage), saved progress, chiptune music
- Every level is validated by a flood‑fill solver (`tools/validate-levels.mjs`): all gems, keys, chests and the exit are reachable
- PWA: installable, works offline
