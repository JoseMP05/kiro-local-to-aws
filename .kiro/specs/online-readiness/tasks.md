# Implementation Plan: online-readiness

## Tasks

- [x] 1. Contrato de despliegue
  - [x] 1.1 `PORT`, `HOST` y `GET /health` en `src/server/start.js`
    - _Requirements: 1.1, 1.2, 1.3, 1.4_
  - [x] 1.2 Métricas de Tick (`onTickDuration`) y apagado ordenado
    - _Requirements: 1.4, 1.5_
  - [x] 1.3 `Dockerfile`, `.dockerignore` y `packageManager` en `package.json`
    - _Requirements: 1.6_
  - [x] 1.4 README con el Contrato_Despliegue
    - _Requirements: 1.7_
  - [x] 1.5 Prueba de contrato `test/server/deploy-contract.test.js`
    - _Requirements: 1.1, 1.2, 1.4_

- [x] 2. Potenciadores
  - [x] 2.1 Parámetros de Configuración y regla cruzada del factor turbo
    - _Requirements: 2.1, 2.11_
  - [x] 2.2 Tipos de Caja y recogida (`boxes.js`)
    - _Requirements: 2.2, 2.3, 2.4, 2.5_
  - [x] 2.3 Efecto_Turbo (`effects/builtin/turbo.js`)
    - _Requirements: 2.6, 2.7_
  - [x] 2.4 Escudo (`tanks.js`, `hits.js`, `game.js`, `snapshot.js`)
    - _Requirements: 2.8, 2.9, 2.10, 2.12_
  - [x] 2.5 Pruebas `test/engine/powerups.test.js` y `test/effects/turbo.test.js`
    - _Requirements: 2.2 a 2.10_

- [x] 3. Retroalimentación en el cliente
  - [x] 3.1 Sprites de Cajas, anillo de escudo y estela de turbo
    - _Requirements: 3.1, 3.2, 3.3_
  - [x] 3.2 Partículas de eliminación en jugador y espectador
    - _Requirements: 3.4_
  - [x] 3.3 Insignias de potenciadores en el HUD
    - _Requirements: 3.5_
  - [x] 3.4 Sonidos y tecla M
    - _Requirements: 3.6_

- [x] 4. Capacidad bajo carga
  - [x] 4.1 `scripts/loadtest.js` y `npm run loadtest`
    - _Requirements: 4.1, 4.2, 4.3_
  - [x] 4.2 `players.max` en 100 y ejecución local con 100 jugadores
    - _Requirements: 4.4, 4.5_

- [ ] 5. Pendientes
  - [ ] 5.1 Comprobación manual en navegador: cajas, escudo, turbo, partículas, sonidos y tecla M
    - _Requirements: 3.1 a 3.6_
  - [ ] 5.2 Ejecutar la Prueba_Carga contra la URL pública desde otra máquina y ajustar el tamaño de la instancia
    - _Requirements: 4.2, 4.3_
  - [ ]* 5.3 Pruebas de `powerupBadges` y `createParticles` (funciones puras)
    - _Requirements: 3.4, 3.5_
