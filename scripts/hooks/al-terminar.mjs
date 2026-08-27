#!/usr/bin/env node
/**
 * ============================================================================
 *  EL HOOK QUE NO DEJA TERMINAR EL TURNO CON ALGO ROTO
 * ============================================================================
 *
 *  Es la pieza mas importante de todo el andamio, y la razon esta escrita en el CLAUDE.md como
 *  pregunta de disenio: "¿puede la base hacerlo imposible, en vez de que el front lo pida por
 *  favor?". Esa pregunta nunca se le habia aplicado al PROCESO de trabajo.
 *
 *  El CLAUDE.md dice "los cuatro comandos en 0, siempre". Eso es un consejo: depende de que
 *  alguien se acuerde. Este hook lo vuelve una barrera: sale con codigo 2 y el turno no termina.
 *
 *  ============================================================================
 *   QUE CORRE Y QUE NO
 *  ============================================================================
 *
 *  Corre tipos, lint y tests, que tardan segundos. NO corre `build` (veinte segundos) ni las
 *  pruebas de permisos (necesitan red y una base remota).
 *
 *  Un gate que duele se termina salteando con --no-verify, y ahi deja de proteger. Es la misma
 *  leccion que ya esta escrita arriba del pre-commit de este proyecto, donde dice que en el
 *  Tablero Contable el hook tardaba de 90 a 180 segundos y por eso habia que avisar de pasarle
 *  un timeout de 420000 ms a la herramienta que llamaba a git commit.
 *
 *  ============================================================================
 *   FALLA ABIERTO ANTE UN PROBLEMA DE INFRAESTRUCTURA
 *  ============================================================================
 *
 *  Si no hay node_modules, no bloquea: avisa y deja pasar. Bloquear por algo que no es un
 *  defecto del codigo es como se llega a que alguien apague el hook entero — y un hook apagado
 *  no protege de nada.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const raiz = process.env["CLAUDE_PROJECT_DIR"] ?? process.cwd();

if (!existsSync(`${raiz}/node_modules`)) {
  console.error("al-terminar: sin node_modules, se saltean los chequeos");
  process.exit(0);
}

const CHEQUEOS = [
  { nombre: "tipos", cmd: "npx", args: ["tsc", "-b"] },
  { nombre: "lint", cmd: "npx", args: ["oxlint"] },
  { nombre: "tests", cmd: "npx", args: ["vitest", "run"] },
];

const fallados = [];
for (const c of CHEQUEOS) {
  const r = spawnSync(c.cmd, c.args, { cwd: raiz, encoding: "utf8", shell: true });
  if (r.status !== 0) {
    fallados.push(`${c.nombre}:\n${(r.stdout ?? "") + (r.stderr ?? "")}`.slice(0, 3000));
  }
}

if (fallados.length === 0) process.exit(0);

// Codigo 2 = bloquea el fin del turno. Lo que va a stderr es lo que se lee para arreglarlo.
console.error(
  `El turno no puede terminar: ${fallados.length} chequeo(s) en rojo.\n\n${fallados.join("\n\n")}`,
);
process.exit(2);
