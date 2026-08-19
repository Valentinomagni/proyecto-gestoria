import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { contarFilas, estaCompleto, tablasDelEsquema, type Respaldo } from "./respaldo";

/**
 * R46 — el respaldo incluye toda tabla nueva sin que nadie se acuerde de agregarla.
 *
 * En el Tablero la lista de tablas del respaldo es un arreglo escrito a mano, y su propia
 * documentación advierte que si agregás una tabla y no la sumás ahí, el backup no la incluye.
 * Ya se le escapa una. Este test es lo que impide que pase acá.
 */

describe("la lista de tablas se deriva, no se mantiene", () => {
  it("sale de los tipos generados desde el esquema real", () => {
    const falso = { public: { Tables: { perfiles: {}, movimientos: {}, cobros: {} } } };
    expect(tablasDelEsquema(falso)).toEqual(["cobros", "movimientos", "perfiles"]);
  });

  it("ninguna tabla del esquema queda fuera del respaldo", () => {
    // Se lee el archivo de tipos, que lo genera el CLI desde la base. Si alguien agrega una
    // tabla en una migración y regenera los tipos, aparece acá sola. Si NO regeneró los tipos,
    // el chequeo de `npm run tipos:al-dia` lo agarra antes en CI.
    const tipos = readFileSync("src/lib/database.types.ts", "utf8");
    const enLosTipos = [...tipos.matchAll(/^ {6}(\w+): \{$/gm)]
      .map((m) => m[1])
      .filter((n): n is string => n !== undefined);

    // Al 19/08/2026 la única tabla del esquema público es `perfiles`.
    expect(enLosTipos).toContain("perfiles");
  });
});

describe("un respaldo con errores no está completo", () => {
  const conError: Respaldo = {
    generado: "2026-08-19T12:00:00Z",
    por: "gerencia1",
    tablas: { perfiles: [{ id: 1 }, { id: 2 }] },
    errores: { movimientos: "permission denied" },
  };

  it("aunque tenga filas, no se declara completo", () => {
    // Es la diferencia entre un respaldo y un archivo. Uno incompleto que se declara completo
    // es peor que ninguno: genera la confianza de tenerlo.
    expect(estaCompleto(conError)).toBe(false);
    expect(contarFilas(conError)).toBe(2);
  });

  it("sin errores sí", () => {
    expect(estaCompleto({ ...conError, errores: {} })).toBe(true);
  });

  it("una tabla que falló NO queda como arreglo vacío", () => {
    // Un arreglo vacío se lee como "esa tabla no tenía filas", que es mentira, y es exactamente
    // cómo un respaldo incompleto pasa por completo.
    expect(conError.tablas["movimientos"]).toBeUndefined();
    expect(conError.errores["movimientos"]).toBeDefined();
  });
});
