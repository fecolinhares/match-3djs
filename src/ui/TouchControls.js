// ============================================================
// Match-3D.js — TouchControls (DOM overlay de botões p/ mobile)
//
// Mobile-first: swipe é impreciso e "comandos estranhos" no touch.
// Botões grandes (≥44px) visíveis SÓ em telas com pointer:coarse
// (touch). Emite os mesmos eventos discretos do InputManager:
//   moveLeft, moveRight, rotate, softDrop, hardDrop
//
// API: constructor({container}), show(), hide(), on(name, cb),
//      off(name, cb), destroy(). CSS em ui.css (.m3d-touch-*).
// ============================================================

const TOUCH_EVENTS = ['moveLeft', 'moveRight', 'rotate', 'softDrop', 'hardDrop'];

export class TouchControls {
  /**
   * @param {Object} [opts]
   * @param {HTMLElement|null} [opts.container] Elemento pai (default: #app).
   * @param {'auto'|'touch'|'keyboard'} [opts.mode] Mesmo modo do
   *        InputManager: 'touch' mostra os botões; 'keyboard' NÃO monta
   *        nada (isolamento — no desktop os botões não existem).
   */
  constructor({ container = null, mode = 'auto' } = {}) {
    this._container = container || document.getElementById('app') || document.body;
    this._listeners = new Map();

    // Isolamento: em modo keyboard (desktop), os botões NÃO são criados.
    let resolved = mode;
    if (resolved === 'auto') {
      const coarse =
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(pointer: coarse)').matches;
      const maxTouch = navigator.maxTouchPoints > 0;
      resolved = coarse || maxTouch ? 'touch' : 'keyboard';
    }
    this._isTouch = resolved === 'touch';

    if (this._isTouch) this._build();
  }

  on(name, callback) {
    if (!TOUCH_EVENTS.includes(name)) return () => {};
    if (!this._listeners.has(name)) this._listeners.set(name, new Set());
    this._listeners.get(name).add(callback);
    return () => this.off(name, callback);
  }

  off(name, callback) {
    this._listeners.get(name)?.delete(callback);
  }

  _emit(name) {
    const set = this._listeners.get(name);
    if (!set || set.size === 0) return;
    for (const cb of [...set]) {
      try {
        cb();
      } catch (err) {
        console.error(`[TouchControls] handler "${name}" falhou:`, err);
      }
    }
  }

  /** Botão de ação — pointerdown dispara imediatamente (responsive). */
  _makeButton(label, eventName, ariaLabel, textLabel = null) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `m3d-touch-btn m3d-touch-${eventName}`;
    btn.setAttribute('aria-label', ariaLabel || eventName);
    btn.innerHTML = `<span class="m3d-touch-icon">${label}</span>${textLabel ? `<span class="m3d-touch-label">${textLabel}</span>` : ''}`;

    // pointerdown (não click) — responsivo imediato, sem delay de 300ms.
    const down = (e) => {
      e.preventDefault();
      this._emit(eventName);
      btn.classList.add('m3d-touch-btn--active');
    };
    const up = () => btn.classList.remove('m3d-touch-btn--active');
    const leave = () => btn.classList.remove('m3d-touch-btn--active');

    btn.addEventListener('pointerdown', down);
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointercancel', leave);
    btn.addEventListener('pointerleave', leave);
    // Previne scroll/drag do botão
    btn.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });

    this._buttons.push(btn);
    return btn;
  }

  _build() {
    this._buttons = [];

    const root = document.createElement('div');
    root.className = 'm3d-touch-controls';
    root.setAttribute('aria-hidden', 'true');

    // Fileira 1 — mover (D-pad): ◀ ▶
    const moveRow = document.createElement('div');
    moveRow.className = 'm3d-touch-row m3d-touch-row--move';

    const btnLeft = this._makeButton('◀', 'moveLeft', 'Mover esquerda', 'Esq');
    const btnRight = this._makeButton('▶', 'moveRight', 'Mover direita', 'Dir');
    moveRow.append(btnLeft, btnRight);

    // Fileira 2 — ações: ⟳ (rotacionar) ▼ (soft drop) ⤓ (hard drop)
    const actRow = document.createElement('div');
    actRow.className = 'm3d-touch-row m3d-touch-row--actions';

    const btnRotate = this._makeButton('⟳', 'rotate', 'Rotacionar', 'Girar');
    const btnSoft = this._makeButton('▼', 'softDrop', 'Queda rápida', 'Abaixa');
    const btnHard = this._makeButton('⤓', 'hardDrop', 'Queda instantânea', 'Solta');
    actRow.append(btnRotate, btnSoft, btnHard);

    root.append(moveRow, actRow);
    this._container.appendChild(root);
    this._root = root;
    // Modo touch garantido no constructor — botões visíveis direto.
    root.classList.add('m3d-touch-controls--visible');
  }

  show() {
    this._root?.classList.add('m3d-touch-controls--visible');
  }

  hide() {
    this._root?.classList.remove('m3d-touch-controls--visible');
  }

  destroy() {
    this._unlistenMedia?.();
    if (this._buttons) {
      for (const btn of this._buttons) {
        btn.removeEventListener('pointerdown', () => {});
      }
    }
    this._root?.remove();
    this._listeners.clear();
  }
}
