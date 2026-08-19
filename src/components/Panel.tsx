import type { ReactNode } from "react";
import { cn } from "../lib/ui";

/**
 * La tarjeta estandar del sistema.
 *
 * POR QUE EXISTE (Seiton, un lugar para cada cosa): en el Tablero Contable el mismo par de
 * estilos —fondo, borde, radio, relleno y sombra— estaba copiado a mano en 23 archivos, ya con
 * DOS variantes distintas de sombra dando vueltas. Asi empieza la deriva visual: nadie decide
 * cambiar el diseno, simplemente se van separando las copias.
 *
 * ============================================================================
 * LA TRAMPA DE LA SOMBRA. Leer antes de tocar la linea del boxShadow.
 *
 *   --ring-sh  es una SOMBRA  -> `0 0 0 1px rgba(...)`. Va adentro de box-shadow.
 *   --ring     es un COLOR    -> `var(--accent)`. Va en border-color o outline-color.
 *
 * Escribir `box-shadow: var(--ring), var(--shadow)` produce CSS invalido, y cuando UN valor de
 * la lista es invalido el navegador DESCARTA LA DECLARACION ENTERA, en silencio. En el Tablero
 * eso dejo cinco pantallas —entre ellas el tablero principal y el reporte— renderizando sin
 * ninguna sombra durante meses, y nadie lo noto.
 *
 * El segundo chequeo de Panel.guard.test.ts existe exactamente por esto.
 * ============================================================================
 */
export function Panel({
  children,
  className,
  densidad = "normal",
}: {
  children: ReactNode;
  className?: string;
  /** `compacta` para tarjetas dentro de otra tarjeta, o filas densas. */
  densidad?: "normal" | "compacta";
}) {
  return (
    <div
      className={cn(
        "bg-surface border border-line rounded-xl",
        densidad === "compacta" ? "p-3" : "p-[18px]",
        className,
      )}
      style={{ boxShadow: "var(--ring-sh),var(--shadow)" }}
    >
      {children}
    </div>
  );
}
