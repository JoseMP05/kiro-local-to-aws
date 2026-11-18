// Sprites de estilo retro dibujados por código (sin imágenes externas).
// Los usan el Cliente_Juego y la Vista_Espectador para compartir el mismo
// estilo. No tocan el DOM al importarse: los lienzos auxiliares se crean la
// primera vez que se dibuja.

export const RETRO_FONT = '"Courier New", Courier, monospace';

export const PALETTE = {
  franja: "#202020",
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

// Baldosa de hormigón de 16 × 16 píxeles con poros; se escala ×4.
function buildConcreteTile() {
  const c = makeCanvas(16, 16);
  const g = c.getContext("2d");
  g.fillStyle = "#7d7b72";
  g.fillRect(0, 0, 16, 16);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const h = hash(x + 31, y + 7);
      if (h < 10) {
        g.fillStyle = "#6a685f";
        g.fillRect(x, y, 1, 1);
      } else if (h < 15) {
        g.fillStyle = "#8f8d84";
        g.fillRect(x, y, 1, 1);
      }
    }
  }
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
    const brick = ctx.createPattern(buildBrickTile(), "repeat");
    const concrete = ctx.createPattern(buildConcreteTile(), "repeat");
    scalePattern(brick, 2);
    scalePattern(concrete, 4);
    p = { brick, concrete };
    patternCache.set(ctx, p);
  }
  return p;
}

// --- mundo (coordenadas de Arena) ---

// --- suelo generado ---
// El suelo se genera una vez por tamaño de Arena en un lienzo a 1/4 de
// resolución (un píxel = 4 × 4 unidades de Arena) y se dibuja ampliado sin
// suavizado. Es determinista: todos los clientes ven el mismo mapa sin que el
// servidor envíe nada más.

const GROUND_CELL = 4;
const groundCache = new Map();

// Colores [r, g, b] de las zonas del suelo.
const G = {
  grass: [46, 59, 46], grassDark: [39, 51, 38], grassLight: [54, 70, 52], grassGrid: [37, 48, 35],
  moss: [34, 46, 30], mossDark: [29, 40, 26],
  dirt: [74, 64, 46], dirtDark: [63, 54, 39], dirtLight: [86, 75, 54],
  road: [96, 82, 58], roadDark: [80, 68, 48], roadEdge: [62, 53, 38], roadLight: [110, 95, 68],
  crater: [28, 24, 19], craterMid: [40, 35, 27], craterRim: [92, 82, 62],
  rock: [112, 112, 104], rockDark: [70, 70, 66],
  bush: [30, 74, 36], bushLight: [52, 104, 54], bushDark: [20, 50, 24],
  flowerA: [230, 214, 90], flowerB: [220, 220, 230],
  track: [33, 42, 31],
};

/** PRNG determinista (mulberry32) para las decoraciones. */
function prng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Ruido de valor suave en [0, 1).
function lattice(ix, iy) {
  let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function valueNoise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = lattice(ix, iy), b = lattice(ix + 1, iy);
  const c = lattice(ix, iy + 1), d = lattice(ix + 1, iy + 1);
  return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
}
function fbm(x, y) {
  return valueNoise(x, y) * 0.65 + valueNoise(x * 2.3 + 17, y * 2.3 + 5) * 0.35;
}

/**
 * Tipo de suelo en un píxel del lienzo de suelo (gx, gy) de un lienzo gw × gh.
 * Dos caminos de tierra cruzan la Arena por el centro.
 */
function groundZone(gx, gy, gw, gh) {
  const roadHalf = 14;
  const dy = Math.abs(gy - (gh / 2 + Math.sin(gx / 41) * 4));
  const dx = Math.abs(gx - (gw / 2 + Math.sin(gy / 37) * 4));
  const d = Math.min(dx, dy);
  if (d < roadHalf) return { zone: "road", d };
  if (d < roadHalf + 2) return { zone: "roadEdge", d };
  const n = fbm(gx / 46, gy / 46);
  if (n > 0.66) return { zone: "dirt", d };
  if (n < 0.3) return { zone: "moss", d };
  return { zone: "grass", d };
}

