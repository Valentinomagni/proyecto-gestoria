# Dos apps, una base — diseño de la reconstrucción

**Fecha:** 26/08/2026
**Estado:** aprobado en conversación, pendiente de los tres planes de ejecución.

**Cómo leerlo.** Las secciones 1 a 5 son el producto: por qué se rechaza y qué se construye. La 6
y la 7 son el aspecto. La 8 y la 9 son con qué y cómo se trabaja — **la 9 es la que más cambia el
resultado y es la que faltaba**. De la 10 en adelante, los recortes, los arreglos, las pruebas y
el corte en tres planes.

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

## 6. El color: la gama de la Tarjeta Habitualista

### La decisión, y quién la tomó

Yo propuse usar la misma **familia** de color pero con un tono propio, porque el hexadecimal de
Habitualista es la identidad de otra empresa. Lo planteé una vez; la respuesta fue que sea la
gama de Habitualista, para que le resulte agradable a la dueña. **Va como se pidió.**

Queda escrito quién decidió qué, porque dentro de un año alguien va a preguntar por qué una
herramienta de Grupo Paris usa el color de otra marca, y la respuesta es que fue una decisión
deliberada de producto, no un descuido.

### Dónde va el teal y dónde no

El color entra en el **marco** y en **un solo acento**. No entra en los números.

| Zona | Color | Por qué |
|---|---|---|
| Tira superior | Teal oscuro | Es lo primero que se ve. Produce el "esto se parece a lo que uso" |
| Tira de migas | Teal medio | Calca la segunda barra del sitio |
| Botón principal, foco, sección abierta | Teal | Un solo acento en toda la app |
| Cifras, tablas, texto | Gris y negro | Si el teal invade los números se pierde la señal |
| Estados | Verde, ámbar, rojo | Hecho, atención, falta plata. Intocables |

La regla que sobrevive es la que importa: **un número nunca es del color de la marca**. Cuando
todo es teal, el rojo de "falta plata" deja de gritar — y ese grito es la razón de ser del
sistema.

### La paleta

Punto de partida, tomado del sitio de Habitualista. **Los valores finales se sacan muestreando
una captura del sitio y se ajustan hasta pasar contraste AA** (4,5:1 para texto, 3:1 para
elementos de interfaz), medido, no a ojo.

| Token | Claro | Para qué |
|---|---|---|
| `--marca` | `#0E7C8C` aprox. | Tira superior, botón principal |
| `--marca-2` | `#5FB4C4` aprox. | Tira de migas |
| `--marca-suave` | `#E4F1F5` aprox. | Fondo de fila seleccionada, sección abierta |
| `--marca-ink` | `#FFFFFF` | Texto sobre teal oscuro |

En **modo oscuro** el teal baja de luminosidad, no de saturación: un teal desaturado se ve
enfermo. Los tres tokens tienen su par oscuro y se validan igual.

Se escriben en **OKLCH**, que es lo que Tailwind 4 usa nativamente. No es capricho: interpolar
entre dos colores en RGB pasa por grises embarrados, y en OKLCH no. Importa para las
transiciones de la sección 7.

### La trampa que ya costó cinco pantallas

`--ring` es un **color** y `--ring-sh` es una **sombra**. `box-shadow: var(--ring), var(--shadow)`
es CSS inválido y el navegador **descarta la declaración entera, en silencio**. Está en el
`CLAUDE.md` y sigue valiendo con los tokens nuevos.

### La enmienda al CLAUDE.md

El `CLAUDE.md` dice hoy: *"monocromo; el color aparece sólo en estados"*. Esta sección lo
enmienda, y la enmienda se escribe ahí con su porqué. Una regla que se incumple sin actualizarla
deja de ser una regla y pasa a ser una decoración — que es exactamente lo que el método del
proyecto dice que no puede pasar.

---

## 7. El salto de calidad visual

El pedido es que se vea como una herramienta cara. Esa impresión no sale de agregar efectos:
sale de **nueve decisiones concretas**, cada una verificable. Las listo con lo que hay que hacer
y cómo se comprueba, porque "que se vea premium" no es un criterio que se pueda revisar.

### 7.1 Jerarquía de tamaños, de verdad

Hoy casi todo es `text-sm` y `text-2xs`. Una app se ve barata cuando todos los textos miden
parecido. La escala de nueve pasos ya existe y está sin usar.

**Regla:** el número que decide algo va en `text-3xl` o `text-4xl`, y su rótulo en `text-2xs`.
En el resumen, la Diferencia de cada empresa es el número más grande de la pantalla. En la
empresa, también.

**Se comprueba:** en la pantalla del resumen tiene que haber al menos cuatro pasos distintos de
la escala.

### 7.2 Los números no bailan

`.tnum` ya está. Falta lo otro: **toda columna de plata alineada a la derecha, con ancho fijo, y
los miles siempre con punto.**

Y una decisión nueva: en las cifras grandes del resumen, **si los centavos son cero no se
muestran**. `9.435.000` se lee de un golpe; `9.435.000,00` obliga a contar. En el extracto y en
el presupuesto los centavos van siempre, porque ahí la exactitud es el punto.

