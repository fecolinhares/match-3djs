// ============================================================
// Match-3D.js — SceneManager.js
// Contract: SceneManager.init(container) → { scene, camera, renderer }
// Design: CARTOON ARCADE backdrop — warm stone/brick wall
//   (tan/gold/ochre/brown blocks, dark mortar, deterministic canvas
//   texture) framing the dark board like an arcade cabinet. The wall
//   is bright/warm so the dark navy board reads as a recessed window;
//   a warm vignette keeps the screen edges dark so gems pop.
//   Camera/lighting untouched: FOV 42 camera at [0,0,16] → [0,-1.5,0],
//   warm directional key (top-left), cool hemisphere fill, violet rim
//   point behind the board, low ambient. WebGL2, antialias,
//   pixelRatio capped at 2, ACES tone mapping.
// ============================================================

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RENDER } from '../config.js';

const BG_DEEP = 0x241708; // warm dark fallback (mortar brown) — no blue-black void

/**
 * init(container) → { scene, camera, renderer }
 * Container: a DOM element (or a canvas is appended to it).
 */
export function init(container) {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, RENDER.PIXEL_RATIO));
  renderer.setSize(container.clientWidth || 1, container.clientHeight || 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG_DEEP);

  // Warm stone/brick backdrop — full-screen arcade-cabinet wall.
  const backdrop = buildBrickBackdrop();
  scene.add(backdrop);

  const camera = new THREE.PerspectiveCamera(
    RENDER.FOV,
    (container.clientWidth || 1) / (container.clientHeight || 1),
    0.1,
    100
  );
  camera.position.set(RENDER.CAMERA_POS[0], RENDER.CAMERA_POS[1], RENDER.CAMERA_POS[2]);
  camera.lookAt(RENDER.CAMERA_LOOKAT[0], RENDER.CAMERA_LOOKAT[1], RENDER.CAMERA_LOOKAT[2]);

  // --- Lighting -----------------------------------------------------
  // Warm key, top-left, slightly amber for cinema warmth.
  // Alta intensidade + direção dura = facetas com sombras dramáticas
  // (cada face do octaedro pega luz diferente → vende volume da pedra).
  const key = new THREE.DirectionalLight(0xffe3b8, 3.4);
  key.position.set(-6, 10, 7);

  // Cool blue hemisphere fill — LEVE, para não lavar o contraste das facetas.
  // Reduzido (0.45→0.30): junto com o spot 90 antigo, o azul dominava a cena.
  const fill = new THREE.HemisphereLight(0x8fb2ff, 0x1a1226, 0.30);

  // Violet rim point behind the board — separates gems from the bg.
  const rim = new THREE.PointLight(0x7b2fff, RENDER.RIM_LIGHT_INTENSITY, 45, 2.0);
  rim.position.set(0, 2, -8);

  // Low violet ambient — luz ambiente suave (anti-slop: não tint cyan em tudo)
  const ambient = new THREE.AmbientLight(0x8f8fd8, RENDER.AMBIENT_INTENSITY);

  // Soft spotlight frontal — foca o tabuleiro (centro do board brilha,
  // bordas caem), look "holofote de palco" dos match-3 modernos.
  // ANTI-SLOP: intensidade 90 + cor azul (0xcfe8ff) lavava a cena inteira
  // em cyan — dominava a borda violeta e estourava o centro. Agora:
  // intensidade contida + tom neutro quente.
  const spot = new THREE.SpotLight(0xfff2e0, 42, 40, 0.55, 0.65, 1.2);
  spot.position.set(0, 9, 10);
  spot.target.position.set(0, RENDER.CAMERA_LOOKAT[1], 0);
  scene.add(spot, spot.target);

  scene.add(key, fill, rim, ambient);

  // Environment map — CRÍTICO para o MeshPhysicalMaterial das gems.
  // Sem envMap, transmission/iridescence/clearcoat/specular não têm o que
  // refletir e as gems parecem polígonos sólidos planos. RoomEnvironment
  // dá reflexos suaves de estúdio que fazem as gems parecerem pedra real.
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const envScene = new RoomEnvironment();
  const envRT = pmrem.fromScene(envScene, 0.04);
  scene.environment = envRT.texture;
  scene.environmentIntensity = 0.9; // sutil — gems brilham, não estouram
  // Aplicado globalmente; cada material usa envMapIntensity próprio.

  // Resize handling (kept internal; PostFX resizes separately via its own setSize).
  const onResize = () => {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  };
  window.addEventListener('resize', onResize);
  renderer.domElement.__match3dResize = onResize;

  return { scene, camera, renderer };
}

/** Manual resize (also call PostFX.setSize after this). */
export function resize(container, camera, renderer) {
  const w = container.clientWidth || 1;
  const h = container.clientHeight || 1;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}

// ------------------------------------------------------------
// Warm stone/brick backdrop (arcade-cabinet wall).
// Two BackSide spheres centered on the scene, camera inside both:
//   1. Brick dome  (radius 60)  — deterministic canvas brick wall,
//      tan/gold/ochre/brown stones, dark mortar, cartoon bevels,
//      stone grain speckles. Texture repeats x2 so tile seams land
//      off-screen (longitudes ±x), never in the camera view.
//   2. Vignette dome (radius 59.5) — warm radial darkening at the
//      screen edges, framing the dark board like a cabinet window.
// ------------------------------------------------------------

