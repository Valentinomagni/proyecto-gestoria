import { useSaldos } from "@/lib/datos";
import { aCentavos, formatearCorto } from "@/lib/plata";

/**
 * ============================================================================
 *  EL SALDO DE LAS TARJETAS DONDE ELLA TRABAJA
 * ============================================================================
 *
 *  SIN SELECTOR (spec 5). Un selector la obligaría a saber de antemano por qué empresa preguntar,
 *  y ella no piensa por empresa: piensa por trámite.
 *
 *  LA LISTA NO LA ARMA ESTA PANTALLA, LA ARMA EL PERMISO. `puedo_ver` viene de la base y es la
 *  misma respuesta que usa la app de la oficina. Filtrar acá por "las que tienen trámites míos"
 *  sería una segunda regla, que se separa de la primera el día que una de las dos cambie.
 *
 *  Y LO QUE NO SE PUEDE VER NO SE DIBUJA, ni siquiera en cero: el 27/08/2026 toda gestora veía
 *  las cinco tarjetas en `$ 0,00` teniendo ocho millones y medio, y salía al registro creyendo
 *  que no había con qué pagar. Un cero es un número y se lee como un hecho.
 *
 *  El cero de una tarjeta que SI puede ver es otra cosa y sí se muestra: es cierto, y es
 *  justamente la razón por la que uno de sus trámites está esperando plata.
 */
export function SaldoDeArriba() {
  const saldos = useSaldos();

  if (saldos.isPending) return <p className="text-xs text-ink2">Buscando los saldos…</p>;

  const mias = (saldos.data ?? []).filter((s) => s.puedo_ver);

  if (mias.length === 0) {
    return <p className="text-xs text-ink2">Todavía no tenés trámites en ninguna tarjeta.</p>;
  }

  return (
    <div data-saldo-de-arriba="true" className="flex flex-wrap gap-x-4 gap-y-1">
      {mias.map((s) => (
        <p key={s.tarjeta_id} className="text-xs">
          <span className="text-ink2">{s.nombre}</span>{" "}
          {/*
            `tnum` son las cifras de ancho fijo. Sin eso, dos saldos uno al lado del otro bailan
            de ancho cuando cambia un dígito — y acá cambian solos, en tiempo real.
          */}
          <span className="tnum">{formatearCorto(aCentavos(s.contable))}</span>
        </p>
      ))}
    </div>
  );
}
