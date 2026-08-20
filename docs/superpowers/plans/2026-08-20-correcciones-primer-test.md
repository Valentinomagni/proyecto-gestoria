# Correcciones del primer test real — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dejar el sistema en condiciones de simular la cadena completa de gestión y control con los tres tipos de usuario —gestoría, administración contable y gerencia— corrigiendo los dieciséis defectos que aparecieron en la primera prueba real del 20/08/2026.

**Architecture:** Doce tareas, cada una con su propio ciclo de prueba. Las cinco primeras tocan la base de datos y son las que desbloquean todo lo demás: sin ellas, la gestora no ve un trámite y la cadena no se puede simular. Las siete siguientes son pantalla. Cada migración es aditiva salvo donde se dice lo contrario, y ninguna toca datos existentes sin decirlo en su bloque de comprobación.

**Tech Stack:** Postgres 15 con RLS (Supabase), React 19, TypeScript, Vite, Tailwind 4, TanStack Query 5, vitest.

## Global Constraints

Estas reglas valen para **todas** las tareas. No se repiten en cada una.

- **Cero emojis** en interfaz, mensajes y documentación. Íconos sólo de `lucide-react`. Ojo con `ℹ` (U+2139), que Unicode clasifica como letra.
- **Español de Argentina, voseo**, tono directo, sin jerga técnica en la interfaz. Un error nunca muestra el mensaje crudo de la base.
- **Comentarios en español que explican el POR QUÉ**, no el qué. Densidad alta: esto lo mantiene una sola persona que no es programadora.
- **La plata es `numeric(14,2)` en Postgres y centavos enteros en JavaScript.** Toda conversión pasa por `src/lib/plata.ts`. Nunca `Number()` sobre un importe escrito por una persona.
- **Toda fecha pasa por `src/lib/fechas.ts`.** Nunca `new Date().getMonth()` ni `.toISOString().slice()` fuera de ese archivo.
- **Todo control de formulario usa `src/lib/campos.ts`.** Nunca la clase escrita a mano.
- **Nada se borra.** Un trámite se anula con motivo; un movimiento se compensa con un ajuste.
- **No se mide a las personas.** Ni rankings, ni conteos por gestora, ni comparaciones.
- **Toda vista lleva `security_invoker = true`.**
- **Toda migración trae adentro su bloque "cómo comprobar que quedó bien"**, y ese bloque se corre de verdad antes de dar la tarea por terminada.
- **Los cuatro comandos en 0 antes de cada commit:** `npx tsc -b`, `npx oxlint` (cero advertencias), `npx vitest run`, `npx vite build`.
- **Toda migración se aplica con `npm run db:push`**, nunca pegando SQL a mano, y después se corre `npm run db:tipos` y `npm run permisos`.
- El PATH no trae node: cada comando arranca con `export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH"`.
- `SUPABASE_ACCESS_TOKEN` tiene que estar exportado para los comandos de base. **No se escribe en ningún archivo.**

---

## Estructura de archivos

**Migraciones nuevas** (el nombre exacto lo genera `npm run db:nueva <nombre>`, que le pone el sello de tiempo adelante):

| Archivo | De qué se hace cargo |
|---|---|
| `supabase/migrations/*_oficina.sql` | `es_oficina()` y el reemplazo de `es_gerencia()` en todas las policies. El guardián de auto-promoción pasa a ser "nadie se cambia el rol a sí mismo". |
| `supabase/migrations/*_gestora_desde_el_alta.sql` | Permitir asignar la gestora al dar de alta, y que la vea desde ese momento. |
| `supabase/migrations/*_checklist_nuevo.sql` | Los cinco requisitos que reemplazan a los diez actuales. |
| `supabase/migrations/*_datos_de_interes.sql` | `administrativo` en trámites, `orden` en `v_saldos`, y la modalidad reducida a dos valores. |
| `supabase/migrations/*_historial_presupuesto.sql` | Tabla y trigger que registran cada cambio del presupuesto. |
| `supabase/migrations/*_novedades_en_vivo.sql` | Publicación de Realtime para `tramite_eventos`. |

**Archivos de código nuevos:**

| Archivo | De qué se hace cargo |
|---|---|
| `src/lib/borrador.ts` | Guardar y recuperar lo que se está cargando en un formulario, para que no se pierda al cambiar de pantalla. |
| `src/lib/borrador.test.ts` | Sus pruebas. |
| `src/lib/novedades.ts` | Escuchar los cambios de trámites en vivo y llevar la cuenta de lo no visto. |
| `src/lib/novedades.test.ts` | Sus pruebas (la parte pura: qué es nuevo y qué no). |
| `src/components/Novedades.tsx` | La campana y el panel de novedades. |
| `src/features/tramites/HistorialPresupuesto.tsx` | El historial de cambios del presupuesto, adentro de la ficha. |

**Archivos que se modifican:** `src/lib/roles.ts`, `src/lib/asunto.ts`, `src/lib/datos.ts`, `src/lib/excel.ts`, `src/features/tramites/AltaTramite.tsx`, `src/features/tramites/Ficha.tsx`, `src/features/tramites/Listado.tsx`, `src/features/tarjeta/Tarjeta.tsx`, `src/components/Shell.tsx`, `src/App.tsx`, `src/permisos.rls.test.ts`.

---

## Task 1: Contable y gerencia, permisos idénticos

**Files:**
- Create: `supabase/migrations/*_oficina.sql` (con `npm run db:nueva oficina`)
- Modify: `src/lib/roles.ts:47-49`
- Modify: `src/permisos.rls.test.ts` (el bloque "nadie se auto-promueve")

**Interfaces:**
- Produce: la función SQL `public.es_oficina()` → `boolean`, que devuelve verdadero para gerencia y para contable. Todas las tareas siguientes la usan en vez de `es_gerencia()`.
- Produce: `puedeAdministrar(rol: Rol): boolean` en `roles.ts` pasa a devolver `true` para `"gerencia"` y `"contable"`.

**Por qué esta tarea va primera:** hoy contable no ve la pantalla de Administración, así que no puede confirmar plazos, cargar feriados ni atender avisos. Sin eso no se puede simular la cadena con los tres usuarios, que es el objetivo de toda esta tanda.

**Consecuencia que hay que saber:** con esto, contable puede cambiar roles y activar cuentas. Es lo que se pidió. A cambio se cierra un agujero que hoy existe: **nadie —ni gerencia— puede cambiarse el rol a sí mismo**, que hasta ahora sólo estaba impedido para los que no eran gerencia.

- [ ] **Step 1: Crear la migración vacía**

```bash
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH"
export SUPABASE_ACCESS_TOKEN=<el token sbp_ de la cuenta>
npm run db:nueva oficina
```

Esperado: `{"path":"...supabase/migrations/<sello>_oficina.sql","message":"Migration created"}`

- [ ] **Step 2: Escribir la migración**

Escribir en el archivo recién creado (con la herramienta de escritura, **no** con un heredoc: las comillas invertidas del SQL se rompen en el shell):

```sql
-- ============================================================================
--  CONTABLE Y GERENCIA: LOS MISMOS PERMISOS, SIN EXCEPCIONES
-- ============================================================================
--
--  POR QUE. En la practica son la misma oficina. Hoy contable no entra a Administracion, asi
--  que no puede confirmar un plazo, cargar un feriado ni atender un aviso — y entonces la mitad
--  del sistema depende de que una sola persona este disponible.
--
--  SE HACE CON UN HELPER Y NO CAMBIANDO CADA POLICY A MANO. `es_oficina()` dice QUE PROTEGE, no
--  quien es. El dia que un cuarto rol tenga que administrar, se toca esta funcion y ninguna
--  policy. Es la misma razon por la que existe `puede_ver_cobros()`.
--
--  ============================================================================
--   LO QUE ESTA MIGRACION CIERRA, Y HOY ESTABA ABIERTO
--  ============================================================================
--
--  El guardian de campos sensibles decia "si no sos gerencia, no toques rol ni activo". O sea
--  que gerencia SI podia cambiarse el rol a si misma. Con contable adentro del mismo grupo eso
--  se vuelve mas facil de tocar sin querer.
--
--  Entonces se invierte la regla: **NADIE se cambia el rol a si mismo, ni gerencia**. Es mas
--  fuerte que lo que habia, y ademas mantiene verdadera la prueba de permisos que dice que
--  nadie se auto-promueve.
--
--  ES ADITIVA EN DATOS: no toca ninguna fila. Solo cambia quien puede tocarlas.

-- ------------------------------------------------------------
-- 1) El helper
-- ------------------------------------------------------------

create or replace function public.es_oficina()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.perfiles
                  where id = auth.uid() and activo and rol in ('gerencia','contable'));
$$;

comment on function public.es_oficina() is
  'Gerencia y contable son la misma oficina y tienen los mismos permisos. El nombre dice QUE '
  'protege y no quien es: el dia que un cuarto rol administre, se toca esta funcion y ninguna '
  'policy.';

revoke all on function public.es_oficina() from public, anon;
grant execute on function public.es_oficina() to authenticated;

-- ------------------------------------------------------------
-- 2) Nadie se cambia el rol a si mismo. Ni gerencia.
-- ------------------------------------------------------------

create or replace function public.perfiles_bloquear_campos_sensibles()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;   -- consola de la base

  -- LA REGLA NUEVA, y es mas fuerte que la anterior: la propia fila nunca cambia de rol.
  -- Antes solo estaba impedido para quien no era gerencia; ahora no lo puede hacer nadie.
  if new.id = auth.uid() and new.rol is distinct from old.rol then
    raise exception 'regla_tramite: Nadie puede cambiarse el rol a si mismo. Pediselo a otra persona de la oficina.';
  end if;

  if not public.es_oficina() then
    if new.rol        is distinct from old.rol
    or new.activo     is distinct from old.activo
    or new.gestora_id is distinct from old.gestora_id
    or new.email      is distinct from old.email then
      raise exception 'regla_tramite: Solo la oficina puede cambiar el rol, el estado o la gestora de un usuario';
    end if;
  end if;

  return new;
end;
$$;

-- ------------------------------------------------------------
-- 3) Todas las policies que decian es_gerencia() pasan a es_oficina()
--
--    Se enumeran una por una a proposito. Un `do $$` que las recorriera dejaria el cambio
--    invisible en el diff, y este es exactamente el tipo de cambio que hay que poder leer.
-- ------------------------------------------------------------

drop policy if exists "perfiles_select" on public.perfiles;
create policy "perfiles_select" on public.perfiles for select
  using (id = auth.uid() or public.es_oficina());

drop policy if exists "perfiles_update_gerencia" on public.perfiles;
create policy "perfiles_update_gerencia" on public.perfiles for update
  using (public.es_oficina()) with check (public.es_oficina());

drop policy if exists "encuestas_write" on public.encuestas_adopcion;
create policy "encuestas_write" on public.encuestas_adopcion for all to authenticated
  using (public.es_oficina()) with check (public.es_oficina());

drop policy if exists "feriados_write" on public.feriados;
create policy "feriados_write" on public.feriados for all to authenticated
  using (public.es_oficina()) with check (public.es_oficina());

drop policy if exists "plazos_write" on public.plazos;
create policy "plazos_write" on public.plazos for all to authenticated
  using (public.es_oficina()) with check (public.es_oficina());

drop policy if exists "avisos_update" on public.avisos;
create policy "avisos_update" on public.avisos for update to authenticated
  using (public.es_oficina()) with check (public.es_oficina());

drop policy if exists "avisos_select" on public.avisos;
create policy "avisos_select" on public.avisos for select to authenticated
  using (quien = auth.uid() or public.es_oficina());

-- Los catalogos: se escribieron con un bucle, asi que se rehacen con el mismo bucle.
do $$
declare t text;
begin
  foreach t in array array['razones_sociales','sucursales','gestoras','conceptos',
                           'tarjetas_habitualista','tarjetas_debito','requisitos','parametros']
  loop
    execute format('drop policy if exists "%s_write" on public.%I', t, t);
    execute format('create policy "%s_write" on public.%I for all to authenticated using (public.es_oficina()) with check (public.es_oficina())', t, t);
  end loop;
end $$;

-- ============================================================================
--  COMO COMPROBAR QUE QUEDO BIEN
--
--  1) No queda ninguna policy colgada de es_gerencia(). Tiene que dar CERO filas:
--       select tablename, policyname from pg_policies
--        where schemaname = 'public'
--          and (qual like '%es_gerencia%' or with_check like '%es_gerencia%');
--
--  2) El helper es SECURITY DEFINER, stable y con search_path fijo:
--       select prosecdef, provolatile, proconfig from pg_proc p
--         join pg_namespace n on n.oid = p.pronamespace
--        where n.nspname = 'public' and p.proname = 'es_oficina';
--     Esperado: t, s, {search_path=public}
--
--  3) LA QUE IMPORTA, contra la API real y con usuarios reales: `npm run test:rls`. Ahi esta
--     la prueba de que nadie se cambia el rol a si mismo, que ahora tambien corre para gerencia.
-- ============================================================================
```

- [ ] **Step 3: Comprobar que la migración no quedó vacía y aplicarla**

