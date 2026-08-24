import { useState } from "react";
import { MessageSquare } from "lucide-react";
import { Panel } from "../../components/Panel";
import { SkeletonLineas } from "../../components/Skeleton";
import { formatearFechaHora } from "../../lib/fechas";
import { BOTON_SUAVE, CAMPO } from "../../lib/campos";


/**
 * ============================================================================
 *  LAS NOTAS DEL TRAMITE. Es la "intercomunicacion" del objetivo, y NO es un chat.
 * ============================================================================
 *
 *  POR QUE NO ES UN CHAT, escrito en la migracion y repetido aca porque es lo que mas facil se
 *  desvia: un canal de mensajes nuevo compite con WhatsApp, que ya esta abierto en el telefono
 *  de todos, y pierde. Nadie va a venir a esta pantalla a conversar.
 *
 *  A lo que si sirve: hoy alguien explica algo por WhatsApp —"este no lo presentes hasta que
 *  llegue el 08", "la titular viaja hasta el jueves"— y esa explicacion NO QUEDA EN NINGUN
 *  LADO. Cuando dos semanas despues alguien pregunta por que este tramite esta parado, la
 *  respuesta esta en un chat que hay que buscar, si es que sigue.
 *
 *  Entonces: una anotacion pegada al tramite, con quien y cuando. La ultima arriba, porque lo
 *  que importa es lo ultimo que se supo.
 *
 *  NO SE EDITA NI SE BORRA, y no por olvido: la base le revoco UPDATE y DELETE. Una aclaracion
 *  que se puede reescribir despues no sirve como respaldo, que es justamente para lo que se
 *  escribe. Si algo quedo mal dicho, se escribe otra abajo.
 */
export function Notas({
  notas, cargando, alAgregar, guardando,
}: {
  notas: { id: number; texto: string; creado_at: string | null; autor_nombre: string | null }[];
  cargando: boolean;
  alAgregar: (texto: string) => void;
  guardando: boolean;
}) {
  const [texto, setTexto] = useState("");
  const listo = texto.trim() !== "";

  return (
    <Panel className="flex flex-col gap-3">
      <h2 className="text-lg">Notas</h2>
      <p className="text-xs text-ink2">
        Lo que hoy se explica por WhatsApp y después nadie encuentra. Queda con tu nombre y no
        se puede editar ni borrar: por eso sirve de respaldo.
      </p>

      <label className="flex flex-col gap-2">
        <span className="sr-only">Escribí una nota</span>
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={2}
          placeholder="Ej: la titular viaja hasta el jueves, no presentar antes"
          className={CAMPO}
        />
        <button
          type="button"
          disabled={!listo || guardando}
          onClick={() => {
            alAgregar(texto);
            setTexto("");
          }}
          className={BOTON_SUAVE}
        >
          <MessageSquare aria-hidden="true" size={14} />
          {guardando ? "Guardando" : "Agregar nota"}
        </button>
      </label>

      {cargando ? (
        <SkeletonLineas cantidad={2} />
      ) : notas.length === 0 ? (
        <p className="text-sm text-ink2">Todavía no hay notas en este trámite.</p>
      ) : (
        <div className="flex flex-col">
          {notas.map((n) => (
            <div key={n.id} className="border-b border-line py-2 last:border-0">
              <p className="whitespace-pre-wrap text-sm">{n.texto}</p>
              <p className="mt-1 text-2xs text-ink2 tnum">
                {n.autor_nombre ?? "Alguien"}
                {n.creado_at === null ? "" : ` · ${formatearFechaHora(n.creado_at)}`}
              </p>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
