// El paquete NO tiene entrada raiz: hay que pedir el punto de entrada del navegador. El de
// `/node` arrastra `fs` y no compila para el navegador; el de `/universal` trae los dos.
import escribirXlsx, { type CellObject, type SheetData } from "write-excel-file/browser";
import { aCentavos, aPesos } from "./plata";
import { aFechaDeExcel, hoyArgentina } from "./fechas";

/**
 * ============================================================================
 *  LA EXPORTACION A EXCEL. El único módulo que arma una planilla.
 * ============================================================================
 *
 *  POR QUE EXISTE, y no es una concesión. Hoy la operación vive en una planilla de más de 6.800
 *  filas. Un sistema que se lleva los datos adentro y no los deja salir no reemplaza al Excel:
 *  lo reemplaza a medias, y a medias es peor —porque ahora hay dos lugares—. Poder bajar lo que
 *  se está mirando es lo que hace que nadie tenga que mantener la planilla "por las dudas".
 *
 *  ============================================================================
 *   LAS DOS DECISIONES QUE DECIDEN SI EL ARCHIVO SIRVE
 *  ============================================================================
 *
 *  1. LA PLATA VA COMO NUMERO, con formato de miles. No como el texto "$ 450.000,00".
 *     Exportar importes como texto es el error clásico y arruina el archivo entero: no se
 *     pueden sumar, no se pueden ordenar, y la contadora termina retipeando la columna —que es
 *     exactamente el trabajo que este sistema vino a sacar—. El valor pasa por centavos enteros
 *     y vuelve, así que lo que se escribe tiene dos decimales exactos y nunca 449999.99999.
 *
 *  2. LA FECHA VA COMO FECHA, con el día calendario argentino. Ver `aFechaDeExcel`.
 *
 *  ============================================================================
 *   Y LA REGLA QUE NO ESTA EN EL CODIGO
 *  ============================================================================
 *
 *  Genchi genbutsu: **este archivo se abre y se mira**. Que el test pase no dice nada sobre si
 *  las columnas quedaron legibles, si los títulos se entienden o si la plata se ve como plata.
 *  En el Estudio Magni los tres peores defectos se encontraron mirando, no testeando.
 */

/** Formato de importe argentino dentro de la celda. Excel lo muestra con la coma decimal local. */
const FORMATO_PLATA = "#,##0.00";
const FORMATO_FECHA = "dd/mm/yyyy";

/** Lo que necesita una fila. Es a propósito lo mínimo, para no atar la exportación a la pantalla. */
export interface FilaExportable {
  recibido_at: string;
  cliente_nombre: string;
  cliente_cuenta: string | null;
  oferta_referencia: string | null;
  vehiculo: string | null;
  dominio: string | null;
  tipo: string;
  subtipo: string | null;
  estado: string;
  seccional: string | null;
  numero_pago_registro: string | null;
  administrativo: string | null;
  deposito_solicitado: number | null;
}

/** Cómo se llama cada columna EN CASTELLANO, y de dónde sale. */
interface Columna {
  titulo: string;
  ancho: number;
  /** El valor de la celda, ya listo para escribir. */
  celda: (f: FilaExportable, nombres: Nombres) => CellObject;
}

/** Los diccionarios que traducen los códigos internos a lo que lee una persona. */
export interface Nombres {
  estado: (v: string) => string;
  tipo: (v: string) => string;
  subtipo: (v: string | null) => string;
}

const texto = (v: string | null): CellObject => ({ value: v ?? "", type: String });

/**
 * Un importe. Sin importe, celda VACIA y no un cero.
 *
 * Cero y "todavia no se pidio deposito" no son lo mismo, y en una columna que despues se suma
 * la diferencia se nota: los ceros no cambian el total pero si el promedio y la cuenta de
 * cuantos hay. La celda vacia dice la verdad, que es que no hay dato.
 */
