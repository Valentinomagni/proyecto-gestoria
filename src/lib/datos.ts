import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "./supabase";
import { clasificarFalla } from "./fallas";

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
// Saldos
// ------------------------------------------------------------

export function useSaldos() {
  return useQuery({
    queryKey: ["saldos"],
    queryFn: async (): Promise<Saldo[]> => {
      // ORDENADO A PROPOSITO. Sin `order`, Postgres devuelve las filas en el orden que se le
      // da la gana, y la pantalla de la Tarjeta muestra la primera: la tarjeta que se ve al
      // entrar cambiaria sola entre una carga y la siguiente. En una pantalla de plata, que el
      // numero grande de arriba sea de otra empresa que ayer es la peor forma de equivocarse,
      // porque se ve igual de bien.
      const { data, error } = await supabase.from("v_saldos").select("*").order("nombre");
      if (error) throw error;
      return (data ?? []).map((s) => ({
        tarjeta_id: String(s.tarjeta_id),
        nombre: String(s.nombre),
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
