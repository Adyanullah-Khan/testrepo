# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This repo is a single-file Space Invaders game: `index.html`. It's plain HTML/CSS/JS with no dependencies, no build step, and no package manager — the entire game (markup, styles, and logic) lives in that one file.

## Running

Open `index.html` directly in a browser, or serve it locally:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000/index.html`. There are no build, lint, or test commands — there is no toolchain in this repo.

## Architecture

Everything is in `index.html`, organized top to bottom as:

- **`<style>`** — dark/neon visual theme (glow via `box-shadow`/`text-shadow`, radial-gradient background).
- **Canvas + HUD markup** — a single `<canvas id="c">` (640×720) plus overlay `<div>`s for score/round/lives (`#hud`), the game-over message (`#msg`), and difficulty buttons (`#diff`), positioned absolutely over the canvas.
- **Game script** — a single `<script>` block with no modules/classes, structured as:
  - **Sound**: `beep(freq, dur, type, vol)` creates a lazily-initialized `AudioContext` (`ensureAudio()`) and fires one oscillator+gain envelope per call — no audio assets. The `sfx` object (`shoot`, `alienShoot`, `explosion`, `hit`, `round`, `gameOver`) wraps `beep()` with per-event tone presets; call these instead of touching `AudioContext` directly.
  - **Difficulty**: `DIFF` maps `'easy'|'normal'|'hard'` to multipliers (`speed`, `shoot`, `dive`, `stray`) applied throughout `update()`/`spawnAliens()`. The `#diff` buttons set the module-level `difficulty` var on click; it takes effect on the next `spawnAliens()`/frame, no game reset required.
  - **Input**: a `keys{}` map updated by `keydown`/`keyup` listeners.
  - **`init()`**: (re)builds all mutable state — `state`, `player`, `aliens`, `bullets`, `aBullets`, `particles` — into module-level `let` variables, then calls `spawnAliens()`. Called on load and on restart (`R` after game over).
  - **`spawnAliens()`**: (re)builds the alien formation for the current `state.round`/`difficulty` using the next entry in `PATTERNS` (indexed by `state.wave`, which increments on every call — see Formation patterns below), resets `bullets`/`aBullets`/`state.formX`/`state.formY`/`state.dir`/`state.speed`, and puts the game into a `state.phase = 'countdown'` pause (see Countdown below). Called by `init()` (new game), by `update()` when a wave is fully cleared, and when a round threshold is crossed — score and lives are preserved across all of these except a full `init()`.
  - **`update()`**: while `state.phase === 'countdown'`, only ticks `state.countdownTimer` down and returns early (everything else is frozen). Otherwise: player movement/shooting, formation movement (edge detection flips `state.dir`, bumps `state.speed`, and drops `state.formY`; see Alien types below for how each alien turns that shared formation offset into its own `x`/`y`), alien + stray random shooting, bullet-vs-alien / bullet-vs-player / alien-vs-player collision (AABB checks), round progression (see below), particle physics, and HUD text sync.
  - **`draw()`**: clears and redraws the canvas each frame — background dots, aliens and the ship as pixel-art sprites (`drawSprite()`, per-row color from `ROW_COLORS`, `drawAlien()` adds an orbit ring for circlers and extra glow for an actively-diving diver), bullets as pixel bolts (`drawBolt()`), and particles.
  - **`loop()`**: `requestAnimationFrame` loop calling `update()` then `draw()`.

## Rounds

Progression is score-driven via `ROUND_THRESHOLDS = [200, 400]` in `index.html`: reaching 200 points advances to round 2, 400 points to round 3. Crossing a threshold (checked each tick in `update()`) or clearing every alien in the current wave both call `spawnAliens()`, which rebuilds the grid and sets the round's base alien speed as `1 + (state.round - 1) * 0.5`, scaled by the current difficulty — score, lives, and round number carry over. Only a full `init()` (new game / restart) resets score and round to 1. To add more rounds, extend `ROUND_THRESHOLDS`.

## Alien types

Each alien gets a `type` from `typeForRow(row)`: row 0 → `'circler'`, row 1 → `'diver'`, rows 2–4 → `'grid'`. All three share one formation offset (`state.formX`/`state.formY`, advanced once per frame in `update()`) via each alien's fixed `baseX`/`baseY`, then layer their own motion on top to get the actual `x`/`y` used for drawing and collision:
- `'grid'` — no extra motion; `x/y = baseX/baseY + formX/formY`, i.e. the original side-to-side-and-drop behavior.
- `'circler'` — orbits its formation slot continuously via `angle` (cosine/sine offset); never dives.
- `'diver'` — idles at its formation slot until a randomized `diveTimer` elapses and a `DIFF[difficulty].dive`-scaled chance triggers, then sweeps down to `DIVE_DEPTH` (`H - 160`, short of the player) with a sine wiggle and back up (`diveState`: `'idle' → 'diving' → 'returning' → 'idle'`).

