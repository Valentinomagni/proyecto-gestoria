#!/usr/bin/env node
/**
 * Corre oxlint sobre el archivo que se acaba de tocar, y nada mas.
 *
 * ============================================================================
 *  POR QUE SOLO SOBRE ESE ARCHIVO
 * ============================================================================
 *
 * Tiene que tardar menos de un segundo. Un chequeo que corre despues de CADA edicion y tarda
 * cinco segundos convierte una tarea de diez ediciones en una espera de un minuto, y eso se
 * termina apagando.
 *
 * ============================================================================
 *  Y POR QUE NO BLOQUEA
 * ============================================================================
 *
 * Devuelve el resultado como contexto, no como barrera. Una advertencia de lint a mitad de una
 * refactorizacion es normal —el archivo esta a medio escribir— y bloquear ahi seria pelear con
 * el trabajo en vez de ayudarlo.
 *
 * Lo que no se puede es TERMINAR el turno en rojo, y de eso se ocupa al-terminar.mjs.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

/** Lee el JSON que Claude Code manda por stdin. Si no llega nada, no hay nada que revisar. */
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

if (!/\.tsx?$/.test(archivo) || !existsSync(archivo)) process.exit(0);

const raiz = process.env["CLAUDE_PROJECT_DIR"] ?? process.cwd();
const r = spawnSync("npx", ["oxlint", archivo], { cwd: raiz, encoding: "utf8", shell: true });
if (r.status === 0) process.exit(0);

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PostToolUse",
      additionalContext: `oxlint marcó algo en ${archivo}:\n${(r.stdout ?? "").slice(0, 1500)}`,
    },
  }),
);
process.exit(0);
