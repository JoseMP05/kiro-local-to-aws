// Sistema_Efectos: registro, ciclo de vida y Puntos_Extensión. El Motor_Juego
// lo invoca en las fases 5 (applyPending), 7 (modifyInput), 14 (tickAll) y en
// las bajas/eliminaciones (endForTarget).

import { createEffectContext } from "./effect-context.js";
import { validateInput } from "../shared/validation.js";

/**
 * @param {object} opts
 * @param {object} opts.world estado de la partida (acceso a tanks por id)
 * @param {object} opts.config GameConfig
 * @param {() => number} opts.getTick
 * @param {(msg: string) => void} [opts.log]
 */
export function createEffectSystem({ world, config, getTick, log }) {
  const limits = {
    min: config.effects.speedMultiplierMin,
    max: config.effects.speedMultiplierMax,
  };
  const tickRate = config.tick.rate;
  const maxDurationMs = config.effects.maxDurationMs;

  const pending = []; // { def, targetTankId, durationMs, activationSeq, effectId }
  const active = []; // ActiveEffect
  let activationSeq = 0;
  let nextEffectId = 1;

  /** Valida y encola una activación. */
  function request(def, targetTankId, durationMs, tick) {
    if (!Number.isInteger(durationMs)) {
      return { ok: false, error: "DURATION_NOT_INTEGER" };
    }
    if (durationMs < 1 || durationMs > maxDurationMs) {
      return { ok: false, error: "DURATION_OUT_OF_RANGE" };
    }
    const tank = world.tanks.get(targetTankId);
    if (!tank) return { ok: false, error: "TARGET_NOT_FOUND" };
    if (tank.dead) return { ok: false, error: "TARGET_ELIMINATED" };

    const effectId = nextEffectId++;
    pending.push({ def, targetTankId, durationMs, activationSeq: activationSeq++, effectId });
    return { ok: true, effectId };
  }

  /** Fase 5: aplica las activaciones encoladas en orden de solicitud. */
  function applyPending() {
    // Orden por activationSeq (ya están en orden de inserción).
    const toApply = pending.splice(0, pending.length);
    toApply.sort((a, b) => a.activationSeq - b.activationSeq);
    for (const p of toApply) {
      const tank = world.tanks.get(p.targetTankId);
      if (!tank || tank.dead) {
        log?.(`[efecto ${p.def.name}] objetivo inactivo al aplicar la activación; se descarta`);
        continue;
      }
      const hooks = p.def.create();
      const eff = {
        activationSeq: p.activationSeq,
        effectId: p.effectId,
        name: p.def.name,
        targetTankId: p.targetTankId,
        durationMs: p.durationMs,
        elapsedTicks: 0,
        hooks,
        ctx: null,
        retired: false,
      };
      eff.ctx = createEffectContext({
        tank,
        getTick,
        getRemainingMs: () => remainingMs(eff),
        limits,
        isRetired: () => eff.retired,
        effectName: eff.name,
        log,
      });
      active.push(eff);
      runHook(eff, "onActivate");
    }
  }

  /** Fase 7: encadena los modifyInput de los Efectos del Tanque. */
  function modifyInput(tankId, input) {
    let current = input;
    for (const eff of active) {
      if (eff.retired) continue;
      if (eff.targetTankId !== tankId) continue;
      if (typeof eff.hooks.modifyInput !== "function") continue;
      try {
        const result = eff.hooks.modifyInput(eff.ctx, copyInput(current));
        const v = validateInput(result);
        if (v.ok) {
          current = v.input;
        }
        // Si no es válido, se ignora y la cadena sigue con el Input anterior.
      } catch (err) {
        handleHookError(eff, err);
      }
    }
    return current;
  }

  /** Fase 14: onTick, suma un Tick y expira los Efectos cumplidos. */
  function tickAll() {
    for (const eff of active) {
      if (eff.retired) continue;
      runHook(eff, "onTick");
      if (eff.retired) continue;
      eff.elapsedTicks += 1;
      if (elapsedMs(eff) >= eff.durationMs) {
        end(eff);
      }
    }
    sweepRetired();
  }

  /** Fases 1 y 13: finaliza todos los Efectos de un Tanque. */
  function endForTarget(tankId) {
    for (const eff of active) {
      if (eff.retired) continue;
      if (eff.targetTankId === tankId) end(eff);
    }
    sweepRetired();
  }

  /** Estado para el mensaje: [{ name, remainingMs }] del Tanque. */
  function activeFor(tankId) {
    const out = [];
    for (const eff of active) {
      if (eff.retired) continue;
      if (eff.targetTankId === tankId) {
        out.push({ name: eff.name, remainingMs: remainingMs(eff) });
      }
    }
    return out;
  }

  // --- internos ---

  function elapsedMs(eff) {
    return (eff.elapsedTicks * 1000) / tickRate;
  }

  function remainingMs(eff) {
    return Math.max(0, Math.ceil(eff.durationMs - elapsedMs(eff)));
  }

  function runHook(eff, name) {
    const fn = eff.hooks[name];
    if (typeof fn !== "function") return;
    try {
      fn(eff.ctx);
    } catch (err) {
      handleHookError(eff, err);
    }
  }

  /** Ejecuta onEnd (protegido) una vez y marca retired. */
  function end(eff) {
    if (eff.retired) return;
    const fn = eff.hooks.onEnd;
    if (typeof fn === "function") {
      try {
        fn(eff.ctx);
      } catch (err) {
        log?.(`[efecto ${eff.name}] ${err?.message ?? err}`);
      }
    }
    eff.retired = true;
  }

  /** Error en onActivate/modifyInput/onTick: registra, onEnd protegido y retira. */
  function handleHookError(eff, err) {
    log?.(`[efecto ${eff.name}] ${err?.message ?? err}`);
    end(eff);
  }

  function sweepRetired() {
    for (let i = active.length - 1; i >= 0; i--) {
      if (active[i].retired) active.splice(i, 1);
    }
  }

  function copyInput(input) {
    return {
      w: input.w, a: input.a, s: input.s, d: input.d,
      fire: input.fire, aim: input.aim,
    };
  }

  return { request, applyPending, modifyInput, tickAll, endForTarget, activeFor };
}
