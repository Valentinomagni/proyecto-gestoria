# Requisitos verificables, etapas y adopcion

> Salida de un diseno automatico del 18/08/2026. **SIN VERIFICAR**: los revisores
> adversariales y el critico de completitud no llegaron a correr (limite de gasto).
> El plan en `docs/superpowers/plans/` lo corrige donde hacia falta; ver el
> INDICE, seccion 4.

## Resumen

Diseñé el sistema de Gestoría como 40 requisitos verificables numerados (R1–R40), cada uno con la comprobación al lado, cubriendo las 7 exigencias de "A TENER EN CUENTA" (líneas 26–32 del documento fuente) y las 6 ideas de la sección "IDEAS" (líneas 20–24), más las dos dificultades declaradas. La idea central es una sola: el saldo de cada Tarjeta Habitualista no se guarda en ninguna columna, se calcula como suma de un libro de movimientos inmutable, y se muestra en TRES cifras — contable, comprometido y disponible — donde "comprometido" es la suma de los presupuestos cargados y todavía no pagados. Esa tercera cifra es lo que mata el pisón de saldos entre San Luis y San Juan, porque el dinero que San Juan todavía no gastó ya figura como gastado para San Luis. La etapa 1 entrega exactamente eso más la bandeja de Solicitudes de Fondos que reemplaza la hoja del cuaderno de la imagen 01, y ya sirve sola aunque no se construya nada más. El Excel de la imagen 04 no convive: se importa completo a una tabla histórica de sólo lectura en la etapa 5, se archiva el archivo original con su hash, y deja de escribirse en una fecha anunciada.

## Decisiones

### Dónde vive el saldo de la Tarjeta Habitualista

**Decision.** No existe ninguna columna `saldo` en ninguna tabla. El saldo es `sum(monto)` sobre la tabla `movimientos`, expuesto por la vista `saldos`. Los movimientos no se editan ni se borran: se revoca `update` y `delete` a `authenticated` y las correcciones son filas nuevas de tipo 'ajuste'.

**Por que.** La dificultad declarada en el documento fuente, línea 16, es literalmente que 'muchas veces nos pisamos los saldos disponibles'. Un saldo guardado en una columna se desincroniza y no deja rastro de dónde. Con un libro de movimientos, cada peso tiene una fila con autor, fecha y motivo, y la diferencia se puede encontrar. Además la migración 54 del Tablero (líneas 51-57) ya dejó escrito el criterio: cuando hay más de un camino de escritura, la regla va en la base, no en el front.

**Alternativa descartada.** Columna `saldo_actual` en `tarjetas` actualizada por trigger. Descartada: rinde igual en lectura, pero cuando se desvía no hay forma de reconstruir cuándo empezó a mentir, y este proyecto existe justamente porque un número mintió.

### La cifra que evita el pisón de saldos

**Decision.** Se muestran tres cifras por tarjeta, no una: Saldo contable (ingresos menos pagos), Comprometido (suma de los presupuestos de trámites presupuestados y todavía no pagados ni anulados) y Disponible (contable menos comprometido). El presupuesto de una gestora descuenta del disponible en el mismo momento en que lo carga, antes de que exista el pago.

**Por que.** El documento fuente, línea 21, pide exactamente eso: 'que las gestoras puedan agregar el monto aproximado del trámite y que vaya debitando del saldo total'. Y la línea 16 explica el daño: dos personas mirando el mismo saldo real y comprometiéndolo dos veces. Con una sola cifra el pisón sigue pasando aunque el saldo esté unificado, porque el dinero está pero ya tiene dueño.

**Alternativa descartada.** Mostrar sólo el saldo real y confiar en que la gente mire el listado de trámites pendientes. Descartada: eso es exactamente lo que hacen hoy con el Excel y el WhatsApp, y falla.

### El monto cobrado al cliente

**Decision.** Tabla `cobros` aparte, con clave primaria `tramite_id`, no una columna en `tramites`. RLS: sólo `select` si `ve_dinero_cliente()` devuelve true (gerencia o contable).

**Por que.** La exigencia 1 del documento (línea 26) dice 'limitaría la visibilidad de lo cobrado al cliente para las gestoras'. RLS de Postgres filtra filas, no columnas: con una columna en `tramites`, cualquier `select *` de una gestora la trae igual y sólo la esconde el front. Partir la tabla convierte una regla de UI en una regla de base de datos.

**Alternativa descartada.** `grant select (columnas) on tramites` con privilegios de columna. Descartada: PostgREST hace `select *` por defecto y el error de columna revocada rompe la consulta entera, igual que el 42703 documentado en el CLAUDE.md del Tablero §5.

### Presupuesto y costo real en una sola tabla

**Decision.** `tramite_conceptos` con una columna `momento` que vale 'presupuesto' o 'real', y `concepto` como texto libre validado contra un catálogo configurable (hoy: presupuesto, previo, 2do, arancel, prenda, sellado).

**Por que.** El documento pide dos cosas con la misma forma: el monto aproximado (línea 21) y el costo real 'diferenciando arancel-prenda-sellados' (línea 22). Y la imagen 01 muestra que el cuaderno ya usa conceptos que el documento no nombra: PRESUPUESTO, PREVIO y 2do. Columnas fijas obligarían a una migración cada vez que aparezca un concepto nuevo, y ya aparecieron tres que el pedido escrito no menciona.

**Alternativa descartada.** Columnas `arancel`, `prenda`, `sellado` en `tramites`. Descartada por la evidencia de la imagen 01: la lista de conceptos real es más larga que la escrita.

### Cómo entra el listado de Operaciones de Pago

**Decision.** Dos caminos, ninguno automático: pegar el texto copiado de la tabla (Ctrl+C sobre el listado de la imagen 03, parseo por tabulaciones) o subir un .xlsx. `numero_pago` (por ejemplo 0001420388 en la imagen 03) es único, así que re-pegar el mismo listado no duplica nada.

**Por que.** El dueño del proyecto ya decidió que no se scrapea Habitualista. Pegar es el camino más barato que existe, no requiere credenciales de un sistema ajeno, y el `numero_pago` que ese sistema ya emite resuelve la idempotencia sin inventar una clave.

**Alternativa descartada.** Subir sólo archivo. Descartada: agrega un paso (exportar, encontrar el archivo, subirlo) a una tarea que se hace todos los días a las 17:30. Un paso de más por día es cómo muere una rutina.

### Clave de conciliación entre la app y Habitualista

**Decision.** Tres niveles, en orden: (1) dominio detectado en 'Motivo Pago' + importe exacto dentro de ±3 días, automático; (2) dominio exacto con importe distinto, conciliado con la diferencia marcada; (3) apellido normalizado + importe exacto, propuesta que requiere confirmación humana. Sin match, la operación queda como 'no registrada' y nunca se crea un trámite sola.

**Por que.** La columna 'Motivo Pago' de la imagen 03 tiene tres formas distintas en la misma pantalla: un dominio pelado ('AF725SQ'), apellido más dominio ('CASTRO AA301GU') y apellido solo ('dominguez', 'ochoa'). Un solo criterio no cubre eso. Y el cruce se comprueba: 'CASTRO AA301GU' en la imagen 03 es el mismo 'CASTRO JULIO EXEQUIEL AA301EU' del cuaderno de la imagen 01, con una letra distinta en el dominio — que es justamente por qué el nivel 3 no puede ser automático.

**Alternativa descartada.** Match sólo por importe y fecha. Descartada: en la imagen 03 hay cinco operaciones del 13/08 por $1.044.912,25 y $1.044.915,25 con el mismo motivo 'SYS RENTACAR'. El importe solo no distingue nada.

### La columna 'dominio' del Excel no siempre tiene un dominio

**Decision.** Dos campos: `identificador_unidad text not null` (lo que la persona escriba, crudo) y `dominio text` nullable, que se completa sólo si el crudo matchea patrón de patente (`^[A-Z]{3}\d{3}$` o `^[A-Z]{2}\d{3}[A-Z]{2}$`). Sin constraint que ate el patrón al tipo de trámite.

**Por que.** En la imagen 04 la misma columna C mezcla patentes viejas (KXS462, PFQ795), patentes Mercosur (AG142FZ, AD364NX), códigos de dos letras y seis dígitos (VG504373, TG569842, VB505821) y un número pelado (505796, fila 6853). El patrón 'los patentamientos llevan código y las transferencias llevan patente' NO se sostiene: la fila 6850 es una TRANSFERENCIA con VB505468. Poner un constraint sobre una regla que la evidencia contradice rompería la carga el primer día.

**Alternativa descartada.** Un solo campo `dominio` con validación obligatoria. Descartada porque rechazaría de entrada los patentamientos 0km, que son el trámite principal del documento (línea 5).

### Qué pasa con el Excel de 6.800 filas

**Decision.** Se importa completo a `tramites_historicos`, tabla de sólo lectura (revocados insert/update/delete a `authenticated`), separada de `tramites`. El .xlsx original se archiva tal cual en Supabase Storage con su SHA-256 anotado. Deja de escribirse en una fecha anunciada con dos semanas de anticipación. NO convive.

**Por que.** Mezclar 6.800 filas de calidad desconocida con el modelo vivo envenena todos los conteos del reporte de cierre de mes (exigencia 6, línea 31) desde el primer día. Y la convivencia indefinida es el pisón de saldos un nivel más arriba: dos fuentes de verdad es exactamente el problema que el documento denuncia en la línea 16.

**Alternativa descartada.** Un puente bidireccional que mantenga el Excel sincronizado. Descartada: convierte dos verdades en dos verdades con un traductor, y agrega un componente que puede fallar en silencio.

### Qué columnas del Excel no se importan

**Decision.** No se importan: la columna F (sin encabezado), las dos columnas llamadas QUITER (H y K) y la columna INDICE (J). La hoja RESU… tampoco, por ser derivada.

