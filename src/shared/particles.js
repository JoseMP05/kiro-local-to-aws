// Partículas de explosión en coordenadas del mundo. Sin dependencias del DOM
// salvo el contexto 2D recibido en draw(). El tiempo se pasa desde fuera.

const LIFE_MS = 600;
const MAX_PARTICLES = 300;

export function createParticles() {
  /** @type {Array<{ x: number, y: number, vx: number, vy: number, born: number, color: string, size: number }>} */
  let list = [];

  /** Ráfaga de partículas en (x, y). */
  function burst(x, y, now, { count = 18, colors = ["#ffeb3b", "#ff9800", "#f44336", "#ffffff"] } = {}) {
    for (let i = 0; i < count && list.length < MAX_PARTICLES; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 240;
      list.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        born: now,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 3 + Math.floor(Math.random() * 4),
      });
    }
  }

  /** Dibuja y descarta las partículas vencidas. Llamar con la transformación del mundo activa. */
  function draw(ctx, now) {
    list = list.filter((p) => now - p.born < LIFE_MS);
    for (const p of list) {
      const age = (now - p.born) / 1000;
      const fade = 1 - (now - p.born) / LIFE_MS;
      ctx.globalAlpha = Math.max(0, fade);
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x + p.vx * age), Math.round(p.y + p.vy * age), p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  return { burst, draw, size: () => list.length };
}
