#!/usr/bin/env node
/**
 * ============================================================================
 *  EL SERVICE WORKER NO CACHEA UN SOLO PESO
 * ============================================================================
 *
 *  Es el guardian mas importante de esta tanda, y conviene decir por que con todas las letras.
 *
 *  Un service worker que cachee las respuestas de Supabase le va a mostrar a la gestora un SALDO
 *  VIEJO CON CARA DE SALDO ACTUAL. No un error, no un cartel: un numero, bien dibujado, que ya no
 *  es cierto. Y con ese numero ella decide si sale al registro a pagar.
 *
 *  Es el mismo pecado que este proyecto ya tiene documentado tres veces —un cero que se lee como
 *  un hecho— pero peor, porque un cero al menos llama la atencion y un saldo de ayer no.
 *
 *  ============================================================================
 *   LO QUE SI SE CACHEA
 *  ============================================================================
 *
 *  El armazon: el HTML, el JS, el CSS, la tipografia y los iconos. Con eso la app ABRE sin senial
 *  y puede decir que no hay conexion, que es infinitamente mejor que no abrir. Los datos no.
 *
 *  ============================================================================
 *   POR QUE SE LEE EL ARCHIVO GENERADO Y NO LA CONFIGURACION
 *  ============================================================================
 *
 *  Porque la configuracion es la intencion y el archivo generado es el hecho. Entre las dos hay un
 *  plugin que puede cambiar de version. Este guardian lee `dist/sw.js`, que es lo que de verdad se
 *  le entrega al navegador.
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";

const SW = "dist/sw.js";

if (!existsSync(SW)) {
  console.error(`\n  No existe ${SW}. Corré primero: npm run build\n`);
  process.exit(1);
}

const sw = readFileSync(SW, "utf8");

/*
  Si el dominio de Supabase aparece en el service worker, algo lo esta mirando.

  LOS PUNTOS Y LAS BARRAS ACEPTAN LA FORMA ESCAPADA. Cuando una regla de cache llega al service
  worker generado, llega como EXPRESION REGULAR: `supabase\.co`, no `supabase.co`. La primera
  version de este guardian buscaba el punto literal y contestaba OK con la regla puesta — o sea
  que la mitad del guardian estaba ciega justo para el caso que existe.

  Se descubrio metiendole la violacion a mano: la estrategia salio en rojo y el dominio en verde,
  al mismo tiempo, mirando el mismo archivo.
*/
const PUNTO = "\\\\?\\.";
const BARRA = "\\\\?/";

