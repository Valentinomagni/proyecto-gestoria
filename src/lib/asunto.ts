/**
 * Parsea el asunto del mail que manda administracion.
 *
 * El pedido dice que el asunto trae: nombre completo del cliente, cuenta personal, vehiculo y
 * referencia de oferta de compra. Hoy eso se copia a mano a una planilla.
 *
 * ============================================================================
 *  ES BEST-EFFORT Y NUNCA BLOQUEA. Esto es deliberado.
 * ============================================================================
 *
 *  El formato NO es estable. En la misma planilla conviven:
 *      "PATENTAMIENTO PLAN DE AHORRO- C.74344 MUÑOZ ELIZABETH - UNIDAD PE..."
 *      "PATENTAMIENTO C3 (34913) BALAGUER JUAN ANTONIO (REF. 4097473)"
 *      "TRANSFERENCIA CHEVROLET CRUZE A PARIS AUTOS"
 *  y las referencias aparecen como "REF. 4097473", "ref 4093504" y "REF4064625".
 *
 *  Entonces: lo que reconoce lo devuelve, lo que no reconoce lo deja vacio, y el asunto CRUDO
 *  se guarda siempre. Sin el original, un parseo equivocado no se puede reparar sin volver al
 *  Outlook.
 *
 *  Un parser que adivina es peor que uno que se abstiene: el dato inventado se ve igual de bien
 *  que el correcto, y nadie lo vuelve a mirar.
 */

export interface AsuntoParseado {
  tipo: "patentamiento_0km" | "transferencia_a_cliente" | "transferencia_al_concesionario" | null;
  subtipo: "plan_ahorro" | "credito" | "contado" | null;
  cliente: string | null;
  cuenta: string | null;
  referencia: string | null;
}

/** `C.74344`, `C. 103188`, `c.4097473`. */
const CUENTA = /\bC\.?\s?(\d{4,8})\b/i;

/** `REF. 4097473`, `ref 4093504`, `REF4064625`. Las tres formas conviven en la misma planilla. */
const REFERENCIA = /\bREF\.?\s?(\d{4,10})\b/i;

/** Lo que va entre parentesis y es solo numeros: `(108198)`, `(34913)`. */
const ENTRE_PARENTESIS = /\((\d{4,8})\)/;

/**
 * Palabras del formulario que NUNCA son parte del nombre de un cliente.
 *
 * Se descartan ANTES de buscar el nombre, no despues. La primera version filtraba despues y
 * fallaba: en "PATENTAMIENTO PLAN DE AHORRO- C.74344 MUÑOZ ELIZABETH", la busqueda encontraba
 * primero "PATENTAMIENTO PLAN DE AHORRO" —cuatro palabras en mayusculas seguidas— y al
 * limpiarlas quedaba solo "DE". El cliente real, MUÑOZ ELIZABETH, no se miraba nunca.
 */
const PALABRAS_QUE_NO_SON_NOMBRE = new Set([
  "PATENTAMIENTO", "PATENTAMIENNTO", "TRANSFERENCIA", "PLAN", "DE", "AHORRO", "UNIDAD",
  "REF", "PARIS", "PARÍS", "AUTOS", "CARS", "MOTOR", "TRAC", "DORAL", "CHEVROLET",
  "CITROEN", "PEUGEOT", "VOLKSWAGEN", "FIAT", "RENAULT", "A", "AL", "EL", "LA", "Y",
]);

/** Una palabra que puede ser parte de un nombre: mayusculas, sin digitos, dos letras o mas. */
function pareceNombre(p: string): boolean {
  return /^[A-ZÑÁÉÍÓÚÜ]{2,}$/.test(p) && !PALABRAS_QUE_NO_SON_NOMBRE.has(p);
}

/**
 * Busca la RACHA MAS LARGA de palabras seguidas que parecen un nombre.
 *
 * La mas larga y no la primera: en la planilla el modelo del auto viene antes que el cliente,
 * y suele ser una sola palabra o traer numeros. El nombre son dos o mas palabras pegadas.
 */
function buscarNombre(texto: string): string | null {
  const palabras = texto.split(/[\s,\-.]+/).filter(Boolean);
  let mejor: string[] = [];
  let actual: string[] = [];
  for (const p of palabras) {
    if (pareceNombre(p)) {
      actual.push(p);
      if (actual.length > mejor.length) mejor = [...actual];
    } else {
      actual = [];
    }
  }
  return mejor.length >= 2 ? mejor.slice(0, 4).join(" ") : null;
}

export function parsearAsunto(asunto: string): AsuntoParseado {
  const t = asunto.trim();
  if (t === "") {
    return { tipo: null, subtipo: null, cliente: null, cuenta: null, referencia: null };
  }

  const mayus = t.toUpperCase();

  let tipo: AsuntoParseado["tipo"] = null;
  if (/PATENTAMIEN/.test(mayus)) {
    tipo = "patentamiento_0km";
  } else if (/TRANSFEREN/.test(mayus)) {
    // Los acentos se sacan antes de comparar: en la planilla conviven "A PARIS AUTOS" y
    // "A PARÍS AUTOS", y sin normalizar el segundo caia del lado equivocado — justo el tipo de
    // tramite que sale gratis a tiempo y caro tarde.
    const sinAcentos = mayus.normalize("NFD").replace(/[̀-ͯ]/g, "");
    tipo = /\bA\s+(PARIS|DORAL)\b/.test(sinAcentos)
      ? "transferencia_al_concesionario"
      : "transferencia_a_cliente";
  }

  let subtipo: AsuntoParseado["subtipo"] = null;
  if (/PLAN\s+DE\s+AHORRO/.test(mayus)) subtipo = "plan_ahorro";

  const cuenta = CUENTA.exec(t)?.[1] ?? null;
  const referencia = REFERENCIA.exec(t)?.[1] ?? ENTRE_PARENTESIS.exec(t)?.[1] ?? null;

  // El nombre se busca DESPUES de sacar la cuenta y la referencia, para que sus digitos no
  // ensucien la busqueda.
  const sinNumeros = t
    .replace(CUENTA, " ")
    .replace(REFERENCIA, " ")
    .replace(ENTRE_PARENTESIS, " ");

  return { tipo, subtipo, cliente: buscarNombre(sinNumeros), cuenta, referencia };
}