**Por que.** Una columna sin encabezado no tiene significado conocido, y dos columnas con el mismo nombre en la misma planilla (imagen 04, H y K, ambas 'QUITER') significan cosas distintas que no se pueden inferir mirando. Importar un dato cuyo significado nadie puede escribir es peor que no tenerlo: después alguien lo usa creyendo que sabe qué es.

**Alternativa descartada.** Importarlas como texto 'por si acaso'. Descartada: el CLAUDE.md del Estudio §7.2 lo dice para números y vale igual acá — un dato sin fuente deja de servir para decidir.

### El alta del trámite es la autorización

**Decision.** No hay paso de 'aprobar'. Crear el trámite lo deja en estado `autorizado`, con `autorizado_por` y `autorizado_en` NOT NULL. `firmado` es un estado posterior y separado, que sólo puede marcar gerencia.

**Por que.** El documento fuente lo pide textual en la línea 21: 'si el nombre del cliente esta ingresado a la plataforma ya sea sinónimo de autorización del mismo'. Y la línea 20 pide ver 'los tramites autorizados y firmados', que son dos cosas distintas porque en el circuito real (línea 7) la firma de gerencia es un acto físico posterior al control de oferta.

**Alternativa descartada.** Un único estado 'aprobado' que junte las dos cosas. Descartada porque la línea 20 las nombra por separado.

### El débito lo hace la base, no el front

**Decision.** Un trigger sobre `tramites` inserta el movimiento de tipo 'pago' cuando el estado pasa a `pagado`, con la suma de los conceptos de momento 'real'. Si después se corrige el costo real, se genera un movimiento de 'ajuste', nunca se edita el original.

**Por que.** Es el criterio ya escrito en la migración 54 del Tablero (líneas 51-57): 'un check en la base es una sola regla; en el front serían trece lugares donde acordarse'. Acá hay al menos tres caminos que marcan un trámite como pagado (pantalla de escritorio, pantalla móvil de la gestora, resolución desde la bandeja de conciliación).

**Alternativa descartada.** Insertar el movimiento desde el cliente en la misma mutación. Descartada: el día que se agregue un cuarto camino, ese camino va a olvidarse del movimiento y el saldo va a mentir sin error visible.

### La app en el teléfono de la gestora

**Decision.** Dos pantallas móviles y sólo dos: 'Mis trámites' y la ficha con dos botones grandes, 'Cargar presupuesto' y 'Marcar pagado'. El resto del sistema es de escritorio.

**Por que.** La gestora carga esto parada en el registro, que es exactamente el contexto en el que hoy escribe en el cuaderno de la imagen 01 y le saca una foto. Si la alternativa a sacar una foto es abrir una app de escritorio, gana la foto.

**Alternativa descartada.** Una app responsive completa. Descartada: multiplica la superficie de diseño por cinco para una persona que necesita dos acciones.

### Exportar a Excel entra en la etapa 1, no en la etapa de reportes

**Decision.** Botón 'Exportar a Excel' con la librería `xlsx` en toda vista de listado desde el primer día, respetando el rol de quien exporta.

**Por que.** La exigencia 7 (línea 32) la pide, pero la razón para adelantarla es de adopción: la objeción 'yo lo necesito en Excel' es la que hace que alguien vuelva a abrir la planilla vieja 'sólo por esta vez'. Cerrar esa puerta el día 1 cuesta poco; abrirla dos semanas después ya no cierra.

**Alternativa descartada.** Dejarla junto con los reportes de cierre de mes en la etapa 4. Descartada por el riesgo de adopción, que es el riesgo dominante de este proyecto.

### Ninguna métrica agrega por persona

**Decision.** Ninguna vista, reporte ni exportación agrupa por gestora. Los tiempos se miden por trámite y por razón social. Hay un test guardián que lo verifica sobre las consultas del proyecto.

**Por que.** Es regla dura del CLAUDE.md del Tablero §3, y ahí está escrito el motivo: 'si el equipo lo percibe como control, va a trabajar para la foto y todos los datos van a ser mentira'. Acá el riesgo es mayor que en el Tablero, porque las personas que cargan los datos (las gestoras) son las que menos ganan con el sistema.

**Alternativa descartada.** Un panel de 'trámites por gestora' para gerencia. Descartada: el día que exista, el presupuesto se carga tarde y redondeado, y el saldo comprometido deja de servir.

### Un habitualista por razón social, varias tarjetas físicas adentro

**Decision.** `tarjetas` (la cuenta habitualista, una por razón social) y `tarjetahabientes` (las tarjetas de débito físicas, asociadas a gestoras). La conciliación se hace a nivel cuenta, no a nivel tarjetahabiente.

**Por que.** El documento (línea 9) dice las dos cosas: 'cada razón social del grupo tiene su propia Tarjeta Habitualista' y 'cada gestora maneja su propia tarjeta de debito'. La imagen 02 lo confirma: la tarjeta 'Tarjeta Habiente' dice 4 sobre un único 'Saldo disponible' de $2.505.627,92. Y la imagen 03 no tiene ninguna columna que identifique a la gestora: la columna 'Habitualista' dice 'Paris Autos SA' en las quince filas.

**Alternativa descartada.** Un saldo por gestora. Descartada: Habitualista no expone ese dato, así que sería un número que la conciliación jamás podría respaldar.

## Preguntas abiertas

- **Qué significan las dos columnas llamadas QUITER (H y K en la imagen 04) y la columna INDICE (J).**
  - Lectura A: H es el número de asiento o comprobante en Quiter, K es una marca de que el trámite ya se imputó, e INDICE es un número de fila auxiliar de la planilla.
  - Lectura B: H y K son dos fechas o dos estados de dos momentos distintos del circuito en Quiter, e INDICE es un índice de actualización monetaria aplicado al costo.
  - Recomendacion: No importar ninguna de las tres hasta que la clienta escriba qué son. Un dato cuyo significado nadie puede enunciar se usa mal el día que alguien lo encuentra en la base. El importador las deja en el CSV de rechazos para que sigan disponibles sin entrar al modelo.
- **Cuántas razones sociales tienen Tarjeta Habitualista propia. El documento (línea 9) nombra tres: Paris Autos, Paris Cars y Paris Motor. La planilla de la imagen 04 tiene además las hojas DORAL CHEVROLET y PARIS TRAC.**
  - Lectura A: Doral Chevrolet y Paris Trac existen como razón social pero pagan sus trámites con la habitualista de otra, así que tienen trámites pero no tarjeta.
  - Lectura B: También tienen tarjeta propia y el documento quedó corto porque enumeró las tres principales.
  - Recomendacion: Modelar `tarjetas` con cero o más por razón social. Las dos lecturas entran en el mismo modelo sin migración, y la respuesta se convierte en un dato de configuración en vez de una decisión de esquema. Confirmarlo antes de la etapa 3, porque la conciliación necesita saber contra qué cuenta cruza cada operación.
- **Qué es exactamente la columna GESTOR de la imagen 04: quién tiene el trámite, o quién lo pagó.**
  - Lectura A: Es la gestora asignada al trámite. Está casi siempre vacía porque se completa recién cuando alguien se acuerda.
  - Lectura B: Es quién pagó con la tarjeta. En las filas visibles de la imagen 04, CARLA y MARIANA aparecen SIEMPRE junto con una fecha en la columna I y la marca TARJETA en la L (filas 6843, 6846, 6850, 6851, 6857, 6858, 6863, 6864), y nunca sin ellas.
  - Recomendacion: Importarla como `gestora_pago_declarada`, que es lo que la evidencia sostiene, y dejar `gestora_asignada` vacía en el histórico. En el modelo vivo son dos campos distintos desde el principio. Confirmar con la clienta antes de correr la importación definitiva.
- **Por qué el 'Dep $' del cuaderno no coincide con la suma de las líneas. En la imagen 01, GARAY AGUSTINA NAHIR tiene 450.000 + 200.000 + 16.000 = 666.000 y el total escrito a mano dice 670.000. En NIEVAS MERCEDES MARISEL las líneas sí cierran contra 1.100.000.**
  - Lectura A: La gestora redondea para arriba a propósito, para no quedarse corta si el arancel real es mayor que el presupuesto.
  - Lectura B: Falta una línea de concepto que la lapicera no llegó a escribir o que la foto corta.
  - Recomendacion: Guardar dos números separados: la suma calculada por el sistema y el depósito solicitado que escribe la gestora, y mostrar la diferencia en la bandeja. Si la lectura A es la correcta, la diferencia es información útil (cuánto colchón se pide). Si es la B, la diferencia hace visible el error el mismo día.
- **Si gerencia va a cargar los trámites de San Juan en la plataforma o si va a seguir informándolos por otro canal. El documento dice que gerencia gestiona San Juan (línea 16) pero nunca dice que vaya a usar la herramienta.**
  - Lectura A: Gerencia carga San Juan en la app igual que contable carga San Luis. El saldo se unifica solo.
  - Lectura B: Gerencia sigue trabajando aparte y administración contable transcribe lo de San Juan a la app.
  - Recomendacion: Si es la lectura B, la etapa 1 NO resuelve el pisón de saldos: lo mueve de lugar y le agrega una demora de transcripción. Esto hay que resolverlo antes de escribir una línea de código, porque cambia si el proyecto vale la pena. Recomiendo exigir la lectura A como condición de arranque.
- **Si la lista de conceptos de costo real es cerrada en tres (arancel, prenda, sellados, línea 22) o si hay más.**
  - Lectura A: Son exactamente esos tres y el resto entra en 'arancel'.
  - Lectura B: Son los tres más frecuentes y hay otros (verificación policial, formularios, aforos, multas) que hoy se suman a mano dentro de uno de los tres.
  - Recomendacion: Catálogo configurable desde una pantalla, con esos tres precargados. El cuaderno de la imagen 01 ya usa PREVIO y 2do, que no están en la lista de la línea 22, así que la lectura B tiene evidencia a favor y la A no tiene ninguna.
