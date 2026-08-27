import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * ============================================================================
 *  GUARDIAN DE CAMPOS. Un control se dibuja desde `campos.ts` o no se dibuja.
 * ============================================================================
 *
 *  POR QUE EXISTE. La misma cadena de clases estaba copiada en DIEZ lugares de seis archivos,
 *  con tres constantes distintas llamadas `INPUT` en tres archivos distintos. Cuando hubo que
 *  subir la altura de los controles a 44 px para que se puedan tocar en un telefono, ese
 *  arreglo eran diez ediciones — y el arreglo que se hace nueve veces deja la app con dos
 *  aspectos y a nadie sabiendo cual es el bueno.
 *
 *  ES DE LA MISMA FAMILIA que los guardianes de tipografia, de `Panel` y de la casa: el sistema
 *  visual no se mantiene pidiendolo por favor, se mantiene volviendo imposible saltearlo.
 *
 *  ALCANCE, declarado y angosto: marca la cadena de clases del CONTROL copiada a mano. No
 *  revisa que cada pantalla use el control que corresponde, ni mide nada en el navegador. Eso
 *  se mira mirando, que es como aparecio este problema.
 */

const DUENIO = "src/lib/campos.ts";

const PROHIBIDO: { patron: RegExp; motivo: string }[] = [
  {
    patron: /border-line\s+bg-surface2\s+px-\d/,
    motivo: "la caja de un campo escrita a mano: va CAMPO o CAMPO_SUELTO de lib/campos.ts",
  },
  {
    patron: /bg-accent\s+px-\d+\s+py-\d+\s+text-sm\s+text-accent-ink/,
    motivo: "el botón principal escrito a mano: va BOTON de lib/campos.ts",
  },
  {
    // 16 px es el umbral con el que Safari en iPhone decide hacer zoom solo. Un campo de texto
    // por debajo de eso corre la pantalla al tocarlo y no vuelve.
    //
    // El `(?<![\w:-])` es lo que distingue `text-sm` de `sm:text-sm`, y no es un detalle: la
    // primera version del patron marcaba `text-base sm:text-sm`, que es JUSTO la forma
    // correcta. Un guardian que marca lo correcto se desactiva a la semana.
    patron:
      /<input(?![^>]*type="(checkbox|radio)")[^>]*className="[^"]*(?<![\w:-])text-(2xs|xs|sm)\b/,
    motivo:
      "un campo de texto de menos de 16 px: Safari en iPhone hace zoom solo al tocarlo. " +
      "Va text-base, o text-base sm:text-sm",
  },
];

function archivos(dir: string): string[] {
  const salida: string[] = [];
  for (const entrada of readdirSync(dir)) {
    const ruta = join(dir, entrada);
    if (statSync(ruta).isDirectory()) salida.push(...archivos(ruta));
    else if (/\.tsx?$/.test(entrada)) salida.push(ruta);
  }
  return salida;
}

function esComentario(linea: string): boolean {
  const t = linea.trimStart();
  return t.startsWith("*") || t.startsWith("//") || t.startsWith("/*");
}

describe("guardian de campos", () => {
  it("nadie escribe a mano la clase de un control", () => {
    const hallazgos: string[] = [];
    for (const archivo of archivos("src")) {
      const normal = archivo.replaceAll("\\", "/");
      if (normal === DUENIO || normal.endsWith("campos.guard.test.ts")) continue;
      // El sistema visual es la herramienta que MUESTRA los controles; ahi la copia es el punto.
      if (normal.includes("features/sistema/")) continue;

      const lineas = readFileSync(archivo, "utf8").split("\n");
      lineas.forEach((linea, i) => {
        if (esComentario(linea)) return;
        for (const { patron, motivo } of PROHIBIDO) {
          if (patron.test(linea)) hallazgos.push(`${normal}:${i + 1}  ${motivo}`);
        }
      });
    }
    expect(
      hallazgos,
      `Clases de control escritas a mano en vez de usar src/lib/campos.ts:\n${hallazgos.join("\n")}`,
    ).toEqual([]);
  });

  it("los patrones no marcan texto que está bien", () => {
    // Existe porque un guardián que marca código correcto se desactiva a la semana.
    const correctas = [
      `<input className={CAMPO} />`,
      `<span className="text-xs text-ink2">Correo</span>`,
      `<p className="text-2xs text-ink2">Contable</p>`,
      `<input type="checkbox" className="text-sm" />`,
      `<input className="w-full bg-transparent text-base outline-none sm:text-sm" />`,
      `<button className={BOTON}>Cargar</button>`,
    ];
    for (const linea of correctas) {
      for (const { patron } of PROHIBIDO) {
        expect(patron.test(linea), `marcó de más: ${linea}`).toBe(false);
      }
    }
  });

  it("los patrones sí marcan lo que tienen que marcar", () => {
    const malas = [
      `<input className="rounded-md border border-line bg-surface2 px-3 py-2 text-sm" />`,
      `<button className="rounded-md bg-accent px-4 py-2 text-sm text-accent-ink">Guardar</button>`,
      `<input className="w-full text-sm" />`,
    ];
    for (const linea of malas) {
      expect(
        PROHIBIDO.some(({ patron }) => patron.test(linea)),
        `no marcó: ${linea}`,
      ).toBe(true);
    }
  });
});
