// Pruebas de humo de estructura: aislamiento del núcleo respecto a la red,
// ausencia de fuentes de no determinismo y forma de package.json.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function allFiles(dir) {
  const out = [];
  for (const e of readdirSync(dir)) {
    const full = path.join(dir, e);
    if (statSync(full).isDirectory()) out.push(...allFiles(full));
    else if (full.endsWith(".js")) out.push(full);
  }
  return out;
}

test("package.json: type module, node >=24, solo ws en dependencies", () => {
  const pkg = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8"));
  assert.equal(pkg.type, "module");
  assert.match(pkg.engines.node, />=\s*24/);
  assert.deepEqual(Object.keys(pkg.dependencies), ["ws"]);
});

test("el núcleo (engine, effects, bots) no importa red ni usa no determinismo", () => {
  const dirs = ["src/engine", "src/effects", "src/bots"];
  const forbiddenImports = ["ws", "node:http", "node:net", "../server/", "server/"];
  const forbiddenCalls = ["Math.random", "Date.now", "performance.now", "crypto"];
  for (const d of dirs) {
    for (const f of allFiles(path.join(ROOT, d))) {
      const raw = readFileSync(f, "utf8");
      // Quitar comentarios de línea y de bloque para analizar solo el código.
      const src = raw
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/[^\n]*/g, "");
      for (const imp of forbiddenImports) {
        assert.ok(!src.includes(`"${imp}`) && !src.includes(`'${imp}`), `${f} importa ${imp}`);
      }
      for (const call of forbiddenCalls) {
        assert.ok(!src.includes(call), `${f} usa ${call}`);
      }
    }
  }
});

test("existen las carpetas esperadas", () => {
  for (const d of ["src/engine", "src/server", "src/client", "src/spectator", "src/shared", "src/effects", "src/bots", "test"]) {
    assert.ok(statSync(path.join(ROOT, d)).isDirectory(), `falta ${d}`);
  }
});

test("el README menciona cada carpeta, npm start y npm test", () => {
  const readme = readFileSync(path.join(ROOT, "README.md"), "utf8");
  for (const d of ["src/engine", "src/server", "src/client", "src/spectator", "src/shared", "src/effects", "src/bots", "test"]) {
    assert.ok(readme.includes("`" + d + "`"), `README no menciona ${d}`);
  }
  assert.ok(readme.includes("npm start"));
  assert.ok(readme.includes("npm test"));
});
