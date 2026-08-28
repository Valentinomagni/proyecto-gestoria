import { lazy, Suspense } from "react";
import {
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  Outlet,
  useNavigate,
} from "@tanstack/react-router";
import { Shell } from "./components/Shell";
import { SkeletonLineas } from "./components/Skeleton";
import { Resumen } from "./features/resumen/Resumen";
import { Cola } from "./features/gestora/Cola";
import { useSesion } from "./lib/sesion";
import { Empresa } from "./features/empresa/Empresa";
import { Ficha } from "./features/tramites/Ficha";
import { AltaTramite } from "./features/tramites/AltaTramite";
import { NuevoMovimiento } from "./features/empresa/NuevoMovimiento";

/**
 * ============================================================================
 *  LAS PANTALLAS TIENEN DIRECCION, Y EL BOTON ATRAS FUNCIONA
 * ============================================================================
 *
 *  `@tanstack/react-router` estaba en `package.json` desde el principio y NO LO USABA NADIE: la
 *  navegación era un `useState` en `App.tsx`. Dos consecuencias que se veían todos los días:
 *
 *   - el botón "atrás" del navegador SACABA A LA PERSONA DE LA APP;
 *   - ninguna pantalla se podía mandar por mensaje.
 *
 *  Lo segundo importa más de lo que parece: la forma normal de decirle algo a alguien en esta
 *  empresa es mandarle un mensaje, y hasta hoy no había forma de mandar un trámite.
 */

/*
  ADMINISTRACION VA EN UN PEDAZO APARTE. Se entra dos veces al mes, no todos los días, y arrastra
  el calendario de feriados y el respaldo. Cargarla siempre le suma peso al primer dibujo de la
  pantalla que se mira treinta veces por día.
*/
const Admin = lazy(() => import("./features/admin/Admin").then((m) => ({ default: m.Admin })));

/**
 * La raíz. El `Shell` envuelve al `Outlet` y no al revés.
 *
 * ES EL CUELLO DE BOTELLA DE ESTA TAREA, y está escrito para que no se descubra por sorpresa. Sin
 * router, `App.tsx` resolvía la sesión y recién después elegía pantalla. Con router, la ruta se
 * resuelve PRIMERO: si el componente de la ruta pidiera datos antes de que haya sesión, Supabase
 * devolvería cero filas sin error y la pantalla quedaría en blanco, con un mensaje que no habla
 * de sesión.
 *
 * El `Shell` ya sabe esperar a la sesión, mostrar el login, y explicar el caso de la cuenta sin
 * rol. Poniéndolo afuera, ninguna ruta se dibuja antes de tiempo.
 */
const rutaRaiz = createRootRoute({
  component: () => (
    <Shell>
      <Outlet />
    </Shell>
  ),
  notFoundComponent: NoExiste,
});

/**
 * ============================================================================
 *  LA MISMA DIRECCION, DOS PRODUCTOS
 * ============================================================================
 *
 *  `/` es el resumen de empresas para la oficina y la cola para la gestora. Son dos productos
 *  distintos sobre la misma base, y cada uno entra por su puerta sin tener que elegirla.
 *
 *  POR QUE NO DOS RUTAS: una ruta aparte obligaría a que algo mande ahí —un redirect o un menú—.
 *  Un redirect deja una dirección intermedia en el historial que rompe el botón "atrás", y un
 *  menú es justo lo que la app de la gestora no tiene.
 *
 *  EL ROL LO DECIDE LA BASE, no esta función: `useSesion` lo lee de `perfiles`. Y aunque alguien
 *  llegara a dibujar la pantalla que no le toca, la RLS ya impide que vea lo que no es suyo —
 *  esto elige qué mostrar, no qué proteger.
 */
function PantallaDeEntrada() {
  const { rol } = useSesion();
  return rol === "gestora" ? <Cola /> : <Resumen />;
}

const rutaResumen = createRoute({
  getParentRoute: () => rutaRaiz,
  path: "/",
  component: PantallaDeEntrada,
});

