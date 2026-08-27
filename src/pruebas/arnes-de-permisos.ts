import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

/**
 * ============================================================================
 *  EL ARMADO DE LAS SESIONES PARA LAS PRUEBAS DE PERMISOS
 * ============================================================================
 *
 *  Vive acá y no adentro de un archivo de pruebas porque hay más de uno: `permisos.rls.test.ts`
 *  cubre perfiles, cobros y el libro mayor, y `permisos-plata.rls.test.ts` cubre el presupuesto
 *  y las anulaciones. Copiar estas treinta líneas en el segundo sería exactamente la duplicación
 *  que este proyecto trata como defecto: el día que cambie cómo se entra, cambiaría en un lado
 *  y no en el otro, y el arnés que no se actualizó pasaría en verde sin probar lo mismo.
 *
 *  NO ESTA EN `src/lib/`, y es a propósito: este archivo LEE `.env.local` al importarse. Si un
 *  día alguien lo importara desde una pantalla por error, la app dejaría de compilar en un
 *  entorno sin ese archivo. En `src/pruebas/` se ve que no es código de producción.
 */

function leerEntorno(): Record<string, string> {
  const texto = readFileSync(".env.local", "utf8");
  const salida: Record<string, string> = {};
  for (const linea of texto.split("\n")) {
    const t = linea.trim();
    if (t === "" || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i > 0) salida[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return salida;
}

export const env = leerEntorno();

const URL = env["VITE_SUPABASE_URL"] ?? "";
const CLAVE = env["VITE_SUPABASE_ANON_KEY"] ?? "";
const PASS = env["PRUEBA_PASSWORD"] ?? "";

/** Un cliente ya logueado con ese correo. Cada rol tiene el suyo, sin compartir sesión. */
export async function comoUsuario(email: string): Promise<SupabaseClient> {
  const cliente = createClient(URL, CLAVE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await cliente.auth.signInWithPassword({ email, password: PASS });
  if (error) throw new Error(`No se pudo entrar como ${email}: ${error.message}`);
  return cliente;
}

/** Un cliente SIN sesión, para comprobar que sin loguearse no se ve nada. */
export function sinSesion(): SupabaseClient {
  return createClient(URL, CLAVE, { auth: { persistSession: false } });
}

/**
 * El trámite de prueba es UNO SOLO y se reusa entre corridas.
 *
 * La primera versión del arnés creaba uno nuevo cada vez, y después de tres corridas había tres
 * trámites de prueba en la base — que además confundieron un diagnóstico, porque un `update` por
 * nombre los movió a los tres y la campana de novedades marcó tres cambios que parecían
 * duplicados y no lo eran.
 */
export const NOMBRE_DE_PRUEBA = "VISIBILIDAD DESDE EL ALTA";

/**
 * ============================================================================
 *  PONER UNA LINEA DE PRESUPUESTO, SIN USAR `upsert`
 * ============================================================================
 *
 *  Y ACA VA EL MOTIVO, PORQUE ES UNA TRAMPA QUE VA A VOLVER:
 *
 *  El índice único de un concepto por momento pasó a ser PARCIAL —`where not anulada`— para que
 *  quitar una línea no impida volver a cargar ese mismo concepto. Y un `upsert` de PostgREST no
 *  puede inferir un índice parcial: falla con
 *
 *      42P10: there is no unique or exclusion constraint matching the ON CONFLICT specification
 *
 *  La app no lo sufre, porque agrega líneas con `insert`. Pero el arnés reusa el mismo trámite
 *  entre corridas, así que necesita "poner" una línea sin saber si ya está.
 *
 *  Devuelve el mensaje de error, o null si anduvo. Así quien lo llama puede afirmar sobre él —un
 *  helper que lanza escondería justo el rechazo que algunas pruebas esperan.
 */
export async function ponerLinea(
  cliente: SupabaseClient,
  tramiteId: string,
  conceptoId: string,
  importe: number,
): Promise<string | null> {
  // Se busca la línea VIVA, no cualquiera: puede haber varias anuladas de corridas anteriores, y
  // revivirlas todas chocaría contra el mismo índice parcial.
  const { data: viva } = await cliente
    .from("tramite_conceptos")
    .select("id")
    .eq("tramite_id", tramiteId)
    .eq("concepto_id", conceptoId)
    .eq("momento", "presupuesto")
    .eq("anulada", false)
    .limit(1);

  if (viva && viva.length > 0) {
    const { error } = await cliente
      .from("tramite_conceptos")
      .update({ importe })
      .eq("id", viva[0]?.id ?? 0);
    return error?.message ?? null;
  }

  const { error } = await cliente.from("tramite_conceptos").insert({
    tramite_id: tramiteId,
    concepto_id: conceptoId,
    momento: "presupuesto",
    importe,
  });
  return error?.message ?? null;
}
