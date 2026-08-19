/**
 * ============================================================================
 *  Lo que la pantalla recuerda entre visitas. Preferencias, NUNCA datos.
 * ============================================================================
 *
 *  QUE VA ACA: qué tarjeta estaba mirando, qué filtro había puesto. Cosas que si se pierden
 *  sólo molestan.
 *
 *  QUE NO VA ACA, y es la regla dura: ningún dato de un trámite, ningún importe, ningún nombre
 *  de cliente, ningún token. El almacenamiento del navegador queda en la computadora, sobrevive
 *  al cierre de sesión y lo lee cualquiera que se siente en ese escritorio. Guardar ahí algo de
 *  una persona sería sacar el dato de adentro de la RLS, que es lo único que lo protege.
 *
 *  POR QUE EXISTE. Se vio trabajando: la pantalla de la Tarjeta volvía siempre a la primera de
 *  la lista, así que quien trabaja todo el día con una razón social tenía que elegirla de nuevo
 *  cada vez que iba y volvía. Una fricción chica repetida treinta veces por día es de las que
 *  hacen que se vuelva a la planilla.
 *
 *  POR QUE ENVUELTO Y NO `localStorage` DIRECTO: en navegación privada, con las cookies
 *  bloqueadas o con el disco lleno, `localStorage` LANZA en vez de devolver null. Una
 *  preferencia que no se pudo guardar no puede tumbar la pantalla del saldo.
 */

const PREFIJO = "gestoria.";

export function recordar(clave: string, valor: string): void {
  try {
    window.localStorage.setItem(PREFIJO + clave, valor);
  } catch {
    // Sin memoria se trabaja igual: se pierde la comodidad, no la función.
  }
}

export function recordado(clave: string): string | null {
  try {
    return window.localStorage.getItem(PREFIJO + clave);
  } catch {
    return null;
  }
}
