// Sprites de estilo retro dibujados por código (sin imágenes externas).
// Los usan el Cliente_Juego y la Vista_Espectador para compartir el mismo
// estilo. No tocan el DOM al importarse: los lienzos auxiliares se crean la
// primera vez que se dibuja.

export const RETRO_FONT = '"Courier New", Courier, monospace';

export const PALETTE = {
  franja: "#202020",
  ground: "#2e3b2e",
  groundDark: "#273326",
  groundLight: "#364634",
  groundGrid: "#253023",
  arenaEdge: "#141a12",
  brickA: "#8d5524",
  brickB: "#7a4a1f",
  mortar: "#3b2716",
  outline: "#0d0d0d",
  text: "#f5f5f5",
  accent: "#ffd54f",
};

/** Aclara (amt > 0) u oscurece (amt < 0) un color #rrggbb. */
export function shade(hex, amt) {
  const n = Number.parseInt(hex.slice(1), 16);
  const clamp = (v) => Math.max(0, Math.min(255, v));
  const r = clamp((n >> 16) + amt);
  const g = clamp(((n >> 8) & 0xff) + amt);
  const b = clamp((n & 0xff) + amt);
  return "#" + ((r << 16) | (g << 8) | b).toString(16).padStart(6, "0");
}

/** Color de la barra de vida según la fracción restante. */
export function hpColor(frac) {
  if (frac > 0.66) return "#4caf50";
  if (frac > 0.33) return "#ffca28";
  return "#ef5350";
}

// --- lienzos auxiliares y patrones ---

function makeCanvas(w, h) {
  if (typeof document !== "undefined") {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    return c;
  }
  return new OffscreenCanvas(w, h);
}

// Ruido determinista: el suelo es siempre igual, sin Math.random.
function hash(x, y) {
  return (((x * 73856093) ^ (y * 19349663)) >>> 0) % 100;
}

// Baldosa de suelo de 16 × 16 píxeles; se escala ×4 (64 unidades de Arena).
function buildGroundTile() {
  const c = makeCanvas(16, 16);
  const g = c.getContext("2d");
  g.fillStyle = PALETTE.ground;
  g.fillRect(0, 0, 16, 16);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const h = hash(x, y);
      if (h < 9) {
        g.fillStyle = PALETTE.groundDark;
        g.fillRect(x, y, 1, 1);
      } else if (h < 13) {
        g.fillStyle = PALETTE.groundLight;
        g.fillRect(x, y, 1, 1);
      }
    }
  }
  g.fillStyle = PALETTE.groundGrid;
  g.fillRect(0, 0, 16, 1);
  g.fillRect(0, 0, 1, 16);
  return c;
}

// Baldosa de ladrillos de 16 × 8 píxeles; se escala ×2 (ladrillos de 16 × 8 unidades).
function buildBrickTile() {
  const c = makeCanvas(16, 8);
  const g = c.getContext("2d");
  g.fillStyle = PALETTE.mortar;
  g.fillRect(0, 0, 16, 8);
  const brick = (x, y, w, h, col) => {
    g.fillStyle = col;
    g.fillRect(x, y, w, h);
    g.fillStyle = shade(col, 28);
    g.fillRect(x, y, w, 1);
    g.fillStyle = shade(col, -28);
    g.fillRect(x, y + h - 1, w, 1);
  };
  brick(0, 0, 7, 3, PALETTE.brickA);
  brick(8, 0, 7, 3, PALETTE.brickB);
  // Fila desplazada: los ladrillos de los extremos continúan en la baldosa vecina.
  brick(-4, 4, 7, 3, PALETTE.brickB);
  brick(4, 4, 7, 3, PALETTE.brickA);
  brick(12, 4, 7, 3, PALETTE.brickB);
  return c;
}

const patternCache = new WeakMap();

function scalePattern(pattern, s) {
  if (pattern && typeof pattern.setTransform === "function" && typeof DOMMatrix !== "undefined") {
    pattern.setTransform(new DOMMatrix([s, 0, 0, s, 0, 0]));
  }
}

function patterns(ctx) {
  let p = patternCache.get(ctx);
  if (!p) {
    const ground = ctx.createPattern(buildGroundTile(), "repeat");
    const brick = ctx.createPattern(buildBrickTile(), "repeat");
    scalePattern(ground, 4);
    scalePattern(brick, 2);
    p = { ground, brick };
    patternCache.set(ctx, p);
  }
  return p;
}

// --- mundo (coordenadas de Arena) ---

/** Suelo de la Arena con textura de píxeles y un borde oscuro. */
export function drawGround(ctx, w, h) {
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = patterns(ctx).ground;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = PALETTE.arenaEdge;
  const e = 4;
  ctx.fillRect(0, 0, w, e);
  ctx.fillRect(0, h - e, w, e);
  ctx.fillRect(0, 0, e, h);
  ctx.fillRect(w - e, 0, e, h);
}

