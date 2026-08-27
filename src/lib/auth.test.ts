import { describe, expect, it } from "vitest";
import { mensajeDeLogin } from "./auth";

describe("mensajeDeLogin", () => {
  it("ante credenciales incorrectas NO dice cuál de las dos falló", () => {
    // Decir "el usuario existe pero la contraseña está mal" le confirma a un desconocido que
    // esa cuenta existe. En una empresa eso habilita phishing dirigido contra gente concreta.
    const m = mensajeDeLogin({ message: "Invalid login credentials" });
    expect(m).toContain("no coinciden");
    expect(m).not.toMatch(/no existe|no encontr|contraseña incorrecta|usuario incorrecto/i);
  });

  it("sin conexión lo dice y ofrece reintentar", () => {
    expect(mensajeDeLogin({ message: "Failed to fetch" })).toContain("conexión");
  });

  it("cuenta sin confirmar dice a quién avisarle", () => {
    const m = mensajeDeLogin({ message: "Email not confirmed" });
    expect(m).toContain("administra el sistema");
  });

  it("demasiados intentos aclara que NO hay que cambiar la contraseña", () => {
    // Sin esa aclaración, la reacción natural es blanquear la clave, que no arregla nada.
    const m = mensajeDeLogin({
      message: "For security purposes, you can only request this after 30 seconds",
    });
    expect(m).toContain("no hace falta cambiar la contraseña");
  });

  it("lo que no se reconoce igual sale en castellano y sin jerga", () => {
    const m = mensajeDeLogin({ message: "AuthApiError: unexpected_failure" });
    expect(m).not.toContain("AuthApiError");
    expect(m).toContain("administra el sistema");
  });

  it("no se cae con null ni con cualquier cosa", () => {
    expect(mensajeDeLogin(null).length).toBeGreaterThan(0);
    expect(mensajeDeLogin("texto").length).toBeGreaterThan(0);
  });
});
