// Partículas de explosión y textos flotantes ("-1", "+3") en coordenadas del
// mundo. Sin dependencias del DOM salvo el contexto 2D recibido en draw(). El
// tiempo se pasa desde fuera.

import { RETRO_FONT } from "./sprites.js";

const LIFE_MS = 600;
const MAX_PARTICLES = 300;
const TEXT_LIFE_MS = 800;
const MAX_TEXTS = 40;

export function createParticles() {
  /** @type {Array<{ x: number, y: number, vx: number, vy: number, born: number, color: string, size: number }>} */
  let list = [];
  /** @type {Array<{ x: number, y: number, text: string, color: string, px: number, born: number }>} */
  let texts = [];

  /** Ráfaga de partículas en (x, y). */
  function burst(x, y, now, { count = 18, colors = ["#ffeb3b", "#ff9800", "#f44336", "#ffffff"], speed = 240 } = {}) {
    for (let i = 0; i < count && list.length < MAX_PARTICLES; i++) {
      const angle = Math.random() * Math.PI * 2;
      const v = speed / 4 + Math.random() * speed;
      list.push({
        x, y,
        vx: Math.cos(angle) * v,
        vy: Math.sin(angle) * v,
        born: now,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 3 + Math.floor(Math.random() * 4),
      });
    }
  }

  /** Chispas pequeñas de un impacto de Bala. */
  function sparks(x, y, now) {
    burst(x, y, now, { count: 8, colors: ["#ffffff", "#ffcc80", "#ff7043"], speed: 160 });
  }

  /** Texto que sube y se desvanece en (x, y). `px` en unidades de Arena. */
  function text(x, y, str, now, { color = "#ffffff", px = 16 } = {}) {
    if (texts.length >= MAX_TEXTS) texts.shift();
    texts.push({ x: x + (Math.random() - 0.5) * 12, y, text: str, color, px, born: now });
  }

  /** Dibuja y descarta lo vencido. Llamar con la transformación del mundo activa. */
  function draw(ctx, now) {
    list = list.filter((p) => now - p.born < LIFE_MS);
    for (const p of list) {
      const age = (now - p.born) / 1000;
      const fade = 1 - (now - p.born) / LIFE_MS;
      ctx.globalAlpha = Math.max(0, fade);
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x + p.vx * age), Math.round(p.y + p.vy * age), p.size, p.size);
    }
    texts = texts.filter((t) => now - t.born < TEXT_LIFE_MS);
    if (texts.length > 0) {
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineJoin = "round";
      for (const t of texts) {
        const k = (now - t.born) / TEXT_LIFE_MS;
        const y = Math.round(t.y - 40 * k);
        ctx.globalAlpha = Math.max(0, 1 - k * k);
        ctx.font = `bold ${t.px}px ${RETRO_FONT}`;
        ctx.lineWidth = Math.max(2, t.px / 4);
        ctx.strokeStyle = "#000";
        ctx.strokeText(t.text, Math.round(t.x), y);
        ctx.fillStyle = t.color;
        ctx.fillText(t.text, Math.round(t.x), y);
      }
    }
    ctx.globalAlpha = 1;
  }

  return { burst, sparks, text, draw, size: () => list.length };
}
