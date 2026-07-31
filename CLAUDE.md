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
- **Canvas + HUD markup** — a single `<canvas id="c">` (640×720) plus overlay `<div>`s for score/lives (`#hud`) and the game-over message (`#msg`), positioned absolutely over the canvas.
- **Game script** — a single `<script>` block with no modules/classes, structured as:
  - **Input**: a `keys{}` map updated by `keydown`/`keyup` listeners.
  - **`init()`**: (re)builds all mutable state — `state`, `player`, `aliens`, `bullets`, `aBullets`, `particles` — into module-level `let` variables. Called on load and on restart (`R` after game over).
  - **`update()`**: single tick of game logic — player movement/shooting, alien grid movement (edge detection flips `state.dir` and increases `state.speed`, then drops the grid down), alien random shooting, bullet-vs-alien and bullet-vs-player collision (AABB checks), particle physics, win condition (all aliens dead → `init()`), and HUD text sync.
  - **`draw()`**: clears and redraws the canvas each frame — background dots, aliens (per-row color from `ROW_COLORS`), bullets/player as glowing shapes (`glowRect` helper sets `shadowBlur` before fill), and particles.
  - **`loop()`**: `requestAnimationFrame` loop calling `update()` then `draw()`.

Key invariants to preserve when editing:
- Aliens are a flat array of `{x, y, w, h, alive, row}` objects (5 rows × 11 cols), not a 2D grid — always filter by `.alive` rather than removing entries.
- Row index (`a.row`) drives both scoring weight (`(ROWS - a.row) * 10`) and glow color (`ROW_COLORS[a.row]`), so keep these in sync if row count/order changes.
- `state.speed` and `state.dir` are shared/mutated across the whole alien group each edge-bounce, not per-alien.
- Game-over/restart is handled by toggling `state.over` and showing/hiding `#msg` — `update()` short-circuits entirely while `state.over` is true.
