import { describe, expect, it } from "vitest";
import { revisarCobertura } from "./plazos";

/**
 * Este aviso existe por un error que se cometió DE VERDAD, probando esta misma pantalla: se
 * declaró que el calendario llegaba hasta fin de año con dos feriados cargados, y el sistema
 * empezó a mostrar vencimientos calculados sobre un calendario incompleto.
 *
 * Es el único agujero que quedaba en todo el diseño del reloj, porque entra por donde no hay
 * control posible: la afirmación de una persona. Un aviso no lo cierra, pero lo dice antes.
 */

const AÑO_COMPLETO = new Set(
  // Dieciséis días de un año cualquiera. No importa cuáles: importa cuántos.
  Array.from({ length: 16 }, (_, i) => `2026-${String((i % 12) + 1).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`),
);

describe("el aviso de cobertura", () => {
  it("no dice nada si no hay cobertura declarada", () => {
    // Sin declaración el sistema ya se niega a calcular: no hace falta ningún aviso.
    expect(revisarCobertura(new Set(), null)).toBeNull();
    expect(revisarCobertura(AÑO_COMPLETO, null)).toBeNull();
  });

  it("avisa cuando se declara un año con pocos feriados", () => {
    // EL CASO REAL: dos feriados y cobertura declarada hasta fin de año.
    const aviso = revisarCobertura(new Set(["2026-12-08", "2026-12-25"]), "2026-12-31");
    expect(aviso).not.toBeNull();
    expect(aviso).toContain("2026 tiene 2");
    expect(aviso).toContain("ANTES de lo real");
  });

  it("avisa, y más fuerte, cuando el año declarado no tiene NINGUNO", () => {
    const aviso = revisarCobertura(new Set(["2025-12-25"]), "2026-12-31");
    expect(aviso).toContain("2026 no tiene ninguno");
  });

  it("no avisa cuando el año declarado está cargado en serio", () => {
    // Un guardián que marca lo correcto se desactiva a la semana.
    expect(revisarCobertura(AÑO_COMPLETO, "2026-12-31")).toBeNull();
  });

  it("no mira los años POSTERIORES al declarado", () => {
    // Cargar de más el año que viene no es un problema: la cobertura declarada no llega hasta
    // ahí, así que ningún vencimiento se calcula con esos datos.
    const conFuturoFlaco = new Set([...AÑO_COMPLETO, "2027-01-01"]);
    expect(revisarCobertura(conFuturoFlaco, "2026-12-31")).toBeNull();
  });
});
