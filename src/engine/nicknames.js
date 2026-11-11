// Resolución de Apodos duplicados. Comparación sin distinguir mayúsculas.

/**
 * Devuelve un Apodo libre a partir de `base`. Si `base` no colisiona con
 * ninguno de `existentes` (sin distinguir mayúsculas), lo devuelve tal cual.
 * Si colisiona, prueba `base + n` con el menor n ≥ 2 que quede libre,
 * recortando el final de `base` para que el resultado no supere nickMax.
 * @param {string} base Apodo base ya validado y sin espacios en los extremos
 * @param {Iterable<string>} existentes Apodos presentes en la partida
 * @param {number} nickMax longitud máxima permitida
 * @returns {string}
 */
export function resolveNick(base, existentes, nickMax) {
  const taken = new Set();
  for (const e of existentes) taken.add(e.toLowerCase());

  if (!taken.has(base.toLowerCase())) return base;

  for (let n = 2; ; n++) {
    const suffix = String(n);
    // Recortar el base para que base + suffix no supere nickMax.
    const maxBaseLen = Math.max(0, nickMax - suffix.length);
    const chars = [...base];
    const trimmed = chars.slice(0, maxBaseLen).join("");
    const candidate = trimmed + suffix;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
}