- **De dónde salen los objetivos de patentamientos que pide el informe de saldos proyectados (línea 30).**
  - Lectura A: Gerencia los carga a mano por mes y por razón social, como una meta comercial.
  - Lectura B: Salen del sistema interno (Quiter) o de las unidades ya vendidas y pendientes de patentar, y habría que calcularlos.
  - Recomendacion: Etapa 4 con carga manual (lectura A), que es lo único construible sin integrarse a Quiter. Si la respuesta es la B, la proyección depende de una integración que hoy no está decidida y el requisito R14 se queda sin insumo: eso hay que saberlo antes de prometer el informe.

## Riesgos

- **La gestora sigue mandando la foto del cuaderno y alguien deposita igual. Es el riesgo número uno y no es técnico: mientras exista un camino que funciona sin la app, la app es trabajo extra.**
  - Mitigacion: Regla de negocio firmada por gerencia ANTES de escribir código: no se deposita contra una foto. Si no está en Solicitudes de Fondos, no existe. La app lo hace cumplible mostrando 'Disponible después' en cada solicitud, que es información que la foto no puede dar. Y se mide: durante los primeros 20 días hábiles, la clienta cuenta fotos de cuaderno en el grupo; si el número no llega a cero, el problema es la regla, no el software.
- **El saldo de la app se declara correcto una vez y nadie lo vuelve a comprobar. Es exactamente la forma del error más caro del Tablero: 'NO hay npm. Verificado' (CLAUDE.md del Tablero, líneas 20-36) y 'git push falla' (líneas 255-268), las dos escritas sin el comando al lado.**
  - Mitigacion: El sello de conciliación no es prosa, es un dato: la tercera tarjeta de la pantalla muestra 'conciliado hace N horas' y a las 24 horas el saldo pasa a estado de atención con `--warn`. Nadie tiene que acordarse de revisar: la pantalla se pone fea sola. Y en CLAUDE.md queda la regla heredada — si escribís 'verificado', escribí al lado la consulta SQL que lo comprueba.
- **Publicar sale caro y entonces se publica poco. En el Tablero se llegó a 30 commits sin publicar, incluido un arreglo de seguridad, y el dueño abrió la app, vio la versión vieja y creyó que nada funcionaba (CLAUDE.md del Tablero, §9).**
  - Mitigacion: El primer día del repo se comprueba `git push origin main` y se escribe el resultado con la fecha al lado del comando. Tope duro: nunca más de 5 commits sin publicar, y el número aparece en `docs/ESTADO-DEL-PROYECTO.md`. Si alguna regla obliga a un camino caro, se prueba primero el barato — que es la lección literal de esa sección.
- **El proyecto se declara completo a sí mismo. En el Tablero, la matriz de cobertura del 06/08 se declaró cerrada y una revisión independiente encontró once hallazgos adentro, incluida una contraseña en texto plano.**
  - Mitigacion: Ninguna etapa cierra con un check escrito por quien la construyó. Cada etapa cierra con la clienta recorriendo un guion de ocho pasos escritos de antemano, sobre datos reales, y firmando qué falló. Las migraciones las corre el dueño en Supabase, igual que en el Tablero: es una dependencia real, no una excusa.
- **Se empieza por los reportes lindos. Es el fallo típico del Tablero, saltar del paso 1 al 3: ordenar un poco, entusiasmarse con algo nuevo y dejar las correcciones para después.**
  - Mitigacion: El saldo proyectado y el reporte de cierre están explícitamente en la etapa 4, después de que el listado tenga tres semanas de datos cargados por personas de verdad. Un informe de proyección sobre datos que nadie carga produce números falsos con más confianza.
- **El sistema se percibe como control sobre las gestoras y los datos se vuelven mentira: presupuestos cargados tarde, redondeados y sin desglosar.**
  - Mitigacion: Ninguna vista agrupa por persona, con test guardián. Y el beneficio para la gestora está construido, no prometido: hoy carga en el cuaderno, saca la foto, la manda y después persigue por WhatsApp si depositaron. En la app carga una vez y ve el estado del depósito sin preguntarle a nadie.
- **La importación del Excel se convierte en un pantano de limpieza de datos y se come el proyecto. Son al menos 6.868 filas sólo en la hoja PARIS AUTOS (imagen 04, celda activa E6871) más otras cinco hojas.**
  - Mitigacion: La importación es la etapa 5, la última, y va a una tabla de sólo lectura separada. El criterio de aceptación es aritmético y no cualitativo: filas leídas igual a importadas más rechazadas, con el detalle de cada rechazo. No se limpia nada: lo que no parsea queda con el texto crudo y una observación.
- **Un pago real ocurre y nadie lo carga, así que el saldo de la app queda alto y se vuelve a pisar el saldo — el problema original, adentro del sistema nuevo.**
  - Mitigacion: Es exactamente lo que detecta la fila 'operación no registrada' de la bandeja de conciliación, y por eso la conciliación es etapa 3 y no un extra. Hasta que exista, el sello de 'sin conciliar' a las 24 horas obliga a mirar el sitio de Habitualista todos los días.
- **Dos columnas del Excel se llaman igual (QUITER) y alguien las importa por las dudas; seis meses después un reporte las usa creyendo saber qué son.**
  - Mitigacion: No entran al modelo. Quedan en el CSV de rechazos con su motivo escrito, disponibles y fuera del alcance de cualquier consulta.
- **La app se ve armada de a pedazos, que es el defecto que el Tablero pagó con 571 tamaños de texto a mano en 20 valores distintos.**
  - Mitigacion: Se copian los dos guardianes desde el día uno, no al final: `tipografia.guard.test.ts` y `Panel.guard.test.ts`, más uno propio para emojis y hexadecimales. Y se copia la trampa ya pagada: `--ring` es color y `--ring-sh` es sombra; `box-shadow: var(--ring), var(--shadow)` es CSS inválido y el navegador descarta la declaración entera en silencio.

## Detalle

# Gestoría Grupo Paris — diseño ejecutable

Todo lo que sigue cita el material fuente. Las referencias `[fuente:N]` son líneas de
`docs/fuente/PROYECTO-GESTORIA-texto.md`. Las referencias `[img 0X]` son las capturas.

---

## 1. Los 40 requisitos verificables

### Bloque A — Matar el cuaderno `[fuente:14-15]` `[img 01]`

| # | Requisito | Cómo se comprueba |
|---|---|---|
| **R1** | Toda solicitud de fondos se carga en la app; una foto no es una solicitud. | Pantalla `Solicitudes de fondos` con la solicitud creada en la app. Campo: durante 20 días hábiles la clienta cuenta fotos de cuaderno en el grupo de WhatsApp; el requisito se cumple cuando el conteo llega a cero. |
| **R2** | Una solicitud sin al menos una línea de concepto no se puede guardar. | `solicitudes.test.ts`: `guardarPresupuesto(tramite, [])` rechaza con `FallaDeUsuario`. SQL: `select count(*) from tramites where estado='presupuestado' and not exists (select 1 from tramite_conceptos c where c.tramite_id=tramites.id and momento='presupuesto')` → 0. |
| **R3** | El sistema suma las líneas y muestra la suma junto al depósito que pide la gestora, con la diferencia. | `presupuesto.test.ts` con los números de `[img 01]`: GARAY 450.000 + 200.000 + 16.000 = 666.000 contra `deposito_solicitado` 670.000 → la vista devuelve `diferencia = 4.000`. Mirar la bandeja. |
| **R4** | Cualquier solicitud se encuentra después por cliente, dominio, razón social o mes. | Buscar `GARAY` en el listado trae el trámite. SQL: `select * from tramites where cliente ilike '%garay%'`. |
| **R5** | Los conceptos son un catálogo configurable, no columnas fijas. | Agregar el concepto `verificación policial` desde la pantalla de catálogo y usarlo, **sin correr ninguna migración**. `select distinct concepto from tramite_conceptos`. |

### Bloque B — Un solo saldo, San Luis y San Juan `[fuente:16]`

| # | Requisito | Cómo se comprueba |
|---|---|---|
| **R6** | No existe ninguna columna de saldo persistido. | `select table_name, column_name from information_schema.columns where column_name ilike '%saldo%' and table_schema='public'` → sólo filas de la vista `saldos`, ninguna tabla base. |
| **R7** | Tres cifras por tarjeta: contable, comprometido, disponible. | `saldos.test.ts` sobre la función pura. Pantalla `Tarjeta`, tres `<Panel>` arriba, calcando `[img 02]`. |
| **R8** | Un trámite presupuestado y no pagado baja el disponible aunque nadie haya pagado nada. | `saldos.test.ts`, caso `pisón`: San Juan presupuesta 1.000.000; el `disponible` que devuelve la consulta de San Luis baja 1.000.000 en la misma transacción. |
| **R9** | Los movimientos no se editan ni se borran; se corrigen con un movimiento de ajuste. | `select has_table_privilege('authenticated','public.movimientos','UPDATE')` → `false`. Desde la app, un `update` devuelve 42501. |
| **R10** | San Luis y San Juan ven el mismo número sin recargar. | Dos navegadores con dos usuarios distintos abiertos en `Tarjeta`; cargar un presupuesto en uno y ver bajar el disponible en el otro. TanStack Query invalida `['saldos', tarjetaId]`. |

### Bloque C — Las 7 exigencias de "A TENER EN CUENTA" `[fuente:26-32]`

