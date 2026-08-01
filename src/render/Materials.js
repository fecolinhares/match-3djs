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
    emissiveIntensity: 0.35, // glow interno presente mas não dominante
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
 */
export function createGhostMaterial(colorIndex, opacity = 0.22) {
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
    color: 0x00D2FF,
    transparent: true,
    opacity: 0.0,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}