**Se comprueba:** capturas de pantalla comparadas contra una referencia. Si una columna se
corre un píxel, la prueba falla.

### 7.3 Un ritmo de espacio, no quince

Hoy conviven `gap-2 gap-3 gap-4 p-6 mt-1 mb-2 py-1 py-2` sin criterio. **Seis pasos y ninguno
más**, sobre una base de 4 px: 4, 8, 12, 16, 24, 32.

**Se comprueba:** un guardián, como el de tipografía, que falle si aparece un valor de espacio
fuera de la escala.

### 7.4 Elevación, no bordes

`Panel` hoy es un borde de 1 px. Una superficie que flota se ve cara; un rectángulo con borde se
ve barato. **Dos capas de sombra** —una de contacto corta y opaca, una de ambiente larga y
difusa— y un token para cada nivel.

Tres niveles y basta: `--sombra-plana` (tablas), `--sombra-panel` (tarjetas), `--sombra-flotante`
(menús y diálogos).

### 7.5 El foco se ve, y se ve bien

El anillo de foco del navegador es gris y feo. Un anillo de 2 px en teal con 2 px de separación,
en **todo** lo que recibe foco. Es el detalle que más separa una app cuidada de una que no, y es
además lo que la hace usable con teclado.

**Se comprueba:** `@axe-core/playwright`, que ya está instalado y nunca se usó.

### 7.6 Las cosas se mueven de donde estaban a donde van

Ésta es la única animación que el producto necesita, y no es decoración: **cuando la tarjeta de
la gestora salta de "esperando" a "te toca", tiene que verse el viaje.** Si aparece de la nada,
ella no entiende que es la misma tarjeta.

Se hace con la **View Transitions API**, que Chrome soporta y que cuesta **cero bytes**: se le
pone un `view-transition-name` a la tarjeta y el navegador anima el cambio de posición solo. No
hace falta ninguna librería de animación.

Todo lo demás —abrir una sección, cambiar de nivel— con transiciones de 150 a 200 ms y la curva
`--ease-salida` que ya existe. Nada más largo: una app lenta se siente barata, no cara.

**Y respeta `prefers-reduced-motion`.** Quien tenga el sistema configurado para no animar, no ve
nada moverse.

### 7.7 Los esqueletos tienen la forma de lo que viene

Hoy `SkeletonLineas` dibuja rayas genéricas. Un esqueleto que no se parece al contenido produce
un salto al cargar, y ese salto es exactamente lo que se ve barato. El del resumen tiene cinco
filas con cuatro columnas; el de la empresa tiene el encabezado de cifras y tres secciones.

### 7.8 Los estados vacíos dicen qué hacer

Ya hay un `EmptyState` y está bien. Falta usarlo en todos lados y que cada uno diga la acción
siguiente, no una lástima. "Todavía no hay movimientos" es peor que "Cargá el saldo inicial de la
tarjeta para empezar", con el botón al lado.

### 7.9 Una sola densidad, la de una tabla financiera

Filas de 36 a 40 px, no de 56. Suficiente para el dedo en el teléfono y suficientemente compacto
para que entren quince trámites en una pantalla sin scrollear. Es lo que hace que se parezca a
una herramienta de trabajo y no a una landing.

### Cómo se verifica el acabado, y no de palabra

| Qué | Herramienta | Umbral |
|---|---|---|
| Contraste y accesibilidad | `@axe-core/playwright` | Cero violaciones serias |
| Que nada se corra | `toHaveScreenshot()` de Playwright | Diferencia por debajo del umbral |
| Peso y velocidad | `@lhci/cli` (Lighthouse) | Rendimiento y accesibilidad por encima de 90 |
| Espacios y tipografía fuera de escala | Guardianes propios | Cero |
| Que se vea bien | **Mirarlo** | Los tres peores defectos de esta semana los agarró alguien mirando, no un test |

---

## 8. Las herramientas

### 8.1 Nada de lo que hace falta pide permiso de administrador

Comprobado en esta máquina el 26/08/2026:

```
npm config get prefix  ->  C:\Users\Vmagni\tools\node-v22.17.0-win-x64
npm config get cache   ->  C:\Users\Vmagni\AppData\Local\npm-cache
```

**Todo lo que instala npm vive adentro del perfil del usuario.** No hay un solo paquete de este
diseño que necesite escribir en `Program Files` ni tocar el registro. La regla general: si se
instala con `npm i -D`, no pide administrador nunca.

### 8.2 Lo que ya está instalado y no se usa

Antes de agregar nada, esto es lo que el proyecto ya tiene pago y sin estrenar:

