// Voces de la música de fondo: cada una recibe (ac, nodes, ev, t) y programa su
// audio en el instante `t` del reloj del AudioContext. `nodes` son los buses
// compartidos que arma createMusic (bus, bass, cow, pad, send, noise). Los
// números de cada instrumento están en su tabla de constantes.

import { STEP_S, COWBELL_RATIO } from "./music-score.js";

const SILENCE = 0.0001; // "cero" para rampas exponenciales

const KICK = {
  body: { startHz: 170, endHz: 48, sweepS: 0.11, decayS: 0.19, stopS: 0.21 },
  click: { startHz: 2400, endHz: 300, sweepS: 0.012, decayS: 0.014, stopS: 0.03, gain: 0.35 },
};

const BASS_808 = {
  pitchMul: 2.6, // el ataque arranca más agudo y cae a la nota
  dropS: 0.045,
  attackS: 0.004,
  sustainGain: 0.6,
  sustainMaxS: 0.3,
  glideStart: 0.55, // fracción de la nota donde empieza el deslizamiento
  glideS: 0.14,
  tailS: 0.02,
};

const COWBELL = { detune: [-6, 7], attackS: 0.003, decayS: 0.24, stopS: 0.26 };

const CLAP = { type: "bandpass", freq: 1500, q: 0.8, dur: 0.2 };
const HAT = { type: "highpass", freq: 8000, dur: 0.04 };
const OPEN_HAT = { type: "highpass", freq: 7000, dur: 0.22 };
// Palmada: tres impactos muy seguidos y una cola más larga.
const CLAP_BURSTS = { offsets: [0, 0.011, 0.023], hitDecayS: 0.009, hitFloor: 0.25, tailAt: 0.03, tailGain: 0.7 };
const NOISE_OFFSET_MAX_S = 0.2; // inicio aleatorio dentro del buffer, para que cada golpe suene distinto
const NOISE_TAIL_S = 0.02;

const SAW_DETUNE = [-8, 8];
const SAW_TAIL_S = 0.05;
const PAD = { attackS: 0.5, releaseS: 0.5 };
const STAB = { q: 2, startHz: 350, peakHz: 2200, endHz: 500, peakS: 0.05, attackS: 0.01 };

const RISER = {
  noise: { q: 2, startHz: 300, endHz: 7000 },
  tone: { startHz: 110, endHz: 880, gain: 0.4 },
  tailS: 0.03,
  stopS: 0.05,
};

const IMPACT = { startHz: 90, endHz: 28, dropS: 1, stopS: 0.02, noise: { type: "lowpass", freq: 1200, dur: 1, gain: 0.5 } };