function buildGroundCanvas(w, h) {
  const gw = Math.ceil(w / GROUND_CELL);
  const gh = Math.ceil(h / GROUND_CELL);
  const c = makeCanvas(gw, gh);
  const g = c.getContext("2d");
  const img = g.createImageData(gw, gh);
  const data = img.data;
  const zones = new Array(gw * gh);

  const put = (x, y, col) => {
    if (x < 0 || y < 0 || x >= gw || y >= gh) return;
    const i = (y * gw + x) * 4;
    data[i] = col[0]; data[i + 1] = col[1]; data[i + 2] = col[2]; data[i + 3] = 255;
  };

  // 1) Zonas base con motas.
  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      const { zone, d } = groundZone(x, y, gw, gh);
      zones[y * gw + x] = zone;
      const m = hash(x, y);
      let col;
      if (zone === "road") {
        // Roderas a ambos lados del centro del camino.
        const rut = Math.abs(Math.round(d) - 6) <= 0;
        col = rut ? G.roadDark : m < 10 ? G.roadDark : m < 16 ? G.roadLight : G.road;
      } else if (zone === "roadEdge") {
        col = G.roadEdge;
      } else if (zone === "dirt") {
        col = m < 12 ? G.dirtDark : m < 18 ? G.dirtLight : G.dirt;
      } else if (zone === "moss") {
        col = m < 14 ? G.mossDark : G.moss;
      } else {
        const grid = x % 16 === 0 || y % 16 === 0;
        col = grid ? G.grassGrid : m < 9 ? G.grassDark : m < 13 ? G.grassLight : G.grass;
      }
      put(x, y, col);
    }
  }

  const rnd = prng(Math.imul(gw, 7919) ^ gh);
  const zoneAt = (x, y) => (x < 0 || y < 0 || x >= gw || y >= gh ? null : zones[y * gw + x]);
  const area = gw * gh;

  // 2) Marcas de orugas: pares de líneas punteadas que serpentean por la hierba.
  const tracks = Math.round(area / 50000);
  for (let i = 0; i < tracks; i++) {
    let x = rnd() * gw, y = rnd() * gh, a = rnd() * Math.PI * 2;
    const len = 60 + rnd() * 140;
    for (let s = 0; s < len; s++) {
      a += (rnd() - 0.5) * 0.12;
      x += Math.cos(a); y += Math.sin(a);
      if (s % 3 === 2) continue;
      const nx = -Math.sin(a) * 4, ny = Math.cos(a) * 4;
      for (const k of [1, -1]) {
        const px = Math.round(x + nx * k), py = Math.round(y + ny * k);
        const z = zoneAt(px, py);
        if (z === "grass" || z === "moss") put(px, py, G.track);
      }
    }
  }

  // 3) Cráteres: centro oscuro, anillo intermedio y borde claro.
  const craters = Math.round(area / 24000);
  for (let i = 0; i < craters; i++) {
    const cx = Math.round(rnd() * gw), cy = Math.round(rnd() * gh);
    const r = 4 + Math.floor(rnd() * 7);
    for (let y = -r - 1; y <= r + 1; y++) {
      for (let x = -r - 1; x <= r + 1; x++) {
        const dd = Math.hypot(x, y);
        if (dd > r + 1) continue;
        let col;
        if (dd > r) col = G.craterRim;
        else if (dd > r * 0.6) col = hash(cx + x, cy + y) < 30 ? G.crater : G.craterMid;
        else col = G.crater;
        put(cx + x, cy + y, col);
      }
    }
  }

  // 4) Rocas, arbustos y flores sueltos (los arbustos y flores no van en caminos).
  const rocks = Math.round(area / 5000);
  for (let i = 0; i < rocks; i++) {
    const x = Math.floor(rnd() * gw), y = Math.floor(rnd() * gh);
    const big = rnd() < 0.3;
    put(x, y, G.rock); put(x + 1, y, G.rock); put(x, y + 1, G.rockDark); put(x + 1, y + 1, G.rockDark);
    if (big) { put(x + 2, y, G.rock); put(x + 2, y + 1, G.rockDark); put(x + 1, y - 1, G.rock); }
  }
  const bushes = Math.round(area / 6000);
  for (let i = 0; i < bushes; i++) {
    const x = Math.floor(rnd() * gw), y = Math.floor(rnd() * gh);
    const z = zoneAt(x, y);
    if (z !== "grass" && z !== "moss") continue;
    for (let yy = -1; yy <= 2; yy++) {
      for (let xx = -1; xx <= 2; xx++) {
        if ((xx === -1 || xx === 2) && (yy === -1 || yy === 2)) continue;
        put(x + xx, y + yy, yy === -1 ? G.bushLight : yy === 2 ? G.bushDark : G.bush);
      }
    }
  }
  const flowers = Math.round(area / 2500);
  for (let i = 0; i < flowers; i++) {
    const x = Math.floor(rnd() * gw), y = Math.floor(rnd() * gh);
    if (zoneAt(x, y) !== "grass") continue;
    put(x, y, rnd() < 0.5 ? G.flowerA : G.flowerB);
  }

  g.putImageData(img, 0, 0);
  return c;
}

