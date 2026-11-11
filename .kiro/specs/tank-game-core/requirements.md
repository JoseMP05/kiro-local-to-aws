# Requirements Document

## Introduction

Este documento define los requisitos del núcleo jugable de un videojuego multijugador web de tanques con vista cenital. El juego sirve como base de un taller virtual: correrá en un servidor público y cada participante programará más adelante un "sabotaje" (un módulo que altera la partida). Este spec cubre solo el núcleo: arena, tanques, balas con rebote, cajas, puntuación, ranking en vivo, vista de espectador, bots de prueba, validación y límites, y los puntos de extensión que usarán los sabotajes en un spec posterior.

Quedan fuera de alcance: la carga de sabotajes externos, las cuentas de usuario, la base de datos, el soporte para celulares y el despliegue en la nube.

Supuestos tomados para esta versión inicial (revisables):

- Cada tanque tiene una cantidad configurable de vida y cada bala resta una cantidad configurable de daño. Con los valores por defecto, un tanque se elimina tras 3 impactos.
- Una bala que impacta a su propio tanque emisor después de rebotar le causa daño (fuego amigo propio activado), configurable.
- Por defecto los bots no aparecen en el ranking ni pueden ser líder (opción "bots en el ranking" desactivada), pero siguen ganando y perdiendo puntos. Siempre se distinguen visualmente con un color propio y la etiqueta "BOT".
- El intervalo de recarga por defecto es 500 ms y cada tanque puede tener como máximo 3 balas activas.
- El número máximo de jugadores humanos por defecto es 50.
- El cliente envía un input solo cuando cambia el estado de teclas, disparo o ángulo, y como máximo uno por intervalo de Tick (30 por segundo por defecto), sin depender de la frecuencia de refresco del monitor.
- Cada mensaje del cliente tiene como máximo 1024 bytes y cada conexión puede enviar como máximo 90 mensajes por segundo; la conexión se cierra tras 3 ventanas consecutivas excedidas.
- Un mensaje de más de 1024 bytes y hasta 65536 bytes (tamaño máximo de trama) se descarta sin cerrar la conexión; un mensaje de más de 65536 bytes cierra la conexión con el código 1009.
- Cada jugador recibe en el estado solo las entidades dentro de su área de interés (por defecto 1600 x 1000 unidades de Arena) más su propio tanque; la vista de espectador recibe la Arena completa.
- Todos los jugadores ven la misma cantidad de mundo (por defecto 1440 x 900 unidades de Arena), escalada a su pantalla, sin importar el tamaño o la resolución de la ventana. El área de interés debe ser al menos tan grande como esa área visible.
- Cada tanque tiene un identificador opaco de objetivo, estable y único en la partida, que solo ven los Efectos a través de su contexto y que no se envía a los clientes.
- Un tanque invulnerable tras reaparecer puede disparar, y su invulnerabilidad termina en cuanto dispara una bala.
- El servidor envía una comprobación de conexión cada 10 segundos y cierra la conexión si no recibe respuesta en 30 segundos.
- Las balas de un tanque desconectado se eliminan al retirar el tanque.
- La cantidad de bots está entre 0 y 20, y cada bot recibe el Apodo "Bot N".
- El Efecto_Ralentizar dura 5000 ms por defecto.
- Un tanque es invulnerable durante 2 segundos tras reaparecer.

## Glossary

- **Servidor_Juego**: Proceso Node.js que acepta conexiones WebSocket, sirve los archivos del cliente por HTTP y ejecuta el Motor_Juego.
- **Motor_Juego**: Módulo de simulación autoritativa, independiente de la capa de red, que avanza el estado de la partida en cada Tick.
- **Cliente_Juego**: Página web en HTML5 Canvas y JavaScript sin frameworks que captura el Input del jugador y dibuja el estado recibido.
- **Vista_Espectador**: Página web servida en una ruta aparte que muestra la Arena completa y el Ranking en tamaño grande, sin participar en la partida.
- **Arena**: Área rectangular de juego, de tamaño configurable y mayor que la pantalla del Cliente_Juego, que contiene Obstáculos.
- **Obstáculo**: Elemento rectangular fijo de la Arena que bloquea el paso de Tanques y hace rebotar Balas.
- **Pared**: Borde de la Arena o lado de un Obstáculo.
- **Tanque**: Entidad controlada por un jugador humano o por un Bot, con posición, orientación del cañón, vida y puntos.
- **Área de colisión**: Forma geométrica de un Tanque que el Motor_Juego usa para detectar contactos con Paredes, Balas y Cajas.
- **Jugador**: Persona conectada mediante el Cliente_Juego que controla un Tanque.
- **Bot**: Tanque controlado por el Controlador_Bots dentro del Servidor_Juego.
- **Controlador_Bots**: Módulo que genera el Input de cada Bot en cada Tick.
- **Bala**: Proyectil disparado por un Tanque, que se mueve en línea recta y rebota en las Paredes.
- **Daño propio**: Opción de la Configuración que permite que una Bala rebotada reste vida a su propio Tanque emisor.
- **Caja**: Objeto recogible que aparece periódicamente en la Arena y otorga puntos al Tanque que la toca.
- **Tick**: Paso fijo de simulación del Motor_Juego. La frecuencia por defecto es 30 Ticks por segundo.
- **Tiempo de simulación**: Tiempo medido como número de Ticks multiplicado por 1 dividido por la frecuencia de Tick, independiente del tiempo real.
- **Input**: Mensaje del Cliente_Juego con el estado de las teclas de movimiento (W, A, S, D), el ángulo de apuntado y el estado del disparo.
- **Apodo**: Nombre visible elegido por el Jugador al entrar, sin registro.
- **Punto_Seguro**: Posición de la Arena libre de Obstáculos y a una distancia mínima configurable de cualquier otro Tanque.
- **Invulnerabilidad**: Estado temporal tras reaparecer en que las Balas no restan vida al Tanque. Termina al cumplirse el tiempo de protección de la Configuración o cuando el Tanque crea una Bala, lo que ocurra primero.
- **Área_Interés**: Rectángulo de la Arena, de ancho y alto definidos en la Configuración, asociado al Tanque de un Jugador, que determina qué Tanques, Balas y Cajas se incluyen en los mensajes de estado enviados a ese Jugador.
- **Área_Visible**: Rectángulo del mundo, de ancho y alto fijos definidos en la Configuración (por defecto 1440 x 900 unidades de Arena), que la cámara del Cliente_Juego muestra escalado al Canvas. Su tamaño en unidades de Arena no depende del tamaño ni de la resolución de la ventana.
- **Factor de escala de cámara**: Número por el que el Cliente_Juego multiplica las distancias en unidades de Arena para obtener píxeles del Canvas; es el menor valor entre el ancho del Canvas dividido por el ancho del Área_Visible y el alto del Canvas dividido por el alto del Área_Visible.
- **Franja**: Zona del Canvas que queda fuera del Área_Visible escalada cuando la proporción del Canvas no coincide con la del Área_Visible.
- **Origen de cámara**: Esquina superior izquierda del Área_Visible, en coordenadas de la Arena.
- **Tamaño máximo de trama**: Tamaño máximo en bytes de un mensaje WebSocket que el Servidor_Juego acepta leer (por defecto 65536 bytes); un mensaje mayor provoca el cierre de la conexión.
- **Identificador_Objetivo**: Cadena de texto opaca que el Motor_Juego asigna a cada Tanque (de Jugador o Bot) al crearlo. Es estable durante toda la permanencia del Tanque en la partida (no cambia al ser eliminado, al reaparecer ni si cambia el Apodo), única entre todos los Tanques creados desde el arranque (no se reutiliza tras la retirada de un Tanque, aunque un Jugador nuevo entre con el mismo Apodo), no revela el identificador interno del Tanque, no permite acceder al estado del Motor_Juego y se genera de forma determinista a partir de la semilla y el estado de la partida.
- **Intervalo de envío**: Tiempo mínimo entre dos Inputs consecutivos enviados por el Cliente_Juego, igual a 1 dividido por la frecuencia de Tick de la Configuración (por defecto 1/30 de segundo).
- **Bots en el ranking**: Opción booleana de la Configuración, desactivada por defecto, que determina si los Bots aparecen en las Tablas_Ranking y pueden ser Líder.
- **Tanque elegible**: Tanque que puede figurar en la tabla de tanques del Ranking: todo Tanque de Jugador y, solo cuando la opción bots en el ranking está activada, todo Bot.
- **Ranking**: Estructura que contiene una o más Tablas_Ranking.
- **Tabla_Ranking**: Lista ordenada de entradas (nombre, puntos, indicador de Bot) identificada por un nombre. En este spec solo existe la tabla de tanques.
- **Líder**: Tanque en la primera posición de la tabla de tanques del Ranking en el momento de un evento. Como la tabla solo contiene Tanques elegibles, con la opción bots en el ranking desactivada el Líder es siempre un Tanque de Jugador.
- **Configuración**: Archivo único que contiene todos los parámetros ajustables del juego.
- **Modo de depuración**: Opción de la Configuración, desactivada por defecto, que habilita comportamientos de prueba como la activación automática del Efecto_Ralentizar.
- **Validador**: Módulo del Servidor_Juego que comprueba los mensajes y Apodos recibidos.
- **Limitador_Mensajes**: Módulo del Servidor_Juego que controla la frecuencia de mensajes por conexión.
- **Mensaje de comprobación**: Mensaje de control que el Servidor_Juego envía periódicamente a cada conexión para verificar que sigue respondiendo.
- **Codificador_Mensajes**: Módulo que convierte mensajes del protocolo entre objetos JavaScript y texto JSON transmitido por WebSocket.
- **Instante de render**: Instante de simulación en el que el Cliente_Juego o la Vista_Espectador dibujan las entidades, retrasado respecto al último estado recibido por el retardo de interpolación.
- **Sistema_Efectos**: Componente del Motor_Juego que registra Efectos y los invoca en los Puntos_Extensión.
- **Punto_Extensión**: Momento definido del Tick en que el Sistema_Efectos invoca a los Efectos activos.
- **Efecto**: Módulo que altera la partida mediante los Puntos_Extensión, asociado a un Tanque objetivo y con una duración en milisegundos.
- **Contexto_Efecto**: Objeto que el Sistema_Efectos entrega a un Efecto y que expone la única API permitida para consultar y modificar la partida.
- **Multiplicador_Velocidad**: Factor por el que el Motor_Juego multiplica la velocidad de movimiento de un Tanque; vale 1 por defecto y solo se modifica mediante el Contexto_Efecto.
- **Efecto_Ralentizar**: Efecto interno de ejemplo que reduce la velocidad de movimiento del Tanque objetivo.

## Requirements

### Requirement 1: Configuración centralizada

**User Story:** Como organizador del taller, quiero ajustar todos los parámetros del juego en un único archivo, para adaptar la partida sin tocar el código.

#### Acceptance Criteria

