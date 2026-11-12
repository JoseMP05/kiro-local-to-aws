# Design Document: online-readiness

## Overview

Cambios acotados sobre `tank-game-core`, sin nuevas dependencias de ejecución (`ws` sigue siendo la única). El núcleo (`src/engine`, `src/effects`, `src/bots`) mantiene sus restricciones: sin red, sin reloj y sin `Math.random`.

## Components

### Contrato de despliegue (`src/server/start.js`)

- `resolvePort(PORT, config.server.port)`: valida el entero; si es inválido, escribe `PORT inválido` y sale con código 1.
- `HOST` por defecto `0.0.0.0`.
- `GET|HEAD /health` se atiende antes del manejador estático. El cuerpo se calcula en `healthBody()` a partir de `gateway.liveConnections()` y de las métricas de Tick.
- Métricas de Tick: `createTickLoop` acepta `onTickDuration(ms)`, que mide simulación más envío. `start.js` agrega una ventana de 5 segundos (`tick.rate × 5` Ticks) y publica media y máximo de la última ventana completa.
- Apagado: `SIGTERM` y `SIGINT` detienen el bucle, cierran los sockets con 1001, cierran el servidor HTTP y salen con 0; un temporizador `unref` de 3 s fuerza la salida.

### Imagen (`Dockerfile`, `.dockerignore`)

Node 24 Alpine, `corepack enable` y `pnpm install --frozen-lockfile --prod` (el repositorio usa `pnpm-lock.yaml`; `package.json` fija `packageManager`). Solo se copian `config.json` y `src`. Corre como `node`. `HEALTHCHECK` con `fetch` sobre `/health`.

### Potenciadores

| Pieza | Cambio |
| --- | --- |
| `config-schema.js`, `config.json` | `boxes.powerupChance`, `effects.turbo.{factor,durationMs}`, `effects.shield.durationMs` |
| `config-loader.js` | Regla cruzada: `speedMultiplierMin ≤ turbo.factor ≤ speedMultiplierMax` |
| `boxes.js` | `pickKind(powerupChance, rng)`. Con 0 no consume `rng`. `collectBoxes` solo suma puntos si `kind === "puntos"` |
| `effects/builtin/turbo.js` | Misma estructura que `slow.js`, con cuenta de instancias por objetivo |
| `tanks.js` | Campo `shieldUntilTick` (-1 = sin escudo). Se reinicia al reaparecer |
| `hits.js` | `isInvulnerable` considera la protección de reaparición y el escudo |
| `game.js` | `applyPowerup(ev)` en la fase 10: `turbo` → `activateEffect`; `escudo` → `shieldUntilTick`. `getView` expone `shield` |
| `snapshot.js` | `toTankState` incluye `shield` |

Se usa un campo separado para el escudo porque `bullets.js` pone `invulnerableUntilTick = -1` al disparar (Req. 7.10 del núcleo), y el escudo no debe perderse así.

### Clientes

- `shared/sprites.js`: `drawCrate(..., kind)` delega en `drawPowerupCrate` para `turbo` y `escudo`; `drawTank` dibuja el anillo de escudo y la estela de turbo.
- `shared/particles.js`: sistema de partículas con tiempo inyectado, compartido por jugador y espectador.
- `client/audio.js`: sonidos con WebAudio; el contexto se crea en la primera reproducción por la política de autoplay del navegador.
- `client/hud.js`: `powerupBadges(own)` es pura y `drawBadges` dibuja las insignias.
- `client/main.js`: `reactToState(prev, next)` compara estados consecutivos para disparar sonidos y partículas.

### Prueba de carga (`scripts/loadtest.js`)

Cada jugador simulado entra con el apodo `LT_<n>`, envía Input a 30 Hz con cambios de dirección cada 1 a 3 s y dispara con probabilidad 0,3. Mide el intervalo entre mensajes `state` por cliente. Al final lee `/health` y evalúa los cuatro criterios del requisito 4.3.

## Testing Strategy

- `test/engine/powerups.test.js`: puntos, turbo (activación y fin), escudo (no se pierde al disparar, caduca) y `powerupChance` 0 y 1.
- `test/effects/turbo.test.js`: ciclo de vida y cuenta de instancias.
- `test/server/deploy-contract.test.js`: arranca el servidor real con `PORT`, comprueba `/health`, 404 y `PORT` inválido.
- La Prueba_Carga se ejecuta a mano antes de cada despliegue y después contra la URL pública.
- Los gráficos y el audio se comprueban a mano; no hay pruebas automáticas de Canvas.