| # | Exigencia (línea) | Requisito | Cómo se comprueba |
|---|---|---|---|
| **R11** | 26 — limitar visibilidad de lo cobrado | Una gestora no ve el cobro ni el margen en pantalla, ni en la exportación, ni en la respuesta de la API. | Con un JWT de rol `gestora`: `select * from cobros` → **0 filas**. `exportar.test.ts`: con `puedeVerCobros=false`, ninguna clave del objeto exportado contiene `cobrado` ni `margen`. Y mirar la pantalla logueado como gestora real. |
| **R12** | 27 — sólo gerencia/contable modifican saldos | Sólo gerencia y contable pueden insertar `ingreso` y `ajuste`. | Insert de una gestora en `movimientos` con `tipo='ingreso'` → 42501. `rls.test.sql` con los tres roles. |
| **R13** | 28 — agrupar por tipo de trámite | Tres tipos exactos: `patentamiento_0km`, `transferencia_usado`, `transferencia_a_concesionario`. | `check` en la tabla. Filtro en el listado y un subtotal por tipo en el reporte. `select tipo, count(*) from tramites group by tipo` devuelve como mucho tres filas. |
| **R14** | 29 — dividir por razones sociales | Todo se filtra por razón social, y ninguna vista mezcla dos sin decirlo en el título. | `select nombre from razones_sociales` incluye las cinco hojas de `[img 04]`. Recorrer las pantallas: cada una muestra la razón social activa en el encabezado. |
| **R15** | 30 — informe de saldos proyectados | Proyectado = disponible − comprometido − (objetivo de patentamientos del mes × costo promedio). | `proyeccion.test.ts` con tres casos de números escritos a mano. Pantalla `Proyección`. |
| **R16** | 31 — reporte a cierre de mes | Patentamientos y transferencias por razón social, con costo total y margen. | El primer mes se compara contra el conteo hecho a mano sobre el Excel; tienen que dar igual. `cierre.test.ts` sobre la función de agregación. |
| **R17** | 32 — exportar a Excel | Botón `Exportar a Excel` en toda vista de listado, con la librería `xlsx`. | Generar el archivo, **abrirlo y mirarlo**. `exportar.test.ts` para las columnas y R11 para los permisos. |

### Bloque D — Las 6 ideas `[fuente:20-24]`

| # | Idea (línea) | Requisito | Cómo se comprueba |
|---|---|---|---|
| **R18** | 20 — centralizar en tiempo real | Una sola pantalla muestra a la vez trámites autorizados y firmados y el saldo de la tarjeta, sin cambiar de vista. | Mirar la pantalla `Tarjeta`. |
| **R19** | 21 — el nombre cargado es la autorización | No hay paso de aprobar. El alta deja el trámite en `autorizado` con `autorizado_por` y `autorizado_en` NOT NULL. | `select count(*) from tramites where autorizado_por is null` → 0. `estados.test.ts`: no existe transición hacia `autorizado`. |
| **R20** | 21 — el monto aproximado debita del saldo | El presupuesto compromete el saldo en el mismo momento en que se carga. | Es R8. |
| **R21** | 22 — costo real diferenciando arancel/prenda/sellado | Los conceptos reales se cargan aparte de los presupuestados y la ficha muestra la diferencia. | Ficha de trámite: dos columnas, presupuesto y real, y el desvío. `select momento, count(*) from tramite_conceptos group by momento` devuelve las dos. |
| **R22** | 23 — el monto cobrado al cliente en otro espacio | Tabla `cobros` separada, alimenta el informe de costos con el margen por trámite. | Pantalla `Cobros` (invisible para gestoras, R11) y la columna margen en el reporte. |
| **R23** | 24 — análisis pro-contras para gerencia | `docs/PRO-CONTRAS.md` con la consulta SQL escrita al lado de cada número. | Correr las consultas del documento y comparar. Ningún número sin consulta al lado. |

### Bloque E — Habitualista y conciliación

| # | Requisito | Cómo se comprueba |
|---|---|---|
| **R24** | Los ingresos de dinero se cargan a mano. No hay scraping de Habitualista. | `grep -ri "habitualista" src/ \| grep -i "fetch\|axios\|http"` → sin resultados. |
| **R25** | Se puede pegar el listado de `Operaciones de Pago` y el sistema lo parsea. | `pegar-operaciones.test.ts` con las quince filas de `[img 03]` transcritas literalmente, incluidos `$ 1.044.912,25` y `19009 - Av Ejercito de los Andes 575`. |
| **R26** | Pegar dos veces el mismo listado no duplica nada. | Correr la importación dos veces y comparar `select count(*) from operaciones_pago`. La clave es `numero_pago` único (`0001420388` en `[img 03]`). |
| **R27** | La conciliación clasifica en cuatro: conciliada, no registrada, sin respaldo, dudosa. | `conciliacion.test.ts` con un caso armado de cada una. |
| **R28** | La conciliación **nunca** crea un trámite sola. | `conciliacion.test.ts`: la función es pura y su tipo de retorno no tiene forma de crear nada. `select count(*) from tramites where creado_por is null` → 0. |
| **R29** | La pantalla dice cuándo fue la última conciliación y marca el saldo con `--warn` pasadas 24 h. | Mirar la pantalla al día siguiente sin conciliar. `sello-conciliacion.test.ts` con reloj falso. |

### Bloque F — Reglas de la casa

| # | Requisito | Cómo se comprueba |
|---|---|---|
| **R30** | Tamaños de texto sólo de la escala `text-2xs`…`text-4xl`. | `src/lib/tipografia.guard.test.ts`, copiado del Tablero. |
| **R31** | Toda tarjeta es `<Panel>`, y `box-shadow` usa `var(--ring-sh)`, no `var(--ring)`. | `src/components/Panel.guard.test.ts`, con los dos chequeos del Tablero. El segundo existe porque `box-shadow: var(--ring), var(--shadow)` es CSS inválido y el navegador descarta la declaración entera en silencio. |
| **R32** | Cero emojis, íconos sólo de `lucide-react`, cero hexadecimales a mano. | `src/lib/casa.guard.test.ts`, con el filtro por categoría Unicode **más** el caso `ℹ` (U+2139), que es categoría `Ll` y se escapa de cualquier filtro por categoría de símbolo. |
| **R33** | Ningún error muestra el mensaje crudo de la base. | `fallas.test.ts`. Y grep: cero `e.message` renderizado fuera de `detalleTecnico`. |
| **R34** | Todo monto lleva `.tnum`. | `casa.guard.test.ts`: toda clase que contenga `$` formateado en un `<td>` lleva `tnum`. Y mirar una columna de importes. |
| **R35** | Ninguna vista, reporte ni exportación agrupa por persona. | `casa.guard.test.ts`: cero `group by` sobre `gestora_id` en `src/`. Recorrer los reportes. |
| **R36** | Las migraciones son idempotentes y traen adentro el bloque "cómo comprobar que quedó bien". | Correr cada migración dos veces seguidas en Supabase: la segunda no falla ni cambia nada. |
| **R37** | Español rioplatense con voseo, sin jerga técnica en la UI. | Revisión a ojo de todos los textos antes de cada publicación. |

### Bloque G — Migración y adopción

| # | Requisito | Cómo se comprueba |
|---|---|---|
| **R38** | Filas leídas = filas importadas + filas rechazadas, por hoja, y el número se publica. | `node scripts/verificar-importacion.mjs` imprime la tabla y sale con código 1 si no cierra. |
| **R39** | Ninguna fila del histórico entra a `tramites`. | `select count(*) from tramites where creado_en < '<fecha de arranque>'` → 0. `has_table_privilege('authenticated','tramites_historicos','INSERT')` → false. |
| **R40** | Cargar un trámite completo lleva menos de 20 segundos y no más de 6 campos obligatorios. | Cronómetro con la clienta, tres veces, sobre datos reales. Si da más, el problema es el formulario, no la persona. |

---

## 2. Modelo de datos

### 2.1 Fundación

```sql
create table if not exists public.razones_sociales (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null unique,        -- 'PARIS AUTOS', 'DORAL CHEVROLET', ... (pestañas de [img 04])
  activa     boolean not null default true
);

create table if not exists public.perfiles (
  id       uuid primary key references auth.users(id) on delete cascade,
  nombre   text not null,
  rol      text not null check (rol in ('gerencia','contable','gestora')),
  sucursal text not null check (sucursal in ('San Luis','San Juan')),
  activo   boolean not null default true
);

-- La cuenta corriente. UNA por razón social [fuente:9].
create table if not exists public.tarjetas (
  id              uuid primary key default gen_random_uuid(),
  razon_social_id uuid not null references public.razones_sociales(id),
  nombre          text not null,          -- 'Paris Autos SA', tal cual la columna "Habitualista" de [img 03]
  activa          boolean not null default true,
  unique (razon_social_id, nombre)
);

-- Las tarjetas de débito físicas. [img 02] muestra "Tarjeta Habiente: 4" sobre UN saldo.
create table if not exists public.tarjetahabientes (
  id         uuid primary key default gen_random_uuid(),
  tarjeta_id uuid not null references public.tarjetas(id),
  perfil_id  uuid references public.perfiles(id),
  etiqueta   text not null
);
```

### 2.2 El trámite

