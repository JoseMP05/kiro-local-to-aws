// Disparo, barrido de Balas con rebotes y tiempo de vida.
// La Bala es un círculo de radio r. Para el rebote se usa la suma de Minkowski:
// el centro de la Bala es un punto, los Obstáculos se agrandan r por lado y los
// bordes de la Arena se contraen r. Las esquinas del rectángulo agrandado son
// rectas, lo que da normales siempre alineadas a los ejes.

import { squareAabb, aabbOverlap } from "./geometry.js";

const EPS = 1e-9;

/**
 * Intenta disparar con un Tanque. Devuelve la Bala creada o null.
 * No modifica el Tanque salvo lastShotTick e invulnerabilidad cuando dispara.
 * @param {object} tank
 * @param {object} env { tick, tickRate, reloadMs, maxActive, barrelLength,
 *                        bulletSpeed, bulletRadius, arenaW, arenaH, obstacles }
 * @param {number} ownBulletCount Balas propias activas
 * @param {() => number} nextId generador de id de Bala
 * @returns {object | null} Bullet
 */
export function tryFire(tank, env, ownBulletCount, nextId) {
  const { tick, tickRate, reloadMs, maxActive, barrelLength, bulletSpeed, bulletRadius, arenaW, arenaH, obstacles } = env;

  // 1) Recarga en Ticks enteros.
  const reloadTicks = Math.ceil((reloadMs * tickRate) / 1000);
  const ticksSince = tank.lastShotTick === null ? Infinity : tick - tank.lastShotTick;
  if (ticksSince < reloadTicks) return null;

  // 2) Máximo de Balas propias.
  if (ownBulletCount >= maxActive) return null;

  // 3) Punta del cañón fuera de Obstáculos agrandados y dentro de los bordes.
  const aim = tank.angle;
  const tipX = tank.x + Math.cos(aim) * barrelLength;
  const tipY = tank.y + Math.sin(aim) * barrelLength;
  const r = bulletRadius;
  if (tipX < r || tipX > arenaW - r || tipY < r || tipY > arenaH - r) return null;
  for (const o of obstacles) {
    const grown = { x: o.x - r, y: o.y - r, w: o.w + 2 * r, h: o.h + 2 * r };
    if (tipX > grown.x && tipX < grown.x + grown.w && tipY > grown.y && tipY < grown.y + grown.h) {
      return null;
    }
  }

  // 4) Crear la Bala.
  const bullet = {
    id: nextId(),
    ownerId: tank.id,
    ownerNick: tank.nick,
    ownerLife: tank.life,
    x: tipX,
    y: tipY,
    vx: Math.cos(aim) * bulletSpeed,
    vy: Math.sin(aim) * bulletSpeed,
    bounces: 0,
    bornTick: tick,
    path: null,
  };
  tank.lastShotTick = tick;

  // 5) La invulnerabilidad termina al crear la Bala (Req. 7.10).
  tank.invulnerableUntilTick = -1;

  return bullet;
}

/** Construye la lista de Paredes para el barrido (bordes contraídos + Obstáculos agrandados). */
function buildWalls(arenaW, arenaH, obstacles, r) {
  // Cada Pared es un AABB. Los bordes de la Arena se modelan como el rectángulo
  // interior [r, W−r] × [r, H−r]; el contacto se detecta por sus cuatro líneas.
  const walls = [];
  for (const o of obstacles) {
    walls.push({ x: o.x - r, y: o.y - r, w: o.w + 2 * r, h: o.h + 2 * r });
  }
  return walls;
}

/**
 * Primer contacto del rayo (origen o, dirección unit·speed) con las Paredes,
 * dentro de (eps, maxDist]. Devuelve { t, point, axis, corner } o null.
 */
function firstContact(o, dirX, dirY, maxDist, arenaW, arenaH, walls, r) {
  let best = null;

  const consider = (t, axis) => {
    if (t <= EPS || t > maxDist + EPS) return;
    if (best === null || t < best.t - 1e-9) {
      best = { t, axis, corner: false };
    } else if (Math.abs(t - best.t) <= 1e-9 && best.axis !== axis) {
      // Dos Paredes en ejes distintos con el mismo t: esquina.
      best.corner = true;
    }
  };

  // Bordes de la Arena: líneas x=r, x=W−r, y=r, y=H−r.
  if (dirX > EPS) consider((arenaW - r - o.x) / dirX, "x");
  if (dirX < -EPS) consider((r - o.x) / dirX, "x");
  if (dirY > EPS) consider((arenaH - r - o.y) / dirY, "y");
  if (dirY < -EPS) consider((r - o.y) / dirY, "y");

  // Obstáculos agrandados: entrada por slabs.
  for (const w of walls) {
    const hit = slabEntry(o, dirX, dirY, w, maxDist);
    if (hit) {
      if (hit.corner) {
        consider(hit.t, "x");
        consider(hit.t, "y");
      } else {
        consider(hit.t, hit.axis);
      }
    }
  }

  if (best === null) return null;
  return {
    t: best.t,
    point: { x: o.x + dirX * best.t, y: o.y + dirY * best.t },
    axis: best.axis,
    corner: best.corner,
  };
}

