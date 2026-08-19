import { useState } from "react";
import { Panel } from "../../components/Panel";
import { SkeletonLineas } from "../../components/Skeleton";
import { aPesos, formatear, parsear } from "../../lib/plata";
import { hoyArgentina, proximoDiaHabil } from "../../lib/fechas";
import { supabase } from "../../lib/supabase";
import { nombreDeRol, type Rol } from "../../lib/roles";
import { useGestoras, useGuardar, useRazonesSociales, useSaldos, useTarjetas } from "../../lib/datos";
import { useQuery } from "@tanstack/react-query";

/**
 * Administración. Sólo gerencia.
 *
 * Acá se hace todo lo que el pedido pidió que fuera un dato y no código: quién es cada usuario,
 * qué gestora es cada quien, con qué tarjeta paga cada razón social, y la carga de dinero.
 *
 * Agregar una sexta razón social o un cuarto concepto se hace desde acá, sin correr ninguna
 * migración. Eso es lo que quiere decir "administrable".
 */
export function Admin() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-6">
      <h1 className="text-xl">Administración</h1>
      <CargarDinero />
      <Usuarios />
      <RazonesYTarjetas />
    </div>
  );
}

// ------------------------------------------------------------
// Carga de dinero
// ------------------------------------------------------------

function CargarDinero() {
  const saldos = useSaldos();
  const [tarjetaId, setTarjetaId] = useState("");
  const [importe, setImporte] = useState("");
  const [tipo, setTipo] = useState<"ingreso" | "saldo_inicial">("ingreso");
  const [acreditaManiana, setAcreditaManiana] = useState(true);
  const [observacion, setObservacion] = useState("");

  const guardar = useGuardar(
    async () => {
      const centavos = parsear(importe);
      if (centavos === null) throw new Error("importe invalido");

      // La fecha de acreditación es la razón de ser de este formulario. Un depósito ordenado hoy
      // acredita mañana, así que hasta entonces NO es saldo disponible. Si se cargara como
      // disponible, alguien mandaría a presentar contra plata que todavía no está.
      const hoy = hoyArgentina();

      const { error } = await supabase.from("movimientos").insert({
        tarjeta_id: tarjetaId,
        tipo,
        importe: aPesos(centavos),
        fecha_acreditacion:
          tipo === "saldo_inicial" || !acreditaManiana ? hoy : proximoDiaHabil(),
        concepto: tipo === "saldo_inicial" ? "Saldo inicial del corte" : "Depósito",
        ...(observacion.trim() !== "" && { observacion: observacion.trim() }),
      });
      if (error) throw error;
      setImporte("");
      setObservacion("");
    },
    { exito: "Movimiento cargado", invalidar: ["saldos", "movimientos"] },
  );

  const centavos = parsear(importe);

  return (
    <Panel className="flex flex-col gap-3">
      <h2 className="text-lg">Cargar dinero</h2>
      <p className="text-xs text-ink2">
        Un depósito ordenado hoy acredita mañana. Hasta entonces figura como en tránsito y no
        como disponible: si contara hoy, alguien podría mandar a presentar contra plata que
        todavía no está.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-ink2">Tarjeta</span>
          <select value={tarjetaId} onChange={(e) => setTarjetaId(e.target.value)} className={INPUT}>
            <option value="">Elegí</option>
            {saldos.data?.map((s) => (
              <option key={s.tarjeta_id} value={s.tarjeta_id}>{s.nombre}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-ink2">Qué es</span>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as "ingreso" | "saldo_inicial")}
            className={INPUT}
          >
            <option value="ingreso">Un depósito</option>
            <option value="saldo_inicial">El saldo inicial del corte</option>
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-ink2">Importe</span>
        <input
          inputMode="decimal"
          value={importe}
          onChange={(e) => setImporte(e.target.value)}
          placeholder="2.505.627,92"
          className={`${INPUT} tnum`}
        />
        {centavos !== null && (
          <span className="text-2xs text-ink2 tnum">{formatear(centavos)}</span>
        )}
      </label>

      {tipo === "ingreso" && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={acreditaManiana}
            onChange={(e) => setAcreditaManiana(e.target.checked)}
          />
          Acredita mañana
        </label>
      )}

      {tipo === "saldo_inicial" && (
        <p className="text-xs text-warn">
          El saldo inicial se carga UNA sola vez por tarjeta, y tiene que ser exactamente el que
          muestra el sitio ese día. Es la línea de largada de todo lo demás.
        </p>
      )}

      <label className="flex flex-col gap-1">
        <span className="text-xs text-ink2">Observación</span>
        <input value={observacion} onChange={(e) => setObservacion(e.target.value)} className={INPUT} />
      </label>

      <button
        type="button"
        disabled={tarjetaId === "" || centavos === null || guardar.isPending}
        onClick={() => guardar.mutate(undefined)}
        className="w-fit rounded-md bg-accent px-4 py-2 text-sm text-accent-ink disabled:opacity-50"
      >
        {guardar.isPending ? "Guardando" : "Cargar"}
      </button>
    </Panel>
  );
}

// ------------------------------------------------------------
// Usuarios
// ------------------------------------------------------------

function Usuarios() {
  const gestoras = useGestoras();
  const perfiles = useQuery({
    queryKey: ["perfiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("perfiles").select("id, email, nombre, rol, activo, gestora_id").order("email");
      if (error) throw error;
      return data;
    },
  });

  const guardar = useGuardar(
    async (v: { id: string; rol: Rol; activo: boolean; gestoraId: string | null }) => {
      const { error } = await supabase
        .from("perfiles")
        .update({ rol: v.rol, activo: v.activo, gestora_id: v.gestoraId })
        .eq("id", v.id);
      if (error) throw error;
    },
    { exito: "Usuario actualizado", invalidar: ["perfiles"] },
  );

  if (perfiles.isLoading) return <Panel><SkeletonLineas cantidad={4} /></Panel>;

  return (
    <Panel className="flex flex-col gap-3">
      <h2 className="text-lg">Usuarios</h2>
      <p className="text-xs text-ink2">
        Una cuenta nueva entra sin permisos hasta que se le asigna un rol. Una gestora necesita
        además estar vinculada a su ficha: sin eso vería cero trámites, y la base lo impide.
      </p>

      {perfiles.data?.map((p) => (
        <FilaUsuario
          key={p.id}
          perfil={p}
          gestoras={gestoras.data ?? []}
          alGuardar={(rol, activo, gestoraId) =>
            guardar.mutate({ id: p.id, rol, activo, gestoraId })}
        />
      ))}
    </Panel>
  );
}

function FilaUsuario({
  perfil, gestoras, alGuardar,
}: {
  perfil: { id: string; email: string; rol: string; activo: boolean; gestora_id: string | null };
  gestoras: { id: string; nombre: string }[];
  alGuardar: (rol: Rol, activo: boolean, gestoraId: string | null) => void;
}) {
  const [rol, setRol] = useState(perfil.rol as Rol);
  const [activo, setActivo] = useState(perfil.activo);
  const [gestoraId, setGestoraId] = useState(perfil.gestora_id ?? "");

  const cambio =
    rol !== perfil.rol || activo !== perfil.activo || (gestoraId || null) !== perfil.gestora_id;

  return (
    <div className="flex flex-wrap items-end gap-2 border-b border-line py-2">
      <div className="min-w-48 flex-1">
        <p className="text-sm">{perfil.email}</p>
        <p className="text-2xs text-ink2">{nombreDeRol(perfil.rol as Rol)}</p>
      </div>

      <select value={rol} onChange={(e) => setRol(e.target.value as Rol)} className={INPUT_CHICO}>
        <option value="sin_asignar">Sin asignar</option>
        <option value="gestora">Gestoría</option>
        <option value="contable">Contable</option>
        <option value="gerencia">Gerencia</option>
      </select>

      {rol === "gestora" && (
        <select value={gestoraId} onChange={(e) => setGestoraId(e.target.value)} className={INPUT_CHICO}>
          <option value="">Qué gestora</option>
          {gestoras.map((g) => <option key={g.id} value={g.id}>{g.nombre}</option>)}
        </select>
      )}

      <label className="flex items-center gap-1 text-sm">
        <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
        Activo
      </label>

      <button
        type="button"
        disabled={!cambio}
        onClick={() => alGuardar(rol, activo, gestoraId === "" ? null : gestoraId)}
        className="rounded-md border border-line px-3 py-2 text-sm disabled:opacity-40"
      >
        Guardar
      </button>
    </div>
  );
}

// ------------------------------------------------------------
// Razones sociales y tarjetas
// ------------------------------------------------------------

function RazonesYTarjetas() {
  const razones = useRazonesSociales();
  const tarjetas = useTarjetas();

  const guardar = useGuardar(
    async (v: { id: string; tarjetaId: string | null }) => {
      const { error } = await supabase
        .from("razones_sociales").update({ tarjeta_id: v.tarjetaId }).eq("id", v.id);
      if (error) throw error;
    },
    { exito: "Razón social actualizada", invalidar: ["razones_sociales", "saldos"] },
  );

  return (
    <Panel className="flex flex-col gap-2">
      <h2 className="text-lg">Razones sociales y tarjetas</h2>
      <p className="text-xs text-ink2">
        Con qué Tarjeta Habitualista paga cada una. Es editable: si una pasa a pagar con la de
        otra, se cambia acá. Los trámites que ya movieron plata se quedan con la tarjeta que
        tenían.
      </p>

      {razones.data?.map((r) => (
        <div key={r.id} className="flex flex-wrap items-center gap-2 border-b border-line py-2">
          <span className="min-w-40 flex-1 text-sm">{r.nombre}</span>
          <select
            value={r.tarjeta_id ?? ""}
            onChange={(e) => guardar.mutate({ id: r.id, tarjetaId: e.target.value || null })}
            className={INPUT_CHICO}
          >
            <option value="">Sin tarjeta</option>
            {tarjetas.data?.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
          </select>
        </div>
      ))}
    </Panel>
  );
}

const INPUT = "w-full rounded-md border border-line bg-surface2 px-3 py-2 text-sm";
const INPUT_CHICO = "rounded-md border border-line bg-surface2 px-2 py-2 text-sm";
