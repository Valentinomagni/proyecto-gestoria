import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Lo que se muestra cuando todavia no hay nada.
 *
 * POR QUE ES UN COMPONENTE Y NO UN `<p>` suelto: el primer dia del sistema TODAS las pantallas
 * estan vacias. Un vacio sin explicacion se lee como "esta roto", y el primer dia es cuando
 * menos se puede permitir esa lectura.
 *
 * Por eso `que_hacer` no es opcional. Una pantalla vacia que no dice el paso siguiente es una
 * pantalla que deja a alguien trabado sin saber a quien preguntarle.
 */
export function EmptyState({
  icono: Icono,
  titulo,
  queHacer,
  accion,
}: {
  icono: LucideIcon;
  titulo: string;
  /** El paso siguiente, en castellano y en imperativo voseante. Obligatorio a proposito. */
  queHacer: string;
  accion?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <Icono aria-hidden="true" className="text-ink2" size={28} strokeWidth={1.5} />
      <p className="text-lg">{titulo}</p>
      <p className="text-sm text-ink2 max-w-sm">{queHacer}</p>
      {accion}
    </div>
  );
}
