import { test } from "node:test";
import assert from "node:assert/strict";
import { makeGame, advance } from "../helpers/game-factory.js";

/** Crea una partida con un Jugador y una Caja de `kind` justo debajo de su Tanque. */
function setup(kind, overrides = {}) {
  const { game, config } = makeGame(7, { "boxes.max": 0, ...overrides });
  game.requestJoin("c1", "Ana");
  game.step();
  const w = game._world;
  const tank = [...w.tanks.values()][0];
  w.boxes.set(900, { id: 900, x: tank.x, y: tank.y, kind });
  return { game, config, w, tank };
}

test("una Caja de puntos suma puntos y no activa efectos", () => {
  const { game, config, tank } = setup("puntos");
  const res = game.step();
  assert.equal(res.boxPicked.length, 1);
  assert.equal(tank.score, config.boxes.points);
  assert.equal(game.getView().tanks[0].effects.length, 0);
});

test("la Caja turbo activa el efecto, no suma puntos y sube la velocidad", () => {
  const { game, config, tank } = setup("turbo");
  game.step();
  game.step(); // la activación se aplica en la fase 5 del Tick siguiente
  assert.equal(tank.score, 0);
  assert.equal(tank.speedMultiplier, config.effects.turbo.factor);
  const eff = game.getView().tanks[0].effects;
  assert.equal(eff.length, 1);
  assert.equal(eff[0].name, "turbo");
});

test("el turbo termina y la velocidad vuelve a 1", () => {
  const { game, config, tank } = setup("turbo");
  const ticks = Math.ceil((config.effects.turbo.durationMs * config.tick.rate) / 1000) + 3;
  advance(game, ticks);
  assert.equal(tank.speedMultiplier, 1);
  assert.equal(game.getView().tanks[0].effects.length, 0);
});

test("la Caja escudo protege de balas y no se pierde al disparar", () => {
  const { game, tank } = setup("escudo", { "tank.protectionS": 0 });
  game.step();
  assert.equal(game.getView().tanks[0].shield, true);
  // Un disparo propio no quita el escudo (a diferencia de la protección de reaparición).
  game.setInput(tank.id, { w: false, a: false, s: false, d: false, fire: true, aim: 0 });
  game.step();
  assert.equal(game.getView().tanks[0].shield, true);
});

test("el escudo caduca tras su duración", () => {
  const { game, config } = setup("escudo");
  game.step();
  advance(game, Math.ceil((config.effects.shield.durationMs * config.tick.rate) / 1000) + 2);
  assert.equal(game.getView().tanks[0].shield, false);
});

test("con powerupChance 1 todas las Cajas nuevas son potenciadores", () => {
  const { game } = makeGame(11, { "boxes.max": 5, "boxes.intervalS": 0.1, "boxes.powerupChance": 1 });
  advance(game, 200);
  const kinds = [...game._world.boxes.values()].map((b) => b.kind);
  assert.ok(kinds.length > 0);
  assert.ok(kinds.every((k) => k === "turbo" || k === "escudo"), kinds.join(","));
});

test("con powerupChance 0 todas las Cajas nuevas son de puntos", () => {
  const { game } = makeGame(11, { "boxes.max": 5, "boxes.intervalS": 0.1, "boxes.powerupChance": 0 });
  advance(game, 200);
  const kinds = [...game._world.boxes.values()].map((b) => b.kind);
  assert.ok(kinds.length > 0);
  assert.ok(kinds.every((k) => k === "puntos"));
});
