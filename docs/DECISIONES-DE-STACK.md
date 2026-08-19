# Decisiones de stack — Plataforma de Gestoría

Fecha: 18/08/2026. Estado: **propuesta, esperando tu visto bueno.** Nada de esto está
implementado todavía, que es justo lo que lo hace barato de discutir.

Este documento existe porque preguntaste lo correcto: *"solo te voy a cuestionar usar el mismo
stack, cuando estás haciendo un proyecto nuevo, y podrías analizar qué se hizo mal en el otro
para mejorar en este"*. Tenés razón y el momento es este: el Tablero ya tiene 56 migraciones
corridas y gente usándolo, así que ahí cada cambio de cimiento cuesta caro. Acá no hay nada.

Regla que se respeta en todo el documento, la misma de tus dos proyectos: **si dice
"verificado", al lado está el comando que lo comprueba.** Si no lo pude correr, dice
"sin verificar".

---

## 1. Qué se hizo mal en el Tablero

Antes de proponer nada, el diagnóstico. Todo lo que sigue está tomado de `CLAUDE.md`,
`docs/SISTEMA-VISUAL.md`, `db/README.md` y `.claude/agents/revisor-contable.md` del propio
Tablero — son documentos que el proyecto escribió sobre sí mismo.

**Lo primero que hay que decir, porque cambia la respuesta: la mayor parte del daño no fue del
stack, fue del proceso.** Las cuatro afirmaciones falsas con sello "verificado" (que no había
npm, que `git push` no funcionaba, que el encuadre estaba testeado, que la matriz de cobertura
estaba revisada) le costaron al proyecto más que cualquier decisión técnica. Ninguna se arregla
cambiando de librería. Cambiar de stack para resolver un problema de proceso sería repetir el
error de construir un workflow entero de GitHub Actions para instalar paquetes que se podían
instalar a mano.

Dicho eso, sí hubo decisiones de stack que costaron plata y tiempo. Estas:

### 1.1 Las migraciones se corren a mano, pegándolas en el editor de Supabase

Es el problema más caro de los técnicos, y arrastra a otros cuatro detrás:

- Hay **56 migraciones** que se pegan una por una en Supabase → SQL Editor (`db/README.md`).
- Cada archivo tiene que anotarse solo en `schema_migrations` al final, escrito a mano.
- Hizo falta un test guardián (`src/lib/migraciones.guard.test.ts`) **porque la lista de
  migraciones vigiladas se quedó en la 28 mientras se escribían nueve más**, y el chip de
  Administración decía "Base de datos al día" sin haber mirado ninguna. Entre esas nueve estaba
  la que cerraba un agujero de seguridad.
- Existe `src/lib/esquema.ts`, un "gateado defensivo" que saca columnas de los payloads cuando
  la migración correspondiente no está aplicada. Sin eso, PostgREST falla el update **entero**
  con 42703/PGRST204 por una columna que falta. Es decir: hay código de producción cuyo único
  trabajo es sobrevivir a que el esquema del código y el de la base no coincidan.
- Y lo más caro de todo: en la rutina de cuatro pasos de `CLAUDE.md`, **el paso 2 no lo puede
  cerrar Claude** porque "las migraciones se corren en una máquina a la que no llego". Un paso
  de la rutina depende de que vos estés disponible.

Nada de eso es culpa de Postgres ni de Supabase. Es culpa de no usar la herramienta de
migraciones que Supabase ya tiene.

### 1.2 Los tipos de la base y el código se separan solos

`package.json` tiene el script `gen:types`, pero nada obliga a correrlo. La consecuencia es la
misma de arriba: `esquema.ts`, `schemas.ts` con `validateRows` para "avisar del drift" y
`saneaCards` para "arreglar lo arreglable". Tres capas de defensa contra un problema que se
puede eliminar en vez de mitigar.

### 1.3 Las fechas fallaron tres veces

`.claude/agents/revisor-contable.md`, textual: *"Esto ya falló tres veces"*. El Tablón archivaba
vencimientos tres horas antes y el chip "Venció" usaba la zona del navegador. La causa concreta
es siempre la misma: alguien escribe `new Date().getMonth()` o `toISOString().slice(0,10)` en
vez de pasar por `toARTDate()`.