```bash
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH"
node scripts/migraciones-sanas.mjs && npm run db:seco
```

Esperado: `migraciones sanas` sin salida de error, y `Would push these migrations: • <sello>_oficina.sql`

```bash
npm run db:push && npm run db:tipos && npm run permisos
```

Esperado: `Finished supabase db push.`, `Tipos generados`, y los tres controles de permisos en verde.

- [ ] **Step 4: Correr el bloque de comprobación de la migración**

```bash
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH"
node -e '
const tok = process.env.SUPABASE_ACCESS_TOKEN;
const sql = async (q) => {
  const r = await fetch("https://api.supabase.com/v1/projects/drsooohkwwpnijonxwwt/database/query", {
    method: "POST",
    headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json", "User-Agent": "curl/8.0.1" },
    body: JSON.stringify({ query: q }),
  });
  return r.ok ? r.json() : ["FALLA: " + (await r.text()).slice(0, 160)];
};
sql("select tablename, policyname from pg_policies where schemaname=\x27public\x27 and (qual like \x27%es_gerencia%\x27 or with_check like \x27%es_gerencia%\x27)")
  .then((f) => console.log("policies con es_gerencia (esperado 0):", f.length, JSON.stringify(f)));
'
```

Esperado: `policies con es_gerencia (esperado 0): 0 []`

- [ ] **Step 5: Cambiar `puedeAdministrar` en el front**

En `src/lib/roles.ts`, reemplazar la función `puedeAdministrar` por:

```ts
/**
 * Quien administra catalogos, plazos, feriados, usuarios, respaldo y avisos.
 *
 * GERENCIA Y CONTABLE SON LA MISMA OFICINA, y por eso tienen exactamente lo mismo. Espeja al
 * helper `es_oficina()` de la base, que es quien decide de verdad: esto solo evita mostrar
 * botones que van a fallar.
 */
export function puedeAdministrar(rol: Rol): boolean {
  return rol === "gerencia" || rol === "contable";
}
```

- [ ] **Step 6: Actualizar la prueba de permisos que ahora afirma otra cosa**

En `src/permisos.rls.test.ts`, reemplazar el test `"contable NO puede darse el rol de gerencia"` por:

```ts
  it("contable YA NO se auto-promueve, pero ahora tampoco gerencia", async () => {
    /*
      LA REGLA CAMBIO Y ES MAS FUERTE. Antes decia "solo gerencia cambia roles", asi que
      gerencia SI podia cambiarse el suyo. Ahora nadie puede cambiar el rol de su PROPIA fila,
      ni gerencia — que es lo que hace que este invariante siga siendo verdad ahora que contable
      administra igual que gerencia.
    */
    for (const [quien, cliente, esperado] of [
      ["contable", contable, "contable"],
      ["gerencia", gerencia, "gerencia"],
    ] as const) {
      const { data: sesion } = await cliente.auth.getUser();
      const miId = sesion.user?.id ?? "";
      expect(miId, `sin sesion para ${quien}`).not.toBe("");

      await cliente.from("perfiles").update({ rol: "gestora" }).eq("id", miId);

      const { data } = await cliente.from("perfiles").select("rol").eq("id", miId).single();
      expect(data?.rol, `${quien} se cambio el rol a si mismo`).toBe(esperado);
    }
  });

  it("pero contable SI puede administrar a otro, igual que gerencia", async () => {
    // Es la otra mitad del cambio: identicos quiere decir que contable tambien administra.
    const correo = env["PRUEBA_GESTORA"] ?? "";
    const { data: antes } = await contable
      .from("perfiles").select("activo").eq("email", correo).single();
    const original = antes?.activo;
    expect(original).toBeDefined();

    const { error } = await contable
      .from("perfiles").update({ activo: !original }).eq("email", correo);
    expect(error).toBeNull();

    const { data: medio } = await contable
      .from("perfiles").select("activo").eq("email", correo).single();
    expect(medio?.activo).toBe(!original);

    // Se restaura el valor REAL, no uno escrito a mano: asi fue como este arnes dejo una vez
    // desactivada a una gestora que trabajaba.
    await contable.from("perfiles").update({ activo: original }).eq("email", correo);
    const { data: final } = await contable
      .from("perfiles").select("activo").eq("email", correo).single();
    expect(final?.activo).toBe(original);
  });
```

- [ ] **Step 7: Correr las pruebas de permisos y verlas pasar**

```bash
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH"
npm run test:rls
```

Esperado: `Tests 24 passed (24)` — las 23 de antes menos una reemplazada, más dos nuevas.

- [ ] **Step 8: Comprobar en el navegador que contable entra a Administración**

Levantar el servidor con la herramienta de vista previa (`preview_start` con `dev`), entrar como `contable1@grupoparis.com` y comprobar que en el menú aparece **Administración** y que la pantalla carga con los paneles de avisos, dinero, usuarios, calendario y respaldo.

- [ ] **Step 9: Los cuatro comandos y commit**

```bash
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH"
npx tsc -b && npx oxlint && npx vitest run && npx vite build
git add -A
git commit -m "Contable y gerencia son la misma oficina, con el mismo alcance"
```

---

## Task 2: La gestora ve su trámite desde que se lo asignan

**Files:**
- Create: `supabase/migrations/*_gestora_desde_el_alta.sql`
- Modify: `src/features/tramites/AltaTramite.tsx`
- Modify: `src/permisos.rls.test.ts`

**Interfaces:**
- Consume: `public.es_oficina()` de la Task 1.
- Produce: `tramites.gestora_id` se puede escribir en el `insert`, no sólo al entregar.

**Por qué:** hoy `gestora_id` recién se completa al pasar a *entregado*, y la policy de lectura de la gestora exige `gestora_id = mi_gestora_id()`. Resultado: un trámite que carga contable es **invisible** para gestoría hasta dos pasos después. Es el defecto que impide simular la cadena.

- [ ] **Step 1: Escribir la prueba de permisos que hoy falla**

Agregar al final de `src/permisos.rls.test.ts`:

```ts
describe("una gestora ve el tramite desde que se lo asignan", () => {
  let creado = "";

  beforeAll(async () => {
    // Se necesita el id de la gestora vinculada a la cuenta de prueba.
    const { data: sesion } = await gestora.auth.getUser();
    const { data: perfil } = await gestora
      .from("perfiles").select("gestora_id").eq("id", sesion.user?.id ?? "").single();
    const gestoraId = perfil?.gestora_id;
    if (!gestoraId) throw new Error("La cuenta de prueba no esta vinculada a ninguna gestora");

    const { data: razon } = await gerencia.from("razones_sociales").select("id").limit(1).single();
    const { data: suc } = await gerencia.from("sucursales").select("id").limit(1).single();

    const { data, error } = await gerencia
      .from("tramites")
      .insert({
        razon_social_id: razon?.id,
        sucursal_id: suc?.id,
        tipo: "patentamiento_0km",
        cliente_nombre: "VISIBILIDAD DESDE EL ALTA",
        medio_pago: "tarjeta_habitualista",
        gestora_id: gestoraId,
      })
      .select("id")
      .single();
    if (error) throw new Error(`No se pudo crear el tramite de prueba: ${error.message}`);
    creado = String(data?.id);
  });

  it("gerencia lo creo y lo ve", async () => {
    const { data } = await gerencia.from("tramites").select("id").eq("id", creado);
    expect(data).toHaveLength(1);
  });

  it("y la gestora asignada lo ve ENSEGUIDA, todavia en recibido", async () => {
    // Es el defecto que impedia simular la cadena: antes lo veia recien dos pasos despues.
    const { data, error } = await gestora
      .from("tramites").select("id, estado").eq("id", creado);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data?.[0]?.estado).toBe("recibido");
  });

  it("pero la gestora de la OTRA ficha sigue sin verlo", async () => {
    // Lo que este cambio no tenia que romper.
    const otra = await comoUsuario(env["PRUEBA_GESTORA_2"] ?? "");
    const { data } = await otra.from("tramites").select("id").eq("id", creado);
    expect(data).toEqual([]);
  });

  it("y puede cargarle conceptos al presupuesto", async () => {
    // El pedido dice que el presupuesto y sus conceptos los completa la gestora.
    const { data: concepto } = await gerencia.from("conceptos").select("id").limit(1).single();
    const { error } = await gestora.from("tramite_conceptos").insert({
      tramite_id: creado,
      concepto_id: concepto?.id,
      momento: "presupuesto",
      importe: 1234.56,
    });
    expect(error).toBeNull();
  });
});
```

- [ ] **Step 2: Agregar la segunda cuenta de gestora al entorno**

En `.env.local` (que está en `.gitignore` y nunca se commitea), agregar:

```
PRUEBA_GESTORA_2=gestoria2@grupoparis.com
```

Y en `.env.example`, agregar la línea `PRUEBA_GESTORA_2=` debajo de `PRUEBA_GESTORA=`.

- [ ] **Step 3: Correr la prueba y verla fallar por la razón esperada**

```bash
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH"
npm run test:rls
```

Esperado: falla en `"y la gestora asignada lo ve ENSEGUIDA"` con `expected [] to have length 1`. Si falla en el `beforeAll` con un error de la base, el problema es otro y hay que leerlo antes de seguir.

- [ ] **Step 4: Escribir la migración**

```bash
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH"
npm run db:nueva gestora_desde_el_alta
```

Y escribir adentro:

```sql
-- ============================================================================
--  LA GESTORA VE SU TRAMITE DESDE QUE SE LO ASIGNAN, NO DOS PASOS DESPUES
-- ============================================================================
--
--  EL DEFECTO, encontrado en la primera prueba real: `gestora_id` recien se completaba al pasar
--  a `entregado`, y la policy de lectura de la gestora exige `gestora_id = mi_gestora_id()`.
--  Entonces un tramite que cargaba contable era INVISIBLE para gestoria hasta dos pasos
--  despues — y en esos dos pasos no habia forma de que la gestora supiera que existia.
--
--  No hace falta tocar la policy de lectura: ya dice lo correcto. Lo que faltaba era poder
--  ASIGNAR la gestora al dar de alta.
--
--  ============================================================================
--   POR QUE LA ASIGNACION SIGUE SIENDO OPCIONAL
--  ============================================================================
--
--  El alta tiene que entrar en menos de veinte segundos o vuelve el cuaderno. Obligar a elegir
--  gestora en ese momento agrega una decision que muchas veces todavia no esta tomada. Si se
--  deja vacia, se asigna al entregar, como hasta ahora.
--
--  ES ADITIVA: no toca datos ni cambia ninguna policy de lectura.

-- El trigger que bloquea campos por diferencia de jsonb corre en UPDATE, no en INSERT, asi que
-- una gestora no puede auto-asignarse un tramite: la policy de insert sigue siendo solo oficina.
-- Se deja escrito porque es la primera pregunta que aparece al leer este cambio.

-- La unica regla nueva: si se asigna una gestora al alta, tiene que estar activa. Una gestora
-- dada de baja no puede recibir trabajo nuevo, y sin esto el tramite quedaria asignado a
-- alguien que no entra al sistema — invisible para todos y sin que nadie se entere.
create or replace function public.a_tramites_gestora_activa()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.gestora_id is not null
     and not exists (select 1 from public.gestoras g where g.id = new.gestora_id and g.activa) then
    raise exception 'regla_tramite: Esa gestora esta dada de baja. Elegi otra o dejalo sin asignar.';
  end if;
  return new;
end;
$$;

drop trigger if exists a_tramites_gestora_activa on public.tramites;
create trigger a_tramites_gestora_activa
  before insert or update of gestora_id on public.tramites
  for each row execute function public.a_tramites_gestora_activa();

revoke execute on function public.a_tramites_gestora_activa() from public, anon, authenticated;

-- ============================================================================
--  COMO COMPROBAR QUE QUEDO BIEN
--
--  1) El trigger existe y corre antes de insert y de update de gestora_id:
--       select tgname, tgtype from pg_trigger
--        where tgrelid = 'public.tramites'::regclass and tgname = 'a_tramites_gestora_activa';
--
--  2) Una gestora dada de baja NO se puede asignar. Tiene que FALLAR:
--       update public.gestoras set activa = false where nombre = 'Mariana';
--       update public.tramites set gestora_id = (select id from public.gestoras where nombre='Mariana')
--        where cliente_nombre = 'carolina';
--       -- y despues volver a activarla:
--       update public.gestoras set activa = true where nombre = 'Mariana';
--
--  3) LA QUE IMPORTA: `npm run test:rls`, que entra con la gestora real y comprueba que ve el
--     tramite en estado `recibido` y que la gestora de la otra ficha NO lo ve.
-- ============================================================================
```

- [ ] **Step 5: Aplicar la migración**

```bash
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH"
node scripts/migraciones-sanas.mjs && npm run db:push && npm run db:tipos && npm run permisos
```

Esperado: `Finished supabase db push.` y los tres controles de permisos en verde.

- [ ] **Step 6: Correr la prueba y verla pasar**

```bash
npm run test:rls
```

Esperado: `Tests 28 passed (28)`.

