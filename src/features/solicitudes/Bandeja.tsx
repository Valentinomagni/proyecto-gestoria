import { HandCoins } from "lucide-react";
import { Panel } from "../../components/Panel";
import { SkeletonLineas } from "../../components/Skeleton";
import { EmptyState } from "../../components/EmptyState";
import { aCentavos, formatear } from "../../lib/plata";
import { hoyArgentina, aFechaArgentina } from "../../lib/fechas";
import { useSaldos, useTramites } from "../../lib/datos";

/**
 * La bandeja de pedidos de fondos. Reemplaza la foto del cuaderno.
 *
 * ES UNA LISTA DIARIA QUE SE VACIA, no una cola de urgencias. El duenio del proyecto lo dijo
 * textual: "el plazo real es diario, van y piden plata para pagar y como tarde esta al dia
 * siguiente". Tres bloques —atrasadas, de hoy, frenadas— y un contador que dice si el dia esta
 * cerrado.
 *
 * "DISPONIBLE DESPUES" al lado de cada pedido: cuanto queda si se aprueba ese. Es el numero que
 * hoy no existe y por el que se deposita a ciegas.
 */
export function Bandeja({ alAbrir }: { alAbrir: (id: string) => void }) {
  const presupuestados = useTramites({ estado: "presupuestado" });
  const frenados = useTramites({ estado: "frenado_por_saldo" });
  const saldos = useSaldos();

  if (presupuestados.isLoading || saldos.isLoading) {
    return <SkeletonLineas cantidad={5} className="m-6 max-w-2xl" />;
  }

  const hoy = hoyArgentina();
  const todos = presupuestados.data ?? [];
  const deHoy = todos.filter((t) => aFechaArgentina(t.recibido_at) === hoy);
  const atrasadas = todos.filter((t) => aFechaArgentina(t.recibido_at) < hoy);

  if (todos.length === 0 && (frenados.data ?? []).length === 0) {
    return (
      <Panel className="m-6 max-w-lg p-0 overflow-hidden">
        <EmptyState
          icono={HandCoins}
          titulo="No hay pedidos de fondos"
          queHacer="Cuando una gestora cargue un presupuesto, aparece acá con cuánto queda si se aprueba."
        />
      </Panel>
    );
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4 p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-xl">Pedidos de fondos</h1>
        <p className="text-sm text-ink2">
          {deHoy.length} de hoy
          {atrasadas.length > 0 ? ` · ${atrasadas.length} de días anteriores` : ""}
        </p>
      </div>

      {atrasadas.length > 0 && (
        <Bloque
          titulo="De días anteriores"
          ayuda="El acuerdo es pagar en el día o al siguiente. Estos ya se pasaron."
          tramites={atrasadas}
          saldos={saldos.data ?? []}
          alAbrir={alAbrir}
          alerta
        />
      )}

      <Bloque titulo="De hoy" tramites={deHoy} saldos={saldos.data ?? []} alAbrir={alAbrir} />

      {(frenados.data ?? []).length > 0 && (
        <Bloque
          titulo="Frenados por falta de saldo"
          ayuda="No dependen de quien mira esta pantalla: dependen de que entre plata."
          tramites={frenados.data ?? []}
          saldos={saldos.data ?? []}
          alAbrir={alAbrir}
        />
      )}
    </div>
  );
}

function Bloque({
  titulo, ayuda, tramites, saldos, alAbrir, alerta = false,
}: {
  titulo: string;
  ayuda?: string;
  tramites: { id: string; cliente_nombre: string; oferta_referencia: string | null; tarjeta_id: string | null; deposito_solicitado: number | null }[];
  saldos: { tarjeta_id: string; nombre: string; contable: number; comprometido: number }[];
  alAbrir: (id: string) => void;
  alerta?: boolean;
}) {
  if (tramites.length === 0) {
    return (
      <Panel>
        <h2 className="text-lg">{titulo}</h2>
        <p className="text-sm text-ink2 mt-1">Nada pendiente.</p>
      </Panel>
    );
  }

  return (
    <Panel className={alerta ? "border-warn" : ""}>
      <h2 className="text-lg">{titulo}</h2>
      {ayuda ? <p className="text-xs text-ink2 mt-1 mb-2">{ayuda}</p> : null}
      <div className="flex flex-col">
        {tramites.map((t) => {
          const s = saldos.find((x) => x.tarjeta_id === t.tarjeta_id);
          const disponible = s ? s.contable - s.comprometido : null;
          const pedido = t.deposito_solicitado ?? 0;
          const despues = disponible === null ? null : disponible - pedido;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => alAbrir(t.id)}
              className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line py-2 text-left"
            >
              <div>
                <p className="text-sm">{t.cliente_nombre}</p>
                <p className="text-2xs text-ink2 tnum">
                  {t.oferta_referencia ?? ""} {s ? `· ${s.nombre}` : ""}
                </p>
              </div>
              <div className="text-right">
                <p className="text-base tnum">{formatear(aCentavos(pedido))}</p>
                {despues !== null && (
                  <p className={`text-2xs tnum ${despues < 0 ? "text-danger" : "text-ink2"}`}>
                    Disponible después: {formatear(aCentavos(despues))}
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </Panel>
  );
}
