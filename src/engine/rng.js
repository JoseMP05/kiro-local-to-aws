// Fuente aleatoria determinista con semilla. mulberry32 es un generador
// pequeño y rápido que, dada una semilla, produce siempre la misma secuencia.
// El Motor_Juego lo usa en lugar de Math.random para ser reproducible.

/**
 * Crea un generador pseudoaleatorio con semilla.
 * @param {number} seed semilla entera (se trunca a 32 bits)
 * @returns {() => number} función que devuelve un número en [0, 1)
 */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
