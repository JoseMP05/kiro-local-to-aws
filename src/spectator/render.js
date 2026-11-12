// Dibujo de la Vista_Espectador: Arena completa con escala única y estilo
// retro. La función de transformación es pura; el dibujo usa el contexto 2D.

import {
  PALETTE, RETRO_FONT, drawGround, drawObstacle, drawCrate, drawBullet, drawTank,
  drawCrtOverlay, drawPanel, drawOutlinedText,
} from "../shared/sprites.js";

const RANKING_FONT_PX = 24;
const MEDALS = ["#ffd54f", "#cfd8dc", "#ffab91"];

/**
 * Escala y desplazamiento para mostrar toda la Arena centrada.
 * @returns {{ s: number, ox: number, oy: number }}
 */
export function spectatorTransform(vw, vh, W, H) {
  const s = Math.min(vw / W, vh / H);
  const ox = (vw - W * s) / 2;
  const oy = (vh - H * s) / 2;
  return { s, ox, oy };
}

/**
 * Dibuja un cuadro de espectador.
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} scene { arena, obstacles, tanks, bullets, boxes, config, ranking, killFeed, frame }
 * @param {{ w: number, h: number }} screen px CSS
 * @param {number} dpr
 */
export function drawSpectatorFrame(ctx, scene, screen, dpr) {
  const { arena, obstacles, tanks, bullets, boxes, config } = scene;
  const frame = scene.frame ?? 0;
  const tr = spectatorTransform(screen.w, screen.h, arena.width, arena.height);

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = PALETTE.franja;
  ctx.fillRect(0, 0, screen.w, screen.h);

  ctx.save();
  ctx.setTransform(dpr * tr.s, 0, 0, dpr * tr.s, dpr * tr.ox, dpr * tr.oy);

  drawGround(ctx, arena.width, arena.height);
  for (const o of obstacles) drawObstacle(ctx, o);
  for (const b of boxes.values()) drawCrate(ctx, b.x, b.y, config.boxSize, frame, b.kind);
  for (const b of bullets.values()) drawBullet(ctx, b.x, b.y, config.bulletRadius);

  // Etiquetas de unos 13 px en pantalla, con la escala que tenga la Arena.
  const labelPx = 11 / tr.s;
  for (const t of tanks.values()) {
    if (t.dead) continue;
    drawTank(ctx, t, {
      size: config.tankSize,
      barrelLength: config.barrelLength,
      maxHealth: config.maxHealth,
      color: t.bot ? "#9e9e9e" : "#1e88e5",
      label: t.bot ? `${t.nick} BOT · ${t.score}` : t.nick,
      labelColor: t.bot ? "#e0e0e0" : "#ffffff",
      labelPx,
      frame,
    });
  }

  if (scene.particles) scene.particles.draw(ctx, scene.now ?? 0);

  ctx.restore();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  drawCrtOverlay(ctx, screen.w, screen.h);
  drawOutlinedText(ctx, "● EN VIVO", screen.w / 2, 14, { px: 18, color: "#ef5350" });
  if (scene.ranking) drawRankingPanel(ctx, scene.ranking);
  if (scene.killFeed) drawKillFeed(ctx, scene.killFeed, screen);
}

function drawRankingPanel(ctx, ranking) {
  const pad = 16;
  const lineH = RANKING_FONT_PX + 10;
  const w = 420;
  let lines = 0;
  for (const table of ranking.tables) lines += 1 + Math.max(1, Math.min(10, table.entries.length));
  const h = pad * 2 + lines * lineH;
  const x = 20, y = 20;
  drawPanel(ctx, x, y, w, h);

  ctx.font = `bold ${RANKING_FONT_PX}px ${RETRO_FONT}`;
  ctx.textBaseline = "top";
  let ly = y + pad;
  for (const table of ranking.tables) {
    ctx.textAlign = "left";
    ctx.fillStyle = PALETTE.accent;
    ctx.fillText(table.name.toUpperCase(), x + pad, ly);
    ly += lineH;
    if (table.entries.length === 0) {
      ctx.fillStyle = "#9e9e9e";
      ctx.fillText("ESPERANDO JUGADORES", x + pad, ly);
      ly += lineH;
    }
    for (const e of table.entries.slice(0, 10)) {
      const color = e.position <= 3 ? MEDALS[e.position - 1] : PALETTE.text;
      ctx.fillStyle = color;
      ctx.textAlign = "left";
      const nick = e.nick.length > 14 ? e.nick.slice(0, 13) + "…" : e.nick;
      ctx.fillText(`${String(e.position).padStart(2, " ")}. ${nick}`, x + pad, ly);
      if (e.bot) {
        ctx.fillStyle = "#9e9e9e";
        ctx.fillText("BOT", x + w - pad - 130, ly);
      }
      ctx.fillStyle = color;
      ctx.textAlign = "right";
      ctx.fillText(String(e.score), x + w - pad, ly);
      ly += lineH;
    }
  }
  ctx.textAlign = "left";
}

function drawKillFeed(ctx, feed, screen) {
  if (feed.length === 0) return;
  const px = 18;
  const lineH = px + 12;
  const pad = 12;
  ctx.font = `bold ${px}px ${RETRO_FONT}`;
  let w = 0;
  const texts = feed.map((it) => ({ killer: it.killer ?? "?", victim: it.victim }));
  for (const t of texts) w = Math.max(w, ctx.measureText(`${t.killer} ► ${t.victim}`).width);
  w = Math.ceil(w) + pad * 2;
  const h = pad * 2 + texts.length * lineH - 12;
  const x = screen.w - w - 24;
  const y = 20;
  drawPanel(ctx, x, y, w, h);

  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  let ly = y + pad;
  for (const t of texts) {
    let lx = x + pad;
    ctx.fillStyle = PALETTE.accent;
    ctx.fillText(t.killer, lx, ly);
    lx += ctx.measureText(t.killer).width;
    ctx.fillStyle = "#ef5350";
    ctx.fillText(" ► ", lx, ly);
    lx += ctx.measureText(" ► ").width;
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(t.victim, lx, ly);
    ly += lineH;
  }
}
