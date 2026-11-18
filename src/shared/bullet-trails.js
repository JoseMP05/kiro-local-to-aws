// Estelas de Balas: recuerda las últimas posiciones interpoladas de cada Bala
// (por id) para dibujar una cola corta. Barato: arrays pequeños por Bala y
// limpieza de los ids que ya no aparecen. Compartido por Cliente y Espectador.

import { drawBulletTrail } from "./sprites.js";

/**
 * @param {{ maxLength?: number }} [opts] longitud máxima de la estela
 */
export function createBulletTrails({ maxLength = 7 } = {}) {
  const trails = new Map(); // id -> { xs, ys, seen }
  let gen = 0;

  /** Llamar al empezar cada cuadro. */
  function begin() {
    gen++;
  }

  /** Registra la posición actual de una Bala y dibuja su estela (sin la cabeza). */
  function drawFor(ctx, id, x, y, r) {
    let tr = trails.get(id);
    if (!tr) {
      tr = { xs: [], ys: [], seen: gen };
      trails.set(id, tr);
    }
    tr.seen = gen;
    const n = tr.xs.length;
    // No se acumulan puntos duplicados (Bala quieta o cuadro repetido).
    if (n === 0 || tr.xs[n - 1] !== x || tr.ys[n - 1] !== y) {
      tr.xs.push(x);
      tr.ys.push(y);
      if (tr.xs.length > maxLength) {
        tr.xs.shift();
        tr.ys.shift();
      }
    }
    // La cola excluye la posición actual (ahí se dibuja la Bala).
    drawBulletTrail(ctx, tr.xs, tr.ys, r, tr.xs.length - 1);
  }

  /** Llamar al terminar cada cuadro: descarta estelas de Balas que ya no existen. */
  function end() {
    for (const [id, tr] of trails) if (tr.seen !== gen) trails.delete(id);
  }

  function clear() {
    trails.clear();
  }

  return { begin, drawFor, end, clear, size: () => trails.size };
}
