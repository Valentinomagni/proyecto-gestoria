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
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "./src") },
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
