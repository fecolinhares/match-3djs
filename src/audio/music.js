// ============================================================
// Match-3D.js — MusicEngine (lo-fi procedural, zero arquivos)
// Playlist de trilhas lo-fi sintetizadas 100% via WebAudio:
// pads com wobble, chimes de cristal, bass, bateria relaxada e
// textura de vinil (crackles). Nenhum áudio externo, nenhum
// direito autoral — o jogo gera a trilha em tempo real.
//
// Comportamento (contrato):
//   MusicEngine.start()     — embaralha a playlist e toca a 1ª faixa
//   MusicEngine.stop()      — para tudo (fade out)
//   MusicEngine.pause()     — suspende o AudioContext
//   MusicEngine.resume()    — retoma o AudioContext
//   Cada faixa toca N ciclos da progressão (~50-90s) e, ao acabar,
//   a próxima da playlist entra automaticamente (sequência). Quando
//   a playlist termina, é re-embaralhada (evitando repetir a última).
// ============================================================

import { AUDIO } from '../config.js';

const MUSIC = AUDIO.MUSIC;
const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);
const clamp01 = (v) => Math.max(0, Math.min(1, v));

// ------------------------------------------------------------
// Voicings dos acordes (notas MIDI) — vozes fechadas, registro
// confortável de lo-fi (C3-B4). Progressões jazz/minor suaves.
// ------------------------------------------------------------
const CHORDS = {
  Fmaj7:  [53, 57, 60, 64],
  Em7:    [52, 55, 59, 62],
  Dm7:    [50, 53, 57, 60],
  Cmaj7:  [48, 52, 55, 59],
  Am7:    [45, 48, 52, 55],
  G7:     [43, 47, 50, 53],
  Gmaj7:  [43, 47, 50, 54],
  Dmaj7:  [50, 54, 57, 61],
  D7:     [50, 53, 57, 60],
  Bbmaj7: [46, 50, 53, 57],
  C7:     [48, 52, 55, 58],
  E7:     [52, 56, 59, 62],
  A7:     [45, 49, 52, 55],
  Dm7b5:  [50, 53, 56, 59],
  C6:     [48, 52, 55, 57],
  Gadd9:  [43, 47, 50, 54, 57],
};

// Pentatônicas por tonalidade (para os chimes de cristal)
const PENTA = {
  C: [60, 62, 64, 67, 69, 72, 74, 76],
  Am: [57, 60, 62, 64, 67, 69, 72, 74],
  Dm: [50, 53, 55, 57, 60, 62, 65, 67],
  G: [55, 59, 62, 64, 67, 71, 74, 76],
  Em: [52, 55, 59, 62, 64, 67, 71, 74],
  F: [53, 57, 60, 62, 65, 69, 72, 74],
};