1. THE Configuración SHALL definir en un único archivo, con un valor por defecto para cada uno, los siguientes parámetros: el puerto, la ruta de la Vista_Espectador, el tamaño de la Arena, los Obstáculos, la frecuencia de Tick, las velocidades de Tanques y Balas, la longitud del cañón, el radio de Bala, el intervalo de recarga, el número máximo de Balas activas por Tanque, el número máximo de rebotes, el tiempo de vida máximo de una Bala, la vida y el daño, la activación del daño propio, los puntos por eliminación, la bonificación por eliminar al Líder, el porcentaje de puntos perdidos al morir, el tiempo de reaparición, el tiempo de protección tras reaparecer, la distancia mínima y el número máximo de intentos para buscar un Punto_Seguro, los parámetros de Cajas (máximo en la Arena, intervalo de aparición, puntos por Caja, tamaño de Caja y número máximo de intentos para ubicar una Caja), la cantidad de Bots, sus distancias de detección y de visión, su distancia de llegada y su tiempo máximo por destino, la activación de la opción bots en el ranking, el número máximo de Jugadores, el ancho y el alto del Área_Interés, el ancho y el alto del Área_Visible, las longitudes mínima y máxima de Apodo, el tamaño máximo de mensaje, el tamaño máximo de trama, el máximo de mensajes por segundo y el número de ventanas consecutivas antes de cerrar una conexión, el intervalo de comprobación de conexión, el tiempo de espera de comprobación de conexión, el retardo de interpolación, la duración máxima de un Efecto, el rango del multiplicador de velocidad, el factor y la duración del Efecto_Ralentizar y la activación del modo de depuración.
2. THE Configuración SHALL establecer en 50 el porcentaje por defecto de puntos perdidos al morir, con un rango permitido de 0 a 100 en números enteros.
3. THE Configuración SHALL establecer en 30 la frecuencia de Tick por defecto, con un rango permitido de 1 a 120 Ticks por segundo en números enteros.
4. THE Configuración SHALL declarar para cada parámetro numérico un valor mínimo y un valor máximo permitidos, junto al parámetro en el mismo archivo.
5. WHEN el Servidor_Juego arranca, THE Servidor_Juego SHALL validar, antes de abrir el puerto HTTP y WebSocket, que cada valor numérico de la Configuración sea un número finito dentro de su rango permitido (límites incluidos) y que cada Obstáculo quede completamente dentro de la Arena.
6. IF uno o más valores de la Configuración no son numéricos, están fuera de su rango permitido o describen un Obstáculo que sale de la Arena, THEN THE Servidor_Juego SHALL terminar el arranque con código de salida distinto de 0, sin abrir el puerto, y mostrar en consola un mensaje por cada parámetro inválido con el nombre del parámetro, el valor recibido y el rango permitido.
7. IF el archivo de Configuración no existe o no se puede leer o interpretar, THEN THE Servidor_Juego SHALL terminar el arranque con código de salida distinto de 0, sin abrir el puerto, y mostrar en consola un mensaje que indique el archivo afectado y el motivo del fallo.
8. IF el archivo de Configuración omite un parámetro, THEN THE Servidor_Juego SHALL usar el valor por defecto de ese parámetro y continuar el arranque.
9. THE Configuración SHALL establecer en 90 el máximo de mensajes por segundo por defecto (3 veces el ritmo máximo de Inputs del Cliente_Juego con la frecuencia de Tick por defecto), con un rango permitido de 1 a 1000 en números enteros.
10. WHEN el Servidor_Juego arranca, THE Servidor_Juego SHALL validar, antes de abrir el puerto HTTP y WebSocket, que el máximo de mensajes por segundo de la Configuración sea mayor o igual a 2 veces la frecuencia de Tick de la Configuración (con 30 Ticks por segundo, al menos 60).
11. IF el máximo de mensajes por segundo de la Configuración es menor que 2 veces la frecuencia de Tick, THEN THE Servidor_Juego SHALL terminar el arranque con código de salida distinto de 0, sin abrir el puerto, y mostrar en consola un mensaje con el valor del máximo de mensajes por segundo, el valor de la frecuencia de Tick y el mínimo requerido.
12. THE Configuración SHALL establecer la opción bots en el ranking como un valor booleano con valor por defecto false.
13. IF la opción bots en el ranking de la Configuración tiene un valor que no es booleano, THEN THE Servidor_Juego SHALL terminar el arranque con código de salida distinto de 0, sin abrir el puerto, y mostrar en consola un mensaje con el nombre del parámetro y el valor recibido.
14. THE Configuración SHALL establecer en 1024 bytes el tamaño máximo de mensaje por defecto, con un rango permitido de 64 a 65536 en números enteros, y en 65536 bytes el tamaño máximo de trama por defecto, con un rango permitido de 1024 a 1048576 en números enteros.
15. IF el tamaño máximo de trama de la Configuración es menor que el tamaño máximo de mensaje de la Configuración, THEN THE Servidor_Juego SHALL terminar el arranque con código de salida distinto de 0, sin abrir el puerto, y mostrar en consola un mensaje con el valor de ambos parámetros y la regla incumplida (tamaño máximo de trama mayor o igual al tamaño máximo de mensaje).

### Requirement 2: Ejecución local

**User Story:** Como participante del taller, quiero correr el juego en mi máquina con un solo comando, para probarlo sin pasos de instalación complejos.

#### Acceptance Criteria

1. WHEN se ejecuta `npm start` en la raíz del proyecto después de `npm install`, THE Servidor_Juego SHALL iniciar el servidor HTTP y el servidor WebSocket en el mismo puerto definido en la Configuración en un plazo máximo de 5 segundos, sin requerir pasos de compilación ni comandos adicionales.
2. THE Servidor_Juego SHALL ejecutarse sobre Node.js 24 o superior usando módulos ES, con la librería ws como única dependencia de ejecución declarada en el proyecto.
3. WHEN un navegador solicita la ruta raíz, THE Servidor_Juego SHALL entregar la página del Cliente_Juego y todos los archivos estáticos que la página requiere para cargarse y conectarse por WebSocket.
4. WHEN un navegador solicita la ruta de espectador definida en la Configuración, THE Servidor_Juego SHALL entregar la página de la Vista_Espectador y todos los archivos estáticos que la página requiere para cargarse y conectarse por WebSocket.
5. WHEN el Servidor_Juego termina de arrancar, THE Servidor_Juego SHALL mostrar en consola la URL completa del Cliente_Juego y la URL completa de la Vista_Espectador, ambas con el host local y el puerto de la Configuración.
6. IF el puerto de la Configuración está ocupado por otro proceso al arrancar, THEN THE Servidor_Juego SHALL terminar el proceso con un código de salida distinto de 0 y un mensaje en consola que indique el número de puerto ocupado.
7. IF un navegador solicita una ruta que no corresponde al Cliente_Juego, a la Vista_Espectador ni a sus archivos estáticos, THEN THE Servidor_Juego SHALL responder con una respuesta de recurso no encontrado y seguir atendiendo conexiones sin alterar la partida en curso.
8. IF `npm start` se ejecuta con una versión de Node.js inferior a 24, THEN THE Servidor_Juego SHALL terminar el proceso con un código de salida distinto de 0 y un mensaje en consola que indique la versión mínima requerida.

### Requirement 3: Entrada a la partida con Apodo

**User Story:** Como Jugador, quiero entrar en cualquier momento escribiendo solo un Apodo, para jugar sin registrarme.

#### Acceptance Criteria

1. WHEN un Jugador envía un Apodo válido desde una conexión que no tiene Tanque, THE Servidor_Juego SHALL crear en el siguiente Tick un Tanque para ese Jugador en un Punto_Seguro, con 0 puntos y con la vida máxima definida en la Configuración.
2. WHILE una partida está en curso, THE Servidor_Juego SHALL aceptar nuevos Jugadores sin reiniciar la partida y sin modificar la posición, la vida ni los puntos de los Tanques existentes.
3. THE Validador SHALL aceptar como válido un Apodo de tipo texto cuya longitud en caracteres, tras eliminar los espacios iniciales y finales, sea mayor o igual a la longitud mínima y menor o igual a la longitud máxima de la Configuración (por defecto 2 y 16 caracteres), y THE Servidor_Juego SHALL usar como Apodo del Tanque el texto sin esos espacios iniciales y finales.
4. THE Validador SHALL aceptar en un Apodo únicamente las letras A a Z, las letras á, é, í, ó, ú, ü y ñ (en mayúscula y en minúscula), los dígitos 0 a 9, el espacio, el guion (-) y el guion bajo (_), y SHALL rechazar un Apodo que contenga cualquier otro carácter.
5. IF un Jugador envía un Apodo inválido (ausente, que no es texto, con longitud fuera del rango de la Configuración o con un carácter no permitido), THEN THE Servidor_Juego SHALL responder con un mensaje de error que indique la regla incumplida, no crear ningún Tanque y mantener abierta la conexión para que el Jugador pueda enviar otro Apodo.
6. IF un Jugador envía un Apodo que, tras eliminar espacios iniciales y finales y sin distinguir mayúsculas de minúsculas, es igual al Apodo de otro Tanque presente en la partida (activo o eliminado en espera de reaparecer, incluidos los Bots), THEN THE Servidor_Juego SHALL asignar al nuevo Tanque el Apodo seguido del menor número entero mayor o igual a 2 que produzca un Apodo no usado por ningún otro Tanque, recortando el final del Apodo base si es necesario para que el resultado no supere la longitud máxima de la Configuración.
7. WHEN un Tanque es creado, THE Servidor_Juego SHALL enviar al Jugador, antes del primer mensaje de estado que incluya ese Tanque, un mensaje con el identificador del Tanque, el Apodo final asignado, las dimensiones de la Arena, el ancho y el alto del Área_Visible de la Configuración y la lista de Obstáculos.
8. IF una conexión que ya tiene un Tanque en la partida envía un nuevo Apodo, THEN THE Servidor_Juego SHALL descartar el mensaje, mantener el Tanque existente con su Apodo, posición, vida y puntos sin cambios, y no crear un segundo Tanque.

### Requirement 4: Límite de Jugadores

**User Story:** Como organizador, quiero limitar el número de Jugadores simultáneos, para que el servidor público no se sature.

#### Acceptance Criteria

1. THE Configuración SHALL definir el número máximo de Jugadores como un entero entre 1 y 200, con valor por defecto 50.
2. IF un Jugador envía un Apodo válido mientras el número de Tanques de Jugadores humanos en la partida es mayor o igual al número máximo de Jugadores de la Configuración, THEN THE Servidor_Juego SHALL rechazar la entrada sin crear un Tanque y responder al Jugador con un mensaje de error que indique partida llena.
3. IF el Servidor_Juego rechaza una entrada por partida llena, THEN THE Servidor_Juego SHALL mantener abierta la conexión del Jugador, dejarlo fuera de la partida y aceptar un nuevo envío de Apodo por esa misma conexión.
4. THE Servidor_Juego SHALL contar como Tanques de Jugadores humanos los Tanques activos y los eliminados en espera de reaparecer, y excluir del conteo las conexiones de Jugadores que aún no tienen un Tanque creado.
5. THE Servidor_Juego SHALL excluir a los Bots del conteo del número máximo de Jugadores.
6. THE Servidor_Juego SHALL excluir las conexiones de la Vista_Espectador del conteo del número máximo de Jugadores.
7. WHEN el Servidor_Juego retira el Tanque de un Jugador desconectado, THE Servidor_Juego SHALL descontar ese Tanque del conteo, de forma que el siguiente Apodo válido recibido pueda crear un Tanque.
8. IF el Servidor_Juego recibe varios Apodos válidos cuando quedan menos plazas libres que solicitudes, THEN THE Servidor_Juego SHALL crear Tanques en el orden de llegada de los mensajes hasta alcanzar el máximo y rechazar las solicitudes restantes por partida llena, de forma que el número de Tanques de Jugadores humanos nunca supere el máximo de la Configuración.

