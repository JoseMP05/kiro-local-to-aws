// Eliminación y puntuación. Para cada Tanque eliminado en este Tick, aplica la
// pérdida de puntos, otorga puntos al autor (con bonificación si la víctima era
// el Líder de la fase 0) y marca el estado de muerte.

import { NEUTRAL_INPUT } from "./tanks.js";

/**
 * @param {object} env
 * @param {object[]} env.newlyDead Tanques eliminados en este Tick, en orden
 * @param {Map<number,object>} env.tanks
 * @param {number} env.tick
 * @param {number} env.killPoints
 * @param {number} env.leaderBonus
 * @param {number} env.deathLossPercent
 * @param {number|null} env.leaderId Líder al inicio del Tick (fase 0)
 * @returns {Array<{victimNick:string,killerNick:string|null}>} eventos kill
 */
export function applyScoring(env) {
  const { newlyDead, tanks, tick, killPoints, leaderBonus, deathLossPercent, leaderId } = env;
  const kills = [];

  for (const victim of newlyDead) {
    // 1) Pérdida de puntos.
    const lost = Math.floor((victim.score * deathLossPercent) / 100);
    victim.score -= lost;

    // 2) Puntos al autor.
    const hit = victim.lastHit;
    let killerNick = hit ? hit.ownerNick : null;
    if (hit && hit.ownerId !== victim.id) {
      const killer = tanks.get(hit.ownerId);
      if (killer) {
        killer.score += killPoints;
        if (leaderId !== null && victim.id === leaderId) {
          killer.score += leaderBonus;
        }
      }
      // Si el autor ya no está en la partida, nadie gana puntos (Req. 12.6).
    }

    // 3) Marcar la muerte.
    victim.dead = true;
    victim.deadTick = tick;
    victim.deathPos = { x: victim.x, y: victim.y };
    victim.lastInput = NEUTRAL_INPUT;
    victim.lastHit = null;

    kills.push({ victimNick: victim.nick, killerNick });
  }

  return kills;
}
