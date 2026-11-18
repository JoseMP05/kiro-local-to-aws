import { test } from "node:test";
import assert from "node:assert/strict";
import { createKillFeed } from "../../src/shared/kill-feed.js";
test("createKillFeed: por defecto 5 avisos y 5 s", () => {
  const f = createKillFeed();
  for (let i = 0; i < 6; i++) f.add(`V${i}`, "K", 0);
  assert.equal(f.active(4999).length, 5);
  assert.equal(f.active(5000).length, 0);
});
test("createKillFeed: máximo y duración configurables", () => {
  const f = createKillFeed({ maxItems: 3, ttlMs: 4000 });
  for (let i = 0; i < 5; i++) f.add(`V${i}`, "K", 0);
  assert.deepEqual(f.active(3999).map((it) => it.victim), ["V2", "V3", "V4"]);
  assert.equal(f.active(4000).length, 0);
});
