import { test } from "node:test";
import assert from "node:assert/strict";
import { pickupInfo, createPickupFx } from "../../src/shared/pickup-fx.js";
import { POWERUP_KINDS } from "../../src/engine/boxes.js";
import { powerupBadges } from "../../src/client/hud.js";
import { EFFECT_COLORS } from "../../src/shared/ui-colors.js";

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

test("un efecto tiene el mismo color en el aviso y en la insignia del HUD", () => {
  assert.equal(pickupInfo("turbo").color, EFFECT_COLORS.turbo);
  assert.equal(pickupInfo("escudo").color, EFFECT_COLORS.escudo);
  assert.equal(pickupInfo("ralentizar").color, EFFECT_COLORS.ralentizar);
  const badges = powerupBadges({ shield: true, shieldMs: 1000, effects: [
    { name: "turbo", remainingMs: 1000 }, { name: "ralentizar", remainingMs: 1000 },
  ] });
  assert.deepEqual(badges.map((b) => b.color).sort(), [EFFECT_COLORS.escudo, EFFECT_COLORS.ralentizar, EFFECT_COLORS.turbo].sort());
});

test("createPickupFx.draw sin avisos no toca el contexto", () => {
  const fx = createPickupFx();
  const ctx = new Proxy({}, { get() { throw new Error("no debería usarse el contexto"); } });
  fx.draw(ctx, 0, 24);
  assert.equal(fx.size(), 0);
});
