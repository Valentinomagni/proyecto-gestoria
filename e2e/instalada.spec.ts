import { expect, test } from "@playwright/test";
import { entrarComo } from "./entrar";

/**
 * ============================================================================
 *  LA APP CONSTRUIDA: LA QUE SE INSTALA Y LA QUE ABRE SIN SENIAL
 * ============================================================================
 *
 *  Corre contra el BUILD servido en el 4173, no contra el servidor de desarrollo. La razón está
 *  en `playwright.config.ts`, y en resumen: en desarrollo Vite sirve cada módulo por separado y el
 *  service worker no los precachea, así que la app no arranca sin red. Probarlo ahí daría un rojo
 *  que no habla de la app.
 */

test("el manifiesto esta, y con los iconos que hacen falta para instalarla", async ({ page }) => {
  await page.goto("/");

  const enlace = page.locator('link[rel="manifest"]');
  await expect(enlace).toHaveCount(1);

  const manifiesto = await page.evaluate(async () => {
    const href = document.querySelector('link[rel="manifest"]')?.getAttribute("href");
    if (href === null || href === undefined) return null;
    return (await (await fetch(href)).json()) as unknown;
  });

  const m = manifiesto as { name: string; icons: { sizes: string; purpose?: string }[] };
  expect(m.name).toContain("Gestoría");
  expect(m.icons.length).toBeGreaterThanOrEqual(2);

  /*
    EL `maskable` NO ES UN LUJO: sin uno, Android recorta el icono cuadrado dentro de su forma y
    se come los bordes del isotipo. Se ve en el escritorio del teléfono.
  */
  expect(m.icons.some((i) => (i.purpose ?? "").includes("maskable"))).toBe(true);
});

test("el service worker se registra y precachea el armazon", async ({ page }) => {
  await page.goto("/");

  const cuantos = await page.evaluate(async () => {
    const rs = await navigator.serviceWorker.getRegistrations();
    return rs.length;
  });
  expect(cuantos, "no se registro ningun service worker").toBeGreaterThan(0);
});

test("sin conexion la app ABRE, lo dice, y NO muestra ningun importe", async ({
  page,
  context,
}) => {
  /*
    ============================================================================
     LA REGLA QUE NO SE NEGOCIA
    ============================================================================

    Sin red, la app tiene que ABRIR —para eso está el service worker— y tiene que DECIR que no hay
    conexión. Lo que no puede hacer, bajo ninguna circunstancia, es mostrar el último saldo que
    vio como si fuera el de ahora.

    Un saldo viejo con cara de saldo actual es peor que un error: no llama la atención, y con ese
    número ella decide si sale al registro a pagar.

    Y TAMPOCO PUEDE DECIRLE QUE LE DESACTIVARON LA CUENTA. Antes del 28/08/2026 eso es lo que
    pasaba: sin red la consulta a `perfiles` fallaba, el perfil quedaba en null, y la app decía
    "Tu cuenta todavía no está habilitada. Falta que gerencia te asigne un rol". Falso, alarmante,
    y termina en una llamada desde la vereda del registro.
  */
  await entrarComo(page, "gestora");
  await expect(page.getByRole("heading", { name: /Te toca a vos/ })).toBeVisible();

  /*
    ============================================================================
     SE ESPERA A QUE EL SERVICE WORKER TOME EL CONTROL, Y NO ES CEREMONIA
    ============================================================================

    Registrarse no alcanza: hasta que el service worker CONTROLA la página, la recarga sale a la
    red de verdad y sin conexión devuelve ERR_INTERNET_DISCONNECTED — la prueba falla por una
    carrera y no por el producto.

    Pasó el 28/08/2026, en una corrida donde la misma prueba había pasado antes. Una prueba
    intermitente es peor que una que falla siempre: la primera se termina volviendo a correr hasta
    que sale en verde, y ahí deja de proteger.

    `navigator.serviceWorker.ready` espera a que esté activo; `controller !== null` es lo que de
    verdad importa, porque es la condición bajo la cual el service worker intercepta la navegación.
  */
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, {
    timeout: 20_000,
  });

  await context.setOffline(true);
  await page.reload();

  // ABRE: no es la pantalla de error del navegador ni el ErrorBoundary.
  await expect(page.getByRole("heading", { name: "Sin conexión" })).toBeVisible({
    timeout: 20_000,
  });
  /*
    `not.toBeVisible()` Y NO `toHaveCount(0)`. El respaldo de "no llegó a cargar" vive en el
    `index.html` —es el que se ve cuando el JS no arranca— y SIGUE EN EL DOM, oculto, después de
    que React monta. Contar elementos lo encuentra siempre y la prueba falla con la app sana.
  */
  await expect(page.getByText(/no llegó a cargar/)).not.toBeVisible();
  await expect(page.getByText(/no está habilitada/)).not.toBeVisible();

  // Ni un importe en toda la pantalla.
  const cuerpo = (await page.locator("body").textContent()) ?? "";
  expect(cuerpo, "hay un importe en pantalla sin conexion").not.toMatch(/\$\s?[\d.]/);

  await context.setOffline(false);
});
