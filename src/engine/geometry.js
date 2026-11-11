// Geometría pura para el Motor_Juego y el Controlador_Bots. Sin imports de red.
// Un AABB (axis-aligned bounding box) se representa con { x, y, w, h }, donde
// (x, y) es la esquina superior izquierda.

const EPS = 1e-9;

/**
 * Solape estricto entre dos AABB (tocarse por el borde no cuenta).
 * @returns {boolean}
 */
export function aabbOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/**
 * Construye el AABB de un cuadrado de Tanque centrado en (cx, cy) de lado size.
 */
export function squareAabb(cx, cy, size) {
  const half = size / 2;
  return { x: cx - half, y: cy - half, w: size, h: size };
}

/**
 * Intersección de un rayo (origen o, dirección d) con un AABB por el método de
 * slabs. Devuelve el contacto de entrada en el rango (eps, maxT], o null.
 * Indica el eje de la cara tocada y si es una esquina (|tX − tY| ≤ 1e−9).
 * @param {{x:number,y:number}} o origen
 * @param {{x:number,y:number}} d dirección (no necesariamente unitaria)
 * @param {{x:number,y:number,w:number,h:number}} box
 * @param {number} maxT distancia máxima en unidades de |d|·t
 * @returns {{ t: number, axis: "x"|"y", corner: boolean } | null}
 */
export function rayAabb(o, d, box, maxT) {
  const minX = box.x, maxX = box.x + box.w;
  const minY = box.y, maxY = box.y + box.h;

  // Eje X.
  let txEnterRaw, txExitRaw;
  if (Math.abs(d.x) < EPS) {
    // Rayo paralelo al eje X: sin entrada si está fuera de la franja.
    if (o.x < minX || o.x > maxX) return null;
    txEnterRaw = -Infinity;
    txExitRaw = Infinity;
  } else {
    const t1 = (minX - o.x) / d.x;
    const t2 = (maxX - o.x) / d.x;
    txEnterRaw = Math.min(t1, t2);
    txExitRaw = Math.max(t1, t2);
  }

  // Eje Y.
  let tyEnterRaw, tyExitRaw;
  if (Math.abs(d.y) < EPS) {
    if (o.y < minY || o.y > maxY) return null;
    tyEnterRaw = -Infinity;
    tyExitRaw = Infinity;
  } else {
    const t1 = (minY - o.y) / d.y;
    const t2 = (maxY - o.y) / d.y;
    tyEnterRaw = Math.min(t1, t2);
    tyExitRaw = Math.max(t1, t2);
  }

  const tEnter = Math.max(txEnterRaw, tyEnterRaw);
  const tExit = Math.min(txExitRaw, tyExitRaw);

  // Sin intersección si los intervalos no se solapan o la caja queda detrás.
  if (tEnter > tExit) return null;
  if (tExit < EPS) return null;
  if (tEnter > maxT) return null;

  // El contacto es la entrada (o el origen si ya está dentro: tEnter < eps).
  const t = tEnter;
  if (t <= EPS) return null; // Ya dentro o justo en el borde; no es un contacto nuevo.

  // La cara tocada es la del eje con mayor t de entrada.
  const corner = Math.abs(txEnterRaw - tyEnterRaw) <= 1e-9;
  const axis = txEnterRaw > tyEnterRaw ? "x" : "y";
  return { t, axis, corner };
}

/**
 * ¿El segmento de p0 a p1 interseca el AABB? Usa recorte de Liang-Barsky.
 * @returns {boolean}
 */
export function segmentIntersectsAabb(p0, p1, box) {
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  let t0 = 0, t1 = 1;
  const minX = box.x, maxX = box.x + box.w, minY = box.y, maxY = box.y + box.h;
  const clip = (p, q) => {
    if (Math.abs(p) < EPS) return q >= 0; // paralela
    const r = q / p;
    if (p < 0) {
      if (r > t1) return false;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return false;
      if (r < t1) t1 = r;
    }
    return true;
  };
  if (!clip(-dx, p0.x - minX)) return false;
  if (!clip(dx, maxX - p0.x)) return false;
  if (!clip(-dy, p0.y - minY)) return false;
  if (!clip(dy, maxY - p0.y)) return false;
  return t0 <= t1;
}

