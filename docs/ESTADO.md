# Estado del proyecto

Contado de nuevo el **19/08/2026**. Los números salen de correr los comandos, no de recordar.

**Dónde estamos:** etapa 0 (fundación), **nueve de diez tareas terminadas**. Falta sólo el
despliegue en Cloudflare, que depende de vos. **Ninguna
funcionalidad del negocio existe todavía**: no hay trámites, ni saldos. La base existe con
`perfiles` y los helpers de permisos, y nada más.

---

## Los números

| Qué | Cuánto | Comando |
|---|---|---|
| Tests, todos verdes | **77** | `npx vitest run` |
| Pruebas de permisos contra la API real | **9** | `npm run test:rls` |
| Archivos de prueba | 11 | idem |
| Guardianes | 6 | `tipografia`, `Panel`, `casa`, `plata`, `fechas`, `migraciones` |
| Módulos de lógica en `src/lib` | 9 | `plata`, `fechas`, `fallas`, `roles`, `auth`, `respaldo`, `sesion`, `monitoreo`, `ui` |
| Con prueba propia | 6 de 9 | sin prueba: `ui` (4 líneas), `sesion` y `monitoreo` (los ejercita el navegador) |
| Peso de arranque | **79,52 kB** + 53,77 kB de Supabase | `npx vite build` |
| Sentry, en pedazo aparte | 148,53 kB, **no bloquea el primer dibujo** | idem |
| Duración del pre-commit | ~2,3 s | contra 90 a 180 s en el Tablero |
| Commits sin publicar | **0** | `git rev-list --count origin/dev..dev` |
| Migraciones corridas | **2** de 2 escritas | `npm run db:seco` dice "up to date" |
| Tablas en la base | 1 (`perfiles`) | `npm run db:tipos` |
| Cuentas creadas | 4, con roles asignados | verificado por la API |

---

## Lo que depende de mí

En orden, y cada uno bloquea al siguiente:

- [x] **Tarea 2 — Supabase enlazado**, con el flujo `db:seco` → `db:push` → `db:tipos`.
- [x] **Tarea 3 — migración 01 aplicada**: perfiles, alta automática, anti-autopromoción y los
      seis helpers. Corrida dos veces sin duplicar. **Falta designar la primera gerencia**, que
      necesita una cuenta real (abajo).
- [x] **Tarea 4 — arnés de permisos contra la API real.** Nueve pruebas, y **visto en rojo**
      sacando el trigger anti-autopromoción a propósito.
- [x] **Tarea 7 — login, roles y cáscara.** Probado en el navegador con las tres situaciones:
      gerencia entra, un usuario sin asignar ve la pantalla que lo explica, y una contraseña
      equivocada no revela cuál de los dos campos falló.
- [x] **Tarea 8 — `ErrorBoundary` y monitoreo.** Falta el botón de avisar un problema, que
      necesita una tabla y va con la etapa 1.
- [x] **Tarea 10 — respaldo derivado del esquema.** Falta **restaurarlo una vez de verdad**, que
      necesita la segunda base.
- [ ] **Tarea 9 — despliegue en Cloudflare.** Depende de vos.

## Lo que depende de vos

- [ ] **Rotar el token de Supabase (`sbp_`) y el de GitHub.** Los dos quedaron escritos en el
      historial de la conversación. El de Supabase es de cuenta: llega también al Tablero.
- [ ] **La regla de gerencia, por escrito:** *no se deposita contra una foto de cuaderno*.
      Sin eso, el camino viejo sigue abierto y es más corto. Es el primer entregable del
      proyecto y no es código.
- [ ] **La encuesta del día 0 a las gestoras y a gerencia de San Juan.** Las tuyas ya están.
      Caduca: después del encendido no se puede reconstruir. Ver `docs/ENCUESTA-DIA-0.md`.
- [x] ~~Crear las cuentas en el panel de Supabase.~~ Hechas: cuatro, con `gerencia1` y
      `contable1` ya designados.
- [ ] **Cambiar la contraseña genérica** antes de que el sistema tenga saldos reales.
      `gerencia1` tiene acceso total.
- [ ] **Contar las filas de la planilla, por hoja.** Hoy sólo sabemos que PARIS AUTOS pasa de
      6.868 y que hay cinco hojas más.
- [ ] **Confirmar los plazos con las gestoras.** Los cinco de `docs/DOMINIO.md` §4 están sin
      verificar, y hasta que no lo estén el sistema no los muestra como vencimientos.
- [ ] **Cloudflare Pages**, cuando haya algo que mostrar. La entrada `proyecto-gestoria` que
      quedó a medio crear es un Worker, no un Pages, y hay que borrarla.

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
