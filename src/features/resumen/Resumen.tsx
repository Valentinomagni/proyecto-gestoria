import { Link } from "@tanstack/react-router";
import { Panel } from "../../components/Panel";
import { SkeletonLineas } from "../../components/Skeleton";
import { aCentavos, formatearCorto } from "../../lib/plata";
import { useResumen, type FilaDeResumen } from "../../lib/resumen";

/**
 * ============================================================================
 *  NIVEL 1 — LAS CINCO EMPRESAS
 * ============================================================================
 *
 *  Es la puerta de entrada de la oficina, y contesta DOS preguntas:
 *
 *    1. ¿Dónde falta plata?      — con qué empresa hay que depositar.
 *    2. ¿Dónde hay algo que hacer? — dónde hay trámites esperando.
 *
 *  Todo lo que no conteste una de las dos es adorno, y por eso acá no hay gráficos, ni
 *  comparaciones contra ayer, ni nada por gestora.
 *
 *  ============================================================================
 *   POR QUE ES ASI Y NO DE OTRA FORMA
 *  ============================================================================
 *
 *  Se compararon tres formas —una tabla plana, una cifra grande con la tabla debajo, y tarjetas
 *  reordenadas por urgencia— y cada una tenía un defecto concreto:
 *
 *    - La tabla plana hace pesar igual la Diferencia que el Saldo de hoy, y la Diferencia es la
 *      única con la que se decide algo.
 *    - La cifra grande ponía adelante el TOTAL DEL GRUPO, y con el total del grupo no se decide
 *      nada: no se deposita en el grupo, se deposita en una tarjeta.
 *    - Las tarjetas reordenadas hacen que una empresa CAMBIE DE LUGAR. Nadie puede aprender que
 *      Paris Autos es la primera si la primera cambia — y es la misma forma de defecto que
 *      `frenado_por_saldo`: algo que se mueve solo, sin que nadie lo pida.
 *
 *  Ésta toma la tabla, le aplica la jerarquía a la Diferencia DE CADA FILA en vez de al total, y
 *  marca lo que necesita algo EN EL LUGAR en vez de moviéndolo.
 *
 *  Es más simple no por tener menos cosas, sino por tener MENOS REGLAS QUE APRENDER: nada se
 *  pliega, nada se reordena, nada aparece o desaparece, y no hace falta interactuar para verlo
 *  entero. Siempre las mismas cinco filas, siempre en el mismo lugar.
 */
export function Resumen() {
  const empresas = useResumen();

  if (empresas.isLoading) return <EsqueletoDelResumen />;

  const filas = empresas.data ?? [];
  const total = filas.reduce((t, e) => t + aCentavos(e.diferencia), 0);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4 p-6">
      <h1 className="text-xl">Grupo Paris</h1>

      <Panel className="p-0 overflow-hidden">
        {/* Los rótulos en el paso más chico de la escala: son referencia, no contenido. */}
        <div className="grid grid-cols-[1fr_auto] items-baseline gap-4 border-b border-line px-4 py-2 text-2xs text-ink2 sm:grid-cols-[1fr_7rem_7rem_13rem_4rem]">
          <span>Empresa</span>
          <span className="hidden text-right sm:block">Saldo hoy</span>
          <span className="hidden text-right sm:block">Reservado</span>
          <span className="text-right">Diferencia</span>
          <span className="hidden text-right sm:block">Esperan</span>
        </div>

        {filas.map((e) => (
          <FilaDeEmpresa key={e.razon_social_id} empresa={e} />
        ))}

        {/*
          EL TOTAL VA EN EL PIE Y EN CHICO. Es util —contesta "cuanto tiene el grupo"— pero no es
          con lo que se decide nada: se deposita en una tarjeta, no en el grupo. Ponerlo grande
          seria darle el peso visual al numero menos accionable de la pantalla.
        */}
        <div className="grid grid-cols-[1fr_auto] items-baseline gap-4 border-t border-line px-4 py-2 text-sm sm:grid-cols-[1fr_7rem_7rem_13rem_4rem]">
          <span className="text-ink2">Total</span>
          <span className="hidden sm:block" />
          <span className="hidden sm:block" />
          <span className="tnum text-right">{formatearCorto(total)}</span>
          <span className="hidden sm:block" />
        </div>
      </Panel>
    </div>
  );
}

/**
 * Una empresa.
 *
 * ES UN `Link` Y NO UN `div` CON `onClick`: se puede abrir en otra pestaña con el clic del medio,
 * copiar con el botón derecho, y el navegador lo trata como lo que es, una dirección. La oficina
 * trabaja con dos empresas a la vez más seguido de lo que parece.
 */
