import { type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import { aCentavos } from "./lib/plata";
import { comoUsuario, env, ponerLinea, sinSesion, NOMBRE_DE_PRUEBA } from "./pruebas/arnes-de-permisos";

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
 *  ALCANCE DE HOY, declarado: `perfiles`, `cobros` y `movimientos`. Las otras catorce tablas NO
 *  estan cubiertas por este arnes, y decirlo es parte del trabajo: un arnes que corre en verde
 *  sobre tres tablas no prueba nada sobre las otras catorce.
 *
 *  ESTAS TRES SON LAS QUE IMPORTAN, y por eso son estas: `perfiles` decide quien es cada uno,
 *  `cobros` guarda el margen —lo unico que una gestora no puede ver por ningun camino— y
 *  `movimientos` es el libro mayor del que sale cada saldo.
 *
 *  ============================================================================
 *   NO HAY CUENTA SIN ROL ASIGNADO, y por eso falta una prueba
 *  ============================================================================
 *
 *  El registro publico esta apagado a proposito, asi que una cuenta nueva la crea gerencia desde
 *  el panel y no se puede fabricar desde aca. La prueba del default seguro —"alguien recien dado
 *  de alta no ve nada"— hoy NO se corre. Lo que si se cubre es lo que se puede: que nadie se
 *  cambie el rol ni se active solo.
 */

let gerencia: SupabaseClient;
let contable: SupabaseClient;
let gestora: SupabaseClient;
let anonimo: SupabaseClient;

beforeAll(async () => {
  gerencia = await comoUsuario(env["PRUEBA_GERENCIA"] ?? "");
  contable = await comoUsuario(env["PRUEBA_CONTABLE"] ?? "");
  gestora = await comoUsuario(env["PRUEBA_GESTORA"] ?? "");
  anonimo = sinSesion();
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

  it("una gestora se ve SOLO a si misma", async () => {
    // Fuera de la oficina, nadie ve la lista de quien mas entra al sistema ni con que rol.
    const { data, error } = await gestora.from("perfiles").select("email");
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data?.[0]?.email).toBe(env["PRUEBA_GESTORA"]);
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
 *
 * Esta funcion es esa forma de afirmar, escrita una sola vez: intenta que alguien se cambie el
 * rol a SI MISMO y comprueba, releyendo la fila, que no lo logro.
 */
async function noSeCambiaElRol(
  quien: string,
  cliente: SupabaseClient,
  esperado: string,
): Promise<void> {
  const { data: sesion } = await cliente.auth.getUser();
  const miId = sesion.user?.id ?? "";
  expect(miId, `sin sesion para ${quien}`).not.toBe("");

  await cliente.from("perfiles").update({ rol: "gestora" }).eq("id", miId);

  const { data } = await cliente.from("perfiles").select("rol").eq("id", miId).single();
  expect(data?.rol, `${quien} se cambio el rol a si mismo`).toBe(esperado);
}

describe("nadie se auto-promueve", () => {
  it("contable YA NO se auto-promueve, pero ahora tampoco gerencia", async () => {
    /*
      LA REGLA CAMBIO Y ES MAS FUERTE. Antes decia "solo gerencia cambia roles", asi que
      gerencia SI podia cambiarse el suyo. Ahora nadie puede cambiar el rol de su PROPIA fila,
      ni gerencia — que es lo que hace que este invariante siga siendo verdad ahora que contable
      administra igual que gerencia.
    */
    // Los dos en paralelo: son sesiones distintas contra filas distintas, no se pisan.
    await Promise.all([
      noSeCambiaElRol("contable", contable, "contable"),
      noSeCambiaElRol("gerencia", gerencia, "gerencia"),
    ]);
  });

  it("pero contable SI puede administrar a otro, igual que gerencia", async () => {
    // Es la otra mitad del cambio: identicos quiere decir que contable tambien administra.
    const correo = env["PRUEBA_GESTORA"] ?? "";
    const { data: antes } = await contable
      .from("perfiles").select("activo").eq("email", correo).single();
    const original = antes?.activo;
    expect(original).toBeDefined();

    const { error } = await contable
      .from("perfiles").update({ activo: !original }).eq("email", correo);
    expect(error).toBeNull();

    const { data: medio } = await contable
      .from("perfiles").select("activo").eq("email", correo).single();
    expect(medio?.activo).toBe(!original);

    // Se restaura el valor REAL, no uno escrito a mano: asi fue como este arnes dejo una vez
    // desactivada a una gestora que trabajaba.
    await contable.from("perfiles").update({ activo: original }).eq("email", correo);
    const { data: final } = await contable
      .from("perfiles").select("activo").eq("email", correo).single();
    expect(final?.activo).toBe(original);
  });

  it("una gestora no puede desactivarse ni activarse sola", async () => {
    /*
      ESTE TEST SE ESCRIBIA AL REVES Y ROMPIA LA BASE. La version anterior daba por hecho que
      la cuenta estaba inactiva y afirmaba `activo === false`; cuando esa cuenta paso a ser una
      gestora que trabaja, el test la DEJO DESACTIVADA y la app dejo de andar para ella.

      Un test que rompe el sistema que prueba es peor que no tenerlo, porque el daño aparece
      despues y en otro lado. Ahora se lee el valor real, se intenta darlo vuelta, y se afirma
      que NO cambio — sea cual sea. Y si llegara a cambiar, se restaura antes de fallar: la
      prueba avisa del agujero sin dejar la base peor de como la encontro.
    */
    const { data: sesion } = await gestora.auth.getUser();
    const miId = sesion.user?.id ?? "";
    expect(miId).not.toBe("");

    const { data: antes } = await gestora.from("perfiles").select("activo").eq("id", miId).single();
    const original = antes?.activo;
    expect(original).toBeDefined();

    await gestora.from("perfiles").update({ activo: !original }).eq("id", miId);

    const { data: despues } = await gestora.from("perfiles").select("activo").eq("id", miId).single();
    if (despues?.activo !== original) {
      await gerencia.from("perfiles").update({ activo: original }).eq("id", miId);
    }
    expect(despues?.activo).toBe(original);
  });

  it("una gestora tampoco se cambia el rol", async () => {
    const { data: sesion } = await gestora.auth.getUser();
    const miId = sesion.user?.id ?? "";

    await gestora.from("perfiles").update({ rol: "gerencia" }).eq("id", miId);

    const { data } = await gestora.from("perfiles").select("rol").eq("id", miId).single();
    expect(data?.rol).toBe("gestora");
  });

  it("pero si puede cambiarse el nombre, que es la razon de que exista esa policy", async () => {
    const { data: sesion } = await gestora.auth.getUser();
    const miId = sesion.user?.id ?? "";
    const { data: antes } = await gestora.from("perfiles").select("nombre").eq("id", miId).single();
    const original = antes?.nombre ?? "";

    const { error } = await gestora.from("perfiles").update({ nombre: "Prueba" }).eq("id", miId);
    expect(error).toBeNull();

    const { data: despues } = await gestora.from("perfiles").select("nombre").eq("id", miId).single();
    expect(despues?.nombre).toBe("Prueba");

    await gestora.from("perfiles").update({ nombre: original }).eq("id", miId);
  });
});

describe("gerencia si puede administrar", () => {
  it("gerencia cambia el estado de otro y lo deja EXACTAMENTE como estaba", async () => {
    /*
      "Lo deja como estaba" tiene que significar como estaba DE VERDAD, no un valor escrito a
      mano. La version anterior terminaba poniendo `activo: false` fijo, y asi fue como este
      arnes dejo desactivada a una gestora que trabajaba. Se lee el original y se restaura ese.
    */
    const correo = env["PRUEBA_GESTORA"] ?? "";
    const { data: antes } = await gerencia
      .from("perfiles").select("activo").eq("email", correo).single();
    const original = antes?.activo;
    expect(original).toBeDefined();

    const { error: e1 } = await gerencia
      .from("perfiles").update({ activo: !original }).eq("email", correo);
    expect(e1).toBeNull();

    const { data: medio } = await gerencia
      .from("perfiles").select("activo").eq("email", correo).single();
    expect(medio?.activo).toBe(!original);

    const { error: e2 } = await gerencia
      .from("perfiles").update({ activo: original }).eq("email", correo);
    expect(e2).toBeNull();

    const { data: final } = await gerencia
      .from("perfiles").select("activo").eq("email", correo).single();
    expect(final?.activo).toBe(original);
  });
});

describe("nada se borra", () => {
  it("ni siquiera gerencia puede borrar un perfil", async () => {
    // No hay policy de DELETE para nadie. Sin filas afectadas no hay error, asi que lo que se
    // comprueba es que la fila SIGA AHI: es la unica evidencia real de que no se borro.
    const correo = env["PRUEBA_GESTORA"] ?? "";
    await gerencia.from("perfiles").delete().eq("email", correo);
    const { data } = await gerencia.from("perfiles").select("email").eq("email", correo);
    expect(data).toHaveLength(1);
  });
});

/**
 * ============================================================================
 *  EL MARGEN. Es el invariante mas importante de todo el sistema.
 * ============================================================================
 *
 *  `cobros` guarda lo que se le cobro al cliente. La diferencia contra lo que costo el tramite
 *  es el margen de la empresa, y una gestora NO puede verlo. No es desconfianza: es que ese
 *  numero no es parte de su trabajo y saberlo cambia la relacion.
 *
 *  POR QUE ESTA EN OTRA TABLA Y NO EN OTRA COLUMNA DE `tramites`, que es lo que parece obvio:
 *  en Supabase TODOS los que entraron son el mismo rol de Postgres (`authenticated`), asi que
 *  un permiso por columna no distingue una gestora de gerencia. La unica separacion que existe
 *  de verdad es por FILA, y para eso el dato tiene que vivir en su propia tabla.
 *
 *  ============================================================================
 *   "POR NINGUN CAMINO" SE PRUEBA CAMINO POR CAMINO
 *  ============================================================================
 *
 *  Son cuatro, y el tercero es el que se olvida siempre.
 */
describe("una gestora no llega al margen por ningun camino", () => {
  let tramiteId = "";

  beforeAll(async () => {
    // ============================================================================
    //  EL DATO SE CREA. Un test que pasa porque no hay filas no prueba absolutamente nada.
    // ============================================================================
    //
    // Sin un cobro cargado, "la gestora ve cero cobros" es cierto para todo el mundo y el test
    // corre en verde sobre la nada. Es exactamente el falso verde que este proyecto tiene
    // documentado: comprobar una cosa PARECIDA y escribir "verificado".
    //
    // Es idempotente: `cobros.tramite_id` es la clave primaria, asi que correrlo mil veces deja
    // una sola fila. Y no se borra al final, porque en este sistema nada se borra: la base ni
    // siquiera tiene el permiso.
    const { data: tramites } = await gerencia.from("tramites").select("id").limit(1);
    tramiteId = tramites?.[0]?.id ?? "";
    if (tramiteId === "") throw new Error("Hace falta al menos un tramite para probar cobros");

    const { error } = await gerencia.from("cobros").upsert({
      tramite_id: tramiteId,
      monto_cobrado: 999999.99,
      observacion: "fila de prueba del arnes de permisos",
    });
    if (error) throw new Error(`No se pudo preparar el cobro de prueba: ${error.message}`);
  });

  it("PRIMERO: el dato existe de verdad y gerencia lo ve", async () => {
    // Sin esto, todo lo de abajo podria estar pasando por vacio.
    const { data, error } = await gerencia
      .from("cobros").select("monto_cobrado").eq("tramite_id", tramiteId);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(aCentavos(data?.[0]?.monto_cobrado as string | number)).toBe(99999999);
  });

  it("camino 1, leer la tabla: la gestora ve CERO cobros", async () => {
    // Cero filas y no un error: la RLS filtra por ausencia, no por rechazo.
    const { data, error } = await gestora.from("cobros").select("*");
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("camino 2, pedir uno puntual: tampoco por id", async () => {
    const { data, error } = await gestora.from("cobros").select("*").eq("tramite_id", tramiteId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("camino 3, COLGARLO DEL TRAMITE: es el que se olvida", async () => {
    /*
      PostgREST deja traer una tabla relacionada adentro de otra consulta, con `cobros(*)`
      montado sobre `tramites`. Si la policy de `cobros` estuviera floja, el margen saldria
      colgado de un tramite que la gestora SI puede ver, sin tocar nunca la tabla de frente.

      Es la fuga que no se ve mirando las policies de a una, y por eso se prueba armando la
      consulta exacta que la haria.
    */
    const { data, error } = await gestora.from("tramites").select("id, cobros(monto_cobrado)");

    // Puede volver error —la relacion no se deja incrustar— o filas con el cobro vacio. Las dos
    // respuestas son correctas. Lo que NO puede pasar es que venga el monto.
    expect(JSON.stringify(data ?? [])).not.toContain("999999");

    if (error === null) {
      for (const fila of (data ?? []) as { cobros?: unknown }[]) {
        const c = fila.cobros;
        expect(Array.isArray(c) ? c : c === null || c === undefined ? [] : [c]).toEqual([]);
      }
    }
  });

  it("el camino 3 EXISTE: la misma consulta, como gerencia, si trae el monto", async () => {
    /*
      ============================================================================
       ESTE TEST ES EL QUE HACE QUE EL ANTERIOR VALGA ALGO.
      ============================================================================

      Un test que afirma "no vino el margen" pasa igual si la consulta estaba mal escrita, si la
      relacion no existe, o si PostgREST la rechazo por cualquier otro motivo. Verde por la
      razon equivocada, que es la forma de falso positivo que este proyecto ya sufrio una vez y
      dejo documentada.

      Corriendo EXACTAMENTE la misma consulta con gerencia se prueba que el camino existe y
      funciona. Entonces la unica diferencia entre las dos respuestas es quien pregunta — o sea,
      la RLS. Que es justo lo que habia que demostrar.

      Es ademas la unica forma honesta de comprobarlo sin aflojar la policy de verdad en una
      base que tiene datos.
    */
    const { data, error } = await gerencia.from("tramites").select("id, cobros(monto_cobrado)");
    expect(error).toBeNull();
    expect(JSON.stringify(data ?? [])).toContain("999999");
  });

  it("camino 4, escribir: la gestora no puede cargar ni cambiar un cobro", async () => {
    // Si pudiera escribir, podria escribir un monto conocido y sacar el margen por diferencia.
    await gestora.from("cobros").update({ monto_cobrado: 1 }).eq("tramite_id", tramiteId);

    const { data } = await gerencia
      .from("cobros").select("monto_cobrado").eq("tramite_id", tramiteId).single();
    expect(aCentavos(data?.monto_cobrado as string | number)).toBe(99999999);
  });

  it("y contable SI lo ve, porque si no el margen no lo controla nadie", async () => {
    const { data, error } = await contable
      .from("cobros").select("monto_cobrado").eq("tramite_id", tramiteId);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("sin loguearse tampoco, obviamente", async () => {
    const { data, error } = await anonimo.from("cobros").select("*");
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});

/**
 * ============================================================================
 *  EL LIBRO MAYOR. Solo se inserta, y no todo el mundo.
 * ============================================================================
 *
 *  El saldo no es un campo: es la suma de esta tabla. Si una fila se puede editar o borrar, el
 *  saldo de ayer deja de poder reconstruirse, y ahi el sistema pierde lo unico que lo hace
 *  confiable frente al sitio de la Tarjeta.
 */
describe("el libro mayor solo se inserta", () => {
  // El importe se guarda en CENTAVOS ENTEROS, como en toda la app: comparar decimales que
  // vienen de la base contra decimales que vuelven de la base es como se cuelan las diferencias
  // de un centavo que despues nadie puede explicar.
  let movimiento: { id: number; centavos: number; tarjeta: string } | null = null;

  beforeAll(async () => {
    const { data } = await gerencia.from("movimientos").select("id, importe, tarjeta_id").limit(1);
    const m = data?.[0];
    if (m) {
      movimiento = {
        id: Number(m.id),
        centavos: aCentavos(m.importe as string | number),
        tarjeta: String(m.tarjeta_id),
      };
    }
  });

  it("hay un movimiento con el que probar", () => {
    // Igual que con los cobros: sin dato, todo lo de abajo pasaria por vacio.
    expect(movimiento).not.toBeNull();
  });

  it("NI GERENCIA puede cambiar un importe ya escrito", async () => {
    const m = movimiento;
    if (!m) throw new Error("sin movimiento con el que probar");

    await gerencia.from("movimientos").update({ importe: 1 }).eq("id", m.id);

    const { data } = await gerencia.from("movimientos").select("importe").eq("id", m.id).single();
    expect(aCentavos(data?.importe as string | number)).toBe(m.centavos);
  });

  it("NI GERENCIA puede borrar un movimiento", async () => {
    const m = movimiento;
    if (!m) throw new Error("sin movimiento con el que probar");

    await gerencia.from("movimientos").delete().eq("id", m.id);

    const { data } = await gerencia.from("movimientos").select("id").eq("id", m.id);
    expect(data).toHaveLength(1);
  });

  it("una gestora no puede cargar plata", async () => {
    const m = movimiento;
    if (!m) throw new Error("sin movimiento con el que probar");

    const { error } = await gestora.from("movimientos").insert({
      tarjeta_id: m.tarjeta, tipo: "ingreso", importe: 1000, concepto: "no deberia entrar",
    });
    expect(error).not.toBeNull();
  });

  it("y gerencia tampoco escribe a mano un tipo que le toca al trigger", async () => {
    /*
      `reserva`, `pago` y las reversas las escribe el trigger, que es SECURITY DEFINER. Que
      gerencia pudiera escribirlas a mano seria poder comprometer o pagar plata sin que exista
      el tramite que lo justifica: el saldo dejaria de ser explicable por los tramites, que es
      justamente lo que lo hace auditable.
    */
    const m = movimiento;
    if (!m) throw new Error("sin movimiento con el que probar");

    const { error } = await gerencia.from("movimientos").insert({
      tarjeta_id: m.tarjeta, tipo: "pago", importe: -1000, concepto: "a mano, no deberia entrar",
    });
    expect(error).not.toBeNull();
  });
});

/**
 * ============================================================================
 *  LA GESTORA VE SU TRAMITE DESDE QUE SE LO ASIGNAN
 * ============================================================================
 *
 *  EL DEFECTO, encontrado en la primera prueba real con los tres usuarios: `gestora_id` recien
 *  se completaba al pasar a `entregado`, y la policy de lectura exige `gestora_id =
 *  mi_gestora_id()`. Entonces un tramite que cargaba contable era INVISIBLE para gestoria hasta
 *  dos pasos despues — y en esos dos pasos no habia forma de que la gestora supiera que existia.
 *
 *  Es el defecto que impedia simular la cadena completa, y por eso su prueba va contra la API
 *  real: lo que hay que garantizar no es que la policy sea correcta en abstracto, es que la
 *  gestora ABRA la app y lo vea.
 */
describe("una gestora ve el tramite desde que se lo asignan", () => {
  let creado = "";
  let otraGestora: SupabaseClient;

  beforeAll(async () => {
    otraGestora = await comoUsuario(env["PRUEBA_GESTORA_2"] ?? "");

    const { data: sesion } = await gestora.auth.getUser();
    const { data: perfil } = await gestora
      .from("perfiles").select("gestora_id").eq("id", sesion.user?.id ?? "").single();
    const gestoraId = perfil?.gestora_id;
    if (!gestoraId) throw new Error("La cuenta de prueba no esta vinculada a ninguna gestora");

    const { data: razon } = await gerencia.from("razones_sociales").select("id").limit(1).single();
    const { data: suc } = await gerencia.from("sucursales").select("id").limit(1).single();

    /*
      SE REUSA EL DE LA CORRIDA ANTERIOR, y no es una optimizacion: la primera version creaba uno
      nuevo cada vez y despues de tres corridas habia tres tramites de prueba en la base — que
      ademas confundieron un diagnostico, porque un `update` por nombre los movio a los tres.

      Un arnes que ensucia la base que prueba se vuelve, el mes que viene, una tabla llena de
      basura que nadie se anima a limpiar porque no sabe cual es de prueba. Y aca nada se borra.
    */
    // `.limit(1)` y el primero del arreglo, NO `maybeSingle()`: con varias filas ya cargadas
    // maybeSingle devuelve null en vez de la primera, y entonces el arnes crea otra mas — que
    // es exactamente como se llegaron a acumular las que habia.
    const { data: existentes } = await gerencia
      .from("tramites").select("id").eq("cliente_nombre", NOMBRE_DE_PRUEBA)
      .order("recibido_at").limit(1);

    if (existentes && existentes.length > 0) {
      creado = String(existentes[0]?.id);
      // Se lo devuelve al estado inicial para que la prueba corra siempre igual.
      await gerencia.from("tramites").update({ gestora_id: gestoraId }).eq("id", creado);
      return;
    }

    const { data, error } = await gerencia
      .from("tramites")
      .insert({
        razon_social_id: razon?.id,
        sucursal_id: suc?.id,
        tipo: "patentamiento_0km",
        cliente_nombre: NOMBRE_DE_PRUEBA,
        medio_pago: "tarjeta_habitualista",
        gestora_id: gestoraId,
      })
      .select("id")
      .single();
    if (error) throw new Error(`No se pudo crear el tramite de prueba: ${error.message}`);
    creado = String(data?.id);
  });

  it("gerencia lo creo y lo ve", async () => {
    // Sin esto, todo lo de abajo podria estar pasando por vacio.
    const { data } = await gerencia.from("tramites").select("id").eq("id", creado);
    expect(data).toHaveLength(1);
  });

  it("y la gestora asignada lo ve ENSEGUIDA, todavia en recibido", async () => {
    // Es el defecto que impedia simular la cadena: antes lo veia recien dos pasos despues.
    const { data, error } = await gestora
      .from("tramites").select("id, estado").eq("id", creado);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    // Lo que importa es que lo VEA, en el estado que sea. Antes no lo veia hasta `entregado`,
    // y exigir un estado puntual ataria la prueba a que el tramite sea nuevo — que es
    // justamente lo que se dejo de hacer para no ensuciar la base.
    expect(data?.[0]?.estado).toBeDefined();
  });

  it("pero la gestora de la OTRA ficha sigue sin verlo", async () => {
    // Lo que este cambio no tenia que romper.
    const { data } = await otraGestora.from("tramites").select("id").eq("id", creado);
    expect(data).toEqual([]);
  });

  it("y puede cargarle conceptos al presupuesto", async () => {
    // El pedido dice que el presupuesto y sus conceptos los completa la gestora. La policy de
    // conceptos ya lo permitia para quien VEA el tramite: no verlo era lo unico que se lo
    // impedia. O sea que este arreglo destraba dos cosas, no una.
    const { data: concepto } = await gerencia.from("conceptos").select("id").limit(1).single();

    /*
      `ponerLinea` y no `upsert`. Hay un indice unico de un concepto por momento y por tramite
      —un poka-yoke, para que el mismo arancel no entre dos veces— y como el tramite de prueba se
      reusa, un insert pelado chocaria en la segunda corrida.

      Y `upsert` TAMPOCO sirve desde el 21/08/2026: ese indice paso a ser PARCIAL, para que
      quitar una linea no impida volver a cargar ese concepto, y PostgREST no puede inferir un
      indice parcial (42P10). El helper hace select y despues update o insert.

      Lo que se prueba es que la gestora PUEDA escribir, no que la fila sea nueva.
    */
    const falla = await ponerLinea(gestora, creado, String(concepto?.id), 1234.56);
    expect(falla).toBeNull();
  });

  it("una gestora dada de baja no puede recibir trabajo nuevo", async () => {
    /*
      Sin esto, un tramite podria quedar asignado a alguien que ya no entra al sistema:
      invisible para gestoria, invisible para quien lo asigno, y sin que nadie se entere hasta
      que alguien pregunte por que ese tramite no avanza.
    */
    const { data: baja } = await gerencia
      .from("gestoras").select("id, activa").eq("activa", false).limit(1).maybeSingle();

    // Si no hay ninguna dada de baja, se da de baja una a proposito y se restaura al final.
    let id = baja?.id as string | undefined;
    let habiaQueDarDeBaja = false;
    if (id === undefined) {
      const { data: alguna } = await gerencia
        .from("gestoras").select("id").eq("activa", true).limit(1).single();
      id = String(alguna?.id);
      await gerencia.from("gestoras").update({ activa: false }).eq("id", id);
      habiaQueDarDeBaja = true;
    }

    const { error } = await gerencia.from("tramites").update({ gestora_id: id }).eq("id", creado);

    /*
      ============================================================================
       SE RESTAURA ANTES DE AFIRMAR, Y NO DESPUES
      ============================================================================

      La primera version tenia el `expect` arriba y la restauracion abajo. Cuando el aserto
      fallo —que es exactamente lo que pasa mientras el arreglo todavia no esta— la excepcion
      se llevo puesta la restauracion y **la gestora quedo dada de baja en la base**. La corrida
      siguiente no pudo ni crear el tramite de prueba: cinco tests salteados por un test.

      Es la misma forma de defecto que ya dejo una vez desactivada a una gestora que trabajaba.
      Un test que rompe el sistema que prueba es peor que no tenerlo, porque el daño aparece
      despues y en otro lado.
    */
    if (habiaQueDarDeBaja) {
      await gerencia.from("gestoras").update({ activa: true }).eq("id", id);
    }

    expect(error, "se pudo asignar un tramite a una gestora dada de baja").not.toBeNull();
  });
});
