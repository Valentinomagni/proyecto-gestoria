/**
 * Que se le muestra a alguien que no pudo entrar.
 *
 * PURA: recibe el error, devuelve texto. Se puede probar sin red.
 *
 * LA REGLA DE SEGURIDAD QUE NO SE ROMPE: ante credenciales incorrectas NO se dice cual de las
 * dos fallo. Decir "el usuario existe pero la contrasenia esta mal" le confirma a un desconocido
 * que esa cuenta existe, y en una empresa eso habilita phishing dirigido.
 *
 * Todo lo demas si se explica, y con la accion que desatasca. En el Tablero alguien quedo afuera
 * con un "Usuario no encontrado" y nada mas: no sabia si habia escrito mal, si le habian cambiado
 * el usuario, o si el sistema estaba roto. El sistema SI puede distinguir esos casos, y no
 * hacerlo convierte un problema de treinta segundos en una llamada.
 */
export function mensajeDeLogin(e: unknown): string {
  const msg =
    e && typeof e === "object" && "message" in e ? String((e as { message: unknown }).message) : "";

  if (/failed to fetch|load failed|networkerror/i.test(msg)) {
    return "No hay conexión con el servidor. Revisá tu internet y probá de nuevo.";
  }

  if (/email not confirmed/i.test(msg)) {
    return "Tu cuenta todavía no está confirmada. Avisale a quien administra el sistema para que la habilite.";
  }

  if (/for security purposes|rate limit|too many/i.test(msg)) {
    return "Hubo demasiados intentos seguidos. Esperá un momento y volvé a probar; no hace falta cambiar la contraseña.";
  }

  if (/invalid login credentials/i.test(msg)) {
    // A proposito no se aclara cual de los dos: ver el comentario de arriba.
    return "El correo o la contraseña no coinciden. Si no la recordás, pedile a quien administra el sistema que te la blanquee.";
  }

  return "No se pudo entrar. Probá de nuevo, y si sigue pasando avisale a quien administra el sistema.";
}
