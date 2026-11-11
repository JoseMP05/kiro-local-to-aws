// Avisos de eliminación de la Vista_Espectador. Cola con expiración de 5 s y
// máximo 5 avisos; al llegar el sexto se retira el más antiguo. Puro.

const MAX_ITEMS = 5;
const TTL_MS = 5000;

export function createKillFeed() {
  // Cada item: { victim, killer, expireAt }.
  let items = [];

  /** Añade un aviso con la hora actual. */
  function add(victim, killer, nowMs) {
    items.push({ victim, killer, expireAt: nowMs + TTL_MS });
    if (items.length > MAX_ITEMS) {
      items.shift(); // retira el más antiguo
    }
  }

  /** Avisos vigentes (no expirados) en el instante nowMs. */
  function active(nowMs) {
    items = items.filter((it) => it.expireAt > nowMs);
    return items.map((it) => ({ victim: it.victim, killer: it.killer }));
  }

  function clear() {
    items = [];
  }

  return { add, active, clear };
}