Ojo con el diagnóstico, porque es fácil errarle: **el problema no fue la falta de una librería
de fechas.** Argentina no tiene horario de verano desde 2009, así que un desplazamiento fijo de
−3 es exactamente correcto. El problema fue que **no había nada que impidiera saltearse el
helper**. Es un problema de guardián, no de dependencia.

### 1.4 El sistema visual se rompió por copia, no por decisión

- **571 tamaños de letra escritos a mano en 20 valores distintos**, decimales incluidos
  (`11.5px`, `12.5px`). Se arregló con la escala de nueve pasos más un test guardián.
- El par `bg-surface rounded-2xl p-[18px]` + sombra estaba **copiado a mano en 23 archivos**,
  ya con dos variantes distintas de sombra. Se arregló con `<Panel>` más otro guardián.
- `box-shadow: var(--ring), var(--shadow)` es CSS inválido y el navegador **descarta la
  declaración entera en silencio**: cinco pantallas venían sin ninguna sombra durante meses.

Los tres son la misma falla: el sistema de diseño vivía repartido entre `tailwind.config.js`
(tipografía) y `src/index.css` (color), y nada conectaba los dos.

### 1.5 El service worker escrito a mano

`public/sw.js` es propio. `CLAUDE.md` §9, textual: *"Después de publicar, la app no cambia sola
en la pantalla de nadie... Si alguien dice 'no veo los cambios', esa es la primera pregunta, no
la última."* Y el fallo de los módulos que se bajan a demanda obligó a escribir
`clasificarFalla` entero para no ofrecer "Reintentar" cuando reintentar no puede funcionar.

### 1.6 `xlsx` tiene una vulnerabilidad alta sin arreglo

**Verificado hoy** con `npm audit` sobre `xlsx@0.18.5`, que es la versión que usa el Tablero:

```
xlsx  *
Severity: high
Prototype Pollution in sheetJS - GHSA-4r6h-8v6p-xvw6
SheetJS Regular Expression Denial of Service (ReDoS) - GHSA-5pgg-2g8v-p4x9
No fix available
```

Ese "No fix available" es real: SheetJS dejó de publicar en el registro público.

### 1.7 El gate de pre-commit tarda de 90 a 180 segundos

Corre `tsc --noEmit` más **toda** la suite. Es tan lento que `CLAUDE.md` tiene que avisar de
pasarle un timeout de 420000 ms a la herramienta que llama a `git commit`. Un gate que duele se
termina salteando.

### 1.8 Setenta y cinco documentos

`CLAUDE.md` §2, textual: *"así se llegó a tener 75 documentos sin saber cuáles decían la
verdad"*. Esto no es stack, pero se previene desde el día uno o no se previene nunca.

---

## 2. Lo que este proyecto tiene de distinto, y que cambia la respuesta

El Tablero organiza **trabajo**. Si un número sale mal, alguien lo mira raro y se corrige.

Esto administra **plata**: saldos de tres Tarjetas Habitualistas, montos reservados, costos
reales discriminados en arancel, prenda y sellados, y lo cobrado al cliente. Un número mal acá
frena un trámite en el registro, o hace que alguien mande a presentar sobre un saldo que no
existe — que es literalmente el problema que se quiere resolver.

Eso mueve dos cosas al primer lugar de la lista, y ninguna de las dos es un problema que el
Tablero haya tenido que resolver:

1. **La aritmética de dinero tiene que ser exacta**, no aproximada.
2. **El saldo tiene que estar al día en dos lugares a la vez** (San Luis y San Juan), porque el
   pisón de saldos entre contable y gerencia es la queja textual del documento.

---

## 3. Las decisiones, capa por capa

Resumen primero; el detalle y el porqué, abajo.

