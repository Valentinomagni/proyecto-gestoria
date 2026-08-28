import { useQuery } from "@tanstack/react-query";
import { supabase } from "./supabase";
import { aNumero } from "./datos";

/**
 * ============================================================================
 *  LA COLA DE LA GESTORA
 * ============================================================================
 *
 * El bloque y la acción vienen decididos DE LA BASE. Acá no se recalcula ninguno de los dos: si
 * aparece la tentación de escribir `saldo >= pide`, es la señal de que algo se está duplicando.
 * La razón entera está en la migración `la_cola_de_la_gestora`, y en resumen es que la plata es
 * de la TARJETA y se la reparten todos los presupuestos vivos de esa tarjeta.
 */

export type Bloque = "te_toca" | "esperando" | "terminado";
export type Accion = "presupuestar" | "ir_al_registro" | "devolver" | "ninguna";

export interface FilaDeCola {
  tramite_id: string;
  cliente_nombre: string;
  dominio: string | null;
  oferta_referencia: string | null;
  empresa: string;
  razon_social_id: string;
  tarjeta_id: string | null;
  estado: string;
  bloque: Bloque;
  accion: Accion;
  /** Lo que pide el presupuesto, en centavos. */
  pide: number;
  /** Cuánto falta depositar en la tarjeta para que salga. En centavos. Cero si no espera nada. */
  falta: number;
  desde: string | null;
}

/*
  EL ORDEN DE ESTA LISTA ES EL ORDEN DE LA PANTALLA, y no es alfabético ni casual: ella abre el
  teléfono para saber qué hacer ahora. Lo que ya terminó va último.

  `vacio` es obligatorio en los tres. Un bloque vacío sin una palabra que lo explique se lee como
  un error de carga, y la respuesta a "no tenés nada pendiente" no puede parecerse a "no se pudo
  cargar".
*/
export const BLOQUES: { valor: Bloque; titulo: string; vacio: string }[] = [
  {
    valor: "te_toca",
    titulo: "Te toca a vos",
    vacio: "No tenés nada para hacer ahora mismo.",
  },
  {
    valor: "esperando",
    titulo: "Esperando a la oficina",
    vacio: "No estás esperando plata de nadie.",
  },
  {
    valor: "terminado",
    titulo: "Terminados hoy",
    vacio: "Todavía no devolviste ninguno hoy.",
  },
];

/**
 * El texto del botón, o `null` si no hay nada que hacer.
 *
 * DEVUELVE `null` Y NO UNA CADENA VACÍA a propósito: un botón con texto vacío sigue siendo un
 * botón. Se puede tabular hasta él, el lector de pantalla lo anuncia sin nombre, y se puede
 * apretar. La ausencia de acción tiene que ser la ausencia del elemento.
 */
export function textoDeAccion(a: Accion): string | null {
  switch (a) {
    case "presupuestar":
      return "Cargar el presupuesto";
    case "ir_al_registro":
      return "Andá al registro";
    case "devolver":
      return "Entregar a administración";
    case "ninguna":
      return null;
  }
}

/**
 * Reparte las filas en los tres bloques, del más viejo al más nuevo.
 *
 * SIEMPRE DEVUELVE LOS TRES, aunque estén vacíos. Un bloque ausente no se dibuja, y entonces la
 * pantalla no puede decir "no tenés nada": simplemente no muestra nada, que es lo mismo que se ve
 * cuando algo falló.
 */
export function agrupar(filas: FilaDeCola[]): Record<Bloque, FilaDeCola[]> {
  const r: Record<Bloque, FilaDeCola[]> = { te_toca: [], esperando: [], terminado: [] };
  for (const f of filas) r[f.bloque].push(f);

  /*
    Una fila sin `desde` va al final. `desde` sale de un `coalesce` de tres columnas, así que en
    la práctica no debería ser nulo — pero ordenar por null deja la fila donde el navegador
    quiera, y "donde el navegador quiera" en una lista de trabajo es arriba de todo la mitad de
    las veces.
  */
  const clave = (f: FilaDeCola) => f.desde ?? "9999-12-31";
  for (const b of Object.keys(r) as Bloque[]) {
    r[b] = r[b].toSorted((a, z) => clave(a).localeCompare(clave(z)));
  }
  return r;
}

/*
  EL SELECT VA EN UNA SOLA CADENA LITERAL, sin partirla con `+`: supabase-js infiere los tipos
  leyendo ese literal, y una concatenacion lo deja en `GenericStringError` — o sea que se pierde
  el chequeo de tipos justo en la consulta que trae plata.
*/
const COLUMNAS =
  "tramite_id, cliente_nombre, dominio, oferta_referencia, empresa, razon_social_id, tarjeta_id, estado, bloque, accion, pide, falta, desde";

export function useCola() {
  return useQuery({
    queryKey: ["cola"],
    queryFn: async (): Promise<FilaDeCola[]> => {
      const { data, error } = await supabase.from("v_cola_de_gestora").select(COLUMNAS);
      if (error) throw error;
      return (data ?? []).map((f) => ({
        tramite_id: String(f.tramite_id),
        cliente_nombre: String(f.cliente_nombre),
        dominio: f.dominio === null ? null : String(f.dominio),
        oferta_referencia: f.oferta_referencia === null ? null : String(f.oferta_referencia),
        empresa: String(f.empresa),
        razon_social_id: String(f.razon_social_id),
        tarjeta_id: f.tarjeta_id === null ? null : String(f.tarjeta_id),
        estado: String(f.estado),
        bloque: f.bloque as Bloque,
        accion: f.accion as Accion,
        pide: aNumero(f.pide),
        falta: aNumero(f.falta),
        desde: f.desde === null ? null : String(f.desde),
      }));
    },
  });
}
