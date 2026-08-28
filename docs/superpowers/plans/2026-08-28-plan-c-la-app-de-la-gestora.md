# Plan C — La app de la gestora

> **Para quien lo ejecute:** SUB-SKILL OBLIGATORIA: usar `superpowers:subagent-driven-development`
> (recomendada) o `superpowers:executing-plans` para implementarlo tarea por tarea. Los pasos usan
> casillas (`- [ ]`) para poder marcarlos.

**Objetivo:** que la gestora abra el teléfono, vea en una sola pantalla lo que le toca hacer, y que
esa pantalla se mueva sola cuando la oficina deposita — sin recargar, sin preguntar por WhatsApp.

**Arquitectura:** una ruta `/` que se dibuja distinta según el rol: la oficina ve el resumen de
empresas del Plan B, la gestora ve su cola. La cola son tres bloques —te toca, esperando, terminados
hoy— y **quién va en qué bloque lo decide la base, no el navegador**, en una vista nueva que se
apoya en `v_esperando_plata`, que ya existe y ya sabe repartir la plata de una tarjeta entre todos
los presupuestos vivos. Encima va el tiempo real que ya funciona, y una capa de PWA que hace la app
instalable **cacheando sólo el armazón y jamás los datos**.

**Stack:** React 19, TypeScript, Vite 8 (rolldown), Tailwind 4 (`@theme` en CSS), Supabase
(Postgres, RLS, Auth, Realtime), TanStack Query 5, TanStack Router 1.170, lucide-react, sonner,
vitest, oxlint, oxfmt, Playwright (`channel: "chrome"`), `@axe-core/playwright`, `vite-plugin-pwa`
(ya instalado, sin usar), Cloudflare Pages.

---

## Restricciones globales

Copiadas del `CLAUDE.md` y del spec. **Valen para todas las tareas**, no se repiten en cada una.

- **Esto lo revisa la dueña de la empresa. No admite defectos visibles.**
- **Si escribís "verificado", escribí al lado el comando o el `archivo:línea` que lo comprueba.** Si
  no podés, escribí "sin verificar". Las dos son respuestas válidas; inventar la primera, no.
- **Todo comando arranca con** `export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH"`. Node y npm
  no están en el PATH.
- **Códigos de salida:** nunca `comando | tail`, que devuelve el estado de `tail`. Siempre
  `comando > /tmp/log 2>&1; echo "EXIT: $?"; tail -20 /tmp/log`.
- **El token de cuenta sale de `.env.local`**, que está en `.gitignore`:
  `export SUPABASE_ACCESS_TOKEN="$(grep '^SUPABASE_ACCESS_TOKEN=' .env.local | cut -d= -f2-)"`.
- **`supabase db push` lleva `--yes`**: sin eso se cuelga esperando confirmación.
- **Puerto 5173 con `strictPort`.** Está anotado en las redirect URLs de Supabase Auth.
- **Cero emojis.** Ni en interfaz, ni en mensajes, ni en documentación. Íconos sólo de
  `lucide-react`. Ojo con el simbolo de informacion (U+2139): Unicode lo clasifica como **letra**.
- **No se mide a las personas.** Ni rankings, ni conteos por gestora, ni comparaciones. Hay
  guardián (`npm run test` corre `casa.guard.test.ts`).
- **Español de Argentina, voseo**, tono directo, sin jerga técnica. Un error nunca muestra el
  mensaje crudo de la base.
- **Nada se borra.** Se anula con motivo.
- **La plata es `numeric(14,2)` en Postgres y centavos enteros en JavaScript.** Todo importe pasa
  por `src/lib/plata.ts`. **Nunca `Number("600.000")`** — da 600.
- **Ningún plazo ni arancel escrito en el código.**
- **Un número nunca es del color de la marca.** El teal va en el marco; los estados conservan su
  color. `npm run contraste` mide los pares reales en claro y en oscuro.
- **Comentarios en español que explican el POR QUÉ**, no el qué. La densidad alta es deliberada.
- **Toda vista lleva `security_invoker = true`**, y **recrear una vista no conserva lo revocado**:
  hay que volver a poner `revoke` y `grant`.
- **`create or replace view` no puede renombrar ni reordenar columnas.** Lo nuevo va al final.
- **Toda policy que llame a un helper `security definer` lleva `to authenticated`.**
- **Postgres comprueba el permiso de `execute` al PLANIFICAR**, no al recorrer filas: un `case` no
  evita que haga falta el `grant`. (Costó dos migraciones el 28/08/2026.)
- **Nunca editar JSX con expresiones regulares ni `sed`.**
- **TDD:** test primero, verificar que falla **por la razón esperada**, después implementar.
- **Si un aserto de este plan resulta incorrecto, no lo ajustes para que pase. Pará y reportalo.**
- **Antes de escribir una función, buscá si ya existe.** La duplicación es un defecto.
- **Con defectos abiertos no entran funciones nuevas.**

### Lo que este plan NO hace, y está decidido en el spec §15

- **No manda notificaciones push al teléfono.** El salto funciona con la app abierta. El aviso push
  necesita permisos del navegador y es otra etapa. Si aparece la tentación de agregarlo, no.
- **No trae los vencimientos de vuelta.**
- **No separa la base de desarrollo de la de producción.** Eso es la Tarea 10, y es una acción del
  usuario: acá se deja el interruptor y el instructivo, no la base.

---

## Mapa de archivos

**Se crean:**

| Archivo | De qué es responsable |
|---|---|
| `supabase/migrations/<ts>_la_cola_de_la_gestora.sql` | La vista `v_cola_de_gestora`: una fila por trámite con su bloque y su acción |
| `src/lib/cola.ts` | El tipo `FilaDeCola`, `useCola()`, y `BLOQUES` con su orden y su rótulo |
| `src/lib/cola.test.ts` | Que el mapeo de la fila no pierda ni invente nada |
| `src/features/gestora/Cola.tsx` | La pantalla: tres bloques, el saludo y el saldo |
| `src/features/gestora/TarjetaDeTramite.tsx` | Una tarjeta: cliente, dominio, empresa, la frase y el botón |
| `src/features/gestora/SaldoDeArriba.tsx` | La línea de saldo de las tarjetas donde ella trabaja |
| `src/features/gestora/FichaReducida.tsx` | Lo que ve al tocar el nombre: datos, presupuesto y notas |
| `src/features/gestora/SinConexion.tsx` | Lo que se dibuja cuando no hay red: nunca un importe viejo |
| `scripts/pwa-sana.mjs` | Guardián: que el service worker no cachee ninguna llamada a Supabase |
| `e2e/gestora.spec.ts` | La cola, la ficha reducida y las notas, en el Chrome de verdad |
| `e2e/salto.spec.ts` | **Dos sesiones a la vez**: la oficina deposita, la tarjeta salta |
| `docs/SEGUNDA-BASE.md` | El instructivo para separar desarrollo de producción |

**Se modifican:**

| Archivo | Qué cambia |
|---|---|
| `src/rutas.tsx:61-65` | `/` se dibuja según el rol: `Resumen` para la oficina, `Cola` para la gestora |
| `src/lib/datos.ts:433-465` | `useSaldosEnVivo` invalida además la clave `["cola"]` |
| `src/index.css` | `--salto` para la transición de la tarjeta, y su apagado por movimiento reducido |
| `vite.config.ts:11` | El plugin de PWA, con su manifiesto y su estrategia de caché |
| `src/permisos-plata.rls.test.ts` | Que la cola de una gestora no muestre trámites de otra |
| `package.json` | El script `pwa`, y `pwa` dentro del portón |
| `.githooks/pre-commit` | `pwa` entra al portón |
| `public/brand/` | Los íconos de la app instalable, generados del isotipo que ya existe |
| `CHANGELOG.md`, `docs/ESTADO.md` | Al cerrar |

---

## La decisión que ordena todo el plan, y por qué no hay tres variantes

**Quién va en qué bloque lo decide la base.** No el navegador.

La tentación es obvia y es la que hay que no tener: el front ya tiene `useTramites()` y
`useSaldos()`, así que parece gratis escribir

```ts
const cubre = saldo.contable >= tramite.deposito_solicitado; // NO
```

Eso está mal por tres razones, y las tres ya mordieron a este proyecto:

1. **La plata es de la tarjeta, no del trámite.** Una tarjeta con 500.000 y tres presupuestos de
   200.000 no cubre tres: cubre dos y media. La cuenta correcta reparte el saldo entre **todos** los
   presupuestos vivos de esa tarjeta, y eso ya lo hace `v_esperando_plata`. Rehacerlo en JavaScript
   es reescribir la parte difícil, peor y en otro idioma.

2. **Dos fuentes para el mismo hecho se separan, y se separan en silencio.** El día que cambie el
   criterio en la vista —porque entra el depósito en tránsito, porque cambia qué cuenta como
   comprometido— la pantalla de la gestora va a seguir con el criterio viejo. Nadie va a ver un
   error: va a ver una tarjeta en el bloque equivocado. Que es exactamente el defecto de
   `frenado_por_saldo`, el que este sistema vino a matar.

3. **Es la doctrina de conciliación escrita por el revisor contable**, y es regla del proyecto:
   *"un `if` que decide si escribir plata mirando el estado o el sello, en vez de mirar CUÁNTO QUEDA
   COMPROMETIDO y CUÁNTO YA SE COBRÓ. Mientras las ramas comparen situaciones en vez de saldos, cada
   camino nuevo va a necesitar su propia guarda, y la que falte no va a dar error."*

Por eso la Tarea 1 es una vista y no un `useMemo`. El navegador recibe la palabra `te_toca`,
`esperando` o `terminado` y su único trabajo es dibujarla.

---

## Tarea 1: La vista de la cola

**Archivos:**
- Crear: `supabase/migrations/<timestamp>_la_cola_de_la_gestora.sql`
- Modificar: `src/permisos-plata.rls.test.ts` (agregar el `describe` del final de esta tarea)

**Interfaces:**
- Consume: `public.v_esperando_plata` (columnas `tramite_id, tarjeta_id, gestora_id, pide, falta`),
  `public.tramites`, `public.razones_sociales`, `public.puedo_ver_tarjeta(uuid)`, `hoy_argentina()`.
- Produce: la vista `public.v_cola_de_gestora` con las columnas, **en este orden**:
  `tramite_id (uuid), cliente_nombre (text), dominio (text), oferta_referencia (text),
  empresa (text), razon_social_id (uuid), tarjeta_id (uuid), estado (text), bloque (text),
  accion (text), pide (numeric), falta (numeric), desde (timestamptz)`.
  `bloque` es uno de `te_toca` / `esperando` / `terminado`.
  `accion` es uno de `presupuestar` / `ir_al_registro` / `devolver` / `ninguna`.

- [ ] **Paso 1: Escribir la prueba que falla**

En `src/permisos-plata.rls.test.ts`, al final del archivo:

```ts
/**
 * ============================================================================
 *  LA COLA DE LA GESTORA
 * ============================================================================
 *
 *  El bloque y la acción los decide LA BASE. Si esto se calculara en el navegador, el día que
 *  cambie el criterio de "la tarjeta cubre" la pantalla de la gestora seguiría con el viejo — y
 *  no daría error: mostraría una tarjeta en el bloque equivocado. Es el defecto de
 *  `frenado_por_saldo` con otra forma.
 */
describe("la cola de la gestora", () => {
  const COLUMNAS =
    "tramite_id, cliente_nombre, empresa, estado, bloque, accion, pide, falta, desde";

  it("le devuelve SOLO sus tramites", async () => {
    const { data, error } = await gestora.from("v_cola_de_gestora").select(COLUMNAS);
    expect(error).toBeNull();
    expect(data?.length ?? 0, "la gestora de prueba no tiene ningun tramite vivo").toBeGreaterThan(
      0,
    );

    // Contra la lista cruda: los ids de la cola tienen que estar TODOS entre los suyos.
    const { data: suyos } = await gestora.from("tramites").select("id");
    const mios = new Set((suyos ?? []).map((t) => String(t.id)));
    const ajenos = (data ?? []).filter((f) => !mios.has(String(f.tramite_id)));
    expect(ajenos.length, "la cola trae tramites que no son de ella").toBe(0);
  });

  it("cada fila tiene un bloque y una accion de los permitidos", async () => {
    const { data } = await gestora.from("v_cola_de_gestora").select(COLUMNAS);
    const BLOQUES = ["te_toca", "esperando", "terminado"];
    const ACCIONES = ["presupuestar", "ir_al_registro", "devolver", "ninguna"];
    for (const f of data ?? []) {
      expect(BLOQUES, `bloque desconocido en ${String(f.cliente_nombre)}`).toContain(f.bloque);
      expect(ACCIONES, `accion desconocida en ${String(f.cliente_nombre)}`).toContain(f.accion);
    }
  });

  it("lo que espera plata NO tiene accion, y lo dice con cuanto falta", async () => {
    /*
      ES EL CORAZON DEL PRODUCTO. Un boton en un tramite sin plata la manda al registro a que la
      rebote el cajero. La ausencia de boton tiene que venir con el numero de por que.
    */
    const { data } = await gestora.from("v_cola_de_gestora").select(COLUMNAS);
    for (const f of (data ?? []).filter((x) => x.bloque === "esperando")) {
      expect(f.accion, `${String(f.cliente_nombre)} espera plata y tiene boton`).toBe("ninguna");
      expect(Number(f.falta), `${String(f.cliente_nombre)} espera plata sin decir cuanta`).toBeGreaterThan(0);
    }
  });

  it("y coincide con v_esperando_plata, que es la unica que sabe repartir la plata", async () => {
    /*
      LAS DOS LISTAS SE COMPARAN A PROPOSITO. Si algun dia la vista de la cola calculara por su
      cuenta si la tarjeta cubre, esta prueba seria lo unico que lo notaria.
    */
    const { data: cola } = await gestora.from("v_cola_de_gestora").select("tramite_id, bloque");
    const { data: esperando } = await gestora.from("v_esperando_plata").select("tramite_id");

    const enEspera = new Set((esperando ?? []).map((e) => String(e.tramite_id)));
    const enBloque = new Set(
      (cola ?? []).filter((c) => c.bloque === "esperando").map((c) => String(c.tramite_id)),
    );
    expect([...enBloque].toSorted()).toEqual([...enEspera].toSorted());
  });

  it("la oficina no la usa: su cola viene vacia", async () => {
    /*
      Gerencia puede hacer lo que hace una gestora, pero desde la ficha del tramite y no desde una
      cola (spec 5). Que la vista le devuelva vacio no es una restriccion: es que la pregunta
      "que me toca a MI" no tiene sentido para quien no lleva tramites.
    */
    const { data, error } = await gerencia.from("v_cola_de_gestora").select("tramite_id");
    expect(error).toBeNull();
    expect(data?.length ?? 0).toBe(0);
  });
});
```

