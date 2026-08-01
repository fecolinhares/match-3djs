# Match-3D.js

> Um puzzle match-3 inspirado no clássico **COLUMNS** da Sega, elevado ao padrão
> visual dos jogos atuais — gráficos **AAA** com Three.js, jogável com **mouse ou
> teclado**.

![Gameplay](docs/screenshot.png)

## 🎮 Como Jogar

O objetivo é alinhar **3 ou mais gems da mesma cor** — na horizontal, vertical
ou **diagonal** — para destruí-las e marcar pontos. Uma coluna de 3 gems cai do
topo; mova-a, rotacione as gems, e solte para alinhar e combinar.

| Ação | Teclado | Mouse |
|------|---------|-------|
| Mover coluna | `←` / `→` ou `A` / `D` | Clique na coluna |
| Rotacionar gems | `↑` ou `W` | Clique no tabuleiro |
| Queda rápida | `↓` ou `S` | — |
| Queda instantânea | `Espaço` | — |
| Pausar | `P` ou `Esc` | — |
| Reiniciar | `R` | Botão Play Again |

## ✨ Features

- **Gems com aparência de pedras preciosas** — MeshPhysicalMaterial com
  refração, iridescência e glow interno (nada de cubos de plástico)
- **Iluminação cinematográfica** — key warm, fill azulado, rim violeta
- **Bloom seletivo** — gems brilham, HUD não
- **Partículas explosivas** — fragmentos, sparkles, ring shockwave
- **Screen shake** sutil em combos grandes
- **Cascatas + combos** — multiplicadores de pontuação
- **Wild Star** — gem especial rara com bônus
- **HUD glass** — score animado, preview da próxima coluna, nível
- **Audio sintetizado** — WebAudio, zero arquivos externos
- **Reduced motion** respeitado (`prefers-reduced-motion`)

## 🛠️ Tech

- [Three.js](https://threejs.org/) (WebGL2, EffectComposer + bloom)
- [Vite](https://vitejs.dev/) — build + dev server
- JavaScript puro (ES modules) — zero frameworks de UI

## 🚀 Rodando

```bash
npm install   # (veja nota abaixo sobre o symlink do node_modules)
npm run dev   # → http://localhost:3456
```

## 📁 Estrutura

```
src/
├── main.js          — bootstrap + game loop
├── config.js        — constantes (board, gems, render, input, audio)
├── game/            — lógica pura (Board, Gem, FallingColumn, MatchDetector, GameState)
├── render/          — Three.js (SceneManager, Materials, Particles, GemMesh, BoardMesh, PostFX)
├── input/           — InputManager (teclado + mouse + touch)
├── ui/              — HUD + Menu (DOM overlay glass)
└── audio/           — AudioManager (WebAudio SFX)
```

## 📐 Design System

Ver [DESIGN.md](DESIGN.md) — paleta de gems, tipografia, motion, iluminação e
anti-patterns. Arquitetura em [ARCHITECTURE.md](ARCHITECTURE.md).

## 📄 Licença

MIT — ver [LICENSE](LICENSE).
