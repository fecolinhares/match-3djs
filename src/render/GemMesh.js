// ============================================================
// Match-3D.js — GemMesh.js
// Contract: GemMesh.create(colorIndex, position) → THREE.Group
//           (faceted gem mesh + glow sprite + selection ring).
// Design: CARTOON ARCADE (Columns-classic) — THREE distinct
//         silhouettes mapped per color (round / diamond / rounded-
//         square) so each gem reads by shape AND color. Strong dark
//         edge shading via vertexColors tintFacets (dark facets
//         darker, light facets lighter) + a bold dark outline mesh
//         (scaled-up BackSide clone, #1A120B) = the classic flat
//         cartoon inked look. No gloss — matte body, outline carries
//         the silhouette.
//         Selected: elevate +Y, scale 1.15, animated ring.
//         Match flash: emissive pulses 3× then explodes.
//         All motion uses exponential/overshoot easing — never linear.
// ============================================================

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GEM_DEFS, TUNING } from '../config.js';
import {
  createGemMaterial,
  createCoreMaterial,
  createOutlineMaterial,
  createRingMaterial,
  makeGlowTexture,
  toColor,
} from './Materials.js';

// ------------------------------------------------------------
// Easing utilities (shared by the render layer)
// ------------------------------------------------------------
export function clamp01(t) {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}
export function easeOutQuad(t) {
  return 1 - (1 - t) * (1 - t);
}
export function easeOutCubic(t) {
  const u = 1 - t;
  return 1 - u * u * u;
}
export function easeOutBack(t, s = 1.70158) {
  const u = t - 1;
  return 1 + (s + 1) * u * u * u + s * u * u;
}
/** Elastic overshoot: bounces past the target, settles at 1. */
export function easeOutElastic(t) {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const p = 0.32;
  const s = p / 4;
  return Math.pow(2, -10 * t) * Math.sin(((t - s) * (2 * Math.PI)) / p) + 1;
}
export function easeInOutQuad(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

/** Live reduced-motion check: media query OR runtime TUNING flag. */
export function isReducedMotion() {
  const mq =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return Boolean(mq || TUNING.REDUCED_MOTION);
}

// ------------------------------------------------------------
// Timing constants
// ------------------------------------------------------------
const SPAWN_DUR = 0.42; // elastic drop-in from above
const FALL_DUR = 0.35; // gravity drop (elastic overshoot)
const MOVE_DUR = 0.08; // horizontal column move (snappy)
const FLASH_DUR = TUNING.MATCH_FLASH_MS / 1000; // 0.25s pulse×3
const IDLE_ROT_SPEED = 0.35; // rad/s, disabled under reduced motion
const OUTLINE_SCALE = 1.06; // 0.92×1.06=0.98 < GAP 1.0; fino p/ facetas

// ------------------------------------------------------------
// Vertex-color facet tinting — each face gets a brightness factor
// from its normal orientation (up faces lighter, down faces darker).
// CARTOON: contrast is STRONG on purpose — dark facets sink toward
// near-black, light facets pop — so gems read as outlined cartoon
// jewels (Columns-classic) instead of neon glass. GPU-independent.
// ------------------------------------------------------------
function tintFacets(geometry) {
  const pos = geometry.attributes.position;
  const count = pos.count;
  const colors = new Float32Array(count * 3);
  // All body geometries are non-indexed triangle soup; compute each
  // face normal by averaging the 3 vertices of the triangle.
  for (let i = 0; i < count; i += 3) {
    const ax = pos.getX(i), ay = pos.getY(i), az = pos.getZ(i);
    const bx = pos.getX(i + 1), by = pos.getY(i + 1), bz = pos.getZ(i + 1);
    const cx = pos.getX(i + 2), cy = pos.getY(i + 2), cz = pos.getZ(i + 2);
    // normal = (B-A) × (C-A)
    const ux = bx - ax, uy = by - ay, uz = bz - az;
    const vx = cx - ax, vy = cy - ay, vz = cz - az;
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len; ny /= len; nz /= len;
    // Cartoon key: top faces (normal.y > 0) catch key light → very
    // light. Down faces sink near-dark; side faces mid-dark. Wide
    // spread = strong edge/outline read on every silhouette.
    // v2 (polished-jewel pass): side weight RAISED 0.2 → 0.55 so the
    // girdle band separates from the pavilion band (crown/girdle/
    // pavilion read as 3 distinct planes on every color), down faces
    // deepened −0.02 → −0.06 for a darker base (but not black), and
    // up weight trimmed 0.72 → 0.5 so bright crown/table faces stop
    // clamping to pure white (keeps hue alive on light gems like
    // Frost Diamond).
    const up = Math.max(0, ny);
    const down = Math.max(0, -ny);
    const side = Math.abs(nx) * 0.5 + Math.abs(nz) * 0.5;
    const b = 0.5 + up * 0.5 + side * 0.6 - down * 0.06; // ~0.44..1.1
    for (let k = 0; k < 3; k++) {
      colors[(i + k) * 3] = b;
      colors[(i + k) * 3 + 1] = b;
      colors[(i + k) * 3 + 2] = b;
    }
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

// ------------------------------------------------------------
// Per-color silhouettes — EXACT 3D reproductions of the 6-gem
// reference image (user-provided). Each is a REAL faceted jewel
// built from a crown (top facets) + girdle + pavilion, merged into
// a single non-indexed triangle soup so tintFacets tints per face.
//   hexagon   — rubi: prisma hexagonal + coroa piramidal (top-left)
//   square    — safira: octógono com mesa + coroa step (top-right)
//   emerald   — esmeralda: retângulo step-cut com painel (middle-left)
//   pear      — topázio: pêra Lathe (coroa larga, apex fino) (middle-right)
//   brilliant — amatista: brilliant-cut Lathe (mesa + ponta) (bottom-left)
//   sphere    — âmbar: bola facetada (bottom-right)
// ------------------------------------------------------------
function _nonIndexed(geo) {
  return geo.toNonIndexed ? geo.toNonIndexed() : geo;
}

/**
 * Normalize a built geometry so its LARGEST dimension ≈ target (0.9).
 * The pear (Lathe 1.15 tall) and brilliant (~1.02 tall) were taller
 * than the 0.80 settled scale allows and visually crossed cell rows;
 * every shape now fits max-dim 0.9 inside the 0.80 group scale
 * (0.80×0.9 = 0.72 core footprint, outline 0.80×0.9×1.10 = 0.79 <
 * GAP 1.0). Uniform scale preserves silhouette proportions.
 */
function normalizeGeometry(geo, target = 0.9) {
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const maxDim = Math.max(
    bb.max.x - bb.min.x,
    bb.max.y - bb.min.y,
    bb.max.z - bb.min.z
  );
  if (maxDim > 0.0001 && Math.abs(maxDim - target) > 0.001) {
    const s = target / maxDim;
    geo.scale(s, s, s);
  }
  return geo;
}

export function buildBodyGeometry(shape) {
  switch (shape) {
    case 'hexagon': {
      // Rubi hexagonal: prisma 6 lados + coroa piramidal 6 lados no topo.
      const girdle = new THREE.CylinderGeometry(0.5, 0.5, 0.45, 6, 1);
      girdle.rotateX(Math.PI / 2); // eixo Y → Z (assenta no tabuleiro)
      // coroa: cone hexagonal invertido (ápice para cima, base na girdle)
      const crown = new THREE.ConeGeometry(0.5, 0.42, 6, 1);
      crown.rotateX(Math.PI / 2);
      crown.translate(0, 0.42, 0); // sobre a girdle
      const merged = mergeGeometries([girdle, crown]);
      return normalizeGeometry(_nonIndexed(merged));
    }
    case 'square': {
      // Safira square-cut: caixa octogonal (girdle) + mesa octogonal menor
      // (coroa com degrau) = borda grossa + interior estrelado da ref.
      const half = 0.46;
      const c = 0.16;
      const oct = (h, depth, z) => {
        const s = new THREE.Shape();
        s.moveTo(-half + c, -half);
        s.lineTo(half - c, -half);
        s.lineTo(half, -half + c);
        s.lineTo(half, half - c);
        s.lineTo(half - c, half);
        s.lineTo(-half + c, half);
        s.lineTo(-half, half - c);
        s.lineTo(-half, -half + c);
        s.closePath();
        const g = new THREE.ExtrudeGeometry(s, {
          depth,
          bevelEnabled: true,
          bevelThickness: h * 0.18,
          bevelSize: h * 0.14,
          bevelSegments: 2,
          curveSegments: 4,
        });
        g.translate(0, 0, z);
        return g;
      };
      const girdle = oct(half, 0.5, -0.28);
      const mesa = oct(half * 0.62, 0.22, 0.05); // mesa menor em cima
      const merged = mergeGeometries([girdle, mesa]);
      return normalizeGeometry(_nonIndexed(merged));
    }
    case 'emerald': {
      // Esmeralda step-cut: extrude retangular CHANFRADO (cantos cortados
      // = facetas no girdle) + mesa menor em cima. Não é uma caixa lisa:
      // os 8 cantos cortados criam as facetas diagonais do corte.
      const w = 0.82;
      const h = 0.56;
      const cut = 0.12; // chanfro dos cantos (facetas diagonais)
      const rect = (ww, hh) => {
        const s = new THREE.Shape();
        s.moveTo(-ww / 2 + cut, -hh / 2);
        s.lineTo(ww / 2 - cut, -hh / 2);
        s.lineTo(ww / 2, -hh / 2 + cut);
        s.lineTo(ww / 2, hh / 2 - cut);
        s.lineTo(ww / 2 - cut, hh / 2);
        s.lineTo(-ww / 2 + cut, hh / 2);
        s.lineTo(-ww / 2, hh / 2 - cut);
        s.lineTo(-ww / 2, -hh / 2 + cut);
        s.closePath();
        return s;
      };
      const girdle = new THREE.ExtrudeGeometry(rect(w, h), {
        depth: 0.42,
        bevelEnabled: true,
        bevelThickness: 0.14,
        bevelSize: 0.1,
        bevelSegments: 2,
        curveSegments: 4,
      });
      girdle.translate(0, 0, -0.28);
      const mesa = new THREE.ExtrudeGeometry(rect(w * 0.6, h * 0.55), {
        depth: 0.3,
        bevelEnabled: true,
        bevelThickness: 0.1,
        bevelSize: 0.08,
        bevelSegments: 2,
        curveSegments: 4,
      });
      mesa.translate(0, 0, 0.12); // painel central em degrau (step-cut)
      const merged = mergeGeometries([girdle, mesa]);
      return normalizeGeometry(_nonIndexed(merged));
    }
    case 'pear': {
      // Topázio pêra/triângulo: forma TRIANGULAR da ref (apex no topo,
      // base curva). Em vez de Lathe (que parece cone liso), usa um
      // prisma triangular extrudado + mesa triangular → facetas planas
      // grandes e inconfundíveis (crown/coroa no topo, base em baixo).
      const halfW = 0.5;
      const halfH = 0.44;
      const tri = (scale, z) => {
        const s = new THREE.Shape();
        s.moveTo(0, halfH * scale);            // apex no topo
        s.lineTo(halfW * scale, -halfH * scale); // canto direito da base
        s.lineTo(-halfW * scale, -halfH * scale); // canto esquerdo da base
        s.closePath();
        const g = new THREE.ExtrudeGeometry(s, {
          depth: 0.34,
          bevelEnabled: true,
          bevelThickness: 0.1,
          bevelSize: 0.09,
          bevelSegments: 2,
          curveSegments: 3,
        });
        g.translate(0, 0, z);
        return g;
      };
      const body = tri(1, -0.2);
      const mesa = tri(0.55, 0.12); // mesa triangular (coroa facetada)
      const merged = mergeGeometries([body, mesa]);
      return normalizeGeometry(_nonIndexed(merged));
    }
    case 'brilliant': {
      // Amatista brilliant-cut: perfil Lathe com MESA no topo (table),
      // girdle e ponta embaixo (pavilhão) — silhueta clássica da ref.
      const r0 = 0.02; // ponta do pavilhão (embaixo)
      const r1 = 0.5;  // girdle (meio)
      const r2 = 0.34; // mesa (topo)
      const points = [
        new THREE.Vector2(r0, -0.62),        // ponta embaixo
        new THREE.Vector2(r1 * 0.55, -0.28), // pavilhão sobe
        new THREE.Vector2(r1, -0.02),        // girdle
        new THREE.Vector2(r1, 0.1),          // coroa base
        new THREE.Vector2(r2, 0.32),         // coroa sobe
        new THREE.Vector2(r2, 0.4),          // mesa
      ];
      const lathe = new THREE.LatheGeometry(points, 10);
      // Lathe já gera com eixo de altura em Y — NÃO rotacionar.
      return normalizeGeometry(_nonIndexed(lathe));
    }
    case 'sphere':
    default: {
      // Bola facetada (âmbar) — icosaedro d2 (80 faces) com facetas
      // visíveis em todos os ângulos.
      return normalizeGeometry(_nonIndexed(new THREE.IcosahedronGeometry(0.5, 2)));
    }
  }
}

/** Per-shape scale for the inner "highlight" core. */
function coreScaleFor(shape) {
  switch (shape) {
    case 'hexagon': return [0.75, 0.8, 0.75];
    case 'square': return [0.8, 0.8, 0.65];
    case 'emerald': return [0.85, 0.7, 0.7];
    case 'pear': return [0.7, 1.0, 0.7]; // core acompanha o triângulo
    case 'brilliant': return [0.8, 1.3, 0.8];
    default: return [1, 1, 1];
  }
}

// Geometry cache: build + tint once per shape, clone per gem (clone
// copies the color attribute, so per-gem mutation is safe).
const _bodyGeoCache = new Map();
function getBodyGeometry(shape) {
  let geo = _bodyGeoCache.get(shape);
  if (!geo) {
    geo = buildBodyGeometry(shape);
    tintFacets(geo);
    _bodyGeoCache.set(shape, geo);
  }
  return geo.clone();
}

// ------------------------------------------------------------
// create(colorIndex, position, opts) → THREE.Group
//   opts.scale      — base scale (default 1). Falling gems pass >1
//                     (they never tick, so scale must be set here).
//   opts.glowBoost  — bigger/brighter glow sprite (falling column).
// ------------------------------------------------------------
export function create(colorIndex, position, opts = {}) {
  const def = GEM_DEFS[colorIndex] ?? GEM_DEFS[GEM_DEFS.length - 1];
  const group = new THREE.Group();
  // scale default 0.92 p/ gems assentadas: facetas legíveis na tela
  // (normalize 0.9 → corpo 0.83; outline 1.06 → 0.88 < GAP 1.0).
  const scale = opts.scale ?? 0.92;
  const glowBoost = Boolean(opts.glowBoost);

  const bodyMat = createGemMaterial(colorIndex);
  const coreMat = createCoreMaterial(colorIndex);

  // Cartoon body — shape fixed per color (round / diamond / square):
  // silhouette + saturated color both carry identity. Vertex colors per
  // face: faces turned up get light tones, down/side faces get dark —
  // strong dark-edge shading that reads as an outlined cartoon jewel
  // independent of envMap/GPU.
  const shape = def[4] || 'sphere';
  const bodyGeo = getBodyGeometry(shape);
  const body = new THREE.Mesh(bodyGeo, bodyMat);

  // Bold ink outline (contract TASK 2) — classic cartoon trick: a
  // slightly scaled-up clone of the SAME body geometry rendered with
  // BackSide + flat dark #1A120B. The far-side back faces poke out
  // around the silhouette and read as a thick dark outline around
  // every shape (hexagon/square/emerald/pear/brilliant/sphere).
  // Added to the GROUP (child of the gem, not the scene) so it
  // follows the gem's pop-in / selection / flash scale automatically;
  // rotation.y is synced to the body in tick() so the outline hugs
  // the silhouette as the gem idles.
  const outline = new THREE.Mesh(bodyGeo.clone(), createOutlineMaterial());
  outline.scale.setScalar(OUTLINE_SCALE);
  outline.renderOrder = -1; // renderiza antes do corpo (atrás), BackSide
                            // aparece ao redor da silhueta = outline grosso

  // Inner highlight — opaque heart rendered in the opaque pass, seen
  // through the slightly-translucent flat shell (Columns "highlight
  // interno"). FLAT cartoon: the heart is a crisp painted core, no
  // refraction (shell opacity 0.88, transmission 0).
  // Scaled per shape so it follows the silhouette.
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.26, 0), coreMat);
  core.rotation.y = Math.PI / 4;
  core.rotation.x = 0.3;
  const cs = coreScaleFor(shape);
  // 1.05 → 0.92: heart slightly smaller so it stops competing with the
  // facet shading (still reads as the Columns \"highlight interno\").
  core.scale.set(cs[0] * 0.92, cs[1] * 0.92, cs[2] * 0.92);

  // Glow sprite behind the stone — SUTIL para gems assentadas.
  // Falling gems (glowBoost) ganham glow UM POUCO maior, mas NÃO
  // exagerado: glow enorme (2.6) + opacity alta virava orbe branco
  // cegante (especialmente Frost Diamond). Agora discreto: a leitura
  // da coluna caindo vem do beam + ghost, não de glow branco.
  const glow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: makeGlowTexture(),
      color: new THREE.Color(def[2]),
      transparent: true,
      opacity: glowBoost ? 0.32 : 0.12,  // 0.18→0.12: glow suavizava outlines
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  glow.scale.setScalar(glowBoost ? 1.9 : 1.35);
  glow.position.z = -0.05;

  // Selection ring (hidden until selected).
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.68, 48), createRingMaterial());
  ring.position.z = 0.02;
  ring.visible = false;

  // Sparkle — brilho 4-pontas que pisca periodicamente (look Bejeweled).
  // Tom levemente quente (não branco puro) e opacity mais contida —
  // branco puro + additive + bloom = brilho cegante.
  const sparkle = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: makeGlowTexture(),
      color: new THREE.Color(0xfff4e0),
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      rotation: Math.PI / 4, // vira em "X" para dar o formato 4-pontas
    })
  );
  sparkle.scale.setScalar(0.7);
  sparkle.position.set(0.28, 0.28, 0.1);
  sparkle.userData.phase = Math.random() * Math.PI * 2; // dessincroniza os sparkles

  group.add(outline, body, core, glow, ring, sparkle);

  const start = {
    x: position.x,
    y: position.y + 5.5,
    z: position.z,
  };
  group.position.set(start.x, start.y, start.z);
  group.scale.setScalar(0.2 * scale); // falling gems: 0.2×scale pop-in start

  group.userData = {
    group,
    colorIndex,
    x: position.x,
    y: position.y,
    z: position.z,
    body,
    core,
    outline,
    glow,
    ring,
    sparkle,
    // tween: current motion
    tween: { t: 0, from: { ...start }, to: { ...position }, dur: SPAWN_DUR, ease: easeOutElastic },
    base: { x: position.x, y: position.y, z: position.z },
    scaleBoost: scale, // aplicado no tick (falling gems: nunca tick, fica fixo)
    popT: 0, // scale-in animation progress (0..1)
    popScale: 0.001,
    sel: 0, // 0..1 selected pose blend
    selected: false,
    flashT: -1,
    flashComplete: null,
    reduced: isReducedMotion(),
  };

  group.userData.tick = tick;
  return group;
}

