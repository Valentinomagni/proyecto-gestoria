#!/usr/bin/env node
/**
 * ============================================================================
 *  EL TEAL PASA CONTRASTE, Y SE MIDE
 * ============================================================================
 *
 *  El spec da los valores "aprox." y dice, textual: "los valores finales se sacan muestreando una
 *  captura del sitio y se ajustan hasta pasar contraste AA, medido, no a ojo".
 *
 *  Esto es el "medido". Lee los tokens de `src/index.css` y calcula el contraste real de cada par
 *  que va a existir en pantalla, en claro Y en oscuro.
 *
 *  ============================================================================
 *   POR QUE 4,5 PARA TEXTO Y 3 PARA LO DEMAS
 *  ============================================================================
 *
 *  Son los umbrales AA de WCAG. El de 3:1 vale para elementos de interfaz —un borde, un anillo de
 *  foco, un icono— porque no hay que leerlos letra por letra. El de 4,5:1 vale para texto.
 *
 *  Mezclarlos es el error facil: un anillo de foco que pasa 3:1 esta bien, y el mismo color como
 *  texto no.
 *
 *  ============================================================================
 *   POR QUE MIDE HEX Y NO OKLCH
 *  ============================================================================
 *
 *  Porque el archivo esta escrito en hex, y los veinte tokens que ya existen tambien. El spec
 *  proponia OKLCH argumentando que interpolar colores en RGB pasa por grises embarrados — cierto,
 *  pero la unica animacion de este producto es de POSICION, no de color. Un token en OKLCH entre
 *  veinte en hex seria inconsistente sin ganar nada.
 *
 *  Si algun dia hay una transicion de color de verdad, se cambia el formato y este guardian
 *  aprende a leer los dos.
 */
import { readFileSync } from "node:fs";

/** De `#rrggbb` a los tres canales en 0..1. */
function hexASrgb(hex) {
  const h = hex.replace("#", "");
  const n =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255);
}

/** Un canal de sRGB a lineal. Vive afuera: no depende de nada de `luminancia`. */
const aLineal = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);

/** Luminancia relativa, tal como la define WCAG. */
function luminancia([r, g, b]) {
  return 0.2126 * aLineal(r) + 0.7152 * aLineal(g) + 0.0722 * aLineal(b);
}

