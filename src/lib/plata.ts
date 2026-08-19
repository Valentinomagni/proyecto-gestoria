/**
 * ============================================================================
 *  LA PLATA. Todo importe pasa por acá y no hay excepciones.
 * ============================================================================
 *
 *  EN POSTGRES la plata es `numeric(14,2)`, que es exacto.
 *  EN JAVASCRIPT la plata son CENTAVOS ENTEROS, y nunca decimales.
 *
 *  POR QUE. En JavaScript `1234.10` no es exactamente 1234,10: es el doble mas cercano. Sobre
 *  un importe suelto no se nota; sumando miles de movimientos para mostrar un saldo, deriva. Y
 *  deriva de la peor forma posible: una diferencia de centavos que nadie puede explicar, en la
 *  pantalla que se usa para decidir si se manda a presentar un tramite.
 *
 *  Un saldo que no cierra por dos centavos destruye la confianza en el sistema entero, y con
 *  razon. Por eso este modulo es uno solo, y por eso hay guardian.
 *
 *  LOS CENTAVOS ENTRAN EN UN ENTERO SEGURO, con margen de sobra: el pago mas caro del listado
 *  real es $ 1.294.511,00, o sea 129.451.100 centavos, y el entero seguro de JavaScript llega
 *  a 9.007.199.254.740.991. Aun asi se comprueba, porque el dia que no entre hay que enterarse
 *  con una excepcion y no con un numero equivocado.
 */

/** Tope de seguridad. Mas alla de esto la aritmetica entera de JavaScript deja de ser exacta. */
function exigirEnteroSeguro(centavos: number, origen: unknown): number {
  if (!Number.isSafeInteger(centavos)) {
    throw new RangeError(`Importe fuera del rango seguro: ${String(origen)}`);
  }
  return centavos;
}

/** Formato en el que Postgres y PostgREST escriben un numeric: punto decimal, sin separadores. */
const DECIMAL_SQL = /^-?\d+(\.\d+)?$/;

/**
 * Cruza el borde de la base hacia adentro: lo que venga de PostgREST -> centavos enteros.
 *
 * Acepta numero Y texto a proposito: al 19/08/2026 **no esta verificado** si PostgREST
 * serializa un `numeric` como numero JSON o como texto, y depende de la version. Aceptar las
 * dos formas hace que la duda no bloquee, y el dia que se compruebe no hay que tocar nada.
 *
 * Un valor ausente vale cero, no NaN: un NaN contamina toda la suma sin dejar rastro y el
 * total sale NaN sin que nadie sepa de donde salio.
 */
export function aCentavos(v: number | string | null | undefined): number {
  if (v === null || v === undefined) return 0;

  if (typeof v === "number") {
    if (!Number.isFinite(v)) throw new RangeError(`Importe no finito: ${String(v)}`);
    return exigirEnteroSeguro(Math.round(v * 100), v);
  }

  const t = v.trim();
  if (t === "") return 0;
  if (!DECIMAL_SQL.test(t)) throw new TypeError(`No es un importe: ${JSON.stringify(v)}`);
  return exigirEnteroSeguro(Math.round(Number(t) * 100), v);
}