const SOSPECHAS = [
  { patron: new RegExp(`supabase${PUNTO}co`, "i"), que: "el dominio de Supabase" },
  { patron: new RegExp(`${BARRA}rest${BARRA}v1`, "i"), que: "la ruta de la API de datos" },
  { patron: new RegExp(`${BARRA}auth${BARRA}v1`, "i"), que: "la ruta de autenticacion" },
  /*
    SE BUSCAN LAS ESTRATEGIAS Y NO `registerRoute`. La primera version de este guardian buscaba
    `registerRoute`, y marcaba en rojo un service worker correcto: Workbox lo emite SIEMPRE para
    el `NavigationRoute` del armazon, aunque no haya una sola regla de cache configurada.

    Un guardian que marca codigo correcto se termina apagando, y despues no esta el dia que hace
    falta. Las cuatro estrategias de abajo son las unicas formas que tiene Workbox de guardar una
    respuesta de red: si aparece cualquiera, algo se esta cacheando en tiempo de ejecucion.
  */
  {
    patron: /NetworkFirst|CacheFirst|StaleWhileRevalidate|NetworkOnly\s*\(|runtimeCaching/,
    que: "una estrategia de cache en tiempo de ejecucion",
  },
  /*
    ============================================================================
     Y EL CACHE ESCRITO A MANO, QUE ES EL QUE ESTE GUARDIAN NO VEIA
    ============================================================================

    LO ENCONTRO LA REVISION DE SEGURIDAD DEL 28/08/2026, probandolo de las dos maneras: la
    violacion con forma de Workbox salia en rojo, y un service worker de siete lineas que cachea
    TODA respuesta de red salia en VERDE, con el cartel "el armazon se cachea y los datos no".

        self.addEventListener("fetch", (ev) => { ev.respondWith((async () => {
          const c = await caches.open("datos");
          const h = await c.match(ev.request); if (h) return h;
          const r = await fetch(ev.request); c.put(ev.request, r.clone()); return r;
        })()) });

    Las cuatro sospechas de arriba son todas de Workbox. La Cache Storage API pelada no aparece en
    ninguna, y se llega a ella pasando a `strategies: "injectManifest"`, que es la forma normal de
    pedir "un poco mas de offline".

    Se miran las TRES piezas que hacen falta juntas para guardar una respuesta: abrir un cache,
    escribir en el, y responder una peticion. Cualquiera de las tres sola puede ser legitima; las
    tres en el mismo archivo son un cache de datos escrito a mano.
  */
  {
    patron: /caches\s*\.\s*open|\.\s*put\s*\(\s*(?:ev|event|e)\s*\.\s*request/,
    que: "un cache escrito a mano (Cache Storage sin Workbox)",
  },
  {
    patron: /addEventListener\s*\(\s*["']fetch["']/,
    que: "un manejador de `fetch` propio, que puede responder desde cache",
  },
];

let malos = 0;
for (const s of SOSPECHAS) {
  const hay = s.patron.test(sw);
  console.log(`  ${hay ? "MAL " : "OK  "} ${hay ? "aparece" : "no aparece"} ${s.que}`);
  if (hay) malos++;
}

/*
  Y QUE EL ARMAZON SI ESTE. Un service worker que no cachea nada no sirve para abrir sin senial, y
  el sintoma seria el peor: la app instalada que no abre. Se cuenta lo precacheado en vez de
  buscar un nombre de archivo, porque los nombres llevan hash y cambian en cada build.
*/
const precacheados = [...sw.matchAll(/"revision"|revision:/g)].length;
const bastante = precacheados >= 5;
console.log(`  ${bastante ? "OK  " : "MAL "} el armazon precachea ${precacheados} archivo(s)`);
if (!bastante) malos++;

/* El manifiesto, sin el cual el navegador no ofrece instalar nada. */
const MANIFIESTO = "dist/manifest.webmanifest";
if (!existsSync(MANIFIESTO)) {
  console.error("  MAL  no se genero el manifiesto");
  malos++;
} else {
  const m = JSON.parse(readFileSync(MANIFIESTO, "utf8"));
  const iconos = m.icons ?? [];
  const tieneMaskable = iconos.some((i) => String(i.purpose ?? "").includes("maskable"));
  console.log(
    `  ${iconos.length >= 2 ? "OK  " : "MAL "} el manifiesto trae ${iconos.length} iconos`,
  );
  if (iconos.length < 2) malos++;

  /*
    EL `maskable` NO ES UN LUJO. Sin uno, Android recorta el icono cuadrado dentro de su forma y
    se come los bordes del isotipo. Se ve en el escritorio del telefono de la duenia.
  */
  console.log(`  ${tieneMaskable ? "OK  " : "MAL "} hay un icono maskable para Android`);
  if (!tieneMaskable) malos++;

  // Y que los archivos que nombra existan de verdad: un manifiesto que apunta a un 404 instala
  // la app sin icono, y eso no da error en ningun lado.
  const enDist = new Set(readdirSync("dist/brand", { withFileTypes: true }).map((d) => d.name));
  for (const i of iconos) {
    const nombre = String(i.src).split("/").pop();
    if (!enDist.has(nombre)) {
      console.error(`  MAL  el manifiesto nombra ${String(i.src)} y no esta en dist/`);
      malos++;
    }
  }
}

if (malos > 0) {
  console.error(`\n  ${malos} problema(s) en el service worker o el manifiesto.`);
  console.error("  Si cachea la API: un saldo viejo con cara de saldo actual es peor que un");
  console.error("  error, porque no llama la atencion y con ese numero se sale a pagar.\n");
  process.exit(1);
}

console.log("\npwa: el armazon se cachea y los datos no.");
process.exit(0);
