# Modelo de datos y permisos (RLS)

> Salida de un diseno automatico del 18/08/2026. **SIN VERIFICAR**: los revisores
> adversariales y el critico de completitud no llegaron a correr (limite de gasto).
> El plan en `docs/superpowers/plans/` lo corrige donde hacia falta; ver el
> INDICE, seccion 4.

## Resumen

Diseñé trece tablas, cuatro vistas y siete helpers SECURITY DEFINER para la plataforma de Gestoría, repartidos en ocho migraciones idempotentes y numeradas. La idea central es que la base sostiene tres invariantes que hoy sostiene la costumbre: el saldo no es un campo que se pisa sino la suma de un libro mayor de sólo-inserción, el ciclo del trámite es una máquina de nueve estados con responsable por transición validada en un trigger, y lo cobrado al cliente NO vive en la misma fila que el resto del trámite. Ese último punto es la decisión que ordena el modelo de permisos: en Supabase todos los usuarios logueados son el mismo rol de Postgres, así que un GRANT por columna es incapaz de distinguir a una gestora de gerencia; la única barrera real es que el dato esté en otra fila de otra tabla, `tramite_cobros`, con su propia RLS, y que la lectura conjunta pase por una vista con `security_invoker` que le devuelve null a quien no puede verlo. La sucursal se modela como dimensión y nunca como muro: cortar la visibilidad por sucursal sería reconstruir en la base el problema que el proyecto viene a resolver.

## Decisiones

### Dónde vive el "cobrado al cliente"

**Decision.** Tabla aparte `tramite_cobros`, 1:1 con `tramites` (PK = tramite_id), con su propia RLS que sólo deja pasar a gerencia y contable. La lectura conjunta se hace con la vista `v_tramites` que hace LEFT JOIN y tiene `security_invoker = true`: la gestora ve la misma vista y le llega `null` en `monto_cobrado`, sin error ni fila faltante.

**Por que.** En Supabase TODOS los usuarios logueados son el MISMO rol de Postgres (`authenticated`). Los GRANT por columna son por rol, no por persona: `grant select (col) on tramites to authenticated` le esconde la columna a la gestora Y a gerencia al mismo tiempo. Es decir, el mecanismo que parece resolverlo no puede resolverlo — mismo patrón que la migración 43 del Tablero, donde `revoke ... from anon` parecía proteger y no protegía nada. RLS por fila sí alcanza cuando la fila está en OTRA tabla: `select * from tramite_cobros` devuelve cero filas para una gestora, y no hay `select *` sobre `tramites` que arrastre el dato porque el dato no está ahí. Pedido en PROYECTO-GESTORIA-texto.md líneas 23 y 26.

**Alternativa descartada.** (a) GRANT por columna sobre `tramites`: descartado porque exigiría crear roles Postgres reales (gerencia/contable/gestora), otorgarlos a `authenticator` y emitir el claim `role` desde un Auth Hook. Duplica la matriz de permisos en dos lugares (RLS + grants) y un claim mal emitido deja la API entera caída. (b) Esconder la tabla y exponer sólo vistas: obliga a revocar select sobre `tramites` a `authenticated`, con lo que se rompe todo `insert`/`update` con `returning=representation` de PostgREST — que es lo que usa el cliente de Supabase por defecto.

### El saldo no se guarda: se calcula

**Decision.** No hay columna `saldo` en ninguna tabla. `movimientos_tarjeta` es un libro mayor de sólo-inserción (sin update ni delete para nadie) y el saldo sale de `v_saldos_tarjeta` como suma. Un error se corrige con un movimiento de tipo `ajuste`, nunca editando el original.

**Por que.** El problema que dispara todo el proyecto es que se pisan los saldos entre contable y gerencia (PROYECTO-GESTORIA-texto.md línea 16). Un campo `saldo` mutable es exactamente el objeto que se pisa: dos escrituras concurrentes y gana la última. Una suma de filas no se pisa. Además la conciliación contra el listado real de Operaciones de Pago (imagen 03-habitualista-operaciones.png) necesita comparar movimiento contra movimiento, no un total contra otro total.

**Alternativa descartada.** Columna `saldo_actual` en `tarjetas_habitualista` mantenida por trigger. Descartada: es un caché de una suma barata, y el día que un trigger falla o alguien corre un update a mano el número miente sin avisar. La imagen 02 muestra un saldo de $2.505.627,92 sobre una tabla con miles de operaciones: sumar eso con un índice es instantáneo.

### Reserva y pago son dos movimientos distintos

**Decision.** El monto aproximado de la gestora genera un movimiento `reserva` (negativo). Cuando se registra el costo real se inserta la `reversa_reserva` (positivo, por el monto exacto reservado) más el `pago` (negativo, por el costo real). Nunca se borra ni se edita la reserva.

**Por que.** El documento pide dos cosas distintas: que el monto aproximado 'vaya debitando del saldo total' (línea 21) y que después se anote el costo real discriminado (línea 22). Si fuera una sola fila editable, el saldo de ayer dejaría de ser reconstruible y la conciliación contra el listado del banco no cerraría nunca, porque en el banco el pago real figura con su número (imagen 03, columna 'Numero de pago') y la reserva no existe. Por eso `v_saldos_tarjeta` expone dos números: `saldo_banco` (comparable con la imagen 02) y `saldo_disponible` (saldo_banco menos reservas vigentes), que es el prudente, el que hay que mirar antes de mandar a presentar.

**Alternativa descartada.** Una sola columna `monto` en el trámite que se pisa con el real. Descartada: pierde la información de cuánto se había reservado, que es justo el número con el que la gestora decide si presenta o no.

### DORAL CHEVROLET y PARIS TRAC

**Decision.** Entran como razones sociales de pleno derecho (5 filas en `razones_sociales`), pero sólo hay 3 tarjetas habitualistas. Cada razón social tiene `tarjeta_id` nullable apuntando a la tarjeta con la que paga. Las dos nuevas arrancan con `tarjeta_id` en null y un trigger impide presentar un trámite con medio de pago `tarjeta_habitualista` si la razón social no tiene tarjeta asignada.

**Por que.** El texto nombra tres habitualistas (línea 9) y la planilla muestra cinco pestañas: PARIS AUTOS, DORAL CHEVROLET, PARIS CARS, PARIS MOTOR, PARIS TRAC (imagen 04-planilla-excel.png, barra de pestañas). Las dos afirmaciones no se contradicen: una habla de tarjetas, la otra de razones sociales. Sacar a DORAL y TRAC del modelo rompería la importación de la planilla y los reportes por razón social que pide la línea 29. Inventarles una tarjeta que el documento no menciona sería peor.

**Alternativa descartada.** Modelar sólo las tres razones sociales con habitualista y meter DORAL/TRAC como una etiqueta dentro de Paris Autos. Descartada: son razones sociales distintas a efectos fiscales y el reporte de cierre de mes (línea 31) las necesita separadas.

### La sucursal NO es un muro de permisos

**Decision.** `sucursales` tiene una columna `gestionada_por` ('contable' para San Luis, 'gerencia' para San Juan) que sirve para filtros y valores por defecto, pero NINGUNA policy de RLS mira la sucursal. Contable ve San Juan y gerencia ve San Luis, completos.

**Por que.** Es literalmente el problema a resolver: 'muchas veces nos pisamos los saldos disponibles en la tarjeta habitualista por no manejar un solo listado unificado' (PROYECTO-GESTORIA-texto.md línea 16). Si la RLS parte la vista por sucursal, el sistema nuevo reproduce el Excel de hoy con otra cara. La responsabilidad se marca, la visibilidad no se corta.

**Alternativa descartada.** RLS por sucursal según el rol. Descartada por lo anterior: sería resolver el problema equivocado con la herramienta más cara de revertir.

### Las gestoras son una tabla propia, no un rol de perfil

**Decision.** `gestoras` (id, nombre, activa, perfil_id nullable) separada de `perfiles`. El vínculo con el login es opcional: `perfiles.gestora_id` apunta a la gestora cuando esa persona tiene usuario.

**Por que.** La planilla ya nombra gestoras (columna GESTOR: CARLA, MARIANA — imagen 04, filas 6843, 6850, 6857) y el trámite se le asigna a una gestora exista o no su usuario. Si la gestora fuera solamente un perfil, no se podría cargar el histórico del Excel ni asignar un trámite a alguien que todavía no se dio de alta. Además cada gestora tiene su tarjeta de débito (línea 9), y la imagen 02 muestra 'Tarjeta Habiente: 4' sobre una sola habitualista: son tarjetahabientes, no usuarios de esta app.

**Alternativa descartada.** Usar `perfiles` con rol='gestora' como única entidad. Descartada: obliga a crear un usuario de Auth para poder registrar una asignación, que es poner el carro adelante del caballo.

### Qué puede tocar una gestora en un trámite

**Decision.** Un trigger `tramites_bloquear_campos_por_rol()` compara `to_jsonb(new) - campos_permitidos` contra `to_jsonb(old) - campos_permitidos` y aborta si difieren. La lista permitida para gestora es cerrada: monto_aproximado, los tres costos reales, numero_pago_registro, seccional, observaciones_gestora y estado.

**Por que.** La RLS de Postgres decide qué FILAS se pueden actualizar, no qué COLUMNAS. Sin trigger, una gestora con permiso de update sobre su fila puede cambiar el nombre del cliente o la razón social desde la consola del navegador. Es el mismo agujero y la misma solución de la migración 39 del Tablero (`profiles_bloquear_campos_sensibles`). La comparación por diferencia de jsonb en vez de enumerar los campos prohibidos es deliberada: una columna que se agregue mañana queda protegida por defecto; la versión enumerada falla abierta.

**Alternativa descartada.** Enumerar los campos prohibidos con `is distinct from`, como hace hoy el Tablero. Funciona, pero cada columna nueva es una que alguien tiene que acordarse de agregar, y el modo de falla es silencioso.

### La máquina de estados vive en la base

**Decision.** Nueve estados en `tramites.estado` con check, más `public.tramites_validar_transicion()`: valida el par (estado_viejo, estado_nuevo) Y el rol que lo puede hacer, y escribe la fila en `tramite_eventos`. Retroceder de estado sólo lo puede gerencia.

**Por que.** El ciclo del documento (líneas 6 a 11) es un procedimiento con responsables distintos por paso, y hoy lo garantiza la costumbre. El Tablero ya aprendió esto en la migración 53: 'el trigger no mira el fuente: mira la escritura'. Acá pesa más todavía porque la transición dispara plata (la reserva) y porque la gestora puede estar operando desde el teléfono en el registro.

**Alternativa descartada.** Una columna por fecha (fecha_autorizado, fecha_presentado...) sin estado ni validación, calculando el estado por la última fecha cargada. Descartada: no hay forma de impedir que se cargue 'pagado' sin haber pasado por 'presentado', que es exactamente el error que hoy se atrapa mirando la planilla.

### Fechas hito denormalizadas además del historial

**Decision.** `tramite_eventos` guarda todo el historial, y `tramites` lleva cuatro timestamps mantenidos por el mismo trigger: autorizado_at, presentado_at, pagado_at, devuelto_at.

**Por que.** El reporte de cierre de mes (línea 31) y el informe de saldos proyectados (línea 30) agrupan por mes de presentación y de pago. Resolver eso con un lateral sobre el historial en cada consulta, sobre una tabla que hoy ya tiene 6.868 filas de Excel para importar (imagen 04, celda activa E6871), es caro y frágil. Las cuatro columnas las escribe un solo trigger, no la aplicación: no se pueden desincronizar desde el front.

**Alternativa descartada.** Sólo el historial, con vista materializada para los reportes. Descartada por ahora: una vista materializada necesita una política de refresco, que es otra pieza que se puede olvidar de correr.

### El asunto del mail se guarda crudo y parseado

**Decision.** Cuatro columnas (cliente_nombre, cliente_cuenta, vehiculo, oferta_referencia) más `asunto_mail` con el texto original completo.

**Por que.** El documento dice que ese asunto trae los cuatro datos y que hoy se copia a mano a la planilla (líneas 6 y 7). Guardar sólo el parseo significa que un asunto con formato raro se pierde para siempre; guardar sólo el crudo significa no poder buscar ni agrupar. Con las dos, un cambio en el parser se puede volver a correr sobre lo viejo sin volver al Outlook.

**Alternativa descartada.** Guardar únicamente las cuatro columnas parseadas y descartar el asunto original, que es lo que hace hoy la planilla (imagen 04, columna B: todo el asunto aplastado en una sola celda de texto). Descartada: cuando el parser se equivoca no hay contra qué comparar, y ya se ve en la planilla que el formato del asunto no es estable (conviven 'REF. 4097473', 'ref 4093504' y 'REF4064625' en las filas 6850, 6857 y 6862).

### Tipos de trámite: text con check, no tabla de catálogo

**Decision.** `tipo` es text con check sobre tres valores: patentamiento_0km, transferencia_a_cliente, transferencia_al_concesionario.

**Por que.** Son los tres que pide la línea 28 y son estructurales: cada uno alimenta un reporte distinto y un objetivo distinto. Agregar un cuarto no es cargar una fila, es tocar los reportes igual. La migración 54 del Tablero explica el criterio inverso para las listas que sí son configurables ('una tabla nueva obligaría a una pantalla nueva para administrarla').

