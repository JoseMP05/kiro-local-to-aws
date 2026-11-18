// HUD del Cliente_Juego: Ranking, minimapa, panel de controles, cuenta
// regresiva. Las funciones de cálculo son puras; el dibujo usa coordenadas de
// pantalla (píxeles CSS) con letra de al menos 14 px.

import { RETRO_FONT, PALETTE, drawPanel, drawKeycap, drawOutlinedText, hpColor } from "../shared/sprites.js";
import { killFeedText, killFeedSegments } from "../shared/kill-feed.js";
import { KILL_ROLE_COLORS } from "../shared/ui-colors.js";

export { killFeedText };

const HUD_FONT_PX = 14;
const MARGIN = 12;
const PROTECTED_TEXT_GAP = 24; // px entre el texto "PROTEGIDO" y el borde superior de la barra de vida

/**
 * Líneas del Ranking: las 10 primeras entradas y, si la posición propia es > 10,
 * una línea adicional con la posición propia.
 * @param {object} ranking { tables: [{ name, entries }], you }
 * @returns {Array<{ text: string, position: number, nick: string, score: number, bot: boolean, own: boolean }>}
 */
export function rankingLines(ranking) {
  const lines = [];
  const table = ranking.tables?.[0];
  if (!table) return lines;
  const youPos = ranking.you?.position ?? null;

  for (const e of table.entries.slice(0, 10)) {
    const mark = e.bot ? " BOT" : "";
    const own = youPos !== null && e.position === youPos;
    lines.push({
      text: `${e.position}. ${e.nick}${mark} — ${e.score}`,
      position: e.position, nick: e.nick, score: e.score, bot: !!e.bot, own,
    });
  }

  if (youPos !== null && youPos > 10) {
    lines.push({
      text: `${youPos}. (tú) — ${ranking.you.score}`,
      position: youPos, nick: "(tú)", score: ranking.you.score, bot: false, own: true,
    });
  }

  return lines;
}

/**
 * Segundos de la cuenta regresiva de reaparición.
 */
export function countdownSeconds(respawnTick, estimatedTick, tickRate) {
  return Math.max(0, Math.ceil((respawnTick - estimatedTick) / tickRate));
}

/**
 * Tamaño del minimapa: la Arena completa escalada para caber en maxW × maxH.
 * @returns {{ scale: number, w: number, h: number }}
 */
export function minimapLayout(arena, maxW, maxH) {
  const scale = Math.min(maxW / arena.w, maxH / arena.h);
  return { scale, w: Math.round(arena.w * scale), h: Math.round(arena.h * scale) };
}

/**
 * Insignias de potenciadores activos del Jugador.
 * @param {{ effects?: Array<{ name: string, remainingMs: number }>, shield?: boolean }|undefined} own
 * @returns {Array<{ label: string, color: string }>}
 */
export function powerupBadges(own) {
  if (!own || own.dead) return [];
  const out = [];
  for (const e of own.effects ?? []) {
    const secs = Math.ceil(e.remainingMs / 1000);
    if (e.name === "turbo") out.push({ label: `TURBO ${secs}S`, color: "#ffca28" });
    else if (e.name === "ralentizar") out.push({ label: `LENTO ${secs}S`, color: "#90a4ae" });
  }
  if (own.shield) out.push({ label: "ESCUDO", color: "#4fc3f7" });
  return out;
}

/** Filas del panel de controles: teclas y acción. */
export const CONTROLS = [
  { keys: ["W", "A", "S", "D"], action: "MOVER (O FLECHAS)" },
  { keys: ["RATÓN"], action: "APUNTAR" },
  { keys: ["CLIC"], action: "DISPARAR" },
  { keys: ["M"], action: "SONIDO SÍ/NO" },
  { keys: ["H"], action: "OCULTAR AYUDA" },
];

/**
 * Dibuja todo el HUD.
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} scene { ranking, respawnTick, estimatedTick, tickRate, showHelp, minimap, frame,
 *   killFeed, myNick, banner, hitFlash }
 * @param {{ w: number, h: number }} screen tamaño en px CSS
 */
