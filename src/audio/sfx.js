// ============================================================
// Match-3D.js — sfx.js (síntese pura, testável offline)
// Receitas de SFX que funcionam com QUALQUER BaseAudioContext
// (AudioContext no jogo, OfflineAudioContext na renderização de
// validação). Mesmo código → o WAV auditado É o som do jogo.
//
// Temática: gems de CRISTAL (chimes harmônicos + shimmer), board de
// PEDRA/madeira cartoon (thumps de ruído filtrado), UI arcade (blips
// curtos). Combos/levelup = arpejos ascendentes; gameover = frase
// descendente suave.
// ============================================================

// Notas (Hz). C4 = 261.63
const N = {
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.0,
  A4: 440.0, B4: 493.88, C5: 523.25, D5: 587.33, E5: 659.25,
  G5: 783.99, A5: 880.0, C6: 1046.5, D6: 1174.66, E6: 1318.51,
  G6: 1567.98,
};

const PENTA = [N.C5, N.D5, N.E5, N.G5, N.A5, N.C6, N.D6, N.E6];

/**
 * Renderiza um SFX no contexto/destino dados.
 * @param {BaseAudioContext} ctx
 * @param {AudioNode} out Nó de destino (master ou destination).
 * @param {string} name move|rotate|softdrop|land|match|combo|levelup|gameover|select
 * @param {Object} [opts] { pitch=1, combo=0, at=0, base={freq,dur,vol} }
 */
