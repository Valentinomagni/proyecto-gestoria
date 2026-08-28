import { expect, test } from "@playwright/test";

/**
 * ============================================================================
 *  LAS PANTALLAS TIENEN DIRECCION, Y EL BOTON ATRAS FUNCIONA
 * ============================================================================
 *
 *  Hasta el 28/08/2026 no. La navegación era un `useState`, así que:
 *
 *   - abrir cualquier dirección daba la pantalla de inicio, sin decir por qué;
 *   - apretar "atrás" SACABA A LA PERSONA DE LA APP;
 *   - ninguna pantalla se podía mandar por mensaje.
 *
 *  Lo último importa más de lo que parece: la forma normal de decirle algo a alguien en esta
 *  empresa es mandarle un mensaje, y hasta hoy no había forma de mandar un trámite.
 *
 *  ============================================================================
 *   LO QUE ESTAS PRUEBAS DEMUESTRAN, Y LO QUE NO
 *  ============================================================================
 *
 *  DEMUESTRAN que cada dirección existe, que la app se dibuja en todas, y que ninguna deja la
 *  pantalla en blanco. Corren sin sesión: el `Shell` dibuja el login para cualquier ruta, que es
 *  lo correcto, así que lo que se mira acá es la URL.
 *
 *  NO DEMUESTRAN que el router funcione. `page.goto()` hace una carga completa del navegador y
 *  crea entradas de historial CON ROUTER O SIN EL — o sea que este mismo archivo habría pasado
 *  entero antes del 28/08/2026, cuando la navegación era un `useState`.
 *
 *  La prueba de verdad es OTRA: hacer clic en un enlace de adentro de la app y después volver
 *  atrás. Eso necesita sesión —hay que pasar el login para ver un enlace— y vive en
 *  `oficina.spec.ts`. Queda escrito acá para que nadie lea este archivo y crea que la navegación
 *  está cubierta.
 */

test("una direccion que no existe no rompe la app", async ({ page }) => {
  await page.goto("/estonoexiste");

  // La app se dibuja igual: sin sesión, el login.
  await expect(page.getByRole("heading", { name: "Gestoría" })).toBeVisible();
  await expect(page.locator("#no-arranco")).toBeHidden();
});

test("las direcciones sobreviven al ida y vuelta del navegador", async ({ page }) => {
  await page.goto("/");
  await page.goto("/administracion");
  await expect(page).toHaveURL(/\/administracion$/);

  await page.goBack();

  // La app sigue dibujada, y la dirección volvió. Esto por sí solo NO prueba el router —ver la
  // cabecera—, pero sí que ninguna de las dos rutas deja la pantalla en blanco al volver.
  await expect(page).toHaveURL(/localhost:5173\/$/);
  await expect(page.getByRole("heading", { name: "Gestoría" })).toBeVisible();
});

test("y adelante tambien", async ({ page }) => {
  await page.goto("/");
  await page.goto("/administracion");
  await page.goBack();
  await page.goForward();

  await expect(page).toHaveURL(/\/administracion$/);
});

test("la direccion de un tramite se puede abrir de una", async ({ page }) => {
  /*
    ES EL CASO DE USO QUE JUSTIFICA TODO ESTO: alguien manda por mensaje el enlace de un trámite y
    del otro lado se abre ese trámite. Sin sesión llega al login, que es lo correcto — y después
    de entrar, el router lleva a donde decía la dirección.
  */
  await page.goto(
    "/empresa/11111111-1111-1111-1111-111111111111/tramite/22222222-2222-2222-2222-222222222222",
  );

  await expect(page.getByRole("heading", { name: "Gestoría" })).toBeVisible();
  await expect(page).toHaveURL(/\/tramite\/22222222/);
});
