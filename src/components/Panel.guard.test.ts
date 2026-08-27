import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * GUARDIAN DE PANEL — R31. Dos chequeos, y cada uno tiene su propia historia.
 *
 * ALCANCE, declarado: cubre la tarjeta CANONICA —la superficie elevada con fondo, borde y
 * sombra— y la union invalida de --ring con --shadow. No persigue toda superficie con esquinas
 * redondeadas: en el Tablero, de 41 superficies con `rounded-2xl`, sólo 18 eran la tarjeta
 * canónica y las otras 23 eran cuatro o cinco cosas genuinamente distintas.
 *
 * Un guardian angosto que declara su alcance es honesto. Uno que finge cubrir todo necesitaria
 * quince excepciones, y eso es PEOR que no tener guardian: aparenta una cobertura que no existe.
 *
 * EL ESCAPE es el comentario `panel-guard-ok` en la linea o en las de arriba, CON EL MOTIVO
 * ESCRITO AL LADO. Es por linea y no por archivo a proposito: exentar un archivo entero deja
 * pasar cualquier copia futura adentro de el y esconde la razon lejos del codigo.
 *
 * Si algun dia hay varios marcadores, eso NO significa agregar mas marcadores: significa que a
 * Panel le falta una variante.
 */

/** La tarjeta canonica: fondo de superficie mas borde de linea, escrita a mano. */
const TARJETA_A_MANO = /\bbg-surface\b(?=[^"'`]*\bborder-line\b)/;

/**
 * `box-shadow: var(--ring), ...` — CSS invalido que el navegador descarta ENTERO, en silencio.
 * Se acepta `var(--ring-sh)`, que si es una sombra. El `(?!-sh)` es toda la diferencia.
 */
const SOMBRA_INVALIDA = /box-?[Ss]hadow[^;\n]*var\(--ring(?!-sh)\)/;

const EXENTOS = new Set(["src/components/Panel.tsx"]);

function archivosTsx(dir: string): string[] {
  const salida: string[] = [];
  for (const entrada of readdirSync(dir)) {
    const ruta = join(dir, entrada);
    if (statSync(ruta).isDirectory()) salida.push(...archivosTsx(ruta));
    else if (entrada.endsWith(".tsx") && !entrada.includes(".test.")) salida.push(ruta);
  }
  return salida;
}

/** Devuelve true si la linea, o alguna de las tres de arriba, trae el escape declarado. */
function tieneEscape(lineas: string[], i: number): boolean {
  for (let j = Math.max(0, i - 3); j <= i; j++) {
    if (lineas[j]?.includes("panel-guard-ok")) return true;
  }
  return false;
}

/**
 * Los comentarios no son codigo, y esta distincion NO es una comodidad: es necesaria.
 *
 * El comentario de Panel.tsx que explica la trampa TIENE que contener el ejemplo malo escrito
 * literal —`box-shadow: var(--ring), var(--shadow)`— porque es lo que lo hace enseniar. Sin
 * esta funcion, el guardian se dispara sobre la documentacion que lo justifica: el primer
 * intento fallo exactamente asi.
 *
 * Es el mismo problema que ya aparecio dos veces hoy en este proyecto —el simbolo de grado en
 * el filtro de emojis, y `clave:` en el detector de secretos— y siempre con la misma forma: un
 * guardian que marca texto correcto se desactiva a la semana, y con el se va la proteccion real.
 */
function esComentario(linea: string): boolean {
  const t = linea.trimStart();
  return t.startsWith("*") || t.startsWith("//") || t.startsWith("/*");
}

describe("guardian de Panel", () => {
  const archivos = archivosTsx("src").filter((a) => !EXENTOS.has(a.replaceAll("\\", "/")));

  it("la tarjeta canonica se escribe con <Panel>, no a mano", () => {
    const hallazgos: string[] = [];
    for (const archivo of archivos) {
      const lineas = readFileSync(archivo, "utf8").split("\n");
      lineas.forEach((linea, i) => {
        if (esComentario(linea)) return;
        if (TARJETA_A_MANO.test(linea) && !tieneEscape(lineas, i)) {
          hallazgos.push(`${archivo}:${i + 1}`);
        }
      });
    }
    expect(
      hallazgos,
      `Tarjeta escrita a mano. Usa <Panel>, o marca la linea con panel-guard-ok y el motivo:\n${hallazgos.join("\n")}`,
    ).toEqual([]);
  });

  it("ninguna sombra usa var(--ring), que es un color y no una sombra", () => {
    const hallazgos: string[] = [];
    for (const archivo of [...archivos, "src/components/Panel.tsx"]) {
      const lineas = readFileSync(archivo, "utf8").split("\n");
      lineas.forEach((linea, i) => {
        if (esComentario(linea)) return;
        if (SOMBRA_INVALIDA.test(linea)) hallazgos.push(`${archivo}:${i + 1}  ${linea.trim()}`);
      });
    }
    expect(
      hallazgos,
      `box-shadow con var(--ring) es CSS invalido y el navegador descarta la declaracion ENTERA, en silencio. Va var(--ring-sh):\n${hallazgos.join("\n")}`,
    ).toEqual([]);
  });

  it("los dos patrones distinguen lo bueno de lo malo", () => {
    // Existe porque un guardian que marca codigo correcto se desactiva a la semana.
    expect(SOMBRA_INVALIDA.test('style={{ boxShadow: "var(--ring-sh),var(--shadow)" }}')).toBe(false);
    expect(SOMBRA_INVALIDA.test('style={{ boxShadow: "var(--ring),var(--shadow)" }}')).toBe(true);
    expect(TARJETA_A_MANO.test('<div className="bg-surface border border-line rounded-xl">')).toBe(true);
    expect(TARJETA_A_MANO.test('<div className="bg-surface2 p-4">')).toBe(false);
    // `border-line` sin `bg-surface` es un separador, no una tarjeta.
    expect(TARJETA_A_MANO.test('<div className="border-t border-line">')).toBe(false);
    // Un comentario que ENSENIA la trampa no es una violacion; una linea de codigo si.
    expect(esComentario(" * Escribir `box-shadow: var(--ring), var(--shadow)` esta mal")).toBe(true);
    expect(esComentario('  style={{ boxShadow: "var(--ring),var(--shadow)" }}')).toBe(false);
  });
});
