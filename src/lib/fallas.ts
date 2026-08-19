/**
 * ============================================================================
 *  LAS FALLAS. Convierte un error crudo en algo que se le pueda MOSTRAR a una persona,
 *  junto con la accion que de verdad la desatasca.
 * ============================================================================
 *
 *  REGLA DURA DEL PROYECTO: ningun mensaje crudo de la base llega nunca a la pantalla. El
 *  volcado tecnico va aparte, plegado, para poder pegarlo en una consulta.
 *
 *  Y la regla que importa mas que la anterior: OFRECER LA ACCION EQUIVOCADA ES PEOR QUE NO
 *  OFRECER NINGUNA. En el Tablero, el ErrorBoundary ofrecia "Reintentar" para un modulo que ya
 *  no existe en el servidor. Reintentar NO PUEDE funcionar ahi: el archivo no esta. La persona
 *  aprieta tres veces, ve el mismo error, y concluye que el sistema esta roto — cuando solo
 *  hacia falta recargar.
 *
 *  PURA: `online` entra por parametro. No lee `navigator` adentro, asi se puede probar.
 */

export type TipoDeFalla =
  | "sin-conexion"
  | "version-vieja"
  | "sin-permiso"
  | "duplicado"
  | "ya-estaba"
  | "regla-del-circuito"
  | "desconocida";

export type AccionSugerida = "actualizar" | "reintentar" | "ver-existente" | "ninguna";

export interface Falla {
  tipo: TipoDeFalla;
  titulo: string;
  /** En castellano. Sin las palabras "constraint", "row-level", "chunk" ni "modulo". */
  explicacion: string;
  accion: AccionSugerida;
  /** Para pegar en una consulta. Con tope: es una pista, no un volcado. */
  detalleTecnico: string;
}

/** Tope del detalle: tiene que poder pegarse en un mensaje, no llenar la pantalla. */
const MAX_DETALLE = 1000;

/**
 * Prefijo con el que los triggers del circuito marcan sus mensajes.
 *
 * POR QUE UNA MARCA Y NO EL TEXTO PELADO: la regla del proyecto es que un error nunca muestra
 * el mensaje crudo de la base, asi que todo lo que llega de Postgres se tapa con el generico.
 * Sin algo que el front pueda MIRAR sin leer prosa, el motivo escrito para una persona
 * —"Para pasar a presupuestado hace falta el monto aproximado"— se perderia junto con el
 * volcado. Es un codigo, no un mensaje: lo que ve la persona es lo que sigue al prefijo.
 */
export const MARCA_REGLA = "regla_tramite:";

function mensajeDe(e: unknown): string {
  if (typeof e === "string") return e;
  if (e && typeof e === "object") {
    const o = e as { message?: unknown; error_description?: unknown };
    if (typeof o.message === "string") return o.message;
    if (typeof o.error_description === "string") return o.error_description;
  }
  return "";
}

function codigoDe(e: unknown): string {
  if (e && typeof e === "object") {
    const c = (e as { code?: unknown }).code;
    if (typeof c === "string") return c;
    if (typeof c === "number") return String(c);
  }
  return "";
}

function nombreDe(e: unknown): string {
  if (e && typeof e === "object") {
    const n = (e as { name?: unknown }).name;
    if (typeof n === "string") return n;
  }
  return "";
}

/** El fallo de un modulo que se baja a demanda. Cada motor de navegador lo redacta distinto. */
function esFalloDeModulo(msg: string, nombre: string): boolean {
  if (nombre === "ChunkLoadError") return true;
  return (
    /failed to fetch dynamically imported module/i.test(msg) ||
    /importing a module script failed/i.test(msg) || // Safari
    /error loading dynamically imported module/i.test(msg) ||
    /loading chunk \S+ failed/i.test(msg)
  );
}

function esFalloDeRed(msg: string): boolean {
  return /failed to fetch|load failed|networkerror|network request failed/i.test(msg);
}

/** Qué índice único se violó, si lo reconocemos. */
function indiceViolado(msg: string): string {
  const m = /unique constraint "([^"]+)"/i.exec(msg);
  return m?.[1] ?? "";
}

