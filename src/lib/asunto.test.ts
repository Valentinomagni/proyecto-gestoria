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

  it("si NO hay REF, el número entre paréntesis es la CUENTA y no la referencia", () => {
    /*
      ESTE TEST AFIRMABA LO CONTRARIO Y SE CAMBIO A PROPOSITO el 20/08/2026, después de la
      primera prueba real. Lo dijo quien carga los trámites: "el número de cuenta personal viene
      entre paréntesis".

      O sea que la suposición original —un paréntesis sin prefijo es una referencia— estaba
      equivocada, y la consecuencia era que la cuenta no se reconocía NUNCA: había que
      escribirla a mano en cada trámite. Era el dato que más se cargaba dos veces.

      Lo que no cambió: cuando el asunto SI dice REF, ese gana como referencia. Lo explícito
      siempre manda.
    */
    const r = parsearAsunto("PATENTAMIENTO CITROEN C3 T200 FEEL PK (108198) VICENCIO");
    expect(r.cuenta).toBe("108198");
    expect(r.referencia).toBeNull();
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

describe("la cuenta personal entre parentesis", () => {
  it("un numero suelto entre parentesis es la CUENTA, no la referencia", () => {
    // En la planilla real ese lugar lo ocupa la cuenta. Antes se leia como referencia, asi que
    // la cuenta no se reconocia NUNCA y habia que escribirla a mano en cada tramite.
    const r = parsearAsunto("PATENTAMIENTO C3 (34913) BALAGUER JUAN ANTONIO");
    expect(r.cuenta).toBe("34913");
    expect(r.referencia).toBeNull();
  });

  it("con REF. adelante, ese es la referencia y el otro la cuenta", () => {
    // El caso real de la planilla: los dos numeros en el mismo asunto.
    const r = parsearAsunto("PATENTAMIENTO C3 (34913) BALAGUER JUAN ANTONIO (REF. 4097473)");
    expect(r.referencia).toBe("4097473");
    expect(r.cuenta).toBe("34913");
  });

  it("el prefijo C. le gana al parentesis, porque es explicito", () => {
    const r = parsearAsunto("PATENTAMIENTO PLAN DE AHORRO- C.74344 MUNOZ ELIZABETH (99999)");
    expect(r.cuenta).toBe("74344");
  });

  it("y el nombre del cliente no se ensucia con ninguno de los dos numeros", () => {
    const r = parsearAsunto("PATENTAMIENTO C3 (34913) BALAGUER JUAN ANTONIO (REF. 4097473)");
    expect(r.cliente).toBe("BALAGUER JUAN ANTONIO");
  });
});

describe("la modalidad tiene dos valores y son de patentamiento", () => {
  it("reconoce la venta directa cuando el asunto la nombra", () => {
    expect(parsearAsunto("PATENTAMIENTO VENTA DIRECTA GOMEZ ANALIA").subtipo).toBe("venta_directa");
  });

  it("y sigue reconociendo el plan de ahorro", () => {
    expect(parsearAsunto("PATENTAMIENTO PLAN DE AHORRO- C.74344 MUNOZ ELIZABETH").subtipo)
      .toBe("plan_ahorro");
  });

  it("NO adivina la modalidad cuando el asunto no la dice", () => {
    // Adivinar un dato del negocio es lo unico que este parser no puede hacer. Que la mayoria
    // sean venta directa no lo vuelve cierto para este.
    expect(parsearAsunto("PATENTAMIENTO C3 (34913) BALAGUER JUAN ANTONIO").subtipo).toBeNull();
  });

  it("y no le pone modalidad a una transferencia, aunque el asunto la nombre", () => {
    // Una transferencia no tiene modalidad: la base tiene un check que lo impide, y el parser
    // no puede devolver algo que despues no se va a poder guardar.
    const r = parsearAsunto("TRANSFERENCIA PLAN DE AHORRO CHEVROLET CRUZE A PARIS AUTOS");
    expect(r.tipo).toBe("transferencia_al_concesionario");
    expect(r.subtipo).toBeNull();
  });
});
