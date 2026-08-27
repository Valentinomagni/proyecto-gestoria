/**
 * ============================================================================
 *  LOS PLAZOS: HOY SOLO SE CONFIGURAN, NO SE MUESTRAN POR TRAMITE
 * ============================================================================
 *
 *  Este modulo llego a calcular vencimientos por tramite. El 21/08/2026 se saco ese panel de la
 *  ficha a pedido del usuario: con tres de los cinco plazos sin confirmar y los feriados sin
 *  cargar, no mostraba fechas — mostraba cinco renglones explicando que faltaba para poder
 *  mostrarlas. Media pantalla ocupada por un cartel de "todavia no".
 *
 *  ============================================================================
 *   LO QUE QUEDA, Y POR QUE SIGUE HACIENDO FALTA
 *  ============================================================================
 *
 *  `revisarCobertura`, que es lo que Administracion usa para avisar hasta donde llega el
 *  calendario de feriados cargado. Eso SI sirve hoy, aunque no haya vencimientos: la fecha de
 *  acreditacion de un deposito depende de los feriados —la calcula `proximoDiaHabil`— y un
 *  calendario que se quedo corto hace que la app diga que la plata entra un dia antes de que
 *  entre. O sea que sigue cuidando plata, que es lo unico que este archivo tiene que hacer.
 *
 *  ============================================================================
 *   LO QUE SE FUE, PARA QUE SE SEPA QUE SE PERDIO
 *  ============================================================================
 *
 *  `calcular`, `plazoDe`, `plazosDeTipo`, `inicioDe`, el tipo `Vencimiento` y los tipos `Plazo`
 *  y `Calendario`, con sus once tests. Los cuatro mas valiosos no probaban que calculara bien:
 *  probaban que SE NEGARA bien —sin plazo confirmado, sin fecha de inicio, con el calendario
 *  vacio, o con un vencimiento mas alla de donde llega el calendario—. Un sistema que avisa un
 *  vencimiento equivocado es peor que uno que no avisa nada, porque el primero se deja de mirar.
 *
 *  Administracion sigue confirmando plazos y cargando feriados, con su propia forma (`FilaPlazo`,
 *  en Calendario.tsx): esa incluye los plazos SIN confirmar, que es justo lo que esa pantalla
 *  necesita y lo que el calculo, a proposito, no podia ver.
 *
 *  Esta todo en el historial de git. Si vuelven los vencimientos, vuelven con esas pruebas: son
 *  mas valiosas que el calculo.
 */

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
