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
import { TouchControls } from './ui/TouchControls.js';
import { AudioManager } from './audio/AudioManager.js';
import { BOARD, RENDER } from './config.js';

// ------------------------------------------------------------
// Setup DOM
// ------------------------------------------------------------
const app = document.getElementById('app');
app.style.position = 'relative';
app.style.width = '100vw';
// Mobile: 100vh inclui a área atrás da barra de endereço do browser →
// o fundo do app fica escondido e os botões touch (absolute bottom)
// saem da tela ("controles tão pra baixo que vão para fora").
// 100dvh = altura visível dinâmica (fallback 100vh p/ browsers antigos).
app.style.height = '100dvh';
app.style.overflow = 'hidden';
app.style.background = '#0A0A12';

// ------------------------------------------------------------
// Mobile layout: zoom out + board mais alto → controles touch não
// cobrem o tabuleiro (user: "espaço em tela para os controles").
// Mutação de RENDER ANTES da criação de câmera/board — ambos leem
// estes valores na init. Resolvido UMA vez (mesma regra do input).
// ------------------------------------------------------------
const IS_MOBILE =
  (typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches) ||
  navigator.maxTouchPoints > 0 ||
  window.innerWidth <= 768;
if (IS_MOBILE) {
  RENDER.CAMERA_POS[2] = RENDER.MOBILE_CAMERA_Z;
  RENDER.BOARD_Y_OFFSET = RENDER.MOBILE_BOARD_Y_OFFSET;
} else if (window.innerHeight < 820) {
  // Desktop curto (laptops 1366×768 / 1280×720): o tilt pinball projeta a
  // base do board para baixo da tela (frame colado/cortado na borda).
  // Zoom out leve mantém o board inteiro visível com margem — mesmo
  // princípio do mobile, mais suave.
  RENDER.CAMERA_POS[2] = 20.5;
}

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

// Modo de input resolvido UMA vez (isolamento touch vs keyboard).
// TouchControls e InputManager usam o MESMO modo → nunca os dois ativos.
const inputMode =
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(pointer: coarse)').matches
    ? 'touch'
    : navigator.maxTouchPoints > 0
      ? 'touch'
      : 'keyboard';

const hud = new HUD({ container: app });
const touchControls = new TouchControls({ container: app, mode: inputMode });
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
          audio.play('combo', { pitch: 1 + (combo - 1) * 0.12, combo: combo + 1 });
          hud.showCombo(combo + 1);
        }
        const snap = game.snapshot();
        hud.update(snap.score, snap.level, snap.lines, snap.combo);
        // Sem screen shake no match (user: "o shake da tela e só sumir
        // está super confuso"). O destaque agora vem do flash forte das
        // peças do combo (brilham → explodem) — câmera fica estável.
      },
      onLevelUp: (n) => {
        audio.play('levelup');
        Particles.levelUpFlash?.();
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
    case 'land':
      // Landing juice: poeira + flash suave no ponto de pouso da coluna.
      Particles.landingImpact?.({ x: ev.x, y: ev.y }, ev.color);
      break;
    case 'fall':
      // Trail de queda: faíscas minúsculas ao longo da coluna.
      Particles.fallTrail?.({ x: ev.x, y: ev.y }, ev.color);
      break;
    case 'match':
      // Dispara o flash + explosão nas células do match.
      // NÃO chamamos sync() enquanto o flash roda — o sync reconciliaria
      // o grid já limpo pelo engine e mataria a explosão.
      // Em cascatas, múltiplos matches disparam em paralelo: contamos e
      // só sincronizamos quando o ÚLTIMO flash terminar.
      flashCount += 1;
      matchResolving = true;
      // Shockwave central do match (anel duplo + flash + faíscas).
      if (ev.cells?.[0]?.cells?.[0]) {
        const first = ev.cells[0].cells[0];
        Particles.shockwave?.({ x: first.x, y: first.y }, ev.cells[0].color);
      }
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
  mode: inputMode, // mesmo modo do TouchControls — isolamento garantido
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
    audio.play('softdrop');
  }
});
input.on('hardDrop', () => {
  if (game) {
    const events = game.hardDrop();
    audio.play('land');
    // Processa eventos do hard drop (land/fall/match) — landing juice,
    // trail e explosão de match SÓ disparam se passarmos por aqui.
    for (const ev of events) handleGameEvent(ev);
    // Sincroniza APÓS o hard drop — MAS NÃO durante flash de match:
    // o sync removeria as gems que estão flashando → flashComplete
    // nunca rodaria → flashCount trava → matchResolving=true para
    // sempre → o update loop nunca mais sincroniza → gems congeladas
    // "no ar" (bug REAL reproduzido: hardDrop durante flash trava).
    if (!matchResolving) boardMesh.sync(game.snapshot());
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
// TouchControls — botões mobile emitem os mesmos eventos discretos
// ------------------------------------------------------------
touchControls.on('moveLeft', () => {
  if (game?.moveLeft()) {
    audio.play('move');
    input.setCurrentColumn(game.snapshot().falling?.x ?? null);
  }
});
touchControls.on('moveRight', () => {
  if (game?.moveRight()) {
    audio.play('move');
    input.setCurrentColumn(game.snapshot().falling?.x ?? null);
  }
});
touchControls.on('rotate', () => {
  if (game?.rotate()) {
    audio.play('rotate');
  }
});
touchControls.on('softDrop', () => {
  if (game) {
    game.softDrop(1 / 60);
    audio.play('softdrop');
  }
});
touchControls.on('hardDrop', () => {
  if (game) {
    const events = game.hardDrop();
    audio.play('land');
    for (const ev of events) handleGameEvent(ev);
    // MESMO fix do teclado: sincronizar durante um flash de match
    // removeria as gems flashando → flashComplete nunca roda →
    // flashCount trava → matchResolving=true para sempre → gems
    // congeladas "no ar" (bug reportado pelo user em múltiplas cores).
    if (!matchResolving) boardMesh.sync(game.snapshot());
  }
});

// ------------------------------------------------------------
// Game loop
// ------------------------------------------------------------
function update(dt) {
  if (!game) return;

  // game.update() JÁ emite 'onEvent' para cada evento (via callback) →
  // handleGameEvent processa TUDO uma única vez. NÃO iterar os events
  // retornados AQUI: processaria cada evento 2x — o match dispararia
  // flashMatch duas vezes no mesmo tick, o 2º setFlash sobrescreveria
  // os callbacks do 1º, flashCount nunca zeraria e o sync pós-flash
  // (que aplica a gravidade visual) nunca rodaria → gems acima do
  // combo não caíam (bug reportado: "a fileira acima não cai").
  game.update(dt);

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

// Debug helper: expõe o game globalmente para testes (Playwright) e QA.
if (typeof window !== 'undefined') {
  window.__game = () => game;
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
