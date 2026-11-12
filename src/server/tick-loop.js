// Bucle de Ticks a paso fijo. Programa cada Tick en inicio + n × dt con
// setTimeout para evitar la deriva de setInterval. Recupera hasta 5 Ticks
// seguidos si el proceso se retrasa; con retrasos mayores descarta el atraso.

/**
 * @param {object} opts
 * @param {object} opts.game
 * @param {object} opts.gateway
 * @param {number} opts.tickRate
 * @param {() => number} [opts.nowFn] reloj monótono en ms (performance.now)
 * @param {(fn: () => void, ms: number) => any} [opts.setTimeoutFn]
 * @param {(msg: string) => void} [opts.log]
 * @param {() => void} [opts.onFatal] se llama tras 10 fallos seguidos
 * @param {(ms: number) => void} [opts.onTickDuration] duración de cada Tick (simulación + envío)
 */
export function createTickLoop({ game, gateway, tickRate, nowFn, setTimeoutFn = setTimeout, log = () => {}, onFatal, onTickDuration }) {
  const now = nowFn ?? (() => performance.now());
  const dt = 1000 / tickRate; // ms por Tick
  const MAX_CATCHUP = 5;
  let startTime = 0;
  let tickCount = 0;
  let consecutiveFailures = 0;
  let running = false;

  function runOneTick() {
    const t0 = now();
    const result = game.step();
    gateway.afterStep(result);
    onTickDuration?.(now() - t0);
  }

  function schedule() {
    if (!running) return;
    const target = startTime + (tickCount + 1) * dt;
    const delay = Math.max(0, target - now());
    setTimeoutFn(onTimeout, delay);
  }

  function onTimeout() {
    if (!running) return;
    const t = now();
    // ¿Cuántos Ticks deberían haberse ejecutado ya?
    let due = Math.floor((t - startTime) / dt) - tickCount;
    if (due < 1) due = 1;
    const toRun = Math.min(due, MAX_CATCHUP);
    if (due > MAX_CATCHUP) {
      log(`[tick-loop] retraso de ${due} Ticks; se descarta el atraso`);
      // Avanzar el contador para no acumular deriva.
      tickCount = Math.floor((t - startTime) / dt) - MAX_CATCHUP;
    }

    for (let i = 0; i < toRun; i++) {
      try {
        runOneTick();
        tickCount++;
        consecutiveFailures = 0;
      } catch (err) {
        consecutiveFailures++;
        log(`[tick-loop] excepción en step(): ${err?.stack ?? err}`);
        if (consecutiveFailures >= 10) {
          log("[tick-loop] 10 fallos seguidos; deteniendo");
          running = false;
          onFatal?.();
          return;
        }
      }
    }
    schedule();
  }

  function start() {
    if (running) return;
    running = true;
    startTime = now();
    tickCount = 0;
    schedule();
  }

  function stop() {
    running = false;
  }

  return { start, stop };
}
