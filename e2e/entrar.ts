import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";

/**
 * ============================================================================
 *  ENTRAR SIN TIPEAR LA CONTRASENIA EN EL FORMULARIO
 * ============================================================================
 *
 *  Se le pide el token a Supabase y se lo deja en el almacenamiento del navegador antes de que la
 *  app arranque.
 *
 *  ============================================================================
 *   POR QUE UN `fetch` CRUDO Y NO EL SDK
 *  ============================================================================
 *
 *  Se probó con `@supabase/supabase-js` y Playwright no lo puede cargar: su transpilador se cuelga
 *  en `auth-js/src/lib/webauthn.errors.ts` con "Unexpected module status 3". El arnés de permisos
 *  sí lo usa, porque corre bajo vitest, que resuelve esos módulos de otra forma.
 *
 *  Y sale mejor igual: son doce líneas contra una dependencia entera, y no hay ninguna capa que
 *  pueda cambiar de comportamiento entre versiones.
 *
 *  ============================================================================
 *   POR QUE NO SE LLENA EL FORMULARIO
 *  ============================================================================
 *
 *  Una prueba que tipea en el login es tres veces más lenta y falla el día que alguien cambie el
 *  texto del botón, por una razón que no tiene nada que ver con lo que quería comprobar. El login
 *  ya tiene su prueba en `humo.spec.ts`; meterlo en cada prueba de pantalla lo convierte en un
 *  punto único de falla de toda la suite.
 */

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);

const URL_BASE = env["VITE_SUPABASE_URL"] ?? "";
const CLAVE = env["VITE_SUPABASE_ANON_KEY"] ?? "";

/** El proyecto, sacado de la URL: es lo que arma la clave del almacenamiento. */
const REF = URL_BASE.replace("https://", "").split(".")[0];

export type Rol = "gerencia" | "contable" | "gestora";

const CORREO: Record<Rol, string> = {
  gerencia: env["PRUEBA_GERENCIA"] ?? "",
  contable: env["PRUEBA_CONTABLE"] ?? "",
  gestora: env["PRUEBA_GESTORA"] ?? "",
};

/**
 * Deja la sesión de ese rol en el navegador y abre la dirección pedida.
 *
 * `addInitScript` corre ANTES de cada carga de página, así que la sesión ya está cuando el cliente
 * de Supabase la busca. Ponerla después con `evaluate` llegaría tarde: la app ya habría decidido
 * que no hay sesión y dibujado el login.
 */
export async function entrarComo(page: Page, rol: Rol, direccion = "/"): Promise<void> {
  const r = await fetch(`${URL_BASE}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: CLAVE, "Content-Type": "application/json" },
    body: JSON.stringify({ email: CORREO[rol], password: env["PRUEBA_PASSWORD"] ?? "" }),
  });

  if (!r.ok) {
    const cuerpo: unknown = await r.json();
    throw new Error(`No se pudo entrar como ${rol}: ${JSON.stringify(cuerpo)}`);
  }

  const sesion = (await r.json()) as { expires_in: number; expires_at?: number };

  /*
    `expires_at` en SEGUNDOS, que es lo que el cliente de Supabase espera leer. Algunas versiones
    del endpoint no lo devuelven; sin él, la app trata la sesión como vencida y dibuja el login —
    un fallo que parece "las credenciales están mal" y no lo está.
  */
  sesion.expires_at ??= Math.floor(Date.now() / 1000) + sesion.expires_in;

  await page.addInitScript(
    ([clave, valor]) => {
      window.localStorage.setItem(clave, valor);
    },
    [`sb-${REF}-auth-token`, JSON.stringify(sesion)] as const,
  );

  await page.goto(direccion);
}
