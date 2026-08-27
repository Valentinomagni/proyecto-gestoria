# Estado del proyecto

Contado de nuevo el **27/08/2026**, después de aplicar la cadena de seis estados. Los números
salen de correr los comandos, no de recordar.

**Dónde estamos:** el circuito entero funciona de punta a punta y la cadena bajó de diez estados a
seis. La base ya no acepta los estados viejos, el front habla el vocabulario nuevo, y ahora hay un
guardián que compara las dos listas para que no vuelvan a separarse.

**Lo que sigue:** el rediseño de las dos pantallas. La de gestoría tiene que dejar de parecerse a
la de la oficina: son dos necesidades distintas, y hoy comparten forma.

---

## Los números

| Qué | Cuánto | Comando |
|---|---|---|
| Tests, todos verdes | **154** en 20 archivos | `npx vitest run` |
| Pruebas de permisos contra la API real | **57** en 2 archivos | `npm run test:rls` |
| Pruebas en el Chrome de verdad | **6** en 2 navegadores | `npm run e2e` |
| Guardianes | **14** | `tipografia`, `Panel`, `casa`, `plata`, `fechas`, `campos`, `pruebas`, `migraciones`, `secretos`, `permisos`, `indices`, `colores`, `estados`, `espacios` |
| Migraciones aplicadas | **37** de 37 escritas | `npx supabase migration list --linked` |
| Tablas en la base | **21**, más **6 vistas** | consulta a `pg_class` |
| Módulos de lógica en `src/lib` | 20 | `ls src/lib/*.ts` |
| Archivos de código | 73, **11.816 líneas** | `find src -name "*.ts*"` |
| `CLAUDE.md` | **116 líneas**, más 4 skills | `wc -l CLAUDE.md` |
| Peso de arranque | **95,36 kB** + 53,77 de Supabase + 11,72 de Query | `npm run build` |
| Sentry, en pedazo aparte | 148,56 kB, **no bloquea el primer dibujo** | idem |
| Excel, en pedazo aparte | 19,69 kB, **se carga recién al apretar el botón** | idem |
| Commits sin publicar a producción | contarlos antes de decir que está publicado | `git rev-list --count origin/main..HEAD` |
| Cuentas creadas | 4, con roles asignados | verificado entrando con cada una |

---

## La cadena de seis estados — 27/08/2026

Cuatro migraciones contra la base viva. Antes de escribir cada una se leyó la función que estaba
corriendo, porque `create or replace function` reemplaza el cuerpo entero y lo que no se vuelva a
escribir desaparece sin que nadie avise.

### Lo que encontró la revisión adversarial, ANTES de aplicar

Cinco defectos en el plan, todos verificados a mano contra el código vigente y los datos reales:

1. **La rama de anulación del trigger de la cuenta corriente desaparecía.** La función viva tiene
   cuatro bloques y la reescritura tenía tres. Anular un trámite presupuestado habría dejado la
   reserva viva **para siempre**, sin error y sin forma de arreglarlo desde la app.
2. **La conversión de los trámites viejos habría disparado el trigger.** BALAGUER ya tenía su
   reserva liberada y su pago escrito: se habría descontado **565.000 dos veces** de Paris Autos.
3. **`tramites_update_gestora` nombra los estados uno por uno** y `resuelto` no estaba. La gestora
   habría apretado el botón y no habría pasado nada — un update de cero filas no devuelve error.
4. **`b_conceptos_no_despues_de_pagado` tampoco lo nombraba**, así que el presupuesto de un
   trámite resuelto volvía a ser editable sobre una reserva ya liberada.
5. **El alta de preexistentes perdía su filtro por estado**: uno ya pagado habría reservado plata
   que el banco ya descontó.

Y una sexta que apareció mirando los datos: **MARTINEZ estaba `presentado` con 520.000 reservados
y cero costo real** — presentó y no pagó. El plan lo mandaba a `resuelto`, que ahora significa
presentó-pagó-y-retiró. Fue a `presupuestado`.

### Lo que apareció comparando contra las funciones vivas

6. **El costo real no excluía las líneas anuladas.** `where momento = 'real'` a secas: una línea
   que alguien quitaba se seguía cobrando. La rama gemela, la del presupuesto, sí la excluía.
