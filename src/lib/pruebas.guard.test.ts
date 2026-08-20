import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";

/**
 * ============================================================================
 *  GUARDIAN DE PRUEBAS. Ningún test unitario puede llegar al cliente de Supabase.
 * ============================================================================
 *
 *  ESTE GUARDIAN NACIO DE UN DEFECTO QUE ESTUVO ABIERTO DESDE LA PRIMERA CORRIDA DE CI.
 *
 *  `respaldo.test.ts` importaba `respaldo.ts`, que importaba `supabase.ts`, que LANZA al
 *  importarse si faltan `VITE_SUPABASE_URL` o `VITE_SUPABASE_ANON_KEY`. Eso último está bien:
 *  es fallar fuerte y temprano, en vez de dar errores de red raros más tarde en otra pantalla.
 *
 *  Pero en CI no hay `.env.local`. Así que el archivo explotaba antes de correr un solo test, y
 *  **el CI estuvo en rojo desde el primer día sin que nadie lo notara**, porque en la máquina de
 *  quien programa el archivo sí existe y todo pasaba.
 *
 *  ============================================================================
 *   LA LECCION, que vale más que el arreglo
 *  ============================================================================
 *
 *  Un portón que sólo funciona en una máquina no es un portón. Y la forma de este defecto es la
 *  peor: no rompía nada visible, no daba un síntoma, y cada commit nuevo lo arrastraba.
 *
 *  Por eso el arreglo no fue "poner las variables en CI" —eso lo habría tapado y habría dejado
 *  los tests corriendo contra un cliente a medio armar—, sino sacar la dependencia: `respaldo.ts`
 *  ahora RECIBE con qué leer.
 *
 *  ALCANCE: sigue los imports relativos, que son los que atan un módulo del proyecto con otro.
 *  No sigue los de paquetes, que no pueden llegar a `supabase.ts`. Las pruebas de permisos
 *  (`*.rls.test.ts`) están excluidas a propósito: corren en otra configuración, contra la API
 *  real, y necesitan credenciales de verdad — ése es justamente su trabajo.
 */

const CLIENTE = "src/lib/supabase.ts";

function archivos(dir: string): string[] {
  const salida: string[] = [];
  for (const entrada of readdirSync(dir)) {
    const ruta = join(dir, entrada);
    if (statSync(ruta).isDirectory()) salida.push(...archivos(ruta));
    else if (/\.tsx?$/.test(entrada)) salida.push(ruta);
  }
  return salida;
}

const normal = (p: string): string => p.replaceAll("\\", "/");

/** Los imports relativos de un archivo, resueltos a rutas del proyecto. */
function importaA(archivo: string): string[] {
  const fuente = readFileSync(archivo, "utf8");
  const crudos = [...fuente.matchAll(/from\s+["'](\.[^"']+)["']/g)].map((m) => m[1]);
  const salida: string[] = [];

  for (const crudo of crudos) {
    if (crudo === undefined) continue;
    const base = resolve(dirname(archivo), crudo);
    // Se prueban las terminaciones porque el import va sin extensión.
    for (const fin of [".ts", ".tsx", "/index.ts", "/index.tsx", ""]) {
      if (existsSync(base + fin) && statSync(base + fin).isFile()) {
        salida.push(normal(base + fin));
        break;
      }
    }
  }
  return salida;
}

/** Todo lo que un archivo termina cargando, siguiendo la cadena. */
function alcanceDe(archivo: string): Set<string> {
  const visto = new Set<string>();
  const pendientes = [resolve(archivo)];

  while (pendientes.length > 0) {
    const actual = pendientes.pop();
    if (actual === undefined) continue;
    const clave = normal(actual);
    if (visto.has(clave)) continue;
    visto.add(clave);
    if (!existsSync(actual)) continue;
    pendientes.push(...importaA(actual));
  }
  return visto;
}

describe("guardian de pruebas", () => {
  it("ningún test unitario carga el cliente de Supabase", () => {
    const cliente = normal(resolve(CLIENTE));
    const hallazgos: string[] = [];

    for (const archivo of archivos("src")) {
      const ruta = normal(archivo);
      if (!/\.test\.tsx?$/.test(ruta)) continue;
      if (ruta.endsWith(".rls.test.ts")) continue; // esas SÍ necesitan credenciales

      if (alcanceDe(archivo).has(cliente)) {
        hallazgos.push(ruta);
      }
    }

    expect(
      hallazgos,
      "Estos tests terminan cargando src/lib/supabase.ts, que lanza si faltan las variables de\n" +
        "entorno. Pasan donde hay .env.local y fallan en CI:\n" +
        hallazgos.join("\n") +
        "\n\nSe arregla sacando la dependencia —que el módulo RECIBA con qué leer—, no poniendo\n" +
        "las variables en CI: eso lo taparía y dejaría los tests contra un cliente a medio armar.",
    ).toEqual([]);
  });

  it("el guardián sabe seguir una cadena de imports", () => {
    // Existe porque un guardián que no encuentra nada y un guardián roto se ven igual.
    // `datos.ts` importa `supabase.ts` directo: si esto no lo ve, el de arriba no vale nada.
    const alcance = alcanceDe("src/lib/datos.ts");
    expect(alcance.has(normal(resolve(CLIENTE)))).toBe(true);

    // Y `plata.ts` no importa nada: no puede llegar.
    expect(alcanceDe("src/lib/plata.ts").has(normal(resolve(CLIENTE)))).toBe(false);
  });

  it("sigue la cadena de más de un salto", () => {
    // `Ficha.tsx` -> `datos.ts` -> `supabase.ts`. Dos saltos, que es la forma que tenía el
    // defecto real y la que un guardián de un solo nivel no habría visto.
    const alcance = alcanceDe("src/features/tramites/Ficha.tsx");
    expect(alcance.has(normal(resolve("src/lib/datos.ts")))).toBe(true);
    expect(alcance.has(normal(resolve(CLIENTE)))).toBe(true);
  });
});