export function drawHud(ctx, scene, screen) {
  ctx.save();
  if (scene.hitFlash > 0) drawHitFlash(ctx, scene.hitFlash, screen);
  if (scene.minimap) drawMinimap(ctx, scene.minimap, MARGIN, MARGIN);
  if (scene.ranking) drawRanking(ctx, scene.ranking, screen);
  if (scene.showHelp) drawControls(ctx, screen);
  else drawHelpHint(ctx, screen);
  if (scene.respawnTick != null) drawCountdown(ctx, scene, screen);
  if (scene.ownHealth) drawOwnHealth(ctx, scene.ownHealth, screen);
  if (scene.protectedNow) {
    // Justo encima de la barra de vida propia.
    const bar = ownHealthLayout(screen);
    drawOutlinedText(ctx, "PROTEGIDO · AÚN NO PUEDES DISPARAR", screen.w / 2, bar.y - PROTECTED_TEXT_GAP, { px: 14, color: "#b3e5fc" });
  }
  if (scene.badges?.length) drawBadges(ctx, scene.badges, screen);
  if (scene.killFeed?.length) drawKillFeed(ctx, scene.killFeed, scene.myNick, screen);
  if (scene.banner) drawOutlinedText(ctx, scene.banner.text, screen.w / 2, screen.h * 0.22, { px: 34, color: scene.banner.color });
  ctx.restore();
}

