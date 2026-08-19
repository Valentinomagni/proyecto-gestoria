import { Inbox } from "lucide-react";
import { Panel } from "../../components/Panel";
import { Skeleton, SkeletonLineas } from "../../components/Skeleton";
import { EmptyState } from "../../components/EmptyState";
import { Isotipo, Lockup } from "../../components/Logo";

/**
 * La referencia viva del sistema visual.
 *
 * POR QUE EXISTE Y NO ES UN LUJO: los tres peores defectos visuales del Estudio Contable Magni
 * se descubrieron MIRANDO, no testeando —el emoji que sobrevivia al filtro, el tablero en
 * blanco por una cabecera, y la firma que publicaba un garabato gris—. Ningun test los agarro.
 *
 * Esta pantalla es donde se mira. Cuando se toca un token, se abre esto y se compara.
 *
 * Se descarta el dia que el sistema tenga tantas pantallas reales que esta sobre. No antes:
 * hoy es la unica forma de ver la escala entera junta.
 */

const ESCALA = [
  { clase: "text-2xs", px: "11px", uso: "metadatos, chips, sellos" },
  { clase: "text-xs", px: "12px", uso: "texto de apoyo, notas al pie" },
  { clase: "text-sm", px: "13px", uso: "el caballito de batalla: listas y tablas" },
  { clase: "text-base", px: "14px", uso: "cuerpo" },
  { clase: "text-lg", px: "16px", uso: "titulo de seccion" },
  { clase: "text-xl", px: "19px", uso: "titulo de pantalla" },
  { clase: "text-2xl", px: "22px", uso: "encabezado grande" },
  { clase: "text-3xl", px: "26px", uso: "cifra destacada" },
  { clase: "text-4xl", px: "32px", uso: "la cifra principal de una pantalla" },
] as const;

const ESTADOS = [
  { nombre: "done", texto: "text-done", significa: "terminado, conciliado, en termino" },
  { nombre: "warn", texto: "text-warn", significa: "por vencer, sin verificar, atencion" },
  { nombre: "danger", texto: "text-danger", significa: "vencido, sin saldo, error" },
] as const;

export function SistemaVisual() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <header className="flex items-center gap-4">
        <Isotipo tono="blanco" alto={40} />
        <div>
          <h1 className="text-xl">Sistema visual</h1>
          <p className="text-sm text-ink2">Gestoría — Grupo Paris</p>
        </div>
      </header>

      <Panel>
        <h2 className="text-lg mb-3">Tipografía</h2>
        <p className="text-sm text-ink2 mb-4">
          Nueve pasos y ninguno más. Si falta un tamaño se agrega a la escala, nunca se escribe a
          mano. Hay guardián.
        </p>
        <div className="flex flex-col gap-2">
          {ESCALA.map((p) => (
            <div key={p.clase} className="flex items-baseline gap-3 border-b border-line pb-2">
              <span className={`${p.clase} shrink-0`}>Ag</span>
              <code className="text-2xs text-ink2 tnum shrink-0">{p.clase}</code>
              <code className="text-2xs text-ink2 tnum shrink-0">{p.px}</code>
              <span className="text-xs text-ink2">{p.uso}</span>
            </div>
          ))}
        </div>
      </Panel>

      <Panel>
        <h2 className="text-lg mb-3">Color</h2>
        <p className="text-sm text-ink2 mb-4">
          La marca es monocroma. El color aparece sólo en estados: en un sistema donde lo que
          importa es si algo vence o si falta plata, un color de marca en un botón compite con la
          única señal que importa.
        </p>
        <div className="flex flex-col gap-2">
          {ESTADOS.map((e) => (
            <div key={e.nombre} className="flex items-baseline gap-3">
              <span className={`${e.texto} text-base shrink-0 w-16`}>{e.nombre}</span>
              <span className="text-sm text-ink2">{e.significa}</span>
            </div>
          ))}
        </div>
      </Panel>

      <Panel>
        <h2 className="text-lg mb-3">Números</h2>
        <p className="text-sm text-ink2 mb-3">
          Todo importe con cifras de ancho fijo, o las columnas bailan al compararlas.
        </p>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-2xs text-ink2 mb-1">con tnum</p>
            <p className="text-base tnum">$ 2.505.627,92</p>
            <p className="text-base tnum">$ 1.111.111,11</p>
            <p className="text-base tnum">$ 192.198,00</p>
          </div>
          <div>
            <p className="text-2xs text-ink2 mb-1">sin tnum</p>
            <p className="text-base">$ 2.505.627,92</p>
            <p className="text-base">$ 1.111.111,11</p>
            <p className="text-base">$ 192.198,00</p>
          </div>
        </div>
      </Panel>

      <Panel>
        <h2 className="text-lg mb-3">Carga</h2>
        <p className="text-sm text-ink2 mb-4">
          El hueco con la forma de lo que va a aparecer. Nunca la palabra que empieza con C.
        </p>
        <div className="flex flex-col gap-4">
          <SkeletonLineas cantidad={3} />
          <div className="flex gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <Skeleton className="h-10 flex-1" />
          </div>
        </div>
      </Panel>

      <Panel className="p-0 overflow-hidden">
        <EmptyState
          icono={Inbox}
          titulo="Todavía no hay trámites"
          queHacer="Cargá el primero pegando el asunto del mail que manda administración."
        />
      </Panel>

      <Panel>
        <h2 className="text-lg mb-3">Marca</h2>
        <p className="text-sm text-ink2 mb-4">
          Los archivos reales, vectorizados del logo original. Se copian, no se redibujan.
        </p>
        <div className="flex items-end gap-8">
          <Isotipo tono="blanco" alto={48} />
          <Lockup tono="blanco" alto={64} />
        </div>
      </Panel>
    </main>
  );
}
