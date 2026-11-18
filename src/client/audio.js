// Sonidos sintetizados con WebAudio (sin archivos de audio). El navegador solo
// permite audio tras una interacción del usuario, así que el contexto se crea
// de forma perezosa en la primera reproducción. M activa o silencia los efectos;
// N activa o silencia la música de fondo (independiente de M).

import { createMusic } from "./music.js";

const MUSIC_PREF_KEY = "tanques.musica";

function readMusicPref() {
  try {
    return localStorage.getItem(MUSIC_PREF_KEY) !== "0";
  } catch {
    return true; // sin almacenamiento disponible: música activada por defecto
  }
}

function writeMusicPref(on) {
  try {
    localStorage.setItem(MUSIC_PREF_KEY, on ? "1" : "0");
  } catch {
    // almacenamiento bloqueado o lleno: la preferencia solo vale en esta sesión
  }
}

export function createAudio() {
  let ac = null;
  let muted = false;
  let musicOn = readMusicPref();
  let musicRequested = false; // el Jugador ya entró a la partida (hubo gesto del usuario)

  let acFailed = false; // el navegador no pudo crear el contexto: no se reintenta en cada sonido

  /** Reanuda/suspende sin que un rechazo de la promesa llegue a la consola ni al flujo del juego. */
  function safeCall(method) {
    try {
      ac[method]()?.catch(() => {});
    } catch {
      // contexto cerrado o sin soporte: el audio es opcional
    }
  }

  // Contexto compartido, sin tener en cuenta M (la música tiene su propio interruptor).
  // Devuelve null si no hay WebAudio o no se puede crear: el juego sigue sin sonido.
  function baseContext() {
    if (!ac) {
      if (acFailed) return null;
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) {
          acFailed = true;
          return null;
        }
        ac = new AC();
      } catch {
        acFailed = true;
        return null;
      }
    }
    if (ac.state === "suspended" && !document.hidden) safeCall("resume");
    return ac;
  }

  function ctx() {
    if (muted) return null;
    return baseContext();
  }

  const music = createMusic({ getContext: baseContext });

  // La música es opcional: ningún fallo suyo debe romper el juego ni la entrada a la partida.
  function safeMusic(fn) {
    try {
      fn();
    } catch (err) {
      console.warn("música: no se pudo iniciar", err);
    }
  }

  // Con la pestaña oculta se suspende el reloj de audio para que no se acumulen notas.
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      safeMusic(() => music.pause());
      if (ac && ac.state === "running") safeCall("suspend");
    } else if (ac) {
      safeCall("resume");
      safeMusic(() => music.resume());
    }
  });

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
    hit() { tone({ type: "square", from: 180, to: 60, ms: 120, volume: 0.07 }); },
    heal() {
      tone({ type: "triangle", from: 440, to: 660, ms: 100, volume: 0.07 });
      tone({ type: "triangle", from: 660, to: 880, ms: 140, volume: 0.07, delayMs: 90 });
    },
    streak() {
      tone({ type: "square", from: 523, to: 523, ms: 90, volume: 0.06 });
      tone({ type: "square", from: 659, to: 659, ms: 90, volume: 0.06, delayMs: 100 });
      tone({ type: "square", from: 784, to: 1046, ms: 220, volume: 0.06, delayMs: 200 });
    },
    powerup() {
      tone({ type: "sawtooth", from: 300, to: 900, ms: 220, volume: 0.06 });
    },
    /** Sonido propio de cada tipo de Caja recogida. */
    pickupKind(kind) {
      if (kind === "puntos") {
        // Moneda: dos notas agudas muy seguidas.
        tone({ type: "square", from: 988, to: 988, ms: 70, volume: 0.05 });
        tone({ type: "square", from: 1319, to: 1319, ms: 200, volume: 0.05, delayMs: 70 });
      } else if (kind === "botiquin") {
        // Curación: tono ascendente suave.
        tone({ type: "triangle", from: 392, to: 523, ms: 110, volume: 0.07 });
        tone({ type: "triangle", from: 523, to: 659, ms: 110, volume: 0.07, delayMs: 100 });
        tone({ type: "triangle", from: 659, to: 988, ms: 200, volume: 0.07, delayMs: 200 });
      } else if (kind === "turbo") {
        // Estela: barrido grave-agudo con ruido.
        tone({ type: "sawtooth", from: 180, to: 1100, ms: 320, volume: 0.045 });
        noise({ ms: 320, volume: 0.07 });
      } else if (kind === "escudo") {
        // Metálico: dos tonos inarmónicos con caída rápida.
        tone({ type: "square", from: 1175, to: 1150, ms: 260, volume: 0.04 });
        tone({ type: "square", from: 1760, to: 1720, ms: 200, volume: 0.03, delayMs: 30 });
        tone({ type: "triangle", from: 587, to: 580, ms: 320, volume: 0.06 });
      } else {
        tone({ type: "triangle", from: 660, to: 990, ms: 90, volume: 0.07 });
      }
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    isMuted() { return muted; },
    /** Crea/reanuda el contexto dentro de un gesto del usuario (p. ej. enviar el formulario). */
    unlock() {
      try {
        baseContext();
      } catch {
        // el audio nunca debe impedir unirse a la partida
      }
    },
    /** Arranca la música (si está activada) tras unirse a la partida. */
    startMusic() {
      musicRequested = true;
      if (musicOn) safeMusic(() => music.start());
    },
    /** N: activa o silencia la música y guarda la preferencia. Devuelve si queda activada. */
    toggleMusic() {
      musicOn = !musicOn;
      writeMusicPref(musicOn);
      if (musicOn) {
        if (musicRequested) safeMusic(() => music.start());
      } else {
        safeMusic(() => music.stop());
      }
      return musicOn;
    },
    isMusicOn() { return musicOn; },
  };
}