| Capa | Tablero | Gestoría | |
|---|---|---|---|
| Base de datos | Supabase (Postgres + RLS + Auth) | **igual** | se mantiene |
| Migraciones | SQL pegado a mano en el editor | **Supabase CLI** (`supabase/migrations/` + `db push --linked`) | **cambia** |
| Tipos de la base | script manual, se desincroniza | **generados + test que falla si están viejos** | **cambia** |
| Dinero | — | **`numeric(14,2)` en la base, centavos enteros en JavaScript** | **nuevo** |
| Fechas | helper a mano, falló 3 veces | helper a mano **+ guardián que prohíbe saltearlo** | **cambia el guardián** |
| Framework | React 19 + Vite | **igual** | se mantiene |
| Ruteo | no hay | **TanStack Router** | **nuevo** |
| Estilos | Tailwind 3 (config JS) + index.css | **Tailwind 4** (`@theme`, todo en CSS) | **cambia** |
| Componentes | Panel/Modal/Skeleton a mano | **shadcn/ui (Radix)** para lo accesible + Panel propio | **cambia** |
| Tablas | a mano | **TanStack Table + Virtual** | **nuevo** |
| Formularios | a mano | **React Hook Form + zod** | **nuevo** |
| Datos | TanStack Query | **igual + Supabase Realtime** | se amplía |
| Excel | `xlsx` (alta, sin arreglo) | **`write-excel-file`** (0 vulnerabilidades) | **cambia** |
| App instalable | `sw.js` propio | **vite-plugin-pwa** con aviso de versión nueva | **cambia** |
| Tests | vitest | **igual**, pero el pre-commit corre sólo lo afectado | proceso |
| Lint | oxlint | **igual** | se mantiene |
| Despliegue | Cloudflare Pages | **igual** | se mantiene |
| Gráficos | SVG propio | **igual** | se mantiene |

### 3.1 Supabase se queda. No es inercia.

Lo evalué contra las alternativas reales y gana por un motivo que este proyecto necesita más
que el Tablero: **los permisos se aplican en la base, no en la pantalla.** La diapositiva 8 de
tu propia presentación lo dice mejor que yo: *"es la diferencia entre esconder un botón y que el
dato realmente no se pueda tocar"*. Acá eso deja de ser una linda frase y pasa a ser el
requisito de que una gestora no llegue nunca al monto cobrado al cliente.

Lo que descarté y por qué:

- **Neon / Postgres pelado + API propia.** Habría que escribir autenticación, sesiones y control
  de acceso a mano. Es más código propio para mantener, escrito por una sola persona, en la capa
  donde un error se paga con datos expuestos.
- **Firebase.** El modelo de datos no es relacional y esto es contabilidad: hay razones sociales,
  tarjetas, trámites, movimientos y conciliación. Sin `join` y sin transacciones, la mitad de los
  informes se vuelven código de aplicación.
- **PocketBase / algo autoalojado.** Necesita un servidor que alguien mantenga. No hay quién.

Sumado a esto: ya tenés una cuenta funcionando, ya sabés dónde se miran los logs, y el patrón de
helpers `SECURITY DEFINER` para evitar la recursión 42P17 ya está probado en el Tablero. Eso es
conocimiento que se reusa, no deuda que se hereda.

### 3.2 Migraciones con el CLI de Supabase. Este es el cambio más importante.

**Verificado hoy**, sin permisos de administrador:

```bash
npm install supabase@2.115.0        # EXIT 0
./node_modules/.bin/supabase --version   # 2.115.0
```

Y lo que importa, del `--help` del propio CLI:

- `supabase db push --linked` → *"Push new migrations to the remote database... Pushes to the
  linked project."*
- `supabase gen types --linked` → genera los tipos TypeScript desde el esquema real.

**Docker sólo hace falta para `--local` / `supabase start`**, que no vamos a usar. Contra el
proyecto remoto enlazado no hace falta, y por eso esto entra sin pedirle permisos de
administrador a nadie.

Qué desaparece con esto, y no es poco:

- Pegar SQL a mano, 56 veces y contando.
- La tabla `schema_migrations` mantenida a mano al final de cada archivo.
- El test guardián que existe porque esa lista se quedó vieja.
- Buena parte de `esquema.ts`: si los tipos se generan del esquema real y hay un test que falla
  cuando están desactualizados, el drift no llega a producción.
- **Y el paso 2 de tu rutina deja de depender de que vos estés sentado en la máquina.**

El costo, dicho sin maquillaje: hay que generar un token de acceso de Supabase, igual que
hiciste con el de GitHub. Es un paso tuyo, una sola vez.

### 3.3 El dinero se guarda en centavos enteros

Esta es la decisión que más me importa de todo el documento.

En JavaScript, `0.1 + 0.2` no da `0.3`. Sobre un trámite suelto no se nota; sobre un libro mayor
que suma miles de movimientos para mostrar un saldo, sí — y se nota como una diferencia de
centavos que nadie puede explicar, en la pantalla que la gente usa para decidir si manda a
presentar un trámite. Un saldo que no cierra por dos centavos destruye la confianza en el
sistema entero, y con razón.

