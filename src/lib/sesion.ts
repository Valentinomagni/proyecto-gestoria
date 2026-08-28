import { useCallback, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { reportar } from "./monitoreo";
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
  /**
   * ============================================================================
   *  NO SE PUDO PREGUNTAR. NO ES LO MISMO QUE "NO TIENE PERFIL"
   * ============================================================================
   *
   * Sin este dato las dos respuestas llegan iguales —`perfil` en null— y la app elige la peor
   * lectura posible: el 28/08/2026, a quien se le cortaba la senial en la calle le decia
   *
   *     "Tu cuenta todavia no esta habilitada. Falta que gerencia te asigne un rol."
   *
   * Es falso, es alarmante, y termina en una llamada a la oficina desde la vereda del registro.
   *
   * Es la misma distincion que el proyecto ya tiene escrita para la base —AUSENCIA (cero filas)
   * contra RECHAZO (un error)— aplicada del lado de adentro.
   *
   * SOLO ES `true` CUANDO NO SE LLEGO A LA BASE. Si la base contestó con un error propio —un
   * 42P17, un permiso revocado— eso NO es falta de conexión, y decirlo sería mentir. Ver
   * `errorDeLaBase`.
   */
  fallo: boolean;
  /**
   * El código que devolvió Postgres, cuando la base contestó y contestó que no.
   *
   * ES UNA PREGUNTA DISTINTA DE `fallo`. Un 42P17 es la recursión en las policies de `perfiles`,
   * que el CLAUDE.md marca como la trampa número uno porque devuelve 500 en TODAS las tablas.
   * Mostrarlo como "sin conexión" sería un mensaje falso, y ademas manda a revisar el WiFi
   * mientras la base está rota.
   */
  errorDeLaBase: string | null;
  /**
   * Volver a preguntar por el perfil, sin recargar la página.
   *
   * EXISTE PORQUE LA PANTALLA DE SIN CONEXION NO TENIA SALIDA. Se recuperaba la señal y la app
   * seguía diciendo que no hasta que el token se renovara — hasta una hora. Lo encontró la
   * revisión de seguridad del 28/08/2026.
   */
  reintentar: () => void;
}

export function useSesion(): Sesion {
  const [session, setSession] = useState<Session | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [cargando, setCargando] = useState(true);
  const [fallo, setFallo] = useState(false);
  const [errorDeLaBase, setErrorDeLaBase] = useState<string | null>(null);

  /*
    El reintento lo arma el efecto, que es donde vive `traerPerfil` con su bandera `vivo`. Se
    guarda en una referencia para que el componente lo pueda llamar sin que cambie de identidad en
    cada dibujo — un `onClick` que cambia en cada render vuelve a montar el botón.
  */
  const reintentarRef = useRef<() => void>(() => undefined);
  const reintentar = useCallback(() => {
    reintentarRef.current();
  }, []);

  useEffect(() => {
    let vivo = true;

    async function traerPerfil(s: Session | null): Promise<void> {
      if (!s) {
        if (vivo) {
          setPerfil(null);
          setCargando(false);
          /*
            SE BAJA `fallo` TAMBIEN POR ACA, y esto era un defecto: la primera versión salía sin
            tocarlo. Como el efecto se monta una sola vez, `fallo` quedaba en `true` hasta el
            siguiente `traerPerfil` CON sesión —o sea, hasta que el token se renovara, que por
            omisión es una hora.
            Traducido: la gestora salía del subsuelo del registro, tenía señal, y la app le seguía
            diciendo que no.
          */
          setFallo(false);
        }
        return;
      }
      const { data, error } = await supabase
        .from("perfiles")
        .select("id, email, nombre, rol, activo, gestora_id")
        .eq("id", s.user.id)
        .maybeSingle();

      if (!vivo) return;

      /*
        ============================================================================
         "NO LLEGUE" Y "LA BASE ME RECHAZO" NO SON LO MISMO
        ============================================================================

        Sin esta distinción, un 42P17 —la recursión en `perfiles` que el CLAUDE.md marca como la
        trampa número uno, y que devuelve 500 en TODAS las tablas— se le mostraría a todo el mundo
        como "Sin conexión". Un mensaje falso, y encima nadie se entera: el error se descartaba.

        Un error de red no trae `code`: `supabase-js` lo devuelve como `TypeError: Failed to
        fetch`. Uno de Postgres sí lo trae. Esa es la señal, y no hay que inventar ninguna.
      */
      const esDeLaBase = error !== null && typeof error.code === "string" && error.code !== "";

      if (error !== null) {
        // Va a Sentry SIEMPRE, sea de red o de la base. Un error que sólo se dibuja se pierde.
        reportar(error, "sesion/traerPerfil");
      }

      setFallo(error !== null && !esDeLaBase);
      setErrorDeLaBase(esDeLaBase ? (error.code ?? "sin código") : null);

      // Si el rol que llega no es uno de los conocidos, se trata como sin_asignar. Es el default
      // seguro: ante la duda, ningun permiso.
      setPerfil(data ? { ...data, rol: esRolValido(data.rol) ? data.rol : "sin_asignar" } : null);
      setCargando(false);
    }

    // Lo que permite reintentar sin recargar la página: se vuelve a preguntar por el perfil.
    reintentarRef.current = () => {
      setCargando(true);
      void supabase.auth.getSession().then(({ data }) => {
        if (!vivo) return;
        setSession(data.session);
        void traerPerfil(data.session);
      });
    };

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

  return { cargando, session, perfil, rol: perfil?.rol ?? null, fallo, errorDeLaBase, reintentar };
}
