/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
import path from "node:path";

// Tailwind 4 se configura desde el CSS (@theme en src/index.css), no desde un archivo aparte.
// POR QUE IMPORTA: en el Tablero la escala tipografica vive en tailwind.config.js y el color en
// index.css, sin nada que conecte los dos archivos. Esa fractura es lo que dejo 571 tamanos
// escritos a mano en 20 valores distintos. Aca color y tipografia son el mismo bloque.
export default defineConfig({
  plugins: [react(), tailwind()],
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