**Decisión, corregida el 18/08/2026 mientras se escribía el plan.** La primera versión de este
documento decía "todo en `bigint` de centavos, también en la base". Estaba sobrecorregido: la
aritmética de `numeric` en Postgres **ya es exacta**, y pasar la base a centavos enteros no
agrega precisión — sólo vuelve ilegible cualquier consulta hecha a mano, que es justo lo que
alguien va a necesitar el día que un saldo no cierre. Va el 16 %, no el 45 %:

- **En Postgres: `numeric(14,2)`.** Toda suma de importes ocurre en vistas SQL, y ahí es exacta.
  Nunca `float`, `real` ni `double precision`.
- **En JavaScript: nunca aritmética sobre el decimal.** Acá sí está el peligro real. PostgREST
  devuelve `numeric` como número JSON, y en JavaScript `1234.10` no es exactamente 1234,10:
  sumar seis mil de esos deriva. Al cruzar el borde se convierte con `Math.round(v * 100)` a
  centavos enteros, se calcula en enteros, y se formatea desde enteros.
- **Un solo módulo `src/lib/plata.ts`**, y un guardián que falla si aparece `+`, `-`, `*` o `/`
  sobre un campo de importe fuera de ahí.

Los números cierran: el trámite más caro de la imagen 03 es `$ 1.294.511,00`, o sea 129.451.100
centavos. El entero seguro de JavaScript llega a 9.007.199.254.740.991 — hay margen de sobra
para cualquier saldo que este grupo llegue a mover.

**Sin verificar:** si PostgREST devuelve `numeric` como número JSON o como texto en esta versión
de Supabase. El borde acepta las dos formas y valida, así que no bloquea; se comprueba con una
consulta real apenas exista el proyecto. Lo escribo así de explícito porque es exactamente el
tipo de detalle que en el Tablero se dio por sabido y después costó cinco pantallas sin sombra.

### 3.4 Fechas: el guardián, no la librería

Ya lo argumenté arriba. Argentina no tiene horario de verano, así que no hace falta ninguna
dependencia nueva: `Intl.DateTimeFormat` con `timeZone: 'America/Argentina/Buenos_Aires'` lo
resuelve nativo.

Lo que sí hace falta, y es lo que faltó tres veces en el Tablero, es un **test guardián** que
falle si aparece `getMonth`, `getDate`, `getFullYear` o `toISOString().slice(0,10)` en cualquier
archivo que no sea `src/lib/fechas.ts`. Una regla en prosa se pudre; un test no.

### 3.5 React 19 + Vite se quedan, y acá sí hay algo de inercia — deliberada

Miré Svelte y Solid. Los dos dan menos código para lo mismo. No los elijo, por dos motivos
concretos:

1. **Esto lo mantiene una sola persona que no es programadora.** Tener dos proyectos con el
   mismo lenguaje, la misma forma de componente y el mismo modelo mental vale más que la elegancia
   de un tercer framework.
2. **Hay piezas del Tablero que se reusan tal cual y ya están pagadas en errores**: la
   clasificación de fallas de `fallas.ts`, el esqueleto de carga, el `ErrorBoundary`, la escala
   tipográfica, el `Panel`. Empezar en otro framework las tira todas.

Es inercia, sí, pero es la clase de inercia que ahorra trabajo en vez de esconder deuda.

### 3.6 Tailwind 4 en vez de 3

En Tailwind 4 la configuración vive en el CSS (`@theme`), no en un `tailwind.config.js` aparte.
Eso arregla exactamente la fractura de la §1.4: hoy el color está en `index.css` y la escala
tipográfica en `tailwind.config.js`, y nada conecta los dos archivos. En 4 son el mismo archivo.

Versión disponible **verificada** con `npm view tailwindcss version` → `4.3.3`.

El costo, dicho: Tailwind 4 exige navegadores modernos (Chrome 111+, Safari 16.4+). Para las PC
del concesionario y los celulares de las gestoras no es un problema, pero queda escrito por si
aparece una máquina vieja.

### 3.7 shadcn/ui para lo accesible, Panel propio para lo de marca

El Tablero escribió su `Modal` a mano y después tuvo que agregar pruebas de accesibilidad con
axe. Los diálogos, los desplegables y los buscadores accesibles son un problema resuelto: foco
atrapado, cierre con Escape, lectores de pantalla, navegación con teclado.

