# Implementation Plan: tank-game-core

## Overview

El plan construye el juego en JavaScript (Node.js 24, módulos ES, sin paso de compilación) siguiendo la estructura de carpetas del diseño. Avanza de dentro hacia fuera: base del proyecto y Configuración, núcleo del Motor_Juego fase a fase, Sistema_Efectos, Controlador_Bots, protocolo e interpolación compartidos, Servidor_Juego, Cliente_Juego, Vista_Espectador y README. Cada tarea de implementación conecta su código con lo ya existente (normalmente añadiendo su fase a `game.step()`), de modo que no queda código suelto.

Las pruebas usan `node:test` y `node:assert/strict`; las propiedades usan `fast-check` (devDependency) con la configuración común `PBT` de `test/helpers/pbt.js` (semilla fija y `numRuns ≥ 100`). Cada prueba de propiedad lleva el comentario `// Feature: tank-game-core, Property N: <título>` y su `test()` empieza por `Property N:`.

`src/shared/math.js` y `src/shared/validation.js` se crean al principio porque el Motor_Juego, el Sistema_Efectos y el Controlador_Bots los importan. El resto del código compartido (`protocol.js`, `interpolation.js`) se crea en su sección.

## Tasks

- [x] 1. Base del proyecto y utilidades compartidas puras
  - [x] 1.1 Crear la base del proyecto y los ayudantes de prueba
    - Crear `package.json` con `"type": "module"`, `engines.node ">=24"`, `dependencies: { "ws" }`, `devDependencies: { "fast-check" }`, scripts `"start": "node src/server/main.js"` y `"test": "node --test test/"` (una sola ejecución, sin `--watch`)
    - Crear las carpetas `src/engine`, `src/effects/builtin`, `src/bots`, `src/server`, `src/shared`, `src/client`, `src/spectator`, `test/{engine,effects,bots,server,shared,client,spectator,properties,helpers}` y un `.gitignore` con `node_modules/`
    - Crear `test/helpers/pbt.js` con `export const PBT = { seed: 20240501, numRuns: 100 }`, sustituible por la variable de entorno `PBT_SEED`
    - _Requirements: 2.1, 2.2, 24.4, 24.5, 24.6, 24.8_

  - [x] 1.2 Implementar `src/shared/math.js`
    - `normalizeAngle(a) = a − 2π·floor((a + π)/(2π))` con resultado en [−π, π)
    - `lerp(a, b, f)`, `lerpAngle(a, b, f)` por el camino más corto y `clampWindow(c, size, arena) → { lo, hi }` (centrada en `arena/2` si `size ≥ arena`; si no, `lo = clamp(c − size/2, 0, arena − size)`)
    - Comentarios en español, nombres en inglés
    - _Requirements: 5.12, 6.9, 17.2, 18.3_

  - [ ]* 1.3 Escribir prueba de propiedad de `clampWindow`
    - **Property 9: La ventana recortada queda dentro de la Arena o centrada**
    - **Validates: Requirements 5.12, 17.2**

  - [x] 1.4 Implementar `src/shared/validation.js`
    - `validateNick(raw, { minLen, maxLen })`: NFC, `trim`, longitud en puntos de código, expresión `^[A-Za-z0-9 _\-áéíóúüñÁÉÍÓÚÜÑ]+$`; códigos `NICK_MISSING`, `NICK_NOT_STRING`, `NICK_LENGTH`, `NICK_CHARS` con mensaje en español
    - `validateInput(value)`: `w, a, s, d, fire` booleanos y `aim` con `Number.isFinite`; devuelve una copia con solo esos 6 campos
    - _Requirements: 3.3, 3.4, 3.5, 14.7_

  - [ ]* 1.5 Escribir prueba de propiedad de `validateNick`
    - **Property 3: Validación de Apodos según un oráculo**
    - Generador local `arbNickCandidate()` con Unicode arbitrario, espacios en los extremos y valores que no son texto
    - **Validates: Requirements 3.3, 3.4, 3.5**

  - [ ]* 1.6 Escribir prueba de propiedad de `validateInput`
    - **Property 23: Validación de Inputs según un oráculo**
    - **Validates: Requirements 14.7**

  - [ ]* 1.7 Escribir pruebas unitarias del Validador
    - `"  Ana  "` → `"Ana"`; `"José"` en NFD aceptado; campo extra ignorado; `aim: "1"` y `aim: NaN` rechazados
    - _Requirements: 3.3, 3.4, 14.7_

  - [x] 1.8 Implementar `src/engine/rng.js`
    - `mulberry32(seed)` → `() => number` en [0, 1), determinista
    - _Requirements: 24.2, 24.7_

- [x] 2. Configuración centralizada
  - [x] 2.1 Crear `src/server/config-schema.js` y `config.json`
    - Lista de parámetros con tipo (`number`, `boolean`, `string`, `obstacles`), `default`, `min`, `max`, `integer` y valor de respaldo, agrupados como en el diseño (`server`, `arena`, `tick`, `tank` con `tank.size`, `bullet`, `score`, `boxes`, `bots` con `inRanking`, `players` con `interestWidth/Height`, `view.width/height`, `network` con `maxMessageBytes` y `maxFrameBytes`, `effects`, `debug`)
    - `config.json` con la forma `{ value?, default, min, max, integer }` por parámetro y los mismos valores por defecto que el esquema (50 %, 30 Ticks, 90 mensajes, `maxMessageBytes` 1024 en [64, 65536], `maxFrameBytes` 65536 en [1024, 1048576], Área_Interés 1600 × 1000 en [100, 20000], Área_Visible 1440 × 900 en [400, 10000], `players.max` 50 en [1, 200], `slow.durationMs` 5000 en [100, 60000])
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.9, 1.12, 1.14, 4.1, 5.10, 17.16, 23.2_

  - [x] 2.2 Implementar `src/server/config-loader.js`
    - `validateConfig(raw) → { ok, config } | { ok: false, errors }`: valor efectivo = `value`, o `default`, o respaldo si falta la entrada; errores acumulados con nombre, valor y rango; número finito, entero, booleano en `bots.inRanking`
    - Validaciones cruzadas: Obstáculos dentro de la Arena; `maxMessagesPerSecond ≥ 2 × tick.rate`; `heartbeatTimeoutMs > heartbeatIntervalMs`; `maxFrameBytes ≥ maxMessageBytes` con el mensaje de ambos valores y la regla; `interestWidth ≥ view.width` e `interestHeight ≥ view.height` con un mensaje por dimensión; `nickMin ≤ nickMax`; `nickMax ≥ longitud("Bot " + bots.count)`; `speedMultiplierMin ≤ slow.factor ≤ speedMultiplierMax`; `barrelLength > size/2 + radius`; existe al menos una celda libre para un Tanque
    - `loadConfig()`: lee `config.json` o la ruta de `TANK_CONFIG`; en fallo de lectura o JSON devuelve `No se pudo cargar config.json: <motivo>`; resultado `GameConfig` congelado en profundidad
    - _Requirements: 1.5, 1.6, 1.7, 1.8, 1.10, 1.11, 1.13, 1.15, 5.15, 5.16, 16.4, 20.9_

  - [ ]* 2.3 Escribir prueba de propiedad de la validación de Configuración
    - **Property 1: Validación de Configuración según un oráculo**
    - Incluir pares `maxMessagesPerSecond`/`tick.rate`, `maxFrameBytes`/`maxMessageBytes` y Área_Interés/Área_Visible
    - **Validates: Requirements 1.5, 1.6, 1.10, 1.11, 1.13, 1.15, 5.15, 5.16**

  - [ ]* 2.4 Escribir prueba de propiedad de los valores por defecto
    - **Property 2: Los parámetros omitidos usan su valor por defecto**
    - **Validates: Requirements 1.8**

  - [ ]* 2.5 Escribir pruebas unitarias de la Configuración
    - Valores por defecto concretos; `maxFrameBytes` igual (acepta) y menor (rechaza) que `maxMessageBytes`; Área_Interés igual (acepta) y menor (rechaza) que el Área_Visible en cada eje; `config.json` coincide con `config-schema.js`; archivo ausente y JSON roto
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.7, 1.9, 1.12, 1.14, 1.15, 4.1, 5.10, 5.15, 5.16, 17.16, 23.2_