```sql
create table if not exists public.tramites (
  id                   uuid primary key default gen_random_uuid(),
  -- Número corto para poder decirlo por teléfono. El uuid no se dicta.
  numero               bigint generated always as identity,
  razon_social_id      uuid not null references public.razones_sociales(id),
  tarjeta_id           uuid not null references public.tarjetas(id),
  sucursal             text not null check (sucursal in ('San Luis','San Juan')),
  tipo                 text not null check (tipo in
                         ('patentamiento_0km','transferencia_usado','transferencia_a_concesionario')),

  -- Los cuatro datos del asunto del mail [fuente:6]
  cliente              text not null,
  cuenta_personal      text,
  modelo               text,
  referencia_oferta    text,

  -- POR QUÉ DOS CAMPOS Y NO UNO: la columna "dominio" de [img 04] mezcla patentes viejas
  -- (KXS462), Mercosur (AG142FZ), códigos de 2 letras + 6 dígitos (VG504373) y números
  -- pelados (505796, fila 6853). Se guarda lo que la persona escribe, y el dominio se
  -- deriva SÓLO si matchea patrón. Un campo único con validación rechazaría los 0km.
  identificador_unidad text not null,
  dominio              text,

  gestora_id           uuid references public.perfiles(id),
  seccional            text,               -- '19005 - Marconi 29' de [img 03]

  estado               text not null default 'autorizado' check (estado in
                         ('autorizado','firmado','entregado','presupuestado',
                          'pagado','retirado','devuelto','anulado')),

  -- El alta ES la autorización [fuente:21]. Por eso van NOT NULL y no hay estado previo.
  autorizado_por       uuid not null references public.perfiles(id),
  autorizado_en        timestamptz not null default now(),
  firmado_en           timestamptz,
  entregado_en         timestamptz,
  presupuestado_en     timestamptz,
  pagado_en            timestamptz,
  retirado_en          timestamptz,
  devuelto_en          timestamptz,
  anulado_en           timestamptz,
  motivo_anulacion     text,

  -- Lo que la gestora PIDE que se deposite. Separado de la suma de conceptos porque en
  -- [img 01] no siempre coinciden: GARAY suma 666.000 y el "Dep $" dice 670.000.
  deposito_solicitado  numeric(14,2),
  notas                text,

  constraint anulado_con_motivo check ((anulado_en is null) = (motivo_anulacion is null))
);

create index if not exists tramites_estado_idx on public.tramites (estado)
  where estado not in ('devuelto','anulado');
create index if not exists tramites_dominio_idx on public.tramites (dominio) where dominio is not null;
```

### 2.3 Conceptos y cobros

```sql
-- Una sola tabla para presupuesto y costo real: misma forma, distinto momento.
-- [fuente:21] pide el monto aproximado, [fuente:22] el real desglosado.
create table if not exists public.tramite_conceptos (
  id          uuid primary key default gen_random_uuid(),
  tramite_id  uuid not null references public.tramites(id) on delete cascade,
  momento     text not null check (momento in ('presupuesto','real')),
  concepto    text not null,               -- 'presupuesto','previo','2do','arancel','prenda','sellado'
  monto       numeric(14,2) not null check (monto >= 0),
  cargado_por uuid not null references public.perfiles(id),
  cargado_en  timestamptz not null default now()
);
create index if not exists conceptos_tramite_idx on public.tramite_conceptos (tramite_id, momento);

-- TABLA APARTE, no columna. RLS filtra FILAS, no columnas: con una columna en `tramites`
-- cualquier `select *` de una gestora la traería y sólo la escondería el front. [fuente:26]
create table if not exists public.cobros (
  tramite_id  uuid primary key references public.tramites(id) on delete cascade,
  monto       numeric(14,2) not null check (monto >= 0),
  cargado_por uuid not null references public.perfiles(id),
  cargado_en  timestamptz not null default now(),
  nota        text
);
```

### 2.4 El libro de movimientos y las tres cifras

```sql
create table if not exists public.movimientos (
  id            uuid primary key default gen_random_uuid(),
  tarjeta_id    uuid not null references public.tarjetas(id),
  tipo          text not null check (tipo in ('ingreso','pago','ajuste')),
  monto         numeric(14,2) not null check (monto <> 0),  -- ingreso +, pago −
  fecha         date not null default current_date,
  tramite_id    uuid references public.tramites(id),
  descripcion   text not null,
  cargado_por   uuid not null references public.perfiles(id),
  cargado_en    timestamptz not null default now(),
  operacion_pago_id uuid,

  constraint mov_signo check (
    (tipo = 'ingreso' and monto > 0) or (tipo = 'pago' and monto < 0) or tipo = 'ajuste'),
  constraint mov_pago_con_tramite check (tipo <> 'pago' or tramite_id is not null)
);

-- El libro es INMUTABLE. Una corrección es una fila nueva de tipo 'ajuste'.
-- Sin esto, el día que el saldo mienta no hay forma de saber cuándo empezó.
revoke update, delete on public.movimientos from authenticated;

create index if not exists mov_tarjeta_fecha_idx on public.movimientos (tarjeta_id, fecha desc);
```

```sql
-- LAS TRES CIFRAS. Esta vista es el corazón del proyecto: la tercera columna es lo que
-- evita el pisón de saldos entre San Luis y San Juan [fuente:16].
create or replace view public.saldos as
with contable as (
  select tarjeta_id, coalesce(sum(monto), 0) as monto
    from public.movimientos group by tarjeta_id
),
comprometido as (
  select t.tarjeta_id, coalesce(sum(c.monto), 0) as monto
    from public.tramites t
    join public.tramite_conceptos c
      on c.tramite_id = t.id and c.momento = 'presupuesto'
   where t.estado = 'presupuestado'          -- presupuestado y todavía no pagado
   group by t.tarjeta_id
)
select
  ta.id                              as tarjeta_id,
  ta.razon_social_id,
  coalesce(co.monto, 0)              as saldo_contable,
  coalesce(cm.monto, 0)              as comprometido,
  coalesce(co.monto, 0) - coalesce(cm.monto, 0) as disponible
from public.tarjetas ta
left join contable    co on co.tarjeta_id = ta.id
left join comprometido cm on cm.tarjeta_id = ta.id;
```

```sql
-- El débito lo hace la base, no el front.
-- MISMO CRITERIO QUE LA MIGRACIÓN 54 DEL TABLERO: hay tres caminos que marcan un trámite
-- como pagado (escritorio, móvil de la gestora, bandeja de conciliación). Un trigger es
-- una regla; en el front serían tres lugares donde acordarse.
create or replace function public.tramite_debita_al_pagar() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_total numeric(14,2);
begin
  if new.estado = 'pagado' and coalesce(old.estado,'') <> 'pagado' then
    select coalesce(sum(monto), 0) into v_total
      from public.tramite_conceptos
     where tramite_id = new.id and momento = 'real';

    if v_total <= 0 then
      -- El texto lo lee una persona, por eso lleva la marca que el front sabe desenvolver.
      raise exception 'regla_estado:Para marcar pagado hace falta cargar el costo real.';
    end if;

    insert into public.movimientos (tarjeta_id, tipo, monto, fecha, tramite_id,
                                    descripcion, cargado_por)
    values (new.tarjeta_id, 'pago', -v_total, current_date, new.id,
            'Pago de trámite #' || new.numero || ' — ' || new.cliente, auth.uid());
  end if;
  return new;
end $$;
```

### 2.5 Conciliación

```sql
create table if not exists public.operaciones_pago (
  id                uuid primary key default gen_random_uuid(),
  -- Clave natural que ya emite Habitualista ('0001420388' en [img 03]).
  -- Es lo que hace que re-pegar el mismo listado no duplique nada.
  numero_pago       text not null unique,
  habitualista      text not null,        -- 'Paris Autos SA'
  tarjeta_id        uuid references public.tarjetas(id),
  canal             text,                 -- 'MOBILE'
  fecha             timestamptz not null,
  importe           numeric(14,2) not null,
  seccional         text,                 -- '19009 - Av Ejercito de los Andes 575'
  motivo            text,                 -- 'AF725SQ' | 'CASTRO AA301GU' | 'dominguez'
  observacion       text,
  dominio_detectado text,
  importada_en      timestamptz not null default now(),
  importada_por     uuid not null references public.perfiles(id)
);

create table if not exists public.conciliaciones (
  operacion_pago_id uuid primary key references public.operaciones_pago(id) on delete cascade,
  movimiento_id     uuid references public.movimientos(id),
  estado            text not null check (estado in
                      ('conciliada','no_registrada','sin_respaldo','descartada')),
  nivel             text check (nivel in ('dominio_importe','dominio','apellido_importe','manual')),
  diferencia        numeric(14,2),
  resuelta_por      uuid references public.perfiles(id),
  resuelta_en       timestamptz,
  nota              text
);
```

### 2.6 RLS

```sql
-- NUNCA una subconsulta a `perfiles` dentro de una policy de `perfiles`: da 42P17.
-- Helpers SECURITY DEFINER, igual que `es_jefe()` en el Tablero.
create or replace function public.mi_rol() returns text
language sql stable security definer set search_path = public as $$
  select rol from public.perfiles where id = auth.uid() and activo
$$;

create or replace function public.mueve_dinero() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.mi_rol() in ('gerencia','contable'), false)
$$;

-- [fuente:26] — el cobro al cliente no lo ve una gestora. Ni una fila.
create or replace function public.ve_dinero_cliente() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.mi_rol() in ('gerencia','contable'), false)
$$;

alter table public.cobros enable row level security;
drop policy if exists cobros_select on public.cobros;
create policy cobros_select on public.cobros for select
  using (public.ve_dinero_cliente());
drop policy if exists cobros_write on public.cobros;
create policy cobros_write on public.cobros for all
  using (public.ve_dinero_cliente()) with check (public.ve_dinero_cliente());

-- [fuente:27] — sólo gerencia y contable modifican saldos disponibles.
alter table public.movimientos enable row level security;
drop policy if exists mov_select on public.movimientos;
create policy mov_select on public.movimientos for select using (auth.uid() is not null);
drop policy if exists mov_insert_dinero on public.movimientos;
create policy mov_insert_dinero on public.movimientos for insert
  with check (
    (tipo in ('ingreso','ajuste') and public.mueve_dinero())
    -- 'pago' entra sólo por el trigger, que es SECURITY DEFINER
    or (tipo = 'pago' and false)
  );
```

