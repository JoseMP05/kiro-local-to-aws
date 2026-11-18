// Vida máxima según la posición en el Ranking. Funciones puras: el Líder y el
// resto del top 10 aguantan más, pero solo si ya tienen puntos (así nadie gana
// vida extra por entrar primero a una partida vacía).

/**
 * Vida extra para una posición del Ranking.
 * @param {number|null} position posición (1 = Líder) o null si no está en el Ranking
 * @param {number} score puntos del Tanque
 * @param {{ first: number, podium: number, top10: number }} bonus
 * @returns {number}
 */
export function rankHealthBonus(position, score, bonus) {
  if (position === null || position === undefined || score <= 0) return 0;
  if (position === 1) return bonus.first;
  if (position <= 3) return bonus.podium;
  if (position <= 10) return bonus.top10;
  return 0;
}

/**
 * Cambia la vida máxima de un Tanque. Si sube, el Tanque activo gana la
 * diferencia; si baja, la vida se recorta al nuevo máximo. Un Tanque eliminado
 * solo guarda el máximo, que usará al reaparecer.
 * @param {object} tank
 * @param {number} newMax
 */
export function setMaxHealth(tank, newMax) {
  const oldMax = tank.maxHp;
  if (newMax === oldMax) return;
  tank.maxHp = newMax;
  if (tank.dead) return;
  if (newMax > oldMax) tank.hp += newMax - oldMax;
  else tank.hp = Math.min(tank.hp, newMax);
}
/**
 * Regeneración de vida de un Tick. Un Tanque activo que lleva `delayTicks`
 * Ticks sin recibir daño recupera `perTick` de vida (puede ser fraccionario:
 * se acumula y solo se suman puntos enteros, así la vida sigue siendo entera).
 * @param {object} tank
 * @param {{ tick: number, delayTicks: number, perTick: number }} opts
 */
export function regenerate(tank, { tick, delayTicks, perTick }) {
  if (tank.dead || perTick <= 0 || tank.hp >= tank.maxHp) {
    tank.regenAcc = 0;
    return;
  }
  if (tank.lastDamageTick !== null && tick - tank.lastDamageTick < delayTicks) return;
  tank.regenAcc += perTick;
  const whole = Math.floor(tank.regenAcc + 1e-9);
  if (whole <= 0) return;
  tank.regenAcc -= whole;
  tank.hp = Math.min(tank.maxHp, tank.hp + whole);
}
