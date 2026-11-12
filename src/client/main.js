// Cliente_Juego: pantallas, conexión, muestreo de Input y bucle de dibujo.
// Importa el código compartido desde /shared/.

import { encode, decode } from "/shared/protocol.js";
import { createStateBuffer } from "/shared/interpolation.js";
import { createInputSampler } from "./input-sampler.js";
import { computeCamera, screenToWorld } from "./camera.js";
import { drawFrame } from "./render.js";
import { drawHud, powerupBadges } from "./hud.js";
import { drawCrtOverlay } from "/shared/sprites.js";
import { createParticles } from "/shared/particles.js";
import { createAudio } from "./audio.js";

const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");
const joinScreen = document.getElementById("screen-join");
const disconnectScreen = document.getElementById("screen-disconnect");
const joinForm = document.getElementById("join-form");
const nickInput = document.getElementById("nick-input");
const nickError = document.getElementById("nick-error");
const rejoinButton = document.getElementById("rejoin-button");

let ws = null;
let welcome = null;
let buffer = null;
let ranking = null;
let sampler = createInputSampler();
let ownId = null;
let deathFocus = null;
let lastState = null;
let lastSendAt = 0;
let frame = 0;
let showHelp = true; // panel de controles visible hasta que se pulse H
const particles = createParticles();
const audio = createAudio();
let lastShotSoundAt = 0;

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

// --- Conexión ---

function connect(nick) {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  ws = new WebSocket(`${proto}//${location.host}/ws/jugador`);
  ws.addEventListener("open", () => {
    ws.send(encode({ type: "join", data: { nick } }));
  });
  ws.addEventListener("message", (ev) => {
    const r = decode(ev.data);
    if (!r.ok) return;
    handleServerMessage(r.message);
  });
  ws.addEventListener("close", () => {
    showDisconnect();
  });
  ws.addEventListener("error", () => {});
}

function handleServerMessage(msg) {
  if (msg.type === "error") {
    nickError.textContent = msg.data.message;
    showJoin();
    return;
  }
  if (msg.type === "welcome") {
    welcome = msg.data;
    ownId = msg.data.tankId;
    buffer = createStateBuffer({
      tickRate: msg.data.config.tickRate,
      interpolationDelayMs: msg.data.config.interpolationDelayMs,
    });
    showGame();
    return;
  }
  if (msg.type === "state") {
    reactToState(lastState, msg.data);
    lastState = msg.data;
    if (buffer) buffer.push(msg.data, performance.now());
    // Foco al morir.
    const own = msg.data.tanks.find((t) => t.id === ownId);
    if (own && own.dead) {
      if (!deathFocus) deathFocus = { x: own.x, y: own.y };
    } else {
      deathFocus = null;
    }
    return;
  }
  if (msg.type === "ranking") {
    ranking = msg.data;
  }
}

// Efectos de sonido y partículas a partir de los cambios entre dos estados.
function reactToState(prev, next) {
  const now = performance.now();
  const myNick = welcome?.nick;
  let iKilled = false;
  for (const k of next.kills ?? []) {
    const victim = prev?.tanks.find((t) => t.nick === k.victim);
    if (victim) particles.burst(victim.x, victim.y, now);
    audio.explosion(k.victim === myNick);
    if (k.killer === myNick && k.victim !== myNick) iKilled = true;
  }
  const before = prev?.tanks.find((t) => t.id === ownId);
  const after = next.tanks.find((t) => t.id === ownId);
  if (!before || !after || after.dead) return;
  const gotPowerup =
    (after.shield && !before.shield) || after.effects.length > before.effects.length;
  if (gotPowerup) audio.powerup();
  else if (after.score > before.score && !iKilled) audio.pickup();
}

// --- Pantallas ---

function showJoin() {
  joinScreen.classList.remove("hidden");
  disconnectScreen.classList.add("hidden");
}
function showGame() {
  joinScreen.classList.add("hidden");
  disconnectScreen.classList.add("hidden");
}
function showDisconnect() {
  disconnectScreen.classList.remove("hidden");
}

joinForm.addEventListener("submit", (e) => {
  e.preventDefault();
  nickError.textContent = "";
  const nick = nickInput.value;
  connect(nick);
});

rejoinButton.addEventListener("click", () => {
  welcome = null; ownId = null; buffer = null; ranking = null; lastState = null; deathFocus = null;
  sampler = createInputSampler();
  showJoin();
});