- [ ] **Step 7: Agregar el selector de gestora al alta**

En `src/features/tramites/AltaTramite.tsx`:

Agregar el import y el estado (junto a los otros `useState`):

```tsx
import { useGestoras, useRazonesSociales, useSucursales } from "../../lib/datos";
```

```tsx
  const gestoras = useGestoras();
  const [gestoraId, setGestoraId] = useState("");
```

Agregar el campo, después del de Sucursal:

```tsx
        <label className="flex flex-col gap-1">
          <span className="text-xs text-ink2">
            Gestora — opcional, se puede asignar después
          </span>
          <select value={gestoraId} onChange={(e) => setGestoraId(e.target.value)} className={CAMPO}>
            <option value="">Todavía no se sabe</option>
            {gestoras.data?.filter((g) => g.activa).map((g) => (
              <option key={g.id} value={g.id}>{g.nombre}</option>
            ))}
          </select>
        </label>
```

Y sumarlo al `insert`:

```tsx
        // Si se asigna acá, la gestora VE el trámite desde este mismo momento. Si se deja
        // vacío, se asigna al entregarlo, como antes: el alta tiene que entrar en veinte
        // segundos y esta decisión muchas veces todavía no está tomada.
        gestora_id: gestoraId === "" ? null : gestoraId,
```

- [ ] **Step 8: Probarlo mirando, con los dos usuarios**

Con la vista previa levantada: entrar como `contable1@grupoparis.com`, cargar un trámite asignándole **Carla**, salir, entrar como `gestoria1@grupoparis.com` y comprobar que el trámite aparece en el listado en estado *Recibido*. Después entrar como `gestoria2@grupoparis.com` y comprobar que **no** aparece.

- [ ] **Step 9: Los cuatro comandos y commit**

```bash
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH"
npx tsc -b && npx oxlint && npx vitest run && npx vite build
git add -A
git commit -m "La gestora ve su tramite desde que se lo asignan, no dos pasos despues"
```

---

## Task 3: El checklist del legajo, con los cinco puntos que se controlan de verdad

**Files:**
- Create: `supabase/migrations/*_checklist_nuevo.sql`

**Interfaces:**
- Produce: la tabla `requisitos` queda con exactamente cinco filas activas, todas con `aplica_a = 'todos'`.

**Los cinco puntos, textuales:** Control de la oferta - Saldo 0; Revisión de factura del auto; Revisión de factura por gastos; Accesorios sí/no; Entrega de vehículo usado sí/no.

- [ ] **Step 1: Escribir la migración**

```bash
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH"
npm run db:nueva checklist_nuevo
```

```sql
-- ============================================================================
--  EL CHECKLIST DEL LEGAJO, CON LO QUE DE VERDAD SE CONTROLA
-- ============================================================================
--
--  Los diez requisitos anteriores salieron de leer normativa. Estos cinco salieron de la
--  primera prueba real, dichos por quien hace el control todos los dias. Ganan los segundos:
--  un checklist que no espeja el control real se contesta de memoria y deja de ser un control.
--
--  ============================================================================
--   LOS VIEJOS SE DESACTIVAN, NO SE BORRAN
--  ============================================================================
--
--  Hay tramites que ya tienen respuestas cargadas contra los requisitos viejos. Borrarlos
--  dejaria esas respuestas apuntando a nada, y ademas es la regla de la casa: nada se borra.
--  Con `activo = false` desaparecen del checklist de los tramites nuevos y las respuestas
--  viejas siguen siendo legibles.
--
--  OJO CON EL EFECTO EN LA MAQUINA DE ESTADOS, que es el motivo de que esto sea una migracion
--  y no un cambio de pantalla: el trigger que deja pasar de `recibido` a `controlado` exige que
--  esten contestados TODOS los requisitos activos. Al desactivar los viejos y activar cinco
--  nuevos, los tramites que estaban en `recibido` con el checklist a medio contestar pasan a
--  necesitar contestar los cinco nuevos. Es lo correcto: son los que de verdad se controlan.

update public.requisitos set activo = false where activo;

insert into public.requisitos (nombre, aplica_a, orden, activo) values
  ('Control de la oferta - Saldo 0',      'todos', 10, true),
  ('Revision de factura del auto',        'todos', 20, true),
  ('Revision de factura por gastos',      'todos', 30, true),
  ('Accesorios si/no',                    'todos', 40, true),
  ('Entrega de vehiculo usado si/no',     'todos', 50, true)
on conflict (nombre, aplica_a) do update set activo = true, orden = excluded.orden;

-- ============================================================================
--  COMO COMPROBAR QUE QUEDO BIEN
--
--  1) Quedan exactamente cinco activos, todos para 'todos':
--       select count(*) as activos, count(*) filter (where aplica_a = 'todos') as para_todos
--         from public.requisitos where activo;
--     Esperado: 5 y 5.
--
--  2) Los viejos siguen ahi, desactivados (no se borro ninguno):
--       select count(*) from public.requisitos where not activo;   -- esperado: 10
--
--  3) Las respuestas ya cargadas siguen apuntando a un requisito que existe:
--       select count(*) from public.tramite_requisitos tr
--        where not exists (select 1 from public.requisitos r where r.id = tr.requisito_id);
--     Esperado: 0.
--
--  4) LA QUE IMPORTA, y se mira: abrir un tramite en estado `recibido` y ver los cinco puntos
--     nuevos, cada uno con Esta / Falta / No corresponde.
-- ============================================================================
```

- [ ] **Step 2: Aplicar y correr el bloque de comprobación**

```bash
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH"
node scripts/migraciones-sanas.mjs && npm run db:push && npm run db:tipos && npm run permisos
```

Después correr las cuatro consultas del bloque contra la base (con el mismo `node -e` con `fetch` del Step 4 de la Task 1) y comprobar: 5 y 5, 10, 0.

- [ ] **Step 3: Mirarlo en pantalla**

Con la vista previa: abrir un trámite en estado *Recibido* y comprobar que el checklist muestra los cinco puntos nuevos y ninguno de los viejos.

- [ ] **Step 4: Commit**

```bash
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH"
npx tsc -b && npx oxlint && npx vitest run && npx vite build
git add -A
git commit -m "El checklist del legajo, con los cinco puntos que se controlan de verdad"
```

---

## Task 4: La cuenta personal viene entre paréntesis

**Files:**
- Modify: `src/lib/asunto.ts:34`
- Modify: `src/lib/asunto.test.ts`

**Interfaces:**
- Produce: `parsearAsunto(asunto: string): AsuntoParseado` reconoce la cuenta también cuando viene como `(74344)`.

**El problema:** hoy la cuenta se reconoce sólo con el prefijo `C.` (`C.74344`). En la planilla real también viene entre paréntesis y sin prefijo. Y ahí choca con `ENTRE_PARENTESIS`, que hoy toma cualquier número entre paréntesis como **referencia de oferta**.

**La regla que resuelve el choque, y hay que entenderla antes de tocar nada:** `REF. 4097473` es explícito y siempre gana como referencia. Un número entre paréntesis **sin** prefijo es la cuenta personal. Si en el mismo asunto aparecen los dos —`(34913)` y `(REF. 4097473)`— el que tiene `REF` es la referencia y el otro es la cuenta.

- [ ] **Step 1: Escribir las pruebas que fallan**

Agregar a `src/lib/asunto.test.ts`:

```ts
describe("la cuenta personal entre parentesis", () => {
  it("un numero suelto entre parentesis es la CUENTA, no la referencia", () => {
    const r = parsearAsunto("PATENTAMIENTO C3 (34913) BALAGUER JUAN ANTONIO");
    expect(r.cuenta).toBe("34913");
    expect(r.referencia).toBeNull();
  });

  it("con REF. adelante, ese es la referencia y el otro la cuenta", () => {
    // El caso real de la planilla: los dos numeros en el mismo asunto.
    const r = parsearAsunto("PATENTAMIENTO C3 (34913) BALAGUER JUAN ANTONIO (REF. 4097473)");
    expect(r.referencia).toBe("4097473");
    expect(r.cuenta).toBe("34913");
  });

  it("el prefijo C. sigue funcionando y le gana al parentesis", () => {
    // Si estan los dos, el explicito manda: C. dice "cuenta" sin ambiguedad.
    const r = parsearAsunto("PATENTAMIENTO PLAN DE AHORRO- C.74344 MUNOZ ELIZABETH (99999)");
    expect(r.cuenta).toBe("74344");
  });

  it("y el nombre del cliente no se ensucia con ninguno de los dos numeros", () => {
    const r = parsearAsunto("PATENTAMIENTO C3 (34913) BALAGUER JUAN ANTONIO (REF. 4097473)");
    expect(r.cliente).toBe("BALAGUER JUAN ANTONIO");
  });
});
```

- [ ] **Step 2: Correr las pruebas y verlas fallar**

```bash
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH"
npx vitest run src/lib/asunto.test.ts
```

Esperado: fallan las tres primeras. La primera con `expected null to be "34913"` (hoy `(34913)` se lee como referencia).

- [ ] **Step 3: Cambiar el parser**

En `src/lib/asunto.ts`, reemplazar el bloque que calcula `cuenta` y `referencia` (hoy son dos líneas, `const cuenta = ...` y `const referencia = ...`) por:

```ts
  /*
    ============================================================================
     LOS DOS NUMEROS DEL ASUNTO, Y COMO SE DISTINGUEN
    ============================================================================

    En la planilla real conviven, a veces en el mismo asunto:
        (34913)         -> la CUENTA personal del cliente
        (REF. 4097473)  -> la REFERENCIA de la oferta

    La regla es que gana lo explicito. `REF` y `C.` dicen que son sin ninguna duda; un numero
    suelto entre parentesis no dice nada, y en la planilla ese lugar lo ocupa la cuenta.

    POR QUE IMPORTA EL ORDEN EN QUE SE RESUELVEN: si el parentesis se leyera primero como
    referencia —que es lo que hacia antes— la cuenta no se reconocia nunca y habia que
    escribirla a mano en cada tramite. Era el dato que mas se cargaba dos veces.
  */
  const referencia = REFERENCIA.exec(t)?.[1] ?? null;

  // El parentesis solo se considera cuenta si NO es el que trae el REF adentro.
  const sueltoEntreParentesis = [...t.matchAll(/\((\d{4,8})\)/g)]
    .map((m) => m[1])
    .find((n) => n !== undefined && n !== referencia) ?? null;

  const cuenta = CUENTA.exec(t)?.[1] ?? sueltoEntreParentesis;
```

Y en el bloque que limpia el texto antes de buscar el nombre, reemplazar por:

```ts
  // El nombre se busca DESPUES de sacar TODOS los numeros, para que ninguno lo ensucie.
  const sinNumeros = t
    .replace(CUENTA, " ")
    .replace(REFERENCIA, " ")
    .replaceAll(/\(\s*\d{4,8}\s*\)/g, " ");
```

- [ ] **Step 4: Correr las pruebas y verlas pasar**

```bash
npx vitest run src/lib/asunto.test.ts
```

Esperado: todas pasan, incluidas las once que ya existían.

- [ ] **Step 5: Probarlo pegando un asunto real en la pantalla**

Con la vista previa: ir a *Cargar trámite*, pegar `PATENTAMIENTO C3 (34913) BALAGUER JUAN ANTONIO (REF. 4097473)` y comprobar que **Cuenta personal** dice `34913`, **Referencia de la oferta** dice `4097473` y **Cliente** dice `BALAGUER JUAN ANTONIO`.

- [ ] **Step 6: Commit**

```bash
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH"
npx tsc -b && npx oxlint && npx vitest run && npx vite build
git add -A
git commit -m "La cuenta personal entre parentesis, que era el dato que mas se cargaba dos veces"
```

---

## Task 5: Modalidad, sólo para patentamientos y con dos valores

**Files:**
- Create: `supabase/migrations/*_modalidad_de_patentamiento.sql`
- Modify: `src/lib/asunto.ts:27` y `:104`
- Modify: `src/lib/asunto.test.ts`
- Modify: `src/features/tramites/AltaTramite.tsx:155-161`
- Modify: `src/features/tramites/Listado.tsx:45-48`
- Modify: `src/lib/excel.test.ts:29`

**Interfaces:**
- Produce: `AsuntoParseado["subtipo"]` pasa de `"plan_ahorro" | "credito" | "contado" | null` a `"plan_ahorro" | "venta_directa" | null`.
- Produce: la constante `MODALIDADES` en `Listado.tsx` queda con dos claves.

**La regla:** un 0km se compra de dos formas y sólo dos: **plan de ahorro** o **venta directa**. Crédito y contado son formas de pago, no modalidades. Y una transferencia no tiene modalidad, así que el campo **no se muestra** cuando el tipo no es patentamiento.

- [ ] **Step 1: Escribir la migración que convierte lo ya cargado**

```bash
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH"
npm run db:nueva modalidad_de_patentamiento
```