- [x] 3. Checkpoint - Base y Configuración
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Motor_Juego: geometría, Apodos, Punto_Seguro, Tanques y movimiento
  - [x] 4.1 Implementar `src/engine/geometry.js`
    - Solape estricto AABB, rayo contra AABB por slabs con eje de la cara y detección de esquina (`|tX − tY| ≤ 1e−9`), `segmentHitsRoundedRect(seg, aabb, r)` y `segmentIntersectsAabb`
    - Funciones puras, sin imports de red
    - _Requirements: 6.6, 8.2, 8.5, 8.8, 9.1, 20.5_

  - [ ]* 4.2 Escribir pruebas unitarias de geometría
    - Rayo que entra por cada cara, por una esquina exacta y que no toca; segmento tangente al rectángulo redondeado
    - _Requirements: 8.2, 8.8, 9.1_

  - [x] 4.3 Implementar `src/engine/nicknames.js`
    - `resolveNick(base, existentes, nickMax)`: comparación sin distinguir mayúsculas, sufijo con el menor n ≥ 2 libre, recortando el base para no superar `nickMax`
    - _Requirements: 3.6_

  - [ ]* 4.4 Escribir prueba de propiedad de `resolveNick`
    - **Property 4: Resolución de Apodos duplicados**
    - **Validates: Requirements 3.6**

  - [x] 4.5 Implementar `src/engine/spawn.js`
    - `findSafePoint(world, rng, maxAttempts)` según el diseño (primer candidato que cumple `safeDistance`; si no, el de mayor `dMin`; si no, `escaneoDeRespaldo` en cuadrícula de paso `tank.size`)
    - Variante para Cajas que evita Obstáculos, Tanques activos y otras Cajas y devuelve `null` tras `boxMaxAttempts`
    - _Requirements: 10.3, 10.4, 11.2, 11.3_

  - [ ]* 4.6 Escribir prueba de propiedad de `findSafePoint`
    - **Property 17: Punto_Seguro válido o el mejor evaluado**
    - **Validates: Requirements 10.3, 10.4**

  - [x] 4.7 Implementar `src/engine/tanks.js`
    - `NEUTRAL_INPUT` congelado; `createTank(...)` con `id`, `joinSeq`, `connId`, `isBot`, `nick`, `hp = maxHealth`, `score = 0`, `life`, `lastShotTick = null`, `invulnerableUntilTick = −1`, `speedMultiplier = 1`
    - `newTargetId(world, rng)`: `"t_" + hex8(hi) + hex8(lo)` con dos valores de `rng`, repetido mientras exista en `world.issuedTargetIds` (que nunca se vacía); se llama después de buscar el Punto_Seguro; el campo `targetId` se asigna una vez y no se reescribe
    - `respawnTank(...)`: vida máxima, `life += 1`, `lastShotTick = null`, invulnerabilidad hasta `tick + round(protectionS × tickRate)`; conserva `id`, Apodo, `joinSeq`, `targetId` y puntos
    - _Requirements: 3.1, 5.8, 7.8, 10.1, 10.2, 10.6, 22.10, 22.11, 22.12_

  - [x] 4.8 Implementar `src/engine/movement.js`
    - Dirección WASD normalizada, distancia `speed × speedMultiplier / tickRate`, resolución por ejes X y después Y buscando el Obstáculo más cercano en todo el recorrido, posición final exacta `límite − half`
    - Ángulo del cañón con `normalizeAngle(input.aim)`
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 23.4_

  - [ ]* 4.9 Escribir prueba de propiedad del desplazamiento libre
    - **Property 10: Desplazamiento libre según las teclas y el multiplicador**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 23.4**

  - [ ]* 4.10 Escribir prueba de propiedad del bloqueo por ejes
    - **Property 11: Bloqueo por ejes contra Paredes**
    - Incluir Obstáculos de 1–4 unidades y velocidades de hasta 5000
    - **Validates: Requirements 6.6, 6.7**

  - [ ]* 4.11 Escribir pruebas unitarias de colisiones de Tanques
    - Esquina bloqueada en ambos ejes; pared de 1 unidad a velocidad alta; contacto con el borde de la Arena
    - _Requirements: 6.6, 6.7, 6.8, 24.3_

