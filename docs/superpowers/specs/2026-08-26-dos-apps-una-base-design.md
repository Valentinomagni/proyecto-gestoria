# Dos apps, una base — diseño de la reconstrucción

**Fecha:** 26/08/2026
**Estado:** aprobado en conversación, pendiente de los tres planes de ejecución.

---

## 1. El problema, y por qué las tres muestras se rechazaron

La app se mostró tres veces y las tres volvió con correcciones. La cuarta no puede volver.

Las ocho correcciones de la última tanda parecen ocho problemas distintos. No lo son. Puestas al
lado del Excel que la dueña usa todos los días, todas dicen lo mismo:

> **La app está organizada por verbos. Su Excel está organizado por empresas.**

La barra lateral dice *Pedidos de fondos · Tarjeta · Trámites · Cargar trámite · Administración* —
cinco cosas que **hacer**. Su Excel dice *PARIS AUTOS · DORAL CHEVROLET · PARIS CARS · PARIS
MOTOR · PARIS TRAC · RESUMEN* — seis cosas que **son**.

Para saber cómo viene Paris Autos, en la app tiene que entrar a Tarjeta, elegir Paris Autos, ir a
Trámites, filtrar mentalmente cuáles son de esa razón social, y armar el cuadro en la cabeza. En
el Excel abre una solapa y está todo. Por eso prefiere el Excel: no es más lindo, es que **no la
obliga a ensamblar nada**.

Eso explica el resto de las quejas sin necesidad de tratarlas una por una:

- *"no quiero barra lateral, parece la réplica del tablero contable"* — la barra es la forma
  visible de esa organización ajena.
- *"que primero se agrupen por razón social"* — es pedir la solapa del Excel.
- *"algo dividido por solapas, similar al Excel que usamos"* — lo mismo, dicho más fuerte.
- *"esta gama de colores, más parecido a lo que ya utilizamos"* — pedir que se parezca a algo
  conocido, porque nada más se parece.

**El criterio de éxito de esta reconstrucción:** que la dueña abra la app y encuentre lo que
busca sin que nadie se lo explique. Si tiene que preguntar dónde está algo, falló.

---

## 2. La decisión que ordena todo: dos productos, una base

Hasta hoy hubo **una app y unos permisos que esconden pantallas**. Eso produce una gestora que
usa una herramienta de oficina con la mitad tapada, y una oficina que usa una herramienta
pensada para un flujo que no es el suyo.

A partir de acá son **dos productos distintos sobre la misma base de datos**:

| | Para quién | Forma | Dónde se usa |
|---|---|---|---|
| **La oficina** | La dueña, gerencia, administración contable | Control: resumen, empresas, listados, plata | Escritorio, sentadas |
| **La gestora** | Las gestoras | Tareas: una cola, un botón por vez | Teléfono, paradas en el registro |

Comparten la base, el libro mayor, la máquina de estados y las policies — todo eso está probado
y **no se toca salvo donde este documento lo dice**. Lo que se rehace es la superficie entera.

**No comparten pantallas.** Un rol no es un filtro sobre la misma vista: es otra aplicación.

---

## 3. La cadena: seis estados y una salida

Hoy son diez estados. El circuito real, dictado por quien lo hace, tiene seis.

| | Estado | De quién es | Qué pasa |
|---|---|---|---|
| 1 | **Recibido** | Oficina | Llega el mail y se carga el trámite |
| 2 | **Controlado** | Oficina | Se contesta el checklist del legajo |
| 3 | **Entregado** | Oficina → Gestora | Se le asigna a una gestora |
| 4 | **Presupuestado** | Gestora | Carga el presupuesto. La plata queda reservada sola y aparece el pedido en la oficina |
| 5 | **Resuelto** | Gestora | Un viaje al registro: presenta, paga y retira. Carga lo que salió de verdad |
| 6 | **Devuelto** | Gestora → Oficina | Le entrega la documentación a administración |

Salida única: **Anulado**, con motivo escrito. Nada se borra.

### Por qué se funden tres estados en uno

