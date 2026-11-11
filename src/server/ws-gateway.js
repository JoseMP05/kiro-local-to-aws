// Pasarela WebSocket: conexiones, enrutado jugador/espectador y envío de
// mensajes. Procesa los mensajes entrantes entre Ticks dejando peticiones en
// las colas del Motor_Juego, nunca modifica entidades directamente.

import { decode, encode } from "../shared/protocol.js";
import { validateNick, validateInput } from "../shared/validation.js";
import { createRateLimiter } from "./rate-limiter.js";
import {
  buildPlayerState, buildSpectatorState, buildRanking, rankingTopSignature,
} from "./snapshot.js";

/**
 * @param {object} opts
 * @param {object} opts.game
 * @param {object} opts.config GameConfig
 * @param {() => number} [opts.now] reloj en ms
 * @param {(msg: string) => void} [opts.log]
 */
export function createGateway({ game, config, now = Date.now, log = () => {} }) {
  /** @type {Map<string, object>} id → Connection */
  const connections = new Map();
  let nextConnId = 1;
  let lastRankingSentAt = 0;
  let lastTopSignature = null;

  const welcomeConfig = {
    tickRate: config.tick.rate,
    interpolationDelayMs: config.network.interpolationDelayMs,
    maxHealth: config.tank.maxHealth,
    tankSize: config.tank.size,
    bulletRadius: config.bullet.radius,
    boxSize: config.boxes.size,
    barrelLength: config.tank.barrelLength,
  };

  /** Registra una conexión nueva. */
  function addConnection(ws, role) {
    const id = `conn_${nextConnId++}`;
    const conn = {
      id,
      role, // "player" | "spectator"
      ws,
      tankId: null,
      joinPending: false,
      limiter: createRateLimiter({
        maxPerSecond: config.network.maxMessagesPerSecond,
        maxConsecutive: config.network.maxExceededWindows,
        now,
        openedAt: now(),
      }),
      lastPongAt: now(),
      rankingPending: false,
    };
    connections.set(id, conn);

    ws.on("pong", () => {
      conn.lastPongAt = now();
    });

    ws.on("message", (data, isBinary) => {
      try {
        handleMessage(conn, data, isBinary);
      } catch (err) {
        log(`[gateway] error procesando mensaje de ${id}: ${err?.message ?? err}`);
      }
    });

    ws.on("close", () => {
      connections.delete(id);
      if (conn.role === "player") {
        game.requestLeave(id);
      }
    });

    ws.on("error", () => {
      // El evento close hará la limpieza.
    });

    if (role === "spectator") {
      sendSpectatorWelcome(conn);
      conn.rankingPending = true;
    }

    return conn;
  }

  function handleMessage(conn, data, isBinary) {
    // 1) Limitador.
    const { deliver, close } = conn.limiter.accept();
    if (close) {
      conn.ws.close(4008, "exceso de mensajes");
      return;
    }
    if (!deliver) return;

    // 2) Tamaño en bytes y binarios.
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
    if (isBinary) {
      log(`[gateway] mensaje binario descartado de ${conn.id}`);
      return;
    }
    if (buf.length > config.network.maxMessageBytes) {
      log(`[gateway] mensaje descartado por tamaño: ${JSON.stringify({ connId: conn.id, bytes: buf.length })}`);
      return;
    }

    // 3) Decode.
    const text = buf.toString("utf8");
    const result = decode(text);
    if (!result.ok) {
      log(`[gateway] decode falló: ${JSON.stringify({ connId: conn.id, reason: result.reason }).slice(0, 80)}`);
      return;
    }

    const { message } = result;

    // 4) Enrutado por rol y tipo.
    if (conn.role === "spectator") {
      // Espectadores: join e input se descartan.
      return;
    }

    if (message.type === "join") {
      if (conn.tankId !== null || conn.joinPending) return; // Ya tiene Tanque o alta pendiente.
      const v = validateNick(message.data.nick, {
        minLen: config.players.nickMin,
        maxLen: config.players.nickMax,
      });
      if (!v.ok) {
        send(conn, { type: "error", data: { code: v.code, message: v.message } });
        return;
      }
      game.requestJoin(conn.id, v.nick);
      conn.joinPending = true;
    } else if (message.type === "input") {
      if (conn.tankId === null) return; // Sin Tanque.
      const v = validateInput(message.data);
      if (v.ok) game.setInput(conn.tankId, v.input);
    }
  }

  /** Procesa el resultado de un Tick y envía los mensajes. */
  function afterStep(tickResult) {
    const view = game.getView();
    const ranking = game.getRanking();
    const kills = tickResult.kills;

    // joined → welcome.
    for (const j of tickResult.joined) {
      const conn = connections.get(j.connId);
      if (!conn) continue;
      conn.tankId = j.tankId;
      conn.joinPending = false;
      sendWelcome(conn, j.tankId, j.nick);
      conn.rankingPending = true;
    }

    // rejected → error GAME_FULL.
    for (const r of tickResult.rejected) {
      const conn = connections.get(r.connId);
      if (!conn) continue;
      conn.joinPending = false;
      send(conn, { type: "error", data: { code: "GAME_FULL", message: "La partida está llena." } });
    }

    // state por conexión.
    for (const conn of connections.values()) {
      if (conn.role === "spectator") {
        send(conn, { type: "state", data: buildSpectatorState(view, config, kills) });
      } else if (conn.tankId !== null) {
        send(conn, { type: "state", data: buildPlayerState(view, conn.tankId, config, kills) });
      }
    }

    // ranking: por tiempo, por cambio en el top 10 o a las conexiones marcadas.
    const t = now();
    const topSig = rankingTopSignature(ranking);
    const byTime = t - lastRankingSentAt >= 1000;
    const byChange = lastTopSignature !== null && topSig !== lastTopSignature;

    if (byTime || byChange) {
      // Enviar a todas las conexiones aptas.
      for (const conn of connections.values()) {
        sendRanking(conn, ranking);
      }
      lastRankingSentAt = t;
      lastTopSignature = topSig;
    } else {
      // Solo a las marcadas (recién entradas o espectadores recién conectados).
      for (const conn of connections.values()) {
        if (conn.rankingPending) sendRanking(conn, ranking);
      }
      if (lastTopSignature === null) lastTopSignature = topSig;
    }

    for (const conn of connections.values()) conn.rankingPending = false;
  }

  function sendWelcome(conn, tankId, nick) {
    const info = game.getStaticInfo();
    send(conn, {
      type: "welcome",
      data: {
        tankId,
        nick,
        arena: info.arena,
        view: { w: config.view.width, h: config.view.height },
        obstacles: info.obstacles,
        config: welcomeConfig,
      },
    });
  }

  function sendSpectatorWelcome(conn) {
    const info = game.getStaticInfo();
    send(conn, {
      type: "spectatorWelcome",
      data: { arena: info.arena, obstacles: info.obstacles, config: welcomeConfig },
    });
  }

  function sendRanking(conn, ranking) {
    const tankId = conn.role === "player" ? conn.tankId : null;
    send(conn, { type: "ranking", data: buildRanking(ranking, tankId, config.bots.inRanking) });
  }

  function send(conn, message) {
    if (conn.ws.readyState !== 1) return; // 1 = OPEN
    try {
      conn.ws.send(encode(message));
    } catch (err) {
      log(`[gateway] error enviando a ${conn.id}: ${err?.message ?? err}`);
    }
  }

  function liveConnections() {
    return connections.values();
  }

  return { addConnection, afterStep, liveConnections, _connections: connections };
}