export const rutaEmpresa = createRoute({
  getParentRoute: () => rutaRaiz,
  path: "/empresa/$razonSocialId",
  component: Empresa,
});

export const rutaTramite = createRoute({
  getParentRoute: () => rutaRaiz,
  path: "/empresa/$razonSocialId/tramite/$tramiteId",
  component: FichaEnRuta,
});

/*
  ============================================================================
   CARGAR UN TRAMITE Y CARGAR DINERO SON RUTAS, NO DIALOGOS
  ============================================================================

  Las dos viven adentro de la empresa, porque un tramite pertenece a una razon social y un
  deposito es a una tarjeta que es de una empresa.

  Y son RUTAS y no ventanas emergentes por tres razones concretas: el boton "atras" del navegador
  las cierra, la direccion se puede compartir, y no hace falta ninguna maquinaria de foco atrapado
  —que es de lo que mas se rompe en accesibilidad y de lo que menos se prueba.
*/
export const rutaNuevoTramite = createRoute({
  getParentRoute: () => rutaRaiz,
  path: "/empresa/$razonSocialId/nuevo",
  component: NuevoTramiteEnRuta,
});

export const rutaNuevoMovimiento = createRoute({
  getParentRoute: () => rutaRaiz,
  path: "/empresa/$razonSocialId/dinero",
  component: NuevoMovimiento,
});

const rutaAdmin = createRoute({
  getParentRoute: () => rutaRaiz,
  path: "/administracion",
  component: () => (
    <Suspense fallback={<SkeletonLineas cantidad={6} className="m-6 max-w-2xl" />}>
      <Admin />
    </Suspense>
  ),
});

/** La ficha lee su id de la ruta y vuelve a la empresa de la que salió, no a "atrás" en general. */
function FichaEnRuta() {
  const { razonSocialId, tramiteId } = rutaTramite.useParams();
  const navegar = useNavigate();
  return (
    <Ficha
      id={tramiteId}
      alVolver={() => void navegar({ to: "/empresa/$razonSocialId", params: { razonSocialId } })}
    />
  );
}

/** El alta recibe la empresa de la ruta, y al guardar vuelve a ella. */
function NuevoTramiteEnRuta() {
  const { razonSocialId } = rutaNuevoTramite.useParams();
  const navegar = useNavigate();
  return (
    <AltaTramite
      razonSocialId={razonSocialId}
      alGuardar={() => void navegar({ to: "/empresa/$razonSocialId", params: { razonSocialId } })}
    />
  );
}

/**
 * Una dirección que no existe lo dice, y ofrece la salida.
 *
 * Sin esto TanStack dibuja su pantalla en inglés, con jerga de router. Alguien que abre un enlace
 * viejo tiene que entender qué pasó y poder seguir.
 */
function NoExiste() {
  return (
    <div className="mx-auto max-w-lg p-6">
      <h1 className="text-xl">Esa dirección no existe</h1>
      <p className="mt-2 text-sm text-ink2">
        Puede ser un enlace viejo, de cuando la pantalla se llamaba de otra forma.
      </p>
      <Link to="/" className="mt-4 inline-block text-sm underline">
        Ir al resumen
      </Link>
    </div>
  );
}

const arbol = rutaRaiz.addChildren([
  rutaResumen,
  rutaEmpresa,
  rutaNuevoTramite,
  rutaNuevoMovimiento,
  rutaTramite,
  rutaAdmin,
]);

export const router = createRouter({
  routeTree: arbol,
  /*
    VOLVER ATRAS RESTAURA EL SCROLL, y no es comodidad: la pantalla de una empresa tiene decenas
    de filas. Bajar treinta, abrir un tramite y volver arriba de todo obliga a buscar de nuevo
    donde se estaba, cada vez.
  */
  scrollRestoration: true,
  /*
    `intent` precarga la ruta cuando el mouse se apoya en el enlace, antes del clic. Es lo que
    hace que abrir una empresa se sienta inmediato en vez de "cargando".
  */
  defaultPreload: "intent",
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
