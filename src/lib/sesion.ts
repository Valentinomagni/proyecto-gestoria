import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { esRolValido, type Rol } from "./roles";

/**
 * Quien esta usando el sistema ahora: la sesion de Auth mas su perfil.
 *
 * Son dos cosas distintas y hace falta esperar a las dos. La sesion dice QUIEN es; el perfil
 * dice QUE PUEDE HACER. Dibujar con la sesion lista y el perfil todavia sin llegar produce el
 * parpadeo clasico: la pantalla muestra "no tenes permiso" por medio segundo y despues el
 * contenido. Por eso `cargando` cubre a las dos.
 */

export interface Perfil {
  id: string;
  email: string;
  nombre: string;
  rol: Rol;
  activo: boolean;
  gestora_id: string | null;
}

export interface Sesion {
  cargando: boolean;
  session: Session | null;
  perfil: Perfil | null;
  /** Null si no hay perfil todavia. Nunca se adivina un rol. */
  rol: Rol | null;
}

export function useSesion(): Sesion {
  const [session, setSession] = useState<Session | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let vivo = true;

    async function traerPerfil(s: Session | null): Promise<void> {
      if (!s) {
        if (vivo) {
          setPerfil(null);
          setCargando(false);
        }
        return;
      }
      const { data } = await supabase
        .from("perfiles")
        .select("id, email, nombre, rol, activo, gestora_id")
        .eq("id", s.user.id)
        .maybeSingle();

      if (!vivo) return;
      // Si el rol que llega no es uno de los conocidos, se trata como sin_asignar. Es el default
      // seguro: ante la duda, ningun permiso.
      setPerfil(
        data ? { ...data, rol: esRolValido(data.rol) ? data.rol : "sin_asignar" } : null,
      );
      setCargando(false);
    }

    void supabase.auth.getSession().then(({ data }) => {
      if (!vivo) return;
      setSession(data.session);
      void traerPerfil(data.session);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_evento, s) => {
      if (!vivo) return;
      setSession(s);
      setCargando(true);
      void traerPerfil(s);
    });

    return () => {
      vivo = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { cargando, session, perfil, rol: perfil?.rol ?? null };
}
