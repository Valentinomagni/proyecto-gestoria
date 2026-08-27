/**
 * ============================================================================
 *  MONITOREO DE ERRORES EN PRODUCCION.
 * ============================================================================
 *
 *  POR QUE ESTA DESDE EL DIA UNO Y NO "MAS ADELANTE": en el Tablero Contable la unica forma de
 *  enterarse de un error en produccion es que alguien avise por WhatsApp. Su propio
 *  docs/SEGURIDAD.md lo llama, textual, "el mayor riesgo operativo real" y lo recomienda como
 *  la UNICA herramienta externa a incorporar sin reservas. Sigue sin estar.
 *
 *  Aca una gestora usa esto parada en el registro, sola. Si la pantalla se rompe y nadie se
 *  entera, el tramite se frena y el sistema pierde la confianza que tardo meses en ganar.
 *
 *  ============================================================================
 *  POR QUE SE CARGA APARTE Y DESPUES, Y NO CON EL RESTO
 *  ============================================================================
 *
 *  Medido: importar Sentry de forma normal llevo el arranque de 59,94 kB a 91,38 kB
 *  comprimidos. Son 31 kB en CADA carga, y quien mas los paga es justamente la gestora, con
 *  datos moviles, parada en el registro, que es la persona a la que este proyecto tiene que
 *  hacerle la vida mas facil.
 *
 *  Entonces entra por `import()` dinamico, en su propio pedazo, despues del primer dibujo. Lo
 *  que se pierde es la ventana de unos milisegundos hasta que carga, y por eso hay una cola:
 *  lo que falle antes se guarda y se manda cuando llega. Nada se pierde.
 *
 *  ============================================================================
 *  LAS CUATRO CONDICIONES, y ninguna es negociable
 *  ============================================================================
 *
 *  1. `sendDefaultPii: false`. Son datos de clientes reales y montos de plata.
 *  2. `tracesSampleRate: 0`. No hace falta monitoreo de rendimiento y traeria ruido.
 *  3. NUNCA contenido de tramites ni importes en el contexto. Solo el identificador.
 *  4. Una segunda sesion de ajuste A LA SEMANA de encenderlo, para filtrar el ruido conocido.
 *
 *  SU CRITERIO DE DESCARTE, escrito de antemano como pide Seiri: si a los dos meses nadie mira
 *  Sentry, SE SACA. Una alerta que nadie mira es ruido, y el ruido entrena a ignorar tambien
 *  las alertas que si importan.
 */

/** Ruido conocido que no es un error del sistema y que no aporta nada leer. */
const RUIDO = [
  /ResizeObserver loop/i,
  /^Script error\.?$/i, // error de otro origen: no trae ni archivo ni linea
  /extension context invalidated/i,
  /chrome-extension:|moz-extension:|safari-extension:/i,
];

type Sentry = typeof import("@sentry/react");

let sentry: Sentry | null = null;
/** Lo que fallo antes de que Sentry terminara de cargar. No se pierde: se manda al llegar. */
const pendientes: { e: unknown; donde: string }[] = [];

export function iniciarMonitoreo(): void {
  const dsn = import.meta.env["VITE_SENTRY_DSN"];

  // Sin DSN no se rompe nada: en desarrollo se trabaja sin monitoreo y esta bien.
  if (!dsn || import.meta.env.DEV) return;

  void import("@sentry/react").then((mod) => {
    mod.init({
      dsn,
      sendDefaultPii: false,
      tracesSampleRate: 0,
      environment: import.meta.env.MODE,
      // Se SACAN las pesadas por nombre, en vez de dejar solo las que queremos.
      //
      // LA DIRECCION DE LA FALLA ES LO QUE DECIDE ESTO, y la primera version la tenia al reves.
      // Con lista blanca, el dia que Sentry renombre una integracion mi filtro la descarta en
      // silencio y me quedo SIN los manejadores globales de error — que es lo unico que
      // necesito, y no me entero nunca. Con lista negra, un renombre deja entrar una
      // integracion de mas: pesa un poco y no rompe nada.
      //
      // Cuando un mecanismo puede fallar, tiene que fallar del lado que no duele.
      integrations: (porDefecto) =>
        porDefecto.filter((i) => !/replay|feedback|tracing|profil|metric/i.test(i.name)),
      beforeSend(evento, pista) {
        const original = pista?.originalException;
        const mensaje =
          (typeof original === "object" && original !== null && "message" in original
            ? String((original as { message: unknown }).message)
            : "") ||
          evento.message ||
          "";

        if (RUIDO.some((r) => r.test(mensaje))) return null;

        // Cinturon ademas de tirantes: aunque sendDefaultPii sea false, se limpia todo lo que
        // pueda arrastrar datos de una persona.
        delete evento.user;
        if (evento.request) delete evento.request.cookies;
        return evento;
      },
    });

    sentry = mod;
    for (const p of pendientes.splice(0)) mod.captureException(p.e, { tags: { donde: p.donde } });
  });
}

/**
 * Reporta un error con contexto MINIMO.
 *
 * `donde` es una etiqueta de pantalla, no un dato. Nunca un nombre de cliente, un dominio ni un
 * importe: eso viaja a un servidor de terceros y no hay ninguna razon para que lo haga.
 */
export function reportar(e: unknown, donde: string): void {
  if (sentry) {
    sentry.captureException(e, { tags: { donde } });
    return;
  }
  // Todavia no cargo. Se guarda, con tope para que un bucle de errores no llene la memoria.
  if (pendientes.length < 20) pendientes.push({ e, donde });
}
