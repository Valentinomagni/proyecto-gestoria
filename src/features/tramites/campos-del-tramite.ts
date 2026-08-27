import type { Rol } from "../../lib/roles";
import type { Database } from "../../lib/database.types";

/**
 * Las columnas que este panel edita.
 *
 * ============================================================================
 *  ESTA UNION ESTA ATADA AL ESQUEMA REAL, Y ESO ES TODO EL PUNTO
 * ============================================================================
 *
 * `chequeoDeColumnas` de abajo no se usa en ningún lado y no se puede borrar: obliga a que cada nombre de
 * acá exista de verdad como columna de `tramites`. El día que alguien renombre una columna en
 * una migración, ESTO DEJA DE COMPILAR — en vez de fallar en producción con un 42703 que aparece
 * recién cuando alguien intenta guardar.
 *
 * Es la misma razón por la que el resto del proyecto arma sus parches con el tipo generado.
 */
type ColumnaEditable =
  | "cliente_nombre" | "oferta_referencia" | "cliente_cuenta" | "vehiculo" | "dominio"
  | "subtipo" | "gestora_id" | "administrativo" | "seccional" | "numero_pago_registro"
  | "documentacion_retirada" | "observaciones_gestora";

type ColumnasDeTramite = keyof Database["public"]["Tables"]["tramites"]["Update"];
type ColumnasQueExisten = ColumnaEditable extends ColumnasDeTramite ? true : never;
const chequeoDeColumnas: ColumnasQueExisten = true;
void chequeoDeColumnas;

/** Lo que se manda a guardar: sólo las columnas tocadas, y sólo de las editables. */
export type CambiosDeDatos = Partial<Record<ColumnaEditable, string | null>>;

/**
 * ============================================================================
 *  QUE DATO SE EDITA, COMO SE LLAMA EN CASTELLANO, Y QUIEN LO PUEDE TOCAR
 * ============================================================================
 *
 *  Una sola tabla, y no tres listas repartidas. Cuando esto vive en cinco lugares, nadie puede
 *  contestar "¿qué puede cambiar una gestora?" sin leerlos todos, y la respuesta termina siendo
 *  distinta en cada uno.
 *
 *  ============================================================================
 *   ESTO NO DECIDE PERMISOS. LOS DECIDE LA BASE.
 *  ============================================================================
 *
 *  El trigger `b_tramites_bloquear_campos` compara el trámite viejo y el nuevo por diferencia de
 *  jsonb y rechaza cualquier columna que ese rol no tenga permitida. Si alguien borra este
 *  archivo, la app se vuelve fea y sigue siendo segura.
 *
 *  Lo que hace este archivo es que la pantalla no OFREZCA lo que la base va a rechazar. Un
 *  formulario que se rechaza al guardar enseña a desconfiar de la pantalla entera, y después no
 *  se confía tampoco en los campos que sí andaban.
 *
 *  Hay un test que compara esta lista contra la del trigger. Si algún día se agrega un campo acá
 *  y no allá, falla antes de llegar a producción.
 *
 *  ============================================================================
 *   LO QUE NO ESTA, Y POR QUE
 *  ============================================================================
 *
 *  `deposito_solicitado` no se ofrece a nadie: desde el 21/08/2026 es la SUMA de las líneas del
 *  presupuesto, y hay un trigger que impide escribirlo a mano. Se cambia agregando, corrigiendo
 *  o quitando una línea, en el panel Presupuesto.
 *
 *  `estado` tampoco: se mueve con el botón del paso siguiente, uno solo, para que no se pueda
 *  saltear un paso eligiendo de una lista.
 */

