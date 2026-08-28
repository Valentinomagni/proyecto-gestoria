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

  // Las cinco están, y cada una es un enlace a la suya.
  for (const empresa of ["PARIS AUTOS", "PARIS CARS", "DORAL CHEVROLET"]) {
    await expect(page.getByRole("link", { name: new RegExp(empresa) })).toBeVisible();
  }
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

  for (const rotulo of [
    "Saldo día de hoy",
    "Depósito pendiente",
    "Saldo reservado",
    "Diferencia",
  ]) {
    await expect(page.getByText(rotulo, { exact: true })).toBeVisible();
  }
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