| Ya instalado | Estado | Para qué sirve acá |
|---|---|---|
| `@playwright/test` | Instalado, **sin configurar** | Las pruebas en Chrome. Falta `playwright.config.ts` |
| Navegadores de Playwright | **Ya descargados** en `%LOCALAPPDATA%\ms-playwright` | No hay nada que bajar |
| Chrome de escritorio | Instalado en la máquina | Playwright puede usar el Chrome REAL con `channel: "chrome"` |
| `@axe-core/playwright` | Instalado, **sin usar** | Accesibilidad y contraste automáticos |
| `vite-plugin-pwa` | Instalado, **sin usar** | Que la app de la gestora se instale en el teléfono y abra sin señal |
| `@sentry/react` | En uso | Enterarse de los errores sin que avisen por WhatsApp |
| `knip`, `oxlint`, `vitest` | En uso | Código muerto, lint, pruebas |

**No hace falta Selenium.** Playwright es la misma herramienta para el mismo trabajo, más rápida
y más estable, y además ya está pago. Instalarlo sería un segundo martillo para el mismo clavo.

### 8.3 Lo que conviene agregar

Cuatro cosas, todas por npm, todas en el perfil del usuario.

| Qué | Por qué | Costo |
|---|---|---|
| `@radix-ui/react-dropdown-menu`, `-dialog`, `-collapsible` | El menú de usuario, los formularios y las secciones plegables. Teclado, foco atrapado, Escape y lectores de pantalla resueltos. Hacerlo a mano es donde se ve lo barato | ~15 kB, sin estilos: se visten con los tokens del proyecto |
| `@lhci/cli` | Lighthouse en la terminal. Un número que dice si la app está rápida y accesible, en vez de una opinión | Sólo desarrollo, 0 kB en producción |
| `vite-plugin-pwa` | **Ya está**: sólo hay que encenderlo. La gestora en un registro con mala señal abre la app y ve lo último que cargó | 0 kB nuevos |
| `oxfmt` | Formateador del **mismo equipo que `oxlint`**, que ya se usa. Un archivo con tres estilos de escritura se lee mal y esconde diferencias en los `diff`. Se eligió sobre Prettier al ver que `claude-code-viewer` usa la cadena completa de Oxc — ver 8.7 | Sólo desarrollo |

### 8.4 Lo que NO conviene agregar, y por qué

Esto es la parte que ahorra tiempo, así que va con el razonamiento entero.

**shadcn/ui completo — no.** Es el estándar de la industria y es bueno. Pero copia unos quince
archivos con sus propias convenciones de tokens, y este proyecto ya tiene un sistema de diseño
con guardianes que fallan si alguien se sale de la escala. Los dos sistemas pelearían, y el que
perdería es el que tiene los guardianes. **Se toma lo que shadcn toma —Radix por debajo— y se
viste con los tokens de acá.** Misma calidad, sin la pelea.

**Una librería de animación (`motion`) — no por ahora.** Son unos 30 kB gzip para una sola
animación que la View Transitions API hace gratis. Si alguna vez hace falta algo que la API no
pueda, se agrega entonces y con el motivo escrito.

**gstack — analizado, y la recomendación es no.**

Es el marco de Garry Tan: 23 slash commands que convierten Claude Code en un equipo de
ingeniería, MIT, muy bueno, y con resultados medidos. Lo miré en serio. El problema es que
**alrededor del 80% ya está instalado acá con otro nombre**:

| Lo que trae gstack | Lo que ya hay |
|---|---|
| `/plan-eng-review`, `/autoplan`, `/office-hours` | `superpowers:brainstorming`, `writing-plans`, `executing-plans` |
| `/review` | `code-review` |
| `/cso` (auditoría de seguridad) | `security-review` |
| `/qa` con navegador | Playwright + el navegador de la sesión |
| `/design-consultation` | `ui-ux-pro-max`, `design-system`, `ui-styling` |
| `/learn`, `/retro` | La memoria del proyecto y el `CLAUDE.md` |

Lo único genuinamente aditivo es **`/design-shotgun`** —generar cuatro a seis variantes de una
pantalla y compararlas— y eso se puede hacer sin instalar nada.

Los tres costos de instalarlo, dichos claro:

1. **Vocabulario doble.** Dos juegos de comandos que hacen lo mismo con nombres distintos, en un
   proyecto cuyo mayor riesgo declarado es la complejidad.
2. **Necesita Bun.** Instalable sin administrador, pero es una segunda cadena de herramientas
   para mantener al lado de Node.
3. **Es código de terceros sin verificar.** Son prompts en Markdown, no ejecutables, así que el
   riesgo es acotado — pero un marketplace de GitHub no tiene revisión, y este proyecto administra
   saldos.

**Si igual lo querés, la forma barata es tomar la idea sin el marco:** que el plan de la app de
la oficina incluya un paso de "generar tres variantes de la pantalla del resumen y elegir", que
es lo que `/design-shotgun` hace.

### 8.5 Las skills de diseño que ya tenés

Esto no hay que buscarlo en GitHub porque ya está instalado en tu Claude Code:

- **`ui-ux-pro-max`** — base de datos local con 161 paletas, 57 pares tipográficos, 99 guías de
  UX y 161 tipos de producto, para React y Tailwind. Es exactamente la herramienta para elegir la
  paleta teal y la jerarquía tipográfica.
