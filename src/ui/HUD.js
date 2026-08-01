// ============================================================
// Match-3D.js — HUD (DOM overlay glass)
//
// Contrato (ARCHITECTURE.md):
//   HUD.update(score, level, lines, combo)  — atualiza DOM
//   HUD.setNextPreview(colors[3])           — mini coluna preview
//   HUD.showCombo(n)                        — texto flutuante "COMBO xn"
//
// Extensões: show(), hide(), destroy().
// Estética (DESIGN.md): glassmorphism (blur 16px, border 10%,
// radius 16px, sombra profunda), score em JetBrains Mono com
// tween de contagem, barra de progresso cyan→violet.
// ============================================================

import { GEM_DEFS, SCORING } from '../config.js';
import './ui.css';

const SCORE_TWEEN_MS = 380;
const COMBO_LIFETIME_MS = 700;

/** Injeta os <link> do Google Fonts uma única vez (idempotente). */
function injectFonts() {
  if (document.getElementById('m3d-fonts')) return;
  const link = document.createElement('link');
  link.id = 'm3d-fonts';
  link.rel = 'stylesheet';
  link.href =
    'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap';
  document.head.appendChild(link);
}

export class HUD {
  /**
   * @param {Object} [opts]
   * @param {HTMLElement|null} [opts.container] Elemento pai (default: #app).
   * @param {boolean|null} [opts.reducedMotion] Override de prefers-reduced-motion.
   */
  constructor({ container = null, reducedMotion = null } = {}) {
    injectFonts();
    this._container = container || document.getElementById('app') || document.body;
    this._reduced =
      reducedMotion ??
      (typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
        : false);

    this._displayScore = 0;
    this._targetScore = 0;
    this._tweenId = null;

    this._build();
  }

  /* ---------------- DOM ---------------- */

  _build() {
    const root = document.createElement('div');
    root.className = 'm3d-hud';
    root.setAttribute('aria-hidden', 'true');

    // Score
    const scorePanel = document.createElement('div');
    scorePanel.className = 'm3d-hud-panel m3d-hud-score';

    const scoreLabel = document.createElement('span');
    scoreLabel.className = 'm3d-label';
    scoreLabel.textContent = 'Score';

    const scoreRow = document.createElement('div');
    scoreRow.className = 'm3d-score-row';

    this._scoreEl = document.createElement('span');
    this._scoreEl.className = 'm3d-score-value';
    this._scoreEl.textContent = '0';

    this._comboBadge = document.createElement('span');
    this._comboBadge.className = 'm3d-combo-badge';
    this._comboBadge.hidden = true;

    scoreRow.append(this._scoreEl, this._comboBadge);
    scorePanel.append(scoreLabel, scoreRow);

    // Next preview
    const nextPanel = document.createElement('div');
    nextPanel.className = 'm3d-hud-panel m3d-hud-next';

    const nextLabel = document.createElement('span');
    nextLabel.className = 'm3d-label';
    nextLabel.textContent = 'Next';

    this._nextStack = document.createElement('div');
    this._nextStack.className = 'm3d-next-stack';

    nextPanel.append(nextLabel, this._nextStack);

    // Stats: level + progress + lines
    const statsPanel = document.createElement('div');
    statsPanel.className = 'm3d-hud-panel m3d-hud-stats';

    const levelRow = document.createElement('div');
    levelRow.className = 'm3d-stat-row';
    const levelLabel = document.createElement('span');
    levelLabel.textContent = 'Level';
    this._levelValue = document.createElement('b');
    this._levelValue.textContent = '1';
    levelRow.append(levelLabel, this._levelValue);

    const progress = document.createElement('div');
    progress.className = 'm3d-progress';
    this._progressFill = document.createElement('div');
    this._progressFill.className = 'm3d-progress-fill';
    progress.appendChild(this._progressFill);

    const linesRow = document.createElement('div');
    linesRow.className = 'm3d-stat-row';
    const linesLabel = document.createElement('span');
    linesLabel.textContent = 'Lines';
    this._linesValue = document.createElement('b');
    this._linesValue.textContent = '0';
    linesRow.append(linesLabel, this._linesValue);

    statsPanel.append(levelRow, progress, linesRow);

    // Camada de combos flutuantes
    this._comboLayer = document.createElement('div');
    this._comboLayer.className = 'm3d-combo-layer';

    root.append(scorePanel, nextPanel, statsPanel, this._comboLayer);
    this._container.appendChild(root);
    this._root = root;
  }

