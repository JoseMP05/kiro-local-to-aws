import { test } from "node:test";
import assert from "node:assert/strict";
import { makeGame, advance } from "../helpers/game-factory.js";
import { rankHealthBonus, setMaxHealth } from "../../src/engine/health.js";
import { streakMilestone } from "../../src/shared/kill-feed.js";
import { buildPlayerState } from "../../src/server/snapshot.js";

const NEUTRAL = { w: false, a: false, s: false, d: false, fire: false, aim: 0 };
const BONUS = { first: 30, podium: 20, top10: 10 };

/** Partida con dos Jugadores (Ana y Beto) sin protección ni Cajas. */
function twoPlayers(overrides = {}) {
  const { game, config } = makeGame(3, { "tank.protectionS": 0, "boxes.max": 0, ...overrides });
  game.requestJoin("c1", "Ana");
  game.requestJoin("c2", "Beto");
  game.step();
  const [ana, beto] = [...game._world.tanks.values()];
  return { game, config, ana, beto };
}

/** Coloca a `killer` frente a `victim` (con 1 de vida) y dispara hasta eliminarlo. */
function killWith(game, killer, victim) {
  killer.x = 200; killer.y = 300;
  victim.x = 420; victim.y = 300;
  victim.hp = 1;
  victim.invulnerableUntilTick = -1;
  victim.shieldUntilTick = -1;
  game.setInput(killer.id, { ...NEUTRAL, fire: true, aim: 0 });
  for (let i = 0; i < 60; i++) {
    // El bono de vida por Ranking puede subir hp mientras la Bala viaja: se mantiene en 1.
    if (!victim.dead) victim.hp = Math.min(victim.hp, 1);
    const res = game.step();
    if (res.kills.length > 0) {
      game.setInput(killer.id, NEUTRAL);
      game._world.bullets.clear(); // que ninguna Bala rebotada afecte al resto de la prueba
      return res.kills[0];
    }
  }
  throw new Error("no hubo eliminación");
}

test("rankHealthBonus: 1.º, 2.º-3.º, 4.º-10.º y sin puntos", () => {
  assert.equal(rankHealthBonus(1, 10, BONUS), 30);
  assert.equal(rankHealthBonus(2, 10, BONUS), 20);
  assert.equal(rankHealthBonus(3, 10, BONUS), 20);
  assert.equal(rankHealthBonus(4, 10, BONUS), 10);
  assert.equal(rankHealthBonus(10, 10, BONUS), 10);
  assert.equal(rankHealthBonus(11, 10, BONUS), 0);
  assert.equal(rankHealthBonus(1, 0, BONUS), 0, "sin puntos no hay bono");
  assert.equal(rankHealthBonus(null, 50, BONUS), 0, "fuera del Ranking (Bots)");
});

test("setMaxHealth: subir suma la diferencia, bajar recorta y eliminado solo guarda", () => {
  const t = { hp: 4, maxHp: 6, dead: false };
  setMaxHealth(t, 9);
  assert.deepEqual([t.hp, t.maxHp], [7, 9]);
  setMaxHealth(t, 6);
  assert.deepEqual([t.hp, t.maxHp], [6, 6]);
  const d = { hp: 0, maxHp: 6, dead: true };
  setMaxHealth(d, 9);
  assert.deepEqual([d.hp, d.maxHp], [0, 9]);
});

test("el Líder con puntos gana vida extra y la pierde al bajar de puesto", () => {
  const { game, config, ana, beto } = twoPlayers();
  const base = config.tank.maxHealth;
  assert.equal(ana.maxHp, base, "con 0 puntos nadie tiene bono");
  assert.equal(beto.maxHp, base);

  ana.score = 50;
  game.step();
  assert.equal(ana.maxHp, base + config.tank.rankHealth.first);
  assert.equal(ana.hp, base + config.tank.rankHealth.first, "al subir gana la vida extra");
  assert.equal(beto.maxHp, base, "Beto sigue con 0 puntos");

  beto.score = 100;
  game.step();
  assert.equal(beto.maxHp, base + config.tank.rankHealth.first);
  assert.equal(ana.maxHp, base + config.tank.rankHealth.podium);
  assert.equal(ana.hp, base + config.tank.rankHealth.podium, "al bajar se recorta");
  assert.equal(game.getView().tanks.find((t) => t.id === ana.id).maxHp, ana.maxHp);
});

