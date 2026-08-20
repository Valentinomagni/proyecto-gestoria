import { useCallback, useState } from "react";

/**
 * ============================================================================
 *  LO QUE SE ESTA CARGANDO NO SE PIERDE AL CAMBIAR DE PANTALLA
 * ============================================================================
 *
 *  EL DEFECTO, dicho por quien lo sufrió en la primera prueba real: "si necesito chequear una
 *  información, tengo que volver a cargar todo". Cada formulario guardaba su estado adentro del
 *  componente, y al navegar React lo desmonta y se lo lleva puesto.
 *
 *  Y no es una molestia menor: el alta tiene que entrar en menos de veinte segundos o vuelve el
 *  cuaderno. Un formulario que hay que llenar dos veces se come ese presupuesto entero, y lo
 *  peor es que castiga justo la conducta correcta — ir a verificar un dato antes de guardarlo.
 *
 *  ============================================================================
 *   POR QUE AL DISCO Y NO MANTENIENDO LA PANTALLA MONTADA
 *  ============================================================================
 *
 *  Guardarlo acá sobrevive además a recargar la página, a que se cierre el navegador sin querer
 *  y a que se corte la luz. Mantener montadas todas las pantallas resuelve menos y cuesta
 *  memoria justo en el teléfono, que es donde menos hay.
 *
 *  ============================================================================
 *   QUE VA ACA Y QUE NO
 *  ============================================================================
 *
 *  Va lo que se está ESCRIBIENDO y todavía no se guardó. No va nada que ya esté en la base: eso
 *  se lee de la base, que es la única que dice la verdad y la única que aplica los permisos.
 *
 *  Es el mismo lugar donde vive `recordar.ts`, y por la misma razón: el almacenamiento del
 *  navegador queda en la computadora, sobrevive al cierre de sesión y lo lee cualquiera que se
 *  siente en ese escritorio. Un borrador de un trámite a medio cargar es aceptable ahí; el
 *  listado completo de clientes no lo sería.
 */

const PREFIJO = "gestoria.borrador.";

/** Lo guardado, o el inicial si no hay nada, si no se entiende, o si el navegador no deja leer. */
export function leerBorrador<T>(clave: string, inicial: T): T {
  try {
    const crudo = window.localStorage.getItem(PREFIJO + clave);
    if (crudo === null) return inicial;
    return JSON.parse(crudo) as T;
  } catch {
    // Un borrador roto —porque cambió la forma del formulario, por ejemplo— devuelve el
    // inicial. Perder un borrador molesta; que rompa la pantalla entera es mucho peor.
    return inicial;
  }
}

export function guardarBorrador<T>(clave: string, valor: T): void {
  try {
    window.localStorage.setItem(PREFIJO + clave, JSON.stringify(valor));
  } catch {
    // Sin lugar para guardar se trabaja igual: se pierde la comodidad, no la función. En
    // navegación privada o con el disco lleno, localStorage LANZA en vez de devolver null.
  }
}

export function descartarBorrador(clave: string): void {
  try {
    window.localStorage.removeItem(PREFIJO + clave);
  } catch {
    // idem
  }
}

/**
 * El borrador como estado de React.
 *
 * Devuelve, en este orden: el valor, cómo cambiarlo, y cómo descartarlo.
 *
 * EL DESCARTE LO LLAMA QUIEN GUARDO CON EXITO, y no es opcional: un borrador que sobrevive a
 * haber guardado reaparece en el trámite siguiente con los datos del anterior — que es peor que
 * no tener borrador, porque se ve como un formulario legítimamente lleno.
 */
export function useBorrador<T>(clave: string, inicial: T): [T, (v: T) => void, () => void] {
  const [valor, setValor] = useState<T>(() => leerBorrador(clave, inicial));

  const cambiar = useCallback(
    (v: T) => {
      setValor(v);
      guardarBorrador(clave, v);
    },
    [clave],
  );

  const descartar = useCallback(() => {
    descartarBorrador(clave);
    setValor(inicial);
    // `inicial` queda fuera de las dependencias a propósito: quien llama le pasa un objeto
    // literal, que es uno nuevo en cada render, e incluirlo haría que esta función cambie
    // siempre y dispare renders en cadena. El inicial de un formulario no cambia entre renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);

  return [valor, cambiar, descartar];
}