```sql
-- ============================================================================
--  LA MODALIDAD ES SOLO DE UN PATENTAMIENTO, Y TIENE EXACTAMENTE DOS VALORES
-- ============================================================================
--
--  Un 0km se compra de dos formas y solo dos: PLAN DE AHORRO o VENTA DIRECTA. `credito` y
--  `contado` no eran modalidades: son formas de pago, y ademas ya existe una columna para eso
--  (`medio_pago`). Estaban de mas y ensuciaban el dato.
--
--  Y una TRANSFERENCIA no tiene modalidad. Hoy el campo se mostraba igual, invitando a llenar
--  algo que no significa nada.
--
--  ============================================================================
--   QUE PASA CON LO QUE YA ESTABA CARGADO
--  ============================================================================
--
--  Los que decian `credito` o `contado` pasan a `venta_directa`, que es lo que de verdad eran:
--  un 0km comprado fuera de un plan de ahorro. Los de plan de ahorro no se tocan. Las
--  transferencias que tuvieran una modalidad cargada quedan en NULL, porque ese dato no existe
--  para ellas.
--
--  Es la unica migracion de esta tanda que TOCA DATOS, y por eso lo dice arriba.

update public.tramites
   set subtipo = 'venta_directa'
 where tipo = 'patentamiento_0km'
   and subtipo in ('credito','contado');

update public.tramites
   set subtipo = null
 where tipo <> 'patentamiento_0km'
   and subtipo is not null;

-- El check que lo vuelve imposible de aca en adelante. Sin esto, la regla vive solo en la
-- pantalla y la primera consulta que escriba alguien por afuera la rompe.
alter table public.tramites drop constraint if exists tramites_subtipo_valido;
alter table public.tramites add constraint tramites_subtipo_valido check (
  subtipo is null
  or (tipo = 'patentamiento_0km' and subtipo in ('plan_ahorro','venta_directa'))
);

comment on column public.tramites.subtipo is
  'Como se compro el 0km: plan_ahorro o venta_directa, y nada mas. Solo aplica a '
  'patentamiento_0km: una transferencia no tiene modalidad. La forma de PAGO es otra cosa y '
  'vive en medio_pago.';

-- ============================================================================
--  COMO COMPROBAR QUE QUEDO BIEN
--
--  1) No quedo ningun subtipo fuera de los dos valores:
--       select distinct tipo, subtipo from public.tramites order by 1, 2;
--     Esperado: subtipo solo null, 'plan_ahorro' o 'venta_directa', y nunca distinto de null
--     cuando tipo no es 'patentamiento_0km'.
--
--  2) El check bloquea. Tiene que FALLAR:
--       update public.tramites set subtipo = 'contado'
--        where tipo = 'patentamiento_0km' limit 1;
--
--  3) Y tambien tiene que FALLAR ponerle modalidad a una transferencia:
--       update public.tramites set subtipo = 'plan_ahorro'
--        where tipo = 'transferencia_a_cliente' limit 1;
-- ============================================================================
```

- [ ] **Step 2: Aplicar y correr el bloque de comprobación, incluidas las dos que deben fallar**

```bash
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH"
node scripts/migraciones-sanas.mjs && npm run db:push && npm run db:tipos && npm run permisos
```

Después correr las tres consultas. Las dos `update` **tienen que devolver error** `23514 violates check constraint`. Si alguna pasa, el check no quedó y hay que parar.

- [ ] **Step 3: Cambiar el parser y su prueba**

En `src/lib/asunto.ts`, cambiar el tipo:

```ts
  subtipo: "plan_ahorro" | "venta_directa" | null;
```

Y la detección:

```ts
  /*
    Un 0km se compra de dos formas y solo dos. Si el asunto no dice "plan de ahorro", en la
    practica es venta directa — pero eso NO se asume acá: se deja en null y lo elige quien
    carga. Adivinar la modalidad es adivinar un dato del negocio, y este parser se abstiene.
  */
  let subtipo: AsuntoParseado["subtipo"] = null;
  if (/PLAN\s+DE\s+AHORRO/.test(mayus)) subtipo = "plan_ahorro";
  else if (/VENTA\s+DIRECTA|0\s?KM\s+DIRECTO/.test(mayus)) subtipo = "venta_directa";
```

En `src/lib/asunto.test.ts`, agregar:

```ts
  it("reconoce la venta directa cuando el asunto la nombra", () => {
    expect(parsearAsunto("PATENTAMIENTO VENTA DIRECTA GOMEZ ANALIA").subtipo).toBe("venta_directa");
  });

  it("y NO adivina la modalidad cuando el asunto no la dice", () => {
    // Adivinar un dato del negocio es lo unico que este parser no puede hacer.
    expect(parsearAsunto("PATENTAMIENTO C3 (34913) BALAGUER JUAN ANTONIO").subtipo).toBeNull();
  });
```

- [ ] **Step 4: Cambiar las dos opciones del alta y hacer el campo condicional**

En `src/features/tramites/AltaTramite.tsx`, reemplazar la etiqueta completa de Modalidad por:

```tsx
        {/*
          LA MODALIDAD ES SOLO DE UN PATENTAMIENTO. Una transferencia no tiene modalidad, y
          mostrar el campo igual invita a llenar algo que no significa nada — que después
          aparece en el Excel y alguien lo lee como si dijera algo.
        */}
        {tipo === "patentamiento_0km" && (
          <label className="flex flex-col gap-1">
            <span className="text-xs text-ink2">Modalidad</span>
            <select value={subtipo} onChange={(e) => setSubtipo(e.target.value)} className={CAMPO}>
              <option value="">Sin especificar</option>
              <option value="plan_ahorro">Plan de ahorro</option>
              <option value="venta_directa">Venta directa 0km</option>
            </select>
          </label>
        )}
```

Y en la función `pegar`, después de `setSubtipo(r.subtipo ?? "")`, agregar la línea que limpia la modalidad cuando el tipo deja de ser patentamiento:

```tsx
    // Si el asunto resultó ser una transferencia, la modalidad no aplica y se va.
    if (r.tipo !== "patentamiento_0km") setSubtipo("");
```

- [ ] **Step 5: Cambiar los nombres en el listado y arreglar la prueba de Excel**

En `src/features/tramites/Listado.tsx`, reemplazar `MODALIDADES`:

```tsx
const MODALIDADES: Record<string, string> = {
  plan_ahorro: "Plan de ahorro",
  venta_directa: "Venta directa 0km",
};
```

En `src/lib/excel.test.ts`, cambiar la línea `subtipo: "plan_ahorro",` — se queda igual, sigue siendo válida. Comprobar que no haya ninguna otra referencia a `credito` o `contado`:

```bash
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH"
grep -rn "credito\|contado" src/ || echo "sin rastros"
```

Esperado: `sin rastros`.

- [ ] **Step 6: Correr todo y mirarlo**

```bash
npx tsc -b && npx oxlint && npx vitest run && npx vite build
```

Con la vista previa: en *Cargar trámite*, elegir tipo **Transferencia a cliente** y comprobar que el campo Modalidad **desaparece**. Elegir **Patentamiento 0km** y comprobar que aparece con las dos opciones.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "La modalidad es solo de un patentamiento y tiene dos valores"
```

---

## Task 6: Lo que estás cargando no se pierde al cambiar de pantalla

**Files:**
- Create: `src/lib/borrador.ts`
- Create: `src/lib/borrador.test.ts`
- Modify: `src/features/tramites/AltaTramite.tsx`
- Modify: `src/features/tramites/Listado.tsx`

**Interfaces:**
- Produce: `useBorrador<T>(clave: string, inicial: T): [T, (v: T) => void, () => void]` — devuelve el valor, cómo cambiarlo, y cómo descartarlo.

**El problema, dicho por quien lo sufrió:** *"si necesito chequear una información, tengo que volver a cargar todo"*. Cada pantalla guarda su formulario en estado de React, y al navegar el componente se desmonta y se lleva todo puesto.

**Por qué al disco y no manteniendo la pantalla montada:** guardarlo en `localStorage` sobrevive además a recargar la página y a que se cierre el navegador sin querer. Mantener montadas todas las pantallas resuelve menos y cuesta memoria en el teléfono, que es donde menos hay.

- [ ] **Step 1: Escribir las pruebas del módulo**

Crear `src/lib/borrador.test.ts`:

```ts
import { describe, expect, it, beforeEach } from "vitest";
import { leerBorrador, guardarBorrador, descartarBorrador } from "./borrador";

describe("borradores", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("lo que se guarda se recupera igual", () => {
    guardarBorrador("alta", { cliente: "GOMEZ", cuenta: "74344" });
    expect(leerBorrador("alta", {})).toEqual({ cliente: "GOMEZ", cuenta: "74344" });
  });

  it("sin nada guardado devuelve el valor inicial", () => {
    expect(leerBorrador("alta", { cliente: "" })).toEqual({ cliente: "" });
  });

  it("descartar lo saca de verdad", () => {
    guardarBorrador("alta", { cliente: "GOMEZ" });
    descartarBorrador("alta");
    expect(leerBorrador("alta", { cliente: "" })).toEqual({ cliente: "" });
  });

  it("un borrador ROTO devuelve el inicial en vez de tirar la pantalla abajo", () => {
    // Pasa de verdad: cambia la forma del formulario y lo guardado deja de encajar. Que eso
    // rompa la pantalla entera seria mucho peor que perder un borrador.
    window.localStorage.setItem("gestoria.borrador.alta", "{ esto no es json");
    expect(leerBorrador("alta", { cliente: "" })).toEqual({ cliente: "" });
  });

  it("no explota si el navegador no deja guardar", () => {
    // En navegacion privada o con el disco lleno, localStorage LANZA. Un borrador que no se
    // pudo guardar no puede tumbar la pantalla del saldo.
    const original = window.localStorage.setItem;
    window.localStorage.setItem = () => { throw new Error("QuotaExceeded"); };
    expect(() => guardarBorrador("alta", { cliente: "GOMEZ" })).not.toThrow();
    window.localStorage.setItem = original;
  });
});
```

- [ ] **Step 2: Correr las pruebas y verlas fallar**

```bash
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH"
npx vitest run src/lib/borrador.test.ts
```

Esperado: falla con `Failed to resolve import "./borrador"`.

- [ ] **Step 3: Escribir el módulo**

Crear `src/lib/borrador.ts`:

```ts
import { useCallback, useState } from "react";

/**
 * ============================================================================
 *  LO QUE SE ESTA CARGANDO NO SE PIERDE AL CAMBIAR DE PANTALLA
 * ============================================================================
 *
 *  EL DEFECTO, dicho por quien lo sufrió en la primera prueba real: "si necesito chequear una
 *  información, tengo que volver a cargar todo". Cada formulario guardaba su estado adentro del
 *  componente, y al navegar React lo desmonta y se lo lleva puesto.
 *
 *  Y no es una molestia menor: el alta tiene que entrar en menos de veinte segundos o vuelve el
 *  cuaderno. Un formulario que hay que llenar dos veces se come ese presupuesto entero.
 *
 *  ============================================================================
 *   POR QUE AL DISCO Y NO MANTENIENDO LA PANTALLA MONTADA
 *  ============================================================================
 *
 *  Guardarlo acá sobrevive además a recargar la página, a que se cierre el navegador sin querer
 *  y a que se corte la luz. Mantener montadas todas las pantallas resuelve menos y cuesta
 *  memoria justo en el teléfono, que es donde menos hay.
 *
 *  ============================================================================
 *   QUE VA ACA Y QUE NO
 *  ============================================================================
 *
 *  Va lo que se está ESCRIBIENDO y todavía no se guardó. No va nada que ya esté en la base: eso
 *  se lee de la base, que es la única que dice la verdad. Y no va ningún dato que no haya
 *  escrito la propia persona en esta computadora.
 */

const PREFIJO = "gestoria.borrador.";

/** Lo guardado, o el inicial si no hay nada, si no se entiende, o si el navegador no deja leer. */
export function leerBorrador<T>(clave: string, inicial: T): T {
  try {
    const crudo = window.localStorage.getItem(PREFIJO + clave);
    if (crudo === null) return inicial;
    return JSON.parse(crudo) as T;
  } catch {
    // Un borrador roto —porque cambió la forma del formulario, por ejemplo— devuelve el
    // inicial. Perder un borrador molesta; que rompa la pantalla entera es mucho peor.
    return inicial;
  }
}

export function guardarBorrador<T>(clave: string, valor: T): void {
  try {
    window.localStorage.setItem(PREFIJO + clave, JSON.stringify(valor));
  } catch {
    // Sin lugar para guardar se trabaja igual: se pierde la comodidad, no la función.
  }
}

export function descartarBorrador(clave: string): void {
  try {
    window.localStorage.removeItem(PREFIJO + clave);
  } catch {
    // idem
  }
}

/**
 * El borrador como estado de React.
 *
 * Devuelve, en este orden: el valor, cómo cambiarlo, y cómo descartarlo. El descarte lo llama
 * quien guardó con éxito — un borrador que sobrevive a haber guardado reaparece en el trámite
 * siguiente con los datos del anterior, que es peor que no tener borrador.
 */
