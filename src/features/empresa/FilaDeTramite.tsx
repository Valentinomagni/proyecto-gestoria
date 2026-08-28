import { Link } from "@tanstack/react-router";
import { aCentavos, formatearCorto } from "../../lib/plata";
import { aFechaArgentina } from "../../lib/fechas";
import { nombreDeEstado } from "../tramites/Listado";

/**
 * ============================================================================
 *  UNA FILA: FECHA, CLIENTE, DOMINIO, GESTORA, PLATA
 * ============================================================================
 *
 *  En ESE orden, que es el de su planilla. El reconocimiento vale: la app anterior se rechazó tres
 *  veces, y el diagnóstico fue que estaba organizada por verbos mientras su Excel está organizado
 *  por empresas.
 *
 *  ============================================================================
 *   LA GESTORA APARECE COMO DATO DE LA FILA, NO COMO AGRUPACION NI COMO CUENTA
 *  ============================================================================
 *
 *  Es la diferencia entre "de quién es este trámite" —que hace falta para saber a quién llamar— y
 *  "cuántos lleva cada una", que es una tabla de posiciones.
 *
 *  El día que exista esa tabla, los presupuestos se cargan tarde y redondeados, y el comprometido
 *  —que es la razón de ser del sistema— pasa a ser mentira.
 *
 *  Por eso: nunca ordenar por gestora, nunca contar por gestora, nunca un total por gestora.
 */
export function FilaDeTramite({
  tramite,
  razonSocialId,
  nombreDeGestora,
  mostrarEstado = false,
}: {
  tramite: {
    id: string;
    cliente_nombre: string;
    dominio: string | null;
    oferta_referencia: string | null;
    gestora_id: string | null;
    deposito_solicitado: number | null;
    recibido_at: string;
    estado: string;
  };
  razonSocialId: string;
  nombreDeGestora: (id: string | null) => string;
  /** En "En curso" el estado importa; en "Esperan plata" son todos presupuestados. */
  mostrarEstado?: boolean;
}) {
  const pide = tramite.deposito_solicitado ?? 0;

  return (
    <Link
      to="/empresa/$razonSocialId/tramite/$tramiteId"
      params={{ razonSocialId, tramiteId: tramite.id }}
      data-fila-tramite
      className="grid grid-cols-[auto_1fr_auto] items-baseline gap-3 border-b border-line px-4 py-2 last:border-b-0 hover:bg-accent-soft sm:grid-cols-[4rem_1fr_6rem_7rem_8rem]"
    >
      <span className="tnum text-2xs text-ink2">{fechaCorta(tramite.recibido_at)}</span>

      <span className="min-w-0 truncate text-sm">{tramite.cliente_nombre}</span>

      {/* El dominio y la gestora se esconden en el teléfono: no entran, y lo que se busca ahí es
          el apellido. En el escritorio están, que es donde se trabaja con la lista abierta. */}
      <span className="hidden truncate text-2xs text-ink2 sm:block">
        {tramite.dominio ?? tramite.oferta_referencia ?? "—"}
      </span>
      <span className="hidden truncate text-2xs text-ink2 sm:block">
        {nombreDeGestora(tramite.gestora_id)}
      </span>

      <span className="tnum whitespace-nowrap text-right text-sm">
        {mostrarEstado && pide === 0 ? (
          <span className="text-2xs text-ink2">{nombreDeEstado(tramite.estado)}</span>
        ) : (
          formatearCorto(aCentavos(pide))
        )}
      </span>
    </Link>
  );
}

/**
 * `25/08` — el año no se muestra.
 *
 * En una lista de trámites vivos todos son de este año, y el año repetido cuarenta veces es ruido
 * que empuja las columnas que sí cambian. La fecha completa está en la ficha.
 *
 * SE USA LA FECHA DE ARGENTINA y no la del navegador: la base ya cuenta el día con
 * `hoy_argentina()`, y entre las 21 y las 24 las dos dirían días distintos.
 */
function fechaCorta(iso: string): string {
  const [, mes, dia] = aFechaArgentina(iso).split("-");
  return `${dia}/${mes}`;
}
