/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";

// Tailwind 4 se configura desde el CSS (@theme en src/index.css), no desde un archivo aparte.
// POR QUE IMPORTA: en el Tablero la escala tipografica vive en tailwind.config.js y el color en
// index.css, sin nada que conecte los dos archivos. Esa fractura es lo que dejo 571 tamanos
// escritos a mano en 20 valores distintos. Aca color y tipografia son el mismo bloque.
export default defineConfig({
  plugins: [
    react(),
    tailwind(),
    /*
      ============================================================================
       LA APP INSTALABLE: SE CACHEA EL ARMAZON Y NUNCA LOS DATOS
      ============================================================================

      La gestora trabaja en la calle, con datos moviles y en el subsuelo de un registro. Que la
      app ABRA sin senial y pueda decir "sin conexion" es infinitamente mejor que no abrir.

      NO HAY `runtimeCaching`, Y NO ES UN OLVIDO. Cualquier regla que alcance a Supabase le
      mostraria un SALDO VIEJO CON CARA DE SALDO ACTUAL: no un error, no un cartel, un numero bien
      dibujado que ya no es cierto — y con ese numero decide si sale al registro a pagar. Lo
      comprueba `npm run pwa` leyendo el `dist/sw.js` generado, que es el hecho y no la intencion.

      `registerType: "autoUpdate"` con `skipWaiting`: una version nueva entra sola en la siguiente
      carga. La alternativa —preguntarle si quiere actualizar— deja a alguien usando una version
      vieja indefinidamente si toca "ahora no", y en un sistema de plata dos versiones no muestran
      lo mismo.

      `navigateFallbackDenylist` saca del armazon todo lo que sea una llamada de datos. Sin eso,
      el fallback de navegacion puede devolver el index.html ante una peticion a la API, y el
      sintoma es horrible: la app "responde" con HTML donde esperaba JSON.
    */
    VitePWA({
      registerType: "autoUpdate",
      workbox: {
        globPatterns: ["**/*.{js,css,html,woff2,png,svg}"],
        clientsClaim: true,
        skipWaiting: true,
        navigateFallbackDenylist: [/^\/rest\//, /^\/auth\//],
      },
      manifest: {
        name: "Gestoría — Grupo Paris",
        short_name: "Gestoría",
        description: "Los trámites del automotor y la cuenta de las Tarjetas Habitualistas.",
        lang: "es-AR",
        start_url: "/",
        display: "standalone",
        theme_color: "#0e7c8c",
        background_color: "#ffffff",
        icons: [
          { src: "/brand/icono-192.png", sizes: "192x192", type: "image/png" },
          { src: "/brand/icono-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "/brand/icono-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
    }),
  ],
  // Poda de Sentry. Medido: sin estas dos banderas su pedazo pesa 155,85 kB comprimidos, que
  // los paga entera la gestora con datos moviles. Son las que la propia documentacion de
  // Sentry indica para sacar el codigo de depuracion y el de trazas de rendimiento, que este
  // proyecto no usa (tracesSampleRate va en 0).
  define: {
    __SENTRY_DEBUG__: false,
    __SENTRY_TRACING__: false,
  },
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "./src") },
  },
  server: {
    port: 5173,
    // strictPort: si 5173 esta ocupado, FALLA en vez de correrse a 5174 en silencio.
    // POR QUE: la URL de desarrollo esta anotada en las "Additional redirect URLs" de Supabase
    // Auth. Si Vite se corre de puerto sin avisar, el login deja de funcionar y el sintoma no
    // apunta al puerto: parece un problema de credenciales. Mejor que no arranque.
    strictPort: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes("node_modules/@supabase/supabase-js")) return "vendor-supabase";
          if (id.includes("node_modules/@tanstack/react-query")) return "vendor-query";
          if (id.includes("node_modules/@tanstack/react-router")) return "vendor-router";
          // write-excel-file solo se usa al exportar. Que viaje en su propio pedazo evita que
          // pese en el arranque de todos los dias.
          if (id.includes("node_modules/write-excel-file")) return "vendor-excel";
        },
      },
    },
  },
  test: {
    // Los de RLS quedan afuera A PROPOSITO: necesitan red y usuarios reales contra la base,
    // asi que corren aparte con `npm run test:rls`. Un test que necesita internet no puede
    // vivir en el gate del pre-commit.
    include: ["src/**/*.test.{ts,tsx}"],
    exclude: ["src/**/*.rls.test.ts"],
    environment: "jsdom",
    globals: true,
  },
});
