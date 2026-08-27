import { describe, expect, it } from "vitest";
import {
  aFechaDeExcel,
  aFechaArgentina,
  formatearFecha,
  formatearFechaHora,
  mesDe,
  proximoDiaHabil,
  sumarDiasHabiles,
} from "./fechas";

/**
 * Todo lo de acá pasa por hora argentina, no por la del navegador.
 *
 * En el Tablero Contable esto falló TRES veces —lo dice su propio revisor-contable— y nunca por
 * el cálculo: siempre porque nada impedía escribir `new Date().getMonth()` en otro archivo. El
 * Tablón archivaba vencimientos tres horas antes y el chip "Venció" usaba la zona del
 * navegador.
 *
 * Argentina no tiene horario de verano desde 2009, así que el desplazamiento es fijo en −3.
 * Aun así todo pasa por `Intl` con la zona nombrada: un desplazamiento escrito a mano es una
 * constante más que alguien puede copiar mal.
 */

describe("aFechaArgentina", () => {
  it("una hora UTC de la madrugada todavía es el día anterior en Argentina", () => {
    // 02:00 UTC del 20/08 son las 23:00 del 19/08 en Argentina. Es EXACTAMENTE el caso que
    // archivaba vencimientos un día antes en el Tablero.
    expect(aFechaArgentina("2026-08-20T02:00:00Z")).toBe("2026-08-19");
  });

  it("a las 03:00 UTC ya cambió el día en Argentina", () => {
    expect(aFechaArgentina("2026-08-20T03:00:00Z")).toBe("2026-08-20");
  });

  it("el mediodía argentino es el mismo día", () => {
    expect(aFechaArgentina("2026-08-19T15:00:00Z")).toBe("2026-08-19");
  });
});

describe("mesDe", () => {
  it("el primero del mes a la madrugada UTC pertenece al mes anterior", () => {
    // 01/09 a las 02:00 UTC son las 23:00 del 31/08 en Argentina. Un cierre mensual que use
    // la fecha UTC se lleva ese trámite al mes equivocado.
    expect(mesDe("2026-09-01T02:00:00Z")).toBe("2026-08");
    expect(mesDe("2026-09-01T03:00:00Z")).toBe("2026-09");
  });
});

describe("formatear", () => {
  it("fecha en el formato que se lee acá", () => {
    expect(formatearFecha("2026-08-19T15:00:00Z")).toBe("19/08/2026");
  });

  it("fecha y hora, con la hora argentina", () => {
    // 18:19 UTC son las 15:19 en Argentina. El listado de Habitualista [img 03] muestra
    // "18/08/2026 12:19 p. m.", así que la hora importa y tiene que ser la local.
    expect(formatearFechaHora("2026-08-18T18:19:00Z")).toBe("18/08/2026 15:19");
  });
});

/*
  ACA VIVIAN LOS OCHO TESTS DEL CORTE DE LAS 16:00 —los de `antesDelCorte`, `minutosHasta` y
  `horaArgentina`—, y se fueron el 21/08/2026 con la cuenta regresiva que se saco de la pantalla
  de la Tarjeta a pedido del usuario.

  Se anota lo que se perdio, porque no era poco: probaban el borde exacto —justo a las 16:00 ya
  NO se llega, decidido hacia el lado seguro— y que la hora entrara por parametro en vez de estar
  escrita en el codigo.

  Estan en el historial de git. Si vuelve la cuenta regresiva, vuelven con ella. Y la zona horaria
  sigue cubierta por los tests de `formatearFechaHora`, que es donde de verdad se ve.
*/

describe("aFechaDeExcel", () => {
  /*
    LA TRAMPA: un tramite dado de alta el 19/08 a las 20:30 de Argentina es, en UTC, el 20/08 a
    las 23:30. La libreria de Excel convierte usando UTC, asi que `new Date(iso)` a secas
    escribiria 20 DE AGOSTO en la planilla — un dia corrido, adentro de un archivo que se manda
    por mail y donde ya no hay forma de darse cuenta.
  */
  it("un alta de la noche argentina NO se corre al dia siguiente", () => {
    const d = aFechaDeExcel("2026-08-19T23:30:00.000Z"); // 20:30 del 19 en Argentina
    expect(d.toISOString()).toBe("2026-08-19T00:00:00.000Z");
  });

  it("la madrugada UTC tampoco se corre al dia anterior", () => {
    const d = aFechaDeExcel("2026-08-19T02:00:00.000Z"); // 23:00 del 18 en Argentina
    expect(d.toISOString()).toBe("2026-08-18T00:00:00.000Z");
  });

  it("el mediodia es el dia obvio", () => {
    expect(aFechaDeExcel("2026-08-18T12:00:00.000Z").toISOString()).toBe(
      "2026-08-18T00:00:00.000Z",
    );
  });
});

/**
 * ============================================================================
 *  LA ARITMETICA DE DIAS HABILES, que es la que decide CUANDO HAY PLATA
 * ============================================================================
 *
 *  Estos tests vivian en `plazos.test.ts`, con el calculo de vencimientos. Ese calculo se saco el
 *  21/08/2026, pero `sumarDiasHabiles` se queda: de ella cuelga `proximoDiaHabil`, que dice
 *  cuando acredita un deposito. Si eso se equivoca un dia, la pantalla muestra saldo disponible
 *  que todavia no existe — y alguien manda a presentar un tramite contra plata que no esta.
 */
describe("sumar dias habiles", () => {
  it("sumar cero deja la misma fecha", () => {
    expect(sumarDiasHabiles("2026-08-19", 0, new Set())).toBe("2026-08-19");
  });

  it("un dia habil desde un viernes cae el lunes", () => {
    expect(sumarDiasHabiles("2026-08-21", 1, new Set())).toBe("2026-08-24");
  });

  it("y si el lunes es feriado, cae el martes", () => {
    // Es para lo que existe la tabla de feriados. Sin ella la cuenta da el lunes, un dia antes
    // de que la plata este de verdad.
    expect(sumarDiasHabiles("2026-08-14", 1, new Set(["2026-08-17"]))).toBe("2026-08-18");
  });

  it("rechaza un numero de dias que no es un entero positivo", () => {
    expect(() => sumarDiasHabiles("2026-08-19", -1, new Set())).toThrow(RangeError);
    expect(() => sumarDiasHabiles("2026-08-19", 1.5, new Set())).toThrow(RangeError);
  });

  it("rechaza una fecha mal escrita en vez de devolver basura", () => {
    // Una fecha invalida que devuelve `Invalid Date` se propaga en silencio hasta la pantalla.
    expect(() => sumarDiasHabiles("19/08/2026", 1, new Set())).toThrow(TypeError);
  });
});

describe("cuando acredita un deposito", () => {
  it("uno ordenado el viernes acredita el lunes, no el sabado", () => {
    // Es el caso que hace perder un fin de semana entero de saldo disponible.
    expect(proximoDiaHabil(new Set(), new Date("2026-08-21T15:00:00Z"))).toBe("2026-08-24");
  });

  it("y si el lunes es feriado, el martes", () => {
    expect(proximoDiaHabil(new Set(["2026-08-24"]), new Date("2026-08-21T15:00:00Z"))).toBe(
      "2026-08-25",
    );
  });
});
