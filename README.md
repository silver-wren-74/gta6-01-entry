# Neon Tide

[![make.fun bounty](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/silver-wren-74/gta6-01-entry/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/silver-wren-74/gta6-01-entry/reward.svg)](https://make.fun/bounty/gta6-01)

An entry for the make.fun bounty [gta6-01](https://make.fun/bounty/gta6-01).

**Neon Tide** is an original open-world crime game that runs in a desktop
browser from static files — no build step, no network. You are Dario "Dax"
Sol, a boat mechanic in the sun-soaked port city of **Port Solana**, who
starts running parcels for the fixer Vera Calloway and ends up running the
city's dirtiest secret out with the tide.

## What's in the city

- A full top-down open world: six avenues and four streets of blocks, pastel
  rooftops and named shops, parks, a parking lot, a beach promenade with
  palms, and marina docks reaching into the bay — plus the boat *Tide Runner*
  moored at Pier 9.
- Traffic that drives the grid, turns at crossings, queues and honks;
  pedestrians who stroll the sidewalks and run screaming from trouble.
- Cars to steal and drive — sedans, cabs, a Comet GT, vans, pickups — with
  arcade physics, drifting handbrake turns, skid marks, damage and fires.
- A five-star wanted system: crimes feed the heat, the Port Solana PD answer
  with Interceptors and officers on foot, hiding bleeds the heat away, and
  getting caught means BUSTED; getting flattened means WASTED.
- A five-mission story (parcel runs, a stolen Comet, collections, a bank
  ledger, and the final tide run), plus endless timed courier work for the
  Solana Sprint depot.
- Combat with a pistol, cash drops, a HUD with a live minimap (police blips
  included), a title screen, pause, and a localStorage save with Continue.
- Fully procedural WebAudio sound: engine, sirens, shots, crashes, jingles,
  and a slow marimba loop over the city. No audio files.

## Controls

- **WASD / arrows** — walk and drive · **Shift** — sprint
- **E** — enter / leave a car · **Space** — handbrake
- **Mouse** — aim · **Click / hold** — shoot · **P** — pause · **M** — mute

## Run it

```sh
node serve.ts          # serves game/ at http://localhost:8080
# or hand it in:
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## Layout

- `main.ts` — the hand-in program: copies `game/` and `screenshots/` to the
  output and writes `dossier.json` with the vendored library.
- `game/index.html` — the page. `game/src/` — the game, one job per file:
  `config` (tuning), `random` (seeded RNG), `city` (Port Solana itself),
  `vehicles` (cars, physics, traffic), `pedestrians`, `police` (wanted heat
  and pursuit), `combat` (bullets, damage, pickups), `missions` (the story
  and courier work), `save`, `audio` (synthesised sound), `input`,
  `render` (the world), `hud` (HUD, minimap, screens), `shots` (the
  screenshot scenes) and `main` (boot and the loop).
- `screenshots/` — four real renders of the game running, staged through
  `game/src/shots.js` via `?shot=` scenes listed in `shots.json`.
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged.
