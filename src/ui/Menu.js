// ============================================================
// Match-3D.js — Menu (overlay glass: menu principal + game over)
//
// Contrato (ARCHITECTURE.md):
//   Menu.show('menu'|'gameover', { score, best })
//   Menu.hide()
//   Enter/Space no teclado inicia (ou reinicia) o jogo.
//
// Estética (DESIGN.md): overlay semi-transparente (rgba(10,10,18,0.72)
// + blur) deixando o mundo 3D visível; transições fade+scale 0.3s.
// Best score persistido em localStorage ('match3d-best').
// ============================================================

import './ui.css';

const BEST_KEY = 'match3d-best';
const FADE_MS = 300;

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

const SCORE_TWEEN_MS = 500;
const easeOutExpo = (t) => 1 - Math.pow(2, -10 * t);

export class Menu {
  /**
   * @param {Object} [opts]
   * @param {HTMLElement|null} [opts.container] Elemento pai (default: #app).
   * @param {Function|null} [opts.onStart] Chamado ao pressionar start/restart.
   * @param {boolean|null} [opts.reducedMotion] Override de prefers-reduced-motion.
   */
  constructor({ container = null, onStart = null, reducedMotion = null } = {}) {
    injectFonts();
    this._container = container || document.getElementById('app') || document.body;
    this._onStart = onStart;
    this._reduced =
      reducedMotion ??
      (typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
        : false);

    this._visible = false;
    this._keyActive = false;
    this._tweenId = null;

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onButtonClick = this._onButtonClick.bind(this);

    this._build();
    window.addEventListener('keydown', this._onKeyDown);
  }

  /** Define o callback disparado por Start / Play Again / Enter / Space. */
  setOnStart(fn) {
    this._onStart = fn;
  }

  /* ---------------- DOM ---------------- */

  _build() {
    const root = document.createElement('div');
    root.className = 'm3d-menu';
    root.hidden = true;

    const card = document.createElement('div');
    card.className = 'm3d-menu-card';

    this._title = document.createElement('h1');
    this._title.className = 'm3d-menu-title';

    this._subtitle = document.createElement('p');
    this._subtitle.className = 'm3d-menu-subtitle';

    const stats = document.createElement('div');
    stats.className = 'm3d-menu-stats';

    const scoreStat = document.createElement('div');
    scoreStat.className = 'm3d-menu-stat';
    const scoreLabel = document.createElement('span');
    scoreLabel.className = 'm3d-label';
    scoreLabel.textContent = 'Score';
    this._scoreEl = document.createElement('b');
    this._scoreEl.textContent = '0';
    scoreStat.append(scoreLabel, this._scoreEl);

    const bestStat = document.createElement('div');
    bestStat.className = 'm3d-menu-stat';
    const bestLabel = document.createElement('span');
    bestLabel.className = 'm3d-label';
    bestLabel.textContent = 'Best';
    this._bestEl = document.createElement('b');
    this._bestEl.textContent = '0';
    bestStat.append(bestLabel, this._bestEl);

    stats.append(scoreStat, bestStat);

    this._newBest = document.createElement('div');
    this._newBest.className = 'm3d-new-best';
    this._newBest.textContent = 'New Best';
    this._newBest.hidden = true;

    this._button = document.createElement('button');
    this._button.className = 'm3d-btn';
    this._button.type = 'button';
    this._button.addEventListener('click', this._onButtonClick);

    const hints = document.createElement('div');
    hints.className = 'm3d-menu-hints';
    hints.innerHTML =
      '<span><span class="m3d-key">\u2190</span><span class="m3d-key">\u2192</span> Move</span>' +
      '<span><span class="m3d-key">\u2191</span> Rotate</span>' +
      '<span><span class="m3d-key">\u2193</span> Soft Drop</span>' +
      '<span><span class="m3d-key">Space</span> Hard Drop</span>' +
      '<span><span class="m3d-key">P</span> Pause</span>';

    card.append(this._title, this._subtitle, stats, this._newBest, this._button, hints);
    root.appendChild(card);
    this._container.appendChild(root);
    this._root = root;
  }

