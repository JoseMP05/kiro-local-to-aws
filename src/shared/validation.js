// Validador: comprueba Apodos e Inputs recibidos de los clientes.
// Puro y sin dependencias de red. Los mensajes de error van en español y los
// códigos en mayúsculas para que el cliente pueda mapearlos.

// Letras permitidas: A-Z, a-z, dígitos, espacio, guion, guion bajo y las
// vocales acentuadas y la eñe en ambas cajas.
const NICK_PATTERN = /^[A-Za-z0-9 _\-áéíóúüñÁÉÍÓÚÜÑ]+$/;

/**
 * Valida un Apodo candidato.
 * @param {unknown} raw valor recibido del cliente
 * @param {{ minLen: number, maxLen: number }} opts longitudes de la Configuración
 * @returns {{ ok: true, nick: string } | { ok: false, code: string, message: string }}
 */
export function validateNick(raw, { minLen, maxLen }) {
  if (raw === undefined || raw === null) {
    return { ok: false, code: "NICK_MISSING", message: "Falta el Apodo." };
  }
  if (typeof raw !== "string") {
    return {
      ok: false,
      code: "NICK_NOT_STRING",
      message: "El Apodo debe ser texto.",
    };
  }
  // Normalizar a NFC para que "José" en NFD y en NFC se traten igual, y
  // recortar espacios iniciales y finales.
  const nick = raw.normalize("NFC").trim();
  // Longitud en puntos de código (no en unidades UTF-16).
  const length = [...nick].length;
  if (length < minLen || length > maxLen) {
    return {
      ok: false,
      code: "NICK_LENGTH",
      message: `El Apodo debe tener entre ${minLen} y ${maxLen} caracteres.`,
    };
  }
  if (!NICK_PATTERN.test(nick)) {
    return {
      ok: false,
      code: "NICK_CHARS",
      message: "El Apodo contiene caracteres no permitidos.",
    };
  }
  return { ok: true, nick };
}

/**
 * Valida un Input y devuelve una copia saneada con solo los 6 campos conocidos.
 * @param {unknown} value valor recibido del cliente
 * @returns {{ ok: true, input: { w: boolean, a: boolean, s: boolean, d: boolean, fire: boolean, aim: number } } | { ok: false, code: string, message: string }}
 */
export function validateInput(value) {
  if (typeof value !== "object" || value === null) {
    return {
      ok: false,
      code: "INPUT_NOT_OBJECT",
      message: "El Input debe ser un objeto.",
    };
  }
  const v = /** @type {Record<string, unknown>} */ (value);
  for (const key of ["w", "a", "s", "d", "fire"]) {
    if (typeof v[key] !== "boolean") {
      return {
        ok: false,
        code: "INPUT_BAD_FIELD",
        message: `El campo "${key}" del Input debe ser booleano.`,
      };
    }
  }
  if (typeof v.aim !== "number" || !Number.isFinite(v.aim)) {
    return {
      ok: false,
      code: "INPUT_BAD_FIELD",
      message: 'El campo "aim" del Input debe ser un número finito.',
    };
  }
  return {
    ok: true,
    input: {
      w: v.w,
      a: v.a,
      s: v.s,
      d: v.d,
      fire: v.fire,
      aim: v.aim,
    },
  };
}
