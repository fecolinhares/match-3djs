// ============================================================
// Match-3D.js — Materials.js
// PBR materials for the CARTOON ARCADE gem aesthetic.
// Contract: Materials.createGemMaterial(colorIndex) → THREE.MeshPhysicalMaterial
// Design: cartoon FLAT candy jewels (Columns-classic) — saturated colors,
//         strong dark edge shading via vertexColors tintFacets, NO gloss
//         (no transmission / iridescence / clearcoat) — the flat cartoon
//         body pairs with the dark outline mesh (createOutlineMaterial)
//         for the bold inked look. Roughness up = matte, not crystal.
// ============================================================

import * as THREE from 'three';
import { GEM_DEFS } from '../config.js';

/**
 * Shared radial glow texture (white → transparent), used by gem glow
 * sprites and particle "poças de luz". Tinted per-use via material.color.
 */
let _glowTexture = null;
export function makeGlowTexture() {
  if (_glowTexture) return _glowTexture;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0.0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.65)');
  grad.addColorStop(0.55, 'rgba(255,255,255,0.18)');
  grad.addColorStop(1.0, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  _glowTexture = new THREE.CanvasTexture(canvas);
  _glowTexture.colorSpace = THREE.SRGBColorSpace;
  return _glowTexture;
}

/**
 * Vertical gradient texture (cyan beam): bright center → transparent
 * top/bottom. Usado no column highlight beam e no trail da coluna que cai.
 */
let _beamTexture = null;
export function makeBeamTexture() {
  if (_beamTexture) return _beamTexture;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0.0, 'rgba(255,255,255,0)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.9)');
  grad.addColorStop(1.0, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  _beamTexture = new THREE.CanvasTexture(canvas);
  _beamTexture.colorSpace = THREE.SRGBColorSpace;
  return _beamTexture;
}

/**
 * Soft radial backdrop texture (cyan center → violet mid → transparent),
 * para o halo de luz atrás do tabuleiro.
 */
let _backdropTexture = null;
export function makeBackdropTexture() {
  if (_backdropTexture) return _backdropTexture;
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(
    size / 2, size / 2, 0,
    size / 2, size / 2, size / 2
  );
  grad.addColorStop(0.0, 'rgba(255,255,255,0.85)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.30)');
  grad.addColorStop(1.0, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  _backdropTexture = new THREE.CanvasTexture(canvas);
  _backdropTexture.colorSpace = THREE.SRGBColorSpace;
  return _backdropTexture;
}

/**
 * Rounded-rect frame texture (cyan glow outline + violet hairline inner),
 * para a moldura premium do tabuleiro. Square canvas — the board plane
 * keeps aspect via its own geometry.
 */
let _frameTexture = null;
export function makeFrameTexture() {
  if (_frameTexture) return _frameTexture;
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const inset = size * 0.02;
  const w = size - inset * 2;
  const h = size - inset * 2;
  const r = size * 0.055;

  const roundRect = (x, y, w2, h2, r2) => {
    ctx.beginPath();
    ctx.moveTo(x + r2, y);
    ctx.arcTo(x + w2, y, x + w2, y + h2, r2);
    ctx.arcTo(x + w2, y + h2, x, y + h2, r2);
    ctx.arcTo(x, y + h2, x, y, r2);
    ctx.arcTo(x, y, x + w2, y, r2);
    ctx.closePath();
  };

  // outer violet glow (shadowBlur = glow) — ANTI-SLOP: era cyan dominante
  ctx.save();
  ctx.shadowColor = 'rgba(124,72,255,0.55)';
  ctx.shadowBlur = 30;
  ctx.strokeStyle = 'rgba(124,72,255,0.75)';
  ctx.lineWidth = 6;
  roundRect(inset, inset, w, h, r);
  ctx.stroke();
  ctx.restore();

  // inner cyan hairline accent — agora o cyan é o detalhe, não o herói
  ctx.strokeStyle = 'rgba(0,210,255,0.30)';
  ctx.lineWidth = 2;
  roundRect(inset + 9, inset + 9, w - 18, h - 18, Math.max(0, r - 9));
  ctx.stroke();

  // corner accent dots (violeta)
  const dot = (x, y) => {
    ctx.fillStyle = 'rgba(140,124,255,0.8)';
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, Math.PI * 2);
    ctx.fill();
  };
  dot(inset + 14, inset + 14);
  dot(inset + w - 14, inset + 14);
  dot(inset + 14, inset + h - 14);
  dot(inset + w - 14, inset + h - 14);

  _frameTexture = new THREE.CanvasTexture(canvas);
  _frameTexture.colorSpace = THREE.SRGBColorSpace;
  return _frameTexture;
}

/**
 * Normalize any color-ish input (hex string, number, THREE.Color) to THREE.Color.
 */
export function toColor(value) {
  if (value instanceof THREE.Color) return value;
  return new THREE.Color(value);
}

/** Returns the THREE.Color base color for a gem colorIndex (defensive fallback). */
export function getBaseColor(colorIndex) {
  const def = GEM_DEFS[colorIndex] ?? GEM_DEFS[GEM_DEFS.length - 1];
  return new THREE.Color(def[1]);
}

/** Returns the emissive THREE.Color for a gem colorIndex. */
export function getEmissiveColor(colorIndex) {
  const def = GEM_DEFS[colorIndex] ?? GEM_DEFS[GEM_DEFS.length - 1];
  return new THREE.Color(def[2]);
}

