// ============================================================
// Match-3D.js — AudioManager
// SFX 100% sintetizados com WebAudio (osciladores + envelopes),
// sem arquivos externos. Parâmetros base vindos de config.js
// (AUDIO.SFX) com micro-composições por nome para soar premium.
//
// Contrato (ARCHITECTURE.md):
//   AudioManager.play(name) — move|rotate|land|match|combo|
//                             levelup|gameover|select
//   AudioManager.setVolume(v), AudioManager.destroy()
//
// AudioContext criado/resumido de forma LAZY no primeiro gesto
// do usuário (política de autoplay dos browsers).
// ============================================================

import { AUDIO } from '../config.js';

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
      this._master.gain.value = this._volume;
      this._master.connect(this._ctx.destination);
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
   * Toca um SFX sintetizado.
   * @param {'move'|'rotate'|'land'|'match'|'combo'|'levelup'|'gameover'|'select'} name
   * @param {Object} [opts]
   * @param {number} [opts.pitch=1] Multiplicador de frequência (ex.: combos crescentes).
   * @param {number} [opts.delay=0] Atraso em segundos.
   */
  play(name, { pitch = 1, delay = 0 } = {}) {
    const ctx = this._ensure();
    if (!ctx) return;
    const sfx = AUDIO.SFX[name];
    if (!sfx) {
      console.warn(`[AudioManager] SFX desconhecido: "${name}"`);
      return;
    }
    const at = ctx.currentTime + delay;
    const f = (m) => Math.max(30, sfx.freq * pitch * m);
    const v = sfx.vol;

    switch (name) {
      case 'move':
        this._tone({ type: sfx.type, freq: f(1), dur: sfx.dur, vol: v, at });
        break;
      case 'rotate':
        this._tone({ type: sfx.type, freq: f(1), dur: sfx.dur, vol: v, at });
        this._tone({ type: 'sine', freq: f(2), dur: sfx.dur * 0.7, vol: v * 0.4, at });
        break;
      case 'land':
        this._tone({ type: sfx.type, freq: f(1.15), glideTo: f(0.75), dur: sfx.dur, vol: v, at });
        break;
      case 'match':
        this._tone({ type: sfx.type, freq: f(1), glideTo: f(1.7), dur: sfx.dur, vol: v, at });
        this._tone({ type: 'sine', freq: f(2), dur: sfx.dur * 0.8, vol: v * 0.35, at: at + 0.03 });
        break;
      case 'combo':
        this._tone({ type: sfx.type, freq: f(1), dur: sfx.dur * 0.5, vol: v, at });
        this._tone({ type: sfx.type, freq: f(1.32), dur: sfx.dur * 0.6, vol: v, at: at + 0.07 });
        break;
      case 'levelup': {
        const notes = [1, 1.25, 1.5];
        for (let i = 0; i < notes.length; i++) {
          this._tone({
            type: 'triangle',
            freq: f(notes[i]),
            dur: 0.14,
            vol: v * 0.9,
            at: at + i * 0.08,
          });
        }
        break;
      }
      case 'gameover':
        this._tone({ type: sfx.type, freq: f(1), glideTo: f(0.45), dur: sfx.dur, vol: v, at });
        this._tone({ type: 'sine', freq: f(1.5), glideTo: f(0.6), dur: sfx.dur * 0.8, vol: v * 0.5, at: at + 0.05 });
        break;
      default:
        // 'select' e qualquer futuro SFX: blip simples com os parâmetros do config.
        this._tone({ type: sfx.type, freq: f(1), dur: sfx.dur, vol: v, at });
    }
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

  /* ---------------- Síntese ---------------- */

  /**
   * Um tom: oscilador + envelope de ganho (attack exponencial curto,
   * release exponencial). glideTo faz pitch slide (exp) até o fim.
   */
  _tone({ type = 'sine', freq = 440, dur = 0.1, vol = 0.2, at = 0, glideTo = null, attack = 0.004 }) {
    const ctx = this._ctx;
    if (!ctx || !this._master) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(1, freq), at);
    if (glideTo !== null && glideTo > 0) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, glideTo), at + dur);
    }

    const peak = Math.min(1, Math.max(0, vol));
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), at + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);

    osc.connect(gain);
    gain.connect(this._master);
    osc.start(at);
    osc.stop(at + dur + 0.02);
  }

  /* ---------------- Ciclo de vida ---------------- */

  destroy() {
    this._detachUnlock();
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