- [x] 5. Motor_Juego: Ranking, partida y orden de fases inicial
  - [x] 5.1 Implementar `src/engine/ranking.js`
    - `computeRanking(tanks, { botsInRanking })` → `{ tables: [{ name: "tanques", entries: [{ position, id, nick, score, isBot }] }] }`, orden por puntos descendente y `joinSeq` ascendente, posiciones 1..n
    - _Requirements: 13.1, 13.2, 13.3, 13.8, 13.10, 13.11, 13.12_

  - [ ]* 5.2 Escribir prueba de propiedad del Ranking
    - **Property 20: El Ranking es una permutación ordenada de los Tanques elegibles**
    - **Validates: Requirements 13.1, 13.2, 13.9, 13.10, 13.11, 13.12**

  - [x] 5.3 Implementar `src/engine/game.js` con las primeras fases
    - `createGame({ config, rng, bots, log })` con `World` (`Map` en orden de creación, `pendingJoins` FIFO, `pendingLeaves`, `issuedTargetIds`, contador de Ticks desde 0)
    - Métodos `requestJoin` (rechaza `connId` con Tanque o alta pendiente), `requestLeave`, `setInput` (descarta si eliminado; reemplaza sin acumular), `addBot`, `step`, `getView` (copias, con `targetId`), `getRanking`, `getStaticInfo`
    - `step()` con las fases 0 (instantánea de Líder), 1 (bajas: retirar Tanque y sus Balas, liberar Apodo y plaza), 2 (altas en orden de llegada con límite `players.max` excluyendo Bots, `resolveNick`, Punto_Seguro, `targetId`, eventos `joined`/`rejected`), 3 (reapariciones), 4 (fin de invulnerabilidad), 7 (Input efectivo o neutro), 8 (movimiento) y 16 (Ranking final, Tick + 1, `TickResult`)
    - Solo usa `config` y `rng`; sin `Math.random`, `Date.now`, `performance.now` ni `crypto`
    - _Requirements: 3.1, 3.2, 3.6, 3.8, 4.2, 4.4, 4.5, 4.7, 4.8, 5.3, 5.4, 5.6, 5.8, 7.7, 10.1, 10.6, 13.3, 16.1, 16.5, 16.6, 22.10, 24.1, 24.2_

  - [x] 5.4 Crear los ayudantes de partidas de prueba
    - `test/helpers/game-factory.js`: Configuración de prueba válida (Arena pequeña), `makeGame(seed, overrides)` y utilidades para avanzar Ticks
    - `test/helpers/arbitraries.js`: `arbConfig()`, `arbWorld()`, `arbInput()`, `arbInputSequence(n)` y `arbOps()` (`join`, `leave`, `input`, `effect`, `step`, con Apodos de un conjunto pequeño para repetir Apodos de Tanques presentes y retirados)
    - _Requirements: 24.4_

  - [ ]* 5.5 Escribir prueba de propiedad de las altas
    - **Property 5: Una alta crea un Tanque nuevo sin alterar los existentes**
    - **Validates: Requirements 3.1, 3.2**

  - [ ]* 5.6 Escribir prueba de propiedad del límite de Jugadores
    - **Property 6: El límite de Jugadores se respeta en orden de llegada**
    - **Validates: Requirements 4.2, 4.4, 4.5, 4.7, 4.8**

  - [ ]* 5.7 Escribir prueba de propiedad del último Input
    - **Property 7: Solo se aplica el último Input recibido entre Ticks**
    - **Validates: Requirements 5.3**

  - [ ]* 5.8 Escribir prueba de propiedad de la normalización del cañón
    - **Property 13: Normalización del ángulo del cañón**
    - **Validates: Requirements 6.9**

- [x] 6. Motor_Juego: disparo, Balas, impactos y puntuación
  - [x] 6.1 Implementar el disparo en `src/engine/bullets.js` y añadir la fase 9 a `game.js`
    - Recarga comparada en Ticks enteros (`ceil(reloadMs × tickRate / 1000)`), máximo de Balas propias, punta del cañón fuera de Obstáculos agrandados y dentro de `[r, W − r] × [r, H − r]`
    - Bala `{ id, ownerId, ownerNick, ownerLife, x, y, vx, vy, bounces: 0, bornTick }`; `lastShotTick = tick`; fin de invulnerabilidad solo si se crea la Bala
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.8, 7.9, 7.10, 7.11_

  - [ ]* 6.2 Escribir prueba de propiedad de la cadencia de disparo
    - **Property 14: Cadencia de disparo según un modelo**
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 7.6**

  - [ ]* 6.3 Escribir pruebas unitarias del disparo
    - Punta dentro de un Obstáculo; disparo inmediato tras reaparecer; la invulnerabilidad termina al disparar y no si el disparo se ignora; Inputs ignorados mientras está eliminado
    - _Requirements: 7.7, 7.8, 7.9, 7.10, 7.11_

  - [x] 6.4 Implementar el barrido con rebotes en `src/engine/bullets.js` y añadir la fase 11 a `game.js`
    - `advanceBullet`: tiempo de vida en Ticks, distancia `bulletSpeed / tickRate`, `primerContacto` con suma de Minkowski y `ε = 1e−9`, esquina invierte ambas componentes, eliminación al tocar con `bounces == maxBounces`, contactos acotados por `maxBounces + 1`
    - Guardar `path` (segmentos con su contador de rebotes) solo durante el Tick; las Balas creadas en el Tick no avanzan
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8_

  - [ ]* 6.5 Escribir prueba de propiedad del barrido
    - **Property 15: El barrido conserva distancia y rapidez**
    - **Validates: Requirements 8.1, 8.2, 8.4**

  - [ ]* 6.6 Escribir pruebas unitarias de rebotes
    - Pasillo con varios contactos en un Tick; esquina exacta cuenta un rebote; eliminación al agotar rebotes; tiempo de vida
    - _Requirements: 8.3, 8.6, 8.7, 8.8, 24.3_

  - [x] 6.7 Implementar `src/engine/hits.js` y añadir la fase 12 a `game.js`
    - Recorrer Balas en orden de creación y sus segmentos; descartar emisor si `bounces == 0`, si `selfDamage == false` o si `ownerLife` no coincide; menor `t` (empate: creado antes); invulnerable elimina sin daño; `hp ≤ 0` → 0 y marca "eliminado en este Tick"; Balas siguientes ignoran Tanques ya eliminados
    - _Requirements: 9.1, 9.2, 9.3, 9.5, 9.6, 9.7, 10.1, 10.7_

  - [ ]* 6.8 Escribir prueba de propiedad de impactos
    - **Property 16: Una Bala que cruza a otro Tanque lo daña**
    - **Validates: Requirements 9.1**

  - [x] 6.9 Implementar `src/engine/scoring.js` y añadir la fase 13 a `game.js`
    - Pérdida `floor(score × pct / 100)`, puntos al autor presente y distinto, bonificación si la víctima era el Líder de la fase 0 (tabla con solo Tanques elegibles; sin Líder si está vacía)
    - Marcar `dead`, `deadTick`, `deathPos`, `lastInput = NEUTRAL_INPUT`; evento `kill { victimNick, killerNick }` con el Apodo guardado en la Bala
    - _Requirements: 9.3, 9.4, 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8, 12.9, 20.11_

  - [ ]* 6.10 Escribir prueba de propiedad de la puntuación
    - **Property 19: Puntuación según un oráculo**
    - **Validates: Requirements 12.1, 12.2, 12.3, 12.4, 12.6, 12.7, 12.8, 12.9**

  - [ ]* 6.11 Escribir pruebas unitarias de impactos, reaparición y puntuación
    - Daño propio con y sin rebote, con la opción activada y desactivada; invulnerable; dos Balas sobre un Tanque con 1 de vida; `kill` con autor desconectado
    - Reaparición: tiempo, vida, conservación de datos, `inv` y fin de invulnerabilidad por tiempo, invulnerabilidad al moverse o recoger Cajas
    - Ejemplos 7 → 4 y 1 → 1; Tanque eliminado sigue en el Ranking y el retirado no
    - _Requirements: 9.2, 9.4, 9.5, 9.6, 9.7, 10.1, 10.2, 10.7, 10.9, 10.10, 12.3, 13.3, 24.3_

