// Configuración común para las pruebas de propiedades (property-based testing).
// La semilla fija hace que los contraejemplos sean reproducibles; se puede
// sustituir con la variable de entorno PBT_SEED. numRuns ≥ 100 según el spec.

const envSeed = Number.parseInt(process.env.PBT_SEED ?? "", 10);

export const PBT = {
  seed: Number.isFinite(envSeed) ? envSeed : 20240501,
  numRuns: 100,
};
