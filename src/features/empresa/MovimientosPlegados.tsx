import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Panel } from "../../components/Panel";
import { Operaciones } from "../tarjeta/Operaciones";
import { useAnularMovimiento, useMovimientos } from "../../lib/datos";
import { useSesion } from "../../lib/sesion";
import { puedeMoverSaldo } from "../../lib/roles";
import { aFechaArgentina, hoyArgentina } from "../../lib/fechas";
import { recordado, recordar } from "../../lib/recordar";

/**
 * ============================================================================
 *  EL EXTRACTO DE LA TARJETA, PLEGADO Y ABIERTO EN "HOY"
 * ============================================================================
 *
 *  El pedido fue textual: *"que la solapa de operaciones sea plegable para que no se acumulen
 *  tantas operaciones viejas, que aparezcan principalmente los movimientos del día"*.
 *
 *  Arranca PLEGADA. Al abrirla muestra los de hoy, con un "Ver todo" que trae los 200 que ya
 *  devuelve la consulta.
 *
 *  ============================================================================
 *   EL DIA SE CUENTA CON LA HORA DE ARGENTINA
 *  ============================================================================
 *
 *  Y no con la del navegador. La base ya usa `hoy_argentina()` desde el 27/08/2026, porque corría
 *  en UTC y entre las 21 y las 24 daba por acreditado un depósito que entraba al día siguiente.
 *
 *  Si el front usara `new Date()` a secas, en esa misma franja las dos dirían días distintos: el
 *  extracto mostraría como "de hoy" movimientos que la vista de saldos todavía cuenta como de
 *  mañana.
 */
export function MovimientosPlegados({ tarjetaId }: { tarjetaId: string }) {
  const clave = `seccion.movimientos.${tarjetaId}`;
  const [abierta, setAbierta] = useState(() => recordado(clave) === "true");
  const [verTodo, setVerTodo] = useState(false);

  const { perfil } = useSesion();
  const movimientos = useMovimientos(abierta ? tarjetaId : null);
  const anular = useAnularMovimiento();

  function alternar(): void {
    const nueva = !abierta;
    setAbierta(nueva);
    recordar(clave, String(nueva));
  }

  const todos = movimientos.data ?? [];
  const deHoy = todos.filter((m) => aFechaArgentina(m.fecha) === hoyArgentina());
  const visibles = verTodo ? todos : deHoy;

  const Flecha = abierta ? ChevronDown : ChevronRight;

  return (
    <Panel className="p-0 overflow-hidden">
      <button
        type="button"
        onClick={alternar}
        aria-expanded={abierta}
        className="flex w-full items-baseline justify-between gap-3 px-4 py-2 text-left"
      >
        <span className="flex items-baseline gap-2">
          <Flecha aria-hidden="true" size={14} className="shrink-0 self-center" />
          <span className="text-sm">Movimientos de la tarjeta</span>
          {abierta && (
            <span className="text-2xs text-ink2">
              {verTodo ? `${String(todos.length)} en total` : `${String(deHoy.length)} de hoy`}
            </span>
          )}
        </span>
      </button>

      {abierta && (
        <div className="border-t border-line">
          {!movimientos.isLoading && deHoy.length === 0 && !verTodo && (
            <p className="px-4 py-3 text-sm text-ink2">Hoy no se movió nada en esta tarjeta.</p>
          )}

          {(visibles.length > 0 || movimientos.isLoading) && (
            <Operaciones
              movimientos={visibles}
              cargando={movimientos.isLoading}
              puedeAnular={puedeMoverSaldo(perfil?.rol ?? "sin_asignar")}
              alAnular={(id, motivo) => anular.mutate({ id, motivo })}
              anulando={anular.isPending}
            />
          )}

          {/*
            "Ver todo" trae los 200 que la consulta ya devolvio: no es otra consulta, es dejar de
            filtrar por fecha. Por eso el numero de arriba cambia al instante.
          */}
          {!movimientos.isLoading && todos.length > deHoy.length && (
            <div className="border-t border-line px-4 py-2">
              <button
                type="button"
                onClick={() => setVerTodo(!verTodo)}
                className="text-2xs underline underline-offset-2"
              >
                {verTodo ? "Ver sólo los de hoy" : `Ver todo (${String(todos.length)})`}
              </button>
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}
