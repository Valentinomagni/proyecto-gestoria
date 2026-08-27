import { HandCoins } from "lucide-react";
import { Panel } from "../../components/Panel";
import { SkeletonLineas } from "../../components/Skeleton";
import { EmptyState } from "../../components/EmptyState";
import { aCentavos, formatear } from "../../lib/plata";
import { hoyArgentina, aFechaArgentina } from "../../lib/fechas";
import { useEsperandoPlata, useSaldos, useTramites } from "../../lib/datos";

/**
 * La bandeja de pedidos de fondos. Reemplaza la foto del cuaderno.
 *
 * ES UNA LISTA DIARIA QUE SE VACIA, no una cola de urgencias. El duenio del proyecto lo dijo
 * textual: "el plazo real es diario, van y piden plata para pagar y como tarde esta al dia
 * siguiente". Tres bloques —de dias anteriores, de hoy, y esperando plata— y un contador arriba
 * con cuantos son de hoy y cuantos se pasaron.
 *
 * "QUEDA DISPONIBLE" al lado de cada pedido: cuanto queda en esa tarjeta. Es el numero que hoy no
 * existe y por el que se deposita a ciegas.
 */
export function Bandeja({ alAbrir }: { alAbrir: (id: string) => void }) {
  /*
    EL TERCER BLOQUE ERA "frenados por falta de saldo" Y CONSULTABA UN ESTADO QUE YA NO EXISTE.

    Nadie marca más que un trámite espera plata: se deduce comparando lo que la tarjeta tiene
    contra lo que tiene comprometido. Eso vive en `v_esperando_plata`, y `useEsperandoPlata` la
    lee. Si entra el depósito, los trámites se caen de la lista solos — que es lo que el estado
    no hacía, porque alguien tenía que acordarse de desmarcarlo.

    NO ES UN BLOQUE MENOS, ES EL MISMO BLOQUE CALCULADO. Y ahora dice **cuánto falta depositar**,
    que es el número por el que hoy se deposita a ciegas.
  */
  const presupuestados = useTramites({ estado: "presupuestado" });
  const esperando = useEsperandoPlata();
  const saldos = useSaldos();

  if (presupuestados.isLoading || saldos.isLoading) {
    return <SkeletonLineas cantidad={5} className="m-6 max-w-2xl" />;
  }

  const hoy = hoyArgentina();
  const todos = presupuestados.data ?? [];
  const deHoy = todos.filter((t) => aFechaArgentina(t.recibido_at) === hoy);
  const atrasadas = todos.filter((t) => aFechaArgentina(t.recibido_at) < hoy);

  if (todos.length === 0) {
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

      <EsperandoPlata filas={esperando.data ?? []} saldos={saldos.data ?? []} alAbrir={alAbrir} />
    </div>
  );
}

