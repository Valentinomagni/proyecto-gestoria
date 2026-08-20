/**
 * ============================================================================
 *  LAS NOVEDADES: QUE LOS CAMBIOS DE UN TRAMITE LLEGUEN SOLOS
 * ============================================================================
 *
 *  El pedido: anunciar las modificaciones de los trámites. Adentro de la app y en vivo — un
 *  correo necesita contratar un servicio y configurar un dominio, y WhatsApp necesita la API de
 *  Business con plantillas aprobadas. Las dos son otra etapa.
 *
 *  ============================================================================
 *   QUE SE AVISA Y QUE NO
 *  ============================================================================
 *
 *  Se avisa cada PASO de la cadena: que un trámite pasó a controlado, a presentado, a pagado.
 *  Eso es lo que la otra persona necesita saber para poder seguir.
 *
 *  NO se avisa cada tecla ni cada campo que alguien corrige. Un aviso por cada cosa es ruido, y
 *  el ruido entrena a ignorar también los avisos que importan — que es exactamente cómo se
 *  apaga un sistema de alertas.
 *
 *  ============================================================================
 *   NO SE AVISAN LOS CAMBIOS PROPIOS
 *  ============================================================================
 *
 *  Quien acaba de mover un trámite ya sabe que lo movió. Avisárselo es la forma más rápida de
 *  que la campana pierda sentido.
 *
 *  ============================================================================
 *   Y LA RLS DECIDE QUE LLEGA
 *  ============================================================================
 *
 *  Realtime respeta las policies, así que una gestora sólo recibe eventos de trámites que puede
 *  ver. Eso no se programa acá y no se puede olvidar: sale de que la policy de lectura ya dice
 *  lo correcto.
 *
 *  ============================================================================
 *   ESTE ARCHIVO NO TOCA LA BASE, Y ES A PROPOSITO
 *  ============================================================================
 *
 *  Acá viven las dos decisiones que se pueden equivocar —qué es nuevo y hasta dónde marcar— y
 *  nada más. La suscripción en vivo vive en `datos.ts`, con el resto de las consultas.
 *
 *  No es prolijidad: `supabase.ts` LANZA al importarse si faltan las variables de entorno, así
 *  que un archivo que lo arrastre no se puede probar sin credenciales. Hay un guardián que lo
 *  impide, y lo agarró apenas se escribió esto.
 */

export interface Novedad {
  id: number;
  tramiteId: string;
  estado: string;
  cuando: string;
}

/** Donde se recuerda hasta donde se miro. Lo usa el hook, en `datos.ts`. */
export const CLAVE_VISTO = "novedades.visto";

/**
 * Suma una novedad a la lista, SIN REPETIRLA y con un tope.
 *
 * ============================================================================
 *  POR QUE DEDUPLICAR, Y POR QUE NO ES LO QUE PARECIA
 * ============================================================================
 *
 * Al probar esto en pantalla, la campana marcó TRES por lo que parecía un solo cambio. Se
 * investigó pensando que llegaba repetido — y no: eran tres trámites distintos con el mismo
 * nombre, que un `update` de prueba movió a los tres. La campana decía la verdad.
 *
 * Queda escrito porque el diagnóstico equivocado sobrevive más que el bueno: quien lea esto
 * dentro de un año no tiene que volver a sospechar de Realtime.
 *
 * ENTONCES POR QUE DEDUPLICAR IGUAL. Por dos motivos que no se vieron pero que son ciertos:
 *   - en desarrollo React monta los efectos dos veces a propósito, así que se abren dos
 *     suscripciones al mismo canal;
 *   - y en producción, cuando se corta el internet y vuelve, Realtime reconecta y puede
 *     reenviar lo que ya mandó.
 *
 * Un contador que dice tres cuando pasó una cosa es peor que no tener contador: la próxima vez
 * que diga tres, nadie le va a creer. Deduplicar por `id` cierra las dos puertas y no depende
 * de contar suscripciones.
 *
 * El tope de 50 es aparte: una campana con doscientas líneas no se lee.
 */
export function sumarNovedad(antes: readonly Novedad[], nueva: Novedad, tope = 50): Novedad[] {
  if (antes.some((n) => n.id === nueva.id)) return [...antes];
  return [nueva, ...antes].slice(0, tope);
}

/** Cuántas de la lista son posteriores a la última vez que se miró. */
export function contarSinVer(lista: readonly Novedad[], desde: string | null): number {
  if (desde === null) return lista.length;
  return lista.filter((n) => n.cuando > desde).length;
}

/**
 * Hasta dónde marcar como visto.
 *
 * SE MARCA CON LA HORA DEL ULTIMO EVENTO Y NO CON "AHORA". Si llega una novedad justo mientras
 * el panel está abierto, marcar con la hora actual la daría por vista sin que nadie la haya
 * leído. Con la lista vacía no hay nada que marcar y se devuelve lo que ya estaba.
 */
export function hastaDondeMarcar(lista: readonly Novedad[], visto: string | null): string | null {
  return lista[0]?.cuando ?? visto;
}