7. **Ir para atrás y volver a resolver escribía la plata dos veces.** Gerencia puede mandar un
   trámite para atrás —es lo que se hace cuando el costo real está mal—, y al volver a cerrarlo se
   escribía una segunda reversa y un segundo pago. Ahora la rama mira también los sellos, que
   nadie limpia.

### Y lo que apareció después de aplicar

8. **El front había quedado roto y nada lo agarró.** Seguía mandando `presentado`, un estado que
   la base ya rechazaba. Las 154 pruebas y las 44 del arnés quedaron **todas en verde**: ninguna
   miraba la máquina de estados. Lo encontró un `grep` a mano.

   De ahí salieron dos cosas: cuatro pruebas nuevas en el arnés, y el guardián `npm run estados`,
   que compara la lista del front contra el `check` de la base y falla si no coinciden.

### La comprobación que importaba

La conversión **no movió plata**. Medido antes y después:

```
Paris Autos SA   contable 9.435.000,00   comprometido 971.234,56
Paris Cars       contable         0,00   comprometido 128.000,00
13 trámites, 44 movimientos
```

Idéntico al centavo, y el libro de BALAGUER quedó con **tres filas y no seis**.

### Lo que encontró la revisión de producto, después de todo lo anterior

9. **Los diecisiete mensajes de error estaban sin una sola tilde**, y `src/lib/fallas.ts:207` los
   muestra **crudos**: lo que dice el SQL es exactamente lo que lee la gestora. Y sin tilde no es
   voseo — "Anota" es otra persona. Los mensajes que dan una instrucción eran justo los que
   perdían el voseo, al lado de una interfaz que dice "Cargá el primero".

   La migración que lo arregla **no retipeó ninguna función**: extrajo los cuerpos con un script
   de las migraciones que los crearon y cambió sólo las cadenas, comprobando que cada uno de los
   17 textos apareciera antes de reemplazarlo.

10. **"Resolver en el registro" pedía tres cosas y no lo decía.** El trigger valida de a una y
    corta en la primera que falta, así que el recorrido real eran cuatro intentos y tres errores
    rojos — parada en la ventanilla. Ahora el panel avisa de antemano, y para todos los pasos.

11. **El guardián de estados no miraba el archivo donde el defecto pasó.** Leía sólo la lista del
    filtro; el botón roto vivía en `SIGUIENTE`, dentro de `Ficha.tsx`. Ahora lee las dos listas,
    y se probó metiéndole el defecto real en el archivo real.

12. **El CHANGELOG prometía una pantalla que no existía.** La vista `v_esperando_plata` estaba
    bien hecha y **nadie la leía**. Peor: la Bandeja había perdido su tercer bloque, así que para
    el administrativo el saldo neto era una señal **menos**, anunciada como función nueva. Ahora
    la lee, agrupada por tarjeta.

### Lo que encontraron las revisiones de contable y de seguridad

Las dos, por caminos distintos, dieron con lo mismo: **una gestora veía las cinco tarjetas en
cero.** Y contable nombró la forma que tienen en común los defectos de plata, que es lo que de
verdad importa:

> *"un `if` que decide si escribir plata mirando el estado o el sello, en vez de mirar **cuánto
> queda comprometido y cuánto ya se cobró**. Mientras las ramas comparen situaciones en vez de
> saldos, cada camino nuevo va a necesitar su propia guarda, y la que falte no va a dar error."*

13. **Vaciar el presupuesto dejaba la reserva viva para siempre, y estaba pasando.**
    `h_conceptos_total_presupuesto` guarda NULL cuando la suma da cero, y la rama de corrección
    exigía `> 0`. BALAGUER quedó `presupuestado`, pidiendo NULL, con **450.000 comprometidos**.

14. **Anular y revivir escribía una segunda reversa.** La rama de resolver sumaba dos tipos y la
    de anular sumaba tres, así que la primera no descontaba lo ya liberado. El comprometido de
    Paris Autos quedaba en **-68.765,44**, y un comprometido negativo no lo detectaba nadie.

