// ============================================================
// Match-3D.js — main.js (bootstrap + game loop)
// Integra: GameState (engine) + SceneManager/Materials/GemMesh/
// BoardMesh/Particles/PostFX (render) + InputManager (input) +
// HUD/Menu (ui) + AudioManager (audio)
// ============================================================

import { GameState } from './game/GameState.js';
import * as SceneManager from './render/SceneManager.js';
import * as Materials from './render/Materials.js';
import * as GemMesh from './render/GemMesh.js';
import { BoardMesh } from './render/BoardMesh.js';
import * as Particles from './render/Particles.js';
import { createPostFX } from './render/PostFX.js';
import { InputManager } from './input/InputManager.js';
import { HUD } from './ui/HUD.js';
import { Menu } from './ui/Menu.js';
import { AudioManager } from './audio/AudioManager.js';
import { BOARD, RENDER, TUNING } from './config.js';

// ------------------------------------------------------------
// Setup DOM
// ------------------------------------------------------------
const app = document.getElementById('app');
app.style.position = 'relative';
app.style.width = '100vw';
app.style.height = '100vh';
app.style.overflow = 'hidden';
app.style.background = '#0A0A12';

// ------------------------------------------------------------
// Renderer + scene
// ------------------------------------------------------------
const { scene, camera, renderer } = SceneManager.init(app);
const postFX = createPostFX(renderer, scene, camera);

const boardMesh = new BoardMesh(scene);
Particles.init?.(scene);

// ------------------------------------------------------------
// Game + inputs + ui + audio
// ------------------------------------------------------------
const audio = new AudioManager();

const hud = new HUD({ container: app });
const menu = new Menu({
  container: app,
  onStart: () => startGame(),
});

let game = null;
let lastTime = performance.now();
let best = Number(localStorage.getItem('match3d-best') || 0);
let pausedFlash = false;
let matchResolving = false; // true durante flash+explosão de match
let flashCount = 0;         // flashes de cascata em andamento
let shake = { t: 0, dur: 0, amp: 0 };

// ------------------------------------------------------------
// Game lifecycle
// ------------------------------------------------------------
function startGame() {
  game = new GameState({
    callbacks: {
      onScore: (points, count, combo) => {
        audio.play('match');
        if (combo > 0) {
          audio.play('combo', { pitch: 1 + (combo - 1) * 0.12 });
          hud.showCombo(combo + 1);
        }
        const snap = game.snapshot();
        hud.update(snap.score, snap.level, snap.lines, snap.combo);
        // screen shake em matches
        const amp = combo > 2 ? TUNING.SHAKE_BIG_COMBO_PX : TUNING.SHAKE_MATCH_PX;
        shake = { t: 0, dur: TUNING.SHAKE_MS / 1000, amp };
      },
      onLevelUp: (n) => {
        audio.play('levelup');
      },
      onGameOver: (info) => {
        audio.play('gameover');
        if (info.score > best) {
          best = info.score;
          localStorage.setItem('match3d-best', String(best));
        }
        menu.show('gameover', { score: info.score, best });
        hud.hide();
      },
      onStateChange: (s) => {
        if (s === 'paused') {
          hud.show();
        }
      },
      onEvent: (ev) => handleGameEvent(ev),
    },
  });

  menu.hide();
  hud.show();

  // Inicializa o board (cria grid + primeira coluna) — OBRIGATÓRIO
  game.start();

  // Sincroniza o tabuleiro inicial
  boardMesh.sync(game.snapshot());
  updateHUD();
  audio.play('select');
}

function handleGameEvent(ev) {
  switch (ev.type) {
    case 'match':
      // Dispara o flash + explosão nas células do match.
      // NÃO chamamos sync() enquanto o flash roda — o sync reconciliaria
      // o grid já limpo pelo engine e mataria a explosão.
      // Em cascatas, múltiplos matches disparam em paralelo: contamos e
      // só sincronizamos quando o ÚLTIMO flash terminar.
      flashCount += 1;
      matchResolving = true;
      boardMesh.flashMatch(ev.cells, () => {
        flashCount -= 1;
        if (flashCount <= 0) {
          flashCount = 0;
          matchResolving = false;
          // Pós-explosão: sincroniza (gravidade já aplicada no engine)
          boardMesh.sync(game.snapshot());
        }
      });
      break;
    default:
      break;
  }
}

