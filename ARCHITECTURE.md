# Match-3D.js — Arquitetura

> Puzzle match-3 inspirado em COLUMNS, gráficos AAA, Three.js, jogável com mouse + teclado.

## Visão geral

```
index.html → src/main.js (game loop) 
             ├── src/config.js          — constantes globais
             ├── src/game/              — LÓGICA PURA (sem Three.js)
             │   ├── Board.js           — grid + gravidade + matches
             │   ├── Gem.js             — estado de uma peça (cor, posição)
             │   ├── FallingColumn.js   — coluna de 3 caindo
             │   ├── MatchDetector.js   — detecção 3+ em linha/col/diag
             │   └── GameState.js       — state machine (menu/playing/paused/over)
             ├── src/render/            — RENDER 3D (Three.js)
             │   ├── SceneManager.js    — cena, câmera, luzes, loop
             │   ├── Materials.js       — materiais PBR das gems
             │   ├── Particles.js       — explosões, sparkles, poeira
             │   ├── GemMesh.js         — mesh visual de uma gem
             │   ├── BoardMesh.js       — malha do tabuleiro + highlights
             │   └── PostFX.js          — bloom, vignette, tone mapping
             ├── src/input/             — ENTRADA
             │   └── InputManager.js    — teclado + mouse unificados
             ├── src/ui/                — HUD (DOM overlay)
             │   ├── HUD.js             — score, level, next preview
             │   └── Menu.js            — menu principal + game over
             └── src/audio/             — SOM (WebAudio)
                 ├── AudioManager.js    — contexto lazy + master chain (volume→compressor)
                 ├── sfx.js             — síntese pura por SFX (testável offline)
                 └── music.js           — MusicEngine: trilha lo-fi procedural (playlist)
```

## Contratos entre módulos (IMPORTANTE — subagentes respeitam estes)

### game/ (lógica pura, sem Three.js)
- `Board` expõe: `cols`, `rows`, `grid[y][x] = gemColor|null`, `spawnColumn()`, `moveColumn(dx)`, `rotateColumn()`, `dropColumn()`, `tickGravity()`, `findMatches()`, `clearMatches()`, `applyGravity()`, `isGameOver()`, `getStateSnapshot()`
- Grid: **x = coluna (0-7), y = linha (0-11)**, y=0 é o topo
- Coluna caindo: `falling = { x, gems: [colorA, colorB, colorC], y }` — y é a posição da gem inferior
- Cores: inteiros 0-6 (ver config.js `GEM_COLORS`)
- Match: 3+ da mesma cor em linha reta (horizontal, vertical, diagonal \ e /)
- Eventos via callback: `onScore(points)`, `onCombo(n)`, `onLevelUp(n)`, `onGameOver()`

### render/
- `SceneManager.init(container)` → retorna `{ scene, camera, renderer }`
- `Materials.createGemMaterial(colorIndex)` → THREE.MeshPhysicalMaterial
- `GemMesh.create(colorIndex, position)` → Group com mesh + glow
- `Particles.explode(position, colorIndex, count)` — partículas de gem
- `Particles.sparkle(position, color)` — brilho pontual
- `BoardMesh` sincroniza com `Board.getStateSnapshot()` — posições 3D por gem
- `BoardMesh` monta um `_tiltGroup` (pai de moldura, gems, falling, ghost,
  beam, highlight) com `rotation.x = BOARD_TILT` — perspectiva pinball sem
  desalinhar conteúdo; `TILT_LIFT` compensa o enquadramento no desktop
- `main.js` — contador `flashCount`/`matchResolving` coordena flashes de
  matchs simultâneos/cascatas; o sync do render só roda com
  `!matchResolving` (sincronizar durante o flash mataria a explosão e
  travaria a gravidade — gems "no ar")
- `PostFX` aplica bloom seletivo + vignette

### input/
- `InputManager` emite eventos: `moveLeft`, `moveRight`, `rotate`, `softDrop`, `hardDrop`, `pause`
- **Isolamento de modo (obrigatório)**: o modo é resolvido UMA vez
  (`touch` se `pointer:coarse` ou `maxTouchPoints>0`, senão `keyboard`)
  e passado para InputManager E TouchControls — os dois nunca ficam
  ativos juntos:
  - `keyboard` (desktop): keydown registrado; touch pointer ignorado
  - `touch` (mobile): keydown NEM é registrado (teclado físico externo
    não controla); os listeners de pointer NÃO são registrados — taps/
    swipes no board são ignorados; botões do TouchControls são os únicos
    controles
- Teclado: ←/→ move, ↑ rotaciona, ↓ soft drop, Espaço hard drop, P pause
- Mouse: clique na coluna move pra lá, clique no tabuleiro = rotacionar na coluna, hover mostra preview

