# CLAUDE.md

**Gestoría — Grupo Paris.** Plataforma compartida entre gerencia, administración contable y
gestoría para los trámites del automotor y la cuenta corriente de las Tarjetas Habitualistas.

Este archivo se carga en cada sesión. Leelo antes de tocar nada.

Es el proyecto hermano del **Tablero Contable**: misma empresa, misma marca, mismo método, y
deliberadamente el mismo aspecto — alguien que usa los dos no tiene que sentir que cambió de
empresa. Y es el tercero de la casa, así que arranca con dos post mortem escritos: los `CLAUDE.md`
del Tablero y del Estudio Contable Magni. **Todo lo que está acá salió de algo que ya se rompió
en alguno de los dos.**

---

## 1. Qué es esto y qué promete

Hoy la operación vive en tres lugares que no se hablan: una foto de un cuaderno que llega por
WhatsApp, una planilla de Excel de más de 6.800 filas, y el sitio de la Tarjeta Habitualista que
cada uno mira por su cuenta. San Luis lo lleva contable y San Juan lo lleva gerencia, y **se pisan
los saldos** porque no hay un listado unificado.

**Posicionamiento:** una herramienta de trabajo tan seria como la plata que administra. Sin ruido
visual, sin nada que compita con los números.

**La frase que ordena el producto**, y no está en el pedido con estas palabras pero es lo que el
pedido describe: **cada trámite es un reloj con plata adentro.** Un trámite frenado no es una
demora, es un recargo. Ver `docs/DOMINIO.md`, que es de lectura obligatoria antes de tocar la
lógica de plazos.

**Lo que el sistema NO hace**, escrito para que nadie lo suponga: no entra al sitio de
Habitualista, no guarda credenciales, no paga nada, no reemplaza a Quiter, no controla si el
cliente pagó, **no mide personas**, y no decide por nadie.

---

## 2. Entorno — verificado el 18/08/2026

Al lado de cada línea, el comando que lo comprueba. Si algún día una de estas afirmaciones te
obliga a un camino caro, **probá primero el camino barato**: cuesta diez segundos y en el Tablero
esta misma regla habría ahorrado dos meses de trabajo inútil, dos veces.

| Qué | Estado | Comando |
|---|---|---|
| `node` portable | v22.17.0 | `export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH"; node --version` |
| `npm` con registro | 10.9.2, PONG | `npm ping` |
| `git` | 2.54.0 | `git --version` |
| `python` | 3.14.6 | `python --version` |
| CLI de Supabase | 2.115.0, instala sin admin | `npx supabase --version` |
| `gh` | **no está** | `which gh` → vacío |

**No hay permisos de administrador en esta máquina y no hacen falta.** Docker tampoco: el CLI de
Supabase sólo lo necesita para el modo `--local`, y acá se trabaja siempre contra el proyecto
remoto enlazado (`--linked`).

**Ni `node` ni `npm` están en el PATH por defecto.** Están, pero hay que ponerlos: cualquier
comando arranca con `export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH"`.

**Consecuencia que ya costó tres intentos fallidos el 19/08/2026:** todo lo que arranca un
proceso **desde afuera del shell** —`.claude/launch.json`, una tarea programada, cualquier
integración— no hereda ese PATH y tiene que llamar al binario con ruta absoluta. Y no alcanza con
apuntar a `npm.cmd`: ese script después invoca a `node`, que tampoco se encuentra, y el error que
tira (`""node"" no se reconoce como un comando`) no dice de dónde viene.

Lo que sí funciona, y es el patrón que ya usa el Tablero:

```json
"runtimeExecutable": "C:\\Users\\Vmagni\\tools\\node-v22.17.0-win-x64\\node.exe",
"runtimeArgs": ["node_modules/vite/bin/vite.js"]
```

**El servidor de desarrollo usa el puerto 5173 con `strictPort`.** Si está ocupado, falla en vez
de correrse a 5174 en silencio — porque esa URL está anotada en las *Additional redirect URLs* de
Supabase Auth, y un cambio de puerto rompería el login con un síntoma que no apunta al puerto.

**Códigos de salida.** `comando | tail` devuelve el estado de `tail`, no del comando. Siempre:

```sh
comando > /tmp/log 2>&1; echo "EXIT: $?"; tail -20 /tmp/log
```

---

## 3. El método: 5S, Kaizen y lo que faltaba nombrar

Los valores del Tablero son 5S y Kaizen. Acá se mantienen y se les agregan tres conceptos del
mismo sistema que los otros dos proyectos **practican sin nombrar** — y lo que no tiene nombre no
se puede exigir en una revisión.

