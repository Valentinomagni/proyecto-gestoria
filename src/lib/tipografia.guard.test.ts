import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * GUARDIAN DE TIPOGRAFIA — R30
 *
 * POR QUE EXISTE, con el numero medido: en el Tablero Contable habia 571 tamanos de letra
 * escritos a mano en 20 valores distintos, decimales incluidos (11.5px, 12.5px, 13.5px). Eso
 * es lo que hace que una app se vea armada de a pedazos aunque cada pantalla por separado
 * este bien.
 *
 * ALCANCE, declarado: revisa las clases de TAMANO de texto en los .tsx de src/. No revisa
 * color, ni peso, ni CSS suelto en archivos .css. Un guardian angosto que dice que cubre es
 * honesto; uno que finge cubrir todo aparenta una cobertura que no existe.
 *
 * SI FALTA UN TAMANO, SE AGREGA A LA ESCALA en src/index.css. Nunca se escribe a mano. Esa
 * es exactamente la conversacion que este test fuerza a tener.
 */

const ESCALA = new Set(["2xs", "xs", "sm", "base", "lg", "xl", "2xl", "3xl", "4xl"]);

/** `text-[13px]`, `text-[1.2rem]`, `text-[#fff]`: cualquier valor arbitrario. */
const ARBITRARIO = /\btext-\[[^\]]+\]/g;

/**
 * `text-5xl`, `text-7xl`: pasos que no existen en la escala.
 * No matchea `text-ink` ni `text-danger`, que son clases de COLOR: el patron exige que
 * termine en `xs`, `sm`, `base`, `lg` o `Nxl`.
 */
const TAMANO = /\btext-(\d*x?[sl]|base|xs|sm|lg)\b/g;

function archivosTsx(dir: string): string[] {
  const salida: string[] = [];
  for (const entrada of readdirSync(dir)) {
    const ruta = join(dir, entrada);
    if (statSync(ruta).isDirectory()) {
      salida.push(...archivosTsx(ruta));
    } else if (entrada.endsWith(".tsx") && !entrada.includes(".test.")) {
      salida.push(ruta);
    }
  }
  return salida;
}

describe("guardian de tipografia", () => {
  const archivos = archivosTsx("src");

  it("ningun tamano de texto arbitrario, del tipo text-[13px]", () => {
    const hallazgos: string[] = [];
    for (const archivo of archivos) {
      const lineas = readFileSync(archivo, "utf8").split("\n");
      lineas.forEach((linea, i) => {
        for (const m of linea.matchAll(ARBITRARIO)) {
          hallazgos.push(`${archivo}:${i + 1}  ${m[0]}`);
        }
      });
    }
    expect(
      hallazgos,
      `Tamano de texto escrito a mano. Si falta un paso, agregalo a la escala de src/index.css:\n${hallazgos.join("\n")}`,
    ).toEqual([]);
  });

  it("todo tamano de texto sale de la escala de nueve pasos", () => {
    const hallazgos: string[] = [];
    for (const archivo of archivos) {
      const lineas = readFileSync(archivo, "utf8").split("\n");
      lineas.forEach((linea, i) => {
        for (const m of linea.matchAll(TAMANO)) {
          const paso = m[1];
          if (paso && !ESCALA.has(paso)) {
            hallazgos.push(`${archivo}:${i + 1}  text-${paso}`);
          }
        }
      });
    }
    expect(
      hallazgos,
      `Tamano fuera de la escala (2xs xs sm base lg xl 2xl 3xl 4xl):\n${hallazgos.join("\n")}`,
    ).toEqual([]);
  });

  it("el propio patron distingue tamano de color", () => {
    // Este caso existe porque un guardian que marca texto correcto se desactiva a la semana,
    // y con el se va la proteccion real. `text-ink` y `text-danger` son colores y tienen que
    // pasar; `text-5xl` es un tamano fuera de escala y tiene que fallar.
    expect([...`text-ink text-ink2 text-danger text-side-ink`.matchAll(TAMANO)]).toEqual([]);
    expect([...`text-5xl`.matchAll(TAMANO)].map((m) => m[1])).toEqual(["5xl"]);
    expect([...`text-sm text-base text-4xl`.matchAll(TAMANO)].map((m) => m[1])).toEqual([
      "sm",
      "base",
      "4xl",
    ]);
  });
});
