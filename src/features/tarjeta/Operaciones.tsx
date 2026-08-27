import { useState } from "react";
import { Panel } from "../../components/Panel";
import { SkeletonLineas } from "../../components/Skeleton";
import { aCentavos, formatear } from "../../lib/plata";
import { formatearFechaHora, hoyArgentina } from "../../lib/fechas";
import { ACCION_CHICA, BOTON_SUAVE, CAMPO_SUELTO } from "../../lib/campos";

/**
 * ============================================================================
 *  EL EXTRACTO DE LA TARJETA
 * ============================================================================
 *
 *  CALCA LA FORMA DEL SITIO que ya usan: arriba las cifras, abajo el listado de operaciones. No
 *  es estética, es la forma mental con la que ya trabajan.
 *
 *  ============================================================================
 *   POR QUE LA FILA DICE EL NOMBRE DEL CLIENTE
 *  ============================================================================
 *
 *  El pedido era que al cargar un presupuesto apareciera acá el descuento. Aparecía — pero decía
 *  "reserva", que es una palabra del sistema. Quien mira esta pantalla busca el apellido, y una
 *  fila que no lo trae obliga a abrir el trámite para saber de qué habla.
 *
 *  ============================================================================
 *   UN MOVIMIENTO ANULADO NO DESAPARECE: SE TACHA
 *  ============================================================================
 *
 *  Es la diferencia entre corregir y esconder. La fila queda, gris y tachada, con su motivo, y
 *  abajo la compensación que la neutraliza. El saldo cierra igual que si se hubiera borrado, y
 *  además queda escrito qué pasó — que es lo que hace falta cuando alguien pregunta por qué el
 *  saldo de ayer no es el que recordaba.
 */

export interface Movimiento {
  id: number;
  fecha: string;
  fecha_acreditacion: string;
  tipo: string;
  importe: number;
  concepto: string | null;
  observacion: string | null;
  corrige_movimiento_id: number | null;
  cliente: string | null;
  anulado: boolean;
}

/**
 * Los movimientos que cargó una persona a mano. Son los únicos que se pueden anular desde acá.
 *
 * Una `reserva`, un `pago` o un `ajuste_reserva` los escribió un trigger a partir del
 * presupuesto de un trámite: anularlos desde la cuenta dejaría el trámite diciendo una cosa y la
 * tarjeta otra. Esos se corrigen corrigiendo el presupuesto. La base lo impide igual; acá se
 * deja de ofrecer para que el rechazo no llegue como una sorpresa.
 */
const A_MANO = new Set(["ingreso", "saldo_inicial", "ajuste"]);

