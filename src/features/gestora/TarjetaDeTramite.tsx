import { Link } from "@tanstack/react-router";
import { textoDeAccion, type FilaDeCola } from "@/lib/cola";
import { aCentavos, formatearCorto } from "@/lib/plata";

/**
 * ============================================================================
 *  UN TRAMITE EN LA COLA
 * ============================================================================
 *
 *  Cuatro renglones y a lo sumo un botón. No hay chip de estado: el estado ya está dicho en la
 *  frase y en el bloque, y un chip más sería una tercera forma de decir lo mismo.
 *
 *  EL NOMBRE ES UN ENLACE Y EL BOTON ES OTRO. Son dos cosas distintas —uno lleva a mirar, el otro
 *  hace avanzar el trámite— y aunque hoy los dos vayan a la misma pantalla, meterlos en un solo
 *  elemento obligaría a adivinar cuál se disparó. En un teléfono, con el pulgar, eso se equivoca.
 */
export function TarjetaDeTramite({ fila }: { fila: FilaDeCola }) {
  const boton = textoDeAccion(fila.accion);

  return (
    <div
      data-tarjeta-tramite="true"
      /*
        `view-transition-name` POR TRAMITE: es lo que hace que la tarjeta se vea VIAJAR de un
        bloque al otro cuando entra la plata, en vez de desaparecer de un lado y aparecer del
        otro. El nombre tiene que ser único en la página y estable entre dibujos, por eso va el
        id y no el índice.
      */
      style={{ viewTransitionName: `tramite-${fila.tramite_id}` }}
      className="flex flex-col gap-1 border-b border-line px-4 py-3 last:border-b-0"
    >
      <Link
        to="/empresa/$razonSocialId/tramite/$tramiteId"
        params={{ razonSocialId: fila.razon_social_id, tramiteId: fila.tramite_id }}
        className="text-sm underline-offset-2 hover:underline"
      >
        {fila.cliente_nombre}
      </Link>

      <p className="text-2xs text-ink2">
        {fila.dominio ?? fila.oferta_referencia ?? "sin dominio"} · {fila.empresa}
      </p>

      <p className="text-xs">{frase(fila)}</p>

      {boton !== null && (
        <Link
          data-boton-accion="true"
          to="/empresa/$razonSocialId/tramite/$tramiteId"
          params={{ razonSocialId: fila.razon_social_id, tramiteId: fila.tramite_id }}
          /*
            `min-h-11` son 44px, el mínimo táctil que usa el resto de esta app. Con menos, en un
            teléfono, se le erra — y errarle a este botón es abrir el trámite equivocado.
          */
          className="mt-1 inline-flex min-h-11 items-center justify-center rounded-md bg-accent px-4 text-sm text-accent-ink"
        >
          {boton}
        </Link>
      )}
    </div>
  );
}

/**
 * La frase que explica por qué está donde está.
 *
 * LA DEL BLOQUE DE ESPERA LLEVA EL NUMERO. "Esperando plata" sin decir cuánta la deja sin saber
 * si faltan mil pesos o medio millón — y con esa diferencia decide si llama a la oficina o no.
 */
function frase(f: FilaDeCola): string {
  /*
    `aCentavos` ANTES DE FORMATEAR, como en el resto de la app. La base manda pesos —520000.00— y
    `formatear` espera centavos, así que sin esta conversión un presupuesto de $ 520.000 se dibuja
    como $ 5.200: dividido por cien, sin error y sin advertencia.

    ME PASO EL 28/08/2026 escribiendo esta misma función, y no lo agarró ninguna prueba: lo agarré
    mirando la pantalla. Es hermano del defecto del `Number("600.000")` que costó un factor de mil.
  */
  if (f.bloque === "esperando") return `Falta que depositen ${formatearCorto(aCentavos(f.falta))}`;
  switch (f.accion) {
    case "presupuestar":
      return "Falta el presupuesto";
    case "ir_al_registro":
      return `Ya tenés los ${formatearCorto(aCentavos(f.pide))}`;
    case "devolver":
      return "Resuelto: falta entregarlo a administración";
    case "ninguna":
      return "Devuelto";
  }
}
