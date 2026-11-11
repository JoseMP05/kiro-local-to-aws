// Búfer de estados e interpolación para el Cliente_Juego y la Vista_Espectador.
// Dibuja en un Instante de render retrasado respecto al último estado recibido,
// interpolando entre dos estados. No extrapola.

import { lerp, lerpAngle } from "./math.js";

export { lerp, lerpAngle };

/**
 * Posición interpolada exacta en los extremos (f=0 → pa, f=1 → pb).
 */
export function interpolatePosition(pa, pb, f) {
  if (f <= 0) return { x: pa.x, y: pa.y };
  if (f >= 1) return { x: pb.x, y: pb.y };
  return { x: pa.x + (pb.x - pa.x) * f, y: pa.y + (pb.y - pa.y) * f };
}

/**
 * @param {object} opts
 * @param {number} opts.tickRate
 * @param {number} opts.interpolationDelayMs
 * @param {number} [opts.maxStates]
 */
export function createStateBuffer({ tickRate, interpolationDelayMs, maxStates = 30 }) {
  // Cada entrada: { tick, receivedAt, tanks: Map, bullets: Map, boxes: Map }.
  const states = [];

  const simTime = (tick) => tick / tickRate;

  function toMaps(state) {
    const tanks = new Map();
    for (const t of state.tanks) tanks.set(t.id, t);
    const bullets = new Map();
    for (const b of state.bullets) bullets.set(b.id, b);
    const boxes = new Map();
    for (const b of state.boxes) boxes.set(b.id, b);
    return { tanks, bullets, boxes };
  }

  /** Inserta un estado. Devuelve false si su tick ≤ el último. */
  function push(state, localNowMs) {
    const last = states[states.length - 1];
    if (last && state.tick <= last.tick) return false;
    const maps = toMaps(state);
    states.push({ tick: state.tick, receivedAt: localNowMs, ...maps });
    while (states.length > maxStates) states.shift();
    return true;
  }

  /** Instante de render en segundos de simulación. */
  function renderTime(localNowMs) {
    const last = states[states.length - 1];
    if (!last) return 0;
    return simTime(last.tick) + (localNowMs - last.receivedAt) / 1000 - interpolationDelayMs / 1000;
  }

  /** Muestrea el estado interpolado en el Instante de render. */
  function sample(localNowMs) {
    const empty = { tanks: new Map(), bullets: new Map(), boxes: new Map() };
    if (states.length === 0) return empty;

    const rt = renderTime(localNowMs);

    // Buscar A (último con simTime ≤ rt) y B (siguiente).
    let aIndex = -1;
    for (let i = 0; i < states.length; i++) {
      if (simTime(states[i].tick) <= rt) aIndex = i;
      else break;
    }

    if (aIndex === -1) {
      // rt antes del primer estado: dibujar el primero sin interpolar.
      return drawState(states[0]);
    }

    const a = states[aIndex];
    const b = states[aIndex + 1];

    if (!b) {
      // Sin B: última posición sin extrapolar (Req. 18.4).
      return drawState(a);
    }

    const tA = simTime(a.tick), tB = simTime(b.tick);
    const f = tB > tA ? (rt - tA) / (tB - tA) : 0;

    return interpStates(a, b, f);
  }

  // Dibuja un único estado sin interpolar (Tanques eliminados se saltan).
  function drawState(s) {
    const tanks = new Map();
    for (const [id, t] of s.tanks) {
      if (t.dead) continue;
      tanks.set(id, { ...t });
    }
    return { tanks, bullets: new Map(s.bullets), boxes: new Map(s.boxes) };
  }

  function interpStates(a, b, f) {
    const tanks = new Map();
    for (const [id, tb] of b.tanks) {
      if (tb.dead) continue;
      const ta = a.tanks.get(id);
      // Interpolar solo si estaba en A y no reaparece (de eliminado a activo).
      if (ta && !ta.dead) {
        const pos = interpolatePosition(ta, tb, f);
        tanks.set(id, { ...tb, x: pos.x, y: pos.y, angle: lerpAngle(ta.angle, tb.angle, f) });
      } else {
        tanks.set(id, { ...tb });
      }
    }

    const bullets = new Map();
    for (const [id, bb] of b.bullets) {
      const ba = a.bullets.get(id);
      if (ba) {
        const pos = interpolatePosition(ba, bb, f);
        bullets.set(id, { ...bb, x: pos.x, y: pos.y });
      } else {
        bullets.set(id, { ...bb });
      }
    }

    const boxes = new Map();
    for (const [id, box] of b.boxes) {
      boxes.set(id, { ...box });
    }

    return { tanks, bullets, boxes };
  }

  function clear() {
    states.length = 0;
  }

  return { push, renderTime, sample, clear };
}
