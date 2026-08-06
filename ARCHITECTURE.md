# Match-3D.js — Architecture

> COLUMNS-inspired match-3 puzzle, AAA graphics, Three.js, playable with mouse + keyboard.

## Overview

```
index.html → src/main.js (game loop)
             ├── src/config.js          — global constants
             ├── src/game/              — PURE LOGIC (no Three.js)
             │   ├── Board.js           — grid + gravity + matches
             │   ├── Gem.js             — state of one piece (color, position)
             │   ├── FallingColumn.js   — falling column of 3
             │   ├── MatchDetector.js   — detects 3+ in row/col/diag
             │   └── GameState.js       — state machine (menu/playing/paused/over)
             ├── src/render/            — 3D RENDER (Three.js)
             │   ├── SceneManager.js    — scene, camera, lights, loop
             │   ├── Materials.js       — PBR materials for gems
             │   ├── Particles.js       — explosions, sparkles, dust
             │   ├── GemMesh.js         — visual mesh of a gem
             │   ├── BoardMesh.js       — board mesh + highlights
             │   └── PostFX.js          — bloom, vignette, tone mapping
             ├── src/input/             — INPUT
             │   └── InputManager.js    — unified keyboard + mouse
             ├── src/ui/                — HUD (DOM overlay)
             │   ├── HUD.js             — score, level, next preview
             │   ├── Menu.js            — main menu + game over
             │   └── TouchControls.js   — mobile touch buttons
             └── src/audio/             — SOUND (WebAudio)
                 ├── AudioManager.js    — lazy context + master chain (volume→compressor)
                 ├── sfx.js             — pure SFX synthesis (offline-testable)
                 └── music.js           — MusicEngine: procedural lo-fi soundtrack (playlist)
```

## Module contracts (IMPORTANT — subagents must respect these)

### game/ (pure logic, no Three.js)
- `Board` exposes: `cols`, `rows`, `grid[y][x] = gemColor|null`, `spawnColumn()`, `moveColumn(dx)`, `rotateColumn()`, `dropColumn()`, `tickGravity()`, `findMatches()`, `clearMatches()`, `applyGravity()`, `isGameOver()`, `getStateSnapshot()`
- Grid: **x = column (0-7), y = row (0-11)**, y=0 is the top
- Falling column: `falling = { x, gems: [colorA, colorB, colorC], y }` — y is the bottom gem position
- Colors: integers 0-6 (see config.js `GEM_COLORS`)
- Match: 3+ of the same color in a straight line (horizontal, vertical, diagonal \ and /)
- Events via callback: `onScore(points)`, `onCombo(n)`, `onLevelUp(n)`, `onGameOver()`

### render/
- `SceneManager.init(container)` → returns `{ scene, camera, renderer }`
- `Materials.createGemMaterial(colorIndex)` → THREE.MeshPhysicalMaterial
- `GemMesh.create(colorIndex, position)` → Group with mesh + glow
- `Particles.explode(position, colorIndex, count)` — gem particles
- `Particles.sparkle(position, color)` — point sparkle
- `BoardMesh` syncs with `Board.getStateSnapshot()` — 3D positions per gem
- `BoardMesh` builds a `_tiltGroup` (parent of frame, gems, falling, ghost,
  beam, highlight) with `rotation.x = BOARD_TILT` — pinball perspective without
  misaligning content; `TILT_LIFT` compensates framing on desktop
- `main.js` — `flashCount`/`matchResolving` counters coordinate simultaneous/
  cascade match flashes; render sync only runs with `!matchResolving`
  (syncing during the flash would kill the explosion and freeze gravity —
  gems "in the air")
- `PostFX` applies selective bloom + vignette