// ------------------------------------------------------------
// Playlist — 6 trilhas lo-fi (progressão, bpm, groove, timbre)
// ------------------------------------------------------------
const TRACKS = [
  {
    name: 'Crystal Dew',
    key: 'C',
    bpm: 70,
    chords: ['Fmaj7', 'Em7', 'Dm7', 'Cmaj7'],
    barsPerChord: 2,
    cycles: 4,
    padType: 'triangle',
    padFilter: 900,
    padWobble: 0.35,
    chimeVol: 0.16,
    chimeDensity: 0.5,
    bassVol: 0.2,
    drumVol: 0.14,
    kickPattern: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
    snarePattern: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    hatPattern: [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1],
    bassPattern: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0],
  },
  {
    name: 'Midnight Gems',
    key: 'Am',
    bpm: 78,
    chords: ['Am7', 'Dm7', 'G7', 'Cmaj7'],
    barsPerChord: 2,
    cycles: 4,
    padType: 'sawtooth',
    padFilter: 700,
    padWobble: 0.5,
    chimeVol: 0.12,
    chimeDensity: 0.35,
    bassVol: 0.24,
    drumVol: 0.18,
    kickPattern: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0],
    snarePattern: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    hatPattern: [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1, 1],
    bassPattern: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0],
  },
  {
    name: 'Neon Cavern',
    key: 'Dm',
    bpm: 64,
    chords: ['Dm7', 'G7', 'Cmaj7', 'Fmaj7'],
    barsPerChord: 2,
    cycles: 3,
    padType: 'sawtooth',
    padFilter: 600,
    padWobble: 0.6,
    chimeVol: 0.14,
    chimeDensity: 0.4,
    bassVol: 0.22,
    drumVol: 0.1,
    kickPattern: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
    snarePattern: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    hatPattern: [0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0],
    bassPattern: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0],
  },
  {
    name: 'Topaz Skies',
    key: 'G',
    bpm: 74,
    chords: ['Gmaj7', 'Em7', 'Am7', 'D7'],
    barsPerChord: 2,
    cycles: 4,
    padType: 'triangle',
    padFilter: 1100,
    padWobble: 0.25,
    chimeVol: 0.18,
    chimeDensity: 0.55,
    bassVol: 0.18,
    drumVol: 0.12,
    kickPattern: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
    snarePattern: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    hatPattern: [0, 1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1],
    bassPattern: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0],
  },
  {
    name: 'Amber Waves',
    key: 'Em',
    bpm: 82,
    chords: ['Em7', 'A7', 'Dmaj7', 'Gmaj7'],
    barsPerChord: 2,
    cycles: 4,
    padType: 'triangle',
    padFilter: 850,
    padWobble: 0.3,
    chimeVol: 0.13,
    chimeDensity: 0.3,
    bassVol: 0.26,
    drumVol: 0.2,
    kickPattern: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0],
    snarePattern: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    hatPattern: [0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 0, 1],
    bassPattern: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0],
  },
  {
    name: 'Starlight Prism',
    key: 'F',
    bpm: 68,
    chords: ['Fmaj7', 'Dm7', 'Bbmaj7', 'C7'],
    barsPerChord: 2,
    cycles: 4,
    padType: 'sawtooth',
    padFilter: 750,
    padWobble: 0.45,
    chimeVol: 0.17,
    chimeDensity: 0.5,
    bassVol: 0.2,
    drumVol: 0.12,
    kickPattern: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
    snarePattern: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    hatPattern: [0, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0, 1],
    bassPattern: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0],
  },
];

const STEPS_PER_BEAT = 4; // 16ª notas
const SWING = 0.62;       // offbeats atrasados (groove lo-fi)

export class MusicEngine {
  /**
   * @param {Object} opts
   * @param {AudioContext} opts.ctx Contexto de áudio (compartilhado).
   * @param {AudioNode} opts.output Nó de destino (master chain do jogo).
   * @param {number} [opts.volume] Gain da música (default MUSIC.VOLUME).
   * @param {number} [opts.seed] Semente p/ variação determinística (QA).
   */
  constructor({ ctx, output, volume = MUSIC.VOLUME, seed = Date.now() }) {
    this._ctx = ctx;
    this._out = output;
    this._volume = volume;
    this._seed = seed;
    this._rng = this._mulberry32(seed);

    this._bus = ctx.createGain();
    this._bus.gain.value = 0;
    // Delay de ambiente (space lo-fi) — feedback curto.
    this._delay = ctx.createDelay(1.0);
    this._delay.delayTime.value = 0.28;
    this._fb = ctx.createGain();
    this._fb.gain.value = 0.32;
    this._delayWet = ctx.createGain();
    this._delayWet.gain.value = 0.22;
    this._bus.connect(this._delay);
    this._delay.connect(this._fb);
    this._fb.connect(this._delay);
    this._delay.connect(this._delayWet);
    this._delayWet.connect(this._out);
    this._bus.connect(this._out);

    // Textura de vinil (contínua enquanto toca)
    this._vinyl = null;
    this._vinylGain = null;
    this._crackleTimer = null;

    this._playlist = [];
    this._trackIdx = -1;
    this._timer = null;
    this._step = 0;
    this._nextStepTime = 0;
    this._playing = false;
    this._stopping = false;
    this._lastTrack = null;
    this._currentTrack = null;
    this._onTrackEnd = null;
  }

  _mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------------- Ciclo de vida ---------------- */

  /**
   * Embaralha a playlist e começa a tocar. Cada chamada garante uma
   * faixa de abertura DIFERENTE da anterior (a última tocada é
   * movida para o fim do shuffle).
   */
  start(onTrackEnd = null) {
    this._stopping = false;
    this._onTrackEnd = onTrackEnd;
    this._shufflePlaylist();
    this._playNext(0);
  }

