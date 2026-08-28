import { Link } from "@tanstack/react-router";
import { SkeletonLineas } from "../../components/Skeleton";
import { useEmpresa } from "../../lib/resumen";
import { rutaNuevoMovimiento } from "../../rutas";
import { CargarDinero } from "./CargarDinero";

/**
 * Le da a `CargarDinero` la tarjeta de la empresa de la ruta.
 *
 * VIVE SEPARADO DEL FORMULARIO porque el formulario no debería saber nada de rutas: recibe una
 * tarjeta y carga plata en ella. Así también se puede probar sin router.
 */
export function NuevoMovimiento() {
  const { razonSocialId } = rutaNuevoMovimiento.useParams();
  const empresa = useEmpresa(razonSocialId);

  if (empresa.isLoading) return <SkeletonLineas cantidad={4} className="m-6 max-w-lg" />;

  /*
    SIN TARJETA NO SE PUEDE CARGAR PLATA, y hay que decirlo con nombre y apellido. Una razon
    social sin Tarjeta Habitualista asignada existe —se configura en Administracion— y llegar acá
    con un formulario que va a fallar al guardar es peor que no ofrecerlo.
  */
  if (empresa.data === null || empresa.data === undefined || empresa.data.tarjeta_id === null) {
    return (
      <div className="mx-auto max-w-lg p-6">
        <h1 className="text-xl">Esta empresa no tiene tarjeta asignada</h1>
        <p className="mt-2 text-sm text-ink2">
          Sin Tarjeta Habitualista no hay dónde cargar el depósito. Se asigna en Administración, en
          la lista de razones sociales.
        </p>
        <Link to="/" className="mt-4 inline-block text-sm underline">
          Ir al resumen
        </Link>
      </div>
    );
  }

  return (
    <CargarDinero
      tarjetaId={empresa.data.tarjeta_id}
      razonSocialId={razonSocialId}
      nombreDeEmpresa={empresa.data.nombre}
    />
  );
}