export function renderSfx(ctx, out, name, { pitch = 1, combo = 0, at = 0, base = null } = {}) {
  if (!ctx || !out) return;
  const b = base || { freq: 400, dur: 0.1, vol: 0.2 };
  const f = (m) => Math.max(30, b.freq * pitch * m);

  switch (name) {
    case 'move': {
      osc(ctx, out, { type: 'square', freq: f(1), dur: 0.032, vol: b.vol, at, attack: 0.002 });
      noise(ctx, out, { dur: 0.02, vol: b.vol * 0.35, at, filterType: 'highpass', freq: 5000 });
      break;
    }
    case 'rotate': {
      osc(ctx, out, { type: 'triangle', freq: f(1), glideTo: f(1.9), dur: 0.075, vol: b.vol, at, attack: 0.003 });
      osc(ctx, out, { type: 'sine', freq: f(2.4), dur: 0.045, vol: b.vol * 0.4, at: at + 0.012, attack: 0.003 });
      // SWISH de giro: noise bandpass 2.6k→1.4k (auditoria: faltava caráter de rotação).
      noise(ctx, out, {
        dur: 0.08, vol: b.vol * 0.5, at,
        filterType: 'bandpass', freq: 2600, q: 1.1, glideTo: 1400,
      });
      break;
    }
    case 'softdrop': {
      // Passo leve da coluna descendo — tick, não thump.
      osc(ctx, out, { type: 'square', freq: f(1), dur: 0.035, vol: b.vol, at, attack: 0.002 });
      noise(ctx, out, { dur: 0.018, vol: b.vol * 0.25, at, filterType: 'highpass', freq: 4000 });
      break;
    }
    case 'land': {
      // Thump de pedra/madeira: ruído lowpass com sweep + pitch drop.
      noise(ctx, out, {
        dur: 0.11, vol: b.vol * 0.9, at,
        filterType: 'lowpass', freq: 900, q: 0.8, glideTo: 220,
      });
      osc(ctx, out, { type: 'sine', freq: f(1.05), glideTo: f(0.62), dur: 0.12, vol: b.vol * 0.9, at, attack: 0.003 });
      osc(ctx, out, { type: 'triangle', freq: f(2.1), dur: 0.05, vol: b.vol * 0.2, at: at + 0.004, attack: 0.003 });
      break;
    }
    case 'match': {
      // Shimmer de cristal com CAUDA LONG de air — o som-hero do jogo
      // (auditoria: faltava brilho sustentado; agora harmônico 5x + duas
      // camadas de noise air 7.5k/11k com decay até ~0.55s).
      chime(ctx, out, { freq: f(1), dur: 0.55, vol: b.vol, at, partials: [1, 2, 3, 4, 5] });
      chime(ctx, out, { freq: f(2), dur: 0.42, vol: b.vol * 0.5, at: at + 0.018, partials: [1, 2, 3] });
      // Cauda de ar sustentada (release = timeConstant) — shimmer de cristal
      // até ~0.5s (auditoria: air morria em 0.3s com exponentialRamp).
      noise(ctx, out, { dur: 0.5, vol: b.vol * 0.35, at: at + 0.01, filterType: 'highpass', freq: 7500, release: 0.12 });
      noise(ctx, out, { dur: 0.38, vol: b.vol * 0.2, at: at + 0.1, filterType: 'highpass', freq: 11000, release: 0.09 });
      break;
    }
    case 'combo': {
      // Arpejo pentatônico ascendente com RITMO QUE ACELERA (60→45ms) e
      // chimes ricos (4 partials, corpo 0.22s) — o combo deve EVOLUIR o
      // match, não soar como um eco fraco (feedback: "sem graça").
      const idx = Math.min(Math.max(0, combo), PENTA.length - 1);
      const notes = PENTA.slice(0, idx + 1);
      let t = at;
      notes.forEach((n, i) => {
        const nn = n * pitch;
        chime(ctx, out, {
          freq: nn, dur: 0.22, vol: b.vol * (0.8 + 0.09 * i),
          at: t, partials: [1, 2, 3, 4],
        });
        t += Math.max(0.04, 0.075 - i * 0.01); // acelera (75→40ms) — audível
      });
      // Shimmer de fechamento com decay suave (sparkle, não bloco denso).
      // dur longo p/ o release completar antes do src.stop cortar.
      noise(ctx, out, {
        dur: 0.35, vol: b.vol * 0.18, at: t,
        filterType: 'highpass', freq: 8000, release: 0.1,
      });
      break;
    }
    case 'levelup': {
      const notes = [N.C5, N.E5, N.G5, N.C6];
      notes.forEach((n, i) => {
        chime(ctx, out, { freq: n * pitch, dur: 0.2, vol: b.vol * 0.85, at: at + i * 0.085, partials: [1, 2, 3] });
      });
      chime(ctx, out, { freq: N.G6 * pitch, dur: 0.35, vol: b.vol * 0.7, at: at + 0.36, partials: [1, 2, 3, 4] });
      noise(ctx, out, { dur: 0.12, vol: b.vol * 0.2, at: at + 0.36, filterType: 'highpass', freq: 7000 });
      break;
    }
    case 'gameover': {
      const notes = [N.E5, N.C5, N.G4, N.C4];
      notes.forEach((n, i) => {
        osc(ctx, out, {
          type: 'triangle', freq: n * pitch, dur: 0.2, vol: b.vol * 0.8,
          at: at + i * 0.16, attack: 0.004,
        });
      });
      noise(ctx, out, {
        dur: 0.25, vol: b.vol * 0.7, at: at + 0.66,
        filterType: 'lowpass', freq: 500, q: 0.9, glideTo: 120,
      });
      break;
    }
    default: {
      // 'select' e futuros: blip de cristal suave + SPARKLE de UI arcade
      // (transiente 3.5kHz — auditoria: blip estava abafado).
      osc(ctx, out, { type: 'sine', freq: f(1), dur: 0.05, vol: b.vol, at, attack: 0.003 });
      osc(ctx, out, { type: 'sine', freq: f(1.5), dur: 0.04, vol: b.vol * 0.5, at: at + 0.02, attack: 0.003 });
      noise(ctx, out, { dur: 0.03, vol: b.vol * 0.25, at, filterType: 'highpass', freq: 3500 });
      break;
    }
  }
}

/* ---------------- Primitivas ---------------- */

