# Reglas para revisar PRs

Las usa la revisión automática (`.github/scripts/pr-review.mjs`) y sirven también a quien revise a mano.

## Arquitectura del juego

- `src/engine`, `src/effects` y `src/bots` son deterministas: sin red, sin reloj (`Date.now`, `setTimeout`) y sin `Math.random`. El azar sale del generador de la partida (`src/engine/rng.js`).
- El servidor es un único proceso con el estado en memoria. Nada que dependa de varias instancias, bases de datos o estado compartido.
- `ws` es la única dependencia de ejecución. Una dependencia nueva necesita una razón clara en la descripción del PR.
- Los parámetros del juego viven en `config.json` y se validan en `src/server/config-schema.js`. Un valor nuevo debe tener tipo, rango y valor por defecto.
- El código compartido entre cliente y servidor está en `src/shared` y no puede usar APIs de Node.

## Efectos nuevos (el PR más típico del público)

- Copiar la estructura de `src/effects/builtin/turbo.js` y registrarlo en `src/engine/game.js`.
- La duración y la intensidad salen de `config.json`, no de constantes en el código.
- Debe terminar limpio: al acabar, el tanque vuelve a su estado normal.
- Debe incluir una prueba en `test/effects/`.

## Estilo

- Módulos ES, Node.js 24, sin paso de compilación.
- Nombres de variables y funciones en inglés; comentarios y mensajes al usuario en español.
- Cambios pequeños y enfocados. Un PR que mezcla varias cosas se puede pedir que se divida.

## Seguridad y despliegue

- Cada merge a `main` se despliega solo en el entorno de la charla. Un PR no debe romper `GET /health`, el puerto (`PORT`), el apagado con `SIGTERM` ni las rutas `/ws/jugador` y `/ws/espectador`.
- Nada de secretos, claves o URLs privadas en el código.
- Los mensajes que llegan por WebSocket son entrada no confiable: validarlos (ver `src/shared/validation.js`).
- Cambios en `.github/`, `Dockerfile` o `infra/` merecen revisión humana cuidadosa: menciónalo en el resumen.