### Requirement 5: Simulación autoritativa a Tick fijo

**User Story:** Como organizador, quiero que el servidor decida todo lo que ocurre en la partida, para que ningún cliente pueda hacer trampa alterando el estado.

#### Acceptance Criteria

1. THE Motor_Juego SHALL avanzar el estado completo de la partida una vez por Tick, de forma que en cualquier intervalo de 10 segundos de tiempo real el número de Ticks ejecutados difiera como máximo en un 2 % de 10 veces la frecuencia de Tick de la Configuración (con 30 Ticks por segundo, entre 294 y 306 Ticks).
2. IF el Servidor_Juego recibe de un Cliente_Juego un mensaje de un tipo distinto a entrada con Apodo, Input o control de conexión, THEN THE Servidor_Juego SHALL descartar el mensaje y dejar sin cambios la posición, la vida, los puntos, las Balas y las Cajas de la partida.
3. WHEN el Servidor_Juego recibe uno o más Inputs válidos de un Tanque entre dos Ticks consecutivos, THE Motor_Juego SHALL guardar como Input más reciente del Tanque el último recibido y aplicar solo ese Input en el siguiente Tick.
4. WHEN el Motor_Juego completa un Tick, THE Servidor_Juego SHALL enviar a cada Cliente_Juego con Tanque creado y a cada Vista_Espectador conectada un único mensaje de estado con el número de Tick (que vale 0 en el primer Tick tras el arranque y aumenta en 1 en cada Tick), el identificador, Apodo, posición, orientación del cañón, vida, puntos, indicador de eliminado e indicador de Bot de cada Tanque incluido, el identificador y la posición de cada Bala incluida, y el identificador, la posición y el tipo de cada Caja incluida, donde las entidades incluidas son las indicadas en los criterios 5.11 y 5.13.
5. WHEN el Motor_Juego completa un Tick y ha transcurrido al menos 1 segundo desde el último envío del Ranking, THE Servidor_Juego SHALL enviar el Ranking a cada Cliente_Juego con Tanque creado y a cada Vista_Espectador conectada, con las mismas Tablas_Ranking y entradas para todas las conexiones, sin filtrar por Área_Interés.
6. THE Motor_Juego SHALL calcular cada Tick con un intervalo de tiempo fijo igual a 1 dividido por la frecuencia de Tick de la Configuración (por defecto 1/30 de segundo), idéntico en todos los Ticks y con independencia del tiempo real transcurrido entre Ticks.
7. WHEN el Motor_Juego completa un Tick en el que cambió el Apodo, el orden o los puntos de alguna de las 10 primeras entradas de la tabla de tanques, THE Servidor_Juego SHALL enviar el Ranking en ese mismo Tick, con un máximo de un mensaje de Ranking por conexión y por Tick.
8. IF un Tanque activo no recibió ningún Input desde el Tick anterior, THEN THE Motor_Juego SHALL aplicar en el Tick el Input más reciente guardado del Tanque, o un Input sin teclas de movimiento, sin disparo y con ángulo de apuntado 0 si el Tanque nunca recibió un Input.
9. WHEN se crea el Tanque de un Jugador o se conecta una Vista_Espectador, THE Servidor_Juego SHALL enviar el Ranking a esa conexión al completar el siguiente Tick, sin esperar al intervalo de 1 segundo.
10. THE Configuración SHALL definir el ancho y el alto del Área_Interés en unidades de Arena, con valores por defecto 1600 y 1000 y un rango permitido de 100 a 20000 para cada uno.
11. WHEN el Servidor_Juego construye el mensaje de estado de un Tick para un Cliente_Juego, THE Servidor_Juego SHALL incluir el Tanque de ese Jugador (activo o eliminado) y, además, únicamente los Tanques activos, las Balas y las Cajas cuya posición (centro) está dentro del Área_Interés de ese Jugador, con los bordes del rectángulo incluidos; los Tanques eliminados de otros Jugadores y de Bots quedan fuera del mensaje.
12. THE Servidor_Juego SHALL calcular el Área_Interés de un Jugador en cada Tick como un rectángulo con el ancho y el alto de la Configuración centrado en la posición del Tanque del Jugador al final del Tick, o en la posición que tenía el Tanque en el Tick de su eliminación mientras está eliminado, desplazado lo mínimo necesario en cada eje para quedar dentro de la Arena; en un eje en que la Arena es menor que el Área_Interés, el rectángulo SHALL centrarse en el centro de la Arena en ese eje.
13. WHEN el Servidor_Juego construye el mensaje de estado de un Tick para una Vista_Espectador, THE Servidor_Juego SHALL incluir todos los Tanques, Balas y Cajas de la partida, sin aplicar ningún Área_Interés.
14. FOR ALL estados de partida y Tanques de Jugador, el mensaje de estado enviado a ese Jugador SHALL contener exactamente las Balas, las Cajas y los Tanques activos cuya posición está dentro de su Área_Interés, más su propio Tanque, sin repeticiones (propiedad invariante).
15. WHEN el Servidor_Juego arranca, THE Servidor_Juego SHALL validar, antes de abrir el puerto HTTP y WebSocket, que el ancho del Área_Interés sea mayor o igual al ancho del Área_Visible y que el alto del Área_Interés sea mayor o igual al alto del Área_Visible (con los valores por defecto, 1600 ≥ 1440 y 1000 ≥ 900).
16. IF el ancho o el alto del Área_Interés de la Configuración es menor que el ancho o el alto del Área_Visible, THEN THE Servidor_Juego SHALL terminar el arranque con código de salida distinto de 0, sin abrir el puerto, y mostrar en consola un mensaje con la dimensión afectada, el valor del Área_Interés y el valor del Área_Visible.

### Requirement 6: Movimiento y colisiones de Tanques

**User Story:** Como Jugador, quiero mover mi Tanque con WASD por la Arena, para desplazarme y esquivar.

#### Acceptance Criteria

1. WHEN un Tick procesa el Input de un Tanque activo con al menos una tecla de movimiento activa y una dirección resultante distinta de cero, THE Motor_Juego SHALL desplazar el Tanque en esa dirección una distancia igual a la velocidad de movimiento de la Configuración (en unidades de Arena por segundo), multiplicada por el multiplicador de velocidad del Tanque (1 por defecto) y dividida por la frecuencia de Tick.
2. THE Motor_Juego SHALL calcular la dirección resultante de un Input sumando un vector unitario por cada tecla activa: W hacia el borde superior de la Arena, S hacia el borde inferior, A hacia el borde izquierdo y D hacia el borde derecho.
3. WHEN un Input combina dos teclas de movimiento perpendiculares (W o S con A o D), THE Motor_Juego SHALL normalizar la dirección resultante a longitud 1, de forma que la distancia recorrida en un Tick en diagonal sea igual a la recorrida en línea recta, con una tolerancia de 0,001 unidades de Arena.
4. IF un Input activa a la vez dos teclas opuestas (W y S, o A y D), THEN THE Motor_Juego SHALL anular el desplazamiento en ese eje y aplicar solo el desplazamiento del eje perpendicular, si existe.
5. IF un Tick procesa un Input sin teclas de movimiento activas, o el Tanque aún no ha recibido ningún Input, THEN THE Motor_Juego SHALL mantener la posición del Tanque sin cambios en ese Tick.
6. IF el desplazamiento de un Tick haría que el área de colisión de un Tanque se superponga con un Obstáculo o sobrepase un borde de la Arena, THEN THE Motor_Juego SHALL detener el Tanque en el punto de contacto sobre el eje bloqueado y aplicar el desplazamiento completo del eje no bloqueado, siempre que ese eje esté libre.
7. IF el desplazamiento de un Tick está bloqueado en ambos ejes, THEN THE Motor_Juego SHALL dejar el Tanque en el punto de contacto de ambos ejes sin atravesar ninguna Pared.
8. THE Motor_Juego SHALL mantener el área de colisión de cada Tanque completamente dentro de la Arena y sin superposición con ningún Obstáculo al final de cada Tick, aunque el desplazamiento por Tick sea mayor que el grosor de un Obstáculo.
9. WHEN un Tick procesa el Input de un Tanque activo, THE Motor_Juego SHALL fijar la orientación del cañón del Tanque al ángulo de apuntado del Input, normalizado al rango [−π, π) radianes, sin modificar la dirección de movimiento.

### Requirement 7: Disparo

**User Story:** Como Jugador, quiero apuntar con el mouse y disparar con clic, para atacar a otros Tanques.

#### Acceptance Criteria

1. WHEN un Tick procesa un Input con disparo activo de un Tanque activo y el tiempo desde el último disparo del Tanque es mayor o igual al intervalo de recarga de la Configuración (por defecto 500 ms), THE Motor_Juego SHALL crear en ese mismo Tick una Bala con el Tanque como emisor, el contador de rebotes en 0, la velocidad de Bala de la Configuración y la dirección del ángulo de apuntado del Input, y registrar ese Tick como el último disparo del Tanque.
2. THE Motor_Juego SHALL ubicar cada Bala nueva en la punta del cañón, definida como el punto situado a la longitud de cañón de la Configuración desde el centro del Tanque en la dirección del ángulo de apuntado.
3. THE Motor_Juego SHALL medir el tiempo desde el último disparo de un Tanque como el número de Ticks transcurridos multiplicado por 1 dividido por la frecuencia de Tick, con independencia del tiempo real transcurrido.
4. WHILE el tiempo desde el último disparo de un Tanque es menor al intervalo de recarga, THE Motor_Juego SHALL ignorar el disparo de ese Tanque sin crear Bala y sin modificar el Tick del último disparo.
5. WHILE un Input mantiene el disparo activo durante varios Ticks consecutivos, THE Motor_Juego SHALL crear una Bala cada vez que el tiempo desde el último disparo alcance el intervalo de recarga, sin requerir que el disparo se desactive entre Balas.
6. IF un Tanque tiene en la Arena un número de Balas activas propias (creadas por ese Tanque y aún no eliminadas) igual al máximo de Balas activas por Tanque de la Configuración (por defecto 3), THEN THE Motor_Juego SHALL ignorar el disparo de ese Tanque sin crear Bala y sin modificar el Tick del último disparo.
7. WHILE un Tanque está eliminado y esperando reaparecer, THE Motor_Juego SHALL ignorar los Inputs de ese Tanque, sin crear Balas ni almacenar esos Inputs para aplicarlos tras la reaparición.
8. WHEN un Tanque es creado o reaparece, THE Motor_Juego SHALL permitir que el Tanque dispare en el primer Tick que procese un Input con disparo activo, sin esperar el intervalo de recarga.
9. IF la punta del cañón de un Tanque queda superpuesta con un Obstáculo o fuera de la Arena en el Tick en que se procesa un disparo, THEN THE Motor_Juego SHALL ignorar ese disparo sin crear Bala y sin modificar el Tick del último disparo.
10. WHEN el Motor_Juego crea una Bala de un Tanque invulnerable según el criterio 7.1, THE Motor_Juego SHALL terminar la invulnerabilidad de ese Tanque en ese mismo Tick, antes de procesar los impactos de Balas de ese Tick, de forma que las Balas que se superpongan con el Tanque desde ese Tick le resten vida según el criterio 9.1.
11. IF un Tanque invulnerable tiene el disparo activo y el Motor_Juego ignora el disparo según los criterios 7.4, 7.6 o 7.9, THEN THE Motor_Juego SHALL mantener la invulnerabilidad del Tanque sin cambios.

