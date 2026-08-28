/**
 * El isotipo y el lockup de Grupo Paris.
 *
 * Son los archivos REALES de la marca, copiados de tablero-contable-v2/public/brand/. Salieron
 * de vectorizar el logo original con potrace, no de una interpretacion ni de un icono generico.
 *
 * SE COPIAN, NO SE REDIBUJAN. Medido en el Estudio Contable Magni cuando se intento lo
 * contrario: el redibujo daba 15,40 de diferencia contra el original y el calco 3,61.
 *
 * REGLAS DE USO, del manual de marca:
 *  - Blanco sobre fondos oscuros, negro sobre claros. Nunca al reves ni sobre gris medio.
 *  - Nunca coloreado, deformado, rotado ni con sombra.
 *  - Tamano minimo: 24 px de alto el isotipo, 32 px el lockup. Por debajo se pierde el detalle
 *    de las curvas internas.
 *  - El ancho y el alto NO se ajustan por separado.
 */

type Tono = "negro" | "blanco";

/** Solo el simbolo. Para espacios chicos: tira superior, favicon, avatar. */
export function Isotipo({ tono = "negro", alto = 34 }: { tono?: Tono; alto?: number }) {
  return (
    <img
      src={`/brand/isotipo-${tono}.svg`}
      alt="Grupo Paris"
      height={alto}
      style={{ height: alto, width: "auto" }}
    />
  );
}

/** Simbolo mas nombre. Cuando hay espacio horizontal y conviene reforzar la marca. */
export function Lockup({ tono = "negro", alto = 48 }: { tono?: Tono; alto?: number }) {
  return (
    <img
      src={`/brand/lockup-${tono}.svg`}
      alt="Grupo Paris"
      height={alto}
      style={{ height: alto, width: "auto" }}
    />
  );
}
