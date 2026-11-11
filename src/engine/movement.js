// Movimiento de Tanques por ejes contra Obstáculos y bordes de la Arena.
// Resolución exacta: busca el Obstáculo más cercano en todo el recorrido, de
// modo que una Pared delgada nunca se atraviesa aunque el paso sea grande.

import { normalizeAngle } from "../shared/math.js";

/**
 * Calcula la dirección normalizada (dx, dy) a partir del Input WASD.
 * W → arriba (y−), S → abajo (y+), A → izquierda (x−), D → derecha (x+).
 * Las teclas opuestas se anulan. Devuelve (0,0) si no hay movimiento.
 */
export function inputDirection(input) {
  let dx = (input.d ? 1 : 0) - (input.a ? 1 : 0);
  let dy = (input.s ? 1 : 0) - (input.w ? 1 : 0);
  if (dx === 0 && dy === 0) return { x: 0, y: 0 };
  const len = Math.hypot(dx, dy);
  return { x: dx / len, y: dy / len };
}

/**
 * Mueve un Tanque un Tick según su Input y el Multiplicador_Velocidad.
 * Modifica tank.x, tank.y y tank.angle.
 * @param {object} tank
 * @param {object} input Input efectivo
 * @param {object} env { arenaW, arenaH, obstacles, tankSize, tankSpeed, tickRate }
 */
export function moveTank(tank, input, env) {
  const { arenaW, arenaH, obstacles, tankSize, tankSpeed, tickRate } = env;
  const half = tankSize / 2;

  // Orientación del cañón (independiente del movimiento).
  tank.angle = normalizeAngle(input.aim);

  const dir = inputDirection(input);
  if (dir.x === 0 && dir.y === 0) return; // Sin movimiento (Req. 6.5).

  const dist = (tankSpeed * tank.speedMultiplier) / tickRate;

  // --- Eje X ---
  const mx = dir.x * dist;
  if (mx !== 0) {
    tank.x = resolveAxisX(tank.x, tank.y, mx, half, arenaW, obstacles);
  }

  // --- Eje Y (usa la X ya actualizada) ---
  const my = dir.y * dist;
  if (my !== 0) {
    tank.y = resolveAxisY(tank.x, tank.y, my, half, arenaH, obstacles);
  }
}

/**
 * Resuelve el desplazamiento en X. Devuelve la nueva coordenada x del centro.
 */
function resolveAxisX(x, y, mx, half, arenaW, obstacles) {
  const top = y - half, bottom = y + half;
  if (mx > 0) {
    const tankRight = x + half;
    let limit = arenaW; // borde derecho de la Arena
    for (const o of obstacles) {
      // Solape estricto en Y y Obstáculo por delante.
      if (o.y < bottom && o.y + o.h > top && o.x >= tankRight - 1e-9) {
        if (o.x < limit) limit = o.x;
      }
    }
    const target = x + mx;
    return Math.min(target, limit - half);
  } else {
    const tankLeft = x - half;
    let limit = 0; // borde izquierdo de la Arena
    for (const o of obstacles) {
      if (o.y < bottom && o.y + o.h > top && o.x + o.w <= tankLeft + 1e-9) {
        if (o.x + o.w > limit) limit = o.x + o.w;
      }
    }
    const target = x + mx;
    return Math.max(target, limit + half);
  }
}

/**
 * Resuelve el desplazamiento en Y. Devuelve la nueva coordenada y del centro.
 */
function resolveAxisY(x, y, my, half, arenaH, obstacles) {
  const left = x - half, right = x + half;
  if (my > 0) {
    const tankBottom = y + half;
    let limit = arenaH;
    for (const o of obstacles) {
      if (o.x < right && o.x + o.w > left && o.y >= tankBottom - 1e-9) {
        if (o.y < limit) limit = o.y;
      }
    }
    const target = y + my;
    return Math.min(target, limit - half);
  } else {
    const tankTop = y - half;
    let limit = 0;
    for (const o of obstacles) {
      if (o.x < right && o.x + o.w > left && o.y + o.h <= tankTop + 1e-9) {
        if (o.y + o.h > limit) limit = o.y + o.h;
      }
    }
    const target = y + my;
    return Math.max(target, limit + half);
  }
}