**Alternativa descartada.** Tabla `tipos_tramite` con FK. Descartada: agrega una pantalla de ABM para tres filas que no cambian.

### Nada se borra

**Decision.** Ninguna tabla del dominio tiene policy de DELETE para ningún rol. Un trámite equivocado se pasa a estado `anulado` con motivo; un movimiento equivocado se compensa con un `ajuste`.

**Por que.** La planilla actual es el registro histórico de la operación y va por la fila 6.868 (imagen 04). El día que falte un trámite, la pregunta va a ser 'quién lo borró' y no va a haber respuesta. Anular deja el rastro y cuesta lo mismo.

**Alternativa descartada.** Delete para gerencia. Descartado: gerencia es justamente quien más rápido puede tapar un error propio, y el documento pide una plataforma para destrabar la comunicación entre sectores, no para arbitrar entre ellos.

### Vistas con security_invoker

**Decision.** Todas las vistas se crean con `with (security_invoker = true)`, y la migración 08 trae la consulta que lista las vistas de `public` que no lo tienen.

**Por que.** Una vista en Postgres corre con los permisos de su DUEÑO. Creada desde el SQL Editor de Supabase, la dueña es `postgres`, que saltea RLS. Sin ese flag, `v_tramites` le entregaría a cualquier gestora todos los trámites de todas las razones sociales y el monto cobrado al cliente incluido — es decir, la vista que existe para proteger el dato sería el agujero. Con el flag, la RLS de `tramite_cobros` se evalúa como la gestora y el LEFT JOIN le devuelve null.

**Alternativa descartada.** No usar vistas y armar el join en el front con dos consultas, una a `tramites` y otra a `tramite_cobros`. Descartada: obliga a que el front sepa el rol antes de consultar y ramifique, y ese `if (esGestora)` en el cliente es exactamente el 'esconder un botón' que el pedido descarta. La regla de la casa vale acá: la pared la pone la base, el front sólo avisa antes.

## Preguntas abiertas

- **¿La carga en la plataforma reemplaza la firma de gerencia, o convive con ella?**
  - Lectura A: Reemplaza: 'si el nombre del cliente está ingresado a la plataforma ya sea sinónimo de autorización del mismo' (línea 21). Entonces el estado `autorizado` sobra y el trámite pasa de `controlado` directo a `entregado_gestora`.
  - Lectura B: Convive: 'se firma la documentación por gerencia y se entrega a las gestoras' (línea 7) describe el procedimiento actual y la frase de la línea 21 sólo quiere decir que la gestora no tiene que esperar la foto del papel firmado por WhatsApp.
  - Recomendacion: Dejar el estado `autorizado` en el esquema (sacarlo después es una migración trivial; agregarlo después obliga a recalcular el historial). Que autorizar sea un solo clic de gerencia y que la gestora vea el sello 'AUTORIZADO' en la lista. Confirmar con la clienta antes de construir la pantalla de gerencia.
- **¿PRESUPUESTO / PREVIO / 2do del cuaderno son los mismos tres conceptos que arancel / prenda / sellados?**
  - Lectura A: Son la misma apertura con otro nombre: la gestora ya discrimina en tres líneas (imagen 01-cuaderno-gestora.png) y el documento pide 'diferenciando arancel-prenda-sellados' (línea 22). Entonces alcanza con tres campos y el cuaderno se mapea uno a uno.
  - Lectura B: Son dos aperturas distintas: la del cuaderno es el ADELANTO (lo que hay que depositar antes) y la del documento es el COSTO REAL una vez pagado. En los tres casos legibles del cuaderno la suma no da el 'Dep': 570.000+480.000+40.000 = 1.090.000 contra 'Dep $1.100.000'; 440.000+330.000+27.000 = 797.000 contra 800.000; 450.000+200.000+16.000 = 666.000 contra 670.000. El depósito es un redondeo hacia arriba del adelanto, no el costo.
  - Recomendacion: Modelar como en la lectura B, que es lo que muestran los números: `monto_aproximado` es el depósito redondeado (lo que debita del saldo) y los tres costos reales van aparte. No inventar campos para PRESUPUESTO/PREVIO/2do hasta preguntarle a la gestora qué es cada uno; mientras tanto entran en `observaciones_gestora`.
- **¿Con qué tarjeta habitualista pagan DORAL CHEVROLET y PARIS TRAC?**
  - Lectura A: Usan la de otra razón social (probablemente Paris Autos, que es la que aparece como 'Habitualista' en todas las filas visibles de la imagen 03).
  - Lectura B: Tienen la suya y el documento sólo nombró tres porque son las tres que maneja contable en San Luis.
  - Recomendacion: Cargar las cinco razones sociales con `tarjeta_id` en null para esas dos, y que el sistema bloquee presentar un trámite con medio de pago 'tarjeta_habitualista' hasta que se defina. Un null que frena es mejor que un default que factura contra la tarjeta equivocada.
- **¿'PATENTAMIENTO PLAN DE AHORRO' es un tipo de trámite propio o un atributo del patentamiento?**
  - Lectura A: Atributo: el documento pide agrupar por tres tipos (línea 28) y plan de ahorro es la modalidad de compra, no otro trámite en el registro.
  - Lectura B: Tipo propio: en la planilla aparece escrito como categoría distinta y sistemática, con su número de cuenta ('PATENTAMIENTO PLAN DE AHORRO- C.74344', 'C.103188' — imagen 04, filas 6843 y 6852 a 6855), y el circuito de documentación no es el mismo.
  - Recomendacion: Lectura A: `tipo` queda en tres valores y se agrega `subtipo` nullable con check ('plan_ahorro','credito','contado'). Los reportes pueden agrupar por los dos. Si mañana resulta ser un tipo propio, es un update de una columna, no una migración de datos.
- **¿Quién carga el trámite: administración de ventas o administración contable?**
  - Lectura A: Contable, como hoy: recibe el legajo y el mail y lo pasa a la planilla (líneas 6 y 7). Administración de ventas no es usuaria de la plataforma y el documento sólo nombra tres sectores (línea 18).
  - Lectura B: Administración de ventas, que es quien tiene el asunto del mail armado, y contable pasa a controlar en vez de tipear.
  - Recomendacion: Lectura A para la etapa 1: `estado='recibido'` lo crea contable o gerencia, y `recibido_at` es un dato de la fila, no una acción de un usuario de esa área. La lectura B es una mejora obvia de una etapa posterior, y el esquema ya la soporta agregando un valor al check de `perfiles.rol`; no hace falta decidirlo ahora.
- **¿Qué es la columna INDICE de la planilla?**
  - Lectura A: El índice del plan de ahorro (el coeficiente o número de cuota), que iría junto a la cuenta.
  - Lectura B: Un índice interno de la planilla o del sistema Quiter para cruzar filas entre hojas.
  - Recomendacion: No modelarla todavía. Va a `datos_planilla jsonb` en la importación del histórico, que preserva la columna sin comprometer una interpretación. Preguntar antes de darle una columna propia.
- **¿Las gestoras tienen que ver el saldo de la tarjeta habitualista, o sólo si alcanza?**
  - Lectura A: Ven el saldo: el objetivo es 'visualizar en tiempo real... también los saldos disponibles en las respectivas tarjetas habitualistas' (línea 20) y ya lo ven en el sitio del habitualista con su propio usuario (imagen 02).
  - Lectura B: No lo ven: la restricción de la línea 26 es sobre lo cobrado al cliente, pero el espíritu de la línea 27 ('sólo gerencia/administración contable podrían modificar saldos disponibles') podría extenderse a mirarlo.
  - Recomendacion: Lectura A, y el esquema la implementa: la gestora ve los movimientos y el saldo de las tarjetas donde tiene tarjeta de débito, y no puede insertar ni un solo movimiento a mano. La línea 27 dice MODIFICAR, no ver, y esconderle el saldo a quien decide si presenta o no vuelve a poner la comunicación en WhatsApp.

## Riesgos

- **Alguien crea una vista nueva sin `security_invoker = true`. La vista corre como `postgres`, saltea toda la RLS, y una gestora ve el monto cobrado al cliente de todos los trámites.**
  - Mitigacion: La migración 08 incluye una consulta de verificación sobre `pg_class.reloptions` que lista las vistas de `public` sin el flag, y un test de integración que se loguea como gestora de prueba y afirma que `monto_cobrado` viene null. Es el chequeo que hay que correr después de cada migración que agregue vistas.
- **`tramite_cobros` termina en la publicación de Realtime y los cambios se emiten a suscriptores que no deberían recibirlos.**
  - Mitigacion: La migración 08 la excluye explícitamente y agrega la consulta que lista las tablas de `supabase_realtime`. Sólo `tramites` y `movimientos_tarjeta` entran.
- **Alguien corre `alter table movimientos_tarjeta force row level security` siguiendo un consejo genérico de seguridad, y los triggers SECURITY DEFINER que insertan la reserva dejan de funcionar: la gestora carga el presupuesto y el saldo no se mueve, sin ningún error visible.**
  - Mitigacion: Está escrito como comentario dentro de la migración 04, arriba de la definición del trigger, con el motivo. Y la verificación de esa migración es funcional: cargar un presupuesto de prueba y comprobar que aparece la fila de reserva.
- **La importación del histórico (6.868 filas de la planilla) dispara los triggers de estado y de cuenta corriente y genera miles de movimientos falsos que destruyen el saldo.**
  - Mitigacion: Los trámites importados entran con `origen='planilla'` y el trigger de cuenta corriente arranca con `if new.origen <> 'app' then return new`. El saldo histórico se carga como un único movimiento de tipo `saldo_inicial` con la fecha de corte.
- **El índice único parcial que impide patentar dos veces el mismo dominio rechaza una carga legítima (por ejemplo, un patentamiento que se anuló mal y se recarga) y la contable no entiende el error crudo de Postgres.**
  - Mitigacion: El índice excluye los anulados, así que el camino de salida existe. Y el error tiene que pasar por un clasificador de fallas —el equivalente de `src/lib/fallas.ts` del Tablero— para que el mensaje sea 'ese dominio ya tiene un patentamiento cargado' con un enlace al trámite existente, no el texto de la violación de unicidad.
- **Se agrega una columna con plata a `tramites` (por ejemplo `margen` o `ganancia`) y el dato escondido se filtra por la puerta de al lado, sin tocar `tramite_cobros`.**
  - Mitigacion: `comment on table public.tramites` lo dice en una línea: en esta tabla no va ningún importe que la gestora no pueda ver. Y un test que consulta `information_schema.columns` de `tramites` contra una lista blanca de columnas monetarias, para que la regla falle sola en vez de quedar en prosa.
- **La conciliación marca diferencias todos los días porque el sitio de Habitualista incluye operaciones de otras sucursales o de trámites que no pasaron por la plataforma, y el equipo aprende a ignorar el cartel.**
  - Mitigacion: `operaciones_habitualista.estado_conciliacion` distingue 'solo_en_banco' de 'diferencia_importe', y esas filas se pueden pasar a 'justificada' con un motivo escrito, que el check exige. Un tablero de conciliación que siempre está en rojo es un tablero apagado; la salida tiene que ser cerrar cada fila, no silenciarlas todas.
- **Una gestora deja la empresa y su usuario queda activo con acceso a los trámites y saldos.**
  - Mitigacion: `perfiles.activo` es la llave: los siete helpers de RLS exigen `activo = true`, así que desactivar el perfil deja al usuario logueado pero sin una sola fila visible. Desactivar no borra: los trámites históricos conservan la gestora asignada.

## Detalle

## 0. Lo que decide el diseño, antes del SQL

Tres frases del material fuente mandan sobre todo lo demás.

**Una.** *"muchas veces nos pisamos los saldos disponibles en la tarjeta habitualista por no manejar un solo listado unificado"* — `PROYECTO-GESTORIA-texto.md` línea 16. Un saldo que se pisa es un campo mutable con dos escritores. La respuesta no es un lock: es que el saldo deje de ser un campo. `movimientos_tarjeta` es un libro mayor de sólo-inserción y el saldo se suma.

**Dos.** *"Quizá limitaría la visibilidad de lo cobrado al cliente para las gestoras"* — línea 26. Esto no se resuelve escondiendo un botón. Ver §5.

**Tres.** *"Solo los usuarios como gerencia/administracion contable podrían modificar saldos disponibles"* — línea 27. Dice MODIFICAR, no ver. La gestora ve el saldo (lo necesita para decidir si presenta) y no puede insertar un movimiento ni con un cliente HTTP a mano.

Y una regla del Tablero que acá vale igual: **nunca una subconsulta a la tabla de perfiles dentro de una policy de perfiles** (42P17). Está pagada en `C:\Users\Vmagni\Desktop\GRUPO PARIS\tablero-contable-v2\db\migraciones\migracion-14-FIX-URGENTE-recursion.sql`, que dejó producción en 500 y el login sin cargar.

---

## 1. Migración 01 — Cimientos, perfiles y helpers