- [ ] **Paso 2: Correr la prueba y ver que falla por la razón esperada**

```bash
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && npm run test:rls > /tmp/rls.log 2>&1; echo "EXIT: $?"; grep -E "cola|42P01|does not exist" /tmp/rls.log | head -10
```

Esperado: `EXIT: 1` y el mensaje `relation "public.v_cola_de_gestora" does not exist` (código
42P01). **Si falla por otra cosa, pará.** Un fallo por credenciales o por falta de datos de prueba
no comprueba nada.

- [ ] **Paso 3: Escribir la migración**

```bash
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && export SUPABASE_ACCESS_TOKEN="$(grep '^SUPABASE_ACCESS_TOKEN=' .env.local | cut -d= -f2-)" && npm run db:nueva la_cola_de_la_gestora
```

Y en el archivo que crea:

```sql
-- ============================================================================
--  LA COLA DE LA GESTORA
-- ============================================================================
--
--  Una fila por tramite vivo de quien consulta, con DOS respuestas ya tomadas: en que bloque va y
--  que boton le toca. El navegador no decide ninguna de las dos.
--
--  ============================================================================
--   POR QUE ACA Y NO EN EL NAVEGADOR
--  ============================================================================
--
--  Porque "la tarjeta cubre este presupuesto" NO es una comparacion entre dos numeros. La plata es
--  de la TARJETA y se la reparten todos los presupuestos vivos de esa tarjeta: con 500.000 y tres
--  presupuestos de 200.000, cubre dos y media. Esa cuenta ya vive en `v_esperando_plata` y es la
--  parte dificil.
--
--  Si el front la rehiciera, el dia que cambie el criterio —que entre el deposito en transito, que
--  cambie que cuenta como comprometido— la pantalla de la gestora seguiria con el viejo. Y no
--  daria error: mostraria una tarjeta en el bloque equivocado. Es `frenado_por_saldo` de nuevo,
--  que es el defecto que este sistema vino a matar.
--
--  ============================================================================
--   POR QUE UN `left join` A `v_esperando_plata` Y NO UN `exists`
--  ============================================================================
--
--  Porque de ahi sale tambien `falta`, que es el numero que la pantalla necesita para explicar la
--  ausencia del boton. Un `exists` diria que si o que no y habria que ir a buscar el cuanto por
--  separado — dos consultas que pueden contestar cosas distintas.
--
--  ============================================================================
--   QUE NO ESTA EN LA COLA
--  ============================================================================
--
--  `recibido` y `controlado` son de la oficina: la gestora todavia no lo tiene en la mano.
--  `anulado` no esta porque no hay nada que hacer con el. `devuelto` esta SOLO si se devolvio hoy,
--  y por eso mide contra `hoy_argentina()` y no contra `now()`: a las 21:30 de Argentina `now()`
--  en UTC ya es maniana, y la lista de "terminados hoy" se vaciaria sola a mitad de la tarde.
-- ============================================================================

create or replace view public.v_cola_de_gestora as
select
  t.id                                        as tramite_id,
  t.cliente_nombre,
  t.dominio,
  t.oferta_referencia,
  r.nombre                                    as empresa,
  t.razon_social_id,
  t.tarjeta_id,
  t.estado,
  case
    when t.estado = 'devuelto'                       then 'terminado'
    when t.estado = 'presupuestado'
     and e.tramite_id is not null                    then 'esperando'
    else 'te_toca'
  end                                         as bloque,
  case
    when t.estado = 'entregado'                      then 'presupuestar'
    when t.estado = 'presupuestado'
     and e.tramite_id is null                        then 'ir_al_registro'
    when t.estado = 'resuelto'                       then 'devolver'
    else 'ninguna'
  end                                         as accion,
  coalesce(t.deposito_solicitado, 0::numeric) as pide,
  coalesce(e.falta, 0::numeric)               as falta,
  -- El momento que ordena cada bloque: desde cuando esta esperando esto.
  coalesce(t.presupuestado_at, t.entregado_at, t.recibido_at) as desde
from public.tramites t
join public.razones_sociales r on r.id = t.razon_social_id
left join public.v_esperando_plata e on e.tramite_id = t.id
where t.gestora_id = public.mi_gestora_id()
  and (
    t.estado in ('entregado', 'presupuestado', 'resuelto')
    or (t.estado = 'devuelto' and t.devuelto_at >= hoy_argentina())
  );

-- Recrear una vista NO conserva lo revocado. Se vuelve a poner, siempre.
alter view public.v_cola_de_gestora set (security_invoker = true);
revoke all on public.v_cola_de_gestora from anon, authenticated;
grant select on public.v_cola_de_gestora to anon, authenticated;

comment on view public.v_cola_de_gestora is
  'La cola de quien consulta: un tramite por fila, con su bloque y su accion ya decididos. '
  'El bloque `esperando` sale de v_esperando_plata y NO se recalcula en ningun otro lado.';
```

- [ ] **Paso 4: Comprobar que `mi_gestora_id()` es ejecutable por `anon`**

Es la trampa que costó dos migraciones el 28/08/2026: Postgres mira el permiso de `execute` **al
planificar**, así que una vista que llama a un helper revocado le contesta a `anon` 42501 (rechazo)
en vez de cero filas (ausencia).

El SQL va en un archivo y el `fetch` en otro: meter los dos en un `node -e` obliga a anidar tres
niveles de comillas, y ahí es donde el shell se come una palabra sin avisar.

```bash
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && cat > /tmp/acl.sql <<'SQL'
select proname, coalesce(array_to_string(proacl::text[], ' | '), 'sin acl') as acl
from pg_proc where pronamespace = 'public'::regnamespace and proname = 'mi_gestora_id';
SQL
cat > /tmp/consulta.mjs <<'JS'
import fs from "node:fs";
const env = fs.readFileSync(".env.local", "utf8");
const get = (k) => (env.match(new RegExp("^" + k + "=(.*)$", "m")) || [])[1]?.trim();
const r = await fetch(
  "https://api.supabase.com/v1/projects/drsooohkwwpnijonxwwt/database/query",
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${get("SUPABASE_ACCESS_TOKEN")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: fs.readFileSync(process.argv[2], "utf8") }),
  },
);
console.log("STATUS", r.status);
console.log(await r.text());
JS
cp /tmp/consulta.mjs ./.tmp-consulta.mjs && node ./.tmp-consulta.mjs /tmp/acl.sql; rm -f ./.tmp-consulta.mjs
```

**El `.mjs` se copia adentro del proyecto y se borra después** porque desde `/tmp` no resuelve
`node_modules` — no lo necesita para esto, pero sí para cualquier variante que importe algo, y
dejarlo afuera es la clase de detalle que hace perder diez minutos.

Si el resultado **no** incluye `anon=X`, agregá al final de la migración, antes de aplicarla:

```sql
-- `mi_gestora_id()` sin sesion devuelve null, asi que `anon` no lee nada al ejecutarla — pero
-- necesita poder ejecutarla igual, porque el permiso se mira al PLANIFICAR la consulta de la
-- vista. Sin esto, quien no entro recibe 42501 (rechazo) en vez de cero filas (ausencia), y eso
-- manda a buscar un problema de permisos donde solo falta haber entrado.
grant execute on function public.mi_gestora_id() to anon;
```

- [ ] **Paso 5: Aplicar y comprobar que `anon` recibe ausencia, no rechazo**

```bash
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && export SUPABASE_ACCESS_TOKEN="$(grep '^SUPABASE_ACCESS_TOKEN=' .env.local | cut -d= -f2-)" && npm run migraciones > /tmp/m.log 2>&1; echo "GUARDIAN: $?" && npx supabase db push --yes > /tmp/p.log 2>&1; echo "PUSH: $?"; tail -5 /tmp/p.log
```

Después, sin sesión:

```bash
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && node -e '
const fs=require("fs");const e=fs.readFileSync(".env.local","utf8");
const g=k=>(e.match(new RegExp("^"+k+"=(.*)$","m"))||[])[1].trim();
fetch(`${g("VITE_SUPABASE_URL")}/rest/v1/v_cola_de_gestora?select=tramite_id`,
  {headers:{apikey:g("VITE_SUPABASE_ANON_KEY")}})
 .then(r=>r.text().then(t=>console.log("status",r.status,"cuerpo",t)));'
```

Esperado: `status 200 cuerpo []`. **Si dice 401 y 42501, falta el `grant` del paso 4.**

- [ ] **Paso 6: Correr las pruebas y ver que pasan**

```bash
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && npm run test:rls > /tmp/rls.log 2>&1; echo "EXIT: $?"; grep -E "^ *Tests |cola" /tmp/rls.log | head -10
```

Esperado: `EXIT: 0`, y las cinco pruebas nuevas de "la cola de la gestora" en verde.

- [ ] **Paso 7: Regenerar los tipos y comprobar el portón**

```bash
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && export SUPABASE_ACCESS_TOKEN="$(grep '^SUPABASE_ACCESS_TOKEN=' .env.local | cut -d= -f2-)" && npm run db:tipos > /tmp/t.log 2>&1; echo "TIPOS: $?" && grep -n "v_cola_de_gestora" src/lib/database.types.ts | head -2 && npm run tipos:al-dia > /dev/null 2>&1; echo "AL DIA: $?"
```

- [ ] **Paso 8: Commit**

```bash
git add supabase/migrations src/permisos-plata.rls.test.ts src/lib/database.types.ts src/lib/tablas.generado.ts && git commit -F- <<'EOF'
La cola de la gestora la decide la base, no el navegador

Una fila por tramite con su bloque y su accion ya resueltos. El bloque
`esperando` sale de `v_esperando_plata`, que es la unica que sabe repartir la
plata de una tarjeta entre todos sus presupuestos vivos.

Rehacer esa cuenta en JavaScript seria reescribir la parte dificil, peor y en
otro idioma — y el dia que cambiara el criterio la pantalla de la gestora
seguiria con el viejo SIN DAR ERROR, mostrando una tarjeta en el bloque
equivocado. Eso es `frenado_por_saldo` de nuevo.

Hay una prueba que compara las dos listas justamente para que, si algun dia la
vista calculara por su cuenta, algo lo note.
EOF
```

---

## Tarea 2: El hook y el vocabulario de la cola

**Archivos:**
- Crear: `src/lib/cola.ts`, `src/lib/cola.test.ts`

**Interfaces:**
- Consume: `public.v_cola_de_gestora` (Tarea 1), `aNumero` de `src/lib/datos.ts`, `supabase` de
  `src/lib/supabase.ts`.
- Produce:
  - `export type Bloque = "te_toca" | "esperando" | "terminado"`
  - `export type Accion = "presupuestar" | "ir_al_registro" | "devolver" | "ninguna"`
  - `export interface FilaDeCola { tramite_id: string; cliente_nombre: string; dominio: string | null;
    oferta_referencia: string | null; empresa: string; razon_social_id: string;
    tarjeta_id: string | null; estado: string; bloque: Bloque; accion: Accion; pide: number;
    falta: number; desde: string | null }`
  - `export const BLOQUES: { valor: Bloque; titulo: string; vacio: string }[]`
  - `export function textoDeAccion(a: Accion): string | null`
  - `export function useCola(): UseQueryResult<FilaDeCola[]>` — clave `["cola"]`
  - `export function agrupar(filas: FilaDeCola[]): Record<Bloque, FilaDeCola[]>`

- [ ] **Paso 1: Escribir la prueba que falla**