function groundCanvas(w, h) {
  const key = `${w}x${h}`;
  let c = groundCache.get(key);
  if (!c) {
    c = buildGroundCanvas(w, h);
    groundCache.set(key, c);
  }
  return c;
}

/**
 * Suelo de la Arena (zonas, caminos, cráteres y decoración) con un borde
 * oscuro. Si se pasa `rect` (zona visible en unidades de Arena), solo se copia
 * esa parte del lienzo.
 */
export function drawGround(ctx, w, h, rect = null) {
  ctx.imageSmoothingEnabled = false;
  const c = groundCanvas(w, h);
  let sx = 0, sy = 0, sw = c.width, sh = c.height;
  if (rect) {
    sx = Math.max(0, Math.floor(rect.left / GROUND_CELL) - 1);
    sy = Math.max(0, Math.floor(rect.top / GROUND_CELL) - 1);
    sw = Math.min(c.width, Math.ceil(rect.right / GROUND_CELL) + 1) - sx;
    sh = Math.min(c.height, Math.ceil(rect.bottom / GROUND_CELL) + 1) - sy;
  }
  if (sw > 0 && sh > 0) {
    ctx.drawImage(c, sx, sy, sw, sh, sx * GROUND_CELL, sy * GROUND_CELL, sw * GROUND_CELL, sh * GROUND_CELL);
  }
  ctx.fillStyle = PALETTE.arenaEdge;
  const e = 4;
  ctx.fillRect(0, 0, w, e);
  ctx.fillRect(0, h - e, w, e);
  ctx.fillRect(0, 0, e, h);
  ctx.fillRect(w - e, 0, e, h);
}

// --- obstáculos ---

/**
 * Estilo de un Obstáculo según su forma: los cuadrados son bloques de acero,
 * los rectángulos gruesos son losas de hormigón y los muros finos son de
 * ladrillo. Es solo visual; la colisión es la misma.
 * @returns {"acero"|"hormigon"|"ladrillo"}
 */
export function obstacleStyle(o) {
  if (o.w === o.h) return "acero";
  if (Math.min(o.w, o.h) > 40) return "hormigon";
  return "ladrillo";
}

/** Obstáculo con sombra, textura según su estilo y contorno. */
export function drawObstacle(ctx, o) {
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(o.x + 6, o.y + 6, o.w, o.h);
  ctx.imageSmoothingEnabled = false;
  const style = obstacleStyle(o);
  if (style === "acero") drawSteel(ctx, o);
  else if (style === "hormigon") drawConcrete(ctx, o);
  else drawBrick(ctx, o);
}

function drawBrick(ctx, o) {
  ctx.fillStyle = patterns(ctx).brick;
  ctx.fillRect(o.x, o.y, o.w, o.h);
  ctx.fillStyle = "rgba(255,255,255,0.14)";
  ctx.fillRect(o.x, o.y, o.w, 2);
  ctx.strokeStyle = "#1b120a";
  ctx.lineWidth = 2;
  ctx.strokeRect(o.x + 1, o.y + 1, o.w - 2, o.h - 2);
}