```sql
-- ============================================================================
--  GESTORÍA — MIGRACIÓN 01
--  Cimientos: extensiones, registro de migraciones, perfiles, roles y los
--  helpers SECURITY DEFINER sobre los que se apoya toda la RLS del proyecto.
--  Correr en Supabase -> SQL Editor. Se puede correr dos veces.
-- ============================================================================
--
--  POR QUÉ LOS HELPERS SON LO PRIMERO
--
--  Toda policy de este esquema pregunta "quién sos". Si esa pregunta se hace con una
--  subconsulta a `perfiles` desde una policy DE `perfiles`, Postgres entra en recursión
--  infinita (42P17) y devuelve 500 en TODAS las tablas, no sólo en esa. Ya pasó en el
--  Tablero Contable (db/migraciones/migracion-14-FIX-URGENTE-recursion.sql): el login
--  dejó de cargar y hubo que arreglarlo en caliente.
--
--  Una función SECURITY DEFINER se ejecuta con los permisos de su dueño (postgres), y el
--  dueño de una tabla está exento de RLS. Por eso `es_gerencia()` puede leer `perfiles`
--  desde adentro de una policy de `perfiles` sin volver a disparar la policy.
--
--  Las tres condiciones que hacen que un helper sea seguro, y las tres están en cada uno:
--    - `security definer`  -> corta la recursión.
--    - `stable`            -> el planificador la evalúa una vez por consulta, no por fila.
--    - `set search_path = public` -> impide que alguien secuestre la resolución de nombres
--      creando un esquema propio antes en el search_path.
-- ============================================================================

create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm  with schema extensions;

-- ------------------------------------------------------------
-- 1) Registro de migraciones
--
--    Sin esto no hay forma de saber, mirando la base, qué se aplicó. En el Tablero se
--    agregó recién en la migración 28 y hubo que reconstruir la lista a mano.
-- ------------------------------------------------------------

create table if not exists public.schema_migrations (
  id         int primary key,
  nombre     text        not null,
  applied_at timestamptz not null default now()
);

alter table public.schema_migrations enable row level security;

drop policy if exists "schema_migrations_select" on public.schema_migrations;
create policy "schema_migrations_select" on public.schema_migrations
  for select using (auth.role() = 'authenticated');

comment on table public.schema_migrations is
  'Que migraciones se corrieron en ESTA base. La app solo lee; escribe cada script corriendo como postgres.';

-- ------------------------------------------------------------
-- 2) Perfiles
--
--    Una fila por usuario de Auth. `rol` es text con check y no un enum de Postgres: un
--    enum obliga a `alter type` para agregar un valor y no se puede sacar nunca uno.
-- ------------------------------------------------------------

create table if not exists public.perfiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text        not null,
  nombre      text        not null,
  rol         text        not null default 'sin_asignar',
  activo      boolean     not null default false,
  gestora_id  uuid,                  -- FK se agrega en la migración 02 (gestoras aún no existe)
  creado_at   timestamptz not null default now(),
  constraint perfiles_rol_valido
    check (rol in ('sin_asignar', 'gestora', 'contable', 'gerencia'))
);

create unique index if not exists perfiles_email_uniq on public.perfiles (lower(email));

comment on table public.perfiles is
  'Un usuario de la plataforma. La identidad la maneja Auth; esta tabla dice QUE PUEDE HACER.';

comment on column public.perfiles.rol is
  'sin_asignar | gestora | contable | gerencia. Arranca en sin_asignar a proposito: un usuario recien creado no ve NADA hasta que gerencia lo habilita. El default seguro es el que no da permisos.';

comment on column public.perfiles.activo is
  'Llave general del acceso. Los siete helpers de RLS exigen activo=true, asi que desactivar un perfil lo deja logueado y sin una sola fila visible. Se desactiva, no se borra: los tramites historicos conservan quien los toco.';

comment on column public.perfiles.gestora_id is
  'A que gestora corresponde esta persona. Solo tiene sentido con rol=gestora. Es lo que ata el login con las filas de tramites que puede ver; sin esto una gestora veria cero tramites.';

alter table public.perfiles drop constraint if exists perfiles_gestora_coherente;
alter table public.perfiles add constraint perfiles_gestora_coherente
  check (rol <> 'gestora' or gestora_id is not null);

-- ------------------------------------------------------------
-- 3) Alta automática desde Auth
--
--    Sin este trigger, un usuario que se registra queda sin fila en `perfiles` y la app
--    le muestra una pantalla vacía sin explicación. Con él queda registrado y sin permisos.
-- ------------------------------------------------------------

create or replace function public.perfiles_alta_automatica()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfiles (id, email, nombre, rol, activo)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data->>'nombre', ''), split_part(new.email, '@', 1)),
    'sin_asignar',
    false
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists perfiles_alta_automatica on auth.users;
create trigger perfiles_alta_automatica
  after insert on auth.users
  for each row execute function public.perfiles_alta_automatica();

-- ------------------------------------------------------------
-- 4) Nadie se auto-promueve
--
--    La policy de update de `perfiles` deja editar la fila propia (para cambiarse el
--    nombre). Sin este trigger, eso alcanza para:
--        update perfiles set rol = 'gerencia' where id = auth.uid();
--    desde la consola del navegador. Es exactamente el agujero de la migración 39 del
--    Tablero, donde el jefe podía darse `admin_sistema` y leer el canal de consultas.
--
--    `auth.uid() is null` deja pasar al SQL Editor, que es el único lugar autorizado a
--    designar la primera gerencia.
-- ------------------------------------------------------------

create or replace function public.perfiles_bloquear_campos_sensibles()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.es_gerencia() then
    if new.rol        is distinct from old.rol
    or new.activo     is distinct from old.activo
    or new.gestora_id is distinct from old.gestora_id
    or new.email      is distinct from old.email then
      raise exception 'Solo gerencia puede cambiar rol, activo, gestora o email de un perfil';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists perfiles_bloquear_campos_sensibles on public.perfiles;
create trigger perfiles_bloquear_campos_sensibles
  before update on public.perfiles
  for each row execute function public.perfiles_bloquear_campos_sensibles();

-- ------------------------------------------------------------
-- 5) Los helpers
-- ------------------------------------------------------------

create or replace function public.mi_rol()
returns text language sql security definer stable set search_path = public as $$
  select rol from public.perfiles where id = auth.uid() and activo;
$$;

create or replace function public.es_gerencia()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.perfiles
                  where id = auth.uid() and activo and rol = 'gerencia');
$$;

create or replace function public.es_contable()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.perfiles
                  where id = auth.uid() and activo and rol = 'contable');
$$;

create or replace function public.es_gestora()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.perfiles
                  where id = auth.uid() and activo and rol = 'gestora');
$$;

-- El nombre dice QUÉ protege, no quién es. Si mañana un cuarto rol tiene que ver los
-- cobros, se toca esta función y NO las policies que la usan.
create or replace function public.puede_ver_cobros()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.perfiles
                  where id = auth.uid() and activo and rol in ('gerencia','contable'));
$$;

create or replace function public.mi_gestora_id()
returns uuid language sql security definer stable set search_path = public as $$
  select gestora_id from public.perfiles
   where id = auth.uid() and activo and rol = 'gestora';
$$;

-- Una gestora ve el saldo de las tarjetas donde tiene tarjeta de débito, y de ninguna otra.
create or replace function public.opero_esta_tarjeta(p_tarjeta uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.tarjetas_debito td
     where td.tarjeta_habitualista_id = p_tarjeta
       and td.activa
       and td.gestora_id = public.mi_gestora_id()
  );
$$;

grant execute on function public.mi_rol()                 to authenticated;
grant execute on function public.es_gerencia()            to authenticated;
grant execute on function public.es_contable()            to authenticated;
grant execute on function public.es_gestora()             to authenticated;
grant execute on function public.puede_ver_cobros()       to authenticated;
grant execute on function public.mi_gestora_id()          to authenticated;
grant execute on function public.opero_esta_tarjeta(uuid) to authenticated;

-- Las funciones de trigger NO son endpoints. En Postgres toda función nace con EXECUTE
-- para PUBLIC, y `anon` hereda de PUBLIC: revocarle sólo a `anon` no le saca nada. Esa
-- línea le costó a la migración 43 del Tablero una protección que parecía existir.
revoke execute on function public.perfiles_alta_automatica()           from public, anon, authenticated;
revoke execute on function public.perfiles_bloquear_campos_sensibles() from public, anon, authenticated;

-- ------------------------------------------------------------
-- 6) RLS de perfiles — ACÁ ESTÁ LA TRAMPA
--
--    Ni una subconsulta a `perfiles` en estas policies. Todo pasa por los helpers.
-- ------------------------------------------------------------

alter table public.perfiles enable row level security;

drop policy if exists "perfiles_select" on public.perfiles;
create policy "perfiles_select" on public.perfiles for select
  using (
    id = auth.uid()             -- columna propia, sin subquery
    or public.es_gerencia()     -- helper SECURITY DEFINER
    or public.es_contable()
  );

drop policy if exists "perfiles_update_propio" on public.perfiles;
create policy "perfiles_update_propio" on public.perfiles for update
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "perfiles_update_gerencia" on public.perfiles;
create policy "perfiles_update_gerencia" on public.perfiles for update
  using (public.es_gerencia()) with check (public.es_gerencia());

-- Sin policy de insert ni de delete: las filas las crea el trigger de auth.users
-- (SECURITY DEFINER, no pasa por RLS) y no se borran nunca.

insert into public.schema_migrations (id, nombre)
  values (1, 'migracion-01-cimientos.sql') on conflict (id) do nothing;

-- ============================================================================
--  CÓMO COMPROBAR QUE QUEDÓ BIEN
--
--  1) No hay recursión (esto tiene que devolver filas, no 42P17):
--       select id, rol from public.perfiles limit 5;
--
--  2) Designar la primera gerencia — desde ACÁ, el SQL Editor, donde auth.uid() es null:
--       update public.perfiles set rol = 'gerencia', activo = true
--        where lower(email) = 'la-cuenta@...';
--
--  3) Un usuario no se puede promover. Logueado como contable, esto tiene que FALLAR:
--       update public.perfiles set rol = 'gerencia' where id = auth.uid();
-- ============================================================================
```

---

## 2. Migración 02 — Catálogos

