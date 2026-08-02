# Contributing to Match-3D.js

Obrigado por querer contribuir! 🎮

## Como contribuir

### 1. Issues

- Antes de abrir uma issue, procure se já existe uma similar.
- Use os templates: **Bug report** (com passos de reprodução, ambiente e
  screenshot se possível) ou **Feature request** (descreva o problema que
  resolve e a solução proposta).
- Issues de segurança: **NÃO** abra publicamente — use o
  [Security Advisories](https://github.com/fecolinhares/match-3djs/security/advisories/new).
  Veja [SECURITY.md](SECURITY.md).

### 2. Pull Requests

O fluxo é o padrão GitHub:

1. **Fork** o repositório (se você não tem permissão de push direto).
2. Crie uma branch a partir da `main` mais recente:
   ```bash
   git fetch origin
   git checkout -b feat/minha-mudanca origin/main
   ```
3. Faça commits **atômicos** — um commit por mudança lógica, com mensagem
   clara (ex: `feat:`, `fix:`, `refactor:`, `docs:`).
4. Rode os checks locais antes de abrir o PR:
   ```bash
   npm ci
   npm run build
   ```
5. Abra o PR contra `main`. A branch é protegida:
   - **1 review de aprovação** obrigatório
   - **Status checks** obrigatórios (`Build & Deploy to GitHub Pages`)
   - **Linear history** (sem merge commits — use squash ou rebase)
   - **Force push bloqueado** na `main`

### 3. Padrões do projeto

- **Sem secrets** — nunca commite `.env`, tokens ou paths locais da sua
  máquina (`/home/...`, `/tmp/...`, etc.). Variáveis de ambiente no código
  devem usar `process.env.X` com fallback.
- **Lógica pura** em `src/game/` — sem Three.js/DOM (testável em Node).
- **Design system** — siga `DESIGN.md` (cores, motion, anti-patterns).
- **Reduced motion** — qualquer animação nova deve respeitar
  `prefers-reduced-motion`.
- Idioma dos comentários/código: PT-BR ou EN — consistente no arquivo.

### 4. Estrutura

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

## Dúvidas

Abra uma issue com a tag `question` ou comente no PR. Obrigado! 🙏
