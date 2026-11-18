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
import { createKillFeed, streakMilestone, isSelfKill } from "/shared/kill-feed.js";
import { createPickupFx, pickupInfo } from "/shared/pickup-fx.js";

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
let showHelp = true; // panel de controles: visible al entrar, se oculta solo a los 10 s; H lo alterna
let helpHideAt = 0; // instante (performance.now) del ocultado automático; 0 = sin temporizador
let killedBy = null; // { killer, self }: quién eliminó al Jugador en su muerte actual
const particles = createParticles();
const audio = createAudio();
const killFeed = createKillFeed();
const pickupFx = createPickupFx();
let lastShotSoundAt = 0;
let hitFlashAt = -Infinity; // último daño recibido (para el borde rojo)
let banner = null; // { text, color, until }: anuncio de racha propia
const HIT_FLASH_MS = 350;
const BANNER_MS = 2200;
const HELP_AUTO_HIDE_MS = 10000;

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
      killedBy = null;
    }
    return;
  }
  if (msg.type === "ranking") {
    ranking = msg.data;
  }
}

// Efectos de sonido, partículas y avisos a partir de los cambios entre dos estados.
function reactToState(prev, next) {
  const now = performance.now();
  const myNick = welcome?.nick;
  let iKilled = false;
  for (const k of next.kills ?? []) {
    killFeed.add(k.victim, k.killer, now, k.streak ?? 0);
    const victim = prev?.tanks.find((t) => t.nick === k.victim);
    if (victim) particles.burst(victim.x, victim.y, now);
    audio.explosion(k.victim === myNick);
    if (k.victim === myNick) killedBy = { killer: k.killer ?? null, self: isSelfKill(k) };
    if (k.killer === myNick && k.victim !== myNick) {
      iKilled = true;
      const label = streakMilestone(k.streak);
      if (label) {
        banner = { text: label, color: "#ff9800", until: now + BANNER_MS };
        audio.streak();
      }
    }
  }

  // Cajas recogidas: animación sobre la Caja (de cualquier Jugador visible).
  for (const c of next.collected ?? []) {
    pickupFx.add(c.kind, c.x, c.y, now);
    particles.burst(c.x, c.y, now, { count: 10, colors: pickupInfo(c.kind).burst, speed: 170 });
  }
  // Recogidas propias: aviso flotante con la cantidad configurada, ráfaga y sonido por tipo.
  const ownNow = next.tanks.find((t) => t.id === ownId);
  const pickups = next.pickups ?? [];
  for (const p of pickups) {
    if (!ownNow) break;
    const info = pickupInfo(p.kind, p.amount);
    if (info.text) particles.text(ownNow.x, ownNow.y - 44, info.text, now, { color: info.color, px: 20 });
    particles.burst(ownNow.x, ownNow.y, now, { count: 14, colors: info.burst, speed: 200 });
    audio.pickupKind(p.kind);
  }
  const healedByBox = pickups.some((p) => p.kind === "botiquin");

  // Impactos y curaciones: diferencia de vida de cada Tanque entre estados.
  let healed = false;
  if (prev) {
    const prevById = new Map(prev.tanks.map((t) => [t.id, t]));
    for (const t of next.tanks) {
      const b = prevById.get(t.id);
      if (!b || b.dead || t.dead) continue;
      const diff = t.hp - b.hp;
      if (diff < 0) {
        particles.sparks(t.x, t.y, now);
        particles.text(t.x, t.y - 32, String(diff), now, { color: "#ff5252" });
        if (t.id === ownId) {
          hitFlashAt = now;
          audio.hit();
        }
      } else if (diff > 0) {
        if (!(t.id === ownId && healedByBox)) particles.text(t.x, t.y - 32, `+${diff}`, now, { color: "#69f0ae" });
        if (t.id === ownId) healed = true;
      }
    }
  }

  const before = prev?.tanks.find((t) => t.id === ownId);
  const after = next.tanks.find((t) => t.id === ownId);
  if (!before || !after || after.dead || before.dead) return;
  if (pickups.length > 0) return; // el sonido ya lo dio cada tipo de Caja
  const gotPowerup =
    (after.shield && !before.shield) || after.effects.length > before.effects.length;
  if (gotPowerup) audio.powerup();
  else if (healed) audio.heal();
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
  // La ayuda se muestra al entrar y se oculta sola; no vuelve a aparecer al reaparecer.
  showHelp = true;
  helpHideAt = performance.now() + HELP_AUTO_HIDE_MS;
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
  killFeed.clear(); banner = null; hitFlashAt = -Infinity; killedBy = null;
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
    helpHideAt = 0; // el control manual anula el ocultado automático
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
      // Un sonido por recarga como mucho (el servidor no dispara más rápido).
      if (input.fire && now - lastShotSoundAt > (welcome?.config.reloadMs ?? 500)) {
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
      pickupFx,
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
    const now = performance.now();
    if (banner && now >= banner.until) banner = null;
    if (helpHideAt && now >= helpHideAt) {
      showHelp = false;
      helpHideAt = 0;
    }
    drawHud(ctx, {
      ranking,
      killFeed: killFeed.active(now),
      myNick: welcome.nick,
      banner,
      hitFlash: Math.max(0, 1 - (now - hitFlashAt) / HIT_FLASH_MS),
      respawnTick,
      killedBy,
      ownHealth: ownState && !ownState.dead
        ? { hp: ownState.hp, maxHp: ownState.maxHp, base: welcome.config.maxHealth }
        : null,
      estimatedTick,
      tickRate: welcome.config.tickRate,
      showHelp,
      badges: powerupBadges(ownState, welcome.config.effectDurations),
      protectedNow: !!(ownState && !ownState.dead && ownState.inv),
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