```sql
-- ============================================================================
--  GESTORÍA — MIGRACIÓN 02
--  Razones sociales, sucursales, tarjetas habitualistas, gestoras y tarjetas
--  de débito. Idempotente.
-- ============================================================================
--
--  RAZÓN SOCIAL Y TARJETA NO SON LO MISMO, Y ES LA DECISIÓN DE ESTE ARCHIVO
--
--  El documento dice que cada razón social tiene su Tarjeta Habitualista y nombra tres:
--  Paris Autos, Paris Cars, Paris Motor (PROYECTO-GESTORIA-texto.md línea 9). La planilla
--  muestra CINCO pestañas: PARIS AUTOS, DORAL CHEVROLET, PARIS CARS, PARIS MOTOR, PARIS TRAC
--  (imagen 04-planilla-excel.png, barra inferior).
--
--  No se contradicen: una frase habla de tarjetas, la otra de razones sociales. Entonces son
--  dos tablas, con una FK de razón social hacia tarjeta. DORAL y PARIS TRAC entran como
--  razones sociales de pleno derecho —el reporte por razón social de la línea 29 las
--  necesita— con `tarjeta_id` en NULL hasta que la clienta diga con qué tarjeta pagan.
--  Un null que frena la presentación es mejor que un default que le factura a la tarjeta
--  equivocada.
-- ============================================================================

create table if not exists public.tarjetas_habitualista (
  id      uuid primary key default extensions.gen_random_uuid(),
  nombre  text    not null unique,
  activa  boolean not null default true
);

comment on table public.tarjetas_habitualista is
  'Cada Tarjeta Habitualista es una cuenta corriente. El saldo NO vive aca: se suma de movimientos_tarjeta.';

comment on column public.tarjetas_habitualista.nombre is
  'Como figura en el sitio del habitualista, columna Habitualista: "Paris Autos SA" (imagen 03-habitualista-operaciones.png). Se guarda igual para que la conciliacion pueda emparejar por texto al pegar el listado.';

create table if not exists public.razones_sociales (
  id         uuid primary key default extensions.gen_random_uuid(),
  nombre     text    not null unique,
  cuit       text,
  tarjeta_id uuid    references public.tarjetas_habitualista(id),
  activa     boolean not null default true,
  orden      int     not null default 100
);

comment on column public.razones_sociales.tarjeta_id is
  'Con que Tarjeta Habitualista paga esta razon social. NULL = todavia no definido: el sistema bloquea presentar un tramite suyo con medio de pago tarjeta_habitualista. Es el caso de DORAL CHEVROLET y PARIS TRAC, que aparecen en la planilla pero no entre las tres habitualistas que nombra el documento.';

comment on column public.razones_sociales.orden is
  'Orden de aparicion en selectores y reportes. Sin esto el orden es alfabetico y Paris Autos, que es la de mayor volumen, queda en el medio.';

create table if not exists public.sucursales (
  id             uuid primary key default extensions.gen_random_uuid(),
  nombre         text    not null unique,
  gestionada_por text    not null,
  activa         boolean not null default true,
  constraint sucursales_gestionada_por_valido check (gestionada_por in ('contable','gerencia'))
);

comment on column public.sucursales.gestionada_por is
  'Quien lleva los tramites de esta sucursal: San Luis lo maneja contable, San Juan lo maneja gerencia (linea 16 del documento). ES METADATO, NO ES UN PERMISO: ninguna policy de RLS mira la sucursal. Cortar la visibilidad por sucursal seria reconstruir en la base el problema que este proyecto viene a resolver, que es justamente que no hay un listado unificado y por eso se pisan los saldos.';

create table if not exists public.gestoras (
  id        uuid primary key default extensions.gen_random_uuid(),
  nombre    text    not null unique,
  perfil_id uuid    references public.perfiles(id),
  activa    boolean not null default true
);

comment on table public.gestoras is
  'La persona que presenta y paga en el registro. Es una tabla aparte de perfiles a proposito: el historico de la planilla ya nombra gestoras (columna GESTOR: CARLA, MARIANA — imagen 04, filas 6843 y 6857) y hay que poder asignarle un tramite a alguien que todavia no tiene usuario en la plataforma.';

comment on column public.gestoras.perfil_id is
  'El login de esta gestora, si lo tiene. Nullable: la asignacion de un tramite no depende de que exista el usuario.';

create table if not exists public.tarjetas_debito (
  id                      uuid primary key default extensions.gen_random_uuid(),
  tarjeta_habitualista_id uuid    not null references public.tarjetas_habitualista(id),
  gestora_id              uuid    not null references public.gestoras(id),
  alias                   text,
  ultimos4                text,
  activa                  boolean not null default true,
  constraint tarjetas_debito_ultimos4_formato
    check (ultimos4 is null or ultimos4 ~ '^[0-9]{4}$')
);

create unique index if not exists tarjetas_debito_unica
  on public.tarjetas_debito (tarjeta_habitualista_id, gestora_id) where activa;

comment on table public.tarjetas_debito is
  'Cada gestora maneja su propia tarjeta de debito con la que paga en el registro (linea 9). Una Habitualista tiene varias: la imagen 02-habitualista-inicio.png muestra "Tarjeta Habiente: 4" sobre una sola cuenta.';

comment on column public.tarjetas_debito.ultimos4 is
  'Ultimos cuatro digitos, para identificarla en la conciliacion. NUNCA el numero completo: este sistema no necesita poder pagar, solo poder reconocer quien pago.';

-- FK diferida de la migración 01 (perfiles.gestora_id), ahora que gestoras existe
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'perfiles_gestora_fk') then
    alter table public.perfiles add constraint perfiles_gestora_fk
      foreign key (gestora_id) references public.gestoras(id);
  end if;
end $$;

-- ------------------------------------------------------------
-- Semillas — reales, del material fuente
-- ------------------------------------------------------------

insert into public.tarjetas_habitualista (nombre) values
  ('Paris Autos SA'), ('Paris Cars'), ('Paris Motor')
on conflict (nombre) do nothing;

insert into public.razones_sociales (nombre, orden) values
  ('PARIS AUTOS', 10), ('DORAL CHEVROLET', 20), ('PARIS CARS', 30),
  ('PARIS MOTOR', 40), ('PARIS TRAC', 50)
on conflict (nombre) do nothing;

update public.razones_sociales r
   set tarjeta_id = t.id
  from public.tarjetas_habitualista t
 where r.tarjeta_id is null
   and ( (r.nombre = 'PARIS AUTOS' and t.nombre = 'Paris Autos SA')
      or (r.nombre = 'PARIS CARS'  and t.nombre = 'Paris Cars')
      or (r.nombre = 'PARIS MOTOR' and t.nombre = 'Paris Motor') );

insert into public.sucursales (nombre, gestionada_por) values
  ('San Luis', 'contable'), ('San Juan', 'gerencia')
on conflict (nombre) do nothing;

-- ------------------------------------------------------------
-- RLS de catálogos: todos leen, sólo gerencia escribe
--
--    Leen todos porque son los nombres que aparecen en cada selector: una gestora que no
--    puede leer `razones_sociales` ve un desplegable vacío. Escribe gerencia porque tocar
--    una razón social o una tarjeta cambia a dónde va la plata de todos los trámites
--    futuros; no es una tarea de carga diaria.
-- ------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['tarjetas_habitualista','razones_sociales','sucursales','gestoras','tarjetas_debito']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%s_select" on public.%I', t, t);
    execute format('create policy "%s_select" on public.%I for select using (auth.role() = ''authenticated'')', t, t);
    execute format('drop policy if exists "%s_write" on public.%I', t, t);
    execute format('create policy "%s_write" on public.%I for all using (public.es_gerencia()) with check (public.es_gerencia())', t, t);
  end loop;
end $$;

insert into public.schema_migrations (id, nombre)
  values (2, 'migracion-02-catalogos.sql') on conflict (id) do nothing;
```

---

## 3. Migración 03 — Trámites, estados y bloqueo de columnas

