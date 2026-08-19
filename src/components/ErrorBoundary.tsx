import { Component, type ErrorInfo, type ReactNode } from "react";
import { RefreshCw, RotateCcw } from "lucide-react";
import { clasificarFalla, type Falla } from "../lib/fallas";
import { reportar } from "../lib/monitoreo";
import { Panel } from "./Panel";

/**
 * La red que impide que un error de render deje la pantalla EN BLANCO.
 *
 * POR QUE EXISTE: en el Tablero no hay ninguno —verificado en su docs/SEGURIDAD.md §1.7: "cero
 * ErrorBoundary, cero componentDidCatch"— y un error de render en cualquier componente deja la
 * pantalla vacia, sin mensaje, sin recuperacion y sin que nadie se entere.
 *
 * Lo que se muestra sale de `clasificarFalla`, asi que el mensaje esta en castellano y la accion
 * que se ofrece es la que DE VERDAD desatasca. Ofrecer "Reintentar" cuando reintentar no puede
 * funcionar es peor que no ofrecer nada: la persona aprieta tres veces y concluye que el
 * sistema esta roto.
 */

interface Props {
  children: ReactNode;
  /** Etiqueta de la pantalla, para el monitoreo. Nunca un dato de una persona. */
  donde: string;
}

interface Estado {
  falla: Falla | null;
}

export class ErrorBoundary extends Component<Props, Estado> {
  override state: Estado = { falla: null };

  static getDerivedStateFromError(e: unknown): Estado {
    // `navigator.onLine` se lee ACA y no adentro de clasificarFalla, que es pura y se puede
    // probar. El orden de sus ramas depende de este dato: sin red, ofrecer "Actualizar" deja
    // la pantalla en blanco.
    return { falla: clasificarFalla(e, navigator.onLine) };
  }

  override componentDidCatch(e: unknown, info: ErrorInfo): void {
    reportar(e, this.props.donde);
    if (import.meta.env.DEV) console.error("ErrorBoundary:", e, info.componentStack);
  }

  private actualizar = (): void => {
    // Recarga saltando el cache. Es lo unico que arregla un modulo que ya no existe en el
    // servidor porque se publico una version nueva.
    window.location.reload();
  };

  private reintentar = (): void => {
    this.setState({ falla: null });
  };

  override render(): ReactNode {
    const { falla } = this.state;
    if (!falla) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <Panel className="max-w-md">
          <h1 className="text-lg mb-2">{falla.titulo}</h1>
          <p className="text-sm text-ink2 mb-4">{falla.explicacion}</p>

          {falla.accion === "actualizar" && (
            <button
              type="button"
              onClick={this.actualizar}
              className="flex items-center gap-2 rounded-md bg-accent px-3 py-2 text-sm text-accent-ink"
            >
              <RefreshCw aria-hidden="true" size={16} />
              Actualizar
            </button>
          )}

          {falla.accion === "reintentar" && (
            <button
              type="button"
              onClick={this.reintentar}
              className="flex items-center gap-2 rounded-md bg-accent px-3 py-2 text-sm text-accent-ink"
            >
              <RotateCcw aria-hidden="true" size={16} />
              Probar de nuevo
            </button>
          )}

          {/* El detalle tecnico va plegado y ultimo: es para pegar en una consulta, no para leer.
              Que este disponible es lo que evita el "me tira un error" sin mas informacion. */}
          <details className="mt-4">
            <summary className="text-2xs text-ink2 cursor-pointer">Detalle técnico</summary>
            <pre className="text-2xs text-ink2 mt-2 whitespace-pre-wrap break-all">
              {falla.detalleTecnico}
            </pre>
          </details>
        </Panel>
      </div>
    );
  }
}
