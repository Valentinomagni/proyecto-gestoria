import { Panel } from "../../components/Panel";
import { SkeletonLineas } from "../../components/Skeleton";
import { formatearFechaHora } from "../../lib/fechas";
import { aCentavos, formatear } from "../../lib/plata";
import type { CambioDelTramite } from "../../lib/datos";

/**
 * ============================================================================
 *  LOS CAMBIOS DEL PRESUPUESTO
 * ============================================================================
 *
 *  Ahora que el depósito se puede corregir hasta que se paga, hace falta poder ver QUE se
 *  corrigió y quién lo hizo.
 *
 *  ESTA EN LA FICHA Y NO EN LA CUENTA CORRIENTE a propósito. El movimiento de ajuste ya queda en
 *  el extracto de la tarjeta, pero cuando alguien pregunta por qué el presupuesto no es el que
 *  se había dicho, abre el TRAMITE — no el extracto.
 *
 *  Lo escribe un trigger, así que registra el cambio venga de donde venga. Un historial con
 *  agujeros es peor que ninguno: se lo lee como completo.
 */
export function HistorialPresupuesto({
  cambios, cargando,
}: {
  cambios: CambioDelTramite[];
  cargando: boolean;
}) {
  if (cargando) return <Panel><SkeletonLineas cantidad={2} /></Panel>;

  // Sin cambios no se dibuja nada. Un panel vacío que dice "no hay cambios" ocupa lugar en la
  // pantalla del teléfono para no decir nada: la mayoría de los trámites nunca se corrigen.
  if (cambios.length === 0) return null;

  return (
    <Panel className="flex flex-col gap-2">
      <h2 className="text-lg">Cambios del presupuesto</h2>
      <p className="text-2xs text-ink2">
        Queda registrado quién lo cambió y de cuánto a cuánto. No se puede editar ni borrar.
      </p>
      <div className="flex flex-col">
        {cambios.map((c) => (
          <div key={c.id} className="border-b border-line py-2 last:border-0">
            <p className="text-sm">{describir(c)}</p>
            <p className="text-2xs text-ink2 tnum">
              {c.quien_nombre ?? "Alguien"} · {formatearFechaHora(c.cuando)}
            </p>
          </div>
        ))}
      </div>
    </Panel>
  );
}

/**
 * Cómo se lee un cambio.
 *
 * El importe pasa por el módulo de plata en vez de mostrarse crudo: el trigger lo guarda como
 * texto decimal —`640000.00`— y así, sin puntos de miles, un número de siete cifras se lee mal
 * justo cuando importa distinguir 64.000 de 640.000.
 */
function describir(c: CambioDelTramite): string {
  if (c.que === "deposito") {
    const antes = c.antes === null ? null : formatear(aCentavos(c.antes));
    const despues = c.despues === null ? "sin depósito" : formatear(aCentavos(c.despues));
    return antes === null ? `Depósito: ${despues}` : `Depósito: de ${antes} a ${despues}`;
  }
  // Un concepto llega ya armado por el trigger, con su nombre y su momento.
  return c.antes === null ? `Concepto agregado: ${c.despues ?? ""}` : `Concepto: de ${c.antes} a ${c.despues ?? ""}`;
}
