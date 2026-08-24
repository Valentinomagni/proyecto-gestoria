import { describe, expect, it } from "vitest";
import { CAMPOS, camposPara, nombreDeCampo } from "./campos-del-tramite";

/**
 * Este archivo decide QUE PUEDE TOCAR CADA ROL en la pantalla. No decide permisos: los decide el
 * trigger `b_tramites_bloquear_campos` de la base. Lo que se prueba acá es que la pantalla no le
 * ofrezca a una gestora un campo que la base le va a rechazar — porque un formulario que se
 * rechaza al guardar enseña a desconfiar de la pantalla entera, y después no se confía tampoco
 * en los campos que sí andaban.
 */

/**
 * La lista `permitidos` del trigger, copiada tal cual de
 * `supabase/migrations/20260819160416_tramites.sql`.
 *
 * `deposito_solicitado` está en la lista de la base pero NO se ofrece en pantalla: desde el
 * 21/08/2026 es un valor derivado —la suma de los conceptos— y hay un segundo trigger,
 * `b_tramites_total_derivado`, que impide escribirlo a mano. Sigue permitido en el primero
 * porque el recálculo pasa por ahí con el `auth.uid()` de la gestora.
 */
const PERMITIDOS_A_LA_GESTORA = [
  "deposito_solicitado", "seccional", "numero_pago_registro", "observaciones_gestora",
  "documentacion_retirada", "dominio", "estado", "presentado_at", "pagado_at", "retirado_at",
  "presupuestado_at", "actualizado_at", "actualizado_por",
];

describe("la pantalla no le ofrece a la gestora nada que la base le rechace", () => {
  it("todos los campos que se le ofrecen estan en la lista del trigger", () => {
    for (const c of camposPara("gestora")) {
      expect(PERMITIDOS_A_LA_GESTORA, `la base le rechazaria ${c.columna}`).toContain(c.columna);
    }
  });

  it("y no le ofrece la gestora ni el administrativo, que son de la oficina", () => {
    const columnas = camposPara("gestora").map((c) => c.columna);
    expect(columnas).not.toContain("gestora_id");
    expect(columnas).not.toContain("administrativo");
  });

  it("tampoco el total del presupuesto, que es derivado", () => {
    // Si esto apareciera, la pantalla ofreceria escribir a mano el numero del que cuelga la
    // reserva de la tarjeta — y la base lo rechazaria con un mensaje que nadie pidio.
    for (const rol of ["gestora", "contable", "gerencia"] as const) {
      expect(camposPara(rol).map((c) => c.columna)).not.toContain("deposito_solicitado");
    }
  });
});

describe("la oficina puede cambiar quien hace el tramite", () => {
  it("gerencia edita la gestora asignada", () => {
    // Es el ejemplo textual del pedido: "que permita modificar datos, por ejemplo la gestora
    // que realiza el tramite".
    expect(camposPara("gerencia").map((c) => c.columna)).toContain("gestora_id");
  });

  it("y contable tiene exactamente lo mismo que gerencia", () => {
    expect(camposPara("contable").map((c) => c.columna))
      .toEqual(camposPara("gerencia").map((c) => c.columna));
  });
});

describe("sin rol asignado no se edita nada", () => {
  it("no se le ofrece ningun campo", () => {
    expect(camposPara("sin_asignar")).toHaveLength(0);
  });
});

describe("cada columna tiene un nombre en castellano", () => {
  it("ninguna se muestra con el nombre de la base", () => {
    // Si esto falla, el panel de cambios diria "gestora_id" en vez de "Gestora".
    for (const c of CAMPOS) {
      expect(c.nombre, `${c.columna} se muestra con nombre de base`).not.toContain("_");
      expect(c.nombre.length).toBeGreaterThan(2);
    }
  });

  it("lo traduce, y una columna desconocida no rompe: se muestra como viene", () => {
    expect(nombreDeCampo("gestora_id")).toBe("Gestora");
    expect(nombreDeCampo("una_columna_nueva")).toBe("una_columna_nueva");
  });
});
