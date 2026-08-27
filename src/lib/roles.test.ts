import { describe, expect, it } from "vitest";
import {
  ROLES,
  esRolValido,
  estaHabilitado,
  nombreDeRol,
  puedeMoverSaldo,
  puedeVerCobros,
} from "./roles";

describe("roles", () => {
  it("todos los roles tienen nombre en castellano", () => {
    for (const rol of ROLES) {
      expect(nombreDeRol(rol).length).toBeGreaterThan(0);
    }
  });

  it("una gestora NO ve lo cobrado al cliente", () => {
    // Es la invariante del proyecto. Acá sólo se esconde el botón; lo que de verdad lo impide
    // es que el dato viva en otra tabla con su propia RLS.
    expect(puedeVerCobros("gestora")).toBe(false);
    expect(puedeVerCobros("sin_asignar")).toBe(false);
    expect(puedeVerCobros("contable")).toBe(true);
    expect(puedeVerCobros("gerencia")).toBe(true);
  });

  it("una gestora NO mueve saldos, aunque los vea", () => {
    // El pedido dice "sólo gerencia/contable podrían MODIFICAR saldos disponibles". Dice
    // modificar, no ver: la gestora necesita ver el saldo para decidir si presenta.
    expect(puedeMoverSaldo("gestora")).toBe(false);
    expect(puedeMoverSaldo("contable")).toBe(true);
  });

  /*
    ACA VIVIA `puedeAdministrar`, y se fue el 21/08/2026 con el menú por rol.

    La regla que probaba —gerencia y contable administran igual, gestoría no— no desapareció:
    se mudó a `MENU` en `src/menu.ts`, donde ahora cada pantalla dice qué roles la ven, y la
    prueba equivalente vive en `src/menu.test.ts` ("contable y gerencia tienen exactamente el
    mismo menú"). Tener las dos habría sido tener dos fuentes para la misma decisión.
  */

  it("un usuario sin asignar no está habilitado ni estando activo", () => {
    expect(estaHabilitado("sin_asignar", true)).toBe(false);
    expect(estaHabilitado("contable", false)).toBe(false);
    expect(estaHabilitado("contable", true)).toBe(true);
  });

  it("un rol que no existe se reconoce como inválido", () => {
    expect(esRolValido("gerencia")).toBe(true);
    expect(esRolValido("jefe")).toBe(false);
  });
});
