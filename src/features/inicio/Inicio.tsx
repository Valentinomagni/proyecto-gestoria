import { LayoutGrid } from "lucide-react";
import { EmptyState } from "../../components/EmptyState";
import { Panel } from "../../components/Panel";

/**
 * La pantalla de inicio, todavia vacia.
 *
 * Existe porque una app sin nada no puede quedar EN BLANCO: un vacio sin explicacion se lee
 * como "esta roto". Dice lo que hay y lo que falta, y desaparece cuando llegue el listado de
 * tramites de la etapa 1.
 */
export function Inicio() {
  return (
    <div className="mx-auto max-w-3xl p-6">
      <Panel className="p-0 overflow-hidden">
        <EmptyState
          icono={LayoutGrid}
          titulo="La fundación está lista"
          queHacer="Todavía no hay trámites ni saldos: eso llega con la próxima etapa. Por ahora funcionan las cuentas, los permisos y el sistema visual."
        />
      </Panel>
    </div>
  );
}
