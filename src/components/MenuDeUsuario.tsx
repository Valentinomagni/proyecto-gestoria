import { useEffect, useRef, useState } from "react";
import { ChevronDown, LogOut, Settings } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { supabase } from "../lib/supabase";
import { nombreDeRol, puedeMoverSaldo, type Rol } from "../lib/roles";

/**
 * ============================================================================
 *  EL NOMBRE DE QUIEN ENTRO, Y DETRAS ADMINISTRACION
 * ============================================================================
 *
 *  Administración se entra dos veces al mes, no todos los días: usuarios, razones sociales,
 *  feriados y el respaldo. Tenerla como destino permanente le daba el mismo peso que a la
 *  pantalla que se mira treinta veces por día.
 *
 *  ============================================================================
 *   UN MENU DEL QUE NO SE PUEDE SALIR CON TECLADO ES UN MENU ROTO
 *  ============================================================================
 *
 *  Por eso: `aria-expanded` y `aria-haspopup` para que el lector de pantalla diga qué es y si
 *  está abierto; Escape lo cierra; y al cerrarse **el foco vuelve al botón**.
 *
 *  Ese último detalle es el que se olvida siempre, y es el que deja a alguien perdido: si el foco
 *  se queda en un elemento que ya no existe, el navegador lo manda al principio del documento y
 *  hay que tabular la página entera de nuevo.
 */
export function MenuDeUsuario({ nombre, rol }: { nombre: string; rol: Rol }) {
  const [abierto, setAbierto] = useState(false);
  const boton = useRef<HTMLButtonElement>(null);
  const caja = useRef<HTMLDivElement>(null);

  function cerrar(devolverFoco = true): void {
    setAbierto(false);
    if (devolverFoco) boton.current?.focus();
  }

  useEffect(() => {
    if (!abierto) return;

    function alTeclado(e: KeyboardEvent): void {
      if (e.key === "Escape") cerrar();
    }
    /*
      TAMBIEN CIERRA AL TOCAR AFUERA, y sin devolver el foco: quien hizo clic en otro lado ya
      eligio donde estar. Devolverselo al boton seria arrancarle el cursor de donde lo puso.
    */
    function alClic(e: MouseEvent): void {
      if (caja.current !== null && !caja.current.contains(e.target as Node)) cerrar(false);
    }

    document.addEventListener("keydown", alTeclado);
    document.addEventListener("mousedown", alClic);
    return () => {
      document.removeEventListener("keydown", alTeclado);
      document.removeEventListener("mousedown", alClic);
    };
  }, [abierto]);

  return (
    <div ref={caja} className="relative">
      <button
        ref={boton}
        type="button"
        onClick={() => setAbierto(!abierto)}
        aria-expanded={abierto}
        aria-haspopup="menu"
        className="flex items-center gap-1 text-2xs text-side-ink2"
      >
        {nombre}
        <ChevronDown aria-hidden="true" size={12} />
      </button>

      {abierto && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 flex min-w-44 flex-col rounded-md border border-line bg-surface p-1 shadow-[var(--shadow-lg)]"
        >
          <p className="px-2 py-1 text-2xs text-ink2">{nombreDeRol(rol)}</p>

          {/*
            SOLO LA OFICINA VE ADMINISTRACION. La RLS ya lo impide de verdad —una gestora que
            abriera la URL a mano veria consultas devolviendo cero filas—, pero ofrecer una puerta
            que no lleva a ningun lado enseña a desconfiar de la pantalla.
          */}
          {puedeMoverSaldo(rol) && (
            <Link
              to="/administracion"
              role="menuitem"
              onClick={() => cerrar(false)}
              className="flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent-soft"
            >
              <Settings aria-hidden="true" size={14} />
              Administración
            </Link>
          )}

          <button
            type="button"
            role="menuitem"
            onClick={() => void supabase.auth.signOut()}
            className="flex items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-accent-soft"
          >
            <LogOut aria-hidden="true" size={14} />
            Salir
          </button>
        </div>
      )}
    </div>
  );
}
