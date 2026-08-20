import { diasHabilesEntre, hoyArgentina, sumarDiasCorridos, sumarDiasHabiles } from "./fechas";

/**
 * ============================================================================
 *  LOS VENCIMIENTOS. Este módulo es el único que calcula uno.
 * ============================================================================
 *
 *  "Cada trámite es un reloj con plata adentro." Un trámite frenado no es una demora: es un
 *  recargo. Esto calcula el reloj.
 *
 *  ============================================================================
 *   LO QUE ESTE MODULO HACE MEJOR QUE CALCULAR: NEGARSE
 *  ============================================================================
 *
 *  **Un sistema que avisa un vencimiento equivocado es PEOR que uno que no avisa nada**, porque
 *  el primero se deja de mirar. Y una sola fecha mal calculada tira abajo la confianza en todas
 *  las demás, incluidas las que estaban bien.
 *
 *  Por eso `calcular` devuelve CUATRO respuestas posibles y tres de ellas son "no sé", cada una
 *  con su motivo distinto y accionable:
 *
 *    `vence`            -> la fecha, cuántos días hábiles faltan y qué pasa si se pasa.
 *    `sin_confirmar`    -> el plazo existe pero nadie lo verificó todavía. Falta preguntarle a
 *                          una gestora. NO se muestra ninguna cuenta regresiva.
 *    `sin_inicio`       -> el reloj arranca con un dato que todavía no está cargado. Por
 *                          ejemplo la fecha de certificación de la primera firma del 08, que la
 *                          hace un escribano fuera del sistema.
 *    `sin_calendario`   -> el plazo cae más allá de donde llega el calendario de feriados
 *                          cargado, así que el cálculo sería optimista. Falta cargar feriados.
 *
 *  Las tres negativas dicen QUE FALTA, no "no se puede". Un mensaje que no dice qué hacer es
 *  igual de inútil que no mostrar nada.
 *
 *  ============================================================================
 *   POR QUE EL CALENDARIO SE COMPRUEBA, Y NO SE CONFIA
 *  ============================================================================
 *
 *  `sumarDiasHabiles` con pocos feriados cargados devuelve una fecha ANTERIOR a la real: cuenta
 *  menos días no hábiles de los que hay. O sea que el error va justo para el lado que hace daño
 *  —avisar que vence antes, y peor, dar por vencido algo que no venció—. Comprobar la cobertura
 *  antes de mostrar es lo que impide eso.
 */

/** Un plazo, como sale de `v_plazos_usables`. Sólo llegan acá los verificados. */
export interface Plazo {
  clave: string;
  nombre: string;
  aplica_a: string;
  desde: string;
  dias: number;
  habiles: boolean;
  consecuencia: string;
  norma: string | null;
  verificado_el: string;
  verificado_por: string;
}

/** Hasta dónde llega el calendario de feriados que se cargó. */
export interface Calendario {
  feriados: ReadonlySet<string>;
  /** El último día cubierto, `YYYY-MM-DD`. Más allá de acá el cálculo no es confiable. */
  cubreHasta: string | null;
}

export type Vencimiento =
  | {
      estado: "vence";
      fecha: string;
      diasHabilesRestantes: number;
      vencido: boolean;
      plazo: Plazo;
    }
  | { estado: "sin_confirmar"; queFalta: string }
  | { estado: "sin_inicio"; queFalta: string }
  | { estado: "sin_calendario"; queFalta: string };

/**
 * El vencimiento de un plazo para un trámite.
 *
 * @param plazo   El plazo verificado. `null` si el que corresponde todavía no se confirmó.
 * @param inicio  El día en que arranca el reloj, `YYYY-MM-DD`. `null` si ese dato no está.
 */