// ------------------------------------------------------------
// Public per-gem controls
// ------------------------------------------------------------

/** Retarget the gem to a new cell center (e.g. gravity drop). */
export function setTarget(group, position, mode = 'fall') {
  const u = group.userData;
  u.base = { x: position.x, y: position.y, z: position.z };
  const dur = mode === 'move' ? MOVE_DUR : mode === 'spawn' ? SPAWN_DUR : FALL_DUR;
  const ease = mode === 'move' ? easeOutQuad : easeOutElastic;
  u.tween = {
    t: 0,
    from: { x: group.position.x, y: group.position.y, z: group.position.z },
    to: { ...position },
    dur,
    ease,
  };
}

/** Instantly snap (used on first sync). */
export function snapTo(group, position) {
  const u = group.userData;
  u.base = { x: position.x, y: position.y, z: position.z };
  group.position.set(position.x, position.y, position.z);
  u.popT = 1;
  u.popScale = 1;
  u.tween.t = 1;
  group.scale.setScalar(u.scaleBoost ?? 1);
}

/** Scale pop-in at the current position (landing / placement). */
export function popIn(group) {
  const u = group.userData;
  u.popT = 0;
  u.popScale = 0.001;
}

/** Selected: elevate +Y, scale 1.15, animated ring. */
export function setSelected(group, on) {
  const u = group.userData;
  u.selected = Boolean(on);
  u.ring.visible = on;
}

