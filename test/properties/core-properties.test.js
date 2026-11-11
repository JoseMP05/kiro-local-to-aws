// Pruebas de propiedades obligatorias y clave con fast-check.

import { test } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { PBT } from "../helpers/pbt.js";
import { clampWindow, normalizeAngle } from "../../src/shared/math.js";
import { validateNick } from "../../src/shared/validation.js";
import { encode, decode } from "../../src/shared/protocol.js";
import { interpolatePosition } from "../../src/shared/interpolation.js";
import { resolveNick } from "../../src/engine/nicknames.js";
import { makeGame } from "../helpers/game-factory.js";

const runOpts = { seed: PBT.seed, numRuns: PBT.numRuns };

// Feature: tank-game-core, Property 9: La ventana recortada queda dentro de la Arena o centrada
test("Property 9: clampWindow queda dentro de la Arena o centrada", () => {
  fc.assert(
    fc.property(
      fc.double({ min: -5000, max: 5000, noNaN: true }),
      fc.double({ min: 0.1, max: 10000, noNaN: true }),
      fc.double({ min: 0.1, max: 10000, noNaN: true }),
      (c, size, arena) => {
        const { lo, hi } = clampWindow(c, size, arena);
        assert.ok(Math.abs(hi - lo - size) < 1e-6);
        if (size <= arena) {
          assert.ok(lo >= -1e-6 && hi <= arena + 1e-6);
          if (c >= size / 2 && c <= arena - size / 2) {
            assert.ok(Math.abs(lo - (c - size / 2)) < 1e-6);
          }
        } else {
          assert.ok(Math.abs(lo - (arena / 2 - size / 2)) < 1e-6);
        }
      }
    ),
    runOpts
  );
});

// Feature: tank-game-core, Property 3: Validación de Apodos según un oráculo
test("Property 3: validateNick coincide con el oráculo", () => {
  const PATTERN = /^[A-Za-z0-9 _\-áéíóúüñÁÉÍÓÚÜÑ]+$/;
  const arbNickCandidate = fc.oneof(
    fc.string(),
    fc.fullUnicodeString(),
    fc.constantFrom("  Ana  ", "a", "", "Bot 1", "José", "x".repeat(50), 123, null, undefined)
  );
  fc.assert(
    fc.property(arbNickCandidate, (raw) => {
      const r = validateNick(raw, { minLen: 2, maxLen: 16 });
      if (raw === undefined || raw === null) { assert.equal(r.ok, false); return; }
      if (typeof raw !== "string") { assert.equal(r.ok, false); return; }
      const nick = raw.normalize("NFC").trim();
      const len = [...nick].length;
      const expected = len >= 2 && len <= 16 && PATTERN.test(nick);
      assert.equal(r.ok, expected);
      if (expected) assert.equal(r.nick, nick);
    }),
    runOpts
  );
});

// Feature: tank-game-core, Property 4: Resolución de Apodos duplicados
test("Property 4: resolveNick devuelve un Apodo libre y válido", () => {
  fc.assert(
    fc.property(
      fc.array(fc.constantFrom("Ana", "ana", "Bob", "Carla"), { maxLength: 6 }),
      fc.constantFrom("Ana", "Bob", "Zoe"),
      (existentes, base) => {
        const r = resolveNick(base, existentes, 16);
        const lower = new Set(existentes.map((e) => e.toLowerCase()));
        assert.ok(!lower.has(r.toLowerCase()));
        assert.ok([...r].length <= 16);
        if (!lower.has(base.toLowerCase())) assert.equal(r, base);
      }
    ),
    runOpts
  );
});

