// Cargador y validador de la Configuración. Lee config.json (o la ruta de la
// variable de entorno TANK_CONFIG), valida cada parámetro contra el esquema y
// aplica las validaciones cruzadas del diseño. Devuelve un GameConfig plano y
// congelado en profundidad.

import { readFileSync } from "node:fs";
import { CONFIG_SCHEMA } from "./config-schema.js";

/**
 * Lee el valor efectivo de un parámetro desde el objeto bruto de config.json.
 * Valor efectivo = `value` si existe; si no, `default` del archivo; si la
 * entrada falta por completo, el respaldo del esquema (Req. 1.8).
 * @returns {{ present: boolean, value: * }}
 */
function readRaw(raw, path, spec) {
  const parts = path.split(".");
  let node = raw;
  for (const part of parts) {
    if (node === undefined || node === null || typeof node !== "object") {
      return { present: false, value: spec.default };
    }
    node = node[part];
  }
  if (node === undefined || node === null || typeof node !== "object") {
    // La entrada falta: usar el respaldo del esquema.
    return { present: false, value: spec.default };
  }
  if ("value" in node) return { present: true, value: node.value };
  if ("default" in node) return { present: true, value: node.default };
  return { present: false, value: spec.default };
}

/** Asigna value en un objeto anidado según la ruta con puntos. */
function setPath(target, path, value) {
  const parts = path.split(".");
  let node = target;
  for (let i = 0; i < parts.length - 1; i++) {
    node[parts[i]] ??= {};
    node = node[parts[i]];
  }
  node[parts[parts.length - 1]] = value;
}

/** Valida un Obstáculo individual. */
function isValidObstacle(o) {
  return (
    o !== null &&
    typeof o === "object" &&
    Number.isFinite(o.x) &&
    Number.isFinite(o.y) &&
    Number.isFinite(o.w) &&
    Number.isFinite(o.h) &&
    o.w > 0 &&
    o.h > 0
  );
}

/** Congela en profundidad un objeto plano. */
function deepFreeze(obj) {
  for (const key of Object.keys(obj)) {
    const v = obj[key];
    if (v !== null && typeof v === "object") deepFreeze(v);
  }
  return Object.freeze(obj);
}

/**
 * Valida la Configuración bruta contra el esquema y las reglas cruzadas.
 * @param {object} raw objeto JSON ya parseado
 * @returns {{ ok: true, config: object } | { ok: false, errors: string[] }}
 */
