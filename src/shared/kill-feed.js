// Avisos de eliminación (Cliente_Juego y Vista_Espectador). Cola con
// expiración (5 s por defecto) y un máximo de avisos (5 por defecto); al pasar
// del máximo se retira el más antiguo. También decide qué rachas de eliminaciones se anuncian. Puro.

const MAX_ITEMS = 5;
const TTL_MS = 5000;

/**
 * @param {{ maxItems?: number, ttlMs?: number }} [opts]
 */
export function createKillFeed({ maxItems = MAX_ITEMS, ttlMs = TTL_MS } = {}) {
  // Cada item: { victim, killer, streak, expireAt }.
  let items = [];

  /** Añade un aviso con la hora actual. `streak` es la racha del autor. */
  function add(victim, killer, nowMs, streak = 0) {
    items.push({ victim, killer, streak, expireAt: nowMs + ttlMs });
    if (items.length > maxItems) {
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

/** ¿El aviso es una autodestrucción (el autor es la propia víctima)? */
export function isSelfKill(item) {
  return item.killer != null && item.killer === item.victim;
}

/** Texto plano de una línea del aviso de eliminaciones. */
export function killFeedText(item) {
  if (isSelfKill(item)) return `${item.victim} ✸ se autodestruyó`;
  const killer = item.killer ?? "?";
  const streak = item.streak >= 3 ? ` ×${item.streak}` : "";
  return `${killer} ► ${item.victim}${streak}`;
}

/**
 * Segmentos de una línea del aviso para dibujarla por colores.
 * @returns {Array<{ text: string, role: "killer"|"sep"|"victim"|"streak" }>}
 */
export function killFeedSegments(item) {
  if (isSelfKill(item)) {
    return [
      { text: item.victim, role: "victim" },
      { text: " ✸ ", role: "sep" },
      { text: "se autodestruyó", role: "killer" },
    ];
  }
  const segs = [
    { text: item.killer ?? "?", role: "killer" },
    { text: " ► ", role: "sep" },
    { text: item.victim, role: "victim" },
  ];
  if (item.streak >= 3) segs.push({ text: ` ×${item.streak}`, role: "streak" });
  return segs;
}