```sql
-- CÓMO COMPROBAR QUE QUEDÓ BIEN
--
-- 1) Una gestora no ve cobros:
--      set local role authenticated;
--      set local request.jwt.claims = '{"sub":"<uuid de una gestora>"}';
--      select count(*) from public.cobros;                 -- tiene que dar 0
--
-- 2) Una gestora no puede ingresar dinero (esto tiene que FALLAR con 42501):
--      insert into public.movimientos (tarjeta_id, tipo, monto, descripcion, cargado_por)
--      values ('<TARJETA>', 'ingreso', 100, 'prueba', '<uuid de la gestora>');
--
-- 3) El libro es inmutable (esto tiene que FALLAR):
--      update public.movimientos set monto = 1 where id = '<MOV>';
--
-- 4) El comprometido baja el disponible sin que haya pago:
--      select saldo_contable, comprometido, disponible from public.saldos
--       where tarjeta_id = '<TARJETA>';
```

---

## 3. Tipos y firmas de TypeScript

```ts
// src/lib/estados.ts
export const ESTADOS = ["autorizado","firmado","entregado","presupuestado",
                        "pagado","retirado","devuelto","anulado"] as const;
export type Estado = (typeof ESTADOS)[number];
export type Rol = "gerencia" | "contable" | "gestora";

export interface Transicion { desde: Estado; hacia: Estado; roles: readonly Rol[]; }

export function transicionesPosibles(desde: Estado, rol: Rol): Estado[];
export function puedeTransicionar(
  desde: Estado, hacia: Estado, rol: Rol,
): { ok: true } | { ok: false; motivo: string };
```

**Tabla de estados. Quién puede mover cada flecha:**

| Desde | Hacia | Quién | Qué pasa además |
|---|---|---|---|
| — | `autorizado` | contable, gerencia | El alta es la autorización `[fuente:21]` |
| `autorizado` | `firmado` | **gerencia sola** | Registra que la firma física ocurrió `[fuente:7]` |
| `firmado` | `entregado` | contable, gerencia | Recién acá la gestora lo ve en el teléfono |
| `entregado` | `presupuestado` | gestora, contable, gerencia | **Compromete el saldo.** Aparece en Solicitudes de fondos |
| `presupuestado` | `pagado` | gestora, contable, gerencia | El trigger inserta el movimiento de débito |
| `pagado` | `retirado` | gestora, contable, gerencia | — |
| `retirado` | `devuelto` | contable, gerencia | Cierra el trámite `[fuente:11]` |
| cualquiera salvo `devuelto` | `anulado` | contable, gerencia | Libera el comprometido. Exige motivo |

No hay flechas hacia atrás. Una corrección se hace anulando y volviendo a cargar, para que
el rastro quede.

```ts
// src/lib/saldos.ts  — PURA, no toca red ni Date.now()
export interface MovimientoSaldo { tarjetaId: string; tipo: "ingreso"|"pago"|"ajuste"; monto: number }
export interface Compromiso      { tarjetaId: string; monto: number }
export interface Saldos          { contable: number; comprometido: number; disponible: number }

export function saldosDeTarjeta(
  movimientos: readonly MovimientoSaldo[],
  compromisos: readonly Compromiso[],
): Saldos;

/** Cuánto queda disponible SI se aprueba esta solicitud. Es el número de la bandeja. */
export function disponibleDespuesDe(saldos: Saldos, monto: number): number;
```

```ts
// src/lib/dominio.ts
const PATENTE_VIEJA    = /^[A-Z]{3}\d{3}$/;      // KXS462, PFQ795   [img 04]
const PATENTE_MERCOSUR = /^[A-Z]{2}\d{3}[A-Z]{2}$/; // AG142FZ, AD364NX [img 04]

/**
 * `crudo` siempre se conserva. `dominio` sale null cuando el texto es un código interno
 * (VG504373, TG569842) o un número pelado (505796, fila 6853 de [img 04]).
 */
export function normalizarIdentificador(bruto: string): { crudo: string; dominio: string | null };

/** Saca el dominio de un "Motivo Pago" de [img 03]: 'CASTRO AA301GU' -> 'AA301GU'. */
export function dominioDeMotivo(motivo: string): string | null;
```

```ts
// src/lib/conciliacion.ts
export type NivelMatch = "dominio_importe" | "dominio" | "apellido_importe" | "manual";

export interface ResultadoConciliacion {
  conciliadas:   Array<{ operacionId: string; movimientoId: string; nivel: NivelMatch; diferencia: number }>;
  /** Se pagó algo que nadie cargó. ESTA es la fila que justifica el sistema entero. */
  noRegistradas: Array<{ operacionId: string; importe: number; motivo: string }>;
  /** Está marcado pagado en la app y no aparece en Habitualista. */
  sinRespaldo:   Array<{ movimientoId: string; importe: number; tramiteNumero: number }>;
  /** Match por apellido: propone, no decide. */
  dudosas:       Array<{ operacionId: string; candidatos: string[] }>;
}

export function conciliar(
  operaciones: readonly OperacionPago[],
  pagos: readonly MovimientoPago[],
  toleranciaDias = 3,
): ResultadoConciliacion;
```

Orden de los niveles, y el orden importa igual que en `clasificarFalla`:

1. `dominio_importe` — dominio detectado igual **y** importe exacto dentro de ±3 días. Automático.
2. `dominio` — dominio igual, importe distinto. Conciliada, con la diferencia escrita.
3. `apellido_importe` — apellido normalizado más importe exacto. **Propuesta, requiere un clic humano.**
   Nunca automático: en `[img 03]` figura `CASTRO AA301GU` y en el cuaderno `[img 01]`
   `CASTRO JULIO EXEQUIEL AA301EU`. Una letra de diferencia en el dominio, mismo cliente.
4. Sin match — `noRegistradas`.

```ts
// src/lib/pegar-operaciones.ts
export function parsearOperacionesPegadas(texto: string): {
  filas: OperacionPago[];
  rechazadas: Array<{ linea: number; texto: string; motivo: string }>;
};
```
Separa por tabulaciones, tolera el encabezado, parsea `$ 1.044.912,25` (punto de miles,
coma decimal) y `18/08/2026 12:19 p. m.` (con el espacio adentro de `p. m.`, tal cual
`[img 03]`).

```ts
// src/lib/exportar.ts
export function filasParaExcel(
  tramites: readonly TramiteVista[],
  puedeVerCobros: boolean,
): Record<string, string | number>[];
```

```ts
// src/lib/proyeccion.ts  — [fuente:30]
export function saldoProyectado(args: {
  disponible: number; comprometido: number;
  objetivoPatentamientos: number; costoPromedio: number;
}): { proyectado: number; faltante: number };
```

---

## 4. Pantallas

### 4.1 `Tarjeta` — calca `[img 02]` arriba y `[img 03]` abajo

```
GESTORÍA                                 [Paris Autos ▾]   [Agosto 2026 ▾]   Carla ▾

┌ Saldo contable ─────┐  ┌ Comprometido ───────┐  ┌ Disponible ─────────┐
│ $ 2.505.627,92      │  │ $ 1.870.000,00      │  │ $ 635.627,92        │
│ 14 movimientos      │  │ 6 trámites          │  │ conciliado 17:34    │
└─────────────────────┘  └─────────────────────┘  └─────────────────────┘

Movimientos
Fecha         Detalle                                Trámite    Importe        Quién
18/08 12:19   Pago · CASTRO JULIO EXEQUIEL           #1284      -400.000,00    Carla
18/08 09:00   Ingreso · transferencia BNA            —        +2.000.000,00    Gerencia
14/08 14:31   Pago · PARNISARI KJL164                #1279      -128.595,00    Mariana
```

Tres `<Panel>` arriba, exactamente las tres tarjetas de `[img 02]`, porque
`[fuente:34]` pide "un saldo inicial y listado de operaciones". La tercera lleva el
sello de conciliación; a las 24 h sin conciliar el número pasa a `--warn`.
Todos los importes con `.tnum`.

### 4.2 `Solicitudes de fondos` — reemplaza el cuaderno

```
Solicitudes de fondos                                       Paris Autos · 6 pendientes

#1284  GARAY AGUSTINA NAHIR · Peugeot 208 (108511) · VG505270
       Presupuesto  450.000,00
       Previo       200.000,00
       2do           16.000,00
       ──────────────────────
       Suma         666.000,00     Pide depositar  670.000,00   (+4.000,00)
       Cargado por Carla · hoy 08:42

       Disponible ahora 635.627,92  →  después  −34.372,08
       [ Depositar ]   [ No alcanza, dejar en espera ]   [ Rechazar ]
```

`Disponible después` en negativo y en `--danger`: eso es lo que hoy nadie ve antes de
depositar, y por eso se pisan. Cuando gerencia aprieta `Depositar` se abre el alta del
movimiento de ingreso; el estado de la solicitud cambia recién cuando el ingreso se guarda.

### 4.3 `Mis trámites` — teléfono de la gestora, dos pantallas y nada más

```
Mis trámites                          Carla · Paris Autos

#1284  GARAY AGUSTINA NAHIR            Entregado
       Peugeot 208 · VG505270          [ Cargar presupuesto ]

#1279  PARNISARI KJL164                Presupuestado
       Transferencia usado             [ Marcar pagado ]
```

---

## 5. Las etapas, y por qué cada una sirve sola

### Etapa 1 — El listado y el saldo `R1–R14, R17–R20, R30–R37`

Entra: login y roles; razones sociales y tarjetas; alta de trámite con los cuatro datos del
asunto del mail; máquina de estados completa; presupuesto por conceptos; bandeja de
Solicitudes de fondos; libro de movimientos con ingreso manual; las tres cifras; el listado
tipo `[img 03]`; filtros por razón social, tipo, estado y mes; **exportar a Excel**; RLS de
saldos y de cobros; las dos pantallas de teléfono.