function drawSteel(ctx, o) {
  const { x, y, w, h } = o;
  ctx.fillStyle = "#56616a";
  ctx.fillRect(x, y, w, h);
  // Biselado: luz arriba e izquierda, sombra abajo y derecha.
  ctx.fillStyle = "#8c9aa4";
  ctx.fillRect(x, y, w, 4);
  ctx.fillRect(x, y, 4, h);
  ctx.fillStyle = "#333b41";
  ctx.fillRect(x, y + h - 4, w, 4);
  ctx.fillRect(x + w - 4, y, 4, h);
  // Placa interior con franjas diagonales de aviso.
  const m = Math.max(10, Math.round(w * 0.2));
  ctx.save();
  ctx.beginPath();
  ctx.rect(x + m, y + m, w - 2 * m, h - 2 * m);
  ctx.clip();
  ctx.fillStyle = "#3f474e";
  ctx.fillRect(x + m, y + m, w - 2 * m, h - 2 * m);
  ctx.fillStyle = "#c9a227";
  for (let k = -h; k < w; k += 16) {
    ctx.beginPath();
    ctx.moveTo(x + m + k, y + h - m);
    ctx.lineTo(x + m + k + 8, y + h - m);
    ctx.lineTo(x + m + k + 8 + (h - 2 * m), y + m);
    ctx.lineTo(x + m + k + (h - 2 * m), y + m);
    ctx.fill();
  }
  ctx.restore();
  // Remaches en las esquinas.
  ctx.fillStyle = "#b8c4cc";
  const r = 3, inset = 6;
  for (const [rx, ry] of [[x + inset, y + inset], [x + w - inset - r, y + inset], [x + inset, y + h - inset - r], [x + w - inset - r, y + h - inset - r]]) {
    ctx.fillRect(rx, ry, r, r);
  }
  ctx.strokeStyle = PALETTE.outline;
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
}

function drawConcrete(ctx, o) {
  const { x, y, w, h } = o;
  ctx.fillStyle = patterns(ctx).concrete;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.fillRect(x, y, w, 3);
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fillRect(x, y + h - 4, w, 4);
  // Juntas de dilatación cada 80 unidades y una grieta fija según la posición.
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  for (let jx = x + 80; jx < x + w - 10; jx += 80) ctx.fillRect(jx, y, 2, h);
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = 2;
  const seed = hash(x, y);
  ctx.beginPath();
  ctx.moveTo(x + w * (0.2 + seed / 300), y + 3);
  ctx.lineTo(x + w * (0.3 + seed / 400), y + h * 0.45);
  ctx.lineTo(x + w * (0.22 + seed / 250), y + h - 4);
  ctx.stroke();
  ctx.strokeStyle = "#1f1f1c";
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
}

const POWERUP_STYLE = {
  turbo: { body: "#f9a825", dark: "#a66a00", light: "#ffe082", icon: "#fff8e1" },
  escudo: { body: "#29b6f6", dark: "#0277bd", light: "#b3e5fc", icon: "#e1f5fe" },
  botiquin: { body: "#eceff1", dark: "#90a4ae", light: "#ffffff", icon: "#e53935" },
};

/** Caja de potenciador: brilla y muestra un icono (rayo = turbo, escudo = escudo, cruz = botiquín). */
function drawPowerupCrate(ctx, x, y, size, frame, kind) {
  const st = POWERUP_STYLE[kind];
  const s = Math.round(size);
  const bob = Math.round(Math.sin(frame / 10 + x * 0.01) * 2);
  const l = Math.round(x - s / 2);
  const t = Math.round(y - s / 2) + bob;

  // Halo pulsante.
  const pulse = 0.25 + 0.2 * Math.sin(frame / 8);
  ctx.fillStyle = `rgba(255,255,255,${pulse.toFixed(2)})`;
  ctx.fillRect(l - 4, t - 4, s + 8, s + 8);

  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.fillRect(l + 3, Math.round(y - s / 2) + 4, s, s);
  ctx.fillStyle = st.body;
  ctx.fillRect(l, t, s, s);
  ctx.fillStyle = st.light;
  ctx.fillRect(l, t, s, 2);
  ctx.fillStyle = st.dark;
  ctx.fillRect(l, t + s - 3, s, 3);
  ctx.strokeStyle = PALETTE.outline;
  ctx.lineWidth = 2;
  ctx.strokeRect(l + 1, t + 1, s - 2, s - 2);

  ctx.fillStyle = st.icon;
  const u = Math.max(2, Math.round(s / 10));
  const cx = Math.round(x);
  const cy = Math.round(y) + bob;
  if (kind === "turbo") {
    // Rayo en bloques.
    ctx.fillRect(cx, cy - 4 * u, 2 * u, 3 * u);
    ctx.fillRect(cx - u, cy - 2 * u, 3 * u, u);
    ctx.fillRect(cx - 2 * u, cy - u, 3 * u, u);
    ctx.fillRect(cx - u, cy, 2 * u, 3 * u);
    ctx.fillRect(cx - u, cy + 2 * u, u, 2 * u);
  } else if (kind === "botiquin") {
    // Cruz roja.
    ctx.fillRect(cx - u, cy - 3 * u, 2 * u, 6 * u);
    ctx.fillRect(cx - 3 * u, cy - u, 6 * u, 2 * u);
  } else {
    // Escudo en bloques.
    ctx.fillRect(cx - 3 * u, cy - 3 * u, 6 * u, 4 * u);
    ctx.fillRect(cx - 2 * u, cy + u, 4 * u, 2 * u);
    ctx.fillRect(cx - u, cy + 3 * u, 2 * u, u);
    ctx.fillStyle = st.dark;
    ctx.fillRect(cx - u, cy - 2 * u, 2 * u, 3 * u);
  }
}

