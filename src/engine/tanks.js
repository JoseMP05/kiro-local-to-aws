// Creación de Tanques, Input neutro, reaparición, invulnerabilidad e
// Identificador_Objetivo. Puro respecto a la red; solo usa config y rng.

/** Input neutro congelado: sin teclas, sin disparo, ángulo 0. */
export const NEUTRAL_INPUT = Object.freeze({
  w: false, a: false, s: false, d: false, fire: false, aim: 0,
});

/** Formatea un entero de 32 bits como 8 dígitos hexadecimales. */
function hex8(n) {
  return (n >>> 0).toString(16).padStart(8, "0");
}

/**
 * Genera un Identificador_Objetivo opaco y único en la partida.
 * Consume dos valores de rng (o más si colisiona). Se llama DESPUÉS de buscar
 * el Punto_Seguro para que la posición no dependa de si hubo colisión.
 * @param {{ issuedTargetIds: Set<string> }} world
 * @param {() => number} rng
 * @returns {string}
 */
export function newTargetId(world, rng) {
  let id;
  do {
    const hi = Math.floor(rng() * 2 ** 32);
    const lo = Math.floor(rng() * 2 ** 32);
    id = "t_" + hex8(hi) + hex8(lo);
  } while (world.issuedTargetIds.has(id));
  world.issuedTargetIds.add(id);
  return id;
}

/**
 * Crea un Tanque. El targetId se genera fuera y se pasa aquí.
 * @param {object} opts
 * @returns {object} Tank
 */
export function createTank(opts) {
  const {
    id, joinSeq, connId, isBot, nick, targetId,
    x, y, maxHealth,
  } = opts;
  return {
    id,
    joinSeq,
    connId: connId ?? null,
    isBot: !!isBot,
    targetId,
    nick,
    x,
    y,
    angle: 0,
    hp: maxHealth,
    score: 0,
    dead: false,
    deadTick: null,
    deathPos: null,
    life: 0,
    lastShotTick: null,
    invulnerableUntilTick: -1,
    speedMultiplier: 1,
    lastInput: NEUTRAL_INPUT,
  };
}

/**
 * Reaparece un Tanque eliminado. Conserva id, Apodo, joinSeq, targetId y
 * puntos. Restaura vida máxima, incrementa `life`, limpia el disparo y fija la
 * invulnerabilidad por tiempo.
 * @param {object} tank
 * @param {object} opts { x, y, tick, maxHealth, protectionTicks }
 */
export function respawnTank(tank, { x, y, tick, maxHealth, protectionTicks }) {
  tank.x = x;
  tank.y = y;
  tank.hp = maxHealth;
  tank.dead = false;
  tank.deadTick = null;
  tank.deathPos = null;
  tank.life += 1;
  tank.lastShotTick = null;
  tank.speedMultiplier = 1;
  tank.lastInput = NEUTRAL_INPUT;
  tank.invulnerableUntilTick = tick + protectionTicks;
}
