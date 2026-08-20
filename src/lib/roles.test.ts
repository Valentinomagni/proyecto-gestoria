import { describe, expect, it } from "vitest";
import {
  ROLES,
  esRolValido,
  estaHabilitado,
  nombreDeRol,
  puedeAdministrar,
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

  it("gerencia y contable administran igual, y gestoría no", () => {
    /*
      ESTA REGLA CAMBIO A PROPOSITO el 20/08/2026, y por eso el test cambio con ella. Antes
      decia que sólo gerencia administraba, y la consecuencia real era que confirmar un plazo,
      cargar un feriado o atender un aviso dependía de que una sola persona estuviera
      disponible. En la práctica gerencia y contable son la misma oficina.

      Espeja al helper `es_oficina()` de la base, que es quien decide de verdad.
    */
    expect(puedeAdministrar("gerencia")).toBe(true);
    expect(puedeAdministrar("contable")).toBe(true);
    expect(puedeAdministrar("gestora")).toBe(false);
    expect(puedeAdministrar("sin_asignar")).toBe(false);
  });

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
