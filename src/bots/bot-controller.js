// Controlador_Bots: genera el Input de cada Bot en cada Tick. Solo importa
// funciones puras de engine/geometry.js y shared/. No toca la red.

import { segmentIntersectsAabb, squareAabb, rayAabb } from "../engine/geometry.js";
import { normalizeAngle } from "../shared/math.js";

// Las 8 direcciones WASD y su vector unitario.
const DIRS = [
  { w: true, a: false, s: false, d: false, vx: 0, vy: -1 }, // N
  { w: true, a: false, s: false, d: true, vx: Math.SQRT1_2, vy: -Math.SQRT1_2 }, // NE
  { w: false, a: false, s: false, d: true, vx: 1, vy: 0 }, // E
  { w: false, a: false, s: true, d: true, vx: Math.SQRT1_2, vy: Math.SQRT1_2 }, // SE
  { w: false, a: false, s: true, d: false, vx: 0, vy: 1 }, // S
  { w: false, a: true, s: true, d: false, vx: -Math.SQRT1_2, vy: Math.SQRT1_2 }, // SW
  { w: false, a: true, s: false, d: false, vx: -1, vy: 0 }, // W
  { w: true, a: true, s: false, d: false, vx: -Math.SQRT1_2, vy: -Math.SQRT1_2 }, // NW
];

/**
 * @param {object} opts
 * @param {object} opts.config GameConfig
 * @param {() => number} opts.rng
 */
export function createBotController({ config, rng }) {
  // Estado por Bot: { moveDir, target, targetSinceTick }.
  const state = new Map(); // tankId → estado
  const idByNick = new Map();

  const tankSize = config.tank.size;
  const half = tankSize / 2;

  function init(game) {
    for (let i = 1; i <= config.bots.count; i++) {
      const nick = `Bot ${i}`;
      const id = game.addBot(nick);
      idByNick.set(nick, id);
    }
  }

  function pickTarget(view) {
    const W = view.arena.width, H = view.arena.height;
    const x = half + rng() * (W - 2 * half);
    const y = half + rng() * (H - 2 * half);
    return { x, y };
  }

  function inputsFor(view) {
    const result = new Map();
    const obstacles = view.obstacles;
    const activeTanks = view.tanks.filter((t) => !t.dead);

    for (const bot of view.tanks) {
      if (bot.dead || !bot.isBot) continue;

      let st = state.get(bot.id);
      if (!st) {
        st = { moveDir: 0, target: pickTarget(view), targetSinceTick: view.tick };
        state.set(bot.id, st);
      }

      // 1) Objetivo visible más cercano con línea de visión.
      let aim = 0;
      let fire = false;
      let bestTarget = null;
      let bestDist = Infinity;
      for (const other of activeTanks) {
        if (other.id === bot.id) continue;
        const dx = other.x - bot.x, dy = other.y - bot.y;
        const dist = Math.hypot(dx, dy);
        if (dist > config.bots.visionRange) continue;
        // Línea de visión libre.
        let blocked = false;
        for (const o of obstacles) {
          if (segmentIntersectsAabb({ x: bot.x, y: bot.y }, { x: other.x, y: other.y }, o)) {
            blocked = true;
            break;
          }
        }
        if (blocked) continue;
        if (dist < bestDist - 1e-9 || (Math.abs(dist - bestDist) <= 1e-9 && (bestTarget === null || other.joinSeq < bestTarget.joinSeq))) {
          bestTarget = other;
          bestDist = dist;
        }
      }
      if (bestTarget) {
        aim = Math.atan2(bestTarget.y - bot.y, bestTarget.x - bot.x);
        fire = true;
      }

      // 2) Destino: renovar por llegada o por tiempo.
      const toTarget = { x: st.target.x - bot.x, y: st.target.y - bot.y };
      const distToTarget = Math.hypot(toTarget.x, toTarget.y);
      const timeout = config.bots.targetTimeoutS * config.tick.rate;
      if (distToTarget <= config.bots.arriveDistance || view.tick - st.targetSinceTick >= timeout) {
        st.target = pickTarget(view);
        st.targetSinceTick = view.tick;
      }

      // 3) Dirección hacia el destino entre las 8.
      const desiredAngle = Math.atan2(st.target.y - bot.y, st.target.x - bot.x);
      let moveDir = nearestDir(desiredAngle);

      // 4) Esquivar: si el rayo en moveDir toca una Pared, probar las 8 en orden.
      if (rayHitsWall(bot, DIRS[moveDir], obstacles, view.arena)) {
        const order = dirsByAngle(desiredAngle);
        let found = -1;
        for (const di of order) {
          if (!rayHitsWall(bot, DIRS[di], obstacles, view.arena)) {
            found = di;
            break;
          }
        }
        moveDir = found >= 0 ? found : (moveDir + 4) % 8; // opuesta si ninguna libre
      }
      st.moveDir = moveDir;

      const d = DIRS[moveDir];
      result.set(bot.id, { w: d.w, a: d.a, s: d.s, d: d.d, fire, aim: normalizeAngle(aim) });
    }

    return result;
  }

  // Dirección de las 8 con menor diferencia angular respecto a `angle`.
  function nearestDir(angle) {
    let best = 0, bestDiff = Infinity;
    for (let i = 0; i < DIRS.length; i++) {
      const a = Math.atan2(DIRS[i].vy, DIRS[i].vx);
      const diff = Math.abs(normalizeAngle(a - angle));
      if (diff < bestDiff) { bestDiff = diff; best = i; }
    }
    return best;
  }

  // Índices de las 8 direcciones ordenados por cercanía angular a `angle`.
  function dirsByAngle(angle) {
    const withDiff = DIRS.map((d, i) => {
      const a = Math.atan2(d.vy, d.vx);
      return { i, diff: Math.abs(normalizeAngle(a - angle)) };
    });
    withDiff.sort((x, y) => x.diff - y.diff);
    return withDiff.map((x) => x.i);
  }

  // ¿Un rayo desde el centro en la dirección d, de longitud half + detectDistance,
  // toca un Obstáculo o el borde de la Arena?
  function rayHitsWall(bot, dir, obstacles, arena) {
    const length = half + config.bots.detectDistance;
    const o = { x: bot.x, y: bot.y };
    const dvec = { x: dir.vx, y: dir.vy };
    // Borde de la Arena.
    const endX = bot.x + dir.vx * length;
    const endY = bot.y + dir.vy * length;
    if (endX < half || endX > arena.width - half || endY < half || endY > arena.height - half) {
      return true;
    }
    for (const obs of obstacles) {
      const grown = { x: obs.x - half, y: obs.y - half, w: obs.w + tankSize, h: obs.h + tankSize };
      const hit = rayAabb(o, dvec, grown, length);
      if (hit) return true;
    }
    return false;
  }

  return { init, inputsFor };
}
