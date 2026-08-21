import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "./supabase";
import { clasificarFalla } from "./fallas";
import { recordado, recordar } from "./recordar";
import {
  CLAVE_VISTO, contarSinVer, hastaDondeMarcar, sumarNovedad, type Novedad,
} from "./novedades";
import type { Plazo } from "./plazos";

/**
 * Las consultas a la base, en un solo lugar.
 *
 * REGLA: ningun componente arma su propia consulta. Cuando la misma consulta vive en tres
 * pantallas, se separan sin que nadie lo decida — es lo mismo que paso con las tarjetas
 * copiadas a mano en el Tablero, pero con datos.
 */

export interface RazonSocial { id: string; nombre: string; tarjeta_id: string | null; orden: number }
export interface Sucursal { id: string; nombre: string; gestionada_por: string }
export interface Gestora { id: string; nombre: string; perfil_id: string | null; activa: boolean }
export interface Concepto { id: string; nombre: string; orden: number }
export interface Tarjeta { id: string; nombre: string; orden: number }
export interface Requisito { id: string; nombre: string; aplica_a: string; orden: number }

export interface Saldo {
  tarjeta_id: string;
  nombre: string;
  /** Por uso, no alfabetico. La pantalla abre en la primera. */
  orden: number;
  contable: number;
  en_transito: number;
  comprometido: number;
}

export interface Tramite {
  id: string;
  razon_social_id: string;
  sucursal_id: string;
  tipo: string;
  subtipo: string | null;
  estado: string;
  cliente_nombre: string;
  cliente_cuenta: string | null;
  vehiculo: string | null;
  oferta_referencia: string | null;
  asunto_mail: string | null;
  dominio: string | null;
  gestora_id: string | null;
  medio_pago: string;
  tarjeta_id: string | null;
  deposito_solicitado: number | null;
  seccional: string | null;
  numero_pago_registro: string | null;
  documentacion_entregada: string | null;
  documentacion_retirada: string | null;
  observaciones: string | null;
  observaciones_gestora: string | null;
  motivo_frenado: string | null;
  motivo_anulacion: string | null;
  recibido_at: string;
  presentado_at: string | null;
  pagado_at: string | null;
  /** Quien de administracion quedo a cargo. Texto libre; ver la migracion. */
  administrativo: string | null;
  // Las tres ocurren FUERA del sistema y las carga una persona. Ver la migracion del reloj.
  certificacion_primera_firma: string | null;
  verificacion_policial: string | null;
  factura_fecha: string | null;
}

/** Los importes llegan de PostgREST como texto o numero segun la version. Se normaliza acá. */
function aNumero(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "") return Number(v);
  return 0;
}

// ------------------------------------------------------------
// Catalogos. Cambian muy poco, asi que se cachean largo.
// ------------------------------------------------------------

const CATALOGO = { staleTime: 10 * 60_000 };

export function useRazonesSociales() {
  return useQuery({
    queryKey: ["razones_sociales"],
    ...CATALOGO,
    queryFn: async (): Promise<RazonSocial[]> => {
      const { data, error } = await supabase
        .from("razones_sociales").select("id, nombre, tarjeta_id, orden")
        .eq("activa", true).order("orden");
      if (error) throw error;
      return data;
    },
  });
}

export function useSucursales() {
  return useQuery({
    queryKey: ["sucursales"],
    ...CATALOGO,
    queryFn: async (): Promise<Sucursal[]> => {
      const { data, error } = await supabase
        .from("sucursales").select("id, nombre, gestionada_por").eq("activa", true).order("nombre");
      if (error) throw error;
      return data;
    },
  });
}

export function useGestoras() {
  return useQuery({
    queryKey: ["gestoras"],
    ...CATALOGO,
    queryFn: async (): Promise<Gestora[]> => {
      const { data, error } = await supabase
        .from("gestoras").select("id, nombre, perfil_id, activa").order("nombre");
      if (error) throw error;
      return data;
    },
  });
}

export function useConceptos() {
  return useQuery({
    queryKey: ["conceptos"],
    ...CATALOGO,
    queryFn: async (): Promise<Concepto[]> => {
      const { data, error } = await supabase
        .from("conceptos").select("id, nombre, orden").eq("activo", true).order("orden");
      if (error) throw error;
      return data;
    },
  });
}

