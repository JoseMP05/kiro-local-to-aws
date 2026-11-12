// Impactos de Balas contra Tanques. Recorre las Balas en orden de creación y,
// para cada una, busca la primera superposición con un Tanque a lo largo de su
// recorrido (path). Aplica daño o descarta según invulnerabilidad y daño propio.

import { squareAabb, segmentHitsRoundedRect } from "./geometry.js";

/**
 * Procesa los impactos de un Tick. Modifica el hp de los Tanques y devuelve las
 * Balas que deben eliminarse y los Tanques eliminados en este Tick.
 * @param {object} env
 * @param {Iterable<object>} env.bullets Balas en orden de creación (con .path)
 * @param {Map<number,object>} env.tanks Tanques por id
 * @param {number} env.tankSize
 * @param {number} env.bulletRadius
 * @param {number} env.damage
 * @param {boolean} env.selfDamage
 * @param {number} env.tick
 * @param {Set<number>} env.bulletsToRemoveByBounce ids ya marcados por agotar rebotes
 * @returns {{ removeBullets: Set<number>, newlyDead: object[], impacts: Map<number,{ownerId,ownerNick}> }}
 */
export function resolveHits(env) {
  const { bullets, tanks, tankSize, bulletRadius, damage, selfDamage, bulletsToRemoveByBounce } = env;
  const removeBullets = new Set();
  const newlyDead = [];
  const deadSet = new Set(); // Tanques eliminados en este Tick: las Balas siguientes los ignoran.

  for (const b of bullets) {
    if (!b.path) continue;
    let hitTank = null;
    let hitT = Infinity;
    let hitSegIndex = -1;

    for (let si = 0; si < b.path.length; si++) {
      const seg = b.path[si];
      let candidate = null;
      let candidateT = Infinity;

      for (const t of tanks.values()) {
        if (t.dead) continue;
        if (deadSet.has(t.id)) continue;
        // Descartar emisor según reglas de daño propio.
        if (t.id === b.ownerId) {
          if (seg.bounces === 0) continue;
          if (!selfDamage) continue;
          if (b.ownerLife !== t.life) continue;
        }
        const box = squareAabb(t.x, t.y, tankSize);
        const tt = segmentHitsRoundedRect(seg.from, seg.to, box, bulletRadius);
        if (tt === null) continue;
        if (tt < candidateT - 1e-12 || (Math.abs(tt - candidateT) <= 1e-12 && (candidate === null || t.joinSeq < candidate.joinSeq))) {
          candidate = t;
          candidateT = tt;
        }
      }

      if (candidate !== null) {
        hitTank = candidate;
        hitT = candidateT;
        hitSegIndex = si;
        break; // Primer segmento con contacto.
      }
    }

    if (hitTank !== null) {
      removeBullets.add(b.id);
      const invulnerable = isInvulnerable(hitTank, env.tick);
      if (invulnerable) {
        // La Bala se elimina sin daño (Req. 9.5, 10.7).
      } else {
        hitTank.hp -= damage;
        hitTank.lastHit = { ownerId: b.ownerId, ownerNick: b.ownerNick };
        if (hitTank.hp <= 0) {
          hitTank.hp = 0;
          deadSet.add(hitTank.id);
          newlyDead.push(hitTank);
        }
      }
    } else if (bulletsToRemoveByBounce.has(b.id)) {
      removeBullets.add(b.id);
    }
  }

  return { removeBullets, newlyDead };
}

function isInvulnerable(tank, tick) {
  const protectedByRespawn = tank.invulnerableUntilTick >= 0 && tick <= tank.invulnerableUntilTick;
  const shielded = tank.shieldUntilTick >= 0 && tick <= tank.shieldUntilTick;
  return protectedByRespawn || shielded;
}