Aliens that reach the player (any type) cost a life and are destroyed on contact — formation aliens no longer end the game outright by reaching the bottom row; only `state.lives <= 0` calls `endGame()`. Stray purple bullets (`update()`, `Math.random() < 0.006 * DIFF[difficulty].stray`) spawn from a random x at the top of the screen independent of any alien, reusing the `aBullets` array/collision path via an optional per-bullet `color`.

## Pixel sprites & ship damage

`SPRITES` (per alien type) and `SHIP_SPRITE` are small bitmap strings (`'1'`/`'0'` rows) rendered cell-by-cell by `drawSprite(pattern, x, y, w, h, color, skip, glow)`, which maps the pattern onto the given box regardless of grid size — this is the single place sprite pixel size is computed (`w/cols`, `h/rows`).

The ship takes 3 hits (`state.lives` 3→0) before it's destroyed: `hitPlayer()` (called from both the alien-bullet and alien-contact collision checks in `update()`) decrements `state.lives` and calls `damageShip(lethal)`. On a non-lethal hit it randomly moves 6 pixel indices from `SHIP_PIXELS` (precomputed list of all filled cells in `SHIP_SPRITE`) into `player.missing` (a `Set`), which `drawSprite()` skips when rendering — so the ship visibly chips apart hit by hit. On the lethal 3rd hit, every pixel is added to `player.missing` (full wipeout) and a large particle burst fires before `endGame()`.

`spawnParticles(x, y, color, {count, grav, blood})` is the one particle source for both sparks (ship hits) and "blood" splatter (alien deaths, `blood: true` — wider spread, per-particle size, slight upward kick) and gravity-affected trails (`grav`, applied to `p.vy` each tick in `update()`).

## Formation patterns

`spawnAliens()` lays aliens out on the usual 5×11 (row, col) grid, but each cell is first run through `PATTERNS[state.wave % PATTERNS.length]`, which returns `{dx, dy, skip}` — a positional offset baked into that alien's `baseX`/`baseY`, or `skip: true` to omit the cell entirely (fewer aliens that wave, e.g. the diamond's corners). `state.wave` increments on every `spawnAliens()` call (new game, round advance, or wave-clear), so the shape changes each time a fresh formation spawns, independent of `state.round`. To add a shape, append another `(r, c) => ({dx, dy, skip})` function to `PATTERNS`.

## Countdown

Every `spawnAliens()` call sets `state.phase = 'countdown'` and `state.countdownTimer = COUNTDOWN_FRAMES` (240), and spawns each alien 220px above its `baseY`. While in that phase, `update()` eases every alien's `y` from that offset down to `baseY` over the first 40 frames (ease-out cubic — the "slide in" entrance) and otherwise just decrements the timer, returning early so player/bullet logic stays frozen, until the timer hits 0 and `state.phase` flips to `'playing'`. `draw()` renders the formation underneath a dimmed overlay with the current step from `COUNTDOWN_LABELS` (`'3'`, `'2'`, `'1'`, `'GO!'`, one per 60 frames) plus a `ROUND N` label that itself slides in from the left over the first 20 frames, so a new round/wave is always previewed before it goes live.

Key invariants to preserve when editing:
- Aliens are a flat array of `{baseX, baseY, x, y, w, h, alive, row, type, angle, diveState, diveTimer, diveProgress}` objects (5 rows × 11 cols minus any `PATTERNS` skips), not a 2D grid — always filter by `.alive` rather than removing entries, and mutate `x`/`y` (not `baseX`/`baseY`) for per-frame position.
- Row index (`a.row`) drives scoring weight (`(ROWS - a.row) * 10`), glow color (`ROW_COLORS[a.row]`), and type (`typeForRow`) — keep these in sync if row count/order changes.
- `state.formX`/`state.formY`/`state.dir`/`state.speed` are shared across the whole formation each edge-bounce, not per-alien, and are reset by `spawnAliens()` on every new wave/round.
- Game-over/restart is handled by toggling `state.over` and showing/hiding `#msg` — `update()` short-circuits entirely while `state.over` is true; `state.phase === 'countdown'` short-circuits gameplay (but not `over`) independently.
