import { useEffect, useState } from "react";
import { CloudOff, RefreshCw, ServerCrash } from "lucide-react";
import { Panel } from "@/components/Panel";
import { BOTON } from "@/lib/campos";

/**
 * Si hay red o no, escuchando al navegador.
 *
 * SE ESCUCHAN LOS DOS EVENTOS Y ADEMAS SE LEE EL VALOR INICIAL. Suscribirse sin leer el estado de
 * arranque deja la app creyendo que hay conexión hasta que se caiga por primera vez — o sea,
 * justo el caso de abrirla ya sin señal, que es para lo que existe todo esto.
 */
export function useHayConexion(): boolean {
  const [hay, setHay] = useState(() => navigator.onLine);

  useEffect(() => {
    const prendio = () => {
      setHay(true);
    };
    const corto = () => {
      setHay(false);
    };
    window.addEventListener("online", prendio);
    window.addEventListener("offline", corto);
    return () => {
      window.removeEventListener("online", prendio);
      window.removeEventListener("offline", corto);
    };
  }, []);

  return hay;
}

/**
 * ============================================================================
 *  SIN CONEXION: SE DICE, Y NO SE MUESTRA NINGUN NUMERO
 * ============================================================================
 *
 *  La app abre sin señal porque el armazón está cacheado. Lo que NO hace es mostrar el último
 *  saldo que vio: un importe viejo con cara de importe actual es peor que un error, porque no
 *  llama la atención y con ese número ella decide si sale al registro a pagar.
 *
 *  POR ESO TAMPOCO HAY "ULTIMA ACTUALIZACION: HACE 2 HORAS". Es la solución que parece prolija y
 *  no lo es: el número queda en pantalla, grande, y la aclaración chiquita al lado. Lo que se lee
 *  es el número.
 *
 *  Y ES LA MISMA REGLA DE SIEMPRE, aplicada a otra ausencia: el 27/08/2026 un cero se leyó como
 *  un hecho y una gestora no salió a pagar teniendo ocho millones y medio. Un saldo de ayer se
 *  lee como un hecho de la misma forma.
 *
 *  EL TEXTO ES NEUTRAL porque esto lo ven los dos productos: vive en el `Shell`, arriba de todo,
 *  y le aparece igual a la gestora en la calle que a la oficina si se le cae internet.
 */
export function SinConexion({ alReintentar }: { alReintentar?: () => void }) {
  return (
    <div className="mx-auto max-w-xl p-6">
      <Panel className="flex flex-col items-center gap-3 py-8 text-center">
        <CloudOff className="size-8 text-ink2" aria-hidden="true" />
        <h1 className="text-lg">Sin conexión</h1>
        <p className="text-sm text-ink2">
          No podemos mostrarte los saldos ni los trámites hasta que vuelva la señal.
        </p>
        <p className="text-xs text-ink2">
          No te mostramos los últimos que vimos a propósito: un saldo de hace un rato se lee igual
          que el de ahora, y con ese número se sale a pagar.
        </p>
        {alReintentar !== undefined && (
          /*
            EL BOTON NO ESTABA, Y ESO ERA LA MITAD DEL DEFECTO. Sin él, la única salida era que el
            token se renovara —hasta una hora— o recargar a mano. La gestora sale del subsuelo del
            registro, tiene señal, y la app le sigue diciendo que no.
          */
          <button type="button" onClick={alReintentar} className={BOTON}>
            <RefreshCw className="size-4" aria-hidden="true" />
            Probar de nuevo
          </button>
        )}
      </Panel>
    </div>
  );
}

/**
 * ============================================================================
 *  LA BASE CONTESTO, Y CONTESTO QUE NO
 * ============================================================================
 *
 *  ES OTRA PANTALLA A PROPOSITO. Decir "sin conexión" cuando la base respondió con un error propio
 *  es mentir, y encima manda a revisar el WiFi mientras el problema está del otro lado.
 *
 *  El caso que más importa es el 42P17: la recursión en las policies de `perfiles`, que el
 *  CLAUDE.md marca como la trampa número uno porque devuelve 500 en **todas** las tablas. Con el
 *  mensaje de "sin conexión" encima, nadie lo encontraría.
 *
 *  El código se muestra. No es jerga gratuita: es el único dato que sirve para encontrarlo, y la
 *  pantalla dice exactamente qué hacer con él.
 */
export function LaBaseNoContesta({ codigo }: { codigo: string }) {
  return (
    <div className="mx-auto max-w-xl p-6">
      <Panel className="flex flex-col items-center gap-3 py-8 text-center">
        <ServerCrash className="size-8 text-ink2" aria-hidden="true" />
        <h1 className="text-lg">El sistema no está respondiendo</h1>
        <p className="text-sm text-ink2">
          Tenés conexión: el problema está de nuestro lado, no del tuyo. No es nada que hayas hecho
          mal y no se arregla desde acá.
        </p>
        <p className="text-xs text-ink2">
          Avisale a quien administra el sistema y pasale este código: <strong>{codigo}</strong>.
        </p>
      </Panel>
    </div>
  );
}
