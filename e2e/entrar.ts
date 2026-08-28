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

/**
 * Carga un depósito de prueba en la primera tarjeta y devuelve su id.
 *
 * SE USA SOLO PARA LA PRUEBA DE TIEMPO REAL, que necesita que la plata se mueva desde AFUERA de
 * la pantalla que está mirando. Quien lo llame tiene que anularlo en un `finally`.
 */
export async function cargarDepositoPorLaApi(
  importe: number,
  /*
    EN QUE TARJETA. Sin esto siempre cae en la primera por `orden`, que es PARIS AUTOS — la que
    tiene once millones y la que mira la duenia. La prueba del salto necesita depositar en una
    tarjeta VACIA, que es donde puede haber alguien esperando plata, y ademas conviene que el
    movimiento de prueba caiga lo mas lejos posible de la plata de verdad.
  */
  nombreDeTarjeta?: string,
): Promise<number> {
  const { token, tarjetaId } = await sesionDeGerencia(nombreDeTarjeta);

  const r = await fetch(`${URL_BASE}/rest/v1/movimientos`, {
    method: "POST",
    headers: {
      apikey: CLAVE,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      tarjeta_id: tarjetaId,
      tipo: "ingreso",
      importe,
      concepto: "PRUEBA DE TIEMPO REAL",
      fecha_acreditacion: new Date().toISOString().slice(0, 10),
    }),
  });

  const filas = (await r.json()) as { id: number }[];
  if (!r.ok || filas.length === 0) throw new Error(`no se pudo cargar: ${JSON.stringify(filas)}`);
  return filas[0].id;
}

/** Lo deshace por la misma puerta que usaría una persona: `anular_movimiento`, con su motivo. */
export async function anularPorLaApi(id: number, motivo: string): Promise<void> {
  const { token } = await sesionDeGerencia();

  const r = await fetch(`${URL_BASE}/rest/v1/rpc/anular_movimiento`, {
    method: "POST",
    headers: {
      apikey: CLAVE,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_id: id, p_motivo: motivo }),
  });
  if (!r.ok) throw new Error(`no se pudo anular ${String(id)}: ${await r.text()}`);
}

/**
 * El token de gerencia y una tarjeta. Se pide cada vez: son dos llamadas y no vale cachear.
 *
 * Sin nombre, la primera por `orden`. Con nombre, esa — y si no existe, FALLA en vez de caer en
 * la primera: depositar en la tarjeta equivocada es mover plata donde nadie lo pidió, y el
 * síntoma sería una prueba que "no salta" por una razón que no tiene nada que ver.
 */
async function sesionDeGerencia(
  nombreDeTarjeta?: string,
): Promise<{ token: string; tarjetaId: string }> {
  const rSesion = await fetch(`${URL_BASE}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: CLAVE, "Content-Type": "application/json" },
    body: JSON.stringify({ email: CORREO.gerencia, password: env["PRUEBA_PASSWORD"] ?? "" }),
  });
  const { access_token: token } = (await rSesion.json()) as { access_token: string };

  const filtro =
    nombreDeTarjeta === undefined
      ? "order=orden&limit=1"
      : `nombre=ilike.*${encodeURIComponent(nombreDeTarjeta)}*&limit=1`;

  const rTarjeta = await fetch(
    `${URL_BASE}/rest/v1/tarjetas_habitualista?select=id,nombre&${filtro}`,
    {
      headers: { apikey: CLAVE, Authorization: `Bearer ${token}` },
    },
  );
  const tarjetas = (await rTarjeta.json()) as { id: string; nombre: string }[];

  if (tarjetas.length === 0) {
    throw new Error(
      `No hay ninguna tarjeta que se llame "${nombreDeTarjeta ?? ""}". No se deposita a ciegas.`,
    );
  }
  return { token, tarjetaId: tarjetas[0].id };
}