- **`design-system`** — arquitectura de tokens en tres capas y especificación de componentes.
- **`ui-styling`** — shadcn, Tailwind y accesibilidad.
- **`dataviz`** — por si alguna vez hay un gráfico.
- **`senior-frontend`** y **`senior-backend`** — revisión de calidad de código.
- **`security-review`** y **`code-review`** — auditoría antes de publicar.

**El plan de la app de la oficina tiene que invocar `ui-ux-pro-max` y `design-system` antes de
escribir una línea de CSS.** Eso está escrito acá para que no se olvide.

### 8.6 Lo que se investigó y no aplica

- **Magic UI, Aceternity y los kits de componentes animados** — 150 componentes con animaciones
  llamativas. Son para páginas de venta, no para una herramienta de trabajo donde lo que importa
  es leer un número rápido. Agregarían peso y ruido.
- **Plantillas de dashboard premium** (Haze y similares) — traen 96 pantallas que no se usan y
  una estructura que habría que desarmar. Este proyecto tiene cinco pantallas y un sistema propio.
- **pgTAP para probar la base** — necesita Postgres local, que necesita Docker, que no está
  disponible acá. El arnés de permisos contra la API real ya cubre eso mejor: prueba lo que
  devuelve PostgREST, no lo que dice la policy.


### 8.7 Los siete repos que se pidieron analizar

Se buscaron y se leyeron los siete. **La conclusión general primero, porque ahorra tiempo: los
siete son clientes para agentes de codificación** —interfaces para manejar Claude Code desde la
web, el escritorio o el teléfono—. Comparten casi nada de dominio con una gestoría del automotor.

Aun así, dos de ellos dejaron algo concreto, y está abajo.

| Prioridad | Repo | Qué es en realidad | Qué se puede tomar |
|---|---|---|---|
| 1 | **Claudable** (`opactorai/Claudable`) | Un constructor de webs por IA. Next.js, Prisma, SQLite, Electron, shadcn/ui. Es una **aplicación monolítica**, no una librería | **Nada aplicable.** Next.js no es el stack de acá y no hay piezas extraíbles. Lo único que aporta es confirmar que Tailwind + shadcn es el estándar del que ya se habló en 8.4 |
| 2 | **cdesktop** | No se encontró un repositorio con ese nombre. Puede ser un nombre interno o un proyecto renombrado | Nada, hasta tener el enlace exacto |
| 3 | **Claude Code Viewer** (`d-kimuson/claude-code-viewer`) | Cliente web de Claude Code. **PWA instalable en el teléfono, con notificaciones push** | **Dos cosas, y las dos valen.** Ver abajo |
| 4 | **Happy** (`slopus/happy`) | Cliente móvil y web con voz en tiempo real y cifrado punta a punta | Los patrones de sincronización en vivo son interesantes, pero está hecho en React Native con Expo: otro mundo, no se traslada |
| 5 | **Claude Code UI** (`siteboon/claudecodeui`) | Interfaz simple para manejar sesiones de Claude Code de forma remota | Poco. Es una capa de UI sobre un CLI |
| 6 | **Personal Website** | Demasiado genérico para identificar un repositorio concreto | Nada, hasta tener el enlace |
| 7 | **Claude Code Native** | No se encontró un repositorio con ese nombre | Nada, hasta tener el enlace |

#### Lo que sí salió de Claude Code Viewer

**Primero: `oxfmt` en lugar de Prettier.** Ese proyecto usa **Oxlint + Oxfmt + Lefthook**. Acá ya
se usa `oxlint`, y `oxfmt` es el formateador **del mismo equipo y de la misma cadena** — está
publicado en npm, versión 0.65.0, escrito en Rust. En la sección 8.3 yo había propuesto Prettier
con su plugin de Tailwind; **eso cambia a `oxfmt`**: un solo juego de herramientas en vez de dos
que se pisan la configuración, y bastante más rápido.

**Segundo: cómo se arma una PWA instalable.** Es exactamente lo que la app de la gestora necesita
—que se instale en el teléfono y abra sin señal— y acá `vite-plugin-pwa` ya está instalado y
apagado. Sirve como referencia de qué encender, aunque el código no se copie.

**Lo que NO se toma de ahí:** las notificaciones push. Requieren un service worker con
suscripción, un servidor que las emita y permisos del navegador. Está declarado en la sección 15
como fuera de alcance, y sigue estándolo.

### 8.8 CodeGraph: la respuesta honesta

**No lo estoy usando, y nunca lo dije. Eso último es lo que estuvo mal**, más que no tenerlo: se
pidió, no se instaló, y no se avisó. No hay `.mcp.json` en el proyecto ni ningún servidor MCP
configurado.

#### Qué es

Un servidor MCP que arma un grafo semántico del código —funciones, clases, importaciones, quién
llama a quién— y lo expone con unas 42 herramientas: buscar por significado, ver el árbol de
llamadas, analizar el impacto de un cambio. Es local, es MIT, y se instala por npm. Hay varias
implementaciones con el mismo nombre; la más difundida es `@colbymchenry/codegraph`.

#### Por qué se pidió, y el problema es real

