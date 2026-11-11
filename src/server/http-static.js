// Servidor de archivos estáticos con lista blanca de extensiones y protección
// contra salir de la carpeta base. Solo atiende GET y HEAD.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = path.resolve(__dirname, "..");
const CLIENT_DIR = path.join(SRC_ROOT, "client");
const SPECTATOR_DIR = path.join(SRC_ROOT, "spectator");
const SHARED_DIR = path.join(SRC_ROOT, "shared");

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

/**
 * Crea el manejador HTTP estático.
 * @param {object} cfg GameConfig (para spectatorPath)
 * @returns {(req, res) => Promise<void>}
 */
export function createStaticHandler(cfg) {
  const spectatorPath = cfg.server.spectatorPath;

  return async function handle(req, res) {
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Método no permitido");
      return;
    }

    let urlPath;
    try {
      urlPath = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    } catch {
      return notFound(res);
    }

    const resolved = resolvePath(urlPath, spectatorPath);
    if (!resolved) return notFound(res);

    try {
      const content = await readFile(resolved.file);
      res.writeHead(200, {
        "Content-Type": resolved.contentType,
        "X-Content-Type-Options": "nosniff",
      });
      if (req.method === "HEAD") res.end();
      else res.end(content);
    } catch (err) {
      if (err.code === "ENOENT" || err.code === "EISDIR") return notFound(res);
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Error interno");
    }
  };

  function resolvePath(urlPath, spectatorPath) {
    // Rutas raíz.
    if (urlPath === "/") {
      return resolveWithin(CLIENT_DIR, "index.html");
    }
    if (urlPath === spectatorPath || urlPath === spectatorPath + "/") {
      return resolveWithin(SPECTATOR_DIR, "index.html");
    }
    if (urlPath.startsWith(spectatorPath + "/")) {
      return resolveWithin(SPECTATOR_DIR, urlPath.slice(spectatorPath.length + 1));
    }
    if (urlPath.startsWith("/shared/")) {
      return resolveWithin(SHARED_DIR, urlPath.slice("/shared/".length));
    }
    // Archivo del cliente.
    return resolveWithin(CLIENT_DIR, urlPath.slice(1));
  }
}

function resolveWithin(baseDir, relative) {
  const file = path.resolve(baseDir, relative);
  // Debe quedar dentro de la carpeta base (evita ../).
  if (file !== baseDir && !file.startsWith(baseDir + path.sep)) return null;
  const ext = path.extname(file).toLowerCase();
  const contentType = CONTENT_TYPES[ext];
  if (!contentType) return null;
  return { file, contentType };
}

function notFound(res) {
  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("No encontrado");
}
