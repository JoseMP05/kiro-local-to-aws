// Vista_Espectador: conexión, reconexión cada 3 s y bucle de dibujo.

import { decode } from "/shared/protocol.js";
import { createStateBuffer } from "/shared/interpolation.js";
import { drawSpectatorFrame } from "./render.js";
import { createKillFeed } from "./kill-feed.js";

const canvas = document.getElementById("spectator-canvas");
const ctx = canvas.getContext("2d");
const status = document.getElementById("status");

let ws = null;
let welcome = null;
let buffer = null;
let ranking = null;
const killFeed = createKillFeed();
let frame = 0;

function dpr() {
  return Math.min(window.devicePixelRatio || 1, 2);
}

function resizeCanvas() {
  const w = window.innerWidth, h = window.innerHeight;
  canvas.style.width = w + "px";
  canvas.style.height = h + "px";
  canvas.width = Math.floor(w * dpr());
  canvas.height = Math.floor(h * dpr());
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

/** Lógica de reconexión con setTimeout inyectable (para pruebas). */
export function createReconnector(connectFn, scheduleFn = setTimeout, delayMs = 3000) {
  function onClose() {
    status.classList.remove("hidden");
    if (buffer) buffer.clear();
    scheduleFn(connectFn, delayMs);
  }
  return { onClose };
}

function connect() {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  ws = new WebSocket(`${proto}//${location.host}/ws/espectador`);
  ws.addEventListener("open", () => {
    status.classList.add("hidden");
  });
  ws.addEventListener("message", (ev) => {
    const r = decode(ev.data);
    if (!r.ok) return;
    handle(r.message);
  });
  ws.addEventListener("close", () => reconnector.onClose());
  ws.addEventListener("error", () => {});
}

const reconnector = createReconnector(connect);

function handle(msg) {
  if (msg.type === "spectatorWelcome") {
    welcome = msg.data;
    buffer = createStateBuffer({
      tickRate: msg.data.config.tickRate,
      interpolationDelayMs: msg.data.config.interpolationDelayMs,
    });
    return;
  }
  if (msg.type === "state") {
    if (buffer) buffer.push(msg.data, performance.now());
    for (const k of msg.data.kills ?? []) {
      killFeed.add(k.victim, k.killer, performance.now());
    }
    return;
  }
  if (msg.type === "ranking") {
    ranking = msg.data;
  }
}

function draw() {
  frame++;
  if (welcome && buffer) {
    const scene = buffer.sample(performance.now());
    drawSpectatorFrame(ctx, {
      frame,
      arena: welcome.arena,
      obstacles: welcome.obstacles,
      tanks: scene.tanks,
      bullets: scene.bullets,
      boxes: scene.boxes,
      config: welcome.config,
      ranking,
      killFeed: killFeed.active(performance.now()),
    }, { w: window.innerWidth, h: window.innerHeight }, dpr());
  }
  requestAnimationFrame(draw);
}
requestAnimationFrame(draw);

connect();
