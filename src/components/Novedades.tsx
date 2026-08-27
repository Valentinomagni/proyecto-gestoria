import { useState } from "react";
import { Bell } from "lucide-react";
import { Panel } from "./Panel";
import { formatearFechaHora } from "../lib/fechas";
import { nombreDeEstado } from "../features/tramites/Listado";
import type { Novedad } from "../lib/novedades";

/**
 * La campana de novedades.
 *
 * EL NUMERO SOLO APARECE SI HAY ALGO. Un contador en cero permanente es un adorno, y un adorno
 * al lado de un aviso le baja el valor al aviso.
 *
 * SE MARCAN COMO VISTAS AL ABRIR EL PANEL, no al cerrarlo: abrirlo es el momento en que se
 * leen. Marcarlas al cerrar haría que el número siga ahí mientras se está mirando la lista.
 */
export function Novedades({
  lista,
  sinVer,
  alAbrirPanel,
  alAbrirTramite,
}: {
  lista: Novedad[];
  sinVer: number;
  alAbrirPanel: () => void;
  alAbrirTramite: (id: string) => void;
}) {
  const [abierto, setAbierto] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (!abierto) alAbrirPanel();
          setAbierto(!abierto);
        }}
        className="flex items-center gap-2 text-2xs text-side-ink2"
      >
        <Bell aria-hidden="true" size={14} />
        Novedades
        {sinVer > 0 && <span className="tnum text-warn">{sinVer}</span>}
      </button>

      {abierto && (
        <Panel className="fixed inset-x-4 bottom-20 z-20 flex max-h-80 max-w-md flex-col gap-2 overflow-y-auto md:inset-x-auto md:bottom-6 md:left-6">
          <h2 className="text-sm">Novedades</h2>
          {lista.length === 0 ? (
            <p className="text-2xs text-ink2">
              Nada nuevo desde que entraste. Acá van a aparecer los trámites que muevan los demás,
              sin que tengas que recargar.
            </p>
          ) : (
            lista.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => {
                  alAbrirTramite(n.tramiteId);
                  setAbierto(false);
                }}
                className="border-b border-line py-2 text-left last:border-0"
              >
                <p className="text-sm">Pasó a {nombreDeEstado(n.estado)}</p>
                <p className="text-2xs text-ink2 tnum">{formatearFechaHora(n.cuando)}</p>
              </button>
            ))
          )}
          <button
            type="button"
            onClick={() => setAbierto(false)}
            className="w-fit text-2xs text-ink2"
          >
            Cerrar
          </button>
        </Panel>
      )}
    </>
  );
}
