// Motor_Juego: API pública y orden de fases de step(). No abre puertos ni lee
// archivos ni el reloj. Determinista a partir de (config, rng, operaciones).

import { createTank, respawnTank, newTargetId, NEUTRAL_INPUT } from "./tanks.js";
import { moveTank } from "./movement.js";
import { tryFire, advanceBullet } from "./bullets.js";
import { resolveHits } from "./hits.js";
import { applyScoring } from "./scoring.js";
import { trySpawnBox, collectBoxes } from "./boxes.js";
import { findSafePoint } from "./spawn.js";
import { resolveNick } from "./nicknames.js";
import { computeRanking } from "./ranking.js";
import { createEffectSystem } from "../effects/effect-system.js";
import { createSlowEffect } from "../effects/builtin/slow.js";
import { createTurboEffect } from "../effects/builtin/turbo.js";
import { createNitroEffect } from "../effects/builtin/nitro.js";

/**
 * Crea una partida.
 * @param {object} opts
 * @param {object} opts.config GameConfig validado
 * @param {() => number} opts.rng fuente aleatoria en [0, 1)
 * @param {object} [opts.bots] Controlador_Bots (opcional)
 * @param {(msg: string) => void} [opts.log]
 * @returns {object} Game
 */
export function createGame({ config, rng, bots, log }) {
  const world = {
    tick: 0,
    tanks: new Map(),
    bullets: new Map(),
    boxes: new Map(),
    obstacles: config.arena.obstacles.map((o) => ({ ...o })),
    pendingJoins: [], // FIFO { connId, nick }
    pendingLeaves: new Set(), // connIds
    issuedTargetIds: new Set(),
    nextTankId: 1,
    nextBulletId: 1,
    nextBoxId: 1,
    nextJoinSeq: 1,
    lastBoxSpawnTick: -Infinity,
    belowMaxSinceTick: 0,
    ranking: { tables: [{ name: "tanques", entries: [] }] },
  };

  const effects = createEffectSystem({
    world,
    config,
    getTick: () => world.tick,
    log,
  });

  // Definición del Efecto_Ralentizar propia de esta partida.
  const slowDef = createSlowEffect({ factor: config.effects.slow.factor });

  const turboDef = createTurboEffect({ factor: config.effects.turbo.factor });
  const nitroDef = createNitroEffect();
  const shieldTicks = Math.max(1, Math.round((config.effects.shield.durationMs * config.tick.rate) / 1000));

  // Dimensiones y parámetros usados en varias fases.
  const arenaW = config.arena.width;
  const arenaH = config.arena.height;
  const tankSize = config.tank.size;
  const protectionTicks = Math.round(config.tank.protectionS * config.tick.rate);
  const respawnTicks = Math.round(config.tank.respawnS * config.tick.rate);

  // --- API pública ---

  function requestJoin(connId, nick) {
    // Rechaza si connId ya tiene Tanque o alta pendiente.
    for (const t of world.tanks.values()) {
      if (t.connId === connId) return false;
    }
    for (const p of world.pendingJoins) {
      if (p.connId === connId) return false;
    }
    world.pendingJoins.push({ connId, nick });
    return true;
  }

  function requestLeave(connId) {
    world.pendingLeaves.add(connId);
  }

  function setInput(tankId, input) {
    const tank = world.tanks.get(tankId);
    if (!tank || tank.dead) return; // Descartar si eliminado (Req. 7.7).
    tank.lastInput = input; // Reemplaza sin acumular (Req. 5.3).
  }

  function addBot(nick) {
    const tank = spawnTank({ connId: null, isBot: true, nick, resolve: false });
    return tank.id;
  }

  function activateEffect(def, targetTankId, durationMs) {
    return effects.request(def, targetTankId, durationMs, world.tick);
  }

  // Crea un Tanque en un Punto_Seguro. Si resolve=true, resuelve el Apodo.
  function spawnTank({ connId, isBot, nick, resolve }) {
    const existing = [...world.tanks.values()].map((t) => t.nick);
    const finalNick = resolve ? resolveNick(nick, existing, config.players.nickMax) : nick;

    const activeTanks = [];
    for (const t of world.tanks.values()) {
      if (!t.dead) activeTanks.push({ x: t.x, y: t.y });
    }
    const point = findSafePoint(
      { arenaW, arenaH, obstacles: world.obstacles, activeTanks, tankSize, safeDistance: config.tank.safeDistance },
      rng,
      config.tank.safeMaxAttempts
    );
    const targetId = newTargetId(world, rng);

    const tank = createTank({
      id: world.nextTankId++,
      joinSeq: world.nextJoinSeq++,
      connId,
      isBot,
      nick: finalNick,
      targetId,
      x: point.x,
      y: point.y,
      maxHealth: config.tank.maxHealth,
    });
    world.tanks.set(tank.id, tank);
    return tank;
  }

  // Cuenta de Tanques de Jugador (activos + eliminados), excluye Bots.
  function playerCount() {
    let n = 0;
    for (const t of world.tanks.values()) if (!t.isBot) n++;
    return n;
  }

  function countOwnBullets(ownerId) {
    let n = 0;
    for (const b of world.bullets.values()) if (b.ownerId === ownerId) n++;
    return n;
  }

  // --- step(): orden de fases ---

  function step() {
    const result = { tick: world.tick, joined: [], rejected: [], kills: [], boxPicked: [] };

    // Fase 0: instantánea de Líder.
    const leaderRanking = computeRanking(rankingTanks(), { botsInRanking: config.bots.inRanking });
    const leaderEntries = leaderRanking.tables[0].entries;
    const leaderId = leaderEntries.length > 0 ? leaderEntries[0].id : null;

    // Fase 1: bajas (desconexiones).
    if (world.pendingLeaves.size > 0) {
      for (const t of [...world.tanks.values()]) {
        if (t.connId !== null && world.pendingLeaves.has(t.connId)) {
          effects.endForTarget(t.id);
          // Eliminar sus Balas.
          for (const [bid, b] of [...world.bullets.entries()]) {
            if (b.ownerId === t.id) world.bullets.delete(bid);
          }
          world.tanks.delete(t.id);
        }
      }
      world.pendingLeaves.clear();
    }

    // Fase 2: altas en orden de llegada.
    const joins = world.pendingJoins.splice(0, world.pendingJoins.length);
    for (const p of joins) {
      if (playerCount() >= config.players.max) {
        result.rejected.push({ connId: p.connId, reason: "GAME_FULL" });
        continue;
      }
      const tank = spawnTank({ connId: p.connId, isBot: false, nick: p.nick, resolve: true });
      result.joined.push({ connId: p.connId, tankId: tank.id, nick: tank.nick });
    }

    // Fase 3: reapariciones.
    for (const t of world.tanks.values()) {
      if (t.dead && t.deadTick !== null && world.tick - t.deadTick >= respawnTicks) {
        const activeTanks = [];
        for (const o of world.tanks.values()) {
          if (!o.dead && o.id !== t.id) activeTanks.push({ x: o.x, y: o.y });
        }
        const point = findSafePoint(
          { arenaW, arenaH, obstacles: world.obstacles, activeTanks, tankSize, safeDistance: config.tank.safeDistance },
          rng,
          config.tank.safeMaxAttempts
        );
        respawnTank(t, {
          x: point.x,
          y: point.y,
          tick: world.tick,
          maxHealth: config.tank.maxHealth,
          protectionTicks,
        });
      }
    }

    // Fase 4: fin de invulnerabilidad por tiempo.
    for (const t of world.tanks.values()) {
      if (t.invulnerableUntilTick >= 0 && world.tick > t.invulnerableUntilTick) {
        t.invulnerableUntilTick = -1;
      }
    }

    // Fase 5: activaciones de Efectos.
    effects.applyPending();

    // Fase 6: Inputs de Bots.
    if (bots) {
      const botInputs = bots.inputsFor(getView());
      for (const [tankId, input] of botInputs) {
        const t = world.tanks.get(tankId);
        if (t && !t.dead) t.lastInput = input;
      }
    }

    // Fase 7 + 8: Input efectivo y movimiento.
    for (const t of world.tanks.values()) {
      if (t.dead) continue;
      const base = t.lastInput ?? NEUTRAL_INPUT;
      const effInput = effects.modifyInput(t.id, base);
      moveTank(t, effInput, {
        arenaW, arenaH, obstacles: world.obstacles, tankSize,
        tankSpeed: config.tank.speed, tickRate: config.tick.rate,
      });
      t.effectiveInput = effInput; // guardar para la fase de disparo
    }

    // Fase 9: disparos.
    for (const t of world.tanks.values()) {
      if (t.dead) continue;
      const input = t.effectiveInput ?? NEUTRAL_INPUT;
      if (!input.fire) continue;
      const bullet = tryFire(
        t,
        {
          tick: world.tick, tickRate: config.tick.rate, reloadMs: config.bullet.reloadMs,
          maxActive: config.bullet.maxActive, barrelLength: config.tank.barrelLength,
          bulletSpeed: config.bullet.speed, bulletRadius: config.bullet.radius,
          arenaW, arenaH, obstacles: world.obstacles,
        },
        countOwnBullets(t.id),
        () => world.nextBulletId++
      );
      if (bullet) world.bullets.set(bullet.id, bullet);
    }

    // Fase 10: recogida de Cajas (+ modo de depuración).
    const picked = collectBoxes(world, {
      tankSize, boxSize: config.boxes.size, boxPoints: config.boxes.points,
    });
    for (const ev of picked) {
      result.boxPicked.push(ev);
      applyPowerup(ev);
      if (config.debug) {
        // Elegir un Tanque activo distinto, ordenados por joinSeq.
        const candidates = [];
        for (const t of world.tanks.values()) {
          if (!t.dead && t.id !== ev.tankId) candidates.push(t);
        }
        candidates.sort((a, b) => a.joinSeq - b.joinSeq);
        if (candidates.length > 0) {
          const chosen = candidates[Math.floor(rng() * candidates.length)];
          activateEffect(slowDef, chosen.id, config.effects.slow.durationMs);
        }
      }
    }

    // Fase 11: avance de Balas.
    const bulletsToRemoveByBounce = new Set();
    for (const b of world.bullets.values()) {
      if (b.bornTick === world.tick) {
        // Las Balas creadas en este Tick no avanzan; recorrido de longitud cero.
        b.path = [{ from: { x: b.x, y: b.y }, to: { x: b.x, y: b.y }, bounces: b.bounces }];
        continue;
      }
      const { remove } = advanceBullet(b, {
        tick: world.tick, tickRate: config.tick.rate, bulletSpeed: config.bullet.speed,
        bulletLifetimeS: config.bullet.lifetimeS, maxBounces: config.bullet.maxBounces,
        bulletRadius: config.bullet.radius, arenaW, arenaH, obstacles: world.obstacles,
      });
      if (remove) bulletsToRemoveByBounce.add(b.id);
    }

    // Fase 12: impactos.
    const { removeBullets, newlyDead } = resolveHits({
      bullets: world.bullets.values(),
      tanks: world.tanks,
      tankSize,
      bulletRadius: config.bullet.radius,
      damage: config.bullet.damage,
      selfDamage: config.bullet.selfDamage,
      tick: world.tick,
      bulletsToRemoveByBounce,
    });
    for (const bid of removeBullets) world.bullets.delete(bid);
    // Eliminar también las Balas que agotaron rebotes y no impactaron.
    for (const bid of bulletsToRemoveByBounce) world.bullets.delete(bid);

    // Fase 13: eliminaciones y puntos.
    if (newlyDead.length > 0) {
      const kills = applyScoring({
        newlyDead,
        tanks: world.tanks,
        tick: world.tick,
        killPoints: config.score.kill,
        leaderBonus: config.score.leaderBonus,
        deathLossPercent: config.score.deathLossPercent,
        leaderId,
      });
      for (const k of kills) result.kills.push(k);
      for (const dead of newlyDead) effects.endForTarget(dead.id);
    }

    // Fase 14: Efectos por Tick.
    effects.tickAll();

    // Fase 15: aparición de Cajas.
    const beforeCount = world.boxes.size;
    const box = trySpawnBox(
      world,
      {
        tick: world.tick, tickRate: config.tick.rate, boxMax: config.boxes.max,
        boxIntervalS: config.boxes.intervalS, boxSize: config.boxes.size,
        boxMaxAttempts: config.boxes.maxAttempts, arenaW, arenaH,
        obstacles: world.obstacles, tankSize, powerupChance: config.boxes.powerupChance,
      },
      rng,
      () => world.nextBoxId++
    );
    if (box) world.boxes.set(box.id, box);
    // Actualizar belowMaxSinceTick cuando el número de Cajas baja desde el máximo.
    updateBelowMax(beforeCount);

    // Fase 16: cierre.
    world.ranking = computeRanking(rankingTanks(), { botsInRanking: config.bots.inRanking });
    result.tick = world.tick;
    world.tick += 1;

    // Limpiar los recorridos de Balas (solo válidos durante el Tick).
    for (const b of world.bullets.values()) b.path = null;

    return result;
  }

  // Aplica el potenciador de una Caja recogida (las Cajas de puntos no hacen nada aquí).
  function applyPowerup(ev) {
    if (ev.kind === "turbo") {
      activateEffect(turboDef, ev.tankId, config.effects.turbo.durationMs);
    } else if (ev.kind === "escudo") {
      const tank = world.tanks.get(ev.tankId);
      if (tank && !tank.dead) tank.shieldUntilTick = world.tick + shieldTicks;
    }
  }

  let wasAtMax = false;
  function updateBelowMax(/* beforeCount */) {
    const atMax = world.boxes.size >= config.boxes.max;
    if (wasAtMax && !atMax) {
      world.belowMaxSinceTick = world.tick;
    }
    wasAtMax = atMax;
  }

  function rankingTanks() {
    const out = [];
    for (const t of world.tanks.values()) {
      out.push({ id: t.id, nick: t.nick, score: t.score, isBot: t.isBot, joinSeq: t.joinSeq });
    }
    return out;
  }

  // --- vistas de solo lectura ---

  function getView() {
    const tanks = [];
    for (const t of world.tanks.values()) {
      tanks.push({
        id: t.id, joinSeq: t.joinSeq, isBot: t.isBot, targetId: t.targetId,
        nick: t.nick, x: t.x, y: t.y, angle: t.angle, hp: t.hp, score: t.score,
        dead: t.dead, deadTick: t.deadTick, deathPos: t.deathPos ? { ...t.deathPos } : null,
        invulnerableUntilTick: t.invulnerableUntilTick,
        inv: t.invulnerableUntilTick >= 0 && world.tick <= t.invulnerableUntilTick,
        shield: t.shieldUntilTick >= 0 && world.tick <= t.shieldUntilTick,
        respawnTick: t.dead && t.deadTick !== null ? t.deadTick + respawnTicks : null,
        effects: effects.activeFor(t.id),
      });
    }
    const bullets = [];
    for (const b of world.bullets.values()) {
      bullets.push({ id: b.id, x: b.x, y: b.y });
    }
    const boxes = [];
    for (const b of world.boxes.values()) {
      boxes.push({ id: b.id, x: b.x, y: b.y, kind: b.kind });
    }
    return { tick: world.tick, arena: { width: arenaW, height: arenaH }, obstacles: world.obstacles, tanks, bullets, boxes };
  }

  function getRanking() {
    return world.ranking;
  }

  function getStaticInfo() {
    return {
      arena: { width: arenaW, height: arenaH },
      obstacles: world.obstacles.map((o) => ({ ...o })),
    };
  }

  return {
    requestJoin, requestLeave, setInput, addBot, activateEffect,
    step, getView, getRanking, getStaticInfo,
    // Exponer world para pruebas internas del engine (solo lectura recomendada).
    _world: world,
  };
}
