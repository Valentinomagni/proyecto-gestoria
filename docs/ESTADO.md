# Estado del proyecto

Contado de nuevo el **19/08/2026, a la noche**. Los números salen de correr los comandos, no de
recordar.

**Dónde estamos:** etapa 0 terminada y **etapa 1 con el circuito entero funcionando de punta a
punta**, caminado en el navegador con plata de verdad en la base: cargar el saldo, dar de alta un
trámite, controlarlo con el checklist, entregarlo a una gestora, presupuestarlo, presentarlo y
pagarlo. Los cinco saldos cierran en cada paso.

**Lo que falta para que la vea la dueña:** el despliegue en Cloudflare, que **depende de vos** y
son tres campos en un panel (abajo, con los valores exactos).

---

## Los números

| Qué | Cuánto | Comando |
|---|---|---|
| Tests, todos verdes | **138** en 18 archivos | `npx vitest run` |
| Pruebas de permisos contra la API real | **23** | `npm run test:rls` |
| Guardianes | **10** | `tipografia`, `Panel`, `casa`, `plata`, `fechas`, `campos`, `pruebas`, `migraciones`, `secretos`, `permisos` |
| Migraciones aplicadas | **11** de 11 escritas | `npm run db:seco` dice "up to date" |
| Tablas en la base | **19**, más **5 vistas** | consulta a `pg_class` |
| Módulos de lógica en `src/lib` | 15 | `ls src/lib` |
| Archivos de código | 49 | `find src -name "*.ts*"` |
| Peso de arranque | **86,82 kB** + 53,77 de Supabase + 11,72 de Query | `npx vite build` |
| Sentry, en pedazo aparte | 148,56 kB, **no bloquea el primer dibujo** | idem |
| Excel, en pedazo aparte | 19,69 kB, **se carga recién al apretar el botón** | idem |
| Commits sin publicar a producción | **6** en `dev` | `git rev-list --count origin/main..dev` |
| Cuentas creadas | 4, con roles asignados | verificado entrando con cada una |

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
- [ ] **El botón de avisar un problema** (Andon), que necesita su tabla.
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
