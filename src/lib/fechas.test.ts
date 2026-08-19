import { describe, expect, it } from "vitest";
import {
  aFechaDeExcel,
  aFechaArgentina,
  formatearFecha,
  formatearFechaHora,
  mesDe,
  horaArgentina,
  antesDelCorte,
  minutosHasta,
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

describe("horaArgentina", () => {
  it("devuelve la hora local en minutos desde medianoche", () => {
    expect(horaArgentina(new Date("2026-08-19T18:00:00Z"))).toBe(15 * 60);
    expect(horaArgentina(new Date("2026-08-19T19:30:00Z"))).toBe(16 * 60 + 30);
  });
});

/**
 * EL CORTE DE LAS 16:00.
 *
 * Es el reloj real de la operación: el depósito se ordena hasta esa hora y acredita al día
 * siguiente. Quien no decide antes no pierde unas horas, pierde un día entero.
 *
 * La hora NO está escrita en el código: entra por parámetro desde la tabla `parametros`. Un
 * banco cambia un horario de corte sin avisarle a nadie, y un `16` constante convertiría ese
 * cambio en un error silencioso que hace perder un día por vez hasta que alguien lo note.
 */
describe("el corte de depósitos", () => {
  it("a las 15:59 todavía se llega", () => {
    expect(antesDelCorte("16:00", new Date("2026-08-19T18:59:00Z"))).toBe(true);
  });

  it("a las 16:01 ya no", () => {
    expect(antesDelCorte("16:00", new Date("2026-08-19T19:01:00Z"))).toBe(false);
  });

  it("justo a las 16:00 ya no se llega", () => {
    // El borde se decide hacia el lado seguro: decir que todavía se llega cuando no se llega
    // hace perder un día, y el error se descubre al día siguiente.
    expect(antesDelCorte("16:00", new Date("2026-08-19T19:00:00Z"))).toBe(false);
  });

  it("cuántos minutos faltan para el corte", () => {
    expect(minutosHasta("16:00", new Date("2026-08-19T16:45:00Z"))).toBe(135);
    expect(minutosHasta("16:00", new Date("2026-08-19T18:59:00Z"))).toBe(1);
  });

  it("pasado el corte, faltan cero minutos y no un número negativo", () => {
    // Un negativo en la pantalla se leería como "faltan -20 minutos", que no quiere decir nada.
    expect(minutosHasta("16:00", new Date("2026-08-19T19:20:00Z"))).toBe(0);
  });

  it("respeta una hora de corte distinta, porque es un dato y no una constante", () => {
    expect(antesDelCorte("14:30", new Date("2026-08-19T17:29:00Z"))).toBe(true);
    expect(antesDelCorte("14:30", new Date("2026-08-19T17:31:00Z"))).toBe(false);
  });
});

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
    expect(aFechaDeExcel("2026-08-18T12:00:00.000Z").toISOString())
      .toBe("2026-08-18T00:00:00.000Z");
  });
});
