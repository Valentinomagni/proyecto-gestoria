import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { esLaMismaBase } from "./base";

/**
 * El cliente de Supabase. Uno solo para toda la app.
 *
 * La URL y la clave entran por variable de entorno, NO escritas en el codigo: es lo que permite
 * que la vista previa de Cloudflare apunte a una base y produccion a otra. Sin eso, las dos
 * escriben en el mismo lado, que es el problema que tiene hoy el Tablero.
 *
 * LA CLAVE PUBLICABLE ES PUBLICA POR DISENIO. Viaja en el navegador de todos y se asume conocida
 * por cualquiera. Lo que protege los datos es la RLS, no esta clave. Confundir las dos cosas es
 * lo que lleva a creer que esconder algo del bundle es una proteccion.
 */
const URL = import.meta.env["VITE_SUPABASE_URL"];
const CLAVE = import.meta.env["VITE_SUPABASE_ANON_KEY"];

if (!URL || !CLAVE) {
  // Falla fuerte y temprano. Un cliente a medio configurar da errores de red raros mas tarde,
  // en otra pantalla, y ahi nadie los relaciona con una variable que falta.
  throw new Error(
    "Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY. Copia .env.example a .env.local y completalo.",
  );
}

export const supabase = createClient<Database>(URL, CLAVE);

/**
 * Si desarrollo y producción comparten la misma base, contra las variables de verdad.
 *
 * La decisión —y por qué el cartel se calcula en vez de estar escrito a mano— vive en `base.ts`,
 * SIN dependencias, para que su prueba pueda correr sin credenciales.
 */
export function hayUnaSolaBase(): boolean {
  return esLaMismaBase(URL, import.meta.env["VITE_SUPABASE_URL_PRODUCCION"] as string | undefined);
}
