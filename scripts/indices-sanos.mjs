#!/usr/bin/env node
/**
 * ============================================================================
 *  NINGUN INDICE UNICO PARCIAL SE OLVIDA DE EXCLUIR LO ANULADO
 * ============================================================================
 *
 *  ESTA FORMA APARECIO TRES VECES, y la segunda dejo la app rota:
 *
 *   1. `tramite_conceptos_uno_por_momento` — una linea quitada del presupuesto seguia ocupando
 *      el lugar, y no se podia volver a cargar ese concepto. Se arreglo el 21/08/2026, con el
 *      porque escrito al lado.
 *   2. `movimientos_un_saldo_inicial` — EL MISMO ERROR, no generalizado. Consecuencia medida el
 *      26/08/2026: dos tarjetas quedaron SIN PODER RECARGAR SU SALDO DE ARRANQUE.
 *   3. `tramites_patentamiento_unico_idx` — este SI estaba bien hecho: excluye `anulado`.
 *
 *  Dos de tres mal, y la segunda cinco dias despues de arreglar la primera. Por eso deja de ser
 *  algo que hay que acordarse y pasa a ser una prueba.
 *
 *  ============================================================================
 *   COMO DECIDE
 *  ============================================================================
 *
 *  Si la tabla tiene una forma de anular —una columna `anulada`, `activa`, `estado`, o una que
 *  apunte a la correccion— entonces el indice unico parcial TIENE que nombrarla en su `WHERE`.
 *  Si no la nombra, esta mal.
 *
 *  Es deliberadamente grosero: prefiere marcar de mas y que alguien lo lea, antes que dejar
 *  pasar uno. Un guardian que no molesta nunca no esta mirando.
 */
import { readFileSync } from "node:fs";

const REF = "drsooohkwwpnijonxwwt";

let env = {};
try {
  env = Object.fromEntries(
    readFileSync(".env.local", "utf8")
      .split("\n")
      .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
      .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
  );
} catch {
  // Sin .env.local no se puede consultar nada. Se dice y se sale.
}

const token = env["SUPABASE_ACCESS_TOKEN"] ?? process.env["SUPABASE_ACCESS_TOKEN"];
if (!token) {
  /*
    SE SALTEA, PERO LO DICE. Y sale con 0 a proposito: en un repo recien clonado, sin token, el
    primer commit no deberia fallar por esto.

    Queda anotado como deuda en el ESTADO: un guardian que se saltea en silencio y devuelve 0 es
    medio guardian, y esta es la mitad que falta.
  */
  console.error("indices: sin SUPABASE_ACCESS_TOKEN no se puede consultar el esquema. Se saltea.");
  console.error("         Para correrlo: SUPABASE_ACCESS_TOKEN=sbp_... npm run indices");
  process.exit(0);
}

async function sql(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const cuerpo = await r.json();
  if (!r.ok) throw new Error(cuerpo.message ?? JSON.stringify(cuerpo));
  return cuerpo;
}

/** Las columnas con las que una tabla marca algo como anulado o dado de baja. */
const MARCAS = ["anulada", "anulado", "activa", "activo", "corrige_movimiento_id", "estado"];

/**
 * Los indices que NO tienen que excluir lo anulado, con el motivo de cada uno.
 *
 * ============================================================================
 *  ES UNA LISTA CON MOTIVOS, NO UNA LISTA DE SILENCIO
 * ============================================================================
 *
 * El guardian de arriba es deliberadamente grosero: si la tabla tiene alguna forma de anular,
 * exige que el indice la nombre. Eso marca de mas, y marcar de mas esta bien — pero un guardian
 * que marca algo correcto todas las veces se termina apagando entero.
 *
 * Entonces la excepcion se declara UNA POR UNA y con su porque. Agregar una linea acá obliga a
 * escribir por que ese indice es distinto, que es exactamente la conversacion que hay que tener
 * antes de dejarlo pasar.
 */
const CON_MOTIVO = {
  movimientos_una_reserva_por_tramite:
    "Una `reserva` no se puede anular: `anular_movimiento` la rechaza explicitamente porque la " +
    "escribio un trigger a partir del presupuesto de un tramite. Se corrige corrigiendo el " +
    "presupuesto, que escribe un `ajuste_reserva` aparte. Como nunca se anula, lo anulado no " +
    "puede ocupar el lugar.",
};

const indices = await sql(`
  select i.indexname, i.indexdef, i.tablename
    from pg_indexes i
   where i.schemaname = 'public'
     and i.indexdef like '%UNIQUE%'
     and i.indexdef like '%WHERE%'
   order by i.indexname`);

const columnas = await sql(`
  select table_name, column_name from information_schema.columns
   where table_schema = 'public'`);

const porTabla = new Map();
for (const c of columnas) {
  if (!porTabla.has(c.table_name)) porTabla.set(c.table_name, new Set());
  porTabla.get(c.table_name).add(c.column_name);
}

const malos = [];
const exceptuados = [];
for (const i of indices) {
  const cols = porTabla.get(i.tablename) ?? new Set();
  const marcasQueTiene = MARCAS.filter((m) => cols.has(m));
  if (marcasQueTiene.length === 0) continue;

  const donde = i.indexdef.slice(i.indexdef.indexOf("WHERE"));
  if (marcasQueTiene.some((m) => donde.includes(m))) continue;

  if (CON_MOTIVO[i.indexname] !== undefined) {
    exceptuados.push(i.indexname);
    continue;
  }

  malos.push(
    `  ${i.indexname}\n` +
      `     sobre ${i.tablename}, que tiene: ${marcasQueTiene.join(", ")}\n` +
      `     ${donde.replace(/\s+/g, " ").slice(0, 130)}`,
  );
}

if (malos.length === 0) {
  const nota = exceptuados.length > 0 ? ` (${exceptuados.length} con motivo declarado)` : "";
  console.log(
    `indices: ${indices.length} indices unicos parciales revisados, todos excluyen lo anulado${nota}.`,
  );
  process.exit(0);
}

console.error("\n  Hay indices unicos parciales que NO excluyen lo anulado:\n");
console.error(malos.join("\n\n"));
console.error("\n  Consecuencia: lo anulado sigue ocupando el lugar y no se puede volver a cargar.");
console.error("  Ya paso dos veces. Agregale la condicion al WHERE del indice.\n");
process.exit(1);
