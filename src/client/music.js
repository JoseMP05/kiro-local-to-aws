// Reproductor de la música de fondo procedural (WebAudio, sin archivos de
// audio). Aquí vive solo el grafo de mezcla y el planificador: la partitura
// está en music-score.js y los instrumentos en music-voices.js.
// El planificador adelantado (lookahead) fija el inicio de cada nota con el
// reloj del AudioContext; setTimeout solo despierta al planificador.

import { STEP_S, LOOP_STEPS, stepEvents } from "./music-score.js";
import { VOICES, createNoiseBuffer } from "./music-voices.js";

const LOOKAHEAD_S = 0.15; // cuánto se planifica por adelantado
const WAKE_MS = 40; // cada cuánto despierta el planificador
const START_DELAY_S = 0.08; // margen antes de la primera nota
const RESYNC_DELAY_S = 0.05; // margen al reanudar tras quedarse atrás el reloj

/** Curva de saturación suave (tipo tanh) para el 808. */
function saturationCurve(amount = 3.5) {
  const n = 1024;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * amount) / Math.tanh(amount);
  }
  return curve;
}

/**
 * Reproductor: planifica `stepEvents` con el reloj del AudioContext.
 * @param {{ getContext: () => (AudioContext|null), volume?: number }} deps
 */
export function createMusic({ getContext, volume = 0.06 }) {
  let timer = null;
  let playing = false;
  let nextTime = 0;
  let step = 0;
  let gain = null; // volumen general de la música
  let nodes = null; // buses compartidos (se crean una vez por contexto)
  let waitingFor = null; // contexto cuyo `statechange` espera el planificador
  let warned = false;

  /** Cadena de mezcla: voces -> buses -> compresor/limitador -> volumen -> salida. */
  function graph(ac) {
    if (gain && gain.context === ac) return nodes;
    gain = ac.createGain();
    gain.gain.value = 0;
    gain.connect(ac.destination);

    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -20;
    comp.knee.value = 8;
    comp.ratio.value = 8;
    comp.attack.value = 0.004;
    comp.release.value = 0.18;
    comp.connect(gain);

    const bus = ac.createGain();
    bus.connect(comp);

    // 808: saturación compartida por todas sus notas.
    const bass = ac.createGain();
    const shaper = ac.createWaveShaper();
    shaper.curve = saturationCurve();
    shaper.oversample = "2x";
    bass.connect(shaper).connect(bus);

    // Cencerro: pasabanda compartido.
    const cow = ac.createGain();
    const band = ac.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = 1700;
    band.Q.value = 1.1;
    cow.connect(band).connect(bus);

    // Colchón: pasabajos compartido.
    const pad = ac.createGain();
    const padLp = ac.createBiquadFilter();
    padLp.type = "lowpass";
    padLp.frequency.value = 650;
    pad.connect(padLp).connect(bus);

    // Eco con realimentación (cola de la palmada), filtrado para que oscurezca.
    const send = ac.createGain();
    const delay = ac.createDelay(1);
    delay.delayTime.value = 3 * STEP_S; // corchea con puntillo
    const fb = ac.createGain();
    fb.gain.value = 0.38;
    const fbLp = ac.createBiquadFilter();
    fbLp.type = "lowpass";
    fbLp.frequency.value = 2400;
    const wet = ac.createGain();
    wet.gain.value = 0.55;
    send.connect(delay);
    delay.connect(fbLp).connect(fb).connect(delay);
    delay.connect(wet).connect(bus);

    nodes = { bus, bass, cow, pad, send, noise: createNoiseBuffer(ac) };
    return nodes;
  }

  function playStep(ac, n, idx, t0) {
    for (const ev of stepEvents(idx)) {
      VOICES[ev.voice]?.(ac, n, ev, t0 + (ev.off ?? 0) * STEP_S);
    }
  }

  // Mientras el contexto no corre (suspendido, o el navegador espera un gesto)
  // no se sondea cada 40 ms: se espera a que pase a "running".
  function wakeWhenRunning(ac) {
    if (waitingFor === ac) return;
    waitingFor = ac;
    const onChange = () => {
      if (ac.state !== "running") return;
      ac.removeEventListener("statechange", onChange);
      waitingFor = null;
      if (playing && timer === null) {
        nextTime = ac.currentTime + RESYNC_DELAY_S;
        schedule();
      }
    };
    ac.addEventListener("statechange", onChange);
  }

  function schedule() {
    timer = null;
    if (!playing) return;
    try {
      const ac = getContext();
      if (!ac) return;
      if (ac.state !== "running") {
        wakeWhenRunning(ac);
        return;
      }
      const n = graph(ac);
      // Si el reloj se adelantó (pestaña en segundo plano), no se recuperan notas atrasadas.
      if (nextTime < ac.currentTime) nextTime = ac.currentTime + RESYNC_DELAY_S;
      const horizon = ac.currentTime + LOOKAHEAD_S;
      while (nextTime < horizon) {
        // El paso avanza antes de sonar: si una voz falla, ese paso se omite y no se repite.
        const idx = step;
        const t = nextTime;
        nextTime += STEP_S;
        step = (step + 1) % LOOP_STEPS;
        playStep(ac, n, idx, t);
      }
    } catch (err) {
      // Un fallo puntual no debe cortar la cadena de temporizadores: la música sigue en el siguiente despertar.
      if (!warned) {
        warned = true;
        console.warn("música: error al planificar", err);
      }
    }
    timer = setTimeout(schedule, WAKE_MS);
  }

  function clearTimer() {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  return {
    /** Empieza (o reanuda) la música con fundido de entrada. */
    start() {
      const ac = getContext();
      if (!ac) return;
      graph(ac);
      gain.gain.cancelScheduledValues(ac.currentTime);
      gain.gain.setTargetAtTime(volume, ac.currentTime, 0.15);
      if (playing) return;
      playing = true;
      nextTime = ac.currentTime + START_DELAY_S;
      clearTimer();
      schedule();
    },
    /** Detiene la música con fundido de salida. */
    stop() {
      playing = false;
      clearTimer();
      const ac = getContext();
      if (ac && gain) {
        gain.gain.cancelScheduledValues(ac.currentTime);
        gain.gain.setTargetAtTime(0, ac.currentTime, 0.05);
      }
    },
    /** Suspende el planificador (pestaña oculta) sin perder el estado. */
    pause() {
      clearTimer();
    },
    /** Reanuda el planificador tras una pausa; reinicia el reloj de notas. */
    resume() {
      if (!playing) return;
      const ac = getContext();
      if (!ac) return;
      nextTime = ac.currentTime + RESYNC_DELAY_S;
      clearTimer();
      schedule();
    },
    isPlaying() {
      return playing;
    },
  };
}
