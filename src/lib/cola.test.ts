import { describe, expect, it } from "vitest";
import { agrupar, BLOQUES, textoDeAccion, type FilaDeCola } from "./cola";

/** Una fila cualquiera, para no repetir doce campos en cada caso. */
function fila(p: Partial<FilaDeCola>): FilaDeCola {
  return {
    tramite_id: "t1",
    cliente_nombre: "ROSALES MARIA ROSA",
    dominio: "VG506910",
    oferta_referencia: null,
    empresa: "PARIS AUTOS",
    razon_social_id: "r1",
    tarjeta_id: "c1",
    estado: "entregado",
    bloque: "te_toca",
    accion: "presupuestar",
    pide: 0,
    falta: 0,
    desde: "2026-08-28T10:00:00Z",
    ...p,
  };
}

describe("los tres bloques", () => {
  it("estan en el orden en que se miran: primero lo que hay que hacer", () => {
    /*
      EL ORDEN ES LA PANTALLA. Ella abre el telefono para saber que hacer ahora, no para
      enterarse de lo que termino. "Terminados hoy" ultimo y plegado.
    */
    expect(BLOQUES.map((b) => b.valor)).toEqual(["te_toca", "esperando", "terminado"]);
  });

  it("cada bloque sabe que decir cuando esta vacio", () => {
    // Un bloque vacio sin texto se lee como un error de carga. Obligatorio en los tres.
    for (const b of BLOQUES)
      expect(b.vacio.length, `${b.valor} no dice nada al estar vacio`).toBeGreaterThan(10);
  });
});

describe("agrupar", () => {
  it("pone cada fila en su bloque y deja los otros vacios, no ausentes", () => {
    /*
      VACIO Y AUSENTE NO SON LO MISMO. Si un bloque faltara del objeto, la pantalla no lo
      dibujaria y ella no sabria si no tiene nada o si no se cargo.
    */
    const r = agrupar([fila({ tramite_id: "a", bloque: "te_toca" })]);
    expect(r.te_toca.map((f) => f.tramite_id)).toEqual(["a"]);
    expect(r.esperando).toEqual([]);
    expect(r.terminado).toEqual([]);
  });

  it("ordena por antiguedad: lo que espera hace mas tiempo va arriba", () => {
    const r = agrupar([
      fila({ tramite_id: "nuevo", desde: "2026-08-28T15:00:00Z" }),
      fila({ tramite_id: "viejo", desde: "2026-08-28T09:00:00Z" }),
    ]);
    expect(r.te_toca.map((f) => f.tramite_id)).toEqual(["viejo", "nuevo"]);
  });

  it("una fila sin fecha va al final y no rompe el orden", () => {
    // `desde` sale de tres columnas con coalesce; si las tres fueran null, ordenar por null
    // dejaria la fila en cualquier lado segun el navegador.
    const r = agrupar([
      fila({ tramite_id: "sin", desde: null }),
      fila({ tramite_id: "con", desde: "2026-08-28T09:00:00Z" }),
    ]);
    expect(r.te_toca.map((f) => f.tramite_id)).toEqual(["con", "sin"]);
  });

  it("no modifica la lista que recibe", () => {
    /*
      `toSorted` y no `sort`. Con `sort` se reordenaria el array que vino de TanStack Query, que
      es el mismo objeto cacheado: la segunda vez que se dibujara la pantalla el orden ya vendria
      cambiado, y el sintoma seria una lista que se reacomoda sola entre dibujos.
    */
    const entrada = [
      fila({ tramite_id: "b", desde: "2026-08-28T15:00:00Z" }),
      fila({ tramite_id: "a", desde: "2026-08-28T09:00:00Z" }),
    ];
    agrupar(entrada);
    expect(entrada.map((f) => f.tramite_id)).toEqual(["b", "a"]);
  });
});

describe("el texto del boton", () => {
  it("dice lo que va a pasar, en voseo", () => {
    expect(textoDeAccion("presupuestar")).toBe("Cargar el presupuesto");
    expect(textoDeAccion("ir_al_registro")).toBe("Andá al registro");
    expect(textoDeAccion("devolver")).toBe("Entregar a administración");
  });

  it("y sin accion NO hay boton", () => {
    /*
      DEVUELVE null Y NO UNA CADENA VACIA. Un boton con texto vacio sigue siendo un boton: se
      puede tabular hasta el, el lector de pantalla lo anuncia sin nombre, y se puede apretar.
    */
    expect(textoDeAccion("ninguna")).toBeNull();
  });
});