- [x] 7. Motor_Juego: Cajas
  - [x] 7.1 Implementar `src/engine/boxes.js` y añadir las fases 10 y 15 a `game.js`
    - Aparición con `ref = max(lastBoxSpawnTick, belowMaxSinceTick)` e intervalo `round(intervalS × tickRate)`; `lastBoxSpawnTick` se actualiza aunque falle
    - Recogida por Tanques activos (invulnerables incluidos), gana el menor `joinSeq`, suma `boxPoints`, evento `boxPicked { tankId, kind: "puntos" }`
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7_

  - [ ]* 7.2 Escribir prueba de propiedad de la aparición de Cajas
    - **Property 18: Aparición de Cajas acotada, espaciada y en lugar libre**
    - **Validates: Requirements 11.1, 11.2**

  - [ ]* 7.3 Escribir pruebas unitarias de Cajas
    - Sin posición válida; empate de recogida; Tanque eliminado no recoge; evento `boxPicked` único
    - _Requirements: 11.3, 11.5, 11.6, 11.7_

- [x] 8. Checkpoint - Núcleo del Motor_Juego
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Sistema_Efectos y Efecto_Ralentizar
  - [x] 9.1 Implementar `src/effects/effect-context.js`
    - `createEffectContext(...)` congelado con exactamente `getPosition` (objeto nuevo), `getHealth`, `getScore`, `getNick`, `getTargetId`, `getTick`, `getRemainingMs`, `getSpeedMultiplier` (aridad 0) y `setSpeedMultiplier(v)` (aridad 1)
    - `getTargetId()` devuelve el Identificador_Objetivo del Tanque objetivo; ninguna operación recibe identificadores
    - `setSpeedMultiplier`: rechaza y registra no finitos con el nombre del Efecto; guarda `clamp(v, min, max)`; ignora escrituras si el Efecto está retirado
    - _Requirements: 22.1, 22.2, 22.3, 22.4, 22.5, 22.7, 22.8, 22.9_

  - [x] 9.2 Implementar `src/effects/effect-system.js`
    - `request(def, targetId, durationMs, tick)` con errores `DURATION_NOT_INTEGER`, `DURATION_OUT_OF_RANGE`, `TARGET_NOT_FOUND`, `TARGET_ELIMINATED`; `applyPending()` con `onActivate` por `activationSeq`; `modifyInput(tankId, input)` encadenado con `validateInput` y copia campo a campo; `tickAll()` con `onTick`, `elapsedTicks += 1` y expiración; `endForTarget(tankId)`; `activeFor(tankId)` con `remainingMs = max(0, ceil(durationMs − elapsedMs))`
    - Cada hook en `try/catch`; excepción → registro `[efecto <nombre>] <error>`, `onEnd` protegido una vez y retirada; `retired = true` justo después de `onEnd`
    - _Requirements: 21.1, 21.2, 21.3, 21.4, 21.5, 21.6, 21.7, 21.8, 21.9, 21.10, 22.6_

  - [x] 9.3 Conectar el Sistema_Efectos con `game.js`
    - `game.activateEffect(def, targetTankId, durationMs)`; fase 5 (`applyPending`, descartando y registrando objetivos ya inactivos); fase 7 pasa el Input por `modifyInput`; fase 14 (`tickAll`); `endForTarget` en las fases 1 y 13; `effects` de cada Tanque en `getView()`
    - _Requirements: 16.2, 21.1, 21.3, 21.4, 21.5, 21.7, 21.10, 22.3_

  - [ ]* 9.4 Escribir prueba de propiedad del número de Efectos activos
    - **Property 32: Número de Efectos activos según un modelo**
    - **Validates: Requirements 21.1, 21.6, 21.11**

  - [ ]* 9.5 Escribir prueba de propiedad de activaciones inválidas
    - **Property 33: Las activaciones inválidas se rechazan sin cambios**
    - **Validates: Requirements 21.2**

  - [ ]* 9.6 Escribir prueba de propiedad del encadenado de modificadores
    - **Property 34: Encadenado de modificadores de Input**
    - **Validates: Requirements 21.3, 21.8, 22.6**

  - [ ]* 9.7 Escribir prueba de propiedad del Multiplicador_Velocidad
    - **Property 35: Escritura acotada del Multiplicador_Velocidad**
    - **Validates: Requirements 22.3, 22.5, 22.7**

  - [x] 9.8 Implementar `src/effects/builtin/slow.js` y el modo de depuración
    - `createSlowEffect({ factor })` con `Map<targetId, count>` en el cierre: `onActivate` suma 1 y fija `factor`; `onEnd` resta 1, borra la entrada y restaura 1 al llegar a 0, o mantiene `factor`
    - `game.js` crea una definición por partida; en la fase 10, con `config.debug`, por cada `boxPicked` elige con `rng` un Tanque activo distinto (ordenados por `joinSeq`) y solicita el Efecto_Ralentizar con `effects.slow.durationMs`; sin candidatos no hace nada
    - _Requirements: 23.1, 23.3, 23.5, 23.6, 23.7, 23.8, 23.9, 23.10_

  - [ ]* 9.9 Escribir prueba de propiedad del Efecto_Ralentizar
    - **Property 36: Efecto_Ralentizar acumulado por Identificador_Objetivo**
    - **Validates: Requirements 23.3, 23.5, 23.8, 23.9, 23.10**

  - [ ]* 9.10 Escribir prueba de propiedad del Identificador_Objetivo
    - **Property 39: El Identificador_Objetivo es constante y único**
    - Usar `arbOps()` con Apodos repetidos, incluido el de Tanques retirados, y Bots
    - **Validates: Requirements 22.2, 22.11, 22.12, 22.14**

  - [ ]* 9.11 Escribir pruebas unitarias del Sistema_Efectos
    - Orden `onActivate` → `modifyInput` → `onTick` con registro de llamadas; excepción en cada hook; objetivo eliminado o retirado; `effects` en la vista; claves y aridades del Contexto_Efecto; mutar `getPosition()` no altera nada; escritura tras retirada
    - `targetId` con un `rng` falso: valor esperado, independiente del Apodo, y regeneración cuando el `rng` repite valores
    - Dos partidas en la misma prueba no comparten la cuenta del Efecto_Ralentizar; ralentiza desde el primer Tick y restaura; modo de depuración con y sin otro Tanque
    - _Requirements: 16.2, 21.4, 21.5, 21.7, 21.8, 21.9, 21.10, 22.1, 22.2, 22.4, 22.8, 22.9, 22.10, 22.11, 23.1, 23.5, 23.6, 23.7, 23.10, 24.3_