export interface CampoEditable {
  /** La columna real de `public.tramites`. Atada al esquema por `ColumnaEditable`. */
  columna: ColumnaEditable;
  /** Cómo se llama en la pantalla. Nunca el nombre de la base. */
  nombre: string;
  /** Qué escribe la persona. `gestora` y `administrativo` traen su propia lista. */
  como: "texto" | "gestora" | "administrativo" | "modalidad";
  /** Una línea de ayuda, cuando el nombre solo no alcanza. */
  ayuda?: string;
  /** Quiénes lo pueden editar. La oficina son contable y gerencia, y tienen lo mismo. */
  roles: Rol[];
  /**
   * La columna es `not null` en la base, asi que NO se puede vaciar.
   *
   * Hoy es una sola —el nombre del cliente— y por eso no hay una lista aparte: dejarla vacia
   * seria un tramite sin titular, que no es un dato faltante sino un tramite que no existe.
   */
  obligatorio?: boolean;
}

/** Gerencia y contable son la misma oficina, y tienen exactamente lo mismo. */
const OFICINA: Rol[] = ["contable", "gerencia"];

/** Las tres que trabajan con el trámite. */
const TODAS: Rol[] = ["gestora", "contable", "gerencia"];

export const CAMPOS: CampoEditable[] = [
  { columna: "cliente_nombre", nombre: "Cliente", como: "texto", roles: OFICINA,
    obligatorio: true },
  { columna: "oferta_referencia", nombre: "Referencia de la oferta", como: "texto",
    ayuda: "Con esto se ubica el trámite después", roles: OFICINA },
  { columna: "cliente_cuenta", nombre: "Cuenta personal", como: "texto",
    ayuda: "En el asunto del mail viene entre paréntesis", roles: OFICINA },
  { columna: "vehiculo", nombre: "Vehículo", como: "texto", roles: OFICINA },

  /*
    EL DOMINIO LO PUEDE CARGAR LA GESTORA, y es el único dato del vehículo que puede tocar. Es
    correcto: en un patentamiento 0km la patente no existe hasta que ella la trae del registro.
  */
  { columna: "dominio", nombre: "Dominio", como: "texto", roles: TODAS },

  { columna: "subtipo", nombre: "Modalidad", como: "modalidad",
    ayuda: "Sólo en patentamientos", roles: OFICINA },

  /*
    ESTE ES EL PEDIDO, TEXTUAL: "que permita modificar datos, por ejemplo la gestora que realiza
    el trámite". Pasa de verdad: una gestora se enferma, se va de vacaciones, o el trabajo se
    reparte distinto. Sin poder cambiarlo, el trámite le sigue apareciendo a quien no está y no
    le aparece a quien lo tiene en la mano.
  */
  { columna: "gestora_id", nombre: "Gestora", como: "gestora",
    ayuda: "A quién le aparece el trámite", roles: OFICINA },

  { columna: "administrativo", nombre: "Administrativo a cargo", como: "administrativo",
    ayuda: "Quién lo lleva desde administración", roles: OFICINA },

  { columna: "seccional", nombre: "Seccional", como: "texto",
    ayuda: "Dónde se presentó. Hace falta para resolverlo en el registro", roles: TODAS },
  { columna: "numero_pago_registro", nombre: "N° de pago", como: "texto",
    ayuda: "Con él la conciliación empareja sola", roles: TODAS },
  { columna: "documentacion_retirada", nombre: "Documentación retirada", como: "texto",
    ayuda: "Título, cédula y chapas", roles: TODAS },
  { columna: "observaciones_gestora", nombre: "Observaciones de gestoría", como: "texto",
    roles: TODAS },
];

/** Los campos que ese rol puede editar. */
export function camposPara(rol: Rol): CampoEditable[] {
  return CAMPOS.filter((c) => c.roles.includes(rol));
}

/**
 * El nombre en pantalla de una columna.
 *
 * Devuelve la columna cruda si no la conoce, en vez de romper. Lo usa el panel de cambios, que
 * lee columnas escritas por un trigger que registra CUALQUIERA que cambie — incluida una que se
 * agregue mañana y todavía no esté en esta lista. Mostrar `una_columna_nueva` es feo; una
 * pantalla en blanco es peor.
 */
export function nombreDeCampo(columna: string): string {
  return CAMPOS.find((c) => c.columna === columna)?.nombre ?? columna;
}
