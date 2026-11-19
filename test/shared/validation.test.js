import { test } from "node:test";
import assert from "node:assert/strict";
import { validateNick, validateInput } from "../../src/shared/validation.js";

test("validateNick recorta espacios", () => {
  const r = validateNick("  Ana  ", { minLen: 2, maxLen: 16 });
  assert.equal(r.ok, true);
  assert.equal(r.nick, "Ana");
});

test("validateNick acepta José en NFD", () => {
  const nfd = "Jose\u0301"; // "José" como e + acento combinable
  const r = validateNick(nfd, { minLen: 2, maxLen: 16 });
  assert.equal(r.ok, true);
  assert.equal(r.nick, "José".normalize("NFC"));
});

test("validateNick rechaza vacío, no texto, longitud y caracteres", () => {
  assert.equal(validateNick(undefined, { minLen: 2, maxLen: 16 }).code, "NICK_MISSING");
  assert.equal(validateNick(42, { minLen: 2, maxLen: 16 }).code, "NICK_NOT_STRING");
  assert.equal(validateNick("a", { minLen: 2, maxLen: 16 }).code, "NICK_LENGTH");
  assert.equal(validateNick("Ana!", { minLen: 2, maxLen: 16 }).code, "NICK_CHARS");
});

test("validateInput ignora campos extra y rechaza aim inválido", () => {
  const r = validateInput({ w: true, a: false, s: false, d: false, fire: true, aim: 1.2, hack: 9 });
  assert.equal(r.ok, true);
  assert.deepEqual(Object.keys(r.input).sort(), ["a", "aim", "d", "fire", "s", "w"]);
  assert.equal(validateInput({ w: true, a: false, s: false, d: false, fire: true, aim: "1" }).ok, false);
  assert.equal(validateInput({ w: true, a: false, s: false, d: false, fire: true, aim: NaN }).ok, false);
});
test("validateInput acepta seq entero no negativo y rechaza los demás", () => {
  const base = { w: false, a: false, s: false, d: true, fire: false, aim: 0 };
  assert.equal(validateInput({ ...base, seq: 42 }).input.seq, 42);
  assert.equal("seq" in validateInput(base).input, false);
  for (const bad of [-1, 1.5, "3", NaN, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(validateInput({ ...base, seq: bad }).ok, false, String(bad));
  }
});
test("decode conserva seq en los mensajes input", async () => {
  const { decode } = await import("../../src/shared/protocol.js");
  const r = decode(JSON.stringify({ type: "input", data: { w: false, a: false, s: false, d: true, fire: false, aim: 0, seq: 7, x: 1 } }));
  assert.equal(r.ok, true);
  assert.deepEqual(Object.keys(r.message.data).sort(), ["a", "aim", "d", "fire", "s", "seq", "w"]);
});
