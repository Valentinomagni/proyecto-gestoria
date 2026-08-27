#!/usr/bin/env node
/**
 * ============================================================================
 *  LA LISTA DE ESTADOS DEL FRONT DICE LO MISMO QUE EL `check` DE LA BASE
 * ============================================================================
 *
 *  ESTE GUARDIAN EXISTE POR ALGO QUE PASO EL 27/08/2026, y vale la pena contarlo entero.
 *
 *  Ese dia la cadena bajo de diez estados a seis. Se aplicaron cuatro migraciones contra la base,
 *  se corrieron las 154 pruebas y las 44 del arnes de permisos: TODO EN VERDE.
 *
 *  Y sin embargo el front habia quedado roto. Seguia ofreciendo `presentado`, `pagado`,
 *  `retirado` y `frenado_por_saldo` en el filtro del listado, y el boton "Marcar como
 *  presentado" mandaba a la base un estado que el `check` ya rechazaba.
 *
 *  El sintoma habria sido el peor de todos: el boton se ve normal, la gestora lo aprieta, y algo
 *  falla con un mensaje que no habla de estados. Nadie relaciona una cosa con la otra.
 *
 *  NINGUNA PRUEBA LO AGARRO. Lo agarro un `grep` a mano, y podria no haberse hecho.
 *
 *  ============================================================================
 *   POR QUE NO ALCANZA CON UNA PRUEBA
 *  ============================================================================
 *
 *  Una prueba comprueba lo que alguien se acordo de comprobar. Este defecto no es que un estado
 *  este mal: es que DOS LISTAS EN DOS LENGUAJES DISTINTOS tienen que decir lo mismo, y no hay
 *  nada que las obligue. La proxima vez que la cadena cambie —y va a cambiar— el mismo hueco se
 *  abre de nuevo.
 *
 *  Lo que hay que comprobar no es el contenido de la lista: es que las dos coincidan.
 *
 *  ============================================================================
 *   POR QUE LEE EL ARCHIVO CON UNA EXPRESION REGULAR Y NO LO IMPORTA
 *  ============================================================================
 *
 *  `Listado.tsx` importa React, Tailwind y media app. Importarlo desde un script suelto pedria
 *  todo ese arbol y fallaria por razones que no tienen nada que ver con lo que se quiere mirar.
 *
 *  Leer el texto es mas grosero y es mas robusto: si alguien reescribe la constante de una forma
 *  que este guardian no entiende, no encuentra nada y LO DICE — sale con error en vez de dar por
 *  bueno un silencio. Un guardian que no encuentra lo que busca no esta en verde: esta ciego.
 */
import { readFileSync } from "node:fs";

const ARCHIVO = "src/features/tramites/Listado.tsx";
const REF = "drsooohkwwpnijonxwwt";

let env = {};
try {
  env = Object.fromEntries(
    readFileSync(".env.local", "utf8")
      .split("\n")
      .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
      .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
  );
} catch {
  // Sin .env.local no se puede consultar nada. Se dice abajo y se sale.
}

const token = env["SUPABASE_ACCESS_TOKEN"] ?? process.env["SUPABASE_ACCESS_TOKEN"];
if (!token) {
  // Se saltea, pero lo dice. Sale con 0: en un repo recien clonado, sin token, el primer commit
  // no deberia fallar por esto.
  console.error("estados: sin SUPABASE_ACCESS_TOKEN no se puede consultar el check. Se saltea.");
  process.exit(0);
}

// ------------------------------------------------------------
// 1) Lo que dice el front
// ------------------------------------------------------------

const fuente = readFileSync(ARCHIVO, "utf8");
const bloque = /export const ESTADOS[^=]*=\s*\[([\s\S]*?)\];/.exec(fuente);

if (bloque === null) {
  console.error(`\n  No encontre la constante ESTADOS en ${ARCHIVO}.`);
  console.error("  Si se renombro o se movio, actualiza este guardian. Un guardian que no");
  console.error("  encuentra lo que busca no esta en verde: esta ciego.\n");
  process.exit(1);
}

const enElFront = [...bloque[1].matchAll(/valor:\s*"([^"]+)"/g)].map((m) => m[1]);

if (enElFront.length === 0) {
  console.error(`\n  La constante ESTADOS de ${ARCHIVO} quedo vacia, o cambio de forma.\n`);
  process.exit(1);
}

// ------------------------------------------------------------
// 2) Lo que dice la base
// ------------------------------------------------------------

const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    query: `select pg_get_constraintdef(oid) as def from pg_constraint
             where conrelid = 'public.tramites'::regclass and conname = 'tramites_estado_valido'`,
  }),
});

const cuerpo = await r.json();
if (!r.ok) {
  console.error("estados: no se pudo consultar la base:", cuerpo.message ?? JSON.stringify(cuerpo));
  process.exit(1);
}

const definicion = cuerpo[0]?.def;
if (definicion === undefined) {
  console.error("\n  No existe el check `tramites_estado_valido` en la base.");
  console.error("  Sin ese check, la columna `estado` acepta CUALQUIER texto.\n");
  process.exit(1);
}

const enLaBase = [...definicion.matchAll(/'([a-z_]+)'::text/g)].map((m) => m[1]);

// ------------------------------------------------------------
// 3) Y tienen que decir lo mismo
// ------------------------------------------------------------

const soloEnElFront = enElFront.filter((e) => !enLaBase.includes(e));
const soloEnLaBase = enLaBase.filter((e) => !enElFront.includes(e));

if (soloEnElFront.length === 0 && soloEnLaBase.length === 0) {
  console.log(`estados: los ${enElFront.length} del front y los de la base coinciden.`);
  process.exit(0);
}

console.error("\n  La lista de estados del front NO coincide con el check de la base:\n");

if (soloEnElFront.length > 0) {
  console.error(`  Estan en ${ARCHIVO} y la base los RECHAZA:`);
  for (const e of soloEnElFront) console.error(`      ${e}`);
  console.error("");
  console.error("      Es el caso grave: la pantalla ofrece un boton que va a fallar, con un");
  console.error("      mensaje que no habla de estados. Paso el 27/08/2026.");
  console.error("");
}

if (soloEnLaBase.length > 0) {
  console.error("  La base los acepta y el front no los nombra:");
  for (const e of soloEnLaBase) console.error(`      ${e}`);
  console.error("");
  console.error("      Menos grave, pero un tramite que caiga en uno de esos se muestra con su");
  console.error("      codigo interno crudo, y el filtro no lo puede encontrar.");
  console.error("");
}

process.exit(1);