/** Distancia al cuadrado de un punto a un segmento. */
function pointSegDist2(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 < EPS ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx, cy = ay + t * dy;
  const ex = px - cx, ey = py - cy;
  return ex * ex + ey * ey;
}

/**
 * El menor t en [0, 1] en que el segmento (p0→p1) se acerca a distancia ≤ r de
 * un AABB (rectángulo redondeado = AABB agrandado r con esquinas de radio r).
 * Devuelve null si nunca toca.
 * @returns {number | null}
 */
export function segmentHitsRoundedRect(p0, p1, box, r) {
  const minX = box.x, maxX = box.x + box.w, minY = box.y, maxY = box.y + box.h;
  let best = null;

  // Contra el rectángulo agrandado r solo en X (franja [minX−r, maxX+r] × [minY, maxY]).
  const faceX = { x: minX - r, y: minY, w: box.w + 2 * r, h: box.h };
  const tX = firstSegmentAabbEntry(p0, p1, faceX);
  if (tX !== null) best = best === null ? tX : Math.min(best, tX);

  // Agrandado r solo en Y.
  const faceY = { x: minX, y: minY - r, w: box.w, h: box.h + 2 * r };
  const tY = firstSegmentAabbEntry(p0, p1, faceY);
  if (tY !== null) best = best === null ? tY : Math.min(best, tY);

  // Cuatro círculos de las esquinas.
  const corners = [
    [minX, minY], [maxX, minY], [minX, maxY], [maxX, maxY],
  ];
  for (const [cx, cy] of corners) {
    const tC = firstSegmentCircleEntry(p0, p1, cx, cy, r);
    if (tC !== null) best = best === null ? tC : Math.min(best, tC);
  }
  return best;
}

/** Primer t en [0,1] en que el segmento entra en el AABB, o null. */
function firstSegmentAabbEntry(p0, p1, box) {
  const dx = p1.x - p0.x, dy = p1.y - p0.y;
  let t0 = 0, t1 = 1;
  const minX = box.x, maxX = box.x + box.w, minY = box.y, maxY = box.y + box.h;
  const clip = (p, q) => {
    if (Math.abs(p) < EPS) return q >= 0;
    const r = q / p;
    if (p < 0) {
      if (r > t1) return false;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return false;
      if (r < t1) t1 = r;
    }
    return true;
  };
  if (!clip(-dx, p0.x - minX)) return null;
  if (!clip(dx, maxX - p0.x)) return null;
  if (!clip(-dy, p0.y - minY)) return null;
  if (!clip(dy, maxY - p0.y)) return null;
  if (t0 > t1) return null;
  return t0;
}

/** Primer t en [0,1] en que el segmento entra en el círculo (cx, cy, r), o null. */
function firstSegmentCircleEntry(p0, p1, cx, cy, r) {
  const dx = p1.x - p0.x, dy = p1.y - p0.y;
  const fx = p0.x - cx, fy = p0.y - cy;
  const a = dx * dx + dy * dy;
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - r * r;
  if (a < EPS) {
    // Segmento de longitud cero: ¿el punto está dentro?
    return c <= 0 ? 0 : null;
  }
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const sq = Math.sqrt(disc);
  const tA = (-b - sq) / (2 * a);
  const tB = (-b + sq) / (2 * a);
  // Primer t en [0, 1].
  if (tA >= 0 && tA <= 1) return tA;
  if (tB >= 0 && tB <= 1) return tB;
  // El segmento empieza dentro del círculo.
  if (tA < 0 && tB > 0) return 0;
  return null;
}
