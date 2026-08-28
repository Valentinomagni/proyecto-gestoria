import { type FormEvent } from "react";
import { FilePlus } from "lucide-react";
import { Panel } from "../../components/Panel";
import { parsearAsunto } from "../../lib/asunto";
import { supabase } from "../../lib/supabase";
import { BOTON, CAMPO } from "../../lib/campos";
import { useBorrador } from "../../lib/borrador";
import { useAdministrativos, useGestoras, useGuardar, useSucursales } from "../../lib/datos";

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
 *  ============================================================================
 *   TODO LO QUE SE ESCRIBE ACA SOBREVIVE A CAMBIAR DE PANTALLA
 *  ============================================================================
 *
 *  Antes cada campo era un `useState` suelto, asi que al navegar React desmontaba el formulario
 *  y se lo llevaba puesto. Dicho por quien lo sufrio: "si necesito chequear una informacion,
 *  tengo que volver a cargar todo".
 *
 *  Eso castiga justo la conducta correcta —ir a verificar un dato antes de guardarlo— y se come
 *  entero el presupuesto de veinte segundos. Ahora es UN objeto en un borrador que ademas
 *  sobrevive a recargar la pagina.
 */

/** Todo lo que se esta escribiendo en el alta, junto. Un objeto, un borrador. */
interface Alta {
  asunto: string;
  cliente: string;
  cuenta: string;
  vehiculo: string;
  referencia: string;
  dominio: string;
  tipo: string;
  subtipo: string;
  sucursalId: string;
  gestoraId: string;
  administrativo: string;
  medioPago: string;
  canal: string;
  observaciones: string;
}

const VACIO: Alta = {
  asunto: "",
  cliente: "",
  cuenta: "",
  vehiculo: "",
  referencia: "",
  dominio: "",
  tipo: "",
  subtipo: "",
  sucursalId: "",
  gestoraId: "",
  administrativo: "",
  medioPago: "tarjeta_habitualista",
  canal: "presencial",
  observaciones: "",
};

/**
 * ============================================================================
 *  LA RAZON SOCIAL LLEGA POR PROP, NO SE PREGUNTA
 * ============================================================================
 *
 * El alta vive adentro de la empresa: la pantalla ya sabe de cual se trata. EL CAMPO QUE NO
 * EXISTE NO SE PUEDE LLENAR MAL, y elegir la razon social equivocada mete el tramite en la
 * empresa de al lado — donde nadie lo busca.
 *
 * En la base el campo SIGUE siendo obligatorio y sigue viajando en el insert: lo que cambia es
 * quien lo contesta.
 */
