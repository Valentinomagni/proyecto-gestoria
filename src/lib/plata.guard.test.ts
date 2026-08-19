import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * GUARDIAN DE PLATA.
 *
 * La regla: en JavaScript la plata son CENTAVOS ENTEROS, y toda conversión y todo formato pasan
 * por `src/lib/plata.ts`. En JavaScript `1234.10` no es exactamente 1234,10; sumando miles de
 * movimientos, deriva. Un saldo que no cierra por dos centavos destruye la confianza en el
 * sistema entero, y con razón.
 *
 * ALCANCE, declarado y angosto a propósito: prohíbe convertir entre pesos y centavos, y
 * formatear importes, fuera del módulo. **NO detecta toda aritmética sobre plata**: una suma de
 * dos variables llamadas `a` y `b` es indistinguible de cualquier otra suma sin analizar tipos,
 * y este guardián no es un compilador.
 *
 * Decirlo es parte del trabajo. Un guardián que declara qué cubre es honesto; uno que finge
 * cubrir todo aparenta una cobertura que no existe, que es exactamente lo que pasó con la
 * matriz del Tablero.
 */

const DUENIO = "src/lib/plata.ts";

const PROHIBIDO: { patron: RegExp; motivo: string }[] = [
  {
    patron: /\b(importe|monto|saldo|costo|total|precio|arancel)\w*\s*[*/]\s*100\b/i,
    motivo: "convertir entre pesos y centavos a mano: eso lo hace aCentavos/aDecimal",
  },
  {
    patron: /\b(importe|monto|saldo|costo|total|precio|arancel)\w*\.toFixed\s*\(/i,
    motivo: "formatear un importe a mano: eso lo hace formatear()",
  },
  {
    patron: /\bparseFloat\s*\(/,
    motivo: "parseFloat sobre un importe pierde precisión; va parsear() o aCentavos()",
  },
  {
    patron: /style\s*:\s*["']currency["']/,
    motivo: "el formato de moneda vive en un solo lugar",
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

describe("guardian de plata", () => {
  it("nadie convierte ni formatea importes fuera de plata.ts", () => {
    const hallazgos: string[] = [];
    for (const archivo of archivos("src")) {
      const normal = archivo.replaceAll("\\", "/");
      if (normal === DUENIO || normal.endsWith("plata.guard.test.ts")) continue;
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
      `Aritmética o formato de plata fuera de src/lib/plata.ts:\n${hallazgos.join("\n")}`,
    ).toEqual([]);
  });

  it("los patrones distinguen plata de cualquier otro número", () => {
    // Existe porque un guardián que marca código correcto se desactiva a la semana.
    expect(PROHIBIDO.some((p) => p.patron.test("const centavos = monto * 100;"))).toBe(true);
    expect(PROHIBIDO.some((p) => p.patron.test("const pct = aciertos / 100;"))).toBe(false);
    expect(PROHIBIDO.some((p) => p.patron.test("saldoDisponible.toFixed(2)"))).toBe(true);
    expect(PROHIBIDO.some((p) => p.patron.test("parseFloat(texto)"))).toBe(true);
    expect(PROHIBIDO.some((p) => p.patron.test("Number(texto)"))).toBe(false);
  });
});