### Requirement 8: Balas con rebote limitado

**User Story:** Como Jugador, quiero que las Balas reboten en las Paredes un número limitado de veces, para poder hacer disparos con ángulo.

#### Acceptance Criteria

1. WHEN un Tick avanza una Bala, THE Motor_Juego SHALL desplazar la Bala en línea recta, en su dirección actual, una distancia igual a la velocidad de Bala de la Configuración (por defecto 600 unidades de la Arena por segundo, rango permitido de 1 a 5000) multiplicada por el intervalo fijo de Tick.
2. WHEN una Bala toca una Pared y su contador de rebotes es menor al número máximo de rebotes de la Configuración (por defecto 3, rango permitido de 0 a 10), THE Motor_Juego SHALL invertir la componente de la dirección de la Bala perpendicular a esa Pared, conservar la componente paralela, incrementar el contador de rebotes en 1 y recorrer en la nueva dirección la distancia restante del Tick, partiendo del punto de contacto. Cada Bala se crea con su contador de rebotes en 0.
3. WHEN una Bala toca una Pared y su contador de rebotes es igual al número máximo de rebotes de la Configuración, THE Motor_Juego SHALL eliminar la Bala en ese mismo Tick sin reflejar su dirección, de modo que la Bala no aparezca en el siguiente mensaje de estado.
4. THE Motor_Juego SHALL conservar la rapidez de una Bala tras cada rebote, con una diferencia máxima de 0,001 unidades de la Arena por segundo respecto a la velocidad de Bala de la Configuración.
5. THE Motor_Juego SHALL detectar el contacto de una Bala con una Pared en todo el segmento recorrido durante el Tick, aunque esa distancia sea mayor que el grosor de la Pared, de modo que al final de cada Tick ninguna Bala esté superpuesta con un Obstáculo ni fuera de la Arena.
6. WHEN el número de Ticks transcurridos desde la creación de una Bala alcanza el tiempo de vida máximo de la Configuración (por defecto 5 segundos, rango permitido de 0,1 a 60 segundos) multiplicado por la frecuencia de Tick, THE Motor_Juego SHALL eliminar la Bala en ese Tick, haya rebotado o no.
7. WHEN el segmento recorrido por una Bala en un Tick toca varias Paredes en puntos distintos, THE Motor_Juego SHALL procesar los contactos en el orden en que ocurren a lo largo del recorrido, aplicando a cada uno los criterios 8.2 y 8.3 y contando cada contacto como un rebote independiente.
8. WHEN una Bala toca en el mismo punto dos Paredes perpendiculares (una esquina), THE Motor_Juego SHALL invertir ambas componentes de la dirección de la Bala e incrementar el contador de rebotes en 1, contando el contacto como un único rebote.

### Requirement 9: Impactos y eliminación

**User Story:** Como Jugador, quiero que las Balas dañen y eliminen Tanques, para que la partida tenga combate.

#### Acceptance Criteria

1. WHEN durante un Tick una Bala se superpone con un Tanque activo, no invulnerable y distinto de su emisor, THE Motor_Juego SHALL restar a la vida de ese Tanque el daño de la Configuración y eliminar la Bala en ese mismo Tick. Se considera superposición que la distancia entre el centro de la Bala y el contorno del Tanque sea menor o igual al radio de la Bala.
2. WHERE el daño propio está activado en la Configuración, WHEN durante un Tick una Bala con contador de rebotes mayor o igual a 1 se superpone con su Tanque emisor activo y no invulnerable, THE Motor_Juego SHALL restar a la vida del Tanque emisor el daño de la Configuración y eliminar la Bala en ese mismo Tick.
3. WHEN la vida de un Tanque llega a 0 o menos tras un impacto, THE Motor_Juego SHALL fijar la vida del Tanque en 0, marcar el Tanque como eliminado, retirarlo de la Arena y registrar como autor de la eliminación al Tanque emisor de la Bala que causó ese impacto, incluido el caso en que el autor es el propio Tanque eliminado, todo en ese mismo Tick.
4. WHEN un Tanque es eliminado, THE Servidor_Juego SHALL enviar en el mensaje correspondiente a ese Tick, a todos los Cliente_Juego y a todas las Vista_Espectador conectados, sin filtrar por Área_Interés, una notificación con el Apodo del Tanque eliminado y el Apodo del autor. El Apodo del autor se envía aunque el autor esté eliminado o se haya desconectado después del disparo.
5. IF una Bala se superpone con un Tanque activo que está en su tiempo de invulnerabilidad tras reaparecer, THEN THE Motor_Juego SHALL eliminar la Bala sin cambiar la vida de ese Tanque.
6. IF una Bala se superpone con su Tanque emisor y su contador de rebotes es 0 o el daño propio está desactivado en la Configuración, THEN THE Motor_Juego SHALL mantener la Bala en movimiento sin cambiar la vida del Tanque emisor.
7. IF varias Balas se superponen con el mismo Tanque en un mismo Tick, THEN THE Motor_Juego SHALL procesar los impactos en orden de creación de las Balas y, una vez eliminado el Tanque, mantener en movimiento las Balas restantes sin aplicarles impacto contra ese Tanque.

### Requirement 10: Reaparición

**User Story:** Como Jugador, quiero reaparecer automáticamente tras morir, para seguir jugando sin volver a escribir mi Apodo.

#### Acceptance Criteria

1. WHEN se completa el primer Tick en que el tiempo de simulación transcurrido desde la eliminación de un Tanque es mayor o igual al tiempo de reaparición de la Configuración (por defecto 3 segundos, rango permitido de 0,5 a 60 segundos), THE Motor_Juego SHALL reaparecer el Tanque en un Punto_Seguro con vida igual a la vida máxima de la Configuración y sin Balas propias activas pendientes de su vida anterior que le resten vida por fuego amigo propio.
2. WHEN un Tanque reaparece, THE Motor_Juego SHALL conservar el identificador de Tanque, el Apodo, el momento de entrada a la partida y los puntos que el Tanque tenía tras aplicar la pérdida de puntos por eliminación.
3. THE Motor_Juego SHALL elegir como Punto_Seguro una posición en la que el Tanque quede completamente dentro de la Arena, sin superposición con ningún Obstáculo y a una distancia, medida entre centros, mayor o igual a la distancia mínima de la Configuración (por defecto 300 unidades de la Arena) respecto a cada otro Tanque activo.
4. IF el Motor_Juego no encuentra un Punto_Seguro tras el número máximo de intentos de la Configuración (por defecto 30, rango permitido de 1 a 1000), THEN THE Motor_Juego SHALL reaparecer el Tanque, entre las posiciones evaluadas que estén dentro de la Arena y libres de Obstáculos, en la que tenga la mayor distancia al Tanque activo más cercano.
5. WHILE un Tanque está eliminado, THE Cliente_Juego SHALL mostrar al Jugador una cuenta regresiva en segundos enteros, redondeada hacia arriba, hasta la reaparición, actualizada al menos una vez por segundo, y SHALL ocultarla al recibir el primer estado en que el Tanque está activo.
6. WHEN un Tanque reaparece, THE Motor_Juego SHALL otorgar al Tanque invulnerabilidad durante el tiempo de protección de la Configuración (por defecto 2 segundos, rango permitido de 0 a 10 segundos), contado en tiempo de simulación desde el Tick de reaparición, o hasta el Tick en que el Tanque crea una Bala según el criterio 7.10, lo que ocurra primero.
7. WHILE un Tanque es invulnerable, IF una Bala se superpone con ese Tanque, THEN THE Motor_Juego SHALL eliminar la Bala sin restar vida al Tanque.
8. WHILE un Tanque es invulnerable, THE Servidor_Juego SHALL indicar en el estado de ese Tanque de cada mensaje de estado que el Tanque es invulnerable, y THE Cliente_Juego y THE Vista_Espectador SHALL dibujar ese Tanque con una marca visual distinta de la de un Tanque no invulnerable.
9. WHILE un Tanque es invulnerable, THE Motor_Juego SHALL mantener la invulnerabilidad cuando el Tanque se mueve o recoge Cajas, de forma que solo el fin del tiempo de protección (criterio 10.6) o la creación de una Bala (criterio 7.10) la terminen.
10. WHEN termina la invulnerabilidad de un Tanque en un Tick, THE Servidor_Juego SHALL indicar en el estado de ese Tanque del mensaje de estado de ese mismo Tick que el Tanque no es invulnerable.

### Requirement 11: Cajas

**User Story:** Como Jugador, quiero recoger Cajas que aparecen en la Arena, para ganar puntos (y más adelante sabotajes).

#### Acceptance Criteria

1. WHILE el número de Cajas en la Arena es menor al máximo de Cajas de la Configuración (por defecto 5, rango permitido de 0 a 50), THE Motor_Juego SHALL crear una Caja cada vez que transcurre el intervalo de aparición de la Configuración (por defecto 10 segundos, rango permitido de 1 a 300 segundos). El intervalo se mide en Ticks desde la última Caja creada, o desde el momento en que el número de Cajas bajó del máximo si ese momento es posterior.
2. WHEN el Motor_Juego crea una Caja, THE Motor_Juego SHALL ubicarla en una posición en la que la Caja, con el tamaño de Caja de la Configuración, queda completamente dentro de la Arena y sin superposición con Obstáculos, con Tanques activos ni con otras Cajas.
3. IF el Motor_Juego no encuentra una posición válida para una Caja tras el número máximo de intentos de la Configuración (por defecto 20, rango permitido de 1 a 1000), THEN THE Motor_Juego SHALL omitir la creación de esa Caja, dejar sin cambios las Cajas existentes y volver a intentarlo cuando transcurra el siguiente intervalo de aparición.
4. WHEN al final del movimiento de un Tick un Tanque activo (no eliminado, incluido un Tanque con invulnerabilidad tras reaparecer) se superpone con una Caja, THE Motor_Juego SHALL sumar a ese Tanque, en ese mismo Tick, los puntos por Caja de la Configuración (por defecto 10, rango permitido de 0 a 1000) y eliminar la Caja de la Arena.
5. IF dos o más Tanques activos se superponen con la misma Caja en el mismo Tick, THEN THE Motor_Juego SHALL dar la Caja únicamente al Tanque que entró antes a la partida y sumar los puntos por Caja una sola vez.
6. WHILE un Tanque está eliminado y esperando reaparecer, THE Motor_Juego SHALL impedir que ese Tanque recoja Cajas.
7. WHEN un Tanque recoge una Caja, THE Motor_Juego SHALL emitir en ese mismo Tick un único evento de Caja recogida con el identificador del Tanque y el tipo de Caja, consumible por el Sistema_Efectos. En este spec el tipo de Caja es siempre "puntos".

