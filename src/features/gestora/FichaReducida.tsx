import { Link } from "@tanstack/react-router";
import {
  useAgregarNota,
  useConceptos,
  useConceptosDelTramite,
  useNotasDelTramite,
  useRazonesSociales,
  useTramite,
} from "@/lib/datos";
import { Notas } from "@/features/tramites/Notas";
import { Panel } from "@/components/Panel";
import { SkeletonLineas } from "@/components/Skeleton";
import { aCentavos, formatearCorto } from "@/lib/plata";

/**
 * ============================================================================
 *  LO QUE VE LA GESTORA AL TOCAR EL NOMBRE
 * ============================================================================
 *
 *  La cola es la pantalla, pero no es todo lo que puede ver. Acá está lo que a ella le sirve y
 *  NADA MAS (spec 5): los datos del trámite y el presupuesto con sus líneas.
 *
 *  NO ESTA el historial de estados, ni los cambios, ni el costo real, ni ninguna cifra de la
 *  empresa. Eso último no es una decisión de esta pantalla: la RLS ya lo impide. Que igual no se
 *  PIDA es para que la pantalla no se llene de bloques vacíos y de errores en consola, que es lo
 *  que se ve cuando se pide lo que no se puede leer.
 *
 *  UNA SOLA COLUMNA, siempre. Se mira en un teléfono con una mano.
 */
export function FichaReducida({ tramiteId }: { tramiteId: string }) {
  const tramite = useTramite(tramiteId);
  const lineas = useConceptosDelTramite(tramiteId);
  /*
    EL NOMBRE DEL CONCEPTO NO VIENE EN LA LINEA. `useConceptosDelTramite` trae `concepto_id` y no
    el nombre; el catálogo se pide aparte y se cruza acá, que es lo que ya hace la ficha de la
    oficina. Los dos son catálogos cacheados largo, así que no cuesta una consulta por trámite.
  */
  const conceptos = useConceptos();
  const empresas = useRazonesSociales();
  const notas = useNotasDelTramite(tramiteId);
  const agregarNota = useAgregarNota(tramiteId);

  if (tramite.isPending) return <SkeletonLineas cantidad={5} className="mx-auto max-w-xl p-4" />;

  if (tramite.isError || tramite.data === undefined || tramite.data === null) {
    return (
      <div className="mx-auto max-w-xl p-6">
        <h1 className="text-xl">Ese trámite no está en tu lista</h1>
        <p className="mt-2 text-sm text-ink2">
          Puede ser que ya lo hayas devuelto, o que lo lleve otra persona.
        </p>
        <Link to="/" className="mt-4 inline-block text-sm underline">
          Volver a mis trámites
        </Link>
      </div>
    );
  }

  const t = tramite.data;
  const nombreDeConcepto = new Map((conceptos.data ?? []).map((c) => [c.id, c.nombre]));
  const nombreDeEmpresa = new Map((empresas.data ?? []).map((e) => [e.id, e.nombre]));
  const presupuesto = (lineas.data ?? []).filter((l) => l.momento === "presupuesto");

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4 p-4">
      <h1 className="text-xl" style={{ viewTransitionName: `tramite-${tramiteId}` }}>
        {t.cliente_nombre}
      </h1>

      <Panel className="flex flex-col gap-2">
        <Dato rotulo="Dominio" valor={t.dominio} />
        <Dato rotulo="Empresa" valor={nombreDeEmpresa.get(t.razon_social_id) ?? null} />
        <Dato rotulo="Vehículo" valor={t.vehiculo} />
        <Dato rotulo="Cuenta" valor={t.cliente_cuenta} />
        <Dato rotulo="Seccional" valor={t.seccional} />
      </Panel>

      <Panel>
        <h2 className="text-2xs uppercase tracking-wide text-ink2">Presupuesto</h2>
        {presupuesto.length === 0 ? (
          <p className="mt-2 text-xs text-ink2">Todavía no cargaste ninguna línea.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1">
            {/*
              LAS ANULADAS SE MUESTRAN TACHADAS, no se esconden. Es la regla del proyecto —nada se
              borra— y es lo que ya hace `Presupuesto.tsx` en la ficha de la oficina, con la misma
              tachadura. Esconderlas acá haría que la gestora y la oficina vieran presupuestos
              distintos del mismo trámite.
            */}
            {presupuesto.map((l) => (
              <li key={l.id} className="flex justify-between gap-4 text-sm">
                <span className={l.anulada ? "text-ink2 line-through" : ""}>
                  {nombreDeConcepto.get(l.concepto_id) ?? "concepto"}
                </span>
                <span className={`tnum ${l.anulada ? "text-ink2 line-through" : ""}`}>
                  {formatearCorto(aCentavos(l.importe))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {/*
        SE REUSA EL COMPONENTE DE LA OFICINA, no se escribe uno parecido. Es la misma conversación
        vista desde el otro lado, y dos componentes distintos para la misma conversación se
        separan la primera vez que alguien agregue un campo.

        Es por donde la oficina le deja escrito lo que hoy se dice por WhatsApp —"no lo presentes
        hasta que llegue el 08"— y por donde ella contesta.
      */}
      <Notas
        notas={notas.data ?? []}
        cargando={notas.isLoading}
        alAgregar={(texto) => {
          agregarNota.mutate(texto);
        }}
        guardando={agregarNota.isPending}
      />
    </div>
  );
}

/** Un dato del trámite. Si no está cargado lo dice: un renglón vacío se lee como un error. */
function Dato({ rotulo, valor }: { rotulo: string; valor: string | null }) {
  const vacio = valor === null || valor === "";
  return (
    <p className="flex justify-between gap-4 text-sm">
      <span className="text-ink2">{rotulo}</span>
      <span className={vacio ? "text-ink2" : ""}>{vacio ? "sin cargar" : valor}</span>
    </p>
  );
}
