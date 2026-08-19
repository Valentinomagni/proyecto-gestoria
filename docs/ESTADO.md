# Estado del proyecto

Contado de nuevo el **19/08/2026**. Los números salen de correr los comandos, no de recordar.

**Dónde estamos:** etapa 0 (fundación), tareas 1, 5 y 6 terminadas. **Ninguna funcionalidad del
negocio existe todavía**: no hay trámites, ni saldos, ni base de datos con tablas.

---

## Los números

| Qué | Cuánto | Comando |
|---|---|---|
| Tests, todos verdes | **60** | `npx vitest run` |
| Archivos de prueba | 8 | idem |
| Guardianes | 5 | `tipografia`, `Panel`, `casa`, `plata`, `fechas` |
| Módulos de lógica en `src/lib` | 4 | `plata`, `fechas`, `fallas`, `ui` |
| Con prueba propia | 3 de 4 | falta `ui.ts`, que son cuatro líneas sin lógica |
| Peso de arranque | **59,94 kB** comprimidos | `npx vite build` |
| Duración del pre-commit | ~2,3 s | contra 90 a 180 s en el Tablero |
| Commits sin publicar | **0** | `git rev-list --count origin/dev..dev` |
| Migraciones corridas | **0** | la base está vacía |

---

## Lo que depende de mí

En orden, y cada uno bloquea al siguiente:

- [ ] **Tarea 2 — enlazar Supabase y el flujo de migraciones.** Tengo el token y el ref.
- [ ] **Tarea 3 — migración 01**: perfiles, helpers de RLS, y designar la primera gerencia.
- [ ] **Tarea 4 — el arnés de pruebas de permisos** contra la API real, con tres usuarios de
      prueba. Necesita la tarea 3.
- [ ] **Tarea 7 — login, roles, ruteo y cáscara.** Necesita la tarea 3.
- [ ] **Tarea 8 — `ErrorBoundary`, Sentry y el botón de avisar un problema.** Tengo el DSN.
- [ ] **Tarea 10 — respaldo derivado del esquema, y restaurarlo una vez de verdad.**

## Lo que depende de vos

- [ ] **Rotar el token de Supabase (`sbp_`) y el de GitHub.** Los dos quedaron escritos en el
      historial de la conversación. El de Supabase es de cuenta: llega también al Tablero.
- [ ] **La regla de gerencia, por escrito:** *no se deposita contra una foto de cuaderno*.
      Sin eso, el camino viejo sigue abierto y es más corto. Es el primer entregable del
      proyecto y no es código.
- [ ] **La encuesta del día 0 a las gestoras y a gerencia de San Juan.** Las tuyas ya están.
      Caduca: después del encendido no se puede reconstruir. Ver `docs/ENCUESTA-DIA-0.md`.
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
