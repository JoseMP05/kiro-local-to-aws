import { test } from "node:test";
import assert from "node:assert/strict";
import { createRateLimiter } from "../../src/server/rate-limiter.js";

function fakeClock(start = 0) {
  let t = start;
  return { now: () => t, advance: (ms) => { t += ms; } };
}

test("90 mensajes entregados y el 91 descartado en la misma ventana", () => {
  const clock = fakeClock(1000);
  const rl = createRateLimiter({ maxPerSecond: 90, maxConsecutive: 3, now: clock.now, openedAt: 1000 });
  for (let i = 0; i < 90; i++) assert.equal(rl.accept().deliver, true);
  const r = rl.accept();
  assert.equal(r.deliver, false);
  assert.equal(r.close, false);
});

test("cierre tras 3 ventanas consecutivas excedidas", () => {
  const clock = fakeClock(0);
  const rl = createRateLimiter({ maxPerSecond: 2, maxConsecutive: 3, now: clock.now, openedAt: 0 });
  let closed = false;
  for (let win = 0; win < 3; win++) {
    rl.accept(); rl.accept(); // 2 entregados
    const r = rl.accept(); // excede
    if (r.close) closed = true;
    clock.advance(1000);
  }
  assert.equal(closed, true);
});

test("una ventana vacía reinicia el contador de consecutivas", () => {
  const clock = fakeClock(0);
  const rl = createRateLimiter({ maxPerSecond: 1, maxConsecutive: 2, now: clock.now, openedAt: 0 });
  rl.accept(); rl.accept(); // ventana 0 excedida
  clock.advance(2000); // salta una ventana
  rl.accept(); rl.accept(); // ventana 2 excedida, pero consecutive se reinició
  const r = rl.accept();
  assert.equal(r.close, false);
});
