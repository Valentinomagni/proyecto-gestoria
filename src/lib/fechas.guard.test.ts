import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * GUARDIAN DE FECHAS.
 *
 * ESTE ES EL ARCHIVO QUE FALTABA EN EL TABLERO. Allá existe el helper de zona horaria y aun así
 * las fechas fallaron TRES veces, siempre por lo mismo: nada impedía escribir
 * `new Date().getMonth()` en otro archivo. El Tablón archivaba vencimientos tres horas antes y
 * el chip "Venció" usaba la zona del navegador.
 *
 * La lección no es "cuidado con las fechas": es que un módulo correcto no protege si se puede
 * esquivar. El guardián es la protección, no el módulo.
 *
 * ALCANCE, declarado: prohíbe leer componentes de un Date y formatear fechas fuera de
 * `fechas.ts`. NO prohíbe construir un Date —`new Date(iso)` es necesario en todos lados— ni
 * revisa SQL.
 */

const DUENIO = "src/lib/fechas.ts";

const PROHIBIDO: { patron: RegExp; motivo: string }[] = [
  {
    patron: /\.get(FullYear|Month|Date|Day|Hours|Minutes)\s*\(/,
    motivo: "lee el componente en la zona del navegador, no en la argentina",
  },
  {
    patron: /\.toISOString\s*\(\s*\)\s*\.slice/,
    motivo: "recorta el ISO en UTC: a la madrugada devuelve el día equivocado",
  },
  {
    patron: /\.toLocale(Date|Time)?String\s*\(/,
    motivo: "usa el idioma y la zona del navegador, que no son los de la empresa",
  },
  {
    patron: /new\s+Intl\.DateTimeFormat/,
    motivo: "el formato de fechas vive en un solo lugar",
  },
];

function archivos(dir: string): string[] {
  const salida: string[] = [];
  for (const entrada of readdirSync(dir)) {
    const ruta = join(dir, entrada);
    if (statSync(ruta).isDirectory()) salida.push(...archivos(ruta));
    else if (/\.(ts|tsx)$/.test(entrada)) salida.push(ruta);
  }
  return salida;
}

function esComentario(linea: string): boolean {
  const t = linea.trimStart();
  return t.startsWith("*") || t.startsWith("//") || t.startsWith("/*");
}

describe("guardian de fechas", () => {
  it("nadie lee ni formatea fechas fuera de fechas.ts", () => {
    const hallazgos: string[] = [];
    for (const archivo of archivos("src")) {
      const normal = archivo.replaceAll("\\", "/");
      // El dueño puede. Su propio guardián tampoco se revisa a sí mismo: contiene los patrones.
      if (normal === DUENIO || normal.endsWith("fechas.guard.test.ts")) continue;
      const lineas = readFileSync(archivo, "utf8").split("\n");
      lineas.forEach((linea, i) => {
        if (esComentario(linea)) return;
        for (const { patron, motivo } of PROHIBIDO) {
          if (patron.test(linea)) hallazgos.push(`${normal}:${i + 1}  ${motivo}`);
        }
      });
    }
    expect(
      hallazgos,
      `Fechas fuera de src/lib/fechas.ts. En el Tablero esto falló tres veces:\n${hallazgos.join("\n")}`,
    ).toEqual([]);
  });

  it("construir un Date sigue permitido; leerlo, no", () => {
    // Existe porque un guardián que prohíbe de más se desactiva. `new Date(iso)` hace falta en
    // todos lados; lo que no puede salir de fechas.ts es interpretarlo.
    const construir = 'const d = new Date("2026-08-19T15:00:00Z");';
    const leer = "const mes = d.getMonth();";
    expect(PROHIBIDO.some((p) => p.patron.test(construir))).toBe(false);
    expect(PROHIBIDO.some((p) => p.patron.test(leer))).toBe(true);
    expect(PROHIBIDO.some((p) => p.patron.test("d.toISOString().slice(0, 10)"))).toBe(true);
    expect(PROHIBIDO.some((p) => p.patron.test("d.toLocaleDateString('es-AR')"))).toBe(true);
  });
});
