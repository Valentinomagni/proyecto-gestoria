import { Link } from "@tanstack/react-router";
import { Panel } from "../../components/Panel";
import { SkeletonLineas } from "../../components/Skeleton";
import { EmptyState } from "../../components/EmptyState";
import { Inbox } from "lucide-react";
import { aCentavos, formatearCorto } from "../../lib/plata";
import { useEmpresa } from "../../lib/resumen";
import { useEsperandoPlata, useGestoras, useTramites, type Tramite } from "../../lib/datos";
import { rutaEmpresa } from "../../rutas";
import { SeccionPlegable } from "./SeccionPlegable";
import { FilaDeTramite } from "./FilaDeTramite";

/**
 * ============================================================================
 *  NIVEL 2 — UNA EMPRESA. ES DONDE PASA EL DIA.
 * ============================================================================
 *
 *  Arriba las cuatro cifras, que se pidieron por número en la revisión del 24/08/2026 y no se
 *  rediscuten: Saldo de hoy, Depósito pendiente de acreditación, Reservado, y la DIFERENCIA —que
 *  es con la que se decide si se manda a presentar.
 *
 *  Debajo, las secciones de trámites: qué espera plata, qué está en curso, y —plegado— lo que
 *  ya pasó.
 */
export function Empresa() {
  const { razonSocialId } = rutaEmpresa.useParams();
  const empresa = useEmpresa(razonSocialId);

  if (empresa.isLoading) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col gap-4 p-6">
        <SkeletonLineas cantidad={1} className="max-w-48" />
        <Panel>
          <SkeletonLineas cantidad={2} />
        </Panel>
      </div>
    );
  }

  /*
    UNA EMPRESA QUE NO EXISTE LO DICE, y ofrece la salida. Puede ser un enlace viejo, o un id
    escrito a mano. Sin esto la pantalla queda en blanco, que no distingue entre "no existe",
    "no tenés permiso" y "se rompió algo" — y quien la mira no puede ni avisar bien qué le pasó.
  */
  if (empresa.data === null || empresa.data === undefined) {
    return (
      <div className="mx-auto max-w-lg p-6">
        <h1 className="text-xl">Esa empresa no existe</h1>
        <p className="mt-2 text-sm text-ink2">
          Puede ser un enlace viejo, o que la empresa ya no esté activa.
        </p>
        <Link to="/" className="mt-4 inline-block text-sm underline">
          Ir al resumen
        </Link>
      </div>
    );
  }

  const e = empresa.data;
  const seVe = e.movimientos_visibles > 0;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4 p-6">
      <h1 className="text-xl">{e.nombre}</h1>

      {!seVe ? (
        <Panel>
          <p className="text-sm">No podés ver los movimientos de esta tarjeta.</p>
          <p className="mt-1 text-xs text-ink2">
            No quiere decir que esté en cero: quiere decir que no hay datos para mostrarte. Vas a
            ver el saldo de las empresas donde tengas trámites.
          </p>
        </Panel>
      ) : (
        <Panel className="grid gap-4 sm:grid-cols-4">
          <Cifra rotulo="Saldo día de hoy" valor={e.contable} />
          <Cifra rotulo="Depósito pendiente" valor={e.en_transito} apagado />
          <Cifra rotulo="Saldo reservado" valor={e.comprometido} />
          {/*
            LA CUARTA ES LA QUE DECIDE, y por eso es la mas grande de la pantalla. Es la primera
            de las nueve decisiones del acabado: el numero con el que se decide algo va grande y
            su rotulo chico. Una app se ve barata cuando todos los textos miden parecido.
          */}
          <Cifra rotulo="Diferencia" valor={e.diferencia} destacado />
        </Panel>
      )}

      <SeccionesDeTramites razonSocialId={razonSocialId} />
    </div>
  );
}

/** Lo que piden estos tramites, en centavos. Fuera del componente: no captura nada de el. */
const sumar = (lista: Tramite[]): number =>
  lista.reduce((t, x) => t + aCentavos(x.deposito_solicitado ?? 0), 0);

/**
 * ============================================================================
 *  LAS CUATRO SECCIONES, Y SU CRITERIO DE ARRANQUE
 * ============================================================================
 *
 *  | Sección       | Qué trae                                  | Arranca  |
 *  |---------------|-------------------------------------------|----------|
 *  | Esperan plata | Presupuestados cuya tarjeta no cubre       | Abierta  |
 *  | En curso      | Todo lo que sigue avanzando               | Abierta  |
 *  | Terminados    | Devueltos                                 | Plegada  |
 *  | Anulados      | Anulados                                  | Plegada  |
 *
 *  EL CRITERIO ES UNO SOLO: abierto lo que necesita algo, plegado lo que ya pasó. Los terminados
 *  y los anulados no acumulan ruido, pero siguen estando — acá nada se borra, y si dentro de seis
 *  meses alguien busca un cliente tiene que encontrar el trámite Y por qué no salió.
 */
