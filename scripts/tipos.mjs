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
const soloVerificar = process.argv.includes("--verificar");

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

if (soloVerificar) {
  const enDisco = existsSync(DESTINO) ? readFileSync(DESTINO, "utf8") : "";
  if (enDisco.trim() !== salida.trim()) {
    console.error("Los tipos estan desactualizados contra la base. Corre: npm run db:tipos");
    process.exit(1);
  }
  console.log("Los tipos estan al dia.");
  process.exit(0);
}

writeFileSync(DESTINO, salida);
console.log(`Tipos generados en ${DESTINO} (${salida.split("\n").length} lineas).`);
