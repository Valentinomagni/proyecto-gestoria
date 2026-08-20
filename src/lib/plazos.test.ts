import { describe, expect, it } from "vitest";
import { calcular, inicioDe, plazoDe, plazosDeTipo, type Calendario, type Plazo } from "./plazos";
import { sumarDiasHabiles, diasHabilesEntre, sumarDiasCorridos } from "./fechas";

/**
 * Lo primero que se prueba de este módulo NO es que calcule bien: es que SE NIEGUE bien.
 *
 * Un sistema que avisa un vencimiento equivocado es peor que uno que no avisa nada, porque el
 * primero se deja de mirar. Los tres casos en que tiene que negarse valen más que el caso en
 * que acierta.
 */

const VERIFICADO: Plazo = {
  clave: "mora_08",
  nombre: "Mora de la transferencia",
  aplica_a: "todos",
  desde: "certificacion_primera_firma",
  dias: 5,
  habiles: true,
  consecuencia: "20% por año, hasta 5 años",
  norma: "Arancel 14, Anexo I DNRPA",
  verificado_el: "2026-08-18",
  verificado_por: "Lectura completa del Anexo I",
};

/** Un calendario que llega hasta fin de 2026, con dos feriados adentro. */
const CALENDARIO_2026: Calendario = {
  feriados: new Set(["2026-08-17", "2026-12-08"]),
  cubreHasta: "2026-12-31",
};

describe("se niega a calcular, y dice qué falta", () => {
  it("sin plazo confirmado no hay vencimiento, y NO es un error", () => {
    // Es el mecanismo central: la pantalla lee de una vista que no tiene los no verificados,
    // así que acá el plazo llega en null y lo único correcto es no mostrar cuenta regresiva.
    const r = calcular(null, "2026-08-19", CALENDARIO_2026, "2026-08-19");
    expect(r.estado).toBe("sin_confirmar");
    if (r.estado !== "sin_confirmar") throw new Error("estado inesperado");
    expect(r.queFalta).toContain("gestoras");
  });

  it("sin la fecha que arranca el reloj tampoco", () => {
    // Pasa de verdad: la certificación de la primera firma de un 08 la hace un escribano fuera
    // del sistema, así que esa fecha la carga una persona y hasta entonces no existe.
    const r = calcular(VERIFICADO, null, CALENDARIO_2026, "2026-08-19");
    expect(r.estado).toBe("sin_inicio");
  });

  it("y con el calendario vacío se niega, en vez de contar sólo fines de semana", () => {
    /*
      ES EL CASO MAS IMPORTANTE DE LOS TRES, porque es el único que produciría un número que se
      ve bien. Sin feriados cargados, la cuenta da una fecha ANTERIOR a la real: el error va
      justo para el lado que hace daño, avisando que vence antes o dando por vencido algo que no
      venció.
    */
    const vacio: Calendario = { feriados: new Set(), cubreHasta: null };
    const r = calcular(VERIFICADO, "2026-08-19", vacio, "2026-08-19");
    expect(r.estado).toBe("sin_calendario");
    if (r.estado !== "sin_calendario") throw new Error("estado inesperado");
    expect(r.queFalta).toContain("vacío");
  });

  it("y si el plazo cae más allá de donde llega el calendario, también", () => {
    const hastaAgosto: Calendario = { feriados: new Set(["2026-08-17"]), cubreHasta: "2026-08-31" };
    const largo: Plazo = { ...VERIFICADO, dias: 90 };
    const r = calcular(largo, "2026-08-19", hastaAgosto, "2026-08-19");
    expect(r.estado).toBe("sin_calendario");
    if (r.estado !== "sin_calendario") throw new Error("estado inesperado");
    expect(r.queFalta).toContain("2026-08-31");
  });

  it("un plazo en días CORRIDOS no necesita calendario", () => {
    // Los corridos no miran feriados, así que exigir el calendario sería negarse de más.
    const corrido: Plazo = { ...VERIFICADO, habiles: false, dias: 30 };
    const vacio: Calendario = { feriados: new Set(), cubreHasta: null };
    const r = calcular(corrido, "2026-08-19", vacio, "2026-08-19");
    expect(r.estado).toBe("vence");
    if (r.estado !== "vence") throw new Error("estado inesperado");
    expect(r.fecha).toBe("2026-09-18");
  });
});

