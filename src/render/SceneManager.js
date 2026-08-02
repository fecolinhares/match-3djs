// ============================================================
// Match-3D.js — SceneManager.js
// Contract: SceneManager.init(container) → { scene, camera, renderer }
// Design: dark bg #0A0A12 with a subtle radial gradient dome,
//   FOV 42 camera at [0,0,16] → [0,-1.5,0], cinematic lighting:
//   warm directional key (top-left), cool hemisphere fill,
//   violet rim point behind the board, low cyan ambient.
//   WebGL2, antialias, pixelRatio capped at 2, ACES tone mapping.
// ============================================================

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RENDER } from '../config.js';

const BG_DEEP = 0x0a0a12;
const BG_CENTER = 0x191a2e; // slight lift at screen center (gradient dome)

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

  // Subtle radial gradient backdrop — deep well behind the board.
  const dome = buildBackdropDome();
  scene.add(dome);

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
  const fill = new THREE.HemisphereLight(0x8fb2ff, 0x1a1226, 0.45);

  // Violet rim point behind the board — separates gems from the bg.
  const rim = new THREE.PointLight(0x7b2fff, RENDER.RIM_LIGHT_INTENSITY, 45, 2.0);
  rim.position.set(0, 2, -8);

  // Low cyan ambient — DESIGN accent-cyan tint, very subtle.
  const ambient = new THREE.AmbientLight(0x00d2ff, RENDER.AMBIENT_INTENSITY);

  // Soft spotlight frontal — foca o tabuleiro (centro do board brilha,
  // bordas caem), look "holofote de palco" dos match-3 modernos.
  const spot = new THREE.SpotLight(0xcfe8ff, 90, 40, 0.55, 0.65, 1.2);
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
// Gradient backdrop dome: big sphere (BackSide) with a radial
// CanvasTexture, #191A2E center → #0A0A12 edges.
// ------------------------------------------------------------
function buildBackdropDome() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(
    size / 2,
    size / 2 * 0.42,
    size * 0.06,
    size / 2,
    size / 2,
    size * 0.72
  );
  grad.addColorStop(0.0, '#1E2036'); // leve lift cyan-violeta no centro
  grad.addColorStop(0.45, '#10101C');
  grad.addColorStop(1.0, '#0A0A12');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(60, 32, 16),
    new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false })
  );
  dome.position.set(0, -8, 0);
  dome.renderOrder = -10;
  return dome;
}
