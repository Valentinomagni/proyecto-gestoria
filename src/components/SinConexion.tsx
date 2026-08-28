import { useEffect, useState } from "react";
import { CloudOff } from "lucide-react";
import { Panel } from "@/components/Panel";

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
export function SinConexion() {
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
      </Panel>
    </div>
  );
}
