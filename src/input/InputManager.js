// ============================================================
// Match-3D.js — InputManager
// Unifica teclado, mouse e touch em eventos discretos.
//
// Contrato (ARCHITECTURE.md):
//   eventos: moveLeft, moveRight, rotate, softDrop, hardDrop, pause
//   teclado: ←/→ move, ↑ rotaciona, ↓ soft drop, Space hard drop,
//            P/Escape pause, R restart
//   mouse:   clique na coluna move a peça pra lá; clique na coluna
//            atual rotaciona; hover emite preview
//   touch:   swipe ←/→ move, swipe ↑ rotaciona, swipe ↓ soft drop
//
// Extensões (documentadas para o main.js):
//   'restart' (tecla R)
//   'moveTo'  (coluna)   — clique em outra coluna
//   'hover'   (coluna|null) — coluna sob o ponteiro, p/ preview
//
// API: on(name, cb) -> unsubscribe, off, setBoardRect(rect),
//      setCurrentColumn(x), destroy()
// ============================================================

import { INPUT, BOARD } from '../config.js';

const SWIPE_THRESHOLD = 24; // px de deslocamento p/ considerar swipe
const CLICK_THRESHOLD = 8;  // px de tolerância p/ considerar clique
const CONTINUOUS_KEYS = new Set([
  ...INPUT.KEY_LEFT,
  ...INPUT.KEY_RIGHT,
  ...INPUT.KEY_SOFT_DROP,
]);

export class InputManager {
  /**
   * @param {Object} [opts]
   * @param {{left:number, top:number, width:number, height:number}|null} [opts.boardRect]
   *        Retângulo do tabuleiro em px de cliente (getBoundingClientRect).
   *        Se ausente, tenta descobrir via canvas; fallback = viewport.
   * @param {number|null} [opts.currentColumn] Coluna da peça caindo (game informa).
   * @param {'auto'|'touch'|'keyboard'} [opts.mode] Modo de input FORÇADO.
   *        'auto' (default) detecta pelo hardware:
   *          touch (pointer:coarse)  → SÓ touch/swipe (teclado desativado)
   *          keyboard (pointer:fine) → SÓ teclado/mouse (touch desativado)
   *        Isolamento TOTAL: o modo não-ativo NÃO emite eventos.
   */
  constructor({ boardRect = null, currentColumn = null, mode = 'auto' } = {}) {
    this._listeners = new Map();
    this._boardRect = boardRect;
    this._currentColumn = currentColumn;
    this._lastHover = undefined;

    // Detecção de modo: touch (mobile) vs keyboard (desktop). Exclusivo.
    if (mode === 'auto') {
      const coarse =
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(pointer: coarse)').matches;
      const maxTouch = navigator.maxTouchPoints > 0;
      this._mode = coarse || maxTouch ? 'touch' : 'keyboard';
    } else {
      this._mode = mode === 'touch' ? 'touch' : 'keyboard';
    }
    this._isTouch = this._mode === 'touch';

    this._pointer = {
      id: null,
      active: false,
      swiped: false,
      startX: 0,
      startY: 0,
    };

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onPointerDown = this._onPointerDown.bind(this);
    this._onPointerMove = this._onPointerMove.bind(this);
    this._onPointerUp = this._onPointerUp.bind(this);
    this._onPointerCancel = this._onPointerCancel.bind(this);
    this._onBlur = this._onBlur.bind(this);
    this._onMouseLeave = this._onMouseLeave.bind(this);

    this._attach();
  }

  /** Modo ativo: 'touch' | 'keyboard' (para a UI decidir visibilidade). */
  get mode() {
    return this._mode;
  }

  /* ---------------- Eventos ---------------- */

  /** Registra um callback. Retorna uma função que remove o listener. */
  on(name, callback) {
    if (!this._listeners.has(name)) this._listeners.set(name, new Set());
    this._listeners.get(name).add(callback);
    return () => this.off(name, callback);
  }

  off(name, callback) {
    this._listeners.get(name)?.delete(callback);
  }

  _emit(name, data) {
    const set = this._listeners.get(name);
    if (!set || set.size === 0) return;
    for (const cb of [...set]) {
      try {
        cb(data);
      } catch (err) {
        console.error(`[InputManager] handler de "${name}" falhou:`, err);
      }
    }
  }

  /* ---------------- Configuração ---------------- */

  /** Informa o retângulo do tabuleiro (px de cliente) p/ mapear ponteiro → coluna. */
  setBoardRect(rect) {
    this._boardRect = rect;
  }

  /** Informa a coluna atual da peça caindo (p/ clique = rotacionar). */
  setCurrentColumn(x) {
    this._currentColumn = x;
  }

  /* ---------------- Teclado ---------------- */

