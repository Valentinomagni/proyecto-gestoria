import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";

const raiz = document.getElementById("root");
if (!raiz) throw new Error("Falta el elemento #root en index.html");

createRoot(raiz).render(
  <StrictMode>
    <main className="p-6">
      <h1 className="text-xl">Gestoría — Grupo Paris</h1>
      <p className="text-sm text-ink2">Fundación en curso.</p>
    </main>
  </StrictMode>,
);