15. **Corregir el costo real después de resolver no se cobraba.** La guarda por sellos que esta
    misma tanda agregó tapaba también la escritura del pago. La ficha decía 665.000 y la tarjeta
    había cobrado 565.000.

16. **La gestora podía apagar los movimientos de plata de su trámite**, y este agujero lo abrió
    esta tanda: `pagado_at` estaba en la lista de campos que puede escribir desde antes, y no
    molestaba a nadie hasta que la conciliación se apoyó justo en ese sello. `resuelto_at` **no**
    estaba en la lista, y por eso el camino inverso estaba cerrado — la asimetría era el defecto.

17. **Un movimiento podía nacer anulado.** `movimientos_insert` nombra los tipos uno por uno y no
    miraba las dos columnas de las que ahora depende el invariante. Un `ingreso` con
    `anulado = true` entraba, subía el contable y la pantalla lo dibujaba tachado.

18. **`v_saldos` preguntaba la fecha en UTC.** A las 23:30 de Argentina la base decía 28 y era 27,
    así que un depósito que acreditaba mañana se contaba como acreditado hoy. El front ya usaba
    `hoyArgentina()`: durante esas tres horas no coincidían sobre qué día era.

**El arreglo no son seis parches.** `conciliar_tramite` compara lo que el libro dice contra lo que
debería decir y escribe la diferencia. Es **idempotente**, comprobado: 105 movimientos antes de
correrla de nuevo, 105 después. Por eso cierra también los caminos que todavía nadie probó.

Y corrigió los datos:

```
Paris Autos   971.234,56 comprometidos  →  520.000,00
Paris Cars       128.000,00             →           0
```

### Lo que queda anotado

- **`npm run espacios` está en rojo**, con 9 hallazgos. Son decisiones visuales del rediseño, no
  arreglos mecánicos: entra al pre-commit cuando el front se rehaga.
- **`npm run formato:check` está en rojo**, con 92 archivos. El grueso es conversión de finales de
  línea CRLF a LF, no formato de verdad: el repo está mezclado. Necesita un `.gitattributes` con
  `* text=auto eol=lf` antes de aplicarlo, o el diff se vuelve ilegible.
- **Paris Cars tiene 128.000 comprometidos por un trámite en `recibido`.** La reserva se escribe
  cuando cambia el importe pedido, sin mirar el estado, así que un trámite que ni empezó puede
  tener plata comprometida. La vista de "esperando plata" no lo muestra porque sólo mira los
  presupuestados: la tarjeta dice que debe 128.000 y la lista de quién espera está vacía.

## La segunda revisión — 24/08/2026

Ocho correcciones pedidas sobre fotos de la pantalla. Todas hechas y **miradas**, no sólo probadas.

| Lo que pediste | Dónde quedó |
|---|---|
| Accesorios y Entrega de vehículo usado con Sí / No | Checklist del legajo, verificado en pantalla |
| Quitar la sección Vencimientos | Fuera de la ficha. Administración conserva plazos y feriados |
| Modificar presupuestos, con historial | Cada línea con Corregir y Quitar; panel Cambios unificado |
| Cuatro columnas en la Tarjeta | Saldo día de hoy / Depósito pendiente / Saldo reservado / Diferencia |
| Quitar el panel de "Paso siguiente" | Reemplazado por una barra de avance arriba |
| Que el presupuesto se descuente solo | Lo hace un trigger: el total ES la suma de las líneas |
| Gestoría sin "Cargar trámite" | Menú por rol, con test |
| Modificar datos, por ejemplo la gestora | Panel Datos del trámite, editable, con historial |

### Lo que apareció mirando los datos, y no leyendo el código

1. **Un trámite tenía $6.128.000 presupuestados y CERO reservados.** Los dos números eran
   independientes y nadie los comparaba. Lo empareja la migración `20260821194117`, que toca sólo
   los trámites vivos.
2. **Renombrar una tabla no la renombra adentro de las funciones**, porque el cuerpo de una
   función plpgsql es texto. El trigger del historial quedó apuntando al nombre viejo y **no se
   podía guardar ninguna línea de presupuesto**. El `db push` había dicho "Finished". Lo agarró la
   comprobación que inserta una línea de verdad y compara el total contra un número escrito de
   antemano.
