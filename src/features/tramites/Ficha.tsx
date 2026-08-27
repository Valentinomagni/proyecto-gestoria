import { ArrowLeft } from "lucide-react";
import { Panel } from "../../components/Panel";
import { SkeletonLineas } from "../../components/Skeleton";
import { supabase } from "../../lib/supabase";
import { BOTON } from "../../lib/campos";
import { formatearFechaHora } from "../../lib/fechas";
import type { Database } from "../../lib/database.types";
import {
  useAdministrativos, useCambios, useConceptos, useConceptosDelTramite, useCorregirConcepto,
  useEventosDelTramite, useGestoras, useGuardar, useNotasDelTramite, useQuitarConcepto,
  useRequisitos, useRequisitosDelTramite, useTramite,
} from "../../lib/datos";
import { useSesion } from "../../lib/sesion";
import { CambiosDelTramite } from "./CambiosDelTramite";
import { Checklist } from "./Checklist";
import { DatosDelTramite } from "./DatosDelTramite";
import type { CambiosDeDatos } from "./campos-del-tramite";
import { Notas } from "./Notas";
import { Presupuesto } from "./Presupuesto";
import { Salidas } from "./Salidas";
import { Chip, nombreDeEstado } from "./Listado";

/**
 * ============================================================================
 *  LA FICHA DEL TRAMITE
 * ============================================================================
 *
 *  Es el orquestador: arma los datos y reparte. Cada panel vive en su archivo, porque este
 *  llegó a tener mil líneas y un archivo que no entra en la cabeza se edita a ciegas.
 *
 *  EL BOTON ES UNO SOLO, el del paso siguiente. Nadie elige un estado de una lista: elegir de
 *  una lista es como se saltea un paso sin querer.
 *
 *  Lo que exige cada paso lo decide LA BASE, no esta pantalla. Si falta un dato, el trigger
 *  devuelve el motivo escrito en castellano y `clasificarFalla` lo muestra tal cual. Que la
 *  validación viva en un solo lado es lo que evita que la pantalla deje pasar algo que la base
 *  rechaza, o al revés.
 */

/**
 * Que sigue despues de cada estado. Espeja la maquina de estados de la base.
 *
 * `presupuestado > resuelto` es UN paso porque es UN viaje al registro: la gestora presenta, paga
 * y retira en la misma ventanilla. Antes eran tres botones para el mismo momento, y ninguno de
 * los tres le decia nada nuevo a la oficina.
 *
 * SI ACA APARECIERA UN ESTADO QUE LA BASE YA NO ACEPTA, el boton se veria bien y fallaria contra
 * un check al apretarlo. Esta lista y `tramites_estado_valido` se mueven juntas.
 */
const SIGUIENTE: Record<
  string,
  { estado: string; boton: string; pide?: string } | undefined
> = {
  recibido: {
    estado: "controlado",
    boton: "Marcar como controlado",
    pide: "el legajo contestado entero, sin requisitos en blanco",
  },
  controlado: {
    estado: "entregado",
    boton: "Entregar a la gestora",
    pide: "elegir la gestora que lo lleva",
  },
  entregado: {
    estado: "presupuestado",
    boton: "Cargar el presupuesto",
    pide: "al menos una línea del presupuesto, con su importe",
  },
  presupuestado: {
    estado: "resuelto",
    boton: "Resolver en el registro",
    pide: "la seccional, el costo real por concepto y qué documentación retiraste",
  },
  /*
    "DEVOLVER" Y NO "ENTREGAR", aunque el paso de arriba tambien entregue.

    El estado que queda se llama "Devuelto", y el chip del listado lo dice asi. Si el boton dijera
    "Entregar", la gestora apretaria una palabra y el sistema le contestaria con otra. Ademas
    "Entregar a la gestora" ya existe tres pasos antes: dos botones con el mismo verbo en los dos
    extremos de la cadena se confunden justo cuando alguien va apurado.
  */
  resuelto: { estado: "devuelto", boton: "Devolver a administración" },
};

/** Estados en los que el presupuesto ya no se toca: la reserva ya se libero. */
const CERRADOS = new Set(["resuelto", "devuelto", "anulado"]);

/** Y en estos tampoco se toca el costo real: el tramite ya termino. */
const TERMINADOS = new Set(["devuelto", "anulado"]);

