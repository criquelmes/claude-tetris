# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Vanilla-JS Tetris: three files (`index.html`, `style.css`, `game.js`), no dependencies, no `package.json`, no build step, no test suite, no linter. Do not introduce tooling or a framework unless asked.

## Running

```bash
open index.html            # macOS — works directly, no server needed
python3 -m http.server 8000   # or any static server, then http://localhost:8000
```

Verification is manual in a browser: reload the page and play. There are no automated tests to run.

## Architecture

`game.js` is a single classic script (not a module) built on module-level mutable globals — `board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropInterval`, `dropAccum`, `animId` — declared in one `let` at the top and reset wholesale by `init()`, which also runs at load time. New state belongs in that same declaration *and* in `init()`, or restarting will leak the previous game.

**Type index is the single identity for a piece.** `PIECES[t]` shapes are filled with the literal value `t`, `COLORS[t]` is that piece's color, and a locked cell on the board stores `t` (0 = empty). So `PIECES`, `COLORS`, and board cell values are index-aligned by construction — adding or reordering a piece means touching all three plus the `Math.floor(Math.random() * 7) + 1` bound in `randomPiece()`.

**Collision is the only geometry primitive.** `collide(shape, x, y)` tests a candidate placement; every move, rotation, drop, ghost projection, and the game-over check is expressed as a trial call to it. Add new movement by proposing coordinates and asking `collide`, never by hand-rolling bounds checks. Note it tolerates `ny < 0` (piece partly above the board) but rejects `nx` out of range and `ny >= ROWS`.

**Rendering is full-redraw, immediate mode.** `draw()` clears and repaints grid → locked board → ghost → current piece each frame; nothing is cached or dirty-tracked. `drawBlock` is shared by the board and the NEXT preview, parameterized by cell size and alpha.

**Loop and pause.** `loop()` accumulates `dt` into `dropAccum` and drops one row per `dropInterval`. `togglePause()` and `endGame()` both `cancelAnimationFrame(animId)`; resuming *must* reset `lastTime = performance.now()` first, otherwise the first `dt` after the pause is the entire paused duration and the piece teleports down. Same reasoning applies to any new state that suspends the loop.

Speed/level is derived, not stored progressively: `clearLines()` recomputes `level = floor(lines / 10) + 1` and `dropInterval = max(100, 1000 - (level - 1) * 90)` from the line total.

## Constraints when changing things

- Canvas sizes are hardcoded in `index.html` and must equal the JS constants: `#board` is `COLS * BLOCK` × `ROWS * BLOCK` (300×600), and `#next-canvas` is a 4×4 grid at the `NB = 30` used in `drawNext()` (120×120). Changing `COLS`, `ROWS`, `BLOCK`, or `NB` without updating the markup silently clips or letterboxes the render.
- `game.js` reads all its DOM nodes by id at the top level and runs `init()` immediately, so the `<script>` tag must stay at the end of `<body>` and element ids must not be renamed on one side only.
- Pieces lock instantly on contact (`softDrop`/`hardDrop`/the loop all call `lockPiece()`); there is no lock delay or hold queue. Rotation is a naive CW transpose with ±1/±2 column kicks, not SRS.
- User-facing strings (overlay text, README) are in Spanish; keep new UI text in Spanish. Code identifiers and comments are English.