// Borde rojo que se desvanece al recibir daño. `alpha` en [0, 1].
function drawHitFlash(ctx, alpha, screen) {
  const g = ctx.createRadialGradient(
    screen.w / 2, screen.h / 2, Math.min(screen.w, screen.h) * 0.3,
    screen.w / 2, screen.h / 2, Math.max(screen.w, screen.h) * 0.7
  );
  g.addColorStop(0, "rgba(229,57,53,0)");
  g.addColorStop(1, `rgba(229,57,53,${(0.55 * alpha).toFixed(3)})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, screen.w, screen.h);
}

// Últimas eliminaciones arriba en el centro; las del Jugador van resaltadas.
function drawKillFeed(ctx, feed, myNick, screen) {
  setFont(ctx);
  const lineH = HUD_FONT_PX + 8;
  const pad = 8;
  let w = 0;
  for (const it of feed) w = Math.max(w, ctx.measureText(killFeedText(it)).width);
  w = Math.ceil(w) + pad * 2;
  const h = pad * 2 + feed.length * lineH - 8;
  const x = Math.round((screen.w - w) / 2);
  const y = MARGIN;
  drawPanel(ctx, x, y, w, h);
  let ly = y + pad;
  for (const it of feed) {
    const mine = myNick && (it.killer === myNick || it.victim === myNick);
    if (mine) {
      ctx.fillStyle = it.victim === myNick ? "rgba(229,57,53,0.35)" : "rgba(67,160,71,0.35)";
      ctx.fillRect(x + 4, ly - 3, w - 8, lineH - 2);
    }
    let lx = x + pad;
    for (const seg of killFeedSegments(it)) {
      ctx.fillStyle = KILL_ROLE_COLORS[seg.role];
      ctx.fillText(seg.text, lx, ly);
      lx += ctx.measureText(seg.text).width;
    }
    ly += lineH;
  }
}

function setFont(ctx, px = HUD_FONT_PX) {
  ctx.font = `bold ${px}px ${RETRO_FONT}`;
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
}

const MEDALS = ["#ffd54f", "#cfd8dc", "#ffab91"];

function drawRanking(ctx, ranking, screen) {
  const lines = rankingLines(ranking);
  const pad = 12;
  const lineH = HUD_FONT_PX + 6;
  const w = 260;
  const h = pad * 2 + lineH * (lines.length + 1) + 4;
  const x = screen.w - w - MARGIN - 4;
  const y = MARGIN;
  drawPanel(ctx, x, y, w, h);

  setFont(ctx);
  ctx.fillStyle = PALETTE.accent;
  ctx.fillText("RANKING", x + pad, y + pad);

  let ly = y + pad + lineH + 4;
  if (lines.length === 0) {
    ctx.fillStyle = "#9e9e9e";
    ctx.fillText("SIN JUGADORES", x + pad, ly);
  }
  for (const line of lines) {
    if (line.own) {
      ctx.fillStyle = "rgba(67,160,71,0.35)";
      ctx.fillRect(x + 6, ly - 3, w - 12, lineH);
    }
    const color = line.position <= 3 ? MEDALS[line.position - 1] : PALETTE.text;
    ctx.fillStyle = color;
    ctx.textAlign = "left";
    const nick = line.nick.length > 14 ? line.nick.slice(0, 13) + "…" : line.nick;
    ctx.fillText(`${String(line.position).padStart(2, " ")}. ${nick}`, x + pad, ly);
    if (line.bot) {
      ctx.fillStyle = "#9e9e9e";
      ctx.fillText("BOT", x + w - pad - 78, ly);
    }
    ctx.fillStyle = color;
    ctx.textAlign = "right";
    ctx.fillText(String(line.score), x + w - pad, ly);
    ly += lineH;
  }
  ctx.textAlign = "left";
}

/**
 * Minimapa con la Arena completa, los Obstáculos, la zona que ve el Jugador y
 * las entidades que conoce el cliente (solo recibe las de su Área_Interés).
 * @param {object} mm { arena, obstacles, cam, tanks, boxes, ownId, self, frame }
 */
export function drawMinimap(ctx, mm, x, y) {
  const { arena, obstacles, cam, tanks, boxes, ownId, self, frame = 0 } = mm;
  const L = minimapLayout(arena, 210, 140);
  const s = L.scale;
  const pad = 10;
  const titleH = HUD_FONT_PX + 8;
  drawPanel(ctx, x, y, L.w + pad * 2, L.h + pad * 2 + titleH);

  setFont(ctx);
  ctx.fillStyle = PALETTE.accent;
  ctx.fillText("MAPA", x + pad, y + pad);

  const ox = x + pad;
  const oy = y + pad + titleH;

  ctx.save();
  ctx.beginPath();
  ctx.rect(ox, oy, L.w, L.h);
  ctx.clip();

  ctx.fillStyle = "#1f2a1d";
  ctx.fillRect(ox, oy, L.w, L.h);

  // Cuadrícula tenue.
  ctx.fillStyle = "rgba(255,255,255,0.05)";
  for (let gx = 400; gx < arena.w; gx += 400) ctx.fillRect(ox + Math.round(gx * s), oy, 1, L.h);
  for (let gy = 400; gy < arena.h; gy += 400) ctx.fillRect(ox, oy + Math.round(gy * s), L.w, 1);

  ctx.fillStyle = "#a0662e";
  for (const o of obstacles) {
    ctx.fillRect(ox + o.x * s, oy + o.y * s, Math.max(1, o.w * s), Math.max(1, o.h * s));
  }

  ctx.fillStyle = PALETTE.accent;
  for (const b of boxes.values()) {
    ctx.fillRect(Math.round(ox + b.x * s) - 1, Math.round(oy + b.y * s) - 1, 3, 3);
  }

  for (const t of tanks.values()) {
    if (t.id === ownId) continue;
    ctx.fillStyle = t.bot ? "#bdbdbd" : "#42a5f5";
    ctx.fillRect(Math.round(ox + t.x * s) - 2, Math.round(oy + t.y * s) - 2, 4, 4);
  }

  // Zona que ve el Jugador.
  if (cam) {
    ctx.strokeStyle = "rgba(255,255,255,0.75)";
    ctx.lineWidth = 1;
    ctx.strokeRect(
      Math.round(ox + cam.originX * s) + 0.5,
      Math.round(oy + cam.originY * s) + 0.5,
      Math.round(cam.viewW * s) - 1,
      Math.round(cam.viewH * s) - 1
    );
  }

  // Posición propia: parpadea; gris mientras está eliminado.
  if (self) {
    const px = Math.round(ox + self.x * s);
    const py = Math.round(oy + self.y * s);
    const big = Math.floor(frame / 20) % 2 === 0;
    const r = big ? 4 : 3;
    ctx.fillStyle = "#000";
    ctx.fillRect(px - r - 1, py - r - 1, 2 * r + 2, 2 * r + 2);
    ctx.fillStyle = self.dead ? "#757575" : "#69f0ae";
    ctx.fillRect(px - r, py - r, 2 * r, 2 * r);
    if (!self.dead && Number.isFinite(self.angle)) {
      ctx.strokeStyle = "#69f0ae";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + Math.cos(self.angle) * 10, py + Math.sin(self.angle) * 10);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawControls(ctx, screen) {
  const pad = 12;
  const rowH = HUD_FONT_PX + 16;
  const w = 330;
  const h = pad * 2 + HUD_FONT_PX + 10 + rowH * (CONTROLS.length + 1);
  const x = MARGIN;
  const y = screen.h - h - MARGIN - 4;
  drawPanel(ctx, x, y, w, h);

  setFont(ctx);
  ctx.fillStyle = PALETTE.accent;
  ctx.fillText("CONTROLES", x + pad, y + pad);

  let ry = y + pad + HUD_FONT_PX + 10;
  const actionX = x + 170;
  for (const row of CONTROLS) {
    let kx = x + pad;
    if (row.keys.length === 4) {
      // W encima de S, como en el teclado.
      const kw = 28;
      drawKeycap(ctx, kx + kw + 2, ry, "W");
      ry += rowH;
      for (const k of ["A", "S", "D"]) {
        drawKeycap(ctx, kx, ry, k);
        kx += kw + 2;
      }
    } else {
      for (const k of row.keys) kx += drawKeycap(ctx, kx, ry, k) + 4;
    }
    setFont(ctx);
    ctx.fillStyle = PALETTE.text;
    ctx.textBaseline = "middle";
    ctx.fillText(row.action, actionX, ry + (HUD_FONT_PX + 6) / 2);
    ry += rowH;
  }
}

function drawHelpHint(ctx, screen) {
  setFont(ctx);
  const label = "AYUDA";
  const kw = 28;
  const textW = Math.ceil(ctx.measureText(label).width);
  const w = 12 + kw + 8 + textW + 12;
  const h = 44;
  const x = MARGIN;
  const y = screen.h - h - MARGIN - 4;
  drawPanel(ctx, x, y, w, h);
  drawKeycap(ctx, x + 12, y + 10, "H");
  setFont(ctx);
  ctx.fillStyle = PALETTE.text;
  ctx.textBaseline = "middle";
  ctx.fillText(label, x + 12 + kw + 8, y + 10 + (HUD_FONT_PX + 6) / 2);
}

/** Titular de la pantalla de eliminación según quién causó la baja. */
export function deathHeadline(killedBy) {
  if (!killedBy) return "ELIMINADO";
  if (killedBy.self) return "TE AUTODESTRUISTE";
  if (killedBy.killer) return `ELIMINADO POR ${killedBy.killer}`;
  return "ELIMINADO";
}

function drawCountdown(ctx, scene, screen) {
  const secs = countdownSeconds(scene.respawnTick, scene.estimatedTick, scene.tickRate);
  drawOutlinedText(ctx, deathHeadline(scene.killedBy), screen.w / 2, screen.h / 2 - 70, { px: 28, color: "#ef5350" });
  drawOutlinedText(ctx, `REAPARECES EN ${secs}`, screen.w / 2, screen.h / 2 - 30, { px: 40, color: PALETTE.accent });
}

/** Posición y tamaño de la barra de vida propia: abajo al centro. */
export function ownHealthLayout(screen) {
  const w = Math.min(360, Math.max(200, screen.w - 760));
  const h = 22;
  return { x: Math.round((screen.w - w) / 2), y: screen.h - h - MARGIN - 8, w, h };
}

/** Barra de vida propia, grande, abajo al centro. `base` es la vida máxima sin bono de Ranking. */
function drawOwnHealth(ctx, own, screen) {
  const { x, y, w, h } = ownHealthLayout(screen);
  const frac = Math.max(0, Math.min(1, own.hp / own.maxHp));
  if (own.maxHp > (own.base ?? own.maxHp)) {
    ctx.fillStyle = PALETTE.accent;
    ctx.fillRect(x - 5, y - 5, w + 10, h + 10);
  }
  ctx.fillStyle = "#000";
  ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
  ctx.fillStyle = "#3a1010";
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = hpColor(frac);
  ctx.fillRect(x, y, Math.round(frac * w), h);
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.fillRect(x, y, Math.round(frac * w), 3);
  drawOutlinedText(ctx, `VIDA ${Math.ceil(own.hp)}/${own.maxHp}`, screen.w / 2, y + h / 2, { px: 14, baseline: "middle" });
}

function drawBadges(ctx, badges, screen) {
  setFont(ctx, 18);
  const pad = 10;
  const h = 18 + pad * 2;
  let y = screen.h - h - MARGIN - 4;
  for (const b of badges) {
    const w = Math.ceil(ctx.measureText(b.label).width) + pad * 2;
    const x = screen.w - w - MARGIN - 4;
    drawPanel(ctx, x, y, w, h);
    ctx.fillStyle = b.color;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(b.label, x + pad, y + pad);
    y -= h + 10;
  }
}