`presentado`, `pagado` y `retirado` eran tres botones para **un solo viaje al registro**. La
gestora presenta, le liquidan, paga y retira, todo en la misma ventanilla. Tenerlos separados la
obligaba a abrir la app tres veces para registrar algo que pasó una vez, y ninguna de esas tres
aperturas le decía nada nuevo a la oficina.

Al fundirse, el paso 5 pide de una vez lo que ese momento produce: la seccional, el N° de pago,
**el costo real discriminado por concepto** y qué documentación retiró.

### Por qué desaparece `frenado_por_saldo`

No es un estado del trámite: es una condición de la tarjeta. El trámite está presupuestado y
correcto; lo que falta es que la tarjeta tenga con qué. Modelarlo como estado obligaba a alguien
a marcarlo y a desmarcarlo a mano, y ese alguien se olvidaba.

**Ahora se deduce:** un trámite presupuestado cuya tarjeta no cubre el saldo reservado está
esperando plata. Se calcula, no se marca. Si entra plata, deja de estarlo solo.

### Dónde espera la plata

Entre 4 y 5, y en ningún otro lado. La gestora presupuestó, la oficina todavía no depositó, y
ella no puede salir. **Ese hueco es el único momento de espera de todo el circuito**, y es lo que
las dos apps tienen que hacer visible: a ella, "no salgas todavía"; a la oficina, "hay alguien
esperando".

### Lo que se conserva

El checklist del legajo antes de entregarlo a gestoría. Nadie se quejó de él, y es el único
control que evita que un legajo incompleto llegue al registro.

---

## 4. La app de la oficina

### Navegación: tres niveles y ningún menú

```
RESUMEN  →  EMPRESA  →  TRÁMITE
```

La barra lateral no se reemplaza por otra barra: se reemplaza por **profundidad**. Arriba, una
tira fina y fija con el camino recorrido —`Grupo Paris / Paris Autos / MARTINEZ DIEGO`— donde
cada tramo es un botón para volver, y el nombre de quien entró a la derecha. Eso es toda la
navegación.

**Las cinco pantallas de hoy se convierten en dos:**

| Hoy | Dónde queda |
|---|---|
| Pedidos de fondos | Deja de ser pantalla: es la sección ESPERAN PLATA de cada empresa y la columna ESPERAN del resumen |
| Tarjeta | Las cuatro cifras pasan al encabezado de la empresa; el extracto va plegado abajo |
| Trámites | Es el cuerpo de la empresa, en secciones por estado |
| Cargar trámite | Un botón `+ Trámite` adentro de la empresa — un trámite siempre pertenece a una razón social |
| Administración | Debajo del nombre de usuario. Se entra dos veces al mes, no todos los días |

### Nivel 1 — El resumen

Es la puerta de entrada y es la solapa RESUMEN de su Excel, calculada sola.

```
GRUPO PARIS                                          26/08   Sofía ▾
─────────────────────────────────────────────────────────────────────
  EMPRESA            SALDO HOY     RESERVADO    DIFERENCIA   ESPERAN
  Paris Autos        9.435.000       971.234     8.463.765     3
  Doral Chevrolet            0             0             0     —
  Paris Cars                 0             0             0     2
  Paris Motor                0             0             0     —
  Paris Trac                 0             0             0     —
─────────────────────────────────────────────────────────────────────
  TOTAL GRUPO        9.435.000       971.234     8.463.765     5
```

Cada fila es un botón. **ESPERAN** es la cuenta de trámites presupuestados esperando plata en esa
empresa — el número que hoy obliga a entrar a otra pantalla.

### Nivel 2 — La empresa

Es donde va a pasar el día.

```
Grupo Paris / PARIS AUTOS                                    Sofía ▾
─────────────────────────────────────────────────────────────────────
  Saldo hoy       Pendiente        Reservado        Queda
  9.435.000       3.000.000          971.234        8.463.765
                                          [+ Trámite]    [+ Dinero]
─────────────────────────────────────────────────────────────────────
▾ ESPERAN PLATA (2)                                           648.000
   25/08  MARTINEZ DIEGO ARMANDO    VB505821   Carla         520.000
   21/08  MARTORINA ALEJANDRO       TB582793   Mariana       128.000

▾ EN CURSO (4)
   20/08  BALAGUER JUAN ANTONIO     —          Carla         Resuelto
   20/08  GARRO PABLO EMMANUEL      TG569554   —             Recibido

▸ TERMINADOS (8)
▸ ANULADOS (3)
▸ MOVIMIENTOS DE LA TARJETA — hoy (3)
```