function FilaDeEmpresa({ empresa }: { empresa: FilaDeResumen }) {
  /*
    LO QUE NO SE PUEDE LEER DICE "SIN DATOS". LO QUE ESTA VACIO MUESTRA SUS CEROS.

    La vista hace `left join` y `coalesce(...,0)`, asi que una tarjeta que no se puede leer sale
    con los mismos ceros que una vacia. El 27/08/2026 toda gestora leia las cinco tarjetas en
    `$ 0,00` mientras Paris Autos tenia ocho millones y medio, y salia al registro creyendo que no
    habia con que pagar. Un cero es un numero y se lee como un hecho. "Sin datos" no.

    PERO LA VUELTA TAMBIEN ES FALSA, y costo el 28/08/2026: decidir con `movimientos_visibles > 0`
    ponia "Sin datos" en las tres empresas todavia vacias de gerencia, que las ve todas. Ahi el
    cero SI es el hecho, y esconderlo es la mentira.

    `puedo_ver` es una respuesta de permiso y contesta la pregunta que hay que hacer.
  */
  const seVe = empresa.puedo_ver;
  const espera = empresa.esperan > 0;

  return (
    <Link
      to="/empresa/$razonSocialId"
      params={{ razonSocialId: empresa.razon_social_id }}
      className={`grid grid-cols-[1fr_auto] items-baseline gap-4 border-b border-line px-4 py-2 last:border-b-0 hover:bg-accent-soft sm:grid-cols-[1fr_7rem_7rem_13rem_4rem] ${
        /* La marca de "acá hay algo que hacer" va EN EL LUGAR: un borde, no un cambio de fila. */
        espera ? "border-l-2 border-l-warn" : "border-l-2 border-l-transparent"
      }`}
    >
      <span className="text-sm">{empresa.nombre}</span>

      {!seVe ? (
        /*
          "Sin datos" ocupa el lugar de los TRES importes y no el de las cuatro columnas. Cuando
          abarcaba tambien la de Esperan quedaba pegado al borde derecho, justo debajo de ese
          rotulo, y se leia como si fuera un valor de "Esperan". Se vio mirando la pantalla.
        */
        <span className="text-2xs text-ink2 sm:col-span-3 sm:text-right">Sin datos</span>
      ) : (
        <>
          <span className="hidden tnum text-right text-sm text-ink2 sm:block">
            {formatearCorto(aCentavos(empresa.contable))}
          </span>
          <span className="hidden tnum text-right text-sm text-ink2 sm:block">
            {formatearCorto(aCentavos(empresa.comprometido))}
          </span>
          {/*
            LA DIFERENCIA ES EL NUMERO MAS GRANDE DE LA PANTALLA, y es la unica con la que se
            decide algo. En rojo solo si es negativa: nunca del color de la marca, porque cuando
            todo es teal el rojo de "falta plata" deja de gritar.
          */}
          {/*
            `whitespace-nowrap` NO ES DECORATIVO, y lo pide un defecto que se vio mirando: con la
            columna en 9rem, `$ 11.120.627,92` se partia en DOS LINEAS y la fila pasaba de 44 a 72
            pixeles. El numero con el que se decide todo, cortado al medio.

            Ahora la columna tiene 13rem —medido: entra hasta `$ 999.999.999,99` a 22px— y el
            `nowrap` garantiza que si algun dia no entrara se desborde a la vista en vez de
            partirse en silencio.
          */}
          <span
            className={`tnum whitespace-nowrap text-right text-2xl ${
              aCentavos(empresa.diferencia) < 0 ? "text-danger" : ""
            }`}
          >
            {formatearCorto(aCentavos(empresa.diferencia))}
          </span>
          {/*
            `—` y no `0` cuando no hay nadie esperando: un cero en una columna de cuentas invita a
            leerlo como plata.
          */}
          <span
            className={`hidden tnum text-right text-sm sm:block ${espera ? "text-warn" : "text-ink2"}`}
          >
            {espera ? empresa.esperan : "—"}
          </span>
        </>
      )}
    </Link>
  );
}

/**
 * El esqueleto tiene la FORMA de lo que viene: cinco filas de cuatro columnas.
 *
 * Uno genérico produce un salto al cargar, y ese salto es exactamente lo que se ve barato.
 */
function EsqueletoDelResumen() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4 p-6">
      <SkeletonLineas cantidad={1} className="max-w-40" />
      <Panel className="flex flex-col gap-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="grid grid-cols-[1fr_7rem_7rem_9rem] gap-4">
            <SkeletonLineas cantidad={1} />
            <SkeletonLineas cantidad={1} />
            <SkeletonLineas cantidad={1} />
            <SkeletonLineas cantidad={1} />
          </div>
        ))}
      </Panel>
    </div>
  );
}
