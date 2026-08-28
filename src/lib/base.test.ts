import { describe, expect, it } from "vitest";
import { esLaMismaBase } from "./base";

/**
 * ============================================================================
 *  EL CARTEL DE "BASE COMPARTIDA" SE APAGA SOLO
 * ============================================================================
 *
 *  Se prueba la función pura y no `hayUnaSolaBase()`, que lee `import.meta.env`: lo que puede
 *  salir mal es la DECISION, y la decisión no necesita variables de entorno para probarse.
 *
 *  El caso que importa es el tercero. Si `VITE_SUPABASE_URL_PRODUCCION` quedara vacía en
 *  Cloudflare —que es la forma más probable de equivocarse— la respuesta tiene que ser "sí, es la
 *  misma", o sea el cartel PUESTO. Ante la duda se avisa de más, nunca de menos.
 */
describe("saber si hay una sola base", () => {
  it("sin la variable de produccion, hay una sola", () => {
    expect(esLaMismaBase("https://abc.supabase.co", undefined)).toBe(true);
  });

  it("con la variable vacia tambien: es como no tenerla", () => {
    expect(esLaMismaBase("https://abc.supabase.co", "")).toBe(true);
    expect(esLaMismaBase("https://abc.supabase.co", "   ")).toBe(true);
  });

  it("si apunta a la misma, hay una sola", () => {
    expect(esLaMismaBase("https://abc.supabase.co", "https://abc.supabase.co")).toBe(true);
  });

  it("y si son distintas, ya son dos y el cartel sobra", () => {
    expect(esLaMismaBase("https://dev.supabase.co", "https://prod.supabase.co")).toBe(false);
  });

  it("un espacio de mas no las hace distintas", () => {
    /*
      Las variables de Cloudflare se pegan a mano en un formulario web. Un espacio al final es la
      forma más común de romper una comparación de texto, y acá romperla significa APAGAR el
      cartel en la base de desarrollo — o sea, al revés de lo seguro.
    */
    expect(esLaMismaBase("https://abc.supabase.co ", " https://abc.supabase.co")).toBe(true);
  });
});