export function AltaTramite({
  razonSocialId,
  alGuardar,
}: {
  razonSocialId: string;
  alGuardar: () => void;
}) {
  const sucursales = useSucursales();
  const gestoras = useGestoras();
  const administrativos = useAdministrativos();

  const [f, setF, descartar] = useBorrador<Alta>("alta", VACIO);
  const cambiar = (parte: Partial<Alta>): void => setF({ ...f, ...parte });

  /**
   * Lo que reconoce se carga en los campos de abajo, editable. Lo que no, LOS VACIA.
   *
   * ============================================================================
   *  POR QUE VACIA Y NO DEJA LO ANTERIOR. Esto se descubrio mirando, no testeando.
   * ============================================================================
   *
   *  La primera version escribia cada campo solo si el parseo habia reconocido algo, que parece
   *  lo prudente y es exactamente lo contrario.
   *
   *  Lo que pasaba en pantalla: se pegaba un asunto, se veia que era el equivocado, se pegaba
   *  el correcto — y los campos que el segundo asunto NO traia se quedaban con los datos del
   *  PRIMERO. En modalidad eso es cosmetico. En cliente o en referencia de oferta es un tramite
   *  con el nombre de otra persona, cargado con toda confianza porque el formulario se completo
   *  solo.
   *
   *  Estos cinco campos son un reflejo del asunto y de nada mas. Lo que se corrija a mano
   *  DESPUES sobrevive, porque solo se recalculan cuando se toca el asunto.
   */
  function pegar(texto: string): void {
    const r = parsearAsunto(texto);
    cambiar({
      asunto: texto,
      cliente: r.cliente ?? "",
      cuenta: r.cuenta ?? "",
      referencia: r.referencia ?? "",
      tipo: r.tipo ?? "",
      // El parser ya devuelve null si el tipo no es patentamiento; esto lo deja explicito.
      subtipo: r.tipo === "patentamiento_0km" ? (r.subtipo ?? "") : "",
    });
  }

  /** Cambiar de tipo puede dejar una modalidad que ya no aplica. Se limpia en el mismo paso. */
  function elegirTipo(nuevo: string): void {
    cambiar({ tipo: nuevo, ...(nuevo !== "patentamiento_0km" && { subtipo: "" }) });
  }

  const guardar = useGuardar(
    async () => {
      const { error } = await supabase.from("tramites").insert({
        razon_social_id: razonSocialId,
        sucursal_id: f.sucursalId,
        tipo: f.tipo,
        subtipo: f.subtipo === "" ? null : f.subtipo,
        canal: f.canal,
        medio_pago: f.medioPago,
        cliente_nombre: f.cliente.trim(),
        cliente_cuenta: f.cuenta.trim() === "" ? null : f.cuenta.trim(),
        vehiculo: f.vehiculo.trim() === "" ? null : f.vehiculo.trim(),
        oferta_referencia: f.referencia.trim() === "" ? null : f.referencia.trim(),
        asunto_mail: f.asunto.trim() === "" ? null : f.asunto,
        dominio: f.dominio.trim() === "" ? null : f.dominio.trim().toUpperCase(),
        observaciones: f.observaciones.trim() === "" ? null : f.observaciones.trim(),
        // Si se asigna acá, la gestora VE el trámite desde este mismo momento. Si se deja
        // vacío se asigna al entregarlo, como antes.
        gestora_id: f.gestoraId === "" ? null : f.gestoraId,
        administrativo: f.administrativo.trim() === "" ? null : f.administrativo.trim(),
      });
      if (error) throw error;
      // El borrador se descarta SOLO si guardó: uno que sobrevive reaparece en el trámite
      // siguiente con los datos del anterior, y se ve como un formulario legítimamente lleno.
      descartar();
    },
    { exito: "Trámite cargado", invalidar: ["tramites", "saldos", "administrativos"] },
  );

  function enviar(e: FormEvent): void {
    e.preventDefault();
    guardar.mutate(undefined, { onSuccess: alGuardar });
  }

  const listo = f.cliente.trim() !== "" && f.tipo !== "" && f.sucursalId !== "";

  return (
    <form onSubmit={enviar} className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
      <h1 className="text-xl">Cargar un trámite</h1>

      <Panel>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-ink2">
            Pegá acá el asunto del mail. Lo que se reconozca se completa solo abajo.
          </span>
          <textarea
            value={f.asunto}
            onChange={(e) => pegar(e.target.value)}
            rows={2}
            className={CAMPO}
            placeholder="PATENTAMIENTO PLAN DE AHORRO- C.74344 MUÑOZ ELIZABETH (REF. 4097473)"
          />
        </label>
      </Panel>

      <Panel className="flex flex-col gap-3">
        <Campo etiqueta="Cliente" obligatorio>
          <input
            value={f.cliente}
            onChange={(e) => cambiar({ cliente: e.target.value })}
            required
            className={CAMPO}
          />
        </Campo>

        <div className="grid gap-3 sm:grid-cols-2">
          <Campo etiqueta="Referencia de la oferta" ayuda="Con esto se ubica el trámite después">
            <input
              value={f.referencia}
              onChange={(e) => cambiar({ referencia: e.target.value })}
              className={CAMPO}
            />
          </Campo>
          <Campo etiqueta="Cuenta personal" ayuda="En el asunto viene entre paréntesis">
            <input
              value={f.cuenta}
              onChange={(e) => cambiar({ cuenta: e.target.value })}
              className={CAMPO}
            />
          </Campo>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Campo etiqueta="Vehículo">
            <input
              value={f.vehiculo}
              onChange={(e) => cambiar({ vehiculo: e.target.value })}
              className={CAMPO}
            />
          </Campo>
          <Campo etiqueta="Dominio" ayuda="Un 0km entra sin patente">
            <input
              value={f.dominio}
              onChange={(e) => cambiar({ dominio: e.target.value })}
              className={CAMPO}
            />
          </Campo>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Campo etiqueta="Tipo" obligatorio>
            <select
              value={f.tipo}
              onChange={(e) => elegirTipo(e.target.value)}
              required
              className={CAMPO}
            >
              <option value="">Elegí</option>
              <option value="patentamiento_0km">Patentamiento 0km</option>
              <option value="transferencia_a_cliente">Transferencia a cliente</option>
              <option value="transferencia_al_concesionario">Transferencia al concesionario</option>
            </select>
          </Campo>

          {/*
            LA MODALIDAD ES SOLO DE UN PATENTAMIENTO. Una transferencia no tiene modalidad, y
            mostrar el campo igual invita a llenar algo que no significa nada — que después sale
            en el Excel y alguien lo lee como si dijera algo. La base además lo impide con un
            check: esto sólo evita ofrecer algo que va a fallar.
          */}
          {f.tipo === "patentamiento_0km" && (
            <Campo etiqueta="Modalidad">
              <select
                value={f.subtipo}
                onChange={(e) => cambiar({ subtipo: e.target.value })}
                className={CAMPO}
              >
                <option value="">Sin especificar</option>
                <option value="plan_ahorro">Plan de ahorro</option>
                <option value="venta_directa">Venta directa 0km</option>
              </select>
            </Campo>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Campo etiqueta="Sucursal" obligatorio>
            <select
              value={f.sucursalId}
              onChange={(e) => cambiar({ sucursalId: e.target.value })}
              required
              className={CAMPO}
            >
              <option value="">Elegí</option>
              {sucursales.data?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </Campo>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {/*
            LA GESTORA SE PUEDE ELEGIR ACA, y es opcional. Si se elige, ella VE el trámite desde
            este momento; si se deja vacía, se asigna al entregarlo, como antes.

            Antes no se podía y esa era la razón por la que un trámite cargado por administración
            era invisible para gestoría hasta dos pasos después.
          */}
          <Campo etiqueta="Gestora" ayuda="Opcional. Si la elegís, lo ve desde ahora">
            <select
              value={f.gestoraId}
              onChange={(e) => cambiar({ gestoraId: e.target.value })}
              className={CAMPO}
            >
              <option value="">Todavía no se sabe</option>
              {gestoras.data
                ?.filter((g) => g.activa)
                .map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.nombre}
                  </option>
                ))}
            </select>
          </Campo>

          <Campo etiqueta="Administrativo a cargo" ayuda="A quién preguntarle por este legajo">
            {/*
              La lista de sugerencias sale de lo ya cargado. No obliga a nada —se puede escribir
              cualquier cosa— pero empuja a repetir la forma en vez de inventarla, que es lo
              único que se puede hacer contra un texto libre.
            */}
            <input
              list="administrativos-ya-usados"
              value={f.administrativo}
              onChange={(e) => cambiar({ administrativo: e.target.value })}
              className={CAMPO}
            />
            <datalist id="administrativos-ya-usados">
              {administrativos.data?.map((a) => (
                <option key={a} value={a} />
              ))}
            </datalist>
          </Campo>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Campo etiqueta="Medio de pago" obligatorio>
            <select
              value={f.medioPago}
              onChange={(e) => cambiar({ medioPago: e.target.value })}
              className={CAMPO}
            >
              <option value="tarjeta_habitualista">Tarjeta Habitualista</option>
              <option value="transferencia">Transferencia</option>
              <option value="efectivo">Efectivo</option>
            </select>
          </Campo>
          <Campo etiqueta="Canal" ayuda="RUNA lo maneja administración">
            <select
              value={f.canal}
              onChange={(e) => cambiar({ canal: e.target.value })}
              className={CAMPO}
            >
              <option value="presencial">Presencial</option>
              <option value="runa">RUNA</option>
            </select>
          </Campo>
        </div>

        <Campo etiqueta="Observaciones">
          <textarea
            value={f.observaciones}
            onChange={(e) => cambiar({ observaciones: e.target.value })}
            rows={2}
            className={CAMPO}
          />
        </Campo>
      </Panel>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={!listo || guardar.isPending} className={BOTON}>
          <FilePlus aria-hidden="true" size={16} />
          {guardar.isPending ? "Guardando" : "Cargar trámite"}
        </button>
        <p className="text-2xs text-ink2">
          Cargarlo acá ya vale como autorización. Lo que escribas no se pierde si cambiás de
          pantalla.
        </p>
      </div>
    </form>
  );
}

function Campo({
  etiqueta,
  ayuda,
  obligatorio = false,
  children,
}: {
  etiqueta: string;
  ayuda?: string;
  obligatorio?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-ink2">
        {etiqueta}
        {obligatorio ? " *" : ""}
        {ayuda === undefined ? "" : ` — ${ayuda}`}
      </span>
      {children}
    </label>
  );
}
