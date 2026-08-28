import { useState } from "react";
import { toast } from "sonner";
import { HardDriveDownload } from "lucide-react";
import { Panel } from "../../components/Panel";
import { Calendario } from "./Calendario";
import { Avisos } from "./Avisos";
import { SkeletonLineas } from "../../components/Skeleton";
import { hoyArgentina } from "../../lib/fechas";
import { supabase } from "../../lib/supabase";
import { clasificarFalla } from "../../lib/fallas";
import { BOTON_SUAVE, CAMPO_SUELTO } from "../../lib/campos";
import { nombreDeRol, type Rol } from "../../lib/roles";
import { useGestoras, useGuardar, useRazonesSociales, useTarjetas } from "../../lib/datos";
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
      {/* Arriba de todo, a propósito: con defectos abiertos no entran funciones nuevas. */}
      <Avisos />
      {/*
        CARGAR DINERO SE FUE DE ACA el 28/08/2026, y esta anotado porque alguien lo va a buscar.

        Vive adentro de cada empresa, al lado de "+ Trámite". No es configuracion: es trabajo
        diario, y un deposito siempre es a una tarjeta que es de una empresa. Cargarlo desde la
        pantalla que ya sabe cual quita el selector de tarjeta — y el campo que no existe no se
        puede llenar mal.

        Lo que SI queda aca es la lista de razones sociales y que tarjeta tiene cada una, que si
        es configuracion.
      */}
      <Usuarios />
      <RazonesYTarjetas />
      <Calendario />
      <Respaldo />
    </div>
  );
}

// ------------------------------------------------------------
// Respaldo
// ------------------------------------------------------------

/**
 * ============================================================================
 *  BAJAR UN RESPALDO. La lista de tablas se DERIVA, no se mantiene.
 * ============================================================================
 *
 *  En el Tablero Contable el respaldo recorre siete nombres escritos a mano, y su propia
 *  documentación advierte que si agregás una tabla y no la sumás ahí, el backup no la incluye.
 *  Ya se le escapa una: la que guarda los arqueos. Acá la lista sale de `tablas.generado.ts`,
 *  que lo escribe el mismo comando que genera los tipos desde la base real. Una tabla nueva
 *  entra sola porque nadie escribe la lista.
 *
 *  SI UNA TABLA FALLA, EL BOTON LO DICE Y NO DISIMULA. Un respaldo incompleto que se presenta
 *  como completo es peor que no tener ninguno: genera la confianza de tenerlo.
 *
 *  LO QUE ESTE RESPALDO NO TRAE, y está escrito para que nadie lo suponga: las cuentas de
 *  acceso. Viven en el esquema `auth`, que la clave publicable no puede leer. Trae los datos,
 *  no la identidad. Sirve para recuperar información, no para reconstruir el sistema entero.
 */
function Respaldo() {
  const [bajando, setBajando] = useState(false);

  async function bajar(): Promise<void> {
    setBajando(true);
    try {
      const { armarRespaldo, contarFilas, estaCompleto } = await import("../../lib/respaldo");
      const { TABLAS } = await import("../../lib/tablas.generado");

      const { data: sesion } = await supabase.auth.getUser();
      const r = await armarRespaldo(
        async (tabla) => {
          const { data, error } = await supabase.from(tabla as never).select("*");
          return { data: data as unknown[] | null, error };
        },
        TABLAS,
        sesion.user?.email ?? "sin identificar",
      );

      const nombre = `respaldo-gestoria-${hoyArgentina()}.json`;
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(r, null, 1)], { type: "application/json" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = nombre;
      a.click();
      URL.revokeObjectURL(url);

      const cuantas = Object.keys(r.tablas).length;
      if (estaCompleto(r)) {
        toast.success(`Respaldo bajado: ${cuantas} tablas, ${contarFilas(r)} filas`);
      } else {
        // Se baja igual: sirve más un respaldo incompleto que se sabe incompleto que ninguno.
        toast.warning("El respaldo salió incompleto", {
          description: `No se pudieron leer: ${Object.keys(r.errores).join(", ")}. El archivo se bajó igual y dice adentro cuáles faltaron.`,
        });
      }
    } catch (e) {
      const falla = clasificarFalla(e, navigator.onLine);
      toast.error(falla.titulo, { description: falla.explicacion });
    } finally {
      setBajando(false);
    }
  }

  return (
    <Panel className="flex flex-col gap-3">
      <h2 className="text-lg">Respaldo</h2>
      <p className="text-xs text-ink2">
        Baja un archivo con todo lo que hay en la base. La lista de tablas no se mantiene a mano:
        sale del esquema real, así que una tabla nueva entra sola. No incluye las cuentas de acceso,
        que viven en otro lado: sirve para recuperar datos, no para rehacer el sistema.
      </p>
      <button type="button" disabled={bajando} onClick={() => void bajar()} className={BOTON_SUAVE}>
        <HardDriveDownload aria-hidden="true" size={14} />
        {bajando ? "Leyendo la base" : "Bajar un respaldo"}
      </button>
    </Panel>
  );
}