  stop() {
    this._stopping = true; // impede o setTimeout do _finishTrack re-iniciar
    this._stopScheduler();
    this._stopVinyl();
    // fade out rápido do bus
    const now = this._ctx.currentTime;
    this._bus.gain.cancelScheduledValues(now);
    this._bus.gain.setValueAtTime(this._bus.gain.value, now);
    this._bus.gain.linearRampToValueAtTime(0, now + 0.4);
    this._playing = false;
  }

  /** Suspende o contexto (pause do jogo). */
  pause() {
    this._stopScheduler();
    if (this._ctx.state === 'running') this._ctx.suspend().catch(() => {});
  }

  /** Retoma o contexto. */
  resume() {
    if (this._ctx.state === 'suspended') this._ctx.resume().catch(() => {});
    if (this._playing) this._startScheduler();
  }

  setVolume(v) {
    this._volume = clamp01(v);
    if (this._playing) {
      const now = this._ctx.currentTime;
      this._bus.gain.setTargetAtTime(this._volume, now, 0.05);
    }
  }

  isPlaying() {
    return this._playing;
  }

  get currentTrack() {
    return this._currentTrack ? this._currentTrack.name : null;
  }

  /* ---------------- Playlist ---------------- */

  _shufflePlaylist() {
    const list = TRACKS.slice();
    // Fisher-Yates
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(this._rng() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    // A última faixa tocada não abre o novo ciclo — evita repetição
    // imediata de abertura ("cada início de jogo, música diferente").
    if (this._lastTrack) {
      const idx = list.findIndex((t) => t.name === this._lastTrack);
      if (idx > -1) {
        list.splice(idx, 1);
        list.push(this._lastTrack);
      }
    }
    this._playlist = list;
    this._trackIdx = -1;
  }

  _playNext(startDelay = 0.1) {
    this._stopping = false;
    this._trackIdx += 1;
    if (this._trackIdx >= this._playlist.length) {
      this._shufflePlaylist();
      this._trackIdx = 0;
    }
    const track = this._playlist[this._trackIdx];
    this._currentTrack = track;
    this._lastTrack = track.name;
    this._step = 0;
    this._nextStepTime = this._ctx.currentTime + startDelay;
    this._playing = true;
    this._ensureVinyl(track);
    // fade in do bus
    const now = this._ctx.currentTime;
    this._bus.gain.cancelScheduledValues(now);
    this._bus.gain.setValueAtTime(0, now);
    this._bus.gain.linearRampToValueAtTime(this._volume, now + (MUSIC.FADE_IN || 1.0));
    this._startScheduler();
  }

  /* ---------------- Scheduler (lookahead) ---------------- */

  _startScheduler() {
    if (this._timer) return;
    this._timer = setInterval(() => this._tick(), 100);
  }

  _stopScheduler() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }

  _tick() {
    const LOOKAHEAD = 0.35;
    const stepDur = 60 / this._currentTrack.bpm / STEPS_PER_BEAT;
    while (this._nextStepTime < this._ctx.currentTime + LOOKAHEAD) {
      this._scheduleStep(this._step, this._nextStepTime);
      this._step += 1;
      this._nextStepTime += stepDur;
      if (!this._playing) return;
    }
    // Verifica fim da faixa
    const totalSteps = this._totalSteps();
    if (this._step >= totalSteps) {
      this._finishTrack();
    }
  }

  _totalSteps() {
    const t = this._currentTrack;
    const stepsPerBar = 16;
    const bars = t.chords.length * t.barsPerChord;
    return bars * stepsPerBar * t.cycles;
  }

  _finishTrack() {
    this._stopScheduler();
    this._playing = false;
    // fade out curto e toca a próxima
    const now = this._ctx.currentTime;
    this._bus.gain.cancelScheduledValues(now);
    this._bus.gain.setValueAtTime(this._bus.gain.value, now);
    this._bus.gain.linearRampToValueAtTime(0, now + 0.6);
    const cb = this._onTrackEnd;
    setTimeout(() => {
      if (cb) cb(this._currentTrack);
      if (this._playing === false && !this._stopping) this._playNext(0.4);
    }, 650);
  }

  /* ---------------- Vinil ---------------- */

