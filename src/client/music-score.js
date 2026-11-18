// Partitura de la música de fondo (phonk / batalla). Fa menor con sabor frigio
// a 140 BPM en medio tiempo: bombo en el primer tiempo y palmada en el tercero.
// 16 compases en dos secciones: A (groove) y B (drop con cencerro completo).
// Todo es puro: `stepEvents` devuelve qué suena en cada semicorchea; las voces
// (music-voices.js) lo convierten en audio.

export const BPM = 140;
/** Duración de una semicorchea en segundos. */
export const STEP_S = 60 / BPM / 4;
export const STEPS_PER_BAR = 16;
export const BARS = 16;
export const LOOP_STEPS = BARS * STEPS_PER_BAR;
/** Primer compás de la sección B (drop). */
export const DROP_BAR = 8;

export const midiToFreq = (n) => 440 * 2 ** ((n - 69) / 12);

/** Sección de un compás: "groove" (A) o "drop" (B). */
export function sectionOf(bar) {
  return bar >= DROP_BAR ? "drop" : "groove";
}

// Acordes por compás: raíz del 808 (MIDI) y tipo de tercera (3 = menor, 4 = mayor).
const Fm = { root: 29, third: 3 };
const Gb = { root: 30, third: 4 };
const Ab = { root: 32, third: 4 };
export const CHORDS = [
  Fm, Fm, Gb, Fm, Fm, Fm, Ab, Gb, // A: groove
  Fm, Gb, Fm, Ab, Fm, Gb, Ab, Gb, // B: drop
];

/** Frecuencias de la tríada del acorde, dos octavas sobre la raíz del 808. */
export function voicing(chord) {
  const r = chord.root + 24;
  return [r, r + chord.third, r + 7].map(midiToFreq);
}

// 808 por compás: [paso, desplazamiento en semitonos, duración en pasos, glide opcional en semitonos].
const BASS_GROOVE = [
  [[0, 0, 6], [6, 0, 2], [10, 0, 5]],
  [[0, 0, 6], [7, 0, 2], [10, 0, 6, 5]],
];
const BASS_DROP = [
  [[0, 0, 6], [6, 0, 2], [10, 0, 3], [13, 5, 3]],
  [[0, 0, 5], [5, 0, 2], [10, 0, 6, 7]],
];

const KICKS_GROOVE = [0, 10];
const KICKS_DROP = [0, 7, 10];

// Riff del cencerro: 2 compases, paso -> semitonos sobre Fa5 (MIDI 77).
const RIFF = [
  { 0: 0, 3: 0, 6: 1, 8: 0, 11: -2, 14: -4 },
  { 0: 0, 3: 0, 6: 3, 8: 1, 11: 0, 14: -5 },
];
const COWBELL_ROOT = 77;
/** Relación entre las dos cuadradas del cencerro (~540 Hz y ~800 Hz). */
export const COWBELL_RATIO = 800 / 540;

/**
 * Eventos de un paso de la canción.
 * `off` es un desplazamiento dentro del paso (0..1) para los tresillos.
 * @param {number} step paso global (se reduce módulo LOOP_STEPS)
 * @returns {Array<{ voice: string, freq?: number, freqs?: number[], steps: number, vol: number, off?: number, glide?: number }>}
 */
export function stepEvents(step) {
  const s = ((step % LOOP_STEPS) + LOOP_STEPS) % LOOP_STEPS;
  const bar = Math.floor(s / STEPS_PER_BAR);
  const k = s % STEPS_PER_BAR;
  const chord = CHORDS[bar];
  const drop = sectionOf(bar) === "drop";
  const out = [];

  // 808: nota larga con caída de tono al atacar; algunas deslizan a otra nota.
  const bassPattern = (drop ? BASS_DROP : BASS_GROOVE)[bar % 2];
  for (const [bk, off, len, glide] of bassPattern) {
    if (bk !== k) continue;
    const ev = { voice: "808", freq: midiToFreq(chord.root + off), steps: len, vol: 0.9 };
    if (glide !== undefined) ev.glide = midiToFreq(chord.root + off + glide);
    out.push(ev);
  }

  // Bombo.
  const kicks = drop ? (bar % 2 === 1 ? [...KICKS_DROP, 13] : KICKS_DROP) : KICKS_GROOVE;
  if (kicks.includes(k)) out.push({ voice: "kick", steps: 1, vol: 0.85 });

  // Palmada en medio tiempo (tercer tiempo) y redoble en el último compás del drop.
  const fill = bar === BARS - 1 && k >= 12;
  if (k === 8) out.push({ voice: "clap", steps: 2, vol: 0.45 });
  else if (fill) out.push({ voice: "clap", steps: 1, vol: 0.2 + 0.08 * (k - 12) });

  // Hi-hats trap: corcheas, fantasmas en el drop y redobles de tresillos cada 4 compases.
  const roll = bar % 4 === 3 && (k === 12 || k === 14);
  if (roll) {
    for (let i = 0; i < 3; i++) {
      out.push({ voice: "hat", steps: 0.4, vol: 0.07 + 0.03 * i + (k === 14 ? 0.05 : 0), off: i / 3 });
    }
  } else if (k % 2 === 0) {
    out.push({ voice: "hat", steps: 0.4, vol: k % 4 === 0 ? 0.13 : 0.09 });
  } else if (drop && (k === 3 || k === 11)) {
    out.push({ voice: "hat", steps: 0.3, vol: 0.06 });
  }
  if (drop && bar % 2 === 1 && k === 6) out.push({ voice: "ohat", steps: 1.5, vol: 0.1 });

  // Cencerro phonk: sparse al final del groove, completo en el drop.
  const shift = chord.root - Fm.root;
  const riffNote = RIFF[bar % 2][k];
  if (riffNote !== undefined) {
    const full = drop;
    const sparse = bar >= 4 && !drop && (k === 0 || k === 8);
    if (full || sparse) {
      out.push({ voice: "cowbell", freq: midiToFreq(COWBELL_ROOT + shift + riffNote), steps: 1.5, vol: full ? 0.3 : 0.16 });
    }
  }

  // Capa de batalla: colchón cada 2 compases y metales en los cambios del drop.
  if (k === 0 && bar % 2 === 0) {
    out.push({ voice: "pad", freqs: voicing(chord), steps: 2 * STEPS_PER_BAR, vol: 0.1 });
  }
  if (drop && (k === 0 || (k === 10 && bar % 2 === 0))) {
    out.push({ voice: "stab", freqs: voicing(chord), steps: 3, vol: 0.18 });
  }

  // Riser antes de cada cambio de sección e impacto al entrar.
  if (k === 0 && (bar === DROP_BAR - 1 || bar === BARS - 1)) out.push({ voice: "riser", steps: STEPS_PER_BAR, vol: 0.3 });
  if (k === 0 && bar === DROP_BAR) out.push({ voice: "impact", steps: 12, vol: 0.8 });
  if (k === 0 && bar === 0) out.push({ voice: "impact", steps: 12, vol: 0.5 });

  return out;
}