**Las cuatro cifras** son las que ya se aprobaron en la revisión anterior: Saldo día de hoy,
Depósito pendiente de acreditación, Saldo reservado, y la Diferencia — que es con la que se
decide si se manda a presentar.

**Las secciones son plegables y arrancan con un criterio:** abierto lo que necesita algo,
plegado lo que ya pasó. Los terminados y los anulados no acumulan ruido. Adentro de cada sección
el orden es por fecha, como en su Excel.

**Las columnas son las de su Excel:** fecha, cliente, dominio, gestor, plata.

**Los movimientos de la tarjeta** van plegados y abren en "hoy", con un "ver todo". Es el pedido
textual: *"que la solapa de operaciones sea plegable para que no se acumulen tantas operaciones
viejas, que aparezcan principalmente los movimientos del día"*.

**Bajar a Excel** vive acá, al lado de `+ Trámite`, y baja **lo que se está mirando**: los
trámites de esa empresa con las secciones abiertas. No baja el grupo entero. Quien quiera todo lo
baja empresa por empresa, que es exactamente como está su planilla hoy.

### Nivel 3 — El trámite

La ficha que ya existe, con los paneles que sobreviven: datos editables, presupuesto corregible,
checklist cuando corresponde, cambios, notas, historial y las salidas. Se le saca el panel de
vencimientos, que ya no existe.

Desde acá la oficina también puede avanzar el trámite por pasos que normalmente hace la gestora
— ver la sección 5.

### Qué queda en Administración

Se entra desde el nombre de usuario, arriba a la derecha. Después de los recortes queda:

- **Usuarios** — dar de alta, asignar rol, activar y desactivar.
- **Razones sociales y tarjetas** — la lista de empresas y su Tarjeta Habitualista.
- **Feriados** — el calendario del que depende cuándo acredita un depósito, con el aviso de hasta
  dónde llega lo cargado.
- **Respaldo** — bajar un archivo con todo lo que hay en la base.

Se van de ahí la sección **Plazos** y la de **Problemas avisados**. **Cargar dinero** se muda a la
empresa, como botón `+ Dinero`: el depósito siempre es a una tarjeta, y la tarjeta es de una
empresa.

---

## 5. La app de la gestora

**Una sola pantalla. Sin menú, sin tabla, sin filtros, sin buscador.** Dos bloques: lo que le
toca y lo que espera.

```
┌─────────────────────────────────┐
│ Hola Carla                      │
│ Paris Autos 8.463.765           │
├─────────────────────────────────┤
│ TE TOCA A VOS (2)               │
│                                 │
│  ROSALES MARÍA ROSA             │
│  VG506910 · Paris Autos         │
│  Falta el presupuesto           │
│  ┌───────────────────────────┐  │
│  │   Cargar el presupuesto   │  │
│  └───────────────────────────┘  │
│                                 │
│  MARTINEZ DIEGO ARMANDO         │
│  VB505821 · Paris Autos         │
│  Ya tenés los 520.000           │
│  ┌───────────────────────────┐  │
│  │     Andá al registro      │  │
│  └───────────────────────────┘  │
├─────────────────────────────────┤
│ ESPERANDO A LA OFICINA (1)      │
│  MARTORINA ALEJANDRO            │
│  Pediste 128.000 · hace 3 h     │
├─────────────────────────────────┤
│ TERMINADOS HOY (2)           ▸  │
└─────────────────────────────────┘
```

### Qué botón le toca a cada trámite