Para no leer archivos enteros y gastar tokens de más. **Y el diagnóstico es correcto:** se leyó
`Ficha.tsx` entero —1.083 líneas— más de una vez en la misma sesión.

#### Por qué la recomendación igual es no, todavía

Se midió el proyecto antes de opinar:

```
archivos ts/tsx  73
lineas          11.623   (de las cuales 1.486 son tipos generados)
el archivo escrito a mano mas grande: datos.ts, 713 lineas
```

**Once mil líneas.** CodeGraph rinde cuando el grafo no entra en la cabeza de nadie: cien mil
líneas, cientos de módulos, gente que no sabe qué rompe si toca algo. Acá `grep` encuentra
cualquier cosa en milisegundos y el módulo más grande se lee en una pasada.

Y tiene costo: un servidor MCP más cuyas 42 herramientas ocupan lugar en **cada** sesión, un
índice que hay que mantener fresco en cada cambio, y un modelo de embeddings que descargar.

**El problema que señalaste tiene una causa más simple: leí de más.** Se arregla gratis y hoy,
con una regla escrita:

> **Antes de leer un archivo entero, buscá con `grep` y leé sólo el rango.** Un archivo se lee
> completo la primera vez que se toca en una sesión, y nunca dos veces. Para cambiar diez líneas
> de un archivo de setecientas, se leen esas diez con su contexto.

Eso va al `CLAUDE.md`. **Y el umbral queda escrito para no discutirlo de nuevo: si el proyecto
pasa de 30.000 líneas o de 200 archivos, se reevalúa CodeGraph.**

### 8.9 La caja de herramientas completa, por etapa

Lo pedido: que haya herramienta para cada paso, de front, de back y de auditoría. Esto es lo que
hay y lo que falta, sin huecos.

| Etapa | Herramienta | Estado |
|---|---|---|
| **Lluvia de ideas** | `superpowers:brainstorming` | En uso, es lo que produjo este documento |
| | `ui-ux-pro-max` — 161 paletas, 57 pares tipográficos, 99 guías de UX | Instalada, **sin usar todavía** |
| **Planear** | `superpowers:writing-plans` | En uso |
| | `design-system` — arquitectura de tokens en tres capas | Instalada, **sin usar** |
| **Ejecutar** | `superpowers:executing-plans` | En uso |
| | `ui-styling` — shadcn, Tailwind, accesibilidad | Instalada, **sin usar** |
| **Front** | Vite 8, React 19, Tailwind 4, TanStack Query | En uso |
| | Radix (menú, diálogo, plegables) | **Se agrega** |
| | View Transitions API | **Se enciende**, cuesta cero |
| | `vite-plugin-pwa` | Instalada, **se enciende** |
| **Back** | Supabase con RLS, triggers y libro mayor | En uso |
| | CLI de Supabase para migraciones y tipos | En uso |
| | Los diez guardianes propios | En uso |
| **Pruebas** | `vitest` — unidad | En uso, 154 pruebas |
| | Arnés de permisos contra la API real | En uso, 44 pruebas |
| | `@playwright/test` con el **Chrome real** | Instalado, **se cablea** |
| | `toHaveScreenshot()` — que nada se corra de lugar | **Se enciende** |
| **Auditoría** | `@axe-core/playwright` — accesibilidad y contraste | Instalado, **sin usar** |
| | `@lhci/cli` — Lighthouse | **Se agrega** |
| | `knip` — código muerto | En uso, en rojo con deuda vieja |
| | `security-review` y `code-review` | Instaladas, **sin usar en este proyecto** |
| | `senior-frontend`, `senior-backend` | Instaladas, **sin usar** |
| **Formato** | `oxlint` | En uso |
| | `oxfmt` — del mismo equipo | **Se agrega**, reemplaza a la idea de Prettier |
| **Monitoreo** | `@sentry/react` | En uso |
| **Búsqueda de código** | `grep` y `glob`, con la regla de 8.8 | En uso |
| | CodeGraph | **No**, hasta pasar 30.000 líneas |

**Lo que salta a la vista de esta tabla:** casi todo lo que hace falta ya está instalado y sin
usar. Lo que se agrega son cuatro paquetes chicos. El salto de calidad no viene de instalar
cosas: viene de **encender lo que ya está pago** y de invocar las skills de diseño antes de
escribir CSS, no después.

---
## 9. Cómo se trabaja: la capa que falta

### 9.1 La pregunta era buena y la respuesta es que sí, hay mejor

Tres veces seguidas contesté "no hace falta cambiar nada" en las etapas de ideas, plan y
ejecución. La repregunta —*"¿en serio no hay nada mejor?"*— era correcta.

**Me equivoqué en dónde miré.** Estuve comparando librerías de front, y el problema no está ahí:
el stack está bien y abajo está el análisis de por qué. Lo que falta es **la capa de Claude
Code**, y hay evidencia de esta misma semana.

### 9.2 La evidencia: tres reglas escritas, tres incumplidas

Esta semana rompí tres reglas que **ya estaban escritas en el proyecto**:

