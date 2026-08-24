import { useState } from "react";
import { Ban, PauseCircle } from "lucide-react";
import { Panel } from "../../components/Panel";
import { BOTON_SUAVE, CAMPO } from "../../lib/campos";

/**
 * ============================================================================
 *  LAS DOS SALIDAS DEL CIRCUITO: FRENAR Y ANULAR. Las dos piden un motivo.
 * ============================================================================
 *
 *  POR QUE ESTAN, y por qué juntas: son los dos únicos caminos por los que un trámite deja de
 *  avanzar, y hasta hoy NINGUNO tenía pantalla. La base los soportaba —los estados existen y
 *  exigen su motivo— pero desde la app no había forma de llegar. Un trámite cargado por error
 *  se quedaba ahí para siempre, y uno frenado por falta de plata no se podía marcar como tal.
 *
 *  ============================================================================
 *   EL MOTIVO NO ES OPCIONAL, Y NO LO DECIDE ESTA PANTALLA
 *  ============================================================================
 *
 *  Lo exige la base con un `check`: un trámite anulado sin motivo no se puede guardar, y uno
 *  frenado tampoco. Acá el campo se pide y el botón se deshabilita, pero eso es cortesía — si
 *  alguien lo saltea, la base lo frena igual.
 *
 *  Es la diferencia entre pedirlo por favor y volverlo imposible, que es la pregunta de diseño
 *  de todo este proyecto.
 *
 *  ============================================================================
 *   POR QUE ANULAR NO ES BORRAR, Y ESTA ESCRITO EN LA PANTALLA
 *  ============================================================================
 *
 *  El trámite anulado SIGUE EN EL LISTADO, con su chip y su historial completo. Es la regla
 *  dura del proyecto: nada se borra. Si alguien busca el cliente dentro de seis meses, tiene
 *  que encontrar el trámite Y por qué no salió — que es justamente el dato que hoy se pierde
 *  cuando algo se resuelve por teléfono.
 *
 *  Y un trámite YA DEVUELTO no se anula: la base lo rechaza y dice que se corrija con un
 *  ajuste. Anular algo que ya terminó reescribiría una historia que ya pasó.
 */
export function Salidas({
  estado, alFrenar, alAnular, frenando, anulando,
}: {
  estado: string;
  alFrenar: (motivo: string) => void;
  alAnular: (motivo: string) => void;
  frenando: boolean;
  anulando: boolean;
}) {
  const [abierto, setAbierto] = useState<"frenar" | "anular" | null>(null);
  const [motivo, setMotivo] = useState("");

  // La base decide de verdad; esto sólo evita mostrar un botón que va a fallar.
  const sePuedeFrenar = estado === "presupuestado";
  const sePuedeAnular = estado !== "devuelto" && estado !== "anulado";

  if (!sePuedeFrenar && !sePuedeAnular) return null;

  function cerrar(): void {
    setAbierto(null);
    setMotivo("");
  }

  return (
    <Panel className="flex flex-col gap-2">
      <h2 className="text-lg">Si el trámite no sigue</h2>

      {abierto === null ? (
        <>
          <p className="text-xs text-ink2">
            Las dos opciones piden un motivo escrito, y el trámite queda en el listado con su
            historial completo. Acá nada se borra: si dentro de seis meses alguien busca este
            cliente, tiene que encontrar el trámite y por qué no salió.
          </p>
          <div className="flex flex-wrap gap-2">
            {sePuedeFrenar && (
              <button type="button" onClick={() => setAbierto("frenar")} className={BOTON_SUAVE}>
                <PauseCircle aria-hidden="true" size={14} />
                Frenar por falta de saldo
              </button>
            )}
            {sePuedeAnular && (
              <button type="button" onClick={() => setAbierto("anular")} className={BOTON_SUAVE}>
                <Ban aria-hidden="true" size={14} />
                Anular el trámite
              </button>
            )}
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-sm">
            {abierto === "frenar"
              ? "¿Por qué se frena? Va a aparecer en la bandeja de pedidos, en el bloque de frenados, hasta que entre plata."
              : "¿Por qué se anula? Queda escrito en el trámite y en el historial, para siempre."}
          </p>
          <label className="flex flex-col gap-1">
            <span className="sr-only">Motivo</span>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={2}
              placeholder={
                abierto === "frenar"
                  ? "Ej: no alcanza el saldo de Paris Autos hasta que acredite el depósito"
                  : "Ej: el cliente desistió de la compra"
              }
              className={CAMPO}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={motivo.trim() === "" || frenando || anulando}
              onClick={() => {
                if (abierto === "frenar") alFrenar(motivo);
                else alAnular(motivo);
                cerrar();
              }}
              className={BOTON_SUAVE}
            >
              {abierto === "frenar" ? "Frenar" : "Anular"}
            </button>
            <button type="button" onClick={cerrar} className={BOTON_SUAVE}>
              Volver
            </button>
          </div>
        </div>
      )}
    </Panel>
  );
}
