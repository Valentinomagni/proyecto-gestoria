import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";

/**
 * SistemaVisual es una HERRAMIENTA DE VERIFICACION, no una pantalla del producto.
 *
 * Existe porque los tokens de color y la escala tipografica no se pueden verificar leyendo
 * codigo: hay que mirarlos juntos. La regla del proyecto dice que una pantalla no esta lista
 * hasta que alguien la miro, y esto es donde se mira.
 *
 * `import.meta.env.DEV` lo reemplaza Vite por `false` al compilar para produccion, asi que este
 * `import()` NO entra al paquete que baja el usuario. Se comprueba mirando que el build no
 * genere un pedazo con ese nombre.
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
    {SistemaVisual ? (
      <Suspense fallback={null}>
        <SistemaVisual />
      </Suspense>
    ) : null}
  </StrictMode>,
);
