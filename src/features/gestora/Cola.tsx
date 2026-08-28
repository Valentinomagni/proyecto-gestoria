import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { agrupar, BLOQUES, type FilaDeCola } from "@/lib/cola";
import { useCola } from "@/lib/datos";
import { useSesion } from "@/lib/sesion";
import { Panel } from "@/components/Panel";
import { SkeletonLineas } from "@/components/Skeleton";
import { TarjetaDeTramite } from "./TarjetaDeTramite";
import { SaldoDeArriba } from "./SaldoDeArriba";

/*
  Una referencia estable para "todavía no hay filas". Un `?? []` escrito en el cuerpo crearía un
  array nuevo en cada dibujo, y el efecto de abajo —que compara por identidad— no pararía nunca.
*/
const SIN_FILAS: FilaDeCola[] = [];

/**
 * ============================================================================
 *  EL SALTO: QUE EL REDIBUJO PASE ADENTRO DE UNA TRANSICION DE VISTA
 * ============================================================================
 *
 *  `view-transition-name` en cada tarjeta NO ALCANZA. Es la mitad del mecanismo: el navegador
 *  anima el viaje sólo si el cambio de DOM ocurre adentro de `document.startViewTransition`. Sin
 *  esta parte el atributo queda puesto y sin usar, y la tarjeta desaparece de un bloque y aparece
 *  en el otro — que es exactamente lo que el salto viene a evitar.
 *
 *  El spec lo dice: "el ping pong es el salto". Si ella no ve que es LA MISMA tarjeta la que se
 *  movió, la pantalla sólo cambió sola, y eso se lee como que algo se recargó.
 *
 *  `flushSync` es obligatorio: `startViewTransition` saca la foto del "antes", corre el callback y
 *  saca la del "después". Un `setState` normal es asíncrono, así que la segunda foto saldría
 *  idéntica a la primera y no habría nada que animar.
 *
 *  Y si el navegador no la tiene, se actualiza y ya. La lista es lo que importa; la animación es
 *  cómo se entiende.
 */
function useConSalto(valor: FilaDeCola[]): FilaDeCola[] {
  const [visible, setVisible] = useState(valor);

  useEffect(() => {
    if (Object.is(visible, valor)) return;

    /*
      LA PRIMERA LLEGADA DE DATOS NO ES UN SALTO. Se pasa de la lista vacía a la lista entera, y
      animar eso hace que TODAS las tarjetas parezcan haberse movido cuando en realidad recién
      aparecieron. El salto tiene que significar una sola cosa —entró plata y esto cambió de
      bloque—; si también significa "terminó de cargar", deja de querer decir nada.

      Lo agarró la prueba que espía `startViewTransition`: contaba 1 antes de tocar la plata.
    */
    if (Object.is(visible, SIN_FILAS)) {
      setVisible(valor);
      return;
    }

    const doc = document as Document & {
      startViewTransition?: (f: () => void) => unknown;
    };
    if (typeof doc.startViewTransition !== "function") {
      setVisible(valor);
      return;
    }
    doc.startViewTransition(() => {
      flushSync(() => {
        setVisible(valor);
      });
    });
  }, [valor, visible]);

  return visible;
}

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

  /*
    SE LLAMA ANTES DE CUALQUIER `return`. Un hook detrás de una salida temprana se saltea en
    algunos dibujos y en otros no, y React lo trata como un error de orden de hooks.

    TanStack Query devuelve LA MISMA referencia mientras el contenido no cambie, así que esto
    compara por identidad sin falsos positivos y el efecto no corre en cada refetch.
  */
  const filas = useConSalto(cola.data ?? SIN_FILAS);

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

  const porBloque = agrupar(filas);

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4 p-4">
      <div>
        <h1 className="text-xl">Hola {perfil?.nombre ?? ""}</h1>
        <SaldoDeArriba />
      </div>

      {BLOQUES.map((b) => {
        const delBloque = porBloque[b.valor];
        return (
          <Panel key={b.valor} densidad="compacta" className="p-0">
            <h2 className="px-4 pt-3 text-2xs uppercase tracking-wide text-ink2">
              {b.titulo} ({delBloque.length})
            </h2>
            <div data-bloque={b.valor}>
              {delBloque.length === 0 ? (
                <p className="px-4 py-3 text-xs text-ink2">{b.vacio}</p>
              ) : (
                delBloque.map((f) => <TarjetaDeTramite key={f.tramite_id} fila={f} />)
              )}
            </div>
          </Panel>
        );
      })}
    </div>
  );
}