/** Oscilador + envelope + filtro opcional. */
function osc(ctx, out, { type = 'sine', freq = 440, glideTo = null, dur = 0.1, vol = 0.2,
                         at = 0, attack = 0.004, filterType = null, filterFreq = null, filterQ = 1 }) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(Math.max(1, freq), at);
  if (glideTo !== null && glideTo > 0) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, glideTo), at + dur);
  }

  let node = osc;
  if (filterType) {
    const flt = ctx.createBiquadFilter();
    flt.type = filterType;
    flt.frequency.setValueAtTime(filterFreq ?? freq * 2, at);
    flt.Q.value = filterQ;
    osc.connect(flt);
    node = flt;
  }

  const peak = Math.min(1, Math.max(0.0001, vol));
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(peak, at + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);

  node.connect(gain);
  gain.connect(out);
  osc.start(at);
  osc.stop(at + dur + 0.03);
}

/** Ruído branco filtrado; janela deslocada por fase a cada chamada.
 * `release` (timeConstant) opcional: decaimento suave e LONGO via
 * setTargetAtTime — sem ele usa exponentialRamp (decai rápido).
 * Usado no shimmer do match para cauda de ar sustentada. */
function noise(ctx, out, { dur = 0.1, vol = 0.2, at = 0, filterType = 'lowpass',
                           freq = 800, q = 1, glideTo = null, release = null }) {
  const len = Math.max(1, Math.ceil(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  // Semente simples determinística por at → mesmo som renderizado offline
  // que no jogo (a fase depende só do tempo de início, não de RNG global).
  let seed = Math.floor(at * ctx.sampleRate) & 0xffff;
  for (let i = 0; i < len; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    data[i] = ((seed / 0x3fffffff) * 2 - 1) * 0.9;
  }
  // DC blocker: remove o viés de janela do ruído (auditoria técnica:
  // land tinha DC step +0.105 no ataque → pop audível no início).
  let sum = 0;
  for (let i = 0; i < len; i++) sum += data[i];
  const mean = sum / len;
  if (Math.abs(mean) > 1e-6) {
    for (let i = 0; i < len; i++) data[i] -= mean;
  }

  const src = ctx.createBufferSource();
  src.buffer = buf;

  const flt = ctx.createBiquadFilter();
  flt.type = filterType;
  flt.frequency.setValueAtTime(Math.max(20, freq), at);
  if (glideTo !== null && glideTo > 0) {
    flt.frequency.exponentialRampToValueAtTime(Math.max(20, glideTo), at + dur);
  }
  flt.Q.value = q;

  const gain = ctx.createGain();
  const peak = Math.min(1, Math.max(0.0001, vol));
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(peak, at + 0.003);
  if (release != null) {
    gain.gain.setTargetAtTime(0.0001, at + 0.003, release);
  } else {
    gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  }

  src.connect(flt);
  flt.connect(gain);
  gain.connect(out);
  src.start(at);
  src.stop(at + dur + 0.03);
}

/** Chime de cristal: fundamental + harmônicos + detune sutil. */
function chime(ctx, out, { freq = 523, dur = 0.3, vol = 0.3, at = 0, partials = [1, 2, 3, 4] }) {
  const amps = { 1: 1.0, 2: 0.42, 3: 0.2, 4: 0.1 };
  for (const p of partials) {
    const amp = (amps[p] ?? 0.25) / (partials.length > 3 ? 1.25 : 1);
    osc(ctx, out, { type: 'sine', freq: Math.max(30, freq * p), dur, vol: vol * amp, at, attack: 0.003 });
  }
  osc(ctx, out, { type: 'sine', freq: Math.max(30, freq * 1.003), dur: dur * 0.8, vol: vol * 0.18, at, attack: 0.003 });
  osc(ctx, out, { type: 'sine', freq: Math.max(30, freq * 0.997), dur: dur * 0.8, vol: vol * 0.18, at, attack: 0.003 });
}
