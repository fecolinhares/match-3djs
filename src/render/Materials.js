// ============================================================
// Match-3D.js — Materials.js
// PBR materials for the premium gem aesthetic.
// Contract: Materials.createGemMaterial(colorIndex) → THREE.MeshPhysicalMaterial
// Design: real precious stones — transmission (refraction), iridescence,
//         clearcoat, per-color emissive/specular from GEM_DEFS.
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

  // outer cyan glow (shadowBlur = glow)
  ctx.save();
  ctx.shadowColor = 'rgba(0,210,255,0.95)';
  ctx.shadowBlur = 30;
  ctx.strokeStyle = 'rgba(0,210,255,0.9)';
  ctx.lineWidth = 6;
  roundRect(inset, inset, w, h, r);
  ctx.stroke();
  ctx.restore();

  // inner violet hairline accent
  ctx.strokeStyle = 'rgba(123,47,255,0.5)';
  ctx.lineWidth = 2;
  roundRect(inset + 9, inset + 9, w - 18, h - 18, Math.max(0, r - 9));
  ctx.stroke();

  // corner accent dots (cyan)
  const dot = (x, y) => {
    ctx.fillStyle = 'rgba(0,210,255,0.9)';
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
 * Premium stone look per DESIGN.md §5:
 *  - roughness 0.1, metalness 0.0  (glass, not metal)
 *  - transmission 0.6 + ior/thickness → refractive depth
 *  - iridescence 0.5 → subtle rainbow sheen
 *  - emissive = GEM_DEFS emissive at low intensity (inner glow)
 *  - clearcoat 1.0, high specularIntensity, specular tinted by GEM_DEFS
 *  - flatShading → faceted, not plastic-smooth
 *
 * Returns a FRESH material every call so per-gem match-flash emissive
 * pulses never bleed into sibling gems.
 */
export function createGemMaterial(colorIndex) {
  const def = GEM_DEFS[colorIndex] ?? GEM_DEFS[GEM_DEFS.length - 1];
  // Satura a cor base um pouco (multiply) — gems mais ricas/vivas, como Bejeweled.
  const base = new THREE.Color(def[1]);
  base.offsetHSL(0, 0.08, 0); // +8% saturação
  return new THREE.MeshPhysicalMaterial({
    color: base,
    emissive: new THREE.Color(def[2]),
    emissiveIntensity: 0.28, // glow interno presente mas discreto (não lava com bloom)
    roughness: 0.12,
    metalness: 0.0,
    transmission: 0.35, // moderado — refração quando GPU suporta; sem depender dela
    thickness: 1.4,
    ior: 1.55,
    iridescence: 0.55,
    iridescenceIOR: 1.3,
    clearcoat: 1.0,
    clearcoatRoughness: 0.1,
    specularIntensity: 2.2,
    specularColor: new THREE.Color(def[3]),
    envMapIntensity: 1.5, // reflexos mais evidentes do RoomEnvironment
    vertexColors: true,   // usa tintFacets (contraste de faceta garantido)
    flatShading: true,
  });
}

/**
 * Opaque "inner fire" core material for the gem's center stone.
 * Opaque on purpose: it lands in the opaque pass, so the transmissive
 * shell genuinely refracts it — real gem depth instead of a decal.
 */
export function createCoreMaterial(colorIndex) {
  const def = GEM_DEFS[colorIndex] ?? GEM_DEFS[GEM_DEFS.length - 1];
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(def[1]),
    emissive: new THREE.Color(def[2]),
    emissiveIntensity: 0.55,
    roughness: 0.06,
    metalness: 0.0,
    transmission: 0.0,
    iridescence: 0.3,
    clearcoat: 1.0,
    clearcoatRoughness: 0.1,
    specularIntensity: 1.2,
    specularColor: new THREE.Color(def[3]),
    flatShading: true,
  });
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