export function useTarjetas() {
  return useQuery({
    queryKey: ["tarjetas"],
    ...CATALOGO,
    queryFn: async (): Promise<Tarjeta[]> => {
      const { data, error } = await supabase
        .from("tarjetas_habitualista").select("id, nombre, orden").eq("activa", true).order("orden");
      if (error) throw error;
      return data;
    },
  });
}

/**
 * Los administrativos que ya se usaron alguna vez, para sugerirlos al cargar.
 *
 * ES LO UNICO QUE SE PUEDE HACER CONTRA UN TEXTO LIBRE. No impide escribir cualquier cosa —el
 * campo sigue siendo libre a proposito, porque la lista de personas todavia no esta cerrada—
 * pero empuja a repetir la forma en vez de inventarla. Sin esto, el mismo nombre entra escrito
 * de tres maneras y despues no se puede filtrar por el.
 *
 * El tope de 500 no es arbitrario: alcanza de sobra para juntar los nombres distintos que hay,
 * y evita traerse la tabla entera para armar una lista de sugerencias.
 */
export function useAdministrativos() {
  return useQuery({
    queryKey: ["administrativos"],
    ...CATALOGO,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from("tramites")
        .select("administrativo")
        .not("administrativo", "is", null)
        .limit(500);
      if (error) throw error;

      const nombres = new Set(
        (data ?? []).map((t) => String(t.administrativo).trim()).filter((n) => n !== ""),
      );
      return [...nombres].toSorted();
    },
  });
}

export function useRequisitos(tipo: string | null) {
  return useQuery({
    queryKey: ["requisitos", tipo],
    enabled: tipo !== null,
    ...CATALOGO,
    queryFn: async (): Promise<Requisito[]> => {
      const { data, error } = await supabase
        .from("requisitos").select("id, nombre, aplica_a, orden")
        .eq("activo", true).in("aplica_a", [tipo ?? "", "todos"]).order("orden");
      if (error) throw error;
      return data;
    },
  });
}

// ------------------------------------------------------------
// El calendario y los plazos
// ------------------------------------------------------------

/**
 * ============================================================================
 *  EL CALENDARIO: los feriados, y HASTA DONDE alguien dijo que llegan.
 * ============================================================================
 *
 *  `cubreHasta` NO se deduce mirando qué feriados hay cargados: SE DECLARA. Sale del parámetro
 *  `calendario_cubre_hasta`, que completa quien terminó de cargar un año.
 *
 *  POR QUE, y esto se corrigió después de escribirlo mal la primera vez: la versión anterior
 *  tomaba el año del último feriado cargado y asumía que ese año estaba completo. Si faltaban
 *  feriados —y siempre faltan, porque los puentes turísticos se fijan por decreto cada año— el
 *  vencimiento salía ANTES de lo real. O sea que el error iba justo para el lado que hace daño:
 *  dar por vencido algo que todavía no venció.
 *
 *  Un dato que declara una persona vale más que uno que deduce un programa, cuando lo que está
 *  en juego es si una fecha se muestra o no. Mientras el parámetro esté vacío, ningún plazo en
 *  días hábiles produce vencimiento y la pantalla dice que faltan los feriados.
 */
export function useCalendario() {
  return useQuery({
    queryKey: ["calendario"],
    ...CATALOGO,
    queryFn: async (): Promise<{ feriados: ReadonlySet<string>; cubreHasta: string | null }> => {
      const [dias, parametro] = await Promise.all([
        supabase.from("feriados").select("fecha").order("fecha"),
        supabase.from("parametros").select("valor").eq("clave", "calendario_cubre_hasta").maybeSingle(),
      ]);
      if (dias.error) throw dias.error;
      if (parametro.error) throw parametro.error;

      const declarado = (parametro.data?.valor ?? "").trim();
      return {
        feriados: new Set((dias.data ?? []).map((f) => String(f.fecha))),
        cubreHasta: declarado === "" ? null : declarado,
      };
    },
  });
}

/** SOLO los plazos verificados: la vista no tiene los otros. Ver la migración de plazos. */
export function usePlazos() {
  return useQuery({
    queryKey: ["plazos_usables"],
    ...CATALOGO,
    queryFn: async (): Promise<Plazo[]> => {
      const { data, error } = await supabase
        .from("v_plazos_usables")
        .select("clave, nombre, aplica_a, desde, dias, habiles, consecuencia, norma, verificado_el, verificado_por");
      if (error) throw error;
      return (data ?? [])
        .filter((p) => p.clave !== null && p.verificado_el !== null && p.verificado_por !== null)
        .map((p) => ({
          clave: String(p.clave),
          nombre: String(p.nombre),
          aplica_a: String(p.aplica_a),
          desde: String(p.desde),
          dias: Number(p.dias),
          habiles: Boolean(p.habiles),
          consecuencia: String(p.consecuencia),
          norma: p.norma,
          verificado_el: String(p.verificado_el),
          verificado_por: String(p.verificado_por),
        }));
    },
  });
}

