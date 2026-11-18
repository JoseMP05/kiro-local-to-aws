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
  "arena.width": { type: "number", default: 4400, min: 400, max: 20000 },
  "arena.height": { type: "number", default: 2800, min: 400, max: 20000 },
  // Mapa simétrico: búnkeres en las esquinas, muros, bloques de acero, losas de
  // hormigón y una plaza central con cuatro entradas.
  "arena.obstacles": {
    type: "obstacles",
    default: [
      { x: 2180, y: 220, w: 40, h: 300 },
      { x: 1720, y: 240, w: 80, h: 80 },
      { x: 2600, y: 240, w: 80, h: 80 },
      { x: 900, y: 260, w: 360, h: 40 },
      { x: 3140, y: 260, w: 360, h: 40 },
      { x: 300, y: 300, w: 260, h: 40 },
      { x: 3840, y: 300, w: 260, h: 40 },
      { x: 300, y: 340, w: 40, h: 180 },
      { x: 4060, y: 340, w: 40, h: 180 },
      { x: 1500, y: 380, w: 80, h: 80 },
      { x: 2820, y: 380, w: 80, h: 80 },
      { x: 1240, y: 520, w: 40, h: 220 },
      { x: 3120, y: 520, w: 40, h: 220 },
      { x: 1700, y: 700, w: 60, h: 60 },
      { x: 2640, y: 700, w: 60, h: 60 },
      { x: 760, y: 760, w: 280, h: 40 },
      { x: 3360, y: 760, w: 280, h: 40 },
      { x: 760, y: 800, w: 40, h: 200 },
      { x: 3600, y: 800, w: 40, h: 200 },
      { x: 1820, y: 820, w: 60, h: 60 },
      { x: 2520, y: 820, w: 60, h: 60 },
      { x: 260, y: 880, w: 40, h: 320 },
      { x: 4100, y: 880, w: 40, h: 320 },
      { x: 1300, y: 900, w: 200, h: 120 },
      { x: 2900, y: 900, w: 200, h: 120 },
      { x: 760, y: 1000, w: 280, h: 40 },
      { x: 3360, y: 1000, w: 280, h: 40 },
      { x: 1960, y: 1160, w: 140, h: 40 },
      { x: 2300, y: 1160, w: 140, h: 40 },
      { x: 1960, y: 1200, w: 40, h: 100 },
      { x: 2400, y: 1200, w: 40, h: 100 },
      { x: 2160, y: 1360, w: 80, h: 80 },
      { x: 560, y: 1380, w: 300, h: 40 },
      { x: 3540, y: 1380, w: 300, h: 40 },
      { x: 1960, y: 1500, w: 40, h: 100 },
      { x: 2400, y: 1500, w: 40, h: 100 },
      { x: 260, y: 1600, w: 40, h: 320 },
      { x: 1960, y: 1600, w: 140, h: 40 },
      { x: 2300, y: 1600, w: 140, h: 40 },
      { x: 4100, y: 1600, w: 40, h: 320 },
      { x: 760, y: 1760, w: 280, h: 40 },
      { x: 3360, y: 1760, w: 280, h: 40 },
      { x: 1300, y: 1780, w: 200, h: 120 },
      { x: 2900, y: 1780, w: 200, h: 120 },
      { x: 760, y: 1800, w: 40, h: 200 },
      { x: 3600, y: 1800, w: 40, h: 200 },
      { x: 1820, y: 1920, w: 60, h: 60 },
      { x: 2520, y: 1920, w: 60, h: 60 },
      { x: 760, y: 2000, w: 280, h: 40 },
      { x: 3360, y: 2000, w: 280, h: 40 },
      { x: 1700, y: 2040, w: 60, h: 60 },
      { x: 2640, y: 2040, w: 60, h: 60 },
      { x: 1240, y: 2060, w: 40, h: 220 },
      { x: 3120, y: 2060, w: 40, h: 220 },
      { x: 300, y: 2280, w: 40, h: 180 },
      { x: 2180, y: 2280, w: 40, h: 300 },
      { x: 4060, y: 2280, w: 40, h: 180 },
      { x: 1500, y: 2340, w: 80, h: 80 },
      { x: 2820, y: 2340, w: 80, h: 80 },
      { x: 300, y: 2460, w: 260, h: 40 },
      { x: 3840, y: 2460, w: 260, h: 40 },
      { x: 1720, y: 2480, w: 80, h: 80 },
      { x: 2600, y: 2480, w: 80, h: 80 },
      { x: 900, y: 2500, w: 360, h: 40 },
      { x: 3140, y: 2500, w: 360, h: 40 },
    ],
  },

  // --- tick ---
  "tick.rate": { type: "number", default: 30, min: 1, max: 120, integer: true },

  // --- tank ---
  "tank.speed": { type: "number", default: 200, min: 1, max: 2000 },
  "tank.size": { type: "number", default: 40, min: 8, max: 200 },
  "tank.barrelLength": { type: "number", default: 32, min: 1, max: 200 },
  "tank.maxHealth": { type: "number", default: 6, min: 1, max: 1000, integer: true },
  // Vida extra según la posición en el Ranking (solo con más de 0 puntos).
  "tank.rankHealth.first": { type: "number", default: 3, min: 0, max: 100, integer: true },
  "tank.rankHealth.podium": { type: "number", default: 2, min: 0, max: 100, integer: true },
  "tank.rankHealth.top10": { type: "number", default: 1, min: 0, max: 100, integer: true },
  "tank.respawnS": { type: "number", default: 3, min: 0.5, max: 60 },
  "tank.protectionS": { type: "number", default: 2, min: 0, max: 10 },
  "tank.safeDistance": { type: "number", default: 300, min: 0, max: 20000 },
  "tank.safeMaxAttempts": { type: "number", default: 30, min: 1, max: 1000, integer: true },

  // --- bullet ---
  "bullet.speed": { type: "number", default: 600, min: 1, max: 5000 },
  "bullet.radius": { type: "number", default: 5, min: 1, max: 50 },
  "bullet.damage": { type: "number", default: 1, min: 1, max: 1000 },
  "bullet.reloadMs": { type: "number", default: 300, min: 0, max: 10000 },
  "bullet.maxActive": { type: "number", default: 5, min: 1, max: 50, integer: true },
  "bullet.maxBounces": { type: "number", default: 3, min: 0, max: 10, integer: true },
  "bullet.lifetimeS": { type: "number", default: 3, min: 0.1, max: 60 },
  "bullet.selfDamage": { type: "boolean", default: true },

  // --- score ---
  "score.kill": { type: "number", default: 10, min: 0, max: 100000 },
  "score.leaderBonus": { type: "number", default: 5, min: 0, max: 100000 },
  "score.deathLossPercent": { type: "number", default: 25, min: 0, max: 100, integer: true },

  // --- boxes ---
  "boxes.max": { type: "number", default: 10, min: 0, max: 100, integer: true },
  "boxes.intervalS": { type: "number", default: 6, min: 0.1, max: 600 },
  "boxes.points": { type: "number", default: 10, min: 0, max: 100000 },
  "boxes.size": { type: "number", default: 30, min: 4, max: 200 },
  "boxes.maxAttempts": { type: "number", default: 20, min: 1, max: 1000, integer: true },
  // Probabilidad de que una Caja nueva sea un potenciador (turbo, escudo o botiquín) en vez de puntos.
  "boxes.powerupChance": { type: "number", default: 0.45, min: 0, max: 1 },
  // Vida que recupera el botiquín (sin pasar de la vida máxima).
  "boxes.healAmount": { type: "number", default: 3, min: 1, max: 1000, integer: true },

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
  "effects.turbo.factor": { type: "number", default: 1.6, min: 0.01, max: 10 },
  "effects.turbo.durationMs": { type: "number", default: 5000, min: 100, max: 60000, integer: true },
  "effects.shield.durationMs": { type: "number", default: 5000, min: 100, max: 60000, integer: true },

  // --- debug ---
  "debug": { type: "boolean", default: false },
};
