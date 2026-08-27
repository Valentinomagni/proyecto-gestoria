import { useState } from "react";
import { Ban } from "lucide-react";
import { Panel } from "../../components/Panel";
import { BOTON_SUAVE, CAMPO } from "../../lib/campos";

/**
 * ============================================================================
 *  LA SALIDA DEL CIRCUITO: ANULAR. Pide un motivo.
 * ============================================================================
 *
 *  POR QUE ESTA: es el único camino por el que un trámite deja de avanzar, y hasta hace poco no
 *  tenía pantalla. La base lo soportaba —el estado existe y exige su motivo— pero desde la app no
 *  había forma de llegar, y un trámite cargado por error se quedaba ahí para siempre.
 *
 *  ============================================================================
 *   ANTES ERAN DOS SALIDAS, Y FRENAR DEJO DE SER UNA
 *  ============================================================================
 *
 *  `frenado_por_saldo` era un estado que alguien tenía que marcar Y DESMARCAR a mano. El
 *  desmarcado es el que se olvidaba: entraba la plata y el trámite seguía figurando frenado, así
 *  que la pantalla decía que estaba detenido algo que ya podía salir.
 *
 *  Esperar plata no es una propiedad del trámite: es una comparación entre lo que el trámite pide
 *  y lo que la tarjeta tiene. Y las comparaciones se calculan, no se marcan. Ahora vive en la
 *  vista `v_esperando_plata`, que se actualiza sola cuando entra un depósito.
 *
 *  Esta pantalla perdió un botón y el sistema ganó un dato que nadie puede olvidarse de apagar.
 *
 *  ============================================================================
 *   EL MOTIVO NO ES OPCIONAL, Y NO LO DECIDE ESTA PANTALLA
 *  ============================================================================
 *
 *  Lo exige la base con un `check`: un trámite anulado sin motivo no se puede guardar. Acá el
 *  campo se pide y el botón se deshabilita, pero eso es cortesía — si alguien lo saltea, la base
 *  lo frena igual.
 *
 *  Es la diferencia entre pedirlo por favor y volverlo imposible, que es la pregunta de diseño de
 *  todo este proyecto.
 *
 *  ============================================================================
 *   POR QUE ANULAR NO ES BORRAR, Y ESTA ESCRITO EN LA PANTALLA
 *  ============================================================================
 *
 *  El trámite anulado SIGUE EN EL LISTADO, con su chip y su historial completo. Es la regla dura
 *  del proyecto: nada se borra. Si alguien busca el cliente dentro de seis meses, tiene que
 *  encontrar el trámite Y por qué no salió — que es justamente el dato que hoy se pierde cuando
 *  algo se resuelve por teléfono.
 *
 *  Y un trámite YA DEVUELTO no se anula: la base lo rechaza y dice que se corrija con un ajuste.
 *  Anular algo que ya terminó reescribiría una historia que ya pasó.
 */
export function Salidas({
  estado, alAnular, anulando,
}: {
  estado: string;
  alAnular: (motivo: string) => void;
  anulando: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");

  // La base decide de verdad; esto sólo evita mostrar un botón que va a fallar.
  const sePuedeAnular = estado !== "devuelto" && estado !== "anulado";
  if (!sePuedeAnular) return null;

  function cerrar(): void {
    setAbierto(false);
    setMotivo("");
  }

  return (
    <Panel className="flex flex-col gap-2">
      <h2 className="text-lg">Si el trámite no sigue</h2>

      {!abierto ? (
        <>
          <p className="text-xs text-ink2">
            Anular pide un motivo escrito, y el trámite queda en el listado con su historial
            completo. Acá nada se borra: si dentro de seis meses alguien busca este cliente, tiene
            que encontrar el trámite y por qué no salió.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setAbierto(true)} className={BOTON_SUAVE}>
              <Ban aria-hidden="true" size={14} />
              Anular el trámite
            </button>
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-sm">
            ¿Por qué se anula? Queda escrito en el trámite y en el historial, para siempre.
          </p>
          <label className="flex flex-col gap-1">
            <span className="sr-only">Motivo</span>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={2}
              placeholder="Ej: el cliente desistió de la compra"
              className={CAMPO}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={motivo.trim() === "" || anulando}
              onClick={() => {
                alAnular(motivo);
                cerrar();
              }}
              className={BOTON_SUAVE}
            >
              Anular
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
