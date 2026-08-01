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

Cada gem tem: **cor base**, **cor de emissão** (glow), **cor de brilho** (specular).

| Gem | Cor Base | Emissão | Significado |
|-----|----------|---------|-------------|
| Fire Ruby | `#FF2D55` | `#FF6B81` | Vermelho quente |
| Solar Topaz | `#FF9F0A` | `#FFC24B` | Laranja dourado |
| Emerald | `#30D158` | `#7BE9A0` | Verde vivo |
| Aquamarine | `#0BD1E8` | `#6FE7F5` | Ciano cristal |
| Amethyst | `#AF52DE` | `#D9A0F5` | Roxo real |
| Frost Diamond | `#F2F4F8` | `#FFFFFF` | Branco gelo |
| **Wild Star** | `#FFD60A` | `#FFF3B0` | Especial (raro, bônus) |

> **Nota anti-slop**: estas NÃO são as cores "AI rainbow" padrão — cada uma tem
> matiz deslocado e emissão própria para parecer pedra preciosa real, não cubo
> de plástico.

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

## 8. Anti-Patterns (BANIDO)

- ❌ Cubos de plástico brilhante (gems precisam parecer pedra real)
- ❌ Cores rainbow saturadas sem deslocamento de matiz
- ❌ Texto com gradient clip em HUD
- ❌ Fonte pixel-art retrô
- ❌ Glassmorphism em excesso (só HUD/menus, não no tabuleiro)
- ❌ Screen shake exagerado (sempre < 6px)
- ❌ Animações sem easing (linear = quebrado)
- ❌ Partículas demais (perf: < 500 no total)
- ❌ Cores puras #000/#fff em superfícies
