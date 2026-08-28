import { ChevronRight } from "lucide-react";
import { Link, useMatches } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import type { FilaDeResumen } from "../lib/resumen";

/**
 * ============================================================================
 *  LA TIRA DE MIGAS ES TODA LA NAVEGACION
 * ============================================================================
 *
 *  El pedido fue textual: "no quiero tener una barra lateral, parece literalmente la réplica del
 *  tablero contable". La barra no se cambia por otra barra: se cambia por PROFUNDIDAD.
 *
 *  Tres niveles —resumen, empresa, trámite— y el camino recorrido siempre a la vista, donde cada
 *  tramo vuelve. No hace falta nada más: si un lugar no está en el camino, se llega desde el
 *  resumen, que está a un toque.
 *
 *  ============================================================================
 *   POR QUE LOS TRAMOS SON `Link` Y NO BOTONES
 *  ============================================================================
 *
 *  Un `Link` se puede abrir en otra pestaña con el clic del medio, copiar con el botón derecho, y
 *  el navegador lo trata como lo que es: una dirección. Un botón con `onClick` que navega se ve
 *  igual y no hace nada de eso.
 */
export function Migas({ nombreDeUsuario }: { nombreDeUsuario: string }) {
  const tramos = useTramos();

  return (
    <nav
      aria-label="Dónde estás"
      className="flex items-center justify-between gap-3 bg-side-bg2 px-4 py-1"
    >
      <ol className="flex min-w-0 items-center gap-1 text-2xs text-side-ink">
        {tramos.map((t, i) => (
          <li key={`${t.texto}-${String(i)}`} className="flex min-w-0 items-center gap-1">
            {i > 0 && <ChevronRight aria-hidden="true" size={12} className="shrink-0 opacity-70" />}
            {i === tramos.length - 1 ? (
              /*
                EL ULTIMO TRAMO NO ES UN ENLACE, y es la regla de las migas: un enlace a donde ya
                estás no lleva a ningún lado, y quien usa lector de pantalla lo escucha igual que
                los otros. `aria-current` es lo que dice "acá estás".
              */
              <span aria-current="page" className="truncate font-medium">
                {t.texto}
              </span>
            ) : t.params === undefined ? (
              <Link to="/" className="truncate underline-offset-2 hover:underline">
                {t.texto}
              </Link>
            ) : (
              <Link
                to="/empresa/$razonSocialId"
                params={t.params}
                className="truncate underline-offset-2 hover:underline"
              >
                {t.texto}
              </Link>
            )}
          </li>
        ))}
      </ol>

      <span className="shrink-0 text-2xs text-side-ink2">{nombreDeUsuario}</span>
    </nav>
  );
}

/** Un tramo del camino. `params` sólo lo lleva el de la empresa. */
interface Tramo {
  texto: string;
  params?: { razonSocialId: string };
}

/** Arma el camino a partir de la ruta activa. Vive acá porque nadie más lo necesita. */
function useTramos(): Tramo[] {
  const coincidencias = useMatches();
  const cliente = useQueryClient();

  const ultima = coincidencias[coincidencias.length - 1];
  const p = (ultima?.params ?? {}) as { razonSocialId?: string; tramiteId?: string };

  const tramos: Tramo[] = [{ texto: "Grupo Paris" }];

  if (p.razonSocialId !== undefined) {
    /*
      EL NOMBRE SALE DEL CACHE DE `useResumen`, no de una consulta nueva.

      Pedirlo otra vez haria que las migas parpadeen "cargando" cada vez que se cambia de nivel, y
      una tira que parpadea arriba de todo se nota mas que el contenido.

      Si el cache esta vacio —alguien abrio la URL de una empresa directamente— muestra el guion
      hasta que el nivel 2 traiga el dato. Es corto, no salta, y no miente.
    */
    const filas = cliente.getQueryData<FilaDeResumen[]>(["resumen"]);
    const una = cliente.getQueryData<FilaDeResumen | null>(["resumen", p.razonSocialId]);
    const nombre =
      una?.nombre ?? filas?.find((f) => f.razon_social_id === p.razonSocialId)?.nombre ?? "—";

    tramos.push({ texto: nombre, params: { razonSocialId: p.razonSocialId } });
  }

  if (p.tramiteId !== undefined) {
    // El nombre del cliente lo tiene la ficha, que es la que esta dibujada. Hasta que llegue, el
    // guion: escribir el id crudo seria mostrar un dato interno que no le dice nada a nadie.
    const t = cliente.getQueryData<{ cliente_nombre?: string }>(["tramite", p.tramiteId]);
    tramos.push({ texto: t?.cliente_nombre ?? "—" });
  }

  return tramos;
}