// ------------------------------------------------------------
// Saldos
// ------------------------------------------------------------

export function useSaldos() {
  return useQuery({
    queryKey: ["saldos"],
    queryFn: async (): Promise<Saldo[]> => {
      // ============================================================================
      //  ORDENADO POR USO, NO POR NOMBRE
      // ============================================================================
      //
      // La pantalla abre en la primera de la lista. Ordenando por nombre abria en Doral
      // Chevrolet, y las que mas se usan son Paris Autos y Paris Cars: la pantalla que se mira
      // treinta veces por dia arrancaba siempre en la tarjeta equivocada.
      //
      // El orden lo decide la base, en la columna `orden` de `tarjetas_habitualista`, para que
      // se pueda cambiar sin tocar codigo. Antes de eso ordenaba por nombre por una razon que
      // sigue siendo valida: SIN `order` Postgres devuelve las filas en cualquier orden, y la
      // tarjeta que se ve al entrar cambiaria sola entre una carga y la siguiente.
      const { data, error } = await supabase.from("v_saldos").select("*").order("orden");
      if (error) throw error;
      return (data ?? []).map((s) => ({
        tarjeta_id: String(s.tarjeta_id),
        nombre: String(s.nombre),
        orden: Number(s.orden),
        contable: aNumero(s.contable),
        en_transito: aNumero(s.en_transito),
        comprometido: aNumero(s.comprometido),
      }));
    },
  });
}

/**
 * El saldo se entera solo cuando otro lo mueve.
 *
 * ES LA FUNCION CENTRAL DEL PRODUCTO, no un adorno: el pedido dice que "muchas veces se pisan
 * con el dinero que hay disponible en el dia". TanStack Query solo no alcanza —refresca cuando
 * la pestania vuelve al foco, no cuando la otra persona carga un movimiento—. Con esto, si
 * gerencia carga un ingreso en San Juan, el saldo de contable en San Luis cambia sin recargar.
 */
export function useSaldosEnVivo(cliente: QueryClient): void {
  useEffect(() => {
    const canal = supabase
      .channel("movimientos-en-vivo")
      .on("postgres_changes", { event: "*", schema: "public", table: "movimientos" }, () => {
        void cliente.invalidateQueries({ queryKey: ["saldos"] });
        void cliente.invalidateQueries({ queryKey: ["movimientos"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "tramites" }, () => {
        void cliente.invalidateQueries({ queryKey: ["tramites"] });
        void cliente.invalidateQueries({ queryKey: ["saldos"] });
      })
      .subscribe();
    return () => void supabase.removeChannel(canal);
  }, [cliente]);
}

/**
 * La campana: los pasos de la cadena que movieron OTROS, en vivo.
 *
 * Vive acá y no en `novedades.ts` porque toca la base, igual que `useSaldosEnVivo`. Las dos
 * decisiones que se pueden equivocar —qué es nuevo y hasta dónde marcar— viven allá, sin
 * dependencias, para poder probarlas sin credenciales.
 */
export function useNovedades(miId: string | null): {
  lista: Novedad[];
  sinVer: number;
  marcarVistas: () => void;
} {
  const [lista, setLista] = useState<Novedad[]>([]);
  const [visto, setVisto] = useState<string | null>(() => recordado(CLAVE_VISTO));

  useEffect(() => {
    if (miId === null) return;

    const canal = supabase
      .channel("novedades")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "tramite_eventos" },
        (msg) => {
          const e = msg.new as {
            id: number; tramite_id: string; estado_hasta: string; at: string; por?: string | null;
          };
          // Los cambios propios no se avisan: quien lo movió ya sabe que lo movió.
          if (e.por === miId) return;

          setLista((antes) =>
            sumarNovedad(antes, {
              id: Number(e.id),
              tramiteId: String(e.tramite_id),
              estado: String(e.estado_hasta),
              cuando: String(e.at),
            }),
          );
        },
      )
      .subscribe();

    return () => void supabase.removeChannel(canal);
  }, [miId]);

  const marcarVistas = useCallback(() => {
    const hasta = hastaDondeMarcar(lista, visto);
    if (hasta === null) return;
    setVisto(hasta);
    recordar(CLAVE_VISTO, hasta);
  }, [lista, visto]);

  return { lista, sinVer: contarSinVer(lista, visto), marcarVistas };
}

export function useMovimientos(tarjetaId: string | null) {
  return useQuery({
    queryKey: ["movimientos", tarjetaId],
    enabled: tarjetaId !== null,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("movimientos")
        .select("id, fecha, fecha_acreditacion, tipo, importe, concepto, observacion")
        .eq("tarjeta_id", tarjetaId ?? "")
        .order("fecha", { ascending: false })
        .order("id", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []).map((m) => Object.assign(m, { importe: aNumero(m.importe) }));
    },
  });
}

