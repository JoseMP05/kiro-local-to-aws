// Prueba de carga: conecta N jugadores simulados (y opcionalmente espectadores)
// que se mueven y disparan al azar, y mide lo que recibe cada cliente.
//
// Uso:
//   node scripts/loadtest.js --url ws://localhost:3000 --players 50 --duration 30
//   node scripts/loadtest.js --url wss://juego.ejemplo.com --players 40 --spectators 5 --ramp 20
//
// Opciones:
//   --url         URL base (ws:// o wss://). Por defecto ws://localhost:3000
//   --players     jugadores simulados. Por defecto 50
//   --spectators  espectadores simulados. Por defecto 1
//   --duration    segundos de carga sostenida tras la rampa. Por defecto 30
//   --ramp        segundos para ir entrando de forma escalonada. Por defecto 5
//
// Criterios de aprobado (se imprimen al final): sin cierres inesperados, sin
// rechazos por partida llena (si players <= players.max), p95 del intervalo
// entre estados por debajo de 2 × el periodo del Tick y tick.maxMs del servidor
// por debajo del presupuesto de Tick.

import { WebSocket } from "ws";

const args = parseArgs(process.argv.slice(2));
const BASE = (args.url ?? "ws://localhost:3000").replace(/\/$/, "");
const PLAYERS = int(args.players, 50);
const SPECTATORS = int(args.spectators, 1);
const DURATION_S = int(args.duration, 30);
const RAMP_S = int(args.ramp, 5);
const HTTP_BASE = BASE.replace(/^ws/, "http");

function parseArgs(list) {
  const out = {};
  for (let i = 0; i < list.length; i++) {
    if (list[i].startsWith("--")) out[list[i].slice(2)] = list[i + 1];
  }
  return out;
}
function int(v, d) {
  const n = Number.parseInt(v ?? "", 10);
  return Number.isFinite(n) && n >= 0 ? n : d;
}

const stats = {
  opened: 0,
  joined: 0,
  rejected: 0,
  errors: 0,
  unexpectedCloses: 0,
  closeCodes: new Map(),
  stateMsgs: 0,
  bytes: 0,
  gaps: [], // intervalos entre estados consecutivos por cliente (ms)
  connectMs: [], // tiempo hasta recibir welcome
};

let finishing = false;
const sockets = [];

function bump(map, key) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function startClient(index, role) {
  const path = role === "player" ? "/ws/jugador" : "/ws/espectador";
  const t0 = performance.now();
  const ws = new WebSocket(BASE + path);
  sockets.push(ws);
  let lastStateAt = 0;
  let welcomed = false;
  let timer = null;
  let dir = { w: false, a: false, s: false, d: false };
  let nextTurnAt = 0;
  let aim = 0;

  ws.on("open", () => {
    stats.opened++;
    if (role === "player") ws.send(JSON.stringify({ type: "join", data: { nick: `LT_${index}` } }));
  });

  ws.on("message", (data) => {
    stats.bytes += data.length;
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return;
    }
    if (msg.type === "welcome" || msg.type === "spectatorWelcome") {
      welcomed = true;
      stats.connectMs.push(performance.now() - t0);
      if (role === "player") {
        stats.joined++;
        timer = setInterval(() => sendInput(), 1000 / 30);
      }
    } else if (msg.type === "state") {
      stats.stateMsgs++;
      const now = performance.now();
      if (lastStateAt) stats.gaps.push(now - lastStateAt);
      lastStateAt = now;
    } else if (msg.type === "error") {
      if (msg.data.code === "GAME_FULL") stats.rejected++;
      else stats.errors++;
    }
  });

  function sendInput() {
    if (ws.readyState !== WebSocket.OPEN) return;
    const now = performance.now();
    if (now >= nextTurnAt) {
      dir = { w: Math.random() < 0.6, a: Math.random() < 0.3, s: Math.random() < 0.1, d: Math.random() < 0.3 };
      aim = Math.random() * Math.PI * 2 - Math.PI;
      nextTurnAt = now + 1000 + Math.random() * 2000;
    }
    ws.send(JSON.stringify({ type: "input", data: { ...dir, fire: Math.random() < 0.3, aim } }));
  }

  ws.on("close", (code) => {
    if (timer) clearInterval(timer);
    if (!finishing) {
      stats.unexpectedCloses++;
      bump(stats.closeCodes, code);
    }
  });
  ws.on("error", () => {
    if (!finishing && !welcomed) stats.errors++;
  });
}

