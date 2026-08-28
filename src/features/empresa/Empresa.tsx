import { Link } from "@tanstack/react-router";
import { Panel } from "../../components/Panel";
import { SkeletonLineas } from "../../components/Skeleton";
import { aCentavos, formatearCorto } from "../../lib/plata";
import { useEmpresa } from "../../lib/resumen";
import { rutaEmpresa } from "../../rutas";

/**
 * ============================================================================
 *  NIVEL 2 — UNA EMPRESA. ES DONDE PASA EL DIA.
 * ============================================================================
 *
 *  Arriba las cuatro cifras, que se pidieron por número en la revisión del 24/08/2026 y no se
 *  rediscuten: Saldo de hoy, Depósito pendiente de acreditación, Reservado, y la DIFERENCIA —que
 *  es con la que se decide si se manda a presentar.
 *
 *  Debajo van las secciones de trámites, plegables. Todavía no están: llegan en la tarea 8.
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
    </div>
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