/** Obstáculo como muro de ladrillos con sombra y contorno. */
export function drawObstacle(ctx, o) {
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(o.x + 5, o.y + 5, o.w, o.h);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = patterns(ctx).brick;
  ctx.fillRect(o.x, o.y, o.w, o.h);
  ctx.fillStyle = "rgba(255,255,255,0.14)";
  ctx.fillRect(o.x, o.y, o.w, 2);
  ctx.strokeStyle = "#1b120a";
  ctx.lineWidth = 2;
  ctx.strokeRect(o.x + 1, o.y + 1, o.w - 2, o.h - 2);
}

/** Caja de madera con una moneda; flota un poco para llamar la atención. */
export function drawCrate(ctx, x, y, size, frame = 0) {
  const s = Math.round(size);
  const bob = Math.round(Math.sin(frame / 12 + x * 0.01) * 1.5);
  const l = Math.round(x - s / 2);
  const t = Math.round(y - s / 2) + bob;

  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.fillRect(l + 3, Math.round(y - s / 2) + 4, s, s);

  ctx.fillStyle = "#b9772f";
  ctx.fillRect(l, t, s, s);
  // Tablas.
  ctx.fillStyle = "#8a5520";
  const third = Math.round(s / 3);
  ctx.fillRect(l, t + third, s, 2);
  ctx.fillRect(l, t + 2 * third, s, 2);
  ctx.fillStyle = "#d4954a";
  ctx.fillRect(l, t, s, 2);
  // Contorno y esquinas metálicas.
  ctx.strokeStyle = "#4a2a0c";
  ctx.lineWidth = 2;
  ctx.strokeRect(l + 1, t + 1, s - 2, s - 2);
  ctx.fillStyle = "#cfcfcf";
  const c = 4;
  ctx.fillRect(l, t, c, c);
  ctx.fillRect(l + s - c, t, c, c);
  ctx.fillRect(l, t + s - c, c, c);
  ctx.fillRect(l + s - c, t + s - c, c, c);
  // Moneda.
  const m = Math.max(4, Math.round(s * 0.34));
  const mx = Math.round(x - m / 2);
  const my = Math.round(y - m / 2) + bob;
  ctx.fillStyle = "#5d4300";
  ctx.fillRect(mx - 1, my - 1, m + 2, m + 2);
  ctx.fillStyle = PALETTE.accent;
  ctx.fillRect(mx, my, m, m);
  ctx.fillStyle = "#fff3b0";
  ctx.fillRect(mx + 1, my + 1, 2, 2);
}

/**
 * Bala como bola de píxeles naranja con núcleo blanco. Se distingue de la
 * moneda amarilla de las Cajas.
 */
export function drawBullet(ctx, x, y, r) {
  const d = Math.max(2, Math.round(r));
  x = Math.round(x);
  y = Math.round(y);
  // Halo en cruz: da forma redondeada sin perder el aspecto de píxel.
  ctx.fillStyle = "rgba(255,87,34,0.4)";
  ctx.fillRect(x - d - 2, y - d + 1, 2 * d + 4, 2 * d - 2);
  ctx.fillRect(x - d + 1, y - d - 2, 2 * d - 2, 2 * d + 4);
  ctx.fillStyle = "#ff7043";
  ctx.fillRect(x - d, y - d + 1, 2 * d, 2 * d - 2);
  ctx.fillRect(x - d + 1, y - d, 2 * d - 2, 2 * d);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x - Math.ceil(d / 2), y - Math.ceil(d / 2), d, d);
}