1. **Los botones de 16 píxeles.** `src/lib/campos.ts` documenta la regla de 44 px y hasta la
   medición que la produjo —"se midió en un teléfono de 375 px: había once controles de menos de
   40"—. La rompí igual, escribiendo las clases a mano.
2. **El índice parcial del saldo inicial.** Arreglé exactamente esa forma dos días antes, en
   `tramite_conceptos`, y escribí el porqué. No la generalicé, y las dos tarjetas quedaron sin
   poder recargar su saldo.
3. **Leer archivos enteros.** Leí `Ficha.tsx` —1.083 líneas— más de una vez en la misma sesión.

No es distracción. Es lo que la documentación de Anthropic describe textual:

> *"Bloated CLAUDE.md files cause Claude to ignore your actual instructions."*
>
> *"If Claude already does something correctly without the instruction, delete it or **convert it
> to a hook**."*

El `CLAUDE.md` de este proyecto tiene **335 líneas y 18,5 kB**. Está excelentemente escrito —es
lo mejor del proyecto— y es **demasiado largo para obedecerse**. Se carga entero en cada sesión y
compite consigo mismo.

### 9.3 Los hooks: la diferencia entre pedir por favor y garantizar

**No hay ninguno configurado.** Es el hallazgo más importante de toda esta investigación.

Un hook es un comando que Claude Code corre solo, en un momento fijo, y **cuyo resultado no se
puede ignorar**. El `CLAUDE.md` es un consejo; un hook es una barrera. Es exactamente la misma
distinción que este proyecto ya aplica en la base de datos con los poka-yokes:

> *¿Puede la base hacerlo imposible, en vez de que el front lo pida por favor?*

La respuesta para el proceso de trabajo es la misma, y hasta ahora no se aplicó.

| Cuándo corre | Qué corre | Qué error mata |
|---|---|---|
| Después de editar `src/**/*.ts` o `.tsx` | `oxlint` sobre ese archivo | Las advertencias que se acumulan hasta que nadie las mira |
| Después de escribir `supabase/migrations/*.sql` | `npm run migraciones` | **La migración vacía.** Ese error ya pasó dos veces |
| Después de editar `*.tsx` | Los guardianes de tipografía, campos y casa | Los botones de 16 píxeles |
| Antes de un `git push` | Los cuatro comandos | Publicar algo en rojo |
| **Al terminar el turno** (`Stop`) | Los cuatro comandos y los guardianes | **Que yo diga "listo" con algo roto** |

**El último es el que cambia todo.** Bloquea el fin del turno hasta que esté verde. Deja de
depender de que me acuerde de correr los comandos, que es de lo que depende hoy.

### 9.4 Los tres revisores existen y nunca los usé

El proyecto tiene tres subagentes definidos: **`revisor-contable`**, **`revisor-producto`** y
**`revisor-seguridad`**. Están disponibles y **no los usé ni una vez** en toda la reconstrucción.

Y el `CLAUDE.md` dice, en la sección de disciplina:

> *"Ninguna etapa cierra sin una revisión de alguien que no la escribió."*

**Toda esta semana me revisé a mí mismo.** El proyecto tiene escrito por qué eso falla: la matriz
de cobertura del Tablero Contable *"se declaró completa a sí misma"*, y una revisión
independiente encontró once hallazgos adentro, incluida una contraseña en texto plano.

Cuándo va cada uno, de acá en adelante:

| Revisor | Se invoca cuando | Qué mira |
|---|---|---|
| `revisor-seguridad` | Antes de cada publicación que toque la base, la RLS o los permisos | Que no se filtre nada, que las policies digan lo que parecen decir |
| `revisor-contable` | Cuando se toque plata, saldos, fechas o el libro mayor | Que los números y las fechas sean correctos desde la lógica contable |
| `revisor-producto` | Cuando se agregue una pantalla o se cambie un texto | Que sirva a quien la usa y no contradiga los valores del proyecto |
| `/code-review` | Sobre el diff, antes de cada publicación | Defectos de corrección, en contexto limpio |

Un revisor que corre en su propia ventana **ve el diff y no el razonamiento que lo produjo**. Por
eso encuentra lo que el que escribió no puede ver.

### 9.5 El CLAUDE.md se parte en dos

De 335 líneas a unas 60. **No se tira nada**: lo que sale se convierte en skills, que Claude
carga sólo cuando hacen falta en vez de en cada sesión.

**Lo que se queda en el `CLAUDE.md`** —porque sin esto se cometen errores en cualquier tarea:

- Las rarezas del entorno: el PATH que no trae node, el puerto 5173 con `strictPort`, cómo se
  leen los códigos de salida, que `db push` necesita `--yes`.
- Las reglas duras del producto: cero emojis, no se mide a las personas, voseo, nada se borra.
- **La regla del color, enmendada** según la sección 6: el teal va en el marco y en un acento;
  los números nunca son del color de la marca.
- **La regla de cómo se lee código**, de la sección 8.8: buscar con `grep` y leer el rango, no el
  archivo entero.
