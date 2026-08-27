#!/usr/bin/env node
/**
 * ============================================================================
 *  NINGUN COLOR ESCRITO A MANO FUERA DE index.css
 * ============================================================================
 *
 *  `src/index.css` es el unico origen de verdad del color. Todo lo demas usa tokens:
 *  `text-ink`, `bg-surface`, `border-line`, `text-danger`.
 *
 *  ============================================================================
 *   POR QUE HACE FALTA AHORA Y NO ANTES
 *  ============================================================================
 *
 *  Hasta hoy la app era monocroma, y un color escrito a mano se notaba enseguida. Con la paleta
 *  teal de Habitualista entrando en el marco, un `bg-cyan-700` suelto se va a ver "casi bien" — y
 *  eso es peor, porque nadie lo corrige.
 *
 *  Es el mismo mecanismo que `tipografia.guard.test.ts`: la regla que no tiene guardian se
 *  incumple sola. En el Tablero Contable esa fractura dejo 571 tamanios de letra escritos a mano
 *  en 20 valores distintos, decimales incluidos.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/** Las familias de color que trae Tailwind y que este proyecto NO usa: usa sus tokens. */
const FAMILIAS = [
  "slate",
  "gray",
  "zinc",
  "neutral",
  "stone",
  "red",
  "orange",
  "amber",
  "yellow",
  "lime",
  "green",
  "emerald",
  "teal",
  "cyan",
  "sky",
  "blue",
  "indigo",
  "violet",
  "purple",
  "fuchsia",
  "pink",
  "rose",
];

/*
  OJO CON EL ESCAPADO. Esto es un template literal, no un literal de expresion regular: adentro
  de comillas invertidas una barra-b es un caracter de retroceso y una barra-d es una `d` a
  secas. Van DOBLES para que lleguen enteras a `new RegExp`.

  Es el error mas facil de cometer en este archivo, y el sintoma es el peor de todos: el guardian
  corre, no encuentra nada, y parece que esta todo bien.
*/
const CLASE_DE_TAILWIND = new RegExp(
  `\\b(?:text|bg|border|ring|fill|stroke|from|via|to|shadow|decoration|outline|accent|caret|divide|placeholder)-(?:${FAMILIAS.join("|")})-\\d{2,3}\\b`,
  "g",
);

/** Un literal de expresion regular: aca el escapado es simple. */
const COLOR_A_MANO = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(|\boklch\(/g;

function archivos(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return archivos(p);
    return /\.tsx?$/.test(p) ? [p] : [];
  });
}

/**
 * Vacia las lineas que son comentario, conservando la numeracion.
 *
 * ============================================================================
 *  POR QUE HACE FALTA, Y LO ENCONTRO EL PROPIO GUARDIAN
 * ============================================================================
 *
 * La primera version marcaba `src/components/Panel.tsx:15`, que dice:
 *
 *     --ring-sh  es una SOMBRA  -> `0 0 0 1px rgba(...)`.
 *
 * Eso NO es un color: es la documentacion de la trampa de `--ring` contra `--ring-sh`, que en el
 * Tablero Contable dejo cinco pantallas sin sombra durante meses. Marcarla obligaria a borrar
 * justamente el comentario que evita que el error vuelva.
 *
 * Un guardian que marca la documentacion es un guardian que se apaga.
 *
 * SE VACIAN LAS LINEAS EN VEZ DE SACARLAS para que el numero de linea del hallazgo siga siendo
 * el del archivo real. Un guardian que reporta la linea equivocada hace perder mas tiempo del
 * que ahorra.
 */
function sinComentarios(texto) {
  let enBloque = false;
  return texto.split("\n").map((linea) => {
    const limpia = linea.trim();

    if (enBloque) {
      if (limpia.includes("*/")) {
        enBloque = false;
        // Lo que venga DESPUES del cierre sigue siendo codigo y hay que mirarlo.
        return linea.slice(linea.indexOf("*/") + 2);
      }
      return "";
    }

    if (limpia.startsWith("//")) return "";

    const abre = linea.indexOf("/*");
    if (abre !== -1) {
      const cierra = linea.indexOf("*/", abre + 2);
      if (cierra === -1) {
        enBloque = true;
        return linea.slice(0, abre);
      }
      return linea.slice(0, abre) + linea.slice(cierra + 2);
    }

    return linea;
  });
}

const malos = [];
for (const p of archivos("src")) {
  // Los tests y los guardianes no se revisan: ahi un color literal ES el dato que se prueba.
  if (p.includes(".test.") || p.includes(".guard.")) continue;

  sinComentarios(readFileSync(p, "utf8")).forEach((linea, i) => {
    for (const m of linea.matchAll(CLASE_DE_TAILWIND)) {
      malos.push(`  ${p}:${i + 1}  ${m[0]}   -> usa un token: text-ink, bg-surface, text-danger`);
    }
    for (const m of linea.matchAll(COLOR_A_MANO)) {
      malos.push(`  ${p}:${i + 1}  ${m[0]}   -> el color va en src/index.css, no acá`);
    }
  });
}

if (malos.length === 0) {
  console.log("colores: ningun color escrito a mano fuera de index.css.");
  process.exit(0);
}

console.error("\n  Hay colores escritos a mano fuera de src/index.css:\n");
console.error(malos.slice(0, 40).join("\n"));
if (malos.length > 40) console.error(`\n  ...y ${malos.length - 40} mas.`);
console.error("\n  El color vive en un solo archivo. Si falta un token, agregalo ahi.\n");
process.exit(1);
