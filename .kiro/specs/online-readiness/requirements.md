# Requirements Document

## Introduction

Esta especificación amplía `tank-game-core` para que el juego sea una experiencia multijugador en línea sólida y se pueda desplegar en la nube. Cubre tres frentes: el contrato de despliegue del servidor, los potenciadores y la retroalimentación sensorial del juego, y la verificación de capacidad mediante pruebas de carga. El despliegue en AWS en sí queda fuera de esta especificación y se trabaja en la especificación de infraestructura.

## Glossary

- **Servidor_Juego**: el proceso Node.js definido en `tank-game-core`.
- **Contrato_Despliegue**: el conjunto de variables de entorno, rutas y señales que el Servidor_Juego ofrece a quien lo despliega.
- **Potenciador**: Caja que otorga un efecto temporal en lugar de puntos. Tipos: `turbo` y `escudo`.
- **Escudo**: estado temporal en el que un Tanque no recibe daño; a diferencia de la protección de reaparición, disparar no lo cancela.
- **Prueba_Carga**: ejecución de `scripts/loadtest.js` con jugadores simulados.

## Requirements

### Requirement 1: Contrato de despliegue

**User Story:** Como persona que despliega el juego, quiero un contrato claro de puerto, salud y apagado, para publicarlo en un contenedor sin leer el código.

#### Acceptance Criteria

1. WHERE la variable de entorno `PORT` está definida con un entero entre 1 y 65535, THE Servidor_Juego SHALL escuchar en ese puerto en lugar del de `config.json`.
2. IF `PORT` está definida y no es un entero entre 1 y 65535, THEN THE Servidor_Juego SHALL terminar con código distinto de 0 y un mensaje que contenga `PORT inválido`.
3. THE Servidor_Juego SHALL escuchar por defecto en todas las interfaces (`0.0.0.0`), y WHERE `HOST` está definida, en ese host.
4. WHEN un cliente solicita `GET /health`, THE Servidor_Juego SHALL responder 200 con JSON que incluya `status`, `players`, `spectators` y `tick` (`rate`, `budgetMs`, `avgMs`, `maxMs`), sin alterar la partida.
5. WHEN el Servidor_Juego recibe `SIGTERM` o `SIGINT`, THE Servidor_Juego SHALL detener el bucle de Ticks, cerrar las conexiones WebSocket con código 1001 y terminar con código 0 en un máximo de 3 segundos.
6. THE proyecto SHALL incluir un `Dockerfile` que construya una imagen basada en Node.js 24, ejecute el proceso como usuario sin privilegios y defina un `HEALTHCHECK` sobre `/health`.
7. THE `README.md` SHALL documentar el Contrato_Despliegue, incluida la restricción de una sola réplica por mantener el estado en memoria.

### Requirement 2: Potenciadores

**User Story:** Como Jugador, quiero cajas que den ventajas temporales, para que la partida tenga más decisiones que solo apuntar y disparar.

#### Acceptance Criteria

1. THE Configuración SHALL definir `boxes.powerupChance` (por defecto 0,35, rango 0 a 1) como la probabilidad de que una Caja nueva sea un Potenciador.
2. WHEN aparece una Caja y `boxes.powerupChance` es 0, THE Motor_Juego SHALL crearla con tipo `puntos` sin consumir números aleatorios adicionales.
3. WHEN aparece una Caja y `boxes.powerupChance` es mayor que 0, THE Motor_Juego SHALL elegir entre `puntos`, `turbo` y `escudo` con el generador aleatorio de la partida.
4. WHEN un Tanque recoge una Caja de tipo `puntos`, THE Motor_Juego SHALL sumar `boxes.points` a su puntuación.
5. WHEN un Tanque recoge una Caja de tipo `turbo` o `escudo`, THE Motor_Juego SHALL no sumar puntos.
6. WHEN un Tanque recoge una Caja `turbo`, THE Motor_Juego SHALL activar el Efecto_Turbo sobre él con la duración `effects.turbo.durationMs` y el factor `effects.turbo.factor`.
7. WHEN termina el último Efecto_Turbo activo de un Tanque, THE Sistema_Efectos SHALL restaurar su Multiplicador_Velocidad a 1.
8. WHEN un Tanque recoge una Caja `escudo`, THE Motor_Juego SHALL volverlo inmune a las Balas durante `effects.shield.durationMs`.
9. WHILE un Tanque tiene Escudo, THE Motor_Juego SHALL conservarlo cuando el Tanque dispara.
10. WHEN un Tanque es eliminado o reaparece, THE Motor_Juego SHALL quitarle el Escudo.
11. IF `effects.turbo.factor` queda fuera de `[effects.speedMultiplierMin, effects.speedMultiplierMax]`, THEN THE Servidor_Juego SHALL terminar el arranque con código distinto de 0 y un mensaje con el valor y el rango.
12. THE mensajes de estado SHALL incluir por Tanque el campo `shield` y la lista `effects`, y por Caja el campo `kind`.

### Requirement 3: Retroalimentación en el cliente

**User Story:** Como Jugador y como público, quiero ver y oír lo que ocurre, para que el juego se sienta vivo.

#### Acceptance Criteria

1. THE Cliente_Juego y la Vista_Espectador SHALL dibujar cada tipo de Caja con un aspecto distinto: moneda para `puntos`, rayo para `turbo` y escudo para `escudo`.
2. WHILE un Tanque tiene Escudo, THE clientes SHALL dibujar un anillo azul alrededor de él.
3. WHILE un Tanque tiene Efecto_Turbo, THE clientes SHALL dibujar una estela amarilla detrás de él.
4. WHEN llega un evento de eliminación, THE clientes SHALL mostrar una ráfaga de partículas en la última posición conocida de la víctima.
5. THE Cliente_Juego SHALL mostrar un indicador con el nombre y los segundos restantes de cada Potenciador activo del Jugador.
6. THE Cliente_Juego SHALL reproducir sonidos sintetizados (sin archivos) al disparar, en explosiones, al recoger puntos y al recoger un Potenciador, y SHALL permitir silenciarlos con la tecla M.

### Requirement 4: Capacidad bajo carga

**User Story:** Como organizador de la charla, quiero comprobar cuántos jugadores aguanta el servidor, para no descubrirlo en directo.

#### Acceptance Criteria

1. THE proyecto SHALL incluir `scripts/loadtest.js`, ejecutable con `npm run loadtest`, que acepte `--url`, `--players`, `--spectators`, `--duration` y `--ramp`.
2. THE Prueba_Carga SHALL informar de conexiones abiertas, jugadores admitidos y rechazados, cierres inesperados, tiempo hasta entrar, intervalo entre estados (p50, p95, p99 y máximo), ancho de banda por cliente y los tiempos de Tick del servidor leídos de `/health`.
3. THE Prueba_Carga SHALL terminar con código distinto de 0 si hay cierres inesperados, jugadores rechazados, un p95 del intervalo entre estados mayor que dos periodos de Tick, o un `tick.maxMs` mayor que `tick.budgetMs`.
4. THE Configuración SHALL admitir hasta 100 jugadores simultáneos con `players.max` en 100.
5. WHEN se ejecuta la Prueba_Carga con 100 jugadores y 3 espectadores en una sola máquina, THE Servidor_Juego SHALL cumplir los criterios del requisito 4.3.