### input/
- `InputManager` emits events: `moveLeft`, `moveRight`, `rotate`, `softDrop`, `hardDrop`, `pause`
- **Mode isolation (required)**: the mode is resolved ONCE (`touch` if
  `pointer:coarse` or `maxTouchPoints>0`, otherwise `keyboard`) and passed to
  BOTH InputManager and TouchControls — the two are never active together:
  - `keyboard` (desktop): keydown registered; touch pointer ignored
  - `touch` (mobile): keydown is NOT even registered (external physical
    keyboard doesn't control); pointer listeners are NOT registered — taps/
    swipes on the board are ignored; TouchControls buttons are the only
    controls
- Keyboard: ←/→ move, ↑ rotate, ↓ soft drop, Space hard drop, P pause
- Mouse: click a column to move there, click the board = rotate in the column, hover shows preview

### ui/
- `HUD.update(score, level, lines, combo)` — DOM
- `HUD.setNextPreview(colors[3])` — mini column preview
- `Menu.show('menu'|'gameover', { score, best })` — glass overlay
- `TouchControls` (mobile): buttons ◀ ▶ ⟳ ▼ ⤓ (LEFT/RIGHT/ROTATE/DOWN/DROP)
  color-coded, visible ONLY in touch mode; on desktop they are not even created
- **Gems are real faceted jewels** (GemMesh): each color has a cut silhouette
  (crown + girdle + pavilion) via mergeGeometries:
  hexagon (ruby) / square (sapphire) / emerald (emerald) / pear (topaz) /
  brilliant (amethyst) / sphere (amber); `toNonIndexed()` ensures
  tintFacets (per-facet colors) works

### audio/
- `AudioManager.play(name, { pitch, combo })` — names: `move`, `rotate`,
  `softdrop`, `land`, `match`, `combo`, `levelup`, `gameover`, `select`
- `sfx.js` (`renderSfx(ctx, out, name, opts)`) — PURE synthesis recipes;
  work with any `BaseAudioContext`, including `OfflineAudioContext`
  (QA rendering produces the exact WAVs of the game). Theme: crystal gems
  (chimes with 1x-4x harmonics + shimmer), stone board (lowpass noise
  thumps with sweep), cartoon UI (short blips), combos/level-up (ascending
  arpeggios), game over (descending phrase).
- `music.js` (`MusicEngine`) — procedural lo-fi soundtrack: playlist of 6
  tracks (chord progression, bpm, groove and timbre per track), lookahead
  scheduler (setInterval + `ctx.currentTime`), drums + bass + pads with LFO
  (wobble) + crystal chimes + vinyl crackle. `start()` shuffles the playlist
  (the last played goes to the end — each game start opens with a DIFFERENT
  track); when each track ends (`_finishTrack` → 650ms timeout), the next
  plays in sequence; at the end of the playlist, re-shuffle.
  `pause()`/`resume()` suspends/resumes the AudioContext; `stop()` sets
  `_stopping` (prevents re-start via the timeout). `renderOffline(ctx, out,
  trackName, seed, cycles)` renders the whole track in an
  OfflineAudioContext (the SAME code as the game) — QA. Integration:
  `startGame()` → `audio.startMusic()`; `onGameOver` → `audio.stopMusic()`;
  pause → `pauseMusic()`.

### Match flash (race conditions — DOCUMENTED)
- `flashCount`/`matchResolving` (main.js) protect the sync: during a flash
  the render does NOT sync (the sync would remove the flashing gems → orphan
  `flashComplete` → freeze). `_removeGem` completes pending flashes
  (defensive).
- **Callback chaining (BoardMesh.flashMatch)**: if a gem is ALREADY flashing
  when a 2nd match (cascade) hits it, `setFlash` used to overwrite the 1st
  match's `flashComplete` → its remaining never zeroed → `flashCount` froze →
  gems frozen in the air (REAL bug: 2-match combo with shared gems). Now the
  callbacks are CHAINED: the complete flash calls both the 1st and 2nd
  callback.
- `_removeGem` with anti-duplication guard (`!u.vanishing`) — the chained
  callback calls `_removeGem` 2x for the same gem.
- Master chain with `DynamicsCompressor` (threshold -14, ratio 5) — peaks of
  multiple arpeggios/chimes don't clip. Master volume in `AUDIO.MASTER_VOLUME`.

## Game flow (COLUMNS)

1. `GameState` starts in `menu`
2. Start → `playing`, `Board.spawnColumn()` creates a 3-gem column at the top
3. Each tick: column drops 1 cell (speed increases with level)
4. Input: move/rotate while falling
5. Land (column reaches bottom/stacks) → `findMatches()`
6. If match: `clearMatches()` → `applyGravity()` → re-check (cascade) → combo++
7. No match: `spawnColumn()` new
8. Game over: grid full with no room for a new column

## AAA Standard

- Everything with exponential easing (nothing linear)
- Gems with MeshPhysicalMaterial: transmission, iridescence, emissive glow
- Selective bloom: gems + particles glow, DOM HUD doesn't
- Subtle screen shake on combos, explosive particles
- `prefers-reduced-motion` respected
- FPS: WebGL2, antialias, pixelRatio ≤ 2