`src/lib/cola.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { agrupar, BLOQUES, textoDeAccion, type FilaDeCola } from "./cola";

/** Una fila cualquiera, para no repetir doce campos en cada caso. */
function fila(p: Partial<FilaDeCola>): FilaDeCola {
  return {
    tramite_id: "t1",
    cliente_nombre: "ROSALES MARIA ROSA",
    dominio: "VG506910",
    oferta_referencia: null,
    empresa: "PARIS AUTOS",
    razon_social_id: "r1",
    tarjeta_id: "c1",
    estado: "entregado",
    bloque: "te_toca",
    accion: "presupuestar",
    pide: 0,
    falta: 0,
    desde: "2026-08-28T10:00:00Z",
    ...p,
  };
}

describe("los tres bloques", () => {
  it("estan en el orden en que se miran: primero lo que hay que hacer", () => {
    /*
      EL ORDEN ES LA PANTALLA. Ella abre el telefono para saber que hacer ahora, no para
      enterarse de lo que termino. "Terminados hoy" ultimo y plegado.
    */
    expect(BLOQUES.map((b) => b.valor)).toEqual(["te_toca", "esperando", "terminado"]);
  });

  it("cada bloque sabe que decir cuando esta vacio", () => {
    // Un bloque vacio sin texto se lee como un error de carga. Obligatorio en los tres.
    for (const b of BLOQUES) expect(b.vacio.length, `${b.valor} no dice nada al estar vacio`).toBeGreaterThan(10);
  });
});

describe("agrupar", () => {
  it("pone cada fila en su bloque y deja los otros vacios, no ausentes", () => {
    /*
      VACIO Y AUSENTE NO SON LO MISMO. Si un bloque faltara del objeto, la pantalla no lo
      dibujaria y ella no sabria si no tiene nada o si no se cargo.
    */
    const r = agrupar([fila({ tramite_id: "a", bloque: "te_toca" })]);
    expect(r.te_toca.map((f) => f.tramite_id)).toEqual(["a"]);
    expect(r.esperando).toEqual([]);
    expect(r.terminado).toEqual([]);
  });

  it("ordena por antiguedad: lo que espera hace mas tiempo va arriba", () => {
    const r = agrupar([
      fila({ tramite_id: "nuevo", desde: "2026-08-28T15:00:00Z" }),
      fila({ tramite_id: "viejo", desde: "2026-08-28T09:00:00Z" }),
    ]);
    expect(r.te_toca.map((f) => f.tramite_id)).toEqual(["viejo", "nuevo"]);
  });

  it("una fila sin fecha va al final y no rompe el orden", () => {
    // `desde` sale de tres columnas con coalesce; si las tres fueran null, ordenar por null
    // dejaria la fila en cualquier lado segun el navegador.
    const r = agrupar([
      fila({ tramite_id: "sin", desde: null }),
      fila({ tramite_id: "con", desde: "2026-08-28T09:00:00Z" }),
    ]);
    expect(r.te_toca.map((f) => f.tramite_id)).toEqual(["con", "sin"]);
  });
});

describe("el texto del boton", () => {
  it("dice lo que va a pasar, en voseo", () => {
    expect(textoDeAccion("presupuestar")).toBe("Cargar el presupuesto");
    expect(textoDeAccion("ir_al_registro")).toBe("Andá al registro");
    expect(textoDeAccion("devolver")).toBe("Entregar a administración");
  });

  it("y sin accion NO hay boton", () => {
    /*
      DEVUELVE null Y NO UNA CADENA VACIA. Un boton con texto vacio sigue siendo un boton: se
      puede tabular hasta el, el lector de pantalla lo anuncia sin nombre, y se puede apretar.
    */
    expect(textoDeAccion("ninguna")).toBeNull();
  });
});
```

- [ ] **Paso 2: Correr y ver que falla**

```bash
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && npx vitest run src/lib/cola.test.ts > /tmp/c.log 2>&1; echo "EXIT: $?"; grep -E "Cannot find module|Failed to resolve" /tmp/c.log | head -3
```

Esperado: `EXIT: 1` con `Failed to resolve import "./cola"`.

- [ ] **Paso 3: Escribir `src/lib/cola.ts`**

```ts
import { useQuery } from "@tanstack/react-query";
import { supabase } from "./supabase";
import { aNumero } from "./datos";

/**
 * ============================================================================
 *  LA COLA DE LA GESTORA
 * ============================================================================
 *
 * El bloque y la acción vienen decididos DE LA BASE. Acá no se recalcula ninguno de los dos: si
 * aparece la tentación de escribir `saldo >= pide`, es la señal de que algo se está duplicando.
 * La razón entera está en la migración `la_cola_de_la_gestora`.
 */

export type Bloque = "te_toca" | "esperando" | "terminado";
export type Accion = "presupuestar" | "ir_al_registro" | "devolver" | "ninguna";

export interface FilaDeCola {
  tramite_id: string;
  cliente_nombre: string;
  dominio: string | null;
  oferta_referencia: string | null;
  empresa: string;
  razon_social_id: string;
  tarjeta_id: string | null;
  estado: string;
  bloque: Bloque;
  accion: Accion;
  /** Lo que pide el presupuesto, en centavos. */
  pide: number;
  /** Cuánto falta depositar en la tarjeta para que salga. En centavos. Cero si no espera nada. */
  falta: number;
  desde: string | null;
}

/*
  EL ORDEN DE ESTA LISTA ES EL ORDEN DE LA PANTALLA, y no es alfabético ni casual: ella abre el
  teléfono para saber qué hacer ahora. Lo que ya terminó va último y plegado.

  `vacio` es obligatorio en los tres. Un bloque vacío sin una palabra que lo explique se lee como
  un error de carga, y la respuesta a "no tenés nada pendiente" no puede parecerse a "no se pudo
  cargar".
*/
export const BLOQUES: { valor: Bloque; titulo: string; vacio: string }[] = [
  {
    valor: "te_toca",
    titulo: "Te toca a vos",
    vacio: "No tenés nada para hacer ahora mismo.",
  },
  {
    valor: "esperando",
    titulo: "Esperando a la oficina",
    vacio: "No estás esperando plata de nadie.",
  },
  {
    valor: "terminado",
    titulo: "Terminados hoy",
    vacio: "Todavía no devolviste ninguno hoy.",
  },
];

/**
 * El texto del botón, o `null` si no hay nada que hacer.
 *
 * DEVUELVE `null` Y NO UNA CADENA VACÍA a propósito: un botón con texto vacío sigue siendo un
 * botón. Se puede tabular hasta él, el lector de pantalla lo anuncia sin nombre, y se puede
 * apretar. La ausencia de acción tiene que ser la ausencia del elemento.
 */
export function textoDeAccion(a: Accion): string | null {
  switch (a) {
    case "presupuestar":
      return "Cargar el presupuesto";
    case "ir_al_registro":
      return "Andá al registro";
    case "devolver":
      return "Entregar a administración";
    case "ninguna":
      return null;
  }
}

/**
 * Reparte las filas en los tres bloques, del más viejo al más nuevo.
 *
 * SIEMPRE DEVUELVE LOS TRES, aunque estén vacíos. Un bloque ausente no se dibuja, y entonces la
 * pantalla no puede decir "no tenés nada": simplemente no muestra nada, que es lo mismo que se ve
 * cuando algo falló.
 */
export function agrupar(filas: FilaDeCola[]): Record<Bloque, FilaDeCola[]> {
  const r: Record<Bloque, FilaDeCola[]> = { te_toca: [], esperando: [], terminado: [] };
  for (const f of filas) r[f.bloque].push(f);

  /*
    Una fila sin `desde` va al final. `desde` sale de un `coalesce` de tres columnas, así que en
    la práctica no debería ser nulo — pero ordenar por null deja la fila donde el navegador
    quiera, y "donde el navegador quiera" en una lista de trabajo es arriba de todo la mitad de
    las veces.
  */
  const clave = (f: FilaDeCola) => f.desde ?? "9999-12-31";
  for (const b of Object.keys(r) as Bloque[]) {
    r[b] = r[b].toSorted((a, z) => clave(a).localeCompare(clave(z)));
  }
  return r;
}

/*
  EL SELECT VA EN UNA SOLA CADENA LITERAL, sin partirla con `+`: supabase-js infiere los tipos
  leyendo ese literal, y una concatenación lo deja en `GenericStringError` — o sea que se pierde
  el chequeo de tipos justo en la consulta que trae plata.
*/
const COLUMNAS =
  "tramite_id, cliente_nombre, dominio, oferta_referencia, empresa, razon_social_id, tarjeta_id, estado, bloque, accion, pide, falta, desde";

export function useCola() {
  return useQuery({
    queryKey: ["cola"],
    queryFn: async (): Promise<FilaDeCola[]> => {
      const { data, error } = await supabase.from("v_cola_de_gestora").select(COLUMNAS);
      if (error) throw error;
      return (data ?? []).map((f) => ({
        tramite_id: String(f.tramite_id),
        cliente_nombre: String(f.cliente_nombre),
        dominio: f.dominio === null ? null : String(f.dominio),
        oferta_referencia: f.oferta_referencia === null ? null : String(f.oferta_referencia),
        empresa: String(f.empresa),
        razon_social_id: String(f.razon_social_id),
        tarjeta_id: f.tarjeta_id === null ? null : String(f.tarjeta_id),
        estado: String(f.estado),
        bloque: f.bloque as Bloque,
        accion: f.accion as Accion,
        pide: aNumero(f.pide),
        falta: aNumero(f.falta),
        desde: f.desde === null ? null : String(f.desde),
      }));
    },
  });
}
```

- [ ] **Paso 4: Correr y ver que pasan**

```bash
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && npx vitest run src/lib/cola.test.ts > /tmp/c.log 2>&1; echo "EXIT: $?"; grep -E "^ *Tests " /tmp/c.log
```

Esperado: `EXIT: 0`, `Tests 6 passed (6)`.

- [ ] **Paso 5: Commit**

```bash
git add src/lib/cola.ts src/lib/cola.test.ts && git commit -F- <<'EOF'
El vocabulario de la cola, con los tres bloques siempre presentes

`agrupar` devuelve los tres aunque esten vacios. Un bloque ausente no se dibuja,
y entonces la pantalla no puede decir "no tenes nada": no muestra nada, que es
exactamente lo que se ve cuando algo fallo.

`textoDeAccion` devuelve null y no cadena vacia: un boton con texto vacio sigue
siendo un boton — se tabula hasta el, el lector lo anuncia sin nombre, y se
puede apretar.
EOF
```

---

## Tarea 3: La pantalla de la cola, y `/` según el rol

**Archivos:**
- Crear: `src/features/gestora/Cola.tsx`, `src/features/gestora/TarjetaDeTramite.tsx`
- Modificar: `src/rutas.tsx:61-65`
- Test: `e2e/gestora.spec.ts` (se crea acá y crece en las tareas 6 y 7)

**Interfaces:**
- Consume: `useCola`, `agrupar`, `BLOQUES`, `textoDeAccion`, `FilaDeCola` (Tarea 2);
  `useSesion` de `src/lib/sesion.ts`; `Panel` de `src/components/Panel.tsx`; `formatearCorto` de
  `src/lib/plata.ts`; `entrarComo` de `e2e/entrar.ts`.
- Produce: `export function Cola()`; `export function TarjetaDeTramite({ fila }: { fila: FilaDeCola })`.

- [ ] **Paso 1: Escribir la prueba que falla**

`e2e/gestora.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { entrarComo } from "./entrar";

/**
 * ============================================================================
 *  LA COLA, EN EL CHROME DE VERDAD
 * ============================================================================
 *
 *  Se prueba en el teléfono además de en el escritorio porque es donde se usa. El proyecto
 *  `telefono` de `playwright.config.ts` ya emula uno.
 */

test("la gestora entra y ve su cola, no el resumen de la oficina", async ({ page }) => {
  await entrarComo(page, "gestora");

  await expect(page.getByRole("heading", { name: /Te toca a vos/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Esperando a la oficina/ })).toBeVisible();

  // Y NO ve la pantalla de la oficina: es el otro producto.
  await expect(page.getByRole("heading", { name: "Grupo Paris" })).toHaveCount(0);
});

test("la oficina sigue viendo el resumen, y no una cola", async ({ page }) => {
  await entrarComo(page, "gerencia");

  await expect(page.getByRole("heading", { name: "Grupo Paris" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Te toca a vos/ })).toHaveCount(0);
});

test("cada tarjeta dice de que empresa es y que hay que hacer", async ({ page }) => {
  await entrarComo(page, "gestora");

  const primera = page.locator("[data-tarjeta-tramite]").first();
  await expect(primera).toBeVisible();

  // El dominio y la empresa, que es como ella identifica un trámite.
  await expect(primera).toContainText(/[A-Z]{2}\d{3}[A-Z]{2}|[A-Z]{3}\d{3}/);
});

test("lo que espera plata no tiene boton, y dice cuanto falta", async ({ page }) => {
  /*
    ES EL CORAZON DEL PRODUCTO. Un botón en un trámite sin plata la manda al registro a que la
    rebote el cajero. Y la ausencia del botón sola no alcanza: tiene que venir con el número.
  */
  await entrarComo(page, "gestora");

  const esperando = page.locator("[data-bloque='esperando'] [data-tarjeta-tramite]");
  const cuantas = await esperando.count();
  test.skip(cuantas === 0, "la gestora de prueba no tiene ningun tramite esperando plata");

  const uno = esperando.first();
  await expect(uno.getByRole("button")).toHaveCount(0);
  await expect(uno).toContainText(/Falta/);
});

test("un bloque vacio lo dice con palabras, y no queda en blanco", async ({ page }) => {
  await entrarComo(page, "gestora");

  // Alguno de los tres va a estar vacío; el que esté, tiene que hablar.
  const bloques = page.locator("[data-bloque]");
  for (let i = 0; i < (await bloques.count()); i++) {
    const b = bloques.nth(i);
    if ((await b.locator("[data-tarjeta-tramite]").count()) === 0) {
      await expect(b, "un bloque vacio no dice nada").toContainText(/No |Todavía/);
    }
  }
});
```

- [ ] **Paso 2: Correr y ver que falla**

