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

/*
  ============================================================================
   ACA VIVIA LA ARITMETICA DEL CORTE DE LAS 16:00
  ============================================================================

  `antesDelCorte`, `minutosHasta`, `horaArgentina` y `aMinutos` se fueron el 21/08/2026 junto con
  la cuenta regresiva, que se saco de la pantalla de la Tarjeta a pedido del usuario.

  Se anota lo que se perdio, porque no era poco: probaban el borde exacto —justo a las 16:00 ya
  NO se llega, decidido hacia el lado seguro, porque decir que se llega cuando no se llega hace
  perder un dia entero— y que la hora entrara por parametro en vez de estar escrita en el codigo.
  Todo esta en el historial de git. Si vuelve la cuenta regresiva, vuelve con sus pruebas.

  LO QUE EL CORTE SIGUE DECIDIENDO NO SE FUE, y es lo que de verdad mueve plata: la fecha en que
  acredita un deposito la calcula `proximoDiaHabil`, aca abajo. Eso es lo que separa el saldo de
  hoy del de maniana, y sigue probado.

  Y la zona horaria tampoco quedo sin cubrir: el formateador `HORA` lo sigue usando
  `formatearFechaHora`, con sus tests.
*/

/**
 * Un instante -> la fecha que hay que escribir en una celda de Excel.
 *
 * ============================================================================
 *  POR QUE NO ALCANZA CON `new Date(iso)`, QUE ES LO QUE PARECE OBVIO
 * ============================================================================
 *
 *  Excel guarda una fecha SIN ZONA: es un dia de calendario y nada mas. La libreria convierte
 *  el `Date` de JavaScript usando UTC. Entonces un tramite dado de alta el 19/08 a las 21:00 de
 *  Argentina —que en UTC ya es el 20/08 a las 00:00— aparece en la planilla como 20 DE AGOSTO.
 *
 *  Es la MISMA falla que el Tablero tuvo tres veces con las fechas, y es peor en un archivo:
 *  la planilla se manda por mail, se abre en otra computadora y ahi ya no hay forma de darse
 *  cuenta de que el dia esta corrido. Un numero equivocado adentro de un Excel no se discute,
 *  se cree.
 *
 *  Por eso: se saca el dia CALENDARIO argentino y se arma la medianoche UTC de ESE dia. Asi lo
 *  que la libreria escribe es exactamente el dia que la persona vio en pantalla.
 */
export function aFechaDeExcel(instante: string | Date): Date {
  return new Date(`${aFechaArgentina(instante)}T00:00:00Z`);
}

/**
 * El dia habil siguiente a una fecha, en formato `YYYY-MM-DD`.
 *
 * ES LA FUNCION QUE DECIDE CUANDO HAY PLATA. Un deposito ordenado el VIERNES no acredita el
 * sabado. Sin esto la pantalla mostraria saldo disponible un dia antes de que exista, y alguien
 * mandaria a presentar un tramite contra plata que todavia no esta — que es exactamente lo que
 * este sistema viene a evitar.
 *
 * LOS FERIADOS ENTRAN POR PARAMETRO, desde la tabla `feriados`. Con el conjunto vacio cuenta
 * solo sabados y domingos, y entonces un deposito ordenado el jueves anterior a un feriado
 * figura como acreditado un dia antes de lo real. Es un error CONOCIDO y acotado, no silencioso:
 * Administracion avisa hasta donde llega el calendario cargado, con `revisarCobertura`.
 */
export function proximoDiaHabil(feriados: ReadonlySet<string>, desde: Date = new Date()): string {
  return sumarDiasHabiles(aFechaArgentina(desde), 1, feriados);
}

/**
 * ============================================================================
 *  SUMA DIAS HABILES A UNA FECHA. Es la aritmética del reloj del sistema.
 * ============================================================================
 *
 *  `desde` y lo que devuelve son días de calendario argentinos, `YYYY-MM-DD`. Se trabaja sobre
 *  la medianoche UTC de cada día para que no haya ninguna hora en el medio: acá no existen las
 *  horas, existen los días, y meter horas es como se corren los cálculos.
 *
 *  ============================================================================
 *   LOS FERIADOS ENTRAN POR PARAMETRO Y NO SE CALCULAN
 *  ============================================================================
 *
 *  Los feriados argentinos NO son calculables. Los trasladables se mueven por decreto, los
 *  puentes turísticos se fijan cada año en el Boletín Oficial, y Carnaval y Viernes Santo
 *  dependen de la Pascua. Una función que los "calcule" va a estar bien tres años y mal el
 *  cuarto, y el año que esté mal nadie lo va a notar hasta que un trámite venza tarde.
 *
 *  Entonces salen de la tabla `feriados` y llegan acá como un conjunto de `YYYY-MM-DD`.
 *
 *  QUE PASA SI EL CONJUNTO ESTA VACIO: cuenta sólo sábados y domingos, y da un resultado
 *  OPTIMISTA — una fecha anterior a la real. Por eso Administración avisa hasta dónde llega el
 *  calendario cargado, con `revisarCobertura` en `plazos.ts`: un año a medio cargar hace que la
 *  app diga que la plata entra un día antes de que entre.
 *
 *  El día 0 es `desde`: sumar un día hábil a un viernes da el lunes siguiente.
 */
export function sumarDiasHabiles(
  desde: string,
  dias: number,
  feriados: ReadonlySet<string>,
): string {
  if (!Number.isInteger(dias) || dias < 0) {
    throw new RangeError(`Días hábiles inválidos: ${String(dias)}`);
  }

  const d = new Date(`${desde}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) throw new TypeError(`Fecha mal escrita: ${JSON.stringify(desde)}`);

  let faltan = dias;
  while (faltan > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (esHabil(d, feriados)) faltan -= 1;
  }
  return aISO(d);
}

/** Sábado, domingo o feriado, no. Se mira en UTC porque el `Date` es la medianoche UTC del día. */
function esHabil(d: Date, feriados: ReadonlySet<string>): boolean {
  const dia = d.getUTCDay();
  if (dia === 0 || dia === 6) return false;
  return !feriados.has(aISO(d));
}

/** `YYYY-MM-DD` de un `Date` que representa la medianoche UTC de ese día. */
function aISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}