| Estado del trámite | Bloque | Botón |
|---|---|---|
| Entregado | Te toca a vos | `Cargar el presupuesto` |
| Presupuestado, la tarjeta **no** cubre | Esperando a la oficina | ninguno |
| Presupuestado, la tarjeta **sí** cubre | Te toca a vos | `Andá al registro` |
| Resuelto | Te toca a vos | `Entregar a administración` |
| Devuelto | Terminados hoy | ninguno |

**Un botón por tarjeta y por vez.** Sin botón significa que no hay nada que ella pueda hacer, y
eso se dice con palabras además de con la ausencia: *"sin botón: no hay nada que puedas hacer
todavía"*.

### El ping pong es el salto

Cuando la oficina deposita, la tarjeta de MARTORINA **se mueve sola** del bloque de abajo al de
arriba y le aparece un botón. Ella no recarga nada, no consulta nada, no pregunta por WhatsApp.

Ese salto es el ida y vuelta hecho cosa. No hace falta un chat: el chat obliga a leer mensajes y
compite con WhatsApp, que ya está abierto en su teléfono y siempre gana. El salto no compite con
nada porque no pide atención: está cuando ella mira.

### Sin selector de tarjeta

Cada trámite dice de qué empresa es y si la plata está. La línea de arriba muestra el saldo de
las tarjetas donde ella tiene trabajo, en vivo. Un selector la obligaría a saber de antemano por
cuál empresa preguntar, y ella no piensa por empresa: piensa por trámite.

### Lo que carga en cada paso

- **Cargar el presupuesto:** los conceptos con su importe. El total es la suma, y eso es lo que
  se reserva. Ya funciona así.
- **Andá al registro:** al volver carga seccional, N° de pago, el costo real por concepto y qué
  documentación retiró. Un formulario, una guardada.
- **Entregar a administración:** confirmación sola.

### Qué ve si toca el nombre del cliente

La cola es la pantalla, pero **no es todo lo que puede ver**. Tocar el nombre abre una ficha
reducida, de una sola columna, con lo que a ella le sirve y nada más:

- los datos del trámite —cliente, dominio, vehículo, cuenta, seccional—, editables sólo en lo que
  la base ya le permite: dominio, seccional, N° de pago y sus observaciones;
- el presupuesto, con sus líneas;
- las **notas**, que es por donde la oficina le deja escrito lo que hoy se dice por WhatsApp —
  "no lo presentes hasta que llegue el 08"— y por donde ella contesta.

No ve el historial de estados, ni los cambios, ni el costo real de otros trámites, ni ninguna
cifra de la empresa que no sea el saldo de la tarjeta donde trabaja. Eso último no es una
decisión de pantalla: la RLS ya lo impide.

### La oficina puede hacer lo que hace la gestora

Contable y gerencia pueden avanzar cualquier trámite, incluidos los pasos que normalmente hace
una gestora. Pasa de verdad: la gestora se queda sin batería, o llama por teléfono para que le
carguen algo. La base ya lo permite y **no se restringe**. Lo que cambia es que en la app de la
oficina eso no es el camino principal: se hace desde la ficha del trámite, no desde una cola.

---

## 6. El color

### La tensión, dicha de frente

La dueña quiere la gama de la Tarjeta Habitualista. El proyecto tiene escrita la regla contraria:

> *Color: monocromo. El color aparece sólo en estados. En un sistema donde lo que importa es si
> algo vence o si falta plata, un color "de marca" en un botón compite con la única señal que
> importa.*

Esa regla es correcta y el pedido también. Se resuelven separando **marco** de **contenido**:

- **El marco es teal.** La tira de arriba y la de migas llevan el verde azulado de la familia de
  Habitualista. Es lo primero que se ve al abrir y es lo que produce el *"esto se parece a lo que
  uso"*.
- **El contenido sigue monocromo.** Cifras, tablas y secciones en gris y negro. Ahí el único
  color son los estados: verde hecho, ámbar atención, rojo falta plata.

### Dos límites

1. **No se copia el hexadecimal de Habitualista.** Esa es la identidad de otra empresa y usarla
   exacta en una herramienta de Grupo Paris está mal. Se usa la misma **familia** —teal oscuro
   arriba, teal claro en las migas— con un tono propio.
