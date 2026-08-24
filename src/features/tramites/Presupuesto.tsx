import { useState } from "react";
import { Plus } from "lucide-react";
import { Panel } from "../../components/Panel";
import { aCentavos, aPesos, formatear, parsear } from "../../lib/plata";
import { ACCION_CHICA, CAMPO_SUELTO } from "../../lib/campos";

/**
 * ============================================================================
 *  EL PRESUPUESTO ES LA SUMA DE SUS CONCEPTOS. NO HAY UN SEGUNDO NUMERO.
 * ============================================================================
 *
 *  Antes esta pantalla mostraba dos totales: la "Suma" de las líneas y, aparte, un "Depósito que
 *  se solicita" que se escribía a mano — y era ése el que se descontaba de la tarjeta. Había
 *  hasta una fila llamada "Diferencia con el depósito pedido" para explicar por qué no
 *  coincidían.
 *
 *  Una fila que existe para explicar una incoherencia es la señal de que la incoherencia no
 *  debería existir. Medido en los datos reales el 21/08/2026: un trámite tenía $6.128.000 en
 *  líneas y CERO reservado, y otro pedía $655.000 con líneas por $450.000.
 *
 *  Ahora hay un solo número, y es el total. Lo que se reserva de la tarjeta es exactamente eso,
 *  y lo mantiene un trigger: apenas se agrega, se corrige o se quita una línea, la reserva se
 *  ajusta sola y el movimiento aparece en el extracto. Si hace falta pedir de más —el arancel
 *  real recién se sabe en la ventanilla— se carga como un concepto más, con su nombre.
 *
 *  ============================================================================
 *   UNA LINEA QUITADA SE VE TACHADA, NO DESAPARECE
 *  ============================================================================
 *
 *  Acá nada se borra. Y en este caso importa más que en otros: cuando el trámite vuelve del
 *  registro y el número no cierra, la pregunta es qué se sacó y por qué. Una línea que
 *  desaparece no deja con qué contestarla.
 */

export interface Linea {
  id: number;
  concepto_id: string;
  importe: number;
  anulada: boolean;
  motivo_anulacion: string | null;
}