### ui/
- `HUD.update(score, level, lines, combo)` — DOM
- `HUD.setNextPreview(colors[3])` — mini coluna preview
- `Menu.show('menu'|'gameover', { score, best })` — overlay glass
- `TouchControls` (mobile): botões ◀ ▶ ⟳ ▼ ⤓ (ESQ/DIR/GIRAR/ABAIXA/SOLTA)
  color-coded, visíveis SÓ em modo touch; em desktop não são nem criados
- **Gems são jóias facetadas reais** (GemMesh): cada cor tem silhueta de
  corte (crown + girdle + pavilion) via mergeGeometries:
  hexagon (rubi) / square (safira) / emerald (esmeralda) / pear (topázio) /
  brilliant (amatista) / sphere (âmbar); `toNonIndexed()` garante que o
  tintFacets (cores por faceta) funcione

### audio/
- `AudioManager.play(name, { pitch, combo })` — nomes: `move`, `rotate`,
  `softdrop`, `land`, `match`, `combo`, `levelup`, `gameover`, `select`
- `sfx.js` (`renderSfx(ctx, out, name, opts)`) — receitas de síntese PURAS;
  funcionam com qualquer `BaseAudioContext`, inclusive `OfflineAudioContext`
  (renderização de QA gera os WAVs exatos do jogo). Temática: gems de
  cristal (chimes com harmônicos 1x-4x + shimmer), board de pedra (thumps
  de ruído lowpass com sweep), UI cartoon (blips curtos), combos/levelup
  (arpejos ascendentes), gameover (frase descendente).
- `music.js` (`MusicEngine`) — trilha lo-fi procedural: playlist de 6
  faixas (progressão de acordes, bpm, groove e timbre por faixa),
  scheduler com lookahead (setInterval + `ctx.currentTime`), bateria +
  bass + pads com LFO (wobble) + chimes de cristal + vinil crackle.
  `start()` embaralha a playlist (a última tocada vai para o fim — cada
  início de jogo abre com faixa DIFERENTE); ao acabar cada faixa
  (`_finishTrack` → timeout 650ms), a próxima entra em sequência; no fim
  da playlist, re-shuffle. `pause()`/`resume()` suspende/retoma o
  AudioContext; `stop()` seta `_stopping` (impede re-início pelo
  timeout). `renderOffline(ctx, out, trackName, seed, cycles)` renderiza
  a faixa inteira em OfflineAudioContext (o MESMO código do jogo) — QA.
  Integração: `startGame()` → `audio.startMusic()`; `onGameOver` →
  `audio.stopMusic()`; pause → `pauseMusic()`.

### Flash de match (race conditions — DOCUMENTADO)
- `flashCount`/`matchResolving` (main.js) protegem o sync: durante um
  flash o render NÃO sincroniza (o sync removeria as gems flashando →
  `flashComplete` órfão → travamento). `_removeGem` completa flashes
  pendentes (defensivo).
- **Encadeamento de callbacks (BoardMesh.flashMatch)**: se uma gem JÁ
  está flashando quando um 2º match (cascata) a atinge, o `setFlash`
  sobrescrevia o `flashComplete` do 1º match → remaining dele nunca
  zerava → `flashCount` travava → gems congeladas no ar (bug REAL:
  combo de 2 combinações com gems compartilhadas). Agora os callbacks
  são ENCADEADOS: o flash completo chama o 1º e o 2º callback.
- `_removeGem` com guard anti-duplicação (`!u.vanishing`) — o callback
  encadeado chama `_removeGem` 2x para a mesma gem.
- Master chain com `DynamicsCompressor` (threshold -14, ratio 5) — picos de
  arpejos/chimes múltiplos não clipam. Volume mestre em `AUDIO.MASTER_VOLUME`.

## Fluxo do jogo (COLUMNS)

1. `GameState` inicia em `menu`
2. Start → `playing`, `Board.spawnColumn()` cria coluna de 3 no topo
3. A cada tick: coluna desce 1 célula (velocidade aumenta com nível)
4. Input: mover/rotacionar enquanto cai
5. Land (coluna chega ao fundo/empilha) → `findMatches()`
6. Se match: `clearMatches()` → `applyGravity()` → re-check (cascata) → combo++
7. Sem match: `spawnColumn()` nova
8. Game over: grid cheio sem espaço pra nova coluna

## Padrão AAA

- Tudo com easing exponencial (nada linear)
- Gems com MeshPhysicalMaterial: transmission, iridescence, emissive glow
- Bloom seletivo: gems + partículas brilham, HUD DOM não
- Screen shake sutil em combos, partículas explosivas
- `prefers-reduced-motion` respeitado
- FPS: WebGL2, antialias, pixelRatio ≤ 2