function updateHUD() {
  const snap = game?.snapshot();
  if (!snap) return;
  hud.update(snap.score, snap.level, snap.lines, snap.combo);
  hud.setNextPreview(snap.next);
}

// ------------------------------------------------------------
// Input wiring
// ------------------------------------------------------------
const input = new InputManager({
  currentColumn: null,
});

input.on('moveLeft', () => {
  if (game?.moveLeft()) {
    audio.play('move');
    input.setCurrentColumn(game.snapshot().falling?.x ?? null);
  }
});
input.on('moveRight', () => {
  if (game?.moveRight()) {
    audio.play('move');
    input.setCurrentColumn(game.snapshot().falling?.x ?? null);
  }
});
input.on('rotate', () => {
  if (game?.rotate()) {
    audio.play('rotate');
  }
});
input.on('softDrop', () => {
  if (game) {
    game.softDrop(1 / 60);
    audio.play('land');
  }
});
input.on('hardDrop', () => {
  if (game) {
    const events = game.hardDrop();
    audio.play('land');
    // re-sync após hard drop + possível match
    boardMesh.sync(game.snapshot());
  }
});
input.on('pause', () => {
  if (game) {
    game.togglePause();
    audio.play('select');
  }
});
input.on('restart', () => {
  startGame();
});
input.on('moveTo', (col) => {
  if (game?.moveTo(col)) {
    audio.play('move');
    input.setCurrentColumn(col);
  }
});
input.on('hover', (col) => {
  // preview highlight
});

// ------------------------------------------------------------
// Game loop
// ------------------------------------------------------------
function update(dt) {
  if (!game) return;

  const events = game.update(dt);

  // Dirige eventos (match → flash; enquanto resolve, não sync)
  for (const ev of events) {
    if (ev.type === 'match') {
      matchResolving = true;
    }
    handleGameEvent(ev);
  }

  // Reconcile board com game snapshot — mas NÃO durante explosão de match
  if (!matchResolving) {
    const snap = game.snapshot();
    if (snap) {
      if (!snap.falling) {
        boardMesh.clearFalling(); // coluna pousou → esconde grupo
      }
      boardMesh.sync(snap);
    }
  }

  // HUD updates
  const snap = game.snapshot();
  if (snap) {
    hud.update(snap.score, snap.level, snap.lines, snap.combo);
    hud.setNextPreview(snap.next);
  }

  // Update input's current column
  if (snap?.falling) {
    input.setCurrentColumn(snap.falling.x);
  }
}

function render(time) {
  const dt = Math.min((time - lastTime) / 1000, 0.05);
  lastTime = time;

  update(dt);

  // Screen shake
  if (shake.t < shake.dur) {
    shake.t += dt;
    const k = shake.t / shake.dur;
    const decay = 1 - k;
    camera.position.x = RENDER.CAMERA_POS[0] + (Math.random() - 0.5) * shake.amp * decay;
    camera.position.y = RENDER.CAMERA_POS[1] + (Math.random() - 0.5) * shake.amp * decay;
  } else {
    camera.position.set(RENDER.CAMERA_POS[0], RENDER.CAMERA_POS[1], RENDER.CAMERA_POS[2]);
  }

  // Animations internas (gems, falling, particles)
  boardMesh.update(dt, time / 1000);
  Particles.update?.(dt, time / 1000);

  // Render via composer (bloom + vignette)
  postFX.composer.render();

  requestAnimationFrame(render);
}

// ------------------------------------------------------------
// Resize
// ------------------------------------------------------------
window.addEventListener('resize', () => {
  SceneManager.resize(app, camera, renderer);
  postFX.setSize(window.innerWidth, window.innerHeight);
  input.setBoardRect?.(app.getBoundingClientRect());
});

// ------------------------------------------------------------
// Init
// ------------------------------------------------------------
input.setBoardRect(app.getBoundingClientRect());
menu.show('menu', { score: 0, best });
requestAnimationFrame(render);
