import { expect, test } from "@playwright/test";
import { entrarComo } from "./entrar";

/**
 * ============================================================================
 *  LA COLA, EN EL CHROME DE VERDAD
 * ============================================================================
 *
 *  Se prueba en el teléfono además de en el escritorio porque es donde se usa. El proyecto
 *  `telefono` de `playwright.config.ts` ya emula uno.
 */

test("la gestora entra y ve su cola, no el resumen de la oficina", async ({ page }) => {
  await entrarComo(page, "gestora");

  await expect(page.getByRole("heading", { name: /Te toca a vos/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Esperando a la oficina/ })).toBeVisible();

  // Y NO ve la pantalla de la oficina: es el otro producto.
  await expect(page.getByRole("heading", { name: "Grupo Paris" })).toHaveCount(0);
});

test("la oficina sigue viendo el resumen, y no una cola", async ({ page }) => {
  await entrarComo(page, "gerencia");

  await expect(page.getByRole("heading", { name: "Grupo Paris" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Te toca a vos/ })).toHaveCount(0);
});

test("cada tarjeta dice de que empresa es y que hay que hacer", async ({ page }) => {
  await entrarComo(page, "gestora");

  const primera = page.locator("[data-tarjeta-tramite]").first();
  await expect(primera).toBeVisible();
  await expect(primera).toContainText("PARIS AUTOS");
});

test("lo que espera plata no tiene boton, y dice cuanto falta", async ({ page }) => {
  /*
    ES EL CORAZON DEL PRODUCTO. Un botón en un trámite sin plata la manda al registro a que la
    rebote el cajero. Y la ausencia del botón sola no alcanza: tiene que venir con el número.
  */
  await entrarComo(page, "gestora");

  const esperando = page.locator("[data-bloque='esperando'] [data-tarjeta-tramite]");
  await expect(
    esperando.first(),
    "no hay ningun tramite esperando plata: sin eso esta prueba no comprueba nada",
  ).toBeVisible();

  await expect(esperando.first()).toContainText(/Falta que depositen/);
  // Sólo el enlace del nombre. Ningún botón de acción.
  await expect(esperando.first().locator("[data-boton-accion]")).toHaveCount(0);

  /*
    EL IMPORTE EXACTO, Y NO SOLO QUE HAYA UN IMPORTE.

    El 28/08/2026 esta tarjeta decía `$ 450` para un trámite que pide 45.000: la base manda pesos,
    `formatear` espera centavos, y faltaba el `aCentavos` del medio. Dividido por cien, sin error
    y sin advertencia. Una expresión como `/\$ [\d.]+/` habría pasado igual de contenta.

    El trámite de prueba pide 45.000 fijos, así que el número se puede atar.
  */
  await expect(esperando.first()).toContainText("$ 45.000");
});

test("y lo que si tiene plata trae su boton", async ({ page }) => {
  await entrarComo(page, "gestora");

  const teToca = page.locator("[data-bloque='te_toca'] [data-tarjeta-tramite]");
  await expect(teToca.first()).toBeVisible();
  await expect(teToca.first().locator("[data-boton-accion]")).toHaveCount(1);
});

test("arriba muestra el saldo de las tarjetas donde tiene trabajo, y ninguna otra", async ({
  page,
}) => {
  /*
    SIN SELECTOR DE TARJETA (spec 5). Un selector la obligaría a saber de antemano por qué empresa
    preguntar, y ella no piensa por empresa: piensa por trámite.

    LA LISTA NO LA ARMA LA PANTALLA, LA ARMA EL PERMISO: son las tarjetas con `puedo_ver`, que es
    la misma respuesta que usa la app de la oficina.
  */
  await entrarComo(page, "gestora");

  const saldo = page.locator("[data-saldo-de-arriba]");
  await expect(saldo).toBeVisible();

  // Donde trabaja, con el número de verdad y no un cero.
  await expect(saldo).toContainText("Paris Autos SA");
  await expect(saldo).toContainText("$ 11.940.627,92");

  // Y las que no puede ver no se dibujan: ahí no hay saldo que mostrar, ni siquiera un cero.
  await expect(saldo).not.toContainText("Paris Motor");
  await expect(saldo).not.toContainText("Paris Trac");
});

test("un bloque vacio lo dice con palabras, y no queda en blanco", async ({ page }) => {
  await entrarComo(page, "gestora");

  /*
    SE ESPERA ANTES DE CONTAR. `count()` no reintenta —a diferencia de `toBeVisible()`— así que
    sin esta línea devuelve 0 y la prueba falla por la carga, no por lo que quiere comprobar.
  */
  await expect(page.getByRole("heading", { name: /Te toca a vos/ })).toBeVisible();

  // Alguno de los tres va a estar vacío; el que esté, tiene que hablar.
  const bloques = page.locator("[data-bloque]");
  const total = await bloques.count();
  expect(total, "no se dibujo ningun bloque").toBe(3);

  for (let i = 0; i < total; i++) {
    const b = bloques.nth(i);
    if ((await b.locator("[data-tarjeta-tramite]").count()) === 0) {
      await expect(b, "un bloque vacio no dice nada").toContainText(/No |Todavía/);
    }
  }
});