export function Ficha({ id, alVolver }: { id: string; alVolver: () => void }) {
  const tramite = useTramite(id);
  const conceptos = useConceptos();
  const lineas = useConceptosDelTramite(id);
  const eventos = useEventosDelTramite(id);
  const gestoras = useGestoras();
  const administrativos = useAdministrativos();
  const requisitos = useRequisitos(tramite.data?.tipo ?? null);
  const respuestas = useRequisitosDelTramite(id);
  const notas = useNotasDelTramite(id);
  const cambios = useCambios(id);
  const { perfil } = useSesion();

  const corregirConcepto = useCorregirConcepto();
  const quitarConcepto = useQuitarConcepto();

  /** El paso siguiente. No manda ningún dato: los datos se corrigen en su panel. */
  const avanzar = useGuardar(
    async (nuevo: string) => {
      // El parche se arma con el tipo GENERADO desde el esquema real. Si maniana se renombra
      // una columna, esto deja de compilar en vez de fallar en produccion con un 42703.
      const parche: Database["public"]["Tables"]["tramites"]["Update"] = { estado: nuevo };
      const { error } = await supabase.from("tramites").update(parche).eq("id", id);
      if (error) throw error;
    },
    {
      exito: "Trámite actualizado",
      invalidar: ["tramite", "tramites", "saldos", "tramite_eventos", "tramite_cambios"],
    },
  );

  /**
   * Corregir datos del trámite, SIN moverlo de paso.
   *
   * Va aparte de `avanzar` porque corregir un tipeo no puede obligar a avanzar la cadena, y
   * porque `avanzar` manda `estado`: si esto lo reusara, cada corrección dispararía la máquina
   * de estados y sus validaciones para no cambiar de estado.
   */
  const corregir = useGuardar(
    async (cambiosDeDatos: CambiosDeDatos) => {
      if (Object.keys(cambiosDeDatos).length === 0) return;

      /*
        `cliente_nombre` se separa a mano, y no es ceremonia: es la unica columna editable que en
        la base es `not null`, asi que su tipo generado NO acepta null y el resto si. Separarla
        es lo que deja que el parche siga atado al tipo generado en vez de castearlo — y un cast
        aca seria perder justamente la comprobacion que avisa cuando cambia el esquema.
      */
      const { cliente_nombre, ...resto } = cambiosDeDatos;
      const parche: Database["public"]["Tables"]["tramites"]["Update"] = { ...resto };
      if (cliente_nombre !== undefined && cliente_nombre !== null) {
        parche.cliente_nombre = cliente_nombre;
      }

      const { error } = await supabase.from("tramites").update(parche).eq("id", id);
      if (error) throw error;
    },
    { exito: "Datos corregidos", invalidar: ["tramite", "tramites", "tramite_cambios"] },
  );

  const agregarLinea = useGuardar(
    async (v: { conceptoId: string; momento: string; importe: number }) => {
      const { error } = await supabase.from("tramite_conceptos").insert({
        tramite_id: id, concepto_id: v.conceptoId, momento: v.momento, importe: v.importe,
      });
      if (error) throw error;
    },
    {
      exito: "Concepto agregado",
      invalidar: ["tramite_conceptos", "tramite", "tramites", "saldos", "movimientos", "tramite_cambios"],
    },
  );

  /**
   * Anular. Escribe el motivo EN LA MISMA operacion que el estado.
   *
   * No es un detalle de comodidad: la base tiene un `check` que exige el motivo cuando el estado
   * es `anulado`. Si se guardaran en dos pasos, el primero fallaria — y con razon, porque entre
   * uno y otro habria un instante con un tramite anulado sin ningun motivo.
   *
   * ANTES ESTA FUNCION SERVIA PARA DOS SALIDAS, anular y frenar. Frenar dejo de existir: esperar
   * plata se deduce de la tarjeta en `v_esperando_plata` y ya no lo marca una persona.
   */
  const anular = useGuardar(
    async (motivo: string) => {
      const parche: Database["public"]["Tables"]["tramites"]["Update"] = {
        estado: "anulado",
        motivo_anulacion: motivo.trim(),
      };

      const { error } = await supabase.from("tramites").update(parche).eq("id", id);
      if (error) throw error;
    },
    { exito: "Trámite anulado", invalidar: ["tramite", "tramites", "saldos", "tramite_eventos"] },
  );

  const responder = useGuardar(
    async (v: { requisitoId: string; respuesta: string }) => {
      const { error } = await supabase.from("tramite_requisitos").upsert(
        { tramite_id: id, requisito_id: v.requisitoId, respuesta: v.respuesta },
        { onConflict: "tramite_id,requisito_id" },
      );
      if (error) throw error;
    },
    { exito: "Respuesta guardada", invalidar: ["tramite_requisitos"] },
  );

  const responderTodo = useGuardar(
    async () => {
      const filas = (requisitos.data ?? []).map((r) => ({
        tramite_id: id, requisito_id: r.id, respuesta: "si",
      }));
      const { error } = await supabase.from("tramite_requisitos").upsert(filas, {
        onConflict: "tramite_id,requisito_id",
      });
      if (error) throw error;
    },
    { exito: "Checklist contestado", invalidar: ["tramite_requisitos"] },
  );

  /*
    El `autor` va explicito y es `auth.uid()`: la policy exige que coincidan, asi que la base NO
    deja escribir una nota firmada por otra persona. Es lo que hace que una nota valga como
    respaldo — si se pudiera firmar por cualquiera, seria un papelito.
  */
  const agregarNota = useGuardar(
    async (texto: string) => {
      const { data: sesion } = await supabase.auth.getUser();
      const autor = sesion.user?.id;
      if (autor === undefined) throw new Error("regla_tramite: Se cerró la sesión. Entrá de nuevo.");
      const { error } = await supabase
        .from("tramite_notas")
        .insert({ tramite_id: id, texto: texto.trim(), autor });
      if (error) throw error;
    },
    { exito: "Nota guardada", invalidar: ["tramite_notas"] },
  );

  if (tramite.isLoading || !tramite.data) {
    return <SkeletonLineas cantidad={6} className="m-6 max-w-2xl" />;
  }

  const t = tramite.data;
  const paso = SIGUIENTE[t.estado];
  const presupuesto = (lineas.data ?? []).filter((l) => l.momento === "presupuesto");
  const reales = (lineas.data ?? []).filter((l) => l.momento === "real");
  const guardandoLinea =
    agregarLinea.isPending || corregirConcepto.isPending || quitarConcepto.isPending;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-6">
      <button type="button" onClick={alVolver} className="flex min-h-11 w-fit items-center gap-2 text-sm text-ink2">
        <ArrowLeft aria-hidden="true" size={14} /> Volver al listado
      </button>

      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-xl">{t.cliente_nombre}</h1>
        <Chip estado={t.estado} />
      </div>

      {/*
        ============================================================================
         UNA BARRA DE AVANCE, NO UN PANEL DE FORMULARIO
        ============================================================================

        El panel "Paso siguiente" se sacó a pedido, y tenía razón: pedía de nuevo el depósito
        —que ahora es la suma de los conceptos y se edita en el panel Presupuesto— y la
        seccional, que es un dato del trámite y vive con los demás datos. Un panel que repite
        campos que están más abajo obliga a decidir cuál de los dos es el verdadero.

        Y SI FALTA UN DATO, LO DICE LA BASE, con su mensaje en castellano: "Falta indicar en qué
        seccional se presentó". Eso es mejor que una lista de requisitos acá arriba, que se
        desincronizaría el día que cambie una regla del trigger.

        PERO AVISAR QUE VA A PEDIR NO ES LO MISMO QUE VALIDAR, y esa distinción costó cuatro
        viajes a la ventanilla. "Resolver en el registro" pide TRES cosas —la seccional, el costo
        real y la documentación— y el trigger las valida de a una, cortando en la primera que
        falta. O sea que la gestora apretaba, leía un error rojo, cargaba un dato, apretaba,
        leía otro error rojo, y así cuatro veces, parada en el registro con el legajo en la mano.

        Antes eran tres botones, y cada uno pedía UNA cosa en su momento. Fundirlos en uno no
        sacó trabajo: sacó las señales, y agregó tres rechazos en el medio. Un rechazo por
        intentar hacer lo correcto enseña a desconfiar de la pantalla.

        `pide` no valida nada y por eso no se puede desincronizar con el trigger: sólo dice de
        antemano qué va a hacer falta. Convierte cuatro intentos en uno.
      */}
      {paso ? (
        <Panel className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-2xs text-ink2">Paso siguiente</p>
            <p className="text-sm">{paso.boton}</p>
            {paso.pide !== undefined && (
              <p className="text-xs text-ink2">Vas a necesitar {paso.pide}.</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => avanzar.mutate(paso.estado)}
            disabled={avanzar.isPending}
            className={BOTON}
          >
            {avanzar.isPending ? "Guardando" : paso.boton}
          </button>
        </Panel>
      ) : (
        <Panel>
          <p className="text-sm text-ink2">
            El trámite está {nombreDeEstado(t.estado).toLowerCase()}. No hay paso siguiente.
          </p>
        </Panel>
      )}

      <DatosDelTramite
        tramite={t as unknown as Record<string, unknown>}
        rol={perfil?.rol ?? "sin_asignar"}
        gestoras={gestoras.data ?? []}
        administrativos={administrativos.data ?? []}
        alGuardar={(cambiosDeDatos) => corregir.mutate(cambiosDeDatos)}
        guardando={corregir.isPending}
      />

      {/*
        El asunto original del mail queda AFUERA del panel de datos a propósito: no se edita
        nunca. Es la fuente, y una fuente que se puede corregir deja de servir para comprobar
        contra ella si un dato se cargó bien.
      */}
      {t.asunto_mail !== null && (
        <details>
          <summary className="text-2xs text-ink2 cursor-pointer">Asunto original del mail</summary>
          <p className="text-2xs text-ink2 mt-1 whitespace-pre-wrap">{t.asunto_mail}</p>
        </details>
      )}

      {t.estado === "recibido" && (
        <Panel className="flex flex-col gap-3">
          <h2 className="text-lg">Checklist del legajo</h2>
          <Checklist
            requisitos={requisitos.data ?? []}
            respuestas={respuestas.data ?? {}}
            alResponder={(requisitoId, respuesta) => responder.mutate({ requisitoId, respuesta })}
            alResponderTodo={() => responderTodo.mutate(undefined)}
          />
        </Panel>
      )}

      {/*
        EL PRESUPUESTO NO SE TOCA DESPUES DE PAGADO. La base lo impide con un trigger; acá se
        deja de ofrecer para que el rechazo no llegue como una sorpresa. La razón está escrita en
        la migración: al pagar se libera la reserva entera, así que un cambio posterior
        escribiría un ajuste sobre una reserva que ya no existe.
      */}
      <Presupuesto
        titulo="Presupuesto"
        ayuda="Es lo que se reserva de la tarjeta. Sólo cambia cuando cambia una línea."
        rotuloTotal="Total que se pide"
        lineas={presupuesto}
        conceptos={conceptos.data ?? []}
        editable={!CERRADOS.has(t.estado)}
        alAgregar={(conceptoId, importe) =>
          agregarLinea.mutate({ conceptoId, momento: "presupuesto", importe })}
        alCorregir={(idLinea, importe) => corregirConcepto.mutate({ id: idLinea, importe })}
        alQuitar={(idLinea, motivo) => quitarConcepto.mutate({ id: idLinea, motivo })}
        guardando={guardandoLinea}
      />

      <Presupuesto
        titulo="Costo real"
        ayuda="Lo que de verdad se pagó en la ventanilla. Cargalo antes de resolverlo en el registro."
        rotuloTotal="Total pagado"
        lineas={reales}
        conceptos={conceptos.data ?? []}
        editable={!TERMINADOS.has(t.estado)}
        alAgregar={(conceptoId, importe) =>
          agregarLinea.mutate({ conceptoId, momento: "real", importe })}
        alCorregir={(idLinea, importe) => corregirConcepto.mutate({ id: idLinea, importe })}
        alQuitar={(idLinea, motivo) => quitarConcepto.mutate({ id: idLinea, motivo })}
        guardando={guardandoLinea}
      />

      <CambiosDelTramite
        cambios={cambios.data ?? []}
        cargando={cambios.isLoading}
        gestoras={gestoras.data ?? []}
      />

      <Salidas
        estado={t.estado}
        anulando={anular.isPending}
        alAnular={(motivo) => anular.mutate(motivo)}
      />

      <Notas
        notas={notas.data ?? []}
        cargando={notas.isLoading}
        alAgregar={(texto) => agregarNota.mutate(texto)}
        guardando={agregarNota.isPending}
      />

      <Panel>
        <h2 className="text-lg mb-2">Historial</h2>
        <div className="flex flex-col gap-1 text-sm">
          {(eventos.data ?? []).map((e) => (
            <div key={e.id} className="flex justify-between border-b border-line py-1">
              <span>
                {e.estado_desde ? `${nombreDeEstado(e.estado_desde)} → ` : "Alta: "}
                {nombreDeEstado(e.estado_hasta)}
              </span>
              <span className="text-2xs text-ink2 tnum">{formatearFechaHora(e.at)}</span>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