/** Entrada de un rayo en un AABB por slabs; devuelve { t, axis, corner } o null. */
function slabEntry(o, dx, dy, box, maxDist) {
  const minX = box.x, maxX = box.x + box.w, minY = box.y, maxY = box.y + box.h;
  let txEnter, txExit, tyEnter, tyExit;
  if (Math.abs(dx) < EPS) {
    if (o.x <= minX || o.x >= maxX) return null;
    txEnter = -Infinity; txExit = Infinity;
  } else {
    const t1 = (minX - o.x) / dx, t2 = (maxX - o.x) / dx;
    txEnter = Math.min(t1, t2); txExit = Math.max(t1, t2);
  }
  if (Math.abs(dy) < EPS) {
    if (o.y <= minY || o.y >= maxY) return null;
    tyEnter = -Infinity; tyExit = Infinity;
  } else {
    const t1 = (minY - o.y) / dy, t2 = (maxY - o.y) / dy;
    tyEnter = Math.min(t1, t2); tyExit = Math.max(t1, t2);
  }
  const tEnter = Math.max(txEnter, tyEnter);
  const tExit = Math.min(txExit, tyExit);
  if (tEnter > tExit) return null;
  if (tExit < EPS) return null;
  if (tEnter > maxDist + EPS) return null;
  if (tEnter <= EPS) return null;
  const corner = Math.abs(txEnter - tyEnter) <= 1e-9;
  const axis = txEnter > tyEnter ? "x" : "y";
  return { t: tEnter, axis, corner };
}

/**
 * Avanza una Bala un Tick con rebotes. Devuelve { remove: boolean }.
 * Guarda b.path (segmentos con su contador de rebotes) para la fase de impactos.
 * @param {object} b Bala
 * @param {object} env { tick, tickRate, bulletSpeed, bulletLifetimeS, maxBounces,
 *                        bulletRadius, arenaW, arenaH, obstacles }
 */
export function advanceBullet(b, env) {
  const { tick, tickRate, bulletSpeed, bulletLifetimeS, maxBounces, bulletRadius, arenaW, arenaH, obstacles } = env;

  // Tiempo de vida.
  const lifeTicks = Math.round(bulletLifetimeS * tickRate);
  if (tick - b.bornTick >= lifeTicks) {
    b.path = [{ from: { x: b.x, y: b.y }, to: { x: b.x, y: b.y }, bounces: b.bounces }];
    return { remove: true };
  }

  const r = bulletRadius;
  const walls = buildWalls(arenaW, arenaH, obstacles, r);
  let remaining = bulletSpeed / tickRate;
  const path = [];
  let segStart = { x: b.x, y: b.y };
  let remove = false;

  // Número de contactos acotado por maxBounces + 1.
  for (let guard = 0; guard <= maxBounces + 1; guard++) {
    const speed = Math.hypot(b.vx, b.vy);
    const dirX = b.vx / speed, dirY = b.vy / speed;

    const hit = firstContact({ x: b.x, y: b.y }, dirX, dirY, remaining, arenaW, arenaH, walls, r);
    if (!hit) {
      // Sin contacto: avanzar lo que resta y cerrar el segmento.
      const to = { x: b.x + dirX * remaining, y: b.y + dirY * remaining };
      path.push({ from: segStart, to, bounces: b.bounces });
      b.x = to.x;
      b.y = to.y;
      break;
    }

    // Avanzar hasta el contacto.
    b.x = hit.point.x;
    b.y = hit.point.y;
    remaining -= hit.t;
    path.push({ from: segStart, to: { x: b.x, y: b.y }, bounces: b.bounces });

    if (b.bounces === maxBounces) {
      // Este contacto elimina la Bala en el punto de contacto (Req. 8.3).
      remove = true;
      break;
    }

    // Reflejar.
    if (hit.corner) {
      b.vx = -b.vx;
      b.vy = -b.vy;
    } else if (hit.axis === "x") {
      b.vx = -b.vx;
    } else {
      b.vy = -b.vy;
    }
    b.bounces += 1;
    segStart = { x: b.x, y: b.y };
    if (remaining <= EPS) break;
  }

  b.path = path;
  return { remove };
}
