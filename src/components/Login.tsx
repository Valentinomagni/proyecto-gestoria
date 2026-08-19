import { useState, type FormEvent } from "react";
import { LogIn } from "lucide-react";
import { supabase } from "../lib/supabase";
import { mensajeDeLogin } from "../lib/auth";
import { Lockup } from "./Logo";
import { Panel } from "./Panel";

/**
 * La pantalla de entrada.
 *
 * Sin registro publico: las cuentas las crea quien administra el sistema. No es una app de
 * consumo — es la herramienta interna de una empresa, y cualquiera que pueda crearse una cuenta
 * solo es alguien que no deberia estar adentro.
 */
export function Login() {
  const [email, setEmail] = useState("");
  const [clave, setClave] = useState("");
  const [error, setError] = useState("");
  const [entrando, setEntrando] = useState(false);

  async function entrar(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError("");
    setEntrando(true);
    const { error: falla } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: clave,
    });
    if (falla) {
      setError(mensajeDeLogin(falla));
      setEntrando(false);
    }
    // Si sale bien no se apaga `entrando`: la sesion cambia y esta pantalla se desmonta sola.
    // Apagarlo produciria un parpadeo del boton justo antes de desaparecer.
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-side-bg p-6">
      <div className="flex w-full max-w-sm flex-col items-center gap-6">
        <Lockup tono="blanco" alto={72} />

        <Panel className="w-full">
          <h1 className="text-lg mb-1">Gestoría</h1>
          <p className="text-sm text-ink2 mb-5">Entrá con tu cuenta de la empresa.</p>

          <form onSubmit={entrar} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-ink2">Correo</span>
              <input
                type="email"
                value={email}
                onChange={(ev) => setEmail(ev.target.value)}
                autoComplete="username"
                required
                className="rounded-md border border-line bg-surface2 px-3 py-2 text-base"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs text-ink2">Contraseña</span>
              <input
                type="password"
                value={clave}
                onChange={(ev) => setClave(ev.target.value)}
                autoComplete="current-password"
                required
                className="rounded-md border border-line bg-surface2 px-3 py-2 text-base"
              />
            </label>

            {error !== "" && (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={entrando}
              className="mt-1 flex items-center justify-center gap-2 rounded-md bg-accent px-3 py-2 text-sm text-accent-ink disabled:opacity-60"
            >
              <LogIn aria-hidden="true" size={16} />
              {entrando ? "Entrando" : "Entrar"}
            </button>
          </form>
        </Panel>

        <p className="text-2xs text-side-ink2">
          Las cuentas las crea quien administra el sistema.
        </p>
      </div>
    </div>
  );
}
