import type { ReactNode } from "react";
import { LogOut, ShieldAlert } from "lucide-react";
import { supabase } from "../lib/supabase";
import { nombreDeRol } from "../lib/roles";
import { useSesion } from "../lib/sesion";
import { menuPara, type Pantalla } from "../menu";
import { Isotipo } from "./Logo";
import { SkeletonLineas } from "./Skeleton";
import { EmptyState } from "./EmptyState";
import { Login } from "./Login";
import { Panel } from "./Panel";

/**
 * La cáscara: decide qué se ve según quién entró.
 *
 * Tres estados, y cada uno importa:
 *  - cargando -> esqueleto, nunca la palabra que empieza con C;
 *  - sin sesión -> el login;
 *  - con sesión pero SIN rol -> una pantalla que EXPLICA y dice a quién avisarle.
 *
 * El tercero es el que se suele olvidar, y es el que más se ve el primer día: todas las cuentas
 * nuevas nacen sin permisos. Dejar a esa persona frente a una pantalla vacía es hacerle creer
 * que el sistema está roto.
 */
export function Shell({
  children, pantalla, alNavegar,
}: {
  children: ReactNode;
  pantalla: Pantalla;
  alNavegar: (p: Pantalla) => void;
}) {
  const { cargando, session, perfil } = useSesion();

  if (cargando) {
    return (
      <div className="p-6">
        <SkeletonLineas cantidad={4} className="max-w-md" />
      </div>
    );
  }

  if (!session) return <Login />;

  if (!perfil || !perfil.activo || perfil.rol === "sin_asignar") {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <Panel className="max-w-md">
          <EmptyState
            icono={ShieldAlert}
            titulo="Tu cuenta todavía no está habilitada"
            queHacer="Ya entraste, pero falta que gerencia te asigne un rol. Avisale y probá de nuevo en un rato."
            accion={<BotonSalir />}
          />
        </Panel>
      </div>
    );
  }

  const menu = menuPara(perfil.rol);

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 shrink-0 flex-col justify-between bg-side-bg p-4">
        <div className="flex flex-col gap-6">
          <Isotipo tono="blanco" alto={34} />
          <nav className="flex flex-col gap-1">
            {menu.map((m) => {
              const Icono = m.icono;
              const activa = pantalla === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => alNavegar(m.id)}
                  className={`flex items-center gap-2 rounded-md px-2 py-2 text-sm ${
                    activa ? "bg-side-bg2 text-side-ink" : "text-side-ink2"
                  }`}
                >
                  <Icono aria-hidden="true" size={16} />
                  {m.nombre}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="flex flex-col gap-2">
          <div>
            <p className="text-xs text-side-ink">{perfil.nombre}</p>
            <p className="text-2xs text-side-ink2">{nombreDeRol(perfil.rol)}</p>
          </div>
          {/*
            Mientras haya una sola base de Supabase, la app lo dice. Un riesgo conocido que no
            se ve, se olvida — y el día que esto tenga saldos reales, una prueba destructiva en
            una vista previa los tocaría.
          */}
          <p className="text-2xs text-warn">Base compartida con desarrollo</p>
          <BotonSalir oscuro />
        </div>
      </aside>

      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}

function BotonSalir({ oscuro = false }: { oscuro?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => void supabase.auth.signOut()}
      className={
        oscuro
          ? "flex items-center gap-2 text-2xs text-side-ink2"
          : "flex items-center gap-2 rounded-md border border-line px-3 py-2 text-sm"
      }
    >
      <LogOut aria-hidden="true" size={14} />
      Salir
    </button>
  );
}