2. **Los valores se eligen midiendo contraste**, en claro y en oscuro, no a ojo. El proyecto ya
   tiene tema oscuro y el teal tiene que funcionar en los dos.

Esto **enmienda una regla escrita del `CLAUDE.md`**, así que la enmienda se escribe ahí con su
porqué. Una regla que se incumple sin actualizarla deja de ser una regla.

---

## 7. Lo que se saca

| Se va | Por qué |
|---|---|
| **La barra lateral** | Es la forma visible de una organización que no es la suya |
| **Avisar un problema** y "Problemas avisados" | Pedido explícito. La tabla `avisos` queda en la base; se va la pantalla |
| **Plazos y vencimientos** | Pedido explícito. Se va la sección Plazos de Administración y el panel de la ficha |
| **La campana de novedades** | Con el resumen en vivo y el salto de la gestora, avisa algo que ya se ve |
| Los estados `presentado`, `pagado`, `retirado`, `frenado_por_saldo` | Ver la sección 3 |

**Los feriados se quedan.** No son parte de los vencimientos: de ellos depende el cálculo de
cuándo acredita un depósito, que es lo que separa el saldo de hoy del de mañana.

**Lo que NO se saca, aunque no se haya nombrado:**

- El **checklist del legajo** — el único control antes del registro.
- Las **notas del trámite** — son el ida y vuelta escrito, y lo que hoy se pierde en WhatsApp.
- **Bajar a Excel** — a propósito. La dueña viene del Excel; quitarle la puerta de salida a su
  propia planilla es la forma más rápida de que desconfíe de la herramienta.

---

## 8. El tiempo real

No necesita nada nuevo en la base. Comprobado el 26/08/2026 contra el proyecto remoto:

- `movimientos`, `tramites` y `tramite_eventos` ya están en la publicación `supabase_realtime`.
- La policy `movimientos_select` dice `es_oficina() OR (es_gestora() AND opero_esta_tarjeta(tarjeta_id))`,
  así que una gestora ya puede leer los movimientos de las tarjetas donde tiene trabajo.

Falta que las pantallas se suscriban:

- **Oficina:** el resumen y la empresa se actualizan solos. Si contable carga un depósito en San
  Luis, la dueña lo ve en San Juan sin recargar.
- **Gestora:** la tarjeta salta de bloque.

**Cómo se comprueba:** dos ventanas, dos usuarios, y mirarlo. No hay test unitario que pruebe
esto, y esa es exactamente la comprobación que Playwright sí puede automatizar.

---

## 9. Los arreglos de base

### 9.1 El saldo inicial no se puede volver a cargar

**Es un defecto abierto y bloqueante.** Comprobado en la base remota:

```
SALDO INICIAL POR TARJETA
  Paris Autos SA   2.505.627,92  ANULADO
  Paris Cars       5.000.000,00  ANULADO
```

Las dos tarjetas están hoy sin poder recargar su saldo de arranque. El índice
`movimientos_un_saldo_inicial` es parcial sobre `tipo = 'saldo_inicial'` y **no excluye los
anulados**, así que el anulado sigue ocupando el lugar.

Es la misma forma exacta del defecto que ya se arregló el 21/08/2026 en
`tramite_conceptos_uno_por_momento` y que no se generalizó.

**Arreglo:** el índice pasa a `where not exists (una anulación que lo apunte)`. Y se revisan
**todos** los índices únicos parciales por esa misma forma.

**Guardián nuevo:** una prueba que falle si aparece un índice único parcial que no contemple lo
anulado. Es la tercera vez que aparece esta forma; merece una prueba automática, no memoria.

### 9.2 La máquina de estados

De diez estados a seis más `anulado`. Incluye:

- Reescribir `c_tramites_transicion` con las transiciones nuevas y lo que cada paso exige.
- Migrar los trámites que hoy están en `presentado`, `pagado` o `retirado` — al 26/08/2026 son
  tres, todos de prueba, así que es barato. **Es el momento de hacerlo.**
