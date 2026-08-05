---
name: Match-3D.js
version: "1.0"
description: >
  Design system para Match-3D.js — puzzle match-3 inspirado em COLUMNS com
  gráficos AAA em Three.js. Estética: gemstones premium, dark tech arcade,
  glass HUD, iluminação cinematográfica.
---

# Design System — Match-3D.js

## 1. Visão Geral

Um puzzle match-3 moderno inspirado no clássico COLUMNS da Sega (1990), elevado ao
padrão visual dos jogos atuais. A estética mistura **gemstones premium** (pedras
preciosas facetadas com materiais PBR), **dark tech arcade** (fundo escuro rico com
iluminação dramática) e **glass HUD** (painéis translúcidos com blur).

## 2. Atmosfera

- **Dark, luxuoso, imersivo** — fundo profundo com gradiente sutil e partículas
  flutuantes (poeira cósmica / sparkles)
- **Foco total no tabuleiro** — as gems são o herói visual, iluminação direcionada
- **Motion premium** — easing exponencial, animações com física (elastic leve),
  screen shake sutil em combos grandes, partículas explosivas
- **Referências**: Bejeweled 3 (polimento de gems), Puzzle Quest (profundidade),
  os jogos de match-3 da King (juiciness), Lumines (estética minimal premium)

## 3. Paleta

| Token | Hex | Uso |
|-------|-----|-----|
| `bg-deep` | `#0A0A12` | Fundo principal (quase preto, leve azul) |
| `bg-vignette` | radial rgba(0,0,0,0.6) | Vinheta nas bordas |
| `surface-glass` | rgba(255,255,255,0.04) | Painéis HUD |
| `surface-glass-border` | rgba(255,255,255,0.10) | Bordas de painéis |
| `accent-cyan` | `#00D2FF` | Cor primária de destaque (UI) |
| `accent-violet` | `#7B2FFF` | Gradiente secundário |

### Cores das Gems (6 cores + especial)

Cada gem tem: **cor base**, **cor de emissão** (glow), **cor de brilho** (specular)
e **rim** (anel colorido do contorno — v3, referência do usuário em
`docs/reference/gems-reference.jpg`).

| Gem | Cor Base | Emissão | Rim | Significado |
|-----|----------|---------|-----|-------------|
| Fire Ruby | `#F02E4E` | `#FF6A80` | `#FF4D6D` | Rubi hexagonal (ref top-left) |
| Solar Topaz | `#FF9F1C` | `#FFC24D` | `#FFC24D` | Pêra triangular apex-top (ref middle-right) |
| Emerald | `#1FCB6E` | `#5BEA9D` | `#3EE88A` | Esmeralda step-cut (ref middle-left) |
| Aquamarine | `#00B7E6` | `#4AD9F7` | `#59CDFF` | Safira square-cut (ref top-right) |
| Amethyst | `#9B4DE8` | `#C487FF` | `#CE93F0` | Brilliant ponta-embaixo (ref bottom-left) |
| Amber | `#FF8A1E` | `#FFB64D` | `#FFB64D` | Esfera facetada (ref bottom-right) |
| **Wild Star** | `#FFC700` | `#FFE14D` | `#FFD60A` | Especial (raro, bônus) |

> **Nota (v3, 2026-08-03):** a cor 5 era "Frost Diamond" (branco gelo) — trocada
> por **Amber** porque a imagem de referência do usuário mostra âmbar/laranja no
> slot bottom-right. O outline preto cartoony foi substituído pelo **rim colorido**
> de cada jóia (campo 6 do `GEM_DEFS`), com halo/glow colorido visível e facetas
> de alto contraste — reprodução fiel da referência em 3D.

## 4. Tipografia

- **UI**: `Inter` / `system-ui` — clean, moderna, legível
- **Display/Títulos**: `Space Grotesk` — geométrica, tech, premium (via CDN self-host)
- **Números/Score**: `JetBrains Mono` — tabular-nums para pontuação
- Proibido: serifas decorativas, fontes "arcade" pixeladas (retro demais)

Escala: score 48px+ (display), título 24px, corpo 14-16px, labels 11px uppercase.

## 5. Componentes 3D

### Gems (peças do tabuleiro)

- **Geometria**: octaedro facetado / esfera polar com facetas — não cubo!
- **Material**: MeshPhysicalMaterial com `roughness: 0.1`, `metalness: 0.0`,
  `transmission: 0.6` (refração), `iridescence: 0.5` (arco-íris sutil)
- **Emissão**: emissive com intensidade baixa (0.2-0.4) para glow interno
- **Borda**: outline sutil (cel-shading edge) para leitura no grid
- **Tamanho**: 1 unidade, espaçamento 1.1 para respiro
- **Estado selected**: elevação +Y + scale 1.15 + ring highlight animado
- **Fall**: animação de queda com overshoot leve (elastic-out)
- **Match flash**: emissão estoura 3x, scale pulsa, depois explode em partículas