  _ensureVinyl() {
    if (this._vinyl) return;
    const ctx = this._ctx;
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * 0.5;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 3200;
    const gain = ctx.createGain();
    gain.gain.value = 0.012;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this._bus);
    src.start();
    this._vinyl = src;
    this._vinylGain = gain;
    // Crackles esparsos
    this._crackleTimer = setInterval(() => {
      if (!this._playing) return;
      if (Math.random() < 0.4) this._playCrackle();
    }, 900);
  }

  _playCrackle() {
    const ctx = this._ctx;
    const t = ctx.currentTime + 0.01;
    const len = Math.floor(ctx.sampleRate * 0.004);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * 0.4;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 2500;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.05, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.004);
    src.connect(hp);
    hp.connect(g);
    g.connect(this._bus);
    src.start(t);
  }

  _stopVinyl() {
    if (this._vinyl) {
      try { this._vinyl.stop(); } catch { /* já parado */ }
      this._vinyl = null;
      this._vinylGain = null;
    }
    if (this._crackleTimer) {
      clearInterval(this._crackleTimer);
      this._crackleTimer = null;
    }
  }

  /* ---------------- Step scheduling ---------------- */

  _swingTime(step, time) {
    // Offbeats (ímpar) atrasados — swing lo-fi
    if (step % 2 === 1) return time + (60 / this._currentTrack.bpm / STEPS_PER_BEAT) * (SWING - 0.5);
    return time;
  }

  _scheduleStep(step, time) {
    const t = this._currentTrack;
    const stepsPerBar = 16;
    const stepsPerChord = stepsPerBar * t.barsPerChord;
    const chordIdx = Math.floor(step / stepsPerChord) % t.chords.length;
    const stepInChord = step % stepsPerChord;
    const stepInBar = step % stepsPerBar;

    // Início de acorde → pad + bass raiz
    if (stepInChord === 0) {
      const chord = CHORDS[t.chords[chordIdx]];
      this._playPad(chord, time, t, stepsPerChord);
      this._playBass(chord[0] - 12, time, t);
      if (t.chimeDensity > 0 && this._rng() < 0.35) this._playChime(chord, time, t);
    }
    // Chimes esparsos (melodia de cristal)
    if (t.chimeDensity > 0 && stepInChord === 8 && this._rng() < t.chimeDensity) {
      this._playChime(CHORDS[t.chords[chordIdx]], time, t);
    }

    // Bateria
    const kick = t.kickPattern[stepInBar];
    const snare = t.snarePattern[stepInBar];
    const hat = t.hatPattern[stepInBar];
    const ht = this._swingTime(step, time);
    if (kick) this._playKick(time, t);
    if (snare) this._playSnare(time, t);
    if (hat) this._playHat(ht, t);

    // Bass (padrão)
    if (t.bassPattern[stepInBar]) {
      const chord = CHORDS[t.chords[chordIdx]];
      this._playBass(chord[0] - 12, time, t, 0.9);
    }
  }

  /* ---------------- Instrumentos ---------------- */

  _playPad(chord, time, track, stepsPerChord) {
    const ctx = this._ctx;
    const dur = stepsPerChord * 60 / track.bpm / STEPS_PER_BEAT + 0.4;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = track.padFilter;
    filter.Q.value = 0.6;
    // LFO no filtro (wobble lo-fi)
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.08 + track.padWobble * 0.12;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = track.padFilter * 0.18;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start(time);
    lfo.stop(time + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, time);
    g.gain.linearRampToValueAtTime(0.13 * track.chimeVol * 2.2, time + 0.6);
    g.gain.setValueAtTime(0.13 * track.chimeVol * 2.2, time + dur - 0.8);
    g.gain.linearRampToValueAtTime(0.0001, time + dur);
    filter.connect(g);
    g.connect(this._bus);
    for (const note of chord) {
      const osc = ctx.createOscillator();
      osc.type = track.padType;
      osc.frequency.value = midiHz(note);
      osc.detune.value = (Math.random() * 2 - 1) * 7;
      osc.connect(filter);
      osc.start(time);
      osc.stop(time + dur);
      // camada suave 1 oitava acima (brilho de cristal)
      if (track.chimeVol > 0.12) {
        const osc2 = ctx.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.value = midiHz(note + 12);
        osc2.detune.value = (Math.random() * 2 - 1) * 4;
        const g2 = ctx.createGain();
        g2.gain.setValueAtTime(0.0001, time);
        g2.gain.linearRampToValueAtTime(0.05 * track.chimeVol, time + 0.8);
        g2.gain.linearRampToValueAtTime(0.0001, time + dur);
        osc2.connect(g2);
        g2.connect(this._bus);
        osc2.start(time);
        osc2.stop(time + dur);
      }
    }
  }

  _playBass(noteMidi, time, track, vel = 1) {
    const ctx = this._ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = midiHz(noteMidi);
    const g = ctx.createGain();
    const v = 0.2 * track.bassVol * vel;
    g.gain.setValueAtTime(0.0001, time);
    g.gain.linearRampToValueAtTime(v, time + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.42);
    osc.connect(g);
    g.connect(this._bus);
    osc.start(time);
    osc.stop(time + 0.5);
  }

  _playChime(chord, time, track) {
    const ctx = this._ctx;
    const key = track.key;
    const pool = PENTA[key] || PENTA.C;
    const note = pool[Math.floor(this._rng() * pool.length)] + (this._rng() < 0.3 ? 12 : 0);
    const f = midiHz(note);
    const dur = 0.9;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, time);
    g.gain.linearRampToValueAtTime(track.chimeVol, time + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, time + dur);
    g.connect(this._bus);
    for (const partial of [1, 2, 3]) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f * partial;
      osc.detune.value = (Math.random() * 2 - 1) * 3;
      const pg = ctx.createGain();
      pg.gain.value = 1 / partial;
      osc.connect(pg);
      pg.connect(g);
      osc.start(time);
      osc.stop(time + dur);
    }
  }

  _playKick(time, track) {
    const ctx = this._ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, time);
    osc.frequency.exponentialRampToValueAtTime(48, time + 0.09);
    const g = ctx.createGain();
    const v = 0.7 * track.drumVol;
    g.gain.setValueAtTime(v, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.12);
    osc.connect(g);
    g.connect(this._bus);
    osc.start(time);
    osc.stop(time + 0.14);
  }

  _playSnare(time, track) {
    const ctx = this._ctx;
    const len = Math.floor(ctx.sampleRate * 0.09);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 1.6);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1700;
    bp.Q.value = 0.7;
    const g = ctx.createGain();
    g.gain.value = 0.45 * track.drumVol;
    src.connect(bp);
    bp.connect(g);
    g.connect(this._bus);
    src.start(time);
  }

  _playHat(time, track) {
    const ctx = this._ctx;
    const len = Math.floor(ctx.sampleRate * 0.03);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 6000; // 7500→6000: hi-hat menos brilhante (lo-fi calmo)
    const g = ctx.createGain();
    g.gain.value = 0.09 * track.drumVol; // 0.16→0.09: fundo, não destaque
    src.connect(hp);
    hp.connect(g);
    g.connect(this._bus);
    src.start(time);
  }

  /* ---------------- Render offline (QA/demo) ---------------- */

  /**
   * Agenda a faixa INTEIRA em um OfflineAudioContext (sem scheduler)
   * — o MESMO código de síntese, renderizado deterministicamente.
   * @param {OfflineAudioContext} ctx
   * @param {AudioNode} output
   * @param {string} trackName
   * @param {number} [seed]
   */
  static renderOffline(ctx, output, trackName, seed = 12345, cyclesOverride) {
    const track = TRACKS.find((t) => t.name === trackName) || TRACKS[0];
    const engine = new MusicEngine({ ctx, output, volume: 1, seed });
    engine._currentTrack = track;
    engine._playing = true;
    engine._bus.gain.value = 1; // offline: sem fade-in (o _playNext não roda)
    const stepDur = 60 / track.bpm / STEPS_PER_BEAT;
    const totalSteps = (track.chords.length * track.barsPerChord) * 16 * (cyclesOverride ?? track.cycles);
    // Vinil (textura) — não precisa no offline (ruído contínuo)
    // Agenda direto (mesmo código do scheduler)
    for (let step = 0; step < totalSteps; step++) {
      const time = step * stepDur;
      engine._scheduleStep(step, time);
    }
    return engine;
  }

  static trackNames() {
    return TRACKS.map((t) => t.name);
  }
}

export { TRACKS };