export function useBorrador<T>(clave: string, inicial: T): [T, (v: T) => void, () => void] {
  const [valor, setValor] = useState<T>(() => leerBorrador(clave, inicial));

  const cambiar = useCallback((v: T) => {
    setValor(v);
    guardarBorrador(clave, v);
  }, [clave]);

  const descartar = useCallback(() => {
    descartarBorrador(clave);
    setValor(inicial);
    // `inicial` a propósito fuera de las dependencias: si quien llama le pasa un objeto nuevo en
    // cada render, incluirlo haría que esta función cambie siempre y dispare re-renders en
    // cadena. El inicial de un formulario no cambia entre renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);

  return [valor, cambiar, descartar];
}
```

- [ ] **Step 4: Correr las pruebas y verlas pasar**

```bash
npx vitest run src/lib/borrador.test.ts
```

Esperado: `Tests 5 passed (5)`.

- [ ] **Step 5: Usar el borrador en el alta**

En `src/features/tramites/AltaTramite.tsx`, reemplazar los catorce `useState` sueltos por un solo objeto en el borrador:

```tsx
import { useBorrador } from "../../lib/borrador";

/** Todo lo que se está escribiendo en el alta, junto. Un objeto, un borrador. */
interface Alta {
  asunto: string; cliente: string; cuenta: string; vehiculo: string; referencia: string;
  dominio: string; tipo: string; subtipo: string; razonId: string; sucursalId: string;
  gestoraId: string; medioPago: string; canal: string; observaciones: string;
  administrativo: string;
}

const VACIO: Alta = {
  asunto: "", cliente: "", cuenta: "", vehiculo: "", referencia: "", dominio: "",
  tipo: "", subtipo: "", razonId: "", sucursalId: "", gestoraId: "",
  medioPago: "tarjeta_habitualista", canal: "presencial", observaciones: "",
  administrativo: "",
};
```

Y dentro del componente:

```tsx
  const [f, setF, descartar] = useBorrador<Alta>("alta", VACIO);
  const cambiar = (parte: Partial<Alta>): void => setF({ ...f, ...parte });
```

Cada campo pasa de `value={cliente} onChange={(e) => setCliente(e.target.value)}` a `value={f.cliente} onChange={(e) => cambiar({ cliente: e.target.value })}`.

**Los quince campos, para no saltearse ninguno:** `asunto` (es un `textarea`, y su `onChange` llama a `pegar`, no a `cambiar`), `cliente`, `cuenta`, `vehiculo`, `referencia`, `dominio`, `tipo`, `subtipo`, `razonId`, `sucursalId`, `gestoraId`, `medioPago`, `canal`, `observaciones`, `administrativo`.

Al terminar, **no puede quedar ningún `useState` suelto en este archivo**. Comprobarlo:

```bash
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH"
grep -c "useState" src/features/tramites/AltaTramite.tsx
```

Esperado: `0`. Si da más, quedó un campo sin migrar y ése es el que se va a seguir perdiendo.

La función `pegar` pasa a escribir todo de una:

```tsx
  function pegar(texto: string): void {
    const r = parsearAsunto(texto);
    cambiar({
      asunto: texto,
      cliente: r.cliente ?? "",
      cuenta: r.cuenta ?? "",
      referencia: r.referencia ?? "",
      tipo: r.tipo ?? "",
      subtipo: r.tipo === "patentamiento_0km" ? (r.subtipo ?? "") : "",
    });
  }
```

Y en el `onSuccess` del guardado, donde hoy se limpian los campos, llamar a `descartar()`.

- [ ] **Step 6: Recordar también el filtro del listado**

En `src/features/tramites/Listado.tsx`, reemplazar los dos `useState` de búsqueda y estado:

```tsx
  // El filtro también se recuerda: volver al listado y encontrarlo como lo dejaste es parte de
  // no tener que recargar todo cada vez que se va a chequear un dato.
  const [buscar, setBuscar] = useBorrador("listado.buscar", "");
  const [estado, setEstado] = useBorrador("listado.estado", "");
```

(El tercer valor que devuelve `useBorrador` no se usa acá, así que se desestructuran sólo dos.)

- [ ] **Step 7: Probarlo mirando, que es como se encontró**

Con la vista previa: ir a *Cargar trámite*, llenar cliente, cuenta y vehículo **sin guardar**, ir a *Tarjeta*, volver a *Cargar trámite* y comprobar que **está todo**. Después guardar el trámite y comprobar que el formulario queda vacío y no reaparece lo anterior.

- [ ] **Step 8: Los cuatro comandos y commit**

```bash
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH"
npx tsc -b && npx oxlint && npx vitest run && npx vite build
git add -A
git commit -m "Lo que estas cargando no se pierde al cambiar de pantalla"
```

---

## Task 7: El orden de las tarjetas, por uso y no por alfabeto

**Files:**
- Create: `supabase/migrations/*_orden_de_tarjetas.sql`
- Modify: `src/lib/datos.ts` (la función `useSaldos`)

**Interfaces:**
- Consume: `v_saldos` pasa a exponer la columna `orden`.
- Produce: `Saldo` gana el campo `orden: number`.

**El pedido:** primero Paris Autos, segundo Paris Cars, que son las que más se usan. Hoy `useSaldos` ordena por nombre, así que arranca en Doral Chevrolet — y la pantalla del saldo abre siempre en la tarjeta equivocada.

- [ ] **Step 1: Escribir la migración**

```bash
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH"
npm run db:nueva orden_de_tarjetas
```

```sql
-- ============================================================================
--  EL ORDEN DE LAS TARJETAS LO DECIDE EL USO, NO EL ALFABETO
-- ============================================================================
--
--  La pantalla del saldo abre en la primera de la lista, y hasta hoy ordenaba por nombre: abria
--  en Doral Chevrolet. Las que mas se usan son Paris Autos y Paris Cars, asi que la pantalla
--  que se mira treinta veces por dia arrancaba siempre en la tarjeta equivocada.
--
--  La columna `orden` ya existia y ya decia lo correcto para Paris Autos. Faltaban dos cosas:
--  subir Paris Cars al segundo lugar, y que la vista EXPONGA `orden` para que el front pueda
--  usarlo. Sin lo segundo, el front no tenia con que ordenar y caia en el nombre.

update public.tarjetas_habitualista set orden = 20 where nombre = 'Paris Cars';
update public.tarjetas_habitualista set orden = 30 where nombre = 'Doral Chevrolet';

-- La vista se recrea igual que estaba, mas la columna `orden`. Se repite entera y no se
-- "agrega una columna": una vista no se altera, se reemplaza, y dejarla escrita completa es lo
-- que permite leer en el diff que lo demas no cambio.
create or replace view public.v_saldos with (security_invoker = true) as
select th.id as tarjeta_id,
       th.nombre,
       th.orden,
       coalesce(sum(m.importe) filter (
         where m.tipo in ('saldo_inicial','ingreso','pago','ajuste')
           and m.fecha_acreditacion <= current_date), 0) as contable,
       coalesce(sum(m.importe) filter (
         where m.tipo = 'ingreso' and m.fecha_acreditacion > current_date), 0) as en_transito,
       coalesce(-sum(m.importe) filter (
         where m.tipo in ('reserva','ajuste_reserva','reversa_reserva')), 0) as comprometido
  from public.tarjetas_habitualista th
  left join public.movimientos m on m.tarjeta_id = th.id
 group by th.id, th.nombre, th.orden;

-- `create or replace view` NO conserva los permisos revocados si la vista se recrea con otras
-- columnas, asi que se vuelven a poner. Sin esta linea, la vista quedaria escribible otra vez y
-- `npm run permisos` se pondria en rojo — que es exactamente para lo que existe ese guardian.
revoke insert, update, delete, truncate on public.v_saldos from anon, authenticated;
grant select on public.v_saldos to authenticated;

-- ============================================================================
--  COMO COMPROBAR QUE QUEDO BIEN
--
--  1) El orden quedo por uso:
--       select nombre, orden from public.tarjetas_habitualista order by orden;
--     Esperado: Paris Autos SA 10, Paris Cars 20, Doral Chevrolet 30, Paris Motor 40,
--               Paris Trac 50.
--
--  2) La vista expone `orden` y sigue siendo de solo lectura:
--       npm run permisos
--     Esperado: los tres controles en verde.
--
--  3) LA QUE IMPORTA, y se mira: entrar a Tarjeta y ver que abre en Paris Autos SA.
-- ============================================================================
```

- [ ] **Step 2: Aplicar y comprobar**

```bash
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH"
node scripts/migraciones-sanas.mjs && npm run db:push && npm run db:tipos && npm run permisos
```

Esperado: los tres controles de permisos en verde. Si `ninguna vista es escribible` sale en rojo, faltó la línea de `revoke`.

- [ ] **Step 3: Ordenar por `orden` en el front**

En `src/lib/datos.ts`, en la interfaz `Saldo` agregar `orden: number;`, y en `useSaldos` cambiar la consulta y el mapeo:

```ts
      // ORDENADO POR USO, no por nombre. La pantalla abre en la primera de la lista y las que
      // más se usan son Paris Autos y Paris Cars: ordenar por nombre hacía que la pantalla que
      // se mira treinta veces por día arrancara siempre en la tarjeta equivocada.
      const { data, error } = await supabase.from("v_saldos").select("*").order("orden");
      if (error) throw error;
      return (data ?? []).map((s) => ({
        tarjeta_id: String(s.tarjeta_id),
        nombre: String(s.nombre),
        orden: Number(s.orden),
        contable: aNumero(s.contable),
        en_transito: aNumero(s.en_transito),
        comprometido: aNumero(s.comprometido),
      }));
```

- [ ] **Step 4: Mirarlo**

Con la vista previa: entrar a *Tarjeta* y comprobar que abre en **Paris Autos SA** y que el desplegable lista Paris Autos, Paris Cars, Doral Chevrolet, Paris Motor, Paris Trac, en ese orden. Comprobar también que la pantalla de *Administración → Cargar dinero* lista las tarjetas en el mismo orden.

- [ ] **Step 5: Los cuatro comandos y commit**

```bash
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH"
npx tsc -b && npx oxlint && npx vitest run && npx vite build
git add -A
git commit -m "El orden de las tarjetas lo decide el uso, no el alfabeto"
```

---

## Task 8: Corregir el depósito después de presupuestado

**Files:**
- Modify: `src/features/tramites/Ficha.tsx:257-269`

**Interfaces:**
- Consume: el trigger `e_tramites_cuenta_corriente` de la base, que ya existe y ya sabe corregir.

**Lo que hay que saber antes de tocar nada:** el libro mayor **ya sabe corregir un depósito**. Cuando cambia `deposito_solicitado`, escribe un movimiento `ajuste_reserva` **por la diferencia**, y no toca la reserva original — porque editarla haría que el saldo de ayer deje de ser reconstruible. El único caso que excluye es `pagado`, y con razón: ahí ya se descontó el costo real.

O sea que esto es **puramente de pantalla**: el campo sólo se muestra en estado `entregado`, así que un error de tipeo no se podía arreglar nunca.

- [ ] **Step 1: Cambiar la condición del campo**

En `src/features/tramites/Ficha.tsx`, reemplazar el bloque `{t.estado === "entregado" && (...)}` del depósito por:

```tsx
          {/*
            ============================================================================
             EL DEPOSITO SE PUEDE CORREGIR HASTA QUE SE PAGA
            ============================================================================

            Antes el campo solo aparecia en `entregado`, asi que un error de tipeo no se podia
            arreglar nunca — y un depósito mal cargado es plata comprometida de más o de menos
            en la pantalla con la que se decide si se manda a presentar.

            La base ya sabía corregirlo: al cambiar el importe escribe un movimiento de ajuste
            POR LA DIFERENCIA, y nunca toca la reserva original. Faltaba solamente mostrar el
            campo.

            DESPUES DE PAGADO NO, y tampoco es capricho: ahí ya se liberó la reserva y se
            descontó el costo real. Corregir el presupuesto en ese punto no cambiaría ninguna
            plata y dejaría el trámite diciendo algo que no pasó. Si hubo un error después del
            pago, se arregla con un ajuste, que es otra operación y queda escrita.
          */}
          {["entregado", "presupuestado", "frenado_por_saldo", "presentado"].includes(t.estado) && (
            <label className="flex flex-col gap-1">
              <span className="text-xs text-ink2">
                {t.deposito_solicitado === null
                  ? "Depósito que se solicita * — puede ser mayor que la suma de los conceptos"
                  : "Depósito que se solicita — si lo corregís, la diferencia se ajusta sola en la cuenta"}
              </span>
              <input
                inputMode="decimal"
                value={valor("deposito_solicitado", t.deposito_solicitado?.toString() ?? null)}
                onChange={(e) => set("deposito_solicitado", e.target.value)}
                className={CAMPO}
              />
              {campos["deposito_solicitado"] !== undefined && (
                <button
                  type="button"
                  onClick={() => avanzar.mutate(t.estado)}
                  className={BOTON_SUAVE}
                >
                  Guardar el depósito corregido
                </button>
              )}
            </label>
          )}
```

**Por qué el botón llama a `avanzar.mutate(t.estado)` con el estado actual:** esa mutación ya arma el parche con todos los campos pendientes y lo manda. Pasarle el estado en el que ya está hace que guarde el depósito **sin mover el trámite de paso**, que es exactamente lo que hace falta para corregir un tipeo.

- [ ] **Step 2: Probar el circuito completo de la corrección, mirando los números**

Con la vista previa, entrando como gerencia:

1. Anotar el **Comprometido** actual de la tarjeta en la pantalla *Tarjeta*.
2. Abrir un trámite en estado *Presupuestado*, anotar su depósito.
3. Corregirlo a un valor **mayor** y guardar.
4. Volver a *Tarjeta*: el **Comprometido** tiene que haber subido exactamente por la diferencia, y en *Operaciones* tiene que aparecer una línea `Correccion del presupuesto` con esa diferencia en negativo.
5. Corregirlo de vuelta al valor original y comprobar que el Comprometido vuelve al número del punto 1.

Esta comprobación es la que importa: que el número de la pantalla del saldo termine donde tiene que terminar. Que el formulario guarde sin error no dice nada sobre eso.

- [ ] **Step 3: Comprobar que después de pagado el campo no está**

Abrir un trámite en estado *Pagado* y comprobar que el campo del depósito **no aparece**.

- [ ] **Step 4: Los cuatro comandos y commit**

```bash
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH"
npx tsc -b && npx oxlint && npx vitest run && npx vite build
git add -A
git commit -m "El deposito se puede corregir hasta que se paga"
```

---

## Task 9: Los vencimientos no se le muestran a la gestora

**Files:**
- Modify: `src/features/tramites/Ficha.tsx`

**Interfaces:**
- Consume: `puedeVerCobros(rol)` no sirve acá; se usa el rol directamente vía `useSesion()`.

**El pedido:** ocultar vencimientos en la parte de gestoría. La gestora trabaja con el paso siguiente y el presupuesto; los plazos normativos son control de oficina, y en la pantalla del teléfono compiten con lo único que ella necesita ver ahí.

- [ ] **Step 1: Leer el rol en la ficha**

En `src/features/tramites/Ficha.tsx`, agregar el import y el uso:

```tsx
import { useSesion } from "../../lib/sesion";
```

Dentro del componente `Ficha`, junto a los otros hooks:

```tsx
  const { perfil } = useSesion();
```

- [ ] **Step 2: Condicionar el panel**

Reemplazar el uso de `<Vencimientos ... />` por:

```tsx
      {/*
        LOS VENCIMIENTOS SON CONTROL DE OFICINA, no de gestoría. La gestora trabaja con el paso
        siguiente y con el presupuesto; en la pantalla del teléfono, que es donde ella la usa,
        un panel de plazos normativos compite con lo único que necesita ver parada en el
        registro. Se lo saca de la vista, no de sus permisos: los plazos los sigue pudiendo
        leer, simplemente no se le dibujan acá.
      */}
      {perfil?.rol !== "gestora" && (
        <Vencimientos
          plazos={plazosDeTipo(plazos.data ?? [], t.tipo)}
          calendario={calendario.data ?? { feriados: new Set(), cubreHasta: null }}
          fechas={{
            recibido: t.recibido_at.slice(0, 10),
            presentado: t.presentado_at === null ? null : t.presentado_at.slice(0, 10),
            certificacion_primera_firma: t.certificacion_primera_firma,
            verificacion_policial: t.verificacion_policial,
            factura: t.factura_fecha,
          }}
          alGuardarFecha={(campo, fecha) => guardarFecha.mutate({ campo, valor: fecha })}
          tipo={t.tipo}
        />
      )}
```

- [ ] **Step 3: Mirarlo con los dos usuarios**

Con la vista previa: entrar como `gestoria1@grupoparis.com`, abrir un trámite asignado a Carla y comprobar que **no** aparece el panel *Vencimientos*. Entrar como `contable1@grupoparis.com`, abrir el mismo trámite y comprobar que **sí** aparece.

- [ ] **Step 4: Los cuatro comandos y commit**

```bash
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH"
npx tsc -b && npx oxlint && npx vitest run && npx vite build
git add -A
git commit -m "Los vencimientos son control de oficina y no se le dibujan a la gestora"
```

---

## Task 10: El administrativo a cargo

**Files:**
- Create: `supabase/migrations/*_administrativo_a_cargo.sql`
- Modify: `src/lib/datos.ts` (la interfaz `Tramite`)
- Modify: `src/features/tramites/AltaTramite.tsx`
- Modify: `src/features/tramites/Ficha.tsx`
- Modify: `src/lib/excel.ts`
- Modify: `src/lib/excel.test.ts`

**Interfaces:**
- Produce: `tramites.administrativo` (`text`, nulable) y el campo `administrativo: string | null` en la interfaz `Tramite`.

- [ ] **Step 1: Escribir la migración**

```bash
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH"
npm run db:nueva administrativo_a_cargo
```

```sql
-- ============================================================================
--  EL ADMINISTRATIVO A CARGO
-- ============================================================================
--
--  Quien de administracion se hizo cargo de este tramite. Es un dato de interes: sirve para
--  saber a quien preguntarle cuando algo del legajo no cierra, que hoy se resuelve preguntando
--  en voz alta hasta que alguien contesta.
--
--  ES UN TEXTO LIBRE, y fue una decision explicita, no una simplificacion: la lista de quienes
--  pueden quedar a cargo todavia no esta cerrada, y una tabla de catalogo obligaria a darla de
--  alta antes de poder cargar el primer tramite. El dia que se estabilice, pasarlo a catalogo
--  es una migracion chica.
--
--  LO QUE SE PIERDE POR ser texto libre, dicho de frente: no se puede filtrar bien, porque el
--  mismo nombre va a entrar escrito de tres formas. Se compensa en la pantalla con una lista de
--  sugerencias armada con lo ya cargado, que empuja a repetir la forma en vez de inventarla.
--
--  ES ADITIVA: una columna nulable y nada mas.

alter table public.tramites
  add column if not exists administrativo text;

comment on column public.tramites.administrativo is
  'Quien de administracion quedo a cargo. Texto libre a proposito: la lista de personas '
  'todavia no esta cerrada y un catalogo obligaria a darla de alta antes del primer tramite.';

-- Se suma a los campos que una gestora PUEDE tocar? NO. La gestora no asigna administrativos.
-- Al no estar en la lista de permitidos del trigger de bloqueo, queda protegido por defecto —
-- que es exactamente para lo que ese trigger compara por diferencia de jsonb.

-- ============================================================================
--  COMO COMPROBAR QUE QUEDO BIEN
--
--  1) La columna existe y es nulable:
--       select column_name, is_nullable, data_type from information_schema.columns
--        where table_schema='public' and table_name='tramites' and column_name='administrativo';
--     Esperado: una fila, YES, text.
--
--  2) Una gestora NO lo puede cambiar. Con `npm run test:rls` no alcanza porque no hay prueba
--     para esto; se comprueba a mano entrando como gestora, abriendo un tramite suyo e
--     intentando guardarlo: la base tiene que responder que una gestora solo puede cargar el
--     presupuesto, los costos, el dominio, la seccional, el numero de pago y sus observaciones.
-- ============================================================================
```

- [ ] **Step 2: Aplicar**

```bash
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH"
node scripts/migraciones-sanas.mjs && npm run db:push && npm run db:tipos && npm run permisos
```

- [ ] **Step 3: Sumarlo al tipo y al alta**

En `src/lib/datos.ts`, dentro de la interfaz `Tramite`, agregar:

```ts
  /** Quien de administración quedó a cargo. Texto libre; ver la migración. */
  administrativo: string | null;
```

En `src/features/tramites/AltaTramite.tsx` el campo ya está en el borrador (`administrativo`, Task 6). Agregar el import y el hook:

```tsx
import { useAdministrativos, useGestoras, useRazonesSociales, useSucursales } from "../../lib/datos";
```

```tsx
  const administrativos = useAdministrativos();
```

Y el control, después del de Gestora:

```tsx
        <label className="flex flex-col gap-1">
          <span className="text-xs text-ink2">Administrativo a cargo</span>
          {/*
            La lista de sugerencias sale de lo ya cargado. No obliga a nada —se puede escribir
            cualquier cosa— pero empuja a repetir la forma en vez de inventarla, que es lo único
            que se puede hacer contra el problema de un texto libre.
          */}
          <input
            list="administrativos-ya-usados"
            value={f.administrativo}
            onChange={(e) => cambiar({ administrativo: e.target.value })}
            className={CAMPO}
          />
          <datalist id="administrativos-ya-usados">
            {administrativos.data?.map((a) => <option key={a} value={a} />)}
          </datalist>
        </label>
```

Y en `src/lib/datos.ts`, agregar el hook que alimenta la lista:

```ts
/**
 * Los administrativos que ya se usaron alguna vez, para sugerirlos.
 *
 * Es lo único que se puede hacer contra un texto libre: no impide escribir cualquier cosa, pero
 * empuja a repetir la forma en vez de inventarla, que es como el mismo nombre termina cargado
 * de tres maneras distintas y después no se puede filtrar por él.
 */
export function useAdministrativos() {
  return useQuery({
    queryKey: ["administrativos"],
    ...CATALOGO,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from("tramites")
        .select("administrativo")
        .not("administrativo", "is", null)
        .limit(500);
      if (error) throw error;
      const nombres = new Set(
        (data ?? []).map((t) => String(t.administrativo).trim()).filter((n) => n !== ""),
      );
      return [...nombres].toSorted();
    },
  });
}
```

Sumarlo al `insert` del alta:

```tsx
        administrativo: f.administrativo.trim() === "" ? null : f.administrativo.trim(),
