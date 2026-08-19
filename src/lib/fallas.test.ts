import { describe, expect, it } from "vitest";
import { clasificarFalla } from "./fallas";

/**
 * Ningún mensaje crudo de la base llega nunca a la pantalla. Todo pasa por acá, y lo que sale
 * es un título, una explicación en castellano y **la acción que de verdad desatasca**.
 *
 * Ofrecer "Reintentar" cuando reintentar no puede funcionar es peor que no ofrecer nada: la
 * persona aprieta tres veces, ve el mismo error y concluye que el sistema está roto.
 */

describe("orden de las ramas", () => {
  it("sin conexión gana sobre versión vieja, y ese orden NO es negociable", () => {
    // Sin red, un módulo que se baja a demanda TAMBIÉN falla al bajar, y el error se parece al
    // de una versión vieja. Si se evaluara primero "versión vieja", la acción sería
    // "Actualizar", y una recarga sin red deja la pantalla EN BLANCO. Es el peor consejo
    // posible en el peor momento posible: una gestora parada en el registro sin señal.
    const falloDeModulo = { name: "ChunkLoadError", message: "Loading chunk 42 failed" };
    expect(clasificarFalla(falloDeModulo, false).accion).toBe("reintentar");
    expect(clasificarFalla(falloDeModulo, true).accion).toBe("actualizar");
  });
});

describe("permisos", () => {
  it("42501 no ofrece reintentar, porque reintentar no va a cambiar nada", () => {
    const f = clasificarFalla({ code: "42501", message: "new row violates row-level security" }, true);
    expect(f.tipo).toBe("sin-permiso");
    expect(f.accion).toBe("ninguna");
    expect(f.explicacion).not.toContain("row-level");
  });
});

describe("la base cambió y el navegador tiene código viejo", () => {
  it("42703 pide actualizar", () => {
    const f = clasificarFalla({ code: "42703", message: 'column "canal" does not exist' }, true);
    expect(f.tipo).toBe("version-vieja");
    expect(f.accion).toBe("actualizar");
  });

  it("PGRST204 pide actualizar", () => {
    expect(clasificarFalla({ code: "PGRST204", message: "..." }, true).accion).toBe("actualizar");
  });
});

describe("índices únicos, cada uno con su explicación", () => {
  it("dos patentamientos del mismo dominio", () => {
    const f = clasificarFalla(
      { code: "23505", message: 'duplicate key value violates unique constraint "tramites_patentamiento_unico_idx"' },
      true,
    );
    expect(f.tipo).toBe("duplicado");
    expect(f.titulo).toContain("patentamiento");
    expect(f.accion).toBe("ver-existente");
  });

  it("el presupuesto guardado dos veces no es un error para la persona", () => {
    // Apretó guardar dos veces. El índice hizo su trabajo: el saldo no se debitó dos veces.
    // Decirle "error" sería mentirle: para ella salió bien.
    const f = clasificarFalla(
      { code: "23505", message: 'duplicate key value violates unique constraint "movimientos_una_reserva_por_tramite"' },
      true,
    );
    expect(f.tipo).toBe("ya-estaba");
    expect(f.accion).toBe("ninguna");
    expect(f.titulo).toContain("ya");
  });

  it("un duplicado que no reconocemos igual se explica sin jerga", () => {
    const f = clasificarFalla({ code: "23505", message: 'unique constraint "otra_cosa"' }, true);
    expect(f.tipo).toBe("duplicado");
    expect(f.explicacion).not.toContain("constraint");
  });
});

describe("reglas del circuito", () => {
  it("el motivo del trigger llega en castellano y no se tapa con un genérico", () => {
    // El trigger marca sus mensajes para que sobrevivan a la regla de "nunca el mensaje crudo".
    // Sin la marca, el motivo escrito para una persona se perdería junto con el volcado.
    const f = clasificarFalla(
      { code: "P0001", message: "regla_tramite: Para pasar a presupuestado hace falta el monto aproximado" },
      true,
    );
    expect(f.tipo).toBe("regla-del-circuito");
    expect(f.explicacion).toBe("Para pasar a presupuestado hace falta el monto aproximado");
    expect(f.accion).toBe("ninguna");
  });
});

describe("conexión", () => {
  it("sin red se ofrece reintentar", () => {
    const f = clasificarFalla({ message: "Failed to fetch" }, false);
    expect(f.tipo).toBe("sin-conexion");
    expect(f.accion).toBe("reintentar");
  });
});

describe("lo que no se reconoce", () => {
  it("igual sale un mensaje en castellano y sin jerga", () => {
    const f = clasificarFalla(new Error("something exploded"), true);
    expect(f.tipo).toBe("desconocida");
    expect(f.explicacion).not.toContain("exploded");
    expect(f.accion).toBe("reintentar");
  });

  it("el detalle técnico se guarda aparte, para poder pegarlo en una consulta", () => {
    const f = clasificarFalla({ code: "XX000", message: "internal error" }, true);
    expect(f.detalleTecnico).toContain("XX000");
    expect(f.detalleTecnico).toContain("internal error");
  });

  it("el detalle técnico tiene tope: es para pegar, no un volcado", () => {
    const f = clasificarFalla({ message: "x".repeat(5000) }, true);
    expect(f.detalleTecnico.length).toBeLessThanOrEqual(1000);
  });

  it("no se cae con null ni con cualquier cosa", () => {
    expect(clasificarFalla(null, true).tipo).toBe("desconocida");
    expect(clasificarFalla("un texto suelto", true).tipo).toBe("desconocida");
    expect(clasificarFalla(42, true).tipo).toBe("desconocida");
  });
});