const plata = (v: number | null): CellObject =>
  v === null
    ? { type: Number, format: FORMATO_PLATA }
    : { value: aPesos(aCentavos(v)), type: Number, format: FORMATO_PLATA };

const COLUMNAS: Columna[] = [
  { titulo: "Fecha", ancho: 12, celda: (f) => ({ value: aFechaDeExcel(f.recibido_at), type: Date, format: FORMATO_FECHA }) },
  { titulo: "Cliente", ancho: 30, celda: (f) => texto(f.cliente_nombre) },
  { titulo: "Cuenta personal", ancho: 16, celda: (f) => texto(f.cliente_cuenta) },
  { titulo: "Referencia de oferta", ancho: 20, celda: (f) => texto(f.oferta_referencia) },
  { titulo: "Vehículo", ancho: 24, celda: (f) => texto(f.vehiculo) },
  { titulo: "Dominio", ancho: 12, celda: (f) => texto(f.dominio) },
  { titulo: "Tipo", ancho: 26, celda: (f, n) => texto(n.tipo(f.tipo)) },
  { titulo: "Modalidad", ancho: 16, celda: (f, n) => texto(n.subtipo(f.subtipo)) },
  { titulo: "Estado", ancho: 20, celda: (f, n) => texto(n.estado(f.estado)) },
  { titulo: "Seccional", ancho: 18, celda: (f) => texto(f.seccional) },
  { titulo: "N° de pago", ancho: 16, celda: (f) => texto(f.numero_pago_registro) },
  { titulo: "Administrativo a cargo", ancho: 22, celda: (f) => texto(f.administrativo) },
  { titulo: "Depósito solicitado", ancho: 20, celda: (f) => plata(f.deposito_solicitado) },
];

/**
 * Arma la planilla y la baja.
 *
 * Devuelve cuántas filas escribió: quien llama muestra ese número. "Se bajaron 43 trámites" es
 * verificable de un vistazo contra lo que hay en pantalla; "Listo" no dice si salieron todos.
 */
export async function bajarTramites(
  filas: FilaExportable[],
  nombres: Nombres,
): Promise<number> {
  const encabezado: CellObject[] = COLUMNAS.map((c) => ({
    value: c.titulo,
    type: String,
    fontWeight: "bold" as const,
  }));

  const hoja: SheetData = [encabezado, ...filas.map((f) => celdasDeFila(f, nombres))];

  // La version 4 del paquete ya NO recibe `fileName`: devuelve `toBlob()` y `toFile(nombre)`.
  await escribirXlsx(hoja, {
    // La primera fila queda fija: con 6.800 filas, sin esto se pierde de vista qué columna es cuál.
    stickyRowsCount: 1,
    columns: COLUMNAS.map((c) => ({ width: c.ancho })),
    sheet: "Trámites",
  }).toFile(`tramites-${hoyArgentina()}.xlsx`);

  return filas.length;
}

/**
 * Las celdas de una fila, ya con su tipo y su formato.
 *
 * ESTA SEPARADO PARA PODER PROBARLO. La division es a proposito: acá está TODO lo que este
 * proyecto puede equivocar —qué tipo lleva cada celda, con qué formato y qué día de calendario—
 * y del otro lado queda armar el zip, que es trabajo de la librería.
 *
 * El zip se comprobó UNA VEZ a mano, abriendo el archivo y leyendo el XML: la fecha salió con
 * `numFmtId` de `dd/mm/yyyy`, el importe con `#,##0.00`, el encabezado en negrita y la primera
 * fila congelada. Se vuelve a hacer así el día que se actualice la librería.
 */
export function celdasDeFila(f: FilaExportable, nombres: Nombres): CellObject[] {
  return COLUMNAS.map((c) => c.celda(f, nombres));
}

/** Los títulos, en orden. Exportado para que el test compruebe contra qué columna es cada celda. */
export const TITULOS: string[] = COLUMNAS.map((c) => c.titulo);