```sql
-- ============================================================================
--  GESTORÍA — MIGRACIÓN 03
--  El trámite, su ciclo de nueve estados y quién puede mover cada paso.
-- ============================================================================
--
--  EL CICLO, TEXTUAL DEL DOCUMENTO (líneas 6 a 11):
--
--    recibido de administración -> control de oferta y saldos -> autorizado/firmado por
--    gerencia -> entregado a la gestora -> presupuesto aproximado de la gestora ->
--    presentado en el registro -> pagado -> retirado -> devuelto a administración.
--
--  Hoy ese orden lo garantiza la costumbre y una planilla que va por la fila 6.868
--  (imagen 04-planilla-excel.png, celda activa E6871). Acá lo garantiza un trigger, y no
--  sólo el orden: también QUIÉN puede hacer cada salto. La transición dispara plata (la
--  reserva contra el saldo), así que dejarla librada al front no alcanza — es el mismo
--  argumento de la migración 53 del Tablero: "el trigger no mira el fuente: mira la
--  escritura".
-- ============================================================================

create table if not exists public.tramites (
  id                     uuid primary key default extensions.gen_random_uuid(),

  -- De dónde viene y a quién pertenece
  razon_social_id        uuid not null references public.razones_sociales(id),
  sucursal_id            uuid not null references public.sucursales(id),
  tipo                   text not null,
  subtipo                text,

  -- El asunto del mail
  cliente_nombre         text not null,
  cliente_cuenta         text,
  vehiculo               text,
  oferta_referencia      text,
  asunto_mail            text,
  dominio                text,

  -- Gestión
  estado                 text not null default 'recibido',
  gestora_id             uuid references public.gestoras(id),
  medio_pago             text not null default 'tarjeta_habitualista',

  -- Plata que la gestora SÍ ve
  monto_aproximado       numeric(14,2),
  costo_arancel          numeric(14,2),
  costo_prenda           numeric(14,2),
  costo_sellados         numeric(14,2),
  costo_real             numeric(14,2) generated always as (
    coalesce(costo_arancel,0) + coalesce(costo_prenda,0) + coalesce(costo_sellados,0)
  ) stored,

  -- Rastro del registro y del DMS
  seccional              text,
  numero_pago_registro   text,
  imputado_quiter        boolean not null default false,
  imputado_quiter_at     date,

  -- Fechas hito (las escribe el trigger, no la app)
  recibido_at            timestamptz not null default now(),
  autorizado_at          timestamptz,
  presentado_at          timestamptz,
  pagado_at              timestamptz,
  devuelto_at            timestamptz,

  -- Texto libre
  observaciones          text,
  observaciones_gestora  text,
  motivo_anulacion       text,

  -- Origen y auditoría
  origen                 text not null default 'app',
  datos_planilla         jsonb,
  creado_por             uuid references public.perfiles(id),
  creado_at              timestamptz not null default now(),
  actualizado_por        uuid references public.perfiles(id),
  actualizado_at         timestamptz not null default now(),

  constraint tramites_tipo_valido check (tipo in (
    'patentamiento_0km','transferencia_a_cliente','transferencia_al_concesionario')),
  constraint tramites_subtipo_valido check (
    subtipo is null or subtipo in ('plan_ahorro','credito','contado')),
  constraint tramites_estado_valido check (estado in (
    'recibido','controlado','autorizado','entregado_gestora','presupuestado',
    'presentado','pagado','retirado','devuelto','anulado')),
  constraint tramites_medio_pago_valido check (
    medio_pago in ('tarjeta_habitualista','transferencia','efectivo')),
  constraint tramites_origen_valido check (origen in ('app','planilla','importacion')),
  constraint tramites_importes_no_negativos check (
    coalesce(monto_aproximado,0) >= 0 and coalesce(costo_arancel,0) >= 0
    and coalesce(costo_prenda,0) >= 0 and coalesce(costo_sellados,0) >= 0),
  constraint tramites_anulado_con_motivo check (
    estado <> 'anulado' or nullif(btrim(coalesce(motivo_anulacion,'')), '') is not null),
  constraint tramites_quiter_completo check (
    (imputado_quiter is false) or (imputado_quiter_at is not null))
);

comment on table public.tramites is
  'Un tramite: un patentamiento o una transferencia. REGLA QUE NO SE ROMPE: en esta tabla no va NINGUN importe que la gestora no pueda ver. Lo cobrado al cliente vive en public.tramite_cobros, que es otra fila y por eso otra RLS. Si alguien agrega aca una columna de margen o de ganancia, rompe la unica barrera que protege ese dato.';

comment on column public.tramites.tipo is
  'Los tres tipos de la linea 28: patentamiento 0km, transferencia de usado a cliente, y transferencia del usado que entra en parte de pago AL concesionario. Es text con check y no una tabla de catalogo porque cada uno alimenta un reporte distinto: agregar un cuarto no es cargar una fila, es tocar los reportes igual.';

comment on column public.tramites.subtipo is
  'Modalidad de compra. Existe porque la planilla escribe "PATENTAMIENTO PLAN DE AHORRO- C.74344" como si fuera una categoria propia (imagen 04, filas 6843 y 6852-6855). Se modela como atributo y no como tipo: si resulta ser un tipo propio, es un update de una columna y no una migracion de datos. PREGUNTA ABIERTA sin resolver.';

comment on column public.tramites.cliente_cuenta is
  'La "cuenta personal" que viene en el asunto del mail (linea 6). En la planilla aparece como C.74344, C.103188 (imagen 04).';

comment on column public.tramites.asunto_mail is
  'El asunto del correo COMPLETO, sin parsear. Las cuatro columnas de arriba salen de el. Se guarda el crudo porque el formato no es estable (conviven "REF. 4097473", "ref 4093504" y "REF4064625" en las filas 6850, 6857 y 6862 de la planilla) y sin el original un parseo equivocado no se puede reparar sin volver al Outlook.';

comment on column public.tramites.dominio is
  'La patente. Nullable a proposito: un 0km entra al circuito sin dominio y lo recibe recien en el registro.';

comment on column public.tramites.medio_pago is
  'De donde sale la plata. La planilla ya distingue las dos columnas "$ TRANSF" y "TARJETA" (imagen 04, encabezados E y L). Solo tarjeta_habitualista debita el saldo simulado: una transferencia no pasa por la cuenta corriente de la habitualista y contarla ahi haria que el saldo no cierre nunca contra la imagen 02.';

comment on column public.tramites.monto_aproximado is
  'El presupuesto que manda la gestora al dia siguiente (linea 7) y que "vaya debitando del saldo total" (linea 21). En el cuaderno es el renglon "Dep $" (imagen 01-cuaderno-gestora.png): 1.100.000, 800.000, 670.000. OJO: no es la suma de los tres renglones de arriba (570.000+480.000+40.000 = 1.090.000), es el deposito redondeado hacia arriba. Es este numero el que reserva saldo, no el costo real.';

comment on column public.tramites.costo_real is
  'Columna generada: arancel + prenda + sellados. Generada y no calculada en el front porque el reporte de costos (linea 23) la ordena y la suma, y una suma hecha en tres pantallas distintas termina dando tres numeros distintos.';

comment on column public.tramites.imputado_quiter is
  'Si el tramite ya se imputo en Quiter. Sale de las columnas QUITER de la planilla (imagen 04, encabezados G e I, con su FECHA al lado). Sin esto, el pase de vuelta a administracion no tiene como cerrarse.';

comment on column public.tramites.origen is
  'app | planilla | importacion. El historico de la planilla (6.868 filas) entra con origen=planilla y los triggers de cuenta corriente lo ignoran: si no, generaria miles de movimientos falsos y el saldo quedaria destruido el primer dia.';

comment on column public.tramites.datos_planilla is
  'Las columnas de la planilla vieja que todavia no sabemos que significan (INDICE, por ejemplo). Preserva el dato sin comprometer una interpretacion. Se vacia cuando cada columna encuentra su lugar.';

-- ------------------------------------------------------------
-- Historial de estados
-- ------------------------------------------------------------

create table if not exists public.tramite_eventos (
  id             bigserial primary key,
  tramite_id     uuid not null references public.tramites(id) on delete cascade,
  estado_desde   text,
  estado_hasta   text not null,
  por            uuid references public.perfiles(id),
  rol_al_momento text,
  nota           text,
  at             timestamptz not null default now()
);

comment on table public.tramite_eventos is
  'Quien movio el tramite, cuando y desde donde. Reemplaza a la imagen del cuaderno que hoy llega por WhatsApp (imagen 01): el pedido textual es "Necesitamos llevar ese registro en un formato de listado" (linea 14).';

comment on column public.tramite_eventos.rol_al_momento is
  'El rol que tenia esa persona cuando lo hizo. Sin esto, cambiarle el rol a alguien reescribe la lectura de todo su historial.';

-- ------------------------------------------------------------
-- Índices
-- ------------------------------------------------------------

create index if not exists tramites_abiertos_idx
  on public.tramites (razon_social_id, recibido_at desc)
  where estado not in ('devuelto','anulado');

create index if not exists tramites_gestora_abiertos_idx
  on public.tramites (gestora_id, estado)
  where estado not in ('devuelto','anulado') and gestora_id is not null;

create index if not exists tramites_presentado_idx on public.tramites (presentado_at) where presentado_at is not null;
create index if not exists tramites_pagado_idx     on public.tramites (pagado_at)     where pagado_at is not null;

create index if not exists tramites_dominio_idx on public.tramites (upper(dominio)) where dominio is not null;

create index if not exists tramites_cliente_trgm_idx
  on public.tramites using gin (cliente_nombre extensions.gin_trgm_ops);

-- Un 0km se patenta UNA vez. Este índice existe porque la duplicación es el error más
-- barato de cometer copiando de un mail a una planilla, y hoy no lo atrapa nada.
create unique index if not exists tramites_patentamiento_unico_idx
  on public.tramites (upper(dominio))
  where tipo = 'patentamiento_0km' and estado <> 'anulado' and dominio is not null;

create index if not exists tramites_numero_pago_idx
  on public.tramites (numero_pago_registro) where numero_pago_registro is not null;

create index if not exists tramite_eventos_tramite_idx
  on public.tramite_eventos (tramite_id, at desc);

-- ------------------------------------------------------------
-- actualizado_at
-- ------------------------------------------------------------

create or replace function public.tramites_actualizado_at()
returns trigger language plpgsql as $$
begin
  new.actualizado_at := now();
  new.actualizado_por := auth.uid();
  return new;
end;
$$;

drop trigger if exists a_tramites_actualizado_at on public.tramites;
create trigger a_tramites_actualizado_at
  before update on public.tramites
  for each row execute function public.tramites_actualizado_at();

-- ------------------------------------------------------------
-- Bloqueo de columnas por rol
--
--    LA RLS DE POSTGRES DECIDE FILAS, NO COLUMNAS. Una gestora con permiso de update
--    sobre su propia fila puede, sin este trigger, hacer desde la consola del navegador:
--        update tramites set razon_social_id = '...' where id = '...';
--    y mandarle el gasto a otra razón social.
--
--    La comparación se hace por DIFERENCIA de jsonb en vez de enumerar los campos
--    prohibidos: así una columna que se agregue mañana queda protegida por defecto. La
--    versión enumerada —que es la que usa hoy el Tablero— falla abierta, y en silencio.
--
--    `actualizado_at` y `actualizado_por` van excluidos porque el trigger de arriba los
--    cambia antes que este: los triggers BEFORE corren por orden alfabético de nombre, y
--    por eso el otro se llama `a_tramites_...` y este `b_tramites_...`.
-- ------------------------------------------------------------

create or replace function public.tramites_bloquear_campos_por_rol()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  permitidos text[] := array[
    'monto_aproximado','costo_arancel','costo_prenda','costo_sellados','costo_real',
    'seccional','numero_pago_registro','observaciones_gestora','estado',
    'dominio','presentado_at','pagado_at','actualizado_at','actualizado_por'
  ];
begin
  if auth.uid() is null then return new; end if;            -- consola de la base
  if public.es_gerencia() or public.es_contable() then return new; end if;

  if not public.es_gestora() then
    raise exception 'Tu usuario no tiene permiso para modificar tramites';
  end if;

  if (to_jsonb(new) - permitidos) is distinct from (to_jsonb(old) - permitidos) then
    raise exception 'Una gestora solo puede cargar presupuesto, costos, dominio, seccional, numero de pago y observaciones';
  end if;

  return new;
end;
$$;

drop trigger if exists b_tramites_bloquear_campos on public.tramites;
create trigger b_tramites_bloquear_campos
  before update on public.tramites
  for each row execute function public.tramites_bloquear_campos_por_rol();

-- ------------------------------------------------------------
-- La máquina de estados
-- ------------------------------------------------------------

create or replace function public.orden_estado(p text)
returns int language sql immutable as $$
  select case p
    when 'recibido' then 1 when 'controlado' then 2 when 'autorizado' then 3
    when 'entregado_gestora' then 4 when 'presupuestado' then 5 when 'presentado' then 6
    when 'pagado' then 7 when 'retirado' then 8 when 'devuelto' then 9
    when 'anulado' then 99 end;
$$;

create or replace function public.tramites_validar_transicion()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  rol text := coalesce(public.mi_rol(), 'consola');
  ok  boolean := false;
begin
  if tg_op = 'INSERT' then
    if new.estado <> 'recibido' and new.origen = 'app' then
      raise exception 'Un tramite nuevo entra en estado recibido';
    end if;
    insert into public.tramite_eventos (tramite_id, estado_desde, estado_hasta, por, rol_al_momento)
      values (new.id, null, new.estado, auth.uid(), rol);
    return new;
  end if;

  if new.estado is not distinct from old.estado then return new; end if;
  if rol = 'consola' then return new; end if;   -- importaciones y arreglos desde el SQL Editor

  -- Anular: en cualquier momento, gerencia o contable, con motivo (lo exige el check).
  if new.estado = 'anulado' then
    ok := rol in ('gerencia','contable');

  -- Retroceder: sólo gerencia. Sin esto, un error se arregla desarmando el circuito y
  -- nadie se entera de que el trámite volvió atrás.
  elsif public.orden_estado(new.estado) < public.orden_estado(old.estado) then
    ok := (rol = 'gerencia');

  else
    ok := case old.estado || '>' || new.estado
      when 'recibido>controlado'             then rol in ('contable','gerencia')
      when 'controlado>autorizado'           then rol = 'gerencia'
      when 'autorizado>entregado_gestora'    then rol in ('contable','gerencia')
      when 'entregado_gestora>presupuestado' then rol = 'gestora'
      when 'presupuestado>presentado'        then rol in ('gestora','contable','gerencia')
      when 'presentado>pagado'               then rol in ('gestora','contable','gerencia')
      when 'pagado>retirado'                 then rol in ('gestora','contable','gerencia')
      when 'retirado>devuelto'               then rol in ('contable','gerencia')
      else false
    end;
  end if;

  if not ok then
    raise exception 'No se puede pasar de % a % con el rol %', old.estado, new.estado, rol;
  end if;

  -- Requisitos de contenido de cada paso. Van acá y no en el front porque son la razón de
  -- ser del paso: presentar sin presupuesto es lo que hoy frena un trámite en el registro
  -- por no poder abonarlo (línea 10).
  if new.estado = 'presupuestado' and coalesce(new.monto_aproximado,0) <= 0 then
    raise exception 'Para pasar a presupuestado hace falta el monto aproximado';
  end if;
  if new.estado = 'pagado' and coalesce(new.costo_real,0) <= 0 then
    raise exception 'Para pasar a pagado hace falta el costo real discriminado';
  end if;
  if new.estado = 'presentado' and new.medio_pago = 'tarjeta_habitualista'
     and not exists (select 1 from public.razones_sociales r
                      where r.id = new.razon_social_id and r.tarjeta_id is not null) then
    raise exception 'Esa razon social no tiene Tarjeta Habitualista asignada';
  end if;

  -- Fechas hito
  if new.estado = 'autorizado' then new.autorizado_at := now(); end if;
  if new.estado = 'presentado' then new.presentado_at := coalesce(new.presentado_at, now()); end if;
  if new.estado = 'pagado'     then new.pagado_at     := coalesce(new.pagado_at, now());     end if;
  if new.estado = 'devuelto'   then new.devuelto_at   := now(); end if;

  insert into public.tramite_eventos (tramite_id, estado_desde, estado_hasta, por, rol_al_momento)
    values (new.id, old.estado, new.estado, auth.uid(), rol);

  return new;
end;
$$;

drop trigger if exists c_tramites_validar_transicion on public.tramites;
create trigger c_tramites_validar_transicion
  before insert or update on public.tramites
  for each row execute function public.tramites_validar_transicion();

revoke execute on function public.tramites_actualizado_at()          from public, anon, authenticated;
revoke execute on function public.tramites_bloquear_campos_por_rol() from public, anon, authenticated;
revoke execute on function public.tramites_validar_transicion()      from public, anon, authenticated;

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------

alter table public.tramites enable row level security;

drop policy if exists "tramites_select" on public.tramites;
create policy "tramites_select" on public.tramites for select
  using (
    public.es_gerencia()
    or public.es_contable()
    or (public.es_gestora() and gestora_id = public.mi_gestora_id())
  );

drop policy if exists "tramites_insert" on public.tramites;
create policy "tramites_insert" on public.tramites for insert
  with check (public.es_gerencia() or public.es_contable());

drop policy if exists "tramites_update_oficina" on public.tramites;
create policy "tramites_update_oficina" on public.tramites for update
  using (public.es_gerencia() or public.es_contable())
  with check (public.es_gerencia() or public.es_contable());

drop policy if exists "tramites_update_gestora" on public.tramites;
create policy "tramites_update_gestora" on public.tramites for update
  using (
    public.es_gestora()
    and gestora_id = public.mi_gestora_id()
    and estado in ('entregado_gestora','presupuestado','presentado','pagado','retirado')
  )
  with check (public.es_gestora() and gestora_id = public.mi_gestora_id());

-- Sin policy de delete para nadie. Un tramite se anula, no se borra: el dia que falte uno
-- la pregunta va a ser quien lo borro y no va a haber respuesta.

alter table public.tramite_eventos enable row level security;

drop policy if exists "tramite_eventos_select" on public.tramite_eventos;
create policy "tramite_eventos_select" on public.tramite_eventos for select
  using (exists (select 1 from public.tramites t where t.id = tramite_eventos.tramite_id));
-- Esta subconsulta SI esta permitida: es a OTRA tabla, y por eso hereda la RLS de
-- `tramites` en vez de recursar. Lo prohibido es la subconsulta a perfiles DESDE perfiles.

-- Sin insert: las filas las escribe el trigger, que es SECURITY DEFINER.

insert into public.schema_migrations (id, nombre)
  values (3, 'migracion-03-tramites.sql') on conflict (id) do nothing;
```

---

## 4. Migración 04 — Cuenta corriente