// --- Input ---

const KEYMAP = { KeyW: "w", KeyA: "a", KeyS: "s", KeyD: "d", ArrowUp: "w", ArrowLeft: "a", ArrowDown: "s", ArrowRight: "d" };

// Las teclas pulsadas mientras se escribe el apodo no cuentan como Input.
const isTyping = (e) => e.target instanceof HTMLInputElement;

window.addEventListener("keydown", (e) => {
  if (isTyping(e)) return;
  if (e.code === "KeyH" && !e.repeat) {
    showHelp = !showHelp;
    return;
  }
  if (e.code === "KeyM" && !e.repeat) {
    audio.toggleMute();
    return;
  }
  const k = KEYMAP[e.code];
  if (k) {
    sampler.setKey(k, true);
    if (e.code.startsWith("Arrow")) e.preventDefault(); // evita desplazar la página
  }
});
window.addEventListener("keyup", (e) => {
  if (isTyping(e)) return;
  const k = KEYMAP[e.code];
  if (k) sampler.setKey(k, false);
});
window.addEventListener("blur", () => sampler.releaseAll());

let cursor = { x: 0, y: 0 };
canvas.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  cursor.x = e.clientX - rect.left;
  cursor.y = e.clientY - rect.top;
});
canvas.addEventListener("mousedown", () => sampler.setFire(true));
canvas.addEventListener("mouseup", () => sampler.setFire(false));

// --- Bucle de envío de Input ---

function startSendLoop(tickRate) {
  const interval = 1000 / tickRate;
  setInterval(() => {
    if (!ws || ws.readyState !== WebSocket.OPEN || ownId === null) return;
    const now = performance.now();
    if (now - lastSendAt < interval) return;
    const input = sampler.flush();
    if (input) {
      if (input.fire && now - lastShotSoundAt > 500) {
        audio.shot();
        lastShotSoundAt = now;
      }
      ws.send(encode({ type: "input", data: input }));
      lastSendAt = now;
    }
  }, interval / 2);
}
startSendLoop(30); // frecuencia por defecto; el welcome puede ajustarla

// --- Bucle de dibujo ---

function draw() {
  frame++;
  if (welcome && buffer) {
    const scene = buffer.sample(performance.now());
    const own = scene.tanks.get(ownId);
    const focus = own ? { x: own.x, y: own.y } : deathFocus || { x: welcome.arena.width / 2, y: welcome.arena.height / 2 };

    const cam = computeCamera(
      { w: window.innerWidth, h: window.innerHeight },
      { w: welcome.view.w, h: welcome.view.h },
      { w: welcome.arena.width, h: welcome.arena.height },
      focus
    );

    // Calcular el ángulo de apuntado desde la posición del Tanque al cursor.
    if (own) {
      const p = screenToWorld(cam, cursor.x, cursor.y);
      sampler.setAim(Math.atan2(p.y - own.y, p.x - own.x));
    }

    drawFrame(ctx, cam, {
      obstacles: welcome.obstacles,
      arena: { w: welcome.arena.width, h: welcome.arena.height },
      tanks: scene.tanks,
      bullets: scene.bullets,
      boxes: scene.boxes,
      ownId,
      config: welcome.config,
      frame,
      particles,
      now: performance.now(),
    }, dpr());

    const screen = { w: window.innerWidth, h: window.innerHeight };
    drawCrtOverlay(ctx, screen.w, screen.h);

    // HUD.
    const ownState = lastState?.tanks.find((t) => t.id === ownId);
    const respawnTick = ownState?.dead ? ownState.respawnTick : null;
    const estimatedTick = lastState ? lastState.tick : 0;
    const self = own
      ? { x: own.x, y: own.y, angle: own.angle, dead: false }
      : deathFocus ? { x: deathFocus.x, y: deathFocus.y, dead: true } : null;
    drawHud(ctx, {
      ranking,
      respawnTick,
      estimatedTick,
      tickRate: welcome.config.tickRate,
      showHelp,
      badges: powerupBadges(ownState),
      minimap: {
        arena: { w: welcome.arena.width, h: welcome.arena.height },
        obstacles: welcome.obstacles,
        cam,
        tanks: scene.tanks,
        boxes: scene.boxes,
        ownId,
        self,
        frame,
      },
    }, screen);
  }
  requestAnimationFrame(draw);
}
requestAnimationFrame(draw);
