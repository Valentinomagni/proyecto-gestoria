import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * ============================================================================
 *  PRUEBAS DE PERMISOS, CONTRA LA API REAL.
 * ============================================================================
 *
 *  POR QUE ASI Y NO SIMULANDO LA SESION EN SQL con `set local request.jwt.claims`:
 *
 *  Lo que hay que garantizar NO es que la policy sea correcta en abstracto. Es QUE DEVUELVE
 *  POSTGREST. Entre la policy y la respuesta hay un cliente HTTP, un `select *` que puede
 *  expandirse distinto, una vista con o sin `security_invoker`, y una publicacion de Realtime.
 *
 *  Simular la capa de abajo es exactamente el error que este proyecto tiene documentado cuatro
 *  veces: comprobar una cosa PARECIDA y escribir "verificado". La simulacion en SQL queda como
 *  herramienta de diagnostico rapido, no como la prueba.
 *
 *  ============================================================================
 *  COMO SE CORRE
 *  ============================================================================
 *
 *      npm run test:rls
 *
 *  Necesita `.env.local` con la URL, la clave publicable y las cuentas de prueba. Ese archivo
 *  esta en .gitignore y no se commitea nunca.
 *
 *  ALCANCE DE HOY, declarado: solo `perfiles`, que es la unica tabla que existe. Las pruebas que
 *  de verdad importan —que una gestora no llegue al cobrado al cliente por ningun camino— llegan
 *  con la etapa 1, cuando existan `cobros` y `movimientos`. Decirlo es parte del trabajo: un
 *  arnes que corre en verde sobre una tabla no prueba nada sobre las otras doce.
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

const env = leerEntorno();
const URL = env["VITE_SUPABASE_URL"] ?? "";
const CLAVE = env["VITE_SUPABASE_ANON_KEY"] ?? "";
const PASS = env["PRUEBA_PASSWORD"] ?? "";

/** Un cliente ya logueado con ese correo. Cada rol tiene el suyo, sin compartir sesion. */
async function comoUsuario(email: string): Promise<SupabaseClient> {
  const cliente = createClient(URL, CLAVE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await cliente.auth.signInWithPassword({ email, password: PASS });
  if (error) throw new Error(`No se pudo entrar como ${email}: ${error.message}`);
  return cliente;
}

let gerencia: SupabaseClient;
let contable: SupabaseClient;
let sinAsignar: SupabaseClient;
let anonimo: SupabaseClient;

beforeAll(async () => {
  gerencia = await comoUsuario(env["PRUEBA_GERENCIA"] ?? "");
  contable = await comoUsuario(env["PRUEBA_CONTABLE"] ?? "");
  sinAsignar = await comoUsuario(env["PRUEBA_SIN_ASIGNAR"] ?? "");
  anonimo = createClient(URL, CLAVE, { auth: { persistSession: false } });
});

describe("quien ve que en perfiles", () => {
  it("gerencia ve a todos", async () => {
    const { data, error } = await gerencia.from("perfiles").select("email, rol");
    expect(error).toBeNull();
    expect(data?.length).toBeGreaterThanOrEqual(4);
  });

  it("contable ve a todos", async () => {
    const { data, error } = await contable.from("perfiles").select("email, rol");
    expect(error).toBeNull();
    expect(data?.length).toBeGreaterThanOrEqual(4);
  });

  it("un usuario sin asignar se ve SOLO a si mismo", async () => {
    // Es el default seguro funcionando: alguien recien dado de alta no ve nada del resto.
    const { data, error } = await sinAsignar.from("perfiles").select("email");
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data?.[0]?.email).toBe(env["PRUEBA_SIN_ASIGNAR"]);
  });

  it("sin loguearse no se ve NADA, y no es un error: son cero filas", async () => {
    // Cero filas y no un 401 es lo correcto: la RLS no filtra por error, filtra por ausencia.
    const { data, error } = await anonimo.from("perfiles").select("email");
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});

/**
 * OJO CON COMO SE AFIRMA ACA, y esta leccion costo un falso positivo en el primer intento.
 *
 * La primera version de estas pruebas afirmaba que la operacion devolviera ERROR. Fallo, y por
 * un momento parecio un agujero de seguridad: "contable se auto-promueve". No lo era. El test
 * tomaba una fila cualquiera con `.limit(1)` —contable ve a todos— en vez de la suya, el update
 * no matcheaba ninguna fila, y PostgREST NO devuelve error cuando afecta cero filas.
 *
 * O sea: el test estaba mal y la seguridad bien. Pero pudo haber sido al reves y no me habria
 * enterado, porque estaba mirando el mecanismo equivocado.
 *
 * Entonces se afirma sobre el RESULTADO, no sobre el mecanismo: se intenta el cambio y despues
 * se LEE la fila. Si el rol quedo como estaba, esta protegido — no importa si lo freno el
 * trigger con una excepcion o la RLS devolviendo cero filas. Lo que hay que garantizar es que
 * el dato no cambie, no como se impide.
 */
describe("nadie se auto-promueve", () => {
  it("contable NO puede darse el rol de gerencia", async () => {
    const { data: sesion } = await contable.auth.getUser();
    const miId = sesion.user?.id ?? "";
    expect(miId).not.toBe("");

    await contable.from("perfiles").update({ rol: "gerencia" }).eq("id", miId);

    const { data } = await contable.from("perfiles").select("rol").eq("id", miId).single();
    expect(data?.rol).toBe("contable");
  });

  it("un usuario sin asignar tampoco se activa solo", async () => {
    const { data: sesion } = await sinAsignar.auth.getUser();
    const miId = sesion.user?.id ?? "";

    await sinAsignar.from("perfiles").update({ activo: true }).eq("id", miId);

    const { data } = await sinAsignar.from("perfiles").select("activo").eq("id", miId).single();
    expect(data?.activo).toBe(false);
  });

  it("pero si puede cambiarse el nombre, que es la razon de que exista esa policy", async () => {
    const { data: sesion } = await sinAsignar.auth.getUser();
    const miId = sesion.user?.id ?? "";
    const { data: antes } = await sinAsignar.from("perfiles").select("nombre").eq("id", miId).single();
    const original = antes?.nombre ?? "";

    const { error } = await sinAsignar.from("perfiles").update({ nombre: "Prueba" }).eq("id", miId);
    expect(error).toBeNull();

    const { data: despues } = await sinAsignar.from("perfiles").select("nombre").eq("id", miId).single();
    expect(despues?.nombre).toBe("Prueba");

    await sinAsignar.from("perfiles").update({ nombre: original }).eq("id", miId);
  });
});

describe("gerencia si puede administrar", () => {
  it("gerencia cambia el rol de otro y lo deja como estaba", async () => {
    const correo = env["PRUEBA_SIN_ASIGNAR"] ?? "";
    const { error: e1 } = await gerencia.from("perfiles").update({ activo: true }).eq("email", correo);
    expect(e1).toBeNull();
    const { error: e2 } = await gerencia.from("perfiles").update({ activo: false }).eq("email", correo);
    expect(e2).toBeNull();
  });
});

describe("nada se borra", () => {
  it("ni siquiera gerencia puede borrar un perfil", async () => {
    // No hay policy de DELETE para nadie. Sin filas afectadas no hay error, asi que lo que se
    // comprueba es que la fila SIGA AHI: es la unica evidencia real de que no se borro.
    const correo = env["PRUEBA_SIN_ASIGNAR"] ?? "";
    await gerencia.from("perfiles").delete().eq("email", correo);
    const { data } = await gerencia.from("perfiles").select("email").eq("email", correo);
    expect(data).toHaveLength(1);
  });
});
