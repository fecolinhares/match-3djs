// ============================================================
// Match-3D.js — PostFX.js
// Contract: selective bloom (gems/particles glow — HUD DOM never
//   does), vignette, ACES tone mapping.
//   EffectComposer + RenderPass + UnrealBloomPass + vignette
//   ShaderPass + OutputPass. Strengths from RENDER config.
// ============================================================

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RENDER } from '../config.js';

/**
 * createPostFX(renderer, scene, camera) → { composer, bloom, setSize, dispose }
 *
 * Selective bloom: threshold-based (BLOOM_THRESHOLD) — emissive gems and
 * additive particles exceed it and bloom; the dark board/surface does not.
 * The HUD is a DOM overlay, so it is never part of the 3D buffer at all.
 */
export function createPostFX(renderer, scene, camera) {
  const w = renderer.domElement.clientWidth || 1;
  const h = renderer.domElement.clientHeight || 1;

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const bloom = new UnrealBloomPass(
    new THREE.Vector2(w, h),
    RENDER.BLOOM_STRENGTH,
    RENDER.BLOOM_RADIUS,
    RENDER.BLOOM_THRESHOLD
  );
  composer.addPass(bloom);

  // Vignette — darkens edges (DESIGN bg-vignette token), in linear space
  // before the OutputPass converts to sRGB + tone maps.
  const vignette = new ShaderPass({
    name: 'Match3DVignette',
    uniforms: {
      tDiffuse: { value: null },
      intensity: { value: 0.85 },
      smoothness: { value: 0.4 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D tDiffuse;
      uniform float intensity;
      uniform float smoothness;
      varying vec2 vUv;
      void main() {
        vec4 c = texture2D(tDiffuse, vUv);
        vec2 d = vUv - 0.5;
        float dist = length(d * vec2(1.0, 1.15));
        float edge = smoothstep(0.62 - smoothness, 0.62 + smoothness, dist);
        float vig = edge * intensity;
        gl_FragColor = vec4(c.rgb * (1.0 - vig * 0.62), c.a);
      }
    `,
  });
  composer.addPass(vignette);

  // OutputPass: ACES tone mapping + sRGB output conversion (last pass).
  composer.addPass(new OutputPass());

  return {
    composer,
    bloom,
    setSize(width, height) {
      composer.setSize(width, height);
    },
    setBloomStrength(v) {
      bloom.strength = v;
    },
    setBloomEnabled(on) {
      bloom.enabled = Boolean(on);
    },
    dispose() {
      composer.dispose();
    },
  };
}
