// ============================================================
// Match-3D.js — Particles.js
// Contract:
//   Particles.init(scene)
//   Particles.explode(position, colorIndex, count)  — fragments + sparkles
//   Particles.sparkle(position, color)              — point flash
//   Particles.update(dt, time)
//   Particles.dispose()
// Design: gem shard fragments + additive sparkles + shockwave ring +
//         light pool + ambient cosmic dust (~200 pts).
//         Everything pooled; hard cap ~490 particles total.
// ============================================================

import * as THREE from 'three';
import { GEM_DEFS, TUNING } from '../config.js';
import { makeGlowTexture, toColor } from './Materials.js';
import { clamp01, easeOutCubic, isReducedMotion } from './GemMesh.js';

// Pool budgets (total ≈ 40 + 240 + 200 + 4 + 6 = 490 < 500)
const FRAGMENT_POOL = 40;
const SPARK_POOL = 240;
const RING_POOL = 4;
const POOL_SPRITE_POOL = 6;
const DUST_COUNT = 200;

const GRAVITY = -7.5; // world units/s² (floaty, not punishing)
const DUST_DRIFT = 0.06;

// ------------------------------------------------------------
// Module state
// ------------------------------------------------------------
const state = {
  scene: null,
  reduced: false,
  fragments: [],
  fragCursor: 0,
  sparkGeometry: null,
  sparkMaterial: null,
  sparkPoints: null,
  spark: {
    positions: null,
    colors: null,
    sizes: null,
    alphas: null,
    vel: null,
    life: null,
    age: null,
    cursor: 0,
    active: 0,
  },
  rings: [],
  ringCursor: 0,
  pools: [],
  poolCursor: 0,
  dustPoints: null,
  dustBase: null,
  dustPhases: null,
  dustVel: null,
  fragMaterials: new Map(),
};

// ------------------------------------------------------------
// Fragment materials — one shared MeshPhysicalMaterial per color
// (scale-fade instead of opacity-fade → no per-fragment clones)
// ------------------------------------------------------------
function getFragmentMaterial(colorIndex) {
  let mat = state.fragMaterials.get(colorIndex);
  if (!mat) {
    const def = GEM_DEFS[colorIndex] ?? GEM_DEFS[GEM_DEFS.length - 1];
    mat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(def[1]),
      emissive: new THREE.Color(def[2]),
      emissiveIntensity: 0.55,
      roughness: 0.35,
      metalness: 0.0,
      transmission: 0.0,
      flatShading: true,
    });
    state.fragMaterials.set(colorIndex, mat);
  }
  return mat;
}

// ------------------------------------------------------------
// Sparkle shader — per-particle color/size/alpha
// ------------------------------------------------------------
const SPARK_VERT = /* glsl */ `
  attribute vec3 aColor;
  attribute float aSize;
  attribute float aAlpha;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vColor = aColor;
    vAlpha = aAlpha;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (170.0 / max(0.1, -mv.z));
    gl_Position = projectionMatrix * mv;
  }
`;

const SPARK_FRAG = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    float core = smoothstep(0.5, 0.05, d);
    float a = core * vAlpha;
    if (a < 0.004) discard;
    gl_FragColor = vec4(vColor * (0.6 + 1.4 * core), a);
  }
