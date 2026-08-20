import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { Panel } from "../../components/Panel";
import { SkeletonLineas } from "../../components/Skeleton";
import { BOTON_SUAVE, CAMPO } from "../../lib/campos";
import { formatearFechaHora } from "../../lib/fechas";
import { supabase } from "../../lib/supabase";
import { useGuardar } from "../../lib/datos";

/**
 * ============================================================================
 *  LOS AVISOS QUE LLEGARON. Sin esto, el andon es un pozo.
 * ============================================================================
 *
 *  El botón de avisar existía y nadie podía leer los avisos. Una cuerda que se puede tirar pero
 *  que no suena en ningún lado es peor que no tenerla: la primera vez alguien avisa, no pasa
 *  nada, y no vuelve a avisar nunca. Y ahí se pierden justo los problemas que sólo ve quien
 *  está usando el sistema.
 *
 *  ============================================================================
 *   LOS SIN ATENDER VAN PRIMERO, Y SE CUENTAN
 *  ============================================================================
 *
 *  Un aviso atendido es historia; uno sin atender es trabajo. Mezclarlos hace que la lista
 *  crezca y que lo pendiente se pierda adentro.
 *
 *  ============================================================================
 *   ATENDER PIDE ESCRIBIR QUE SE HIZO
 *  ============================================================================
 *
 *  Y no es burocracia: es lo único que hace que el aviso siguiente valga la pena. Si quien
 *  avisó no se entera de qué pasó con lo que dijo, la próxima no dice nada.
 *
 *  NO SE CUENTAN AVISOS POR PERSONA, y por eso esta pantalla no agrupa por quien avisó ni
 *  muestra ningún total individual. Sólo dice quién fue, para poder volver a preguntarle. Un
 *  tablero de "quién avisa más problemas" convierte el andon en algo que conviene no tocar.
 */

interface Aviso {
  id: number;
  texto: string | null;
  contexto: Record<string, unknown>;
  creado_at: string;
  atendido_at: string | null;
  resolucion: string | null;
  quien_email: string | null;
}

function useAvisos() {
  return useQuery({
    queryKey: ["avisos"],
    queryFn: async (): Promise<Aviso[]> => {
      const { data, error } = await supabase
        .from("avisos")
        .select("id, texto, contexto, creado_at, atendido_at, resolucion, perfiles!avisos_quien_fkey(email)")
        .order("creado_at", { ascending: false })
        .limit(100);
      if (error) throw error;

      return (data ?? []).map((a) => {
        const p = a.perfiles as { email?: string } | { email?: string }[] | null;
        const uno = Array.isArray(p) ? p[0] : p;
        return {
          id: Number(a.id),
          texto: a.texto,
          contexto: (a.contexto ?? {}) as Record<string, unknown>,
          creado_at: String(a.creado_at),
          atendido_at: a.atendido_at,
          resolucion: a.resolucion,
          quien_email: uno?.email ?? null,
        };
      });
    },
  });
}

