// Avisos de eliminación (Cliente_Juego y Vista_Espectador). Cola con
// expiración de 5 s y máximo 5 avisos; al llegar el sexto se retira el más
// antiguo. También decide qué rachas de eliminaciones se anuncian. Puro.

const MAX_ITEMS = 5;
const TTL_MS = 5000;

export function createKillFeed() {
  // Cada item: { victim, killer, streak, expireAt }.
  let items = [];

  /** Añade un aviso con la hora actual. `streak` es la racha del autor. */
  function add(victim, killer, nowMs, streak = 0) {
    items.push({ victim, killer, streak, expireAt: nowMs + TTL_MS });
    if (items.length > MAX_ITEMS) {
      items.shift(); // retira el más antiguo
    }
  }

  /** Avisos vigentes (no expirados) en el instante nowMs. */
  function active(nowMs) {
    items = items.filter((it) => it.expireAt > nowMs);
    return items.map((it) => ({ victim: it.victim, killer: it.killer, streak: it.streak }));
  }

  function clear() {
    items = [];
  }

  return { add, active, clear };
}

/**
 * Texto del anuncio de una racha, o null si esa racha no se anuncia. Se
 * anuncian 3, 5 y luego cada múltiplo de 5.
 * @param {number} streak eliminaciones seguidas
 * @returns {string|null}
 */
export function streakMilestone(streak) {
  if (!Number.isInteger(streak) || streak < 3) return null;
  if (streak === 3) return "RACHA ×3";
  if (streak === 5) return "IMPARABLE ×5";
  if (streak % 5 === 0) return `LEYENDA ×${streak}`;
  return null;
}
