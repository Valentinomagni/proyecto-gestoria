import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { iniciarMonitoreo } from "./lib/monitoreo";
import "./index.css";

iniciarMonitoreo();

/**
 * SistemaVisual es una HERRAMIENTA DE VERIFICACION, no una pantalla del producto.
 *
 * `import.meta.env.DEV` lo reemplaza Vite por `false` al compilar, asi que este `import()` NO
 * entra al paquete que baja el usuario. Se comprueba mirando que el build no genere su pedazo.
 *
 * Se descarta el dia que existan suficientes pantallas reales como para que sobre.
 */
const SistemaVisual = import.meta.env.DEV
  ? lazy(() => import("./features/sistema/SistemaVisual").then((m) => ({ default: m.SistemaVisual })))
  : null;

const raiz = document.getElementById("root");
if (!raiz) throw new Error("Falta el elemento #root en index.html");

createRoot(raiz).render(
  <StrictMode>
    <ErrorBoundary donde="raiz">
      {SistemaVisual ? (
        <Suspense fallback={null}>
          <SistemaVisual />
        </Suspense>
      ) : null}
    </ErrorBoundary>
  </StrictMode>,
);
