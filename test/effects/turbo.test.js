import { test } from "node:test";
import assert from "node:assert/strict";
import { createTurboEffect } from "../../src/effects/builtin/turbo.js";

/** Contexto mínimo que registra el multiplicador. */
function fakeCtx(targetId = 1) {
  const state = { mult: 1 };
  return {
    state,
    ctx: {
      getTargetId: () => targetId,
      setSpeedMultiplier: (v) => { state.mult = v; },
    },
  };
}

test("turbo aplica su factor al activarse y vuelve a 1 al terminar", () => {
  const def = createTurboEffect({ factor: 1.6 });
  const { ctx, state } = fakeCtx();
  const inst = def.create();
  inst.onActivate(ctx);
  assert.equal(state.mult, 1.6);
  inst.onEnd(ctx);
  assert.equal(state.mult, 1);
});

test("con dos instancias, el multiplicador solo vuelve a 1 al terminar la última", () => {
  const def = createTurboEffect({ factor: 2 });
  const { ctx, state } = fakeCtx();
  const a = def.create();
  const b = def.create();
  a.onActivate(ctx);
  b.onActivate(ctx);
  a.onEnd(ctx);
  assert.equal(state.mult, 2);
  b.onEnd(ctx);
  assert.equal(state.mult, 1);
});

test("el nombre del efecto es turbo", () => {
  assert.equal(createTurboEffect({ factor: 1.5 }).name, "turbo");
});
