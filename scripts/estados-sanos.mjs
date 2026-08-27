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
 *   MIRA DOS ARCHIVOS, Y LA PRIMERA VERSION MIRABA UNO SOLO
 *  ============================================================================
 *
 *  La primera version leia unicamente `Listado.tsx`, la lista del filtro. Una revision lo agarro
 *  el mismo dia: EL BOTON ROTO NO VIVIA AHI. Vivia en `SIGUIENTE`, adentro de `Ficha.tsx`, que
 *  es la que dice a que estado manda cada boton.
 *
 *  O sea que el guardian escrito para que el defecto no volviera no cubria el archivo donde el
 *  defecto habia pasado. Estaba en verde mientras `Ficha.tsx` seguia nombrando estados muertos.
 *
 *  Y `Ficha.tsx` tenia escrito, textual: "Esta lista y `tramites_estado_valido` se mueven
 *  juntas". No se movian juntas: no habia nada que las atara. Un comentario que describe una
 *  proteccion inexistente es peor que no tener el comentario, porque el que lo lee deja de mirar.
 *
 *  ============================================================================
 *   POR QUE LEE LOS ARCHIVOS CON UNA EXPRESION REGULAR Y NO LOS IMPORTA
 *  ============================================================================
 *
 *  Los dos importan React, Tailwind y media app. Importarlos desde un script suelto pediria todo
 *  ese arbol y fallaria por razones que no tienen nada que ver con lo que se quiere mirar.
 *
 *  Leer el texto es mas grosero y es mas robusto: si alguien reescribe una constante de una forma
 *  que este guardian no entiende, no encuentra nada y LO DICE — sale con error en vez de dar por
 *  bueno un silencio. Un guardian que no encuentra lo que busca no esta en verde: esta ciego.
 */
import { readFileSync } from "node:fs";

/**
 * Las dos listas del front, con como se saca cada una.
 *
 * `ESTADOS` son los valores del filtro del listado: los que se pueden ELEGIR.
 * `SIGUIENTE` son los estados a los que manda cada boton: los que se pueden ESCRIBIR.
 *
 * La segunda es la peligrosa. Un valor de mas en el filtro devuelve una lista vacia; un valor de
 * mas en `SIGUIENTE` es un boton que falla al apretarlo.
 */
const LISTAS = [
  {
    archivo: "src/features/tramites/Listado.tsx",
    constante: "ESTADOS",
    bloque: /export const ESTADOS[^=]*=\s*\[([\s\S]*?)\];/,
    valores: /valor:\s*"([^"]+)"/g,
  },
  {
    archivo: "src/features/tramites/Ficha.tsx",
    constante: "SIGUIENTE",
    // `SIGUIENTE` es un objeto y no un arreglo, y sus claves TAMBIEN son estados: son el estado
    // desde el que sale cada paso. Se miran las dos cosas, claves y destinos.
    bloque: /const SIGUIENTE[\s\S]*?=\s*\{([\s\S]*?)\n\};/,
    valores: /(?:^\s{2}([a-z_]+):|estado:\s*"([^"]+)")/gm,
  },
];

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

/** Cada entrada queda como { estado, archivo, constante } para poder decir DONDE esta el problema. */
const enElFront = [];

for (const lista of LISTAS) {
  const bloque = lista.bloque.exec(readFileSync(lista.archivo, "utf8"));

  if (bloque === null) {
    console.error(`\n  No encontre la constante ${lista.constante} en ${lista.archivo}.`);
    console.error("  Si se renombro o se movio, actualiza este guardian. Un guardian que no");
    console.error("  encuentra lo que busca no esta en verde: esta ciego.\n");
    process.exit(1);
  }

  const valores = [...bloque[1].matchAll(lista.valores)]
    .map((m) => m[1] ?? m[2])
    .filter((v) => v !== undefined);

  if (valores.length === 0) {
    console.error(
      `\n  La constante ${lista.constante} de ${lista.archivo} quedo vacia, o cambio de forma.\n`,
    );
    process.exit(1);
  }

  for (const estado of valores) {
    enElFront.push({ estado, archivo: lista.archivo, constante: lista.constante });
  }
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

const soloEnElFront = enElFront.filter((e) => !enLaBase.includes(e.estado));

const nombrados = new Set(enElFront.map((e) => e.estado));
const soloEnLaBase = enLaBase.filter((e) => !nombrados.has(e));

if (soloEnElFront.length === 0 && soloEnLaBase.length === 0) {
  const cuantas = LISTAS.map((l) => l.constante).join(" y ");
  console.log(
    `estados: ${nombrados.size} estados en ${cuantas}, y coinciden con el check de la base.`,
  );
  process.exit(0);
}

console.error("\n  Las listas de estados del front NO coinciden con el check de la base:\n");

if (soloEnElFront.length > 0) {
  console.error("  Los nombra el front y LA BASE LOS RECHAZA:");
  for (const e of soloEnElFront) {
    console.error(`      ${e.estado}   en ${e.archivo}, dentro de ${e.constante}`);
  }
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