  _onKeyDown(e) {
    // Isolamento: em modo touch (mobile), teclado NÃO ativa.
    if (this._isTouch) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const code = e.code;
    // Repetição automática só para ações contínuas (mover / soft drop).
    if (e.repeat && !CONTINUOUS_KEYS.has(code)) return;

    if (INPUT.KEY_LEFT.includes(code)) {
      e.preventDefault();
      this._emit('moveLeft');
    } else if (INPUT.KEY_RIGHT.includes(code)) {
      e.preventDefault();
      this._emit('moveRight');
    } else if (INPUT.KEY_ROTATE.includes(code)) {
      e.preventDefault();
      this._emit('rotate');
    } else if (INPUT.KEY_SOFT_DROP.includes(code)) {
      e.preventDefault();
      this._emit('softDrop');
    } else if (INPUT.KEY_HARD_DROP.includes(code)) {
      e.preventDefault();
      this._emit('hardDrop');
    } else if (INPUT.KEY_PAUSE.includes(code)) {
      e.preventDefault();
      this._emit('pause');
    } else if (INPUT.KEY_RESTART.includes(code)) {
      this._emit('restart');
    }
  }

  /* ---------------- Ponteiro (mouse + touch) ---------------- */

  _onPointerDown(e) {
    // Isolamento: em modo keyboard (desktop), touch NÃO ativa.
    if (!this._isTouch && e.pointerType === 'touch') return;
    const p = this._pointer;
    p.id = e.pointerId;
    p.active = true;
    p.swiped = false;
    p.startX = e.clientX;
    p.startY = e.clientY;
  }

  _onPointerMove(e) {
    if (e.pointerId !== this._pointer.id) {
      // Hover também funciona sem botão pressionado (mouse) — só em
      // modo keyboard; em touch não há hover útil.
      if (e.pointerType === 'mouse' && !this._isTouch) this._updateHover(e.clientX, e.clientY);
      return;
    }
    const p = this._pointer;
    if (p.active && !p.swiped) {
      const dx = e.clientX - p.startX;
      const dy = e.clientY - p.startY;
      if (Math.hypot(dx, dy) >= SWIPE_THRESHOLD) {
        p.swiped = true;
        this._handleSwipe(dx, dy);
      }
    }
    this._updateHover(e.clientX, e.clientY);
  }

  _onPointerUp(e) {
    if (e.pointerId !== this._pointer.id) return;
    const p = this._pointer;
    const wasSwiped = p.swiped;
    const moved = Math.hypot(e.clientX - p.startX, e.clientY - p.startY);
    p.active = false;
    p.id = null;

    if (!wasSwiped && moved < CLICK_THRESHOLD) {
      const col = this._columnAt(e.clientX, e.clientY);
      if (col !== null) {
        if (col === this._currentColumn) this._emit('rotate', col);
        else this._emit('moveTo', col);
      }
    }
  }

  _onPointerCancel(e) {
    if (e.pointerId === this._pointer.id) {
      this._pointer.active = false;
      this._pointer.id = null;
    }
  }

  _handleSwipe(dx, dy) {
    if (Math.abs(dx) > Math.abs(dy)) {
      this._emit(dx > 0 ? 'moveRight' : 'moveLeft');
    } else {
      this._emit(dy > 0 ? 'softDrop' : 'rotate');
    }
  }

  _updateHover(clientX, clientY) {
    const col = this._columnAt(clientX, clientY);
    if (col !== this._lastHover) {
      this._lastHover = col;
      this._emit('hover', col);
    }
  }

  _onBlur() {
    this._lastHover = undefined;
    this._emit('hover', null);
  }

  _onMouseLeave() {
    this._lastHover = undefined;
    this._emit('hover', null);
  }

  /* ---------------- Mapeamento ponteiro → coluna ---------------- */

  _columnAt(clientX, clientY) {
    const rect = this._boardRect ?? this._autoRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return null;
    const inX = clientX >= rect.left && clientX < rect.left + rect.width;
    const inY = clientY >= rect.top && clientY < rect.top + rect.height;
    if (!inX || !inY) return null;
    const rel = (clientX - rect.left) / rect.width;
    const col = Math.floor(rel * BOARD.COLS);
    return col >= 0 && col < BOARD.COLS ? col : null;
  }

  _autoRect() {
    const canvas =
      document.querySelector('#app canvas') || document.querySelector('canvas');
    if (canvas) {
      const r = canvas.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) return r;
    }
    return { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
  }

  /* ---------------- Ciclo de vida ---------------- */

  _attach() {
    // Isolamento real: em modo touch, o keydown nem é registrado
    // (teclado físico externo não controla o mobile).
    if (!this._isTouch) {
      window.addEventListener('keydown', this._onKeyDown);
    }
    window.addEventListener('pointerdown', this._onPointerDown);
    window.addEventListener('pointermove', this._onPointerMove);
    window.addEventListener('pointerup', this._onPointerUp);
    window.addEventListener('pointercancel', this._onPointerCancel);
    window.addEventListener('blur', this._onBlur);
    document.documentElement.addEventListener('mouseleave', this._onMouseLeave);
  }

  _detach() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('pointerdown', this._onPointerDown);
    window.removeEventListener('pointermove', this._onPointerMove);
    window.removeEventListener('pointerup', this._onPointerUp);
    window.removeEventListener('pointercancel', this._onPointerCancel);
    window.removeEventListener('blur', this._onBlur);
    document.documentElement.removeEventListener('mouseleave', this._onMouseLeave);
  }

  destroy() {
    this._detach();
    this._listeners.clear();
  }
}