test("al reaparecer, la vida es la máxima según el Ranking", () => {
  const { game, config, ana, beto } = twoPlayers();
  beto.score = 200; // tras perder el 50 % sigue siendo Líder con 100
  killWith(game, ana, beto);
  assert.equal(beto.dead, true);
  advance(game, Math.round(config.tank.respawnS * config.tick.rate) + 1);
  assert.equal(beto.dead, false);
  assert.equal(beto.maxHp, config.tank.maxHealth + config.tank.rankHealth.first);
  assert.equal(beto.hp, beto.maxHp);
});

test("el botiquín cura healAmount sin pasar de la vida máxima", () => {
  const { game, config, ana } = twoPlayers({ "tank.maxHealth": 100 });
  assert.equal(config.boxes.healAmount, 35, "por defecto cura 35 de vida");
  const w = game._world;
  ana.hp = 1;
  w.boxes.set(900, { id: 900, x: ana.x, y: ana.y, kind: "botiquin" });
  const res = game.step();
  assert.deepEqual(res.boxPicked.map((e) => e.kind), ["botiquin"]);
  assert.equal(ana.hp, 1 + config.boxes.healAmount);
  assert.equal(ana.score, 0, "el botiquín no da puntos");

  ana.hp = ana.maxHp - 5;
  w.boxes.set(901, { id: 901, x: ana.x, y: ana.y, kind: "botiquin" });
  game.step();
  assert.equal(ana.hp, ana.maxHp, "no supera la vida máxima");
});

test("la racha cuenta eliminaciones seguidas y se reinicia al morir", () => {
  const { game, config, ana, beto } = twoPlayers();
  const respawn = Math.round(config.tank.respawnS * config.tick.rate) + 1;

  const k1 = killWith(game, ana, beto);
  assert.deepEqual(k1, { victimNick: "Beto", killerNick: "Ana", streak: 1 });
  advance(game, respawn);
  const k2 = killWith(game, ana, beto);
  assert.equal(k2.streak, 2);
  assert.equal(ana.streak, 2);
  advance(game, respawn);

  const k3 = killWith(game, beto, ana);
  assert.equal(k3.streak, 1, "la racha de Beto empezó de nuevo al reaparecer");
  assert.equal(ana.streak, 0, "Ana pierde su racha al morir");
});

test("streakMilestone anuncia 3, 5 y múltiplos de 5", () => {
  assert.equal(streakMilestone(2), null);
  assert.equal(streakMilestone(3), "RACHA ×3");
  assert.equal(streakMilestone(4), null);
  assert.equal(streakMilestone(5), "IMPARABLE ×5");
  assert.equal(streakMilestone(7), null);
  assert.equal(streakMilestone(10), "LEYENDA ×10");
  assert.equal(streakMilestone(15), "LEYENDA ×15");
  assert.equal(streakMilestone(undefined), null);
});

test("el estado del Jugador incluye maxHp de cada Tanque y la racha de cada eliminación", () => {
  const { game, config, ana } = twoPlayers();
  ana.score = 50;
  game.step();
  const st = buildPlayerState(game.getView(), ana.id, config, [
    { victimNick: "Beto", killerNick: "Ana", streak: 3 },
  ]);
  const own = st.tanks.find((t) => t.id === ana.id);
  assert.equal(own.maxHp, config.tank.maxHealth + config.tank.rankHealth.first);
  assert.deepEqual(st.kills, [{ victim: "Beto", killer: "Ana", streak: 3 }]);
});
