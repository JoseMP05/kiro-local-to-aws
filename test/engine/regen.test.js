import { test } from "node:test";
import assert from "node:assert/strict";
import { makeGame, advance } from "../helpers/game-factory.js";
import { regenerate } from "../../src/engine/health.js";
import { buildWelcomeConfig } from "../../src/server/snapshot.js";
const tank = (over = {}) => ({ dead: false, hp: 50, maxHp: 100, lastDamageTick: null, regenAcc: 0, ...over });
test("regenerate: suma vida entera acumulando fracciones", () => {
  const t = tank();
  for (let i = 0; i < 30; i++) regenerate(t, { tick: i, delayTicks: 0, perTick: 4 / 30 });
  assert.equal(t.hp, 54);
  assert.ok(Number.isInteger(t.hp));
});
test("regenerate: espera delayTicks desde el último daño", () => {
  const t = tank({ lastDamageTick: 100 });
  regenerate(t, { tick: 159, delayTicks: 60, perTick: 1 });
  assert.equal(t.hp, 50);
  regenerate(t, { tick: 160, delayTicks: 60, perTick: 1 });
  assert.equal(t.hp, 51);
});
test("regenerate: no pasa de la vida máxima ni cura a eliminados", () => {
  const full = tank({ hp: 99 });
  regenerate(full, { tick: 0, delayTicks: 0, perTick: 5 });
  assert.equal(full.hp, 100);
  const dead = tank({ dead: true, hp: 0 });
  regenerate(dead, { tick: 0, delayTicks: 0, perTick: 5 });
  assert.equal(dead.hp, 0);
});
test("partida: regenera solo tras la espera desde el último daño", () => {
  const { game, config } = makeGame(7, {
    "tank.protectionS": 0, "boxes.max": 0, "tank.maxHealth": 100,
    "tank.regen.perS": 30, "tank.regen.delayS": 1,
  });
  game.requestJoin("c1", "Ana");
  game.step();
  const [ana] = [...game._world.tanks.values()];
  ana.hp = 50;
  ana.lastDamageTick = game._world.tick;
  advance(game, config.tick.rate - 1);
  assert.equal(ana.hp, 50, "aún dentro de la espera");
  advance(game, 10);
  assert.ok(ana.hp > 50 && ana.hp <= 100, `regenera tras la espera (hp=${ana.hp})`);
});
test("partida: con perS 0 no hay regeneración", () => {
  const { game } = makeGame(7, { "tank.protectionS": 0, "boxes.max": 0, "tank.maxHealth": 100, "tank.regen.perS": 0 });
  game.requestJoin("c1", "Ana");
  game.step();
  const [ana] = [...game._world.tanks.values()];
  ana.hp = 50;
  advance(game, 300);
  assert.equal(ana.hp, 50);
});
test("welcome: incluye regenPerS", () => {
  const { config } = makeGame(1);
  assert.equal(buildWelcomeConfig(config).regenPerS, config.tank.regen.perS);
});