// ------------------------------------------------------------
// Tramites
// ------------------------------------------------------------

export function useTramites(filtros: { estado?: string; buscar?: string } = {}) {
  return useQuery({
    queryKey: ["tramites", filtros],
    queryFn: async (): Promise<Tramite[]> => {
      let q = supabase.from("tramites").select("*").order("recibido_at", { ascending: false }).limit(300);
      if (filtros.estado) q = q.eq("estado", filtros.estado);
      if (filtros.buscar && filtros.buscar.trim() !== "") {
        const b = `%${filtros.buscar.trim()}%`;
        // Una sola caja que busca en los cuatro campos con los que se ubica un tramite.
        q = q.or(
          `cliente_nombre.ilike.${b},dominio.ilike.${b},oferta_referencia.ilike.${b},cliente_cuenta.ilike.${b}`,
        );
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).map((t) =>
        Object.assign(t, {
          deposito_solicitado: t.deposito_solicitado === null ? null : aNumero(t.deposito_solicitado),
        }),
      ) as Tramite[];
    },
  });
}

export function useTramite(id: string | null) {
  return useQuery({
    queryKey: ["tramite", id],
    enabled: id !== null,
    queryFn: async (): Promise<Tramite> => {
      const { data, error } = await supabase.from("tramites").select("*").eq("id", id ?? "").single();
      if (error) throw error;
      return Object.assign(data, {
        deposito_solicitado: data.deposito_solicitado === null ? null : aNumero(data.deposito_solicitado),
      }) as Tramite;
    },
  });
}

export function useConceptosDelTramite(tramiteId: string | null) {
  return useQuery({
    queryKey: ["tramite_conceptos", tramiteId],
    enabled: tramiteId !== null,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tramite_conceptos")
        .select("id, concepto_id, momento, importe")
        .eq("tramite_id", tramiteId ?? "");
      if (error) throw error;
      return (data ?? []).map((c) => Object.assign(c, { importe: aNumero(c.importe) }));
    },
  });
}

export function useRequisitosDelTramite(tramiteId: string | null) {
  return useQuery({
    queryKey: ["tramite_requisitos", tramiteId],
    enabled: tramiteId !== null,
    queryFn: async (): Promise<Record<string, { respuesta: string; nota: string | null }>> => {
      const { data, error } = await supabase
        .from("tramite_requisitos")
        .select("requisito_id, respuesta, nota")
        .eq("tramite_id", tramiteId ?? "");
      if (error) throw error;
      const porId: Record<string, { respuesta: string; nota: string | null }> = {};
      for (const r of data ?? []) porId[r.requisito_id] = { respuesta: r.respuesta, nota: r.nota };
      return porId;
    },
  });
}

/**
 * Las notas del trámite, con el nombre de quien las escribió.
 *
 * Sale de `v_tramite_notas` y no de la tabla: una gestora sólo puede leer SU perfil, así que
 * leyendo la tabla directo las notas de las demás salían sin nombre. La vista pone el nombre
 * con un helper que devuelve únicamente eso, y mantiene la RLS de las notas intacta.
 */
export interface Nota {
  id: number;
  texto: string;
  creado_at: string | null;
  autor_nombre: string | null;
}

export function useNotasDelTramite(tramiteId: string | null) {
  return useQuery({
    queryKey: ["tramite_notas", tramiteId],
    enabled: tramiteId !== null,
    queryFn: async (): Promise<Nota[]> => {
      const { data, error } = await supabase
        .from("v_tramite_notas")
        .select("id, texto, creado_at, autor_nombre")
        .eq("tramite_id", tramiteId ?? "")
        .order("creado_at", { ascending: false });
      if (error) throw error;

      // Los tipos de una VISTA salen todos anulables: Postgres no puede garantizar que una
      // columna de una vista no sea nula, aunque en la tabla de abajo sea `not null`. Se
      // normaliza acá, en el borde, y la pantalla recibe la forma que espera.
      return (data ?? [])
        .filter((n): n is typeof n & { id: number; texto: string } =>
          n.id !== null && n.texto !== null)
        .map((n) => ({
          id: n.id,
          texto: n.texto,
          creado_at: n.creado_at,
          autor_nombre: n.autor_nombre,
        }));
    },
  });
}

