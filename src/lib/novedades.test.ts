import { describe, expect, it } from "vitest";
import { contarSinVer, hastaDondeMarcar, sumarNovedad, type Novedad } from "./novedades";

/**
 * Lo que se prueba acá es la parte que decide si la campana dice la verdad. La suscripción en
 * vivo no se prueba con un test: se prueba abriendo dos ventanas, y eso está escrito en la
 * migración que publica las tablas.
 */

const N = (id: number, cuando: string): Novedad => ({
  id,
  tramiteId: "t1",
  estado: "controlado",
  cuando,
});

const LISTA = [
  N(3, "2026-08-20T12:00:00.000Z"),
  N(2, "2026-08-20T11:00:00.000Z"),
  N(1, "2026-08-20T10:00:00.000Z"),
];

describe("contar lo que no se vio", () => {
  it("sin haber mirado nunca, todo es nuevo", () => {
    expect(contarSinVer(LISTA, null)).toBe(3);
  });

  it("cuenta solo lo posterior a la ultima vez que se miro", () => {
    expect(contarSinVer(LISTA, "2026-08-20T11:00:00.000Z")).toBe(1);
  });

  it("si se miro despues de todo, no queda nada", () => {
    expect(contarSinVer(LISTA, "2026-08-20T23:00:00.000Z")).toBe(0);
  });

  it("una lista vacia cuenta cero y no rompe", () => {
    expect(contarSinVer([], null)).toBe(0);
    expect(contarSinVer([], "2026-08-20T10:00:00.000Z")).toBe(0);
  });
});

describe("hasta donde marcar como visto", () => {
  it("marca con la hora del ULTIMO evento, no con ahora", () => {
    /*
      Si se marcara con "ahora", una novedad que llega justo mientras el panel esta abierto
      quedaria dada por vista sin que nadie la haya leido. Marcar con el ultimo evento conocido
      deja afuera lo que llegue despues, que es lo correcto.
    */
    expect(hastaDondeMarcar(LISTA, null)).toBe("2026-08-20T12:00:00.000Z");
  });

  it("con la lista vacia no cambia nada", () => {
    // No hay nada que marcar: dejar lo que ya estaba evita perder la marca anterior.
    expect(hastaDondeMarcar([], "2026-08-19T10:00:00.000Z")).toBe("2026-08-19T10:00:00.000Z");
    expect(hastaDondeMarcar([], null)).toBeNull();
  });

  it("y despues de marcar, no queda nada sin ver", () => {
    // Las dos funciones juntas: es la unica forma de comprobar que el contador se apaga.
    const hasta = hastaDondeMarcar(LISTA, null);
    expect(contarSinVer(LISTA, hasta)).toBe(0);
  });
});

describe("la misma novedad no se cuenta dos veces", () => {
  /*
    NO SE VIO REPETIR EN PANTALLA, y vale aclararlo: una vez la campana marco tres y parecia
    esto, pero eran tres tramites distintos con el mismo nombre. La campana decia la verdad.

    Se deduplica igual por dos motivos que son ciertos aunque no se hayan visto: React monta los
    efectos dos veces en desarrollo —dos suscripciones al mismo canal— y Realtime puede reenviar
    al reconectar despues de un corte.

    Un contador que dice tres cuando paso una cosa es peor que no tener contador: la proxima vez
    que diga tres, nadie le va a creer.
  */
  it("el mismo id no entra dos veces", () => {
    const una = sumarNovedad([], N(1, "2026-08-20T10:00:00.000Z"));
    const otraVez = sumarNovedad(una, N(1, "2026-08-20T10:00:00.000Z"));
    expect(otraVez).toHaveLength(1);
  });

  it("pero una novedad distinta si, y va primera", () => {
    const una = sumarNovedad([], N(1, "2026-08-20T10:00:00.000Z"));
    const dos = sumarNovedad(una, N(2, "2026-08-20T11:00:00.000Z"));
    expect(dos).toHaveLength(2);
    expect(dos[0]?.id).toBe(2);
  });

  it("y hay un tope, porque una campana con doscientas lineas no se lee", () => {
    let lista: ReturnType<typeof sumarNovedad> = [];
    for (let i = 1; i <= 60; i++) lista = sumarNovedad(lista, N(i, `2026-08-20T10:00:${String(i).padStart(2, "0")}.000Z`), 50);
    expect(lista).toHaveLength(50);
    expect(lista[0]?.id).toBe(60);
  });
});
