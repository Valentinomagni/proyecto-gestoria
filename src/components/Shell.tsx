import { useEffect, type ReactNode } from "react";
import { LogOut, ShieldAlert } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { supabase } from "../lib/supabase";
import { useSesion } from "../lib/sesion";
import { useNovedades, useSaldosEnVivo } from "../lib/datos";
import { Isotipo } from "./Logo";
import { SkeletonLineas } from "./Skeleton";
import { EmptyState } from "./EmptyState";
import { Login } from "./Login";
import { Avisar } from "./Avisar";
import { Novedades } from "./Novedades";
import { Migas } from "./Migas";
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
 * nuevas nacen sin permisos. Dejar a esa persona frente a una pantalla vacía es hacerle creer que
 * el sistema está roto.
 *
 * ============================================================================
 *  PERDIO LA BARRA LATERAL, Y LA DE ABAJO TAMBIEN
 * ============================================================================
 *
 * El pedido fue textual: "no quiero tener una barra lateral, parece literalmente la réplica del
 * tablero contable". Y no se reemplaza por otra barra: se reemplaza por PROFUNDIDAD —resumen,
 * empresa, trámite— con las migas mostrando el camino.
 *
 * LA BARRA DE ABAJO DEL TELEFONO SE VA POR LA MISMA RAZON, y hay que decir qué se pierde y qué se
 * gana. Existía porque eran cinco pantallas planas y el pulgar de una mano llega al borde
 * inferior y no al superior — se midió, y en un teléfono de 375 px la barra lateral dejaba 151 px
 * de contenido.
 *
 * Con tres niveles no hay cinco destinos que poner ahí. Y a cambio se gana algo que antes no
 * existía: **el gesto nativo de "atrás" del teléfono ahora funciona**, porque hay router. Antes
 * sacaba de la app.
 *
 * La pantalla de la gestora se rehace entera en el Plan C, y ahí se vuelve a mirar la ergonomía
 * del teléfono con la cola de tareas ya diseñada.
 */
export function Shell({ children }: { children: ReactNode }) {
  const cliente = useQueryClient();
  const navegar = useNavigate();
  const { cargando, session, perfil } = useSesion();

  // El saldo se entera solo cuando otro lo mueve. Es la función central del producto: sin esto,
  // dos personas miran el mismo número viejo y comprometen la misma plata.
  useSaldosEnVivo(cliente);

  // La campana escucha los pasos de la cadena. Necesita saber QUIÉN soy para no avisarme mis
  // propios cambios: quien acaba de mover un trámite ya sabe que lo movió.
  const novedades = useNovedades(perfil?.id ?? null);

  const ruta = useRouterState({ select: (s) => s.location.pathname });

  /*
    EL FOCO SE MUEVE AL CONTENIDO AL CAMBIAR DE NIVEL, y es requisito de WCAG.

    Sin esto, quien usa lector de pantalla cambia de pantalla y sigue parado en el encabezado:
    escucha "Grupo Paris" de nuevo y no se entera de que abajo hay algo distinto.

    Se hace acá y no en cada pantalla porque una pantalla que se olvide de hacerlo no falla de
    forma visible: simplemente deja a alguien sin saber dónde está.
  */
  useEffect(() => {
    document.getElementById("contenido")?.focus();
  }, [ruta]);

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
      <div className="flex min-h-dvh items-center justify-center p-6">
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

  /*
    Mientras haya una sola base de Supabase, la app lo dice. Un riesgo conocido que no se ve, se
    olvida — y el día que esto tenga saldos reales, una prueba destructiva los tocaría.
  */
  const avisoBase = "Base compartida con desarrollo";

  return (
    <div className="flex min-h-dvh flex-col">
      {/* La tira superior: teal oscuro, y es lo primero que se ve. */}
      <header className="flex items-center justify-between gap-3 bg-side-bg px-4 py-2">
        <Isotipo tono="blanco" alto={22} />
        <div className="flex items-center gap-3">
          <span className="text-2xs text-side-ink2">{avisoBase}</span>
          <Novedades
            lista={novedades.lista}
            sinVer={novedades.sinVer}
            alAbrirPanel={novedades.marcarVistas}
            alAbrirTramite={() => void navegar({ to: "/" })}
          />
          {/* El andon vive en la cáscara, así que está en TODAS las pantallas y para todos los
              roles. Un botón de avisar que está en una sola pantalla sirve para los problemas de
              esa pantalla. */}
          <Avisar pantalla={ruta} rol={perfil.rol} tramiteId={null} />
          <BotonSalir oscuro />
        </div>
      </header>

      <Migas nombreDeUsuario={perfil.nombre} />

      {/* `tabIndex={-1}` lo hace enfocable por código sin meterlo en el orden de tabulación. */}
      <main id="contenido" tabIndex={-1} className="flex-1 overflow-auto outline-none">
        {children}
      </main>
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