/** Caja de madera con una moneda; flota un poco para llamar la atención. */
export function drawCrate(ctx, x, y, size, frame = 0, kind = "puntos") {
  if (kind in POWERUP_STYLE) return drawPowerupCrate(ctx, x, y, size, frame, kind);
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

/**
 * Etiqueta de Bot: el apodo con la marca BOT (salvo que el apodo ya diga "Bot");
 * los puntos solo se muestran si los Bots están en el Ranking (si no, el número
 * confunde con el del Líder).
 */
export function botLabel(nick, score, showScore = false) {
  // Si el apodo ya empieza por "Bot" no se repite la marca.
  const tag = /^bot\b/i.test(nick) ? "" : " BOT";
  const pts = showScore ? ` · ${score}` : "";
  return `${nick}${tag}${pts}`;
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

/**
 * Barra de vida continua: el relleno es proporcional a hp/maxHp y cambia de
 * verde a amarillo y rojo. Con vida extra por Ranking (`bonus`), el borde es dorado.
 */
function drawHealth(ctx, left, top, width, hp, maxHp, bonus = false) {
  const frac = Math.max(0, Math.min(1, hp / maxHp));
  const h = 6;
  if (bonus) {
    ctx.fillStyle = PALETTE.accent;
    ctx.fillRect(left - 2, top - 2, width + 4, h + 4);
  }
  ctx.fillStyle = "#000";
  ctx.fillRect(left - 1, top - 1, width + 2, h + 2);
  ctx.fillStyle = "#3a1010";
  ctx.fillRect(left, top, width, h);
  ctx.fillStyle = hpColor(frac);
  ctx.fillRect(left, top, Math.round(frac * width), h);
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.fillRect(left, top, Math.round(frac * width), 1);
}

/**
 * Tanque visto desde arriba: orugas, casco del color de su categoría y una
 * torreta con cañón que gira hacia el ángulo de apuntado.
 * @param {object} t { x, y, angle, hp, maxHp, inv }
 * @param {object} o { size, barrelLength, color, maxHealth, label, labelColor, labelPx, frame }
 *   maxHealth es la vida base; si t.maxHp es mayor, el Tanque tiene vida extra por Ranking.
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

  // Escudo de potenciador: anillo cian continuo (parpadea al acabarse).
  if (t.shield) {
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.strokeStyle = "#4fc3f7";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x, y, h + 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  // Turbo: estela amarilla detrás del tanque.
  if (t.effects && t.effects.some((e) => e.name === "turbo")) {
    ctx.save();
    ctx.fillStyle = "#ffca28";
    for (let i = 1; i <= 3; i++) {
      ctx.globalAlpha = 0.6 - i * 0.15;
      const back = (i * 9) + ((o.frame ?? 0) % 6);
      ctx.fillRect(Math.round(x - Math.cos(t.angle) * (h + back)) - 3, Math.round(y - Math.sin(t.angle) * (h + back)) - 3, 6, 6);
    }
    ctx.restore();
  }

  const maxHp = t.maxHp ?? o.maxHealth;
  drawHealth(ctx, L, T - 11, s, t.hp, maxHp, maxHp > o.maxHealth);
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