/** Texto con contorno negro, legible sobre cualquier fondo. */
export function drawOutlinedText(ctx, text, x, y, { px = 11, color = PALETTE.text, align = "center", baseline = "top" } = {}) {
  ctx.font = `bold ${px}px ${RETRO_FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(2, px / 4);
  ctx.strokeStyle = "#000";
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

/** Vida en bloques (hasta 10 de vida máxima) o en barra continua. */
function drawHealth(ctx, left, top, width, hp, maxHp) {
  const frac = Math.max(0, Math.min(1, hp / maxHp));
  const col = hpColor(frac);
  const h = 5;
  ctx.fillStyle = "#000";
  ctx.fillRect(left - 1, top - 1, width + 2, h + 2);
  if (maxHp <= 10) {
    const gap = 2;
    const pip = (width - gap * (maxHp - 1)) / maxHp;
    for (let i = 0; i < maxHp; i++) {
      ctx.fillStyle = i < hp ? col : "#3a1010";
      ctx.fillRect(left + i * (pip + gap), top, pip, h);
    }
  } else {
    ctx.fillStyle = "#3a1010";
    ctx.fillRect(left, top, width, h);
    ctx.fillStyle = col;
    ctx.fillRect(left, top, frac * width, h);
  }
}

/**
 * Tanque visto desde arriba: orugas, casco del color de su categoría y una
 * torreta con cañón que gira hacia el ángulo de apuntado.
 * @param {object} t { x, y, angle, hp, inv }
 * @param {object} o { size, barrelLength, color, maxHealth, label, labelColor, labelPx, frame }
 */
export function drawTank(ctx, t, o) {
  const s = o.size;
  const h = s / 2;
  const x = Math.round(t.x);
  const y = Math.round(t.y);
  const L = x - h;
  const T = y - h;
  const tread = Math.max(4, Math.round(s * 0.22));

  // Sombra.
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(L + 4, T + 4, s, s);

  // Orugas; las marcas se desplazan con la posición, así parecen rodar.
  ctx.fillStyle = "#1e1e1e";
  ctx.fillRect(L, T, tread, s);
  ctx.fillRect(L + s - tread, T, tread, s);
  const step = 6;
  const off = (((x + y) % step) + step) % step;
  ctx.fillStyle = "#4a4a4a";
  for (let yy = T + off; yy < T + s - 1; yy += step) {
    ctx.fillRect(L + 1, yy, tread - 2, 2);
    ctx.fillRect(L + s - tread + 1, yy, tread - 2, 2);
  }

  // Casco.
  const hl = L + tread;
  const hw = s - 2 * tread;
  ctx.fillStyle = o.color;
  ctx.fillRect(hl, T + 2, hw, s - 4);
  ctx.fillStyle = shade(o.color, 45);
  ctx.fillRect(hl, T + 2, hw, 2);
  ctx.fillStyle = shade(o.color, -50);
  ctx.fillRect(hl, T + s - 4, hw, 2);
  ctx.strokeStyle = PALETTE.outline;
  ctx.lineWidth = 2;
  ctx.strokeRect(L + 1, T + 1, s - 2, s - 2);

  // Cañón y torreta (giran juntos).
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(t.angle);
  const bw = Math.max(3, Math.round(s * 0.16));
  const bl = o.barrelLength;
  ctx.fillStyle = PALETTE.outline;
  ctx.fillRect(0, -bw / 2 - 1, bl + 1, bw + 2);
  ctx.fillStyle = "#5b5b5b";
  ctx.fillRect(0, -bw / 2, bl, bw);
  ctx.fillStyle = "#8a8a8a";
  ctx.fillRect(0, -bw / 2, bl, 1);
  ctx.fillStyle = "#2a2a2a";
  ctx.fillRect(bl - 4, -bw / 2 - 1, 4, bw + 2);
  const tr = Math.round(s * 0.24);
  ctx.fillStyle = PALETTE.outline;
  ctx.fillRect(-tr - 1, -tr - 1, 2 * tr + 2, 2 * tr + 2);
  ctx.fillStyle = shade(o.color, -22);
  ctx.fillRect(-tr, -tr, 2 * tr, 2 * tr);
  ctx.fillStyle = shade(o.color, 30);
  ctx.fillRect(-tr, -tr, 2 * tr, 2);
  ctx.fillStyle = shade(o.color, -65);
  ctx.fillRect(-3, -3, 6, 6);
  ctx.restore();

  // Invulnerable: anillo blanco parpadeante con transparencia 0,6.
  if (t.inv && Math.floor((o.frame ?? 0) / 8) % 2 === 0) {
    ctx.save();
    ctx.globalAlpha = 0.6;
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.arc(x, y, h + 7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  drawHealth(ctx, L, T - 11, s, t.hp, o.maxHealth);
  if (o.label) {
    drawOutlinedText(ctx, o.label, x, T + s + 5, { px: o.labelPx ?? 11, color: o.labelColor ?? PALETTE.text });
  }
}

// --- pantalla (píxeles CSS) ---

/** Líneas de barrido y viñeta, como un monitor CRT. */
export function drawCrtOverlay(ctx, w, h) {
  ctx.fillStyle = "rgba(0,0,0,0.12)";
  for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0,0.45)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

/** Panel con borde doble estilo consola. */
export function drawPanel(ctx, x, y, w, h) {
  ctx.fillStyle = "rgba(8,10,20,0.85)";
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "#000";
  ctx.fillRect(x + 4, y + h, w, 4);
  ctx.fillRect(x + w, y + 4, 4, h);
  ctx.strokeStyle = PALETTE.text;
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 4.5, y + 4.5, w - 9, h - 9);
}

/** Tecla dibujada con relieve. Devuelve su ancho. */
export function drawKeycap(ctx, x, y, label, px = 14) {
  ctx.font = `bold ${px}px ${RETRO_FONT}`;
  const w = Math.max(24, Math.ceil(ctx.measureText(label).width) + 12);
  const h = px + 10;
  ctx.fillStyle = "#000";
  ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = "#8a8a8a";
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "#e0e0e0";
  ctx.fillRect(x, y, w, h - 4);
  ctx.fillStyle = "#111";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x + w / 2, y + (h - 4) / 2 + 1);
  return w;
}