Cada uno abajo tiene su mecanismo concreto en este proyecto. **Un valor sin mecanismo es una
decoración.**

### Seiri — clasificar: sacar lo que no se usa

- YAGNI. `knip` en CI para código muerto.
- **Tope de documentación, desde el día uno:** este archivo, `docs/ESTADO.md`, `docs/DOMINIO.md`
  y los planes. Ningún documento nuevo sin dueño y sin fecha de descarte.
- Toda función nueva trae escrito **qué mide, a quién ayuda y cuándo se descarta si no sirvió**.
  Sin criterio de descarte no entra: una propuesta sin fecha de revisión es un compromiso
  permanente disfrazado de experimento.

*Por qué:* el Tablero llegó a **75 documentos sin saber cuáles decían la verdad**.

### Seiton — ordenar: un lugar para cada cosa

- La tabla de nombres del plan manda. Un concepto, un nombre, en toda la base y en todo el front.
- Un módulo por asunto. `plata.ts` es el único que hace aritmética de importes; `fechas.ts` el
  único que toca calendario; `plazos.ts` el único que calcula un vencimiento.
- Los tokens de color y la escala tipográfica viven **en un solo archivo**.

*Por qué:* en el Tablero aparecieron dos `ordenarConsultas` exportadas con la misma firma y
comportamiento distinto, y la escala tipográfica vivía en un archivo y el color en otro, sin nada
que los conectara.

### Seiso — limpiar: dejarlo sin defectos a la vista

- Los cuatro comandos en 0, siempre, con la salida pegada.
- Cero advertencias toleradas. Una advertencia permanente entrena a ignorar las advertencias.

### Seiketsu — estandarizar: que lo limpio sea lo normal

- Sistema de diseño con guardianes. Plantilla de migración. Plantilla de plan.
- Toda migración trae adentro su bloque **"cómo comprobar que quedó bien"**.

### Shitsuke — disciplina: que se cumpla sin que nadie mire

- Hook de pre-commit (tipos, lint, tests afectados) y CI (la suite completa).
- **Ninguna etapa cierra sin una revisión de alguien que no la escribió.**

*Por qué:* la matriz de cobertura del Tablero **se declaró completa a sí misma**, y una revisión
independiente encontró once hallazgos adentro, incluida una contraseña en texto plano.

### Poka-yoke — a prueba de errores

**Es el concepto que mejor describe lo que este diseño hace, y ninguno de los dos proyectos
anteriores lo nombra.** Un poka-yoke no avisa del error: lo hace imposible.

Ante cada regla, la pregunta de diseño es una sola:

> **¿Puede la base hacerlo imposible, en vez de que el front lo pida por favor?**

En este proyecto son poka-yokes, y hay que reconocerlos como una familia:

| Mecanismo | Qué vuelve imposible |
|---|---|
| Índice único de una reserva por trámite | Que guardar dos veces el presupuesto debite dos veces |
| Índice único de patentamiento por dominio | Patentar dos veces el mismo 0km |
| `check` de signo por tipo de movimiento | Un ingreso negativo que da vuelta el saldo entero |
| Sin policy de UPDATE ni DELETE en `movimientos` | Que alguien edite el libro mayor y el saldo de ayer deje de ser reconstruible |
| Trigger de transición de estado | Saltearse un paso del circuito, o hacerlo con el rol que no corresponde |
| Bloqueo de columnas **por diferencia de jsonb** | Que una columna agregada mañana quede desprotegida por olvido |
| `cobros` en otra tabla, no en otra columna | Que una gestora llegue al margen por cualquier camino |
| Los guardianes de tipografía, `Panel` y casa | Que el sistema visual se separe por copia |
| `security_invoker` en toda vista | Que una vista saltee la RLS entera en silencio |

**Regla dura:** un poka-yoke que nunca se vio fallar no es un poka-yoke. Cada guardián se prueba
metiéndole la violación a mano y **mirándolo en rojo** antes de darlo por bueno.

### Andon — parar la línea cuando aparece un defecto

- **Con defectos abiertos no entran funciones nuevas.** Si estás por escribir una función nueva y
  hay hallazgos abiertos, estás en el paso equivocado.
- La app tiene un botón para avisar un problema, que adjunta solo el contexto técnico. Quien lo
  aprieta no tiene que saber explicar nada.
- **Y el sistema mismo avisa:** monitoreo de errores desde el día uno. En el Tablero, la única
  forma de enterarse de un error en producción es que alguien avise por WhatsApp — su propio
  análisis de seguridad lo marca como el mayor riesgo operativo abierto.

