import { test } from "node:test";
import assert from "node:assert/strict";
import {
  stepEvents, LOOP_STEPS, STEPS_PER_BAR, BARS, DROP_BAR, BPM, STEP_S, COWBELL_RATIO,
} from "../../src/client/music-score.js";

const VOICES = ["808", "kick", "clap", "hat", "ohat", "cowbell", "pad", "stab", "riser", "impact"];

function barEvents(bar) {
  const out = [];
  for (let k = 0; k < STEPS_PER_BAR; k++) for (const e of stepEvents(bar * STEPS_PER_BAR + k)) out.push({ ...e, k });
  return out;
}

test("la canción dura 16 compases a ~140 BPM y se repite sin saltos", () => {
  assert.equal(BARS, 16);
  assert.equal(LOOP_STEPS, 16 * STEPS_PER_BAR);
  assert.deepEqual(stepEvents(0), stepEvents(LOOP_STEPS));
  assert.deepEqual(stepEvents(37), stepEvents(37 + 3 * LOOP_STEPS));
  assert.ok(BPM >= 135 && BPM <= 145);
  assert.ok(Math.abs(STEP_S - 60 / BPM / 4) < 1e-12);
});

test("todos los eventos son válidos", () => {
  for (let i = 0; i < LOOP_STEPS; i++) {
    for (const e of stepEvents(i)) {
      assert.ok(VOICES.includes(e.voice), e.voice);
      assert.ok(e.vol > 0 && e.vol <= 1 && e.steps > 0);
      assert.ok(e.off === undefined || (e.off >= 0 && e.off < 1));
      if (e.freq !== undefined) assert.ok(Number.isFinite(e.freq) && e.freq > 20 && e.freq < 4000, `${e.voice} ${e.freq}`);
      if (e.glide !== undefined) assert.ok(e.glide > 20 && e.glide < 400);
      if (e.freqs) assert.ok(e.freqs.length === 3 && e.freqs.every((f) => f > 20 && f < 4000));
    }
  }
});

test("medio tiempo: bombo en el primer tiempo y palmada solo en el tercero", () => {
  for (let bar = 0; bar < BARS; bar++) {
    const evs = barEvents(bar);
    assert.ok(evs.some((e) => e.voice === "kick" && e.k === 0), `bombo en el compás ${bar}`);
    assert.ok(evs.some((e) => e.voice === "808" && e.k === 0), `808 en el compás ${bar}`);
    const claps = evs.filter((e) => e.voice === "clap").map((e) => e.k);
    assert.ok(claps.includes(8));
    if (bar !== BARS - 1) assert.deepEqual(claps, [8], `una sola palmada en el compás ${bar}`);
  }
});

test("el 808 tiene notas largas y algunos deslizamientos; el drop los repite", () => {
  const all = [];
  for (let b = 0; b < BARS; b++) all.push(...barEvents(b).filter((e) => e.voice === "808"));
  assert.ok(all.some((e) => e.steps >= 5), "sostenido largo");
  assert.ok(all.some((e) => e.glide), "deslizamiento entre notas");
  assert.ok(all.filter((e) => e.glide).length < all.length / 2, "deslizamientos ocasionales");
});

test("el cencerro es la firma del drop: ausente al inicio, completo en la sección B", () => {
  const count = (from, to) => {
    let n = 0;
    for (let b = from; b < to; b++) n += barEvents(b).filter((e) => e.voice === "cowbell").length;
    return n;
  };
  assert.equal(count(0, 4), 0);
  assert.ok(count(4, DROP_BAR) > 0 && count(4, DROP_BAR) < count(DROP_BAR, BARS));
  assert.ok(count(DROP_BAR, BARS) >= 8 * 6);
  assert.ok(Math.abs(COWBELL_RATIO - 800 / 540) < 1e-9);
  const full = barEvents(DROP_BAR).filter((e) => e.voice === "cowbell");
  assert.ok(Math.max(...full.map((e) => e.vol)) > Math.max(...barEvents(5).filter((e) => e.voice === "cowbell").map((e) => e.vol)));
});

test("hay redobles de tresillos, risers e impactos y capa de batalla", () => {
  const rolls = barEvents(3).filter((e) => e.voice === "hat" && e.off > 0);
  assert.ok(rolls.length >= 4, "tresillos en el compás 3");
  assert.ok(barEvents(DROP_BAR - 1).some((e) => e.voice === "riser"));
  assert.ok(barEvents(BARS - 1).some((e) => e.voice === "riser"));
  assert.ok(barEvents(DROP_BAR).some((e) => e.voice === "impact"));
  assert.ok(barEvents(0).some((e) => e.voice === "pad"));
  assert.equal(barEvents(0).some((e) => e.voice === "stab"), false);
  assert.ok(barEvents(DROP_BAR).some((e) => e.voice === "stab"));
});

test("las dos secciones son distintas", () => {
  assert.notDeepEqual(barEvents(1), barEvents(DROP_BAR + 1));
  assert.notDeepEqual(barEvents(0).map((e) => e.voice), barEvents(DROP_BAR).map((e) => e.voice));
});
