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

  /*
    Mientras haya una sola base de Supabase, la app lo dice. Un riesgo conocido que no se ve,
    se olvida — y el día que esto tenga saldos reales, una prueba destructiva en una vista
    previa los tocaría.
  */
  const avisoBase = "Base compartida con desarrollo";

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/*
        ============================================================================
         DOS NAVEGACIONES, Y NO ES UN CAPRICHO: SON DOS PERSONAS DISTINTAS.
        ============================================================================

        En el escritorio trabaja administración y gerencia, sentadas, con el listado a la vista
        todo el día: barra al costado, nombres completos.

        En el teléfono trabaja LA GESTORA, PARADA EN EL REGISTRO Y CON UNA MANO. Por eso la
        barra va ABAJO: el pulgar de una mano llega al borde inferior de la pantalla y no llega
        al superior. Un menú arriba obliga a la segunda mano, y la segunda mano tiene el legajo.

        SE MIDIO, y por eso existe este cambio: con la barra lateral de 224 px, en un teléfono
        de 375 px al contenido le quedaban 151. La pantalla de quien más la necesita era la
        única inusable.
      */}

      {/* Teléfono: tira de identidad arriba, fina, que no compite con los números. */}
      <header className="flex items-center justify-between gap-3 bg-side-bg px-4 py-2 md:hidden">
        <Isotipo tono="blanco" alto={22} />
        <div className="flex items-center gap-3">
          <span className="text-2xs text-warn">{avisoBase}</span>
          <BotonSalir oscuro />
        </div>
      </header>

      {/* Escritorio: la barra de siempre. */}
      <aside className="hidden w-56 shrink-0 flex-col justify-between bg-side-bg p-4 md:flex">
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
                  aria-current={activa ? "page" : undefined}
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
          <p className="text-2xs text-warn">{avisoBase}</p>
          <BotonSalir oscuro />
        </div>
      </aside>

      {/*
        El relleno de abajo deja pasar la barra: sin él, la última fila del listado queda
        tapada por la navegación y nadie se entera de que hay algo más.
      */}
      <main className="flex-1 overflow-auto pb-24 md:pb-0">{children}</main>

      {/*
        Teléfono: la navegación, abajo. `pb-[env(safe-area-inset-bottom)]` la levanta por
        encima de la barra del iPhone; sin eso el último renglón de texto queda debajo del
        indicador y el botón se toca mal justo en el borde.
      */}
      <nav className="fixed inset-x-0 bottom-0 z-10 flex justify-around border-t border-side-bg2 bg-side-bg pb-[env(safe-area-inset-bottom)] md:hidden">
        {menu.map((m) => {
          const Icono = m.icono;
          const activa = pantalla === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => alNavegar(m.id)}
              aria-current={activa ? "page" : undefined}
              className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-1 px-1 py-2 ${
                activa ? "text-side-ink" : "text-side-ink2"
              }`}
            >
              <Icono aria-hidden="true" size={20} />
              <span className="text-2xs leading-none">{m.corto}</span>
            </button>
          );
        })}
      </nav>
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
