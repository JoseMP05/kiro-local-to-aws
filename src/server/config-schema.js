// Esquema de la Configuración: lista de todos los parámetros con su tipo,
// valor por defecto de respaldo y, para los numéricos, rango e indicador de
// entero. El cargador usa este esquema como fuente de verdad del tipo y como
// respaldo si config.json omite una entrada por completo (Req. 1.8).
//
// Tipos: "number", "boolean", "string", "obstacles".
// Cada parámetro se identifica por su ruta con puntos, p. ej. "tank.size".

/**
 * @typedef {object} ParamSpec
 * @property {"number"|"boolean"|"string"|"obstacles"} type
 * @property {*} default valor de respaldo
 * @property {number} [min]
 * @property {number} [max]
 * @property {boolean} [integer]
 */

/** @type {Record<string, ParamSpec>} */
export const CONFIG_SCHEMA = {
  // --- server ---
  "server.port": { type: "number", default: 3000, min: 1, max: 65535, integer: true },
  "server.spectatorPath": { type: "string", default: "/espectador" },

  // --- arena ---
  "arena.width": { type: "number", default: 3200, min: 400, max: 20000 },
  "arena.height": { type: "number", default: 2000, min: 400, max: 20000 },
  "arena.obstacles": {
    type: "obstacles",
    default: [
      { x: 600, y: 400, w: 200, h: 40 },
      { x: 2400, y: 400, w: 200, h: 40 },
      { x: 1500, y: 950, w: 200, h: 100 },
      { x: 600, y: 1560, w: 200, h: 40 },
      { x: 2400, y: 1560, w: 200, h: 40 },
    ],
  },

  // --- tick ---
  "tick.rate": { type: "number", default: 30, min: 1, max: 120, integer: true },

  // --- tank ---
  "tank.speed": { type: "number", default: 200, min: 1, max: 2000 },
  "tank.size": { type: "number", default: 40, min: 8, max: 200 },
  "tank.barrelLength": { type: "number", default: 32, min: 1, max: 200 },
  "tank.maxHealth": { type: "number", default: 3, min: 1, max: 1000 },
  "tank.respawnS": { type: "number", default: 3, min: 0.5, max: 60 },
  "tank.protectionS": { type: "number", default: 2, min: 0, max: 10 },
  "tank.safeDistance": { type: "number", default: 300, min: 0, max: 20000 },
  "tank.safeMaxAttempts": { type: "number", default: 30, min: 1, max: 1000, integer: true },

  // --- bullet ---
  "bullet.speed": { type: "number", default: 600, min: 1, max: 5000 },
  "bullet.radius": { type: "number", default: 5, min: 1, max: 50 },
  "bullet.damage": { type: "number", default: 1, min: 1, max: 1000 },
  "bullet.reloadMs": { type: "number", default: 500, min: 0, max: 10000 },
  "bullet.maxActive": { type: "number", default: 3, min: 1, max: 50, integer: true },
  "bullet.maxBounces": { type: "number", default: 3, min: 0, max: 10, integer: true },
  "bullet.lifetimeS": { type: "number", default: 5, min: 0.1, max: 60 },
  "bullet.selfDamage": { type: "boolean", default: true },

  // --- score ---
  "score.kill": { type: "number", default: 10, min: 0, max: 100000 },
  "score.leaderBonus": { type: "number", default: 5, min: 0, max: 100000 },
  "score.deathLossPercent": { type: "number", default: 50, min: 0, max: 100, integer: true },

  // --- boxes ---
  "boxes.max": { type: "number", default: 5, min: 0, max: 100, integer: true },
  "boxes.intervalS": { type: "number", default: 10, min: 0.1, max: 600 },
  "boxes.points": { type: "number", default: 10, min: 0, max: 100000 },
  "boxes.size": { type: "number", default: 30, min: 4, max: 200 },
  "boxes.maxAttempts": { type: "number", default: 20, min: 1, max: 1000, integer: true },

  // --- bots ---
  "bots.count": { type: "number", default: 0, min: 0, max: 20, integer: true },
  "bots.detectDistance": { type: "number", default: 60, min: 0, max: 5000 },
  "bots.visionRange": { type: "number", default: 500, min: 0, max: 20000 },
  "bots.arriveDistance": { type: "number", default: 20, min: 1, max: 5000 },
  "bots.targetTimeoutS": { type: "number", default: 10, min: 0.1, max: 600 },
  "bots.inRanking": { type: "boolean", default: false },

  // --- players ---
  "players.max": { type: "number", default: 50, min: 1, max: 200, integer: true },
  "players.nickMin": { type: "number", default: 2, min: 1, max: 100, integer: true },
  "players.nickMax": { type: "number", default: 16, min: 1, max: 100, integer: true },
  "players.interestWidth": { type: "number", default: 1600, min: 100, max: 20000 },
  "players.interestHeight": { type: "number", default: 1000, min: 100, max: 20000 },

  // --- view ---
  "view.width": { type: "number", default: 1440, min: 400, max: 10000 },
  "view.height": { type: "number", default: 900, min: 400, max: 10000 },

  // --- network ---
  "network.maxMessageBytes": { type: "number", default: 1024, min: 64, max: 65536, integer: true },
  "network.maxFrameBytes": { type: "number", default: 65536, min: 1024, max: 1048576, integer: true },
  "network.maxMessagesPerSecond": { type: "number", default: 90, min: 1, max: 1000, integer: true },
  "network.maxExceededWindows": { type: "number", default: 3, min: 1, max: 100, integer: true },
  "network.heartbeatIntervalMs": { type: "number", default: 10000, min: 100, max: 600000, integer: true },
  "network.heartbeatTimeoutMs": { type: "number", default: 30000, min: 100, max: 600000, integer: true },
  "network.interpolationDelayMs": { type: "number", default: 100, min: 0, max: 2000, integer: true },

  // --- effects ---
  "effects.maxDurationMs": { type: "number", default: 60000, min: 100, max: 600000, integer: true },
  "effects.speedMultiplierMin": { type: "number", default: 0.2, min: 0.01, max: 10 },
  "effects.speedMultiplierMax": { type: "number", default: 3, min: 0.01, max: 10 },
  "effects.slow.factor": { type: "number", default: 0.5, min: 0.01, max: 10 },
  "effects.slow.durationMs": { type: "number", default: 5000, min: 100, max: 60000, integer: true },

  // --- debug ---
  "debug": { type: "boolean", default: false },
};
