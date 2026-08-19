#!/usr/bin/env node
// ============================================================================
//  Revisa que ninguna migracion sea vacia o puro comentario.
//
//  POR QUE EXISTE, y salio de un incidente real del 19/08/2026:
//
//  `supabase migration new gestora_coherente` creo el archivo, el comando que iba a escribirlo
//  se colgo, y quedo un archivo de CERO BYTES. El push posterior lo aplico sin error y
//  REGISTRO LA VERSION COMO APLICADA. El CLI decia "up to date" y el esquema no habia cambiado:
//  el constraint que se suponia aplicado no existia, y el agujero que cerraba seguia abierto.
//
//  Es la misma forma exacta del chip del Tablero que decia "Base de datos al dia" mientras
//  nueve migraciones seguian sin mirarse: el REGISTRO se cree y la REALIDAD no se comprueba.
//
//  Se descubrio porque se probo que el constraint bloqueara, en vez de confiar en el "Finished"
//  del comando. Este script convierte esa suerte en un chequeo que corre solo.
//
//  LO QUE ESTE SCRIPT NO HACE, dicho para que nadie lo suponga: no comprueba que el SQL sea
//  correcto ni que haga lo que dice. Solo garantiza que HAYA SQL. La comprobacion de que una
//  migracion hizo lo que promete sigue siendo el bloque "COMO COMPROBAR QUE QUEDO BIEN" que
//  cada archivo trae adentro, y correrlo.
// ============================================================================

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const CARPETA = "supabase/migrations";

/** Saca comentarios de linea, de bloque, y el espacio en blanco. Lo que queda, es SQL. */
function sqlEfectivo(texto) {
  return texto
    .replaceAll(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((l) => l.replace(/--.*$/, "").trim())
    .join("")
    .trim();
}

let archivos;
try {
  archivos = readdirSync(CARPETA).filter((a) => a.endsWith(".sql"));
} catch {
  // Todavia no hay carpeta de migraciones. No es un error.
  process.exit(0);
}

const hallazgos = [];

for (const archivo of archivos) {
  const ruta = join(CARPETA, archivo);
  const texto = readFileSync(ruta, "utf8");

  if (texto.trim() === "") {
    hallazgos.push(`${ruta}  ->  esta VACIO (${texto.length} bytes)`);
    continue;
  }

  const sql = sqlEfectivo(texto);
  if (sql === "") {
    hallazgos.push(`${ruta}  ->  no tiene ni una sentencia: es todo comentario`);
    continue;
  }

  // Un archivo con comentarios y una sola sentencia es legitimo; uno sin punto y coma casi
  // seguro quedo cortado a la mitad, que es como se veria el mismo incidente con otra forma.
  if (!sql.includes(";")) {
    hallazgos.push(`${ruta}  ->  no termina ninguna sentencia con ';': parece cortado`);
  }
}

if (hallazgos.length === 0) {
  process.exit(0);
}

console.error("");
console.error("  Hay migraciones que no van a hacer nada:");
console.error("");
for (const h of hallazgos) console.error(`  ${h}`);
console.error("");
console.error("  Una migracion vacia se aplica sin error y queda registrada como exitosa.");
console.error("  El CLI va a decir 'up to date' y el esquema no va a haber cambiado.");
console.error("");
process.exit(1);
