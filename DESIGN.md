---
name: Match-3D.js
version: "1.0"
description: >
  Design system for Match-3D.js — a COLUMNS-inspired match-3 puzzle with AAA
  Three.js graphics. Aesthetic: premium gemstones, dark tech arcade, glass HUD,
  cinematic lighting.
---

# Design System — Match-3D.js

## 1. Overview

A modern match-3 puzzle inspired by the classic Sega COLUMNS (1990), elevated to
the visual standard of current games. The aesthetic blends **premium gemstones**
(faceted precious stones with PBR materials), **dark tech arcade** (rich dark
background with dramatic lighting) and **glass HUD** (translucent panels with
blur).

## 2. Atmosphere

- **Dark, luxurious, immersive** — deep background with subtle gradient and
  floating particles (cosmic dust / sparkles)
- **Total focus on the board** — the gems are the visual hero, directional
  lighting
- **Premium motion** — exponential easing, physics-based animations (light
  elastic), subtle screen shake on big combos, explosive particles
- **References**: Bejeweled 3 (gem polish), Puzzle Quest (depth), King's
  match-3 games (juiciness), Lumines (minimal premium aesthetic)

## 3. Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `bg-deep` | `#0A0A12` | Main background (near black, slight blue) |
| `bg-vignette` | radial rgba(0,0,0,0.6) | Edge vignette |
| `surface-glass` | rgba(255,255,255,0.04) | HUD panels |
| `surface-glass-border` | rgba(255,255,255,0.10) | Panel borders |
| `accent-cyan` | `#00D2FF` | Primary highlight color (UI) |
| `accent-violet` | `#7B2FFF` | Secondary gradient |

### Gem Colors (6 colors + special)

Each gem has: **base color**, **emission color** (glow), **specular color**
(brightness) and **rim** (colored outline ring — v3, user reference in
`docs/reference/gems-reference.jpg`).

| Gem | Base Color | Emission | Rim | Meaning |
|-----|----------|---------|-----|-------------|
| Fire Ruby | `#F02E4E` | `#FF6A80` | `#FF4D6D` | Hexagonal ruby (ref top-left) |
| Solar Topaz | `#FF9F1C` | `#FFC24D` | `#FFC24D` | Triangular pear apex-top (ref middle-right) |
| Emerald | `#1FCB6E` | `#5BEA9D` | `#3EE88A` | Step-cut emerald (ref middle-left) |
| Aquamarine | `#00B7E6` | `#4AD9F7` | `#59CDFF` | Square-cut sapphire (ref top-right) |
| Amethyst | `#9B4DE8` | `#C487FF` | `#CE93F0` | Brilliant point-down (ref bottom-left) |
| Amber | `#FF8A1E` | `#FFB64D` | `#FFB64D` | Faceted sphere (ref bottom-right) |
| **Wild Star** | `#FFC700` | `#FFE14D` | `#FFD60A` | Special (rare, bonus) |

> **Note (v3, 2026-08-03):** color 5 used to be "Frost Diamond" (ice white) —
> replaced with **Amber** because the user's reference image shows amber/orange
> in the bottom-right slot. The black cartoon outline was replaced by the
> **colored rim** of each jewel (field 6 of `GEM_DEFS`), with a visible colored
> halo/glow and high-contrast facets — faithful 3D reproduction of the reference.

## 4. Typography

- **UI**: `Inter` / `system-ui` — clean, modern, legible
- **Display/Titles**: `Space Grotesk` — geometric, tech, premium (self-hosted CDN)
- **Numbers/Score**: `JetBrains Mono` — tabular-nums for scoring
- Forbidden: decorative serifs, pixelated "arcade" fonts (too retro)

Scale: score 48px+ (display), title 24px, body 14-16px, labels 11px uppercase.

## 5. 3D Components

### Gems (board pieces)

- **Geometry**: faceted octahedron / polar sphere with facets — not a cube!
- **Material**: MeshPhysicalMaterial with `roughness: 0.1`, `metalness: 0.0`,
  `transmission: 0.6` (refraction), `iridescence: 0.5` (subtle rainbow)
- **Emission**: emissive with low intensity (0.2-0.4) for internal glow
- **Edge**: subtle outline (cel-shading edge) for grid readability
- **Size**: 1 unit, 1.1 spacing for breathing room
- **Selected state**: +Y elevation + scale 1.15 + animated highlight ring
- **Fall**: drop animation with light overshoot (elastic-out)
- **Match flash**: emission bursts 3x, scale pulses, then explodes into particles