### Requirement 12: Puntuación

**User Story:** Como Jugador, quiero ganar puntos al eliminar Tanques y perder parte de ellos al morir, para que haya riesgo y recompensa.

#### Acceptance Criteria

1. WHEN un Tanque elimina a un Tanque distinto de sí mismo, THE Motor_Juego SHALL sumar al autor, en el mismo Tick de la eliminación, exactamente los puntos por eliminación de la Configuración, una sola vez por cada Tanque eliminado.
2. WHEN un Tanque elimina a un Tanque distinto de sí mismo que ocupaba la primera posición de la tabla de tanques del Ranking al inicio del Tick en que ocurre la eliminación (con los empates resueltos según el criterio 13.1), THE Motor_Juego SHALL sumar al autor, además de los puntos por eliminación, la bonificación por Líder de la Configuración una sola vez.
3. WHEN un Tanque es eliminado, THE Motor_Juego SHALL restar al Tanque eliminado una cantidad igual al resultado, redondeado hacia abajo al entero, de multiplicar los puntos que tenía antes de la eliminación por el porcentaje de puntos perdidos de la Configuración y dividir entre 100 (por ejemplo, con el 50 % por defecto, un Tanque con 7 puntos pierde 3 y queda con 4, y un Tanque con 1 punto pierde 0 y queda con 1).
4. WHEN un Tanque es eliminado por una Bala de la que es emisor, THE Motor_Juego SHALL aplicar al Tanque la pérdida de puntos del criterio 12.3 y no sumarle puntos por eliminación ni bonificación por Líder.
5. THE Motor_Juego SHALL mantener los puntos de cada Tanque como un entero mayor o igual a 0 y conservarlos sin cambios mientras el Tanque está eliminado en espera de reaparecer y al reaparecer.
6. IF el Tanque autor de una eliminación fue retirado de la partida por desconexión antes del Tick en que ocurre la eliminación, THEN THE Motor_Juego SHALL no sumar puntos por eliminación ni bonificación por Líder a ningún Tanque y SHALL aplicar al Tanque eliminado la pérdida de puntos del criterio 12.3.
7. WHEN varios Tanques son eliminados en el mismo Tick, THE Motor_Juego SHALL calcular los puntos de cada eliminación de forma independiente según los criterios 12.1 a 12.4, usando como Líder el Tanque en primera posición al inicio de ese Tick, y sumar al autor el total de los puntos de todas sus eliminaciones de ese Tick.
8. WHERE la opción bots en el ranking está desactivada en la Configuración, THE Motor_Juego SHALL tomar como Líder para el criterio 12.2 el Tanque de Jugador en primera posición de la tabla de tanques al inicio del Tick, de forma que la eliminación de un Bot nunca otorgue la bonificación por Líder, y SHALL no otorgar bonificación por Líder en un Tick en que la tabla de tanques no tiene entradas.
9. THE Motor_Juego SHALL sumar y restar puntos a los Bots según los criterios 12.1 a 12.7 con independencia del valor de la opción bots en el ranking, y otorgar la bonificación por Líder a un Bot que elimina al Líder.

### Requirement 13: Ranking en vivo

**User Story:** Como Jugador, quiero ver siempre el ranking de los 10 primeros y mi posición, para saber cómo voy.

#### Acceptance Criteria

1. THE Ranking SHALL ordenar la tabla de tanques por puntos de mayor a menor; en caso de empate de puntos, por el orden de creación del Tanque en el Servidor_Juego, del más antiguo al más reciente, sin que la reaparición de un Tanque cambie su orden de creación.
2. THE Ranking SHALL asignar a cada entrada de la tabla de tanques una posición entera única y consecutiva desde 1 hasta el número de entradas, de modo que dos Tanques con los mismos puntos ocupen posiciones distintas.
3. THE Ranking SHALL incluir en la tabla de tanques todos los Tanques elegibles, tanto activos como eliminados en espera de reaparecer, y excluir los Tanques de Jugadores cuya conexión se cerró a partir del Tick en que el Tanque es retirado de la partida.
4. WHILE el Jugador está en la partida, THE Cliente_Juego SHALL mostrar las primeras entradas de la tabla de tanques, hasta un máximo de 10 (todas si hay menos de 10), con posición, Apodo y puntos de cada entrada.
5. WHILE el Tanque del Jugador ocupa una posición mayor que 10 en la tabla de tanques, THE Cliente_Juego SHALL mostrar además, debajo de las 10 primeras entradas, la posición, el Apodo y los puntos del Tanque del Jugador.
6. WHEN el Servidor_Juego envía el Ranking a un Cliente_Juego, THE Servidor_Juego SHALL incluir en el mensaje la posición y los puntos del Tanque de ese Jugador en la tabla de tanques.
7. WHEN el Cliente_Juego recibe un mensaje de Ranking, THE Cliente_Juego SHALL reemplazar el ranking mostrado por el contenido del mensaje recibido antes de dibujar el siguiente fotograma.
8. THE Ranking SHALL identificar cada Tabla_Ranking por nombre dentro del mensaje de Ranking, para permitir agregar en un spec posterior una tabla de creadores de sabotajes sin cambiar el formato del mensaje de Ranking.
9. FOR ALL conjuntos de 0 o más Tanques de Jugadores y Bots con puntos enteros mayores o iguales a 0, y para ambos valores de la opción bots en el ranking, el Ranking SHALL producir una lista que es una permutación de los Tanques elegibles del conjunto de entrada, ordenada según el criterio 13.1 y con posiciones numeradas según el criterio 13.2 (propiedad invariante).
10. WHERE la opción bots en el ranking está desactivada en la Configuración, THE Ranking SHALL excluir a los Bots de todas las Tablas_Ranking, de forma que ningún Bot ocupe una posición ni desplace la posición de un Tanque de Jugador.
11. WHERE la opción bots en el ranking está activada en la Configuración, THE Ranking SHALL incluir a los Bots en la tabla de tanques con las mismas reglas de orden y posición que los Tanques de Jugadores.
12. THE Servidor_Juego SHALL incluir en cada entrada de cada Tabla_Ranking del mensaje de Ranking un indicador booleano que indique si la entrada corresponde a un Bot.
13. WHERE la opción bots en el ranking está activada en la Configuración, THE Cliente_Juego SHALL mostrar la marca "BOT" junto al Apodo de cada entrada del Ranking cuyo indicador de Bot es verdadero.

### Requirement 14: Protocolo de mensajes

**User Story:** Como desarrollador, quiero un protocolo de mensajes definido y validado, para que cliente y servidor se entiendan y los mensajes malformados no rompan el juego.

#### Acceptance Criteria

1. THE Codificador_Mensajes SHALL convertir cada mensaje del protocolo en un texto JSON con exactamente dos campos de primer nivel: un campo de tipo, cuyo valor es una cadena de la lista de tipos conocidos del protocolo, y un campo de datos, cuyo valor es un objeto JSON.
2. WHEN el Codificador_Mensajes recibe un texto JSON válido con un tipo conocido y un campo de datos que cumple la estructura de ese tipo, THE Codificador_Mensajes SHALL convertir el texto en el objeto de mensaje correspondiente a ese tipo.
3. IF el Codificador_Mensajes recibe un texto que no es JSON, que tiene un tipo desconocido o que no cumple la estructura del tipo, THEN THE Codificador_Mensajes SHALL devolver un resultado de fallo con el motivo del rechazo, sin lanzar una excepción.
4. FOR ALL mensajes válidos del protocolo, codificar y luego decodificar SHALL producir un mensaje con el mismo tipo y con campos de datos de nombres y valores iguales a los del original (propiedad de ida y vuelta).
5. IF el Servidor_Juego recibe un texto que no es JSON, de tipo desconocido, con campos obligatorios faltantes, con campos de tipo de dato incorrecto o con valores fuera de rango, THEN THE Validador SHALL descartar el mensaje, registrar en consola el tipo de fallo y el identificador de la conexión, mantener la conexión abierta y dejar sin cambios la posición, la vida, los puntos, el último Input y el resto del estado de la partida.
6. IF el Servidor_Juego recibe un mensaje cuyo tamaño en bytes es mayor que el tamaño máximo de mensaje de la Configuración (por defecto 1024 bytes) y menor o igual al tamaño máximo de trama de la Configuración (por defecto 65536 bytes), THEN THE Servidor_Juego SHALL descartar el mensaje antes de decodificarlo, registrar en consola el tamaño recibido y el identificador de la conexión, mantener la conexión abierta, contar el mensaje en el Limitador_Mensajes según el criterio 15.1 y dejar sin cambios el estado de la partida.
7. THE Validador SHALL aceptar un Input solo si contiene las teclas W, A, S y D y el disparo con valores booleanos, y un ángulo de apuntado en radianes de tipo numérico finito (se rechazan NaN, Infinity y -Infinity), e ignorar cualquier campo adicional del Input.
8. IF el Servidor_Juego recibe un mensaje de Input de una conexión sin Tanque, o un mensaje de entrada con Apodo de una conexión que ya tiene un Tanque, THEN THE Validador SHALL descartar el mensaje sin modificar el estado de la partida ni el Tanque existente.
9. IF el Servidor_Juego recibe un mensaje cuyo tamaño en bytes es mayor que el tamaño máximo de trama de la Configuración, THEN THE Servidor_Juego SHALL cerrar la conexión con el código de cierre 1009 (mensaje demasiado grande), sin decodificar ni interpretar el contenido del mensaje, y retirar el Tanque asociado, si existe, según el criterio 16.1.

### Requirement 15: Límite de frecuencia de mensajes

**User Story:** Como organizador, quiero limitar cuántos mensajes envía cada cliente, para proteger el servidor público de abusos.

#### Acceptance Criteria

