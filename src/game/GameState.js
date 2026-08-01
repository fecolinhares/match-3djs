// ============================================================
// Match-3D.js — GameState (state machine: menu → playing → paused → gameover)
// Lógica pura — sem Three.js, sem DOM
// ============================================================

import { Board } from './Board.js';
import { COLUMN } from '../config.js';

export const STATE = {
  MENU: 'menu',
  PLAYING: 'playing',
  PAUSED: 'paused',
  GAMEOVER: 'gameover',
};

/**
 * Orquestra o fluxo do jogo: gera coluna, ticks, input, match check.
 * Encapsula um Board e expõe métodos para a camada de UI/input.
 */
export class GameState {
  /**
   * @param {object} opts
   * @param {object} opts.callbacks { onScore, onCombo, onLevelUp, onGameOver, onStateChange, onEvent }
   * @param {function} opts.random
   */
  constructor(opts = {}) {
    this.callbacks = opts.callbacks ?? {};
    this.state = STATE.MENU;
    this.board = null;
    this._elapsed = 0;
    this._pendingEvents = [];
  }

  // ---------- Lifecycle ----------

  start() {
    this.board = new Board({
      callbacks: {
        onScore: (points, count, combo) => this._emit('onScore', points, count, combo),
        onCombo: (n) => this._emit('onCombo', n),
        onLevelUp: (n) => this._emit('onLevelUp', n),
        onGameOver: (info) => this._emit('onGameOver', info),
      },
      random: this.callbacks.random,
    });
    this._setState(STATE.PLAYING);
    this.board.ensureNext();
    this.board.spawnColumn();
    return this.board.getStateSnapshot();
  }

  togglePause() {
    if (this.state === STATE.PLAYING) {
      this._setState(STATE.PAUSED);
      return true;
    }
    if (this.state === STATE.PAUSED) {
      this._setState(STATE.PLAYING);
      return true;
    }
    return false;
  }

  toMenu() {
    this._setState(STATE.MENU);
  }

  gameOver() {
    this._setState(STATE.GAMEOVER);
  }

  // ---------- Update loop ----------

  /**
   * Avança o jogo por dt segundos (chamado no requestAnimationFrame).
   * Retorna eventos para o render processar.
   */
  update(dt) {
    if (this.state !== STATE.PLAYING || !this.board) return [];
    this._elapsed += dt;

    const events = this.board.update(dt);
    for (const ev of events) this._emit('onEvent', ev);

    if (this.board.over) this.gameOver();

    return events;
  }

  // ---------- Input forwarding ----------

  moveLeft() {
    if (this.state !== STATE.PLAYING) return false;
    return this.board.moveFallingLeft();
  }

  moveRight() {
    if (this.state !== STATE.PLAYING) return false;
    return this.board.moveFallingRight();
  }

  rotate() {
    if (this.state !== STATE.PLAYING) return false;
    return this.board.rotateFalling();
  }

  softDrop(dt = 1 / 60) {
    if (this.state !== STATE.PLAYING) return [];
    return this.board.softDrop(dt);
  }

  hardDrop() {
    if (this.state !== STATE.PLAYING) return [];
    return this.board.hardDrop();
  }

  moveTo(x) {
    if (this.state !== STATE.PLAYING) return false;
    return this.board.moveFallingTo(x);
  }

  // ---------- Queries ----------

  snapshot() {
    return this.board ? this.board.getStateSnapshot() : null;
  }

  // ---------- Internals ----------

  _setState(next) {
    this.state = next;
    this._emit('onStateChange', next);
  }

  _emit(name, ...args) {
    if (typeof this.callbacks[name] === 'function') {
      this.callbacks[name](...args);
    }
  }
}

export default { STATE, GameState };