```sql
-- ============================================================================
--  GESTORÍA — MIGRACIÓN 04
--  La cuenta corriente simulada de la Tarjeta Habitualista.
-- ============================================================================
--
--  POR QUÉ UN LIBRO MAYOR Y NO UNA COLUMNA `saldo`
--
--  El problema que dispara el proyecto entero: "muchas veces nos pisamos los saldos
--  disponibles en la tarjeta habitualista por no manejar un solo listado unificado"
--  (línea 16). Un campo `saldo` mutable es exactamente el objeto que se pisa: dos updates
--  concurrentes y gana el último, sin error y sin rastro. Una suma de filas insertadas no
--  se pisa nunca.
--
--  POR QUÉ NADIE PUEDE HACER UPDATE NI DELETE ACÁ
--
--  Un movimiento equivocado se corrige con uno de tipo `ajuste`, con su motivo. Editar el
--  original haría que el saldo de ayer deje de ser reconstruible, y sin eso la conciliación
--  contra el listado real del habitualista (imagen 03) no cierra nunca.
--
--  DOS SALDOS, Y LOS DOS HACEN FALTA
--    - saldo_banco: ingresos + pagos + ajustes. Tiene que dar igual al "Saldo disponible"
--      de la imagen 02 ($ 2.505.627,92).
--    - saldo_disponible: saldo_banco menos las reservas vigentes. Es el prudente, el que
--      hay que mirar antes de mandar a presentar, porque contempla los trámites que ya
--      tienen presupuesto y todavía no se pagaron. La diferencia entre los dos es
--      exactamente lo que hoy no se ve y hace que dos personas comprometan la misma plata.
-- ============================================================================

create table if not exists public.movimientos_tarjeta (
  id          bigserial primary key,
  tarjeta_id  uuid not null references public.tarjetas_habitualista(id),
  fecha       timestamptz not null default now(),
  tipo        text not null,
  importe     numeric(14,2) not null,
  tramite_id  uuid references public.tramites(id),
  gestora_id  uuid references public.gestoras(id),
  concepto    text,
  seccional   text,
  observacion text,
  origen      text not null default 'app',
  creado_por  uuid references public.perfiles(id),
  creado_at   timestamptz not null default now(),

  constraint movimientos_tipo_valido check (tipo in (
    'saldo_inicial','ingreso','reserva','reversa_reserva','ajuste_reserva','pago','ajuste')),
  constraint movimientos_importe_no_cero check (importe <> 0),
  -- El signo lo impone la base y no el front: un ingreso negativo o un pago positivo dan
  -- vuelta el saldo entero y no hay forma de darse cuenta mirando la lista.
  constraint movimientos_signo_coherente check (
    (tipo in ('ingreso','reversa_reserva') and importe > 0)
    or (tipo in ('reserva','pago') and importe < 0)
    or (tipo in ('saldo_inicial','ajuste','ajuste_reserva'))),
  constraint movimientos_reserva_con_tramite check (
    tipo not in ('reserva','reversa_reserva','ajuste_reserva','pago') or tramite_id is not null)
);

comment on table public.movimientos_tarjeta is
  'Libro mayor de la Tarjeta Habitualista. SOLO SE INSERTA: no hay policy de update ni de delete para ningun rol. Un error se compensa con un ajuste, con su motivo escrito.';

comment on column public.movimientos_tarjeta.importe is
  'Con signo: positivo entra, negativo sale. numeric y NUNCA float: en float 0.1+0.2 no da 0.3, y un saldo de siete cifras acumula centavos que despues nadie puede explicar.';

comment on column public.movimientos_tarjeta.tipo is
  'saldo_inicial: la foto del dia que arranca el sistema. ingreso: la carga manual de dinero, que es como se decidio que funcione (no se scrapea el sitio del habitualista). reserva: el debito por el monto aproximado que carga la gestora (linea 21). reversa_reserva + pago: cuando se conoce el costo real, se devuelve la reserva entera y se descuenta lo que de verdad se pago. ajuste: correccion con motivo.';

comment on column public.movimientos_tarjeta.origen is
  'app | tramite | conciliacion. Dice que filas escribio un trigger y cuales una persona, que es la primera pregunta cuando un saldo no cierra.';

-- ------------------------------------------------------------
-- Índices
-- ------------------------------------------------------------

-- El extracto: una tarjeta, lo más nuevo arriba. Es la pantalla que copia la imagen 03.
-- `id desc` como desempate: dos movimientos del mismo segundo tienen que salir siempre en
-- el mismo orden, o el listado "salta" al recargar.
create index if not exists movimientos_extracto_idx
  on public.movimientos_tarjeta (tarjeta_id, fecha desc, id desc);

create index if not exists movimientos_tramite_idx
  on public.movimientos_tarjeta (tramite_id) where tramite_id is not null;

-- Una sola reserva viva por trámite. Sin esto, dos guardadas seguidas del presupuesto
-- reservan dos veces y el saldo disponible miente hacia abajo, que es la mentira que hace
-- frenar un trámite sin motivo.
create unique index if not exists movimientos_una_reserva_por_tramite
  on public.movimientos_tarjeta (tramite_id) where tipo = 'reserva';

-- ------------------------------------------------------------
-- Sincronización automática desde el trámite
--
--    ACÁ ESTÁ LA PARTE FINA DEL MODELO DE PERMISOS. El documento dice que sólo gerencia y
--    contable modifican saldos (línea 27) Y que el monto aproximado de la gestora debita
--    del saldo (línea 21). Las dos cosas a la vez sólo cierran de una manera: la gestora
--    NO tiene insert sobre `movimientos_tarjeta`, ni uno. El débito lo escribe este
--    trigger, que es SECURITY DEFINER y por lo tanto corre como el dueño de la tabla.
--
--    CONSECUENCIA QUE HAY QUE SABER: no correr nunca
--        alter table public.movimientos_tarjeta force row level security;
--    El dueño de una tabla está exento de RLS salvo que se active FORCE. Con FORCE, este
--    trigger deja de poder insertar, y el síntoma es el peor posible: la gestora carga el
--    presupuesto, la pantalla dice que guardó, y el saldo no se mueve.
-- ------------------------------------------------------------

create or replace function public.tarjeta_de_razon_social(p_razon uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select tarjeta_id from public.razones_sociales where id = p_razon;
$$;

create or replace function public.tramites_sincronizar_cuenta_corriente()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_tarjeta   uuid;
  v_reservado numeric(14,2);
begin
  -- El histórico de la planilla no genera movimientos: son 6.868 filas ya pagadas y
  -- cerradas, y meterlas al libro mayor destruiría el saldo el primer día.
  if new.origen <> 'app' then return new; end if;
  if new.medio_pago <> 'tarjeta_habitualista' then return new; end if;

  v_tarjeta := public.tarjeta_de_razon_social(new.razon_social_id);
  if v_tarjeta is null then return new; end if;

  -- 1) Primera carga del presupuesto -> reserva
  if coalesce(old.monto_aproximado, 0) = 0 and coalesce(new.monto_aproximado, 0) > 0 then
    insert into public.movimientos_tarjeta
      (tarjeta_id, tipo, importe, tramite_id, gestora_id, concepto, origen, creado_por)
    values
      (v_tarjeta, 'reserva', -new.monto_aproximado, new.id, new.gestora_id,
       'Presupuesto aproximado - ' || new.cliente_nombre, 'tramite', auth.uid());

  -- 2) Corrección del presupuesto -> ajuste por la diferencia; la reserva original queda
  elsif coalesce(old.monto_aproximado,0) > 0
        and coalesce(new.monto_aproximado,0) > 0
        and new.monto_aproximado is distinct from old.monto_aproximado
        and new.estado <> 'pagado' then
    insert into public.movimientos_tarjeta
      (tarjeta_id, tipo, importe, tramite_id, gestora_id, concepto, origen, creado_por)
    values
      (v_tarjeta, 'ajuste_reserva', -(new.monto_aproximado - old.monto_aproximado),
       new.id, new.gestora_id, 'Correccion del presupuesto', 'tramite', auth.uid());
  end if;

  -- 3) Pago -> se devuelve TODO lo reservado y se descuenta el costo real
  if new.estado = 'pagado' and old.estado is distinct from 'pagado' then
    select coalesce(sum(-importe), 0) into v_reservado
      from public.movimientos_tarjeta
     where tramite_id = new.id and tipo in ('reserva','ajuste_reserva');

    if v_reservado <> 0 then
      insert into public.movimientos_tarjeta
        (tarjeta_id, tipo, importe, tramite_id, gestora_id, concepto, origen, creado_por)
      values (v_tarjeta, 'reversa_reserva', v_reservado, new.id, new.gestora_id,
              'Libera la reserva', 'tramite', auth.uid());
    end if;

    insert into public.movimientos_tarjeta
      (tarjeta_id, tipo, importe, tramite_id, gestora_id, concepto, seccional, observacion, origen, creado_por)
    values (v_tarjeta, 'pago', -new.costo_real, new.id, new.gestora_id,
            'Pago en registro - ' || new.cliente_nombre, new.seccional,
            new.numero_pago_registro, 'tramite', auth.uid());
  end if;

  -- 4) Anulación -> se libera lo que quede comprometido
  if new.estado = 'anulado' and old.estado is distinct from 'anulado' then
    select coalesce(sum(-importe), 0) into v_reservado
      from public.movimientos_tarjeta
     where tramite_id = new.id
       and tipo in ('reserva','ajuste_reserva','reversa_reserva','pago');
    if v_reservado > 0 then
      insert into public.movimientos_tarjeta
        (tarjeta_id, tipo, importe, tramite_id, concepto, origen, creado_por)
      values (v_tarjeta, 'reversa_reserva', v_reservado, new.id,
              'Tramite anulado: libera lo reservado', 'tramite', auth.uid());
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists z_tramites_cuenta_corriente on public.tramites;
create trigger z_tramites_cuenta_corriente
  after update on public.tramites
  for each row execute function public.tramites_sincronizar_cuenta_corriente();

revoke execute on function public.tramites_sincronizar_cuenta_corriente() from public, anon, authenticated;

-- ------------------------------------------------------------
-- Vista de saldos
--
--    `security_invoker = true` NO ES OPCIONAL. Una vista corre con los permisos de su
--    dueño, y creada desde el SQL Editor la dueña es `postgres`, que saltea RLS. Sin el
--    flag, esta vista le mostraría a cualquier gestora el saldo de todas las razones
--    sociales.
-- ------------------------------------------------------------

create or replace view public.v_saldos_tarjeta
with (security_invoker = true) as
select
  t.id     as tarjeta_id,
  t.nombre,
  coalesce(sum(m.importe) filter (
    where m.tipo in ('saldo_inicial','ingreso','pago','ajuste')), 0)      as saldo_banco,
  coalesce(sum(-m.importe) filter (where m.tipo in ('reserva','ajuste_reserva')), 0)
    - coalesce(sum(m.importe) filter (where m.tipo = 'reversa_reserva'), 0) as reservado,
  coalesce(sum(m.importe), 0)                                             as saldo_disponible,
  max(m.fecha)                                                            as ultimo_movimiento
from public.tarjetas_habitualista t
left join public.movimientos_tarjeta m on m.tarjeta_id = t.id
group by t.id, t.nombre;

comment on view public.v_saldos_tarjeta is
  'saldo_banco: comparable con el "Saldo disponible" del sitio del habitualista (imagen 02). saldo_disponible: el prudente, ya descontadas las reservas de los tramites presupuestados y no pagados. La diferencia entre los dos es lo que hoy no se ve y hace que dos personas comprometan la misma plata.';

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------

alter table public.movimientos_tarjeta enable row level security;

drop policy if exists "movimientos_select" on public.movimientos_tarjeta;
create policy "movimientos_select" on public.movimientos_tarjeta for select
  using (
    public.es_gerencia()
    or public.es_contable()
    or (public.es_gestora() and public.opero_esta_tarjeta(tarjeta_id))
  );

-- Solo gerencia y contable cargan plata a mano (linea 27). La gestora no tiene insert: su
-- debito lo escribe el trigger de arriba, que corre como dueño de la tabla.
drop policy if exists "movimientos_insert" on public.movimientos_tarjeta;
create policy "movimientos_insert" on public.movimientos_tarjeta for insert
  with check (
    (public.es_gerencia() or public.es_contable())
    and tipo in ('saldo_inicial','ingreso','ajuste')
  );

-- Sin update. Sin delete. Para nadie.

insert into public.schema_migrations (id, nombre)
  values (4, 'migracion-04-cuenta-corriente.sql') on conflict (id) do nothing;
```

---

## 5. Migración 05 — Lo cobrado al cliente (la respuesta al punto 5 del pedido)

