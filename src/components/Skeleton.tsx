import { cn } from "../lib/ui";

/**
 * El hueco con la forma de lo que va a aparecer.
 *
 * NUNCA la palabra "Cargando". Dos motivos, y ninguno es estetico:
 *  - el hueco RESERVA el espacio, asi que no hay salto cuando llegan los datos;
 *  - una espera con forma se siente mas corta que una espera con un cartel.
 *
 * Accesibilidad: `aria-busy` en el contenedor y `aria-hidden` en las barras, que son
 * decoracion y no contenido. Un lector de pantalla no tiene que leer seis rectangulos grises.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn("bg-surface2 rounded-md animate-pulse", className)} />
  );
}

/** Varias barras apiladas, para una lista o un bloque de texto. */
export function SkeletonLineas({
  cantidad = 3,
  className,
}: {
  cantidad?: number;
  className?: string;
}) {
  return (
    <div aria-busy="true" className={cn("flex flex-col gap-2", className)}>
      {Array.from({ length: cantidad }, (_, i) => (
        // La ultima sale mas corta: es lo que hace que se lea como texto y no como una grilla.
        <Skeleton key={i} className={i === cantidad - 1 ? "h-4 w-2/3" : "h-4 w-full"} />
      ))}
    </div>
  );
}