**Sirve sola porque:** el día que se enciende, la hoja del cuaderno `[img 01]` deja de
existir y el disponible es un solo número para San Luis y San Juan. Ésas son literalmente
las dos dificultades declaradas `[fuente:14-16]`. Aunque no se construya nada más, el
proyecto ya cumplió su objetivo `[fuente:18]`.

La exportación a Excel está acá y no en la etapa 4 a propósito: es lo que hace innecesario
volver a abrir la planilla vieja "sólo por esta vez".

### Etapa 2 — Costo real y lo cobrado `R21, R22, R11`

Entra: conceptos de momento `real`; desvío presupuesto contra real en la ficha; tabla
`cobros` con su RLS; margen por trámite para gerencia y contable.

**Sirve sola porque:** sin conciliación ni reportes, ya contesta "cuánto nos costó de
verdad y cuánto le cobramos", que hoy no se contesta con la planilla porque las columnas
`$ TRANSF` y `TOTAL` de `[img 04]` están vacías en todas las filas visibles.

### Etapa 3 — Conciliación con Habitualista `R24–R29`

Entra: pegar o subir el listado de Operaciones de Pago; los cuatro niveles de match; la
bandeja de diferencias; el sello de última conciliación.

**Sirve sola porque:** convierte un saldo simulado en un saldo con respaldo. Sin ella el
sistema es una hipótesis prolija; con ella, cada peso de diferencia tiene una fila con
nombre. Es también el único mecanismo que detecta el pisón residual: alguien pagó algo que
nunca se cargó.

### Etapa 4 — Cierre de mes y proyección `R15, R16, R23`

Entra: reporte de cierre por razón social y tipo; objetivos de patentamientos por mes;
saldo proyectado; `docs/PRO-CONTRAS.md` con las consultas al lado de cada número;
exportación completa.

**Sirve sola porque:** es lo que se le muestra a gerencia, y lo pide el documento en dos
lugares `[fuente:30-31]` más el pedido explícito de justificar la herramienta `[fuente:24]`.
Va cuarta porque un informe de proyección sobre datos que nadie carga produce números falsos
con más confianza.

### Etapa 5 — El histórico `R38, R39`

Entra: importación del Excel completo a `tramites_historicos`; buscador unificado que
consulta lo vivo y lo histórico con la misma caja.

**Sirve sola porque:** es consulta pura. Y va última a propósito: si va primera, el equipo
se pasa dos semanas limpiando datos de 2024 en vez de dejar de usar el cuaderno. Mientras
tanto el .xlsx original queda archivado y se puede abrir.

---

## 6. Adopción: qué hace que abandonen WhatsApp, el cuaderno y el Excel

**Lo que hoy hace la gestora:** escribe en el cuaderno, le saca una foto, la manda al grupo,
y después persigue por WhatsApp preguntando si depositaron. **La segunda mitad es la que le
duele, no la primera.** El sistema gana ahí: carga una vez y ve el estado del depósito sin
preguntarle a nadie. Si el argumento de venta es "ordenamos la información", pierde.

**Las siete condiciones, en orden de importancia:**

1. **Regla de gerencia firmada antes de escribir código: no se deposita contra una foto.**
   Sin esto ninguna herramienta gana, porque el camino viejo sigue funcionando y es más
   corto. Es una decisión de negocio, no de software, y es el primer entregable del proyecto.
2. **La app funciona en el teléfono, parada, en el registro.** Dos pantallas, dos botones.
   Si la alternativa a sacar una foto es abrir una app de escritorio, gana la foto.
3. **Cargar un trámite en menos de 20 segundos** (R40). Si tarda más que escribir a mano,
   el cuaderno vuelve.
4. **Exportar a Excel desde el día 1.** Cierra la objeción "yo lo necesito en Excel" antes
   de que se convierta en una excepción permanente.
5. **Gerencia deja de depositar a ciegas.** El número `Disponible después` es un beneficio
   inmediato para quien firma el gasto, y es quien tiene el poder de imponer la regla 1.
6. **Ninguna métrica por persona** (R35). El día que exista un ranking de gestoras, los
   presupuestos se cargan tarde y redondeados y el comprometido deja de servir.
7. **Paralelo de dos semanas con fecha de fin anunciada.** Durante el paralelo la app es la
   fuente y el Excel se llena copiando **de** la app, nunca al revés, y todos los días se
   comparan los dos conteos. Fuera de esas dos semanas no hay convivencia.

### La decisión sobre el Excel histórico

| Qué | Decisión |
|---|---|
| ¿Se importa? | **Sí, completo**, a `tramites_historicos`, sólo lectura, tabla separada. Etapa 5. |
| ¿Se archiva? | **Sí.** El .xlsx original va a Supabase Storage con su SHA-256 anotado en `docs/MIGRACION-EXCEL.md`. |
| ¿Convive? | **No.** Sólo durante el paralelo de dos semanas, y con la app como fuente. Después deja de escribirse. |

Mezclar las filas históricas con el modelo vivo envenena todos los conteos del reporte de
cierre desde el primer día, y la convivencia indefinida es el pisón de saldos un nivel más
arriba: dos fuentes de verdad es exactamente lo que denuncia `[fuente:16]`.

---

## 7. Migración de datos: qué se importa y qué no

Fuente: `GESTORIA AL 06-08-2026.xlsx`. Hojas visibles en `[img 04]`: PARIS AUTOS, DORAL
CHEVROLET, PARIS CARS, PARIS MOTOR, PARIS TRAC, RESU… La celda activa es `E6871` y las filas
llegan al menos a 6.868 **sólo en PARIS AUTOS**, así que el volumen total es mayor a 6.800 y
hay que contarlo antes de decidir nada.

| Col | Encabezado | Destino | Decisión |
|---|---|---|---|
| — | (pestaña) | `hoja` → `razon_social` | Se importa. La hoja `RESU…` **no**: es derivada. |
| A | FECHA | `fecha` | Se importa. Fechas fuera de 2015–2027 → rechazo con motivo. |
| B | (sin encabezado) | `descripcion` **cruda** + `tipo_detectado`, `cliente_detectado` | Se importa siempre cruda. El parseo es derivado y best-effort: `PATENTAMIENTO` / `TRANSFERENCIA` / `TRANSFERENCIA … A PARIS AUTOS` → los tres tipos de `[fuente:28]`. |
| C | (sin encabezado) | `identificador_unidad` + `dominio_detectado` | Se importa cruda. El dominio sale sólo si matchea patrón: la misma columna tiene KXS462, AG142FZ, VG504373 y 505796. |
| D | GESTOR | `gestora_declarada` | Se importa **como quién pagó**, no como quién tiene el trámite. Ver pregunta abierta 3. |
| E | $ TRANSF | `monto_transf` | Se importa si es numérico. Vacía en todas las filas visibles. |
| F | (sin encabezado) | — | **No se importa.** Columna sin nombre = sin significado conocido. |
| G | TOTAL | `total` | Se importa si es numérico. Vacía en todas las filas visibles. |
| H | QUITER | — | **No se importa.** Pregunta abierta 1. |
| I | FECHA | `fecha_pago_declarada` | Se importa. En las filas visibles aparece siempre junto con GESTOR y TARJETA. |
| J | INDICE | — | **No se importa.** Pregunta abierta 1. |
| K | QUITER | — | **No se importa.** Dos columnas con el mismo nombre en la misma planilla. |
| L | TARJETA | `pagado_con_tarjeta` | Se importa como booleano por presencia del texto. |

**Lo que NO se importa a `tramites` (el modelo vivo): nada.** Cero filas históricas.

**La excepción, y es a mano:** los trámites abiertos al día del corte —los que están en la
planilla sin fecha en la columna I ni marca TARJETA— se cargan **a mano** en la app durante
el paralelo. Son decenas, no miles, y hacerlo a mano garantiza que quien los carga entiende
la pantalla antes de que el sistema esté en producción.

### Herramienta

Tres pasos, deliberadamente separados, porque el parseo tiene que ser auditable **antes** de
que toque la base:

```
node scripts/importar-excel.mjs "GESTORIA AL 06-08-2026.xlsx" --salida ./importacion
  -> importacion/historicos.csv
  -> importacion/rechazos.csv     (fila, hoja, texto crudo, motivo)
  -> importacion/resumen.txt      (por hoja: leídas / importadas / rechazadas)

node scripts/verificar-importacion.mjs ./importacion
  -> sale con código 1 si leídas ≠ importadas + rechazadas en cualquier hoja

node scripts/cargar-historicos.mjs ./importacion   # service role, idempotente por (hoja, fila)
```

Se usa `xlsx`, que ya está en el stack decidido. No se usa Postgres COPY directo desde el
.xlsx ni una extensión: el paso intermedio en CSV es lo que permite abrir el archivo y
mirar 20 filas al azar antes de escribir nada.

**Criterio de aceptación (R38), aritmético y no cualitativo:** por cada hoja, filas leídas =
importadas + rechazadas. Más 20 filas elegidas al azar comparadas a ojo contra el Excel.

---

## 8. Procedimiento diario — esto es el instructivo

> Se imprime y se pega al lado del monitor. Está escrito para las personas que lo van a
> hacer, no para quien programa.

**08:00–09:30 · Administración contable (San Luis)**

1. Abrí el mail. De cada trámite nuevo copiá lo que ya viene en el asunto: nombre completo
   del cliente, cuenta personal, vehículo y referencia de oferta.
2. Hacé el control de la oferta y el análisis de saldos como siempre.
3. Si está bien: **Trámites → Nuevo**. Cargá razón social, sucursal, tipo, cliente,
   identificador de la unidad, referencia de oferta y gestora. Guardá.
   Con eso el trámite queda **autorizado**. No hay que aprobarlo aparte: cargarlo es
   autorizarlo.
