import { describe, expect, it } from "vitest";
import { revisarCobertura } from "./plazos";

/**
 * ============================================================================
 *  LO UNICO QUE QUEDA VIVO DE `plazos.ts`
 * ============================================================================
 *
 *  Este archivo probaba el calculo de vencimientos por tramite. Ese panel se saco de la ficha el
 *  21/08/2026, y con el se fueron once tests — entre ellos los cuatro que probaban que el sistema
 *  SE NEGARA a calcular sin plazo confirmado, sin fecha de inicio o sin feriados cargados. Estan
 *  en el historial de git.
 *
 *  Queda el aviso de cobertura, que sigue haciendo falta: los feriados los usa el calculo de
 *  cuando acredita un deposito, y un calendario a medio cargar hace que la app diga que la plata
 *  entra un dia antes de que entre.
 */

const AÑO_COMPLETO = new Set(
  // Dieciséis días de un año cualquiera. No importa cuáles: importa cuántos.
  Array.from(
    { length: 16 },
    (_, i) => `2026-${String((i % 12) + 1).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`,
  ),
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