`;

// ------------------------------------------------------------
// init(scene)
// ------------------------------------------------------------
export function init(scene) {
  state.scene = scene;
  state.reduced = isReducedMotion();

  // --- fragments -------------------------------------------------
  const fragGeo = new THREE.OctahedronGeometry(0.13, 0);
  for (let i = 0; i < FRAGMENT_POOL; i++) {
    const mesh = new THREE.Mesh(fragGeo, getFragmentMaterial(0));
    mesh.visible = false;
    mesh.userData = {
      vel: new THREE.Vector3(),
      angVel: new THREE.Vector3(),
      life: 0,
      age: 0,
      colorIndex: 0,
    };
    scene.add(mesh);
    state.fragments.push(mesh);
  }

  // --- sparkles (single Points system, ring-buffer pool) ----------
  const sp = state.spark;
  sp.positions = new Float32Array(SPARK_POOL * 3);
  sp.colors = new Float32Array(SPARK_POOL * 3);
  sp.sizes = new Float32Array(SPARK_POOL);
  sp.alphas = new Float32Array(SPARK_POOL);
  sp.vel = new Float32Array(SPARK_POOL * 3);
  sp.life = new Float32Array(SPARK_POOL);
  sp.age = new Float32Array(SPARK_POOL);

  state.sparkGeometry = new THREE.BufferGeometry();
  state.sparkGeometry.setAttribute('position', new THREE.BufferAttribute(sp.positions, 3));
  state.sparkGeometry.setAttribute('aColor', new THREE.BufferAttribute(sp.colors, 3));
  state.sparkGeometry.setAttribute('aSize', new THREE.BufferAttribute(sp.sizes, 1));
  state.sparkGeometry.setAttribute('aAlpha', new THREE.BufferAttribute(sp.alphas, 1));

  state.sparkMaterial = new THREE.ShaderMaterial({
    vertexShader: SPARK_VERT,
    fragmentShader: SPARK_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  state.sparkPoints = new THREE.Points(state.sparkGeometry, state.sparkMaterial);
  state.sparkPoints.frustumCulled = false;
  scene.add(state.sparkPoints);

  // --- shockwave rings ----------------------------------------------
  const ringGeo = new THREE.RingGeometry(0.5, 0.6, 48);
  for (let i = 0; i < RING_POOL; i++) {
    const mesh = new THREE.Mesh(
      ringGeo,
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      })
    );
    mesh.visible = false;
    mesh.userData = { age: 0, life: 0 };
    scene.add(mesh);
    state.rings.push(mesh);
  }

  // --- light pools (glow sprites resting on the board) --------------
  const glowTex = makeGlowTexture();
  for (let i = 0; i < POOL_SPRITE_POOL; i++) {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTex,
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    sprite.visible = false;
    sprite.userData = { age: 0, life: 0 };
    scene.add(sprite);
    state.pools.push(sprite);
  }

  // --- ambient dust ---------------------------------------------------
  const dustGeo = new THREE.BufferGeometry();
  const dustPos = new Float32Array(DUST_COUNT * 3);
  state.dustBase = new Float32Array(DUST_COUNT * 3);
  state.dustPhases = new Float32Array(DUST_COUNT);
  state.dustVel = new Float32Array(DUST_COUNT * 3);
  for (let i = 0; i < DUST_COUNT; i++) {
    const x = (Math.random() * 2 - 1) * 8.5;
    const y = (Math.random() * 2 - 1) * 6.5 - 1.5;
    const z = (Math.random() * 2 - 1) * 2.5 - 2.2;
    dustPos[i * 3] = state.dustBase[i * 3] = x;
    dustPos[i * 3 + 1] = state.dustBase[i * 3 + 1] = y;
    dustPos[i * 3 + 2] = state.dustBase[i * 3 + 2] = z;
    state.dustPhases[i] = Math.random() * Math.PI * 2;
    state.dustVel[i * 3] = (Math.random() * 2 - 1) * 0.12;
    state.dustVel[i * 3 + 1] = (Math.random() * 2 - 1) * 0.1;
    state.dustVel[i * 3 + 2] = (Math.random() * 2 - 1) * 0.05;
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dustMat = new THREE.PointsMaterial({
    color: 0x8fa8cc,
    size: 0.045,
    transparent: true,
    opacity: 0.4,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });
  state.dustPoints = new THREE.Points(dustGeo, dustMat);
  state.dustPoints.frustumCulled = false;
  scene.add(state.dustPoints);
}

// ------------------------------------------------------------
// explode(position, colorIndex, count)
// ------------------------------------------------------------
export function explode(position, colorIndex, count = TUNING.EXPLOSION_PARTICLES) {
  if (!state.scene) return;
  const n = state.reduced ? Math.max(4, Math.ceil(count / 2)) : count;
  const pos = toVector3(position);
  const def = GEM_DEFS[colorIndex] ?? GEM_DEFS[GEM_DEFS.length - 1];

  spawnFragments(pos, colorIndex, n);
  spawnSparkles(pos, def[2], Math.max(4, Math.floor(n / 2) + 3));
  spawnRing(pos, def[2]);
  spawnPoolSprite(pos, def[2]);
}

// ------------------------------------------------------------
// sparkle(position, color) — quick point flash
// ------------------------------------------------------------
export function sparkle(position, color) {
  if (!state.scene) return;
  const pos = toVector3(position);
  const col = toColor(color);
  spawnSparkles(pos, '#' + col.getHexString(), state.reduced ? 1 : 3, 0.35);
}

// ------------------------------------------------------------
// update(dt, time)
// ------------------------------------------------------------
export function update(dt, time) {
  if (!state.scene) return;

  // --- fragments ------------------------------------------------
  for (const f of state.fragments) {
    if (!f.visible) continue;
    const u = f.userData;
    u.age += dt;
    const p = clamp01(u.age / u.life);
    u.vel.y += GRAVITY * dt;
    f.position.addScaledVector(u.vel, dt);
    f.rotation.x += u.angVel.x * dt;
    f.rotation.y += u.angVel.y * dt;
    // shrink-fade in the last 35% of life
    const s = p > 0.65 ? 1 - easeOutCubic((p - 0.65) / 0.35) : 1;
    f.scale.setScalar(Math.max(0.001, s));
    if (p >= 1) f.visible = false;
  }

  // --- sparkles ---------------------------------------------------
  const sp = state.spark;
  let dirty = false;
  for (let i = 0; i < SPARK_POOL; i++) {
    if (sp.age[i] >= sp.life[i]) continue;
    sp.age[i] += dt;
    const p = clamp01(sp.age[i] / sp.life[i]);
    sp.positions[i * 3] += sp.vel[i * 3] * dt;
    sp.positions[i * 3 + 1] += sp.vel[i * 3 + 1] * dt;
    sp.positions[i * 3 + 2] += sp.vel[i * 3 + 2] * dt;
    const fade = (1 - p) * (1 - p);
    sp.alphas[i] = 0.9 * fade;
    sp.sizes[i] = sp.sizes[i] * 0.99 + 0.5 * 0.01;
    dirty = true;
  }
  if (dirty) {
    sp.positions.needsUpdate = true;
    sp.alphas.needsUpdate = true;
    sp.sizes.needsUpdate = true;
  }

  // --- rings -----------------------------------------------------
  for (const r of state.rings) {
    if (!r.visible) continue;
    const u = r.userData;
    u.age += dt;
    const p = clamp01(u.age / u.life);
    const s = 0.4 + 3.4 * easeOutCubic(p);
    r.scale.setScalar(s);
    r.material.opacity = 0.55 * (1 - p);
    if (p >= 1) r.visible = false;
  }

  // --- light pools ------------------------------------------------
  for (const s of state.pools) {
    if (!s.visible) continue;
    const u = s.userData;
    u.age += dt;
    const p = clamp01(u.age / u.life);
    s.material.opacity = 0.5 * (1 - p) * (1 - p);
    s.scale.setScalar(2.0 + 0.8 * p);
    if (p >= 1) s.visible = false;
  }

  // --- dust drift ------------------------------------------------
  const posAttr = state.dustPoints.geometry.attributes.position;
  for (let i = 0; i < DUST_COUNT; i++) {
    const i3 = i * 3;
    posAttr.array[i3] = state.dustBase[i3] + Math.sin(time * 0.35 + state.dustPhases[i]) * 0.35;
    posAttr.array[i3 + 1] =
      state.dustBase[i3 + 1] + Math.sin(time * 0.28 + state.dustPhases[i] * 1.7) * 0.25;
    posAttr.array[i3 + 2] =
      state.dustBase[i3 + 2] + Math.sin(time * 0.2 + state.dustPhases[i] * 0.9) * 0.15;
  }
  posAttr.needsUpdate = true;
}

// ------------------------------------------------------------
// dispose()
// ------------------------------------------------------------
export function dispose() {
  if (!state.scene) return;
  for (const f of state.fragments) state.scene.remove(f);
  if (state.sparkPoints) state.scene.remove(state.sparkPoints);
  for (const r of state.rings) state.scene.remove(r);
  for (const s of state.pools) state.scene.remove(s);
  if (state.dustPoints) state.scene.remove(state.dustPoints);
  state.scene = null;
  state.fragments.length = 0;
  state.rings.length = 0;
  state.pools.length = 0;
  state.fragMaterials.clear();
}

// ------------------------------------------------------------
// Internals
// ------------------------------------------------------------
function toVector3(v) {
  if (v instanceof THREE.Vector3) return v;
  return new THREE.Vector3(v.x, v.y, v.z ?? 0);
}

function spawnFragments(pos, colorIndex, n) {
  const count = Math.min(n, FRAGMENT_POOL);
  for (let i = 0; i < count; i++) {
    const f = state.fragments[state.fragCursor];
    state.fragCursor = (state.fragCursor + 1) % FRAGMENT_POOL;
    const u = f.userData;
    u.colorIndex = colorIndex;
    f.material = getFragmentMaterial(colorIndex);
    f.position.copy(pos);
    // up-biased burst, slight randomness
    u.vel.set(
      (Math.random() * 2 - 1) * 2.6,
      Math.random() * 4.2 + 1.2,
      (Math.random() * 2 - 1) * 2.6
    );
    u.angVel.set(
      (Math.random() * 2 - 1) * 9,
      (Math.random() * 2 - 1) * 9,
      (Math.random() * 2 - 1) * 9
    );
    u.life = 0.5 + Math.random() * 0.45;
    u.age = 0;
    f.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
    f.scale.setScalar(0.8 + Math.random() * 0.6);
    f.visible = true;
  }
}

function spawnSparkles(pos, hexColor, n, scale = 1) {
  const col = new THREE.Color(hexColor);
  const sp = state.spark;
  for (let i = 0; i < n; i++) {
    const idx = sp.cursor;
    sp.cursor = (sp.cursor + 1) % SPARK_POOL;
    sp.positions[idx * 3] = pos.x + (Math.random() * 2 - 1) * 0.2;
    sp.positions[idx * 3 + 1] = pos.y + (Math.random() * 2 - 1) * 0.2;
    sp.positions[idx * 3 + 2] = pos.z + (Math.random() * 2 - 1) * 0.2;
    sp.colors[idx * 3] = col.r;
    sp.colors[idx * 3 + 1] = col.g;
    sp.colors[idx * 3 + 2] = col.b;
    sp.sizes[idx] = (0.9 + Math.random() * 1.4) * scale;
    sp.alphas[idx] = 0.9;
    sp.vel[idx * 3] = (Math.random() * 2 - 1) * 1.8 * scale;
    sp.vel[idx * 3 + 1] = Math.random() * 2.6 * scale + 0.4;
    sp.vel[idx * 3 + 2] = (Math.random() * 2 - 1) * 1.2 * scale;
    sp.life[idx] = 0.35 + Math.random() * 0.4;
    sp.age[idx] = 0;
  }
  sp.positions.needsUpdate = true;
  sp.colors.needsUpdate = true;
  sp.sizes.needsUpdate = true;
  sp.alphas.needsUpdate = true;
}

function spawnRing(pos, hexColor) {
  if (state.reduced) return;
  const r = state.rings[state.ringCursor];
  state.ringCursor = (state.ringCursor + 1) % RING_POOL;
  r.material.color.set(hexColor);
  r.position.set(pos.x, pos.y, pos.z + 0.05);
  r.userData.age = 0;
  r.userData.life = 0.42;
  r.scale.setScalar(0.4);
  r.material.opacity = 0.55;
  r.visible = true;
}

function spawnPoolSprite(pos, hexColor) {
  const s = state.pools[state.poolCursor];
  state.poolCursor = (state.poolCursor + 1) % POOL_SPRITE_POOL;
  s.material.color.set(hexColor);
  s.position.set(pos.x, pos.y, -0.35);
  s.userData.age = 0;
  s.userData.life = 0.6;
  s.material.opacity = 0.5;
  s.visible = true;
}
