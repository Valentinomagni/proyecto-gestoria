import { useState } from "react";
import { Wallet } from "lucide-react";
import { Panel } from "../../components/Panel";
import { SkeletonLineas } from "../../components/Skeleton";
import { EmptyState } from "../../components/EmptyState";
import { aCentavos, formatear } from "../../lib/plata";
import { formatearFechaHora, hoyArgentina, minutosHasta, antesDelCorte } from "../../lib/fechas";
import { useMovimientos, useSaldos } from "../../lib/datos";

/**
 * La pantalla de la Tarjeta Habitualista.
 *
 * CALCA LA FORMA DE LO QUE YA USAN. El pedido lo dice textual: "Quisiera un formato similar a
 * lo que estamos acostumbradas a manejar, como la imagen de la pagina de la Tarjeta
 * Habitualista, con un saldo inicial y listado de operaciones". Arriba las cifras, abajo el
 * extracto. No es una preferencia estetica: es la forma mental con la que ya trabajan.
 */

/** La hora de corte sale de la base. Este valor es el respaldo si todavia no cargo. */
const CORTE_POR_DEFECTO = "16:00";

export function Tarjeta() {
  const saldos = useSaldos();
  const [tarjetaId, setTarjetaId] = useState<string | null>(null);
  const elegida = tarjetaId ?? saldos.data?.[0]?.tarjeta_id ?? null;
  const movimientos = useMovimientos(elegida);
  const saldo = saldos.data?.find((s) => s.tarjeta_id === elegida);

  if (saldos.isLoading) return <SkeletonLineas cantidad={5} className="m-6 max-w-2xl" />;

  if (!saldo) {
    return (
      <Panel className="m-6 max-w-lg p-0 overflow-hidden">
        <EmptyState
          icono={Wallet}
          titulo="Todavía no hay tarjetas cargadas"
          queHacer="Gerencia las carga desde Administración."
        />
      </Panel>
    );
  }

  const disponible = saldo.contable - saldo.comprometido;
  const proyectado = saldo.contable + saldo.en_transito - saldo.comprometido;
  const faltan = minutosHasta(CORTE_POR_DEFECTO);
  const seLlega = antesDelCorte(CORTE_POR_DEFECTO);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl">Tarjeta Habitualista</h1>
        <select
          value={elegida ?? ""}
          onChange={(e) => setTarjetaId(e.target.value)}
          className="rounded-md border border-line bg-surface2 px-3 py-2 text-sm"
        >
          {saldos.data?.map((s) => (
            <option key={s.tarjeta_id} value={s.tarjeta_id}>{s.nombre}</option>
          ))}
        </select>
      </div>

      {/*
        LA CUENTA REGRESIVA AL CORTE. Es la informacion mas accionable del sistema y hoy no
        existe en ningun lado: el deposito se ordena hasta las 16:00 y acredita al dia
        siguiente, asi que quien no decide antes NO pierde unas horas, pierde un dia.

        Pasada la hora CAMBIA DE PREGUNTA: deja de decir cuanto falta y dice la consecuencia
        real de haber llegado tarde. Decirla es lo que evita que alguien crea que todavia llega.
      */}
      <Panel className={seLlega ? "" : "border-warn"}>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <p className="text-2xs text-ink2">Corte de depósitos</p>
            <p className="text-lg">
              {seLlega
                ? `Faltan ${Math.floor(faltan / 60)} h ${faltan % 60} min`
                : "Lo que ordenes ahora acredita pasado mañana"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xs text-ink2">Proyectado para mañana</p>
            <p className="text-2xl tnum">{formatear(aCentavos(proyectado))}</p>
          </div>
        </div>
      </Panel>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Cifra rotulo="Contable" valor={saldo.contable} ayuda="Lo acreditado. Coincide con el sitio." />
        <Cifra rotulo="En tránsito" valor={saldo.en_transito} ayuda="Ordenado, acredita mañana." apagado />
        <Cifra rotulo="Comprometido" valor={saldo.comprometido} ayuda="Presupuestos sin pagar." />
        <Cifra
          rotulo="Disponible hoy"
          valor={disponible}
          ayuda="Con esto se decide si se presenta."
          destacado
          alerta={disponible < 0}
        />
      </div>

      <Panel>
        <h2 className="text-lg mb-3">Operaciones</h2>
        {movimientos.isLoading ? (
          <SkeletonLineas cantidad={4} />
        ) : movimientos.data && movimientos.data.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-2xs text-ink2">
                <tr className="border-b border-line">
                  <th className="py-2 text-left font-normal">Fecha</th>
                  <th className="py-2 text-left font-normal">Concepto</th>
                  <th className="py-2 text-right font-normal">Importe</th>
                  <th className="py-2 text-left font-normal">Acredita</th>
                </tr>
              </thead>
              <tbody>
                {movimientos.data.map((m) => (
                  <tr key={m.id} className="border-b border-line">
                    <td className="py-2 tnum text-ink2">{formatearFechaHora(m.fecha)}</td>
                    <td className="py-2">{m.concepto ?? m.tipo}</td>
                    <td className={`py-2 text-right tnum ${m.importe < 0 ? "" : "text-done"}`}>
                      {formatear(aCentavos(m.importe))}
                    </td>
                    <td className="py-2 text-2xs text-ink2">
                      {m.fecha_acreditacion > hoyArgentina() ? "en tránsito" : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-ink2">Todavía no hay movimientos en esta tarjeta.</p>
        )}
      </Panel>
    </div>
  );
}

function Cifra({
  rotulo, valor, ayuda, destacado = false, apagado = false, alerta = false,
}: {
  rotulo: string; valor: number; ayuda: string;
  destacado?: boolean; apagado?: boolean; alerta?: boolean;
}) {
  return (
    <Panel>
      <p className="text-2xs text-ink2">{rotulo}</p>
      <p
        className={`tnum ${destacado ? "text-3xl" : "text-2xl"} ${
          alerta ? "text-danger" : apagado ? "text-ink2" : ""
        }`}
      >
        {formatear(aCentavos(valor))}
      </p>
      <p className="text-2xs text-ink2 mt-1">{ayuda}</p>
    </Panel>
  );
}
