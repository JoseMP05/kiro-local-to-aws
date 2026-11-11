// Utilidades matemáticas puras, compartidas por el Motor_Juego, el
// Sistema_Efectos, el Controlador_Bots y el cliente. Nombres en inglés,
// comentarios en español. Sin dependencias.

const TAU = Math.PI * 2;

/**
 * Normaliza un ángulo al rango [−π, π).
 * Fórmula del spec: a − 2π·floor((a + π)/(2π)).
 * @param {number} a ángulo en radianes
 * @returns {number} ángulo equivalente en [−π, π)
 */
export function normalizeAngle(a) {
  return a - TAU * Math.floor((a + Math.PI) / TAU);
}

/**
 * Interpolación lineal entre a y b con factor f.
 * @param {number} a extremo inicial
 * @param {number} b extremo final
 * @param {number} f factor (normalmente en [0, 1])
 * @returns {number}
 */
export function lerp(a, b, f) {
  return a + (b - a) * f;
}

/**
 * Interpolación angular por el camino más corto.
 * Calcula la diferencia mínima entre a y b y avanza esa fracción.
 * @param {number} a ángulo inicial en radianes
 * @param {number} b ángulo final en radianes
 * @param {number} f factor en [0, 1]
 * @returns {number} ángulo interpolado, normalizado a [−π, π)
 */
export function lerpAngle(a, b, f) {
  const diff = normalizeAngle(b - a);
  return normalizeAngle(a + diff * f);
}

/**
 * Recorta una ventana de tamaño `size` centrada en `c` para que quede dentro
 * de [0, arena]. Si la ventana es mayor o igual que la Arena en ese eje, se
 * centra en arena/2. Devuelve { lo, hi }.
 * @param {number} c centro deseado
 * @param {number} size tamaño de la ventana
 * @param {number} arena tamaño del eje de la Arena
 * @returns {{ lo: number, hi: number }}
 */
export function clampWindow(c, size, arena) {
  if (size >= arena) {
    const lo = arena / 2 - size / 2;
    return { lo, hi: lo + size };
  }
  let lo = c - size / 2;
  // Mantener lo dentro de [0, arena − size].
  if (lo < 0) lo = 0;
  else if (lo > arena - size) lo = arena - size;
  return { lo, hi: lo + size };
}
