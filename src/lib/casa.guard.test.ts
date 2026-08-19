import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * GUARDIAN DE LAS REGLAS DE LA CASA — R32, R35.
 *
 * ALCANCE, declarado: emojis, hexadecimales escritos a mano, origen de los iconos, y metricas
 * por persona. Revisa `src/`, incluidos los `.ts`.
 *
 * NO cubre `.tnum` en los importes: ese chequeo llega junto con `src/lib/plata.ts`, que es lo
 * que va a dar los importes formateados. Un chequeo sobre algo que todavia no existe seria
 * una casilla marcada sin evidencia atras, que es justo lo que este proyecto no hace.
 */

const EXENTOS = new Set(["src/lib/casa.guard.test.ts", "src/index.css"]);

/**
 * SIMBOLOS TIPOGRAFICOS LEGITIMOS.
 *
 * La categoria Unicode `So` NO significa emoji: marca tambien simbolos de uso corriente. Los
 * tres casos de abajo se descubrieron corriendo este mismo filtro sobre el plan del proyecto,
 * ANTES de que existiera una linea de codigo:
 *
 *   - `°` en `5° dia habil`, que ademas viene citado textual de la norma de la DNRPA;
 *   - `‰` en el arancel de prenda, que es el uno por mil del contrato;
 *   - los caracteres de dibujo de cajas de los diagramas de dependencias.
 *
 * Excluirlos no es aflojar el guardian: es lo que lo mantiene vivo. Un guardian que se dispara
 * sobre texto correcto se desactiva a la semana, y con el se va la proteccion contra el emoji
 * que si importaba.
 */
const TIPOGRAFICOS = new Set(["°", "º", "ª", "§", "†", "‰", "±", "×", "÷"]);
function esTipograficoLegitimo(c: string): boolean {
  const p = c.codePointAt(0) ?? 0;
  if (TIPOGRAFICOS.has(c)) return true;
  if (p >= 0x2500 && p <= 0x257f) return true; // dibujo de cajas
  if (p >= 0x2190 && p <= 0x21ff) return true; // flechas
  return false;
}

/**
 * `ℹ` (U+2139) es categoria `Ll` —LETRA minuscula, no simbolo— porque vive en el bloque de
 * simbolos parecidos a letras. Un filtro por categoria de simbolo NO LO VE. Y el selector de
 * variacion que lo acompania (U+FE0F) no es espacio en blanco, asi que sobrevive a un
 * `split().join()` y queda suelto en medio de la frase.
 *
 * Los dos casos estan pagados en el Estudio Contable Magni y por eso van explicitos.
 */
const LETRAS_QUE_SON_EMOJI = new Set(["ℹ", "™", "⤴", "⤵"]);

function esEmoji(c: string): boolean {
  if (esTipograficoLegitimo(c)) return false;
  if (LETRAS_QUE_SON_EMOJI.has(c)) return true;
  if (c === "️") return true; // selector de variacion
  const p = c.codePointAt(0) ?? 0;
  if (p >= 0x1f000 && p <= 0x1ffff) return true; // pictogramas
  if (p >= 0x2600 && p <= 0x27bf) return true; // simbolos varios y dingbats
  return false;
}

/** Hexadecimal de color escrito a mano: `#fff`, `#18181b`. Todo color sale de los tokens. */
const HEX = /#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?\b/;

/** Cualquier libreria de iconos que no sea lucide-react. */
const ICONOS_AJENOS = /from\s+["'](react-icons|@heroicons|@tabler\/icons|font-awesome|@mui\/icons)/;

/**
 * Metricas por persona. R35, y no es cortesia: el dia que exista un ranking de gestoras, los
 * presupuestos se cargan tarde y redondeados, y el comprometido —que es la razon de ser del
 * sistema— pasa a ser mentira. Es el modo de falla mas probable del proyecto y no es tecnico.
 */
const POR_PERSONA = /(group\s+by|groupBy|agrupar\w*)[^;\n]*\bgestora(_id)?\b/i;

function archivos(dir: string): string[] {
  const salida: string[] = [];
  for (const entrada of readdirSync(dir)) {
    const ruta = join(dir, entrada);
    if (statSync(ruta).isDirectory()) salida.push(...archivos(ruta));
    else if (/\.(ts|tsx)$/.test(entrada)) salida.push(ruta);
  }
  return salida.filter((a) => !EXENTOS.has(a.replaceAll("\\", "/")));
}

function esComentario(linea: string): boolean {
  const t = linea.trimStart();
  return t.startsWith("*") || t.startsWith("//") || t.startsWith("/*");
}

function recorrer(prueba: (linea: string) => boolean, saltearComentarios = true): string[] {
  const hallazgos: string[] = [];
  for (const archivo of archivos("src")) {
    const lineas = readFileSync(archivo, "utf8").split("\n");
    lineas.forEach((linea, i) => {
      if (saltearComentarios && esComentario(linea)) return;
      if (prueba(linea)) hallazgos.push(`${archivo}:${i + 1}  ${linea.trim().slice(0, 90)}`);
    });
  }
  return hallazgos;
}

describe("guardian de las reglas de la casa", () => {
  it("cero emojis, ni en la interfaz ni en los comentarios", () => {
    // Aca NO se saltean los comentarios: la regla es cero emojis en todo el proyecto.
    const hallazgos = recorrer((l) => [...l].some(esEmoji), false);
    expect(hallazgos, `Emoji encontrado. Los iconos salen de lucide-react:\n${hallazgos.join("\n")}`).toEqual([]);
  });

  it("ningun hexadecimal de color escrito a mano", () => {
    const hallazgos = recorrer((l) => HEX.test(l));
    expect(hallazgos, `Color a mano. Todo sale de los tokens de src/index.css:\n${hallazgos.join("\n")}`).toEqual([]);
  });

  it("los iconos salen solo de lucide-react", () => {
    const hallazgos = recorrer((l) => ICONOS_AJENOS.test(l));
    expect(hallazgos, `Libreria de iconos ajena:\n${hallazgos.join("\n")}`).toEqual([]);
  });

  it("nada se agrupa por gestora", () => {
    const hallazgos = recorrer((l) => POR_PERSONA.test(l));
    expect(
      hallazgos,
      `Metrica por persona. El dia que exista un ranking de gestoras, los presupuestos se cargan tarde y redondeados:\n${hallazgos.join("\n")}`,
    ).toEqual([]);
  });

  it("los patrones distinguen lo legitimo de lo prohibido", () => {
    // Los tres falsos positivos que ya aparecieron en este proyecto, como casos de test.
    expect(esEmoji("°")).toBe(false);
    expect(esEmoji("‰")).toBe(false);
    expect(esEmoji("└")).toBe(false);
    expect(esEmoji("→")).toBe(false);
    // Y los que si hay que atrapar, incluido el que se disfraza de letra.
    expect(esEmoji("ℹ")).toBe(true);
    expect(esEmoji("️")).toBe(true);
    expect(esEmoji("\u{1f600}")).toBe(true);
    expect(esEmoji("✅")).toBe(true);
    // Hexadecimales: sólo colores, no cualquier almohadilla.
    expect(HEX.test('color: "#18181b"')).toBe(true);
    expect(HEX.test("// ver seccion #3 del manual")).toBe(false);
    // Agrupar por gestora esta mal; filtrar por gestora esta bien.
    expect(POR_PERSONA.test("group by gestora_id")).toBe(true);
    expect(POR_PERSONA.test("where gestora_id = mi_gestora_id()")).toBe(false);
  });
});
