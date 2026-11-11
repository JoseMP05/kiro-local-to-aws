// Comprobación de conexión con ping/pong nativo de WebSocket. Cada intervalo,
// cierra las conexiones que no respondieron a tiempo y hace ping a las demás.

/**
 * @param {object} opts
 * @param {() => Iterable<object>} opts.connections devuelve las conexiones vivas
 * @param {number} opts.intervalMs
 * @param {number} opts.timeoutMs
 * @param {() => number} [opts.now] reloj en ms
 * @param {(fn: () => void, ms: number) => any} [opts.setIntervalFn]
 * @param {(h: any) => void} [opts.clearIntervalFn]
 * @returns {{ start(): void, stop(): void }}
 */
export function createHeartbeat({ connections, intervalMs, timeoutMs, now = Date.now, setIntervalFn = setInterval, clearIntervalFn = clearInterval }) {
  let handle = null;

  function tick() {
    const t = now();
    for (const conn of connections()) {
      if (t - conn.lastPongAt > timeoutMs) {
        conn.ws.terminate();
      } else {
        try {
          conn.ws.ping();
        } catch {
          // ignorar: el cierre se gestionará por el evento close
        }
      }
    }
  }

  function start() {
    if (handle) return;
    handle = setIntervalFn(tick, intervalMs);
  }

  function stop() {
    if (handle) {
      clearIntervalFn(handle);
      handle = null;
    }
  }

  return { start, stop, _tick: tick };
}
