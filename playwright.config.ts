import { defineConfig, devices } from "@playwright/test";

/**
 * ============================================================================
 *  PRUEBAS EN EL NAVEGADOR
 * ============================================================================
 *
 *  USA EL CHROME DE VERDAD de esta máquina, con `channel: "chrome"`, y no el Chromium que trae
 *  Playwright. No es capricho: la app la abre la dueña en su Chrome, y las diferencias entre
 *  Chromium y Chrome —códecs, fuentes del sistema, cómo redondea el subpíxel— son justo las que
 *  hacen que una captura pase en la prueba y se vea distinta en la realidad.
 *
 *  EL SERVIDOR LO LEVANTA PLAYWRIGHT, con el mismo puerto fijo de siempre. Esa URL está anotada
 *  en las redirect URLs de Supabase Auth, así que el puerto no se puede mover.
 *  `reuseExistingServer` para no pelear con el `npm run dev` que ya esté abierto mientras se
 *  trabaja.
 *
 *  UN SOLO TRABAJADOR. Las pruebas entran con las MISMAS cuentas de `.env.local` y tocan la
 *  MISMA base: en paralelo se pisan entre ellas y un fallo se vuelve imposible de leer. Es la
 *  misma decisión que ya tomó el arnés de permisos, y por el mismo motivo.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  timeout: 60_000,
  expect: {
    timeout: 10_000,
    /*
      Umbral de la comparación de capturas. Cero exigiría que no cambie ni un píxel por el
      antialiasing del texto entre corridas, y eso convierte al guardián en ruido — que es como
      se llega a que alguien lo apague.
    */
    toHaveScreenshot: { maxDiffPixelRatio: 0.01 },
  },
  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chrome",
      use: { ...devices["Desktop Chrome"], channel: "chrome" },
      testIgnore: "instalada.spec.ts",
    },
    {
      // La gestora trabaja parada en el registro, con una mano. Su app se prueba en el tamaño
      // real de un teléfono, no en una ventana angosta de escritorio.
      name: "telefono",
      use: { ...devices["Pixel 7"], channel: "chrome" },
      testIgnore: "instalada.spec.ts",
    },
    {
      /*
        ============================================================================
         LA APP CONSTRUIDA, QUE ES LA QUE SE INSTALA
        ============================================================================

        EN DESARROLLO LA APP NO ARRANCA SIN RED, Y NO ES UN DEFECTO: Vite sirve cada módulo por
        separado y el service worker de desarrollo no los precachea. Medido — al cortar la red y
        recargar, cinco recursos daban ERR_INTERNET_DISCONNECTED y saltaba el ErrorBoundary.

        Todo lo que dependa del armazón cacheado —abrir sin señal, el manifiesto, el service
        worker de verdad— tiene que probarse contra el BUILD servido, o no se está probando lo
        que se publica. Por eso este proyecto y su servidor aparte.
      */
      name: "instalada",
      use: { ...devices["Pixel 7"], channel: "chrome", baseURL: "http://localhost:4173" },
      testMatch: "instalada.spec.ts",
    },
  ],
  webServer: [
    {
      command: "npm run dev",
      url: "http://localhost:5173",
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      // El build, servido. `--strictPort` por la misma razón que el de desarrollo: un puerto que
      // se corre solo produce fallos que no hablan del puerto.
      command: "npm run build && npx vite preview --port 4173 --strictPort",
      url: "http://localhost:4173",
      reuseExistingServer: true,
      timeout: 180_000,
    },
  ],
});
