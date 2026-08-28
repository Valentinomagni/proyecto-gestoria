import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Panel } from "../../components/Panel";
import { formatearCorto } from "../../lib/plata";
import { recordado, recordar } from "../../lib/recordar";

/**
 * ============================================================================
 *  UNA SECCION, SU CUENTA Y SU TOTAL
 * ============================================================================
 *
 *  El título lleva CUÁNTOS son y CUÁNTA PLATA suman, y eso se ve con la sección plegada. Es lo
 *  que hace que plegar no esconda: *"Esperan plata (2) — $ 648.000"* dice todo lo que hace falta
 *  para decidir si abrirla.
 *
 *  Una sección plegada que sólo dice su nombre obliga a abrirla para saber si importa, y entonces
 *  quedan todas abiertas y no sirvió de nada.
 *
 *  ============================================================================
 *   ES UN `button` CON `aria-expanded`, NO UN `div` QUE ESCUCHA CLICS
 *  ============================================================================
 *
 *  Sin eso quien usa lector de pantalla escucha el título y no se entera de que se puede abrir,
 *  ni de si está abierto. Y no se llega con teclado.
 *
 *  ============================================================================
 *   LO QUE SE PLIEGA SE RECUERDA, Y POR EMPRESA
 *  ============================================================================
 *
 *  Quien pliega los anulados no quiere volver a plegarlos mañana. Y se recuerda por empresa
 *  porque una tiene tres anulados y otra ochenta: la decisión de plegarlos no es la misma.
 */
export function SeccionPlegable({
  titulo,
  ayuda,
  cuantos,
  total,
  abiertaPorDefecto,
  claveDeMemoria,
  alerta = false,
  children,
}: {
  titulo: string;
  ayuda?: string;
  cuantos: number;
  /** En centavos. `null` cuando la sección no suma plata, como los anulados. */
  total: number | null;
  abiertaPorDefecto: boolean;
  claveDeMemoria: string;
  alerta?: boolean;
  children: ReactNode;
}) {
  const [abierta, setAbierta] = useState(
    () => (recordado(claveDeMemoria) ?? String(abiertaPorDefecto)) === "true",
  );

  function alternar(): void {
    const nueva = !abierta;
    setAbierta(nueva);
    recordar(claveDeMemoria, String(nueva));
  }

  const Flecha = abierta ? ChevronDown : ChevronRight;

  return (
    <Panel className={`p-0 overflow-hidden ${alerta ? "border-l-2 border-l-warn" : ""}`}>
      <button
        type="button"
        onClick={alternar}
        aria-expanded={abierta}
        className="flex w-full items-baseline justify-between gap-3 px-4 py-2 text-left"
      >
        <span className="flex min-w-0 items-baseline gap-2">
          <Flecha aria-hidden="true" size={14} className="shrink-0 self-center" />
          <span className="text-sm">{titulo}</span>
          <span className="text-2xs text-ink2">({cuantos})</span>
        </span>

        {/*
          EL TOTAL SE VE CON LA SECCION PLEGADA, que es el punto. Sin el, plegar esconde y hay que
          abrir para saber si importa — y entonces quedan todas abiertas.
        */}
        {total !== null && cuantos > 0 && (
          <span className="tnum shrink-0 whitespace-nowrap text-sm">{formatearCorto(total)}</span>
        )}
      </button>

      {abierta && (
        <div className="border-t border-line">
          {ayuda !== undefined && <p className="px-4 py-2 text-2xs text-ink2">{ayuda}</p>}
          {children}
        </div>
      )}
    </Panel>
  );
}