```

- [ ] **Step 4: Mostrarlo en la ficha**

En `src/features/tramites/Ficha.tsx`, en la grilla de `<Dato ... />`, agregar:

```tsx
          <Dato rotulo="Administrativo a cargo" valor={t.administrativo} />
```

- [ ] **Step 5: Sumarlo al Excel**

En `src/lib/excel.ts`, agregar el campo a la interfaz `FilaExportable`:

```ts
  administrativo: string | null;
```

Y la columna a `COLUMNAS`, después de Seccional:

```ts
  { titulo: "Administrativo a cargo", ancho: 22, celda: (f) => texto(f.administrativo) },
```

En `src/lib/excel.test.ts`, agregar `administrativo: "Sofía",` al objeto `BASE` y este test:

```ts
  it("el administrativo a cargo sale en su columna", () => {
    expect(celda(BASE, "Administrativo a cargo").value).toBe("Sofía");
  });
```

- [ ] **Step 6: Correr todo y mirarlo**

```bash
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH"
npx tsc -b && npx oxlint && npx vitest run && npx vite build
```

Con la vista previa: cargar un trámite con un administrativo, comprobar que aparece en la ficha, cargar un segundo trámite y comprobar que el nombre del primero aparece como sugerencia. Bajar el Excel y **abrirlo**: la columna tiene que estar y tener el nombre.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "El administrativo a cargo, con sugerencias de lo ya cargado"
```

---

## Task 11: El historial de cambios del presupuesto

**Files:**
- Create: `supabase/migrations/*_historial_presupuesto.sql`
- Create: `src/features/tramites/HistorialPresupuesto.tsx`
- Modify: `src/lib/datos.ts`
- Modify: `src/features/tramites/Ficha.tsx`

**Interfaces:**
- Produce: la tabla `presupuesto_historial` y el hook `useHistorialPresupuesto(tramiteId)`.

**Por qué hace falta:** hoy el presupuesto se puede cambiar —se agregan conceptos, se corrige el depósito— y no queda registro de quién lo cambió ni de cuánto era antes. El movimiento de `ajuste_reserva` deja rastro en la cuenta corriente, pero la ficha del trámite no muestra nada, y es ahí donde se mira cuando alguien pregunta por qué el presupuesto no es el que se había dicho.

- [ ] **Step 1: Escribir la migración**

```bash
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH"
npm run db:nueva historial_presupuesto
```