3. **El total se podía escribir a mano por la puerta de atrás**, salteando las líneas. Ahora lo
   impide un trigger que distingue el recálculo por una marca local a la transacción.

### Lo que se vio mirando la pantalla

- El historial mostraba los **UUID crudos** de la gestora. Ahora dice "de Carla a Mariana".
- El extracto **duplicaba el apellido** ("Presupuesto - X — X") y decía "Correccion" sin acento.
- Los botones **Corregir** y **Quitar** medían **16 píxeles** en el teléfono — justo los que usa
  la gestora parada en el registro. Ahora hay una constante `ACCION_CHICA` con los 44 que el
  proyecto exige, para que la regla tenga dónde vivir.

### Deuda conocida y anotada

- **`npm run espacios` está en rojo con 9 hallazgos**, y es a propósito. Los nueve están en
  `Shell.tsx` (3), `DatosDelTramite.tsx` (2), `EmptyState`, `Login`, `Panel` y `Avisos`. Varios
  son decisiones visuales —el relleno de la tarjeta, el alto del estado vacío— y esas se toman en
  el paso de diseño del Plan B, no con un reemplazo mecánico. Se conecta al pre-commit ahí.
  Mientras tanto el número sirve de medida: eran 9, no cientos.
- **`npm run deadcode` está en rojo desde antes de esta tanda**: nueve dependencias sin usar y
  nueve tipos exportados que nadie importa. Esta revisión no agregó ninguno, pero tampoco los
  limpió.
- **`npm run permisos` devuelve 0 cuando se saltea** por falta de token. Un guardián que se
  saltea en silencio y dice que salió bien es medio guardián.
- Las **claves foráneas** de `tramite_cambios` conservan el nombre viejo (`presupuesto_historial_*`).
  Es cosmético: nunca se muestran.

---

## Las correcciones del primer test real — 20/08/2026

Las catorce que salieron de probar el sistema con los tres usuarios. **Todas hechas.**

| Qué se pidió | Cómo quedó |
|---|---|
| La cuenta personal viene entre paréntesis | Se reconoce sola. Gana lo explícito: `REF` es referencia, `C.` es cuenta, y un número suelto entre paréntesis es la cuenta |
| Modalidad: debería decir DIRECTA | Sólo para patentamientos, y con dos valores: plan de ahorro o venta directa. En una transferencia el campo ya no aparece |
| Que no se pierdan los datos al cambiar de pantalla | Un borrador que además sobrevive a recargar y a cerrar el navegador |
| Paris Autos primero, Paris Cars segundo | El orden lo decide la columna `orden` de la base, no el alfabeto |
| Contable y gerencia, permisos idénticos | Un helper `es_oficina()`. Y de paso: nadie se cambia el rol a sí mismo, ni gerencia |
| Poder editar los depósitos por errores de tipeo | Se corrige hasta que se paga, y la diferencia se ajusta sola en la cuenta |
| Ocultar vencimientos en gestoría | Son control de oficina. Se le sacan de la vista, no de sus permisos |
| Designar un gestor y que le aparezca | Se elige al dar de alta, y lo ve desde ese momento |
| Modificar los ítems del check | Los cinco que se controlan de verdad. Los diez viejos quedan desactivados, no borrados |
| Que las gestoras carguen el presupuesto | Ya podían: lo único que se lo impedía era no ver el trámite |
| Corregir la visibilidad en gestoras | Misma corrección que la anterior |
| Notificaciones de las modificaciones | Una campana en vivo, en las dos barras |
| Historial de modificaciones en presupuesto | Quién lo cambió, cuándo y de cuánto a cuánto. Lo escribe un trigger |
| Administrativo a cargo | Campo con sugerencias de lo ya cargado. Sale en la ficha y en el Excel |

### Lo que encontraron las comprobaciones, y no una relectura

- **Realtime nunca había funcionado.** La publicación estaba vacía: la app se suscribía, no daba
  error, y no llegaba nada. El saldo "se actualizaba solo" por el refresco al volver el foco, no
  por Realtime. Era lo que el código llama la función central del producto.
- **Seis policies** seguían nombrando a los dos roles con un `or` escrito a mano, dejando al
  helper sin ser el único lugar que decide — sobre `tramites` y `movimientos`.