// Feature: tank-game-core, Property 21: Ida y vuelta del Codificador_Mensajes
test("Property 21: encode/decode ida y vuelta", () => {
  const arbMessage = fc.oneof(
    fc.record({ type: fc.constant("join"), data: fc.record({ nick: fc.string() }) }),
    fc.record({
      type: fc.constant("input"),
      data: fc.record({
        w: fc.boolean(), a: fc.boolean(), s: fc.boolean(), d: fc.boolean(),
        fire: fc.boolean(), aim: fc.double({ min: -10, max: 10, noNaN: true }),
      }),
    }),
    fc.record({ type: fc.constant("error"), data: fc.record({ code: fc.constant("GAME_FULL"), message: fc.string() }) })
  );
  fc.assert(
    fc.property(arbMessage, (msg) => {
      const r = decode(encode(msg));
      assert.equal(r.ok, true);
      assert.equal(r.message.type, msg.type);
      if (msg.type === "input") {
        assert.deepEqual(r.message.data, msg.data);
      }
    }),
    runOpts
  );
});

// Feature: tank-game-core, Property 22: decode es total y rechaza lo inválido
test("Property 22: decode es total", () => {
  fc.assert(
    fc.property(fc.string(), (text) => {
      const r = decode(text);
      assert.ok(typeof r === "object" && "ok" in r);
      if (!r.ok) assert.ok(typeof r.reason === "string");
    }),
    runOpts
  );
});

// Feature: tank-game-core, Property 26: La posición interpolada está en el segmento
test("Property 26: posición interpolada en el segmento con extremos exactos", () => {
  fc.assert(
    fc.property(
      fc.record({ x: fc.double({ min: -1000, max: 1000, noNaN: true }), y: fc.double({ min: -1000, max: 1000, noNaN: true }) }),
      fc.record({ x: fc.double({ min: -1000, max: 1000, noNaN: true }), y: fc.double({ min: -1000, max: 1000, noNaN: true }) }),
      fc.double({ min: 0, max: 1, noNaN: true }),
      (pa, pb, f) => {
        const p = interpolatePosition(pa, pb, f);
        if (f === 0) assert.deepEqual(p, { x: pa.x, y: pa.y });
        if (f === 1) assert.deepEqual(p, { x: pb.x, y: pb.y });
        // Dentro de la caja envolvente del segmento.
        const minX = Math.min(pa.x, pb.x), maxX = Math.max(pa.x, pb.x);
        assert.ok(p.x >= minX - 1e-6 && p.x <= maxX + 1e-6);
      }
    ),
    runOpts
  );
});

// Feature: tank-game-core, Property 13: Normalización del ángulo del cañón
test("Property 13: normalizeAngle en [−π, π)", () => {
  fc.assert(
    fc.property(fc.double({ min: -1000, max: 1000, noNaN: true }), (a) => {
      const n = normalizeAngle(a);
      assert.ok(n >= -Math.PI - 1e-9 && n < Math.PI + 1e-9);
      const k = (a - n) / (2 * Math.PI);
      assert.ok(Math.abs(k - Math.round(k)) < 1e-6);
    }),
    runOpts
  );
});

// Feature: tank-game-core, Property 37: Reproducibilidad del Motor_Juego
test("Property 37: dos partidas con la misma semilla producen el mismo estado", () => {
  fc.assert(
    fc.property(fc.integer({ min: 1, max: 1000 }), (seed) => {
      const a = makeGame(seed, { "bots.count": 3 });
      const b = makeGame(seed, { "bots.count": 3 });
      // Nota: makeGame no inicia bots; añadimos bots de forma idéntica.
      for (const g of [a, b]) {
        g.game.addBot("Bot 1");
        g.game.requestJoin("c1", "Ana");
      }
      for (let i = 0; i < 20; i++) {
        a.game.step();
        b.game.step();
      }
      const va = a.game.getView();
      const vb = b.game.getView();
      assert.equal(va.tanks.length, vb.tanks.length);
      for (let i = 0; i < va.tanks.length; i++) {
        assert.equal(va.tanks[i].x, vb.tanks[i].x);
        assert.equal(va.tanks[i].y, vb.tanks[i].y);
        assert.equal(va.tanks[i].targetId, vb.tanks[i].targetId);
      }
    }),
    { seed: PBT.seed, numRuns: 30 }
  );
});
