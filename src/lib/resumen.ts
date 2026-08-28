import { useQuery } from "@tanstack/react-query";
import { supabase } from "./supabase";
import { aNumero } from "./datos";

/**
 * Una empresa en el resumen.
 *
 * `movimientos_visibles` en 0 significa "NO SE VEN SUS MOVIMIENTOS", no "está en cero". La vista
 * hace `left join` y `coalesce(...,0)`, así que una tarjeta que no se puede leer sale con los
 * mismos ceros que una vacía — y sin este número la pantalla no tiene con qué distinguirlas.
 *
 * El 27/08/2026 toda gestora veía las cinco tarjetas en `$ 0,00` mientras Paris Autos tenía ocho
 * millones y medio. Un cero es un número y se lee como un hecho.
 */
export interface FilaDeResumen {
  razon_social_id: string;
  nombre: string;
  tarjeta_id: string | null;
  contable: number;
  en_transito: number;
  comprometido: number;
  diferencia: number;
  esperan: number;
  movimientos_visibles: number;
}

/*
  EL SELECT VA EN UNA SOLA CADENA LITERAL, sin partirla con `+`: supabase-js infiere los tipos
  leyendo ese literal, y una concatenacion lo deja en `GenericStringError` — o sea que se pierde
  el chequeo de tipos justo en la consulta que trae plata.
*/
const COLUMNAS =
  "razon_social_id, nombre, tarjeta_id, contable, en_transito, comprometido, diferencia, esperan, movimientos_visibles";

/** El mapeo vive en un solo lado: dos copias se separan la primera vez que se agrega una columna. */
function aFila(f: Record<string, unknown>): FilaDeResumen {
  return {
    razon_social_id: String(f["razon_social_id"]),
    nombre: String(f["nombre"]),
    tarjeta_id: f["tarjeta_id"] === null ? null : String(f["tarjeta_id"]),
    contable: aNumero(f["contable"]),
    en_transito: aNumero(f["en_transito"]),
    comprometido: aNumero(f["comprometido"]),
    diferencia: aNumero(f["diferencia"]),
    esperan: aNumero(f["esperan"]),
    movimientos_visibles: aNumero(f["movimientos_visibles"]),
  };
}

/**
 * ============================================================================
 *  EL RESUMEN DE LAS CINCO EMPRESAS
 * ============================================================================
 *
 * Es la puerta de entrada de la oficina, y contesta dos preguntas: dónde falta plata, y dónde hay
 * algo que hacer. Todo lo que no conteste una de las dos es adorno.
 *
 * SE INVALIDA CON EL MISMO GOLPE EN VIVO QUE LOS SALDOS. Sin eso entraría un depósito, el saldo de
 * la empresa cambiaría al abrirla, y el resumen seguiría mostrando el número viejo — que es la
 * peor forma de equivocarse que tiene esta app: dos pantallas del mismo sistema diciendo cosas
 * distintas de la misma plata.
 *
 * El orden lo decide la base, en la columna `orden` de `razones_sociales`, para que se pueda
 * cambiar sin tocar código. Y NO CAMBIA SOLO NUNCA: nadie puede aprender que Paris Autos es la
 * primera si la primera cambia.
 */
export function useResumen() {
  return useQuery({
    queryKey: ["resumen"],
    queryFn: async (): Promise<FilaDeResumen[]> => {
      const { data, error } = await supabase
        .from("v_resumen_empresas")
        .select(COLUMNAS)
        .order("orden");
      if (error) throw error;
      return (data ?? []).map(aFila);
    },
  });
}

/**
 * Una empresa sola, para el encabezado del nivel 2 y para el nombre de las migas.
 *
 * LEE DEL MISMO CACHE que `useResumen` cuando ya está: si el resumen se cargó recién, TanStack
 * devuelve la fila sin ir a la base. Por eso las migas pueden mostrar el nombre sin parpadear al
 * cambiar de nivel, y una tira que parpadea arriba de todo se nota más que el contenido.
 */
export function useEmpresa(razonSocialId: string) {
  return useQuery({
    queryKey: ["resumen", razonSocialId],
    queryFn: async (): Promise<FilaDeResumen | null> => {
      const { data, error } = await supabase
        .from("v_resumen_empresas")
        .select(COLUMNAS)
        .eq("razon_social_id", razonSocialId)
        .maybeSingle();
      if (error) throw error;
      return data === null ? null : aFila(data);
    },
  });
}
