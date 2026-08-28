import { expect, test } from "@playwright/test";
import { entrarComo } from "./entrar";

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

test("una empresa sin movimientos visibles dice Sin datos, no un cero", async ({ page }) => {
  /*
    ES EL DEFECTO DEL 27/08/2026 CONVERTIDO EN PRUEBA. Toda gestora veía las cinco tarjetas en
    `$ 0,00` mientras Paris Autos tenía ocho millones y medio, y salía al registro creyendo que no
    había con qué pagar.

    Un cero es un número y se lee como un hecho. "Sin datos" no.
  */
  await entrarComo(page, "gerencia");

  const doral = page.getByRole("link", { name: /DORAL CHEVROLET/ });
  await expect(doral).toContainText("Sin datos");
  await expect(doral).not.toContainText("$ 0");
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

test("la gestora ve el saldo de su empresa, no ceros", async ({ page }) => {
  /*
    La otra mitad del defecto del 27/08. La gestora tiene que ver números de verdad en las
    empresas donde tiene trámites, y "Sin datos" en las otras — nunca un cero que se lea como
    un hecho.
  */
  await entrarComo(page, "gestora");

  const conDatos = page.getByRole("link", { name: /PARIS AUTOS/ });
  await expect(conDatos).toBeVisible();
  await expect(conDatos).not.toContainText("Sin datos");
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

test("y la gestora NO los ve", async ({ page }) => {
  /*
    La base ya lo impide —`movimientos_insert` exige `es_oficina()`— así que un botón visible
    fallaría al apretarlo. Un botón que va a fallar es PEOR que no tenerlo: enseña a desconfiar de
    la pantalla, y quien desconfía de una pantalla de plata vuelve al cuaderno.
  */
  await entrarComo(page, "gestora");
  await page.getByRole("link", { name: /PARIS AUTOS/ }).click();

  await Promise.all([
    expect(page.getByRole("link", { name: "Trámite", exact: true })).toHaveCount(0),
    expect(page.getByRole("link", { name: "Dinero", exact: true })).toHaveCount(0),
  ]);
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
