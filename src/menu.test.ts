import { describe, expect, it } from "vitest";
import { menuPara } from "./menu";

/**
 * Lo que se prueba acá no es que el menú tenga tal o cual ítem: es que las DOS necesidades del
 * sistema no se mezclen en una sola barra. Gestoría pide la plata; la oficina la administra.
 */

describe("gestoría ve lo suyo y nada más", () => {
  it("no puede cargar un trámite: eso lo hacen contable y gerencia", () => {
    // Es el pedido de la FOTO 7, y es correcto: el trámite nace de un mail que llega a
    // administración. Una gestora parada en el registro no carga altas.
    const ids = menuPara("gestora").map((m) => m.id);
    expect(ids).not.toContain("alta");
  });

  it("tampoco entra a Administración", () => {
    expect(menuPara("gestora").map((m) => m.id)).not.toContain("admin");
  });

  it("pero sí ve sus trámites y el saldo de la tarjeta", () => {
    // El saldo es lo que le dice si lo que presupuestó se puede pagar hoy o recién mañana.
    const ids = menuPara("gestora").map((m) => m.id);
    expect(ids).toContain("tramites");
    expect(ids).toContain("tarjeta");
  });
});

describe("la oficina ve todo, y las dos mitades ven lo mismo", () => {
  it("contable y gerencia tienen exactamente el mismo menú", () => {
    // Lo pidió el usuario textual: "Sí, todo idéntico incluidos los usuarios". Antes contable no
    // veía Administración, y la consecuencia era que confirmar un plazo o atender un aviso
    // dependía de que una sola persona estuviera disponible.
    expect(menuPara("contable").map((m) => m.id)).toEqual(menuPara("gerencia").map((m) => m.id));
  });

  it("y pueden cargar trámites", () => {
    expect(menuPara("gerencia").map((m) => m.id)).toContain("alta");
    expect(menuPara("contable").map((m) => m.id)).toContain("alta");
  });
});

describe("sin rol asignado no hay menú", () => {
  it("no ve ninguna pantalla", () => {
    // Todas las cuentas nuevas nacen así. La pantalla que les toca explica que falta el rol y a
    // quién avisarle; un menú lleno de pantallas que van a fallar sería peor que ninguno.
    expect(menuPara("sin_asignar")).toHaveLength(0);
  });
});