export function Operaciones({
  movimientos, cargando, puedeAnular, alAnular, anulando,
}: {
  movimientos: Movimiento[];
  cargando: boolean;
  puedeAnular: boolean;
  alAnular: (id: number, motivo: string) => void;
  anulando: boolean;
}) {
  const [anulandoId, setAnulandoId] = useState<number | null>(null);
  const [motivo, setMotivo] = useState("");

  if (cargando) return <Panel><SkeletonLineas cantidad={4} /></Panel>;

  return (
    <Panel>
      <h2 className="text-lg mb-3">Operaciones</h2>

      {movimientos.length === 0 ? (
        <p className="text-sm text-ink2">Todavía no hay movimientos en esta tarjeta.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-2xs text-ink2">
              <tr className="border-b border-line">
                <th className="py-2 text-left font-normal">Fecha</th>
                <th className="py-2 text-left font-normal">Concepto</th>
                <th className="py-2 text-right font-normal">Importe</th>
                <th className="py-2 text-left font-normal">Estado</th>
                {puedeAnular && <th className="py-2 text-right font-normal"> </th>}
              </tr>
            </thead>
            <tbody>
              {movimientos.map((m) => (
                <tr key={m.id} className={`border-b border-line ${m.anulado ? "text-ink2" : ""}`}>
                  <td className="py-2 tnum text-ink2">{formatearFechaHora(m.fecha)}</td>
                  <td className={m.anulado ? "py-2 line-through" : "py-2"}>
                    {describir(m)}
                    {m.observacion !== null && m.observacion !== "" && (
                      <span className="block text-2xs text-ink2">{m.observacion}</span>
                    )}
                  </td>
                  <td
                    className={`py-2 text-right tnum ${
                      m.anulado ? "line-through" : m.importe < 0 ? "" : "text-done"
                    }`}
                  >
                    {formatear(aCentavos(m.importe))}
                  </td>
                  <td className="py-2 text-2xs text-ink2">
                    {m.anulado
                      ? "anulado"
                      : m.fecha_acreditacion > hoyArgentina()
                        ? "en tránsito"
                        : ""}
                  </td>
                  {puedeAnular && (
                    <td className="py-2 text-right">
                      {A_MANO.has(m.tipo) && !m.anulado && m.corrige_movimiento_id === null && (
                        <button
                          type="button"
                          onClick={() => { setAnulandoId(m.id); setMotivo(""); }}
                          className={ACCION_CHICA}
                        >
                          Anular
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/*
        EL MOTIVO SE PIDE ANTES, no después. La base lo exige igual, pero si se pidiera después de
        apretar Anular el error llegaría como un rechazo — y un rechazo enseña a desconfiar de la
        pantalla. Pedirlo antes lo convierte en parte de la tarea.
      */}
      {anulandoId !== null && (
        <div className="mt-3 flex flex-col gap-2 border-t border-line pt-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-ink2">
              Por qué se anula — queda escrito al lado del movimiento
            </span>
            <input
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Se cargó con un cero de más"
              className={CAMPO_SUELTO}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={motivo.trim() === "" || anulando}
              onClick={() => { alAnular(anulandoId, motivo.trim()); setAnulandoId(null); }}
              className={BOTON_SUAVE}
            >
              {anulando ? "Anulando" : "Anular el movimiento"}
            </button>
            <button
              type="button"
              onClick={() => setAnulandoId(null)}
              className="text-sm text-ink2"
            >
              Dejarlo como está
            </button>
          </div>
          <p className="text-2xs text-ink2">
            No se borra: queda tachado con su motivo, y abajo el ajuste que lo compensa. El saldo
            vuelve a cerrar y se puede explicar qué pasó.
          </p>
        </div>
      )}
    </Panel>
  );
}

/**
 * Cómo se llama cada movimiento que nace de un trámite.
 *
 * ============================================================================
 *  POR QUE NO SE USA LA COLUMNA `concepto` PARA ESTOS
 * ============================================================================
 *
 * Se probó, y se vio mal en pantalla: el trigger de la base ya escribe el nombre del cliente
 * adentro de `concepto` —"Presupuesto - MARTORINA"—, así que agregarle el apellido al lado daba
 * "Presupuesto - MARTORINA — MARTORINA". Además ese texto lo escribió una migración sin acentos,
 * y "Correccion" se lee en la pantalla que mira la dueña de la empresa.
 *
 * Cómo se LEE un movimiento es una decisión de esta pantalla, no de la base. Cambiar una
 * etiqueta acá no necesita una migración, y el texto que quedó guardado en la base sigue siendo
 * el rastro de qué la escribió.
 */
const NOMBRE_DEL_TIPO: Record<string, string> = {
  reserva: "Presupuesto",
  ajuste_reserva: "Corrección del presupuesto",
  reversa_reserva: "Se libera la reserva",
  pago: "Pago en el registro",
};

/** Qué dice la fila. El apellido al lado, porque es con lo que se busca. */
function describir(m: Movimiento): string {
  if (m.cliente !== null) return `${NOMBRE_DEL_TIPO[m.tipo] ?? m.concepto ?? m.tipo} — ${m.cliente}`;
  return m.concepto ?? m.tipo;
}
