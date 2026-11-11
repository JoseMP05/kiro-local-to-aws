// Limitador_Mensajes: controla la frecuencia de mensajes por conexión con
// ventanas fijas desde la apertura. Reloj inyectable para las pruebas.

/**
 * @param {object} opts
 * @param {number} opts.maxPerSecond mensajes permitidos por ventana de 1 s
 * @param {number} opts.maxConsecutive ventanas excedidas seguidas antes de cerrar
 * @param {() => number} opts.now reloj en ms
 * @param {number} opts.openedAt instante de apertura de la conexión en ms
 */
export function createRateLimiter({ maxPerSecond, maxConsecutive, now, openedAt }) {
  let currentWindow = -1;
  let count = 0;
  let consecutive = 0;

  function accept() {
    const win = Math.floor((now() - openedAt) / 1000);

    if (win !== currentWindow) {
      // Cambio de ventana.
      if (currentWindow >= 0) {
        // Si la ventana anterior no se excedió, o se saltó alguna, reinicia.
        const skipped = win - currentWindow > 1;
        const prevExceeded = count > maxPerSecond;
        if (!prevExceeded || skipped) {
          consecutive = 0;
        }
      }
      currentWindow = win;
      count = 0;
    }

    count += 1;

    if (count <= maxPerSecond) {
      return { deliver: true, close: false };
    }

    // count > max: no se entrega.
    if (count === maxPerSecond + 1) {
      // La ventana pasa a estar excedida.
      consecutive += 1;
      if (consecutive >= maxConsecutive) {
        return { deliver: false, close: true };
      }
    }
    return { deliver: false, close: false };
  }

  return { accept };
}
