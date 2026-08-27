import { expect, test } from "@playwright/test";

/**
 * ============================================================================
 *  LA PRIMERA PRUEBA, Y LA MAS BARATA DE TODAS: QUE LA APP ARRANQUE
 * ============================================================================
 *
 *  Suena trivial y no lo es. El 20/08/2026 el sitio publicado quedó en NEGRO, sin una sola
 *  palabra, y nadie se enteró hasta que alguien lo abrió a mano. Una pantalla en negro no
 *  distingue entre "está cargando", "se cayó internet", "el despliegue salió mal" y "esto nunca
 *  funcionó": quien la mira no puede hacer nada, ni siquiera avisar bien qué le pasó.
 *
 *  Esta prueba falla en dos segundos si eso vuelve a pasar.
 */

test("la app arranca y muestra el login", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Gestoría" })).toBeVisible();
  await expect(page.getByLabel("Correo")).toBeVisible();
  await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
});

test("y el aviso de que no cargó NO se ve cuando sí cargó", async ({ page }) => {
  /*
    El aviso vive en el HTML crudo y se esconde cuando React monta. Si algún día quedara visible
    por encima de una app que anda, sería PEOR que no tenerlo: diría que está roto lo que
    funciona, y eso enseña a ignorar los avisos que sí importan.
  */
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
  await expect(page.locator("#no-arranco")).toBeHidden();
});

test("no hay errores en la consola al arrancar", async ({ page }) => {
  const errores: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errores.push(m.text());
  });

  await page.goto("/");
  await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();

  /*
    El refresco del token de Supabase sin sesión devuelve 400, y es esperable: no hay sesión que
    refrescar. Filtrarlo es lo correcto; NO filtrar nada convertiría esta prueba en una que falla
    siempre, y una prueba que siempre falla se termina borrando.
  */
  const reales = errores.filter((e) => !e.includes("400") && !e.includes("refresh_token"));
  expect(reales, `errores en consola: ${reales.join(" | ")}`).toHaveLength(0);
});
