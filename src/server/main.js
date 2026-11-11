// Punto de entrada. Comprueba la versión de Node antes de importar start.js,
// de modo que ningún import pueda fallar antes de esta comprobación.

const major = Number.parseInt(process.versions.node.split(".")[0], 10);
if (!Number.isFinite(major) || major < 24) {
  console.error(`Se requiere Node.js 24 o superior (versión actual: ${process.versions.node})`);
  process.exit(1);
}

await import("./start.js");