/** Deterministic PRNG (mulberry32) — same seed → same texture every run. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp255(v) {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

/** Shift a #RRGGBB color by ±delta lightness → 'rgb(r,g,b)'. */
function shade(hex, delta) {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${clamp255(((n >> 16) & 255) + delta)},${clamp255(((n >> 8) & 255) + delta)},${clamp255((n & 255) + delta)})`;
}

// Warm stone palette — DESATURADA e ESCURA (v2, 2026-08-03, user:
// "melhore o fundo de tijolos, não está tão legal no tema Columns").
// ANTES: tan/ouro/ocre claros (~87 de brilho) competiam com as gems.
// AGORA: marrons profundos/acinzentados (ardósia quente) — o board e as
// gems são os heróis visuais (impeccable: fundo recua), vibe arcade
// cabinet escuro do Columns clássico.
const STONE_PALETTE = [
  { base: '#6E5D4C', light: '#7D6B58', dark: '#564836' }, // taupe quente
  { base: '#635445', light: '#72614F', dark: '#4D4032' }, // marrom-acinzentado
  { base: '#5C4E40', light: '#6A5B4A', dark: '#463B2F' }, // café profundo
  { base: '#554839', light: '#635544', dark: '#40362A' }, // sombra quente
  { base: '#6A5949', light: '#786650', dark: '#524535' }, // stone quente
];

const MORTAR = '#1B1510'; // argamassa quase preta quente — profundidade

/** One stone: top-lit cartoon shading + hard bevel edges + grain speckles. */
function drawBrick(ctx, rand, x, y, w, h) {
  const p = STONE_PALETTE[(rand() * STONE_PALETTE.length) | 0];
  const jit = (rand() - 0.5) * 16; // per-stone warmth jitter

  // Soft top-lit gradient (lit above, shaded below — "raised stone").
  const base = shade(p.base, jit);
  const lit = shade(p.light, jit * 0.7);
  const dark = shade(p.dark, jit * 0.7);
  const grad = ctx.createLinearGradient(0, y, 0, y + h);
  grad.addColorStop(0, lit);
  grad.addColorStop(0.35, base);
  grad.addColorStop(1, dark);
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);

  // Hard cartoon bevel edges.
  ctx.fillStyle = lit;
  ctx.fillRect(x, y, w, 3); // top
  ctx.fillRect(x, y, 3, h); // left
  ctx.fillStyle = dark;
  ctx.fillRect(x, y + h - 4, w, 4); // bottom
  ctx.fillRect(x + w - 3, y, 3, h); // right

  // Stone grain speckles (rough, uneven masonry).
  const n = 26 + ((rand() * 30) | 0);
  for (let i = 0; i < n; i++) {
    const sx = x + 2 + rand() * (w - 4);
    const sy = y + 3 + rand() * (h - 7);
    const sr = 0.8 + rand() * 1.9;
    ctx.fillStyle = rand() < 0.5
      ? shade(p.base, jit - 14 - rand() * 18)
      : shade(p.base, jit + 12 + rand() * 16);
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.fill();
  }
}

function buildBrickBackdrop() {
  const SIZE = 1024;
  const BW = 64; // stone width
  const BH = 32; // stone height
  const MORTAR_PX = 5;

  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  const rand = mulberry32(0x5eed1234); // fixed seed — deterministic

  // Mortar bed first, stones drawn inset → recessed dark joints.
  ctx.fillStyle = MORTAR;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Staggered running bond (offset half-stone every other course).
  const rows = Math.ceil(SIZE / BH) + 2;
  const cols = Math.ceil(SIZE / BW) + 2;
  for (let r = 0; r < rows; r++) {
    const y = r * BH + MORTAR_PX / 2;
    const stagger = r % 2 === 0 ? 0 : BW / 2;
    for (let c = -1; c < cols; c++) {
      const x = c * BW - stagger + MORTAR_PX / 2;
      drawBrick(ctx, rand, x, y, BW - MORTAR_PX, BH - MORTAR_PX);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  // x2 wrap: seams land at longitudes ±x (off-screen for the front camera),
  // and the visible patch keeps a dense ~6×6 stone masonry look.
  tex.repeat.set(2, 1);

  const brickDome = new THREE.Mesh(
    new THREE.SphereGeometry(60, 48, 24),
    new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false })
  );
  brickDome.position.set(0, -8, 0);
  brickDome.renderOrder = -10;

  // Warm vignette — cabinet framing, edges dark so the board pops.
  const V = 512;
  const vCanvas = document.createElement('canvas');
  vCanvas.width = vCanvas.height = V;
  const vCtx = vCanvas.getContext('2d');
  const vig = vCtx.createRadialGradient(V / 2, V / 2, V * 0.28, V / 2, V / 2, V * 0.75);
  vig.addColorStop(0.0, 'rgba(24, 13, 4, 0)');
  vig.addColorStop(0.55, 'rgba(24, 13, 4, 0)');
  vig.addColorStop(0.80, 'rgba(24, 13, 4, 0.28)');
  vig.addColorStop(1.0, 'rgba(16, 8, 2, 0.60)');
  vCtx.fillStyle = vig;
  vCtx.fillRect(0, 0, V, V);

  const vTex = new THREE.CanvasTexture(vCanvas);
  vTex.colorSpace = THREE.SRGBColorSpace;

  const vignetteDome = new THREE.Mesh(
    new THREE.SphereGeometry(59.5, 48, 24),
    new THREE.MeshBasicMaterial({
      map: vTex,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      fog: false,
    })
  );
  vignetteDome.position.set(0, -8, 0);
  vignetteDome.renderOrder = -9;

  const group = new THREE.Group();
  group.add(brickDome, vignetteDome);
  return group;
}
