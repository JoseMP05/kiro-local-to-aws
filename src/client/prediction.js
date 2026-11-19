// Predicción del movimiento propio en el Cliente_Juego. Puro, sin DOM.
//
// Sin predicción, el Tanque propio se dibuja donde el servidor dice que estaba
// hace un rato: ida al servidor + espera al Tick + vuelta + retraso de
// interpolación (unos 300 ms jugando contra AWS). Con predicción, el cliente
// mueve su Tanque en cuanto envía el Input, con la misma función de movimiento
// que el servidor, y corrige con cada estado:
//   1. Cada Tick del cliente envía un Input con `seq` y lo aplica localmente.
//   2. El estado del servidor trae `ack`: el último `seq` aplicado.
//   3. Se parte de la posición del servidor y se vuelven a aplicar los Inputs
//      que el servidor aún no había aplicado.
//   4. La diferencia con lo predicho se absorbe poco a poco en el dibujo.
import { moveTank } from "../shared/movement.js";

/** Más allá de esta distancia (unidades de Arena) la corrección es un salto. */
const SNAP_DISTANCE = 120;
/** Tiempo característico (ms) en que se absorbe una corrección pequeña. */
const SMOOTH_MS = 90;
/** Inputs sin confirmar que se guardan como mucho (unos 4 s a 30 Ticks/s). */
const MAX_PENDING = 120;

/**
 * @param {object} opts
 * @param {number} opts.tickRate Ticks por segundo
 * @param {number} opts.tankSize
 * @param {number} opts.tankSpeed velocidad base en unidades/s
 * @param {{ width: number, height: number }} opts.arena
 * @param {Array<{ x: number, y: number, w: number, h: number }>} opts.obstacles
 */
export function createPredictor({ tickRate, tankSize, tankSpeed, arena, obstacles }) {
  const env = { arenaW: arena.width, arenaH: arena.height, obstacles, tankSize, tankSpeed, tickRate };
  const tickMs = 1000 / tickRate;
  /** @type {Array<{ seq: number, input: object }>} */
  let pending = [];
  let pos = null; // posición predicha tras el último Tick del cliente
  let prev = null; // posición en el Tick anterior (para interpolar entre Ticks)
  let lastTickAt = 0;
  let speedMul = 1;
  let offset = { x: 0, y: 0 }; // corrección pendiente de absorber en el dibujo
  let lastDrawAt = null;

  function simulate(p, input) {
    const t = { x: p.x, y: p.y, angle: 0, speedMultiplier: speedMul };
    moveTank(t, input, env);
    return { x: t.x, y: t.y };
  }

  /** Un Tick del cliente: guarda el Input enviado y lo aplica a la posición predicha. */
  function tick(input, seq, now) {
    if (!pos) return;
    pending.push({ seq, input });
    if (pending.length > MAX_PENDING) pending.shift();
    prev = pos;
    pos = simulate(pos, input);
    lastTickAt = now;
  }

  /**
   * Corrige con el Tanque propio de un estado del servidor.
   * @param {{ x: number, y: number, dead: boolean, ack?: number, speedMul?: number } | undefined} own
   */
  function reconcile(own) {
    if (!own || own.dead) {
      reset();
      return;
    }
    speedMul = own.speedMul ?? 1;
    if (own.ack !== undefined) pending = pending.filter((p) => p.seq > own.ack);
    let p = { x: own.x, y: own.y };
    for (const { input } of pending) p = simulate(p, input);
    if (!pos) {
      pos = p;
      prev = p;
      offset = { x: 0, y: 0 };
      return;
    }
    const ex = pos.x - p.x;
    const ey = pos.y - p.y;
    if (Math.hypot(ex + offset.x, ey + offset.y) > SNAP_DISTANCE) {
      // Demasiado lejos (p. ej. un bloqueo que el cliente no vio): salto directo.
      offset = { x: 0, y: 0 };
      prev = p;
    } else {
      // El dibujo no salta: la diferencia pasa al desplazamiento, que se desvanece.
      offset = { x: offset.x + ex, y: offset.y + ey };
      prev = { x: prev.x - ex, y: prev.y - ey };
    }
    pos = p;
  }

  /** Posición para dibujar en `now`, o null si no hay predicción (sin Tanque o eliminado). */
  function position(now) {
    if (!pos) return null;
    const dt = lastDrawAt === null ? 0 : Math.max(0, now - lastDrawAt);
    lastDrawAt = now;
    const k = Math.exp(-dt / SMOOTH_MS);
    offset = { x: offset.x * k, y: offset.y * k };
    const f = Math.max(0, Math.min(1, (now - lastTickAt) / tickMs));
    return {
      x: prev.x + (pos.x - prev.x) * f + offset.x,
      y: prev.y + (pos.y - prev.y) * f + offset.y,
    };
  }

  function reset() {
    pending = [];
    pos = null;
    prev = null;
    offset = { x: 0, y: 0 };
  }

  return { tick, reconcile, position, reset, pendingCount: () => pending.length };
}

/** Tiempo (ms) en que la Bala propia pasa de salir del cañón dibujado a su recorrido real. */
const SHOT_BLEND_MS = 250;

/**
 * Ajuste de las Balas propias. El Tanque propio se dibuja en la posición
 * predicha, por delante de donde el servidor lo tenía al disparar; sin ajuste,
 * al avanzar las Balas saldrían por detrás del cañón. Cada Bala propia nueva se
 * desplaza lo mismo que el Tanque predicho respecto al del servidor, y ese
 * desplazamiento se reduce a cero en SHOT_BLEND_MS.
 */
export function createOwnBulletShift({ blendMs = SHOT_BLEND_MS } = {}) {
  const shifts = new Map(); // id de Bala -> { x, y, born }
  /**
   * @param {Map<number, { x: number, y: number, own?: boolean }>} bullets Balas interpoladas
   * @param {{ x: number, y: number }} shift Tanque predicho − Tanque del servidor (interpolado)
   * @param {number} now
   * @returns {Map} Balas con las propias desplazadas
   */
  function apply(bullets, shift, now) {
    const out = new Map();
    for (const [id, b] of bullets) {
      if (!b.own) {
        out.set(id, b);
        continue;
      }
      let s = shifts.get(id);
      if (!s) {
        s = { x: shift.x, y: shift.y, born: now };
        shifts.set(id, s);
      }
      const k = Math.max(0, 1 - (now - s.born) / blendMs);
      out.set(id, k > 0 ? { ...b, x: b.x + s.x * k, y: b.y + s.y * k } : b);
    }
    for (const id of shifts.keys()) if (!bullets.has(id)) shifts.delete(id);
    return out;
  }
  return { apply, size: () => shifts.size };
}