// ------------------------------------------------------------
// Carga de dinero
// ------------------------------------------------------------

// ------------------------------------------------------------
// Usuarios
// ------------------------------------------------------------

function Usuarios() {
  const gestoras = useGestoras();
  const perfiles = useQuery({
    queryKey: ["perfiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("perfiles")
        .select("id, email, nombre, rol, activo, gestora_id")
        .order("email");
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

  if (perfiles.isLoading)
    return (
      <Panel>
        <SkeletonLineas cantidad={4} />
      </Panel>
    );

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
            guardar.mutate({ id: p.id, rol, activo, gestoraId })
          }
        />
      ))}
    </Panel>
  );
}

function FilaUsuario({
  perfil,
  gestoras,
  alGuardar,
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

      <select
        value={rol}
        onChange={(e) => setRol(e.target.value as Rol)}
        aria-label={`Rol de ${perfil.email}`}
        className={CAMPO_SUELTO}
      >
        <option value="sin_asignar">Sin asignar</option>
        <option value="gestora">Gestoría</option>
        <option value="contable">Contable</option>
        <option value="gerencia">Gerencia</option>
      </select>

      {rol === "gestora" && (
        <select
          value={gestoraId}
          onChange={(e) => setGestoraId(e.target.value)}
          aria-label={`Qué gestora es ${perfil.email}`}
          className={CAMPO_SUELTO}
        >
          <option value="">Qué gestora</option>
          {gestoras.map((g) => (
            <option key={g.id} value={g.id}>
              {g.nombre}
            </option>
          ))}
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
        className={BOTON_SUAVE}
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
        .from("razones_sociales")
        .update({ tarjeta_id: v.tarjetaId })
        .eq("id", v.id);
      if (error) throw error;
    },
    { exito: "Razón social actualizada", invalidar: ["razones_sociales", "saldos"] },
  );

  return (
    <Panel className="flex flex-col gap-2">
      <h2 className="text-lg">Razones sociales y tarjetas</h2>
      <p className="text-xs text-ink2">
        Con qué Tarjeta Habitualista paga cada una. Es editable: si una pasa a pagar con la de otra,
        se cambia acá. Los trámites que ya movieron plata se quedan con la tarjeta que tenían.
      </p>

      {razones.data?.map((r) => (
        <div key={r.id} className="flex flex-wrap items-center gap-2 border-b border-line py-2">
          <span className="min-w-40 flex-1 text-sm">{r.nombre}</span>
          <select
            value={r.tarjeta_id ?? ""}
            onChange={(e) => guardar.mutate({ id: r.id, tarjetaId: e.target.value || null })}
            aria-label={`Tarjeta de ${r.nombre}`}
            className={CAMPO_SUELTO}
          >
            <option value="">Sin tarjeta</option>
            {tarjetas.data?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
          </select>
        </div>
      ))}
    </Panel>
  );
}
