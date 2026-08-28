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
import { Empresa } from "./features/empresa/Empresa";
import { Ficha } from "./features/tramites/Ficha";

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

const rutaResumen = createRoute({
  getParentRoute: () => rutaRaiz,
  path: "/",
  component: Resumen,
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

const arbol = rutaRaiz.addChildren([rutaResumen, rutaEmpresa, rutaTramite, rutaAdmin]);

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
