import { describe, expect, it } from "vitest";
import { parsearAsunto } from "./asunto";

/**
 * Los casos son las filas REALES de la planilla, transcritas literalmente. No inventados: un
 * caso inventado se parsea perfecto y no prueba nada sobre el formato que llega de verdad.
 */

describe("tipo de trámite", () => {
  it("reconoce un patentamiento", () => {
    expect(parsearAsunto("PATENTAMIENTO CITROEN C3 T200 FEEL PK (108198) VICENCIO LUNA").tipo)
      .toBe("patentamiento_0km");
  });

  it("tolera el error de tipeo de la planilla", () => {
    // "PATENTAMIENNTO" con dos enes existe de verdad en la fila 6858.
    expect(parsearAsunto("PATENTAMIENNTO PLAN DE AHORRO. C. 105235 DOMINGUEZ CELESTE").tipo)
      .toBe("patentamiento_0km");
  });

  it("distingue la transferencia AL concesionario, que es la que sale gratis a tiempo", () => {
    expect(parsearAsunto("TRANSFERENCIA CHEVROLET CRUZE A PARÍS AUTOS").tipo)
      .toBe("transferencia_al_concesionario");
    expect(parsearAsunto("TRANSFERENCIA A PARIS 208 ALLURE 1.6 N 5P").tipo)
      .toBe("transferencia_al_concesionario");
  });

  it("una transferencia comun es a cliente", () => {
    expect(parsearAsunto("TRANSFERENCIA 108297 MARTINEZ NELLY FABIANA REF 4100879").tipo)
      .toBe("transferencia_a_cliente");
  });

  it("lo que no reconoce queda en null, no adivina", () => {
    expect(parsearAsunto("cualquier cosa").tipo).toBeNull();
    expect(parsearAsunto("").tipo).toBeNull();
  });
});

describe("plan de ahorro", () => {
  it("se detecta como subtipo y no como tipo propio", () => {
    const r = parsearAsunto("PATENTAMIENTO PLAN DE AHORRO- C.74344 MUÑOZ ELIZABETH");
    expect(r.tipo).toBe("patentamiento_0km");
    expect(r.subtipo).toBe("plan_ahorro");
  });
});

describe("cuenta personal", () => {
  it("las tres formas que conviven en la planilla", () => {
    expect(parsearAsunto("PATENTAMIENTO PLAN DE AHORRO- C.74344 MUÑOZ ELIZABETH").cuenta).toBe("74344");
    expect(parsearAsunto("PATENTAMIENNTO PLAN DE AHORRO. C. 105235 DOMINGUEZ").cuenta).toBe("105235");
    expect(parsearAsunto("PATENTAMIENTO PLAN DE AHORRO- C.103188 SYS RENTACAR").cuenta).toBe("103188");
  });
});

describe("referencia de la oferta", () => {
  it("las tres formas de escribirla, que conviven en la misma planilla", () => {
    expect(parsearAsunto("PATENTAMIENTO C3 (34913) BALAGUER JUAN ANTONIO (REF. 4097473)").referencia).toBe("4097473");
    expect(parsearAsunto("PATENTAMIENTO OCHOA CARLA ref 4093504 cl 79196").referencia).toBe("4093504");
    expect(parsearAsunto("PATENTAMIENTO RAMIREZ MATIAS (107818) REF4064625").referencia).toBe("4064625");
  });

  it("si no hay REF, cae al número entre paréntesis", () => {
    expect(parsearAsunto("PATENTAMIENTO CITROEN C3 T200 FEEL PK (108198) VICENCIO").referencia).toBe("108198");
  });
});

describe("cliente", () => {
  it("saca el nombre sin las palabras del formulario", () => {
    const r = parsearAsunto("PATENTAMIENTO PLAN DE AHORRO- C.74344 MUÑOZ ELIZABETH - UNIDAD PE");
    expect(r.cliente).toContain("MUÑOZ");
    expect(r.cliente).not.toContain("PATENTAMIENTO");
    expect(r.cliente).not.toContain("PLAN");
  });

  it("cuando no se puede distinguir, devuelve null en vez de inventar", () => {
    // Un parser que adivina es peor que uno que se abstiene: el dato inventado se ve igual de
    // bien que el correcto, y nadie lo vuelve a mirar.
    expect(parsearAsunto("PATENTAMIENTO").cliente).toBeNull();
  });
});