/** Vuelve a decimal para escribir en un `numeric` de Postgres. Sin pasar por coma flotante. */
export function aDecimal(centavos: number): string {
  exigirEnteroSeguro(centavos, centavos);
  const signo = centavos < 0 ? "-" : "";
  const abs = Math.abs(centavos);
  return `${signo}${Math.trunc(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/** Suma exacta. Es aritmetica entera: no hay nada que pueda derivar. */
export function sumar(...centavos: number[]): number {
  let total = 0;
  for (const c of centavos) total += c;
  return exigirEnteroSeguro(total, centavos);
}

const MILES = new Intl.NumberFormat("es-AR");

/**
 * Centavos -> `$ 2.505.627,92`.
 *
 * La parte entera y los centavos se arman POR SEPARADO, sin dividir por cien en ningun momento:
 * si se convirtiera a decimal para formatear, se volveria a meter la coma flotante justo en el
 * ultimo paso, que es donde menos se la ve venir.
 *
 * El negativo va con el signo adelante y NO entre parentesis: el saldo negativo se muestra, no
 * se disimula. El pedido dice que intentan tener siempre dinero disponible; taparlo seria sacar
 * justo la senal que importa.
 */
export function formatear(centavos: number): string {
  exigirEnteroSeguro(centavos, centavos);
  const signo = centavos < 0 ? "-" : "";
  const abs = Math.abs(centavos);
  const entero = MILES.format(Math.trunc(abs / 100));
  return `${signo}$ ${entero},${String(abs % 100).padStart(2, "0")}`;
}

/**
 * Lo que escribe una persona -> centavos. Formato argentino: punto de miles, coma decimal.
 *
 * Devuelve null cuando no se entiende, en vez de adivinar. Adivinar un importe es exactamente
 * lo que no puede hacer este sistema.
 *
 * Acepta las dos formas que conviven en el cuaderno de la gestora: `1.100.000` y `1100000`.
 */
export function parsear(texto: string): number | null {
  const limpio = texto.replaceAll(/[$\s ]/g, "");
  if (limpio === "") return null;

  const partes = limpio.split(",");
  if (partes.length > 2) return null;

  const [enteroCrudo, decimalCrudo] = partes;
  const entero = (enteroCrudo ?? "").replaceAll(".", "");
  if (!/^-?\d+$/.test(entero)) return null;

  // Mas de dos decimales no es un importe. Se rechaza en vez de redondear: cambiar en silencio
  // lo que alguien escribio es peor que decirle que lo escriba de nuevo.
  if (decimalCrudo !== undefined && !/^\d{1,2}$/.test(decimalCrudo)) return null;

  const centavos = decimalCrudo === undefined ? 0 : Number(decimalCrudo.padEnd(2, "0"));
  const negativo = entero.startsWith("-");
  const pesos = Number(negativo ? entero.slice(1) : entero);
  const total = pesos * 100 + centavos;
  return exigirEnteroSeguro(negativo ? -total : total, texto);
}

/**
 * Centavos enteros -> el numero que espera una columna `numeric` de Postgres.
 *
 * POR QUE EXISTE ESTA FUNCION EN VEZ DE UN `/ 100` EN LA PANTALLA: el guardian prohibe dividir
 * importes fuera de este modulo, y con razon. Toda conversion entre pesos y centavos vive aca,
 * en un solo lugar donde se puede revisar de una sola mirada.
 *
 * La division es exacta para cualquier importe dentro del rango seguro: los centavos son un
 * entero y dividir por cien un entero menor a 2^53 no pierde nada relevante para dos decimales.
 */
export function aPesos(centavos: number): number {
  exigirEnteroSeguro(centavos, centavos);
  return centavos / 100;
}

/**
 * ============================================================================
 *  Lo que escribio una persona -> el numero que va a la base. Null si no se entiende.
 * ============================================================================
 *
 *  EXISTE POR UN DEFECTO QUE COSTO UN FACTOR DE MIL, encontrado el 19/08/2026 mirando la
 *  pantalla y no testeando.
 *
 *  La ficha del tramite guardaba el deposito con `Number(texto)`. Se escribio `600.000` en el
 *  campo —seiscientos mil, como se escribe en castellano— y el sistema reservo SEISCIENTOS
 *  PESOS: para `Number()` el punto es el separador decimal, no el de miles. Sin error, sin
 *  advertencia, y con el trámite avanzando como si la plata estuviera comprometida.
 *
 *  El modulo de plata ya tenia `parsear`, que lo hace bien. El problema fue que ese camino
 *  existia y NO se uso: entre `parsear(t)` y `Number(t)` no habia nada que empujara al
 *  correcto. Esta funcion es ese empujon —un solo paso del texto al numero de la base— y el
 *  guardian ahora marca en rojo cualquier `Number()` que termine en un campo de plata.
 */
export function pesosDesdeTexto(texto: string): number | null {
  const centavos = parsear(texto);
  return centavos === null ? null : aPesos(centavos);
}
