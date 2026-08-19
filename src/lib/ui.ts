/**
 * Junta clases de CSS descartando lo vacio, lo nulo y lo falso.
 *
 * Deliberadamente simple: NO resuelve conflictos entre clases de Tailwind. Si un componente
 * trae `p-3` y quien lo usa le pasa `p-6`, van las dos y decide el orden del CSS. El dia que
 * eso moleste de verdad entra `tailwind-merge`; hasta entonces son dos dependencias para un
 * problema que todavia no aparecio.
 */
export function cn(...clases: (string | false | null | undefined)[]): string {
  return clases.filter(Boolean).join(" ");
}
