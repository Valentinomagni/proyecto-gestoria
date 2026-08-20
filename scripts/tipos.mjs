#!/usr/bin/env node
// ============================================================================
//  Genera src/lib/database.types.ts desde el esquema real de la base.
//
//  POR QUE NO ES UN REDIRECT SUELTO EN package.json, que es lo primero que escribi:
//  `supabase gen types ... > archivo` escribe la salida PASE LO QUE PASE. Cuando el comando
//  falla —un flag mal escrito, la red caida, el token vencido— el mensaje de error termina
//  ADENTRO del archivo de tipos, TypeScript explota con un error que no tiene nada que ver, y
//  se busca el problema en el lugar equivocado. Ya paso, con este mismo comando.
//
//  Aca se genera a memoria, se comprueba el codigo de salida Y que el contenido tenga forma de
//  tipos, y recien entonces se escribe el archivo.
// ============================================================================

import { execFileSync } from "node:child_process";
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { execPath } from "node:process";

const REF = "drsooohkwwpnijonxwwt";
const DESTINO = "src/lib/database.types.ts";
const DESTINO_TABLAS = "src/lib/tablas.generado.ts";
const soloVerificar = process.argv.includes("--verificar");

/**
 * Los nombres de las tablas, sacados de los tipos, PARA USAR EN TIEMPO DE EJECUCION.
 *
 * POR QUE HACE FALTA UN SEGUNDO ARCHIVO. Los tipos de TypeScript se borran al compilar: el
 * respaldo no puede recorrer `Database["public"]["Tables"]` cuando corre en el navegador,
 * porque ahi ya no existe. Y una lista escrita a mano es exactamente el defecto del Tablero
 * Contable, donde el respaldo recorre siete nombres a mano y ya se le escapa una tabla.
 *
 * Entonces la lista se GENERA junto con los tipos, del mismo lugar y en el mismo comando. Una
 * tabla nueva entra sola; no hay forma de agregar una y olvidarse de esta lista, porque nadie
 * la escribe.
 */
function tablasDe(tipos) {
  const bloque = tipos.match(/Tables: \{([\s\S]*?)\n {4}\}\n {4}Views:/);
  if (!bloque) return null;
  const nombres = [...bloque[1].matchAll(/^ {6}(\w+): \{$/gm)].map((m) => m[1]);
  return nombres.length > 0 ? nombres.toSorted() : null;
}

function archivoDeTablas(nombres) {
  return `// GENERADO por scripts/tipos.mjs desde el esquema real. No editar a mano.
//
// Existe porque los tipos de TypeScript se borran al compilar y el respaldo necesita la lista
// CUANDO CORRE. Se regenera con \`npm run db:tipos\`, junto con los tipos.

export const TABLAS: readonly string[] = [
${nombres.map((n) => `  "${n}",`).join("\n")}
];
`;
}

let salida;
try {
  // Se invoca el .js del CLI con el propio node, y NO el atajo `supabase.cmd`: desde Node 20,
  // spawn de un .cmd sin shell falla con EINVAL en Windows, y con shell habria que preocuparse
  // por el entrecomillado. Esto no tiene ninguno de los dos problemas.
  salida = execFileSync(
    execPath,
    ["node_modules/supabase/dist/supabase.js", "gen", "types", "typescript",
     "--project-id", REF, "--schema", "public"],
    { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
  );
} catch (e) {
  console.error("No se pudieron generar los tipos. El archivo NO se toco.");
  console.error(String(e.stderr || e.message).slice(0, 500));
  process.exit(1);
}

if (!salida.includes("export type Database")) {
  console.error("La salida no tiene forma de tipos. El archivo NO se toco.");
  console.error(salida.slice(0, 300));
  process.exit(1);
}

const tablas = tablasDe(salida);
if (!tablas) {
  console.error("No se pudo sacar la lista de tablas de los tipos. NO se toco ningun archivo.");
  console.error("Cambio el formato que genera el CLI: hay que ajustar tablasDe() en este script.");
  process.exit(1);
}
const listado = archivoDeTablas(tablas);

if (soloVerificar) {
  const enDisco = existsSync(DESTINO) ? readFileSync(DESTINO, "utf8") : "";
  if (enDisco.trim() !== salida.trim()) {
    console.error("Los tipos estan desactualizados contra la base. Corre: npm run db:tipos");
    process.exit(1);
  }
  const listaEnDisco = existsSync(DESTINO_TABLAS) ? readFileSync(DESTINO_TABLAS, "utf8") : "";
  if (listaEnDisco.trim() !== listado.trim()) {
    console.error("La lista de tablas del respaldo esta desactualizada. Corre: npm run db:tipos");
    process.exit(1);
  }
  console.log("Los tipos y la lista de tablas estan al dia.");
  process.exit(0);
}

writeFileSync(DESTINO, salida);
writeFileSync(DESTINO_TABLAS, listado);
console.log(`Tipos generados en ${DESTINO} (${salida.split("\n").length} lineas).`);
console.log(`Lista de tablas en ${DESTINO_TABLAS} (${tablas.length} tablas).`);
