import { useState } from "react";
import { Wallet } from "lucide-react";
import { Panel } from "../../components/Panel";
import { SkeletonLineas } from "../../components/Skeleton";
import { EmptyState } from "../../components/EmptyState";
import { aCentavos, formatear } from "../../lib/plata";
import { useAnularMovimiento, useMovimientos, useSaldos } from "../../lib/datos";
import { recordado, recordar } from "../../lib/recordar";
import { CAMPO_SUELTO } from "../../lib/campos";
import { puedeMoverSaldo } from "../../lib/roles";
import { useSesion } from "../../lib/sesion";
import { Operaciones } from "./Operaciones";

/**
 * La pantalla de la Tarjeta Habitualista.
 *
 * CALCA LA FORMA DE LO QUE YA USAN. El pedido lo dice textual: "Quisiera un formato similar a
 * lo que estamos acostumbradas a manejar, como la imagen de la pagina de la Tarjeta
 * Habitualista, con un saldo inicial y listado de operaciones". Arriba las cifras, abajo el
 * extracto. No es una preferencia estetica: es la forma mental con la que ya trabajan.
 */
export function Tarjeta() {
  const saldos = useSaldos();
  const { perfil } = useSesion();
  const anular = useAnularMovimiento();

  /*
    LA TARJETA ELEGIDA SE RECUERDA. Sin esto, la pantalla volvia siempre a la primera de la
    lista: quien trabaja todo el dia con una razon social tenia que elegirla de nuevo cada vez
    que iba y volvia. Es la clase de friccion chica y repetida que hace que se vuelva al Excel.

    Se comprueba contra la lista real antes de usarla: una tarjeta que se dio de baja, o la
    preferencia de otra empresa que quedo en esa computadora, no puede dejar la pantalla vacia.
  */
  const [tarjetaId, setTarjetaId] = useState<string | null>(() => recordado("tarjeta"));
  const existe = saldos.data?.some((s) => s.tarjeta_id === tarjetaId) ?? false;
  const elegida = (existe ? tarjetaId : null) ?? saldos.data?.[0]?.tarjeta_id ?? null;

  function elegir(id: string): void {
    setTarjetaId(id);
    recordar("tarjeta", id);
  }

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

  /*
    ============================================================================
     LAS CUATRO COLUMNAS, CON LOS NOMBRES QUE USA LA EMPRESA
    ============================================================================

    Los nombres los dictó el usuario y se copian literales. No es un detalle de redacción: esta
    pantalla tiene que poder compararse contra el sitio de Habitualista sin traducir nada
    mentalmente, y "Contable" o "En tránsito" son palabras del sistema, no de la operación.

    LA CUARTA ES LA QUE DECIDE. Es con la que se contesta la única pregunta que importa a la
    mañana: ¿alcanza para mandar a presentar? Cuando da negativo se pinta en rojo, porque
    significa que hay más comprometido que plata.

    LA CUENTA REGRESIVA AL CORTE SE SACO a pedido. Lo que decía —que un depósito ordenado después
    de las 16:00 acredita pasado mañana— sigue estando donde se necesita: en el formulario de
    Cargar dinero, que es el momento en que alguien decide depositar.
  */
  const diferencia = saldo.contable - saldo.comprometido;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl">Tarjeta Habitualista</h1>
        <select
          value={elegida ?? ""}
          onChange={(e) => elegir(e.target.value)}
          className={CAMPO_SUELTO}
        >
          {saldos.data?.map((s) => (
            <option key={s.tarjeta_id} value={s.tarjeta_id}>{s.nombre}</option>
          ))}
        </select>
      </div>

      {/*
        LAS CUATRO CIFRAS SÓLO SE MUESTRAN SI SE PUEDEN LEER LOS MOVIMIENTOS.

        La vista hace `left join` y `coalesce(...,0)`, así que una tarjeta cuyos movimientos no se
        ven sale con los mismos ceros que una vacía. El 27/08/2026 toda gestora leía las cinco
        tarjetas en `$ 0,00` mientras Paris Autos tenía ocho millones y medio.

        Un cero es un número y se lee como un hecho. "Sin datos" no.
      */}
      {saldo.movimientos_visibles === 0 ? (
        <Panel>
          <p className="text-sm">No podés ver los movimientos de esta tarjeta.</p>
          <p className="text-xs text-ink2 mt-1">
            No quiere decir que esté en cero: quiere decir que no hay datos para mostrarte. Vas a
            ver el saldo de las tarjetas donde tengas trámites.
          </p>
        </Panel>
      ) : (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Cifra
          rotulo="Saldo día de hoy"
          valor={saldo.contable}
          ayuda="Lo acreditado. Tiene que coincidir con el sitio."
        />
        <Cifra
          rotulo="Depósito pendiente de acreditación"
          valor={saldo.en_transito}
          ayuda="Ordenado, acredita mañana. Todavía no se puede gastar."
          apagado
        />
        <Cifra
          rotulo="Saldo reservado"
          valor={saldo.comprometido}
          ayuda="Presupuestos cargados y sin pagar."
        />
        <Cifra
          rotulo="Diferencia"
          valor={diferencia}
          ayuda="Saldo de hoy menos lo reservado. Con esto se decide si se presenta."
          destacado
          alerta={diferencia < 0}
        />
      </div>
      )}

      <Operaciones
        movimientos={movimientos.data ?? []}
        cargando={movimientos.isLoading}
        puedeAnular={puedeMoverSaldo(perfil?.rol ?? "sin_asignar")}
        alAnular={(id, motivo) => anular.mutate({ id, motivo })}
        anulando={anular.isPending}
      />
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
