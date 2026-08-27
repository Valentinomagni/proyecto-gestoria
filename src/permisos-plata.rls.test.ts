import { type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import { aCentavos } from "./lib/plata";
import {
  comoUsuario,
  env,
  ponerLinea,
  sinSesion,
  NOMBRE_DE_PRUEBA,
} from "./pruebas/arnes-de-permisos";

/**
 * ============================================================================
 *  LA PLATA DEL PRESUPUESTO, Y LA DE LA CUENTA
 * ============================================================================
 *
 *  ESTAS PRUEBAS SOLO SE PUEDEN CORRER ASI, contra la API real y con usuarios reales, y vale la
 *  pena escribir por qué: los guardianes nuevos preguntan por `auth.uid()`, y en la consola SQL
 *  del panel `auth.uid()` es null a propósito —es donde corren las migraciones—, así que ahí
 *  dejan pasar todo.
 *
 *  Una comprobación hecha desde la consola SQL habría salido en verde sin probar nada. Es la
 *  misma forma de error que este proyecto tiene documentada cuatro veces: comprobar la cosa
 *  parecida y escribir "verificado".
 *
 *  ============================================================================
 *   LO QUE SE CUBRE
 *  ============================================================================
 *
 *   - Que el total del presupuesto no se pueda escribir a mano, ni siendo gerencia.
 *   - Que cargar y quitar una línea SI lo mueva, con el importe exacto.
 *   - Que quitar una línea sin motivo escrito no se pueda.
 *   - Que un movimiento del libro mayor se anule sólo desde la oficina, sólo con motivo, sólo
 *     una vez, y sólo si lo cargó una persona.
 *   - Que el historial de cambios no se pueda editar ni borrar.
 */

let gerencia: SupabaseClient;
let gestora: SupabaseClient;
let anonimo: SupabaseClient;

beforeAll(async () => {
  gerencia = await comoUsuario(env["PRUEBA_GERENCIA"] ?? "");
  gestora = await comoUsuario(env["PRUEBA_GESTORA"] ?? "");
  anonimo = sinSesion();
});

describe("el total del presupuesto es la suma, y no se escribe a mano", () => {
  let elTramite = "";
  let sellados = "";

  beforeAll(async () => {
    const { data } = await gerencia
      .from("tramites")
      .select("id")
      .eq("cliente_nombre", NOMBRE_DE_PRUEBA)
      .order("recibido_at")
      .limit(1);
    elTramite = String(data?.[0]?.id ?? "");

    const { data: c } = await gerencia
      .from("conceptos")
      .select("id")
      .eq("nombre", "Sellados")
      .single();
    sellados = String(c?.id ?? "");
  });

  it("hay un tramite y un concepto con los que probar", () => {
    // Sin dato, todo lo de abajo pasaria por vacio y el arnes diria que anda.
    expect(elTramite).not.toBe("");
    expect(sellados).not.toBe("");
  });

  it("una gestora NO puede escribir el total a mano", async () => {
    /*
      ES EL POKA-YOKE CENTRAL DE ESTA TANDA. De `deposito_solicitado` cuelga la reserva de la
      Tarjeta Habitualista, así que un valor escrito directo sería plata comprometida sin ninguna
      línea que la explique — y el comprometido es la cifra con la que se decide si se manda a
      presentar. O sea: exactamente "se pisan los saldos", que es el problema que el proyecto
      viene a resolver.

      La columna SIGUE en la lista de permitidos de `b_tramites_bloquear_campos`, y tiene que
      seguir: el recálculo pasa por ahí con el `auth.uid()` de la gestora. Quien decide es
      `b_tramites_total_derivado`, que mira una marca de transacción que sólo deja el recálculo.
    */
    const { error } = await gestora
      .from("tramites")
      .update({ deposito_solicitado: 99999999 })
      .eq("id", elTramite);
    expect(error).not.toBeNull();
    expect(error?.message ?? "").toContain("suma de sus conceptos");
  });

  it("ni gerencia, que es quien mas permisos tiene", async () => {
    const { error } = await gerencia
      .from("tramites")
      .update({ deposito_solicitado: 99999999 })
      .eq("id", elTramite);
    expect(error).not.toBeNull();
  });

  it("pero cargar una linea SI lo mueve, y por el importe exacto", async () => {
    /*
      ESTA PRUEBA AGARRO UN DEFECTO REAL el 21/08/2026, y por eso está escrita así. Al renombrar
      la tabla del historial, el trigger que registra cada línea quedó apuntando al nombre viejo
      —Postgres no reescribe el cuerpo de una función plpgsql al renombrar una tabla— y NINGUNA
      línea de presupuesto se podía guardar. El `db push` había dicho "Finished".
    */
    const { data: antes } = await gerencia
      .from("tramites")
      .select("deposito_solicitado")
      .eq("id", elTramite)
      .single();

    // `ponerLinea` y no `upsert`: el índice único es parcial y PostgREST no lo puede inferir.
    // Está explicado en el helper, con el código de error.
    const falla = await ponerLinea(gestora, elTramite, sellados, 777);
    expect(falla, "la gestora no pudo cargar el concepto").toBeNull();

    const { data: despues } = await gerencia
      .from("tramites")
      .select("deposito_solicitado")
      .eq("id", elTramite)
      .single();

    const subio =
      aCentavos(despues?.deposito_solicitado as string | number) -
      aCentavos((antes?.deposito_solicitado ?? 0) as string | number);
    expect(subio).toBe(77700);
  });

  /**
   * La línea VIVA, buscada por id.
   *
   * Apuntar por trámite + concepto + momento no alcanza: de corridas anteriores pueden quedar
   * varias líneas anuladas del mismo concepto, y un update por esos tres campos las tocaría a
   * todas. La de "sin motivo" pasaría en verde por el motivo equivocado — porque las viejas ya
   * traen su motivo escrito y el check no se quejaría.
   */
  async function lineaViva(): Promise<number> {
    const { data } = await gerencia
      .from("tramite_conceptos")
      .select("id")
      .eq("tramite_id", elTramite)
      .eq("concepto_id", sellados)
      .eq("momento", "presupuesto")
      .eq("anulada", false)
      .limit(1);
    return Number(data?.[0]?.id ?? 0);
  }

  it("y quitar una linea SIN motivo no se puede", async () => {
    const id = await lineaViva();
    expect(id, "hace falta la linea viva de la prueba anterior").toBeGreaterThan(0);

    const { error } = await gestora
      .from("tramite_conceptos")
      .update({ anulada: true })
      .eq("id", id);
    expect(error).not.toBeNull();
  });

  it("con motivo si, y el total baja solo por ese importe", async () => {
    const id = await lineaViva();
    expect(id, "hace falta la linea viva de la prueba anterior").toBeGreaterThan(0);

    const { data: antes } = await gerencia
      .from("tramites")
      .select("deposito_solicitado")
      .eq("id", elTramite)
      .single();

    const { error } = await gestora
      .from("tramite_conceptos")
      .update({ anulada: true, motivo_anulacion: "linea del arnes de permisos" })
      .eq("id", id);
    expect(error).toBeNull();

    const { data: despues } = await gerencia
      .from("tramites")
      .select("deposito_solicitado")
      .eq("id", elTramite)
      .single();

    const bajo =
      aCentavos((antes?.deposito_solicitado ?? 0) as string | number) -
      aCentavos((despues?.deposito_solicitado ?? 0) as string | number);
    expect(bajo).toBe(77700);
  });
});

describe("un movimiento cargado mal se anula, y solo desde la oficina", () => {
  let unIngreso = 0;
  let unaReserva = 0;

  beforeAll(async () => {
    const { data: i } = await gerencia
      .from("movimientos")
      .select("id")
      .eq("tipo", "ingreso")
      .order("id", { ascending: false })
      .limit(1);
    unIngreso = Number(i?.[0]?.id ?? 0);

    const { data: r } = await gerencia
      .from("movimientos")
      .select("id")
      .eq("tipo", "reserva")
      .limit(1);
    unaReserva = Number(r?.[0]?.id ?? 0);
  });

  it("hay un ingreso y una reserva con los que probar", () => {
    expect(unIngreso).toBeGreaterThan(0);
    expect(unaReserva).toBeGreaterThan(0);
  });

  it("una gestora no puede anular nada", async () => {
    const { error } = await gestora.rpc("anular_movimiento", {
      p_id: unIngreso,
      p_motivo: "no deberia poder",
    });
    expect(error).not.toBeNull();
  });

  it("sin loguearse tampoco: la funcion no esta concedida a anon", async () => {
    const { error } = await anonimo.rpc("anular_movimiento", {
      p_id: unIngreso,
      p_motivo: "menos todavia",
    });
    expect(error).not.toBeNull();
  });

  it("gerencia tampoco puede anular sin escribir el motivo", async () => {
    const { error } = await gerencia.rpc("anular_movimiento", { p_id: unIngreso, p_motivo: "   " });
    expect(error).not.toBeNull();
    // CON LAS TILDES. El 27/08/2026 los mensajes se escribieron en castellano de verdad, y esta
    // prueba fue una de las dos que lo agarraron: fija el TEXTO, no sólo que haya error.
    expect(error?.message ?? "").toContain("Escribí por qué se anula");
  });

  it("y una RESERVA no se anula desde la cuenta, ni siendo gerencia", async () => {
    /*
      La reserva la escribió un trigger a partir del presupuesto de un trámite. Anularla desde
      acá dejaría la cuenta diciendo una cosa y el trámite otra: el trámite seguiría mostrando su
      presupuesto y la tarjeta ya no lo tendría comprometido. Se corrige corrigiendo el
      presupuesto, que es lo que la pantalla ahora permite.
    */
    const { error } = await gerencia.rpc("anular_movimiento", {
      p_id: unaReserva,
      p_motivo: "probando",
    });
    expect(error).not.toBeNull();
    expect(error?.message ?? "").toContain("lo generó un trámite");
  });

  it("gerencia SI anula un deposito cargado mal, y el saldo vuelve a donde estaba", async () => {
    /*
      EL PRECIO DE ESTA PRUEBA, ESCRITO PARA QUE SE VEA: deja dos filas de un peso en el libro
      mayor cada vez que corre, que se suman a cero. El libro es de sola inserción por diseño, no
      se limpian, y por eso van rotuladas con el nombre del arnés.

      Se paga igual porque es la única que comprueba la ARITMETICA de la anulación, que es lo que
      le importa a quien mira el saldo. Las de arriba comprueban quién puede; ésta, que la cuenta
      cierre.
    */
    const { data: tarjeta } = await gerencia
      .from("tarjetas_habitualista")
      .select("id")
      .limit(1)
      .single();

    const antes = await gerencia
      .from("v_saldos")
      .select("contable")
      .eq("tarjeta_id", tarjeta?.id ?? "")
      .single();

    const { data: nuevo, error: eIns } = await gerencia
      .from("movimientos")
      .insert({
        tarjeta_id: tarjeta?.id,
        tipo: "ingreso",
        importe: 1,
        concepto: "PRUEBA DEL ARNES DE PERMISOS",
      })
      .select("id")
      .single();
    expect(eIns, "gerencia tendria que poder cargar un ingreso").toBeNull();

    const { error } = await gerencia.rpc("anular_movimiento", {
      p_id: Number(nuevo?.id),
      p_motivo: "prueba automatica del arnes de permisos",
    });
    expect(error, "gerencia tendria que poder anular un ingreso").toBeNull();

    const despues = await gerencia
      .from("v_saldos")
      .select("contable")
      .eq("tarjeta_id", tarjeta?.id ?? "")
      .single();
    expect(aCentavos(despues.data?.contable as string | number)).toBe(
      aCentavos(antes.data?.contable as string | number),
    );

    // Y el original NO se borró: sigue estando, que es toda la diferencia con un delete.
    const { data: sigue } = await gerencia
      .from("movimientos")
      .select("id")
      .eq("id", Number(nuevo?.id));
    expect(sigue).toHaveLength(1);

    // Anularlo dos veces lo restaría dos veces: el saldo quedaría peor que antes de corregirlo.
    const { error: dos } = await gerencia.rpc("anular_movimiento", {
      p_id: Number(nuevo?.id),
      p_motivo: "otra vez",
    });
    expect(dos).not.toBeNull();
  });
});

describe("el historial de cambios es de solo lectura", () => {
  it("ni gerencia lo puede editar", async () => {
    const { data } = await gerencia.from("tramite_cambios").select("id, antes").limit(1);
    const fila = data?.[0];
    if (fila === undefined) throw new Error("hace falta una fila de historial para esta prueba");

    await gerencia.from("tramite_cambios").update({ antes: "pisado" }).eq("id", fila.id);

    const { data: sigue } = await gerencia
      .from("tramite_cambios")
      .select("antes")
      .eq("id", fila.id)
      .single();
    expect(sigue?.antes).toBe(fila.antes);
  });

  it("ni borrar", async () => {
    const { data } = await gerencia.from("tramite_cambios").select("id").limit(1);
    const id = data?.[0]?.id;
    if (id === undefined) throw new Error("hace falta una fila de historial para esta prueba");

    await gerencia.from("tramite_cambios").delete().eq("id", id);

    const { data: sigue } = await gerencia.from("tramite_cambios").select("id").eq("id", id);
    expect(sigue).toHaveLength(1);
  });

  it("y sin sesion devuelve CERO FILAS, no un error", async () => {
    // La ausencia y el rechazo son cosas distintas, y confundirlas manda a buscar un problema de
    // permisos donde sólo falta una sesión. Por eso la policy dice `to authenticated`.
    const { data, error } = await anonimo.from("tramite_cambios").select("*");
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});

/**
 * ============================================================================
 *  LA CADENA DE SEIS ESTADOS, Y POR QUE ESTA PRUEBA NO EXISTIA ANTES
 * ============================================================================
 *
 *  El 27/08/2026 la cadena bajó de diez estados a seis. Se aplicaron cuatro migraciones y las
 *  154 pruebas siguieron en verde — TODAS. Ninguna miraba la máquina de estados.
 *
 *  Y sin embargo el front había quedado roto: seguía mandando `presentado`, un estado que la base
 *  ya rechazaba. El botón se veía bien y fallaba al apretarlo. Nada lo agarró; lo agarró un
 *  `grep` a mano.
 *
 *  Una prueba que no existe no falla nunca, y eso se parece bastante a estar en verde.
 */
describe("la cadena de seis estados", () => {
  let elTramite = "";
  let estadoDeArranque = "";

  beforeAll(async () => {
    const { data } = await gerencia
      .from("tramites")
      .select("id, estado")
      .eq("cliente_nombre", NOMBRE_DE_PRUEBA)
      .order("recibido_at")
      .limit(1);
    elTramite = String(data?.[0]?.id ?? "");
    estadoDeArranque = String(data?.[0]?.estado ?? "");
  });

  it("hay un tramite con el que probar", () => {
    expect(elTramite).not.toBe("");
    // NO SE ESPERA UN ESTADO CONCRETO. La primera version de esta prueba daba por sentado que el
    // tramite de prueba estaba en `recibido` y estaba en `entregado`. Lo que hay que comprobar es
    // que NO SE MUEVA, no en cual esta parado.
    expect(estadoDeArranque).not.toBe("resuelto");
  });

  it("no se puede saltear hasta resuelto", async () => {
    /*
      El boton de la pantalla es uno solo, el del paso siguiente, asi que este salto no se puede
      hacer desde la app. Pero SI desde la consola del navegador, y por eso lo impide la base:
      resolver sin haber presupuestado escribiria un pago sin presupuesto contra el que
      compararlo, y liberaria una reserva que no existe.
    */
    const { error } = await gerencia
      .from("tramites")
      .update({ estado: "resuelto" })
      .eq("id", elTramite);
    expect(error).not.toBeNull();
  });

  it("y los estados viejos ya no existen", async () => {
    /*
      El check se apreto a siete valores. Un estado de la cadena anterior tiene que ser RECHAZADO
      por la base, no ignorado en silencio: si se ignorara, el tramite se quedaria donde estaba y
      la pantalla diria que guardo.
    */
    const VIEJOS = ["presentado", "pagado", "retirado", "frenado_por_saldo"];

    // Van en paralelo y no en fila: los cuatro los rechaza el mismo `check`, ninguno llega a
    // tocar la fila, y entonces el orden entre ellos no cambia nada.
    const rechazos = await Promise.all(
      VIEJOS.map(async (viejo) => {
        const { error } = await gerencia
          .from("tramites")
          .update({ estado: viejo })
          .eq("id", elTramite);
        return { viejo, error };
      }),
    );

    for (const { viejo, error } of rechazos) {
      expect(error, `el estado viejo ${viejo} deberia ser rechazado`).not.toBeNull();
    }
  });

  it("el tramite no se movio de donde estaba", async () => {
    // Las dos pruebas de arriba tienen que haber sido rechazadas SIN efecto. Un rechazo que igual
    // deja la fila a medio cambiar es peor que no tener la regla.
    const { data } = await gerencia.from("tramites").select("estado").eq("id", elTramite).single();
    expect(data?.estado).toBe(estadoDeArranque);
  });
});

/**
 * ============================================================================
 *  LA LISTA DE QUIEN ESPERA PLATA SE PUEDE LEER, Y NO SE PUEDE ESCRIBIR
 * ============================================================================
 *
 *  `v_esperando_plata` reemplaza al estado `frenado_por_saldo`. Estas pruebas existen porque el
 *  front la consulta con la MISMA forma que se prueba acá: si la vista cambiara de columnas, la
 *  Bandeja mostraría un bloque vacío sin ningún error, y nadie se enteraría hasta que alguien
 *  pregunte por qué no aparece un trámite que está esperando.
 *
 *  Hoy la vista devuelve cero filas, y eso es CORRECTO: ninguna tarjeta tiene un presupuestado
 *  sin cubrir. Por eso las pruebas miran que la consulta ANDE y que los permisos estén bien, no
 *  que traiga algo — una prueba que exija filas se rompería sola el día que la oficina pague todo.
 */
describe("la lista de quien espera plata", () => {
  const COLUMNAS = "tramite_id, cliente_nombre, oferta_referencia, tarjeta_id, pide, falta";

  it("una gestora la puede leer, con las columnas que usa la pantalla", async () => {
    const { error } = await gestora.from("v_esperando_plata").select(COLUMNAS);
    expect(error, `la vista no responde: ${error?.message ?? ""}`).toBeNull();
  });

  it("y la oficina tambien", async () => {
    const { error } = await gerencia.from("v_esperando_plata").select(COLUMNAS);
    expect(error).toBeNull();
  });

  it("sin sesion devuelve CERO FILAS, no un error", async () => {
    // La ausencia y el rechazo son cosas distintas, y confundirlas manda a buscar un problema de
    // permisos donde sólo falta una sesión.
    const { data, error } = await anonimo.from("v_esperando_plata").select(COLUMNAS);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("y NO se puede escribir: es una vista, no una tabla", async () => {
    const { error } = await gerencia
      .from("v_esperando_plata")
      .delete()
      .eq("tramite_id", "00000000-0000-0000-0000-000000000000");
    expect(error).not.toBeNull();
  });
});

/**
 * ============================================================================
 *  LA GESTORA VE EL SALDO DE LA TARJETA CON LA QUE VA A PAGAR
 * ============================================================================
 *
 *  ESTA PRUEBA EXISTE POR UN DEFECTO QUE ESTUVO VIVO Y NO LO AGARRÓ NADA. El 27/08/2026 toda
 *  gestora veía las cinco tarjetas en `$ 0,00` — no "sin datos", CERO, que es un número y se lee
 *  como un hecho. Paris Autos tenía 8.463.765,44 disponibles.
 *
 *  La causa: `v_saldos` es `security_invoker`, suma `movimientos`, y la policy de `movimientos`
 *  exigía una fila en `tarjetas_debito`, que está vacía. Entonces `contable` y `comprometido`
 *  daban 0 por `coalesce`, y `v_esperando_plata` comparaba `0 < 0`: nunca traía nada.
 *
 *  ============================================================================
 *   POR QUE LA PRUEBA VIEJA NO LO AGARRÓ, QUE ES LA PARTE QUE ENSEÑA
 *  ============================================================================
 *
 *  Había una prueba de que la gestora podía LEER la vista, y pasaba: `error === null`. Leer sin
 *  error y leer algo son cosas distintas, y una vista vacía no da error.
 *
 *  Por eso esta mira NÚMEROS, no ausencia de error.
 */
describe("la gestora ve el saldo de la tarjeta donde tiene tramites", () => {
  let laTarjeta = "";

  beforeAll(async () => {
    // La tarjeta de un tramite vivo suyo. Si no hubiera ninguno, la prueba de abajo lo dice.
    const { data } = await gestora
      .from("tramites")
      .select("tarjeta_id")
      .not("tarjeta_id", "is", null)
      .not("estado", "in", "(devuelto,anulado)")
      .limit(1);
    laTarjeta = String(data?.[0]?.tarjeta_id ?? "");
  });

  it("hay una tarjeta con la que probar", () => {
    expect(laTarjeta, "la gestora de prueba necesita un tramite vivo con tarjeta").not.toBe("");
  });

  it("y VE SUS MOVIMIENTOS, no cero", async () => {
    const { data, error } = await gestora
      .from("v_saldos")
      .select("nombre, contable, comprometido, movimientos_visibles")
      .eq("tarjeta_id", laTarjeta)
      .single();

    expect(error).toBeNull();
    expect(
      Number(data?.movimientos_visibles ?? 0),
      "la gestora ve la tarjeta de su tramite con CERO movimientos: es el defecto del 27/08/2026",
    ).toBeGreaterThan(0);
  });

  it("una tarjeta donde no tiene nada dice `sin datos`, y no un importe", async () => {
    /*
      La diferencia entre las dos filas es lo que importa: la vista no puede distinguir sola una
      tarjeta vacía de una que no se ve, y por eso devuelve `movimientos_visibles`. Si esta
      prueba dejara de encontrar una tarjeta sin movimientos visibles, querría decir que la
      gestora las ve todas — que es lo contrario del permiso mínimo.
    */
    const { data } = await gestora.from("v_saldos").select("nombre, movimientos_visibles");
    const sinDatos = (data ?? []).filter((s) => Number(s.movimientos_visibles) === 0);
    expect(sinDatos.length, "la gestora ve TODAS las tarjetas, y no deberia").toBeGreaterThan(0);
  });

  it("la oficina las ve todas", async () => {
    const { data } = await gerencia.from("v_saldos").select("nombre, movimientos_visibles");
    const conDatos = (data ?? []).filter((s) => Number(s.movimientos_visibles) > 0);
    expect(conDatos.length).toBeGreaterThan(0);
  });
});

/**
 * Los sellos no los escribe una gestora.
 *
 * `pagado_at` estaba en la lista de campos que podía tocar, y no molestaba a nadie hasta que la
 * conciliación se apoyó en ese sello para no liberar dos veces la reserva. Escribirlo a mano
 * apagaba para siempre los movimientos de plata de ese trámite, sin un error en pantalla.
 */
describe("los sellos de la cadena no los escribe una gestora", () => {
  it("no puede escribir pagado_at", async () => {
    const { data } = await gestora.from("tramites").select("id").limit(1);
    const id = String(data?.[0]?.id ?? "");
    expect(id).not.toBe("");

    const { error } = await gestora
      .from("tramites")
      .update({ pagado_at: new Date().toISOString() })
      .eq("id", id);
    expect(error, "una gestora pudo escribir pagado_at").not.toBeNull();
  });
});