async function health() {
  try {
    const res = await fetch(`${HTTP_BASE}/health`);
    return await res.json();
  } catch (err) {
    return { error: String(err.message ?? err) };
  }
}

function percentile(sorted, p) {
  if (sorted.length === 0) return NaN;
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}
const f1 = (n) => (Number.isFinite(n) ? n.toFixed(1) : "n/d");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

console.log(`Carga contra ${BASE}: ${PLAYERS} jugadores, ${SPECTATORS} espectadores, rampa ${RAMP_S}s, sostenida ${DURATION_S}s`);
const before = await health();
if (before.error) {
  console.error(`No se pudo consultar ${HTTP_BASE}/health: ${before.error}`);
  process.exit(1);
}

const startedAt = performance.now();
const total = PLAYERS + SPECTATORS;
const stepMs = total > 0 ? (RAMP_S * 1000) / total : 0;
for (let i = 0; i < SPECTATORS; i++) {
  startClient(i, "spectator");
  await sleep(stepMs);
}
for (let i = 0; i < PLAYERS; i++) {
  startClient(i, "player");
  await sleep(stepMs);
}

await sleep(DURATION_S * 1000);
const during = await health();
const elapsedS = (performance.now() - startedAt) / 1000;

finishing = true;
for (const ws of sockets) ws.close();
await sleep(500);

const gaps = stats.gaps.sort((a, b) => a - b);
const conn = stats.connectMs.sort((a, b) => a - b);
const tickPeriod = during.tick ? 1000 / during.tick.rate : 33.3;
const clients = Math.max(1, stats.joined + SPECTATORS);

console.log("\n--- Resultado ---");
console.log(`Conexiones abiertas:      ${stats.opened}/${total}`);
console.log(`Jugadores admitidos:      ${stats.joined - 0}/${PLAYERS} (rechazados por partida llena: ${stats.rejected})`);
console.log(`Errores:                  ${stats.errors}`);
console.log(`Cierres inesperados:      ${stats.unexpectedCloses} ${[...stats.closeCodes].map(([c, n]) => `(código ${c}: ${n})`).join(" ")}`);
console.log(`Tiempo hasta welcome:     p50 ${f1(percentile(conn, 50))} ms, p95 ${f1(percentile(conn, 95))} ms`);
console.log(`Estados por cliente/s:    ${f1(stats.stateMsgs / clients / elapsedS)} (esperado ≈ ${during.tick?.rate ?? 30})`);
console.log(`Intervalo entre estados:  p50 ${f1(percentile(gaps, 50))} ms, p95 ${f1(percentile(gaps, 95))} ms, p99 ${f1(percentile(gaps, 99))} ms, máx ${f1(gaps[gaps.length - 1])} ms (periodo ${f1(tickPeriod)} ms)`);
console.log(`Descarga por cliente:     ${f1(stats.bytes / clients / elapsedS / 1024)} KiB/s`);
console.log(`Servidor /health:         jugadores ${during.players}, espectadores ${during.spectators}, tick medio ${during.tick?.avgMs} ms, tick máx ${during.tick?.maxMs} ms (presupuesto ${during.tick?.budgetMs} ms)`);

const checks = [
  ["sin cierres inesperados", stats.unexpectedCloses === 0],
  ["todos los jugadores admitidos", stats.joined + stats.rejected === PLAYERS && stats.rejected === 0],
  ["p95 del intervalo < 2 × periodo de Tick", percentile(gaps, 95) < 2 * tickPeriod],
  ["tick máx del servidor < presupuesto", during.tick ? during.tick.maxMs < during.tick.budgetMs : false],
];
console.log("\n--- Criterios ---");
let ok = true;
for (const [name, pass] of checks) {
  console.log(`${pass ? "OK  " : "FALLA"} ${name}`);
  if (!pass) ok = false;
}
process.exit(ok ? 0 : 1);
