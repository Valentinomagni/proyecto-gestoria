import { describe, expect, it } from "vitest";
import type { CellObject } from "write-excel-file/browser";
import { celdasDeFila, TITULOS, type FilaExportable, type Nombres } from "./excel";

/**
 * Lo que se prueba acá es lo que ESTE proyecto puede equivocar: qué tipo lleva cada celda, con
 * qué formato, y qué día de calendario. Armar el zip es trabajo de la librería y se comprobó una
 * vez abriendo el archivo y leyendo el XML.
 *
 * Los dos errores que estos tests existen para que no vuelvan:
 *   - la plata exportada como TEXTO, que arruina el archivo porque no se puede sumar;
 *   - la fecha corrida un día por la zona horaria, que adentro de un Excel no se discute.
 */

const NOMBRES: Nombres = {
  estado: (v) => `estado:${v}`,
  tipo: (v) => `tipo:${v}`,
  subtipo: (v) => (v === null ? "" : `modalidad:${v}`),
};

const BASE: FilaExportable = {
  recibido_at: "2026-08-19T23:30:00.000Z", // 20:30 del 19 en Argentina
  cliente_nombre: "BALAGUER JUAN ANTONIO",
  cliente_cuenta: null,
  oferta_referencia: "4097473",
  vehiculo: "CITROEN C3 FEEL",
  dominio: null,
  tipo: "patentamiento_0km",
  subtipo: "plan_ahorro",
  estado: "pagado",
  seccional: "San Luis 1",
  numero_pago_registro: null,
  deposito_solicitado: 600000,
};

/**
 * La celda de una columna, buscada por su título, para que el test no dependa del orden.
 *
 * Si la columna no existe, LANZA. Devolver `undefined` haría que los asertos de abajo pasaran
 * por casualidad el día que alguien renombre un título: un test que se vuelve verde solo es
 * peor que no tenerlo.
 */
function celda(fila: FilaExportable, titulo: string): CellObject {
  const i = TITULOS.indexOf(titulo);
  if (i < 0) throw new Error(`No existe la columna ${titulo}. Hay: ${TITULOS.join(", ")}`);
  const c = celdasDeFila(fila, NOMBRES)[i];
  if (c === undefined) throw new Error(`La columna ${titulo} no produjo celda`);
  return c;
}

describe("exportación a Excel", () => {
  it("la plata va como NUMERO con formato, no como texto", () => {
    const c = celda(BASE, "Depósito solicitado");
    expect(c.type).toBe(Number);
    expect(c.value).toBe(600000);
    expect(c.format).toBe("#,##0.00");
  });

  it("un importe con centavos sale con dos decimales exactos", () => {
    const c = celda({ ...BASE, deposito_solicitado: 2505627.92 }, "Depósito solicitado");
    expect(c.value).toBe(2505627.92);
  });

  it("sin depósito la celda queda VACIA y no en cero", () => {
    // Cero y "todavía no se pidió" no son lo mismo, y en una columna que se suma se nota.
    const c = celda({ ...BASE, deposito_solicitado: null }, "Depósito solicitado");
    expect(c.value).toBeUndefined();
    expect(c.type).toBe(Number);
  });

  it("la fecha va como FECHA y con el día argentino, no el de UTC", () => {
    // 2026-08-19T23:30Z son las 20:30 del 19 en Argentina. Sin cuidar la zona, Excel escribiría
    // el 20 de agosto: un día corrido adentro de un archivo que después se manda por mail.
    const c = celda(BASE, "Fecha");
    expect(c.type).toBe(Date);
    expect((c.value as Date).toISOString()).toBe("2026-08-19T00:00:00.000Z");
    expect(c.format).toBe("dd/mm/yyyy");
  });

  it("los códigos internos salen traducidos, no en crudo", () => {
    expect(celda(BASE, "Estado")?.value).toBe("estado:pagado");
    expect(celda(BASE, "Tipo")?.value).toBe("tipo:patentamiento_0km");
    expect(celda(BASE, "Modalidad")?.value).toBe("modalidad:plan_ahorro");
  });

  it("lo que falta sale como celda de texto vacía, nunca como 'null'", () => {
    const c = celda(BASE, "Dominio");
    expect(c.value).toBe("");
    expect(c.type).toBe(String);
  });

  it("hay una celda por cada título, siempre", () => {
    expect(celdasDeFila(BASE, NOMBRES)).toHaveLength(TITULOS.length);
  });
});