```bash
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && npx playwright test e2e/gestora.spec.ts > /tmp/e.log 2>&1; echo "EXIT: $?"; grep -E "failed|Error:|Received" /tmp/e.log | head -6
```

Esperado: `EXIT: 1`, y el primer test falla porque la gestora ve `Grupo Paris` — hoy `/` es el
resumen de la oficina para todos.

- [ ] **Paso 3: Escribir `src/features/gestora/TarjetaDeTramite.tsx`**

```tsx
import { Link } from "@tanstack/react-router";
import { textoDeAccion, type FilaDeCola } from "@/lib/cola";
import { formatearCorto } from "@/lib/plata";

/**
 * ============================================================================
 *  UN TRAMITE EN LA COLA
 * ============================================================================
 *
 *  Cuatro renglones y a lo sumo un botón. No hay chip de estado: el estado ya está dicho en la
 *  frase y en el bloque, y un chip más sería una tercera forma de decir lo mismo.
 *
 *  EL NOMBRE ES UN ENLACE Y EL BOTON ES UN BOTON. Son dos cosas distintas —uno lleva a mirar, el
 *  otro hace avanzar el trámite— y meterlos en el mismo elemento obliga a adivinar cuál se
 *  disparó. En un teléfono, con el pulgar, eso se equivoca.
 */
export function TarjetaDeTramite({ fila }: { fila: FilaDeCola }) {
  const boton = textoDeAccion(fila.accion);

  return (
    <div
      data-tarjeta-tramite="true"
      /*
        `view-transition-name` POR TRAMITE: es lo que hace que la tarjeta se vea VIAJAR de un
        bloque al otro cuando entra la plata, en vez de desaparecer de un lado y aparecer del
        otro. El nombre tiene que ser único en la página y estable entre dibujos, por eso va el
        id y no el índice.
      */
      style={{ viewTransitionName: `tramite-${fila.tramite_id}` }}
      className="flex flex-col gap-1 border-b border-line px-4 py-3 last:border-b-0"
    >
      <Link
        to="/tramite/$tramiteId"
        params={{ tramiteId: fila.tramite_id }}
        className="text-sm underline-offset-2 hover:underline"
      >
        {fila.cliente_nombre}
      </Link>

      <p className="text-2xs text-ink2">
        {fila.dominio ?? fila.oferta_referencia ?? "sin dominio"} · {fila.empresa}
      </p>

      <p className="text-xs">{frase(fila)}</p>

      {boton !== null && (
        <Link
          to="/tramite/$tramiteId"
          params={{ tramiteId: fila.tramite_id }}
          /*
            MIN-HEIGHT 44px: es el mínimo táctil que recomienda Apple y que usa el resto de esta
            app. Con menos, en un teléfono, se le erra.
          */
          className="mt-1 inline-flex min-h-11 items-center justify-center rounded-md bg-accent px-4 text-sm text-accent-ink"
        >
          {boton}
        </Link>
      )}
    </div>
  );
}

/**
 * La frase que explica por qué está donde está.
 *
 * LA DEL BLOQUE DE ESPERA LLEVA EL NUMERO. "Esperando plata" sin decir cuánta la deja sin saber
 * si faltan mil pesos o medio millón — y con esa diferencia decide si llama a la oficina o no.
 */
function frase(f: FilaDeCola): string {
  if (f.bloque === "esperando") return `Falta que depositen ${formatearCorto(f.falta)}`;
  switch (f.accion) {
    case "presupuestar":
      return "Falta el presupuesto";
    case "ir_al_registro":
      return `Ya tenés los ${formatearCorto(f.pide)}`;
    case "devolver":
      return "Resuelto: falta entregarlo a administración";
    case "ninguna":
      return "Devuelto";
  }
}
```

- [ ] **Paso 4: Escribir `src/features/gestora/Cola.tsx`**

```tsx
import { agrupar, BLOQUES, useCola } from "@/lib/cola";
import { useSesion } from "@/lib/sesion";
import { Panel } from "@/components/Panel";
import { SkeletonLineas } from "@/components/Skeleton";
import { TarjetaDeTramite } from "./TarjetaDeTramite";
import { SaldoDeArriba } from "./SaldoDeArriba";

/**
 * ============================================================================
 *  LA COLA: UNA PANTALLA, TRES BLOQUES, NINGUN FILTRO
 * ============================================================================
 *
 *  Sin menú, sin tabla, sin buscador y sin selector de empresa. Cada trámite dice de qué empresa
 *  es; un selector la obligaría a saber de antemano por cuál preguntar, y ella no piensa por
 *  empresa: piensa por trámite. Está en el spec, sección 5.
 *
 *  LOS TRES BLOQUES SE DIBUJAN SIEMPRE, vacíos incluidos, cada uno con su frase. Un bloque que
 *  desaparece cuando no tiene nada deja la pantalla distinta cada día, y una pantalla que cambia
 *  de forma obliga a leerla entera de nuevo cada vez.
 */
export function Cola() {
  const { perfil } = useSesion();
  const cola = useCola();

  if (cola.isPending) return <SkeletonLineas cantidad={4} className="mx-auto max-w-xl p-4" />;

  if (cola.isError) {
    return (
      <Panel>
        <p className="text-sm">No se pudo traer tu lista de trámites.</p>
        <p className="mt-1 text-xs text-ink2">
          Probá de nuevo en un rato. Si sigue igual, avisale a la oficina.
        </p>
      </Panel>
    );
  }

  const porBloque = agrupar(cola.data);

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4 p-4">
      <div>
        <h1 className="text-xl">Hola {perfil?.nombre ?? ""}</h1>
        <SaldoDeArriba />
      </div>

      {BLOQUES.map((b) => {
        const filas = porBloque[b.valor];
        return (
          <Panel key={b.valor} densidad="compacta">
            <h2
              data-bloque-titulo={b.valor}
              className="px-4 pt-3 text-2xs uppercase tracking-wide text-ink2"
            >
              {b.titulo} ({filas.length})
            </h2>
            <div data-bloque={b.valor}>
              {filas.length === 0 ? (
                <p className="px-4 py-3 text-xs text-ink2">{b.vacio}</p>
              ) : (
                filas.map((f) => <TarjetaDeTramite key={f.tramite_id} fila={f} />)
              )}
            </div>
          </Panel>
        );
      })}
    </div>
  );
}
```

- [ ] **Paso 5: Hacer que `/` se dibuje según el rol**

En `src/rutas.tsx`, reemplazar la definición de `rutaResumen` (líneas 61-65) por:

```tsx
/**
 * ============================================================================
 *  LA MISMA DIRECCION, DOS PRODUCTOS
 * ============================================================================
 *
 *  `/` es el resumen de empresas para la oficina y la cola para la gestora. Son dos productos
 *  distintos sobre la misma base, y cada uno entra por su puerta sin tener que elegirla.
 *
 *  POR QUE NO DOS RUTAS: una ruta `/mis-tramites` obligaría a que algo la mande ahí —un redirect
 *  o un menú—. Un redirect deja una dirección intermedia en el historial que rompe el botón
 *  "atrás", y un menú es justo lo que la app de la gestora no tiene.
 *
 *  El rol lo decide la base: `useSesion` lo lee de `perfiles`, y la RLS ya impide que una gestora
 *  vea lo que no es suyo aunque llegara a dibujar la otra pantalla.
 */
function PantallaDeEntrada() {
  const { rol } = useSesion();
  return rol === "gestora" ? <Cola /> : <Resumen />;
}

const rutaResumen = createRoute({
  getParentRoute: () => rutaRaiz,
  path: "/",
  component: PantallaDeEntrada,
});
```

Y agregar arriba, con los demás imports:

```tsx
import { Cola } from "./features/gestora/Cola";
import { useSesion } from "./lib/sesion";
```

- [ ] **Paso 6: Correr las pruebas y ver que pasan**

```bash
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && npx playwright test e2e/gestora.spec.ts > /tmp/e.log 2>&1; echo "EXIT: $?"; grep -E "passed|failed" /tmp/e.log | tail -3
```

Esperado: `EXIT: 0`, `10 passed` (cinco pruebas en dos navegadores).

- [ ] **Paso 7: Comprobar el portón completo**

```bash
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && npm run formato > /dev/null 2>&1; for g in lint formato:check test build espacios colores contraste; do npm run "$g" > "/tmp/g-$g.log" 2>&1; printf "  %-14s EXIT %s\n" "$g" "$?"; done
```

- [ ] **Paso 8: Commit**

```bash
git add src/features/gestora src/rutas.tsx e2e/gestora.spec.ts && git commit -F- <<'EOF'
La cola de la gestora: una pantalla, tres bloques, ningun filtro

`/` se dibuja segun el rol y no hay redirect: un redirect deja una direccion
intermedia en el historial que rompe el boton "atras", y un menu es justo lo que
la app de la gestora no tiene.

LOS TRES BLOQUES SE DIBUJAN SIEMPRE, vacios incluidos, cada uno con su frase. Un
bloque que desaparece cuando no tiene nada deja la pantalla distinta cada dia, y
una pantalla que cambia de forma hay que leerla entera de nuevo cada vez.

El nombre es un enlace y el boton es un boton: dos cosas distintas, y en un
telefono con el pulgar se equivoca la que sea ambigua.
EOF
```

---

## Tarea 4: El saldo de arriba, de las tarjetas donde ella trabaja

**Archivos:**
- Crear: `src/features/gestora/SaldoDeArriba.tsx`
- Test: dentro de `e2e/gestora.spec.ts`

**Interfaces:**
- Consume: `useSaldos()` de `src/lib/datos.ts` (devuelve `Saldo[]` con
  `{ tarjeta_id, nombre, contable, en_transito, comprometido, orden, movimientos_visibles, puedo_ver }`),
  `formatearCorto` de `src/lib/plata.ts`.
- Produce: `export function SaldoDeArriba()`.

- [ ] **Paso 1: Escribir la prueba que falla**

Agregar a `e2e/gestora.spec.ts`:

```ts
test("arriba muestra el saldo de las tarjetas donde tiene trabajo, y ninguna otra", async ({
  page,
}) => {
  /*
    SIN SELECTOR DE TARJETA (spec 5). La línea de arriba muestra sólo las tarjetas donde ella
    tiene trabajo — que son las que la RLS le deja ver el movimiento, así que la lista no la
    arma la pantalla: la arma el permiso.
  */
  await entrarComo(page, "gestora");

  const saldo = page.locator("[data-saldo-de-arriba]");
  await expect(saldo).toBeVisible();
  await expect(saldo).toContainText("PARIS AUTOS");

  // Y NO las que no puede ver: ahí no hay saldo que mostrar, ni siquiera un cero.
  await expect(saldo).not.toContainText("DORAL CHEVROLET");
});
```

- [ ] **Paso 2: Correr y ver que falla**

```bash
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && npx playwright test e2e/gestora.spec.ts -g "saldo de las tarjetas" > /tmp/e.log 2>&1; echo "EXIT: $?"; grep -E "Error:|Received" /tmp/e.log | head -4
```

Esperado: `EXIT: 1` porque el elemento `[data-saldo-de-arriba]` no existe.

- [ ] **Paso 3: Escribir `src/features/gestora/SaldoDeArriba.tsx`**

```tsx
import { useSaldos } from "@/lib/datos";
import { formatearCorto } from "@/lib/plata";

/**
 * ============================================================================
 *  EL SALDO DE LAS TARJETAS DONDE ELLA TRABAJA
 * ============================================================================
 *
 *  SIN SELECTOR (spec 5). Un selector la obligaría a saber de antemano por qué empresa preguntar,
 *  y ella no piensa por empresa: piensa por trámite.
 *
 *  LA LISTA NO LA ARMA ESTA PANTALLA, LA ARMA EL PERMISO. `puedo_ver` viene de la base y es la
 *  misma respuesta que usa la app de la oficina. Filtrar acá por "las que tienen trámites míos"
 *  sería una segunda regla que se puede separar de la primera.
 *
 *  Y LO QUE NO SE PUEDE VER NO SE DIBUJA, ni siquiera en cero: el 27/08/2026 toda gestora veía
 *  las cinco tarjetas en `$ 0,00` teniendo ocho millones y medio, y salía al registro creyendo
 *  que no había con qué pagar. Un cero es un número y se lee como un hecho.
 */
export function SaldoDeArriba() {
  const saldos = useSaldos();

  const mias = (saldos.data ?? []).filter((s) => s.puedo_ver);

  if (saldos.isPending) return <p className="text-xs text-ink2">Buscando los saldos…</p>;
  if (mias.length === 0) {
    return (
      <p className="text-xs text-ink2">
        Todavía no tenés trámites en ninguna tarjeta.
      </p>
    );
  }

  return (
    <div data-saldo-de-arriba="true" className="flex flex-wrap gap-x-4 gap-y-1">
      {mias.map((s) => (
        <p key={s.tarjeta_id} className="text-xs">
          <span className="text-ink2">{s.nombre}</span>{" "}
          {/*
            `tnum` son las cifras de ancho fijo. Sin eso, dos saldos uno al lado del otro bailan
            de ancho cuando cambia un dígito, y en tiempo real cambian solos.
          */}
          <span className="tnum">{formatearCorto(s.contable)}</span>
        </p>
      ))}
    </div>
  );
}
```

- [ ] **Paso 4: Correr y ver que pasa**

```bash
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && npx playwright test e2e/gestora.spec.ts > /tmp/e.log 2>&1; echo "EXIT: $?"; grep -E "passed|failed" /tmp/e.log | tail -2
```

