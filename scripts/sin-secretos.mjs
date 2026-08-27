#!/usr/bin/env node
// ============================================================================
//  Detector de secretos. Corre en el pre-commit y en CI.
//
//  POR QUE EXISTE, y no es una precaucion generica: en el Tablero Contable una contrasena
//  quedo en el historial de git. Su propio docs/SEGURIDAD.md la marca con severidad ALTA y
//  sigue ahi, porque sacarla exige reescribir la historia del repositorio. Este archivo es
//  la diferencia entre cinco minutos hoy y ese problema para siempre.
//
//  QUE MIRA: lo que esta en el area de preparacion (staged), no el disco entero. Un secreto
//  en un archivo ignorado no es un problema; uno a punto de entrar al historial, si.
// ============================================================================

import { execFileSync } from "node:child_process";

/**
 * Cada patron con su nombre en castellano, porque el mensaje lo lee una persona apurada
 * que esta por commitear y necesita saber QUE encontro, no una expresion regular.
 */
const PATRONES = [
  { nombre: "token de cuenta de Supabase", re: /\bsbp_[a-f0-9]{40}\b/ },
  { nombre: "clave secreta de Supabase (saltea la RLS)", re: /\bsb_secret_[A-Za-z0-9_-]{10,}/ },
  { nombre: "token de GitHub (fine-grained)", re: /\bgithub_pat_[A-Za-z0-9_]{20,}/ },
  { nombre: "token clasico de GitHub", re: /\bgh[pousr]_[A-Za-z0-9]{30,}/ },
  { nombre: "clave privada", re: /-----BEGIN (RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/ },
  { nombre: "clave de servicio en un JWT", re: /"role"\s*:\s*"service_role"/ },
  // OJO: `clave` NO esta en esta lista, y es a proposito.
  //
  // Estaba, y el primer commit del proyecto se freno con diez falsos positivos sobre una
  // definicion de columnas de Excel: `{ titulo: "Fecha de alta", clave: "fechaAlta" }`. En un
  // codigo escrito en castellano, `clave` quiere decir "key" mucho mas seguido que
  // "contrasena", y marcarla convierte al detector en ruido.
  //
  // Y esa es la falla que importa: un guardian que se dispara sobre codigo correcto se
  // desactiva a la semana, y con el se va la proteccion contra el secreto que si importaba.
  // Lo que de verdad hay que atrapar —tokens de Supabase, de GitHub, claves privadas— tiene
  // patrones propios y no depende de esta linea.
  {
    nombre: "contrasena escrita a mano",
    re: /\b(password|contrasena|contraseña|passwd)\s*[:=]\s*["'][^"'\s]{8,}["']/i,
  },
  { nombre: "token de Sentry", re: /\bsntrys_[A-Za-z0-9_]{20,}/ },
];

/**
 * Lo que NO se revisa, con su motivo.
 *
 * `sin-secretos.mjs` se excluye a si mismo porque CONTIENE los patrones: si se revisara,
 * fallaria siempre sobre su propia definicion. Es el caso clasico del detector que se
 * detecta a si mismo.
 *
 * Los planes y la documentacion se revisan igual que el codigo: el peor lugar donde puede
 * quedar un secreto es un documento, porque nadie lo busca ahi.
 */
const EXCLUIDOS = [/^scripts\/sin-secretos\.mjs$/, /^package-lock\.json$/];

function archivosPreparados() {
  const salida = execFileSync("git", ["diff", "--cached", "--name-only", "--diff-filter=ACM"], {
    encoding: "utf8",
  });
  return salida
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

function contenidoPreparado(archivo) {
  // Se lee la version PREPARADA, no la del disco. Si alguien edita el archivo despues de
  // hacer `git add`, lo que va a entrar al historial es la preparada, y es la que importa.
  try {
    return execFileSync("git", ["show", `:${archivo}`], {
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
    });
  } catch {
    return "";
  }
}

const hallazgos = [];

for (const archivo of archivosPreparados()) {
  if (EXCLUIDOS.some((re) => re.test(archivo))) continue;
  const texto = contenidoPreparado(archivo);
  if (!texto) continue;
  const lineas = texto.split("\n");
  for (let i = 0; i < lineas.length; i++) {
    for (const { nombre, re } of PATRONES) {
      if (re.test(lineas[i])) hallazgos.push({ archivo, linea: i + 1, nombre });
    }
  }
}

if (hallazgos.length === 0) {
  process.exit(0);
}

console.error("");
console.error("  El commit se frena: hay algo que parece un secreto.");
console.error("");
for (const h of hallazgos) {
  console.error(`  ${h.archivo}:${h.linea}  ->  ${h.nombre}`);
}
console.error("");
console.error("  Que hacer:");
console.error("    1. Sacalo del archivo. Los secretos van en .env.local, que esta ignorado.");
console.error("    2. Si ya lo commiteaste antes, no alcanza con borrarlo: hay que ROTARLO.");
console.error("    3. Si es un falso positivo, agregalo a EXCLUIDOS en scripts/sin-secretos.mjs");
console.error("       CON EL MOTIVO ESCRITO AL LADO.");
console.error("");
process.exit(1);