```sql
-- ============================================================================
--  EL HISTORIAL DEL PRESUPUESTO: QUIEN LO CAMBIO, CUANDO Y DE CUANTO A CUANTO
-- ============================================================================
--
--  Hoy el presupuesto se puede cambiar —se agregan conceptos, se corrige el deposito— y no
--  queda registro de quien lo hizo ni de cuanto era antes. La cuenta corriente guarda el
--  movimiento de ajuste, pero la ficha del tramite no muestra nada, y la ficha es donde se mira
--  cuando alguien pregunta por que el presupuesto no es el que se habia dicho.
--
--  ============================================================================
--   LO ESCRIBE UN TRIGGER, NO LA PANTALLA
--  ============================================================================
--
--  Si lo escribiera la pantalla, el dia que alguien cambie un presupuesto desde otro lado —una
--  correccion a mano, una importacion— el historial diria que no paso nada. Un historial con
--  agujeros es peor que ninguno: se lo lee como completo.
--
--  Y es de SOLO INSERCION, como el libro mayor: sin update ni delete para nadie.

create table if not exists public.presupuesto_historial (
  id          bigserial primary key,
  tramite_id  uuid not null references public.tramites(id) on delete cascade,
  que         text not null,
  antes       text,
  despues     text,
  quien       uuid references public.perfiles(id),
  cuando      timestamptz not null default now(),
  constraint presupuesto_historial_que_valido check (que in ('deposito','concepto'))
);

comment on table public.presupuesto_historial is
  'Cada cambio del presupuesto de un tramite. Lo escribe un trigger y no la pantalla: si lo '
  'escribiera la pantalla, un cambio hecho desde otro lado no quedaria registrado y el '
  'historial diria que no paso nada. Solo insercion.';

create index if not exists presupuesto_historial_tramite_idx
  on public.presupuesto_historial (tramite_id, cuando desc);

-- ------------------------------------------------------------
-- El trigger del deposito
-- ------------------------------------------------------------

create or replace function public.f_tramites_historial_presupuesto()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.deposito_solicitado is distinct from old.deposito_solicitado then
    insert into public.presupuesto_historial (tramite_id, que, antes, despues, quien)
    values (new.id, 'deposito',
            case when old.deposito_solicitado is null then null
                 else to_char(old.deposito_solicitado, 'FM999999999990.00') end,
            case when new.deposito_solicitado is null then null
                 else to_char(new.deposito_solicitado, 'FM999999999990.00') end,
            auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists f_tramites_historial_presupuesto on public.tramites;
create trigger f_tramites_historial_presupuesto
  after update of deposito_solicitado on public.tramites
  for each row execute function public.f_tramites_historial_presupuesto();

-- ------------------------------------------------------------
-- El trigger de los conceptos
-- ------------------------------------------------------------

create or replace function public.f_conceptos_historial_presupuesto()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_nombre text;
begin
  select nombre into v_nombre from public.conceptos where id = new.concepto_id;

  insert into public.presupuesto_historial (tramite_id, que, antes, despues, quien)
  values (new.tramite_id, 'concepto',
          case when tg_op = 'UPDATE'
               then coalesce(v_nombre,'?') || ' ' || to_char(old.importe, 'FM999999999990.00')
               else null end,
          coalesce(v_nombre,'?') || ' ' || to_char(new.importe, 'FM999999999990.00')
            || ' (' || new.momento || ')',
          auth.uid());
  return new;
end;
$$;

drop trigger if exists f_conceptos_historial_presupuesto on public.tramite_conceptos;
create trigger f_conceptos_historial_presupuesto
  after insert or update on public.tramite_conceptos
  for each row execute function public.f_conceptos_historial_presupuesto();

revoke execute on function public.f_tramites_historial_presupuesto()  from public, anon, authenticated;
revoke execute on function public.f_conceptos_historial_presupuesto() from public, anon, authenticated;

-- ------------------------------------------------------------
-- RLS: lo ve quien ve el tramite. De solo insercion, y la insercion la hace el trigger.
-- ------------------------------------------------------------

alter table public.presupuesto_historial enable row level security;

drop policy if exists "presupuesto_historial_select" on public.presupuesto_historial;
create policy "presupuesto_historial_select" on public.presupuesto_historial for select to authenticated
  using (exists (select 1 from public.tramites x where x.id = presupuesto_historial.tramite_id));

-- Sin policy de insert: lo escribe el trigger, que es SECURITY DEFINER y no pasa por RLS.
-- Sin update ni delete para nadie, igual que el libro mayor.
revoke insert, update, delete, truncate on public.presupuesto_historial from anon, authenticated;

-- ============================================================================
--  COMO COMPROBAR QUE QUEDO BIEN
--
--  1) Cambiar un deposito y ver que aparece la fila:
--       update public.tramites set deposito_solicitado = 123456
--        where cliente_nombre = 'carolina';
--       select que, antes, despues from public.presupuesto_historial
--        where tramite_id = (select id from public.tramites where cliente_nombre='carolina');
--
--  2) Nadie puede editar el historial:
--       select has_table_privilege('authenticated','public.presupuesto_historial','UPDATE') as u,
--              has_table_privilege('authenticated','public.presupuesto_historial','DELETE') as d;
--     Esperado: false y false.
--
--  3) `npm run permisos` en verde.
--
--  4) LA QUE IMPORTA, y se mira: corregir un deposito desde la pantalla y ver la linea nueva en
--     el historial de la ficha, con el nombre de quien lo cambio.
-- ============================================================================
```

- [ ] **Step 2: Aplicar y correr el bloque de comprobación**

```bash
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH"
node scripts/migraciones-sanas.mjs && npm run db:push && npm run db:tipos && npm run permisos
```

Correr las tres consultas. La segunda tiene que dar `false` y `false`.

- [ ] **Step 3: El hook**

En `src/lib/datos.ts`:

```ts
export interface CambioDePresupuesto {
  id: number;
  que: string;
  antes: string | null;
  despues: string | null;
  cuando: string;
  quien_nombre: string | null;
}

export function useHistorialPresupuesto(tramiteId: string | null) {
  return useQuery({
    queryKey: ["presupuesto_historial", tramiteId],
    enabled: tramiteId !== null,
    queryFn: async (): Promise<CambioDePresupuesto[]> => {
      const { data, error } = await supabase
        .from("presupuesto_historial")
        .select("id, que, antes, despues, cuando, quien")
        .eq("tramite_id", tramiteId ?? "")
        .order("cuando", { ascending: false });
      if (error) throw error;

      // El nombre se pide aparte y no con un embed: la policy de `perfiles` deja que una
      // gestora lea solo su propia fila, así que un embed le devolvería null para los cambios
      // de sus compañeras. Es el mismo problema que ya tuvieron las notas, resuelto igual.
      const ids = [...new Set((data ?? []).map((c) => c.quien).filter((q): q is string => q !== null))];
      const nombres = new Map<string, string>();
      if (ids.length > 0) {
        const { data: gente } = await supabase.rpc("nombres_de", { personas: ids });
        for (const p of (gente ?? []) as { id: string; nombre: string }[]) nombres.set(p.id, p.nombre);
      }

      return (data ?? []).map((c) => ({
        id: Number(c.id),
        que: String(c.que),
        antes: c.antes,
        despues: c.despues,
        cuando: String(c.cuando),
        quien_nombre: c.quien === null ? null : (nombres.get(c.quien) ?? null),
      }));
    },
  });
}
```

- [ ] **Step 4: La función `nombres_de` que ese hook necesita**

Agregar al final de la misma migración del Step 1, **antes** del bloque de comprobación (y si la migración ya se aplicó, crear una migración nueva con `npm run db:nueva nombres_de`):

```sql
-- Los nombres de varias personas de una. Misma razon que `nombre_de`: la policy de perfiles
-- deja leer solo la fila propia, asi que sin esto una gestora veria los cambios de sus
-- companieras sin nombre. Devuelve UNICAMENTE id y nombre.
create or replace function public.nombres_de(personas uuid[])
returns table (id uuid, nombre text)
language sql security definer stable set search_path = public as $$
  select p.id, p.nombre from public.perfiles p where p.id = any(personas);
$$;

revoke all on function public.nombres_de(uuid[]) from public, anon;
grant execute on function public.nombres_de(uuid[]) to authenticated;
```

- [ ] **Step 5: El componente**

Crear `src/features/tramites/HistorialPresupuesto.tsx`:

```tsx
import { Panel } from "../../components/Panel";
import { SkeletonLineas } from "../../components/Skeleton";
import { formatearFechaHora } from "../../lib/fechas";
import type { CambioDePresupuesto } from "../../lib/datos";

/**
 * El historial de cambios del presupuesto.
 *
 * ESTA EN LA FICHA Y NO EN LA CUENTA CORRIENTE a propósito. El movimiento de ajuste ya queda en
 * la cuenta, pero cuando alguien pregunta por qué el presupuesto no es el que se había dicho,
 * abre el trámite — no el extracto de la tarjeta.
 *
 * Lo escribe un trigger, así que registra el cambio venga de donde venga. Un historial con
 * agujeros es peor que ninguno: se lo lee como completo.
 */
export function HistorialPresupuesto({
  cambios, cargando,
}: {
  cambios: CambioDePresupuesto[];
  cargando: boolean;
}) {
  if (cargando) return <Panel><SkeletonLineas cantidad={2} /></Panel>;
  if (cambios.length === 0) return null;

  return (
    <Panel className="flex flex-col gap-2">
      <h2 className="text-lg">Cambios del presupuesto</h2>
      <div className="flex flex-col">
        {cambios.map((c) => (
          <div key={c.id} className="border-b border-line py-2 last:border-0">
            <p className="text-sm">
              {c.que === "deposito" ? "Depósito" : "Concepto"}
              {c.antes === null ? ": " : ` de ${c.antes} a `}
              {c.despues ?? ""}
            </p>
            <p className="text-2xs text-ink2 tnum">
              {c.quien_nombre ?? "Alguien"} · {formatearFechaHora(c.cuando)}
            </p>
          </div>
        ))}
      </div>
    </Panel>
  );
}
```

- [ ] **Step 6: Conectarlo a la ficha**

En `src/features/tramites/Ficha.tsx`, agregar el hook y el panel debajo del de Costos:

```tsx
import { HistorialPresupuesto } from "./HistorialPresupuesto";
```

```tsx
  const historial = useHistorialPresupuesto(id);
```

```tsx
      <HistorialPresupuesto cambios={historial.data ?? []} cargando={historial.isLoading} />
```

Y sumar `"presupuesto_historial"` a la lista de `invalidar` de las mutaciones `avanzar` y `agregarLinea`, para que el panel se actualice al cambiar algo.

- [ ] **Step 7: Probarlo mirando**

Con la vista previa: abrir un trámite presupuestado, corregir el depósito, y comprobar que aparece una línea *"Depósito de X a Y"* con el nombre de quien lo cambió y la hora. Agregar un concepto y comprobar que aparece su línea.

- [ ] **Step 8: Los cuatro comandos y commit**

```bash
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH"
npx tsc -b && npx oxlint && npx vitest run && npx vite build
git add -A
git commit -m "El historial del presupuesto: quien lo cambio, cuando y de cuanto a cuanto"
```

---

## Task 12: Las novedades, en vivo y adentro de la app

**Files:**
- Create: `supabase/migrations/*_novedades_en_vivo.sql`
- Create: `src/lib/novedades.ts`
- Create: `src/lib/novedades.test.ts`
- Create: `src/components/Novedades.tsx`
- Modify: `src/components/Shell.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Produce: `useNovedades(): { lista: Novedad[]; sinVer: number; marcarVistas: () => void }`
- Produce: `contarSinVer(lista: Novedad[], desde: string | null): number` — la parte pura, que es la que se prueba.

**Por qué en vivo y adentro de la app:** es lo que se eligió y lo que funciona el mismo día. Un correo necesita contratar un servicio y configurar un dominio; WhatsApp necesita la API de Business y aprobación de plantillas. Las dos cosas son otra etapa.

- [ ] **Step 1: La migración que habilita Realtime**

```bash
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH"
npm run db:nueva novedades_en_vivo
```

```sql
-- ============================================================================
--  QUE LOS CAMBIOS DE UN TRAMITE LLEGUEN SOLOS, SIN RECARGAR
-- ============================================================================
--
--  `tramite_eventos` guarda cada paso de la cadena, y es exactamente lo que hay que avisar.
--  Para que Realtime lo mande, la tabla tiene que estar en la publicacion — no alcanza con
--  suscribirse desde el front.
--
--  ES LA PARTE QUE SE OLVIDA SIEMPRE, y falla en silencio: el front se suscribe, no da error, y
--  simplemente no llega nunca nada. No hay ningun sintoma que apunte a esto.
--
--  Realtime respeta la RLS, asi que una gestora solo recibe eventos de tramites que puede ver.
--  Eso NO hay que programarlo: sale de que la policy de select ya dice lo correcto.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tramite_eventos'
  ) then
    alter publication supabase_realtime add table public.tramite_eventos;
  end if;
end $$;

-- Y `tramites`, que ya se usa para refrescar el listado, por si no estaba.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tramites'
  ) then
    alter publication supabase_realtime add table public.tramites;
  end if;
end $$;

-- ============================================================================
--  COMO COMPROBAR QUE QUEDO BIEN
--
--  1) Las dos tablas estan en la publicacion:
--       select tablename from pg_publication_tables
--        where pubname='supabase_realtime' and schemaname='public'
--        order by tablename;
--     Esperado: que aparezcan `tramite_eventos` y `tramites`.
--
--  2) LA QUE IMPORTA, y no se comprueba con SQL: abrir la app en DOS ventanas con dos usuarios
--     distintos, avanzar un tramite en una, y ver que en la otra aparece la novedad sin
--     recargar. Si no aparece, el problema es esta publicacion y no el codigo del front.
-- ============================================================================
```

- [ ] **Step 2: Aplicar y comprobar**

```bash
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH"
node scripts/migraciones-sanas.mjs && npm run db:push && npm run db:tipos && npm run permisos
```

Correr la consulta 1 y comprobar que las dos tablas están.

- [ ] **Step 3: Escribir la prueba de la parte pura**

Crear `src/lib/novedades.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { contarSinVer, type Novedad } from "./novedades";

