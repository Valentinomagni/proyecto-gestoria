import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "./supabase";
import type { Accion, Bloque, FilaDeCola } from "./cola";
import { clasificarFalla } from "./fallas";
import { recordado, recordar } from "./recordar";
import {
  CLAVE_VISTO,
  contarSinVer,
  hastaDondeMarcar,
  sumarNovedad,
  type Novedad,
} from "./novedades";

/**
 * Las consultas a la base, en un solo lugar.
 *
 * REGLA: ningun componente arma su propia consulta. Cuando la misma consulta vive en tres
 * pantallas, se separan sin que nadie lo decida — es lo mismo que paso con las tarjetas
 * copiadas a mano en el Tablero, pero con datos.
 */

export interface RazonSocial {
  id: string;
  nombre: string;
  tarjeta_id: string | null;
  orden: number;
}
export interface Sucursal {
  id: string;
  nombre: string;
  gestionada_por: string;
}
export interface Gestora {
  id: string;
  nombre: string;
  perfil_id: string | null;
  activa: boolean;
}
export interface Concepto {
  id: string;
  nombre: string;
  orden: number;
}
export interface Tarjeta {
  id: string;
  nombre: string;
  orden: number;
}
export interface Requisito {
  id: string;
  nombre: string;
  aplica_a: string;
  orden: number;
  /** `documento` (Está / Falta / No corresponde) o `si_no` (Sí / No). Ver el Checklist. */
  tipo: string;
}

export interface Saldo {
  tarjeta_id: string;
  nombre: string;
  /** Por uso, no alfabetico. La pantalla abre en la primera. */
  orden: number;
  contable: number;
  en_transito: number;
  comprometido: number;
  /**
   * ============================================================================
   *  CUANTOS MOVIMIENTOS HAY. NO SIRVE PARA DECIDIR SI SE MUESTRAN
   * ============================================================================
   *
   * La vista hace `left join` y `coalesce(...,0)`, asi que una tarjeta cuyos movimientos NO SE
   * PUEDEN LEER sale con los mismos ceros que una que de verdad esta vacia. El 27/08/2026 toda
   * gestora veia las cinco tarjetas en `$ 0,00` —no "sin datos", CERO, que es un numero y se lee
   * como un hecho— y concluia que no podia salir a pagar. Paris Autos tenia ocho millones y medio.
   *
   * DECIDIR CON `> 0` FUE EL ARREGLO DE ESE DIA, Y ESTABA MAL: una tarjeta vacia cuenta cero
   * igual que una prohibida, asi que el 28/08/2026 gerencia abria Doral Chevrolet y leia "No
   * podes ver los movimientos de esta tarjeta". Para eso esta `puedo_ver`.
   *
   * Este numero sirve para lo otro: separar "vacia" de "con movimientos" DENTRO de lo que ya se
   * puede ver, para poder decir "todavia no hay movimientos" en vez de dibujar una lista vacia.
   */
  movimientos_visibles: number;
  /**
   * Si esta persona puede leer los movimientos de esta tarjeta.
   *
   * Lo contesta la base con los mismos helpers que usa la policy — la unica fuente que no se
   * puede desincronizar de ella. Es lo UNICO que la pantalla mira para decidir si muestra
   * importes o dice que no los ve.
   */
  puedo_ver: boolean;
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

/**
 * Los importes llegan de PostgREST como texto o numero segun la version. Se normaliza acá.
 *
 * SE EXPORTA para que `resumen.ts` lea las cifras de la misma forma. Tener dos normalizaciones de
 * importes conviviendo es como una empieza a redondear distinto que la otra, y despues dos
 * pantallas del mismo sistema muestran cifras que no coinciden por un centavo.
 */
export function aNumero(v: unknown): number {
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
        .from("razones_sociales")
        .select("id, nombre, tarjeta_id, orden")
        .eq("activa", true)
        .order("orden");
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
        .from("sucursales")
        .select("id, nombre, gestionada_por")
        .eq("activa", true)
        .order("nombre");
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
        .from("gestoras")
        .select("id, nombre, perfil_id, activa")
        .order("nombre");
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
        .from("conceptos")
        .select("id, nombre, orden")
        .eq("activo", true)
        .order("orden");
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
        .from("tarjetas_habitualista")
        .select("id, nombre, orden")
        .eq("activa", true)
        .order("orden");
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
        // `tipo` decide COMO se contesta: un papel del legajo se contesta Esta / Falta / No
        // corresponde, y un hecho de la operacion —hay accesorios, hay usado— se contesta Si o No.
        .from("requisitos")
        .select("id, nombre, aplica_a, orden, tipo")
        .eq("activo", true)
        .in("aplica_a", [tipo ?? "", "todos"])
        .order("orden");
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
        supabase
          .from("parametros")
          .select("valor")
          .eq("clave", "calendario_cubre_hasta")
          .maybeSingle(),
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

/*
  ACA VIVIA `usePlazos`, que traia los plazos confirmados para calcular los vencimientos de un
  tramite. Ese panel se saco de la ficha el 21/08/2026.

  Administracion sigue confirmando plazos, con su propia consulta (`usePlazosTodos`, en
  Calendario.tsx): ahi hacen falta TODOS, tambien los sin confirmar, porque justamente lo que
  esa pantalla hace es confirmarlos. La vista `v_plazos_usables` sigue existiendo en la base.
*/

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
        movimientos_visibles: aNumero(s.movimientos_visibles),
        // `=== true` explicito: un `undefined` por una columna que falte no debe leerse como "no".
        puedo_ver: s.puedo_ver === true,
      }));
    },
  });
}

