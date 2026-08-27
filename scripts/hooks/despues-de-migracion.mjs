#!/usr/bin/env node
/**
 * ============================================================================
 *  EL HOOK QUE MATA LA MIGRACION VACIA
 * ============================================================================
 *
 *  Ese error paso DE VERDAD el 19/08/2026: `supabase migration new` creo el archivo, el comando
 *  que iba a escribirlo se colgo, y se empujaron cero bytes. El CLI dijo "up to date" y el
 *  esquema no habia cambiado. El constraint que se daba por aplicado no existia.
 *
 *  Y volvio a pasar el 21/08/2026, con cuatro archivos de golpe: el primer comando fallo por un
 *  grep mal escrito, se leyo como que no habia creado nada, y se crearon cuatro mas al lado de
 *  los cuatro vacios que ya estaban.
 *
 *  Dos veces la misma forma. Por eso deja de depender de que alguien corra `npm run migraciones`
 *  y pasa a correr solo cada vez que se escribe un .sql en migrations.
 *
 *  ESTE SI BLOQUEA, a diferencia del de lint: una migracion vacia no es un archivo a medio
 *  escribir que despues se completa, es un archivo que el CLI va a dar por aplicado.
 */
import { spawnSync } from "node:child_process";

async function leerEntrada() {
  return new Promise((listo) => {
    let texto = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (c) => (texto += c));
    process.stdin.on("end", () => listo(texto));
    process.stdin.on("error", () => listo(""));
  });
}

const entrada = await leerEntrada();

let archivo = "";
try {
  archivo = JSON.parse(entrada)?.tool_input?.file_path ?? "";
} catch {
  process.exit(0);
}

// Las barras invertidas de Windows se normalizan: el mismo archivo llega escrito de las dos
// formas segun quien lo mande, y una comparacion literal fallaria en silencio.
if (!archivo.replace(/\\/g, "/").includes("supabase/migrations/")) process.exit(0);

const raiz = process.env["CLAUDE_PROJECT_DIR"] ?? process.cwd();
const r = spawnSync("node", ["scripts/migraciones-sanas.mjs"], {
  cwd: raiz,
  encoding: "utf8",
  shell: true,
});
if (r.status === 0) process.exit(0);

console.error(`Hay una migración que no va a hacer nada:\n${(r.stdout ?? "") + (r.stderr ?? "")}`);
process.exit(2);
