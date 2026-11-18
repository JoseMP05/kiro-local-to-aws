// Efectos de recogida de Cajas: textos y colores por tipo (con las cantidades
// configuradas) y la animación de la propia Caja (crece y se desvanece).
// Compartido por Cliente y Espectador.

import { drawCrate } from "./sprites.js";
import { EFFECT_COLORS } from "./ui-colors.js";

const COLLECT_MS = 350;
const MAX_FX = 40;

/**
 * Texto, color y colores de partículas del aviso al recoger una Caja.
 * @param {string} kind puntos | botiquin | turbo | escudo | ralentizar
 * @param {number} [amount] cantidad configurada (puntos o vida)
 * @returns {{ text: string, color: string, burst: string[] }}
 */
export function pickupInfo(kind, amount = 0) {
  switch (kind) {
    case "puntos": return { text: `+${amount} PTS`, color: "#ffd54f", burst: ["#ffd54f", "#fff3b0", "#ffb300"] };
    case "botiquin": return { text: `+${amount} VIDA`, color: "#69f0ae", burst: ["#69f0ae", "#ffffff", "#e53935"] };
    case "turbo": return { text: "TURBO!", color: EFFECT_COLORS.turbo, burst: [EFFECT_COLORS.turbo, "#ffffff", "#f9a825"] };
    case "escudo": return { text: "ESCUDO!", color: EFFECT_COLORS.escudo, burst: [EFFECT_COLORS.escudo, "#b3e5fc", "#ffffff"] };
    case "ralentizar": return { text: "LENTO!", color: EFFECT_COLORS.ralentizar, burst: [EFFECT_COLORS.ralentizar, "#78909c", "#ffffff"] };
    default: return { text: "", color: "#ffffff", burst: ["#ffffff"] };
  }
}

export function createPickupFx() {
  /** @type {Array<{ kind: string, x: number, y: number, born: number }>} */
  let list = [];

  function add(kind, x, y, now) {
    if (list.length >= MAX_FX) list.shift();
    list.push({ kind, x, y, born: now });
  }

  /** Dibuja las Cajas que se están recogiendo (con la transformación del mundo activa). */
  function draw(ctx, now, boxSize) {
    if (list.length === 0) return;
    list = list.filter((f) => now - f.born < COLLECT_MS);
    for (const f of list) {
      const k = (now - f.born) / COLLECT_MS;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - k);
      const sc = 1 + 0.9 * k;
      ctx.translate(f.x, f.y);
      ctx.scale(sc, sc);
      ctx.translate(-f.x, -f.y);
      drawCrate(ctx, f.x, f.y, boxSize, 0, f.kind);
      ctx.restore();
    }
  }

  return { add, draw, size: () => list.length };
}