export function clasificarFalla(e: unknown, online: boolean): Falla {
  const msg = mensajeDe(e);
  const codigo = codigoDe(e);
  const nombre = nombreDe(e);
  const detalleTecnico = `${codigo ? codigo + " " : ""}${msg}`.trim().slice(0, MAX_DETALLE);

  // ------------------------------------------------------------------
  // EL ORDEN DE ESTAS RAMAS IMPORTA Y NO ES NEGOCIABLE.
  //
  // Sin conexion se evalua ANTES que version vieja, porque sin red un modulo TAMBIEN falla al
  // bajar y el error se parece. Si ganara "version vieja", la accion seria "Actualizar", y una
  // recarga sin red deja la pantalla EN BLANCO. Es el peor consejo posible en el peor momento
  // posible: una gestora parada en el registro, sin senial.
  // ------------------------------------------------------------------
  if (!online || (esFalloDeRed(msg) && !online)) {
    return {
      tipo: "sin-conexion",
      titulo: "Sin conexión",
      explicacion: "No hay internet. Cuando vuelva, probá de nuevo: no se perdió nada de lo que cargaste.",
      accion: "reintentar",
      detalleTecnico,
    };
  }

  if (esFalloDeModulo(msg, nombre)) {
    return {
      tipo: "version-vieja",
      titulo: "Hay una versión nueva",
      explicacion: "Se publicó una actualización mientras tenías la página abierta. Actualizá para seguir.",
      accion: "actualizar",
      detalleTecnico,
    };
  }

  if (esFalloDeRed(msg)) {
    return {
      tipo: "sin-conexion",
      titulo: "No se pudo conectar",
      explicacion: "No hubo respuesta del servidor. Revisá tu conexión y probá de nuevo.",
      accion: "reintentar",
      detalleTecnico,
    };
  }

  // La base cambio y este navegador tiene codigo viejo: manda una columna que ya no existe, o
  // le falta una que ahora es obligatoria. Recargar trae el codigo nuevo y se arregla solo.
  if (codigo === "42703" || codigo === "PGRST204" || codigo === "PGRST205") {
    return {
      tipo: "version-vieja",
      titulo: "Hay una versión nueva",
      explicacion: "Tu navegador está usando una versión anterior del sistema. Actualizá para seguir.",
      accion: "actualizar",
      detalleTecnico,
    };
  }

  if (codigo === "42501") {
    return {
      tipo: "sin-permiso",
      titulo: "No tenés permiso para esto",
      explicacion:
        "Tu usuario no puede hacer este cambio. Si creés que sí debería poder, avisale a quien administra el sistema.",
      accion: "ninguna",
      detalleTecnico,
    };
  }

  if (codigo === "23505") {
    const indice = indiceViolado(msg);

    if (indice === "tramites_patentamiento_unico_idx") {
      return {
        tipo: "duplicado",
        titulo: "Ese dominio ya tiene un patentamiento",
        explicacion: "Un 0km se patenta una sola vez. Mirá el trámite que ya existe antes de cargar otro.",
        accion: "ver-existente",
        detalleTecnico,
      };
    }

    if (indice === "movimientos_una_reserva_por_tramite") {
      // Para la persona esto NO es un error: apreto guardar dos veces y el indice hizo su
      // trabajo. Decirle "error" seria mentirle.
      return {
        tipo: "ya-estaba",
        titulo: "El presupuesto ya estaba guardado",
        explicacion: "No se descontó dos veces del saldo. Está todo bien.",
        accion: "ninguna",
        detalleTecnico,
      };
    }

    return {
      tipo: "duplicado",
      titulo: "Ese dato ya está cargado",
      explicacion: "Ya existe un registro igual. Buscalo antes de cargarlo de nuevo.",
      accion: "ninguna",
      detalleTecnico,
    };
  }

  if (msg.includes(MARCA_REGLA)) {
    return {
      tipo: "regla-del-circuito",
      titulo: "No se puede avanzar todavía",
      explicacion: msg.slice(msg.indexOf(MARCA_REGLA) + MARCA_REGLA.length).trim(),
      accion: "ninguna",
      detalleTecnico,
    };
  }

  return {
    tipo: "desconocida",
    titulo: "Algo salió mal",
    explicacion: "No pudimos completar la acción. Probá de nuevo, y si sigue pasando avisá con el botón de reportar.",
    accion: "reintentar",
    detalleTecnico,
  };
}
