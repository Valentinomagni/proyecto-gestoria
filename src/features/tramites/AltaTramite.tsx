import { useState, type FormEvent } from "react";
import { FilePlus } from "lucide-react";
import { Panel } from "../../components/Panel";
import { parsearAsunto } from "../../lib/asunto";
import { supabase } from "../../lib/supabase";
import { useGuardar, useRazonesSociales, useSucursales } from "../../lib/datos";

/**
 * Alta de un tramite.
 *
 * ============================================================================
 *  MENOS DE VEINTE SEGUNDOS Y CINCO CAMPOS OBLIGATORIOS. Es un requisito duro.
 * ============================================================================
 *
 *  Si tarda mas que escribir a mano, el cuaderno vuelve. Por eso el formulario arranca con UN
 *  campo grande donde se pega el asunto del mail, y el resto se completa solo con lo que se
 *  pudo reconocer.
 *
 *  EL ALTA ES LA AUTORIZACION. No hay boton de aprobar: el pedido dice que si el nombre del
 *  cliente esta ingresado a la plataforma, eso ya es sinonimo de autorizacion. La base estampa
 *  quien y cuando.
 *
 *  LA GESTORA NO SE ELIGE ACA. Se asigna cuando el tramite se le entrega, que es un paso
 *  posterior del circuito. Pedirla ahora obligaria a inventar un dato.
 */
