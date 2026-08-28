import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { entrarComo } from "./entrar";

/**
 * ============================================================================
 *  EL ACABADO, COMPROBADO Y NO DE PALABRA
 * ============================================================================
 *
 *  `@axe-core/playwright` estaba instalado desde el principio y NO SE USO NUNCA. Mide contraste,
 *  nombres accesibles, orden de encabezados y roles — todo lo que "se ve bien" no alcanza para
 *  saber.
 *
 *  Se mira SOLO lo serio y lo critico. Las violaciones menores de axe incluyen cosas discutibles,
 *  y un umbral que obliga a discutir es un umbral que se termina bajando a cero exigencia.
 */

/** Las tres pantallas que existen, con la sesión que corresponde. */
const PANTALLAS = [
  { nombre: "el resumen", ir: "/" },
  { nombre: "administración", ir: "/administracion" },
];

for (const p of PANTALLAS) {
  test(`${p.nombre} no tiene violaciones serias de accesibilidad`, async ({ page }) => {
    await entrarComo(page, "gerencia", p.ir);
    await page.waitForLoadState("networkidle");

    const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    const serias = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");

    expect(
      serias,
      serias.map((v) => `${v.id}: ${v.nodes.length} elemento(s)`).join(" | "),
    ).toHaveLength(0);
  });
}

test("la empresa tampoco, con sus secciones abiertas", async ({ page }) => {
  await entrarComo(page, "gerencia");
  await page.getByRole("link", { name: /PARIS AUTOS/ }).click();
  await page.getByRole("button", { name: /Movimientos de la tarjeta/ }).click();
  await page.waitForLoadState("networkidle");

  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  const serias = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");

  expect(serias, serias.map((v) => `${v.id}: ${v.nodes.length}`).join(" | ")).toHaveLength(0);
});

test("y en modo oscuro, que tiene sus propios contrastes", async ({ page }) => {
  /*
    EL OSCURO SE MIDE APARTE Y NO ES CEREMONIA. Dar por buenos los valores del claro es
    exactamente el error que el guardián de contraste existe para evitar: un teal que pasa sobre
    blanco puede no pasar sobre un fondo casi negro.
  */
  await page.emulateMedia({ colorScheme: "dark" });
  await entrarComo(page, "gerencia");
  await page.waitForLoadState("networkidle");

  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  const serias = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");

  expect(serias, serias.map((v) => `${v.id}: ${v.nodes.length}`).join(" | ")).toHaveLength(0);
});

test("el menu del nombre se cierra con Escape, y el foco vuelve al boton", async ({ page }) => {
  /*
    UN MENU DEL QUE NO SE PUEDE SALIR CON TECLADO ES UN MENU ROTO, y el detalle que se olvida
    siempre es el foco: si se queda en un elemento que ya no existe, el navegador lo manda al
    principio del documento y hay que tabular la pagina entera de nuevo.
  */
  await entrarComo(page, "gerencia");

  const boton = page.getByRole("button", { name: /gerencia1/ });
  await boton.click();
  await expect(boton).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("menuitem", { name: "Administración" })).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(boton).toHaveAttribute("aria-expanded", "false");
  await expect(boton).toBeFocused();
});

test("la gestora no ve Administracion en el menu", async ({ page }) => {
  await entrarComo(page, "gestora");
  await page.getByRole("button", { name: /gestoria1/ }).click();

  await expect(page.getByRole("menuitem", { name: "Administración" })).toHaveCount(0);
  await expect(page.getByRole("menuitem", { name: "Salir" })).toBeVisible();
});

/**
 * ============================================================================
 *  LAS DOS PANTALLAS DE LA GESTORA
 * ============================================================================
 *
 *  Entran acá el 28/08/2026, con el plan C. Son las que se miran en un teléfono, con una mano y a
 *  veces en la calle — donde el contraste real es peor que el de un monitor de oficina.
 *
 *  Y se miden en los dos temas por la misma razón que las de la oficina: un color que pasa sobre
 *  blanco puede no pasar sobre un fondo casi negro, y al revés.
 */
for (const oscuro of [false, true]) {
  const tema = oscuro ? "en oscuro" : "en claro";

  test(`la cola de la gestora no tiene violaciones serias, ${tema}`, async ({ page }) => {
    if (oscuro) await page.emulateMedia({ colorScheme: "dark" });
    await entrarComo(page, "gestora");
    await page.getByRole("heading", { name: /Te toca a vos/ }).waitFor();
    await page.waitForLoadState("networkidle");

    const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    const serias = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");

    expect(
      serias,
      serias.map((v) => `${v.id}: ${v.nodes.length} elemento(s)`).join(" | "),
    ).toHaveLength(0);
  });

  test(`y la ficha reducida tampoco, ${tema}`, async ({ page }) => {
    if (oscuro) await page.emulateMedia({ colorScheme: "dark" });
    await entrarComo(page, "gestora");
    await page.locator("[data-tarjeta-tramite]").first().getByRole("link").first().click();
    await page.getByRole("heading", { name: "Notas" }).waitFor();
    await page.waitForLoadState("networkidle");

    const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    const serias = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");

    expect(
      serias,
      serias.map((v) => `${v.id}: ${v.nodes.length} elemento(s)`).join(" | "),
    ).toHaveLength(0);
  });
}
