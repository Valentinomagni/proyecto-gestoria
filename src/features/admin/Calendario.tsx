import { useState } from "react";
import { CalendarPlus, CheckCircle2 } from "lucide-react";
import { Panel } from "../../components/Panel";
import { SkeletonLineas } from "../../components/Skeleton";
import { BOTON_SUAVE, CAMPO, CAMPO_SUELTO } from "../../lib/campos";
import { formatearFecha, hoyArgentina } from "../../lib/fechas";
import { supabase } from "../../lib/supabase";
import { useCalendario, useGuardar } from "../../lib/datos";
import { revisarCobertura } from "../../lib/plazos";
import { useQuery } from "@tanstack/react-query";

/**
 * ============================================================================
 *  EL RELOJ: confirmar plazos y cargar feriados. Sólo gerencia.
 * ============================================================================
 *
 *  Esta pantalla es la que enciende los vencimientos. Mientras esté vacía, el sistema no avisa
 *  ningún vencimiento — y eso es lo correcto, porque avisar uno equivocado es peor que no
 *  avisar nada: el primero se deja de mirar.
 *
 *  ============================================================================
 *   POR QUE CONFIRMAR UN PLAZO PIDE UN NOMBRE
 *  ============================================================================
 *
 *  Un plazo confirmado se muestra en la ficha de todos los trámites con la fecha y el nombre de
 *  quien lo confirmó al lado. Eso hace dos cosas: vuelve el número discutible en vez de creíble
 *  por decreto, y hace que dentro de un año se vea que la confirmación es vieja sin que nadie
 *  tenga que avisarlo.
 *
 *  Y QUIEN LO SABE MEJOR QUE CUALQUIER PAGINA WEB SON LAS GESTORAS. Viven estos plazos todos
 *  los días. Por eso el campo pide un nombre en vez de estampar el del usuario que aprieta:
 *  quien confirma puede no ser quien está sentado en la computadora.
 */
export function Calendario() {
  return (
    <>
      <Plazos />
      <Feriados />
    </>
  );
}

// ------------------------------------------------------------
// Los plazos
// ------------------------------------------------------------

interface FilaPlazo {
  id: string;
  clave: string;
  nombre: string;
  dias: number;
  habiles: boolean;
  consecuencia: string;
  norma: string | null;
  fuente: string | null;
  verificado_el: string | null;
  verificado_por: string | null;
}

function usePlazosTodos() {
  return useQuery({
    queryKey: ["plazos_todos"],
    queryFn: async (): Promise<FilaPlazo[]> => {
      const { data, error } = await supabase
        .from("plazos")
        .select("id, clave, nombre, dias, habiles, consecuencia, norma, fuente, verificado_el, verificado_por")
        .eq("activo", true)
        .order("clave");
      if (error) throw error;
      return data as FilaPlazo[];
    },
  });
}

function Plazos() {
  const plazos = usePlazosTodos();

  const confirmar = useGuardar(
    async (v: { id: string; quien: string }) => {
      // Los dos datos juntos o ninguno: la base tiene un check que lo exige. Una fecha sin
      // responsable es un sello, y un responsable sin fecha no dice contra qué versión se miró.
      const { error } = await supabase
        .from("plazos")
        .update({ verificado_el: hoyArgentina(), verificado_por: v.quien.trim() })
        .eq("id", v.id);
      if (error) throw error;
    },
    { exito: "Plazo confirmado", invalidar: ["plazos_todos", "plazos_usables"] },
  );

  if (plazos.isLoading) return <Panel><SkeletonLineas cantidad={4} /></Panel>;

  const sinConfirmar = (plazos.data ?? []).filter((p) => p.verificado_el === null).length;

  return (
    <Panel className="flex flex-col gap-3">
      <h2 className="text-lg">Plazos</h2>
      <p className="text-xs text-ink2">
        Un plazo sin confirmar NO produce ningún vencimiento en la ficha del trámite. Es a
        propósito: un sistema que avisa un vencimiento equivocado es peor que uno que no avisa
        nada, porque el primero se deja de mirar.
      </p>
      {sinConfirmar > 0 && (
        <p className="text-xs text-warn">
          {sinConfirmar === 1
            ? "Falta confirmar 1 plazo."
            : `Faltan confirmar ${sinConfirmar} plazos.`}{" "}
          Preguntales a las gestoras: los viven todos los días y lo saben mejor que cualquier
          página.
        </p>
      )}

      {plazos.data?.map((p) => (
        <UnPlazo key={p.id} plazo={p} alConfirmar={(quien) => confirmar.mutate({ id: p.id, quien })} />
      ))}
    </Panel>
  );
}