- **Una regresión de permisos:** sin sesión, leer `perfiles` devolvía error en vez de cero filas.
  La RLS tiene que filtrar por ausencia, no por rechazo.
- **Un test del propio arnés** dejaba una gestora desactivada al fallar, porque restauraba
  después de afirmar.
- **Dos errores de orden en migraciones**: convertir datos antes de borrar la restricción vieja,
  y agregar una columna en el medio de una vista.

---

## Lo que depende de mí

### Terminado

- [x] **Etapa 0 completa** salvo el despliegue: Supabase enlazado, permisos probados contra la
      API real, login, roles, cáscara, `ErrorBoundary`, monitoreo y respaldo.
- [x] **El circuito del trámite entero**, con los diez estados y sus reglas en la base.
- [x] **La cuenta corriente**: libro mayor de sólo inserción, las cinco cifras, y las reservas
      que se crean y se liberan solas. Comprobado con números reales en pantalla.
- [x] **El checklist del legajo** con las tres respuestas: Está, Falta, No corresponde.
- [x] **Las notas del trámite**, con autor y sin poder editarse ni borrarse.
- [x] **Bajar a Excel**, con la plata como número y la fecha como fecha. El archivo se abrió y
      se leyó celda por celda.
- [x] **El teléfono**: navegación abajo, fichas en vez de tabla, controles de 44 px.
- [x] **`npm run permisos`**: nadie puede borrar ni vaciar, ninguna vista es escribible, toda
      vista lleva `security_invoker`. Visto en rojo antes de darlo por bueno.

### Lo que sigue

- [x] ~~Los plazos y el calendario hábil.~~ **Hecho, y funcionando de punta a punta.** El
      mecanismo está: `plazos`, `feriados`, la vista que sólo deja pasar lo confirmado, el
      módulo que calcula, y la pantalla que lo carga. Lo que falta ahora son DATOS, y son tuyos
      (abajo). Probado mirando: con la fecha de certificación cargada y el calendario declarado,
      la ficha muestra "Faltan 83 días hábiles · 15/12/2026", y el número se comprobó contra un
      cálculo independiente.
- [x] ~~El botón de avisar un problema (Andon).~~ Está en TODAS las pantallas y para todos los
      roles, y **el botón de mandar nunca se deshabilita**: quien lo aprieta no tiene que saber
      explicar nada. Probado con la gestora, que es quien menos permisos tiene: mandó un aviso
      sin escribir una palabra y gerencia lo ve en Administración, arriba de todo.
- [x] ~~Ampliar las pruebas de permisos a `cobros` y `movimientos`.~~ Hecho: los cuatro caminos
      al margen, incluido el que se olvida siempre —colgar `cobros` de una consulta a
      `tramites`—, y el libro mayor que ni gerencia puede editar ni borrar.
- [ ] **Restaurar un respaldo una vez de verdad.** Necesita la segunda base.

---

## Lo que depende de vos

### Lo que desbloquea que la puedas probar

**Cloudflare no está enlazado a GitHub.** Se comprobó el 19/08/2026: se empujó a `main` y diez
minutos después el sitio seguía sirviendo, byte por byte, el mismo contenido de antes — ni
siquiera intentó desplegar. El proyecto se creó por **subida directa** (una carpeta arrastrada
una vez), y en un proyecto así las opciones de compilación del panel no hacen nada.

Por eso el sitio muestra el andamio del primer día y no la app.

**La solución está lista en el repositorio** y publica desde GitHub Actions, que además compila
con estas dependencias y comprueba el resultado antes de publicar. Falta cargar cinco secretos,
una sola vez, en **GitHub → Settings → Secrets and variables → Actions → New repository secret**:

| Secreto | De dónde sale |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare → My Profile → API Tokens → Create Token, plantilla *Edit Cloudflare Workers* |
| `CLOUDFLARE_ACCOUNT_ID` | De la URL del panel: `dash.cloudflare.com/<esto>` |
| `VITE_SUPABASE_URL` | El mismo que está en tu `.env.local` |
| `VITE_SUPABASE_ANON_KEY` | La clave publicable (`sb_publishable_...`). Es pública por diseño |
| `VITE_SENTRY_DSN` | El DSN de Sentry |

