import { describe, expect, it, beforeEach } from "vitest";
import { leerBorrador, guardarBorrador, descartarBorrador } from "./borrador";

/**
 * Lo que se prueba acá es lo que puede fallar sin que nadie lo note: que un borrador roto o un
 * navegador que no deja guardar NO tumben la pantalla. Perder un borrador molesta; que se caiga
 * la pantalla del saldo por un borrador es otra cosa.
 */

describe("borradores", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("lo que se guarda se recupera igual", () => {
    guardarBorrador("alta", { cliente: "GOMEZ", cuenta: "74344" });
    expect(leerBorrador("alta", {})).toEqual({ cliente: "GOMEZ", cuenta: "74344" });
  });

  it("sin nada guardado devuelve el valor inicial", () => {
    expect(leerBorrador("alta", { cliente: "" })).toEqual({ cliente: "" });
  });

  it("descartar lo saca de verdad", () => {
    // Un borrador que sobrevive a haber guardado reaparece en el tramite siguiente con los datos
    // del anterior, y se ve como un formulario legitimamente lleno.
    guardarBorrador("alta", { cliente: "GOMEZ" });
    descartarBorrador("alta");
    expect(leerBorrador("alta", { cliente: "" })).toEqual({ cliente: "" });
  });

  it("un borrador ROTO devuelve el inicial en vez de tirar la pantalla abajo", () => {
    // Pasa de verdad: cambia la forma del formulario y lo guardado deja de encajar.
    window.localStorage.setItem("gestoria.borrador.alta", "{ esto no es json");
    expect(leerBorrador("alta", { cliente: "" })).toEqual({ cliente: "" });
  });

  it("no explota si el navegador no deja guardar", () => {
    // En navegacion privada o con el disco lleno, localStorage LANZA.
    const original = window.localStorage.setItem;
    window.localStorage.setItem = () => {
      throw new Error("QuotaExceeded");
    };
    expect(() => guardarBorrador("alta", { cliente: "GOMEZ" })).not.toThrow();
    window.localStorage.setItem = original;
  });

  it("dos formularios distintos no se pisan", () => {
    guardarBorrador("alta", { cliente: "GOMEZ" });
    guardarBorrador("listado.buscar", "BALAGUER");
    expect(leerBorrador("alta", {})).toEqual({ cliente: "GOMEZ" });
    expect(leerBorrador("listado.buscar", "")).toBe("BALAGUER");
  });
});
