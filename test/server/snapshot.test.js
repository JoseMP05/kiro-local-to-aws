import { test } from "node:test";
import assert from "node:assert/strict";
import { makeGame } from "../helpers/game-factory.js";
import { buildPlayerState, buildSpectatorState, buildWelcomeConfig } from "../../src/server/snapshot.js";

const OPTS = {
  "arena.width": 4000, "arena.height": 3000,
  "players.interestWidth": 400, "players.interestHeight": 400, "view.width": 400, "view.height": 400,
  "boxes.max": 0, "tank.protectionS": 0,
};

/** Un Jugador en (1000, 1000) con una Caja de `kind` debajo; avanza el Tick de la recogida. */
function pickup(kind) {
  const { game, config } = makeGame(7, OPTS);
  game.requestJoin("c1", "Ana");
  game.step();
  const tank = [...game._world.tanks.values()][0];
  tank.x = 1000;
  tank.y = 1000;
  game._world.boxes.set(900, { id: 900, x: 1000, y: 1000, kind });
  const res = game.step();
  return { game, config, tank, res };
}

test("collected solo incluye recogidas dentro del Área_Interés del Jugador", () => {
  const { game, config, tank } = pickup("puntos");
  const view = game.getView();
  const picked = [
    { kind: "puntos", x: 1100, y: 1000, tankId: 99, amount: 5 }, // dentro
    { kind: "turbo", x: 3000, y: 1000, tankId: 99, amount: 5000 }, // fuera
  ];
  const st = buildPlayerState(view, tank.id, config, [], picked);
  assert.deepEqual(st.collected, [{ kind: "puntos", x: 1100, y: 1000 }]);
  // El espectador ve todas.
  assert.equal(buildSpectatorState(view, config, [], picked).collected.length, 2);
});

test("pickups lleva la cantidad de cada tipo y solo al dueño", () => {
  for (const kind of ["botiquin", "turbo", "escudo"]) {
    const { game, config, tank, res } = pickup(kind);
    const expected = {
      botiquin: config.boxes.healAmount,
      turbo: config.effects.turbo.durationMs,
      escudo: config.effects.shield.durationMs,
    }[kind];
    const view = game.getView();
    assert.deepEqual(buildPlayerState(view, tank.id, config, [], res.boxPicked).pickups, [{ kind, amount: expected }], kind);
    assert.deepEqual(buildPlayerState(view, tank.id + 1, config, [], res.boxPicked).pickups, [], `${kind}: otro Jugador no lo recibe`);
  }
});

test("shieldMs vale la duración exacta del escudo al recogerlo y 0 al caducar", () => {
  const { game, config, tank } = pickup("escudo");
  let st = buildPlayerState(game.getView(), tank.id, config).tanks.find((t) => t.id === tank.id);
  assert.equal(st.shield, true);
  assert.equal(st.shieldMs, config.effects.shield.durationMs);

  const ticks = Math.round((config.effects.shield.durationMs * config.tick.rate) / 1000);
  for (let i = 0; i < ticks + 1; i++) game.step();
  st = buildPlayerState(game.getView(), tank.id, config).tanks.find((t) => t.id === tank.id);
  assert.equal(st.shield, false);
  assert.equal(st.shieldMs, 0);
});

test("welcome: incluye los campos que usa el HUD con sus claves exactas", () => {
  const { config } = makeGame(1);
  const w = buildWelcomeConfig(config);
  assert.equal(w.botsInRanking, config.bots.inRanking);
  assert.equal(w.boxPoints, config.boxes.points);
  assert.equal(w.healAmount, config.boxes.healAmount);
  assert.deepEqual(w.effectDurations, {
    turbo: config.effects.turbo.durationMs,
    ralentizar: config.effects.slow.durationMs,
    escudo: config.effects.shield.durationMs,
  });
  assert.deepEqual(Object.keys(w.effectDurations).sort(), ["escudo", "ralentizar", "turbo"]);
  for (const key of ["tickRate", "interpolationDelayMs", "maxHealth", "reloadMs", "tankSize", "bulletRadius", "boxSize", "barrelLength"]) {
    assert.ok(Number.isFinite(w[key]), key);
  }
});
test("estado del Jugador: solo sus propias Balas llevan own", () => {
  const { game, config } = makeGame(1, { "tank.protectionS": 0, "boxes.max": 0 });
  game.requestJoin("c1", "Ana");
  game.requestJoin("c2", "Beto");
  game.step();
  const [ana, beto] = [...game._world.tanks.values()];
  ana.x = 200; ana.y = 200; beto.x = 200; beto.y = 400;
  game.setInput(ana.id, { w: false, a: false, s: false, d: false, fire: true, aim: 0 });
  game.setInput(beto.id, { w: false, a: false, s: false, d: false, fire: true, aim: Math.PI });
  game.step();
  const view = game.getView();
  assert.equal(view.bullets.length, 2);
  const forAna = buildPlayerState(view, ana.id, config).bullets;
  assert.equal(forAna.filter((b) => b.own).length, 1);
  const anaBullet = view.bullets.find((b) => b.ownerId === ana.id);
  assert.equal(forAna.find((b) => b.own).id, anaBullet.id);
  for (const b of forAna) assert.ok(!("ownerId" in b), "no se envía el id del dueño");
});