- [x] 10. Controlador_Bots
  - [x] 10.1 Implementar `src/bots/bot-controller.js`
    - `createBotController({ config, rng })` con `init(game)` (crea `"Bot 1"`…`"Bot N"`) e `inputsFor(view)` (un Input por Bot activo, ninguno para eliminados)
    - Objetivo visible más cercano con línea de visión (empate: menor `joinSeq`), nuevo destino por llegada o tiempo, dirección entre las 8 WASD, esquiva con rayo de longitud `half + detectDistance` y orden fijo, opuesta si ninguna está libre
    - Solo importa funciones puras de `engine/geometry.js` y `shared/`
    - _Requirements: 20.1, 20.2, 20.3, 20.4, 20.5, 20.6, 20.7, 20.8, 20.9_

  - [x] 10.2 Conectar el Controlador_Bots con `game.js`
    - Fase 6: guardar los Inputs de `inputsFor` como Input más reciente de cada Bot; los Bots usan las mismas reglas que los Jugadores y llevan `isBot = true`
    - _Requirements: 20.3, 20.8, 20.10, 20.11_

  - [ ]* 10.3 Escribir prueba de propiedad de los Inputs de Bots
    - **Property 30: Inputs de Bots válidos y apuntado al objetivo visible más cercano**
    - **Validates: Requirements 20.3, 20.5, 20.6**

  - [ ]* 10.4 Escribir prueba de propiedad de la esquiva
    - **Property 31: Los Bots esquivan las Paredes**
    - **Validates: Requirements 20.4**

  - [ ]* 10.5 Escribir pruebas unitarias de Bots
    - Creación de N Bots y 0 por defecto; Apodos `"Bot 1"`…; nuevo destino por llegada o por tiempo; indicador `bot`
    - _Requirements: 20.1, 20.2, 20.7, 20.9, 20.10, 20.11_

  - [ ]* 10.6 Escribir prueba de propiedad de los invariantes del mundo
    - **Property 12: Invariantes del mundo tras cada Tick**
    - Simulaciones con Bots, Cajas y Configuraciones aleatorias
    - **Validates: Requirements 6.8, 7.6, 8.5, 8.6, 9.3, 12.5**

  - [ ]* 10.7 Escribir prueba de propiedad de reproducibilidad
    - **Property 37: Reproducibilidad del Motor_Juego**
    - Dos partidas con la misma semilla, Configuración y `arbOps()` (altas, bajas, Inputs, activaciones de Efectos) con Bots; comparar Tanques, Balas, Cajas y Ranking tras cada Tick
    - **Validates: Requirements 24.7, 5.6**

- [x] 11. Checkpoint - Motor completo con Efectos y Bots
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Protocolo e interpolación compartidos
  - [x] 12.1 Implementar `src/shared/protocol.js`
    - `MESSAGE_TYPES`, `encode(message)`, `decode(text)` total (sin excepciones) con validador recursivo de esquemas sin dependencias y motivos `NOT_JSON`, `NOT_OBJECT`, `BAD_ENVELOPE`, `UNKNOWN_TYPE`, `BAD_DATA:<campo>`
    - Esquemas de `join`, `input` (conserva solo campos conocidos), `welcome` con `view: { w, h }`, `spectatorWelcome`, `state`, `ranking`, `error`
    - _Requirements: 5.2, 14.1, 14.2, 14.3, 14.7_

  - [ ]* 12.2 Escribir prueba de propiedad de ida y vuelta
    - **Property 21: Ida y vuelta del Codificador_Mensajes**
    - Generador local `arbMessage()` para todos los tipos
    - **Validates: Requirements 14.1, 14.2, 14.4**

  - [ ]* 12.3 Escribir prueba de propiedad de `decode` total
    - **Property 22: `decode` es total y rechaza lo inválido**
    - **Validates: Requirements 14.3, 5.2**

  - [ ]* 12.4 Escribir pruebas unitarias del Codificador_Mensajes
    - Un ejemplo por cada motivo de rechazo
    - _Requirements: 14.3, 24.3_

  - [x] 12.5 Implementar `src/shared/interpolation.js`
    - `createStateBuffer({ tickRate, interpolationDelayMs, maxStates })` con `push` (descarta Tick ≤ último), `renderTime` y `sample` (A/B, sin extrapolar, sin interpolar entidades nuevas o que reaparecen, dejar de dibujar las que desaparecen o están eliminadas)
    - `interpolatePosition` exacta en f = 0 y f = 1; reexportar `lerp` y `lerpAngle`
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 18.6, 18.7, 19.6_

  - [ ]* 12.6 Escribir prueba de propiedad de la posición interpolada
    - **Property 26: La posición interpolada está en el segmento**
    - **Validates: Requirements 18.2, 18.8**

  - [ ]* 12.7 Escribir prueba de propiedad de la interpolación angular
    - **Property 27: Interpolación angular por el camino más corto**
    - **Validates: Requirements 18.3**

  - [ ]* 12.8 Escribir pruebas unitarias de interpolación
    - Fórmula del instante de render; sin B no extrapola; entidad nueva o que reaparece; entidad que desaparece; Tick antiguo descartado
    - _Requirements: 18.1, 18.4, 18.5, 18.6, 18.7, 24.3_