/** Match flash: emissive pulses 3×, then onComplete() (→ explode). */
export function setFlash(group, onComplete) {
  const u = group.userData;
  u.flashT = 0;
  u.flashComplete = onComplete || null;
}

/** Kill tweens (used when the gem is recycled). */
export function dispose(group) {
  group.userData.tick = null;
}

// ------------------------------------------------------------
// Animation driver — group.userData.tick(dt, time)
// ------------------------------------------------------------
function tick(dt, time) {
  const u = this;
  if (!u || u.tick !== tick) return; // recycled guard
  if (u.vanishing) return; // shrink-out owned by BoardMesh
  const group = u.group;

  // --- motion tween -------------------------------------------------
  const tw = u.tween;
  if (tw.t < 1) {
    tw.t = clamp01(tw.t + dt / tw.dur);
    const e = tw.ease(tw.t);
    const px = tw.from.x + (tw.to.x - tw.from.x) * e;
    const py = tw.from.y + (tw.to.y - tw.from.y) * e;
    const pz = tw.from.z + (tw.to.z - tw.from.z) * e;
    u.base.x = px;
    u.base.y = py;
    u.base.z = pz;
  }

  // --- selection pose -------------------------------------------------
  const targetSel = u.selected ? 1 : 0;
  u.sel += (targetSel - u.sel) * Math.min(1, dt * 10);
  const lift = u.sel * 0.35;
  const selScale = 1 + u.sel * 0.15;

  // --- match flash ----------------------------------------------------
  let flashScale = 1;
  let flashEmissive = 1;
  if (u.flashT >= 0) {
    u.flashT += dt;
    const p = clamp01(u.flashT / FLASH_DUR);
    // 3 full sine cycles → 3 pulses; decaying envelope.
    // Amplitude 1.6 (era 2.6) — pulso visível sem estourar emissive/glow.
    const env = 1 - p * 0.5;
    const wave = Math.max(0, Math.sin(p * Math.PI * 6)) * env;
    flashEmissive = 1 + 1.6 * wave;
    flashScale = 1 + 0.24 * wave;
    if (p >= 1) {
      u.flashT = -1;
      const done = u.flashComplete;
      u.flashComplete = null;
      if (done) done();
    }
  }

  // --- write transforms ------------------------------------------------
  group.position.set(u.base.x, u.base.y + lift, u.base.z);

  // pop-in scale (easeOutBack — slight overshoot)
  if (u.popT < 1) {
    u.popT = clamp01(u.popT + dt / 0.22);
    u.popScale = easeOutBack(u.popT);
  }
  group.scale.setScalar(selScale * flashScale * u.popScale * u.scaleBoost);

  // idle rotation (skip under reduced motion)
  if (!u.reduced) {
    u.body.rotation.y += dt * IDLE_ROT_SPEED;
    u.core.rotation.y -= dt * IDLE_ROT_SPEED * 0.6;
  }
  // outline hugs the body silhouette as the gem idles (same geometry,
  // same axis) — under reduced motion neither rotates, still aligned.
  u.outline.rotation.y = u.body.rotation.y;
  const bob = Math.sin(time * 1.6 + u.base.x * 2.1) * 0.012;
  group.position.y += bob;

  // ring pulse when selected
  if (u.selected) {
    const rp = 0.5 + 0.5 * Math.sin(time * 6);
    u.ring.material.opacity = 0.35 + 0.45 * rp;
    const rs = 1 + 0.12 * rp;
    u.ring.scale.setScalar(rs);
    u.ring.rotation.z = time * 0.8;
  }

  // sparkle — brilho periódico (2 ciclos/s, dessincronizado por fase)
  if (!u.reduced) {
    const sp = 0.5 + 0.5 * Math.sin(time * 4.2 + u.sparkle.userData.phase);
    // pico agudo e contido (sp^4 acentua o pico, quase 0 entre eles)
    const peak = sp * sp * sp * sp;
    u.sparkle.material.opacity = 0.6 * peak;
    u.sparkle.scale.setScalar(0.42 + 0.38 * peak);
    u.sparkle.material.rotation += dt * 0.6; // leve rotação contínua (material.rotation)
  } else {
    u.sparkle.material.opacity = 0;
  }

  // --- materials (flash) ------------------------------------------------
  // Flash contido: multiplicador menor para não estourar emissive/glow.
  // Bases: body 0.22 / core 0.7 (cartoon) — pico ~×2.6 sem washout.
  if (u.flashT >= 0 || flashEmissive !== 1) {
    u.body.material.emissiveIntensity = 0.22 * flashEmissive;
    u.core.material.emissiveIntensity = 0.45 * flashEmissive;
    u.glow.material.opacity = 0.18 + 0.3 * (flashEmissive - 1);
  }
}
