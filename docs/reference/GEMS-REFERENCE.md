# 🎨 Visual Reference — Gems (official user image)

> **Source:** `docs/reference/gems-reference.jpg` (1024×1024, provided by the user on 2026-08-03).
> **Rule:** the 3D in-game gems must look **exactly like this image, but in 3D**.
> This spec is the visual contract — any color/shape/glow change must go back to this table.

## The 6 jewels (2×3 grid)

| Position | Jewel | Silhouette | Facets | Rim (outline) | Glow |
|---|---|---|---|---|---|
| top-left | **Ruby** | tall hexagon, sharp top/bottom vertices | central hexagonal facet + radial triangles/trapezoids | crimson → hot-pink (`#FF4D6D` family) | deep red |
| top-right | **Sapphire** | square cushion, beveled corners | concentric step-cut + central star pattern | medium ice blue (`#59CDFF` family) | electric royal-blue |
| middle-left | **Emerald** | horizontal rectangle, sharp corners | step-cut bands + wide central face + diagonal corner facets | vivid emerald green (`#3EE88A` family) | bright green |
| middle-right | **Topaz** | triangular/pear, sharp apex at the TOP, wide curved base | triangles converging to the center | golden → orange (`#FFC24D` family) | warm gold |
| bottom-left | **Amethyst** | classic brilliant cut, wide girdle, point at the BOTTOM | radials + elongated kites, star flashes | lavender-violet (`#CE93F0` family) | saturated purple |
| bottom-right | **Amber** | almost circular/oval brilliant | many radial triangular facets + central face | amber-orange (`#FFB64D` family) | fire orange |

## In-game mapping (`GEM_DEFS` in `src/config.js`)

```
index  shape      game color      reference color  rim (new field 6)
0      hexagon    Fire Ruby       red              #FF5A78
1      pear       Solar Topaz     yellow           #FFC24D
2      emerald    Emerald         green            #3EE88A
3      square     Aquamarine      blue             #59CDFF
4      brilliant  Amethyst        purple           #CE93F0
5      sphere     **Amber** (was Frost Diamond)  orange  #FFB64D
```

> ⚠️ **Change 2026-08-03:** color 5 used to be "Frost Diamond" (white-gray),
> which **doesn't exist in the reference**. The reference shows **amber/orange**
> at bottom-right → replaced with **Amber** (`#FF8A1E`).

## Mandatory visual reading (what vision must confirm)

1. Each gem has a **colored rim** (not a black cartoon outline) in the table color.
2. Each gem has a visible **colored halo/glow** around it (not too subtle).
3. **Sharp facets** with strong contrast (legible crown/girdle/pavilion).
4. **Internal fire** (bright heart) visible at the center.
5. Exact silhouettes: pointed hexagon / cushion / beveled rectangle / apex-top
   triangle / brilliant point-down / faceted sphere.

## How to validate

- Isolated preview: serve a temporary `gem-preview.html` (scale 2.4) +
  `vision_analyze` with ONE short question per gem (long prompts get flaky
  400s on opencode-go).
- In-game: inject 1 gem per column on row 8 (see `threejs-game-development` skill).
- Full board: capture 4 frames ~600ms apart (GPU stall → false black frames).