/** Buffer de ruido blanco compartido por todas las voces de ruido. */
export function createNoiseBuffer(ac) {
  const len = Math.floor(ac.sampleRate * 0.5);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

/** Desconecta la envolvente al terminar para liberar las conexiones a los buses. */
function release(src, ...toDisconnect) {
  src.onended = () => {
    for (const n of toDisconnect) n.disconnect();
  };
}

function osc(ac, type, freq, t, detune = 0) {
  const o = ac.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  o.detune.value = detune;
  return o;
}

function voice808(ac, n, ev, t) {
  const c = BASS_808;
  const dur = ev.steps * STEP_S;
  const o = osc(ac, "sine", ev.freq * c.pitchMul, t);
  o.frequency.exponentialRampToValueAtTime(ev.freq, t + c.dropS); // caída de tono al atacar
  if (ev.glide) {
    const g0 = t + dur * c.glideStart;
    o.frequency.setValueAtTime(ev.freq, g0);
    o.frequency.exponentialRampToValueAtTime(ev.glide, g0 + c.glideS);
  }
  const g = ac.createGain();
  g.gain.setValueAtTime(SILENCE, t);
  g.gain.linearRampToValueAtTime(ev.vol, t + c.attackS);
  g.gain.exponentialRampToValueAtTime(ev.vol * c.sustainGain, t + Math.min(c.sustainMaxS, dur * 0.5));
  g.gain.exponentialRampToValueAtTime(SILENCE, t + dur);
  o.connect(g).connect(n.bass);
  o.start(t);
  o.stop(t + dur + c.tailS);
  release(o, g);
}

function kick(ac, n, ev, t) {
  const { body, click } = KICK;
  const o = osc(ac, "sine", body.startHz, t);
  o.frequency.exponentialRampToValueAtTime(body.endHz, t + body.sweepS);
  const g = ac.createGain();
  g.gain.setValueAtTime(ev.vol, t);
  g.gain.exponentialRampToValueAtTime(SILENCE, t + body.decayS);
  o.connect(g).connect(n.bus);
  o.start(t);
  o.stop(t + body.stopS);
  // Clic de ataque.
  const c = osc(ac, "square", click.startHz, t);
  c.frequency.exponentialRampToValueAtTime(click.endHz, t + click.sweepS);
  const cg = ac.createGain();
  cg.gain.setValueAtTime(ev.vol * click.gain, t);
  cg.gain.exponentialRampToValueAtTime(SILENCE, t + click.decayS);
  c.connect(cg).connect(n.bus);
  c.start(t);
  c.stop(t + click.stopS);
  release(o, g);
  release(c, cg);
}

function noiseHit(ac, n, t, { type, freq, q = 0.7, dur, vol, claps = false, send = null }) {
  const src = ac.createBufferSource();
  src.buffer = n.noise;
  const f = ac.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = ac.createGain();
  g.gain.setValueAtTime(SILENCE, t);
  if (claps) {
    const b = CLAP_BURSTS;
    for (const off of b.offsets) {
      g.gain.setValueAtTime(vol, t + off);
      g.gain.exponentialRampToValueAtTime(vol * b.hitFloor, t + off + b.hitDecayS);
    }
    g.gain.setValueAtTime(vol * b.tailGain, t + b.tailAt);
  } else {
    g.gain.setValueAtTime(vol, t);
  }
  g.gain.exponentialRampToValueAtTime(SILENCE, t + dur);
  src.connect(f).connect(g).connect(n.bus);
  if (send) g.connect(send);
  src.start(t, Math.random() * NOISE_OFFSET_MAX_S);
  src.stop(t + dur + NOISE_TAIL_S);
  release(src, f, g);
}

function clap(ac, n, ev, t) {
  noiseHit(ac, n, t, { ...CLAP, vol: ev.vol, claps: true, send: n.send });
}

function hat(ac, n, ev, t) {
  noiseHit(ac, n, t, { ...HAT, vol: ev.vol });
}

function openHat(ac, n, ev, t) {
  noiseHit(ac, n, t, { ...OPEN_HAT, vol: ev.vol });
}

function cowbell(ac, n, ev, t) {
  const c = COWBELL;
  const g = ac.createGain();
  g.gain.setValueAtTime(SILENCE, t);
  g.gain.linearRampToValueAtTime(ev.vol, t + c.attackS);
  g.gain.exponentialRampToValueAtTime(SILENCE, t + c.decayS);
  const a = osc(ac, "square", ev.freq, t, c.detune[0]);
  const b = osc(ac, "square", ev.freq * COWBELL_RATIO, t, c.detune[1]);
  a.connect(g);
  b.connect(g);
  g.connect(n.cow);
  for (const o of [a, b]) {
    o.start(t);
    o.stop(t + c.stopS);
  }
  release(a, g);
}

/** Sierras desafinadas (dos por frecuencia) conectadas a `out`. Devuelve la última, que sirve para liberar. */
function sawStack(ac, freqs, t, dur, out) {
  let last = null;
  for (const f of freqs) {
    for (const d of SAW_DETUNE) {
      const o = osc(ac, "sawtooth", f, t, d);
      o.connect(out);
      o.start(t);
      o.stop(t + dur + SAW_TAIL_S);
      last = o;
    }
  }
  return last;
}

// Colchón: sierras lentas por el pasabajos compartido.
function pad(ac, n, ev, t) {
  const dur = ev.steps * STEP_S;
  const g = ac.createGain();
  g.gain.setValueAtTime(SILENCE, t);
  g.gain.linearRampToValueAtTime(ev.vol, t + PAD.attackS);
  g.gain.setValueAtTime(ev.vol, t + Math.max(PAD.attackS, dur - PAD.releaseS));
  g.gain.linearRampToValueAtTime(SILENCE, t + dur);
  g.connect(n.pad);
  const last = sawStack(ac, ev.freqs, t, dur, g);
  if (last) release(last, g);
}

// Metales: sierras con filtro propio que abre y cierra rápido.
function stab(ac, n, ev, t) {
  const c = STAB;
  const dur = ev.steps * STEP_S;
  const g = ac.createGain();
  const lp = ac.createBiquadFilter();
  lp.type = "lowpass";
  lp.Q.value = c.q;
  lp.frequency.setValueAtTime(c.startHz, t);
  lp.frequency.exponentialRampToValueAtTime(c.peakHz, t + c.peakS);
  lp.frequency.exponentialRampToValueAtTime(c.endHz, t + dur);
  g.gain.setValueAtTime(SILENCE, t);
  g.gain.linearRampToValueAtTime(ev.vol, t + c.attackS);
  g.gain.exponentialRampToValueAtTime(SILENCE, t + dur);
  lp.connect(n.bus);
  g.connect(lp);
  const last = sawStack(ac, ev.freqs, t, dur, g);
  if (last) release(last, g, lp);
}

function riser(ac, n, ev, t) {
  const c = RISER;
  const dur = ev.steps * STEP_S;
  const src = ac.createBufferSource();
  src.buffer = n.noise;
  src.loop = true;
  const f = ac.createBiquadFilter();
  f.type = "bandpass";
  f.Q.value = c.noise.q;
  f.frequency.setValueAtTime(c.noise.startHz, t);
  f.frequency.exponentialRampToValueAtTime(c.noise.endHz, t + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(SILENCE, t);
  g.gain.exponentialRampToValueAtTime(ev.vol, t + dur);
  g.gain.linearRampToValueAtTime(SILENCE, t + dur + c.tailS);
  src.connect(f).connect(g).connect(n.bus);
  src.start(t);
  src.stop(t + dur + c.stopS);
  const o = osc(ac, "sine", c.tone.startHz, t);
  o.frequency.exponentialRampToValueAtTime(c.tone.endHz, t + dur);
  const og = ac.createGain();
  og.gain.setValueAtTime(SILENCE, t);
  og.gain.exponentialRampToValueAtTime(ev.vol * c.tone.gain, t + dur);
  og.gain.linearRampToValueAtTime(SILENCE, t + dur + c.tailS);
  o.connect(og).connect(n.bus);
  o.start(t);
  o.stop(t + dur + c.stopS);
  release(src, f, g);
  release(o, og);
}

function impact(ac, n, ev, t) {
  const c = IMPACT;
  const dur = ev.steps * STEP_S;
  const o = osc(ac, "sine", c.startHz, t);
  o.frequency.exponentialRampToValueAtTime(c.endHz, t + c.dropS);
  const g = ac.createGain();
  g.gain.setValueAtTime(ev.vol, t);
  g.gain.exponentialRampToValueAtTime(SILENCE, t + dur);
  o.connect(g).connect(n.bus);
  o.start(t);
  o.stop(t + dur + c.stopS);
  release(o, g);
  noiseHit(ac, n, t, { type: c.noise.type, freq: c.noise.freq, dur: c.noise.dur, vol: ev.vol * c.noise.gain });
}

/** Voz por nombre de evento de la partitura. */
export const VOICES = {
  "808": voice808,
  kick,
  clap,
  hat,
  ohat: openHat,
  cowbell,
  pad,
  stab,
  riser,
  impact,
};