Esperado: `EXIT: 0`, `12 passed`.

- [ ] **Paso 5: Commit**

```bash
git add src/features/gestora/SaldoDeArriba.tsx e2e/gestora.spec.ts && git commit -F- <<'EOF'
El saldo de arriba: las tarjetas donde trabaja, sin selector

La lista no la arma la pantalla, la arma el permiso: `puedo_ver` viene de la base
y es la misma respuesta que usa la app de la oficina. Filtrar aca por "las que
tienen tramites mios" seria una segunda regla que se puede separar de la primera.

Lo que no se puede ver no se dibuja NI EN CERO. El 27/08/2026 toda gestora veia
las cinco tarjetas en $ 0,00 teniendo ocho millones y medio, y salia al registro
creyendo que no habia con que pagar.
EOF
```

---

## Tarea 5: El salto en vivo

**Archivos:**
- Modificar: `src/lib/datos.ts:433-465` (`useSaldosEnVivo` invalida también `["cola"]`),
  `src/index.css` (la transición y su apagado)
- Crear: `e2e/salto.spec.ts`

**Interfaces:**
- Consume: `cargarDepositoPorLaApi(importe: number): Promise<number>` y
  `anularPorLaApi(id: number, motivo: string): Promise<void>` de `e2e/entrar.ts`; el
  `view-transition-name` que puso `TarjetaDeTramite` (Tarea 3).
- Produce: nada nuevo hacia afuera. Cambia el comportamiento de `useSaldosEnVivo`.

- [ ] **Paso 1: Escribir la prueba que falla**

`e2e/salto.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { anularPorLaApi, cargarDepositoPorLaApi, entrarComo } from "./entrar";

/**
 * ============================================================================
 *  EL SALTO: LA FUNCION CENTRAL DEL PRODUCTO
 * ============================================================================
 *
 *  El pedido original dice que "muchas veces se pisan con el dinero que hay disponible en el
 *  día". Esto es la respuesta: la oficina deposita y la tarjeta de la gestora se mueve sola del
 *  bloque de espera al de trabajo. Sin recargar, sin preguntar por WhatsApp.
 *
 *  ============================================================================
 *   POR QUE LA PLATA ENTRA POR LA API Y NO POR LA PANTALLA
 *  ============================================================================
 *
 *  La primera versión de la prueba de tiempo real del Plan B hacía todo por la interfaz y limpiaba
 *  en el `finally` con tres selectores, sobre una pantalla que ya estaba en un estado raro. Falló,
 *  la limpieza falló también, y DEJO UN DEPOSITO DE UN PESO EN PRODUCCION que hubo que anular a
 *  mano.
 *
 *  Cargar y anular por la API no debilita la prueba: lo que se comprueba es que LA PANTALLA SE
 *  ENTERE, no que el formulario ande. El formulario tiene su propia prueba.
 */

test("cuando la oficina deposita, la tarjeta salta de bloque sola", async ({ page }) => {
  await entrarComo(page, "gestora");

  const esperando = page.locator("[data-bloque='esperando'] [data-tarjeta-tramite]");
  const cuantas = await esperando.count();
  test.skip(cuantas === 0, "la gestora de prueba no tiene ningun tramite esperando plata");

  // De cuál vamos a mirar el salto, y cuánto falta para que salte.
  const texto = (await esperando.first().textContent()) ?? "";
  const cliente = texto.split("\n")[0].trim();

  let idDelDeposito = 0;
  try {
    /*
      UN IMPORTE GRANDE A PROPOSITO: tiene que alcanzar para cubrir TODOS los presupuestos vivos
      de esa tarjeta, porque la plata es de la tarjeta y se la reparten entre todos. Un depósito
      del tamaño exacto de un presupuesto puede no mover a nadie de bloque.
    */
    idDelDeposito = await cargarDepositoPorLaApi(99_000_000);

    // Sin recargar: la pantalla se tiene que enterar sola.
    await expect(
      page.locator("[data-bloque='te_toca']").getByText(cliente),
      "la tarjeta no salto: el tiempo real no invalido la cola",
    ).toBeVisible({ timeout: 20_000 });

    await expect(page.locator("[data-bloque='esperando']").getByText(cliente)).toHaveCount(0);
  } finally {
    // Se anula por la misma puerta que usaría una persona: `anular_movimiento`, con su motivo.
    if (idDelDeposito !== 0) await anularPorLaApi(idDelDeposito, "prueba del salto en vivo");
  }
});

test("y la tarjeta tiene nombre de transicion, que es lo que la hace viajar", async ({ page }) => {
  /*
    SE COMPRUEBA EL ATRIBUTO Y NO LA ANIMACION. Playwright no puede ver una transición de vista
    ocurrir; lo que sí puede es comprobar que cada tarjeta tenga su nombre único y estable, que es
    la condición sin la cual el navegador no anima nada.

    Escrito acá para que nadie crea que esta prueba comprueba que "se ve lindo": comprueba que
    está la pieza sin la cual no se ve nada.
  */
  await entrarComo(page, "gestora");

  const tarjetas = page.locator("[data-tarjeta-tramite]");
  const n = await tarjetas.count();
  test.skip(n === 0, "la gestora de prueba no tiene tramites");

  const nombres = await tarjetas.evaluateAll((els) =>
    els.map((e) => getComputedStyle(e).viewTransitionName),
  );
  expect(nombres.every((x) => x.startsWith("tramite-")), `nombres: ${nombres.join(", ")}`).toBe(
    true,
  );
  expect(new Set(nombres).size, "dos tarjetas comparten nombre de transicion").toBe(nombres.length);
});
```

- [ ] **Paso 2: Correr y ver que falla**

```bash
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && npx playwright test e2e/salto.spec.ts > /tmp/s.log 2>&1; echo "EXIT: $?"; grep -E "failed|Error:|no salto" /tmp/s.log | head -5
```

Esperado: `EXIT: 1` con "la tarjeta no salto: el tiempo real no invalido la cola". La clave
`["cola"]` todavía no se invalida.

- [ ] **Paso 3: Invalidar la cola en el tiempo real**

En `src/lib/datos.ts`, dentro de `useSaldosEnVivo`, agregar la invalidación en **los dos**
manejadores (`movimientos` y `tramites`), después de la de `["resumen"]`:

```ts
        /*
          Y LA COLA DE LA GESTORA, que es donde el depósito se convierte en un botón. Sin esto,
          la plata entra, el saldo de arriba sube, y la tarjeta sigue en "esperando a la oficina"
          — la pantalla diciendo dos cosas distintas de la misma plata, que es el defecto que
          `frenado_por_saldo` tenía y que este sistema vino a matar.
        */
        void cliente.invalidateQueries({ queryKey: ["cola"] });
```

- [ ] **Paso 4: Apagar la transición cuando se pide movimiento reducido**

En `src/index.css`, junto a las demás reglas de movimiento reducido:

```css
/*
  LAS TRANSICIONES DE VISTA NO LAS APAGA EL SELECTOR UNIVERSAL. Viven en pseudo-elementos propios
  (`::view-transition-*`), fuera del árbol normal, así que un `* { animation: none }` no las toca.
  Hay que apagarlas aparte, y esto ya mordió una vez en el Plan B.
*/
@media (prefers-reduced-motion: reduce) {
  ::view-transition-group(*),
  ::view-transition-old(*),
  ::view-transition-new(*) {
    animation: none !important;
  }
}
```

- [ ] **Paso 5: Correr y ver que pasan**

```bash
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && npx playwright test e2e/salto.spec.ts > /tmp/s.log 2>&1; echo "EXIT: $?"; grep -E "passed|failed" /tmp/s.log | tail -2
```

Esperado: `EXIT: 0`.

- [ ] **Paso 6: Comprobar que no quedó plata de prueba**

```bash
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && node -e '
const fs=require("fs");const e=fs.readFileSync(".env.local","utf8");
const g=k=>(e.match(new RegExp("^"+k+"=(.*)$","m"))||[])[1].trim();
(async()=>{
 const r=await fetch(`${g("VITE_SUPABASE_URL")}/auth/v1/token?grant_type=password`,{method:"POST",
  headers:{apikey:g("VITE_SUPABASE_ANON_KEY"),"Content-Type":"application/json"},
  body:JSON.stringify({email:g("PRUEBA_GERENCIA"),password:g("PRUEBA_PASSWORD")})});
 const {access_token:t}=await r.json();
 const m=await fetch(`${g("VITE_SUPABASE_URL")}/rest/v1/movimientos?select=id,importe,concepto,anulado&concepto=ilike.*PRUEBA*&anulado=eq.false`,
  {headers:{apikey:g("VITE_SUPABASE_ANON_KEY"),Authorization:`Bearer ${t}`}});
 const filas=await m.json();
 console.log("movimientos de prueba SIN anular:",filas.length);
 console.log(JSON.stringify(filas,null,1));
})();'
```

Esperado: `0`. **Si hay alguno, anulalo antes de seguir** — la base es la misma que producción y
la dueña ve el extracto del día.

- [ ] **Paso 7: Commit**

```bash
git add src/lib/datos.ts src/index.css e2e/salto.spec.ts && git commit -F- <<'EOF'
El salto: la oficina deposita y la tarjeta se mueve sola

Es la funcion central del producto. El pedido original dice que "muchas veces se
pisan con el dinero que hay disponible en el dia": esto es la respuesta.

Sin invalidar la clave `cola`, la plata entraba, el saldo de arriba subia, y la
tarjeta seguia en "esperando a la oficina" — la pantalla diciendo dos cosas
distintas de la misma plata, que es el defecto de `frenado_por_saldo` con otra
forma.

La plata entra y sale POR LA API. La primera version de la prueba equivalente del
plan B lo hacia por la interfaz y dejo un deposito de un peso en produccion cuando
la limpieza fallo. No debilita la prueba: lo que se comprueba es que LA PANTALLA
SE ENTERE, no que el formulario ande.

Las transiciones de vista se apagan aparte con movimiento reducido: viven en
pseudo-elementos propios y el selector universal no las toca.
EOF
```

---

## Tarea 6: La ficha reducida

**Archivos:**
- Crear: `src/features/gestora/FichaReducida.tsx`
- Modificar: `src/rutas.tsx` (agregar la ruta `/tramite/$tramiteId`)
- Test: dentro de `e2e/gestora.spec.ts`

**Interfaces:**
- Consume: `useTramite(id)`, `useConceptosDelTramite(id)` de `src/lib/datos.ts`;
  `camposPara(rol)` y `nombreDeCampo(columna)` de `src/features/tramites/campos-del-tramite.ts`;
  `Presupuesto` de `src/features/tramites/Presupuesto.tsx`; `Panel`.
- Produce: `export function FichaReducida({ tramiteId }: { tramiteId: string })`, y la ruta
  exportada `rutaTramiteDeGestora`.

- [ ] **Paso 1: Escribir la prueba que falla**

Agregar a `e2e/gestora.spec.ts`:

```ts
test("tocar el nombre abre la ficha reducida, en una sola columna", async ({ page }) => {
  await entrarComo(page, "gestora");

  const primera = page.locator("[data-tarjeta-tramite]").first();
  const cliente = ((await primera.textContent()) ?? "").split("\n")[0].trim();
  await primera.getByRole("link").first().click();

  await expect(page).toHaveURL(/\/tramite\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: cliente })).toBeVisible();
});

test("y NO le muestra lo que no es de ella", async ({ page }) => {
  /*
    Spec 5: no ve el historial de estados, ni los cambios, ni el costo real de otros trámites, ni
    ninguna cifra de la empresa que no sea el saldo de su tarjeta.

    ESTO NO ES SOLO PANTALLA: la RLS ya lo impide. La prueba está igual porque una pantalla que
    PIDE lo que no puede leer se llena de errores en consola y de bloques vacíos, y eso se ve.
  */
  await entrarComo(page, "gestora");
  await page.locator("[data-tarjeta-tramite]").first().getByRole("link").first().click();

  await expect(page.getByText("Historial de cambios")).toHaveCount(0);
  await expect(page.getByText("Movimientos de la tarjeta")).toHaveCount(0);
});

test("desde la ficha se vuelve a la cola con el boton atras", async ({ page }) => {
  await entrarComo(page, "gestora");
  await page.locator("[data-tarjeta-tramite]").first().getByRole("link").first().click();
  await expect(page).toHaveURL(/\/tramite\//);

  await page.goBack();
  await expect(page.getByRole("heading", { name: /Te toca a vos/ })).toBeVisible();
});
```

- [ ] **Paso 2: Correr y ver que falla**

```bash
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && npx playwright test e2e/gestora.spec.ts -g "ficha reducida" > /tmp/e.log 2>&1; echo "EXIT: $?"; grep -E "Error:|Received|dirección" /tmp/e.log | head -4
```

Esperado: `EXIT: 1` — la ruta `/tramite/$tramiteId` no existe y sale "Esa dirección no existe".

- [ ] **Paso 3: Escribir `src/features/gestora/FichaReducida.tsx`**

