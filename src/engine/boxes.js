// Aparición y recogida de Cajas.

import { squareAabb, aabbOverlap } from "./geometry.js";
import { findBoxPoint } from "./spawn.js";

/**
 * Intenta crear una Caja según el intervalo y el máximo (fase 15).
 * Devuelve la Caja creada o null. Actualiza world.lastBoxSpawnTick si toca
 * intentar (tanto si se crea como si no).
 * @param {object} world
 * @param {object} env { tick, tickRate, boxMax, boxIntervalS, boxSize,
 *                        boxMaxAttempts, arenaW, arenaH, obstacles, tankSize }
 * @param {() => number} rng
 * @param {() => number} nextId
 * @returns {object | null} Box
 */
export function trySpawnBox(world, env, rng, nextId) {
  const { tick, tickRate, boxMax, boxIntervalS, boxSize, boxMaxAttempts, arenaW, arenaH, obstacles, tankSize } = env;

  if (world.boxes.size >= boxMax) return null;

  const intervalTicks = Math.round(boxIntervalS * tickRate);
  const ref = Math.max(world.lastBoxSpawnTick, world.belowMaxSinceTick);
  if (tick - ref < intervalTicks) return null;

  // Toca intentar: se guarda lastBoxSpawnTick aunque falle (Req. 11.3).
  world.lastBoxSpawnTick = tick;

  const activeTanks = [];
  for (const t of world.tanks.values()) {
    if (!t.dead) activeTanks.push({ x: t.x, y: t.y });
  }
  const boxes = [];
  for (const b of world.boxes.values()) boxes.push({ x: b.x, y: b.y });

  const point = findBoxPoint(
    { arenaW, arenaH, obstacles, activeTanks, tankSize, boxes, boxSize },
    rng,
    boxMaxAttempts
  );
  if (!point) return null;

  const box = { id: nextId(), x: point.x, y: point.y, kind: pickKind(env.powerupChance ?? 0, rng) };
  return box;
}

/** Tipos de Caja que son potenciadores. */
export const POWERUP_KINDS = ["turbo", "escudo"];

/**
 * Elige el tipo de una Caja nueva. Con probabilidad 0 no consume el rng, de
 * modo que las partidas sin potenciadores se comportan igual que antes.
 */
function pickKind(powerupChance, rng) {
  if (powerupChance <= 0) return "puntos";
  if (rng() >= powerupChance) return "puntos";
  return POWERUP_KINDS[Math.floor(rng() * POWERUP_KINDS.length)];
}

/**
 * Recogida de Cajas por Tanques activos (fase 10). Para cada Caja superpuesta,
 * gana el Tanque activo de menor joinSeq. Suma boxPoints y emite boxPicked.
 * @param {object} world
 * @param {object} env { tankSize, boxSize, boxPoints }
 * @returns {Array<{ tankId: number, kind: string }>} eventos boxPicked
 */
export function collectBoxes(world, env) {
  const { tankSize, boxSize, boxPoints } = env;
  const picked = [];

  for (const [boxId, box] of [...world.boxes.entries()]) {
    const boxBox = squareAabb(box.x, box.y, boxSize);
    let winner = null;
    for (const t of world.tanks.values()) {
      if (t.dead) continue;
      if (aabbOverlap(boxBox, squareAabb(t.x, t.y, tankSize))) {
        if (winner === null || t.joinSeq < winner.joinSeq) winner = t;
      }
    }
    if (winner !== null) {
      // Solo las Cajas de puntos suman; los potenciadores dan un efecto (lo aplica game.js).
      if (box.kind === "puntos") winner.score += boxPoints;
      world.boxes.delete(boxId);
      picked.push({ tankId: winner.id, kind: box.kind });
    }
  }

  return picked;
}