- [x] 13. Servidor_Juego
  - [x] 13.1 Implementar `src/server/rate-limiter.js`
    - `createRateLimiter({ maxPerSecond, maxConsecutive, now, openedAt })` → `accept() → { deliver, close }` con ventanas fijas desde la apertura, reinicio de `consecutive` en ventanas no excedidas o saltadas y reloj inyectable
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5_

  - [ ]* 13.2 Escribir prueba de propiedad del Limitador_Mensajes
    - **Property 24: Limitador_Mensajes según un modelo**
    - Generador local `arbArrivalTimes()` con ráfagas y huecos
    - **Validates: Requirements 15.1, 15.2, 15.3, 15.4, 15.5**

  - [ ]* 13.3 Escribir pruebas unitarias del Limitador_Mensajes
    - 90 entregados y el 91 descartado; cierre en la tercera ventana; reinicio tras una ventana vacía
    - _Requirements: 15.2, 15.3, 15.4, 24.3_

  - [x] 13.4 Implementar `src/server/snapshot.js`
    - `interestRect` con `clampWindow` por eje, centrado en la posición final del Tick o en `deathPos`
    - `buildPlayerState` (Tanque propio + Tanques activos, Balas y Cajas dentro del rectángulo con bordes incluidos, filtrando con posiciones sin redondear; `kills` sin filtrar; `respawnTick` solo en el propio eliminado), `buildSpectatorState` (todo), `buildRanking` (top 10 por tabla y `you`)
    - `toTankState(tank)` con lista blanca `id, nick, x, y, angle, hp, score, dead, bot, inv, effects`, nunca `{ ...tank }`; redondeo de `x, y` a 0,1 y `angle` a 0,001
    - _Requirements: 5.4, 5.11, 5.12, 5.13, 5.14, 9.4, 10.8, 10.10, 13.6, 21.10, 22.13_

  - [ ]* 13.5 Escribir prueba de propiedad del Área_Interés
    - **Property 8: El estado de un Jugador contiene exactamente su Área_Interés**
    - **Validates: Requirements 5.11, 5.13, 5.14**

  - [ ]* 13.6 Escribir prueba de propiedad de la exclusión del Identificador_Objetivo
    - **Property 40: El Identificador_Objetivo nunca sale del servidor**
    - Construir `welcome`, `spectatorWelcome`, `state`, `ranking` y `error` desde simulaciones aleatorias y comprobar claves y subcadenas
    - **Validates: Requirements 22.13**

  - [x] 13.7 Implementar `src/server/http-static.js`
    - Solo `GET`/`HEAD`; rutas `/`, `/<archivo>`, `<spectatorPath>`, `<spectatorPath>/<archivo>`, `/shared/<archivo>`; `path.resolve` con comprobación de carpeta base y lista blanca de extensiones; `Content-Type` y `X-Content-Type-Options: nosniff`; 404/500 sin afectar la partida
    - _Requirements: 2.3, 2.4, 2.7_

  - [x] 13.8 Implementar `src/server/heartbeat.js`
    - Cada `heartbeatIntervalMs`: `terminate()` si `ahora − lastPongAt > heartbeatTimeoutMs`, si no `ws.ping()`; el evento `pong` actualiza `lastPongAt`
    - _Requirements: 16.3, 16.4_

  - [x] 13.9 Implementar `src/server/ws-gateway.js`
    - `Connection { id, role, ws, tankId, joinPending, limiter, lastPongAt }`; procesamiento en orden: limitador (cierre `4008 "exceso de mensajes"`), `data.length > maxMessageBytes` en bytes del `Buffer` → descartar sin convertir a texto y registrar `{ connId, bytes }` manteniendo la conexión, binarios descartados, `decode` con registro `{ connId, reason }` recortado a 80 caracteres, enrutado por rol y tipo
    - Evento `close` (también con 1009 de `ws` por `maxFrameBytes`, 4008 y `terminate()`): registrar y `game.requestLeave(id)`; espectadores se quitan de los destinatarios
    - Tras cada `step()`: `welcome` con `tankId`, `nick`, `arena`, `view: { w, h }`, `obstacles` y `config` antes del primer `state`; `error GAME_FULL`; `state` por conexión; `ranking` por tiempo ≥ 1 s, por cambio en la firma del top 10 o al entrar, como máximo uno por conexión y Tick; `spectatorWelcome` al conectar un espectador
    - Manejadores de `message` en `try/catch`
    - _Requirements: 3.5, 3.7, 3.8, 4.2, 4.3, 4.6, 5.2, 5.4, 5.5, 5.7, 5.9, 9.4, 14.5, 14.6, 14.8, 14.9, 15.3, 16.1, 16.7, 17.16, 19.4, 19.5, 22.13_

  - [ ]* 13.10 Escribir pruebas unitarias de la pasarela con sockets falsos
    - `welcome` antes del primer `state` y con `view` de la Configuración; `join` repetido; `GAME_FULL` y reintento; espectadores fuera del conteo; Ranking por tiempo, por cambio en el top 10 y al entrar
    - Mensajes de `maxMessageBytes` y `maxMessageBytes + 1` bytes: el primero se procesa, el segundo se descarta, cuenta en el Limitador_Mensajes y la conexión sigue; `close` con 1009 retira el Tanque; mensaje inválido registrado sin cerrar; bajas y liberación de Apodo
    - _Requirements: 3.7, 3.8, 4.3, 4.6, 5.5, 5.7, 5.9, 14.5, 14.6, 14.9, 16.1, 16.5, 16.6, 16.7, 19.5_

  - [ ]* 13.11 Escribir pruebas unitarias de la comprobación de conexión
    - `mock.timers` de `node:test`: ping cada 10 s y cierre a los 30 s sin pong
    - _Requirements: 16.3, 16.4_

  - [x] 13.12 Implementar `src/server/tick-loop.js`
    - Paso fijo con `setTimeout` a `inicio + n × dt` y `performance.now()` inyectables, recuperación de hasta 5 Ticks seguidos, descarte del atraso con aviso, llamada a la pasarela tras cada `step()`, registro de excepciones con pila y parada con código 1 tras 10 fallos seguidos
    - _Requirements: 5.1, 5.6_

  - [ ]* 13.13 Escribir pruebas unitarias del bucle de Ticks
    - Reloj y temporizadores falsos: entre 294 y 306 Ticks en 10 s simulados con retrasos aleatorios
    - _Requirements: 5.1_

  - [x] 13.14 Implementar `src/server/main.js` y `src/server/start.js`
    - `main.js`: comprueba `process.versions.node` (mensaje `Se requiere Node.js 24 o superior (versión actual: X)` y código 1) y después `await import("./start.js")`
    - `start.js`: `loadConfig` (errores y código 1 sin abrir puerto), `mulberry32(Date.now() >>> 0)`, Controlador_Bots, `createGame`, `bots.init(game)`, `http.Server` con `http-static`, `WebSocketServer({ noServer: true, maxPayload: config.network.maxFrameBytes, perMessageDeflate: false })`, enrutado de `upgrade` a `/ws/jugador` y `/ws/espectador` (otras rutas `socket.destroy()`), heartbeat, `EADDRINUSE` → `El puerto <p> está ocupado por otro proceso` y código 1, URLs del juego y del espectador en consola, inicio del bucle de Ticks
    - _Requirements: 1.5, 1.6, 1.7, 2.1, 2.5, 2.6, 2.8, 14.9, 20.1, 24.2_

  - [ ]* 13.15 Escribir pruebas de integración del servidor
    - `child_process.spawn` sobre `main.js` con un `config.json` temporal en un puerto libre (`TANK_CONFIG`): arranque en < 5 s; `GET /` y `GET /espectador` 200; `GET /no-existe` y `GET /../package.json` 404; URLs impresas; puerto ocupado; Configuración inválida sin abrir el puerto
    - Cliente `ws` real entra con Apodo y recibe `welcome` (con `view`), `state` y `ranking`; espectador recibe la Arena completa; trama de `maxFrameBytes + 1` bytes recibe cierre 1009 y otro cliente deja de ver ese Tanque desde el siguiente Tick
    - _Requirements: 1.6, 2.1, 2.3, 2.4, 2.5, 2.6, 2.7, 3.7, 14.9, 16.1, 19.4_