  /* ---------------- Atualização ---------------- */

  /**
   * Atualiza score, level, lines e combo no DOM.
   * O score sobe com tween numérico (expo-out); respeita reduced-motion.
   */
  update(score, level, lines, combo) {
    this._setScore(score ?? 0);
    this._levelValue.textContent = String(level ?? 1);
    this._linesValue.textContent = String(lines ?? 0);

    if (combo > 1) {
      this._comboBadge.textContent = `x${combo}`;
      this._comboBadge.hidden = false;
    } else {
      this._comboBadge.hidden = true;
    }

    this._setProgress(score ?? 0);
  }

  _setScore(target) {
    this._targetScore = target;
    if (this._tweenId !== null) {
      cancelAnimationFrame(this._tweenId);
      this._tweenId = null;
    }
    if (this._reduced) {
      this._displayScore = target;
      this._renderScore();
      return;
    }
    const start = this._displayScore;
    const t0 = performance.now();
    const ease = (t) => 1 - Math.pow(2, -10 * t); // expo-out
    const step = (now) => {
      const t = Math.min(1, (now - t0) / SCORE_TWEEN_MS);
      this._displayScore = Math.round(start + (target - start) * ease(t));
      this._renderScore();
      this._tweenId = t < 1 ? requestAnimationFrame(step) : null;
    };
    this._tweenId = requestAnimationFrame(step);
  }

  _renderScore() {
    this._scoreEl.textContent = this._displayScore.toLocaleString('en-US');
  }

  _setProgress(score) {
    const p = (score % SCORING.LEVEL_UP_EVERY) / SCORING.LEVEL_UP_EVERY;
    this._progressFill.style.width = `${Math.min(100, Math.max(0, p * 100))}%`;
  }

  /**
   * Renderiza a mini coluna com as 3 próximas gems.
   * @param {number[]} colors Índices de cor (0-6) — ver GEM_DEFS.
   */
  setNextPreview(colors) {
    this._nextStack.textContent = '';
    const list =
      Array.isArray(colors) && colors.length >= 3 ? colors : [null, null, null];
    for (let i = 0; i < 3; i++) {
      const idx = list[i];
      const el = document.createElement('div');
      const def = Number.isInteger(idx) ? GEM_DEFS[idx] : null;
      if (def) {
        el.className = 'm3d-next-gem';
        el.style.setProperty('--gem-base', def[1]);
        el.style.setProperty('--gem-glow', def[2]);
      } else {
        el.className = 'm3d-next-gem m3d-next-empty';
      }
      this._nextStack.appendChild(el);
    }
  }

  /** Texto flutuante "COMBO xn" com scale-in + fade-up (0.6s). */
  showCombo(n) {
    const el = document.createElement('div');
    el.className = 'm3d-combo-text';
    el.textContent = `COMBO x${n}`;
    this._comboLayer.appendChild(el);
    if (this._reduced) {
      el.remove();
      return;
    }
    setTimeout(() => el.remove(), COMBO_LIFETIME_MS + 150);
  }

  /* ---------------- Visibilidade ---------------- */

  show() {
    this._root.classList.remove('m3d-hud--hidden');
  }

  hide() {
    this._root.classList.add('m3d-hud--hidden');
  }

  destroy() {
    if (this._tweenId !== null) cancelAnimationFrame(this._tweenId);
    this._root?.remove();
    this._root = null;
  }
}
