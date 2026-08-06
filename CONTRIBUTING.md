# Contributing to Match-3D.js

Thank you for wanting to contribute! 🎮

## How to contribute

### 1. Issues

- Before opening an issue, search for an existing similar one.
- Use the templates: **Bug report** (with reproduction steps, environment and
  screenshot if possible) or **Feature request** (describe the problem it
  solves and the proposed solution).
- Security issues: **DO NOT** open publicly — use the
  [Security Advisories](https://github.com/fecolinhares/match-3djs/security/advisories/new).
  See [SECURITY.md](SECURITY.md).

### 2. Pull Requests

Standard GitHub flow:

1. **Fork** the repository (if you don't have direct push permission).
2. Create a branch from the latest `main`:
   ```bash
   git fetch origin
   git checkout -b feat/my-change origin/main
   ```
3. Make **atomic** commits — one commit per logical change, with a clear
   message (e.g. `feat:`, `fix:`, `refactor:`, `docs:`).
4. Run local checks before opening the PR:
   ```bash
   npm ci
   npm run build
   ```
5. Open the PR against `main`. The branch is protected:
   - **1 approving review** required
   - **Status checks** required (`Build & Deploy to GitHub Pages`)
   - **Linear history** (no merge commits — use squash or rebase)
   - **Force push blocked** on `main`

### 3. Project standards

- **No secrets** — never commit `.env`, tokens or local paths from your
  machine (`/home/...`, `/tmp/...`, etc.). Environment variables in code
  must use `process.env.X` with a fallback.
- **Pure logic** in `src/game/` — no Three.js/DOM (testable in Node).
- **Design system** — follow `DESIGN.md` (colors, motion, anti-patterns).
- **Reduced motion** — any new animation must respect
  `prefers-reduced-motion`.
- Code/comment language: PT-BR or EN — consistent within the file.

### 4. Structure

```
src/
├── main.js          — bootstrap + game loop
├── config.js        — constants (board, gems, render, input, audio)
├── game/            — pure logic (Board, Gem, FallingColumn, MatchDetector, GameState)
├── render/          — Three.js (SceneManager, Materials, Particles, GemMesh, BoardMesh, PostFX)
├── input/           — InputManager (keyboard + mouse + touch)
├── ui/              — HUD + Menu (glass DOM overlay)
└── audio/           — AudioManager (WebAudio SFX)
```

## Questions

Open an issue with the `question` tag or comment on the PR. Thanks! 🙏
