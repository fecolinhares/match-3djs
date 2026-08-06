# Match-3D.js

> A match-3 puzzle inspired by the classic Sega **COLUMNS**, elevated to the
> visual standard of modern games — **AAA** graphics with Three.js, playable
> with **mouse or keyboard** (and touch on mobile).

<p align="center">
  <a href="https://fecolinhares.github.io/match-3djs/"><img src="https://img.shields.io/badge/play%20now-%2300D2FF?style=for-the-badge&logo=githubpages&logoColor=white" alt="Play now"></a>
  <a href="https://github.com/fecolinhares/match-3djs/actions"><img src="https://github.com/fecolinhares/match-3djs/actions/workflows/deploy-pages.yml/badge.svg" alt="CI"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/fecolinhares/match-3djs" alt="License"></a>
</p>

<p align="center">
  <img src="docs/screenshots/gameplay-desktop.png" alt="Desktop gameplay" width="640" />
  <img src="docs/screenshots/gameplay-mobile.png" alt="Mobile gameplay" width="200" />
</p>

## 🎮 Play online

**https://fecolinhares.github.io/match-3djs/** — or run it locally (see [Running](#-running)).

## 🎮 How to Play

The goal is to align **3 or more gems of the same color** — horizontally,
vertically or **diagonally** — to destroy them and score points. A column of 3
gems falls from the top; move it, rotate the gems, and drop it to align and match.

| Action | Keyboard | Mouse | Touch (mobile) |
|--------|----------|-------|----------------|
| Move column | `←` / `→` or `A` / `D` | Click the column | `◀ ESQ` / `▶ DIR` buttons (left/right) |
| Rotate gems | `↑` or `W` | Click the board | `⟳ GIRAR` button (rotate) |
| Soft drop | `↓` or `S` | — | `▼ ABAIXA` button (down) |
| Hard drop | `Space` | — | `⤓ SOLTA` button (drop) |
| Pause | `P` or `Esc` | — | — |
| Restart | `R` | Play Again button | — |

> **Input isolation**: on desktop, only keyboard + mouse work (the touch
> buttons don't even exist); on mobile, **only the touch buttons** control the
> game — clicks/taps/swipes on the board are ignored and the physical keyboard
> is disabled. The modes never mix.

## ✨ Features

- **6 jewels with unique silhouettes** — hexagonal ruby, square-cut sapphire,
  step-cut emerald, pear topaz, brilliant amethyst and faceted sphere, each
  color with its own shape (visual accessibility)
- **Colored rim + halo** — faithful reproduction of the
  [user reference](docs/reference/GEMS-REFERENCE.md): each jewel has a light
  ring in its outline color, colored glow and high-contrast facets
  (v3 — replaced the black cartoon outline)
- **Stone/brick background** — arcade cabinet wall drawn on canvas,
  desaturated dark bricks (grayish-brown) so the board and the gems stay the
  visual focus (v2: the old light tan/gold palette competed)
- **Discreet ghost preview** — real column shapes in dashed white wireframe
  BEHIND the falling gems (z -0.4), very subtle (body ~0.05-0.08, edges
  ~0.18-0.26), showing where the piece will land without competing with the
  active piece
- **Pinball perspective** — board tilted ~11.5° like a pinball machine (top
  recedes, base approaches): `_tiltGroup` rotates frame, gems, ghost and beam
  TOGETHER (alignment preserved) + `TILT_LIFT` compensates the framing; short
  screens (<820px tall) apply a slight zoom out so the frame doesn't clip at
  the edge
- **Cartoon lighting** — warm key + soft fill, facet shading (no refractive
  glass)
- **Selective bloom** — gems glow, HUD doesn't
- **Explosive particles** — fragments, sparkles, ring shockwave
- **Readable combo** — matched pieces glow bright (0.55s), explode and vanish
  — no screen shake (v3)
- **Cascades + combos** — score multipliers
- **Wild Star** — rare special gem with bonus
- **Compact arcade HUD** — Score/Next/Level together at the top, gold borders,
  hard cartoon shadows
- **Mobile layout with room for controls** — camera zoom out + taller board:
  touch buttons sit in a free bottom strip, without covering the board
  (gap ~85-90px)
- **Synthesized audio** — WebAudio, zero external files. Themed sound design:
  crystal gems (chimes with harmonics + shimmer), stone board (thumps),
  cartoon UI (blips); combos/level-up in ascending arpeggios, game over
  descending; master chain with compressor
- **Procedural lo-fi soundtrack** — 6-track playlist generated in real time
  (wobble pads, crystal chimes, bass, relaxed drums, vinyl crackle). Low
  volume (~7dB below SFX); each game start opens with a DIFFERENT random
  track; when it ends, the next one plays in sequence (re-shuffle at the end
  of the playlist)
- **Reduced motion** respected (`prefers-reduced-motion`)
- **Controls** — mouse, keyboard and touch (mobile-first)

## 🛠️ Tech

- [Three.js](https://threejs.org/) (WebGL2, EffectComposer + bloom)
- [Vite](https://vitejs.dev/) — build + dev server
- Pure JavaScript (ES modules) — zero UI frameworks

## 🚀 Running

```bash
npm install
npm run dev   # → http://localhost:3456
```

Production build:

```bash
npm run build      # outputs to dist/
npm run preview    # serves the build locally
```

## 🌐 Deploy (GitHub Pages)

The project is ready for GitHub Pages — the workflow
[`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml)
builds and deploys automatically on push to `main` (or manually via the
Actions tab).

**To activate:** make the repository public (or use a plan with private
Pages) → **Settings → Pages → Source: GitHub Actions**. The `vite.config.js`
already uses `base: './'`, so assets work on any subpath.

## 📁 Structure

```
src/
├── main.js          — bootstrap + game loop
├── config.js        — constants (board, gems, render, input, audio)
├── game/            — pure logic (Board, Gem, FallingColumn, MatchDetector, GameState)
├── render/          — Three.js (SceneManager, Materials, Particles, GemMesh, BoardMesh, PostFX)
├── input/           — InputManager (keyboard + mouse + touch)
├── ui/              — HUD + Menu (glass DOM overlay)
└── audio/           — AudioManager + sfx.js (WebAudio synthesis)
```

## 📐 Design System

See [DESIGN.md](DESIGN.md) — gem palette, typography, motion, lighting and
anti-patterns. Architecture in [ARCHITECTURE.md](ARCHITECTURE.md).

## 🤝 Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) and the
[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). Bugs and features: open an
[issue](https://github.com/fecolinhares/match-3djs/issues) with the template.

- 🔐 Vulnerabilities: report privately via
  [Security Advisories](https://github.com/fecolinhares/match-3djs/security/advisories/new)
  — see [SECURITY.md](SECURITY.md).

## 📄 License

MIT — see [LICENSE](LICENSE).
