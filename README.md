# Ring Runner Ridge

[![make.fun](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/c/best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/ariffforai/best-flight-game/rank.svg)](https://make.fun/c/best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/ariffforai/best-flight-game/reward.svg)](https://make.fun/c/best-flight-game-20261126-0057)

A complete, original flight game for the [make.fun best flight game bounty](https://make.fun/c/best-flight-game-20261126-0057). Fly a small red-and-white prop plane through glowing target rings over a mountain valley — the river winding below, the runway behind you, snow on the ridges.

## How to play

Serve `game/` with any static server and open `index.html` in a desktop browser. No build step, no network requests, no files beyond `game/`.

```sh
node serve.ts   # serves game/ at http://localhost:8080
```

- **Arrows / WASD** — pitch and roll
- **W / S** — throttle up and down
- **Space** — short boost (burns extra fuel)
- **Click** — switch between chase view and cockpit view
- **Enter** — start, or fly again after a crash

Each ring you thread scores **+100** (golden rings +150) and adds **8 seconds** to the clock. A near miss still pays +25. Fuel burns with the throttle and the clock always runs — a run ends on a terrain strike, an empty tank, or an empty clock. Or land it: touch down gently on the runway strip after leaving the airfield and the run ends with a **LANDED! +500** bonus. Fuel under 20% flashes a LOW FUEL warning on the HUD with an audio cue — bring her home before the tank runs dry.

## The game

- `game/src/config.js` — every tuning number in one place
- `game/src/random.js` — the seeded RNG the world layout is built from
- `game/src/terrain.js` — valley height, the winding river, the runway, the trees
- `game/src/world.js` — the flight model, rings, scoring, fuel, time and crashes
- `game/src/render.js` — sky, projected terrain, rings, the aircraft, the cockpit, the HUD
- `game/src/input.js` — keyboard and mouse into stick, throttle and boost
- `game/src/audio.js` — WebAudio beeps, synthesized, no sound files
- `game/src/shots.js` — the deterministic autopilot behind `?shot=cover|low|valley|end|landed`
- `game/src/main.js` — the game loop and the title / flying / game-over phases

The screenshots in `screenshots/` are real renders of this code in a headless browser: the cover is peak gameplay (chase view, a glowing ring dead ahead, HUD lit), then the cockpit over the runway, a ring fly-through high over the valley, and the LANDED screen — a runway landing after the rings, +500 on the score.

## Entry

`main.ts` (Node 22, standard library only) copies `game/` and `screenshots/` to `/output` and writes `/output/dossier.json` with the vendored `vendor/makefun-game.ts`. Outside the grader, `MAKEFUN_OUTPUT_DIR` stands in for `/output`:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

MIT licensed. An entry in the make.fun best flight game bounty.