*Por qué el orden importa:* una función nueva encima de un cálculo roto produce números falsos
con más confianza. En Toyota es doctrina: no se mejora un proceso inestable, primero se lo
estabiliza.

### Genchi genbutsu — ir y ver

**Una pantalla no está lista cuando compila ni cuando el test pasa. Está lista cuando alguien la
miró, en el dispositivo real, con datos reales.**

- El Excel exportado se **abre y se mira**, no alcanza con que el test pase.
- Las pantallas del teléfono se prueban **en un teléfono, parado, con una mano**.
- El saldo se compara contra el sitio de Habitualista **el mismo día**.

*Por qué:* los tres peores defectos del Estudio Magni se descubrieron mirando, no testeando — el
emoji que sobrevivía al filtro, el tablero en blanco por una cabecera, y la firma que publicaba un
garabato gris. **Ningún test los agarró.**

### Kaizen — mejora continua, con evidencia

- Cada etapa cierra con una retrospectiva que produce **una** mejora concreta, escrita.
- El `CHANGELOG` se escribe **en lenguaje de usuario**, no de commit.
- `docs/ESTADO.md` lleva los números contados de nuevo, incluidos los commits sin publicar.

---

## 4. La regla que manda sobre todas

> **Si escribís "verificado", escribí al lado el comando o el archivo:línea que lo comprueba.**
> Si no podés, escribí "sin verificar". Las dos son respuestas válidas; inventar la primera, no.

Los dos proyectos anteriores se lastimaron **cuatro veces** con la misma forma exacta: se escribió
la conclusión sin correr la comprobación, con el sello "Verificado" al lado, y a partir de ahí
nadie volvió a probarlo. *"NO hay npm"*, *"`git push` falla"*, *"el encuadre está verificado por
tests"*, y una matriz de cobertura que decía "Revisada" sobre áreas que nadie miró.

**Una afirmación con el sello "Verificado" deja de revisarse.** Ése es el mecanismo, y por eso la
regla no es "estar seguro" —que nadie puede— sino la versión chica que sí se puede cumplir.

---

## 5. Reglas duras del producto

- **Cero emojis.** Ni en la interfaz, ni en los mensajes, ni **en la documentación**. Íconos sólo
  de `lucide-react`. Ojo con `ℹ` (U+2139): Unicode lo clasifica como **letra**, no como símbolo,
  así que se escapa de cualquier filtro por categoría. El guardián lo contempla.
- **No se mide a las personas.** Ni rankings, ni conteos por gestora, ni comparaciones. Hay
  guardián. Esto no es cortesía: **el día que exista un ranking de gestoras, los presupuestos se
  cargan tarde y redondeados, y el comprometido —que es la razón de ser del sistema— pasa a ser
  mentira.** Es el modo de falla más probable del proyecto y no es técnico.
- **Español de Argentina, voseo**, tono directo, sin jerga técnica en la interfaz. Un error nunca
  muestra el mensaje crudo de la base.
- **Ningún plazo ni arancel escrito en el código.** Van en tablas, con la norma citada, la fecha
  de verificación y quién verificó. La pantalla muestra esa fecha al lado del plazo. Un sistema
  que avisa un vencimiento equivocado es **peor** que uno que no avisa nada, porque el primero se
  deja de mirar.
- **Nada se borra.** Un trámite se anula con motivo; un movimiento se compensa con un ajuste.
- **Comentarios en español que explican el POR QUÉ**, no el qué. La densidad alta es deliberada:
  esto lo mantiene una sola persona que no es programadora.

---

## 6. Marca — la misma del Tablero, sin reinterpretar

Manual completo: `tablero-contable-v2/docs/marca/IDENTIDAD-MARCA.md`. Lo mínimo:

- **Isotipo y lockup**: los archivos reales de `tablero-contable-v2/public/brand/`. Es el logo de
  Grupo Paris vectorizado con potrace desde el original, no un ícono genérico ni una
  interpretación. **Se copia, no se redibuja.** Cuando el pedido es "que sea igual", se calca:
  medido en el Estudio Magni, el redibujo daba 15,40 de diferencia y el calco 3,61.
- Blanco sobre fondos oscuros, negro sobre claros. Nunca coloreado, deformado ni con sombra.
- **Tipografía:** Inter Variable, local, sin CDN. Escala de nueve pasos, `text-2xs` a `text-4xl`.
  Nunca un tamaño a mano.
- **Color:** monocromo. El color aparece **sólo** en estados: `--done`, `--warn`, `--danger`.
  En un sistema donde lo que importa es si algo vence o si falta plata, un color "de marca" en un
  botón compite con la única señal que importa.