```tsx
import { Link } from "@tanstack/react-router";
import { useConceptos, useConceptosDelTramite, useTramite } from "@/lib/datos";
import { Panel } from "@/components/Panel";
import { SkeletonLineas } from "@/components/Skeleton";
import { formatearCorto } from "@/lib/plata";

/**
 * ============================================================================
 *  LO QUE VE LA GESTORA AL TOCAR EL NOMBRE
 * ============================================================================
 *
 *  La cola es la pantalla, pero no es todo lo que puede ver. Acá está lo que a ella le sirve y
 *  NADA MAS (spec 5): los datos del trámite, el presupuesto con sus líneas, y las notas.
 *
 *  NO ESTA el historial de estados, ni los cambios, ni el costo real de otros trámites, ni
 *  ninguna cifra de la empresa. Eso último no es una decisión de esta pantalla: la RLS ya lo
 *  impide. Que igual no se pida es para que la pantalla no se llene de bloques vacíos y de
 *  errores en consola, que es lo que se ve cuando se pide lo que no se puede leer.
 *
 *  UNA SOLA COLUMNA, siempre. Se mira en un teléfono con una mano.
 */
export function FichaReducida({ tramiteId }: { tramiteId: string }) {
  const tramite = useTramite(tramiteId);
  const lineas = useConceptosDelTramite(tramiteId);
  /*
    EL NOMBRE DEL CONCEPTO NO VIENE EN LA LINEA. `useConceptosDelTramite` trae `concepto_id` y no
    `concepto_nombre` — comprobado en `src/lib/datos.ts`, en su `.select(...)`. El catálogo se
    pide aparte y se cruza acá, que es lo que ya hace la ficha de la oficina.
  */
  const conceptos = useConceptos();
  const nombreDe = new Map((conceptos.data ?? []).map((c) => [c.id, c.nombre]));

  if (tramite.isPending) return <SkeletonLineas cantidad={5} className="mx-auto max-w-xl p-4" />;

  if (tramite.isError || tramite.data === undefined) {
    return (
      <div className="mx-auto max-w-xl p-6">
        <h1 className="text-xl">Ese trámite no está en tu lista</h1>
        <p className="mt-2 text-sm text-ink2">
          Puede ser que ya lo hayas devuelto, o que lo lleve otra persona.
        </p>
        <Link to="/" className="mt-4 inline-block text-sm underline">
          Volver a mis trámites
        </Link>
      </div>
    );
  }

  const t = tramite.data;
  const presupuesto = (lineas.data ?? []).filter((l) => l.momento === "presupuesto");

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4 p-4">
      <h1 className="text-xl" style={{ viewTransitionName: `tramite-${tramiteId}` }}>
        {t.cliente_nombre}
      </h1>

      <Panel className="flex flex-col gap-2">
        <Dato rotulo="Dominio" valor={t.dominio} />
        <Dato rotulo="Empresa" valor={t.razon_social_id} />
        <Dato rotulo="Vehículo" valor={t.vehiculo} />
        <Dato rotulo="Cuenta" valor={t.cliente_cuenta} />
        <Dato rotulo="Seccional" valor={t.seccional} />
      </Panel>

      <Panel>
        <h2 className="text-2xs uppercase tracking-wide text-ink2">Presupuesto</h2>
        {presupuesto.length === 0 ? (
          <p className="mt-2 text-xs text-ink2">Todavía no cargaste ninguna línea.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1">
            {/*
              LAS ANULADAS SE MUESTRAN TACHADAS, no se esconden. Es la regla del proyecto —nada se
              borra— y es lo que ya hace `Presupuesto.tsx` en la ficha de la oficina, con la misma
              tachadura. Esconderlas acá haría que la gestora y la oficina vieran presupuestos
              distintos del mismo trámite.
            */}
            {presupuesto.map((l) => (
              <li key={l.id} className="flex justify-between text-sm">
                <span className={l.anulada ? "text-ink2 line-through" : ""}>
                  {nombreDe.get(l.concepto_id) ?? "concepto"}
                </span>
                <span className={`tnum ${l.anulada ? "text-ink2 line-through" : ""}`}>
                  {formatearCorto(l.importe)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

/** Un dato del trámite. Si no está cargado lo dice: un renglón vacío se lee como un error. */
function Dato({ rotulo, valor }: { rotulo: string; valor: string | null }) {
  return (
    <p className="flex justify-between gap-4 text-sm">
      <span className="text-ink2">{rotulo}</span>
      <span className={valor === null || valor === "" ? "text-ink2" : ""}>
        {valor === null || valor === "" ? "sin cargar" : valor}
      </span>
    </p>
  );
}
```

- [ ] **Paso 4: Agregar la ruta**

En `src/rutas.tsx`, después de `rutaNuevoMovimiento`:

```tsx
/**
 * La ficha de la gestora vive en `/tramite/$id` y no en `/empresa/$e/tramite/$t`.
 *
 * POR QUE UNA DIRECCION MAS CORTA: ella no navegó por empresa para llegar acá — llegó desde su
 * cola, que no tiene empresas. Obligarla a llevar un `razonSocialId` en la dirección sería pedirle
 * un dato que su pantalla nunca le dio, y el día que quiera compartir el link tendría que
 * inventarlo.
 */
export const rutaTramiteDeGestora = createRoute({
  getParentRoute: () => rutaRaiz,
  path: "/tramite/$tramiteId",
  component: function FichaDeGestoraEnRuta() {
    const { tramiteId } = rutaTramiteDeGestora.useParams();
    return <FichaReducida tramiteId={tramiteId} />;
  },
});
```

Y sumarla al árbol de rutas, en la llamada a `addChildren` donde ya están las demás.

- [ ] **Paso 5: Correr y ver que pasan**

```bash
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && npx playwright test e2e/gestora.spec.ts > /tmp/e.log 2>&1; echo "EXIT: $?"; grep -E "passed|failed" /tmp/e.log | tail -2
```

- [ ] **Paso 6: Commit**

```bash
git add src/features/gestora/FichaReducida.tsx src/rutas.tsx e2e/gestora.spec.ts && git commit -F- <<'EOF'
La ficha reducida: lo que le sirve a ella y nada mas

Una sola columna, que se mira en un telefono con una mano. Sin historial de
estados, sin cambios, sin costo real de otros tramites y sin ninguna cifra de la
empresa.

Eso ultimo la RLS ya lo impide. Que ademas no se PIDA es para que la pantalla no
se llene de bloques vacios y de errores en consola, que es lo que se ve cuando se
pide lo que no se puede leer.

La direccion es `/tramite/$id` y no cuelga de la empresa: ella no navego por
empresa para llegar aca, llego desde su cola, que no tiene empresas. Pedirle un
`razonSocialId` seria pedirle un dato que su pantalla nunca le dio.
EOF
```

---

## Tarea 7: Las notas, que es por donde hoy se manda un WhatsApp

**Archivos:**
- Modificar: `src/features/gestora/FichaReducida.tsx` (agregar el bloque de notas)
- Test: dentro de `e2e/gestora.spec.ts`

**Interfaces:**
- Consume: `useNotasDelTramite(tramiteId)` de `src/lib/datos.ts`; el componente `Notas` de
  `src/features/tramites/Notas.tsx`, con las props `{ notas, cargando, alAgregar, guardando }`.
- Produce: nada nuevo hacia afuera.

- [ ] **Paso 1: Escribir la prueba que falla**

Agregar a `e2e/gestora.spec.ts`:

```ts
test("la gestora lee las notas de la oficina y puede contestar", async ({ page }) => {
  /*
    ES EL REEMPLAZO DEL WHATSAPP, y por eso está en la ficha y no en un chat aparte (spec 5): un
    chat obliga a leer mensajes y compite con WhatsApp, que ya está abierto en su teléfono y
    siempre gana. Una nota pegada al trámite no compite con nada porque está donde ya se mira.
  */
  await entrarComo(page, "gestora");
  await page.locator("[data-tarjeta-tramite]").first().getByRole("link").first().click();

  const notas = page.locator("[data-notas]");
  await expect(notas).toBeVisible();

  const caja = notas.getByRole("textbox");
  await expect(caja).toBeVisible();
  await expect(notas.getByRole("button", { name: /Agregar|Guardar/ })).toBeVisible();
});
```

- [ ] **Paso 2: Correr y ver que falla**

```bash
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && npx playwright test e2e/gestora.spec.ts -g "notas de la oficina" > /tmp/e.log 2>&1; echo "EXIT: $?"; grep -E "Error:|Received" /tmp/e.log | head -4
```

Esperado: `EXIT: 1` — no existe `[data-notas]` en la ficha reducida.

- [ ] **Paso 3: Agregar el bloque de notas**

En `src/features/gestora/FichaReducida.tsx`, agregar el import y el hook:

```tsx
import { Notas } from "@/features/tramites/Notas";
import { useGuardar } from "@/lib/datos";
```

Dentro del componente, junto a los otros hooks:

```tsx
  const notas = useNotasDelTramite(tramiteId);
  const agregarNota = useGuardar<{ tramite_id: string; texto: string }>("tramite_notas", [
    "notas",
    tramiteId,
  ]);
```

Y al final del `return`, después del `Panel` del presupuesto:

```tsx
      <div data-notas="true">
        {/*
          SE REUSA EL COMPONENTE DE LA OFICINA, no se escribe uno parecido. Es la misma
          conversación vista desde el otro lado, y dos componentes distintos para la misma
          conversación se separan la primera vez que alguien agregue un campo.
        */}
        <Notas
          notas={notas.data ?? []}
          cargando={notas.isPending}
          guardando={agregarNota.isPending}
          alAgregar={(texto) => {
            agregarNota.mutate({ tramite_id: tramiteId, texto });
          }}
        />
      </div>
```

- [ ] **Paso 4: Comprobar contra la firma real de `Notas` y de `useGuardar`**

Antes de correr, leer las dos firmas y ajustar si no coinciden. **No adaptes el componente `Notas`
para que encaje: si la firma es otra, este plan está mal en este punto y hay que reportarlo.**

```bash
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && sed -n '29,48p' src/features/tramites/Notas.tsx && echo "=== useGuardar ===" && sed -n '891,930p' src/lib/datos.ts
```

- [ ] **Paso 5: Correr y ver que pasan**

```bash
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && npm run build > /tmp/b.log 2>&1; echo "BUILD: $?"; grep -E "error TS" /tmp/b.log | head -5; npx playwright test e2e/gestora.spec.ts > /tmp/e.log 2>&1; echo "E2E: $?"; grep -E "passed|failed" /tmp/e.log | tail -2
```

- [ ] **Paso 6: Commit**

```bash
git add src/features/gestora/FichaReducida.tsx e2e/gestora.spec.ts && git commit -F- <<'EOF'
Las notas en la ficha de la gestora: el reemplazo del WhatsApp

Va en la ficha y no en un chat aparte. Un chat obliga a leer mensajes y compite
con WhatsApp, que ya esta abierto en su telefono y siempre gana. Una nota pegada
al tramite no compite con nada porque esta donde ya se mira.

Se reusa el componente de la oficina y no se escribe uno parecido: es la misma
conversacion vista desde el otro lado, y dos componentes para la misma
conversacion se separan la primera vez que alguien agregue un campo.
EOF
```

---

## Tarea 8: La app instalable, que no cachea un solo peso

**Archivos:**
- Modificar: `vite.config.ts:11`, `package.json`
- Crear: `public/brand/icono-192.png`, `public/brand/icono-512.png`,
  `public/brand/icono-maskable-512.png`, `scripts/pwa-sana.mjs`
- Test: `scripts/pwa-sana.mjs` es el guardián; se prueba metiéndole la violación a mano

**Interfaces:**
- Consume: `vite-plugin-pwa` (ya en `devDependencies`), `public/brand/isotipo-negro.svg`.
- Produce: el script `npm run pwa`, que sale distinto de 0 si el service worker generado tiene
  cualquier regla que alcance a `supabase.co`.

- [ ] **Paso 1: Escribir el guardián primero**

`scripts/pwa-sana.mjs`:

```js
#!/usr/bin/env node
/**
 * ============================================================================
 *  EL SERVICE WORKER NO CACHEA UN SOLO PESO
 * ============================================================================
 *
 *  Es el guardián más importante de esta tanda, y conviene decir por qué con todas las letras.
 *
 *  Un service worker que cachee las respuestas de Supabase le va a mostrar a la gestora un SALDO
 *  VIEJO CON CARA DE SALDO ACTUAL. No un error, no un cartel: un número, bien dibujado, que ya no
 *  es cierto. Y con ese número ella decide si sale al registro a pagar.
 *
 *  Es exactamente el pecado que este proyecto tiene documentado tres veces —un cero que se lee
 *  como un hecho— pero peor, porque un cero al menos llama la atención y un saldo de ayer no.
 *
 *  ============================================================================
 *   LO QUE SI SE CACHEA
 *  ============================================================================
 *
 *  El armazón: el HTML, el JS, el CSS, la tipografía y los íconos. Con eso la app ABRE sin señal
 *  y puede decir que no hay conexión, que es infinitamente mejor que no abrir. Los datos no.
 *
 *  ============================================================================
 *   POR QUE SE LEE EL ARCHIVO GENERADO Y NO LA CONFIGURACION
 *  ============================================================================
 *
 *  Porque la configuración es la intención y el archivo generado es el hecho. Entre las dos hay
 *  un plugin que puede cambiar de versión. Este guardián lee `dist/sw.js`, que es lo que de
 *  verdad se le entrega al navegador.
 */
import { readFileSync, existsSync } from "node:fs";

const SW = "dist/sw.js";

if (!existsSync(SW)) {
  console.error(`\n  No existe ${SW}. Corré primero: npm run build\n`);
  process.exit(1);
}

const sw = readFileSync(SW, "utf8");

/*
  Se busca el dominio de Supabase de cualquier forma en que pueda aparecer: en una URL literal, en
  una expresión regular de ruta, o partido. Si aparece en el service worker, algo lo está mirando.
*/
const SOSPECHAS = [
  { patron: /supabase\.co/i, que: "el dominio de Supabase" },
  { patron: /\/rest\/v1/i, que: "la ruta de la API de datos" },
  { patron: /\/auth\/v1/i, que: "la ruta de autenticacion" },
];

let malos = 0;
for (const s of SOSPECHAS) {
  const hay = s.patron.test(sw);
  console.log(`  ${hay ? "MAL " : "OK  "} ${hay ? "aparece" : "no aparece"} ${s.que}`);
  if (hay) malos++;
}

/* Y que el armazón SI esté: un service worker que no cachea nada no sirve para abrir sin señal. */
const cacheaAlgo = /index\.html/.test(sw) || /precache/i.test(sw);
console.log(`  ${cacheaAlgo ? "OK  " : "MAL "} el armazon ${cacheaAlgo ? "se" : "NO se"} precachea`);
if (!cacheaAlgo) malos++;

if (malos > 0) {
  console.error(`\n  ${malos} problema(s) en el service worker.`);
  console.error("  Si cachea la API: un saldo viejo con cara de saldo actual es peor que un");
  console.error("  error, porque no llama la atencion y con ese numero se sale a pagar.\n");
  process.exit(1);
}

console.log("\npwa: el armazon se cachea y los datos no.");
process.exit(0);
```

