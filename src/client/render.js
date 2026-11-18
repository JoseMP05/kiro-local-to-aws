// Dibujo del mundo en Canvas con estilo retro. Las funciones de color y medida
// son puras (sin DOM al importar). drawFrame usa el contexto 2D.

import { visibleWorldRect } from "./camera.js";
import { createBulletTrails } from "../shared/bullet-trails.js";
import {
  PALETTE, drawGround, drawObstacle, drawCrate, drawBullet, drawTank, botLabel, BULLET_COLORS,
} from "../shared/sprites.js";

export { botLabel };

/** Color del Tanque según su categoría. */
export function tankColor(category) {
  switch (category) {
    case "self": return "#43a047";
    case "bot": return "#9e9e9e";
    default: return "#1e88e5"; // otros Jugadores
  }
}

const bulletTrails = createBulletTrails();

/** Ancho de la barra de vida. */
export function hpBarWidth(hp, maxHp, barW) {
  const frac = Math.max(0, Math.min(1, hp / maxHp));
  return frac * barW;
}

const LABEL_COLORS = { self: "#b9f6ca", bot: "#e0e0e0", other: "#ffffff" };

/**
 * Dibuja el mundo de un cuadro.
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} cam cámara de computeCamera
 * @param {object} scene { obstacles, arena, tanks, bullets, boxes, ownId, config, frame }
 * @param {number} dpr devicePixelRatio limitado a 2
 */
export function drawFrame(ctx, cam, scene, dpr) {
  const { obstacles, arena, tanks, bullets, boxes, ownId, config } = scene;
  const frame = scene.frame ?? 0;

  // Franjas en toda la superficie.
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = PALETTE.franja;
  ctx.fillRect(0, 0, cam.canvasW, cam.canvasH);

  // Recorte al Área_Visible y transformación del mundo.
  ctx.save();
  ctx.beginPath();
  ctx.rect(cam.ox, cam.oy, cam.viewW * cam.scale, cam.viewH * cam.scale);
  ctx.clip();
  ctx.setTransform(
    dpr * cam.scale, 0, 0, dpr * cam.scale,
    dpr * (cam.ox - cam.originX * cam.scale),
    dpr * (cam.oy - cam.originY * cam.scale)
  );

  const vr = visibleWorldRect(cam, arena);
  const margin = 100;

  drawGround(ctx, arena.w, arena.h, vr);
  for (const o of obstacles) {
    if (o.x > vr.right + margin || o.x + o.w < vr.left - margin || o.y > vr.bottom + margin || o.y + o.h < vr.top - margin) continue;
    drawObstacle(ctx, o);
  }

  for (const b of boxes.values()) {
    if (outside(b, vr, margin)) continue;
    drawCrate(ctx, b.x, b.y, config.boxSize, frame, b.kind);
  }

  if (scene.pickupFx) scene.pickupFx.draw(ctx, scene.now ?? 0, config.boxSize);

  bulletTrails.begin();
  for (const b of bullets.values()) {
    if (outside(b, vr, margin)) continue;
    const colors = b.own ? BULLET_COLORS.own : BULLET_COLORS.other;
    bulletTrails.drawFor(ctx, b.id, b.x, b.y, config.bulletRadius, colors.trail);
    drawBullet(ctx, b.x, b.y, config.bulletRadius, colors);
  }
  bulletTrails.end();

  for (const t of tanks.values()) {
    if (outside(t, vr, margin)) continue;
    const category = t.id === ownId ? "self" : t.bot ? "bot" : "other";
    drawTank(ctx, t, {
      size: config.tankSize,
      barrelLength: config.barrelLength,
      maxHealth: config.maxHealth,
      color: tankColor(category),
      label: t.bot ? botLabel(t.nick, t.score, config.botsInRanking) : t.nick,
      labelColor: LABEL_COLORS[category],
      labelPx: 14,
      frame,
    });
  }

  if (scene.particles) scene.particles.draw(ctx, scene.now ?? 0);

  ctx.restore();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function outside(e, vr, margin) {
  return (
    e.x < vr.left - margin || e.x > vr.right + margin ||
    e.y < vr.top - margin || e.y > vr.bottom + margin
  );
}
