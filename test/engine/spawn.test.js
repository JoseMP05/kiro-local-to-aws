import { test } from "node:test";
import assert from "node:assert/strict";
import { findSafePoint } from "../../src/engine/spawn.js";
import { mulberry32 } from "../../src/engine/rng.js";

const ENV = { arenaW: 4000, arenaH: 2000, obstacles: [], tankSize: 40 };

function minDist(p, things) {
  return Math.min(...things.map((t) => Math.hypot(t.x - p.x, t.y - p.y)));
}

test("findSafePoint elige el candidato que maximiza la distancia mínima a los Tanques", () => {
  const tanks = [{ x: 1000, y: 1000 }, { x: 3000, y: 1000 }, { x: 2000, y: 500 }];
  // Mismo flujo de rng: la elección debe ser el mejor de los candidatos evaluados.
  const rngA = mulberry32(5);
  const chosen = findSafePoint({ ...ENV, activeTanks: tanks }, rngA, 40);
  const rngB = mulberry32(5);
  const half = 20;
  let bestD = -Infinity;
  for (let i = 0; i < 40; i++) {
    const x = half + rngB() * (ENV.arenaW - 2 * half);
    const y = half + rngB() * (ENV.arenaH - 2 * half);
    bestD = Math.max(bestD, minDist({ x, y }, tanks));
  }
  assert.ok(Math.abs(minDist(chosen, tanks) - bestD) < 1e-9);
});

test("más intentos nunca empeoran la distancia mínima obtenida", () => {
  const tanks = Array.from({ length: 40 }, (_, i) => ({ x: 100 + (i % 10) * 380, y: 100 + Math.floor(i / 10) * 500 }));
  const few = findSafePoint({ ...ENV, activeTanks: tanks }, mulberry32(9), 3);
  const many = findSafePoint({ ...ENV, activeTanks: tanks }, mulberry32(9), 60);
  assert.ok(minDist(many, tanks) >= minDist(few, tanks));
});

test("findSafePoint también se aleja de las Balas en vuelo", () => {
  const bullets = [{ x: 1000, y: 1000 }];
  const p = findSafePoint({ ...ENV, activeTanks: [], bullets }, mulberry32(2), 30);
  // Sin amenazas de Tanques pero con Balas se evalúan todos los candidatos.
  const first = findSafePoint({ ...ENV, activeTanks: [] }, mulberry32(2), 30);
  assert.ok(minDist(p, bullets) >= minDist(first, bullets));
});

test("findSafePoint evita Obstáculos", () => {
  const obstacles = [{ x: 0, y: 0, w: 4000, h: 1900 }]; // solo queda libre la franja inferior
  const p = findSafePoint({ ...ENV, obstacles, activeTanks: [{ x: 10, y: 10 }] }, mulberry32(1), 100);
  assert.ok(p.y - 20 >= 1900);
});

test("findSafePoint: si todos los candidatos caen en Obstáculos usa el escaneo de respaldo", () => {
  // Todo bloqueado salvo una franja a la derecha; el rng fijo siempre cae en x = 2000.
  const obstacles = [{ x: 0, y: 0, w: 3900, h: 2000 }];
  const rng = () => 0.5;
  const expected = { x: 3940, y: 20 }; // primera celda libre de la cuadrícula de respaldo
  assert.deepEqual(findSafePoint({ ...ENV, obstacles, activeTanks: [] }, rng, 5), expected);
  // Con amenazas la ruta pasa por la comparación de distancias y llega al mismo respaldo.
  assert.deepEqual(findSafePoint({ ...ENV, obstacles, activeTanks: [{ x: 100, y: 100 }] }, rng, 5), expected);
});

test("findSafePoint limita los candidatos evaluados por búsqueda", () => {
  let calls = 0;
  const rng = () => { calls++; return 0.5; };
  findSafePoint({ ...ENV, obstacles: [{ x: 0, y: 0, w: 4000, h: 2000 }], activeTanks: [] }, rng, 10_000);
  assert.ok(calls <= 2 * 64, `${calls} llamadas al rng`);
});