- [ ] **Paso 2: Registrarlo y correrlo para ver que falla**

En `package.json`, en `scripts`:

```json
    "pwa": "node scripts/pwa-sana.mjs",
```

```bash
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && npm run build > /dev/null 2>&1 && npm run pwa > /tmp/w.log 2>&1; echo "EXIT: $?"; cat /tmp/w.log
```

Esperado: `EXIT: 1` con `No existe dist/sw.js` — el plugin todavía no está encendido.

- [ ] **Paso 3: Generar los íconos del isotipo que ya existe**

```bash
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && npx --yes sharp-cli --input public/brand/isotipo-negro.png --output public/brand/icono-192.png resize 192 192 && npx --yes sharp-cli --input public/brand/isotipo-negro.png --output public/brand/icono-512.png resize 512 512 && ls -la public/brand/icono-*.png
```

Para el `maskable`, el ícono tiene que tener margen propio: Android le recorta los bordes.

```bash
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && npx --yes sharp-cli --input public/brand/isotipo-negro.png --output public/brand/icono-maskable-512.png resize 410 410 -- extend --top 51 --bottom 51 --left 51 --right 51 --background "#ffffff" && ls -la public/brand/icono-maskable-512.png
```

Comprobá los tres a ojo abriéndolos: **un ícono recortado se ve en el escritorio del teléfono de
la dueña.**

- [ ] **Paso 4: Encender el plugin**

En `vite.config.ts`, agregar el import y el plugin:

```ts
import { VitePWA } from "vite-plugin-pwa";
```

Y dentro de `plugins`, después de `tailwind()`:

```ts
    /*
      ============================================================================
       LA APP INSTALABLE: SE CACHEA EL ARMAZON Y NUNCA LOS DATOS
      ============================================================================

      `registerType: "autoUpdate"` y `clientsClaim` para que una version nueva entre sola en la
      siguiente carga. La alternativa —preguntarle si quiere actualizar— deja a alguien usando
      una version vieja indefinidamente si toca "ahora no", y en un sistema de plata las dos
      versiones no muestran lo mismo.

      `navigateFallbackDenylist` saca del armazon todo lo que sea una llamada de datos. Sin eso,
      el fallback de navegacion puede terminar devolviendo el index.html ante una peticion a la
      API, y el sintoma es hermoso y horrible: la app "responde" con HTML donde esperaba JSON.

      NO HAY `runtimeCaching`. Es a proposito y no es un olvido: cualquier regla que alcance a
      Supabase le mostraria a la gestora un saldo viejo con cara de saldo actual. Lo comprueba
      `npm run pwa` leyendo el `dist/sw.js` generado, que es el hecho y no la intencion.
    */
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["brand/icono-192.png", "brand/icono-512.png"],
      workbox: {
        globPatterns: ["**/*.{js,css,html,woff2,png,svg}"],
        clientsClaim: true,
        skipWaiting: true,
        navigateFallbackDenylist: [/^\/rest\//, /^\/auth\//],
      },
      manifest: {
        name: "Gestoría — Grupo Paris",
        short_name: "Gestoría",
        description: "Los trámites del automotor y la cuenta de las Tarjetas Habitualistas.",
        lang: "es-AR",
        start_url: "/",
        display: "standalone",
        // El teal de Habitualista, el mismo `--accent` del modo claro.
        theme_color: "#0e7c8c",
        background_color: "#ffffff",
        icons: [
          { src: "/brand/icono-192.png", sizes: "192x192", type: "image/png" },
          { src: "/brand/icono-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "/brand/icono-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
    }),
```

- [ ] **Paso 5: Construir y correr el guardián**

```bash
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && npm run build > /tmp/b.log 2>&1; echo "BUILD: $?"; ls -la dist/sw.js dist/manifest.webmanifest && npm run pwa > /tmp/w.log 2>&1; echo "PWA: $?"; cat /tmp/w.log
```

Esperado: `BUILD: 0`, `PWA: 0`, y las cuatro líneas en OK.

- [ ] **Paso 6: Ver el guardián en rojo, metiéndole la violación a mano**

**Un guardián que nunca se vio fallar no es un guardián.** Agregá temporalmente a
`vite.config.ts`, dentro de `workbox`:

```ts
        runtimeCaching: [
          { urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/.*/, handler: "CacheFirst" },
        ],
```

```bash
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && npm run build > /dev/null 2>&1 && npm run pwa > /tmp/w.log 2>&1; echo "EXIT: $?"; cat /tmp/w.log
```

Esperado: `EXIT: 1`, con `MAL aparece el dominio de Supabase` y `MAL aparece la ruta de la API de
datos`. **Sacá el `runtimeCaching`** y volvé a construir para dejarlo en verde.

- [ ] **Paso 7: Meter `pwa` en el portón**

En `.githooks/pre-commit`, junto a los otros guardianes. Y en el `README` del portón si existe.

- [ ] **Paso 8: Commit**

```bash
git add vite.config.ts package.json scripts/pwa-sana.mjs public/brand .githooks/pre-commit && git commit -F- <<'EOF'
La app instalable, y el guardian que le prohibe cachear la plata

Se cachea el armazon —HTML, JS, CSS, tipografia, iconos— para que la app ABRA sin
senial. Los datos NO.

Un service worker que cachee las respuestas de Supabase le muestra a la gestora un
SALDO VIEJO CON CARA DE SALDO ACTUAL: no un error, no un cartel, un numero bien
dibujado que ya no es cierto. Y con ese numero decide si sale al registro a pagar.
Es el pecado que este proyecto ya tiene documentado tres veces, pero peor, porque
un cero al menos llama la atencion y un saldo de ayer no.

El guardian lee `dist/sw.js` y no la configuracion, porque la configuracion es la
intencion y el archivo generado es el hecho — y entre las dos hay un plugin que
puede cambiar de version. Probado en rojo metiendole un `runtimeCaching` a mano.
EOF
```

---

## Tarea 9: Sin conexión, y sin un número viejo

**Archivos:**
- Crear: `src/features/gestora/SinConexion.tsx`
- Modificar: `src/features/gestora/Cola.tsx` (usarlo)
- Test: dentro de `e2e/gestora.spec.ts`

**Interfaces:**
- Consume: el evento `online`/`offline` del navegador; `Panel`.
- Produce: `export function SinConexion()`, y `export function useHayConexion(): boolean`.

- [ ] **Paso 1: Escribir la prueba que falla**

Agregar a `e2e/gestora.spec.ts`:

```ts
test("sin conexion la app abre, lo dice, y NO muestra ningun importe", async ({ page, context }) => {
  /*
    ============================================================================
     LA REGLA QUE NO SE NEGOCIA
    ============================================================================

    Sin red, la app tiene que ABRIR —para eso está el service worker— y tiene que DECIR que no
    hay conexión. Lo que no puede hacer, bajo ninguna circunstancia, es mostrar el último saldo
    que vio como si fuera el de ahora.

    Un saldo viejo con cara de saldo actual es peor que un error: no llama la atención, y con ese
    número ella decide si sale al registro a pagar.
  */
  await entrarComo(page, "gestora");
  await expect(page.getByRole("heading", { name: /Te toca a vos/ })).toBeVisible();

  await context.setOffline(true);
  await page.reload();

  await expect(page.getByText(/Sin conexión/)).toBeVisible({ timeout: 20_000 });

  // Ni un importe en toda la pantalla.
  const cuerpo = (await page.locator("body").textContent()) ?? "";
  expect(cuerpo, "hay un importe en pantalla sin conexion").not.toMatch(/\$\s?[\d.]/);

  await context.setOffline(false);
});
```

- [ ] **Paso 2: Correr y ver que falla**

```bash
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && npx playwright test e2e/gestora.spec.ts -g "Sin conexion" > /tmp/e.log 2>&1; echo "EXIT: $?"; grep -E "Error:|Received|Timed out" /tmp/e.log | head -4
```

Esperado: `EXIT: 1` — no existe el texto "Sin conexión".

- [ ] **Paso 3: Escribir `src/features/gestora/SinConexion.tsx`**

```tsx
import { useEffect, useState } from "react";
import { CloudOff } from "lucide-react";
import { Panel } from "@/components/Panel";

/**
 * Si hay red o no, escuchando al navegador.
 *
 * SE ESCUCHAN LOS DOS EVENTOS Y ADEMAS SE LEE EL VALOR INICIAL. Suscribirse sin leer el estado de
 * arranque deja la app creyendo que hay conexión hasta que se caiga por primera vez — o sea,
 * justo el caso de abrirla ya sin señal, que es para lo que existe todo esto.
 */
export function useHayConexion(): boolean {
  const [hay, setHay] = useState(() => navigator.onLine);

  useEffect(() => {
    const prendio = () => setHay(true);
    const corto = () => setHay(false);
    window.addEventListener("online", prendio);
    window.addEventListener("offline", corto);
    return () => {
      window.removeEventListener("online", prendio);
      window.removeEventListener("offline", corto);
    };
  }, []);

  return hay;
}

/**
 * ============================================================================
 *  SIN CONEXION: SE DICE, Y NO SE MUESTRA NINGUN NUMERO
 * ============================================================================
 *
 *  La app abre sin señal porque el armazón está cacheado. Lo que NO hace es mostrar el último
 *  saldo que vio: un importe viejo con cara de importe actual es peor que un error, porque no
 *  llama la atención y con ese número ella decide si sale al registro a pagar.
 *
 *  POR ESO NO HAY "ULTIMA ACTUALIZACION: HACE 2 HORAS" tampoco. Es la solución que parece
 *  prolija y no lo es: el número queda en pantalla, grande, y la aclaración chiquita al lado. Lo
 *  que se lee es el número.
 */
export function SinConexion() {
  return (
    <div className="mx-auto max-w-xl p-6">
      <Panel className="flex flex-col items-center gap-3 py-8 text-center">
        <CloudOff className="size-8 text-ink2" aria-hidden="true" />
        <h1 className="text-lg">Sin conexión</h1>
        <p className="text-sm text-ink2">
          No te podemos mostrar los saldos ni tus trámites hasta que vuelva la señal.
        </p>
        <p className="text-xs text-ink2">
          No te mostramos los últimos que vimos a propósito: un saldo de hace un rato se lee igual
          que el de ahora, y con ese número se sale a pagar.
        </p>
      </Panel>
    </div>
  );
}
```

- [ ] **Paso 4: Usarlo en la cola**

En `src/features/gestora/Cola.tsx`, agregar el import y la guarda **antes** de todo lo demás:

```tsx
import { SinConexion, useHayConexion } from "./SinConexion";
```

```tsx
export function Cola() {
  const { perfil } = useSesion();
  const hayConexion = useHayConexion();
  const cola = useCola();

  /*
    VA PRIMERO, antes del `isPending`. Sin red, la consulta queda pendiente para siempre y la
    pantalla se quedaría con el esqueleto puesto — que no dice nada y parece que está por llegar.
  */
  if (!hayConexion) return <SinConexion />;

  if (cola.isPending) return <SkeletonLineas cantidad={4} className="mx-auto max-w-xl p-4" />;
```

- [ ] **Paso 5: Correr y ver que pasan**

```bash
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && npx playwright test e2e/gestora.spec.ts > /tmp/e.log 2>&1; echo "EXIT: $?"; grep -E "passed|failed" /tmp/e.log | tail -2
```

- [ ] **Paso 6: Commit**

```bash
git add src/features/gestora e2e/gestora.spec.ts && git commit -F- <<'EOF'
Sin conexion: la app abre, lo dice, y no muestra ningun importe

Un importe viejo con cara de importe actual es peor que un error, porque no llama
la atencion y con ese numero ella decide si sale al registro a pagar.

Y NO hay "ultima actualizacion: hace 2 horas". Es la solucion que parece prolija y
no lo es: el numero queda en pantalla, grande, y la aclaracion chiquita al lado.
Lo que se lee es el numero.

La guarda va ANTES del `isPending`: sin red la consulta queda pendiente para
siempre y la pantalla se quedaria con el esqueleto puesto, que no dice nada y
parece que esta por llegar.
EOF
```

---

## Tarea 10: La segunda base — el instructivo y el interruptor