**Decisión:** shadcn/ui (que es Radix por debajo) para Diálogo, Select, Popover, Command y Toast.
Se copian al repositorio, no son una dependencia que actualice sola. El `Panel`, los colores y la
tipografía siguen siendo nuestros, porque ahí está la marca.

### 3.8 TanStack Table + Virtual: esta app *es* una tabla

Mirá la imagen 03: el listado de Operaciones de Pago tiene un botón **"Columnas"**. La clienta
pidió textualmente *"un formato similar a lo que estamos acostumbradas a manejar"*. Y la planilla
que reemplazamos tiene **6.868 filas**.

Ordenar, filtrar, elegir columnas y dibujar sólo las filas visibles es trabajo que ya está hecho
y probado. Escribirlo a mano sería el mismo error que escribir el `Modal` a mano.

### 3.9 `write-excel-file` en vez de `xlsx`

**Verificado hoy:**

| Paquete | Versión | `npm audit` |
|---|---|---|
| `xlsx` | 0.18.5 | **1 alta, sin arreglo disponible** |
| `exceljs` | 4.4.0 | 2 moderadas (por `uuid` transitivo) |
| `write-excel-file` | 4.1.1 | **0 vulnerabilidades** |

`write-excel-file` sólo escribe, que es lo único que la app necesita. Para **entrar** datos no
hace falta ninguna librería: el listado de Habitualista se copia de la pantalla y se pega, y eso
llega como texto separado por tabulaciones — se parsea con código propio de veinte líneas. Y la
importación del Excel histórico es un script de una sola vez, que corre fuera de la app y no
carga nada en el navegador de nadie.

Resultado: **el lector de Excel desaparece del paquete que baja el usuario.** Menos peso y menos
superficie de ataque.

### 3.10 Realtime de Supabase para el saldo

El documento pide *"visualizar en tiempo real"* y la queja concreta es que **se pisan los saldos
entre San Luis y San Juan**. TanStack Query solo no alcanza: refresca cuando la pestaña vuelve al
foco, no cuando la otra persona carga un movimiento.

Con una suscripción de Realtime sobre la tabla de movimientos, si gerencia carga un ingreso en
San Juan, el saldo de contable en San Luis cambia sin que nadie recargue. Es la función central
del producto, no un adorno.

### 3.11 El resto

- **PWA con `vite-plugin-pwa`** en modo autoactualización, con un aviso visible de "hay una
  versión nueva". Reemplaza al `sw.js` escrito a mano y mata el *"no veo los cambios"*.
- **Ruteo con TanStack Router.** El Tablero no tiene ruteo y por eso ninguna pantalla tiene
  dirección propia. Acá una gestora tiene que poder abrir un trámite puntual desde un enlace. Es
  la decisión más discutible de la lista y la marco como tal: si te parece de más, se saca y se
  vive con pantallas sin dirección.
- **React Hook Form + zod.** El alta de un trámite tiene quince campos y los costos reales tres
  más. `zod` ya lo usás.
- **Pre-commit rápido:** `tsc --noEmit` + lint + **sólo los tests afectados**. La suite completa
  corre en GitHub Actions. Un gate de diez segundos se respeta; uno de tres minutos se saltea.
- **Tope de documentación, escrito desde el día uno:** un `CLAUDE.md`, un `docs/ESTADO.md`, y los
  planes en `docs/superpowers/plans/`. Ningún documento nuevo sin dueño y sin fecha de descarte.

### 3.12 Lo que se agrega después de investigar el dominio y releer los dos proyectos

Seis piezas. **Cinco de las seis salen de un agujero que el propio Tablero tiene documentado y
abierto**, así que no son gusto mío: son deuda conocida que este proyecto puede no contraer.