describe("cuando sí calcula", () => {
  it("cuenta días hábiles y saltea el fin de semana", () => {
    // 19/08/2026 es miércoles. Cinco hábiles: jue 20, vie 21, lun 24, mar 25, mié 26.
    const r = calcular(VERIFICADO, "2026-08-19", CALENDARIO_2026, "2026-08-19");
    expect(r.estado).toBe("vence");
    if (r.estado !== "vence") throw new Error("estado inesperado");
    expect(r.fecha).toBe("2026-08-26");
    expect(r.vencido).toBe(false);
    expect(r.diasHabilesRestantes).toBe(5);
  });

  it("saltea también el feriado, que es para lo que existe la tabla", () => {
    // Desde el viernes 14, con el lunes 17 feriado: lun no, mar 18, mié 19 -> dos hábiles.
    const dos: Plazo = { ...VERIFICADO, dias: 2 };
    const r = calcular(dos, "2026-08-14", CALENDARIO_2026, "2026-08-14");
    expect(r.estado).toBe("vence");
    if (r.estado !== "vence") throw new Error("estado inesperado");
    expect(r.fecha).toBe("2026-08-19");
  });

  it("marca vencido, y los días restantes salen negativos", () => {
    // Se calcula desde el 3 y se mira el 19: ya se pasó.
    const r = calcular(VERIFICADO, "2026-08-03", CALENDARIO_2026, "2026-08-19");
    expect(r.estado).toBe("vence");
    if (r.estado !== "vence") throw new Error("estado inesperado");
    expect(r.vencido).toBe(true);
    expect(r.diasHabilesRestantes).toBeLessThan(0);
  });

  it("trae la consecuencia y quién lo verificó, para mostrarlos al lado", () => {
    // Un número sin procedencia se cree; uno con procedencia se puede discutir.
    const r = calcular(VERIFICADO, "2026-08-19", CALENDARIO_2026, "2026-08-19");
    if (r.estado !== "vence") throw new Error("estado inesperado");
    expect(r.plazo.consecuencia).toContain("20%");
    expect(r.plazo.verificado_por).toContain("Anexo I");
    expect(r.plazo.verificado_el).toBe("2026-08-18");
  });
});

describe("elegir el plazo que corresponde", () => {
  it("lo encuentra por clave", () => {
    expect(plazoDe([VERIFICADO], "mora_08")?.nombre).toBe("Mora de la transferencia");
  });

  it("y devuelve null si no está, que es lo que dispara sin_confirmar", () => {
    expect(plazoDe([VERIFICADO], "vigencia_12")).toBeNull();
    expect(plazoDe([], "mora_08")).toBeNull();
  });
});

describe("la aritmética de días hábiles", () => {
  it("sumar cero deja la misma fecha", () => {
    expect(sumarDiasHabiles("2026-08-19", 0, new Set())).toBe("2026-08-19");
  });

  it("un día hábil desde un viernes cae el lunes", () => {
    expect(sumarDiasHabiles("2026-08-21", 1, new Set())).toBe("2026-08-24");
  });

  it("y si el lunes es feriado, cae el martes", () => {
    expect(sumarDiasHabiles("2026-08-14", 1, new Set(["2026-08-17"]))).toBe("2026-08-18");
  });

  it("rechaza un número de días que no es un entero positivo", () => {
    expect(() => sumarDiasHabiles("2026-08-19", -1, new Set())).toThrow(RangeError);
    expect(() => sumarDiasHabiles("2026-08-19", 1.5, new Set())).toThrow(RangeError);
  });

  it("rechaza una fecha mal escrita en vez de devolver basura", () => {
    expect(() => sumarDiasHabiles("19/08/2026", 1, new Set())).toThrow(TypeError);
  });

  it("los días corridos no saltean nada", () => {
    // Del viernes 21 más un día: sábado 22. Es lo correcto para un plazo en corridos.
    expect(sumarDiasCorridos("2026-08-21", 1)).toBe("2026-08-22");
  });

  it("contar hábiles entre dos fechas da negativo si la segunda ya pasó", () => {
    expect(diasHabilesEntre("2026-08-19", "2026-08-26", new Set())).toBe(5);
    expect(diasHabilesEntre("2026-08-26", "2026-08-19", new Set())).toBe(-5);
    expect(diasHabilesEntre("2026-08-19", "2026-08-19", new Set())).toBe(0);
  });
});

describe("a que tramite le corre cada plazo", () => {
  const soloPatentamiento: Plazo = { ...VERIFICADO, clave: "inicial", aplica_a: "patentamiento_0km" };

  it("los de 'todos' le corren a cualquier tipo", () => {
    expect(plazosDeTipo([VERIFICADO], "transferencia_a_cliente")).toHaveLength(1);
    expect(plazosDeTipo([VERIFICADO], "patentamiento_0km")).toHaveLength(1);
  });

  it("y los de un tipo NO le corren a los otros", () => {
    expect(plazosDeTipo([soloPatentamiento], "transferencia_a_cliente")).toHaveLength(0);
    expect(plazosDeTipo([soloPatentamiento], "patentamiento_0km")).toHaveLength(1);
  });
});

describe("de donde arranca el reloj", () => {
  it("saca la fecha del evento que el plazo declara", () => {
    expect(inicioDe(VERIFICADO, { certificacion_primera_firma: "2026-08-19" })).toBe("2026-08-19");
  });

  it("y devuelve null cuando ese dato todavia no esta, sin inventar otro", () => {
    // Es lo que dispara `sin_inicio`. Usar la fecha de alta del tramite en su lugar daria un
    // vencimiento equivocado, que es lo unico que este modulo no puede hacer.
    expect(inicioDe(VERIFICADO, { certificacion_primera_firma: null })).toBeNull();
    expect(inicioDe(VERIFICADO, { recibido: "2026-08-19" })).toBeNull();
  });
});
