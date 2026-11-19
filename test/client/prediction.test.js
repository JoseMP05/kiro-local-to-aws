import { test } from "node:test";
import assert from "node:assert/strict";
import { createPredictor } from "../../src/client/prediction.js";
const N = { w: false, a: false, s: false, d: false, fire: false, aim: 0 };
const RIGHT = { ...N, d: true };
const make = (obstacles = []) =>
  createPredictor({ tickRate: 30, tankSize: 40, tankSpeed: 240, arena: { width: 2000, height: 1000 }, obstacles });
const step = 240 / 30; // unidades por Tick
test("el Tanque propio se mueve en el mismo Tick en que se envía el Input", () => {
  const p = make();
  p.reconcile({ x: 100, y: 500, dead: false });
  p.tick(RIGHT, 1, 0);
  assert.deepEqual(p.position(1000 / 30), { x: 100 + step, y: 500 });
});
test("reconcile vuelve a aplicar solo los Inputs que el servidor aún no confirmó", () => {
  const p = make();
  p.reconcile({ x: 100, y: 500, dead: false });
  for (let seq = 1; seq <= 5; seq++) p.tick(RIGHT, seq, seq * 33);
  // El servidor aplicó los 2 primeros: está 2 pasos a la derecha.
  p.reconcile({ x: 100 + 2 * step, y: 500, dead: false, ack: 2 });
  assert.equal(p.pendingCount(), 3);
  const pos = p.position(10000);
  assert.ok(Math.abs(pos.x - (100 + 5 * step)) < 1e-9, `x=${pos.x}`);
});
test("una diferencia pequeña se absorbe poco a poco, sin salto", () => {
  const p = make();
  p.reconcile({ x: 100, y: 500, dead: false });
  p.tick(RIGHT, 1, 0);
  const before = p.position(1000 / 30);
  // El servidor quedó 6 unidades por detrás de lo predicho.
  p.reconcile({ x: 100 + step - 6, y: 500, dead: false, ack: 1 });
  const same = p.position(1000 / 30);
  assert.ok(Math.abs(same.x - before.x) < 1e-9, "el dibujo no salta");
  const later = p.position(1000 / 30 + 1000);
  assert.ok(Math.abs(later.x - (100 + step - 6)) < 0.01, "termina en la posición del servidor");
});
test("una diferencia grande salta directamente", () => {
  const p = make();
  p.reconcile({ x: 100, y: 500, dead: false });
  p.reconcile({ x: 900, y: 500, dead: false });
  assert.deepEqual(p.position(0), { x: 900, y: 500 });
});
test("respeta Obstáculos y el multiplicador de velocidad del servidor", () => {
  const wall = [{ x: 130, y: 400, w: 40, h: 200 }];
  const p = make(wall);
  p.reconcile({ x: 100, y: 500, dead: false, speedMul: 1.6 });
  for (let seq = 1; seq <= 10; seq++) p.tick(RIGHT, seq, seq * 33);
  assert.equal(p.position(10000).x, 110, "se detiene contra la pared (130 − 20)");
  const q = make();
  q.reconcile({ x: 100, y: 500, dead: false, speedMul: 1.6 });
  q.tick(RIGHT, 1, 0);
  assert.ok(Math.abs(q.position(10000).x - (100 + step * 1.6)) < 1e-9);
});
test("eliminado: no hay predicción hasta reaparecer", () => {
  const p = make();
  p.reconcile({ x: 100, y: 500, dead: false });
  p.reconcile({ x: 100, y: 500, dead: true });
  assert.equal(p.position(0), null);
  p.tick(RIGHT, 1, 0); // ignorado mientras no hay posición
  assert.equal(p.pendingCount(), 0);
  p.reconcile({ x: 700, y: 300, dead: false });
  assert.deepEqual(p.position(0), { x: 700, y: 300 });
});
