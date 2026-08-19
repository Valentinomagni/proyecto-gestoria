import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { SistemaVisual } from "./features/sistema/SistemaVisual";
import "./index.css";

const raiz = document.getElementById("root");
if (!raiz) throw new Error("Falta el elemento #root en index.html");

createRoot(raiz).render(
  <StrictMode>
    <SistemaVisual />
  </StrictMode>,
);
