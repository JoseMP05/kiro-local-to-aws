import { test } from "node:test";
import assert from "node:assert/strict";
import { makeGame, advance } from "../helpers/game-factory.js";
import { findSafePoint } from "../../src/engine/spawn.js";
import { tryFire } from "../../src/engine/bullets.js";
import { mulberry32 } from "../../src/engine/rng.js";

const NEUTRAL = { w: false, a: false, s: false, d: false, fire: false, aim: 0 };
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

/** Un Jugador (Ana) y un tirador (Beto) alineados; Ana en protección tras reaparecer. */
function shootProtected({ anaFires }) {
  const { game, config } = makeGame(3, { "boxes.max": 0, "tank.protectionS": 3 });
  game.requestJoin("c1", "Ana");
  game.requestJoin("c2", "Beto");
  game.step();
  const [ana, beto] = [...game._world.tanks.values()];
  // Matar a Ana y esperar su reaparición.
  ana.hp = 0; ana.dead = true; ana.deadTick = game._world.tick;
  advance(game, Math.round(config.tank.respawnS * config.tick.rate) + 1);
  assert.equal(ana.dead, false);
  assert.ok(ana.invulnerableUntilTick >= 0, "Ana reaparece con protección");
  return { game, config, ana, beto, anaFires };
}

test("la protección de reaparición evita todo el daño mientras dura", () => {
  const { game, config, ana, beto } = shootProtected({});
  ana.x = 400; ana.y = 300; beto.x = 200; beto.y = 300;
  game.setInput(beto.id, { ...NEUTRAL, fire: true, aim: 0 });
  const protectedTicks = Math.round(config.tank.protectionS * config.tick.rate) - 5;
  for (let i = 0; i < protectedTicks; i++) {
    game.step();
    assert.equal(ana.hp, ana.maxHp, `sin daño en el tick ${i}`);
  }
  // Pasada la protección, las Balas sí hacen daño.
  game.setInput(beto.id, { ...NEUTRAL, fire: true, aim: 0 });
  let damaged = false;
  for (let i = 0; i < 90 && !damaged; i++) {
    game.step();
    damaged = ana.hp < ana.maxHp;
  }
  assert.ok(damaged, "tras la protección recibe daño");
});

test("con protección no se dispara: mantener el disparo no crea Balas ni la acorta", () => {
  const { game, config, ana } = shootProtected({});
  ana.x = 400; ana.y = 300;
  const until = ana.invulnerableUntilTick;
  game.setInput(ana.id, { ...NEUTRAL, fire: true, aim: 0 });
  while (game._world.tick <= until) {
    game.step();
    assert.equal(game._world.bullets.size, 0, `sin Balas en el tick ${game._world.tick - 1}`);
    if (game._world.tick <= until) assert.equal(ana.invulnerableUntilTick, until, "la protección no se acorta");
  }
  assert.equal(ana.lastShotTick, null);
  // Primer tick tras caducar: aparece la primera Bala.
  game.step();
  assert.equal([...game._world.bullets.values()].filter((b) => b.ownerId === ana.id).length, 1);
  assert.equal(ana.invulnerableUntilTick, -1);
  assert.ok(config.tank.protectionS > 0);
});

test("un Tanque recién unido también está protegido", () => {
  const { game, config } = makeGame(4, { "boxes.max": 0, "tank.protectionS": 3 });
  game.requestJoin("c1", "Ana");
  game.step();
  const ana = [...game._world.tanks.values()][0];
  assert.equal(game.getView().tanks[0].inv, true);
  assert.ok(ana.invulnerableUntilTick >= Math.round(config.tank.protectionS * config.tick.rate) - 1);
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

/** Tanque y entorno mínimos para llamar a tryFire directamente. */
function fireSetup(invulnerableUntilTick) {
  const tank = { id: 1, nick: "Ana", life: 0, x: 500, y: 500, angle: 0, invulnerableUntilTick, lastShotTick: null };
  const env = (tick) => ({
    tick, tickRate: 20, reloadMs: 10_000, maxActive: 5, barrelLength: 30,
    bulletSpeed: 600, bulletRadius: 4, arenaW: 4000, arenaH: 2000, obstacles: [],
  });
  return { tank, env, nextId: () => 1 };
}

test("tryFire: en el último tick de protección no dispara y no gasta la recarga", () => {
  const { tank, env, nextId } = fireSetup(50);
  assert.equal(tryFire(tank, env(49), 0, nextId), null);
  assert.equal(tryFire(tank, env(50), 0, nextId), null, "tick == invulnerableUntilTick sigue protegido");
  assert.equal(tank.lastShotTick, null);
  assert.equal(tank.invulnerableUntilTick, 50, "la protección no se acorta");
});

test("tryFire: un tick después de la protección dispara aunque la recarga sea larga", () => {
  const { tank, env, nextId } = fireSetup(50);
  tryFire(tank, env(50), 0, nextId); // bloqueado: no debe consumir recarga
  const bullet = tryFire(tank, env(51), 0, nextId);
  assert.ok(bullet, "tick == until + 1 dispara");
  assert.equal(tank.lastShotTick, 51);
  assert.equal(tank.invulnerableUntilTick, -1);
  assert.equal(tryFire(tank, env(52), 0, nextId), null, "ahora sí rige la recarga");
});
