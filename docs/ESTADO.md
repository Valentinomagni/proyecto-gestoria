# Estado del proyecto

Contado de nuevo el **19/08/2026**. Los números salen de correr los comandos, no de recordar.

**Dónde estamos:** etapa 0 (fundación), tareas 1, 2, 3, 5, 6 y 8 terminadas. **Ninguna
funcionalidad del negocio existe todavía**: no hay trámites, ni saldos. La base existe con
`perfiles` y los helpers de permisos, y nada más.

---

## Los números

| Qué | Cuánto | Comando |
|---|---|---|
| Tests, todos verdes | **60** | `npx vitest run` |
| Archivos de prueba | 8 | idem |
| Guardianes | 5 | `tipografia`, `Panel`, `casa`, `plata`, `fechas` |
| Módulos de lógica en `src/lib` | 4 | `plata`, `fechas`, `fallas`, `ui` |
| Con prueba propia | 3 de 4 | falta `ui.ts`, que son cuatro líneas sin lógica |
| Peso de arranque | **63,81 kB** comprimidos | `npx vite build` |
| Sentry, en pedazo aparte | 148,53 kB, **no bloquea el primer dibujo** | idem |
| Duración del pre-commit | ~2,3 s | contra 90 a 180 s en el Tablero |
| Commits sin publicar | **0** | `git rev-list --count origin/dev..dev` |
| Migraciones corridas | **1** de 1 escrita | `npm run db:seco` dice "up to date" |
| Tablas en la base | 1 (`perfiles`) | `npm run db:tipos` |

---

## Lo que depende de mí

En orden, y cada uno bloquea al siguiente:

- [x] **Tarea 2 — Supabase enlazado**, con el flujo `db:seco` → `db:push` → `db:tipos`.
- [x] **Tarea 3 — migración 01 aplicada**: perfiles, alta automática, anti-autopromoción y los
      seis helpers. Corrida dos veces sin duplicar. **Falta designar la primera gerencia**, que
      necesita una cuenta real (abajo).
- [ ] **Tarea 4 — arnés de pruebas de permisos.** **Bloqueada:** necesita tres usuarios de
      prueba creados desde el panel (abajo).
- [ ] **Tarea 7 — login, roles, ruteo y cáscara.**
- [x] **Tarea 8 — `ErrorBoundary` y monitoreo.** Falta el botón de avisar un problema, que
      necesita una tabla y va con la etapa 1.
- [ ] **Tarea 10 — respaldo derivado del esquema, y restaurarlo una vez de verdad.**

## Lo que depende de vos

- [ ] **Rotar el token de Supabase (`sbp_`) y el de GitHub.** Los dos quedaron escritos en el
      historial de la conversación. El de Supabase es de cuenta: llega también al Tablero.
- [ ] **La regla de gerencia, por escrito:** *no se deposita contra una foto de cuaderno*.
      Sin eso, el camino viejo sigue abierto y es más corto. Es el primer entregable del
      proyecto y no es código.
- [ ] **La encuesta del día 0 a las gestoras y a gerencia de San Juan.** Las tuyas ya están.
      Caduca: después del encendido no se puede reconstruir. Ver `docs/ENCUESTA-DIA-0.md`.
- [ ] **Crear las cuentas en el panel de Supabase** (Authentication → Add user, con *Auto Confirm
      User* tildado): la tuya real, y tres de prueba —`gestora.prueba@`, `contable.prueba@`,
      `gerencia.prueba@`—. Sin ellas no se puede designar la primera gerencia ni correr las
      pruebas de permisos. **Lo hacés vos y no yo**: crear usuarios por API exige la clave
      secreta, y la regla del proyecto es que esa clave no la necesito nunca.
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
