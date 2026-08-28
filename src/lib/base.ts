/**
 * ============================================================================
 *  SI DESARROLLO Y PRODUCCION COMPARTEN LA MISMA BASE
 * ============================================================================
 *
 * Mientras la respuesta sea `true`, la app lo dice en pantalla. Es regla del CLAUDE.md y no es
 * cortesía: un riesgo conocido que no se ve, se olvida — y el día que esto tenga saldos reales,
 * una prueba destructiva los tocaría.
 *
 * ============================================================================
 *  POR QUE SE CALCULA Y NO ES UNA CONSTANTE
 * ============================================================================
 *
 * Hasta el 28/08/2026 el cartel era un texto fijo en el `Shell`. El día que las bases se separen,
 * alguien tendría que acordarse de sacarlo — y ese alguien no se va a acordar, porque el cartel no
 * molesta a nadie.
 *
 * Un cartel que dice "esto es de prueba" en producción es PEOR que no tenerlo: enseña a ignorar
 * los carteles, y el siguiente que aparezca —uno que importe— también se va a ignorar.
 *
 * ============================================================================
 *  POR QUE VIVE SOLO, SIN IMPORTAR NADA
 * ============================================================================
 *
 * Porque su prueba tiene que poder correr sin credenciales. Estaba dentro de `supabase.ts`, que
 * crea el cliente al cargarse y lanza si faltan las variables de entorno: el guardián de pruebas
 * lo marcó en rojo. Es el mismo corte que ya tienen `novedades.ts` y `cola.ts`.
 *
 * El instructivo completo está en `docs/SEGUNDA-BASE.md`.
 */
export function esLaMismaBase(usando: string, produccion: string | undefined): boolean {
  if (produccion === undefined || produccion.trim() === "") return true;
  return produccion.trim() === usando.trim();
}
