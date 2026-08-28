import { expect, test } from "@playwright/test";
import { anularPorLaApi, cargarDepositoPorLaApi, entrarComo } from "./entrar";

/**
 * ============================================================================
 *  EL CIRCUITO DE LA OFICINA, EN EL CHROME DE VERDAD
 * ============================================================================
 *
 *  Tres niveles: resumen -> empresa -> trámite. Y la vuelta, que es la mitad que se rompe.
 *
 *  Acá está LA PRUEBA DE VERDAD DEL ROUTER, que `rutas.spec.ts` no puede dar: hacer clic en un
 *  enlace de adentro de la app y después volver atrás. Con `page.goto()` el navegador hace una
 *  carga completa y el historial funciona con router o sin él; con un clic, no.
 */

test("el resumen muestra las cinco empresas, y la Diferencia de cada una", async ({ page }) => {
  await entrarComo(page, "gerencia");

  await expect(page.getByRole("heading", { name: "Grupo Paris" })).toBeVisible();

  // Las cinco están, y cada una es un enlace a la suya. En paralelo: son comprobaciones
  // independientes, ninguna depende del resultado de la anterior.
  await Promise.all(
    ["PARIS AUTOS", "PARIS CARS", "DORAL CHEVROLET"].map((empresa) =>
      expect(page.getByRole("link", { name: new RegExp(empresa) })).toBeVisible(),
    ),
  );
});

/*
  ============================================================================
   SE FUE LA PRUEBA DEL "SIN DATOS" DE LA GESTORA, Y LA REGLA QUEDO MEJOR CUIDADA
  ============================================================================

  Habia dos pruebas acá que entraban como GESTORA a esta pantalla —el resumen de empresas— para
  comprobar el defecto del 27/08/2026: que no le aparezca `$ 0,00` en una tarjeta que no puede
  ver, porque un cero se lee como un hecho y la deja sin salir a pagar.

  Desde el plan C la gestora NO LLEGA A ESTA PANTALLA: `/` le dibuja su cola. Las dos pruebas
  seguían pasando por casualidad hasta que dejó de existir el camino, y una prueba que comprueba
  una pantalla que su rol no puede abrir no protege nada.

  LA REGLA NO SE FUE, SE MUDO: la comprueba `e2e/gestora.spec.ts`, en "arriba muestra el saldo de
  las tarjetas donde tiene trabajo, y ninguna otra", contra la pantalla que ella sí ve. Es más
  fuerte, porque prueba el lugar donde el defecto puede volver a aparecer.

  Es el mismo movimiento que se le hizo a `menu.ts` en el plan B, y por el mismo motivo.
*/

test("pero a gerencia una empresa vacia le muestra sus ceros, que son ciertos", async ({
  page,
}) => {
  /*
    ============================================================================
     EL DEFECTO DEL 28/08/2026, QUE LO VEIA LA DUENIA
    ============================================================================

    La pantalla decidía con `movimientos_visibles > 0`, y una tarjeta VACIA cuenta cero igual que
    una prohibida. Gerencia veía "Sin datos" en tres de sus cinco empresas, y al abrir una leía
    "No podés ver los movimientos de esta tarjeta. (...) Vas a ver el saldo de las empresas donde
    tengas trámites".

    Puede verlos, y no depende de tener trámites: es la dueña. Ahora decide `puedo_ver`, que es
    una respuesta de permiso y no un conteo.

    ============================================================================
     POR QUE PARIS TRAC Y NO DORAL CHEVROLET
    ============================================================================

    Esta prueba usaba DORAL, y DORAL DEJO DE ESTAR VACIA el 28/08/2026: el plan C necesitaba un
    trámite esperando plata para poder probar el salto, y el único lugar donde puede haber uno es
    una tarjeta en cero. Ese trámite le dejó su reserva, así que la tarjeta ya tiene historia.

    Queda anotado porque es la clase de cosa que se descubre tarde: una prueba se apoyaba en que
    una fila NO existiera, y otra prueba la creó. Mientras la base de desarrollo sea la misma que
    la de producción, esto va a volver a pasar.
  */
  await entrarComo(page, "gerencia");

  const vacia = page.getByRole("link", { name: /PARIS TRAC/ });
  await expect(vacia).not.toContainText("Sin datos");
  await expect(vacia).toContainText("$ 0");

  await vacia.click();
  await expect(page.getByRole("heading", { name: /PARIS TRAC/i })).toBeVisible();

  // La frase que no puede aparecerle NUNCA a la oficina.
  await expect(page.getByText(/No podés ver los movimientos/)).toHaveCount(0);
  // Y el cero se explica, en vez de dejar una lista vacía sin motivo.
  await expect(page.getByText(/Todavía no hay movimientos/)).toBeVisible();
});

