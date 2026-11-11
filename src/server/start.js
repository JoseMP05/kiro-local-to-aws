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

const staticHandler = createStaticHandler(config);
const httpServer = http.createServer((req, res) => {
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
    console.error(`El puerto ${config.server.port} está ocupado por otro proceso`);
    process.exit(1);
  }
  console.error("[http] error del servidor", err);
  process.exit(1);
});

httpServer.listen(config.server.port, () => {
  const port = config.server.port;
  console.log(`Juego: http://localhost:${port}/`);
  console.log(`Espectador: http://localhost:${port}${config.server.spectatorPath}`);
  heartbeat.start();
  const loop = createTickLoop({
    game,
    gateway,
    tickRate: config.tick.rate,
    log: console.error,
    onFatal: () => process.exit(1),
  });
  loop.start();
});
