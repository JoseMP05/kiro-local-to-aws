// Efecto_Turbo: aumenta el Multiplicador_Velocidad del Tanque objetivo.
// Misma estructura que Efecto_Ralentizar: la fábrica guarda la cuenta de
// instancias activas por objetivo, de modo que al terminar una instancia
// el multiplicador solo vuelve a 1 cuando no queda ninguna.

/**
 * @param {{ factor: number }} opts
 * @returns {{ name: string, create: () => object }}
 */
export function createTurboEffect({ factor }) {
  const active = new Map(); // targetId → instancias activas

  return {
    name: "turbo",
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
