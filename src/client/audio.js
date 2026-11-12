// Sonidos sintetizados con WebAudio (sin archivos de audio). El navegador solo
// permite audio tras una interacción del usuario, así que el contexto se crea
// de forma perezosa en la primera reproducción. M activa o silencia.

export function createAudio() {
  let ac = null;
  let muted = false;

  function ctx() {
    if (muted) return null;
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ac = new AC();
    }
    if (ac.state === "suspended") ac.resume();
    return ac;
  }

  /** Tono con barrido de frecuencia y caída de volumen. */
  function tone({ type = "square", from, to, ms, volume = 0.08, delayMs = 0 }) {
    const a = ctx();
    if (!a) return;
    const t0 = a.currentTime + delayMs / 1000;
    const osc = a.createOscillator();
    const gain = a.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + ms / 1000);
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + ms / 1000);
    osc.connect(gain).connect(a.destination);
    osc.start(t0);
    osc.stop(t0 + ms / 1000 + 0.02);
  }

  /** Ruido blanco filtrado para explosiones. */
  function noise({ ms, volume = 0.15 }) {
    const a = ctx();
    if (!a) return;
    const len = Math.floor((a.sampleRate * ms) / 1000);
    const buf = a.createBuffer(1, len, a.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = a.createBufferSource();
    src.buffer = buf;
    const gain = a.createGain();
    gain.gain.value = volume;
    const filter = a.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 900;
    src.connect(filter).connect(gain).connect(a.destination);
    src.start();
  }

  return {
    shot() { tone({ type: "square", from: 520, to: 120, ms: 110, volume: 0.05 }); },
    explosion(loud = false) { noise({ ms: loud ? 450 : 260, volume: loud ? 0.22 : 0.1 }); },
    pickup() {
      tone({ type: "triangle", from: 660, to: 990, ms: 90, volume: 0.07 });
      tone({ type: "triangle", from: 990, to: 1320, ms: 120, volume: 0.07, delayMs: 80 });
    },
    powerup() {
      tone({ type: "sawtooth", from: 300, to: 900, ms: 220, volume: 0.06 });
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    isMuted() { return muted; },
  };
}