1. THE Limitador_Mensajes SHALL contar, de forma independiente para cada conexión del Cliente_Juego o de la Vista_Espectador, todos los mensajes recibidos, incluidos los que el Validador descarte después, en ventanas fijas y consecutivas de 1 segundo que empiezan en el momento en que se abre la conexión.
2. IF una conexión recibe en una ventana más mensajes que el máximo de mensajes por segundo de la Configuración (por defecto 90, rango permitido de 1 a 1000 y mínimo de 2 veces la frecuencia de Tick según los criterios 1.10 y 1.11), THEN THE Limitador_Mensajes SHALL entregar al Validador solo los primeros mensajes de esa ventana, por orden de llegada, hasta alcanzar el máximo, y descartar los excedentes sin que modifiquen el estado de la partida.
3. IF una conexión supera el máximo de mensajes por segundo durante el número de ventanas consecutivas de la Configuración (por defecto 3, rango permitido de 1 a 60), THEN THE Servidor_Juego SHALL cerrar la conexión con un código de cierre que indique exceso de mensajes y retirar el Tanque asociado según el criterio 16.1.
4. WHEN termina una ventana en la que una conexión recibió un número de mensajes menor o igual al máximo de mensajes por segundo, THE Limitador_Mensajes SHALL poner a 0 el contador de ventanas consecutivas excedidas de esa conexión.
5. WHILE una conexión no supera el máximo de mensajes por segundo en la ventana actual, THE Limitador_Mensajes SHALL entregar al Validador cada mensaje recibido en esa ventana, sin descartar ninguno.

### Requirement 16: Desconexión

**User Story:** Como Jugador, quiero que mi Tanque desaparezca al cerrar la página, para que la Arena no se llene de Tanques abandonados.

#### Acceptance Criteria

1. WHEN la conexión de un Jugador se cierra, THE Servidor_Juego SHALL retirar el Tanque del Jugador de la partida y de la tabla de tanques del Ranking en el siguiente Tick, tanto si el Tanque está activo como si está eliminado en espera de reaparecer, de forma que el Tanque no figure en ningún mensaje de estado ni de Ranking enviado después de ese Tick.
2. WHEN la conexión de un Jugador se cierra, THE Sistema_Efectos SHALL invocar la función de finalización de cada Efecto cuyo objetivo es el Tanque retirado, si el Efecto la define, y retirar esos Efectos de los activos dentro del mismo Tick en que se retira el Tanque.
3. WHILE una conexión está abierta, THE Servidor_Juego SHALL enviar a esa conexión un mensaje de comprobación cada intervalo de comprobación de la Configuración (por defecto 10 segundos).
4. IF una conexión no responde a ningún mensaje de comprobación durante el tiempo de espera de la Configuración (por defecto 30 segundos, y siempre mayor que el intervalo de comprobación), THEN THE Servidor_Juego SHALL cerrar la conexión y aplicar al Tanque asociado, si existe, las mismas reglas de retirada de los criterios 16.1, 16.2 y 16.5.
5. WHEN el Servidor_Juego retira el Tanque de un Jugador desconectado, THE Motor_Juego SHALL eliminar en ese mismo Tick todas las Balas activas cuyo emisor es el Tanque retirado.
6. WHEN el Servidor_Juego retira el Tanque de un Jugador desconectado, THE Servidor_Juego SHALL liberar el Apodo y la plaza de ese Jugador, de forma que un nuevo Jugador pueda entrar con el mismo Apodo sin sufijo numérico y el conteo del número máximo de Jugadores se reduzca en 1.
7. WHEN la conexión de una Vista_Espectador se cierra, THE Servidor_Juego SHALL dejar de enviarle mensajes y mantener sin cambios los Tanques, Balas, Cajas, Efectos y el Ranking de la partida.

### Requirement 17: Cliente de juego y cámara

**User Story:** Como Jugador, quiero ver la Arena desde arriba con la cámara siguiendo a mi Tanque, para orientarme en una Arena más grande que mi pantalla.

#### Acceptance Criteria

1. WHEN el Cliente_Juego dibuja un cuadro, THE Cliente_Juego SHALL dibujar en un Canvas HTML5 la porción de la Arena incluida en el Área_Visible, escalada según el criterio 17.14, con sus Obstáculos, las Balas, las Cajas y los Tanques no eliminados, cada Tanque con su Apodo encima y una barra de vida cuya parte llena mide la vida actual dividida por la vida máxima de la Configuración, multiplicada por el ancho total de la barra.
2. WHILE el Tanque del Jugador está activo, THE Cliente_Juego SHALL ubicar la cámara de forma que el centro del Área_Visible coincida con el centro del Tanque del Jugador, desplazando el Área_Visible lo mínimo necesario en cada eje para que quede dentro de la Arena; en un eje en que la Arena es menor que el Área_Visible, THE Cliente_Juego SHALL centrar la Arena dentro del Área_Visible en ese eje.
3. WHILE el Tanque del Jugador está eliminado y esperando reaparecer, THE Cliente_Juego SHALL mantener el Origen de cámara fijo en el valor que tenía en el Tick de la eliminación hasta que el Tanque reaparezca.
4. WHEN la ventana del navegador cambia de tamaño, THE Cliente_Juego SHALL fijar el ancho y el alto del Canvas al ancho y alto interiores de la ventana, recalcular el Factor de escala de cámara y las Franjas según el criterio 17.14 y recalcular el Origen de cámara según los criterios 17.2 y 17.3, antes de dibujar el siguiente cuadro, sin cambiar el ancho ni el alto del Área_Visible en unidades de Arena.
5. THE Cliente_Juego SHALL enviar como máximo un Input por intervalo de envío, de forma que el tiempo entre dos Inputs consecutivos enviados sea mayor o igual al intervalo de envío (por defecto 1/30 de segundo, es decir, como máximo 30 Inputs por segundo), con independencia de la frecuencia de refresco del monitor y del número de cuadros dibujados por segundo.
6. WHEN durante un intervalo de envío cambia el estado de presión de alguna de las teclas W, A, S, D, el estado del botón principal del mouse o el ángulo de apuntado, THE Cliente_Juego SHALL enviar al empezar el siguiente intervalo de envío un único Input con el estado más reciente de las cuatro teclas, del disparo y del ángulo de apuntado, agrupando en ese Input todos los cambios ocurridos durante el intervalo.
7. THE Cliente_Juego SHALL calcular el ángulo de apuntado, en radianes, como la dirección del vector que va desde el centro del Tanque propio hasta el punto de la Arena bajo el cursor, obtenido en cada eje restando a la posición del cursor en el Canvas el desplazamiento de la Franja de ese eje, dividiendo el resultado por el Factor de escala de cámara y sumando la coordenada del Origen de cámara; THE Cliente_Juego SHALL aplicar la misma conversión cuando el cursor está sobre una Franja.
8. THE Cliente_Juego SHALL dibujar el Tanque propio, los Tanques de otros Jugadores y los Bots con tres colores de relleno distintos, uno por categoría, y usar el mismo color para todos los Tanques de una misma categoría.
9. IF la ventana del navegador pierde el foco mientras alguna tecla de movimiento o el botón del mouse está presionado, THEN THE Cliente_Juego SHALL enviar, al empezar el siguiente intervalo de envío según el criterio 17.5, un Input con las cuatro teclas de movimiento y el disparo en estado no presionado.
10. IF la conexión WebSocket se cierra, THEN THE Cliente_Juego SHALL dejar de enviar Inputs, mostrar un mensaje que indique la pérdida de conexión y un botón que, al pulsarlo, muestre la pantalla de ingreso de Apodo.
11. IF durante un intervalo de envío no cambia el estado de ninguna tecla de movimiento, del botón principal del mouse ni del ángulo de apuntado, THEN THE Cliente_Juego SHALL omitir el envío de Input al empezar el siguiente intervalo de envío.
12. IF durante un intervalo de envío una tecla de movimiento o el botón principal del mouse cambia de estado y vuelve al estado que tenía en el último Input enviado, THEN THE Cliente_Juego SHALL enviar al empezar el siguiente intervalo de envío un Input con esa tecla o ese botón en el estado opuesto al del último Input enviado y, al empezar el intervalo de envío posterior, un Input con el estado más reciente, de forma que ninguna pulsación se pierda.
13. THE Cliente_Juego SHALL dibujar junto al Apodo de cada Bot la etiqueta "BOT" y los puntos del Bot, usando el indicador de Bot y los puntos recibidos en el mensaje de estado.
14. THE Cliente_Juego SHALL dibujar el Área_Visible en el Canvas multiplicando las distancias en unidades de Arena por el Factor de escala de cámara, con el mismo factor en ambos ejes, y centrando el Área_Visible escalada en el Canvas, de forma que las Franjas tengan el mismo tamaño a ambos lados del eje en que aparecen.
15. THE Cliente_Juego SHALL rellenar las Franjas con un único color neutro, distinto del color de fondo de la Arena, y SHALL dibujar en el Canvas únicamente las entidades y Obstáculos, o la parte de ellos, situados dentro del Área_Visible.
16. THE Configuración SHALL definir el ancho y el alto del Área_Visible en unidades de Arena, con valores por defecto 1440 y 900 y un rango permitido de 400 a 10000 para cada uno.
17. WHEN el Cliente_Juego recibe el mensaje de bienvenida del criterio 3.7, THE Cliente_Juego SHALL usar como ancho y alto del Área_Visible los valores recibidos en ese mensaje, con independencia del tamaño de la ventana, de la resolución de la pantalla y de la densidad de píxeles del dispositivo.
18. THE Cliente_Juego SHALL dibujar el Ranking, la cuenta regresiva de reaparición y los avisos de desconexión en coordenadas de pantalla, sin aplicar el Factor de escala de cámara, con un tamaño de letra de al menos 14 píxeles CSS para cualquier tamaño de ventana.
19. FOR ALL tamaños de Canvas positivos, posiciones del Tanque dentro de la Arena y Arenas válidas, la región de la Arena dibujada en el Canvas SHALL tener en cada eje exactamente el tamaño del Área_Visible, o el tamaño de la Arena si la Arena es menor en ese eje, SHALL estar contenida en la Arena, y la conversión de un punto del Canvas a coordenadas de la Arena (criterio 17.7) seguida de la conversión inversa a coordenadas del Canvas SHALL devolver el punto original con una tolerancia de 1e−9 píxeles relativa a la magnitud de las coordenadas (propiedad invariante y de ida y vuelta).

### Requirement 18: Interpolación en el cliente

**User Story:** Como Jugador conectado desde lejos, quiero que el movimiento se vea fluido, para jugar cómodo con la latencia real de internet.

#### Acceptance Criteria

