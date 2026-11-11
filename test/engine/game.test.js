import { test } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { PBT } from "../helpers/pbt.js";
import { makeGame, advance } from "../helpers/game-factory.js";
import { aabbOverlap, squareAabb } from "../../src/engine/geometry.js";

test("una alta crea un Tanque con 0 puntos y vida máxima", () => {
  const { game, config } = makeGame(1);
  game.requestJoin("c1", "Ana");
  const res = game.step();
  assert.equal(res.joined.length, 1);
  const v = game.getView();
  assert.equal(v.tanks.length, 1);
  assert.equal(v.tanks[0].score, 0);
  assert.equal(v.tanks[0].hp, config.tank.maxHealth);
});

test("Apodos duplicados se resuelven con sufijo", () => {
  const { game } = makeGame(2);
  game.requestJoin("c1", "Ana");
  game.requestJoin("c2", "ana");
  game.step();
  const nicks = game.getView().tanks.map((t) => t.nick).sort();
  assert.deepEqual(nicks, ["Ana", "ana2"]);
});

test("el límite de Jugadores se respeta", () => {
  const { game } = makeGame(3, { "players.max": 2 });
  game.requestJoin("c1", "A");
  game.requestJoin("c2", "B");
  game.requestJoin("c3", "C");
  const res = game.step();
  assert.equal(res.joined.length, 2);
  assert.equal(res.rejected.length, 1);
  assert.equal(res.rejected[0].reason, "GAME_FULL");
});

test("solo se aplica el último Input entre Ticks", () => {
  const a = makeGame(5);
  const b = makeGame(5);
  a.game.requestJoin("c1", "Ana");
  b.game.requestJoin("c1", "Ana");
  a.game.step();
  b.game.step();
  const id = a.game.getView().tanks[0].id;
  // a recibe varios Inputs; b solo el último.
  a.game.setInput(id, { w: false, a: false, s: false, d: false, fire: false, aim: 0 });
  a.game.setInput(id, { w: true, a: false, s: false, d: false, fire: false, aim: 1 });
  a.game.setInput(id, { w: false, a: false, s: false, d: true, fire: false, aim: 2 });
  b.game.setInput(id, { w: false, a: false, s: false, d: true, fire: false, aim: 2 });
  a.game.step();
  b.game.step();
  const ta = a.game.getView().tanks[0];
  const tb = b.game.getView().tanks[0];
  assert.equal(ta.x, tb.x);
  assert.equal(ta.y, tb.y);
  assert.equal(ta.angle, tb.angle);
});

// Feature: tank-game-core, Property 12: Invariantes del mundo tras cada Tick
test("Property 12: invariantes del mundo tras cada Tick", () => {
  fc.assert(
    fc.property(fc.integer({ min: 1, max: 500 }), (seed) => {
      const { game, config } = makeGame(seed, { "bots.count": 3 });
      game.addBot("Bot 1");
      game.addBot("Bot 2");
      game.requestJoin("c1", "Ana");
      const half = config.tank.size / 2;
      const r = config.bullet.radius;
      for (let i = 0; i < 30; i++) {
        game.step();
        const v = game.getView();
        for (const t of v.tanks) {
          if (t.dead) continue;
          assert.ok(t.x >= half - 1e-6 && t.x <= v.arena.width - half + 1e-6, "Tanque en X");
          assert.ok(t.y >= half - 1e-6 && t.y <= v.arena.height - half + 1e-6, "Tanque en Y");
          assert.ok(t.hp >= 0 && t.hp <= config.tank.maxHealth);
          assert.ok(Number.isInteger(t.score) && t.score >= 0);
          for (const o of v.obstacles) {
            assert.ok(!aabbOverlap(squareAabb(t.x, t.y, config.tank.size), o), "sin solape con Obstáculo");
          }
        }
        for (const b of v.bullets) {
          assert.ok(b.x >= r - 1e-3 && b.x <= v.arena.width - r + 1e-3, "Bala en X");
          assert.ok(b.y >= r - 1e-3 && b.y <= v.arena.height - r + 1e-3, "Bala en Y");
        }
        // Balas por Tanque <= maxActive.
        const counts = new Map();
        for (const b of game._world.bullets.values()) {
          counts.set(b.ownerId, (counts.get(b.ownerId) ?? 0) + 1);
        }
        for (const c of counts.values()) assert.ok(c <= config.bullet.maxActive);
      }
    }),
    { seed: PBT.seed, numRuns: 40 }
  );
});
