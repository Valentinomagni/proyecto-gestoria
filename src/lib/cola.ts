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
  /*
    ============================================================================
     LOS DOS IMPORTES VIENEN EN PESOS, COMO LOS MANDA LA BASE
    ============================================================================

    NO son centavos, aunque el CLAUDE.md diga que en JavaScript la plata son centavos enteros. La
    conversión de esta app pasa en el PUNTO DE DIBUJO —`formatearCorto(aCentavos(x))`, igual que
    `Cifra` en la pantalla de la empresa y que las tres cifras del resumen—, así que estos campos
    son consistentes con `Saldo.contable` y con `FilaDeResumen.contable`.

    Está escrito porque cuesta caro: el 28/08/2026 pasé `falta` directo a `formatearCorto` y un
    presupuesto de $ 520.000 se dibujó como $ 5.200. Dividido por cien, sin error y sin
    advertencia. Lo agarró mirar la pantalla, no una prueba.

    QUIEN DIBUJE UNO DE ESTOS DOS: `aCentavos` primero, siempre.
  */
  pide: number;
  /** Cuánto falta depositar en la tarjeta para que salga. Cero si no espera nada. */
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