```sql
-- ============================================================================
--  GESTORÍA — MIGRACIÓN 05
--  El monto cobrado al cliente, escondido de las gestoras A NIVEL BASE.
-- ============================================================================
--
--  EL PEDIDO, textual: "Sumar en otro espacio el monto cobrado al cliente, para luego poder
--  sacar más rápido un informe de los costos de los tramites" (línea 23) y "Quizá limitaría
--  la visibilidad de lo cobrado al cliente para las gestoras. Que sea una información a la
--  que solo acceda gerencia y administración contable" (línea 26).
--
--  POR QUÉ NO ES UNA COLUMNA EN `tramites`, Y ES EL PUNTO MÁS IMPORTANTE DE TODO EL ESQUEMA
--
--  La RLS de Postgres filtra FILAS. Si `monto_cobrado` vive en la misma fila que la gestora
--  sí puede leer, no hay policy que la esconda: un `select *` la trae, y PostgREST hace
--  `select *` por defecto.
--
--  Lo que sí filtra columnas son los GRANT por columna. Y no sirven acá, por una razón
--  estructural de Supabase: TODOS los usuarios logueados son el MISMO rol de Postgres,
--  `authenticated`. El rol no es por persona. Entonces
--      grant select (monto_cobrado) on tramites to authenticated
--  se lo da a la gestora y a gerencia al mismo tiempo, y revocarlo se lo saca a los dos.
--  El mecanismo que parece resolverlo es incapaz de distinguir a quién se lo esconde.
--
--  Se puede forzar: crear roles Postgres gerencia/contable/gestora, otorgarlos a
--  `authenticator` y emitir el claim `role` desde un Custom Access Token Hook. Se descarta.
--  Duplica la matriz de permisos en dos lugares que se desincronizan (RLS por un lado,
--  grants por otro) y un claim mal emitido no rompe una pantalla: deja la API entera caída
--  para todos.
--
--  Segunda alternativa descartada: dejar la columna en `tramites`, revocarle select a
--  `authenticated` sobre la tabla y exponer sólo vistas. Rompe todo `insert` y `update` con
--  `Prefer: return=representation`, que es lo que manda el cliente de Supabase por defecto,
--  y deja la tabla como una mina esperando el primer grant distraído.
--
--  LA SOLUCIÓN: otra tabla, 1 a 1, con su propia RLS. La fila entera es inalcanzable para
--  una gestora. No hay `select *` que la traiga porque el dato no está en su fila. Y para
--  que la app no tenga que hacer dos consultas ni ramificar por rol, la vista `v_tramites`
--  hace LEFT JOIN con `security_invoker`: gerencia ve el número, la gestora ve null, misma
--  consulta, mismas filas.
-- ============================================================================

create table if not exists public.tramite_cobros (
  tramite_id      uuid primary key references public.tramites(id) on delete cascade,
  monto_cobrado   numeric(14,2) not null,
  fecha_cobro     date,
  comprobante     text,
  notas           text,
  creado_por      uuid references public.perfiles(id),
  creado_at       timestamptz not null default now(),
  actualizado_por uuid references public.perfiles(id),
  actualizado_at  timestamptz not null default now(),
  constraint tramite_cobros_monto_positivo check (monto_cobrado >= 0)
);

comment on table public.tramite_cobros is
  'Lo que se le cobro al cliente por el tramite. VIVE EN UNA TABLA APARTE Y NO EN tramites POR UN MOTIVO DE SEGURIDAD, NO DE ORDEN: la RLS de Postgres filtra filas, no columnas, y en Supabase todos los usuarios logueados comparten el rol authenticated, asi que un grant por columna no puede distinguir a una gestora de gerencia. La unica barrera real es que la fila entera sea inalcanzable. Si alguien mueve esta columna a tramites, la restriccion de la linea 26 del documento deja de existir.';

comment on column public.tramite_cobros.monto_cobrado is
  'Lo cobrado al cliente. Con el costo_real del tramite sale el informe de costos de la linea 23. El margen NO se guarda: se calcula al leer, dentro de la vista que ya esta protegida. Una columna de margen en tramites seria la misma fuga por la puerta de al lado.';

create index if not exists tramite_cobros_fecha_idx
  on public.tramite_cobros (fecha_cobro) where fecha_cobro is not null;

create or replace function public.tramite_cobros_actualizado_at()
returns trigger language plpgsql as $$
begin
  new.actualizado_at := now();
  new.actualizado_por := auth.uid();
  return new;
end;
$$;

drop trigger if exists tramite_cobros_actualizado_at on public.tramite_cobros;
create trigger tramite_cobros_actualizado_at
  before update on public.tramite_cobros
  for each row execute function public.tramite_cobros_actualizado_at();

revoke execute on function public.tramite_cobros_actualizado_at() from public, anon, authenticated;

-- ------------------------------------------------------------
-- RLS: una sola condición, y es un helper
-- ------------------------------------------------------------

alter table public.tramite_cobros enable row level security;

drop policy if exists "cobros_select" on public.tramite_cobros;
create policy "cobros_select" on public.tramite_cobros for select
  using (public.puede_ver_cobros());

drop policy if exists "cobros_insert" on public.tramite_cobros;
create policy "cobros_insert" on public.tramite_cobros for insert
  with check (public.puede_ver_cobros());

drop policy if exists "cobros_update" on public.tramite_cobros;
create policy "cobros_update" on public.tramite_cobros for update
  using (public.puede_ver_cobros()) with check (public.puede_ver_cobros());

-- Sin delete: un cobro mal cargado se corrige, no se borra.

revoke all on public.tramite_cobros from anon;
grant select, insert, update on public.tramite_cobros to authenticated;

-- ------------------------------------------------------------
-- La vista que junta las dos cosas sin ramificar por rol
-- ------------------------------------------------------------

create or replace view public.v_tramites
with (security_invoker = true) as
select
  t.*,
  r.nombre as razon_social,
  s.nombre as sucursal,
  g.nombre as gestora,
  c.monto_cobrado,
  c.fecha_cobro,
  case when c.monto_cobrado is not null then c.monto_cobrado - t.costo_real end as margen
from public.tramites t
join public.razones_sociales r on r.id = t.razon_social_id
join public.sucursales       s on s.id = t.sucursal_id
left join public.gestoras    g on g.id = t.gestora_id
left join public.tramite_cobros c on c.tramite_id = t.id;

comment on view public.v_tramites is
  'La lista que consume toda la app. El LEFT JOIN con tramite_cobros mas security_invoker hace que la gestora reciba las MISMAS filas con monto_cobrado y margen en null, sin error y sin que la app tenga que preguntar el rol antes de consultar. Si esta vista se recrea sin security_invoker, corre como postgres, saltea la RLS y le entrega a la gestora todo lo cobrado a todos los clientes.';

insert into public.schema_migrations (id, nombre)
  values (5, 'migracion-05-cobros.sql') on conflict (id) do nothing;

-- ============================================================================
--  CÓMO COMPROBAR QUE DE VERDAD ESTÁ ESCONDIDO
--
--  1) Vistas de public SIN el flag — tiene que devolver CERO filas:
--       select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
--        where n.nspname='public' and c.relkind='v'
--          and coalesce(array_to_string(c.reloptions,','),'') not like '%security_invoker=true%';
--
--  2) La prueba que vale, logueado en la app CON UN USUARIO GESTORA, en la consola:
--       await supabase.from('tramite_cobros').select('*')                  // -> data: []
--       await supabase.from('v_tramites').select('monto_cobrado').limit(1) // -> null
--     Las dos cosas: la tabla vacía y el null en la vista. Una sola no alcanza.
--
--  3) Y con un usuario de gerencia, las mismas dos consultas tienen que traer el número.
--     Una barrera que también bloquea a quien debe pasar es un error, no una protección.
-- ============================================================================
```

---

## 6. Migración 06 — Conciliación

```sql
-- ============================================================================
--  GESTORÍA — MIGRACIÓN 06
--  Pegar el listado real de Operaciones de Pago y marcar las diferencias.
--  Las columnas salen tal cual de la imagen 03-habitualista-operaciones.png:
--  Numero de pago, Habitualista, Canal, Fecha, Importe, Seccional RPA, Motivo
--  Pago, Observacion. No se scrapea el sitio: se pega el listado y se compara.
-- ============================================================================

create table if not exists public.operaciones_habitualista (
  id                  bigserial primary key,
  tarjeta_id          uuid not null references public.tarjetas_habitualista(id),
  numero_pago         text not null,
  habitualista        text,
  canal               text,
  fecha               timestamptz not null,
  importe             numeric(14,2) not null,
  seccional           text,
  motivo_pago         text,
  observacion         text,
  movimiento_id       bigint references public.movimientos_tarjeta(id),
  estado_conciliacion text not null default 'sin_conciliar',
  justificacion       text,
  importado_por       uuid references public.perfiles(id),
  importado_at        timestamptz not null default now(),

  constraint operaciones_estado_valido check (estado_conciliacion in (
    'sin_conciliar','conciliado','solo_en_banco','solo_en_sistema','diferencia_importe','justificada')),
  constraint operaciones_justificada_con_motivo check (
    estado_conciliacion <> 'justificada'
    or nullif(btrim(coalesce(justificacion,'')),'') is not null)
);

comment on table public.operaciones_habitualista is
  'El listado de Operaciones de Pago del sitio del habitualista, pegado a mano. Es la fuente externa contra la que se controla el libro mayor propio. No lo modifica el sistema: se importa y se concilia.';

comment on column public.operaciones_habitualista.numero_pago is
  'El "Numero de pago" del sitio (0001420388, 0001420382... imagen 03). Es lo que hace idempotente la importacion: pegar dos veces el mismo listado no duplica una sola fila.';

comment on column public.operaciones_habitualista.motivo_pago is
  'Lo que la gestora escribio al pagar. En la imagen 03 es a veces el dominio (AF725SQ, KJL164), a veces el apellido (dominguez, ochoa) y a veces las dos cosas (CASTRO AA301GU). Por eso el emparejamiento automatico prueba las tres formas y lo que no cierra queda para revisar a mano.';

comment on column public.operaciones_habitualista.estado_conciliacion is
  'solo_en_banco: se pago algo que no esta cargado como tramite. solo_en_sistema: hay un pago nuestro que el banco no muestra. diferencia_importe: estan los dos y no coinciden. justificada: alguien la reviso y explico por que esta bien asi. El estado justificada existe para que el tablero se pueda dejar en cero; un tablero que siempre esta en rojo es un tablero apagado.';

-- Idempotencia de la importación: el par tarjeta + número de pago es único en el banco.
create unique index if not exists operaciones_numero_uniq
  on public.operaciones_habitualista (tarjeta_id, numero_pago);

-- Un movimiento propio se concilia contra una sola operación del banco.
create unique index if not exists operaciones_movimiento_uniq
  on public.operaciones_habitualista (movimiento_id) where movimiento_id is not null;

-- El tablero mira sólo lo que no cerró: buscar el puñado que está mal entre miles que están bien.
create index if not exists operaciones_pendientes_idx
  on public.operaciones_habitualista (tarjeta_id, fecha desc)
  where estado_conciliacion not in ('conciliado','justificada');

alter table public.operaciones_habitualista enable row level security;

drop policy if exists "operaciones_select" on public.operaciones_habitualista;
create policy "operaciones_select" on public.operaciones_habitualista for select
  using (
    public.es_gerencia() or public.es_contable()
    or (public.es_gestora() and public.opero_esta_tarjeta(tarjeta_id))
  );

drop policy if exists "operaciones_write" on public.operaciones_habitualista;
create policy "operaciones_write" on public.operaciones_habitualista for all
  using (public.es_gerencia() or public.es_contable())
  with check (public.es_gerencia() or public.es_contable());

insert into public.schema_migrations (id, nombre)
  values (6, 'migracion-06-conciliacion.sql') on conflict (id) do nothing;
```

---

## 7. Migración 07 — Objetivos y reportes

```sql
-- ============================================================================
--  GESTORÍA — MIGRACIÓN 07
--  Objetivos de patentamiento y las vistas de cierre de mes (líneas 30 y 31).
-- ============================================================================

create table if not exists public.objetivos_mensuales (
  id                      uuid primary key default extensions.gen_random_uuid(),
  razon_social_id         uuid not null references public.razones_sociales(id),
  periodo                 date not null,
  tipo                    text not null,
  cantidad_objetivo       int  not null,
  costo_unitario_estimado numeric(14,2),
  creado_por              uuid references public.perfiles(id),
  creado_at               timestamptz not null default now(),
  constraint objetivos_tipo_valido check (tipo in (
    'patentamiento_0km','transferencia_a_cliente','transferencia_al_concesionario')),
  constraint objetivos_periodo_dia_uno check (extract(day from periodo) = 1),
  constraint objetivos_cantidad_positiva check (cantidad_objetivo > 0)
);

create unique index if not exists objetivos_uniq
  on public.objetivos_mensuales (razon_social_id, periodo, tipo);

comment on column public.objetivos_mensuales.periodo is
  'Siempre el dia 1 del mes, y lo exige un check. Sin eso, dos filas del mismo mes con dias distintos se cuentan como dos periodos y el indice unico no sirve de nada.';

comment on column public.objetivos_mensuales.costo_unitario_estimado is
  'Cuanto cuesta en promedio ese tramite. Es la mitad del informe de saldos proyectados de la linea 30: objetivo por costo estimado es la plata que hay que tener disponible en la habitualista este mes.';

create or replace view public.v_cierre_mensual
with (security_invoker = true) as
select
  date_trunc('month', coalesce(t.pagado_at, t.presentado_at, t.recibido_at))::date as periodo,
  r.nombre as razon_social,
  s.nombre as sucursal,
  t.tipo,
  count(*)              as cantidad,
  sum(t.costo_real)     as costo_total,
  avg(t.costo_real)     as costo_promedio,
  sum(t.costo_arancel)  as arancel,
  sum(t.costo_prenda)   as prenda,
  sum(t.costo_sellados) as sellados
from public.tramites t
join public.razones_sociales r on r.id = t.razon_social_id
join public.sucursales       s on s.id = t.sucursal_id
where t.estado <> 'anulado'
group by 1,2,3,4;

comment on view public.v_cierre_mensual is
  'Reporte de patentamientos y transferencias a cierre de mes (linea 31). NO incluye lo cobrado al cliente: si lo incluyera seria una fuga, porque las gestoras leen esta vista. El informe de rentabilidad es otra vista y esa si toca tramite_cobros. Tampoco agrupa por gestora: las metricas describen procesos, no personas.';

create or replace view public.v_saldo_proyectado
with (security_invoker = true) as
select
  o.periodo,
  r.nombre  as razon_social,
  th.nombre as tarjeta,
  sum(o.cantidad_objetivo * coalesce(o.costo_unitario_estimado, 0)) as costo_proyectado,
  max(v.saldo_disponible)                                           as saldo_disponible_hoy,
  max(v.saldo_disponible)
    - sum(o.cantidad_objetivo * coalesce(o.costo_unitario_estimado, 0)) as brecha
from public.objetivos_mensuales o
join public.razones_sociales r on r.id = o.razon_social_id
left join public.tarjetas_habitualista th on th.id = r.tarjeta_id
left join public.v_saldos_tarjeta v on v.tarjeta_id = r.tarjeta_id
group by o.periodo, r.nombre, th.nombre;

comment on view public.v_saldo_proyectado is
  'Informe de saldos proyectados de la linea 30. La columna brecha es la unica que importa: negativa significa que con el saldo de hoy no se llega al objetivo del mes, que es la conversacion que hoy no se puede tener con numeros.';

alter table public.objetivos_mensuales enable row level security;

drop policy if exists "objetivos_select" on public.objetivos_mensuales;
create policy "objetivos_select" on public.objetivos_mensuales for select
  using (public.es_gerencia() or public.es_contable());

drop policy if exists "objetivos_write" on public.objetivos_mensuales;
create policy "objetivos_write" on public.objetivos_mensuales for all
  using (public.es_gerencia()) with check (public.es_gerencia());

insert into public.schema_migrations (id, nombre)
  values (7, 'migracion-07-objetivos-y-reportes.sql') on conflict (id) do nothing;
```

---

## 8. Migración 08 — Endurecimiento

