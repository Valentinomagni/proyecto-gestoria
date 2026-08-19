import { useState } from "react";
import { ArrowLeft, Plus } from "lucide-react";
import { Panel } from "../../components/Panel";
import { SkeletonLineas } from "../../components/Skeleton";
import { aCentavos, aPesos, formatear, parsear, pesosDesdeTexto } from "../../lib/plata";
import { formatearFechaHora } from "../../lib/fechas";
import { supabase } from "../../lib/supabase";
import { BOTON, CAMPO, CAMPO_SUELTO } from "../../lib/campos";
import type { Database } from "../../lib/database.types";
import {
  useConceptos, useConceptosDelTramite, useEventosDelTramite, useGestoras,
  useGuardar, useRequisitos, useRequisitosDelTramite, useTramite,
} from "../../lib/datos";
import { Chip, nombreDeEstado } from "./Listado";

/**
 * La ficha del tramite: donde vive todo el respaldo y desde donde se avanza la cadena.
 *
 * EL BOTON ES UNO SOLO, el del paso siguiente. Nadie elige un estado de una lista: el sistema
 * sabe cual sigue. Elegir de una lista es como se saltea un paso sin querer.
 *
 * Lo que exige cada paso lo decide LA BASE, no esta pantalla. Si falta un dato, el trigger
 * devuelve el motivo escrito en castellano y `clasificarFalla` lo muestra tal cual.
 */

/** Que sigue despues de cada estado. Espeja la maquina de estados de la base. */
const SIGUIENTE: Record<string, { estado: string; boton: string } | undefined> = {
  recibido: { estado: "controlado", boton: "Marcar como controlado" },
  controlado: { estado: "entregado", boton: "Entregar a la gestora" },
  entregado: { estado: "presupuestado", boton: "Cargar el presupuesto" },
  presupuestado: { estado: "presentado", boton: "Marcar como presentado" },
  frenado_por_saldo: { estado: "presentado", boton: "Marcar como presentado" },
  presentado: { estado: "pagado", boton: "Marcar como pagado" },
  pagado: { estado: "retirado", boton: "Marcar como retirado" },
  retirado: { estado: "devuelto", boton: "Devolver a administración" },
};

