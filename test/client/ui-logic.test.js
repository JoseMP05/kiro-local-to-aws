import { test } from "node:test";
import assert from "node:assert/strict";
import { deathHeadline } from "../../src/client/hud.js";
import { killFeedText, killFeedSegments, isSelfKill } from "../../src/shared/kill-feed.js";

test("deathHeadline distingue autor, autodestrucción y desconocido", () => {
  assert.equal(deathHeadline({ killer: "Beto", self: false }), "ELIMINADO POR Beto");
  assert.equal(deathHeadline({ killer: "Ana", self: true }), "TE AUTODESTRUISTE");
  assert.equal(deathHeadline(null), "ELIMINADO");
  assert.equal(deathHeadline({ killer: null, self: false }), "ELIMINADO");
});

test("el aviso de eliminación trata la autodestrucción aparte", () => {
  assert.equal(isSelfKill({ killer: "Ana", victim: "Ana" }), true);
  assert.equal(killFeedText({ killer: "Ana", victim: "Ana", streak: 0 }), "Ana ✸ se autodestruyó");
  assert.equal(killFeedText({ killer: "Ana", victim: "Beto", streak: 3 }), "Ana ► Beto ×3");
  assert.deepEqual(killFeedSegments({ killer: "Ana", victim: "Ana" }).map((s) => s.text), ["Ana", " ✸ ", "se autodestruyó"]);
});
