import { test } from "node:test";
import assert from "node:assert/strict";
import { pickKind, POWERUP_KINDS } from "../../src/engine/boxes.js";

/** rng falso: devuelve los valores dados en orden (el último se repite). */
function stub(...values) {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

test("pickKind: con probabilidad 0 es 'puntos' y no consume el rng", () => {
  let calls = 0;
  assert.equal(pickKind(0, undefined, () => { calls++; return 0; }), "puntos");
  assert.equal(calls, 0);
});

test("pickKind: si el primer sorteo no alcanza la probabilidad, es 'puntos'", () => {
  assert.equal(pickKind(0.4, undefined, stub(0.4, 0)), "puntos");
  assert.equal(pickKind(0.4, undefined, stub(0.39, 0)), POWERUP_KINDS[0]);
});

test("pickKind: un peso 0 nunca se elige, sea cual sea el segundo sorteo", () => {
  const weights = { turbo: 0, escudo: 1, botiquin: 1 };
  for (let i = 0; i < 1000; i++) {
    const kind = pickKind(1, weights, stub(0, i / 1000));
    assert.notEqual(kind, "turbo");
    assert.ok(kind === "escudo" || kind === "botiquin");
  }
});

test("pickKind: los pesos reparten el intervalo en proporción", () => {
  const weights = { turbo: 1, escudo: 0, botiquin: 3 };
  assert.equal(pickKind(1, weights, stub(0, 0.24)), "turbo");
  assert.equal(pickKind(1, weights, stub(0, 0.26)), "botiquin");
  assert.equal(pickKind(1, weights, stub(0, 0.999)), "botiquin");
});

test("pickKind: todos los pesos en 0 caen a 'puntos'", () => {
  assert.equal(pickKind(1, { turbo: 0, escudo: 0, botiquin: 0 }, stub(0, 0.5)), "puntos");
});

test("pickKind: una clave ausente pesa 1 (valor por defecto)", () => {
  // Solo turbo declarado en 0: escudo y botiquín valen 1 cada uno.
  assert.equal(pickKind(1, { turbo: 0 }, stub(0, 0)), "escudo");
  assert.equal(pickKind(1, { turbo: 0 }, stub(0, 0.99)), "botiquin");
  // Sin pesos: reparto en tercios.
  assert.equal(pickKind(1, undefined, stub(0, 0.1)), "turbo");
  assert.equal(pickKind(1, undefined, stub(0, 0.5)), "escudo");
  assert.equal(pickKind(1, undefined, stub(0, 0.9)), "botiquin");
});
