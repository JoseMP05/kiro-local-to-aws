// Contrato de despliegue: PORT, /health y rutas desconocidas, probados contra
// un proceso real del servidor.

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function startServer(port) {
  const child = spawn(process.execPath, ["src/server/main.js"], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("el servidor no arrancó en 5 s")), 5000);
    child.stdout.on("data", (d) => {
      if (d.toString().includes("Juego:")) {
        clearTimeout(timer);
        resolve();
      }
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`el servidor terminó con código ${code}`));
    });
  });
  return { child, ready };
}

test("el servidor usa PORT, responde /health y devuelve 404 en rutas desconocidas", async () => {
  const port = 39000 + Math.floor(Math.random() * 500);
  const { child, ready } = startServer(port);
  try {
    await ready;

    const health = await fetch(`http://127.0.0.1:${port}/health`);
    assert.equal(health.status, 200);
    const body = await health.json();
    assert.equal(body.status, "ok");
    assert.equal(typeof body.players, "number");
    assert.equal(body.tick.rate, 30);

    assert.equal((await fetch(`http://127.0.0.1:${port}/`)).status, 200);
    assert.equal((await fetch(`http://127.0.0.1:${port}/no-existe`)).status, 404);
  } finally {
    child.kill("SIGTERM");
  }
});

test("un PORT inválido termina el proceso con código distinto de 0", async () => {
  const child = spawn(process.execPath, ["src/server/main.js"], {
    cwd: ROOT,
    env: { ...process.env, PORT: "abc" },
    stdio: ["ignore", "ignore", "pipe"],
  });
  let stderr = "";
  child.stderr.on("data", (d) => (stderr += d));
  const code = await new Promise((resolve) => child.on("exit", resolve));
  assert.notEqual(code, 0);
  assert.match(stderr, /PORT inválido/);
});
