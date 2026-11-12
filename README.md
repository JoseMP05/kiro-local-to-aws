# kiro-local-to-aws

Repositorio de la charla **"De Local a AWS: Desarrolla y Despliega con Kiro"**.

Es un juego de tanques multijugador en línea (vista cenital, en el navegador) construido con [Kiro](https://kiro.dev) siguiendo Spec-Driven Development. Se ejecuta en local con un solo comando y se despliega en AWS paso a paso.

## Ejecutar en local

Requisitos: Node.js 24 o superior.

```bash
npm install      # o: pnpm install
npm start
```

- Juego: <http://localhost:3000/>
- Espectador (para proyectar en pantalla): <http://localhost:3000/espectador>
- Estado del servidor: <http://localhost:3000/health>

Para probar las pruebas automáticas:

```bash
npm test
```

### Controles

| Tecla | Acción |
| --- | --- |
| W A S D o flechas | Mover |
| Ratón | Apuntar |
| Clic | Disparar |
| M | Silenciar o activar el sonido |
| H | Ocultar o mostrar la ayuda |

### Cómo se juega

- Cada tanque tiene 3 de vida. Las balas rebotan hasta 3 veces, y también te dañan a ti.
- Eliminar a otro tanque suma puntos (bonus extra si es el líder). Al morir pierdes la mitad de tus puntos y reapareces a los 3 segundos con 2 segundos de protección.
- Las cajas aparecen en el mapa:
  - **Caja de madera con moneda**: suma puntos.
  - **Caja amarilla con rayo (turbo)**: 5 segundos de velocidad aumentada.
  - **Caja azul con escudo**: 5 segundos sin recibir daño, y disparar no lo pierde.
- Hay 3 bots para que la arena no se vea vacía. No aparecen en el ranking.

## Configuración

Todos los parámetros del juego están en `config.json` (arena, velocidades, vida, puntos, cajas, bots, red). Si un valor es inválido, el servidor no arranca y explica cuál.

Variables de entorno (tienen prioridad sobre `config.json`):

| Variable | Por defecto | Descripción |
| --- | --- | --- |
| `PORT` | `3000` (de `config.json`) | Puerto HTTP y WebSocket |
| `HOST` | `0.0.0.0` | Interfaz de red donde escucha |
| `TANK_CONFIG` | `config.json` | Ruta a otro archivo de configuración |

## Contrato de despliegue

Datos que necesita quien despliegue el juego:

- **Un solo proceso, una sola réplica.** El estado de la partida vive en memoria. Dos instancias serían dos partidas distintas.
- **HTTP y WebSocket en el mismo puerto** (`PORT`). Rutas WebSocket: `/ws/jugador` y `/ws/espectador`. El cliente usa `wss://` automáticamente cuando la página se sirve por HTTPS.
- **Health check:** `GET /health` responde `200` con JSON (`status`, `players`, `spectators`, `tick.avgMs`, `tick.maxMs`).
- **Latido de WebSocket:** el servidor envía un ping cada 10 s, así que las conexiones no quedan inactivas ante el timeout de un balanceador (por ejemplo, los 60 s por defecto de un ALB).
- **Apagado ordenado:** responde a `SIGTERM` cerrando conexiones y saliendo con código 0.
- **Imagen Docker:** `docker build -t tank-game .` y `docker run -p 3000:3000 tank-game`. Corre como usuario sin privilegios e incluye `HEALTHCHECK`.
- **Recursos:** ver la sección siguiente. Con 100 jugadores el servidor usa un solo hilo de CPU y unos 95 KiB/s de salida por jugador.

## Prueba de carga

El script `scripts/loadtest.js` conecta jugadores simulados que se mueven y disparan, y mide lo que recibe cada cliente.

```bash
npm run loadtest -- --url ws://localhost:3000 --players 100 --spectators 3 --duration 30 --ramp 10
npm run loadtest -- --url wss://tu-dominio --players 100        # contra producción
```

Imprime conexiones, tiempo hasta entrar, intervalo entre estados (p50, p95, p99), ancho de banda por cliente y los tiempos de Tick del servidor, y termina con código distinto de 0 si algún criterio falla. Conviene ejecutarlo desde una máquina distinta al servidor para que no compitan por la CPU.

## Estructura del proyecto

| Carpeta | Contenido |
| --- | --- |
| `src/engine` | Motor del juego: simulación determinista (tanques, balas, cajas, puntos) sin red ni reloj |
| `src/effects` | Sistema de efectos (turbo, ralentizar) con una API acotada |
| `src/bots` | Controlador de bots |
| `src/server` | Servidor HTTP y WebSocket, bucle de ticks, configuración |
| `src/shared` | Código usado por cliente y servidor (protocolo, interpolación, sprites) |
| `src/client` | Cliente del jugador (canvas, HUD, audio) |
| `src/spectator` | Vista de espectador |
| `test` | Pruebas unitarias, de propiedades y de contrato |

Las especificaciones (requisitos, diseño y tareas) están en `.kiro/specs/`.

## Temario de la charla

1. ¿Qué es Kiro?
2. Instalación y gestión de créditos
3. Spec-Driven Development (SDD): `requirements.md`, `design.md` y `tasks.md`
4. El proyecto base: el juego de tanques en local
5. Despliegue en la nube (AWS en vivo), paso a paso con Kiro:
   - Analizar el juego y proponer la arquitectura
   - Explicar los servicios elegidos
   - Generar la infraestructura como código
   - Provisionar y desplegar hasta obtener la URL pública
   - (Opcional) Recibir Pull Requests de la audiencia y actualizar producción

## Contribuir (opcional)

Si quieres proponer un cambio durante la charla, abre un Pull Request pequeño. Antes de enviarlo, ejecuta `npm test`. Un buen primer cambio es un efecto nuevo: copia `src/effects/builtin/turbo.js` y regístralo en `src/engine/game.js`.
