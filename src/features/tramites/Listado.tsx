/**
 * ============================================================================
 *  EL VOCABULARIO DE LA CADENA: LOS ESTADOS, LOS TIPOS Y LAS MODALIDADES
 * ============================================================================
 *
 *  ============================================================================
 *   SE FUE LA PANTALLA Y QUEDO EL VOCABULARIO
 *  ============================================================================
 *
 *  Este archivo tenía además el LISTADO: una tabla con buscador y filtro, que era la pantalla de
 *  la oficina antes del plan B. Se fue el 28/08/2026, doscientas dos líneas, después de comprobar
 *  que nadie la dibujaba: la reemplazaron el resumen de empresas y la pantalla de la empresa, que
 *  agrupan por razón social en vez de mostrar todo junto.
 *
 *  De sus doce importaciones no quedó ninguna, que es la señal de que era un bloque completo y no
 *  un pedazo enredado con el resto.
 *
 *  ============================================================================
 *   POR QUE EL ARCHIVO SIGUE LLAMANDOSE `Listado.tsx`
 *  ============================================================================
 *
 *  Porque el guardián `npm run estados` lo nombra por ruta —lee `ESTADOS` de acá y `SIGUIENTE` de
 *  `Ficha.tsx` para compararlos contra el `check` de la base— y renombrarlo obliga a tocar el
 *  guardián y cinco importaciones para ganar un nombre más lindo. Se renombra el día que haya otro
 *  motivo para tocarlo.
 */

/**
 * Los seis estados de la cadena, más `anulado`, que no es un paso sino la salida.
 *
 * ERAN DIEZ. `presentado`, `pagado` y `retirado` se fundieron en `resuelto` porque eran tres
 * botones para UN SOLO VIAJE al registro: la gestora presenta, paga y retira en la misma
 * ventanilla. Tenerlos separados la obligaba a abrir la app tres veces para registrar algo que
 * pasó una vez.
 *
 * Y `frenado_por_saldo` desapareció porque no era un estado del trámite sino una condición de la
 * tarjeta: alguien tenía que marcarlo Y DESMARCARLO a mano, y el desmarcado se olvidaba. Ahora se
 * deduce en la vista `v_esperando_plata`.
 *
 * ESTA LISTA TIENE QUE ESPEJAR `tramites_estado_valido` EN LA BASE. Si acá aparece un estado que
 * la base ya no acepta, el filtro ofrece una opción que no devuelve nada — y peor, el botón que
 * lo manda falla contra un check.
 */
export const ESTADOS: { valor: string; nombre: string }[] = [
  { valor: "recibido", nombre: "Recibido" },
  { valor: "controlado", nombre: "Controlado" },
  { valor: "entregado", nombre: "Entregado a gestoría" },
  { valor: "presupuestado", nombre: "Presupuestado" },
  { valor: "resuelto", nombre: "Resuelto en el registro" },
  { valor: "devuelto", nombre: "Devuelto" },
  { valor: "anulado", nombre: "Anulado" },
];

export function nombreDeEstado(v: string): string {
  return ESTADOS.find((e) => e.valor === v)?.nombre ?? v;
}

export const TIPOS: Record<string, string> = {
  patentamiento_0km: "Patentamiento 0km",
  transferencia_a_cliente: "Transferencia a cliente",
  transferencia_al_concesionario: "Transferencia al concesionario",
};

/**
 * Las dos formas en que se compra un 0km, y no hay una tercera.
 *
 * Credito y Contado estaban aca y no eran modalidades: son formas de PAGO, y para eso ya existe
 * `medio_pago`. Y una transferencia directamente no tiene modalidad — la base lo impide con un
 * check, asi que este diccionario nunca recibe una.
 */
export const MODALIDADES: Record<string, string> = {
  plan_ahorro: "Plan de ahorro",
  venta_directa: "Venta directa 0km",
};

/** El color comunica estado y NADA MAS. La marca es monocroma justamente para esto. */
export function Chip({ estado }: { estado: string }) {
  const clase = estado === "anulado" ? "text-ink2" : estado === "devuelto" ? "text-done" : "";
  return <span className={`text-xs ${clase}`}>{nombreDeEstado(estado)}</span>;
}
