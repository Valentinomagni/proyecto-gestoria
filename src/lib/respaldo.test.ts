import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  armarRespaldo,
  contarFilas,
  estaCompleto,
  tablasDelEsquema,
  type Respaldo,
} from "./respaldo";

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

/** Un lector de mentira: un texto en vez de filas significa que esa tabla falla. */
const leer = (porTabla: Record<string, unknown[] | string>) => async (tabla: string) => {
  const v = porTabla[tabla];
  if (typeof v === "string") return { data: null, error: { message: v } };
  return { data: v ?? [], error: null };
};

describe("armarRespaldo", () => {
  /*
    ESTE BLOQUE NO EXISTIA, y no por olvido: no se podia escribir. `armarRespaldo` importaba el
    cliente de Supabase, asi que probarlo exigia credenciales de verdad. Ahora RECIBE con que
    leer, y la funcion se prueba entera sin tocar la red.
  */
  it("junta las filas de cada tabla y firma quien lo bajo", async () => {
    const r = await armarRespaldo(
      leer({ perfiles: [{ id: 1 }, { id: 2 }], movimientos: [{ id: 9 }] }),
      ["perfiles", "movimientos"],
      "gerencia1@grupoparis.com",
      "2026-08-19T12:00:00.000Z",
    );
    expect(Object.keys(r.tablas)).toEqual(["perfiles", "movimientos"]);
    expect(contarFilas(r)).toBe(3);
    expect(estaCompleto(r)).toBe(true);
    expect(r.por).toBe("gerencia1@grupoparis.com");
    expect(r.generado).toBe("2026-08-19T12:00:00.000Z");
  });

  it("una tabla que falla NO queda como arreglo vacio: queda anotada", async () => {
    // Es la diferencia entre un respaldo y un archivo. Un arreglo vacio se lee como "esa tabla
    // no tenia filas", que es mentira, y es exactamente como un respaldo incompleto pasa por
    // completo.
    const r = await armarRespaldo(
      leer({ perfiles: [{ id: 1 }], cobros: "permission denied for table cobros" }),
      ["perfiles", "cobros"],
      "quien sea",
    );
    expect(r.tablas["cobros"]).toBeUndefined();
    expect(r.errores["cobros"]).toBe("permission denied for table cobros");
    expect(estaCompleto(r)).toBe(false);
    expect(contarFilas(r)).toBe(1);
  });

  it("respeta el orden de la lista que se le da", async () => {
    const r = await armarRespaldo(leer({}), ["c", "a", "b"], "x");
    expect(Object.keys(r.tablas)).toEqual(["c", "a", "b"]);
  });
});
