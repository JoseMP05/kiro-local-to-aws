// Vista_Espectador: conexión, reconexión cada 3 s y bucle de dibujo.

import { decode } from "/shared/protocol.js";
import { createStateBuffer } from "/shared/interpolation.js";
import { drawSpectatorFrame } from "./render.js";
import { createKillFeed, streakMilestone } from "/shared/kill-feed.js";
import { createParticles } from "/shared/particles.js";

const canvas = document.getElementById("spectator-canvas");
const ctx = canvas.getContext("2d");
const status = document.getElementById("status");

let ws = null;
let welcome = null;
let buffer = null;
let ranking = null;
const killFeed = createKillFeed();
const particles = createParticles();
let lastTanks = new Map();
let lastTanksById = new Map();
let banner = null; // { text, until }: anuncio de racha
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
    const now = performance.now();
    for (const k of msg.data.kills ?? []) {
      killFeed.add(k.victim, k.killer, now, k.streak ?? 0);
      const v = lastTanks.get(k.victim);
      if (v) particles.burst(v.x, v.y, now, { count: 28 });
      const label = streakMilestone(k.streak);
      if (label && k.killer) banner = { text: `${k.killer}: ${label}`, until: now + 3000 };
    }
    // Chispas en cada Tanque que perdió vida sin morir.
    for (const t of msg.data.tanks) {
      const b = lastTanksById.get(t.id);
      if (b && !b.dead && !t.dead && t.hp < b.hp) particles.sparks(t.x, t.y, now);
    }
    lastTanks = new Map(msg.data.tanks.map((t) => [t.nick, t]));
    lastTanksById = new Map(msg.data.tanks.map((t) => [t.id, t]));
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
      particles,
      now: performance.now(),
      killFeed: killFeed.active(performance.now()),
      banner: banner && performance.now() < banner.until ? banner.text : null,
    }, { w: window.innerWidth, h: window.innerHeight }, dpr());
  }
  requestAnimationFrame(draw);
}
requestAnimationFrame(draw);

connect();
