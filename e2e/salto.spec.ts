import { expect, test } from "@playwright/test";
import { anularPorLaApi, cargarDepositoPorLaApi, entrarComo } from "./entrar";

/**
 * ============================================================================
 *  EL SALTO: LA FUNCION CENTRAL DEL PRODUCTO
 * ============================================================================
 *
 *  El pedido original dice que "muchas veces se pisan con el dinero que hay disponible en el
 *  día". Esto es la respuesta: la oficina deposita y la tarjeta de la gestora se mueve sola del
 *  bloque de espera al de trabajo. Sin recargar, sin preguntar por WhatsApp.
 *
 *  ============================================================================
 *   POR QUE LA PLATA ENTRA POR LA API Y NO POR LA PANTALLA
 *  ============================================================================
 *
 *  La primera versión de la prueba de tiempo real del Plan B hacía todo por la interfaz y limpiaba
 *  en el `finally` con tres selectores, sobre una pantalla que ya estaba en un estado raro. Falló,
 *  la limpieza falló también, y DEJO UN DEPOSITO DE UN PESO EN PRODUCCION que hubo que anular a
 *  mano.
 *
 *  Cargar y anular por la API no debilita la prueba: lo que se comprueba es que LA PANTALLA SE
 *  ENTERE, no que el formulario ande. El formulario tiene su propia prueba.
 *
 *  ============================================================================
 *   POR QUE EN DORAL CHEVROLET Y NO EN PARIS AUTOS
 *  ============================================================================
 *
 *  Porque está en cero, y una tarjeta en cero es el único lugar donde puede haber alguien
 *  esperando plata. Y porque el movimiento de prueba conviene que caiga lo más lejos posible de
 *  los once millones que mira la dueña: mientras la base sea una sola, cada fila que escribe una
 *  prueba se ve en el extracto del día.
 */

/** Lo que pide el trámite de prueba. Se deposita apenas más, para que la tarjeta lo cubra. */
const LO_QUE_FALTA = 45_000;

test("cuando la oficina deposita, la tarjeta salta de bloque sola", async ({ page }) => {
  await entrarComo(page, "gestora");

  const esperando = page.locator("[data-bloque='esperando'] [data-tarjeta-tramite]");
  await expect(
    esperando.first(),
    "no hay ningun tramite esperando plata: sin eso esta prueba no comprueba nada",
  ).toBeVisible();
  await expect(esperando.first()).toContainText("PRUEBA ESPERANDO PLATA");

  let idDelDeposito = 0;
  try {
    idDelDeposito = await cargarDepositoPorLaApi(LO_QUE_FALTA, "Doral");

    /*
      SIN RECARGAR. Si esta espera hiciera `page.reload()` la prueba pasaría igual con el tiempo
      real apagado, y no comprobaría nada de lo que dice comprobar.
    */
    await expect(
      page.locator("[data-bloque='te_toca']").getByText("PRUEBA ESPERANDO PLATA"),
      "la tarjeta no salto: el tiempo real no invalido la cola",
    ).toBeVisible({ timeout: 20_000 });

    // Y se fue del bloque de abajo: saltar es moverse, no aparecer en los dos lados.
    await expect(
      page.locator("[data-bloque='esperando']").getByText("PRUEBA ESPERANDO PLATA"),
    ).toHaveCount(0);

    // Y ahora sí tiene botón, que es lo que el salto le viene a dar.
    await expect(
      page
        .locator("[data-bloque='te_toca'] [data-tarjeta-tramite]")
        .filter({ hasText: "PRUEBA ESPERANDO PLATA" })
        .locator("[data-boton-accion]"),
    ).toHaveCount(1);
  } finally {
    // Se anula por la misma puerta que usaría una persona: `anular_movimiento`, con su motivo.
    if (idDelDeposito !== 0) await anularPorLaApi(idDelDeposito, "prueba del salto en vivo");
  }
});

test("y el salto pasa ADENTRO de una transicion de vista, no de un redibujo pelado", async ({
  page,
}) => {
  /*
    ============================================================================
     LA MITAD DEL MECANISMO QUE NO SE VE
    ============================================================================

    `view-transition-name` en cada tarjeta no alcanza: el navegador anima el viaje SOLO si el
    cambio de DOM ocurre adentro de `document.startViewTransition`. Sin esa llamada el atributo
    queda puesto y sin usar, la tarjeta desaparece de un bloque y aparece en el otro, y las otras
    pruebas de este archivo pasan igual — porque comprueban DONDE queda, no COMO llegó.

    Así que se espía la función. No se puede ver la animación desde Playwright, pero sí se puede
    ver que se pidió, que es la condición sin la cual no hay ninguna.
  */
  await page.addInitScript(() => {
    const d = document as Document & { startViewTransition?: (f: () => void) => unknown };
    const original = d.startViewTransition?.bind(d);
    (window as unknown as { saltos: number }).saltos = 0;
    if (original === undefined) return;
    d.startViewTransition = (f: () => void) => {
      (window as unknown as { saltos: number }).saltos++;
      return original(f);
    };
  });

  await entrarComo(page, "gestora");
  await expect(page.locator("[data-bloque='esperando'] [data-tarjeta-tramite]")).toBeVisible();

  // El primer dibujo NO cuenta como salto: no se movió nada todavía.
  expect(await page.evaluate(() => (window as unknown as { saltos: number }).saltos)).toBe(0);

  let idDelDeposito = 0;
  try {
    idDelDeposito = await cargarDepositoPorLaApi(LO_QUE_FALTA, "Doral");

    await expect(
      page.locator("[data-bloque='te_toca']").getByText("PRUEBA ESPERANDO PLATA"),
    ).toBeVisible({ timeout: 20_000 });

    expect(
      await page.evaluate(() => (window as unknown as { saltos: number }).saltos),
      "la tarjeta cambio de bloque SIN transicion de vista: se ve aparecer, no viajar",
    ).toBeGreaterThan(0);
  } finally {
    if (idDelDeposito !== 0) await anularPorLaApi(idDelDeposito, "prueba del salto en vivo");
  }
});

test("y la tarjeta tiene nombre de transicion, que es lo que la hace viajar", async ({ page }) => {
  /*
    SE COMPRUEBA EL ATRIBUTO Y NO LA ANIMACION. Playwright no puede ver una transición de vista
    ocurrir; lo que sí puede es comprobar que cada tarjeta tenga su nombre único y estable, que es
    la condición sin la cual el navegador no anima nada.

    Escrito acá para que nadie crea que esta prueba dice que "se ve lindo": dice que está la pieza
    sin la cual no se ve nada.
  */
  await entrarComo(page, "gestora");

  const tarjetas = page.locator("[data-tarjeta-tramite]");
  await expect(tarjetas.first()).toBeVisible();

  const nombres = await tarjetas.evaluateAll((els) =>
    els.map((e) => getComputedStyle(e).viewTransitionName),
  );
  expect(
    nombres.every((x) => x.startsWith("tramite-")),
    `nombres: ${nombres.join(", ")}`,
  ).toBe(true);
  expect(new Set(nombres).size, "dos tarjetas comparten nombre de transicion").toBe(nombres.length);
});