### Board

- Grid 8 columns × 14 rows (10 visible; top rows are the off-screen spawn
  zone) — columns fall from above
- Surface: subtle plane with grid lines (1px lines, opacity 0.08)
- Selectable cell: soft highlight (translucent square plane)
- Falling column: shadow projected at the bottom + ghost preview of the
  landing position (translucent body ~0.05-0.08 + dashed wireframe ~0.18-0.26,
  behind the column — soft placeholder, not a solid gem)
- **Pinball perspective (~11.5°)**: all visual board elements (frame, gems,
  falling, ghost, beam, highlight) are children of a `_tiltGroup` rotated on
  X — rotating everything together preserves gems↔cells alignment. The
  vertical offset lives ONLY on the tiltGroup (`Y_OFFSET` of gems does NOT
  repeat `BOARD_Y_OFFSET` — duplicating shifts gems ~1.3u below the cells).
  `TILT_LIFT` (desktop) + zoom out on viewports <820px keep the frame visible.
- **Bottom row spacing**: the last row's `floorLift` is 0.15u (0.35u made the
  top of row-13 gems invade row 12 — visible overlap; fixed). Clearance to the
  bottom frame is ~10px.

### HUD (glass)

- Panels: `backdrop-filter: blur(16px)`, border 1px rgba(255,255,255,0.10),
  border-radius 16px, deep shadow
- Score: counting animation (numeric tween)
- Next preview: mini column with the 3 next gems
- Level/Progress: gradient bar cyan→violet
- Game Over: central glass panel with retry

### Particles

- Gem explosion: gem fragments (broken mesh) + sparkles + ring shockwave
- Light pools: circular sprite with additive blend
- Combo +1: floating "COMBO x3" text with scale-in + fade-up
- Background: slow cosmic dust (points system, ~200 particles)

## 6. Lighting

- **Key light**: warm directional (slightly amber) from top-left
- **Fill light**: soft bluish hemisphere to fill shadows
- **Rim light**: violet point light behind the board
- **Ambient**: low, with a light cyan tint
- **Post**: selective bloom (gems glow, HUD doesn't), vignette, ACES tone mapping

## 7. Motion

- **Fall**: 0.35s elastic-out (overshoot 1.1)
- **Rotate column**: 0.12s ease-out
- **Move column**: 0.08s ease-out (instant, responsive)
- **Match flash**: 0.25s pulse 3x before explosion
- **Explosion**: 0.4s particles + screen shake 0.3s (amplitude 4px, combos >3: 6px)
- **Combo text**: 0.6s scale-in + fade-out
- **Menu transitions**: 0.3s fade+scale
- All respect `prefers-reduced-motion` (disables shake, reduces particles)

## 8. Audio

**Sound design (SFX)** — 100% WebAudio-synthesized, zero files:
- Gems = glassy crystal (chimes with 1x-4x harmonics + shimmer); board =
  stone/wood (low thumps); UI = cartoon (blips)
- Hierarchy: ticks (-14/-16dB) < events (-5/-9dB) < celebration
  (-2.7/-4dB); master chain with DynamicsCompressor
- Combos/level-up in ascending pentatonic arpeggios; game over
  soft descending

**Background track (procedural lo-fi)** — `src/audio/music.js`:
- 6 lo-fi tracks (pads with LFO wobble, pentatonic crystal chimes, bass,
  relaxed drums with swing, vinyl crackle texture)
- LOW volume: `MUSIC.VOLUME 0.34` vs master 0.8 → ~7dB below SFX (the music
  sets the mood, never competes with events)
- Each game start opens with a DIFFERENT random track (shuffle; the last
  played goes to the end); when it ends, the next plays in sequence;
  re-shuffle at the end of the playlist
- Pauses/resumes with the game (AudioContext suspend/resume)

## 9. Anti-Patterns (BANNED)

- ❌ Shiny plastic cubes (gems must look like real stone)
- ❌ Saturated rainbow colors without hue shifting
- ❌ Gradient-clipped text in HUD
- ❌ Retro pixel-art fonts
- ❌ Excessive glassmorphism (HUD/menus only, not the board)
- ❌ Exaggerated screen shake (always < 6px)
- ❌ Animations without easing (linear = broken)
- ❌ Too many particles (perf: < 500 total)
- ❌ Pure #000/#fff colors on surfaces