function SeccionesDeTramites({ razonSocialId }: { razonSocialId: string }) {
  const tramites = useTramites({ razonSocialId });
  const esperando = useEsperandoPlata();
  const gestoras = useGestoras();

  if (tramites.isLoading) {
    return (
      <Panel>
        <SkeletonLineas cantidad={4} />
      </Panel>
    );
  }

  const todos = tramites.data ?? [];

  if (todos.length === 0) {
    return (
      <Panel className="p-0 overflow-hidden">
        <EmptyState
          icono={Inbox}
          titulo="Esta empresa todavía no tiene trámites"
          queHacer="Cuando se cargue el primero, aparece acá con su presupuesto y su estado."
        />
      </Panel>
    );
  }

  /*
    QUIEN ESPERA PLATA SALE DE LA VISTA, NO SE RECALCULA ACA. Es la misma lista que mira la
    gestora: si esta pantalla hiciera su propia cuenta, el dia que cambie el criterio las dos
    mostrarian numeros distintos del mismo hecho.
  */
  const idsQueEsperan = new Set((esperando.data ?? []).map((t) => t.tramite_id));

  const esperan = todos.filter((t) => idsQueEsperan.has(t.id));
  const terminados = todos.filter((t) => t.estado === "devuelto");
  const anulados = todos.filter((t) => t.estado === "anulado");
  const enCurso = todos.filter(
    (t) => !idsQueEsperan.has(t.id) && t.estado !== "devuelto" && t.estado !== "anulado",
  );

  const nombreDeGestora = (id: string | null): string =>
    id === null ? "—" : ((gestoras.data ?? []).find((g) => g.id === id)?.nombre ?? "—");

  const filas = (lista: Tramite[], mostrarEstado = false): React.ReactNode =>
    lista.map((t) => (
      <FilaDeTramite
        key={t.id}
        tramite={t}
        razonSocialId={razonSocialId}
        nombreDeGestora={nombreDeGestora}
        mostrarEstado={mostrarEstado}
      />
    ));

  return (
    <>
      {esperan.length > 0 && (
        <SeccionPlegable
          titulo="Esperan plata"
          ayuda="No dependen de quien mira esta pantalla: dependen de que entre plata. En cuanto el depósito acredita, salen de acá solos."
          cuantos={esperan.length}
          total={sumar(esperan)}
          abiertaPorDefecto
          alerta
          claveDeMemoria={`seccion.esperan.${razonSocialId}`}
        >
          {filas(esperan)}
        </SeccionPlegable>
      )}

      {/*
        ============================================================================
         "EN CURSO" NO LLEVA TOTAL, Y ESO SE DECIDIO MIRANDO LA PANTALLA
        ============================================================================

        Lo llevaba, y decia `$ 821.834,56` justo debajo de un "Saldo reservado" que decia
        `$ 820.000`. Dos numeros que parecen comparables, a diez centimetros uno del otro, que no
        coinciden y que nada explica.

        La diferencia es real y tiene sentido: la seccion sumaba el presupuesto de los ocho, y
        solo los PRESUPUESTADOS comprometen plata. Los que estan en `entregado` o `recibido` con
        presupuesto cargado ya no tienen reserva —la conciliacion se la libero— pero su
        `deposito_solicitado` sigue ahi.

        LA REGLA QUE QUEDA: un total solo donde todos los tramites estan en la MISMA situacion de
        plata. "Esperan plata" son todos presupuestados y todos deben lo mismo, asi que su total
        se entiende solo. "En curso" es una mezcla, y su suma no contesta ninguna pregunta — pero
        invita a compararla con la tarjeta, que es peor que no estar.
      */}
      <SeccionPlegable
        titulo="En curso"
        cuantos={enCurso.length}
        total={null}
        abiertaPorDefecto
        claveDeMemoria={`seccion.encurso.${razonSocialId}`}
      >
        {enCurso.length === 0 ? (
          <p className="px-4 py-3 text-sm text-ink2">Ninguno en curso.</p>
        ) : (
          filas(enCurso, true)
        )}
      </SeccionPlegable>

      <SeccionPlegable
        titulo="Terminados"
        cuantos={terminados.length}
        total={null}
        abiertaPorDefecto={false}
        claveDeMemoria={`seccion.terminados.${razonSocialId}`}
      >
        {filas(terminados, true)}
      </SeccionPlegable>

      <SeccionPlegable
        titulo="Anulados"
        cuantos={anulados.length}
        total={null}
        abiertaPorDefecto={false}
        claveDeMemoria={`seccion.anulados.${razonSocialId}`}
      >
        {filas(anulados, true)}
      </SeccionPlegable>
    </>
  );
}

/** Una cifra con su rótulo. El rótulo siempre en el paso más chico; el número, según su peso. */
function Cifra({
  rotulo,
  valor,
  destacado = false,
  apagado = false,
}: {
  rotulo: string;
  valor: number;
  destacado?: boolean;
  apagado?: boolean;
}) {
  const centavos = aCentavos(valor);
  return (
    <div>
      <p className="text-2xs text-ink2">{rotulo}</p>
      <p
        className={`tnum ${destacado ? "text-2xl" : "text-lg"} ${
          /* En rojo solo si la Diferencia es negativa. Nunca del color de la marca. */
          destacado && centavos < 0 ? "text-danger" : apagado ? "text-ink2" : ""
        }`}
      >
        {formatearCorto(centavos)}
      </p>
    </div>
  );
}
