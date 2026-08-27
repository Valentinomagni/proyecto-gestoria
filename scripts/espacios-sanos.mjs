#!/usr/bin/env node
/**
 * ============================================================================
 *  SEIS PASOS DE ESPACIO, Y NINGUNO MAS
 * ============================================================================
 *
 *  Una app se ve barata cuando los espacios no tienen ritmo, y eso se nota aunque nadie sepa
 *  nombrarlo. Hoy conviven `gap-2`, `gap-3`, `gap-4`, `p-6`, `mt-1`, `mb-2`, `py-1` y `py-2` sin
 *  criterio.
 *
 *  La escala es de 4 px: 1, 2, 3, 4, 6 y 8 en unidades de Tailwind — o sea 4, 8, 12, 16, 24 y 32
 *  pixeles.
 *
 *  Es el mismo mecanismo que `tipografia.guard.test.ts`: la regla que no tiene guardian se
 *  incumple sola, y esta semana hay tres pruebas de eso.
 *
 *  ============================================================================
 *   HOY ESTA EN ROJO A PROPOSITO Y NO ESTA EN EL PRE-COMMIT
 *  ============================================================================
 *
 *  El front actual no sigue esta escala, y se rehace entero en el Plan B: arreglar `Listado.tsx`
 *  hoy seria trabajo que se tira. Se conecta al pre-commit cuando el front se rehaga.
 *
 *  Mientras tanto sirve como MEDIDA de cuanto falta, que es mas util que un cero.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/** 1, 2, 3, 4, 6, 8 -> 4, 8, 12, 16, 24 y 32 pixeles. Mas `0`, `px`, `auto` y `full`. */
const PERMITIDOS = new Set(["0", "px", "1", "2", "3", "4", "6", "8", "auto", "full"]);

const CLASE = /\b(?:gap|gap-x|gap-y|p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|space-x|space-y)-([\w.[\]-]+)/g;

function archivos(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return archivos(p);
    return p.endsWith(".tsx") ? [p] : [];
  });
}

const malos = [];
const porArchivo = new Map();

for (const p of archivos("src")) {
  readFileSync(p, "utf8")
    .split("\n")
    .forEach((linea, i) => {
      for (const m of linea.matchAll(CLASE)) {
        const valor = m[1];
        if (PERMITIDOS.has(valor)) continue;
        // Un valor arbitrario entre corchetes se permite SI lleva su porque en la misma linea.
        if (valor.startsWith("[") && linea.includes("//")) continue;
        malos.push(`  ${p}:${i + 1}  ${m[0]}`);
        porArchivo.set(p, (porArchivo.get(p) ?? 0) + 1);
      }
    });
}

if (malos.length === 0) {
  console.log("espacios: todos dentro de la escala de seis pasos.");
  process.exit(0);
}

console.error(`\n  Hay ${malos.length} espacios fuera de la escala (4, 8, 12, 16, 24, 32 px):\n`);
console.error(malos.slice(0, 30).join("\n"));
if (malos.length > 30) console.error(`\n  ...y ${malos.length - 30} mas.`);

console.error("\n  Por archivo:");
for (const [a, n] of [...porArchivo].toSorted((x, y) => y[1] - x[1]).slice(0, 10)) {
  console.error(`    ${String(n).padStart(3)}  ${a}`);
}

console.error("\n  Usa 1, 2, 3, 4, 6 u 8. Un valor arbitrario necesita un comentario que lo explique.\n");
process.exit(1);