  /* ---------------- Exibição ---------------- */

  /**
   * Mostra o overlay.
   * @param {'menu'|'gameover'} mode
   * @param {{score?:number, best?:number|null}} [opts]
   */
  show(mode, { score = 0, best = null } = {}) {
    const isGameOver = mode === 'gameover';
    const stored = this._readBest();

    let finalBest = stored;
    let isNewBest = false;

    if (isGameOver) {
      isNewBest = score > 0 && score > stored;
      if (isNewBest) {
        finalBest = score;
        this._saveBest(score);
      } else if (best !== null) {
        finalBest = best;
      }
    } else if (best !== null) {
      finalBest = best;
    }

    this._applyMode(isGameOver, isNewBest);
    this._tweenStat(this._scoreEl, score);
    this._tweenStat(this._bestEl, finalBest);

    this._visible = true;
    this._keyActive = true;
    this._root.hidden = false;
    // Força reflow para a transição fade+scale disparar.
    void this._root.offsetWidth;
    this._root.classList.add('m3d-menu-visible');
    try {
      this._button.focus({ preventScroll: true });
    } catch {
      /* focus({preventScroll}) não suportado em browsers antigos */
    }
  }

  hide() {
    this._visible = false;
    this._keyActive = false;
    this._root.classList.remove('m3d-menu-visible');
    if (this._reduced) {
      this._root.hidden = true;
      return;
    }
    setTimeout(() => {
      if (!this._visible) this._root.hidden = true;
    }, FADE_MS);
  }

  _applyMode(isGameOver, isNewBest) {
    if (isGameOver) {
      this._title.textContent = 'GAME OVER';
      this._title.classList.add('m3d-title-gameover');
      this._subtitle.textContent = 'The board is full.';
      this._button.textContent = 'Play Again';
    } else {
      this._title.textContent = '';
      const span = document.createElement('span');
      span.textContent = 'MATCH';
      const accent = document.createElement('span');
      accent.className = 'm3d-accent';
      accent.textContent = '-3D';
      this._title.append(span, accent);
      this._title.classList.remove('m3d-title-gameover');
      this._subtitle.textContent = 'Stack \u00b7 Match \u00b7 Cascade';
      this._button.textContent = 'Start';
    }
    this._newBest.hidden = !(isGameOver && isNewBest);
  }

  /* ---------------- Interação ---------------- */

  _onButtonClick() {
    this._triggerStart();
  }

  _onKeyDown(e) {
    if (!this._keyActive) return;
    if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space') {
      if (e.repeat) return;
      e.preventDefault();
      this._triggerStart();
    }
  }

  _triggerStart() {
    if (typeof this._onStart === 'function') this._onStart();
  }

  /* ---------------- Best score (localStorage) ---------------- */

  _readBest() {
    try {
      return parseInt(localStorage.getItem(BEST_KEY) || '0', 10) || 0;
    } catch {
      return 0;
    }
  }

  _saveBest(v) {
    try {
      localStorage.setItem(BEST_KEY, String(v));
    } catch {
      /* armazenamento indisponível (modo privado) — ignora */
    }
  }

  /* ---------------- Tween numérico ---------------- */

  _tweenStat(el, target) {
    if (this._reduced) {
      el.textContent = String(target);
      return;
    }
    const start = parseInt(el.textContent.replace(/[^\d]/g, '') || '0', 10);
    const t0 = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - t0) / SCORE_TWEEN_MS);
      el.textContent = Math.round(start + (target - start) * easeOutExpo(t)).toLocaleString('en-US');
      if (t < 1) this._tweenId = requestAnimationFrame(step);
      else this._tweenId = null;
    };
    if (this._tweenId !== null) cancelAnimationFrame(this._tweenId);
    this._tweenId = requestAnimationFrame(step);
  }

  /* ---------------- Ciclo de vida ---------------- */

  destroy() {
    window.removeEventListener('keydown', this._onKeyDown);
    if (this._tweenId !== null) cancelAnimationFrame(this._tweenId);
    this._root?.remove();
    this._root = null;
  }
}
