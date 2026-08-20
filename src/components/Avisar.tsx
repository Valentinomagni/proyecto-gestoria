import { useState } from "react";
import { LifeBuoy } from "lucide-react";
import { toast } from "sonner";
import { BOTON_SUAVE, CAMPO } from "../lib/campos";
import { clasificarFalla } from "../lib/fallas";
import { supabase } from "../lib/supabase";
import { Panel } from "./Panel";

/**
 * ============================================================================
 *  ANDON: EL BOTON DE PARAR LA LINEA.
 * ============================================================================
 *
 *  En Toyota el andon es la cuerda que cualquiera puede tirar cuando ve un defecto. Lo que la
 *  hace funcionar no es la cuerda: es que tirarla NO le cueste nada a quien la tira.
 *
 *  ============================================================================
 *   QUIEN LO APRIETA NO TIENE QUE SABER EXPLICAR NADA
 *  ============================================================================
 *
 *  Es la regla de diseño de esta pantalla, y de ahí sale todo lo demás.
 *
 *  Una gestora parada en el registro, con el legajo en una mano y el teléfono en la otra, no va
 *  a redactar un informe. Va a escribir "no me deja guardar", o directamente nada. Y eso tiene
 *  que alcanzar: **el botón de mandar nunca se deshabilita**.
 *
 *  Lo que hace falta para encontrar el problema no lo escribe la persona, lo adjunta la app
 *  sola: en qué pantalla estaba, con qué rol, qué trámite tenía abierto, qué navegador, si
 *  había internet, qué hora era. Exigir una descripción es exactamente cómo se consigue que
 *  nadie avise.
 *
 *  ============================================================================
 *   LO QUE SE ADJUNTA ES TECNICO Y NADA MAS
 *  ============================================================================
 *
 *  Nunca el nombre de un cliente, ni un dominio, ni un importe. El id del trámite alcanza para
 *  que quien lo mire lo abra; copiar los datos de la persona a otra tabla es cómo terminan
 *  saliendo por una exportación que nadie pensó.
 *
 *  ============================================================================
 *   Y ESTA EN TODAS LAS PANTALLAS
 *  ============================================================================
 *
 *  Un botón de avisar que está en una sola pantalla sirve para los problemas de esa pantalla.
 *  Los problemas aparecen en cualquier lado, y sobre todo en el peor momento — que es cuando
 *  nadie va a ponerse a buscar dónde estaba el botón.
 */
export function Avisar({ pantalla, rol, tramiteId }: {
  pantalla: string;
  rol: string;
  tramiteId: string | null;
}) {
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const [mandando, setMandando] = useState(false);

  async function mandar(): Promise<void> {
    setMandando(true);
    try {
      const { data: sesion } = await supabase.auth.getUser();
      const quien = sesion.user?.id;
      if (quien === undefined) throw new Error("regla_tramite: Se cerró la sesión. Entrá de nuevo.");

      const { error } = await supabase.from("avisos").insert({
        // Vacío se guarda como vacío, no como cadena en blanco: es la diferencia entre
        // "no escribió nada" y "escribió espacios".
        texto: texto.trim() === "" ? null : texto.trim(),
        quien,
        contexto: {
          pantalla,
          rol,
          tramite: tramiteId,
          // Contexto TECNICO. Nada de esto identifica a un cliente.
          navegador: navigator.userAgent,
          pantalla_px: `${window.innerWidth}x${window.innerHeight}`,
          habia_internet: navigator.onLine,
          momento: new Date().toISOString(),
        },
      });
      if (error) throw error;

      setTexto("");
      setAbierto(false);
      toast.success("Aviso enviado", {
        description: "Se mandó con el contexto técnico. No hace falta que expliques nada más.",
      });
    } catch (e) {
      const falla = clasificarFalla(e, navigator.onLine);
      toast.error(falla.titulo, { description: falla.explicacion });
    } finally {
      setMandando(false);
    }
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="flex items-center gap-2 text-2xs text-side-ink2"
      >
        <LifeBuoy aria-hidden="true" size={14} />
        Avisar un problema
      </button>
    );
  }

  return (
    <Panel className="fixed inset-x-4 bottom-20 z-20 flex max-w-md flex-col gap-3 md:inset-x-auto md:bottom-6 md:left-6">
      <h2 className="text-sm">Avisar un problema</h2>
      <p className="text-2xs text-ink2">
        No hace falta que expliques nada. Con que aprietes mandar alcanza: la app adjunta sola en
        qué pantalla estabas y el resto del detalle técnico.
      </p>
      <label className="flex flex-col gap-1">
        <span className="sr-only">Qué pasó</span>
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={2}
          placeholder="Si querés contar algo, escribilo acá. Si no, mandá igual."
          className={CAMPO}
        />
      </label>
      <div className="flex flex-wrap gap-2">
        {/*
          NUNCA se deshabilita. Un botón de avisar que exige haber escrito algo es un botón que
          no se aprieta justo cuando más falta hace.
        */}
        <button type="button" onClick={() => void mandar()} className={BOTON_SUAVE}>
          {mandando ? "Mandando" : "Mandar el aviso"}
        </button>
        <button type="button" onClick={() => setAbierto(false)} className={BOTON_SUAVE}>
          Cerrar
        </button>
      </div>
    </Panel>
  );
}