function UnPlazo({ plazo, alConfirmar }: { plazo: FilaPlazo; alConfirmar: (quien: string) => void }) {
  const [quien, setQuien] = useState("");
  const confirmado = plazo.verificado_el !== null;

  return (
    <div className="flex flex-col gap-1 border-b border-line py-2 last:border-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm">{plazo.nombre}</span>
        <span className="text-xs tnum text-ink2">
          {plazo.dias} {plazo.habiles ? "días hábiles" : "días corridos"}
        </span>
      </div>

      <p className={`text-2xs ${confirmado ? "text-ink2" : "text-warn"}`}>{plazo.consecuencia}</p>

      {plazo.norma !== null && <p className="text-2xs text-ink2">{plazo.norma}</p>}
      {plazo.fuente !== null && <p className="text-2xs text-ink2">De dónde salió: {plazo.fuente}</p>}

      {confirmado ? (
        <p className="flex items-center gap-1 text-2xs text-done">
          <CheckCircle2 aria-hidden="true" size={12} />
          Confirmado el {formatearFecha(`${plazo.verificado_el ?? ""}T12:00:00Z`)} por{" "}
          {plazo.verificado_por}
        </p>
      ) : (
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <input
            value={quien}
            onChange={(e) => setQuien(e.target.value)}
            placeholder="Quién lo confirma"
            className={CAMPO_SUELTO}
          />
          <button
            type="button"
            disabled={quien.trim() === ""}
            onClick={() => alConfirmar(quien)}
            className={BOTON_SUAVE}
          >
            Confirmar este plazo
          </button>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------
// Los feriados
// ------------------------------------------------------------

function Feriados() {
  const calendario = useCalendario();
  const [fecha, setFecha] = useState("");
  const [motivo, setMotivo] = useState("");
  const [hasta, setHasta] = useState("");

  const agregar = useGuardar(
    async () => {
      const { error } = await supabase
        .from("feriados")
        .upsert({ fecha, motivo: motivo.trim() }, { onConflict: "fecha" });
      if (error) throw error;
      setFecha("");
      setMotivo("");
    },
    { exito: "Feriado cargado", invalidar: ["calendario"] },
  );

  const declarar = useGuardar(
    async (v: string) => {
      const { error } = await supabase
        .from("parametros")
        .update({ valor: v })
        .eq("clave", "calendario_cubre_hasta");
      if (error) throw error;
    },
    { exito: "Cobertura del calendario declarada", invalidar: ["calendario"] },
  );

  const cargados = calendario.data?.feriados.size ?? 0;
  const cubre = calendario.data?.cubreHasta ?? null;
  const avisoDeCobertura = revisarCobertura(calendario.data?.feriados ?? new Set(), cubre);

  return (
    <Panel className="flex flex-col gap-3">
      <h2 className="text-lg">Feriados</h2>
      <p className="text-xs text-ink2">
        Los feriados no se calculan: se cargan. Los trasladables se mueven por decreto y los
        puentes turísticos se fijan cada año en el Boletín Oficial, así que una fórmula estaría
        bien tres años y mal el cuarto — y el año que esté mal nadie lo notaría hasta que un
        trámite venza tarde.
      </p>

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-ink2">Fecha</span>
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className={`${CAMPO_SUELTO} tnum`}
          />
        </label>
        <label className="flex min-w-48 flex-1 flex-col gap-1">
          <span className="text-xs text-ink2">Motivo</span>
          <input
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ej: Día del Trabajador"
            className={CAMPO}
          />
        </label>
        <button
          type="button"
          disabled={fecha === "" || motivo.trim() === "" || agregar.isPending}
          onClick={() => agregar.mutate(undefined)}
          className={BOTON_SUAVE}
        >
          <CalendarPlus aria-hidden="true" size={14} />
          Agregar
        </button>
      </div>

      <p className="text-xs text-ink2 tnum">
        {cargados === 0
          ? "Todavía no hay ningún feriado cargado."
          : `${cargados} feriados cargados.`}
      </p>

      {/*
        ============================================================================
         HASTA DONDE LLEGA EL CALENDARIO SE DECLARA, NO SE DEDUCE
        ============================================================================

        Tomar el año del último feriado cargado y suponer ese año completo es exactamente la
        clase de deducción que hace daño: si faltan feriados, el vencimiento sale ANTES de lo
        real y el sistema da por vencido algo que no venció.

        Por eso lo dice una persona: "terminé de cargar hasta acá". Mientras esté vacío, ningún
        plazo en días hábiles muestra vencimiento.
      */}
      <div className="flex flex-col gap-2 border-t border-line pt-3">
        <p className="text-xs">
          {cubre === null ? (
            <span className="text-warn">
              No está declarado hasta dónde llega el calendario, así que ningún plazo en días
              hábiles muestra vencimiento todavía.
            </span>
          ) : (
            <span className="text-ink2">
              Declarado: el calendario llega hasta el {formatearFecha(`${cubre}T12:00:00Z`)}.
            </span>
          )}
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-ink2">Cargué los feriados hasta</span>
            <input
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className={`${CAMPO_SUELTO} tnum`}
            />
          </label>
          <button
            type="button"
            disabled={hasta === "" || declarar.isPending}
            onClick={() => declarar.mutate(hasta)}
            className={BOTON_SUAVE}
          >
            Declarar la cobertura
          </button>
          {cubre !== null && (
            <button
              type="button"
              disabled={declarar.isPending}
              onClick={() => declarar.mutate("")}
              className={BOTON_SUAVE}
            >
              Borrar la declaración
            </button>
          )}
        </div>

        {/*
          ============================================================================
           EL AVISO QUE HABRIA FRENADO EL ERROR QUE YA SE COMETIO
          ============================================================================

          Probando esta misma pantalla se declaró cobertura hasta fin de año con DOS feriados
          cargados. El sistema empezó a mostrar vencimientos calculados sobre un calendario
          incompleto: exactamente lo que todo este diseño evita, y entró por la única puerta que
          no tenía control, que es la afirmación de una persona.

          Argentina tiene más de quince feriados por año. Menos de diez en un año declarado es,
          con mucha probabilidad, un año a medio cargar. No lo bloquea —quien declara puede
          tener una razón— pero lo dice antes, no después.
        */}
        {avisoDeCobertura !== null && <p className="text-xs text-warn">{avisoDeCobertura}</p>}
      </div>
    </Panel>
  );
}