export function validateConfig(raw) {
  const errors = [];
  const config = {};

  // 1) Validación por parámetro según el esquema.
  for (const [path, spec] of Object.entries(CONFIG_SCHEMA)) {
    const { value } = readRaw(raw, path, spec);

    if (spec.type === "number") {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        errors.push(`${path}: se esperaba un número finito, se recibió ${JSON.stringify(value)}`);
        continue;
      }
      if (spec.integer && !Number.isInteger(value)) {
        errors.push(`${path}: se esperaba un entero, se recibió ${value}`);
        continue;
      }
      if (value < spec.min || value > spec.max) {
        errors.push(`${path}: valor ${value} fuera de rango [${spec.min}, ${spec.max}]`);
        continue;
      }
      setPath(config, path, value);
    } else if (spec.type === "boolean") {
      if (typeof value !== "boolean") {
        errors.push(`${path}: se esperaba true o false, se recibió ${JSON.stringify(value)}`);
        continue;
      }
      setPath(config, path, value);
    } else if (spec.type === "string") {
      if (typeof value !== "string") {
        errors.push(`${path}: se esperaba texto, se recibió ${JSON.stringify(value)}`);
        continue;
      }
      setPath(config, path, value);
    } else if (spec.type === "obstacles") {
      if (!Array.isArray(value) || !value.every(isValidObstacle)) {
        errors.push(`${path}: se esperaba una lista de Obstáculos { x, y, w, h }`);
        continue;
      }
      setPath(config, path, value.map((o) => ({ x: o.x, y: o.y, w: o.w, h: o.h })));
    }
  }

  // Si falló el parseo básico de los parámetros que las reglas cruzadas
  // necesitan, no se pueden comprobar; se devuelve lo que hay.
  if (errors.length > 0) {
    // Aun así intentamos las cruzadas sobre los valores presentes y válidos.
  }

  // 2) Validaciones cruzadas (solo si los operandos son válidos).
  const get = (path) => {
    const parts = path.split(".");
    let node = config;
    for (const p of parts) {
      if (node === undefined) return undefined;
      node = node[p];
    }
    return node;
  };

  // Obstáculos dentro de la Arena.
  if (Number.isFinite(get("arena.width")) && Number.isFinite(get("arena.height")) && Array.isArray(get("arena.obstacles"))) {
    const W = get("arena.width");
    const H = get("arena.height");
    for (const o of get("arena.obstacles")) {
      if (o.x < 0 || o.y < 0 || o.x + o.w > W || o.y + o.h > H) {
        errors.push(`arena.obstacles: el Obstáculo ${JSON.stringify(o)} sale de la Arena ${W}x${H}`);
      }
    }
  }

  // maxMessagesPerSecond >= 2 * tick.rate.
  if (Number.isFinite(get("network.maxMessagesPerSecond")) && Number.isFinite(get("tick.rate"))) {
    const mps = get("network.maxMessagesPerSecond");
    const rate = get("tick.rate");
    if (mps < 2 * rate) {
      errors.push(`network.maxMessagesPerSecond (${mps}) debe ser mayor o igual que 2 × tick.rate (${rate}), es decir ${2 * rate}`);
    }
  }

  // heartbeatTimeoutMs > heartbeatIntervalMs.
  if (Number.isFinite(get("network.heartbeatIntervalMs")) && Number.isFinite(get("network.heartbeatTimeoutMs"))) {
    if (get("network.heartbeatTimeoutMs") <= get("network.heartbeatIntervalMs")) {
      errors.push(
        `network.heartbeatTimeoutMs (${get("network.heartbeatTimeoutMs")}) debe ser mayor que network.heartbeatIntervalMs (${get("network.heartbeatIntervalMs")})`
      );
    }
  }

  // maxFrameBytes >= maxMessageBytes.
  if (Number.isFinite(get("network.maxFrameBytes")) && Number.isFinite(get("network.maxMessageBytes"))) {
    if (get("network.maxFrameBytes") < get("network.maxMessageBytes")) {
      errors.push(
        `network.maxFrameBytes (${get("network.maxFrameBytes")}) debe ser mayor o igual que network.maxMessageBytes (${get("network.maxMessageBytes")})`
      );
    }
  }

  // interestWidth >= view.width e interestHeight >= view.height.
  if (Number.isFinite(get("players.interestWidth")) && Number.isFinite(get("view.width"))) {
    if (get("players.interestWidth") < get("view.width")) {
      errors.push(`ancho: Área_Interés ${get("players.interestWidth")} menor que Área_Visible ${get("view.width")}`);
    }
  }
  if (Number.isFinite(get("players.interestHeight")) && Number.isFinite(get("view.height"))) {
    if (get("players.interestHeight") < get("view.height")) {
      errors.push(`alto: Área_Interés ${get("players.interestHeight")} menor que Área_Visible ${get("view.height")}`);
    }
  }

  // nickMin <= nickMax.
  if (Number.isFinite(get("players.nickMin")) && Number.isFinite(get("players.nickMax"))) {
    if (get("players.nickMin") > get("players.nickMax")) {
      errors.push(`players.nickMin (${get("players.nickMin")}) debe ser menor o igual que players.nickMax (${get("players.nickMax")})`);
    }
  }

  // nickMax >= longitud("Bot " + bots.count).
  if (Number.isFinite(get("players.nickMax")) && Number.isFinite(get("bots.count"))) {
    const needed = `Bot ${get("bots.count")}`.length;
    if (get("players.nickMax") < needed) {
      errors.push(`players.nickMax (${get("players.nickMax")}) debe ser al menos ${needed} para los Apodos de Bot`);
    }
  }

  // speedMultiplierMin <= slow.factor <= speedMultiplierMax.
  if (
    Number.isFinite(get("effects.speedMultiplierMin")) &&
    Number.isFinite(get("effects.speedMultiplierMax")) &&
    Number.isFinite(get("effects.slow.factor"))
  ) {
    const lo = get("effects.speedMultiplierMin");
    const hi = get("effects.speedMultiplierMax");
    const f = get("effects.slow.factor");
    if (lo > hi) {
      errors.push(`effects.speedMultiplierMin (${lo}) debe ser menor o igual que effects.speedMultiplierMax (${hi})`);
    }
    if (f < lo || f > hi) {
      errors.push(`effects.slow.factor (${f}) debe estar dentro de [${lo}, ${hi}]`);
    }
  }

  // barrelLength > size/2 + radius.
  if (Number.isFinite(get("tank.barrelLength")) && Number.isFinite(get("tank.size")) && Number.isFinite(get("bullet.radius"))) {
    const needed = get("tank.size") / 2 + get("bullet.radius");
    if (get("tank.barrelLength") <= needed) {
      errors.push(`tank.barrelLength (${get("tank.barrelLength")}) debe ser mayor que tank.size/2 + bullet.radius (${needed})`);
    }
  }

  // Existe al menos una celda libre para un Tanque.
  if (
    Number.isFinite(get("arena.width")) &&
    Number.isFinite(get("arena.height")) &&
    Number.isFinite(get("tank.size")) &&
    Array.isArray(get("arena.obstacles"))
  ) {
    if (!hasFreeCell(get("arena.width"), get("arena.height"), get("tank.size"), get("arena.obstacles"))) {
      errors.push("arena: no existe ninguna celda libre de Obstáculos para colocar un Tanque");
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, config: deepFreeze(config) };
}

/** Comprueba si hay al menos una posición libre para un Tanque de lado `size`. */
function hasFreeCell(W, H, size, obstacles) {
  const half = size / 2;
  if (W < size || H < size) return false;
  const step = size;
  for (let cx = half; cx <= W - half + 1e-9; cx += step) {
    for (let cy = half; cy <= H - half + 1e-9; cy += step) {
      const left = cx - half, right = cx + half, top = cy - half, bottom = cy + half;
      let blocked = false;
      for (const o of obstacles) {
        if (left < o.x + o.w && right > o.x && top < o.y + o.h && bottom > o.y) {
          blocked = true;
          break;
        }
      }
      if (!blocked) return true;
    }
  }
  return false;
}

/**
 * Carga la Configuración desde config.json o la ruta de TANK_CONFIG.
 * @returns {{ ok: true, config: object } | { ok: false, errors: string[] }}
 */
export function loadConfig() {
  const path = process.env.TANK_CONFIG ?? "config.json";
  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch (err) {
    return { ok: false, errors: [`No se pudo cargar config.json: ${err.message}`] };
  }
  let raw;
  try {
    raw = JSON.parse(text);
  } catch (err) {
    return { ok: false, errors: [`No se pudo cargar config.json: ${err.message}`] };
  }
  return validateConfig(raw);
}