- [x] 14. Checkpoint - Servidor_Juego
  - Ensure all tests pass, ask the user if questions arise.

- [x] 15. Cliente_Juego
  - [x] 15.1 Implementar `src/client/input-sampler.js` (puro, sin DOM)
    - `createInputSampler()` con `setKey`, `setFire`, `setAim`, `releaseAll` y `flush() → Input | null` (envío del estado si cambió, Input con botones invertidos más seguimiento pendiente si un botón cambió y volvió, `null` sin cambios)
    - _Requirements: 17.5, 17.6, 17.9, 17.11, 17.12_

  - [ ]* 15.2 Escribir prueba de propiedad de la agrupación de Inputs
    - **Property 25: Agrupación de Inputs del cliente sin perder pulsaciones**
    - **Validates: Requirements 17.5, 17.6, 17.9, 17.11, 17.12**

  - [x] 15.3 Implementar `src/client/camera.js` (puro, sin DOM)
    - `computeCamera(canvas, view, arena, focus)` con `scale = min(canvas.w/view.w, canvas.h/view.h)`, Franjas `ox`, `oy` iguales a ambos lados y origen con `clampWindow` de `shared/math.js` (Arena centrada si es menor que el Área_Visible)
    - `worldToScreen`, `screenToWorld` (inversas, válidas también sobre las Franjas) y `visibleWorldRect`
    - _Requirements: 17.2, 17.3, 17.4, 17.7, 17.14, 17.17, 17.19_

  - [ ]* 15.4 Escribir prueba de propiedad de la cámara
    - **Property 38: La cámara muestra un Área_Visible fija dentro de la Arena**
    - Generador local `arbCameraCase()` (Canvas de 1 × 1 a 7680 × 4320, proporciones extremas, Arena menor que el Área_Visible en un eje, punto del Canvas incluido sobre Franjas)
    - **Validates: Requirements 17.2, 17.7, 17.14, 17.17, 17.19**

  - [ ]* 15.5 Escribir pruebas unitarias de la cámara y el apuntado
    - Canvas 1920 × 1080 da Franjas laterales y 1280 × 1024 superiores; Arena menor centrada; tras cambiar el tamaño del Canvas el Área_Visible no cambia; foco fijo mientras está eliminado; ángulo con `screenToWorld` con el cursor dentro del Área_Visible y sobre una Franja
    - _Requirements: 17.2, 17.3, 17.4, 17.7, 17.14, 17.17_

  - [x] 15.6 Implementar `src/client/render.js`
    - Exportar funciones puras sin acceso al DOM al importar (`tankColor(categoría)` con `#43a047`, `#1e88e5`, `#9e9e9e`; `botLabel(score)` → `BOT · <puntos>`; `hpBarWidth(hp, maxHp, barW)`)
    - `drawFrame(ctx, cam, escena, dpr)`: `dpr = min(devicePixelRatio, 2)`; Franjas `#202020` en toda la superficie; `save`, recorte al rectángulo del Área_Visible, `setTransform(dpr·scale, 0, 0, dpr·scale, dpr·(ox − originX·scale), dpr·(oy − originY·scale))`; fondo `#2e3b2e`, Obstáculos, Cajas, Balas y Tanques visibles con Apodo, barra de vida, etiqueta de Bot y marca de invulnerable (anillo blanco parpadeante, transparencia 0,6); `restore` y `setTransform(dpr, 0, 0, dpr, 0, 0)` para el HUD; saltar entidades fuera de `visibleWorldRect`
    - _Requirements: 10.8, 17.1, 17.8, 17.13, 17.14, 17.15, 17.17, 17.18_

  - [x] 15.7 Implementar `src/client/hud.js`
    - Funciones puras `rankingLines(ranking)` (top 10 y línea propia si `you.position > 10`, marca `BOT` si `bot = true`) y `countdownSeconds(respawnTick, tickEstimado, tickRate)` con `ceil`
    - Dibujo en coordenadas de pantalla con letra base de 14 px CSS: Ranking, cuenta regresiva y aviso de desconexión
    - _Requirements: 10.5, 13.4, 13.5, 13.7, 13.13, 17.18_

  - [x] 15.8 Crear `src/client/index.html` y `src/client/main.js`
    - Pantallas de Apodo (errores `NICK_*` y `GAME_FULL` bajo el formulario), juego (Canvas a tamaño de ventana) y desconexión con botón "Volver a entrar" que abre una conexión nueva
    - Conexión a `/ws/jugador`; `welcome` fija `view`, Arena, Obstáculos y `config`; búfer de estados de `shared/interpolation.js`; Ranking reemplazado al recibirlo
    - `setInterval(1000 / tickRate)` con `flush()` y control de `performance.now()`; `blur` → `releaseAll()`; ángulo `atan2` desde la posición interpolada del Tanque al punto `screenToWorld` del cursor; foco de cámara fijo al morir; `resize` actualiza el búfer del Canvas (`innerWidth × dpr`) y la cámara antes del siguiente cuadro; bucle de dibujo con `requestAnimationFrame`
    - _Requirements: 3.7, 10.5, 13.7, 17.1, 17.2, 17.3, 17.4, 17.5, 17.7, 17.9, 17.10, 17.17, 18.1_

  - [ ]* 15.9 Escribir pruebas unitarias de los módulos puros del cliente
    - Cuenta regresiva; líneas del Ranking con y sin línea propia y marca `BOT`; color por categoría; etiqueta `BOT · puntos`; ancho de la barra de vida; tamaño de letra del HUD ≥ 14 px
    - _Requirements: 10.5, 13.4, 13.5, 13.13, 17.1, 17.8, 17.13, 17.18_