export function calcular(
  plazo: Plazo | null,
  inicio: string | null,
  calendario: Calendario,
  hoy: string = hoyArgentina(),
): Vencimiento {
  if (plazo === null) {
    return {
      estado: "sin_confirmar",
      queFalta:
        "Este plazo todavía no está confirmado. Lo confirma gerencia desde Administración, " +
        "y quien mejor lo sabe son las gestoras: lo viven todos los días.",
    };
  }

  if (inicio === null || inicio === "") {
    return {
      estado: "sin_inicio",
      queFalta: `Falta cargar la fecha desde la que corre el plazo de ${plazo.nombre.toLowerCase()}.`,
    };
  }

  const fecha = plazo.habiles
    ? sumarDiasHabiles(inicio, plazo.dias, calendario.feriados)
    : sumarDiasCorridos(inicio, plazo.dias);

  // La comprobación de cobertura va DESPUES de calcular, porque hay que saber hasta dónde llegó
  // para saber si el calendario alcanzaba. Sólo aplica a los plazos en días hábiles: los
  // corridos no dependen de los feriados.
  if (plazo.habiles && (calendario.cubreHasta === null || fecha > calendario.cubreHasta)) {
    return {
      estado: "sin_calendario",
      queFalta:
        `El plazo cae alrededor del ${fecha}, y el calendario de feriados cargado ` +
        (calendario.cubreHasta === null
          ? "está vacío."
          : `llega hasta el ${calendario.cubreHasta}.`) +
        " Sin eso la fecha saldría antes de la real. Se cargan en Administración.",
    };
  }

  return {
    estado: "vence",
    fecha,
    diasHabilesRestantes: diasHabilesEntre(hoy, fecha, calendario.feriados),
    vencido: fecha < hoy,
    plazo,
  };
}

/** Elige, de los plazos usables, el que corresponde a un tipo de trámite. */
export function plazoDe(plazos: readonly Plazo[], clave: string): Plazo | null {
  return plazos.find((p) => p.clave === clave) ?? null;
}

/** Los plazos que le corren a un trámite de este tipo. */
export function plazosDeTipo(plazos: readonly Plazo[], tipo: string): Plazo[] {
  return plazos.filter((p) => p.aplica_a === "todos" || p.aplica_a === tipo);
}

/**
 * De dónde sale el día en que arranca el reloj de un plazo.
 *
 * ============================================================================
 *  LO QUE NO ESTA CARGADO DEVUELVE null, Y ESO NO ES UNA FALLA
 * ============================================================================
 *
 * Varios plazos arrancan con un hecho que ocurre FUERA de este sistema: la certificación de la
 * primera firma de un 08 la hace un escribano, la verificación policial la hace la policía, y
 * la factura la emite el concesionario. Esas fechas las carga una persona cuando las tiene.
 *
 * Mientras no estén, `calcular` devuelve `sin_inicio` y la pantalla pide ese dato en vez de
 * mostrar una cuenta regresiva inventada desde el día en que el trámite entró al sistema. Usar
 * la fecha equivocada de arranque da un vencimiento equivocado, que es lo único que este
 * módulo no puede hacer.
 */
export function inicioDe(plazo: Plazo, fechas: Readonly<Record<string, string | null>>): string | null {
  return fechas[plazo.desde] ?? null;
}

/**
 * Avisa si la cobertura declarada no parece respaldada por los feriados cargados.
 *
 * NO BLOQUEA, avisa. Quien declara puede tener una razón que el sistema no conoce, y un
 * bloqueo que se equivoca se termina esquivando. Pero lo dice ANTES, que es cuando sirve.
 *
 * El umbral son diez por año: Argentina tiene más de quince entre los fijos, los trasladables
 * y los puentes turísticos. Menos de diez en un año declarado es, con mucha probabilidad, un
 * año a medio cargar — y un año a medio cargar produce vencimientos ANTES de lo real.
 */
export function revisarCobertura(
  feriados: ReadonlySet<string>,
  cubreHasta: string | null,
): string | null {
  if (cubreHasta === null) return null;

  const porAnio = new Map<string, number>();
  for (const f of feriados) {
    const anio = f.slice(0, 4);
    porAnio.set(anio, (porAnio.get(anio) ?? 0) + 1);
  }

  const flacos = [...porAnio.entries()]
    .filter(([anio, n]) => n < 10 && anio <= cubreHasta.slice(0, 4))
    .map(([anio, n]) => `${anio} tiene ${n}`);

  // El año declarado sin ningún feriado es el caso más grave, y no aparece en el recuento.
  const anioDeclarado = cubreHasta.slice(0, 4);
  if (!porAnio.has(anioDeclarado)) flacos.push(`${anioDeclarado} no tiene ninguno`);

  if (flacos.length === 0) return null;

  return (
    `Declaraste el calendario hasta el ${cubreHasta}, pero ${flacos.join(" y ")}. ` +
    "En Argentina hay más de quince feriados por año entre los fijos, los trasladables y los " +
    "puentes turísticos. Si falta alguno, los vencimientos van a salir ANTES de lo real."
  );
}
