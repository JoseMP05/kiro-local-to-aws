---
inclusion: always
---

# Tecnología

- Node.js 24 con módulos ES (`"type": "module"`).
- La única dependencia de producción es `ws`.
- Sin paso de build, sin TypeScript y sin frameworks.
- El mismo servidor HTTP sirve el cliente estático y el WebSocket.
- El puerto sale de la variable de entorno `PORT`.

## Estructura

- `src/server/`: servidor HTTP, WebSocket y bucle de juego.
- `src/client/`: HTML, CSS y JavaScript del navegador.
- `test/`: pruebas con `node:test` y `node:assert`, con nombre `*.test.js`.

## Convenciones

- El servidor es la autoridad: decide movimiento, impactos, daño y puntaje.
- La lógica del juego son funciones puras que se pueden probar sin red.
- Cada tarea de la spec termina con sus pruebas pasando (`node --test`).