Con eso cargado, publicar deja de ser un trámite: pasa a ser consecuencia de que algo llegue a
`main`. **Mientras falte alguno el flujo no falla: se saltea y lo dice**, porque un paso rojo
permanente entrena a ignorar el rojo.

*La alternativa*, si preferís el panel: borrar el proyecto de Cloudflare y crearlo de nuevo con
**Workers & Pages → Create → Pages → Connect to Git**, apuntando al repositorio, con build
command `npm run build`, output directory `dist` y `NODE_VERSION=22.17.0`. Es más clics y hay que
repetirlos si algún día se rehace, por eso está primero la otra.

### Seguridad, y esto no puede esperar al final

- [ ] **Rotar el token de Supabase (`sbp_`) y el de GitHub.** Los dos quedaron escritos en el
      historial de la conversación. El de Supabase es **de cuenta**: llega también al Tablero.
- [ ] **Cambiar la contraseña genérica** (`Paris2026!`) antes de que el sistema tenga saldos
      reales. `gerencia1` tiene acceso total.

### Lo que no es código y es lo que decide si el sistema sirve

- [ ] **La regla de gerencia, por escrito:** *no se deposita contra una foto de cuaderno*.
      Sin eso, el camino viejo sigue abierto y es más corto. Es el primer entregable del
      proyecto.
- [ ] **La encuesta del día 0 a las gestoras y a gerencia de San Juan.** Las tuyas ya están.
      Caduca: después del encendido no se puede reconstruir. Ver `docs/ENCUESTA-DIA-0.md`.
- [ ] **Confirmar los plazos con las gestoras.** Los cinco de `docs/DOMINIO.md` §4 están sin
      verificar, y hasta que no lo estén el sistema no los muestra como vencimientos. Un sistema
      que avisa un vencimiento equivocado es peor que uno que no avisa nada.
- [ ] **Contar las filas de la planilla, por hoja.** Hoy sólo sabemos que PARIS AUTOS pasa de
      6.868 y que hay cinco hojas más.
- [ ] **La segunda base de Supabase**, el día que se cargue el `saldo_inicial` real. Mientras
      tanto la app lo dice en pantalla: "Base compartida con desarrollo".

---

## Lo que está decidido y esperando su momento

- **La segunda base de Supabase.** El cupo gratuito es de dos proyectos por cuenta y ya están
  usados. Mientras se construye alcanza con una —no hay plata real que arruinar—, pero **el día
  que se cargue el saldo inicial deja de alcanzar**. Se resuelve con una segunda cuenta gratis o
  con el plan Pro.

---

## Preguntas abiertas

Tres, y ninguna frena el desarrollo. Las ocho originales están en el índice del plan; cinco ya
se contestaron el 19/08.

1. ¿Cuánto se pagó de recargo por presentación fuera de término en el último año? Si la
   respuesta es "no sabemos", ése es el agujero que el sistema tapa.
2. ¿El sellado provincial de San Luis y el de San Juan son distintos?
3. Las transferencias al concesionario, ¿se presentan siempre dentro de los 90 días hábiles?

---

## Lo que hay que saber antes de seguir

Cinco cosas que ya costaron tiempo en este proyecto o en los anteriores:

1. **`node` y `npm` no están en el PATH.** Todo comando arranca con el `export`. Lo que arranca
   procesos desde afuera del shell necesita `node.exe` con ruta absoluta.
2. **El guardián que marca texto correcto se desactiva.** Pasó tres veces en un día: el símbolo
   de grado, `clave:` como "key", y el comentario que enseña la trampa. Los tres están escritos
   como casos de test.
3. **`comando | tail` devuelve el estado de `tail`.** Ya dio un falso "todo bien" en un `push`
   que en realidad había sido rechazado.
4. **`--ring` es un color y `--ring-sh` es una sombra.** Confundirlos produce CSS inválido que el
   navegador descarta entero, en silencio.
5. **Sin conexión se evalúa antes que versión vieja** en `fallas.ts`. Al revés, una recarga sin
   red deja la pantalla en blanco.
