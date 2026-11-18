import { test } from "node:test";
import assert from "node:assert/strict";
import { rankingLines, deathHeadline, fitText, CONTROLS } from "../../src/client/hud.js";
import { killFeedText, killFeedSegments, isSelfKill } from "../../src/shared/kill-feed.js";
import { botLabel } from "../../src/client/render.js";
import { createBulletTrails } from "../../src/shared/bullet-trails.js";

const RANK = {
  tables: [{ name: "tanques", entries: Array.from({ length: 10 }, (_, i) => ({ position: i + 1, nick: `J${i + 1}`, score: 100 - i, bot: false })) }],
  you: { position: 12, score: 5 },
};

test("rankingLines muestra '<apodo> (tú)' en la fila propia fuera del top 10", () => {
  const lines = rankingLines(RANK, "Pepe");
  const own = lines.at(-1);
  assert.equal(own.nick, "Pepe");
  assert.equal(own.own, true);
  assert.match(own.text, /^12\. Pepe \(tú\)/);
});

test("rankingLines marca como propia la fila del top 10 con '(tú)'", () => {
  const lines = rankingLines({ ...RANK, you: { position: 3, score: 98 } }, "J3");
  assert.match(lines[2].text, /J3 \(tú\)/);
  assert.equal(lines[2].own, true);
});

test("fitText recorta con puntos suspensivos solo si no cabe", () => {
  const ctx = { measureText: (t) => ({ width: t.length * 10 }) };
  assert.equal(fitText(ctx, "Ana", 100), "Ana");
  assert.equal(fitText(ctx, "NombreMuyLargo", 75), "Nombre…");
});

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

test("la etiqueta de Bot no repite la marca ni muestra puntos fuera del Ranking", () => {
  assert.equal(botLabel("Bot 20", 75), "Bot 20");
  assert.equal(botLabel("Ana", 75), "Ana BOT");
  assert.equal(botLabel("Bot 20", 75, true), "Bot 20 · 75");
  assert.equal(botLabel("Ana", 75, true), "Ana BOT · 75");
});

test("el panel de controles incluye la tecla N de música", () => {
  assert.ok(CONTROLS.some((c) => c.keys[0] === "N" && c.action === "MÚSICA SÍ/NO"));
});

test("las estelas se acotan y se limpian al desaparecer la Bala", () => {
  const ctx = { fillStyle: "", globalAlpha: 1, fillRect() {} };
  const tr = createBulletTrails({ maxLength: 4 });
  for (let f = 0; f < 10; f++) {
    tr.begin();
    tr.drawFor(ctx, 1, f * 10, 0, 5);
    tr.drawFor(ctx, 2, 0, f * 10, 5);
    tr.end();
  }
  assert.equal(tr.size(), 2);
  tr.begin();
  tr.drawFor(ctx, 2, 0, 100, 5);
  tr.end();
  assert.equal(tr.size(), 1, "la Bala 1 se descarta");
});
test("boxLegend: una fila por tipo de Caja con las cantidades configuradas", async () => {
  const { boxLegend } = await import("../../src/client/hud.js");
  const rows = boxLegend({ boxPoints: 10, healAmount: 35, effectDurations: { turbo: 5000, escudo: 5000 } });
  assert.deepEqual(rows.map((r) => r.kind), ["puntos", "turbo", "escudo", "botiquin"]);
  assert.equal(rows[0].text, "+10 PUNTOS");
  assert.equal(rows[1].text, "MÁS VELOCIDAD 5S");
  assert.equal(rows[2].text, "SIN RECIBIR DAÑO 5S");
  assert.equal(rows[3].text, "+35 VIDA");
});