| Pieza | Por qué | De dónde sale |
|---|---|---|
| **Monitoreo de errores (Sentry)** desde el día 1 | Hoy en el Tablero la única forma de enterarse de un error en producción es que alguien avise por WhatsApp | Su propio `docs/SEGURIDAD.md` lo llama *"el mayor riesgo operativo real"* y lo recomienda como **la única herramienta externa a incorporar sin reservas** |
| **`ErrorBoundary` desde el día 1** | Sin él, un error de render deja la pantalla **en blanco**, sin mensaje y sin que nadie se entere | Mismo documento, §1.7 |
| **Detección de secretos en pre-commit y CI** | En el Tablero **una contraseña quedó en el historial de git**, severidad ALTA, y sigue ahí | Mismo documento, resumen ejecutivo |
| **Proyecto de Supabase separado para desarrollo** | En el Tablero las previews apuntan a la **misma base que producción**, con la advertencia escrita *"ojo con datos de prueba destructivos"* | `docs/FLUJO-DEV.md` del Tablero |
| **Respaldo derivado del esquema, no de una lista a mano** | El backup del Tablero recorre un arreglo de tablas escrito a mano: *"si agregás una tabla nueva y no la sumás ahí, el backup no la incluye"*. Ya se le escapa una tabla | `docs/BACKUP-RESTORE.md` del Tablero |
| **Chequeo diario de integridad del libro mayor** | Que las sumas cierren, que no haya reservas huérfanas, y que ningún trámite pase su plazo sin que nadie lo vea | Nuevo. Sale de `docs/DOMINIO.md` |

Sobre Sentry, las condiciones que el análisis del Tablero ya dejó escritas y que se respetan:
`sendDefaultPii: false`, `tracesSampleRate: 0`, y **una segunda sesión de ajuste a la semana**
para filtrar ruido — errores de extensiones del navegador, `ResizeObserver loop`, 404 de módulos
después de un deploy. Una alerta que nadie mira es ruido, y el ruido entrena a ignorar también las
que importan.

Y una que **no** es herramienta y vale más que las seis: **el respaldo del libro mayor se prueba
restaurándolo.** Un backup que nunca se restauró no es un backup, es un archivo.

### 3.13 Lo que agrega el dominio: `plazos` y `canal`

De `docs/DOMINIO.md` salen exactamente **dos columnas y una tabla**. No es una funcionalidad
nueva grande; es lo que hace que la pantalla que ya existía sirva para decidir.

- **Tabla `plazos`** — cada plazo legal con su norma citada, su valor, la fecha en que se
  verificó y quién lo verificó. Ningún plazo escrito en el código, **nunca**.
- **`tramites.canal`** (`presencial` | `runa`) — una columna. Permite que el reporte muestre el
  costo por canal y que los propios datos de la empresa contesten si conviene el canal digital,
  que según la Disposición 745/2025 baja el arancel de inscripción inicial del 1% al 0,8%.
- **`tramites.vence_el`** — campo derivado del plazo que aplique según tipo y fecha de origen.

---

## 4. Lo que NO cambio, aunque se podría

Para que quede claro que esto no es cambiar por cambiar:

- **TypeScript, vitest, oxlint, Playwright, Cloudflare Pages, GitHub**: se quedan igual. Andan.
- **Gráficos en SVG propio**: no entra ninguna librería de gráficos. Los dos o tres gráficos que
  pide el proyecto (evolución del saldo, costos por tipo de trámite) se dibujan a mano.
- **npm**: verificado que anda (`npm ping` → PONG). Nada de cambiar a pnpm o bun por moda.
- **La identidad visual entera**: monocromo, el color sólo en estados, Inter Variable, isotipo
  vectorizado, cero emojis, voseo. Eso no se toca.

---

## 5. Lo que verifiqué y lo que no

| Afirmación | Estado | Cómo se comprueba |
|---|---|---|
| node v22.17.0 + npm 10.9.2 con registro accesible | **verificado** | `node --version`; `npm ping` → PONG |
| CLI de Supabase instala sin admin | **verificado** | `npm install supabase@2.115.0` → EXIT 0 |
| `db push` empuja al proyecto remoto enlazado | **verificado** | `supabase db push --help` → flag `--linked` |
| Docker sólo hace falta para el modo local | **verificado** | `supabase db push --help` → `--local` vs `--linked` |
| `xlsx@0.18.5` tiene una alta sin arreglo | **verificado** | `npm audit` sobre ese paquete |
| `write-excel-file@4.1.1` tiene 0 vulnerabilidades | **verificado** | `npm audit` sobre ese paquete |
| Versiones de todas las dependencias propuestas | **verificado** | `npm view <paquete> version` |
| Cómo serializa PostgREST un `numeric` | **sin verificar** | consulta real cuando exista el proyecto |
| Que shadcn/ui funcione con Tailwind 4 en esta máquina | **sin verificar** | se comprueba en la tarea 1 del plan |
| Que Realtime alcance el rendimiento necesario | **sin verificar** | se mide con datos reales en la etapa 1 |

---

## 5B. Dónde paro, y por qué agregar más sería contraproducente

