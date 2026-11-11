// Codificador_Mensajes: tipos, esquemas y encode/decode. decode nunca lanza
// una excepción. Validador recursivo de esquemas sin dependencias.

export const MESSAGE_TYPES = [
  "join", "input", "welcome", "spectatorWelcome", "state", "ranking", "error",
];

/** Descriptores de esquema. */
export function arrayOf(schema) {
  return { kind: "array", of: schema };
}
export function objectOf(fields) {
  return { kind: "object", fields };
}

// Esquemas de data por tipo. Los tipos de campo: "boolean", "finiteNumber",
// "string", "integer", "any", o un descriptor array/object.
const SCHEMAS = {
  join: objectOf({ nick: "any" }), // validateNick da el error específico.
  input: objectOf({
    w: "boolean", a: "boolean", s: "boolean", d: "boolean",
    fire: "boolean", aim: "finiteNumber",
  }),
  welcome: objectOf({
    tankId: "integer",
    nick: "string",
    arena: objectOf({ width: "finiteNumber", height: "finiteNumber" }),
    view: objectOf({ w: "finiteNumber", h: "finiteNumber" }),
    obstacles: arrayOf(objectOf({ x: "finiteNumber", y: "finiteNumber", w: "finiteNumber", h: "finiteNumber" })),
    config: "any",
  }),
  spectatorWelcome: objectOf({
    arena: objectOf({ width: "finiteNumber", height: "finiteNumber" }),
    obstacles: arrayOf(objectOf({ x: "finiteNumber", y: "finiteNumber", w: "finiteNumber", h: "finiteNumber" })),
    config: "any",
  }),
  state: objectOf({
    tick: "integer",
    tanks: "any",
    bullets: "any",
    boxes: "any",
    kills: "any",
  }),
  ranking: objectOf({
    tables: "any",
    you: "any",
  }),
  error: objectOf({
    code: "string",
    message: "string",
  }),
};

/** Solo para `input`: lista de campos conocidos a conservar. */
const INPUT_FIELDS = ["w", "a", "s", "d", "fire", "aim"];

/**
 * Serializa un mensaje a texto JSON.
 * @param {{ type: string, data: object }} message
 * @returns {string}
 */
export function encode(message) {
  return JSON.stringify({ type: message.type, data: message.data });
}

/**
 * Deserializa un texto. Nunca lanza una excepción.
 * @param {string} text
 * @returns {{ ok: true, message: { type: string, data: object } } | { ok: false, reason: string }}
 */
export function decode(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, reason: "NOT_JSON" };
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, reason: "NOT_OBJECT" };
  }
  const keys = Object.keys(parsed);
  if (keys.length !== 2 || !("type" in parsed) || !("data" in parsed)) {
    return { ok: false, reason: "BAD_ENVELOPE" };
  }
  if (typeof parsed.type !== "string" || !MESSAGE_TYPES.includes(parsed.type)) {
    return { ok: false, reason: "UNKNOWN_TYPE" };
  }
  const schema = SCHEMAS[parsed.type];
  const check = validateSchema(parsed.data, schema, "");
  if (!check.ok) {
    return { ok: false, reason: `BAD_DATA:${check.field}` };
  }

  // Para input, conservar solo los campos conocidos.
  if (parsed.type === "input") {
    const data = {};
    for (const f of INPUT_FIELDS) data[f] = parsed.data[f];
    return { ok: true, message: { type: "input", data } };
  }

  return { ok: true, message: { type: parsed.type, data: parsed.data } };
}

/** Validador recursivo. Devuelve { ok: true } o { ok: false, field }. */
function validateSchema(value, schema, path) {
  if (schema === "any") return { ok: true };

  if (typeof schema === "string") {
    switch (schema) {
      case "boolean":
        return typeof value === "boolean" ? { ok: true } : fail(path);
      case "finiteNumber":
        return typeof value === "number" && Number.isFinite(value) ? { ok: true } : fail(path);
      case "integer":
        return typeof value === "number" && Number.isInteger(value) ? { ok: true } : fail(path);
      case "string":
        return typeof value === "string" ? { ok: true } : fail(path);
      default:
        return fail(path);
    }
  }

  if (schema.kind === "object") {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return fail(path);
    for (const [field, sub] of Object.entries(schema.fields)) {
      const r = validateSchema(value[field], sub, path ? `${path}.${field}` : field);
      if (!r.ok) return r;
    }
    return { ok: true };
  }

  if (schema.kind === "array") {
    if (!Array.isArray(value)) return fail(path);
    for (let i = 0; i < value.length; i++) {
      const r = validateSchema(value[i], schema.of, `${path}[${i}]`);
      if (!r.ok) return r;
    }
    return { ok: true };
  }

  return fail(path);
}

function fail(field) {
  return { ok: false, field: field || "data" };
}
