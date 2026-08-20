/**
 * ============================================================================
 *  RESPALDO. La lista de tablas NO se mantiene: SE DERIVA.
 * ============================================================================
 *
 *  ============================================================================
 *   ESTE MODULO NO IMPORTA EL CLIENTE DE SUPABASE, Y ES A PROPOSITO
 *  ============================================================================
 *
 *  Lo importaba, y eso mantuvo el CI EN ROJO DESDE LA PRIMERA CORRIDA sin que nadie lo notara.
 *  `supabase.ts` lanza al importarse si faltan las variables de entorno —lo cual esta bien, es
 *  fallar fuerte y temprano—, pero en CI no hay `.env.local`, asi que el archivo de pruebas de
 *  este modulo explotaba antes de correr un solo test. En la maquina de quien programa pasaba,
 *  porque ahi el archivo existe.
 *
 *  Ese es el defecto de fondo y no el import: **un portón que solo funciona en una maquina no
 *  es un porton**. La leccion vale mas que el arreglo.
 *
 *  Entonces `armarRespaldo` RECIBE con que leer. Este modulo decide QUE tablas, en que orden y
 *  como se anota una que fallo; leerlas es trabajo de otro. De paso queda probable sin red.
 *
 *  POR QUE, y es un defecto documentado del Tablero Contable: alla el respaldo recorre un
 *  arreglo de siete nombres escrito a mano en el codigo de la pantalla. Su propia documentacion
 *  lo advierte, textual: "si agregas una tabla nueva y no la sumas ahi, el backup no la
 *  incluye". Y ya se le escapa una: `task_occurrences`, que guarda los arqueos.
 *
 *  Un respaldo incompleto es peor que ninguno, porque genera la confianza de tener uno. Aca la
 *  lista sale de los tipos que el CLI genera desde el esquema real, asi que una tabla nueva
 *  entra sola. Y hay un test que compara contra la base y falla si algo quedo afuera.
 *
 *  ============================================================================
 *  LO QUE ESTE RESPALDO NO INCLUYE, escrito para que nadie lo suponga
 *  ============================================================================
 *
 *  `auth.users` NO esta. Vive en el esquema `auth`, que la clave publicable no puede leer. El
 *  respaldo trae los PERFILES —nombre, rol, si esta activo— pero NO las cuentas: ni los correos
 *  de acceso, ni las contrasenias, ni nada de la identidad.
 *
 *  Consecuencia practica: restaurar esto en una base vacia deja perfiles apuntando a usuarios
 *  que no existen. Sirve para recuperar DATOS, no para reconstruir el sistema entero. Quien lo
 *  lea dentro de un año tiene que saberlo sin tener que averiguarlo.
 */

export interface Respaldo {
  generado: string;
  por: string;
  tablas: Record<string, unknown[]>;
  errores: Record<string, string>;
}

/**
 * Las tablas del esquema publico, sacadas de los tipos generados.
 *
 * Se lee del tipo `Database` en tiempo de compilacion, no de una lista escrita a mano. El test
 * comprueba contra la base que no falte ninguna.
 */
export function tablasDelEsquema(tipos: { public: { Tables: Record<string, unknown> } }): string[] {
  return Object.keys(tipos.public.Tables).toSorted();
}

/**
 * Arma el respaldo leyendo cada tabla.
 *
 * Si una tabla falla —por permisos, por ejemplo— se guarda el motivo en `errores` y NO se deja
 * un arreglo vacio en su lugar. Un arreglo vacio se lee como "esa tabla no tenia filas", que es
 * mentira, y es exactamente como un respaldo incompleto pasa por completo.
 */
export type LeerTabla = (tabla: string) => Promise<{ data: unknown[] | null; error: { message: string } | null }>;

export async function armarRespaldo(
  leer: LeerTabla,
  tablas: readonly string[],
  por: string,
  ahora: string = new Date().toISOString(),
): Promise<Respaldo> {
  const salida: Respaldo = { generado: ahora, por, tablas: {}, errores: {} };

  // De a una y no todas juntas: son diecisiete tablas y una de ellas puede tener miles de
  // filas. Diecisiete consultas al mismo tiempo contra el plan gratuito es como se consigue
  // que la base corte, y un respaldo que falla por apurado no sirve para nada.
  for (const tabla of tablas) {
    // eslint-disable-next-line no-await-in-loop
    const { data, error } = await leer(tabla);
    if (error) salida.errores[tabla] = error.message;
    else salida.tablas[tabla] = data ?? [];
  }

  return salida;
}

/** Cuantas filas trajo en total. Sirve para comparar contra la base despues de restaurar. */
export function contarFilas(r: Respaldo): number {
  return Object.values(r.tablas).reduce((t, filas) => t + filas.length, 0);
}

/** Un respaldo con errores NO esta completo, aunque tenga filas. */
export function estaCompleto(r: Respaldo): boolean {
  return Object.keys(r.errores).length === 0;
}