function contraste(c1, c2) {
  const [a, b] = [luminancia(c1), luminancia(c2)].toSorted((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}

const css = readFileSync("src/index.css", "utf8");

/**
 * Saca el valor de un token dentro de un bloque.
 *
 * SE BUSCA POR BLOQUE Y NO EN TODO EL ARCHIVO porque cada token esta tres veces: en `:root`, en
 * `[data-theme="dark"]` y en el `@media`. Medir el claro contra un valor del oscuro daria un
 * numero que no existe en ninguna pantalla.
 */
function token(nombre, bloque) {
  const desde = css.indexOf(bloque);
  if (desde < 0) return null;
  const hasta = css.indexOf("\n}", desde);
  const trozo = css.slice(desde, hasta);
  const m = new RegExp(`--${nombre}\\s*:\\s*(#[0-9a-fA-F]{3,8})`).exec(trozo);
  return m === null ? null : hexASrgb(m[1]);
}

/*
  ============================================================================
   LOS PARES QUE VAN A EXISTIR DE VERDAD EN PANTALLA, Y SOLO ESOS
  ============================================================================

  Medir pares que nunca se dibujan juntos da una falsa sensacion de rigor y ademas obliga a
  ajustar un color por un problema que no existe.

  `--side-*` son los del cromado: eran la barra lateral y pasan a ser la tira superior y la de
  migas. `--accent` es el unico acento de la app —boton principal, foco, seleccion— y por eso se
  mide como texto sobre su propio fondo y como elemento de interfaz sobre la superficie.
*/
const PARES = [
  { texto: "side-ink", fondo: "side-bg", minimo: 4.5, donde: "el texto de la tira superior" },
  { texto: "side-ink", fondo: "side-bg2", minimo: 4.5, donde: "el texto de la tira de migas" },
  {
    texto: "side-ink2",
    fondo: "side-bg2",
    minimo: 4.5,
    donde: "el nombre de quien entro, en las migas",
  },
  { texto: "accent-ink", fondo: "accent", minimo: 4.5, donde: "el texto del boton principal" },
  { texto: "ink", fondo: "accent-soft", minimo: 4.5, donde: "el texto de una fila seleccionada" },
  {
    texto: "accent",
    fondo: "surface",
    minimo: 3,
    donde: "el anillo de foco y los bordes del acento",
  },
  { texto: "danger", fondo: "surface", minimo: 4.5, donde: "una Diferencia en negativo" },
  { texto: "warn", fondo: "surface", minimo: 4.5, donde: "la cuenta de los que esperan plata" },
  /*
    EL VERDE ENTRO EL 28/08/2026, Y LO ENCONTRO AXE Y NO ESTE GUARDIAN. Daba 3,47:1 sobre blanco,
    el mismo defecto que el ambar del dia anterior — y este archivo no lo veia porque su lista de
    pares no lo nombraba.

    La leccion no es "faltaba un par": es que una lista escrita a mano se queda corta en silencio.
    Los TRES estados se miden ahora, porque los tres se dibujan como texto sobre la superficie.
  */
  { texto: "done", fondo: "surface", minimo: 4.5, donde: "el sello de atendido y lo hecho" },
];

/*
  EL MODO OSCURO SE MIDE APARTE, y no es de mas: dar por buenos los valores del claro es
  exactamente el error que este guardian existe para evitar. Un teal que pasa sobre blanco puede
  no pasar sobre un fondo casi negro, y al reves.
*/
const TEMAS = [
  { nombre: "claro ", bloque: ":root {" },
  { nombre: "oscuro", bloque: ':root[data-theme="dark"] {' },
];

/*
  ============================================================================
   LOS DOS BLOQUES OSCUROS TIENEN QUE DECIR LO MISMO
  ============================================================================

  El oscuro esta escrito DOS VECES: en `[data-theme="dark"]`, que es cuando alguien lo elige, y
  en el `@media (prefers-color-scheme: dark)`, que es cuando lo trae el sistema operativo.

  ESTO PASO EL 28/08/2026, mientras se escribia este mismo archivo. Un reemplazo cambio el primero
  y no el segundo —el `@media` esta indentado distinto— y la app quedo con DOS TEMAS OSCUROS
  DISTINTOS segun como se hubiera llegado: quien apretaba el interruptor veia el teal, y quien
  tenia el sistema en oscuro veia el cromado negro viejo.

  No lo agarra ninguna prueba de contraste, porque los dos pasan por separado. Y no se ve mirando,
  salvo que alguien pruebe LOS DOS CAMINOS, que es justo lo que nadie hace.
*/
/**
 * El contenido de un bloque, hasta SU llave de cierre.
 *
 * SE CUENTAN LAS LLAVES y no se busca un `\n  }` por indentacion. La primera version hacia eso y
 * estaba mal: para el bloque de nivel superior, el primer `\n  }` del archivo aparece recien
 * adentro del `@media`, asi que se tragaba todo lo que hay en el medio y comparaba dos textos que
 * no eran los que decia comparar. El sintoma fue perfecto: decia que los bloques diferian y
 * despues no encontraba ni una diferencia que mostrar.
 */
const bloqueOscuro = (marca) => {
  const desde = css.indexOf(marca);
  if (desde < 0) return null;

  let nivel = 0,
    i = desde + marca.length - 1;
  for (; i < css.length; i++) {
    if (css[i] === "{") nivel++;
    else if (css[i] === "}" && --nivel === 0) break;
  }

  return [...css.slice(desde, i).matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/g)]
    .map((m) => `${m[1]}: ${m[2].trim()}`)
    .toSorted()
    .join("\n");
};

const elegido = bloqueOscuro(':root[data-theme="dark"] {');
const delSistema = bloqueOscuro(':root:not([data-theme="light"]) {');

let malos = 0;

if (elegido === null || delSistema === null) {
  console.error("\n  No encontre uno de los dos bloques de modo oscuro.");
  malos++;
} else if (elegido !== delSistema) {
  console.error("\n  LOS DOS MODOS OSCUROS NO DICEN LO MISMO:\n");
  const a = new Map(elegido.split("\n").map((l) => l.split(": ")));
  const b = new Map(delSistema.split("\n").map((l) => l.split(": ")));
  for (const [k, v] of a) {
    if (b.get(k) !== v)
      console.error(`    --${k}:  elegido "${v}"   sistema "${b.get(k) ?? "falta"}"`);
  }
  for (const [k, v] of b)
    if (!a.has(k)) console.error(`    --${k}:  solo en el del sistema, "${v}"`);
  console.error(
    "\n  Quien elige el oscuro y quien lo tiene en el sistema verian cosas distintas.\n",
  );
  malos++;
}

for (const tema of TEMAS) {
  console.log(`\n  --- ${tema.nombre} ---`);
  for (const p of PARES) {
    const t = token(p.texto, tema.bloque) ?? token(p.texto, ":root {");
    const f = token(p.fondo, tema.bloque) ?? token(p.fondo, ":root {");
    if (t === null || f === null) {
      console.error(`  FALTA  --${p.texto} o --${p.fondo} en ${tema.nombre.trim()}`);
      malos++;
      continue;
    }
    const r = contraste(t, f);
    const ok = r >= p.minimo;
    if (!ok) malos++;
    console.log(
      `  ${ok ? "OK  " : "MAL "} ${r.toFixed(2).padStart(5)}:1  (min ${p.minimo})  ` +
        `--${p.texto} sobre --${p.fondo}  — ${p.donde}`,
    );
  }
}

if (malos > 0) {
  console.error(`\n  ${malos} problema(s).`);
  console.error(
    "  Si un par no llega al minimo: bajale luminosidad al teal hasta que llegue. NO le",
  );
  console.error(
    "  bajes saturacion, que un teal desaturado se ve enfermo — eso lo dice el spec.\n",
  );
  process.exit(1);
}

console.log("\ncontraste: todos los pares pasan AA, en claro y en oscuro.");
process.exit(0);