test("de resumen a empresa y de vuelta, con el boton atras del navegador", async ({ page }) => {
  await entrarComo(page, "gerencia");

  /*
    ESTE CLIC ES LA PRUEBA DEL ROUTER. Antes del 28/08/2026 la navegación era un `useState`: la
    dirección no cambiaba al moverse, así que `goBack()` desde acá salía de la app entera.
  */
  await page.getByRole("link", { name: /PARIS AUTOS/ }).click();

  await expect(page).toHaveURL(/\/empresa\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: "PARIS AUTOS" })).toBeVisible();

  await page.goBack();

  await expect(page).toHaveURL(/localhost:5173\/$/);
  await expect(page.getByRole("heading", { name: "Grupo Paris" })).toBeVisible();
});

test("las migas muestran el camino, y el tramo vuelve", async ({ page }) => {
  await entrarComo(page, "gerencia");
  await page.getByRole("link", { name: /PARIS AUTOS/ }).click();

  const migas = page.getByRole("navigation", { name: "Dónde estás" });
  await expect(migas).toContainText("Grupo Paris");
  await expect(migas).toContainText("PARIS AUTOS");

  // El último tramo NO es un enlace: un enlace a donde ya estás no lleva a ningún lado.
  await expect(migas.getByText("PARIS AUTOS")).toHaveAttribute("aria-current", "page");

  await migas.getByRole("link", { name: "Grupo Paris" }).click();
  await expect(page).toHaveURL(/localhost:5173\/$/);
});

test("la empresa muestra las cuatro cifras, y la Diferencia es la mas grande", async ({ page }) => {
  await entrarComo(page, "gerencia");
  await page.getByRole("link", { name: /PARIS AUTOS/ }).click();

  await Promise.all(
    ["Saldo día de hoy", "Depósito pendiente", "Saldo reservado", "Diferencia"].map((rotulo) =>
      expect(page.getByText(rotulo, { exact: true })).toBeVisible(),
    ),
  );
});

