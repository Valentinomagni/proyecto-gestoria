import { defineConfig } from "vitest/config";

/**
 * Configuración aparte para las pruebas de permisos.
 *
 * POR QUE NO VAN CON EL RESTO: necesitan RED y una base real con usuarios reales. Un test que
 * necesita internet no puede vivir en el gate del pre-commit, que tiene que tardar segundos y
 * funcionar en un tren.
 *
 * Corren con `npm run test:rls`, a mano y en CI.
 */
export default defineConfig({
  test: {
    include: ["src/**/*.rls.test.ts"],
    environment: "node",
    globals: true,
    // Loguearse cuatro veces contra Supabase no entra en los 5 segundos que vitest da por defecto.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // En serie: cada prueba abre su propia sesión y correrlas en paralelo contra la misma base
    // hace que un fallo sea imposible de leer.
    fileParallelism: false,
  },
});