- Las trampas de la base: la recursión de RLS en `perfiles`, `security_invoker` en toda vista,
  nunca `force row level security` sobre `movimientos`.
- La plata: centavos enteros en JavaScript, `numeric(14,2)` en Postgres.
- La regla que manda: si escribís "verificado", escribí al lado el comando.

**Lo que se muda a `.claude/skills/`** —narrativa valiosa que no hace falta en cada tarea:

| Skill | Qué contiene | Cuándo se carga |
|---|---|---|
| `metodo-gestoria` | 5S, Kaizen, Poka-yoke, Andon, Genchi genbutsu, con sus post mortem | Al planificar o al revisar |
| `dominio-gestoria` | La cadena de seis estados, el modelo de plata, qué es un habitualista | Al tocar trámites o saldos |
| `marca-grupo-paris` | El manual de marca, la tipografía, la paleta | Al tocar diseño |
| `base-de-datos` | Migraciones, RLS, triggers, el libro mayor | Al tocar SQL |

**Cómo se comprueba que sirvió:** si vuelvo a romper una regla escrita, el corte se hizo mal.

### 9.6 El router: la pieza que está instalada y apagada

`@tanstack/react-router` **está en `package.json` y no se usa**. `knip` lo viene marcando como
dependencia muerta y nadie lo miró. La navegación de hoy es un `useState` en `App.tsx`.

**La consecuencia, hoy mismo: el botón "atrás" del navegador no funciona y no hay ninguna URL que
se pueda compartir o guardar en favoritos.**

Para alguien que prefiere el Excel, el botón atrás que no anda es de las cosas que hacen
abandonar una herramienta sin poder explicar por qué. Y con la estructura nueva de tres niveles
hace falta de verdad:

| URL | Qué muestra | Por qué importa |
|---|---|---|
| `/` | El resumen de las cinco empresas | |
| `/paris-autos` | La empresa | **La dueña la deja en favoritos y entra directo** |
| `/paris-autos/martinez-diego-armando` | El trámite | Se manda por WhatsApp y el otro abre esa ficha |
| `/mis-tramites` | La cola de la gestora | Es lo único que ella necesita en su teléfono |

Y resuelve otra cosa sin esfuerzo: **las dos apps son dos rutas**, no un `if` sobre el rol.

### 9.7 Las sesiones de trabajo

La documentación de Anthropic nombra un patrón de falla que describe exactamente esta sesión:
*"the kitchen sink session"* — empezar con una tarea, seguir con otra sin relación, volver, y
terminar con el contexto lleno de cosas que ya no importan.

**Una sesión por plan.** El Plan A empieza en una sesión nueva, con el spec como entrada. Cuando
termina y se publica, se cierra. Contexto limpio para el Plan B.

### 9.8 Lo que sí miré y NO cambio, con el motivo

Para que quede escrito y no se vuelva a discutir:

| Se evaluó | Veredicto | Por qué |
|---|---|---|
| **Next.js** en lugar de Vite | **No** | Es una app privada, sin buscadores y sin necesidad de renderizar en el servidor. Vite es más simple y más rápido de desarrollar. Next.js traería un servidor que nadie necesita |
| **Drizzle** u otro ORM | **No** | Los poka-yokes viven en la base —triggers, índices únicos, RLS— y ahí un ORM estorba. El SQL a mano es lo que hace posible que la base impida cosas |
| **Zustand, Jotai, Redux** | **No** | El estado del servidor lo maneja TanStack Query y el de pantalla es local. Agregar un contenedor global sería inventar un problema |
| **shadcn/ui completo** | **No** | Ver 8.4. Se toma Radix, que es lo que shadcn usa por debajo |
| **gstack** | **No** | Ver 8.4. El 80% ya está instalado con otro nombre |
| **CodeGraph** | **No, todavía** | Ver 8.8. Once mil líneas no lo justifican |
| **Selenium** | **No** | Playwright ya está instalado y es mejor |
| **Vite 8, React 19, TS 7, Tailwind 4** | **Se quedan** | Son las versiones actuales y son las correctas para esto |
| **Supabase** | **Se queda** | RLS, Realtime y autenticación en un solo lugar, gratis. Nada lo reemplaza mejor acá |
| **TanStack Query** | **Se queda** | Ya resuelve el caché, el refresco y la invalidación |
| **Playwright + vitest** | **Se quedan** | Instalados y correctos |

**La conclusión honesta: el stack está bien elegido. Lo que estaba mal es cómo trabajo sobre
él.** El salto de calidad que se pidió no sale de cambiar React por otra cosa: sale de los
hooks, de los tres revisores, del router que está apagado, y de un `CLAUDE.md` corto que se
pueda obedecer.

### 9.9 Qué de esto entra en el Plan A

Todo lo de esta sección menos el router, que es del Plan B porque la navegación es la app misma:

- Los cinco hooks, con el `Stop` primero.
- El `CLAUDE.md` partido y las cuatro skills escritas.
- Los tres revisores invocados al cerrar cada plan, y `/code-review` sobre el diff.

**Es media jornada de trabajo y es lo que evita las próximas tres semanas de correcciones.**