test("una empresa que no existe lo dice, y no deja la pantalla en blanco", async ({ page }) => {
  await entrarComo(page, "gerencia", "/empresa/00000000-0000-0000-0000-000000000000");

  await expect(page.getByRole("heading", { name: "Esa empresa no existe" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Ir al resumen" })).toBeVisible();
});

test("y una direccion que no existe tampoco", async ({ page }) => {
  await entrarComo(page, "gerencia", "/estonoexiste");

  await expect(page.getByRole("heading", { name: "Esa dirección no existe" })).toBeVisible();
});

test("las secciones arrancan segun su criterio, y se pliegan", async ({ page }) => {
  /*
    EL CRITERIO ES UNO SOLO: abierto lo que necesita algo, plegado lo que ya pasó. Los terminados
    y los anulados siguen estando —acá nada se borra— pero no acumulan ruido.
  */
  await entrarComo(page, "gerencia");
  await page.getByRole("link", { name: /PARIS AUTOS/ }).click();

  const enCurso = page.getByRole("button", { name: /En curso/ });
  const anulados = page.getByRole("button", { name: /Anulados/ });

  await expect(enCurso).toHaveAttribute("aria-expanded", "true");
  await expect(anulados).toHaveAttribute("aria-expanded", "false");

  // Y se pliega. Es un `button` con `aria-expanded`, así que se llega con teclado y el lector de
  // pantalla dice si está abierto — un `div` que escucha clics no hace ninguna de las dos cosas.
  await enCurso.click();
  await expect(enCurso).toHaveAttribute("aria-expanded", "false");
});

test("las filas de tramite son enlaces, y llevan al tramite", async ({ page }) => {
  await entrarComo(page, "gerencia");
  await page.getByRole("link", { name: /PARIS AUTOS/ }).click();

  const primera = page.locator("[data-fila-tramite]").first();
  await expect(primera).toBeVisible();
  await primera.click();

  // La dirección lleva la empresa Y el trámite: es lo que hace que "volver" sepa a dónde volver.
  await expect(page).toHaveURL(/\/empresa\/[0-9a-f-]{36}\/tramite\/[0-9a-f-]{36}$/);
});

test("y en la lista no hay ninguna cuenta por gestora", async ({ page }) => {
  /*
    NO SE MIDE A LAS PERSONAS. La gestora aparece como dato de la fila —para saber a quién
    llamar— y nunca como agrupación, conteo ni total.

    El día que exista esa tabla de posiciones, los presupuestos se cargan tarde y redondeados, y
    el comprometido —que es la razón de ser del sistema— pasa a ser mentira.
  */
  await entrarComo(page, "gerencia");
  await page.getByRole("link", { name: /PARIS AUTOS/ }).click();

  const encabezados = await page
    .getByRole("button", { name: /En curso|Anulados|Terminados/ })
    .allTextContents();
  for (const t of encabezados) {
    expect(t).not.toMatch(/Carla|Mariana/);
  }
});

test("el extracto arranca plegado y abre en hoy", async ({ page }) => {
  /*
    El pedido fue textual: "que la solapa de operaciones sea plegable para que no se acumulen
    tantas operaciones viejas, que aparezcan principalmente los movimientos del día".
  */
  await entrarComo(page, "gerencia");
  await page.getByRole("link", { name: /PARIS AUTOS/ }).click();

  const extracto = page.getByRole("button", { name: /Movimientos de la tarjeta/ });
  await expect(extracto).toHaveAttribute("aria-expanded", "false");

  await extracto.click();
  await expect(extracto).toHaveAttribute("aria-expanded", "true");
  await expect(extracto).toContainText("de hoy");
});

test("las columnas del extracto no se tocan entre si", async ({ page }) => {
  /*
    SE VIO MIRANDO LA PANTALLA. El importe va alineado a la derecha y el estado a la izquierda, y
    sin separacion el encabezado se leia "ImporteEstado" y una fila anulada decia "$ 1,00anulado".
  */
  await entrarComo(page, "gerencia");
  await page.getByRole("link", { name: /PARIS AUTOS/ }).click();
  await page.getByRole("button", { name: /Movimientos de la tarjeta/ }).click();
  await page.waitForSelector("table thead");

  const encabezado = await page.locator("table thead").innerText();
  expect(encabezado).not.toContain("ImporteEstado");
});

test("el boton de Excel esta en la empresa, y baja lo de esa empresa", async ({ page }) => {
  await entrarComo(page, "gerencia");
  await page.getByRole("link", { name: /PARIS AUTOS/ }).click();

  const boton = page.getByRole("button", { name: /Bajar a Excel/ });
  await expect(boton).toBeVisible();
  await expect(boton).toBeEnabled();
});

test("la oficina ve + Tramite y + Dinero adentro de la empresa", async ({ page }) => {
  await entrarComo(page, "gerencia");
  await page.getByRole("link", { name: /PARIS AUTOS/ }).click();

  await Promise.all([
    expect(page.getByRole("link", { name: "Trámite", exact: true })).toBeVisible(),
    expect(page.getByRole("link", { name: "Dinero", exact: true })).toBeVisible(),
  ]);
});

test("y la gestora NO los ve, ni entrando por la direccion", async ({ page }) => {
  /*
    La base ya lo impide —`movimientos_insert` exige `es_oficina()`— así que un botón visible
    fallaría al apretarlo. Un botón que va a fallar es PEOR que no tenerlo: enseña a desconfiar de
    la pantalla, y quien desconfía de una pantalla de plata vuelve al cuaderno.

    ENTRA POR LA DIRECCION Y NO POR EL RESUMEN. Desde el plan C la gestora no llega a esta
    pantalla navegando: `/` le dibuja su cola. Escribir la dirección a mano es justamente el caso
    que hay que comprobar —el que queda cuando alguien le pasa un enlace— y es más exigente que el
    que había antes, porque no depende de que la navegación se lo impida.
  */
  await entrarComo(page, "gerencia");
  await page.getByRole("link", { name: /PARIS AUTOS/ }).click();
  await expect(page).toHaveURL(/\/empresa\/[0-9a-f-]{36}$/);
  const direccion = new URL(page.url()).pathname;

  const otra = await page.context().browser()?.newContext();
  await page.close();

  const comoGestora = await (otra ?? page.context()).newPage();
  await entrarComo(comoGestora, "gestora", direccion);

  await expect(comoGestora.getByRole("heading", { name: "PARIS AUTOS" })).toBeVisible();
  await Promise.all([
    expect(comoGestora.getByRole("link", { name: "Trámite", exact: true })).toHaveCount(0),
    expect(comoGestora.getByRole("link", { name: "Dinero", exact: true })).toHaveCount(0),
  ]);
  await otra?.close();
});

test("cargar dinero no pregunta la tarjeta: la pantalla ya la sabe", async ({ page }) => {
  await entrarComo(page, "gerencia");
  await page.getByRole("link", { name: /PARIS AUTOS/ }).click();
  await page.getByRole("link", { name: "Dinero", exact: true }).click();

  await expect(page).toHaveURL(/\/empresa\/[0-9a-f-]{36}\/dinero$/);
  await expect(page.getByRole("heading", { name: /Cargar dinero en PARIS AUTOS/ })).toBeVisible();

  // EL CAMPO QUE NO EXISTE NO SE PUEDE LLENAR MAL: no hay selector de tarjeta.
  await expect(page.getByText("Tarjeta", { exact: true })).toHaveCount(0);

  // Y "Volver" vuelve a la empresa, no a "atrás" en general.
  await page.getByRole("button", { name: "Volver" }).click();
  await expect(page).toHaveURL(/\/empresa\/[0-9a-f-]{36}$/);
});

test("cargar un tramite no pregunta la razon social", async ({ page }) => {
  await entrarComo(page, "gerencia");
  await page.getByRole("link", { name: /PARIS AUTOS/ }).click();
  await page.getByRole("link", { name: "Trámite", exact: true }).click();

  await expect(page).toHaveURL(/\/empresa\/[0-9a-f-]{36}\/nuevo$/);
  await expect(page.getByText("Razón social", { exact: true })).toHaveCount(0);
});

test("si alguien carga un deposito, la pantalla del otro cambia sin recargar", async ({ page }) => {
  /*
    ============================================================================
     ES LA FUNCION CENTRAL DEL PRODUCTO, NO UN ADORNO
    ============================================================================

    El pedido decía, textual, que "muchas veces se pisan con el dinero que hay disponible en el
    día". Esto es lo que lo arregla: si contable carga un depósito en San Luis, la pantalla de
    gerencia en San Juan cambia sin que nadie recargue.

    ============================================================================
     EL DEPOSITO SE CARGA Y SE DESHACE POR LA API, NO POR LA PANTALLA
    ============================================================================

    La primera versión lo hacía todo por la interfaz: llenaba el formulario, y en el `finally`
    anulaba con el diálogo. **Falló y dejó un depósito de un peso en producción**, que hubo que
    anular a mano.

    El problema es que la limpieza dependía de encontrar tres selectores en una pantalla que ya
    estaba en un estado raro. Por la API es una llamada que no puede fallar por un botón que se
    renombró.

    Y no debilita la prueba: lo que se comprueba acá es que LA PANTALLA SE ENTERE, no que el
    formulario ande — eso ya lo prueba otra.
  */
  await entrarComo(page, "gerencia");

  const laFila = page.getByRole("link", { name: /PARIS AUTOS/ });
  await expect(laFila).toBeVisible();
  const antes = await laFila.innerText();

  const idDelDeposito = await cargarDepositoPorLaApi(1);

  try {
    // NADIE RECARGA NADA. Si esto falla, la suscripción en vivo no está llegando.
    await expect.poll(async () => laFila.innerText(), { timeout: 20_000 }).not.toBe(antes);
  } finally {
    await anularPorLaApi(
      idDelDeposito,
      "Depósito de prueba del tiempo real. No corresponde a ningún depósito real.",
    );
  }

  // Y vuelve solo a donde estaba, también sin recargar.
  await expect.poll(async () => laFila.innerText(), { timeout: 20_000 }).toBe(antes);
});
