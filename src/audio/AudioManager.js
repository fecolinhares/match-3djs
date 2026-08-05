// ============================================================
// Match-3D.js — AudioManager
// Gerencia o AudioContext (lazy, autoplay-policy) e o master chain
// (volume → compressor → destination). A SÍNTESE vive em sfx.js
// (funções puras, também usadas na renderização offline de QA) —
// o som auditado nos WAVs É o som do jogo.
//
// Contrato (ARCHITECTURE.md):
//   AudioManager.play(name, { pitch, combo, delay }) — move|rotate|
//     softdrop|land|match|combo|levelup|gameover|select
//   AudioManager.setVolume(v), AudioManager.destroy()
// ============================================================

import { AUDIO } from '../config.js';
import { renderSfx } from './sfx.js';
import { MusicEngine } from './music.js';

const GESTURE_EVENTS = ['pointerdown', 'keydown', 'touchstart'];

export class AudioManager {
  /**
   * @param {Object} [opts]
   * @param {number} [opts.volume] Volume mestre (0-1). Default: AUDIO.MASTER_VOLUME.
   */
  constructor({ volume = AUDIO.MASTER_VOLUME } = {}) {
    this._ctx = null;
    this._master = null;
    this._volume = Math.min(1, Math.max(0, volume));
    this._music = null;
    this._musicVolume = AUDIO.MUSIC.VOLUME;
    this._unlock = this.unlock.bind(this);
    this._attachUnlock();
  }

  /* ---------------- Contexto lazy ---------------- */

  _ensure() {
    if (!this._ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) {
        console.warn('[AudioManager] WebAudio indisponível neste navegador.');
        return null;
      }
      this._ctx = new Ctx();
      this._master = this._ctx.createGain();
      const comp = this._ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.knee.value = 18;
      comp.ratio.value = 5;
      comp.attack.value = 0.002;
      comp.release.value = 0.18;
      this._master.gain.value = this._volume;
      this._master.connect(comp);
      comp.connect(this._ctx.destination);
    }
    if (this._ctx.state === 'suspended') {
      this._ctx.resume().catch(() => {});
    }
    return this._ctx;
  }

  /** Cria/resume o contexto. Chamado automaticamente em gestos de usuário. */
  unlock() {
    this._ensure();
  }

  _attachUnlock() {
    for (const evt of GESTURE_EVENTS) {
      window.addEventListener(evt, this._unlock, { capture: true, passive: true });
    }
  }

  _detachUnlock() {
    for (const evt of GESTURE_EVENTS) {
      window.removeEventListener(evt, this._unlock, { capture: true });
    }
  }

  /* ---------------- API pública ---------------- */

  /**
   * Toca um SFX sintetizado (receita em sfx.js).
   * @param {'move'|'rotate'|'softdrop'|'land'|'match'|'combo'|'levelup'|'gameover'|'select'} name
   * @param {Object} [opts]
   * @param {number} [opts.pitch=1] Multiplicador de frequência (combos crescentes).
   * @param {number} [opts.combo=0] Índice do combo (arpejo ganha notas).
   * @param {number} [opts.delay=0] Atraso em segundos.
   */
  play(name, { pitch = 1, combo = 0, delay = 0 } = {}) {
    const ctx = this._ensure();
    if (!ctx || !this._master) return;
    const base = AUDIO.SFX[name];
    if (!base) {
      console.warn(`[AudioManager] SFX desconhecido: "${name}"`);
      return;
    }
    renderSfx(ctx, this._master, name, {
      pitch,
      combo,
      at: ctx.currentTime + delay,
      base,
    });
  }

  /**
   * Ajusta o volume mestre (0-1) com rampa suave para evitar cliques.
   */
  setVolume(v) {
    this._volume = Math.min(1, Math.max(0, v));
    if (this._ctx && this._master) {
      this._master.gain.setTargetAtTime(this._volume, this._ctx.currentTime, 0.02);
    }
  }

  /* ---------------- Música (lo-fi procedural) ---------------- */

  /**
   * Inicia a playlist lo-fi. Cada chamada EMBARALHA a playlist e
   * garante uma faixa de abertura diferente da última — o requisito
   * "cada início de jogo começa com uma música diferente". Ao acabar
   * cada faixa, a próxima entra automaticamente (sequência).
   */
  startMusic() {
    const ctx = this._ensure();
    if (!ctx || !this._master) return;
    if (!this._music) {
      this._music = new MusicEngine({
        ctx,
        output: this._master,
        volume: this._musicVolume,
      });
    }
    this._music.start(() => {
      // Faixa terminou → a próxima da playlist entra sozinha
      // (o MusicEngine já agenda; callback é para telemetria).
    });
  }

  /** Para a música (fade out rápido). */
  stopMusic() {
    if (this._music) {
      this._music.stop();
      this._music = null;
    }
  }

  /** Suspende o contexto (pause do jogo). */
  pauseMusic() {
    if (this._music) this._music.pause();
  }

  /** Retoma o contexto. */
  resumeMusic() {
    if (this._music) this._music.resume();
  }

  /** Ajusta o volume da música (0-1), independente do mestre. */
  setMusicVolume(v) {
    this._musicVolume = Math.min(1, Math.max(0, v));
    if (this._music) this._music.setVolume(this._musicVolume);
  }

  /** Nome da faixa atual (para HUD/telemetria). */
  get currentTrack() {
    return this._music ? this._music.currentTrack : null;
  }

  /* ---------------- Ciclo de vida ---------------- */

  destroy() {
    this._detachUnlock();
    if (this._music) {
      this._music.stop();
      this._music = null;
    }
    if (this._ctx) {
      try {
        this._ctx.close();
      } catch {
        /* contexto já fechado */
      }
      this._ctx = null;
      this._master = null;
    }
  }
}