/** Un tramite presupuestado cuya tarjeta no cubre lo comprometido. */
export type EsperandoPlata = {
  tramite_id: string;
  cliente_nombre: string;
  oferta_referencia: string | null;
  tarjeta_id: string;
  pide: number;
  falta: number;
};

/**
 * ============================================================================
 *  QUIEN ESTA ESPERANDO PLATA. NADIE LO MARCA: SE DEDUCE.
 * ============================================================================
 *
 * Antes esto era un estado, `frenado_por_saldo`, que alguien tenia que marcar y sobre todo
 * DESMARCAR cuando entraba el deposito. El desmarcado es el que se olvidaba, asi que la pantalla
 * decia que estaba detenido algo que ya podia salir.
 *
 * Ahora sale de `v_esperando_plata`, que compara la tarjeta contra lo comprometido. Si entra
 * plata, el tramite se cae de esta lista solo.
 *
 * `falta` ES DE LA TARJETA Y NO DEL TRAMITE, y por eso se repite en todas las filas de la misma
 * tarjeta. La plata es de la tarjeta y se la reparten todos los presupuestos vivos: si hay tres
 * tramites de 60 contra un saldo de 100, ninguno de los tres sale tranquilo aunque cualquiera de
 * ellos entre solo. Lo que hay que depositar es la diferencia de la tarjeta, UNA VEZ, y no la
 * suma de lo que pide cada uno.
 *
 * La invalida el mismo canal en vivo que los saldos: si no, entraria el deposito y la lista
 * seguiria mostrando gente esperando — que es exactamente el defecto que esto vino a arreglar.
 */
export function useEsperandoPlata() {
  return useQuery({
    queryKey: ["esperando_plata"],
    queryFn: async (): Promise<EsperandoPlata[]> => {
      const { data, error } = await supabase
        .from("v_esperando_plata")
        .select("tramite_id, cliente_nombre, oferta_referencia, tarjeta_id, pide, falta")
        .order("presupuestado_at");
      if (error) throw error;
      return (data ?? []).map((t) => ({
        tramite_id: String(t.tramite_id),
        cliente_nombre: String(t.cliente_nombre),
        oferta_referencia: t.oferta_referencia,
        tarjeta_id: String(t.tarjeta_id),
        pide: aNumero(t.pide),
        falta: aNumero(t.falta),
      }));
    },
  });
}

/**
 * La cola de la gestora: sus trámites con el bloque y la acción ya decididos.
 *
 * EL HOOK VIVE ACA Y LA LOGICA EN `cola.ts`, igual que `useNovedades` con `novedades.ts`. Lo que
 * se puede equivocar —el orden de los bloques, qué botón va en cada acción, cómo se agrupa— vive
 * allá SIN DEPENDENCIAS, para poder probarlo sin credenciales. Tenerlo todo junto hacía que
 * `cola.test.ts` cargara el cliente de Supabase, y el guardián de pruebas lo marcó en rojo.
 */