4. Juntá el legajo para la firma.

**09:30–10:30 · Gerencia**

5. Firmá la documentación física.
6. En el listado, marcá **Firmado** lo que firmaste. Se puede en lote.

**10:30 · Administración contable**

7. Entregá el legajo a la gestora y marcá **Entregado**. Sin esa marca la gestora no lo ve
   en el teléfono.

**Durante el día · Gestora, desde el teléfono, en el registro**

8. **Mis trámites → el trámite → Cargar presupuesto.** Una línea por concepto (presupuesto,
   previo, 2do, lo que corresponda). Abajo escribí cuánto pedís que depositen. Guardá.
   Queda **presupuestado** y aparece en Solicitudes de fondos.
   *Esto reemplaza la hoja del cuaderno y la foto. No mandes la foto.*
9. Cuando pagás en el registro: **Marcar pagado**, y cargá el costo real por concepto
   (arancel, prenda, sellados). Guardá. El saldo de la tarjeta baja solo.
10. Cuando lo retirás: **Retirado**.

**11:00 y 16:00, dos pasadas fijas · Gerencia o administración contable**

11. **Solicitudes de fondos.** Por cada una mirá *Disponible después*. Si alcanza,
    transferí por el canal de siempre y después cargá el ingreso:
    **Tarjeta → Nuevo ingreso**, con fecha, importe y de dónde vino.
12. Si no alcanza, dejala en espera. **No la borres:** una solicitud sin fondos es
    información, es lo que después explica por qué un trámite se frenó.
13. **Regla:** no se deposita contra una foto de WhatsApp. Si no está en Solicitudes de
    fondos, no existe.

**17:30 · Administración contable**

14. Entrá a Tarjeta Habitualista, filtrá el día, seleccioná el listado de Operaciones de
    Pago y copialo con Ctrl+C.
15. En la app: **Conciliación → Pegar operaciones.** Pegá y confirmá.
16. Resolvé la bandeja. Tiene tres tipos de fila:
    - **Operación no registrada** — se pagó algo que nadie cargó. Averiguá qué fue y
      cargalo. *Esta fila es el pisón de saldos, y es la razón por la que existe todo esto.*
    - **Pago sin respaldo** — está marcado pagado en la app y no figura en Habitualista.
      Verificá si se pagó de verdad.
    - **Diferencia de importe** — conciliá y escribí el motivo.
17. Cuando la bandeja queda en cero, el saldo se sella con la hora.

**Cuando el trámite vuelve · Administración contable**

18. Marcá **Devuelto** y pasalo a administración para la entrega de la unidad.

**Viernes · Gerencia o administración contable**

19. **Cobros** — cargá el monto cobrado al cliente de los trámites cerrados de la semana.
    Las gestoras no ven esta pantalla.

**Cierre de mes · Gerencia**

20. **Reportes → Cierre de mes.** Revisá, exportá a Excel y guardá el archivo.
21. **Objetivos** — cargá los patentamientos previstos del mes siguiente por razón social.
    Sin ese número no hay saldo proyectado.

---

## 9. Modos de falla del proyecto, con nombre y apellido

Los tres que están documentados en los otros dos proyectos y **cuál se va a repetir acá**.

### 9.1 "El saldo está conciliado. Verificado." — SE VA A REPETIR

Es la forma exacta del error más caro del Tablero: *"NO hay npm. Verificado"* quedó escrito
con el sello al lado y **nadie lo volvió a probar durante semanas**, mientras
`.githooks/pre-commit` corría `npx` tres líneas más abajo. Pasó dos veces en el mismo
archivo: la segunda fue *"git push falla"*.

Acá el candidato es obvio: el saldo de la app es una simulación mantenida a mano. Alguien
va a conciliar una vez, va a escribir que el saldo es correcto, y seis semanas después
nadie va a saber cuándo dejó de serlo.

**Cómo se corta:** el sello de conciliación no es una frase en un documento, es un dato en
la pantalla. `conciliado hace N horas`, y a las 24 h el número pasa a `--warn` solo. Nadie
tiene que acordarse de revisar; la pantalla se pone fea. Y en `CLAUDE.md` va la regla
heredada, textual: **si escribís "verificado", escribí al lado la consulta SQL que lo
comprueba. Si no podés, escribí "sin verificar".**

### 9.2 Publicar poco porque publicar es caro — SE VA A REPETIR SI NO SE MIDE EL DÍA 1

En el Tablero se llegó a **30 commits sin publicar**, incluido el arreglo de un defecto de
seguridad. El dueño abrió la app, vio la versión vieja, y creyó que nada de lo hecho
funcionaba. Nada estaba roto: estaba sin publicar. La causa fue una afirmación cierta en
algún momento, escrita sin el comando al lado, que nadie volvió a probar.

**Cómo se corta:** el primer día del repo nuevo se corre `git push origin main` y se escribe
en `CLAUDE.md` el resultado **con la fecha**. Tope duro: nunca más de 5 commits sin
publicar, y el número vive en `docs/ESTADO-DEL-PROYECTO.md`. Regla general heredada: cuando
una regla del archivo obligue a un camino caro, se prueba primero el barato.

### 9.3 Declararse completo a sí mismo — SE VA A REPETIR

La matriz de cobertura del Tablero del 06/08 se declaró completa; una revisión independiente
encontró once hallazgos adentro de las áreas que daba por cerradas, incluida una contraseña
en texto plano. Y en el proyecto del Estudio, los tres peores defectos —el emoji que
sobrevivía al filtro, el tablero en blanco, la firma que publicaba un garabato— **se
descubrieron mirando la pantalla, no corriendo los tests.**

Acá el riesgo es peor porque el producto son números de dinero: un test que pasa sobre un
`saldosDeTarjeta` correcto no dice nada de si el trigger insertó el movimiento con el signo
que va.

**Cómo se corta:** ninguna etapa cierra con un check escrito por quien la construyó. Cada
etapa cierra con la clienta recorriendo un guion de ocho pasos escritos de antemano, sobre
datos reales, y firmando qué falló. Las migraciones las corre el dueño en Supabase —es una
dependencia real de este proyecto, igual que en el Tablero, y no es una excusa: es la forma
del problema.

### 9.4 El que es propio de acá y no está en ningún CLAUDE.md: la foto vuelve

Los tres de arriba son fallas de método. Ésta es la falla de producto, y es la que mata el
proyecto: la gestora manda la foto igual porque tarda cinco segundos, alguien deposita
igual porque siempre se hizo así, y a las tres semanas la app tiene la mitad de los
trámites. Un sistema con la mitad de los datos es peor que no tener sistema, porque el
saldo comprometido pasa a mentir con formato profesional.

**Cómo se corta:** la regla de gerencia firmada **antes** de la primera línea de código, y
la medición del conteo de fotos durante 20 días hábiles (R1). Si a los 20 días el conteo no
llegó a cero, se para el desarrollo y se arregla la regla, no el software.

### 9.5 Saltar del paso 1 al 3

El fallo típico del Tablero, textual: ordenar un poco, entusiasmarse con algo nuevo y dejar
las correcciones para después. Acá el equivalente concreto es empezar por el informe de
saldos proyectados, que es lo más lindo de mostrar, antes de que el listado tenga datos
reales de tres semanas. Por eso la proyección está en la etapa 4 y está escrito por qué.

---

## 10. Lo que el sistema NO va a hacer

Escrito acá para que nadie lo suponga, con el mismo criterio del comentario de la migración
54 del Tablero.

**Nunca:**

1. **No se conecta a Tarjeta Habitualista.** No la scrapea, no guarda credenciales de ese
   sitio, no lee el saldo real solo. Los ingresos los carga una persona.
2. **No mueve dinero.** No transfiere, no paga, no ordena nada a ningún banco. Registra que
   alguien pagó; no paga.
3. **No mide personas.** No hay ranking de gestoras, ni conteo por persona, ni comparación
   entre gente, en ninguna vista, reporte o exportación.
4. **No es firma digital.** El estado `firmado` registra que la firma física ocurrió; no la
   produce ni la valida.
5. **No inventa montos.** No calcula aranceles, sellados ni tarifas del registro automotor.
   Todos los números los escribe una persona.
6. **No manda mensajes.** No manda WhatsApp, ni mail, ni notificaciones a nadie fuera de la
   app. Si un trámite se traba, alguien lo ve en la pantalla, no le llega un aviso.
7. **No es contabilidad.** No genera asientos, no cierra períodos contables y no se integra
   con el Tablero Contable. Es un proyecto separado, con su propio Supabase y su propio
   repo.
8. **No importa el Excel de forma continua.** La importación histórica es un evento único y
   la tabla resultante es de sólo lectura. No hay sincronización de ida y vuelta.

**Todavía no, y cuándo se revisa:**

9. **No guarda el legajo documental.** Los formularios y el legajo del cliente siguen en
   papel. Se revisa cuando la etapa 3 esté cerrada y la clienta lo pida con un caso concreto.
10. **No se integra con Quiter.** Ninguna etapa de este diseño lee ni escribe en el sistema
    interno. Se revisa si la respuesta a la pregunta abierta 7 (de dónde salen los objetivos
    de patentamientos) obliga a hacerlo.
11. **No funciona sin conexión.** No hay cola de escritura offline. Se revisa si aparece un
    caso real de un registro sin señal.
12. **No controla stock ni entregas de unidades.** El trámite termina cuando vuelve a
    administración; lo que pasa después no es de este sistema.
13. **No tiene multi-idioma, ni multi-moneda, ni auditoría exportable a un formato legal.**

Cada punto de la segunda lista lleva escrito cuándo se descarta o se revisa, porque —regla
del Tablero— una propuesta sin fecha de revisión es un compromiso permanente disfrazado de
experimento.
