#!/usr/bin/env node
/**
 * ============================================================================
 *  GUARDIAN DE PERMISOS. Que nadie pueda borrar, y que ninguna vista se escriba.
 * ============================================================================
 *
 *  POR QUE EXISTE, y esta parte vale mas que el script. La migracion que arreglo los permisos
 *  los arreglo PARA LOS OBJETOS QUE EXISTIAN ESE DIA. Supabase deja permisos por defecto en el
 *  esquema `public` que le dan TODO a `authenticated` sobre cada objeto nuevo; la migracion
 *  tambien cambio ese defecto, pero un defecto se puede volver a cambiar, y una tabla creada
 *  desde el panel web no pasa por ninguna migracion.
 *
 *  O sea: el arreglo puede deshacerse solo, en silencio, y el sintoma no aparece hasta que
 *  alguien borra algo. Un arreglo que se puede deshacer sin que nadie se entere no es un
 *  arreglo: es una ventana de tiempo.
 *
 *  QUE COMPRUEBA, exactamente:
 *
 *    1. Que ningun objeto de `public` le de DELETE ni TRUNCATE a `anon` o `authenticated`.
 *       DELETE lo frena la RLS, asi que es el segundo cerrojo. TRUNCATE **NO PASA POR RLS**
 *       —las policies son por fila y truncate no mira filas—, asi que ahi es el unico.
 *
 *    2. Que ninguna VISTA sea escribible. Una vista simple en Postgres es actualizable: se
 *       puede insertar y modificar a traves de ella. Una vista es una forma de mirar.
 *
 *    3. Que toda vista lleve `security_invoker = true`. Sin eso corre como su dueño y saltea
 *       la RLS entera, en silencio. Es la trampa que CLAUDE.md marca para toda vista.
 *
 *  QUE **NO** COMPRUEBA, dicho de frente: no prueba las policies. Que una policy diga lo que
 *  tiene que decir se prueba contra la API real con usuarios reales, y eso vive en
 *  `permisos.rls.test.ts`. Este script mira el otro cerrojo, el de los GRANT.
 *
 *  CUANDO CORRERLO: antes de publicar a produccion, y despues de cada migracion que cree
 *  tablas o vistas. Necesita SUPABASE_ACCESS_TOKEN (el `sbp_...` de la cuenta).
 *
 *  SIN TOKEN: en una maquina se saltea avisando —un guardian que rompe el build de quien no tiene
 *  la clave se termina sacando del build— pero EN CI FALLA, porque ahi el token siempre tiene que
 *  estar. Ver `scripts/token.mjs`, que es donde vive esa decision para los tres guardianes que
 *  consultan la base.
 */
import { tokenODecirlo } from "./token.mjs";

const REF = "drsooohkwwpnijonxwwt";

// Sin token: en una máquina se saltea diciéndolo, EN CI FALLA. La razón entera está en `token.mjs`.
const TOKEN = tokenODecirlo("permisos");
if (TOKEN === null) process.exit(0);

/** Corre SQL con el token de cuenta. Es lo que usa el editor SQL del panel. */
async function sql(consulta) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
      "User-Agent": "curl/8.0.1",
    },
    body: JSON.stringify({ query: consulta }),
  });
  if (!r.ok) {
    throw new Error(`La consulta al esquema falló (${r.status}): ${await r.text()}`);
  }
  return r.json();
}

const COMPROBACIONES = [
  {
    nombre: "nadie puede borrar ni vaciar",
    porQue:
      "DELETE lo frena la RLS, pero TRUNCATE no pasa por RLS: ahí el grant es el único cerrojo. " +
      "Y la regla del producto es que nada se borra.",
    consulta: `
      select table_name as objeto, grantee as rol, privilege_type as permiso
        from information_schema.role_table_grants
       where table_schema = 'public'
         and grantee in ('anon','authenticated')
         and privilege_type in ('DELETE','TRUNCATE')
       order by table_name, grantee`,
  },
  {
    nombre: "ninguna vista es escribible",
    porQue: "Una vista es una forma de mirar, nunca una puerta de entrada.",
    consulta: `
      select g.table_name as objeto, g.grantee as rol, g.privilege_type as permiso
        from information_schema.role_table_grants g
        join pg_class c on c.relname = g.table_name
        join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
       where g.table_schema = 'public' and c.relkind = 'v'
         and g.grantee in ('anon','authenticated')
         and g.privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE')
       order by g.table_name`,
  },
  {
    nombre: "toda vista lleva security_invoker",
    porQue: "Sin eso la vista corre como su dueño y saltea la RLS entera, en silencio.",
    consulta: `
      select c.relname as objeto, 'vista' as rol, 'sin security_invoker' as permiso
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'v'
         and coalesce((select option_value from pg_options_to_table(c.reloptions)
                        where option_name = 'security_invoker'), 'false') <> 'true'
       order by c.relname`,
  },
];

// Las tres son independientes entre si: van juntas. El resultado se informa EN ORDEN, que es
// como se lee, aunque las consultas hayan vuelto en cualquier orden.
const resultados = await Promise.all(COMPROBACIONES.map((c) => sql(c.consulta)));

let hubo = false;

COMPROBACIONES.forEach((c, i) => {
  const filas = resultados[i] ?? [];
  if (filas.length === 0) {
    console.log(`OK    ${c.nombre}`);
    return;
  }
  hubo = true;
  console.error(`FALLA ${c.nombre}`);
  console.error(`      ${c.porQue}`);
  for (const f of filas) console.error(`      - ${f.objeto}: ${f.permiso} para ${f.rol}`);
});

if (hubo) {
  console.error("");
  console.error("Se arregla con una migración nueva, no a mano en el panel:");
  console.error("  revoke delete, truncate on public.<objeto> from anon, authenticated;");
  process.exit(1);
}

console.log("permisos: los tres controles en verde.");