function Bloque({
  titulo, ayuda, tramites, saldos, alAbrir, alerta = false,
}: {
  titulo: string;
  ayuda?: string;
  tramites: { id: string; cliente_nombre: string; oferta_referencia: string | null; tarjeta_id: string | null; deposito_solicitado: number | null }[];
  saldos: { tarjeta_id: string; nombre: string; contable: number; comprometido: number; movimientos_visibles: number }[];
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
          // ============================================================================
          //  EL DISPONIBLE YA TIENE ESTE PEDIDO DESCONTADO. No se le resta de nuevo.
          // ============================================================================
          //
          //  Este numero estuvo MAL y se vio mirando la pantalla, no testeando: decia
          //  "Disponible despues" y calculaba `disponible - pedido`. Pero la reserva se crea
          //  sola cuando se carga el presupuesto —antes de que el pedido llegue a esta
          //  bandeja—, asi que ya esta adentro de `comprometido` y por lo tanto ya salio del
          //  disponible. Restarla otra vez contaba la misma plata dos veces.
          //
          //  Con un pedido chico se ve como un redondeo raro. Con veinte pedidos de un millon,
          //  la pantalla que decide si se manda plata muestra veinte millones de menos, y la
          //  respuesta es frenar tramites que si tenian con que pagarse.
          /*
            SIN MOVIMIENTOS VISIBLES NO SE MUESTRA UN IMPORTE, SE DICE QUE NO SE VE.

            El 27/08/2026 toda gestora leía acá "Queda disponible: $ 0,00" en las cinco
            tarjetas, en gris neutro, porque 0 no es menor que 0. Paris Autos tenía ocho
            millones y medio. Un cero es un número y se lee como un hecho: la gestora concluía
            que no podía salir a pagar, y lo descubría en el registro.
          */
          const seVe = s !== undefined && s.movimientos_visibles > 0;
          const disponible = seVe ? s.contable - s.comprometido : null;
          const pedido = t.deposito_solicitado ?? 0;
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
                {disponible !== null ? (
                  <p className={`text-2xs tnum ${disponible < 0 ? "text-danger" : "text-ink2"}`}>
                    Queda disponible: {formatear(aCentavos(disponible))}
                  </p>
                ) : (
                  <p className="text-2xs text-ink2">Saldo sin datos</p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </Panel>
  );
}

/**
 * ============================================================================
 *  QUIEN ESTA ESPERANDO PLATA, Y CUANTO HAY QUE DEPOSITAR
 * ============================================================================
 *
 *  ESTE BLOQUE REEMPLAZA A "frenados por falta de saldo", que era un estado que alguien tenia
 *  que marcar Y DESMARCAR a mano. El desmarcado se olvidaba: entraba el deposito y la pantalla
 *  seguia diciendo que el tramite estaba detenido.
 *
 *  Ahora sale de `v_esperando_plata`, y se cae solo en cuanto la plata acredita.
 *
 *  ============================================================================
 *   AGRUPA POR TARJETA, Y ESE ES EL PUNTO
 *  ============================================================================
 *
 *  Lo que falta NO es de cada tramite: es de la tarjeta. La plata es de la tarjeta y se la
 *  reparten todos los presupuestos vivos — si hay tres tramites de 60 contra un saldo de 100,
 *  ninguno de los tres sale tranquilo aunque cualquiera de ellos entre solo.
 *
 *  Listarlo tramite por tramite con su "falta" al lado repetiria el mismo numero tres veces y
 *  haria pensar que hay que depositar el triple. Se deposita UNA VEZ, la diferencia de la
 *  tarjeta, y salen los tres.
 *
 *  ============================================================================
 *   NO DICE DE QUIEN ES CADA TRAMITE, Y ES A PROPOSITO
 *  ============================================================================
 *
 *  Esta pantalla es para decidir a donde mandar plata, no para saber quien pidio mas. Poner la
 *  gestora al lado de cada monto convertiria una lista de trabajo en una tabla de posiciones, y
 *  el dia que exista esa tabla los presupuestos se cargan tarde y redondeados.
 */
function EsperandoPlata({
  filas, saldos, alAbrir,
}: {
  filas: { tramite_id: string; cliente_nombre: string; oferta_referencia: string | null; tarjeta_id: string; pide: number; falta: number }[];
  saldos: { tarjeta_id: string; nombre: string }[];
  alAbrir: (id: string) => void;
}) {
  if (filas.length === 0) return null;

  // Una entrada por tarjeta, con sus tramites adentro. `falta` es igual en todas las filas de la
  // misma tarjeta, asi que alcanza con quedarse con la primera.
  const porTarjeta = new Map<string, { falta: number; filas: typeof filas }>();
  for (const f of filas) {
    const yaEsta = porTarjeta.get(f.tarjeta_id);
    if (yaEsta === undefined) porTarjeta.set(f.tarjeta_id, { falta: f.falta, filas: [f] });
    else yaEsta.filas.push(f);
  }

  return (
    <Panel className="border-warn">
      <h2 className="text-lg">Esperando plata</h2>
      <p className="text-xs text-ink2 mt-1 mb-2">
        No dependen de quien mira esta pantalla: dependen de que entre plata. En cuanto el
        depósito acredita, salen de acá solos.
      </p>

      <div className="flex flex-col gap-4">
        {[...porTarjeta].map(([tarjetaId, grupo]) => (
          <div key={tarjetaId}>
            <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
              <p className="text-sm">
                {saldos.find((s) => s.tarjeta_id === tarjetaId)?.nombre ?? "Sin tarjeta"}
              </p>
              <p className="text-sm tnum text-danger">
                Falta depositar {formatear(aCentavos(grupo.falta))}
              </p>
            </div>

            {grupo.filas.map((f) => (
              <button
                key={f.tramite_id}
                type="button"
                onClick={() => alAbrir(f.tramite_id)}
                className="flex w-full flex-wrap items-baseline justify-between gap-2 border-b border-line py-2 text-left"
              >
                <div>
                  <p className="text-sm">{f.cliente_nombre}</p>
                  <p className="text-2xs text-ink2 tnum">{f.oferta_referencia ?? ""}</p>
                </div>
                <p className="text-base tnum">{formatear(aCentavos(f.pide))}</p>
              </button>
            ))}
          </div>
        ))}
      </div>
    </Panel>
  );
}