### Board (tabuleiro)

- Grid 6 colunas × 12 linhas (visível ~8, colunas caem de cima)
- Superfície: plano sutil com grid lines (linhas 1px, opacity 0.08)
- Célula selecionável: highlight suave (plane quadrado translúcido)
- Coluna que cai: sombra projetada no fundo + preview fantasma da posição
  (ghost translúcido corpo ~0.05-0.08 + wireframe dashed ~0.18-0.26,
  atrás da coluna — placeholder suave, não gem sólida)
- **Perspectiva pinball (~11.5°)**: todos os elementos visuais do board
  (moldura, gems, falling, ghost, beam, highlight) são filhos de um
  `_tiltGroup` rotacionado em X — girar tudo junto preserva o
  alinhamento gems↔células. O offset vertical vive SÓ no tiltGroup
  (`Y_OFFSET` das gems NÃO repete `BOARD_Y_OFFSET` — duplicar desloca as
  gems ~1.3u pra baixo das células). `TILT_LIFT` (desktop) + zoom out em
  viewports <820px mantêm a moldura visível.
- **Espaçamento das rows de baixo**: `floorLift` da última row é 0.15u
  (0.35u fazia o topo das gems da row 13 invadir a row 12 — sobreposição
  visível; corrigido). A folga com a moldura inferior fica ~10px.

### HUD (glass)

- Painéis: `backdrop-filter: blur(16px)`, border 1px rgba(255,255,255,0.10),
  border-radius 16px, sombra profunda
- Score: animação de contagem (tween numérico)
- Next preview: mini coluna com as 3 próximas gems
- Nível/Progresso: barra com gradiente cyan→violet
- Game Over: painel glass central com retry

### Partículas

- Explosão de gems: fragmentos da gem (mesh quebrado) + sparkles + ring shockwave
- Poças de luz: sprite circular com blend additive
- Combo +1: texto flutuante "COMBO x3" com scale-in + fade-up
- Background: poeira cósmica lenta (points system, ~200 partículas)

## 6. Iluminação

- **Key light**: directional quente (cor levemente âmbar) de cima-esquerda
- **Fill light**: hemisphere suave azulada para preencher sombras
- **Rim light**: point light violeta atrás do tabuleiro
- **Ambient**: baixo, com leve tint cyan
- **Post**: bloom seletivo (gems brilham, HUD não), vignette, ACES tone mapping

## 7. Motion

- **Fall**: 0.35s elastic-out (overshoot 1.1)
- **Rotate column**: 0.12s ease-out
- **Move column**: 0.08s ease-out (instantâneo, responsivo)
- **Match flash**: 0.25s pulso 3x antes da explosão
- **Explosion**: 0.4s partículas + screen shake 0.3s (amplitude 4px, combos >3: 6px)
- **Combo text**: 0.6s scale-in + fade-out
- **Menu transitions**: 0.3s fade+scale
- Todas respeitam `prefers-reduced-motion` (desativa shake, reduz partículas)

## 8. Áudio

**Sound design (SFX)** — 100% sintetizado em WebAudio, zero arquivos:
- Gems = cristal vítreo (chimes com harmônicos 1x-4x + shimmer de ar);
  board = pedra/madeira (thumps graves); UI = cartoon (blips)
- Hierarquia: ticks (-14/-16dB) < eventos (-5/-9dB) < celebração
  (-2.7/-4dB); master chain com DynamicsCompressor
- Combos/levelup em arpejos pentatônicos ascendentes; gameover
  descendente suave

**Trilha de fundo (lo-fi procedural)** — `src/audio/music.js`:
- 6 faixas lo-fi (pads com LFO wobble, chimes de cristal pentatônicos,
  bass, bateria relaxada com swing, textura de vinil com crackles)
- Volume BAIXO: `MUSIC.VOLUME 0.34` vs master 0.8 → ~7dB abaixo dos
  SFX (a música ambienta, nunca compete com os eventos)
- Cada início de jogo abre com faixa ALEATÓRIA diferente (shuffle; a
  última tocada vai para o fim); ao acabar, a próxima entra em
  sequência; re-shuffle no fim da playlist
- Pausa/retoma com o jogo (AudioContext suspend/resume)

## 9. Anti-Patterns (BANIDO)

- ❌ Cubos de plástico brilhante (gems precisam parecer pedra real)
- ❌ Cores rainbow saturadas sem deslocamento de matiz
- ❌ Texto com gradient clip em HUD
- ❌ Fonte pixel-art retrô
- ❌ Glassmorphism em excesso (só HUD/menus, não no tabuleiro)
- ❌ Screen shake exagerado (sempre < 6px)
- ❌ Animações sem easing (linear = quebrado)
- ❌ Partículas demais (perf: < 500 no total)
- ❌ Cores puras #000/#fff em superfícies