export function useCola() {
  return useQuery({
    queryKey: ["cola"],
    queryFn: async (): Promise<FilaDeCola[]> => {
      /*
        EL SELECT VA EN UNA SOLA CADENA LITERAL, sin partirla con `+`: supabase-js infiere los
        tipos leyendo ese literal, y una concatenacion lo deja en `GenericStringError` — o sea que
        se pierde el chequeo de tipos justo en la consulta que trae plata.
      */
      const { data, error } = await supabase
        .from("v_cola_de_gestora")
        .select(
          "tramite_id, cliente_nombre, dominio, oferta_referencia, empresa, razon_social_id, tarjeta_id, estado, bloque, accion, pide, falta, desde",
        );
      if (error) throw error;
      return (data ?? []).map((f) => ({
        tramite_id: String(f.tramite_id),
        cliente_nombre: String(f.cliente_nombre),
        dominio: f.dominio === null ? null : String(f.dominio),
        oferta_referencia: f.oferta_referencia === null ? null : String(f.oferta_referencia),
        empresa: String(f.empresa),
        razon_social_id: String(f.razon_social_id),
        tarjeta_id: f.tarjeta_id === null ? null : String(f.tarjeta_id),
        estado: String(f.estado),
        bloque: f.bloque as Bloque,
        accion: f.accion as Accion,
        // En PESOS, como los manda la base. Se convierten con `aCentavos` al dibujar: la razon
        // entera, y lo que costo, esta en el tipo `FilaDeCola`.
        pide: aNumero(f.pide),
        falta: aNumero(f.falta),
        desde: f.desde === null ? null : String(f.desde),
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
        /*
          LA LISTA DE QUIEN ESPERA PLATA SE VA CON EL MISMO GOLPE que el saldo, y no es un extra.

          Si no se invalidara, entraria el deposito, el saldo subiria en pantalla, y la lista
          seguiria mostrando gente esperando plata que ya esta. Eso es EXACTAMENTE el defecto que
          esta lista vino a arreglar: `frenado_por_saldo` fallaba porque nadie se acordaba de
          desmarcar. Dejarla sin invalidar seria reponer el mismo defecto con otra forma.
        */
        void cliente.invalidateQueries({ queryKey: ["esperando_plata"] });
        /*
          Y EL RESUMEN TAMBIEN, por lo mismo. Si contable carga un deposito en San Luis, la
          pantalla de las cinco empresas tiene que cambiar en San Juan sin que nadie recargue.
          Dejarlo afuera dejaria al resumen mostrando un numero viejo mientras la empresa, un
          nivel mas adentro, muestra el nuevo: dos pantallas del mismo sistema diciendo cosas
          distintas de la misma plata.
        */
        void cliente.invalidateQueries({ queryKey: ["resumen"] });
        /*
          Y LA COLA DE LA GESTORA, que es donde el deposito se convierte en un boton.

          Sin esto la plata entra, el saldo de arriba sube, y la tarjeta sigue en "esperando a la
          oficina": la misma pantalla diciendo dos cosas distintas de la misma plata. Es el
          defecto de `frenado_por_saldo` —que alguien tenia que desmarcar a mano— reaparecido con
          otra forma.
        */
        void cliente.invalidateQueries({ queryKey: ["cola"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "tramites" }, () => {
        void cliente.invalidateQueries({ queryKey: ["tramites"] });
        void cliente.invalidateQueries({ queryKey: ["saldos"] });
        void cliente.invalidateQueries({ queryKey: ["esperando_plata"] });
        void cliente.invalidateQueries({ queryKey: ["resumen"] });
        void cliente.invalidateQueries({ queryKey: ["cola"] });
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
            id: number;
            tramite_id: string;
            estado_hasta: string;
            at: string;
            por?: string | null;
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

/**
 * El extracto de una tarjeta.
 *
 * TRAE EL NOMBRE DEL CLIENTE, y esa es la diferencia entre un extracto y una lista de numeros.
 * Antes la columna Concepto decia "reserva" — una palabra del sistema. Cuando la gestora carga
 * un presupuesto y quiere ver que se descontó, lo que busca es el apellido del cliente, no el
 * tipo de asiento.
 *
 * ============================================================================
 *  `anulado` LO TRAE LA BASE, Y ANTES SE CALCULABA ACA MAL
 * ============================================================================
 *
 * Se calculaba mirando que otra fila de ESTA MISMA consulta lo corrigiera. Pero la consulta trae
 * las ultimas 200: si la anulacion quedaba fuera de esa ventana, el movimiento se mostraba como
 * vivo, CON SU BOTON DE ANULAR AL LADO, sobre algo ya anulado. Al apretarlo la base lo rechazaba
 * con un mensaje que no explicaba nada, porque en la pantalla no habia nada que anular.
 *
 * Desde el 27/08/2026 `movimientos.anulado` es una columna real: la escribe `anular_movimiento`
 * en la misma transaccion que la compensacion, y es la misma que mira el indice unico que impide
 * dos saldos iniciales vivos por tarjeta. Una sola verdad, y no depende de cuantas filas se
 * hayan traido.
 */
export function useMovimientos(tarjetaId: string | null) {
  return useQuery({
    queryKey: ["movimientos", tarjetaId],
    enabled: tarjetaId !== null,
    queryFn: async () => {
      /*
        ============================================================================
         SE LEE `v_movimientos` Y NO LA TABLA, Y ES UNA DECISION DE PRIVACIDAD
        ============================================================================

        `movimientos_select` es POR TARJETA —tiene que serlo: el saldo es la suma de la tarjeta—
        pero el trigger de la cuenta corriente escribe el nombre del cliente ADENTRO del concepto:
        `'Presupuesto - ' || t.cliente_nombre`.

        Leyendo la tabla, una gestora recibía en la respuesta de la API el apellido de los clientes
        de OTRA gestora, sobre la misma tarjeta. La vista tapa `concepto`, `observacion` y
        `gestora_id` cuando el movimiento cuelga de un trámite que quien consulta no puede ver.

        Lo encontró la revisión de seguridad del 28/08/2026. Estaba en cero filas —hay una sola
        gestora con trámites— y se activa el día que sean dos, que es el caso normal.
      */
      const { data, error } = await supabase
        .from("v_movimientos")
        // El select va en UNA sola cadena literal, sin partirla con `+`: supabase-js infiere los
        // tipos leyendo ese literal, y una concatenacion lo deja en `GenericStringError` — o sea
        // que se pierde el chequeo de tipos justo en la consulta que trae plata.
        .select(
          "id, fecha, fecha_acreditacion, tipo, importe, concepto, observacion, corrige_movimiento_id, anulado, tramites(cliente_nombre)",
        )
        .eq("tarjeta_id", tarjetaId ?? "")
        .order("fecha", { ascending: false })
        .order("id", { ascending: false })
        .limit(200);
      if (error) throw error;

      const filas = data ?? [];

      return filas.map((m) => ({
        id: Number(m.id),
        fecha: String(m.fecha),
        fecha_acreditacion: String(m.fecha_acreditacion),
        tipo: String(m.tipo),
        importe: aNumero(m.importe),
        concepto: m.concepto,
        observacion: m.observacion,
        corrige_movimiento_id: m.corrige_movimiento_id,
        cliente: m.tramites?.cliente_nombre ?? null,
        /*
          `?? false` PORQUE AHORA SALE DE UNA VISTA. Los tipos de una vista salen todos anulables:
          Postgres no puede garantizar que una columna de una vista no sea nula, aunque en la tabla
          de abajo sea `not null`. Se normaliza acá, en el borde, igual que en `useNotasDelTramite`.

          Y el valor por omisión es `false` —no anulado— a propósito: tratar un movimiento como
          anulado por una duda de tipos lo sacaría del saldo que la pantalla muestra.
        */
        anulado: m.anulado ?? false,
      }));
    },
  });
}

/**
 * Anular un movimiento cargado mal.
 *
 * LLAMA A LA BASE Y NO ARMA EL AJUSTE ACA. Si esta pantalla armara la compensación, el signo, la
 * fecha de acreditación y el tipo dependerían de que el front los calcule bien cada vez — y un
 * signo al revés no da error: duplica el importe en vez de compensarlo.
 *
 * Tampoco borra: la base inserta un ajuste de signo contrario que apunta al original. Los dos se
 * suman a cero, el saldo queda bien, y el error queda visible con su motivo.
 */
export function useAnularMovimiento() {
  return useGuardar(
    async (v: { id: number; motivo: string }) => {
      const { error } = await supabase.rpc("anular_movimiento", {
        p_id: v.id,
        p_motivo: v.motivo,
      });
      if (error) throw error;
    },
    { exito: "Movimiento anulado", invalidar: ["saldos", "movimientos"] },
  );
}

// ------------------------------------------------------------
// Tramites
// ------------------------------------------------------------

export function useTramites(
  filtros: { estado?: string; buscar?: string; razonSocialId?: string } = {},
) {
  return useQuery({
    queryKey: ["tramites", filtros],
    queryFn: async (): Promise<Tramite[]> => {
      let q = supabase
        .from("tramites")
        .select("*")
        .order("recibido_at", { ascending: false })
        .limit(300);
      if (filtros.estado) q = q.eq("estado", filtros.estado);
      /*
        FILTRAR POR EMPRESA EN LA BASE Y NO EN EL FRONT. Traer los 300 de todo el grupo para
        quedarse con los de una es pedirle a la base trabajo que despues se tira, y el dia que
        haya seis mil tramites —la planilla de PARIS AUTOS ya pasa de 6.868 filas— el limite de
        300 empezaria a esconder tramites de la empresa que se esta mirando, sin decirlo.
      */
      if (filtros.razonSocialId) q = q.eq("razon_social_id", filtros.razonSocialId);
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
          deposito_solicitado:
            t.deposito_solicitado === null ? null : aNumero(t.deposito_solicitado),
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
      const { data, error } = await supabase
        .from("tramites")
        .select("*")
        .eq("id", id ?? "")
        .single();
      if (error) throw error;
      return Object.assign(data, {
        deposito_solicitado:
          data.deposito_solicitado === null ? null : aNumero(data.deposito_solicitado),
      }) as Tramite;
    },
  });
}

/**
 * Las lineas del presupuesto y del costo real.
 *
 * TRAE TAMBIEN LAS ANULADAS, a proposito: en pantalla se muestran tachadas con su motivo. Aca
 * nada se borra, y en este caso importa mas que en otros — cuando el tramite vuelve del registro
 * y el numero no cierra, lo que se pregunta es que se saco y por que.
 */
export function useConceptosDelTramite(tramiteId: string | null) {
  return useQuery({
    queryKey: ["tramite_conceptos", tramiteId],
    enabled: tramiteId !== null,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tramite_conceptos")
        .select("id, concepto_id, momento, importe, anulada, motivo_anulacion")
        .eq("tramite_id", tramiteId ?? "")
        .order("id");
      if (error) throw error;
      return (data ?? []).map((c) => Object.assign(c, { importe: aNumero(c.importe) }));
    },
  });
}

/** Las claves que se invalidan cuando cambia una linea: el total y la reserva se mueven solos. */
const AL_TOCAR_EL_PRESUPUESTO = [
  "tramite_conceptos",
  "tramite",
  "tramites",
  "saldos",
  "movimientos",
  "tramite_cambios",
];

/**
 * Corregir el importe de una linea del presupuesto.
 *
 * NO HACE FALTA TOCAR NADA MAS: el trigger `h_conceptos_total_presupuesto` recalcula el total del
 * tramite, y eso dispara el de la cuenta corriente, que escribe el `ajuste_reserva` por la
 * DIFERENCIA. La reserva original nunca se toca, porque editarla haria que el saldo de ayer deje
 * de ser reconstruible.
 */
export function useCorregirConcepto() {
  return useGuardar(
    async (v: { id: number; importe: number }) => {
      const { error } = await supabase
        .from("tramite_conceptos")
        .update({ importe: v.importe })
        .eq("id", v.id);
      if (error) throw error;
    },
    { exito: "Importe corregido", invalidar: AL_TOCAR_EL_PRESUPUESTO },
  );
}

/**
 * Quitar una linea del presupuesto.
 *
 * ES UN UPDATE Y NO UN DELETE, y no es una limitacion tecnica: en este proyecto no hay delete
 * para nadie. La linea queda con su motivo escrito y la plata vuelve sola a la tarjeta.
 */
export function useQuitarConcepto() {
  return useGuardar(
    async (v: { id: number; motivo: string }) => {
      const { error } = await supabase
        .from("tramite_conceptos")
        .update({ anulada: true, motivo_anulacion: v.motivo })
        .eq("id", v.id);
      if (error) throw error;
    },
    { exito: "Línea quitada del presupuesto", invalidar: AL_TOCAR_EL_PRESUPUESTO },
  );
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

/**
 * Agregar una nota a un trámite.
 *
 * VIVE ACA Y NO EN CADA FICHA porque son DOS pantallas —la de la oficina y la de la gestora— y es
 * la misma conversación vista desde los dos lados. Dos copias de este `insert` se separan la
 * primera vez que alguien agregue una columna, y el síntoma sería que una de las dos deja de
 * guardar algo que la otra sí guarda, sin error.
 */
export function useAgregarNota(tramiteId: string) {
  return useGuardar(
    async (texto: string) => {
      const { data: sesion } = await supabase.auth.getUser();
      const autor = sesion.user?.id;
      if (autor === undefined)
        throw new Error("regla_tramite: Se cerró la sesión. Entrá de nuevo.");
      const { error } = await supabase
        .from("tramite_notas")
        .insert({ tramite_id: tramiteId, texto: texto.trim(), autor });
      if (error) throw error;
    },
    { exito: "Nota guardada", invalidar: ["tramite_notas"] },
  );
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
        .filter(
          (n): n is typeof n & { id: number; texto: string } => n.id !== null && n.texto !== null,
        )
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

      const ids = [
        ...new Set((data ?? []).map((c) => c.quien).filter((q): q is string => q !== null)),
      ];
      const nombres = new Map<string, string>();
      if (ids.length > 0) {
        const { data: gente } = await supabase.rpc("nombres_de", { personas: ids });
        for (const p of (gente ?? []) as { id: string; nombre: string }[])
          nombres.set(p.id, p.nombre);
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