1. THE Cliente_Juego SHALL asignar a cada mensaje de estado recibido un instante de simulación igual a su número de Tick dividido por la frecuencia de Tick, y SHALL calcular el instante de render como el instante de simulación del último estado recibido, más el tiempo local transcurrido desde su recepción, menos el retardo de interpolación de la Configuración (por defecto 100 ms, rango permitido de 0 a 1000 ms).
2. WHILE el Cliente_Juego tiene un estado A con instante de simulación menor o igual al instante de render y un estado B con instante de simulación mayor al instante de render, THE Cliente_Juego SHALL dibujar cada Tanque y cada Bala presentes en ambos estados en la posición A + (B − A) × f, donde f es igual a (instante de render − instante de A) dividido por (instante de B − instante de A).
3. WHEN el Cliente_Juego interpola la orientación del cañón de un Tanque, THE Cliente_Juego SHALL interpolar por el camino angular más corto, de forma que la diferencia angular recorrida entre A y B sea menor o igual a π radianes.
4. IF el Cliente_Juego no tiene un estado con instante de simulación posterior al instante de render, THEN THE Cliente_Juego SHALL dibujar cada entidad en la última posición y orientación recibidas, sin extrapolar más allá de ellas.
5. WHEN una entidad está presente en un estado recibido y ausente del estado recibido inmediatamente anterior (por ser nueva o por entrar en el Área_Interés del Jugador), o un Tanque pasa de eliminado a activo, THE Cliente_Juego SHALL dibujar la entidad en la posición recibida en ese estado, sin interpolar desde ninguna posición anterior, aunque la entidad haya estado presente en estados más antiguos.
6. WHEN el instante de render alcanza el instante de simulación de un estado en el que una entidad ya no está presente (por haber sido eliminada o por salir del Área_Interés del Jugador) o un Tanque figura como eliminado, THE Cliente_Juego SHALL dejar de dibujar esa entidad.
7. IF el Cliente_Juego recibe un mensaje de estado con un número de Tick menor o igual al del último estado recibido, THEN THE Cliente_Juego SHALL descartar ese mensaje sin modificar lo que dibuja.
8. FOR ALL pares de estados y factores de interpolación f entre 0 y 1 inclusive, la posición interpolada SHALL estar en el segmento entre ambas posiciones y coincidir con la posición de A cuando f es 0 y con la posición de B cuando f es 1 (propiedad invariante).

### Requirement 19: Vista de espectador

**User Story:** Como organizador, quiero una vista de espectador con toda la Arena y el Ranking en grande, para proyectarla en una transmisión.

#### Acceptance Criteria

1. THE Vista_Espectador SHALL dibujar la Arena completa, con sus Obstáculos, Tanques (con Apodo y barra de vida), Balas y Cajas, usando un único factor de escala igual al menor valor entre el ancho de la ventana dividido por el ancho de la Arena y el alto de la ventana dividido por el alto de la Arena, de forma que la Arena quede centrada, visible por completo y con la misma proporción entre ancho y alto que en la Configuración.
2. WHEN la ventana del navegador cambia de tamaño, THE Vista_Espectador SHALL recalcular el factor de escala del criterio 19.1 y volver a dibujar la Arena completa con el nuevo tamaño antes del siguiente fotograma.
3. WHEN la Vista_Espectador recibe un mensaje de Ranking, THE Vista_Espectador SHALL mostrar, para cada Tabla_Ranking del mensaje, su nombre y hasta 10 primeras entradas con posición, Apodo y puntos, en el orden recibido y con un tamaño de letra de al menos 1,5 veces el tamaño de letra del Ranking del Cliente_Juego, y con la marca "BOT" junto al Apodo de cada entrada cuyo indicador de Bot es verdadero.
4. WHEN la Vista_Espectador se conecta al Servidor_Juego, THE Servidor_Juego SHALL registrar la conexión como espectador sin crear un Tanque y le SHALL enviar las dimensiones de la Arena, la lista de Obstáculos y, a partir del siguiente Tick, mensajes de estado con la Arena completa según el criterio 5.13 y los mismos mensajes de Ranking que recibe un Cliente_Juego.
5. IF el Servidor_Juego recibe un mensaje de entrada con Apodo o un mensaje de Input desde una conexión de espectador, THEN THE Servidor_Juego SHALL descartar el mensaje sin crear un Tanque ni alterar el estado de la partida.
6. THE Vista_Espectador SHALL aplicar a las entidades la misma interpolación definida para el Cliente_Juego en el Requirement 18, con el mismo retardo de interpolación de la Configuración.
7. WHEN un Tanque es eliminado, THE Vista_Espectador SHALL mostrar durante 5 segundos un aviso con el Apodo del autor y el Apodo del Tanque eliminado, con un máximo de 5 avisos visibles a la vez y retirando el más antiguo cuando llegue un sexto aviso.
8. IF la conexión WebSocket de la Vista_Espectador se cierra, THEN THE Vista_Espectador SHALL mostrar un mensaje de desconexión e intentar reconectarse al Servidor_Juego cada 3 segundos hasta lograrlo, y al reconectarse SHALL retirar el mensaje de desconexión y volver a dibujar la partida.
9. THE Vista_Espectador SHALL dibujar los Bots con un color de relleno distinto del de los Tanques de Jugadores, igual para todos los Bots, y con la etiqueta "BOT" y los puntos del Bot junto a su Apodo, usando el indicador de Bot y los puntos recibidos en el mensaje de estado.

### Requirement 20: Bots para pruebas en solitario

**User Story:** Como participante que prueba solo en su máquina, quiero Bots que se muevan, esquiven obstáculos y disparen, para probar el juego sin otros Jugadores.

#### Acceptance Criteria

1. WHEN el Servidor_Juego arranca, THE Controlador_Bots SHALL crear la cantidad de Bots definida en la Configuración, que debe ser un entero entre 0 y 20, cada uno en un Punto_Seguro con 0 puntos y vida completa.
2. IF la Configuración no define la cantidad de Bots, THEN THE Controlador_Bots SHALL usar el valor 0 y no crear Bots.
3. THE Controlador_Bots SHALL generar en cada Tick exactamente un Input por cada Bot, con la misma estructura de Input que los Jugadores (teclas W, A, S, D, ángulo de apuntado y disparo) y que el Validador acepte según el criterio 14.7.
4. WHEN un Bot tiene una Pared a una distancia menor que la distancia de detección de la Configuración (por defecto 60 unidades de la Arena) en su dirección de movimiento, THE Controlador_Bots SHALL cambiar en ese mismo Tick la dirección de movimiento del Bot a una de las 8 direcciones posibles con WASD que no tenga ninguna Pared dentro de la distancia de detección, y, si ninguna de las 8 direcciones cumple esa condición, a la dirección opuesta a la actual.
5. WHILE uno o más Tanques activos distintos del Bot están a una distancia menor o igual al alcance de visión de la Configuración (por defecto 500 unidades de la Arena) y ningún Obstáculo corta el segmento entre el centro del Bot y el centro del Tanque, THE Controlador_Bots SHALL fijar el ángulo de apuntado del Bot hacia el centro del Tanque más cercano que cumpla esas condiciones y activar el disparo en el Input del Bot.
6. WHILE ningún Tanque activo cumple las condiciones del criterio 20.5 para un Bot, THE Controlador_Bots SHALL desactivar el disparo del Bot y moverlo hacia un punto de destino de la Arena sin superposición con Obstáculos, elegido con la fuente de números aleatorios que recibe el Motor_Juego.
7. WHEN un Bot llega a una distancia menor o igual a la distancia de llegada de la Configuración (por defecto 20 unidades de la Arena) de su punto de destino, o pasa el tiempo máximo por destino de la Configuración (por defecto 10 segundos) sin llegar, THE Controlador_Bots SHALL elegir un nuevo punto de destino según el criterio 20.6.
8. THE Motor_Juego SHALL aplicar a los Bots las mismas reglas de movimiento, disparo, recarga, daño, puntos y reaparición que a los Tanques de Jugadores, incluida la omisión de Inputs mientras el Bot está eliminado (criterio 7.7).
9. THE Servidor_Juego SHALL asignar a cada Bot un Apodo con el formato "Bot" seguido de un espacio y un número entero, desde 1 hasta la cantidad de Bots, de forma que ningún Apodo de Bot se repita y todos cumplan las reglas de Apodo del Validador.
10. THE Servidor_Juego SHALL marcar cada Bot con el indicador de Bot en verdadero y cada Tanque de Jugador con el indicador de Bot en falso, en el mensaje de estado y en las entradas del Ranking, durante toda la vida del Tanque.
11. THE Motor_Juego SHALL mantener los puntos de cada Bot según el Requirement 12 y enviarlos en el mensaje de estado con independencia del valor de la opción bots en el ranking, aunque el Bot no figure en ninguna Tabla_Ranking.

### Requirement 21: Puntos de extensión para Efectos

**User Story:** Como desarrollador de los specs futuros, quiero puntos de extensión en el bucle del juego, para que los sabotajes puedan alterar la partida sin modificar el Motor_Juego.

#### Acceptance Criteria

1. WHEN se solicita activar un Efecto sobre un Tanque objetivo presente en la partida con una duración entera en milisegundos entre 1 y la duración máxima de la Configuración (por defecto 60000 ms), THE Sistema_Efectos SHALL registrar el Efecto como activo con su nombre, su Tanque objetivo, su duración y su orden de activación, y SHALL tratar cada activación como un Efecto independiente aunque el mismo Efecto ya esté activo sobre ese Tanque.
2. IF se solicita activar un Efecto con una duración que no es un entero, es menor que 1 o es mayor que la duración máxima de la Configuración, o sobre un Tanque que no está en la partida o está eliminado, THEN THE Sistema_Efectos SHALL rechazar la activación, devolver a quien la solicitó un error que indique la regla incumplida y dejar sin cambios la lista de Efectos activos y el estado de la partida.
3. WHEN un Tick procesa el Input de un Tanque, THE Sistema_Efectos SHALL entregar el Input a cada Efecto activo sobre ese Tanque que defina un modificador de Input, en orden de activación de menor a mayor. Cada modificador SHALL recibir el Input devuelto por el modificador anterior, y el Motor_Juego SHALL aplicar en ese mismo Tick el Input devuelto por el último modificador.
4. WHEN un Tick avanza, THE Sistema_Efectos SHALL invocar exactamente una vez la función de Tick de cada Efecto activo que la defina, en orden de activación de menor a mayor, después de aplicar los Inputs y antes de que el Servidor_Juego envíe el mensaje de estado de ese Tick.
5. WHEN se activa un Efecto, THE Sistema_Efectos SHALL invocar exactamente una vez la función de activación del Efecto, si el Efecto la define, antes de la primera invocación de su modificador de Input o de su función de Tick.
6. WHEN el tiempo acumulado de un Efecto alcanza o supera su duración, THE Sistema_Efectos SHALL invocar exactamente una vez la función de finalización del Efecto, si la define, y retirar el Efecto de los activos dentro del mismo Tick. El tiempo acumulado es el número de Ticks completados desde la activación multiplicado por 1000 dividido por la frecuencia de Tick.
7. WHEN el Tanque objetivo de un Efecto es eliminado o retirado de la partida, THE Sistema_Efectos SHALL invocar exactamente una vez la función de finalización del Efecto, si la define, y retirar el Efecto de los activos dentro del mismo Tick en que ocurre la eliminación o la retirada.
8. IF la función de activación, el modificador de Input o la función de Tick de un Efecto lanza una excepción, THEN THE Sistema_Efectos SHALL registrar el error con el nombre del Efecto, invocar una vez la función de finalización del Efecto si la define, retirar el Efecto de los activos y continuar el Tick con los demás Efectos. En el caso del modificador de Input, el siguiente modificador SHALL recibir el Input que había recibido el modificador que falló.
9. IF la función de finalización de un Efecto lanza una excepción, THEN THE Sistema_Efectos SHALL registrar el error con el nombre del Efecto, retirar el Efecto de los activos sin volver a invocar su función de finalización y continuar el Tick.
10. WHILE un Efecto está activo, THE Servidor_Juego SHALL incluir en cada mensaje de estado, dentro del Tanque objetivo, el nombre del Efecto y su tiempo restante. El tiempo restante es un entero de milisegundos igual a la duración menos el tiempo acumulado, con un mínimo de 0.
11. FOR ALL secuencias de activaciones de Efectos con duraciones válidas, el número de Efectos activos tras cada Tick SHALL ser igual al número de Efectos activados con éxito cuyo tiempo acumulado es menor que su duración, cuyo objetivo sigue en la partida sin estar eliminado y que no fueron retirados por una excepción (propiedad invariante).