export function Ficha({ id, alVolver }: { id: string; alVolver: () => void }) {
  const tramite = useTramite(id);
  const conceptos = useConceptos();
  const lineas = useConceptosDelTramite(id);
  const eventos = useEventosDelTramite(id);
  const gestoras = useGestoras();
  const requisitos = useRequisitos(tramite.data?.tipo ?? null);
  const respuestas = useRequisitosDelTramite(id);

  const [campos, setCampos] = useState<Record<string, string>>({});
  const valor = (k: string, d: string | null): string => campos[k] ?? d ?? "";
  const set = (k: string, v: string): void => setCampos((c) => ({ ...c, [k]: v }));

  const avanzar = useGuardar(
    async (nuevo: string) => {
      // El parche se arma con el tipo GENERADO desde el esquema real. Si maniana se renombra
      // una columna, esto deja de compilar en vez de fallar en produccion con un 42703.
      const parche: Database["public"]["Tables"]["tramites"]["Update"] = { estado: nuevo };
      for (const [k, v] of Object.entries(campos)) {
        const limpio = v.trim();
        if (k === "deposito_solicitado") {
          // Nunca Number(): "600.000" son seiscientos mil, no seiscientos. Ver pesosDesdeTexto.
          if (limpio === "") {
            parche.deposito_solicitado = null;
          } else {
            const pesos = pesosDesdeTexto(limpio);
            if (pesos === null) throw new Error("regla_tramite: El depósito no se entiende. Escribilo así: 600.000");
            parche.deposito_solicitado = pesos;
          }
        } else if (k === "gestora_id") {
          parche.gestora_id = limpio === "" ? null : limpio;
        } else if (k === "seccional") {
          parche.seccional = limpio === "" ? null : limpio;
        } else if (k === "numero_pago_registro") {
          parche.numero_pago_registro = limpio === "" ? null : limpio;
        } else if (k === "documentacion_retirada") {
          parche.documentacion_retirada = limpio === "" ? null : limpio;
        }
      }
      const { error } = await supabase.from("tramites").update(parche).eq("id", id);
      if (error) throw error;
      setCampos({});
    },
    { exito: "Trámite actualizado", invalidar: ["tramite", "tramites", "saldos", "tramite_eventos"] },
  );

  const agregarLinea = useGuardar(
    async (v: { conceptoId: string; momento: string; importe: number }) => {
      const { error } = await supabase.from("tramite_conceptos").insert({
        tramite_id: id, concepto_id: v.conceptoId, momento: v.momento, importe: v.importe,
      });
      if (error) throw error;
    },
    { exito: "Concepto agregado", invalidar: ["tramite_conceptos"] },
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

  if (tramite.isLoading || !tramite.data) return <SkeletonLineas cantidad={6} className="m-6 max-w-2xl" />;

  const t = tramite.data;
  const paso = SIGUIENTE[t.estado];
  const presupuesto = (lineas.data ?? []).filter((l) => l.momento === "presupuesto");
  const reales = (lineas.data ?? []).filter((l) => l.momento === "real");
  const sumaPresupuesto = presupuesto.reduce((s, l) => s + l.importe, 0);
  const sumaReal = reales.reduce((s, l) => s + l.importe, 0);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-6">
      <button type="button" onClick={alVolver} className="flex w-fit items-center gap-2 text-sm text-ink2">
        <ArrowLeft aria-hidden="true" size={14} /> Volver al listado
      </button>

      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-xl">{t.cliente_nombre}</h1>
        <Chip estado={t.estado} />
      </div>

      <Panel>
        <div className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <Dato rotulo="Referencia de la oferta" valor={t.oferta_referencia} destacado />
          <Dato rotulo="Cuenta personal" valor={t.cliente_cuenta} destacado />
          <Dato rotulo="Vehículo" valor={t.vehiculo} />
          <Dato rotulo="Dominio" valor={t.dominio} />
          <Dato rotulo="Seccional" valor={t.seccional} />
          <Dato rotulo="N° de pago" valor={t.numero_pago_registro} />
        </div>
        {t.asunto_mail ? (
          <details className="mt-3">
            <summary className="text-2xs text-ink2 cursor-pointer">Asunto original del mail</summary>
            <p className="text-2xs text-ink2 mt-1 whitespace-pre-wrap">{t.asunto_mail}</p>
          </details>
        ) : null}
      </Panel>

      {/* El paso siguiente, con lo que ese paso exige. */}
      {paso ? (
        <Panel className="flex flex-col gap-3">
          <h2 className="text-lg">Paso siguiente</h2>

          {t.estado === "recibido" && (
            <Checklist
              requisitos={requisitos.data ?? []}
              respuestas={respuestas.data ?? {}}
              alResponder={(requisitoId, respuesta) => responder.mutate({ requisitoId, respuesta })}
              alResponderTodo={() => responderTodo.mutate(undefined)}
            />
          )}

          {t.estado === "controlado" && (
            <label className="flex flex-col gap-1">
              <span className="text-xs text-ink2">Gestora *</span>
              <select
                value={valor("gestora_id", t.gestora_id)}
                onChange={(e) => set("gestora_id", e.target.value)}
                className={CAMPO}
              >
                <option value="">Elegí</option>
                {gestoras.data?.filter((g) => g.activa).map((g) => (
                  <option key={g.id} value={g.id}>{g.nombre}</option>
                ))}
              </select>
            </label>
          )}

          {t.estado === "entregado" && (
            <label className="flex flex-col gap-1">
              <span className="text-xs text-ink2">
                Depósito que se solicita * — puede ser mayor que la suma de los conceptos
              </span>
              <input
                inputMode="decimal"
                value={valor("deposito_solicitado", t.deposito_solicitado?.toString() ?? null)}
                onChange={(e) => set("deposito_solicitado", e.target.value)}
                className={CAMPO}
              />
            </label>
          )}

          {(t.estado === "presupuestado" || t.estado === "frenado_por_saldo") && (
            <label className="flex flex-col gap-1">
              <span className="text-xs text-ink2">Seccional donde se presentó *</span>
              <input
                value={valor("seccional", t.seccional)}
                onChange={(e) => set("seccional", e.target.value)}
                placeholder="19005 - Marconi 29"
                className={CAMPO}
              />
            </label>
          )}

          {t.estado === "presentado" && (
            <label className="flex flex-col gap-1">
              <span className="text-xs text-ink2">
                N° de pago del registro — no es obligatorio, pero con él la conciliación empareja sola
              </span>
              <input
                value={valor("numero_pago_registro", t.numero_pago_registro)}
                onChange={(e) => set("numero_pago_registro", e.target.value)}
                placeholder="0001420388"
                className={CAMPO}
              />
            </label>
          )}

          {t.estado === "pagado" && (
            <label className="flex flex-col gap-1">
              <span className="text-xs text-ink2">Qué documentación retiraste *</span>
              <input
                value={valor("documentacion_retirada", t.documentacion_retirada)}
                onChange={(e) => set("documentacion_retirada", e.target.value)}
                placeholder="Título, cédula y chapas"
                className={CAMPO}
              />
            </label>
          )}

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

      <Costos
        titulo="Presupuesto"
        lineas={presupuesto}
        suma={sumaPresupuesto}
        deposito={t.deposito_solicitado}
        conceptos={conceptos.data ?? []}
        alAgregar={(conceptoId, importe) => agregarLinea.mutate({ conceptoId, momento: "presupuesto", importe })}
      />

      <Costos
        titulo="Costo real"
        lineas={reales}
        suma={sumaReal}
        conceptos={conceptos.data ?? []}
        alAgregar={(conceptoId, importe) => agregarLinea.mutate({ conceptoId, momento: "real", importe })}
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


function Dato({ rotulo, valor, destacado = false }: { rotulo: string; valor: string | null; destacado?: boolean }) {
  return (
    <div>
      <p className="text-2xs text-ink2">{rotulo}</p>
      <p className={destacado ? "tnum" : ""}>{valor ?? "—"}</p>
    </div>
  );
}

function Costos({
  titulo, lineas, suma, deposito, conceptos, alAgregar,
}: {
  titulo: string;
  lineas: { id: number; concepto_id: string; importe: number }[];
  suma: number;
  deposito?: number | null;
  conceptos: { id: string; nombre: string }[];
  alAgregar: (conceptoId: string, importe: number) => void;
}) {
  const [conceptoId, setConceptoId] = useState("");
  const [importe, setImporte] = useState("");
  const nombre = (id: string): string => conceptos.find((c) => c.id === id)?.nombre ?? "";
  const diferencia = deposito === null || deposito === undefined ? null : deposito - suma;

  return (
    <Panel className="flex flex-col gap-3">
      <h2 className="text-lg">{titulo}</h2>

      {lineas.length > 0 ? (
        <div className="flex flex-col gap-1 text-sm">
          {lineas.map((l) => (
            <div key={l.id} className="flex justify-between border-b border-line py-1">
              <span>{nombre(l.concepto_id)}</span>
              <span className="tnum">{formatear(aCentavos(l.importe))}</span>
            </div>
          ))}
          <div className="flex justify-between py-1">
            <span className="text-ink2">Suma</span>
            <span className="tnum">{formatear(aCentavos(suma))}</span>
          </div>
          {diferencia !== null && (
            <div className="flex justify-between py-1">
              {/*
                La diferencia entre lo que suman las lineas y el deposito que se pide existe en
                TODAS las filas del cuaderno: GARAY suma 666.000 y pide 670.000. Si el sistema
                no la muestra, alguien va a creer que el sistema esta mal.

                LAS DOS DIRECCIONES NO SON LO MISMO, y la primera version las mostraba igual.
                De mas es lo normal y esta bien: se pide un poco de colchon porque el arancel
                real recien se sabe en la ventanilla. DE MENOS es una gestora parada en el
                registro con menos plata que la cuenta, que es exactamente el momento en el que
                este sistema tiene que haber avisado antes.

                Se vio mirando la pantalla: con el deposito mal cargado la diferencia decia
                -$ 569.400 en gris, del mismo color que todo lo demas.
              */}
              <span className="text-ink2">Diferencia con el depósito pedido</span>
              <span className={`tnum ${diferencia < 0 ? "text-warn" : ""}`}>
                {formatear(aCentavos(diferencia))}
              </span>
            </div>
          )}
          {diferencia !== null && diferencia < 0 && (
            <p className="text-2xs text-warn">
              El depósito pedido es menor que lo que suman los conceptos. Revisalo antes de
              presentar: con esta plata no alcanza para pagar.
            </p>
          )}
        </div>
      ) : (
        <p className="text-sm text-ink2">Todavía no hay conceptos cargados.</p>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <select value={conceptoId} onChange={(e) => setConceptoId(e.target.value)} className={CAMPO_SUELTO}>
          <option value="">Concepto</option>
          {conceptos.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
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
          disabled={conceptoId === "" || parsear(importe) === null}
          onClick={() => {
            const c = parsear(importe);
            if (c === null) return;
            alAgregar(conceptoId, aPesos(c));
            setImporte("");
            setConceptoId("");
          }}
          className="flex items-center gap-1 rounded-md border border-line px-3 py-2 text-sm disabled:opacity-50"
        >
          <Plus aria-hidden="true" size={14} /> Agregar
        </button>
      </div>
    </Panel>
  );
}

/**
 * ============================================================================
 *  EL CHECKLIST DEL LEGAJO, con las TRES respuestas que tiene la base.
 * ============================================================================
 *
 *  ESTE COMPONENTE NACIO DE UN DEFECTO QUE SE VIO MIRANDO LA PANTALLA, no testeando.
 *
 *  La primera version tenia un solo boton, "marcar los 4 requisitos como presentes", justo
 *  debajo de un texto que decia "una falta registrada sirve". O sea: la pantalla prometia un
 *  control y entregaba un sello de goma. No habia ninguna forma de anotar que algo faltaba,
 *  que es EXACTAMENTE el dato que hace falta despues, cuando el tramite vuelve del registro
 *  rechazado y nadie se acuerda si el formulario 08 estaba o no.
 *
 *  Una pantalla que dice una cosa y hace otra es peor que una que no dice nada: la primera
 *  ademas enseña a no leerla.
 *
 *  POR QUE TRES RESPUESTAS Y NO UN TILDE. Lo dice el comentario de la columna en la base: un
 *  checklist que bloquea por un requisito que no corresponde se termina tildando en falso, y
 *  ahi deja de ser un control y pasa a ser una mentira prolija.
 *
 *  EL ATAJO SE QUEDA, y abajo. El caso comun es que venga todo, y el alta entera tiene que
 *  entrar en veinte segundos o vuelve el cuaderno. Pero deja de ser la UNICA opcion, que es lo
 *  que lo volvia un sello.
 */
const RESPUESTAS = [
  { valor: "si", nombre: "Está" },
  { valor: "no", nombre: "Falta" },
  { valor: "no_aplica", nombre: "No corresponde" },
];

function Checklist({
  requisitos, respuestas, alResponder, alResponderTodo,
}: {
  requisitos: { id: string; nombre: string }[];
  respuestas: Record<string, { respuesta: string; nota: string | null }>;
  alResponder: (requisitoId: string, respuesta: string) => void;
  alResponderTodo: () => void;
}) {
  const contestados = requisitos.filter((r) => respuestas[r.id] !== undefined).length;
  const faltan = requisitos.filter((r) => respuestas[r.id]?.respuesta === "no");

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-ink2">
        Antes de pasar a gestoría hay que contestar el checklist del legajo. Se exige
        contestado, no que todo esté: una falta registrada sirve, una casilla tildada en falso
        no.
      </p>

      <div className="flex flex-col">
        {requisitos.map((r) => {
          const actual = respuestas[r.id]?.respuesta;
          return (
            <div
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-line py-2"
            >
              <span className={`text-sm ${actual === undefined ? "" : "text-ink2"}`}>{r.nombre}</span>
              <div className="flex gap-1">
                {RESPUESTAS.map((op) => (
                  <button
                    key={op.valor}
                    type="button"
                    onClick={() => alResponder(r.id, op.valor)}
                    aria-pressed={actual === op.valor}
                    className={`rounded-md border px-2 py-1 text-xs ${
                      actual === op.valor
                        ? op.valor === "no" ? "border-warn text-warn" : "border-ink"
                        : "border-line text-ink2"
                    }`}
                  >
                    {op.nombre}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/*
        El contador dice lo que FALTA, no lo que ya se hizo. "Contestaste 3" invita a seguir de
        largo; "falta contestar 1" dice exactamente que hacer y cuanto queda.
      */}
      <p className="text-xs text-ink2 tnum">
        {contestados === requisitos.length
          ? `Contestados los ${requisitos.length}`
          : `Falta contestar ${requisitos.length - contestados} de ${requisitos.length}`}
      </p>

      {faltan.length > 0 && (
        <p className="text-xs text-warn">
          Anotado que falta: {faltan.map((r) => r.nombre).join(", ")}. El trámite igual avanza —
          queda escrito para cuando alguien pregunte por qué volvió.
        </p>
      )}

      {contestados < requisitos.length && (
        <button
          type="button"
          onClick={alResponderTodo}
          className="w-fit rounded-md border border-line px-3 py-2 text-xs text-ink2"
        >
          Vino todo: marcar los {requisitos.length} como presentes
        </button>
      )}
    </div>
  );
}
