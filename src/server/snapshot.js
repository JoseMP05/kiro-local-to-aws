// Constructor de estados: Área_Interés, mensajes de estado y de Ranking.
// Usa una lista blanca de campos para que el targetId y cualquier campo interno
// nunca salgan en ningún mensaje.

import { clampWindow } from "../shared/math.js";

/** Redondeo a un número de decimales. */
function round(value, decimals) {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

/**
 * Rectángulo del Área_Interés centrado en (center) con tamaño (aoiW, aoiH),
 * recortado dentro de la Arena por eje con clampWindow.
 */
export function interestRect(center, aoiW, aoiH, arenaW, arenaH) {
  const wx = clampWindow(center.x, aoiW, arenaW);
  const wy = clampWindow(center.y, aoiH, arenaH);
  return { left: wx.lo, right: wx.hi, top: wy.lo, bottom: wy.hi };
}

/** Lista blanca fija: nunca { ...tank }. */
function toTankState(t) {
  return {
    id: t.id,
    nick: t.nick,
    x: round(t.x, 1),
    y: round(t.y, 1),
    angle: round(t.angle, 3),
    hp: t.hp,
    score: t.score,
    dead: t.dead,
    bot: t.isBot,
    inv: !!t.inv,
    shield: !!t.shield,
    effects: t.effects.map((e) => ({ name: e.name, remainingMs: e.remainingMs })),
  };
}

function inRect(x, y, rect) {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

/**
 * Estado para un Jugador: su propio Tanque + entidades dentro del Área_Interés.
 * @param {object} view vista de game.getView()
 * @param {number} tankId Tanque del Jugador
 * @param {object} cfg GameConfig
 * @param {Array} kills eventos kill del Tick (sin filtrar)
 */
export function buildPlayerState(view, tankId, cfg, kills = []) {
  const own = view.tanks.find((t) => t.id === tankId);
  const center = own
    ? own.dead && own.deathPos
      ? own.deathPos
      : { x: own.x, y: own.y }
    : { x: view.arena.width / 2, y: view.arena.height / 2 };

  const rect = interestRect(
    center,
    cfg.players.interestWidth,
    cfg.players.interestHeight,
    view.arena.width,
    view.arena.height
  );

  const tanks = [];
  for (const t of view.tanks) {
    if (t.id === tankId) {
      const st = toTankState(t);
      if (t.dead && t.respawnTick !== null && t.respawnTick !== undefined) {
        st.respawnTick = t.respawnTick;
      }
      tanks.push(st);
      continue;
    }
    if (t.dead) continue; // Tanques eliminados de otros quedan fuera.
    if (inRect(t.x, t.y, rect)) tanks.push(toTankState(t));
  }

  const bullets = [];
  for (const b of view.bullets) {
    if (inRect(b.x, b.y, rect)) bullets.push({ id: b.id, x: round(b.x, 1), y: round(b.y, 1) });
  }
  const boxes = [];
  for (const b of view.boxes) {
    if (inRect(b.x, b.y, rect)) boxes.push({ id: b.id, x: round(b.x, 1), y: round(b.y, 1), kind: b.kind });
  }

  return {
    tick: view.tick,
    tanks,
    bullets,
    boxes,
    kills: kills.map((k) => ({ victim: k.victimNick, killer: k.killerNick })),
  };
}

/** Estado para la Vista_Espectador: todas las entidades. */
export function buildSpectatorState(view, cfg, kills = []) {
  const tanks = view.tanks.map(toTankState);
  const bullets = view.bullets.map((b) => ({ id: b.id, x: round(b.x, 1), y: round(b.y, 1) }));
  const boxes = view.boxes.map((b) => ({ id: b.id, x: round(b.x, 1), y: round(b.y, 1), kind: b.kind }));
  return {
    tick: view.tick,
    tanks,
    bullets,
    boxes,
    kills: kills.map((k) => ({ victim: k.victimNick, killer: k.killerNick })),
  };
}

/**
 * Mensaje de Ranking: top 10 por tabla y `you` del Tanque de la conexión.
 * @param {object} ranking game.getRanking()
 * @param {number|null} tankId
 * @param {boolean} botsInRanking
 */
export function buildRanking(ranking, tankId, botsInRanking) {
  const tables = ranking.tables.map((table) => ({
    name: table.name,
    entries: table.entries.slice(0, 10).map((e) => ({
      position: e.position,
      nick: e.nick,
      score: e.score,
      bot: e.isBot,
    })),
  }));

  let you = null;
  if (tankId !== null && tankId !== undefined) {
    for (const table of ranking.tables) {
      const found = table.entries.find((e) => e.id === tankId);
      if (found) {
        you = { position: found.position, score: found.score };
        break;
      }
    }
  }

  return { tables, you };
}

/** Firma del top 10 de la tabla de tanques, para detectar cambios. */
export function rankingTopSignature(ranking) {
  const table = ranking.tables[0];
  if (!table) return "";
  return table.entries
    .slice(0, 10)
    .map((e) => `${e.nick}:${e.score}`)
    .join("|");
}
