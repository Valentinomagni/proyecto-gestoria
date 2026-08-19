/**
 * ============================================================================
 *  LAS FECHAS. Todo lo que sea un dia calendario o una hora pasa por acá.
 * ============================================================================
 *
 *  POR QUE ES UN MODULO SOLO. En el Tablero Contable esto fallo TRES veces —lo dice su propio
 *  revisor-contable, textual: "Esto ya fallo tres veces"— y NINGUNA fue por el calculo. Siempre
 *  fue porque nada impedia escribir `new Date().getMonth()` en otro archivo: el Tablon
 *  archivaba vencimientos tres horas antes, y el chip "Vencio" usaba la zona del navegador.
 *
 *  La leccion no es "cuidado con las fechas". Es que el modulo solo no alcanza: hace falta el
 *  guardian que impida saltearlo. Esta en fechas.guard.test.ts.
 *
 *  Argentina no tiene horario de verano desde 2009, asi que el desplazamiento es fijo en -3.
 *  Aun asi todo pasa por `Intl` con la zona nombrada: un desplazamiento escrito a mano es una
 *  constante mas que alguien puede copiar mal el dia que cambie la ley.
 */

const ZONA = "America/Argentina/Buenos_Aires";

/** `en-CA` da `YYYY-MM-DD`, que es el formato con el que trabaja Postgres. */
const FECHA_ISO = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const FECHA_LEGIBLE = new Intl.DateTimeFormat("es-AR", {
  timeZone: ZONA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const HORA = new Intl.DateTimeFormat("es-AR", {
  timeZone: ZONA,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Un instante -> el dia calendario argentino, `YYYY-MM-DD`. */
export function aFechaArgentina(instante: string | Date): string {
  return FECHA_ISO.format(new Date(instante));
}

/** El dia de hoy en Argentina, `YYYY-MM-DD`. */
export function hoyArgentina(ahora: Date = new Date()): string {
  return aFechaArgentina(ahora);
}

/** El mes argentino al que pertenece un instante, `YYYY-MM`. */
export function mesDe(instante: string | Date): string {
  return aFechaArgentina(instante).slice(0, 7);
}

/** `19/08/2026`. */
export function formatearFecha(instante: string | Date): string {
  return FECHA_LEGIBLE.format(new Date(instante));
}

/** `18/08/2026 15:19`, con la hora argentina. */
export function formatearFechaHora(instante: string | Date): string {
  const d = new Date(instante);
  return `${FECHA_LEGIBLE.format(d)} ${HORA.format(d)}`;
}

/** La hora argentina de un instante, en minutos desde la medianoche. */
export function horaArgentina(ahora: Date = new Date()): number {
  const [h, m] = HORA.format(ahora).split(":");
  return Number(h) * 60 + Number(m);
}

/** `"16:00"` -> 960. Lanza si el formato no es el esperado, en vez de devolver NaN. */
function aMinutos(hhmm: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) throw new TypeError(`Hora mal escrita: ${JSON.stringify(hhmm)}`);
  const horas = Number(m[1]);
  const minutos = Number(m[2]);
  if (horas > 23 || minutos > 59) throw new RangeError(`Hora fuera de rango: ${hhmm}`);
  return horas * 60 + minutos;
}

/**
 * Si todavia se llega al corte de depositos.
 *
 * JUSTO A LA HORA DEL CORTE YA NO SE LLEGA. El borde se decide hacia el lado seguro: decir que
 * se llega cuando no se llega hace perder un dia entero, y el error se descubre recien al dia
 * siguiente, con un tramite frenado en el registro.
 *
 * La hora entra por parametro, desde la tabla `parametros`. Nunca escrita en el codigo.
 */
export function antesDelCorte(horaCorte: string, ahora: Date = new Date()): boolean {
  return horaArgentina(ahora) < aMinutos(horaCorte);
}

/**
 * Cuantos minutos faltan para el corte. Cero si ya paso.
 *
 * Nunca negativo: "faltan -20 minutos" no quiere decir nada en una pantalla. Pasado el corte,
 * lo que corresponde no es un numero sino otro mensaje —"lo que ordenes ahora acredita pasado
 * manana"—, y eso lo decide quien dibuja, con este cero como senal.
 */
export function minutosHasta(horaCorte: string, ahora: Date = new Date()): number {
  return Math.max(0, aMinutos(horaCorte) - horaArgentina(ahora));
}

/**
 * El dia habil siguiente a una fecha, en formato `YYYY-MM-DD`.
 *
 * Un deposito ordenado el VIERNES antes del corte no acredita el sabado. Sin esto, la pantalla
 * mostraria plata disponible un dia antes de que exista, que es el error que este sistema no
 * puede cometer.
 *
 * PENDIENTE Y DECLARADO: todavia no contempla feriados. La tabla `feriados` y el calendario
 * habil llegan con la capa de vencimientos; hasta entonces, un deposito ordenado el jueves
 * anterior a un feriado va a figurar como acreditado un dia antes de lo real. Es un error
 * conocido, acotado y escrito — no uno silencioso.
 */
export function proximoDiaHabil(desde: Date = new Date()): string {
  const d = new Date(desde);
  do {
    d.setDate(d.getDate() + 1);
  } while (d.getDay() === 0 || d.getDay() === 6);
  return aFechaArgentina(d);
}
