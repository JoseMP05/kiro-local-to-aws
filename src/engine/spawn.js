// Búsqueda de Punto_Seguro para Tanques y de posición libre para Cajas.
// Funciones puras que reciben las dimensiones de la Arena, los Obstáculos y la
// fuente aleatoria de la partida.

import { squareAabb, aabbOverlap } from "./geometry.js";

/** ¿El cuadrado de lado `size` centrado en (cx, cy) solapa algún Obstáculo? */
function overlapsObstacle(cx, cy, size, obstacles) {
  const box = squareAabb(cx, cy, size);
  for (const o of obstacles) {
    if (aabbOverlap(box, o)) return true;
  }
  return false;
}

/**
 * Busca un Punto_Seguro para un Tanque.
 * @param {object} env
 * @param {number} env.arenaW
 * @param {number} env.arenaH
 * @param {Array} env.obstacles
 * @param {Array<{x:number,y:number}>} env.activeTanks centros de Tanques activos
 * @param {number} env.tankSize
 * @param {number} env.safeDistance distancia mínima a otros Tanques
 * @param {() => number} rng
 * @param {number} maxAttempts
 * @returns {{ x: number, y: number }}
 */
export function findSafePoint(env, rng, maxAttempts) {
  const { arenaW, arenaH, obstacles, activeTanks, tankSize, safeDistance } = env;
  const half = tankSize / 2;
  let best = null;

  for (let i = 0; i < maxAttempts; i++) {
    const x = half + rng() * (arenaW - 2 * half);
    const y = half + rng() * (arenaH - 2 * half);
    if (overlapsObstacle(x, y, tankSize, obstacles)) continue;

    let dMin = Infinity;
    for (const t of activeTanks) {
      const dx = t.x - x, dy = t.y - y;
      const d = Math.hypot(dx, dy);
      if (d < dMin) dMin = d;
    }
    if (dMin >= safeDistance) return { x, y };
    if (best === null || dMin > best.dMin) best = { x, y, dMin };
  }

  if (best) return { x: best.x, y: best.y };
  return backupScan(arenaW, arenaH, obstacles, tankSize);
}

/** Escaneo de respaldo: primera celda libre de Obstáculos en cuadrícula de paso tankSize. */
function backupScan(arenaW, arenaH, obstacles, size) {
  const half = size / 2;
  const step = size;
  for (let cx = half; cx <= arenaW - half + 1e-9; cx += step) {
    for (let cy = half; cy <= arenaH - half + 1e-9; cy += step) {
      if (!overlapsObstacle(cx, cy, size, obstacles)) return { x: cx, y: cy };
    }
  }
  // Nunca debería llegar aquí: el config-loader garantiza una celda libre.
  return { x: half, y: half };
}

/**
 * Busca una posición libre para una Caja. Evita Obstáculos, Tanques activos y
 * otras Cajas. Devuelve null tras maxAttempts intentos (Req. 11.3).
 * @param {object} env
 * @param {number} env.arenaW
 * @param {number} env.arenaH
 * @param {Array} env.obstacles
 * @param {Array<{x:number,y:number}>} env.activeTanks
 * @param {number} env.tankSize
 * @param {Array<{x:number,y:number}>} env.boxes posiciones de Cajas existentes
 * @param {number} env.boxSize
 * @param {() => number} rng
 * @param {number} maxAttempts
 * @returns {{ x: number, y: number } | null}
 */
export function findBoxPoint(env, rng, maxAttempts) {
  const { arenaW, arenaH, obstacles, activeTanks, tankSize, boxes, boxSize } = env;
  const half = boxSize / 2;

  for (let i = 0; i < maxAttempts; i++) {
    const x = half + rng() * (arenaW - 2 * half);
    const y = half + rng() * (arenaH - 2 * half);
    if (overlapsObstacle(x, y, boxSize, obstacles)) continue;

    const boxBox = squareAabb(x, y, boxSize);
    let blocked = false;
    for (const t of activeTanks) {
      if (aabbOverlap(boxBox, squareAabb(t.x, t.y, tankSize))) { blocked = true; break; }
    }
    if (blocked) continue;
    for (const b of boxes) {
      if (aabbOverlap(boxBox, squareAabb(b.x, b.y, boxSize))) { blocked = true; break; }
    }
    if (blocked) continue;

    return { x, y };
  }
  return null;
}
