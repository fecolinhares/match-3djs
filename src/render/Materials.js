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
 * CARTOON ARCADE — FLAT (contract TASK 2):
 *  - saturated cartoon base color (from GEM_DEFS, already vivid)
 *  - strong dark edge shading via vertexColors tintFacets
 *    (dark facets darker, light facets lighter → outlined jewel)
 *  - FLAT: NO transmission, NO iridescence, NO clearcoat, specular
 *    barely present, roughness up (0.5) → matte cartoon candy, NOT a
 *    polished 3D crystal. The bold ink look comes from the separate
 *    dark outline mesh (createOutlineMaterial), not from gloss.
 *  - envMapIntensity kept modest — a whisper of depth, no mirror shine
 *  - body is a flat TRANSLUCENT shell (opacity 0.88, no transmission):
 *    mostly-opaque painted cartoon color, with just enough see-through
 *    for the inner highlight heart to read — the same ~12% show-through
 *    the old transmission gave, but flat (no refraction distortion).
 *  - flatShading → faceted, not plastic-smooth
 *
 * Returns a FRESH material every call so per-gem match-flash emissive
 * pulses never bleed into sibling gems.
 */
export function createGemMaterial(colorIndex) {
  const def = GEM_DEFS[colorIndex] ?? GEM_DEFS[GEM_DEFS.length - 1];
  // Satura a cor base um pouco (multiply) — gems mais ricas/vivas, como Bejeweled.
  const base = new THREE.Color(def[1]);
  base.offsetHSL(0, 0.04, 0); // +4% saturação (defs já são cartoon-saturadas)
  return new THREE.MeshPhysicalMaterial({
    color: base,
    emissive: new THREE.Color(def[2]),
    emissiveIntensity: 0.22, // glow interno presente mas discreto (não lava com bloom)
    roughness: 0.5, // flat cartoon — matte, sem candy gloss
    metalness: 0.0,
    transmission: 0.0, // FLAT: sem vidro/refração — corpo opaco
    transparent: true, // shell levemente translúcido p/ o coração interno
    opacity: 0.88,     // aparece o heart (~12% see-through, flat, sem refração)
    thickness: 1.0,
    ior: 1.45,
    iridescence: 0.0, // FLAT: sem arco-íris de cristal
    iridescenceIOR: 1.3,
    clearcoat: 0.0, // FLAT: sem camada brilhante
    clearcoatRoughness: 0.18,
    specularIntensity: 0.3, // FLAT: só um toque de luz especular
    specularColor: new THREE.Color(def[3]),
    envMapIntensity: 0.4, // modesto — profundidade sem espelho
    vertexColors: true,   // usa tintFacets (contorno escuro garantido)
    flatShading: true,
  });
}

/**
 * Opaque "inner fire" core material for the gem's center stone.
 * CARTOON: reads as the "highlight interno" of classic Columns gems —
 * a bright saturated heart inside the opaque flat shell. FLAT per
 * contract TASK 2: rougher + no clearcoat/iridescence so it stays a
 * solid painted heart, not a glossy droplet.
 */
export function createCoreMaterial(colorIndex) {
  const def = GEM_DEFS[colorIndex] ?? GEM_DEFS[GEM_DEFS.length - 1];
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(def[1]),
    emissive: new THREE.Color(def[2]),
    emissiveIntensity: 0.7, // coração brilhante — highlight interno cartoon
    roughness: 0.45, // flat — sem brilho de gota
    metalness: 0.0,
    transmission: 0.0,
    iridescence: 0.0, // flat
    clearcoat: 0.0,   // flat
    clearcoatRoughness: 0.1,
    specularIntensity: 0.3, // flat
    specularColor: new THREE.Color(def[3]),
    flatShading: true,
  });
}

/**
 * Shared bold ink outline material for cartoon gems (contract TASK 2).
 * Classic cartoon trick: a slightly scaled-up clone of the body
 * geometry rendered with BackSide + flat dark color (#1A120B) — the
 * far-side back faces poke out around the silhouette and read as a
 * thick dark outline. Shared singleton: color never changes, so one
 * material is safe for every gem (flash only touches body/core
 * emissive, never this).
 */
let _outlineMaterial = null;
export function createOutlineMaterial() {
  if (_outlineMaterial) return _outlineMaterial;
  _outlineMaterial = new THREE.MeshBasicMaterial({
    color: 0x1a120b, // #1A120B — bold ink outline
    side: THREE.BackSide,
  });
  return _outlineMaterial;
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
