import { useState } from "react";
import { Inbox, Search } from "lucide-react";
import { Panel } from "../../components/Panel";
import { SkeletonLineas } from "../../components/Skeleton";
import { EmptyState } from "../../components/EmptyState";
import { formatearFecha } from "../../lib/fechas";
import { aCentavos, formatear } from "../../lib/plata";
import { useTramites } from "../../lib/datos";
import { CAMPO_ADENTRO, CAMPO_CON_ICONO, CAMPO_SUELTO } from "../../lib/campos";

/**
 * El listado de tramites. Reemplaza la planilla.
 *
 * LA BUSQUEDA ES UNA SOLA CAJA que mira los CUATRO datos con los que se ubica un tramite:
 * cliente, dominio, referencia de la oferta y cuenta personal. Cuatro cajas separadas obligan a
 * saber de antemano cual de los cuatro se tiene a mano, y nunca se sabe.
 */

export const ESTADOS: { valor: string; nombre: string }[] = [
  { valor: "recibido", nombre: "Recibido" },
  { valor: "controlado", nombre: "Controlado" },
  { valor: "entregado", nombre: "Entregado a gestoría" },
  { valor: "presupuestado", nombre: "Presupuestado" },
  { valor: "frenado_por_saldo", nombre: "Frenado por saldo" },
  { valor: "presentado", nombre: "Presentado" },
  { valor: "pagado", nombre: "Pagado" },
  { valor: "retirado", nombre: "Retirado" },
  { valor: "devuelto", nombre: "Devuelto" },
  { valor: "anulado", nombre: "Anulado" },
];

export function nombreDeEstado(v: string): string {
  return ESTADOS.find((e) => e.valor === v)?.nombre ?? v;
}

const TIPOS: Record<string, string> = {
  patentamiento_0km: "Patentamiento 0km",
  transferencia_a_cliente: "Transferencia a cliente",
  transferencia_al_concesionario: "Transferencia al concesionario",
};

export function Listado({ alAbrir }: { alAbrir: (id: string) => void }) {
  const [buscar, setBuscar] = useState("");
  const [estado, setEstado] = useState("");
  const tramites = useTramites({ ...(estado !== "" && { estado }), ...(buscar !== "" && { buscar }) });

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 p-6">
      <h1 className="text-xl">Trámites</h1>

      <Panel className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-56 flex-1 flex-col gap-1">
          <span className="text-xs text-ink2">Buscar por cliente, dominio, referencia o cuenta</span>
          <div className={CAMPO_CON_ICONO}>
            <Search aria-hidden="true" size={14} className="shrink-0 self-center text-ink2" />
            <input
              value={buscar}
              onChange={(e) => setBuscar(e.target.value)}
              className={CAMPO_ADENTRO}
            />
          </div>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-ink2">Estado</span>
          <select
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
            className={CAMPO_SUELTO}
          >
            <option value="">Todos</option>
            {ESTADOS.map((e) => <option key={e.valor} value={e.valor}>{e.nombre}</option>)}
          </select>
        </label>
      </Panel>

      {tramites.isLoading ? (
        <SkeletonLineas cantidad={6} />
      ) : tramites.data && tramites.data.length > 0 ? (
        <>
        {/*
          ============================================================================
           EN EL TELEFONO NO HAY TABLA. Es la pantalla que mas se usa parada.
          ============================================================================

          Se midio: la tabla de siete columnas necesita 445 px y en un telefono el panel tiene
          326. Se puede arrastrar de costado, y ahi esta el problema — buscar un tramite
          arrastrando una tabla con una sola mano, con el legajo en la otra, es exactamente el
          momento en que se vuelve a la planilla.

          Los mismos datos, apilados: el cliente arriba porque es por lo que se busca, la
          referencia y el dominio abajo en chico, el estado y el deposito a la derecha.
        */}
        <Panel className="flex flex-col sm:hidden">
          {tramites.data.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => alAbrir(t.id)}
              className="flex items-baseline justify-between gap-3 border-b border-line py-3 text-left last:border-0"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{t.cliente_nombre}</p>
                <p className="truncate text-2xs text-ink2 tnum">
                  {[t.oferta_referencia, t.dominio, TIPOS[t.tipo] ?? t.tipo]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <Chip estado={t.estado} />
                {t.deposito_solicitado !== null && (
                  <p className="text-2xs tnum text-ink2">
                    {formatear(aCentavos(t.deposito_solicitado))}
                  </p>
                )}
              </div>
            </button>
          ))}
        </Panel>

        <Panel className="hidden overflow-x-auto sm:block">
          <table className="w-full text-sm">
            <thead className="text-2xs text-ink2">
              <tr className="border-b border-line">
                <th className="py-2 text-left font-normal">Fecha</th>
                <th className="py-2 text-left font-normal">Cliente</th>
                <th className="py-2 text-left font-normal">Referencia</th>
                <th className="py-2 text-left font-normal">Dominio</th>
                <th className="py-2 text-left font-normal">Tipo</th>
                <th className="py-2 text-left font-normal">Estado</th>
                <th className="py-2 text-right font-normal">Depósito</th>
              </tr>
            </thead>
            <tbody>
              {tramites.data.map((t) => (
                <tr
                  key={t.id}
                  onClick={() => alAbrir(t.id)}
                  className="cursor-pointer border-b border-line hover:bg-surface2"
                >
                  <td className="py-2 tnum text-ink2">{formatearFecha(t.recibido_at)}</td>
                  <td className="py-2">{t.cliente_nombre}</td>
                  <td className="py-2 tnum text-ink2">{t.oferta_referencia ?? ""}</td>
                  <td className="py-2 tnum">{t.dominio ?? ""}</td>
                  <td className="py-2 text-ink2">{TIPOS[t.tipo] ?? t.tipo}</td>
                  <td className="py-2">
                    <Chip estado={t.estado} />
                  </td>
                  <td className="py-2 text-right tnum">
                    {t.deposito_solicitado === null
                      ? ""
                      : formatear(aCentavos(t.deposito_solicitado))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
        </>
      ) : (
        <Panel className="p-0 overflow-hidden">
          <EmptyState
            icono={Inbox}
            titulo={buscar === "" && estado === "" ? "Todavía no hay trámites" : "No hay trámites con ese filtro"}
            queHacer={
              buscar === "" && estado === ""
                ? "Cargá el primero pegando el asunto del mail que manda administración."
                : "Probá con otro texto, o sacá el filtro de estado."
            }
          />
        </Panel>
      )}
    </div>
  );
}

/** El color comunica estado y NADA MAS. La marca es monocroma justamente para esto. */
export function Chip({ estado }: { estado: string }) {
  const clase =
    estado === "frenado_por_saldo" ? "text-danger"
    : estado === "anulado" ? "text-ink2"
    : estado === "devuelto" ? "text-done"
    : "";
  return <span className={`text-xs ${clase}`}>{nombreDeEstado(estado)}</span>;
}
