import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateConfig } from "../../src/server/config-loader.js";
import { CONFIG_SCHEMA } from "../../src/server/config-schema.js";

function baseRaw() {
  return JSON.parse(readFileSync("config.json", "utf8"));
}

test("config.json por defecto es válido", () => {
  const r = validateConfig(baseRaw());
  assert.equal(r.ok, true);
  assert.equal(r.config.server.port, 3000);
});

test("un parámetro omitido usa su valor por defecto del esquema", () => {
  const raw = baseRaw();
  delete raw.tank.size;
  const r = validateConfig(raw);
  assert.equal(r.ok, true);
  assert.equal(r.config.tank.size, CONFIG_SCHEMA["tank.size"].default);
});

test("maxFrameBytes menor que maxMessageBytes se rechaza", () => {
  const raw = baseRaw();
  raw.network.maxFrameBytes.value = 512;
  raw.network.maxMessageBytes.value = 1024;
  const r = validateConfig(raw);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes("maxFrameBytes")));
});

test("Área_Interés menor que Área_Visible se rechaza por eje", () => {
  const raw = baseRaw();
  raw.players.interestWidth.value = 1000;
  raw.view.width.value = 1440;
  const r = validateConfig(raw);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.startsWith("ancho:")));
});

test("maxMessagesPerSecond menor que 2×tick.rate se rechaza", () => {
  const raw = baseRaw();
  raw.network.maxMessagesPerSecond.value = 30;
  raw.tick.rate.value = 30;
  const r = validateConfig(raw);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes("maxMessagesPerSecond")));
});

test("Obstáculo fuera de la Arena se rechaza", () => {
  const raw = baseRaw();
  raw.arena.obstacles.value = [{ x: -10, y: 0, w: 50, h: 50 }];
  const r = validateConfig(raw);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes("sale de la Arena")));
});

test("bots.inRanking no booleano se rechaza", () => {
  const raw = baseRaw();
  raw.bots.inRanking.value = "sí";
  const r = validateConfig(raw);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes("bots.inRanking")));
});

test("config.json coincide con los valores por defecto del esquema", () => {
  const raw = baseRaw();
  for (const [path, spec] of Object.entries(CONFIG_SCHEMA)) {
    const parts = path.split(".");
    let node = raw;
    for (const p of parts) node = node?.[p];
    if (node && "default" in node) {
      assert.deepEqual(node.default, spec.default, `default de ${path} no coincide`);
    }
  }
});