/**
 * createGemMaterial(colorIndex) → THREE.MeshPhysicalMaterial
 *
 * JEWEL v3 (contract v3, reference image): polished faceted stone, not
 * flat matte cartoon. Deltas from v2 flat:
 *  - roughness 0.4 → 0.26 — faces catch light, facets read as cut stone
 *  - specularIntensity 0.4 → 0.7 — bright edge flashes on facet planes
 *  - envMapIntensity 0.4 → 0.6 — studio reflections give the facets depth
 *  - emissiveIntensity 0.22 → 0.28 — inner glow present, no bloom wash
 *  - vertexColors tintFacets kept (guaranteed per-face contrast, GPU-indep)
 *  - flatShading → faceted, not plastic-smooth
 *  - shell stays slightly translucent (opacity 0.9) so the inner fire
 *    heart shows through — the reference reads as a glowing cut jewel.
 *
 * Returns a FRESH material every call so per-gem match-flash emissive
 * pulses never bleed into sibling gems.
 */
export function createGemMaterial(colorIndex) {
  const def = GEM_DEFS[colorIndex] ?? GEM_DEFS[GEM_DEFS.length - 1];
  // Satura a cor base um pouco (multiply) — gems mais ricas/vivas, como Bejeweled.
  const base = new THREE.Color(def[1]);
  base.offsetHSL(0, 0.04, 0); // +4% saturação (defs já são cartoon-saturadas)
  // Esmeralda (cor 2): emissive um pouco mais alto — a mesa step-cut
  // (face mais clara) ganha contraste contra os degraus no tamanho real
  // da peça (sugestão de auditoria visual; só afeta a verde).
  const emi = colorIndex === 2 ? 0.34 : 0.28;
  return new THREE.MeshPhysicalMaterial({
    color: base,
    emissive: new THREE.Color(def[2]),
    emissiveIntensity: emi, // glow interno presente; bloom threshold alto evita washout
    roughness: 0.26, // polido — facetas pegam luz como pedra cortada
    metalness: 0.0,
    transmission: 0.0, // FLAT: sem vidro/refração — corpo opaco
    transparent: true, // shell levemente translúcido p/ o coração interno
    opacity: 0.9,      // heart ainda aparece, facetas menos lavadas
    thickness: 1.0,
    ior: 1.45,
    iridescence: 0.0, // sem arco-íris de cristal (referência é cor sólida viva)
    iridescenceIOR: 1.3,
    clearcoat: 0.35, // leve verniz — reflexo especular brilhante da ref
    clearcoatRoughness: 0.18,
    specularIntensity: 0.7, // flashes brilhantes nas facetas (ref: rim + highlights)
    specularColor: new THREE.Color(def[3]),
    envMapIntensity: 0.6, // reflexo de estúdio — profundidade de pedra real
    vertexColors: true,   // usa tintFacets (contraste de faceta garantido)
    flatShading: true,
  });
}

/**
 * Opaque "inner fire" core material for the gem's center stone.
 * JEWEL v3: the reference reads as a glowing cut jewel — the heart is
 * the inner fire (bright saturated core seen through the shell).
 * Brighter than v2 flat (0.45 → 0.62): the fire carries the "light
 * from inside" look without washing the outer facets (bloom threshold
 * stays high).
 */
export function createCoreMaterial(colorIndex) {
  const def = GEM_DEFS[colorIndex] ?? GEM_DEFS[GEM_DEFS.length - 1];
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(def[1]),
    emissive: new THREE.Color(def[2]),
    emissiveIntensity: 0.62, // fire interno brilhante (ref: centro iluminado)
    roughness: 0.35, // leve — não é gota de vidro
    metalness: 0.0,
    transmission: 0.0,
    iridescence: 0.0,
    clearcoat: 0.2,  // leve verniz no core também
    clearcoatRoughness: 0.1,
    specularIntensity: 0.5,
    specularColor: new THREE.Color(def[3]),
    flatShading: true,
  });
}

/**
 * Shared bold RIM material for gems — color per gem (contract v3,
 * reference image: each jewel has a COLORED bright rim, not a black
 * ink outline). BackSide clone of the body geometry = the far-side
 * back faces poke out around the silhouette and read as a colored
 * light ring around every shape. Cache per colorIndex (shared between
 * gems of the same color; flash never touches this).
 */
const _outlineMaterials = new Map();
export function createOutlineMaterial(colorIndex) {
  const def = GEM_DEFS[colorIndex] ?? GEM_DEFS[GEM_DEFS.length - 1];
  let mat = _outlineMaterials.get(colorIndex);
  if (!mat) {
    // Rim = cor do contorno da referência (campo 6), levemente clareada
    // para ler como anel de luz e não como contorno chapado.
    const rim = new THREE.Color(def[5] || def[2]);
    mat = new THREE.MeshBasicMaterial({
      color: rim,
      side: THREE.BackSide,
    });
    _outlineMaterials.set(colorIndex, mat);
  }
  return mat;
}

/**
 * Material for ghost / preview gems (translucent column preview).
 * Stronger than before: higher base opacity + additive blending reads
 * as a glowing hologram instead of a faint outline.
 */
export function createGhostMaterial(colorIndex, opacity = 0.5) {
  const def = GEM_DEFS[colorIndex] ?? GEM_DEFS[GEM_DEFS.length - 1];
  return new THREE.MeshBasicMaterial({
    color: new THREE.Color(def[1]),
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

/** Material for selection highlight ring (animated elsewhere). */
export function createRingMaterial() {
  return new THREE.MeshBasicMaterial({
    color: 0x8a7cff, // violeta suave — seleção não compete com a gem
    transparent: true,
    opacity: 0.0,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}