- [x] 16. Vista_Espectador
  - [x] 16.1 Implementar `src/spectator/kill-feed.js` (puro)
    - Cola con expiración `ahora + 5000`, máximo 5 avisos, retirada del más antiguo al llegar el sexto
    - _Requirements: 19.7_

  - [ ]* 16.2 Escribir prueba de propiedad de los avisos de eliminación
    - **Property 29: Avisos de eliminación de la Vista_Espectador**
    - **Validates: Requirements 19.7**

  - [x] 16.3 Implementar `src/spectator/render.js`
    - Función pura `spectatorTransform(vw, vh, W, H)` con `s = min(vw/W, vh/H)` y desplazamiento centrado
    - Dibujo de la Arena completa con Obstáculos, Tanques (Apodo, barra de vida, colores `#1e88e5` y `#9e9e9e`, `BOT · <puntos>`, marca de invulnerable), Balas y Cajas; panel de Ranking con letra de 24 px, una sección por Tabla_Ranking con nombre, hasta 10 entradas y marca `BOT`; avisos de `kill-feed`
    - _Requirements: 10.8, 19.1, 19.2, 19.3, 19.7, 19.9_

  - [ ]* 16.4 Escribir prueba de propiedad de la escala del espectador
    - **Property 28: La Vista_Espectador muestra la Arena completa con escala única**
    - **Validates: Requirements 19.1**

  - [x] 16.5 Crear `src/spectator/index.html` y `src/spectator/main.js`
    - Conexión a `/ws/espectador`, `spectatorWelcome`, búfer de interpolación con el mismo retardo, `resize` recalcula la escala, reconexión con `setTimeout(conectar, 3000)` mostrando "Desconectado, reintentando…" y vaciando el búfer al reconectar
    - _Requirements: 19.2, 19.4, 19.6, 19.8_

  - [ ]* 16.6 Escribir pruebas unitarias de la Vista_Espectador
    - Reconexión cada 3 s con temporizadores falsos (lógica de reconexión extraída como función con `setTimeout` inyectable); tamaño de letra ≥ 1,5 × 14 px
    - _Requirements: 19.3, 19.8_

- [x] 17. README y pruebas de estructura
  - [x] 17.1 Escribir `README.md`
    - Una línea por carpeta (`src/engine`, `src/server`, `src/client`, `src/spectator`, `src/shared`, `src/effects`, `src/bots`, `test`), qué hacen `npm start` y `npm test`, y la lista corta de comprobación manual (dos pestañas y espectador con 5 Bots, redimensionar, cambiar de pestaña con una tecla pulsada, cortar la red)
    - _Requirements: 24.8, 24.9_

  - [x]* 17.2 Escribir pruebas de humo de estructura
    - `package.json` con `"type": "module"`, `engines.node >= 24` y solo `ws` en `dependencies`; el grafo de imports de `src/engine`, `src/effects` y `src/bots` no alcanza `ws`, `node:http`, `node:net` ni `src/server`; esas carpetas no contienen `Math.random`, `Date.now`, `performance.now` ni `crypto`; existen las carpetas del criterio 24.8; el README menciona cada carpeta, `npm start` y `npm test`
    - _Requirements: 2.2, 24.1, 24.2, 24.8, 24.9_

- [x] 18. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Las tareas marcadas con `*` son opcionales y se pueden omitir para un MVP más rápido. Las propiedades exigidas por el Req. 24.4 son la 8 (tarea 13.5), la 20 (5.2), la 21 (12.2), la 38 (15.4), la 26 (12.6), la 32 (9.4), la 39 (9.10) y la 37 (10.7); conviene no omitirlas si se quiere cumplir ese criterio.
- Cada tarea cita criterios concretos para la trazabilidad; cada prueba de propiedad cita su número de Property del diseño.
- Las tareas que tocan `src/engine/game.js` están en oleadas distintas porque cada una añade su fase a `step()`.
- Los generadores específicos de una sola propiedad (`arbNickCandidate`, `arbMessage`, `arbArrivalTimes`, `arbCameraCase`) se definen en su archivo de prueba; los compartidos viven en `test/helpers/arbitraries.js` (tarea 5.4).
- La comprobación visual del Canvas, los colores en pantalla y la fluidez quedan en la lista de verificación manual del README; no son tareas de código.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.4", "1.8", "2.1"] },
    { "id": 2, "tasks": ["1.3", "1.5", "1.6", "1.7", "2.2", "4.1", "4.3"] },
    { "id": 3, "tasks": ["2.3", "2.4", "2.5", "4.2", "4.4", "4.5", "5.1"] },
    { "id": 4, "tasks": ["4.6", "4.7", "4.8", "5.2"] },
    { "id": 5, "tasks": ["4.9", "4.10", "4.11", "5.3"] },
    { "id": 6, "tasks": ["5.4"] },
    { "id": 7, "tasks": ["5.5", "5.6", "5.7", "5.8", "6.1"] },
    { "id": 8, "tasks": ["6.2", "6.3", "6.4"] },
    { "id": 9, "tasks": ["6.5", "6.6", "6.7"] },
    { "id": 10, "tasks": ["6.8", "6.9"] },
    { "id": 11, "tasks": ["6.10", "6.11", "7.1"] },
    { "id": 12, "tasks": ["7.2", "7.3", "9.1"] },
    { "id": 13, "tasks": ["9.2"] },
    { "id": 14, "tasks": ["9.3"] },
    { "id": 15, "tasks": ["9.4", "9.5", "9.6", "9.7", "9.8"] },
    { "id": 16, "tasks": ["9.9", "9.10", "9.11", "10.1"] },
    { "id": 17, "tasks": ["10.2"] },
    { "id": 18, "tasks": ["10.3", "10.4", "10.5", "10.6", "10.7", "12.1", "12.5"] },
    { "id": 19, "tasks": ["12.2", "12.3", "12.4", "12.6", "12.7", "12.8", "13.1", "13.4", "13.7", "13.8"] },
    { "id": 20, "tasks": ["13.2", "13.3", "13.5", "13.6", "13.9", "13.11", "13.12"] },
    { "id": 21, "tasks": ["13.10", "13.13", "13.14"] },
    { "id": 22, "tasks": ["13.15", "15.1", "15.3", "16.1"] },
    { "id": 23, "tasks": ["15.2", "15.4", "15.5", "15.6", "15.7", "16.2", "16.3"] },
    { "id": 24, "tasks": ["15.8", "16.4", "16.5"] },
    { "id": 25, "tasks": ["15.9", "16.6", "17.1"] },
    { "id": 26, "tasks": ["17.2"] }
  ]
}
```
