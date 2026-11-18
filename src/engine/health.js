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