- **Números:** todos con `.tnum`, o las columnas bailan.
- **La trampa que costó cinco pantallas sin sombra durante meses:** `--ring` es un **color**,
  `--ring-sh` es una **sombra**. `box-shadow: var(--ring), var(--shadow)` es CSS inválido y el
  navegador **descarta la declaración entera, en silencio**.

---

## 7. Capa de datos

- **Las migraciones se corren con el CLI**, no pegando SQL a mano: `npm run db:push`. Los tipos
  se generan con `npm run db:tipos` y hay un chequeo en CI que falla si quedaron viejos.
  **Consecuencia: acá no existe `esquema.ts`.** Ese archivo en el Tablero es código de producción
  cuyo único trabajo es sobrevivir a que el esquema del código y el de la base se separen; acá el
  problema no llega a existir.
- **El saldo no es un campo: es la suma de un libro mayor de sólo-inserción.** Un campo mutable
  con dos escritores es exactamente el objeto que se pisa, y el pisón de saldos es el problema que
  el proyecto viene a resolver.
- **RLS: nunca una subconsulta a `perfiles` dentro de una policy de `perfiles`** — recursión
  infinita (42P17), que devuelve 500 en **todas** las tablas. Todo pasa por helpers
  `SECURITY DEFINER` con `stable` y `set search_path = public`.
- **Toda vista lleva `security_invoker = true`.** Sin eso corre como su dueño y saltea la RLS
  entera.
- **Nunca correr `force row level security` sobre `movimientos`.** El dueño de una tabla está
  exento de RLS salvo con FORCE; con FORCE, el trigger que inserta la reserva deja de poder
  escribir, y el síntoma es el peor posible: la pantalla dice que guardó y el saldo no se mueve.
- **La plata es `numeric(14,2)` en Postgres y centavos enteros en JavaScript.** En JavaScript
  `1234.10` no es exactamente 1234,10 y sumar miles deriva. Un solo módulo, con guardián.

---

## 8. Cómo trabajar acá

- **TDD.** Test primero, verificar que falla **por la razón esperada**, después implementar.
- **Si un aserto de un plan resulta incorrecto, no lo ajustes para que pase.** Pará y reportalo.
  En el Tablero pasó dos veces que el test estaba mal y el código bien, y una que el test mal
  habría forzado justo el bug que se quería evitar.
- **Antes de escribir una función, buscá si ya existe.** La duplicación es un defecto, no un
  detalle.
- **Nunca editar JSX con expresiones regulares ni `sed`.** Ya pasó: dejó un `</div>` donde iba un
  `</Panel>`.
- **Una tarea por vez, terminada, revisada por alguien que no la escribió.**

---

## 9. Publicar

`dev` → preview de Cloudflare → `main` = producción. Antes de cada push a `main` con
funcionalidad visible: los cuatro comandos en 0 y la entrada nueva del `CHANGELOG`.

**`git push` funciona desde acá.** Si algún día parece que no, probalo antes de asumirlo: en el
Tablero esa suposición costó **30 commits sin publicar**, incluido el arreglo de un defecto de
seguridad, y el dueño abrió la app, vio una versión vieja y creyó que nada de lo hecho
funcionaba. Nada estaba roto: estaba sin publicar.

**El límite que no se cruza:** pedir permiso **antes de cada vez** que se usa la computadora del
usuario, no una vez por sesión. Nunca escribir sus credenciales.

**Dos bases de Supabase, no una — y hoy hay una sola.** Verificado el 19/08/2026 con
`supabase projects list`: el cupo gratuito es de **dos proyectos por cuenta**, no por
organización, y entre el Tablero (`yyyrlopgwmuvfbzwxiwp`) y éste (`drsooohkwwpnijonxwwt`) la
cuenta está en el tope.

**Mientras se construye, una sola base alcanza:** no hay plata real adentro, así que no hay nada
que una vista previa pueda arruinar. **El día que se carga el `saldo_inicial` real, la base de
desarrollo separada pasa a ser una compuerta**, no una recomendación: una segunda cuenta con otro
correo (gratis, trae su propio cupo) o el plan Pro. En el Tablero las previews apuntan a la misma
base que producción, con una advertencia escrita de "ojo con datos de prueba destructivos"; en una
app de tareas se banca, en una que administra saldos no.

Y mientras haya una sola, **la app lo dice en pantalla**. Un riesgo conocido que no se ve, se
olvida.

---

## 10. Estado

`docs/ESTADO.md` es la fuente de verdad de qué falta, separado entre lo que depende de Claude y lo
que depende del usuario. Mantenerlo al día —incluidos los números de tests y de commits sin
publicar— es parte del trabajo, no un extra.