export function Avisos() {
  const avisos = useAvisos();

  const atender = useGuardar(
    async (v: { id: number; resolucion: string }) => {
      const { data: sesion } = await supabase.auth.getUser();
      const quien = sesion.user?.id;
      if (quien === undefined) throw new Error("regla_tramite: Se cerró la sesión. Entrá de nuevo.");

      // Los tres datos juntos: la base tiene un check que exige la fecha y el responsable a la
      // vez, igual que en los plazos. Media atención no existe.
      const { error } = await supabase
        .from("avisos")
        .update({
          atendido_at: new Date().toISOString(),
          atendido_por: quien,
          resolucion: v.resolucion.trim(),
        })
        .eq("id", v.id);
      if (error) throw error;
    },
    { exito: "Aviso atendido", invalidar: ["avisos"] },
  );

  if (avisos.isLoading) return <Panel><SkeletonLineas cantidad={3} /></Panel>;

  const pendientes = (avisos.data ?? []).filter((a) => a.atendido_at === null);
  const atendidos = (avisos.data ?? []).filter((a) => a.atendido_at !== null);

  return (
    <Panel className="flex flex-col gap-3">
      <h2 className="text-lg">Problemas avisados</h2>

      {pendientes.length === 0 ? (
        <p className="text-sm text-ink2">No hay avisos sin atender.</p>
      ) : (
        <p className="text-xs text-warn">
          {pendientes.length === 1 ? "Hay 1 aviso sin atender." : `Hay ${pendientes.length} avisos sin atender.`}{" "}
          Con defectos abiertos no entran funciones nuevas: es la regla de la casa.
        </p>
      )}

      {pendientes.map((a) => (
        <UnAviso
          key={a.id}
          aviso={a}
          alAtender={(resolucion) => atender.mutate({ id: a.id, resolucion })}
        />
      ))}

      {atendidos.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs text-ink2">
            {atendidos.length === 1 ? "Ver el que ya se atendió" : `Ver los ${atendidos.length} ya atendidos`}
          </summary>
          <div className="mt-2 flex flex-col">
            {atendidos.map((a) => <UnAviso key={a.id} aviso={a} alAtender={null} />)}
          </div>
        </details>
      )}
    </Panel>
  );
}

function UnAviso({
  aviso, alAtender,
}: {
  aviso: Aviso;
  alAtender: ((resolucion: string) => void) | null;
}) {
  const [resolucion, setResolucion] = useState("");
  const c = aviso.contexto;

  return (
    <div className="flex flex-col gap-1 border-b border-line py-2 last:border-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        {/*
          SIN TEXTO NO ES UN AVISO VACIO: es un aviso igual de válido. Quien lo apretó no tiene
          que saber explicar nada, así que la pantalla no lo trata como incompleto.
        */}
        <span className={`text-sm ${aviso.texto === null ? "text-ink2" : ""}`}>
          {aviso.texto ?? "Sin texto: sólo apretó el botón"}
        </span>
        <span className="text-2xs text-ink2 tnum">{formatearFechaHora(aviso.creado_at)}</span>
      </div>

      <p className="text-2xs text-ink2">
        {[
          aviso.quien_email,
          c["rol"] === undefined ? null : `rol ${String(c["rol"])}`,
          c["pantalla"] === undefined ? null : `en ${String(c["pantalla"])}`,
          c["habia_internet"] === false ? "SIN internet" : null,
          c["pantalla_px"] === undefined ? null : String(c["pantalla_px"]),
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>

      {typeof c["navegador"] === "string" && (
        <details>
          <summary className="cursor-pointer text-2xs text-ink2">Detalle técnico</summary>
          <p className="mt-1 break-all text-2xs text-ink2">{c["navegador"]}</p>
        </details>
      )}

      {aviso.atendido_at !== null ? (
        <p className="flex items-start gap-1 text-2xs text-done">
          <CheckCircle2 aria-hidden="true" size={12} className="mt-0.5 shrink-0" />
          <span>
            Atendido el {formatearFechaHora(aviso.atendido_at)}
            {aviso.resolucion === null ? "" : `: ${aviso.resolucion}`}
          </span>
        </p>
      ) : alAtender !== null ? (
        <div className="mt-1 flex flex-wrap items-end gap-2">
          <label className="min-w-48 flex-1">
            <span className="sr-only">Qué se hizo</span>
            <input
              value={resolucion}
              onChange={(e) => setResolucion(e.target.value)}
              placeholder="Qué se hizo con esto"
              className={CAMPO}
            />
          </label>
          <button
            type="button"
            disabled={resolucion.trim() === ""}
            onClick={() => alAtender(resolucion)}
            className={BOTON_SUAVE}
          >
            Marcar atendido
          </button>
        </div>
      ) : null}
    </div>
  );
}
