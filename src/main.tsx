import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { App } from "./App";
import { iniciarMonitoreo } from "./lib/monitoreo";
import "./index.css";

iniciarMonitoreo();

const cliente = new QueryClient({
  defaultOptions: {
    queries: {
      // Lo que manda la frescura del saldo es Realtime, no un intervalo: cuando alguien carga
      // un movimiento, la pantalla del otro se entera sola. Esto es solo la red por si esa
      // suscripcion falla.
      staleTime: 30_000,
      retry: 1,
    },
  },
});

/**
 * SistemaVisual es una HERRAMIENTA DE VERIFICACION, no una pantalla del producto.
 * `import.meta.env.DEV` se reemplaza por `false` al compilar, asi que no entra al paquete.
 * Se abre con ?sistema en la direccion.
 */
const SistemaVisual = import.meta.env.DEV
  ? lazy(() => import("./features/sistema/SistemaVisual").then((m) => ({ default: m.SistemaVisual })))
  : null;

const verSistema =
  import.meta.env.DEV && new URLSearchParams(window.location.search).has("sistema");

const raiz = document.getElementById("root");
if (!raiz) throw new Error("Falta el elemento #root en index.html");

createRoot(raiz).render(
  <StrictMode>
    <ErrorBoundary donde="raiz">
      <QueryClientProvider client={cliente}>
        {verSistema && SistemaVisual ? (
          <Suspense fallback={null}>
            <SistemaVisual />
          </Suspense>
        ) : (
          <App />
        )}
        <Toaster position="bottom-right" />
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);