export function AltaTramite({ alGuardar }: { alGuardar: () => void }) {
  const razones = useRazonesSociales();
  const sucursales = useSucursales();

  const [asunto, setAsunto] = useState("");
  const [cliente, setCliente] = useState("");
  const [cuenta, setCuenta] = useState("");
  const [vehiculo, setVehiculo] = useState("");
  const [referencia, setReferencia] = useState("");
  const [dominio, setDominio] = useState("");
  const [tipo, setTipo] = useState("");
  const [subtipo, setSubtipo] = useState("");
  const [razonId, setRazonId] = useState("");
  const [sucursalId, setSucursalId] = useState("");
  const [medioPago, setMedioPago] = useState("tarjeta_habitualista");
  const [canal, setCanal] = useState("presencial");
  const [observaciones, setObservaciones] = useState("");

  /** Lo que reconoce se carga en los campos de abajo, editable. Lo que no, queda vacio. */
  function pegar(texto: string): void {
    setAsunto(texto);
    const r = parsearAsunto(texto);
    if (r.cliente) setCliente(r.cliente);
    if (r.cuenta) setCuenta(r.cuenta);
    if (r.referencia) setReferencia(r.referencia);
    if (r.tipo) setTipo(r.tipo);
    if (r.subtipo) setSubtipo(r.subtipo);
  }

  const guardar = useGuardar(
    async () => {
      const { error } = await supabase.from("tramites").insert({
        razon_social_id: razonId,
        sucursal_id: sucursalId,
        tipo,
        subtipo: subtipo === "" ? null : subtipo,
        canal,
        medio_pago: medioPago,
        cliente_nombre: cliente.trim(),
        cliente_cuenta: cuenta.trim() === "" ? null : cuenta.trim(),
        vehiculo: vehiculo.trim() === "" ? null : vehiculo.trim(),
        oferta_referencia: referencia.trim() === "" ? null : referencia.trim(),
        asunto_mail: asunto.trim() === "" ? null : asunto,
        dominio: dominio.trim() === "" ? null : dominio.trim().toUpperCase(),
        observaciones: observaciones.trim() === "" ? null : observaciones.trim(),
      });
      if (error) throw error;
    },
    { exito: "Trámite cargado", invalidar: ["tramites", "saldos"] },
  );

  function enviar(e: FormEvent): void {
    e.preventDefault();
    guardar.mutate(undefined, { onSuccess: alGuardar });
  }

  const listo = cliente.trim() !== "" && tipo !== "" && razonId !== "" && sucursalId !== "";

  return (
    <form onSubmit={enviar} className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
      <h1 className="text-xl">Cargar un trámite</h1>

      <Panel>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-ink2">
            Pegá acá el asunto del mail. Lo que se reconozca se completa solo abajo.
          </span>
          <textarea
            value={asunto}
            onChange={(e) => pegar(e.target.value)}
            rows={2}
            className="rounded-md border border-line bg-surface2 px-3 py-2 text-sm"
            placeholder="PATENTAMIENTO PLAN DE AHORRO- C.74344 MUÑOZ ELIZABETH (REF. 4097473)"
          />
        </label>
      </Panel>

      <Panel className="flex flex-col gap-3">
        <Campo etiqueta="Cliente" obligatorio>
          <input value={cliente} onChange={(e) => setCliente(e.target.value)} required className={CLASE_INPUT} />
        </Campo>

        <div className="grid gap-3 sm:grid-cols-2">
          <Campo etiqueta="Referencia de la oferta" ayuda="Con esto se ubica el trámite después">
            <input value={referencia} onChange={(e) => setReferencia(e.target.value)} className={CLASE_INPUT} />
          </Campo>
          <Campo etiqueta="Cuenta personal">
            <input value={cuenta} onChange={(e) => setCuenta(e.target.value)} className={CLASE_INPUT} />
          </Campo>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Campo etiqueta="Vehículo">
            <input value={vehiculo} onChange={(e) => setVehiculo(e.target.value)} className={CLASE_INPUT} />
          </Campo>
          <Campo etiqueta="Dominio" ayuda="Un 0km entra sin patente">
            <input value={dominio} onChange={(e) => setDominio(e.target.value)} className={CLASE_INPUT} />
          </Campo>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Campo etiqueta="Tipo" obligatorio>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)} required className={CLASE_INPUT}>
              <option value="">Elegí</option>
              <option value="patentamiento_0km">Patentamiento 0km</option>
              <option value="transferencia_a_cliente">Transferencia a cliente</option>
              <option value="transferencia_al_concesionario">Transferencia al concesionario</option>
            </select>
          </Campo>
          <Campo etiqueta="Modalidad">
            <select value={subtipo} onChange={(e) => setSubtipo(e.target.value)} className={CLASE_INPUT}>
              <option value="">Sin especificar</option>
              <option value="plan_ahorro">Plan de ahorro</option>
              <option value="credito">Crédito</option>
              <option value="contado">Contado</option>
            </select>
          </Campo>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Campo etiqueta="Razón social" obligatorio>
            <select value={razonId} onChange={(e) => setRazonId(e.target.value)} required className={CLASE_INPUT}>
              <option value="">Elegí</option>
              {razones.data?.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
            </select>
          </Campo>
          <Campo etiqueta="Sucursal" obligatorio>
            <select value={sucursalId} onChange={(e) => setSucursalId(e.target.value)} required className={CLASE_INPUT}>
              <option value="">Elegí</option>
              {sucursales.data?.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          </Campo>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Campo etiqueta="Medio de pago" obligatorio>
            <select value={medioPago} onChange={(e) => setMedioPago(e.target.value)} className={CLASE_INPUT}>
              <option value="tarjeta_habitualista">Tarjeta Habitualista</option>
              <option value="transferencia">Transferencia</option>
              <option value="efectivo">Efectivo</option>
            </select>
          </Campo>
          <Campo etiqueta="Canal" ayuda="RUNA lo maneja administración">
            <select value={canal} onChange={(e) => setCanal(e.target.value)} className={CLASE_INPUT}>
              <option value="presencial">Presencial</option>
              <option value="runa">RUNA</option>
            </select>
          </Campo>
        </div>

        <Campo etiqueta="Observaciones">
          <textarea
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            rows={2}
            className={CLASE_INPUT}
          />
        </Campo>
      </Panel>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={!listo || guardar.isPending}
          className="flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm text-accent-ink disabled:opacity-50"
        >
          <FilePlus aria-hidden="true" size={16} />
          {guardar.isPending ? "Guardando" : "Cargar trámite"}
        </button>
        <p className="text-2xs text-ink2">
          Cargarlo acá ya vale como autorización. La gestora se asigna al entregarlo.
        </p>
      </div>
    </form>
  );
}

const CLASE_INPUT = "w-full rounded-md border border-line bg-surface2 px-3 py-2 text-sm";

function Campo({
  etiqueta, ayuda, obligatorio = false, children,
}: {
  etiqueta: string; ayuda?: string; obligatorio?: boolean; children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-ink2">
        {etiqueta}
        {obligatorio ? " *" : ""}
        {ayuda ? <span className="text-2xs"> — {ayuda}</span> : null}
      </span>
      {children}
    </label>
  );
}