export interface CambioDelTramite {
  id: number;
  /** `deposito`, `concepto` o `dato`. Decide como se lee la linea en pantalla. */
  que: string;
  /** Que columna cambio, cuando `que` es `dato`. Su nombre en castellano lo pone el front. */
  campo: string | null;
  antes: string | null;
  despues: string | null;
  cuando: string;
  quien_nombre: string | null;
}

/**
 * Todos los cambios de un tramite: quien, cuando, y de que a que.
 *
 * NO ES SOLO DEL PRESUPUESTO desde el 21/08/2026. La tabla se llamaba `presupuesto_historial` y
 * registraba el deposito y los conceptos; ahora se llama `tramite_cambios` y un trigger le suma
 * CUALQUIER columna del tramite que cambie, comparando por diferencia de jsonb. Una columna que
 * se agregue maniana queda registrada por defecto.
 *
 * EL NOMBRE SE PIDE APARTE Y NO CON UN EMBED. La policy de `perfiles` deja que una gestora lea
 * solo su propia fila, asi que un embed le devolveria null para los cambios de sus companieras
 * — y un historial con nombres vacios no sirve para repreguntar, que es para lo unico que se
 * mira. Es el mismo problema que ya tuvieron las notas, resuelto igual: una funcion que
 * devuelve UNICAMENTE el nombre.
 */
export function useCambios(tramiteId: string | null) {
  return useQuery({
    queryKey: ["tramite_cambios", tramiteId],
    enabled: tramiteId !== null,
    queryFn: async (): Promise<CambioDelTramite[]> => {
      const { data, error } = await supabase
        .from("tramite_cambios")
        .select("id, que, campo, antes, despues, cuando, quien")
        .eq("tramite_id", tramiteId ?? "")
        .order("cuando", { ascending: false })
        // `id desc` como desempate: dos cambios de la misma guardada tienen la misma hora al
        // milisegundo, y sin esto el listado se reordena solo al recargar y parece que cambio algo.
        .order("id", { ascending: false });
      if (error) throw error;

      const ids = [...new Set((data ?? []).map((c) => c.quien).filter((q): q is string => q !== null))];
      const nombres = new Map<string, string>();
      if (ids.length > 0) {
        const { data: gente } = await supabase.rpc("nombres_de", { personas: ids });
        for (const p of (gente ?? []) as { id: string; nombre: string }[]) nombres.set(p.id, p.nombre);
      }

      return (data ?? []).map((c) => ({
        id: Number(c.id),
        que: String(c.que),
        campo: c.campo,
        antes: c.antes,
        despues: c.despues,
        cuando: String(c.cuando),
        quien_nombre: c.quien === null ? null : (nombres.get(c.quien) ?? null),
      }));
    },
  });
}

export function useEventosDelTramite(tramiteId: string | null) {
  return useQuery({
    queryKey: ["tramite_eventos", tramiteId],
    enabled: tramiteId !== null,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tramite_eventos")
        .select("id, estado_desde, estado_hasta, rol_al_momento, at")
        .eq("tramite_id", tramiteId ?? "")
        .order("at");
      if (error) throw error;
      return data ?? [];
    },
  });
}

/**
 * Toda escritura pasa por aca, y por eso el error se traduce en un solo lugar.
 *
 * Ningun mensaje crudo de la base llega a la pantalla: pasa por clasificarFalla, que ademas
 * traduce los mensajes que los triggers marcan con `regla_tramite:` — que son los que estan
 * escritos PARA una persona.
 */
export function useGuardar<T>(
  fn: (v: T) => Promise<void>,
  opciones: { exito: string; invalidar: string[] },
) {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      toast.success(opciones.exito);
      for (const k of opciones.invalidar) void cliente.invalidateQueries({ queryKey: [k] });
    },
    onError: (e: unknown) => {
      const falla = clasificarFalla(e, navigator.onLine);
      toast.error(falla.titulo, { description: falla.explicacion });
    },
  });
}
