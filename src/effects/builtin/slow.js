// Efecto_Ralentizar: reduce el Multiplicador_Velocidad del Tanque objetivo.
// La fábrica guarda en su cierre un Map<targetId, count> compartido por todas
// las instancias de esta definición, de modo que la cuenta no es global del
// módulo: cada partida crea su propia definición.

/**
 * @param {{ factor: number }} opts
 * @returns {{ name: string, create: () => object }}
 */
export function createSlowEffect({ factor }) {
  const active = new Map(); // targetId → instancias activas

  return {
    name: "ralentizar",
    create() {
      return {
        onActivate(ctx) {
          const id = ctx.getTargetId();
          active.set(id, (active.get(id) ?? 0) + 1);
          ctx.setSpeedMultiplier(factor);
        },
        onEnd(ctx) {
          const id = ctx.getTargetId();
          const n = (active.get(id) ?? 1) - 1;
          if (n <= 0) {
            active.delete(id);
            ctx.setSpeedMultiplier(1);
          } else {
            active.set(id, n);
            ctx.setSpeedMultiplier(factor);
          }
        },
      };
    },
  };
}
