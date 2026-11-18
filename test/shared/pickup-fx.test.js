import { test } from "node:test";
import assert from "node:assert/strict";
import { pickupInfo, createPickupFx } from "../../src/shared/pickup-fx.js";
import { POWERUP_KINDS } from "../../src/engine/boxes.js";

test("todos los tipos de Caja tienen un texto de aviso", () => {
  for (const kind of [...POWERUP_KINDS, "puntos"]) {
    const info = pickupInfo(kind, 10);
    assert.ok(info.text.length > 0, `${kind} sin texto`);
    assert.ok(info.burst.length > 0, `${kind} sin partículas`);
  }
});

test("el texto incluye la cantidad configurada de puntos y vida", () => {
  assert.equal(pickupInfo("puntos", 5).text, "+5 PTS");
  assert.equal(pickupInfo("botiquin", 35).text, "+35 VIDA");
});

test("createPickupFx.draw sin avisos no toca el contexto", () => {
  const fx = createPickupFx();
  const ctx = new Proxy({}, { get() { throw new Error("no debería usarse el contexto"); } });
  fx.draw(ctx, 0, 24);
  assert.equal(fx.size(), 0);
});