- `orden_estado` y los sellos `*_at` se ajustan a la cadena nueva. Los sellos viejos no se
  borran: quedan como historia de lo que pasó cuando la cadena era otra.

### 9.3 Lo que se deduce en vez de marcarse

"Esperando plata" pasa a ser una vista: trámites presupuestados cuya tarjeta no cubre el
reservado. Se calcula en la base, con `security_invoker`, para que la oficina y la gestora vean
exactamente el mismo número.

---

## 10. Cómo se prueba

Playwright ya está instalado (`@playwright/test`) con su script `npm run e2e`, pero **nunca se
cableó**: falta la configuración y las pruebas. No hace falta Selenium — es la misma herramienta,
maneja Chrome igual, y es más rápida y más estable. Instalarlo sería un segundo martillo para el
mismo clavo.

Tres cosas que hoy no se pueden comprobar de ninguna otra manera:

1. **El circuito de la oficina** — cargar un trámite, controlarlo, entregarlo, verlo aparecer en
   ESPERAN PLATA de la empresa correcta.
2. **El circuito de la gestora** — presupuestar, quedar esperando, y que la tarjeta salte cuando
   entra la plata.
3. **El tiempo real** — dos contextos de navegador a la vez: un usuario deposita, el otro lo ve
   sin tocar nada.

Las pruebas entran con las cuentas de `.env.local`, igual que el arnés de permisos.

**Lo que Playwright no reemplaza:** mirar la pantalla. Los tres peores defectos de esta semana
—los UUID crudos, el apellido duplicado, los botones de 16 píxeles— los agarró alguien mirando,
no un test.

---

## 11. Cómo se corta el trabajo

Tres planes en secuencia. **Cada uno termina, se prueba y se publica antes de empezar el
siguiente.**

| | Plan | Qué entrega | Por qué en ese orden |
|---|---|---|---|
| **A** | La base y las pruebas | Saldo inicial arreglado, cadena de seis estados, la vista de "esperando plata", el guardián nuevo, Playwright configurado | Es corto y desbloquea todo. Con la cadena vieja, las dos apps se construirían sobre estados que van a desaparecer |
| **B** | La app de la oficina | Resumen → empresa → trámite, sin barra lateral, color nuevo, y todo lo que se saca | Es lo que ella mira. Es la muestra que tiene que aprobarse |
| **C** | La app de la gestora | La cola de tareas en el teléfono, con el salto en vivo | Es lo que hace que el sistema se alimente solo |

---

## 12. Lo que este diseño NO hace

Escrito para que nadie lo suponga:

- **No trae los vencimientos de vuelta.** Los plazos y el cálculo quedan en el historial de git.
- **No manda notificaciones al teléfono.** El salto de tarjeta funciona con la app abierta. Un
  aviso push necesita un service worker y permisos del navegador; es otra etapa.
- **No permite borrar de verdad** nada: ni un movimiento, ni un trámite, ni una línea. Se anulan
  con motivo y quedan a la vista.
- **No separa la base de desarrollo de la de producción.** Sigue siendo una sola, y la app lo
  sigue diciendo en pantalla.
- **No toca el libro mayor ni las policies**, salvo lo que dice la sección 9.

---

## 13. Lo que depende del usuario

1. **Cambiar la contraseña genérica** antes de que haya saldos reales.
2. **La segunda base de Supabase**, antes de cargar el `saldo_inicial` real. Hoy hay una sola y
   el cupo gratuito de la cuenta está en el tope.
3. **Recargar los dos saldos iniciales** en cuanto el Plan A lo destrabe.
4. **La regla escrita de gerencia:** no se deposita contra una foto de cuaderno.

---

## 14. Deuda conocida que este diseño no cierra

- `npm run deadcode` está en rojo desde antes: nueve dependencias sin usar y nueve tipos
  exportados que nadie importa.
- `npm run permisos` devuelve 0 cuando se saltea por falta de token. Un guardián que se saltea en
  silencio y dice que salió bien es medio guardián.
- Las claves foráneas de `tramite_cambios` conservan el nombre viejo `presupuesto_historial_*`.
  Es cosmético: nunca se muestran.