Me pediste que siguiera pensando hasta poder decir que agregar algo más empeora el proyecto.
Llegué a ese punto, y ésta es la lista de lo que **consideré en serio y descarto**. La razón es
casi siempre la misma, y está escrita en el propio análisis de seguridad del Tablero:

> *"la mayoría del catálogo típico de herramientas no aplica acá y agregarlo sería un retroceso.
> Todo eso presupone un equipo que responda a las alertas. Acá hay una persona. Una alerta que
> nadie mira es ruido, y el ruido entrena a ignorar también las alertas que sí importan."*

| Descartado | Por qué |
|---|---|
| **Sincronización sin conexión completa** para las gestoras | Es la más tentadora y la más peligrosa. Una cola de mutaciones que se reconcilia sola, sobre un libro mayor de plata, puede duplicar un débito o aplicar uno viejo sobre un saldo nuevo. **En su lugar:** el formulario del teléfono guarda el borrador en el dispositivo, así no se pierde lo escrito si se corta la señal. Veinte líneas contra una arquitectura entera, y cubre el caso real. |
| **Librería de gráficos** (Recharts, visx, Chart.js) | Son dos o tres gráficos simples. SVG a mano, cero dependencias, cero peso. |
| **Librería de estado** (Redux, Zustand, Jotai) | TanStack Query ya es el estado del servidor, que es el 95% del estado de esta app. |
| **Monorepo, Docker, Storybook, GraphQL, microservicios** | Cada uno resuelve un problema de coordinación entre equipos. Acá hay una persona. |
| **Escáneres SAST comerciales, WAF, SIEM, pentesting automatizado** | Presuponen alguien que triage las alertas. Ver la cita de arriba. |
| **Analítica de producto** (Posthog, Amplitude) | Cuatro usuarias. Preguntarles es más rápido, más barato y más honesto. Y medir el uso individual choca de frente con la regla de no medir personas. |
| **Notificaciones push** | Suenan bien y son la puerta de entrada al ruido. El sistema ya tiene dónde mirar; si algo hay que avisar, se avisa por WhatsApp, que es donde la gente ya está. Se reevalúa después de tres meses de uso, con datos. |
| **Firma digital de documentos dentro del sistema** | Es un producto entero, con requisitos legales propios. La firma de gerencia sigue siendo física. |
| **Integración automática con Quiter** | El sistema no reemplaza a Quiter y no debe intentar hablarle. Se registra si un trámite ya se imputó, y nada más. |
| **Leer el sitio de Habitualista automáticamente** | Decidido desde el principio y se sostiene: depende de credenciales que no controlamos y de un sitio que puede cambiar sin aviso. Es la pieza más frágil imaginable y no la controlamos. |
| **Cálculo automático del arancel** a partir del valor del vehículo | Tentador —hay una fórmula publicada— y **es exactamente donde este proyecto se puede lastimar**. Los aranceles publicados son del 01/09/2024 y sus montos nominales están vencidos. Un presupuesto calculado solo, con números viejos, sería un número inventado con cara de oficial. El sistema **compara** contra lo que carga la gestora; no lo reemplaza. |

**El criterio que las une:** este proyecto gana por lo que le saca a la operación, no por lo que
le agrega al stack. Cada pieza que entra tiene que traer escrito a quién ayuda **y cuándo se
descarta si no sirvió**. Ninguna de las de arriba pasa esa prueba hoy.

---

## 6. Lo que necesito de vos

1. **El visto bueno a este documento**, o las objeciones. Sobre todo a TanStack Router y a
   Tailwind 4, que son las dos más discutibles.
2. **Las dos preguntas del material fuente que siguen abiertas**, y que bloquean el modelo de
   datos:
   - El documento nombra **tres** razones sociales (Paris Autos, Paris Cars, Paris Motor) pero la
     planilla tiene **cinco** hojas: además DORAL CHEVROLET y PARIS TRAC. ¿Esas dos tienen Tarjeta
     Habitualista propia, o pagan con la de alguna de las otras?
   - La planilla tiene **dos columnas llamadas QUITER** (H y K) y una que el encabezado corta
     (J, parece "RENDICIÓN"). ¿Qué significa cada una?
3. **Saber si el límite de gasto mensual se puede levantar.** El diseño quedó a mitad de camino
   por eso, y el modo subagente que pediste no funciona hasta que se resuelva.