**Archivos:**
- Crear: `docs/SEGUNDA-BASE.md`
- Modificar: `src/components/Shell.tsx` (el cartel de base compartida, si hoy está escrito a mano)

**Interfaces:**
- Consume: las variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` de `.env.local`.
- Produce: `docs/SEGUNDA-BASE.md`, y que el cartel de "base compartida" se apague solo cuando las
  dos bases sean distintas.

**Esta tarea no crea la base.** Crear el proyecto de Supabase es una acción del usuario: hay que
entrar con su cuenta y el cupo gratuito está en el tope, así que primero tiene que decidir qué
hacer con eso. Lo que sí se puede hacer, y es lo que hace esta tarea, es que el día que exista la
segunda base **el cambio sea mecánico y no haya que acordarse de nada**.

- [ ] **Paso 1: Comprobar cómo se decide hoy el cartel**

```bash
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && grep -rn "compartida\|desarrollo" src/components/Shell.tsx src/lib/*.ts | head -6
```

- [ ] **Paso 2: Hacer que el cartel dependa de un dato y no de una constante**

Si el cartel está escrito a mano, reemplazarlo por una comprobación real. En
`src/components/Shell.tsx`, donde hoy se dibuja el aviso:

```tsx
{/*
  EL CARTEL SE APAGA SOLO. Mientras `VITE_SUPABASE_URL_PRODUCCION` no exista o sea igual a la que
  se está usando, hay una sola base y hay que decirlo.

  POR QUE NO UNA CONSTANTE `ES_PRUEBA = true`: porque el día que se separen las bases alguien
  tiene que acordarse de ponerla en false, y ese alguien no se va a acordar. Un cartel que dice
  "esto es de prueba" en producción es peor que no tenerlo, porque enseña a ignorar los carteles.
*/}
{hayUnaSolaBase() && (
  <p className="bg-warn/10 px-4 py-1 text-center text-2xs text-warn">
    Base compartida con desarrollo. Los datos que cargues acá los ve todo el mundo.
  </p>
)}
```

Y en `src/lib/supabase.ts`:

```ts
/**
 * Si desarrollo y producción comparten la misma base.
 *
 * Mientras sea `true`, la app lo dice en pantalla — es regla del CLAUDE.md. Se apaga sola en
 * cuanto las dos URL sean distintas: nadie tiene que acordarse de bajar una bandera.
 */
export function hayUnaSolaBase(): boolean {
  const produccion = import.meta.env["VITE_SUPABASE_URL_PRODUCCION"] as string | undefined;
  return produccion === undefined || produccion === import.meta.env["VITE_SUPABASE_URL"];
}
```

- [ ] **Paso 3: Escribir `docs/SEGUNDA-BASE.md`**

```markdown
# Separar la base de desarrollo de la de producción

Hoy hay **una sola base de Supabase** y la app lo dice en pantalla. Esto es lo que hay que hacer
para que sean dos, y en qué orden.

**Cuándo:** antes de cargar el `saldo_inicial` real. Hasta entonces, todo lo que se carga es de
prueba y se puede tirar.

## Lo que depende de vos

1. **El cupo.** El plan gratuito de Supabase permite **dos proyectos por cuenta**, y los dos están
   usados. Hay tres caminos: pausar un proyecto viejo, pagar el plan Pro, o crear el segundo
   proyecto con otra cuenta. Es una decisión de plata y de quién administra, no técnica.
2. **Crear el proyecto nuevo**, en la misma región (South America, São Paulo) para que la latencia
   no cambie.
3. **Pasarme la URL y las dos claves** del proyecto nuevo. La `anon` viaja en el bundle y es
   pública; la `service_role` **no se pega en ningún lado**, ni en el chat: va sola a `.env.local`.

## Lo que hago yo, después

1. Correr las 41 migraciones sobre la base nueva, en orden:
   `npx supabase link --project-ref <ref-nuevo> && npx supabase db push --yes`.
2. Comprobar que quedaron las mismas: `npx supabase migration list --linked` en las dos, y
   comparar.
3. Crear las cuatro cuentas con sus roles, y comprobar entrando con cada una.
4. Cargar los datos de arranque: razones sociales, sucursales, conceptos, requisitos, tarjetas.
   **No los movimientos:** el `saldo_inicial` real se carga una sola vez, a mano, y con el número
   que dé el banco.
5. Agregar `VITE_SUPABASE_URL_PRODUCCION` a las variables de Cloudflare Pages. Con eso, el cartel
   de "base compartida" se apaga solo en producción y sigue prendido en desarrollo.
6. Anotar las URL de desarrollo **y** de producción en las *Additional redirect URLs* de Supabase
   Auth del proyecto nuevo. **Si esto se olvida, el login falla con un síntoma que no apunta al
   problema**: parece que las credenciales están mal.
7. Comprobar las tres evidencias de siempre, con el usuario real, contra la base nueva.

## Lo que hay que revisar después, y no es opcional

- **El arnés de permisos deja dos movimientos de un peso por corrida.** Hoy caen en la base que la
  dueña mira. En cuanto exista la segunda, el arnés apunta a la de desarrollo y esto se termina.
- **Las contraseñas genéricas.** Están así a propósito mientras se prueba. Se cambian antes de que
  haya un solo saldo real, y las cambia cada persona, no yo.
```

- [ ] **Paso 4: Comprobar que el cartel sigue apareciendo hoy**

```bash
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && npm run build > /tmp/b.log 2>&1; echo "BUILD: $?"; npx playwright test e2e/gestora.spec.ts -g "cola, no el resumen" > /tmp/e.log 2>&1; echo "E2E: $?"
```

Y a ojo, en el navegador: el cartel amarillo tiene que seguir arriba. **Si desapareció, la función
está mal y la app dejó de decir algo que es cierto.**

- [ ] **Paso 5: Commit**

```bash
git add docs/SEGUNDA-BASE.md src/lib/supabase.ts src/components/Shell.tsx && git commit -F- <<'EOF'
El cartel de base compartida se apaga solo, y el instructivo de la segunda base

Antes era una constante que alguien tenia que acordarse de bajar el dia que las
bases se separaran. Ese alguien no se iba a acordar — y un cartel que dice "esto
es de prueba" en produccion es peor que no tenerlo, porque ensenia a ignorar los
carteles.

Ahora compara `VITE_SUPABASE_URL_PRODUCCION` con la que se esta usando: si son
distintas, hay dos bases y el cartel sobra. Nadie decide nada a mano.

El instructivo dice que depende del usuario (el cupo, crear el proyecto, las
claves) y que hago yo despues, en orden. Con la advertencia que mas caro sale
olvidar: las redirect URLs de Auth, cuyo sintoma no apunta al problema.
EOF
```

---

## Tarea 11: El cierre

**Archivos:**
- Modificar: `CHANGELOG.md`, `docs/ESTADO.md`
- Sin archivos nuevos

- [ ] **Paso 1: El portón completo, los dieciséis guardianes**

```bash
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && export SUPABASE_ACCESS_TOKEN="$(grep '^SUPABASE_ACCESS_TOKEN=' .env.local | cut -d= -f2-)"
npm run formato > /dev/null 2>&1
for g in lint formato:check test build secretos migraciones permisos indices colores estados contraste espacios tipos:al-dia pwa; do
  npm run "$g" > "/tmp/g-$g.log" 2>&1; printf "  %-14s EXIT %s\n" "$g" "$?"
done
npm run test:rls > /tmp/g-rls.log 2>&1; echo "  rls            EXIT $?"; grep -E "^ *Tests " /tmp/g-rls.log
npm run e2e > /tmp/g-e2e.log 2>&1; echo "  e2e            EXIT $?"; grep -E "passed|failed" /tmp/g-e2e.log | tail -2
```

Todos en 0. **Si alguno no está en 0, no se sigue.**

- [ ] **Paso 2: Axe sobre las pantallas nuevas**

Agregar a `e2e/acabado.spec.ts` los dos casos que faltan —la cola y la ficha reducida—, en claro y
en oscuro, con el mismo patrón que ya usan las tres pantallas de la oficina. Cero violaciones
serias o críticas.

```bash
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && npx playwright test e2e/acabado.spec.ts > /tmp/a.log 2>&1; echo "EXIT: $?"; grep -E "passed|failed|color-contrast|serious" /tmp/a.log | head -6
```

- [ ] **Paso 3: Las revisiones, DE A UNA**

**Lanzalas de a una.** En el Plan B se lanzaron dos en paralelo cuatro veces y las cuatro murieron
por el límite de gasto mensual, y la tanda se publicó sin revisión independiente.

1. `revisor-producto` sobre el diff de `main..HEAD`.
2. Cuando termine, `revisor-seguridad` sobre lo mismo — le importa especialmente
   `v_cola_de_gestora` y el service worker.
3. `/code-review` sobre el diff.

**Y la deuda del Plan B:** pasarles también aquella tanda, que quedó sin revisar.

- [ ] **Paso 4: Contar los números de nuevo, con el comando que la tabla nombra**

```bash
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && echo "migraciones: $(ls supabase/migrations/*.sql | wc -l)" && echo "archivos src: $(find src -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.css' \) | wc -l)   lineas: $(find src -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.css' \) -exec cat {} + | wc -l)" && npm run test 2>&1 | grep -E "Test Files|Tests " && npx playwright test --list 2>&1 | tail -1 && npm run build 2>&1 | grep -E "dist/assets/index-.*js"
```

- [ ] **Paso 5: Escribir el CHANGELOG y el ESTADO**

En `CHANGELOG.md`, arriba de todo en "Sin publicar todavía", una entrada **escrita para quien usa
el sistema**: qué ve la gestora al abrir el teléfono, qué pasa cuando la oficina deposita, y que la
app se puede instalar y abre sin señal aunque no muestre números.

En `docs/ESTADO.md`: la tabla de números actualizada, qué encontró cada revisión, y **qué quedó
abierto**, con la misma honestidad que la sección del Plan B.

- [ ] **Paso 6: Publicar**

```bash
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && git checkout dev && git merge --ff-only plan-c-la-app-de-la-gestora && git push origin dev && git checkout main && git merge --ff-only dev && git push origin main; echo "PUSH: $?"
```

- [ ] **Paso 7: Las tres evidencias, y no dos**

1. `git rev-list --count origin/main..main` en **0**.
2. El texto nuevo dentro del JS publicado:
   ```bash
   curl -s https://proyecto-gestoria.pages.dev/ | grep -o '/assets/index-[^"]*\.js'
   ```
   y después `grep` de un texto de esta tanda —`Te toca a vos`— sobre ese archivo.
3. **El dato nuevo leído de la base entrando con un usuario real**: con la cuenta de gestora,
   contra producción, la cola dibujada con sus tres bloques.

Y una cuarta que es de esta tanda: **que la app se pueda instalar**. En Chrome, sobre el sitio
publicado, tiene que aparecer el botón de instalar en la barra de direcciones.

---

## Autorrevisión

**1. Cobertura del spec, sección por sección.**

| Requisito del spec §5 | Tarea |
|---|---|
| Una sola pantalla, sin menú ni filtros ni buscador | 3 |
| Dos bloques —te toca, esperando— más terminados hoy | 1, 3 |
| Saludo y saldo arriba, en vivo | 4, 5 |
| Un botón por trámite según su estado | 1 (la acción), 3 (el botón) |
| "Sin botón: no hay nada que puedas hacer todavía", con palabras | 3 (`frase`), y con el número |
| El ping pong es el salto | 5 |
| Sin selector de tarjeta | 4 |
| Tocar el nombre abre la ficha reducida | 6 |
| Las notas, de ida y de vuelta | 7 |
| No ve historial, cambios, ni cifras de la empresa | 6 |
| La oficina puede hacer lo de la gestora desde la ficha | ya existe; la Tarea 3 no lo toca |
| La app instalable, abre sin señal (§14) | 8, 9 |
| La segunda base (§16) | 10 |
| No manda push (§15) | fuera de alcance, escrito en las restricciones |

**2. Marcadores de posición.** Ninguno: cada paso que cambia código lleva el código. Los dos puntos
donde el plan pide leer antes de escribir —la firma de `Notas` en la Tarea 7 paso 4, y cómo se
decide hoy el cartel en la Tarea 10 paso 1— son comprobaciones deliberadas, con la instrucción
explícita de **parar y reportar** si la realidad no coincide, no huecos por completar.

**3. Consistencia de tipos.** `FilaDeCola` se define en la Tarea 2 y la usan las Tareas 3 y 5 con
los mismos nombres. `Bloque` y `Accion` son los mismos literales que devuelve la vista de la Tarea
1 (`te_toca`/`esperando`/`terminado`,
`presupuestar`/`ir_al_registro`/`devolver`/`ninguna`), y las pruebas de la Tarea 1 los verifican
contra la base. `useCola` usa la clave `["cola"]`, que es la que invalida la Tarea 5.
`hayUnaSolaBase()` se define y se usa en la Tarea 10.

**Un hueco que el plan deja a propósito y conviene decirlo:** las pruebas de las Tareas 3, 5 y 6 se
saltean solas (`test.skip`) si la gestora de prueba no tiene trámites en el estado que hace falta.
Es correcto —una prueba que falla por falta de datos manda a buscar un defecto donde no hay uno—
pero **una prueba que se saltea sin decirlo es media prueba**. Antes de dar por cerrada la Tarea 5,
comprobá en la salida de Playwright que los `skipped` sean cero; si no lo son, hay que preparar los
datos de prueba.
