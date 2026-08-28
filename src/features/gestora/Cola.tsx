import { agrupar, BLOQUES } from "@/lib/cola";
import { useCola } from "@/lib/datos";
import { useSesion } from "@/lib/sesion";
import { Panel } from "@/components/Panel";
import { SkeletonLineas } from "@/components/Skeleton";
import { TarjetaDeTramite } from "./TarjetaDeTramite";
import { SaldoDeArriba } from "./SaldoDeArriba";

/**
 * ============================================================================
 *  LA COLA: UNA PANTALLA, TRES BLOQUES, NINGUN FILTRO
 * ============================================================================
 *
 *  Sin menú, sin tabla, sin buscador y sin selector de empresa. Cada trámite dice de qué empresa
 *  es; un selector la obligaría a saber de antemano por cuál preguntar, y ella no piensa por
 *  empresa: piensa por trámite. Está en el spec, sección 5.
 *
 *  LOS TRES BLOQUES SE DIBUJAN SIEMPRE, vacíos incluidos, cada uno con su frase. Un bloque que
 *  desaparece cuando no tiene nada deja la pantalla distinta cada día, y una pantalla que cambia
 *  de forma obliga a leerla entera de nuevo cada vez.
 */
export function Cola() {
  const { perfil } = useSesion();
  const cola = useCola();

  if (cola.isPending) return <SkeletonLineas cantidad={4} className="mx-auto max-w-xl p-4" />;

  if (cola.isError) {
    return (
      <div className="mx-auto max-w-xl p-4">
        <Panel>
          <p className="text-sm">No se pudo traer tu lista de trámites.</p>
          <p className="mt-1 text-xs text-ink2">
            Probá de nuevo en un rato. Si sigue igual, avisale a la oficina.
          </p>
        </Panel>
      </div>
    );
  }

  const porBloque = agrupar(cola.data);

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4 p-4">
      <div>
        <h1 className="text-xl">Hola {perfil?.nombre ?? ""}</h1>
        <SaldoDeArriba />
      </div>

      {BLOQUES.map((b) => {
        const filas = porBloque[b.valor];
        return (
          <Panel key={b.valor} densidad="compacta" className="p-0">
            <h2 className="px-4 pt-3 text-2xs uppercase tracking-wide text-ink2">
              {b.titulo} ({filas.length})
            </h2>
            <div data-bloque={b.valor}>
              {filas.length === 0 ? (
                <p className="px-4 py-3 text-xs text-ink2">{b.vacio}</p>
              ) : (
                filas.map((f) => <TarjetaDeTramite key={f.tramite_id} fila={f} />)
              )}
            </div>
          </Panel>
        );
      })}
    </div>
  );
}