```sql
-- ============================================================================
--  GESTORÍA — MIGRACIÓN 08
--  Cerrar lo que quedó abierto por defecto. Se corre ÚLTIMA y se vuelve a correr
--  después de cada migración que agregue tablas o vistas.
-- ============================================================================
--
--  POR QUÉ HACE FALTA UN ARCHIVO SÓLO PARA ESTO
--
--  Supabase tiene `alter default privileges` que le otorga permisos a `anon` y a
--  `authenticated` sobre CADA TABLA NUEVA del esquema public. El default de la plataforma
--  es abrir, y RLS es lo único que después cierra. Una tabla a la que alguien se olvide de
--  activarle RLS queda legible desde internet sin loguearse.
-- ============================================================================

do $$
declare t text;
begin
  foreach t in array array[
    'perfiles','razones_sociales','sucursales','tarjetas_habitualista','gestoras',
    'tarjetas_debito','tramites','tramite_eventos','movimientos_tarjeta',
    'tramite_cobros','operaciones_habitualista','objetivos_mensuales','schema_migrations'
  ] loop
    execute format('revoke all on public.%I from anon', t);
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

grant select                         on public.schema_migrations        to authenticated;
grant select, insert, update, delete on public.razones_sociales         to authenticated;
grant select, insert, update, delete on public.sucursales               to authenticated;
grant select, insert, update, delete on public.tarjetas_habitualista    to authenticated;
grant select, insert, update, delete on public.gestoras                 to authenticated;
grant select, insert, update, delete on public.tarjetas_debito          to authenticated;
grant select, update                 on public.perfiles                 to authenticated;
grant select, insert, update         on public.tramites                 to authenticated;
grant select                         on public.tramite_eventos          to authenticated;
grant select, insert                 on public.movimientos_tarjeta      to authenticated;
grant select, insert, update         on public.tramite_cobros           to authenticated;
grant select, insert, update, delete on public.operaciones_habitualista to authenticated;
grant select, insert, update, delete on public.objetivos_mensuales      to authenticated;

-- Los delete de catálogos los deja pasar el GRANT y los frena la POLICY (sólo gerencia).
-- Son dos cosas distintas: el grant es el permiso de la tabla, la policy es quién. Sin el
-- grant, la policy no llega a evaluarse nunca y el error que ve el usuario es "permission
-- denied for table", que no explica nada y no se puede traducir a un mensaje útil.

grant select on public.v_tramites         to authenticated;
grant select on public.v_saldos_tarjeta   to authenticated;
grant select on public.v_cierre_mensual   to authenticated;
grant select on public.v_saldo_proyectado to authenticated;

-- ------------------------------------------------------------
-- Realtime: `tramite_cobros` NO entra. Nunca.
--
--    Realtime aplica RLS por suscriptor, pero el margen de error es de configuración y el
--    dato es justo el que el documento pide esconder. Lo que no se publica no se puede
--    filtrar por ahí.
-- ------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables
                    where pubname='supabase_realtime' and tablename='tramites') then
      alter publication supabase_realtime add table public.tramites;
    end if;
    if not exists (select 1 from pg_publication_tables
                    where pubname='supabase_realtime' and tablename='movimientos_tarjeta') then
      alter publication supabase_realtime add table public.movimientos_tarjeta;
    end if;
  end if;
end $$;

insert into public.schema_migrations (id, nombre)
  values (8, 'migracion-08-endurecimiento.sql') on conflict (id) do nothing;

-- ============================================================================
--  LAS CUATRO COMPROBACIONES DESPUÉS DE CADA MIGRACIÓN
--
--  1) Tablas de public sin RLS — cero filas:
--       select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
--        where n.nspname='public' and c.relkind='r' and not c.relrowsecurity;
--
--  2) Vistas sin security_invoker — cero filas:
--       select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
--        where n.nspname='public' and c.relkind='v'
--          and coalesce(array_to_string(c.reloptions,','),'') not like '%security_invoker=true%';
--
--  3) Qué puede tocar `anon` — cero filas:
--       select table_name, privilege_type from information_schema.role_table_grants
--        where grantee='anon' and table_schema='public';
--
--  4) Advisors de Supabase. No se pueden ver desde el repositorio: describen el estado de
--     la base viva. En el Tablero, la primera vez que se miraron encontraron dos cosas que
--     nueve revisiones de código no podían encontrar.
-- ============================================================================
```

---

## 9. Matriz exacta: rol × tabla × operación

S = select, I = insert, U = update, D = delete. Vacío es que la policy lo niega.

| Tabla | gerencia | contable | gestora | sin_asignar / inactivo | anon |
|---|---|---|---|---|---|
| `perfiles` | S U (todos) | S (todos), U propio | S propio, U propio | — | — |
| `razones_sociales` | S I U D | S | S | — | — |
| `sucursales` | S I U D | S | S | — | — |
| `tarjetas_habitualista` | S I U D | S | S | — | — |
| `gestoras` | S I U D | S | S | — | — |
| `tarjetas_debito` | S I U D | S | S | — | — |
| `tramites` | S I U | S I U | S sólo `gestora_id = mi_gestora_id()`; U sólo las suyas, sólo en estados de gestión, y sólo las columnas que deja el trigger | — | — |
| `tramite_eventos` | S | S | S (los de sus trámites, heredado de `tramites`) | — | — |
| `movimientos_tarjeta` | S, I (`saldo_inicial`/`ingreso`/`ajuste`) | S, I (idem) | S sólo tarjetas donde tiene débito. **Sin I** | — | — |
| **`tramite_cobros`** | **S I U** | **S I U** | **nada, ni select** | — | — |
| `operaciones_habitualista` | S I U D | S I U D | S sólo sus tarjetas | — | — |
| `objetivos_mensuales` | S I U D | S | — | — | — |
| `schema_migrations` | S | S | S | S | — |
| `v_tramites` | S con `monto_cobrado` y `margen` | idem | S con `monto_cobrado` y `margen` en **null** | — | — |
| `v_saldos_tarjeta` | S todas | S todas | S sólo sus tarjetas | — | — |
| `v_cierre_mensual` | S | S | S (sus trámites) | — | — |
| `v_saldo_proyectado` | S | S | — | — | — |

**Ningún rol tiene DELETE** sobre `tramites`, `tramite_eventos`, `movimientos_tarjeta` ni `tramite_cobros`.

Tres reglas que no se leen en la tabla y son parte de la matriz:

1. **La gestora nunca inserta un movimiento.** Su débito lo escribe `tramites_sincronizar_cuenta_corriente()`, que es SECURITY DEFINER. Así conviven la línea 21 ("que vaya debitando del saldo") y la 27 ("sólo gerencia/contable modifican saldos") sin contradecirse.
2. **Las columnas que la gestora puede escribir en `tramites` las decide un trigger, no la RLS.** La RLS no sabe de columnas.
3. **`sin_asignar`, y cualquier perfil con `activo = false`, no ven una sola fila.** Los siete helpers exigen `activo`, y sin helper en verdadero ninguna policy pasa. Es el default seguro: un usuario nuevo no ve nada hasta que gerencia lo habilita.

---

## 10. Índices, uno por uno, y por qué

| Índice | Para qué | Por qué así |
|---|---|---|
| `perfiles_email_uniq` sobre `lower(email)` | Que no haya dos perfiles del mismo mail | Sobre la función y no sobre la columna: `Carla@` y `carla@` son la misma persona |
| `tramites_abiertos_idx (razon_social_id, recibido_at desc)` parcial | La pantalla principal | Parcial sobre lo no terminado: en un año el 95% de las filas van a estar en `devuelto` y nadie las mira a diario. Indexarlas es pagar en cada escritura por filas que no se consultan — mismo criterio que el índice parcial de la migración 54 del Tablero |
| `tramites_gestora_abiertos_idx (gestora_id, estado)` parcial | La pantalla de la gestora | Es la consulta que más se hace, desde el teléfono, en el registro, con mala señal |
| `tramites_presentado_idx`, `tramites_pagado_idx` parciales | Cierre de mes (líneas 30 y 31) | Parciales sobre `not null`: sólo las filas que llegaron al hito |
| `tramites_dominio_idx` sobre `upper(dominio)` | Buscar por patente | Es la búsqueda número uno porque el dominio es lo que está escrito en el papel que se tiene en la mano. `upper()` porque en la planilla conviven mayúsculas y minúsculas |
| `tramites_cliente_trgm_idx` GIN de trigramas | Buscar por nombre con errores de tipeo | El nombre se copia a mano de un asunto de mail. La planilla tiene "MUÑOZ ELIZABETH" (imagen 04, fila 6843) y va a haber un "MUNOZ". Un B-tree sólo sirve para prefijos exactos |
| `tramites_patentamiento_unico_idx` único parcial | Un 0km se patenta una sola vez | Duplicar es el error más barato de cometer copiando de un mail a una planilla de 6.868 filas, y hoy no lo atrapa nada. Excluye los anulados, que es la puerta de salida |
| `tramites_numero_pago_idx` parcial | Conciliar contra el listado del banco | Emparejar por el "Numero de pago" de la imagen 03 |
| `tramite_eventos_tramite_idx (tramite_id, at desc)` | La línea de tiempo del trámite | Reemplaza a la foto del cuaderno; se abre en cada detalle |
| `movimientos_extracto_idx (tarjeta_id, fecha desc, id desc)` | El extracto | `id desc` como desempate: dos movimientos del mismo segundo tienen que salir siempre en el mismo orden, o el listado "salta" al recargar |
| `movimientos_tramite_idx` parcial | Del trámite a su plata | Lo usa la pantalla de detalle y lo usa el trigger de reversa, que corre en cada pago |
| `movimientos_una_reserva_por_tramite` único parcial | Una sola reserva viva | Dos guardadas seguidas del presupuesto reservarían dos veces y el saldo disponible mentiría hacia abajo, que es la mentira que hace frenar un trámite sin motivo |
| `tarjetas_debito_unica` único parcial | Una tarjeta por gestora y habitualista | Parcial sobre `activa`: una tarjeta dada de baja y su reemplazo pueden coexistir |
| `operaciones_numero_uniq (tarjeta_id, numero_pago)` | Importación idempotente | Pegar dos veces el mismo listado no duplica nada. Es la única razón por la que la importación se puede repetir sin miedo |
| `operaciones_movimiento_uniq` único parcial | Emparejamiento 1 a 1 | Impide conciliar el mismo movimiento propio contra dos operaciones del banco |
| `operaciones_pendientes_idx` parcial | El tablero de conciliación | Busca el puñado que no cerró dentro de miles que sí |
| `objetivos_uniq` | Un objetivo por mes, razón social y tipo | Funciona junto con el check de día 1: sin el check, el índice único no sirve |
| `tramite_cobros_fecha_idx` parcial | Informe de cobros por período | Parcial sobre `not null` |

---

## 11. Orden de las migraciones

Cada una es idempotente (`create table if not exists`, `drop policy if exists`, `do $$ ... if not exists`, `on conflict do nothing`) y cada una se autoregistra en `schema_migrations` en su última línea.

| # | Archivo | Depende de | Qué queda funcionando sola |
|---|---|---|---|
| 01 | `migracion-01-cimientos.sql` | — | Se puede loguear, hay perfiles y roles. Nadie ve nada hasta que gerencia habilita |
| 02 | `migracion-02-catalogos.sql` | 01 (helpers, `perfiles`) | Están las 5 razones sociales, las 3 tarjetas, las 2 sucursales y las gestoras |
| 03 | `migracion-03-tramites.sql` | 02 (FKs) | **Etapa 1 usable**: se cargan trámites y se mueven por el circuito con control de rol. Ya reemplaza la planilla y el cuaderno |
| 04 | `migracion-04-cuenta-corriente.sql` | 03 (`tramites`) | **Etapa 2**: saldo simulado, débito automático y saldo disponible unificado. Resuelve la línea 16 |
| 05 | `migracion-05-cobros.sql` | 03 | **Etapa 3**: lo cobrado al cliente, escondido. Independiente de la 04 |
| 06 | `migracion-06-conciliacion.sql` | 04 (`movimientos_tarjeta`) | **Etapa 4**: pegar el listado del habitualista y ver las diferencias |
| 07 | `migracion-07-objetivos-y-reportes.sql` | 04 y 05 | **Etapa 5**: cierre de mes y saldo proyectado |
| 08 | `migracion-08-endurecimiento.sql` | todas | Se corre última, y **de nuevo después de cada migración futura** |

La 03 sola ya es un producto: el pedido central del documento es *"Necesitamos llevar ese registro en un formato de listado"* (línea 14) y eso lo resuelve la 03 sin ninguna de las siguientes.

---

## 12. Lo que este esquema NO hace, escrito para que nadie lo suponga

- **No scrapea el sitio de Habitualista.** El saldo se carga a mano como `ingreso` y el listado de operaciones se pega. Es decisión tomada del dueño del proyecto.
- **No manda mails ni WhatsApp.** El cuaderno y el WhatsApp desaparecen porque el dato está en un listado, no porque el sistema mande mensajes.
- **No conoce a administración de ventas.** `recibido_at` es un dato de la fila, no la acción de un usuario de esa área. Si mañana carga sus propios trámites, es un valor más en el check de `perfiles.rol` y una policy más; el esquema no cambia.
- **No calcula comisiones ni rankings por gestora.** Igual que en el Tablero: las métricas describen procesos, no personas. `v_cierre_mensual` agrupa por razón social, sucursal y tipo, nunca por gestora.
- **No borra nada.** Anular y ajustar son los dos únicos caminos de reversa.