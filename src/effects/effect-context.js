// Contexto_Efecto: la única API que un Efecto puede usar para consultar y
// modificar la partida. Se crea uno por activación y cierra sobre una
// referencia interna al Tanque objetivo que el Efecto no puede ver. Objeto
// congelado con exactamente las claves de la tabla del diseño.

/**
 * @param {object} opts
 * @param {object} opts.tank Tanque objetivo (referencia interna)
 * @param {() => number} opts.getTick Tick actual de la partida
 * @param {() => number} opts.getRemainingMs ms restantes del Efecto
 * @param {object} opts.limits { min, max } del Multiplicador_Velocidad
 * @param {() => boolean} opts.isRetired si el Efecto ya se retiró
 * @param {string} opts.effectName nombre del Efecto (para el registro de errores)
 * @param {(msg: string) => void} opts.log
 * @returns {object} Contexto_Efecto congelado
 */
export function createEffectContext(opts) {
  const { tank, getTick, getRemainingMs, limits, isRetired, effectName, log } = opts;

  const ctx = {
    // Consultas: devuelven primitivos o copias nuevas.
    getPosition() {
      return { x: tank.x, y: tank.y };
    },
    getHealth() {
      return tank.hp;
    },
    getScore() {
      return tank.score;
    },
    getNick() {
      return tank.nick;
    },
    getTargetId() {
      return tank.targetId;
    },
    getTick() {
      return getTick();
    },
    getRemainingMs() {
      return getRemainingMs();
    },
    getSpeedMultiplier() {
      return tank.speedMultiplier;
    },
    // Única escritura permitida.
    setSpeedMultiplier(v) {
      if (isRetired()) return; // Efecto retirado: ignora escrituras (Req. 22.8).
      if (typeof v !== "number" || !Number.isFinite(v)) {
        log?.(`[efecto ${effectName}] setSpeedMultiplier rechazó un valor no finito: ${v}`);
        return; // Conserva el valor (Req. 22.7).
      }
      tank.speedMultiplier = Math.max(limits.min, Math.min(limits.max, v));
    },
  };

  return Object.freeze(ctx);
}