const N = (id: number, cuando: string): Novedad => ({
  id, tramiteId: "t1", cliente: "GOMEZ", estado: "controlado", cuando,
});

describe("contar lo que no se vio", () => {
  const lista = [
    N(3, "2026-08-20T12:00:00.000Z"),
    N(2, "2026-08-20T11:00:00.000Z"),
    N(1, "2026-08-20T10:00:00.000Z"),
  ];

  it("sin haber mirado nunca, todo es nuevo", () => {
    expect(contarSinVer(lista, null)).toBe(3);
  });

  it("cuenta solo lo posterior a la ultima vez que se miro", () => {
    expect(contarSinVer(lista, "2026-08-20T11:00:00.000Z")).toBe(1);
  });

  it("si se miro despues de todo, no queda nada", () => {
    expect(contarSinVer(lista, "2026-08-20T23:00:00.000Z")).toBe(0);
  });

  it("una lista vacia cuenta cero y no rompe", () => {
    expect(contarSinVer([], null)).toBe(0);
  });
});
```

- [ ] **Step 4: Correr la prueba y verla fallar**

```bash
npx vitest run src/lib/novedades.test.ts
```

Esperado: `Failed to resolve import "./novedades"`.

- [ ] **Step 5: Escribir el módulo**

Crear `src/lib/novedades.ts`:

```ts
import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";
import { recordado, recordar } from "./recordar";
import { hoyArgentina } from "./fechas";

/**
 * ============================================================================
 *  LAS NOVEDADES: QUE LOS CAMBIOS DE UN TRAMITE LLEGUEN SOLOS
 * ============================================================================
 *
 *  El pedido: anunciar las modificaciones de los trámites. Adentro de la app y en vivo — un
 *  correo necesita contratar un servicio y configurar un dominio, y WhatsApp necesita la API de
 *  Business con plantillas aprobadas. Las dos son otra etapa.
 *
 *  ============================================================================
 *   QUE SE AVISA Y QUE NO
 *  ============================================================================
 *
 *  Se avisa cada paso de la cadena, que es lo que la otra persona necesita saber: que un
 *  trámite pasó a controlado, a presentado, a pagado. NO se avisa cada tecla que alguien
 *  escribe en un campo: un aviso por cada cosa es ruido, y el ruido entrena a ignorar también
 *  los avisos que importan.
 *
 *  ============================================================================
 *   NO SE AVISAN LOS CAMBIOS PROPIOS
 *  ============================================================================
 *
 *  Quien acaba de mover un trámite ya sabe que lo movió. Avisárselo es la forma más rápida de
 *  que la campana pierda sentido.
 *
 *  Y LA RLS DECIDE QUE LLEGA. Realtime respeta las policies, así que una gestora sólo recibe
 *  eventos de trámites que puede ver. Eso no se programa acá: sale de que la policy de lectura
 *  ya dice lo correcto.
 */

export interface Novedad {
  id: number;
  tramiteId: string;
  cliente: string;
  estado: string;
  cuando: string;
}

const CLAVE_VISTO = "novedades.visto";

/** Cuántas de la lista son posteriores a la última vez que se miró. */
export function contarSinVer(lista: Novedad[], desde: string | null): number {
  if (desde === null) return lista.length;
  return lista.filter((n) => n.cuando > desde).length;
}

export function useNovedades(miId: string | null): {
  lista: Novedad[];
  sinVer: number;
  marcarVistas: () => void;
} {
  const [lista, setLista] = useState<Novedad[]>([]);
  const [visto, setVisto] = useState<string | null>(() => recordado(CLAVE_VISTO));

  useEffect(() => {
    if (miId === null) return;

    const canal = supabase
      .channel("novedades")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "tramite_eventos" },
        (msg) => {
          const e = msg.new as {
            id: number; tramite_id: string; estado_hasta: string; at: string; por?: string | null;
          };
          // Los cambios propios no se avisan: quien lo movió ya sabe que lo movió.
          if (e.por === miId) return;

          setLista((antes) => [
            {
              id: Number(e.id),
              tramiteId: String(e.tramite_id),
              // El nombre del cliente se completa al abrir el trámite; acá alcanza el estado.
              cliente: "",
              estado: String(e.estado_hasta),
              cuando: String(e.at),
            },
            ...antes,
          ].slice(0, 50));   // tope: una campana con doscientas líneas no se lee
        },
      )
      .subscribe();

    return () => void supabase.removeChannel(canal);
  }, [miId]);

  const marcarVistas = useCallback(() => {
    // Se marca con la hora del último evento y no con "ahora": si llega uno mientras el panel
    // está abierto, con "ahora" quedaría marcado como visto sin haberlo visto.
    const ultimo = lista[0]?.cuando ?? `${hoyArgentina()}T00:00:00.000Z`;
    setVisto(ultimo);
    recordar(CLAVE_VISTO, ultimo);
  }, [lista]);

  return { lista, sinVer: contarSinVer(lista, visto), marcarVistas };
}
```

- [ ] **Step 6: Correr la prueba y verla pasar**

```bash
npx vitest run src/lib/novedades.test.ts
```

Esperado: `Tests 4 passed (4)`.

- [ ] **Step 7: La campana**

Crear `src/components/Novedades.tsx`:

```tsx
import { useState } from "react";
import { Bell } from "lucide-react";
import { Panel } from "./Panel";
import { formatearFechaHora } from "../lib/fechas";
import { nombreDeEstado } from "../features/tramites/Listado";
import type { Novedad } from "../lib/novedades";

/**
 * La campana de novedades.
 *
 * EL NUMERO SOLO APARECE SI HAY ALGO. Un contador en cero permanente es un adorno, y un adorno
 * al lado de un aviso le baja el valor al aviso.
 */
export function Novedades({
  lista, sinVer, alAbrirPanel, alAbrirTramite,
}: {
  lista: Novedad[];
  sinVer: number;
  alAbrirPanel: () => void;
  alAbrirTramite: (id: string) => void;
}) {
  const [abierto, setAbierto] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setAbierto(!abierto);
          if (!abierto) alAbrirPanel();
        }}
        className="flex items-center gap-2 text-2xs text-side-ink2"
      >
        <Bell aria-hidden="true" size={14} />
        Novedades
        {sinVer > 0 && <span className="tnum text-warn">{sinVer}</span>}
      </button>

      {abierto && (
        <Panel className="fixed inset-x-4 bottom-20 z-20 flex max-h-80 max-w-md flex-col gap-2 overflow-y-auto md:inset-x-auto md:bottom-6 md:left-6">
          <h2 className="text-sm">Novedades</h2>
          {lista.length === 0 ? (
            <p className="text-2xs text-ink2">
              Nada nuevo desde que entraste. Acá van a aparecer los trámites que muevan los
              demás, sin que tengas que recargar.
            </p>
          ) : (
            lista.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => {
                  alAbrirTramite(n.tramiteId);
                  setAbierto(false);
                }}
                className="border-b border-line py-2 text-left last:border-0"
              >
                <p className="text-sm">Pasó a {nombreDeEstado(n.estado)}</p>
                <p className="text-2xs text-ink2 tnum">{formatearFechaHora(n.cuando)}</p>
              </button>
            ))
          )}
        </Panel>
      )}
    </>
  );
}
```

- [ ] **Step 8: Conectarla**

En `src/App.tsx`, usar el hook y pasarle al `Shell` cómo abrir un trámite:

```tsx
import { useSesion } from "./lib/sesion";
import { useNovedades } from "./lib/novedades";
```

```tsx
  const { perfil } = useSesion();
  const novedades = useNovedades(perfil?.id ?? null);
```

Y pasarlos al `Shell`:

```tsx
    <Shell
      pantalla={pantalla}
      alNavegar={(p: Pantalla) => { setPantalla(p); setTramiteAbierto(null); }}
      novedades={novedades}
      alAbrirTramite={abrir}
    >
```

En `src/components/Shell.tsx`, agregar el import y las dos props:

```tsx
import { Novedades } from "./Novedades";
import type { Novedad } from "../lib/novedades";
```

```tsx
export function Shell({
  children, pantalla, alNavegar, novedades, alAbrirTramite,
}: {
  children: ReactNode;
  pantalla: Pantalla;
  alNavegar: (p: Pantalla) => void;
  novedades: { lista: Novedad[]; sinVer: number; marcarVistas: () => void };
  alAbrirTramite: (id: string) => void;
}) {
```

Y el componente en **las dos barras**, justo antes de `<Avisar ... />` — en el `<header>` del teléfono y en el `<aside>` del escritorio. Es el mismo bloque en los dos lugares:

```tsx
          <Novedades
            lista={novedades.lista}
            sinVer={novedades.sinVer}
            alAbrirPanel={novedades.marcarVistas}
            alAbrirTramite={alAbrirTramite}
          />
```

**Por qué en las dos y no en una sola:** la campana avisa que otro movió un trámite. Quien más lo necesita es la gestora, que está en el teléfono y no tiene forma de enterarse de otra manera — dejarla sólo en el escritorio sería ponerla donde menos hace falta.

- [ ] **Step 9: Probarlo con dos ventanas, que es la única forma de probarlo**

Abrir la app en dos pestañas: una como `contable1@grupoparis.com` y otra como `gestoria1@grupoparis.com`, con un trámite asignado a Carla. Desde contable, avanzar el trámite. En la ventana de la gestora, **sin recargar**, la campana tiene que mostrar un 1. Al abrirla, tiene que listar el cambio; al tocarlo, tiene que abrir el trámite.

Si no aparece nada, lo primero que hay que mirar es la consulta 1 de la migración del Step 1: la publicación de Realtime falla en silencio.

- [ ] **Step 10: Los cuatro comandos y commit**

```bash
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH"
npx tsc -b && npx oxlint && npx vitest run && npx vite build
git add -A
git commit -m "Las novedades llegan solas, sin recargar y sin avisar lo propio"
```

---

## Cierre: la simulación de la cadena completa

No es una tarea de código. Es la comprobación de que esta tanda sirvió para lo que se pidió, y va después de las doce.

- [ ] **Paso 1: Actualizar los documentos**

Contar de nuevo los números de `docs/ESTADO.md` corriendo los comandos, no de memoria. Agregar al `CHANGELOG.md` una entrada en lenguaje de usuario con lo que cambió en esta tanda.

- [ ] **Paso 2: Publicar**

```bash
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH"
npx tsc -b && npx oxlint && npx vitest run && npx vite build
npm run test:rls && npm run permisos
git checkout main && git merge --ff-only dev && git push origin main && git checkout dev
```

Esperar a que el flujo *Publicar* termine en verde y comprobar que `https://proyecto-gestoria.pages.dev/` sirve la app compilada.

- [ ] **Paso 3: Caminar la cadena con los tres usuarios, en el sitio publicado**

Este es el objetivo de toda la tanda, dicho por quien lo pidió: *"tengo que probar los 3 tipos de usuarios antes de poder ver que funcione todo como corresponde"*.

1. **Contable** carga un trámite pegando un asunto con la cuenta entre paréntesis, le asigna a Carla y anota el administrativo a cargo.
2. **Contable** contesta los cinco puntos del checklist —uno como *Falta*— y lo marca controlado.
3. **Gestoría (Carla)** lo ve aparecer sin recargar, lo abre, y comprueba que **no** ve el panel de vencimientos.
4. **Contable** lo entrega a Carla.
5. **Gestoría** carga los conceptos del presupuesto y el depósito.
6. **Gerencia** ve el pedido en la bandeja, mira el saldo en *Tarjeta* —que abre en Paris Autos— y comprueba que el comprometido subió.
7. **Contable** corrige el depósito por un error de tipeo y comprueba que el comprometido se ajusta por la diferencia y que el cambio queda en el historial del presupuesto.
8. **Gestoría** lo marca presentado y después pagado, cargando el costo real.
9. **Gerencia** comprueba en *Tarjeta* que se liberó la reserva y se descontó el costo real.
10. En cualquier momento del recorrido, dejar un formulario a medio cargar, cambiar de pantalla y volver: tiene que estar todo.

- [ ] **Paso 4: Anotar lo que aparezca**

Lo que salga mal en esta simulación es la próxima tanda. Anotarlo con el botón de avisar un problema desde el usuario donde apareció: así queda con la pantalla, el rol y la hora, que es lo que después sirve para encontrarlo.

---

## Lo que este plan NO hace, escrito para que nadie lo suponga

- **No manda correos ni WhatsApp.** Las novedades son adentro de la app. Las otras dos vías necesitan servicios contratados y son otra etapa.
- **No convierte al administrativo a cargo en un catálogo.** Es texto libre con sugerencias, y por eso no se va a poder filtrar bien por él hasta que se estabilice la lista.
- **No toca la segunda base de datos.** Preview y producción siguen apuntando a la misma, y la app lo sigue diciendo en pantalla.
- **No agrega la exportación del historial de presupuesto al Excel.** El Excel sigue siendo una fila por trámite.
- **No cambia quién puede ver el margen.** `cobros` sigue exactamente como está: gerencia y contable sí, gestoría no, por ninguno de los cuatro caminos.