---
## 10. Lo que se saca

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

## 11. El tiempo real

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

## 12. Los arreglos de base

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

## 13. Cómo se prueba

Las herramientas están en la sección 8; acá va **qué** se prueba con ellas.

Playwright puede manejar el **Chrome de escritorio que ya está instalado en esta máquina**, con
`channel: "chrome"`. No es un navegador de mentira: es el mismo que abre la dueña.

Cinco cosas que hoy no se pueden comprobar de ninguna otra manera:

1. **El circuito de la oficina** — cargar un trámite, controlarlo, entregarlo, verlo aparecer en
   ESPERAN PLATA de la empresa correcta.
2. **El circuito de la gestora** — presupuestar, quedar esperando, y que la tarjeta salte cuando
   entra la plata.
3. **El tiempo real** — dos contextos de navegador a la vez: un usuario deposita, el otro lo ve
   sin tocar nada.
4. **Que nada se corra de lugar** — capturas comparadas contra una referencia, con
   `toHaveScreenshot()`. Una columna de plata que se mueve un píxel hace fallar la prueba.
5. **Accesibilidad y contraste** — `@axe-core/playwright`, que ya está instalado y nunca se usó.
   Cero violaciones serias, incluido el contraste del teal nuevo sobre blanco y sobre oscuro.

Las pruebas entran con las cuentas de `.env.local`, igual que el arnés de permisos.

**Lo que Playwright no reemplaza:** mirar la pantalla. Los tres peores defectos de esta semana
—los UUID crudos, el apellido duplicado, los botones de 16 píxeles— los agarró alguien mirando,
no un test.

---

## 14. Cómo se corta el trabajo

Tres planes en secuencia. **Cada uno termina, se prueba y se publica antes de empezar el
siguiente.**

| | Plan | Qué entrega | Por qué en ese orden |
|---|---|---|---|
| **A** | La base y el andamio de trabajo | Saldo inicial arreglado, cadena de seis estados, la vista de "esperando plata", el guardián de índices parciales, Playwright contra el Chrome real, `oxfmt`, los guardianes de espacio y color, y **toda la capa de trabajo de la sección 9**: los cinco hooks, el `CLAUDE.md` partido en cuatro skills, y los tres revisores puestos a trabajar | Es corto y desbloquea todo. Con la cadena vieja, las dos apps se construirían sobre estados que van a desaparecer. Y sin los guardianes, el acabado de B se degrada solo |
| **B** | La app de la oficina | Resumen → empresa → trámite, sin barra lateral, la paleta de Habitualista, las nueve decisiones de la sección 7, y todo lo que se saca | Es lo que ella mira. Es la muestra que tiene que aprobarse |
| **C** | La app de la gestora | La cola de tareas en el teléfono, con el salto en vivo, y la app instalable para que abra sin señal | Es lo que hace que el sistema se alimente solo |

**El Plan B empieza invocando `ui-ux-pro-max` y `design-system`**, antes de escribir una línea de
CSS. Los tokens y la escala se eligen ahí, con la base de datos de paletas y de guías que esas
skills ya traen, y recién después se dibuja. Escrito acá para que no se saltee.

**Y el Plan B incluye un paso de tres variantes:** antes de fijar la pantalla del resumen se
dibujan tres versiones distintas y se elige una mirándolas al lado. Es la única idea de gstack que
valía la pena, y no hace falta instalar nada para hacerla.

---

## 15. Lo que este diseño NO hace

Escrito para que nadie lo suponga:

- **No trae los vencimientos de vuelta.** Los plazos y el cálculo quedan en el historial de git.
- **No manda notificaciones al teléfono.** El salto de tarjeta funciona con la app abierta. Un
  aviso push necesita un service worker y permisos del navegador; es otra etapa.
- **No permite borrar de verdad** nada: ni un movimiento, ni un trámite, ni una línea. Se anulan
  con motivo y quedan a la vista.
- **No separa la base de desarrollo de la de producción.** Sigue siendo una sola, y la app lo
  sigue diciendo en pantalla.
- **No toca el libro mayor ni las policies**, salvo lo que dice la sección 12.

---

## 16. Lo que depende del usuario

1. **Cambiar la contraseña genérica** antes de que haya saldos reales.
2. **La segunda base de Supabase**, antes de cargar el `saldo_inicial` real. Hoy hay una sola y
   el cupo gratuito de la cuenta está en el tope.
3. **Recargar los dos saldos iniciales** en cuanto el Plan A lo destrabe.
4. **La regla escrita de gerencia:** no se deposita contra una foto de cuaderno.

---

## 17. Deuda conocida que este diseño no cierra

- `npm run deadcode` está en rojo desde antes: nueve dependencias sin usar y nueve tipos
  exportados que nadie importa.
- `npm run permisos` devuelve 0 cuando se saltea por falta de token. Un guardián que se saltea en
  silencio y dice que salió bien es medio guardián.
- Las claves foráneas de `tramite_cambios` conservan el nombre viejo `presupuesto_historial_*`.
  Es cosmético: nunca se muestran.
