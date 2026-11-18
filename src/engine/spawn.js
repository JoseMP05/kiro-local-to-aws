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

/** Tope efectivo de candidatos evaluados por búsqueda, sea cual sea la configuración. */
const MAX_SAFE_ATTEMPTS = 64;

/**
 * Busca un Punto_Seguro para un Tanque. Evalúa hasta `maxAttempts` candidatos
 * libres de Obstáculos y devuelve el que maximiza la distancia mínima a los
 * Tanques activos y a las Balas en vuelo. Si no hay amenazas devuelve el primer
 * candidato válido sin seguir buscando.
 * @param {object} env
 * @param {number} env.arenaW
 * @param {number} env.arenaH
 * @param {Array} env.obstacles
 * @param {Array<{x:number,y:number}>} env.activeTanks centros de Tanques activos
 * @param {Array<{x:number,y:number}>} [env.bullets] posiciones de Balas en vuelo
 * @param {number} env.tankSize
 * @param {() => number} rng
 * @param {number} maxAttempts se limita a MAX_SAFE_ATTEMPTS para acotar el costo por reaparición
 * @returns {{ x: number, y: number }}
 */
export function findSafePoint(env, rng, maxAttempts) {
  const { arenaW, arenaH, obstacles, activeTanks, tankSize } = env;
  const bullets = env.bullets ?? [];
  const half = tankSize / 2;
  const hasThreats = activeTanks.length > 0 || bullets.length > 0;
  const attempts = Math.min(maxAttempts, MAX_SAFE_ATTEMPTS);
  let best = null;

  for (let i = 0; i < attempts; i++) {
    const x = half + rng() * (arenaW - 2 * half);
    const y = half + rng() * (arenaH - 2 * half);
    if (overlapsObstacle(x, y, tankSize, obstacles)) continue;
    if (!hasThreats) return { x, y };

    const d2 = minDistanceSq(x, y, activeTanks, bullets);
    if (best === null || d2 > best.d2) best = { x, y, d2 };
  }

  if (best) return { x: best.x, y: best.y };
  return backupScan(arenaW, arenaH, obstacles, tankSize);
}

/** Distancia mínima al cuadrado (evita la raíz) a cualquiera de los Tanques o Balas dados. */
function minDistanceSq(x, y, tanks, bullets) {
  let dMin = Infinity;
  for (const t of tanks) {
    const dx = t.x - x;
    const dy = t.y - y;
    const d = dx * dx + dy * dy;
    if (d < dMin) dMin = d;
  }
  for (const b of bullets) {
    const dx = b.x - x;
    const dy = b.y - y;
    const d = dx * dx + dy * dy;
    if (d < dMin) dMin = d;
  }
  return dMin;
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