export function Presupuesto({
  titulo, ayuda, rotuloTotal, lineas, conceptos, editable,
  alAgregar, alCorregir, alQuitar, guardando,
}: {
  titulo: string;
  ayuda: string;
  rotuloTotal: string;
  lineas: Linea[];
  conceptos: { id: string; nombre: string }[];
  editable: boolean;
  alAgregar: (conceptoId: string, importe: number) => void;
  alCorregir: (id: number, importe: number) => void;
  alQuitar: (id: number, motivo: string) => void;
  guardando: boolean;
}) {
  const [conceptoId, setConceptoId] = useState("");
  const [importe, setImporte] = useState("");
  const [corrigiendo, setCorrigiendo] = useState<number | null>(null);
  const [nuevoImporte, setNuevoImporte] = useState("");
  const [quitando, setQuitando] = useState<number | null>(null);
  const [motivo, setMotivo] = useState("");

  const nombre = (id: string): string => conceptos.find((c) => c.id === id)?.nombre ?? "";
  const vivas = lineas.filter((l) => !l.anulada);
  const suma = vivas.reduce((s, l) => s + l.importe, 0);

  // Los conceptos que todavía no están en el presupuesto. Ofrecer uno que ya está sólo lleva a
  // un rechazo por el índice único, y un rechazo enseña a desconfiar de la pantalla.
  const yaPuestos = new Set(vivas.map((l) => l.concepto_id));
  const disponibles = conceptos.filter((c) => !yaPuestos.has(c.id));

  return (
    <Panel className="flex flex-col gap-3">
      <div>
        <h2 className="text-lg">{titulo}</h2>
        <p className="text-2xs text-ink2">{ayuda}</p>
      </div>

      {lineas.length > 0 ? (
        <div className="flex flex-col gap-1 text-sm">
          {lineas.map((l) => (
            <div key={l.id} className="border-b border-line py-1">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className={l.anulada ? "text-ink2 line-through" : ""}>
                  {nombre(l.concepto_id)}
                </span>
                <span className="flex items-baseline gap-3">
                  <span className={`tnum ${l.anulada ? "text-ink2 line-through" : ""}`}>
                    {formatear(aCentavos(l.importe))}
                  </span>
                  {editable && !l.anulada && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setCorrigiendo(l.id);
                          setNuevoImporte(String(l.importe));
                          setQuitando(null);
                        }}
                        className={ACCION_CHICA}
                      >
                        Corregir
                      </button>
                      <button
                        type="button"
                        onClick={() => { setQuitando(l.id); setMotivo(""); setCorrigiendo(null); }}
                        className={ACCION_CHICA}
                      >
                        Quitar
                      </button>
                    </>
                  )}
                </span>
              </div>

              {l.anulada && l.motivo_anulacion !== null && (
                <p className="text-2xs text-ink2">Quitada: {l.motivo_anulacion}</p>
              )}

              {corrigiendo === l.id && (
                <div className="mt-2 flex flex-wrap items-end gap-2">
                  <input
                    inputMode="decimal"
                    value={nuevoImporte}
                    onChange={(e) => setNuevoImporte(e.target.value)}
                    className={`w-36 ${CAMPO_SUELTO} tnum`}
                  />
                  <button
                    type="button"
                    disabled={parsear(nuevoImporte) === null || guardando}
                    onClick={() => {
                      const c = parsear(nuevoImporte);
                      if (c === null) return;
                      alCorregir(l.id, aPesos(c));
                      setCorrigiendo(null);
                    }}
                    className="min-h-11 rounded-md border border-line px-3 py-2 text-sm disabled:opacity-50"
                  >
                    Guardar el importe
                  </button>
                  <button type="button" onClick={() => setCorrigiendo(null)} className="text-sm text-ink2">
                    Cancelar
                  </button>
                </div>
              )}

              {quitando === l.id && (
                <div className="mt-2 flex flex-wrap items-end gap-2">
                  <input
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    placeholder="Por qué se quita"
                    className={`min-w-48 flex-1 ${CAMPO_SUELTO}`}
                  />
                  <button
                    type="button"
                    disabled={motivo.trim() === "" || guardando}
                    onClick={() => { alQuitar(l.id, motivo.trim()); setQuitando(null); }}
                    className="min-h-11 rounded-md border border-line px-3 py-2 text-sm disabled:opacity-50"
                  >
                    Quitar la línea
                  </button>
                  <button type="button" onClick={() => setQuitando(null)} className="text-sm text-ink2">
                    Cancelar
                  </button>
                </div>
              )}
            </div>
          ))}

          <div className="flex justify-between py-1 text-base">
            <span>{rotuloTotal}</span>
            <span className="tnum">{formatear(aCentavos(suma))}</span>
          </div>
        </div>
      ) : (
        <p className="text-sm text-ink2">Todavía no hay conceptos cargados.</p>
      )}

      {editable && (
        <div className="flex flex-wrap items-end gap-2">
          <select
            value={conceptoId}
            onChange={(e) => setConceptoId(e.target.value)}
            className={CAMPO_SUELTO}
          >
            <option value="">Concepto</option>
            {disponibles.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
          <input
            inputMode="decimal"
            value={importe}
            onChange={(e) => setImporte(e.target.value)}
            placeholder="450.000"
            className={`w-32 ${CAMPO_SUELTO} tnum`}
          />
          <button
            type="button"
            disabled={conceptoId === "" || parsear(importe) === null || guardando}
            onClick={() => {
              const c = parsear(importe);
              if (c === null) return;
              alAgregar(conceptoId, aPesos(c));
              setImporte("");
              setConceptoId("");
            }}
            className="flex min-h-11 items-center gap-1 rounded-md border border-line px-3 py-2 text-sm disabled:opacity-50"
          >
            <Plus aria-hidden="true" size={14} /> Agregar
          </button>
        </div>
      )}
    </Panel>
  );
}
