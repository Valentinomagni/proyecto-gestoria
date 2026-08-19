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
| Tests, todos verdes | **105** en 14 archivos | `npx vitest run` |
| Pruebas de permisos contra la API real | **9** | `npm run test:rls` |
| Guardianes | **9** | `tipografia`, `Panel`, `casa`, `plata`, `fechas`, `campos`, `migraciones`, `secretos`, `permisos` |
| Migraciones aplicadas | **9** de 9 escritas | `npm run db:seco` dice "up to date" |
| Tablas en la base | **17**, más **4 vistas** | consulta a `pg_class` |
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

- [ ] **Los plazos y el calendario hábil.** Es el corazón del "reloj con plata adentro" y hoy no
      existe: `proximoDiaHabil` todavía no contempla feriados, y está escrito adentro de la
      función. Necesita las tablas `plazos`, `feriados` y la confirmación tuya de los cinco
      plazos de `docs/DOMINIO.md` §4.
- [ ] **El botón de avisar un problema** (Andon), que necesita su tabla.
- [ ] **Ampliar las pruebas de permisos a `cobros` y `movimientos`**: que una gestora no llegue
      al margen por ninguno de los cuatro caminos.
- [ ] **Restaurar un respaldo una vez de verdad.** Necesita la segunda base.

---

## Lo que depende de vos

### Lo que desbloquea que la puedas probar

- [ ] **Cloudflare: tres campos, una vez.** Hoy la URL sirve el `index.html` del código fuente
      —el que apunta a `/src/main.tsx`, que en producción no existe— así que la página sale en
      blanco. No está roto: falta decirle cómo compilar. En el panel del proyecto, en
      **Settings → Builds & deployments → Build configurations**:

      | Campo | Valor |
      |---|---|
      | Build command | `npm run build` |
      | Build output directory | `dist` |
      | Root directory | *(vacío)* |

      Y en **Settings → Environment variables**, para Production y Preview:

      | Variable | Valor |
      |---|---|
      | `NODE_VERSION` | `22.17.0` |
      | `VITE_SUPABASE_URL` | el mismo que está en `.env.local` |
      | `VITE_SUPABASE_ANON_KEY` | la clave publicable (`sb_publishable_...`) |
      | `VITE_SENTRY_DSN` | el DSN de Sentry |

      Después, **Deployments → Retry deployment**. Si la página carga y pide usuario y
      contraseña, salió bien.

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