### Requirement 22: API limitada mediante Contexto_Efecto

**User Story:** Como organizador, quiero que los Efectos solo accedan al juego por una API limitada, para que un sabotaje no pueda romper el estado interno de la partida.

#### Acceptance Criteria

1. THE Sistema_Efectos SHALL pasar a cada función de un Efecto (activación, Tick, modificador de Input y finalización) un Contexto_Efecto como único argumento de acceso a la partida, sin pasar referencias al Motor_Juego, a otros Tanques, a las Balas, a las Cajas ni al Ranking.
2. THE Contexto_Efecto SHALL exponer únicamente estas consultas: la posición (x, y en coordenadas de la Arena), la vida, los puntos, el Apodo y el Identificador_Objetivo del Tanque objetivo; el número de Tick actual; y el tiempo restante del Efecto en milisegundos, como valor mayor o igual a 0. La consulta del Identificador_Objetivo SHALL devolver el mismo valor a todos los Efectos activos sobre el mismo Tanque.
3. THE Contexto_Efecto SHALL exponer la lectura y la escritura del multiplicador de velocidad del Tanque objetivo. El valor inicial es 1, el rango permitido es el de la Configuración (por defecto de 0,2 a 3, ambos incluidos) y el Motor_Juego usa en cada Tick el último valor fijado por cualquier Efecto antes del paso de movimiento de ese Tick.
4. WHEN un Efecto modifica un dato que obtuvo de una consulta del Contexto_Efecto, THE Contexto_Efecto SHALL devolver el valor original sin cambios en la siguiente consulta del mismo dato, y el estado del Motor_Juego SHALL quedar sin cambios.
5. IF un Efecto fija el multiplicador de velocidad a un número finito fuera del rango permitido, THEN THE Contexto_Efecto SHALL guardar el límite más cercano del rango: el mínimo si el valor es menor y el máximo si es mayor.
6. IF un modificador de Input devuelve un valor que no es un objeto, al que le falta algún campo de Input, que tiene teclas o disparo con valores no booleanos o que tiene un ángulo de apuntado no numérico o no finito, THEN THE Sistema_Efectos SHALL descartar el valor devuelto y pasar al siguiente modificador, o al Motor_Juego, el mismo Input que había recibido ese modificador.
7. IF un Efecto fija el multiplicador de velocidad a un valor no numérico o no finito (NaN, Infinity o -Infinity), THEN THE Contexto_Efecto SHALL rechazar el valor, conservar el multiplicador vigente y registrar el error con el nombre del Efecto.
8. IF un Efecto usa su Contexto_Efecto después de haber sido retirado de los Efectos activos, THEN THE Contexto_Efecto SHALL ignorar las escrituras sin modificar el estado del Motor_Juego.
9. THE Contexto_Efecto SHALL limitar todas sus consultas y escrituras al Tanque objetivo del Efecto, sin ofrecer ninguna operación que reciba un Identificador_Objetivo, un Apodo o un identificador de Tanque como argumento para consultar o modificar otro Tanque.
10. WHEN el Motor_Juego crea un Tanque de Jugador o un Bot, THE Motor_Juego SHALL asignarle en ese mismo Tick un Identificador_Objetivo de tipo texto obtenido de la fuente de números aleatorios de la partida, sin calcularlo a partir del identificador interno del Tanque, del Apodo ni del orden de creación.
11. IF el valor generado para un Identificador_Objetivo coincide con el Identificador_Objetivo de cualquier Tanque creado antes en la misma partida, incluidos los Tanques ya retirados, THEN THE Motor_Juego SHALL generar un nuevo valor con la fuente de números aleatorios de la partida hasta obtener uno no usado.
12. THE Motor_Juego SHALL conservar sin cambios el Identificador_Objetivo de un Tanque desde su creación hasta su retirada de la partida, incluidos los Ticks en que el Tanque es eliminado o reaparece y cualquier cambio de su Apodo.
13. THE Servidor_Juego SHALL excluir el Identificador_Objetivo de todos los mensajes enviados al Cliente_Juego y a la Vista_Espectador, incluidos los mensajes de bienvenida, de estado, de Ranking y de error.
14. FOR ALL secuencias de altas, bajas, eliminaciones y reapariciones de Tanques de Jugadores y Bots, incluidas altas con un Apodo igual al de un Tanque retirado antes, el Identificador_Objetivo de cada Tanque SHALL ser constante mientras el Tanque está en la partida y distinto del Identificador_Objetivo de cualquier otro Tanque creado en la misma partida (propiedad invariante).

### Requirement 23: Efecto interno de ejemplo

**User Story:** Como desarrollador, quiero un Efecto de ejemplo que reduzca la velocidad del objetivo, para comprobar que los puntos de extensión funcionan.

#### Acceptance Criteria

1. WHEN se activa el Efecto_Ralentizar sobre un Tanque, THE Efecto_Ralentizar SHALL fijar el multiplicador de velocidad del Tanque al factor de ralentización de la Configuración (por defecto 0,5, dentro del rango del multiplicador de velocidad del criterio 22.3) mediante el Contexto_Efecto, con efecto a partir del primer Tick posterior a la activación.
2. THE Configuración SHALL definir la duración del Efecto_Ralentizar en milisegundos, con valor por defecto de 5000 ms y rango permitido de 100 a 60000 ms.
3. WHEN una instancia del Efecto_Ralentizar finaliza por fin de su duración, por eliminación del Tanque objetivo o por retirada del Tanque objetivo, THE Efecto_Ralentizar SHALL restar 1 a su cuenta de instancias activas asociada al Identificador_Objetivo del Tanque, obtenido del Contexto_Efecto, y SHALL restaurar a 1 el multiplicador de velocidad del Tanque mediante el Contexto_Efecto solo si esa cuenta llega a 0; si la cuenta queda mayor que 0, SHALL mantener el factor de ralentización.
4. WHILE el Efecto_Ralentizar está activo sobre un Tanque y el movimiento del Tanque no está bloqueado por un Obstáculo ni por el borde de la Arena, THE Motor_Juego SHALL desplazar ese Tanque en cada Tick una distancia igual a la velocidad base de la Configuración multiplicada por el factor de ralentización y dividida por la frecuencia de Tick, con una tolerancia de 0,001 unidades de la Arena, tanto en línea recta como en diagonal.
5. WHEN transcurre el primer Tick después de la finalización del último Efecto_Ralentizar activo sobre un Tanque, THE Motor_Juego SHALL desplazar ese Tanque a la velocidad base de la Configuración sin multiplicador.
6. WHERE el modo de depuración está activado en la Configuración (por defecto desactivado), WHEN un Tanque recoge una Caja, THE Sistema_Efectos SHALL activar el Efecto_Ralentizar, con la duración de la Configuración, sobre un Tanque activo distinto del que recogió la Caja, elegido con la fuente de números aleatorios entregada al Motor_Juego.
7. WHERE el modo de depuración está activado en la Configuración, IF un Tanque recoge una Caja y no existe ningún otro Tanque activo en la partida, THEN THE Sistema_Efectos SHALL omitir la activación del Efecto_Ralentizar sin afectar la recogida de la Caja ni los puntos otorgados.
8. WHEN se activa una instancia del Efecto_Ralentizar, THE Efecto_Ralentizar SHALL sumar 1 a su cuenta de instancias activas asociada al Identificador_Objetivo del Tanque objetivo, creando la entrada con valor 1 si no existe.
9. WHEN la cuenta de instancias activas del Efecto_Ralentizar asociada a un Identificador_Objetivo llega a 0, THE Efecto_Ralentizar SHALL eliminar esa entrada de la cuenta en el mismo Tick.
10. THE Efecto_Ralentizar SHALL llevar cuentas independientes para Tanques con distinto Identificador_Objetivo, de forma que un Tanque nuevo que entra con el mismo Apodo que un Tanque retirado empiece sin instancias activas del Efecto_Ralentizar.

### Requirement 24: Calidad, pruebas y organización

**User Story:** Como estudiante del taller, quiero un proyecto probado y con una estructura de carpetas clara, para entenderlo y modificarlo con confianza.

#### Acceptance Criteria

1. THE Motor_Juego SHALL ejecutarse sin importar la librería ws, los módulos de red o HTTP de Node.js ni ningún módulo del Servidor_Juego, de forma que una prueba pueda crear una partida, enviar Inputs y avanzar Ticks sin abrir conexiones ni puertos.
2. THE Motor_Juego SHALL recibir la fuente de números aleatorios y la Configuración como parámetros al crear una partida, sin leer el archivo de Configuración ni usar una fuente aleatoria global por su cuenta.
3. THE proyecto SHALL incluir al menos una prueba automática para cada una de estas áreas: colisiones de Tanques con Obstáculos y bordes de la Arena, rebotes de Balas, impactos y eliminación, puntuación, Ranking, validación de Apodos, validación de Inputs, Codificador_Mensajes, Limitador_Mensajes, interpolación del Cliente_Juego y Sistema_Efectos.
4. THE proyecto SHALL incluir pruebas automáticas de las propiedades de los criterios 5.14, 13.9, 14.4, 17.19, 18.8, 21.11, 22.14 y 24.7, cada una evaluada con al menos 100 casos de entrada generados desde una semilla fija.
5. WHEN se ejecuta `npm test` en la raíz del proyecto, THE proyecto SHALL ejecutar todas las pruebas automáticas una sola vez, sin modo de observación, sin necesitar el Servidor_Juego en marcha, y terminar con código 0 si todas pasan.
6. IF al menos una prueba automática falla al ejecutar `npm test`, THEN THE proyecto SHALL mostrar en consola el nombre de cada prueba fallida y terminar con un código de salida distinto de 0.
7. FOR ALL semillas, Configuraciones válidas y secuencias de Inputs, dos partidas del Motor_Juego creadas con la misma semilla, la misma Configuración y la misma secuencia de Inputs SHALL tener un estado idéntico de Tanques, Balas, Cajas y Ranking tras el mismo número de Ticks (propiedad de reproducibilidad).
8. THE proyecto SHALL separar en carpetas distintas el Motor_Juego, el Servidor_Juego (red y HTTP), el Cliente_Juego, la Vista_Espectador, el código compartido entre cliente y servidor, el Sistema_Efectos, el Controlador_Bots y las pruebas, de forma que ningún archivo de una de esas partes esté en la carpeta de otra.
9. THE proyecto SHALL incluir en la raíz un archivo README que describa en una línea cada carpeta del criterio 24.8 y que indique los comandos `npm start` y `npm test` con lo que hace cada uno.
