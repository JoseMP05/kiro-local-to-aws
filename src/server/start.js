// Arranque del Servidor_Juego: carga la Configuración, crea la partida, abre el
// puerto HTTP/WebSocket y lanza el bucle de Ticks.

import http from "node:http";
import { WebSocketServer } from "ws";
import { loadConfig } from "./config-loader.js";
import { mulberry32 } from "../engine/rng.js";
import { createGame } from "../engine/game.js";
import { createBotController } from "../bots/bot-controller.js";
import { createStaticHandler } from "./http-static.js";
import { createGateway } from "./ws-gateway.js";
import { createHeartbeat } from "./heartbeat.js";
import { createTickLoop } from "./tick-loop.js";

const loaded = loadConfig();
if (!loaded.ok) {
  for (const e of loaded.errors) console.error(e);
  process.exit(1);
}
const config = loaded.config;

const rng = mulberry32(Date.now() >>> 0);
const bots = createBotController({ config, rng });
const game = createGame({ config, rng, bots, log: console.error });
bots.init(game);

// Puerto y host: las variables de entorno PORT y HOST tienen prioridad sobre
// config.json, para poder desplegar en contenedores sin editar archivos.
const port = resolvePort(process.env.PORT, config.server.port);
const host = process.env.HOST || "0.0.0.0";

function resolvePort(raw, fallback) {
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 65535) {
    console.error(`PORT inválido: "${raw}" (se esperaba un entero entre 1 y 65535)`);
    process.exit(1);
  }
  return n;
}

// Métricas de Tick de la última ventana (para /health y las pruebas de carga).
const startedAt = Date.now();
const tickStats = { count: 0, sumMs: 0, maxMs: 0, windowAvgMs: 0, windowMaxMs: 0 };
function recordTick(ms) {
  tickStats.count++;
  tickStats.sumMs += ms;
  if (ms > tickStats.maxMs) tickStats.maxMs = ms;
  if (tickStats.count >= config.tick.rate * 5) {
    tickStats.windowAvgMs = tickStats.sumMs / tickStats.count;
    tickStats.windowMaxMs = tickStats.maxMs;
    tickStats.count = 0; tickStats.sumMs = 0; tickStats.maxMs = 0;
  }
}

function healthBody() {
  let players = 0, spectators = 0;
  for (const c of gateway.liveConnections()) {
    if (c.role === "player") players++;
    else spectators++;
  }
  return JSON.stringify({
    status: "ok",
    uptimeS: Math.round((Date.now() - startedAt) / 1000),
    players,
    spectators,
    tick: {
      rate: config.tick.rate,
      budgetMs: Math.round((1000 / config.tick.rate) * 100) / 100,
      avgMs: Math.round(tickStats.windowAvgMs * 1000) / 1000,
      maxMs: Math.round(tickStats.windowMaxMs * 1000) / 1000,
    },
  });
}

const staticHandler = createStaticHandler(config);
const httpServer = http.createServer((req, res) => {
  // Comprobación de salud para balanceadores y orquestadores.
  if ((req.method === "GET" || req.method === "HEAD") && req.url?.split("?")[0] === "/health") {
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
    res.end(req.method === "HEAD" ? undefined : healthBody());
    return;
  }
  staticHandler(req, res).catch((err) => {
    console.error("[http] error", err);
    if (!res.headersSent) res.writeHead(500);
    res.end();
  });
});

const wss = new WebSocketServer({
  noServer: true,
  maxPayload: config.network.maxFrameBytes,
  perMessageDeflate: false,
});

const gateway = createGateway({ game, config, log: console.error });

httpServer.on("upgrade", (req, socket, head) => {
  const { pathname } = new URL(req.url, "http://localhost");
  let role = null;
  if (pathname === "/ws/jugador") role = "player";
  else if (pathname === "/ws/espectador") role = "spectator";
  if (!role) {
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => {
    gateway.addConnection(ws, role);
  });
});

const heartbeat = createHeartbeat({
  connections: () => gateway.liveConnections(),
  intervalMs: config.network.heartbeatIntervalMs,
  timeoutMs: config.network.heartbeatTimeoutMs,
});

httpServer.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`El puerto ${port} está ocupado por otro proceso`);
    process.exit(1);
  }
  console.error("[http] error del servidor", err);
  process.exit(1);
});

httpServer.listen(port, host, () => {
  console.log(`Juego: http://localhost:${port}/`);
  console.log(`Espectador: http://localhost:${port}${config.server.spectatorPath}`);
  heartbeat.start();
  const loop = createTickLoop({
    game,
    gateway,
    tickRate: config.tick.rate,
    log: console.error,
    onFatal: () => process.exit(1),
    onTickDuration: recordTick,
  });
  loop.start();
  tickLoop = loop;
});

// Apagado ordenado: los orquestadores (ECS, Docker, systemd) envían SIGTERM.
let tickLoop = null;
for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => {
    console.log(`${signal} recibido, cerrando…`);
    tickLoop?.stop();
    for (const c of gateway.liveConnections()) c.ws.close(1001, "servidor reiniciando");
    httpServer.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
  });
}
