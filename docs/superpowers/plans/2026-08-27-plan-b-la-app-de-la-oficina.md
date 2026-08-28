# Plan B — La app de la oficina

> **Para quien lo ejecute:** SUB-SKILL OBLIGATORIA: usar `superpowers:subagent-driven-development`
> (recomendada) o `superpowers:executing-plans` para implementarlo tarea por tarea. Los pasos usan
> casillas (`- [ ]`) para llevar la cuenta.

**Objetivo:** reemplazar las cinco pantallas de hoy por tres niveles de profundidad —resumen,
empresa, trámite— con la gama de la Tarjeta Habitualista en el marco y el acabado de una
herramienta cara.

**Arquitectura:** el router de TanStack, que está instalado y apagado, se enciende con tres rutas
anidadas y URLs compartibles. La barra lateral no se reemplaza por otra barra: se reemplaza por
profundidad, con una tira de migas donde cada tramo vuelve. Todo dato nuevo que la pantalla
necesita sale de una vista de la base, no de cuentas en el front, para que la oficina y la gestora
vean el mismo número.

**Stack:** React 19, TanStack Router 1.170, TanStack Query 5, Tailwind 4 (`@theme` en CSS),
Supabase, lucide-react, Playwright con `channel: "chrome"`, `@axe-core/playwright`, `@lhci/cli`.

---

## Constraints globales

Estas valen para **todas** las tareas. Están copiadas del `CLAUDE.md` y de las skills, con sus
valores exactos.

- **Cero emojis.** Ni en la interfaz, ni en los mensajes, **ni en la documentación**. Íconos sólo
  de `lucide-react`. Ojo con `ℹ` (U+2139): Unicode lo clasifica como **letra**, no como símbolo,
  así que se escapa de cualquier filtro por categoría.
- **Español de Argentina, voseo**, tono directo, sin jerga técnica. Un error nunca muestra el
  mensaje crudo de la base.
- **La plata es `numeric(14,2)` en Postgres y centavos enteros en JavaScript.** Todo importe pasa
  por `src/lib/plata.ts`. **Nunca `Number("600.000")`** — da 600, y el error es silencioso.
- **Un número nunca es del color de la marca.** El teal va en el marco; los estados conservan su
  color. Cuando todo es teal, el rojo de "falta plata" deja de gritar.
- **No se mide a las personas.** Ni rankings, ni conteos por gestora, ni comparaciones.
- **Nada se borra.** Un trámite se anula con motivo; un movimiento se compensa con un ajuste.
- **Tipografía Inter Variable, local, sin CDN.** Escala de nueve pasos, `text-2xs` a `text-4xl`.
  Nunca un tamaño a mano.
- **`--ring` es un color y `--ring-sh` es una sombra.** `box-shadow: var(--ring), var(--shadow)`
  es CSS inválido y el navegador **descarta la declaración entera, en silencio**.
- **Toda vista lleva `security_invoker = true`**, y al recrearla hay que volver a poner los
  `revoke`: Postgres no los conserva.
- **`node` y `npm` no están en el PATH.** Todo comando arranca con
  `export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH"`.
- **Códigos de salida:** `comando | tail` devuelve el estado de `tail`. Siempre
  `comando > /tmp/log 2>&1; echo "EXIT: $?"; tail -20 /tmp/log`.
- **El servidor de desarrollo usa el puerto 5173 con `strictPort`.** Esa URL está en las redirect
  URLs de Supabase Auth; cambiarlo rompe el login con un síntoma que no apunta al puerto.
- **Nunca editar JSX con expresiones regulares ni `sed`.**
- **Comentarios en español que explican el POR QUÉ**, no el qué.

---

## Lo que las skills de diseño aportaron, y lo que no

El spec dice, textual: *"El Plan B empieza invocando `ui-ux-pro-max` y `design-system`, antes de
escribir una línea de CSS. Escrito acá para que no se saltee."* Se invocaron. Esto es lo que
salió, para que nadie las vuelva a correr esperando otra cosa.

**Lo que NO sirvió, y es la mayor parte.** El generador de sistemas de diseño devolvió, para la
consulta "internal finance back-office ledger dense data table":

| Recomendó | Por qué no va |
|---|---|
| Patrón "Comparison Table + CTA" | Es una estructura de landing page, con hero y sección de precios. Esto es una herramienta interna |
| Estilo "Exaggerated Minimalism" — *fashion, luxury, editorial* | `font-size: clamp(3rem, 10vw, 12rem)` y "massive whitespace". Lo contrario de una tabla densa |
| Azul `#1E40AF` y verde `#059669` sobre fondo oscuro | La paleta está decidida y es la de Habitualista |
| Fira Code y Fira Sans, **por `@import` de Google Fonts** | El proyecto usa Inter Variable **local, sin CDN**. Es una regla dura |

La base de reglas de UX también resultó genérica para esto: dice "usá separador de miles" y "las
tablas hacen scroll horizontal en móvil". La sección 7 del spec —las nueve decisiones— es mucho
más específica y ya está verificada contra esta app.

**Lo que SÍ aportó, y no está en el spec.** Cuatro reglas concretas, todas sobre navegación, que
importan justo en la tarea del router:

1. **`state-preservation`** — volver atrás tiene que restaurar el scroll, los filtros y lo que
   había escrito. Sin esto, bajar treinta filas, abrir un trámite y volver deja a la persona
   arriba de todo otra vez.
2. **`deep-linking`** — toda pantalla clave alcanzable por URL. Es lo que hoy no existe.
3. **`focus-on-route-change`** — después de cambiar de nivel, el foco se mueve al contenido
   principal. Es requisito WCAG y sin eso quien usa lector de pantalla se queda en el encabezado.
4. **`breadcrumb-web`** — migas para jerarquías de tres niveles o más. Es exactamente esta app, y
   confirma la decisión del spec.

Están incorporadas a las tareas 2 y 3. **No hace falta volver a invocar las skills.**

---

## Estructura de archivos

### Se crean

| Archivo | De qué se ocupa |
|---|---|
| `supabase/migrations/<generado>_resumen_de_empresas.sql` | La vista `v_resumen_empresas`: una fila por razón social con sus cuatro cifras y cuántos esperan plata |
| `src/rutas.tsx` | El árbol de rutas y el router. Un solo archivo: si se parte, el árbol deja de leerse de un vistazo |
| `src/components/Migas.tsx` | La tira de migas y el nombre de quien entró. Es toda la navegación |
| `src/features/resumen/Resumen.tsx` | Nivel 1 — la tabla de las cinco empresas |
| `src/features/empresa/Empresa.tsx` | Nivel 2 — el armado de la pantalla de una empresa |
| `src/features/empresa/CifrasDeLaEmpresa.tsx` | Las cuatro cifras del encabezado, con sus botones |
| `src/features/empresa/SeccionPlegable.tsx` | Una sección con su título, su cuenta, su total y su estado abierto o plegado |
| `src/features/empresa/FilaDeTramite.tsx` | Una fila: fecha, cliente, dominio, gestora, plata |
| `src/features/empresa/MovimientosPlegados.tsx` | El extracto de la tarjeta, plegado y abierto en "hoy" |
| `src/lib/resumen.ts` | Los hooks `useResumen` y `useEmpresa`, y el tipo de sus filas |
| `e2e/oficina.spec.ts` | El circuito de la oficina en el Chrome de verdad |
| `e2e/acabado.spec.ts` | Contraste con axe y capturas contra referencia |
| `scripts/espacios-sanos.mjs` | Ya existe. Pasa de 9 hallazgos a 0 y entra al pre-commit |

### Se modifican

| Archivo | Qué cambia |
|---|---|
| `src/index.css` | Los tokens de la gama teal, las tres sombras, el anillo de foco |
| `src/App.tsx` | Deja de decidir la pantalla con `useState` y monta el router |
| `src/main.tsx` | Envuelve la app con el `RouterProvider` |
| `src/components/Shell.tsx` | Pierde la barra lateral; queda la tira superior y las migas |
| `src/menu.ts` | Deja de ser un menú de pantallas y pasa a decir qué rutas ve cada rol |
| `src/features/tramites/Ficha.tsx` | Se le saca el panel de vencimientos y se le pone `view-transition-name` |
| `src/features/admin/Admin.tsx` | Pasa a vivir detrás del nombre de usuario |
| `src/lib/excel.ts` | Baja **lo que se está mirando**, no el grupo entero |
| `playwright.config.ts` | Se le agrega el proyecto de capturas con su umbral |
| `.githooks/pre-commit` | Entra `espacios` |
| `CLAUDE.md` | La enmienda del color, con su porqué |

### Se borran

Ninguno. `Bandeja.tsx`, `Tarjeta.tsx` y `Listado.tsx` **no se borran en este plan**: sus piezas se
mudan y el archivo viejo queda hasta que la tarea 13 compruebe que nada lo importa. Borrar antes de
comprobar es como se pierde una función que alguien usaba y nadie recordaba.

---

## Contraindicaciones y cuellos de botella

Escritos antes de empezar, porque cada uno ya mordió una vez.

**1. Encender el router toca el login.** La sesión hoy se resuelve en `App.tsx` antes de elegir
pantalla. Con router, la ruta se resuelve primero y puede intentar cargar datos sin sesión. Si eso
pasa, la pantalla queda en blanco y el error no habla de sesión. La tarea 2 lo resuelve con una
ruta raíz que espera a la sesión antes de dibujar nada.

**2. Las capturas de referencia fallan la primera vez, y está bien.** `toHaveScreenshot()` genera
la referencia en la primera corrida y falla. Correrlo dos veces no es un parche: es como funciona.
Lo que **no** hay que hacer es generar la referencia sobre una pantalla que todavía no se miró.

**3. El teal tiene que pasar contraste, y `#0E7C8C` sobre blanco no llega.** El valor del spec es
un punto de partida "aprox.". La tarea 1 los mide y los ajusta; si alguno no llega a 4,5:1 se
oscurece hasta que llegue, y se anota el valor final con su medición.

**4. `npm run espacios` está en rojo con 9 hallazgos**, y varios son de archivos que este plan
reescribe. Arreglarlos antes de reescribir es trabajo que se tira. Entra al pre-commit en la
tarea 12, cuando las pantallas ya estén.

**5. La app tiene una sola base.** Todo lo que se pruebe contra datos reales, se prueba con
transacciones que se deshacen o sobre el trámite de prueba del arnés. **Dos veces en la tanda
anterior una comprobación escribió de verdad en producción** y hubo que anular movimientos a mano.

---

# PARTE 1 — EL MARCO

## Tarea 1: La paleta de Habitualista, medida y no a ojo

**Archivos:**
- Modificar: `src/index.css`
- Crear: `scripts/contraste-sano.mjs`
- Modificar: `package.json` (script `contraste`)

**Interfaces:**
- Produce: los tokens `--marca`, `--marca-2`, `--marca-suave`, `--marca-ink` en claro y oscuro, y
  las tres sombras `--sombra-plana`, `--sombra-panel`, `--sombra-flotante`.
- Consume: la escala de nueve pasos y los tokens de estado que ya están en `index.css`.

**Por qué esta tarea va primera:** todo lo demás usa estos tokens. Y porque un color elegido a ojo
que después no pasa contraste obliga a rehacer las pantallas que ya lo usaron.

- [ ] **Paso 1: Leer lo que ya hay, para no duplicar**

```bash
cd "C:/Users/Vmagni/Desktop/GRUPO PARIS/GESTORIA" && grep -n "@theme\|--ring\|--done\|--warn\|--danger\|--sombra\|--shadow" src/index.css | head -30
```

**Anotá qué tokens ya existen.** Si `--sombra-panel` ya está, no se crea de nuevo: se ajusta.

- [ ] **Paso 2: Escribir el guardián de contraste, ANTES de elegir los colores**

Es al revés de lo que parece natural, y es a propósito: un guardián escrito después de elegir se
escribe para que los colores elegidos pasen.

Crear `scripts/contraste-sano.mjs`:

```js
#!/usr/bin/env node
/**
 * ============================================================================
 *  EL TEAL PASA CONTRASTE, Y SE MIDE
 * ============================================================================
 *
 *  El spec da los valores "aprox." y dice, textual: "los valores finales se sacan muestreando una
 *  captura del sitio y se ajustan hasta pasar contraste AA, medido, no a ojo".
 *
 *  Esto es el "medido". Lee los tokens de `src/index.css` y calcula el contraste real de cada par
 *  que va a existir en pantalla.
 *
 *  ============================================================================
 *   POR QUE 4,5 PARA TEXTO Y 3 PARA LO DEMAS
 *  ============================================================================
 *
 *  Son los umbrales AA de WCAG. El de 3:1 vale para elementos de interfaz —un borde, un anillo de
 *  foco, un icono— porque no hay que leerlos letra por letra. El de 4,5:1 vale para texto.
 *
 *  Mezclarlos es el error facil: un anillo de foco que pasa 3:1 esta bien, y el mismo color como
 *  texto no.
 */
import { readFileSync } from "node:fs";

/** De `oklch(45% 0.09 210)` a sRGB. Es la conversion que hace el navegador. */
function oklchASrgb(l, c, hDeg) {
  const h = (hDeg * Math.PI) / 180;
  const a = c * Math.cos(h);
  const b = c * Math.sin(h);

  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;

  const L = l_ ** 3, M = m_ ** 3, S = s_ ** 3;

  const lin = [
    +4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S,
    -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S,
    -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S,
  ];
  // De lineal a sRGB con la curva gamma, y recortado a [0,1].
  return lin.map((v) => {
    const g = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(Math.max(v, 0), 1 / 2.4) - 0.055;
    return Math.min(1, Math.max(0, g));
  });
}

/** Luminancia relativa, tal como la define WCAG. */
function luminancia([r, g, b]) {
  const f = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contraste(c1, c2) {
  const [a, b] = [luminancia(c1), luminancia(c2)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}

const css = readFileSync("src/index.css", "utf8");

/** Saca `--nombre: oklch(L% C H)` del CSS. Devuelve el color en sRGB. */
function token(nombre, bloque) {
  const trozo = bloque === undefined ? css : (css.split(bloque)[1] ?? "");
  const m = new RegExp(`--${nombre}\\s*:\\s*oklch\\(\\s*([\\d.]+)%\\s+([\\d.]+)\\s+([\\d.]+)`).exec(trozo);
  if (m === null) return null;
  return oklchASrgb(Number(m[1]) / 100, Number(m[2]), Number(m[3]));
}

/*
  LOS PARES QUE VAN A EXISTIR DE VERDAD EN PANTALLA, y solo esos.

  Medir pares que nunca se dibujan juntos da una falsa sensacion de rigor y ademas obliga a
  ajustar colores por un problema que no existe.
*/
const PARES = [
  { texto: "--marca-ink", fondo: "--marca", minimo: 4.5, donde: "el texto de la tira superior" },
  { texto: "--ink", fondo: "--marca-suave", minimo: 4.5, donde: "el texto de una fila seleccionada" },
  { texto: "--marca", fondo: "--surface", minimo: 3, donde: "el anillo de foco y los bordes teal" },
  { texto: "--marca-ink", fondo: "--marca-2", minimo: 4.5, donde: "el texto de la tira de migas" },
];

let malos = 0;
for (const p of PARES) {
  const t = token(p.texto), f = token(p.fondo);
  if (t === null || f === null) {
    console.error(`  falta un token: ${p.texto} o ${p.fondo}`);
    malos++;
    continue;
  }
  const r = contraste(t, f);
  const ok = r >= p.minimo;
  if (!ok) malos++;
  console.log(
    `  ${ok ? "OK  " : "MAL "} ${r.toFixed(2)}:1  (min ${p.minimo})  ${p.texto} sobre ${p.fondo}  — ${p.donde}`,
  );
}

if (malos > 0) {
  console.error(`\n  ${malos} par(es) no llegan al minimo.`);
  console.error("  Bajale luminosidad al teal hasta que llegue. NO le bajes saturacion: un teal");
  console.error("  desaturado se ve enfermo, y eso lo dice el spec.\n");
  process.exit(1);
}

console.log("\ncontraste: todos los pares pasan AA.");
process.exit(0);
```

- [ ] **Paso 3: Cablearlo y verlo FALLAR, porque los tokens todavía no existen**

```bash
cd "C:/Users/Vmagni/Desktop/GRUPO PARIS/GESTORIA" && export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && node -e '
const fs=require("fs");const j=JSON.parse(fs.readFileSync("package.json","utf8"));
j.scripts.contraste="node scripts/contraste-sano.mjs";
fs.writeFileSync("package.json", JSON.stringify(j,null,2)+"\n");' && npm run contraste > /tmp/c.log 2>&1; echo "EXIT: $?"; cat /tmp/c.log
```

Esperado: **EXIT 1**, y "falta un token" cuatro veces. Si diera 0 acá, el guardián no está mirando
nada.

- [ ] **Paso 4: Escribir los tokens en `src/index.css`**

Adentro del bloque `@theme`, después de los tokens que ya están:

```css
/* ============================================================================
   LA GAMA DE LA TARJETA HABITUALISTA
   ============================================================================

   POR QUE EL COLOR DE OTRA MARCA, Y QUIEN LO DECIDIO. Se propuso usar la misma familia con un
   tono propio, porque el hexadecimal de Habitualista es la identidad de otra empresa. La
   respuesta del dueño del producto fue que sea la gama de Habitualista, para que le resulte
   agradable a la dueña. Va como se pidio.

   Queda escrito porque dentro de un anio alguien va a preguntar por que una herramienta de Grupo
   Paris usa el color de otra marca, y la respuesta es que fue una decision deliberada de
   producto, no un descuido.

   ============================================================================
    DONDE VA Y DONDE NO
   ============================================================================

   Entra en el MARCO —la tira de arriba, la de migas— y en UN SOLO acento: el boton principal, el
   anillo de foco, la seccion abierta.

   NO entra en los numeros. Cuando todo es teal, el rojo de "falta plata" deja de gritar, y ese
   grito es la razon de ser del sistema.

   ============================================================================
    EN OKLCH, Y NO ES CAPRICHO
   ============================================================================

   Interpolar entre dos colores en RGB pasa por grises embarrados; en OKLCH no. Importa para la
   transicion de la tarjeta que salta, que es la unica animacion que el producto necesita.

   Los valores salen medidos: `npm run contraste` los comprueba contra WCAG AA y falla si alguno
   no llega.
   ============================================================================ */
--marca: oklch(45% 0.085 205);
--marca-2: oklch(62% 0.075 205);
--marca-suave: oklch(96% 0.015 205);
--marca-ink: oklch(100% 0 0);

/* ============================================================================
   TRES SOMBRAS Y NINGUNA MAS
   ============================================================================

   Una superficie que flota se ve cara; un rectangulo con borde de 1px se ve barato. Cada nivel
   lleva DOS capas: una de contacto, corta y opaca, y una de ambiente, larga y difusa. Con una
   sola capa la sombra se ve pegada o se ve sucia.

   OJO: `--ring` es un COLOR y `--ring-sh` es una SOMBRA. Mezclarlos en un `box-shadow` es CSS
   invalido y el navegador DESCARTA LA DECLARACION ENTERA, en silencio. Eso dejo cinco pantallas
   sin sombra durante meses.
   ============================================================================ */
--sombra-plana: 0 1px 1px oklch(0% 0 0 / 0.04), 0 1px 3px oklch(0% 0 0 / 0.06);
--sombra-panel: 0 1px 2px oklch(0% 0 0 / 0.05), 0 4px 12px oklch(0% 0 0 / 0.08);
--sombra-flotante: 0 2px 4px oklch(0% 0 0 / 0.06), 0 12px 32px oklch(0% 0 0 / 0.14);
```

Y en el bloque de modo oscuro:

```css
/* ============================================================================
   EL TEAL EN OSCURO BAJA LUMINOSIDAD, NO SATURACION
   ============================================================================

   Un teal desaturado se ve enfermo: parece gris con una idea de color, y la tira superior deja de
   leerse como la marca. Lo que cambia es cuanta luz tiene, no cuanto color.

   La tira superior sube de luminosidad —sobre fondo oscuro tiene que separarse del fondo, no
   hundirse—, y `--marca-suave` se da vuelta entero: de casi blanco a un teal muy oscuro.
   ============================================================================ */
--marca: oklch(58% 0.09 205);
--marca-2: oklch(70% 0.075 205);
--marca-suave: oklch(26% 0.03 205);
--marca-ink: oklch(14% 0.01 205);

--sombra-plana: 0 1px 1px oklch(0% 0 0 / 0.25), 0 1px 3px oklch(0% 0 0 / 0.3);
--sombra-panel: 0 1px 2px oklch(0% 0 0 / 0.3), 0 4px 12px oklch(0% 0 0 / 0.4);
--sombra-flotante: 0 2px 4px oklch(0% 0 0 / 0.35), 0 12px 32px oklch(0% 0 0 / 0.5);
```

- [ ] **Paso 5: Medir, y ajustar hasta que pase**

```bash
cd "C:/Users/Vmagni/Desktop/GRUPO PARIS/GESTORIA" && export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && npm run contraste > /tmp/c.log 2>&1; echo "EXIT: $?"; cat /tmp/c.log
```

Esperado: **EXIT 0** y los cuatro pares en OK.

**Si alguno da MAL, bajale la luminosidad al teal** —el primer número del `oklch`— de a 2 puntos y
volvé a medir. **No le bajes la saturación.** Anotá en el comentario del CSS el valor final y su
medición, con esta forma: `/* medido: 5,12:1 el 27/08/2026 */`.

- [ ] **Paso 6: Ver el guardián en rojo a propósito**

Cambiá `--marca` a `oklch(75% 0.085 205)` —un teal claro, que sobre blanco no llega— y medí:

```bash
cd "C:/Users/Vmagni/Desktop/GRUPO PARIS/GESTORIA" && export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && npm run contraste > /tmp/c.log 2>&1; echo "EXIT: $?  (tiene que ser 1)"; grep MAL /tmp/c.log
```

Esperado: **EXIT 1**, y nombra el par que falla. Después volvé el valor bueno y comprobá que da 0.

- [ ] **Paso 7: La enmienda al `CLAUDE.md`**

El `CLAUDE.md` dice hoy que un número nunca es del color de la marca, y eso sigue valiendo. Lo que
hay que agregar es de dónde salió el teal. En la sección de reglas duras, debajo de esa línea:

```markdown
- **El teal de Habitualista va en el marco, y los valores están medidos.** La regla original decía
  monocromo con color sólo en estados; se enmendó a pedido el 26/08/2026 para que le resulte
  familiar a quien lo usa. Lo que no cambió: **un número nunca es del color de la marca.**
  `npm run contraste` falla si un par no llega a AA.
```

- [ ] **Paso 8: Commit**

```bash
cd "C:/Users/Vmagni/Desktop/GRUPO PARIS/GESTORIA" && git add -A && git commit -m "La gama de Habitualista, con el contraste medido y no elegido a ojo"
```

---

## Tarea 2: El router encendido

**Archivos:**
- Crear: `src/rutas.tsx`
- Modificar: `src/main.tsx`, `src/App.tsx`, `src/menu.ts`

**Interfaces:**
- Produce: las rutas `/`, `/empresa/$razonSocialId`, `/empresa/$razonSocialId/tramite/$tramiteId`
  y `/administracion`; y el hook `useNavigate` de TanStack disponible en toda la app.
- Consume: `useSesion` y `usePerfil` de `src/lib/sesion.ts`.

**El defecto que esto arregla, y está vivo hoy:** `@tanstack/react-router` está en
`package.json:34` y **no lo usa nadie** — `grep -rn "createRouter" src/` devuelve cero. La
navegación es un `useState` en `App.tsx:24`. Consecuencia: **el botón "atrás" del navegador saca a
la persona de la app**, y ninguna pantalla se puede mandar por WhatsApp.

- [ ] **Paso 1: Escribir la prueba que falla**

Crear `e2e/rutas.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

/**
 * ============================================================================
 *  LAS URL EXISTEN, Y EL BOTON ATRAS FUNCIONA
 * ============================================================================
 *
 *  Hoy no. La navegación es un `useState`, así que:
 *   - abrir /empresa/loquesea da la pantalla de inicio, sin decir por qué;
 *   - apretar "atrás" saca a la persona de la app;
 *   - ninguna pantalla se puede mandar por mensaje.
 *
 *  Esta prueba corre SIN SESION a propósito: comprueba que la ruta EXISTE y lleva al login, no
 *  que muestre datos. Meter credenciales acá haría una prueba lenta y frágil que además falla el
 *  día que cambie una contraseña.
 */
test("una URL que no existe no rompe la app", async ({ page }) => {
  await page.goto("/estonoexiste");
  await expect(page.getByRole("heading", { name: "Gestoría" })).toBeVisible();
});

test("el atras del navegador vuelve adentro de la app, no la abandona", async ({ page }) => {
  await page.goto("/");
  await page.goto("/administracion");
  await page.goBack();

  // Sigue adentro: la URL vuelve a la raíz y la app sigue dibujada.
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Gestoría" })).toBeVisible();
});
```

- [ ] **Paso 2: Correrla y verla fallar**

```bash
cd "C:/Users/Vmagni/Desktop/GRUPO PARIS/GESTORIA" && export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && npx playwright test e2e/rutas.spec.ts --project=chrome > /tmp/r.log 2>&1; echo "EXIT: $?"; grep -E "passed|failed" /tmp/r.log | tail -2
```

Esperado: **falla**. La segunda prueba falla porque `goBack()` sale de la app.

- [ ] **Paso 3: Escribir el árbol de rutas**

Crear `src/rutas.tsx`:

```tsx
import { lazy, Suspense } from "react";
import {
  createRootRoute, createRoute, createRouter, Outlet, useNavigate,
} from "@tanstack/react-router";
import { Shell } from "./components/Shell";
import { SkeletonLineas } from "./components/Skeleton";
import { Resumen } from "./features/resumen/Resumen";
import { Empresa } from "./features/empresa/Empresa";
import { Ficha } from "./features/tramites/Ficha";

/*
  ============================================================================
   ADMINISTRACION VA EN UN PEDAZO APARTE
  ============================================================================

  Se entra dos veces al mes, no todos los dias, y arrastra el calendario de feriados y el respaldo.
  Cargarla siempre le suma peso al primer dibujo de la pantalla que se mira treinta veces por dia.
*/
const Admin = lazy(() =>
  import("./features/admin/Admin").then((m) => ({ default: m.Admin })),
);

/*
  ============================================================================
   LA RUTA RAIZ ESPERA A LA SESION ANTES DE DIBUJAR NADA
  ============================================================================

  ES EL CUELLO DE BOTELLA DE ESTA TAREA, y esta escrito para que no se descubra por sorpresa. Sin
  router, `App.tsx` resolvia la sesion y recien despues elegia pantalla. Con router, la ruta se
  resuelve PRIMERO: si el componente de la ruta pide datos antes de que haya sesion, Supabase
  devuelve cero filas sin error y la pantalla queda en blanco, con un mensaje que no habla de
  sesion.

  Por eso el Shell —que ya sabe esperar a la sesion y mostrar el login— envuelve al `Outlet`.
*/
const rutaRaiz = createRootRoute({
  component: () => (
    <Shell>
      <Outlet />
    </Shell>
  ),
  notFoundComponent: () => <NoExiste />,
});

const rutaResumen = createRoute({
  getParentRoute: () => rutaRaiz,
  path: "/",
  component: Resumen,
});

const rutaEmpresa = createRoute({
  getParentRoute: () => rutaRaiz,
  path: "/empresa/$razonSocialId",
  component: Empresa,
});

const rutaTramite = createRoute({
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

/** La ficha lee su id de la ruta y vuelve a la empresa de la que salió. */
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

/*
  UNA URL QUE NO EXISTE DICE QUE NO EXISTE, y ofrece la salida.

  Sin esto TanStack dibuja su pantalla en ingles, con jerga de router. Alguien que abre un link
  viejo tiene que entender que paso y poder seguir.
*/
function NoExiste() {
  const navegar = useNavigate();
  return (
    <div className="mx-auto max-w-lg p-6">
      <h1 className="text-xl">Esa dirección no existe</h1>
      <p className="mt-2 text-sm text-ink2">
        Puede ser un enlace viejo, de cuando la pantalla se llamaba de otra forma.
      </p>
      <button type="button" onClick={() => void navegar({ to: "/" })} className="mt-4 text-sm underline">
        Ir al resumen
      </button>
    </div>
  );
}

const arbol = rutaRaiz.addChildren([rutaResumen, rutaEmpresa, rutaTramite, rutaAdmin]);

export const router = createRouter({
  routeTree: arbol,
  /*
    VOLVER ATRAS RESTAURA EL SCROLL, y eso no es un detalle de comodidad: la pantalla de una
    empresa tiene decenas de filas. Bajar treinta, abrir un tramite y volver arriba de todo
    obliga a buscar de nuevo dónde se estaba, cada vez.
  */
  scrollRestoration: true,
  defaultPreload: "intent",
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
```

- [ ] **Paso 4: Montarlo**

En `src/main.tsx`, reemplazar el render de `<App />` por el `RouterProvider`:

```tsx
import { RouterProvider } from "@tanstack/react-router";
import { router } from "./rutas";

// ...donde hoy dice <App />:
<RouterProvider router={router} />
```

Y `src/App.tsx` queda sin la máquina de `useState`: lo que hacía —esperar la sesión y elegir
pantalla— ahora lo hacen el `Shell` y las rutas. Si el archivo queda vacío, se borra en la tarea 13
y no antes.

- [ ] **Paso 5: Correr la prueba y verla pasar**

```bash
cd "C:/Users/Vmagni/Desktop/GRUPO PARIS/GESTORIA" && export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && npx tsc -b > /tmp/a.log 2>&1; echo "TIPOS: $?"; head -15 /tmp/a.log; npx playwright test e2e/rutas.spec.ts --project=chrome > /tmp/r.log 2>&1; echo "RUTAS: $?"; grep -E "passed|failed" /tmp/r.log | tail -2
```

Esperado: los dos en 0.

- [ ] **Paso 6: `menu.ts` deja de ser un menú de pantallas**

Hoy `src/menu.ts` dice qué pantallas ve cada rol. Con tres niveles y sin barra lateral, lo que
queda es **qué rutas** puede abrir cada rol. Reemplazar su contenido por:

```ts
/**
 * ============================================================================
 *  QUE RUTAS VE CADA ROL
 * ============================================================================
 *
 *  ESTO NO ES SEGURIDAD, Y CONVIENE TENERLO CLARO. La RLS de la base es la que impide de verdad
 *  que alguien vea lo que no le toca: si una gestora abriera a mano la URL de administración,
 *  la pantalla se dibujaría y las consultas devolverían cero filas.
 *
 *  Esto es cortesía: evita ofrecer una puerta que no lleva a ningún lado.
 */
export const RUTAS_POR_ROL: Record<string, string[]> = {
  gerencia: ["/", "/empresa", "/administracion"],
  contable: ["/", "/empresa", "/administracion"],
  gestora: ["/", "/empresa"],
  sin_asignar: [],
};

export function puedeVer(rol: string, ruta: string): boolean {
  return (RUTAS_POR_ROL[rol] ?? []).some((r) => ruta === r || ruta.startsWith(`${r}/`));
}
```

- [ ] **Paso 7: Commit**

```bash
cd "C:/Users/Vmagni/Desktop/GRUPO PARIS/GESTORIA" && git add -A && git commit -m "El router encendido: las pantallas tienen direccion y el boton atras funciona"
```

---

## Tarea 3: La tira de migas, que es toda la navegación

**Archivos:**
- Crear: `src/components/Migas.tsx`
- Modificar: `src/components/Shell.tsx`

**Interfaces:**
- Consume: `router` de `src/rutas.tsx`, `usePerfil` de `src/lib/sesion.ts`.
- Produce: el componente `<Migas />`, que el `Shell` dibuja debajo de la tira superior.

**La decisión:** la barra lateral no se reemplaza por otra barra, se reemplaza por **profundidad**.
Arriba queda una tira fina y fija con el camino recorrido —`Grupo Paris / Paris Autos / MARTINEZ
DIEGO`— donde cada tramo es un botón para volver, y el nombre de quien entró a la derecha.

- [ ] **Paso 1: Escribir el componente**

Crear `src/components/Migas.tsx`:

```tsx
import { ChevronRight } from "lucide-react";
import { Link, useMatches } from "@tanstack/react-router";

/**
 * ============================================================================
 *  LA TIRA DE MIGAS ES TODA LA NAVEGACION
 * ============================================================================
 *
 *  El pedido fue textual: "no quiero tener una barra lateral, parece literalmente la replica del
 *  tablero contable". La barra no se cambia por otra barra: se cambia por PROFUNDIDAD.
 *
 *  Tres niveles —resumen, empresa, tramite— y el camino recorrido siempre a la vista, donde cada
 *  tramo vuelve. No hace falta nada mas: si un lugar no esta en el camino, se llega desde el
 *  resumen, que esta a un toque.
 *
 *  ============================================================================
 *   POR QUE LOS TRAMOS SON `Link` Y NO BOTONES
 *  ============================================================================
 *
 *  Un `Link` se puede abrir en otra pestania con el clic del medio, copiar con boton derecho, y
 *  el navegador lo trata como lo que es: una direccion. Un boton con `onClick` que navega se ve
 *  igual y no hace nada de eso.
 */
export function Migas({ nombreDeUsuario }: { nombreDeUsuario: string }) {
  const tramos = useTramos();

  return (
    <nav aria-label="Dónde estás" className="flex items-center justify-between gap-3 bg-marca-2 px-4 py-1">
      <ol className="flex min-w-0 items-center gap-1 text-2xs text-marca-ink">
        {tramos.map((t, i) => (
          <li key={t.a} className="flex min-w-0 items-center gap-1">
            {i > 0 && <ChevronRight aria-hidden="true" size={12} className="shrink-0 opacity-70" />}
            {i === tramos.length - 1 ? (
              /*
                EL ULTIMO TRAMO NO ES UN ENLACE, y es la regla de las migas: un enlace a donde ya
                estás no lleva a ningún lado, y quien usa lector de pantalla lo escucha igual que
                los otros. `aria-current` es lo que dice "acá estás".
              */
              <span aria-current="page" className="truncate font-medium">{t.texto}</span>
            ) : (
              <Link to={t.a} params={t.params} className="truncate underline-offset-2 hover:underline">
                {t.texto}
              </Link>
            )}
          </li>
        ))}
      </ol>

      <span className="shrink-0 text-2xs text-marca-ink opacity-90">{nombreDeUsuario}</span>
    </nav>
  );
}

/** Arma el camino a partir de la ruta activa. Vive acá porque nadie más lo necesita. */
function useTramos(): { a: string; params?: Record<string, string>; texto: string }[] {
  const coincidencias = useMatches();
  const ultima = coincidencias[coincidencias.length - 1];
  const p = (ultima?.params ?? {}) as { razonSocialId?: string; tramiteId?: string };

  const tramos: { a: string; params?: Record<string, string>; texto: string }[] = [
    { a: "/", texto: "Grupo Paris" },
  ];

  /*
    EL NOMBRE DE LA EMPRESA Y EL DEL CLIENTE SALEN DEL CACHE DE LA CONSULTA, no de una consulta
    nueva. Pedir el nombre otra vez haria que las migas parpadeen "cargando" cada vez que se
    cambia de nivel, y una tira que parpadea arriba de todo se nota mas que el contenido.

    Mientras el nombre no esta, se muestra el guion: es corto, no salta, y no miente.
  */
  if (p.razonSocialId !== undefined) {
    tramos.push({
      a: "/empresa/$razonSocialId",
      params: { razonSocialId: p.razonSocialId },
      texto: nombreDeEmpresaEnCache(p.razonSocialId) ?? "—",
    });
  }

  if (p.tramiteId !== undefined) {
    tramos.push({
      a: "/empresa/$razonSocialId/tramite/$tramiteId",
      params: { razonSocialId: p.razonSocialId ?? "", tramiteId: p.tramiteId },
      texto: nombreDeClienteEnCache(p.tramiteId) ?? "—",
    });
  }

  return tramos;
}
```

**Nota para quien lo implemente:** `nombreDeEmpresaEnCache` y `nombreDeClienteEnCache` se escriben
en la tarea 5 y la 10, cuando existan las consultas de las que leen. Hasta entonces, devolvé
`undefined` y las migas muestran el guion — que es exactamente lo que hacen cuando el dato todavía
no llegó.

- [ ] **Paso 2: El Shell pierde la barra lateral**

En `src/components/Shell.tsx`, reemplazar la barra lateral por la tira superior y las migas. La
estructura queda:

```tsx
<div className="flex min-h-dvh flex-col">
  {/* La tira superior: teal oscuro, fija, y es lo primero que se ve. */}
  <header className="flex items-center gap-3 bg-marca px-4 py-2 text-marca-ink">
    <Logo className="h-5 w-auto" />
    <span className="text-sm font-medium">Gestoría</span>
  </header>

  <Migas nombreDeUsuario={perfil?.nombre ?? ""} />

  {/*
    EL FOCO SE MUEVE ACA AL CAMBIAR DE NIVEL, y es requisito de WCAG. Sin esto, quien usa lector
    de pantalla cambia de pantalla y sigue parado en el encabezado: escucha "Grupo Paris" de
    nuevo y no se entera de que abajo hay algo distinto.

    `tabIndex={-1}` lo hace enfocable por codigo sin meterlo en el orden de tabulacion.
  */}
  <main id="contenido" tabIndex={-1} className="flex-1 outline-none">
    {children}
  </main>
</div>
```

- [ ] **Paso 3: Mover el foco al cambiar de ruta**

En `src/rutas.tsx`, dentro de `createRouter`, agregar:

```tsx
  /*
    Al terminar de cambiar de ruta, el foco va al contenido. Se hace acá y no en cada pantalla
    porque una pantalla que se olvide de hacerlo no falla de forma visible: simplemente deja a
    alguien sin saber dónde está.
  */
```

Y en `src/components/Shell.tsx`, un efecto que enfoque `#contenido` cuando cambia la ruta:

```tsx
const ruta = useRouterState({ select: (s) => s.location.pathname });
useEffect(() => {
  document.getElementById("contenido")?.focus();
}, [ruta]);
```

- [ ] **Paso 4: Comprobarlo con teclado, que es como se comprueba esto**

```bash
cd "C:/Users/Vmagni/Desktop/GRUPO PARIS/GESTORIA" && export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && npx tsc -b > /tmp/a.log 2>&1; echo "TIPOS: $?"; head -10 /tmp/a.log && npm run lint > /tmp/b.log 2>&1; echo "LINT: $?"
```

Y a mano, con el servidor levantado: entrar con Tab desde la barra de direcciones y comprobar que
**se ve** dónde está el foco en cada tramo de las migas. Si el anillo no se ve, el token
`--marca` no llegó al `:focus-visible` — se arregla en la tarea 12, y queda anotado acá.

- [ ] **Paso 5: Commit**

```bash
cd "C:/Users/Vmagni/Desktop/GRUPO PARIS/GESTORIA" && git add -A && git commit -m "Las migas reemplazan a la barra lateral: profundidad en vez de menu"
```

---

# PARTE 2 — LAS TRES PANTALLAS

## Tarea 4: La vista del resumen, que es la solapa RESUMEN de su Excel

**Archivos:**
- Crear: `supabase/migrations/<generado>_resumen_de_empresas.sql`
- Crear: `src/lib/resumen.ts`
- Modificar: `src/lib/datos.ts` (la invalidación en vivo)
- Modificar: `src/permisos-plata.rls.test.ts`

**Interfaces:**
- Produce: la vista `public.v_resumen_empresas` con las columnas
  `razon_social_id, nombre, tarjeta_id, contable, en_transito, comprometido, diferencia, esperan,
  movimientos_visibles, orden`; y los hooks `useResumen()` y `useEmpresa(razonSocialId)` que
  devuelven `FilaDeResumen`.
- Consume: `public.v_saldos` y `public.v_esperando_plata`, de la tanda anterior.

**Por qué una vista y no una cuenta en el front:** porque el mismo número lo miran dos apps. Si
cada una hiciera su cuenta, el día que una cambie el criterio mostrarían números distintos del
mismo hecho — y entonces nadie le cree a ninguna.

**Comprobado antes de escribir esto:** hay **una razón social por tarjeta**, uno a uno. Las cinco
son PARIS AUTOS, PARIS CARS, PARIS TRAC, PARIS MOTOR y DORAL CHEVROLET, y cada una apunta a su
`tarjeta_id`. Por eso la vista puede unirlas sin duplicar filas.

- [ ] **Paso 1: Crear la migración**

```bash
cd "C:/Users/Vmagni/Desktop/GRUPO PARIS/GESTORIA" && export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && npx supabase migration new resumen_de_empresas 2>&1 | grep -o "[0-9]*_resumen.*sql" | tail -1
```

**Anotá el nombre que imprime.** No sigas sin verlo: una migración vacía se aplica sin error y
queda registrada como aplicada. Ya pasó dos veces.

- [ ] **Paso 2: Escribirla**

Escribir con la herramienta de escritura de archivos, **no con un heredoc**: los acentos y las
comillas se rompen al pasar por el shell. Pasó al escribir este mismo plan.

```sql
-- ============================================================================
--  UNA FILA POR EMPRESA, QUE ES LA SOLAPA RESUMEN DE SU EXCEL
-- ============================================================================
--
--  Es la puerta de entrada de la app de la oficina, y es la pantalla que ella ya conoce: la
--  solapa RESUMEN de su planilla, calculada sola.
--
--  ============================================================================
--   POR QUE UNA VISTA Y NO UNA CUENTA EN EL FRONT
--  ============================================================================
--
--  Porque estos numeros los miran DOS apps. Si cada una hiciera su cuenta, el dia que una cambie
--  el criterio las dos mostrarian numeros distintos del mismo hecho, y entonces nadie le cree a
--  ninguna. Ya paso con "esperando plata" cuando era un estado que alguien marcaba a mano.
--
--  ============================================================================
--   `esperan` SALE DE LA VISTA, NO DE UN `count` PROPIO
--  ============================================================================
--
--  Contar aca los tramites presupuestados cuya tarjeta no cubre seria escribir por segunda vez la
--  regla que ya vive en `v_esperando_plata`. Dos copias de una regla se separan: la primera vez
--  que alguien cambie el criterio va a cambiar una sola, y el resumen va a decir 3 mientras la
--  pantalla de la empresa muestra 2.
--
--  ============================================================================
--   `movimientos_visibles` VIAJA HASTA ACA, Y NO ES DE MAS
--  ============================================================================
--
--  Una tarjeta cuyos movimientos no se pueden leer sale con los mismos ceros que una vacia. El
--  27/08/2026 toda gestora veia las cinco tarjetas en $ 0,00 mientras Paris Autos tenia ocho
--  millones y medio: un cero es un numero y se lee como un hecho.
--
--  El resumen tiene que poder escribir "sin datos" en esa fila, y para eso necesita el dato.
--
--  ES ADITIVA: una vista nueva. No toca ninguna fila ni ninguna policy.
-- ============================================================================

create or replace view public.v_resumen_empresas with (security_invoker = true) as
select r.id                          as razon_social_id,
       r.nombre,
       r.tarjeta_id,
       coalesce(s.contable, 0)       as contable,
       coalesce(s.en_transito, 0)    as en_transito,
       coalesce(s.comprometido, 0)   as comprometido,
       coalesce(s.contable, 0) - coalesce(s.comprometido, 0) as diferencia,
       coalesce(e.esperan, 0)        as esperan,
       coalesce(s.movimientos_visibles, 0) as movimientos_visibles,
       r.orden
  from public.razones_sociales r
  left join public.v_saldos s on s.tarjeta_id = r.tarjeta_id
  left join (
    select tarjeta_id, count(*) as esperan
      from public.v_esperando_plata
     group by tarjeta_id
  ) e on e.tarjeta_id = r.tarjeta_id
 where r.activa;

comment on view public.v_resumen_empresas is
  'Una fila por razon social activa, con las cuatro cifras de su tarjeta y cuantos tramites estan '
  'esperando plata. Es la solapa RESUMEN del Excel, calculada. `movimientos_visibles` en 0 '
  'significa QUE NO SE VEN LOS MOVIMIENTOS, no que la empresa este en cero: la pantalla tiene que '
  'decir "sin datos" y no un importe.';

revoke insert, update, delete, truncate on public.v_resumen_empresas from anon, authenticated;
grant select on public.v_resumen_empresas to authenticated;

-- ============================================================================
--  COMO COMPROBAR QUE QUEDO BIEN
--
--  1) Cinco filas, una por empresa activa:
--       select nombre, contable, comprometido, diferencia, esperan
--         from public.v_resumen_empresas order by orden;
--     Esperado hoy: Paris Autos con 9.435.000,00 y 520.000,00; el resto en cero.
--
--  2) LA SUMA CIERRA CONTRA v_saldos, que es de donde sale:
--       select (select sum(contable) from public.v_resumen_empresas) as resumen,
--              (select sum(contable) from public.v_saldos) as saldos;
--     Esperado: IGUALES. Si difieren, hay dos razones sociales apuntando a la misma tarjeta y el
--     `left join` esta duplicando su plata.
--
--  3) Es de solo lectura y lleva security_invoker:
--       select has_table_privilege('authenticated','public.v_resumen_empresas','UPDATE') as u,
--              has_table_privilege('authenticated','public.v_resumen_empresas','SELECT') as s;
--       select reloptions from pg_class where relname = 'v_resumen_empresas';
--     Esperado: u en false, s en true, y `security_invoker=true` en las opciones.
--
--  4) CON SESION DE GESTORA, las empresas donde no trabaja dan `movimientos_visibles = 0`.
--     Lo cubre `npm run test:rls`.
-- ============================================================================
```

- [ ] **Paso 3: Aplicar y correr las cuatro comprobaciones**

```bash
cd "C:/Users/Vmagni/Desktop/GRUPO PARIS/GESTORIA" && export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && export SUPABASE_ACCESS_TOKEN="$(grep '^SUPABASE_ACCESS_TOKEN=' .env.local | cut -d= -f2-)" && npm run migraciones > /tmp/m.log 2>&1; echo "MIGRACIONES: $?"; npm run db:push > /tmp/p.log 2>&1; echo "PUSH: $?"; tail -6 /tmp/p.log
```

Esperado: los dos en 0. **La comprobación 2 es la que importa:** si las sumas no coinciden, la
vista está contando plata dos veces y todo el resumen miente.

- [ ] **Paso 4: Regenerar los tipos**

```bash
cd "C:/Users/Vmagni/Desktop/GRUPO PARIS/GESTORIA" && export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && export SUPABASE_ACCESS_TOKEN="$(grep '^SUPABASE_ACCESS_TOKEN=' .env.local | cut -d= -f2-)" && npm run db:tipos > /tmp/t.log 2>&1; echo "TIPOS: $?"; grep -c "v_resumen_empresas" src/lib/database.types.ts
```

Esperado: EXIT 0 y un número mayor que cero.

- [ ] **Paso 5: Los hooks**

Crear `src/lib/resumen.ts`:

```ts
import { useQuery } from "@tanstack/react-query";
import { supabase } from "./supabase";
import { aNumero } from "./datos";

/** Una empresa en el resumen. `movimientos_visibles` en 0 significa "no se ven", no "esta en cero". */
export interface FilaDeResumen {
  razon_social_id: string;
  nombre: string;
  tarjeta_id: string | null;
  contable: number;
  en_transito: number;
  comprometido: number;
  diferencia: number;
  esperan: number;
  movimientos_visibles: number;
}

const COLUMNAS =
  "razon_social_id, nombre, tarjeta_id, contable, en_transito, comprometido, diferencia, esperan, movimientos_visibles";

/** El mapeo vive en un solo lado: dos copias se separan la primera vez que se agrega una columna. */
function aFila(f: Record<string, unknown>): FilaDeResumen {
  return {
    razon_social_id: String(f["razon_social_id"]),
    nombre: String(f["nombre"]),
    tarjeta_id: f["tarjeta_id"] === null ? null : String(f["tarjeta_id"]),
    contable: aNumero(f["contable"]),
    en_transito: aNumero(f["en_transito"]),
    comprometido: aNumero(f["comprometido"]),
    diferencia: aNumero(f["diferencia"]),
    esperan: aNumero(f["esperan"]),
    movimientos_visibles: aNumero(f["movimientos_visibles"]),
  };
}

/**
 * ============================================================================
 *  EL RESUMEN DE LAS CINCO EMPRESAS
 * ============================================================================
 *
 * Se invalida con el mismo golpe en vivo que los saldos. Sin eso entraria un deposito, el saldo de
 * la empresa cambiaria al abrirla, y el resumen seguiria mostrando el numero viejo — que es la
 * peor forma de equivocarse que tiene esta app: dos pantallas del mismo sistema diciendo cosas
 * distintas de la misma plata.
 */
export function useResumen() {
  return useQuery({
    queryKey: ["resumen"],
    queryFn: async (): Promise<FilaDeResumen[]> => {
      const { data, error } = await supabase
        .from("v_resumen_empresas").select(COLUMNAS).order("orden");
      if (error) throw error;
      return (data ?? []).map(aFila);
    },
  });
}

/**
 * Una empresa sola, para el encabezado del nivel 2 y para el nombre de las migas.
 *
 * LEE DEL MISMO CACHE que `useResumen` cuando ya esta: si el resumen se cargo recien, TanStack
 * devuelve la fila sin ir a la base. Por eso las migas pueden mostrar el nombre sin parpadear.
 */
export function useEmpresa(razonSocialId: string) {
  return useQuery({
    queryKey: ["resumen", razonSocialId],
    queryFn: async (): Promise<FilaDeResumen | null> => {
      const { data, error } = await supabase
        .from("v_resumen_empresas").select(COLUMNAS)
        .eq("razon_social_id", razonSocialId).maybeSingle();
      if (error) throw error;
      return data === null ? null : aFila(data);
    },
  });
}
```

**Y en `src/lib/datos.ts`**, dentro de `useSaldosEnVivo`, agregar la invalidación del resumen a las
**dos** suscripciones que ya están —la de `movimientos` y la de `tramites`—, al lado de las que ya
invalidan `saldos` y `esperando_plata`:

```ts
        void cliente.invalidateQueries({ queryKey: ["resumen"] });
```

- [ ] **Paso 6: La prueba del arnés**

Al final de `src/permisos-plata.rls.test.ts`:

```ts
describe("el resumen de empresas", () => {
  const COLUMNAS =
    "razon_social_id, nombre, contable, comprometido, diferencia, esperan, movimientos_visibles";

  it("la oficina ve las cinco empresas con numeros de verdad", async () => {
    const { data, error } = await gerencia.from("v_resumen_empresas").select(COLUMNAS);
    expect(error).toBeNull();
    expect(data?.length ?? 0).toBeGreaterThanOrEqual(5);
    const conDatos = (data ?? []).filter((e) => Number(e.movimientos_visibles) > 0);
    expect(conDatos.length, "la oficina no ve ninguna empresa con movimientos").toBeGreaterThan(0);
  });

  it("y la suma cierra contra v_saldos", async () => {
    /*
      SI ESTO FALLA, EL `left join` ESTA DUPLICANDO FILAS: dos razones sociales apuntando a la
      misma tarjeta harian que su plata se cuente dos veces en el total del grupo. Es el defecto
      que un resumen no puede tener, porque el total es lo primero que se mira.
    */
    const { data: resumen } = await gerencia.from("v_resumen_empresas").select("contable");
    const { data: saldos } = await gerencia.from("v_saldos").select("contable");
    const sumar = (f: { contable: unknown }[] | null) =>
      (f ?? []).reduce((t, x) => t + Number(x.contable), 0);
    expect(sumar(resumen)).toBe(sumar(saldos));
  });

  it("sin sesion devuelve CERO FILAS, no un error", async () => {
    const { data, error } = await anonimo.from("v_resumen_empresas").select(COLUMNAS);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("y no se puede escribir: es una vista", async () => {
    const { error } = await gerencia.from("v_resumen_empresas")
      .delete().eq("razon_social_id", "00000000-0000-0000-0000-000000000000");
    expect(error).not.toBeNull();
  });
});
```

- [ ] **Paso 7: Correr, y verla en rojo antes de darla por buena**

```bash
cd "C:/Users/Vmagni/Desktop/GRUPO PARIS/GESTORIA" && export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && npm run test:rls > /tmp/rls.log 2>&1; echo "RLS: $?"; grep -E "Tests " /tmp/rls.log | tail -1
```

Esperado: verde, con cuatro pruebas más que antes.

**Después dale vuelta el aserto de la suma** —`toBe` por `not.toBe`— corré de nuevo, comprobá que
falla, y restauralo. Una prueba que nunca se vio fallar no es una prueba.

- [ ] **Paso 8: Commit**

```bash
cd "C:/Users/Vmagni/Desktop/GRUPO PARIS/GESTORIA" && git add -A && git commit -m "La vista del resumen: una fila por empresa, con lo que espera plata contado en la base"
```

---

## Tarea 5: Tres variantes del resumen, y se elige mirándolas

**Archivos:**
- Crear: `src/features/sistema/VariantesDelResumen.tsx`
- Modificar: `src/features/sistema/SistemaVisual.tsx`
- Modificar: `docs/ESTADO.md`

**Interfaces:**
- Consume: `FilaDeResumen` de `src/lib/resumen.ts`.
- Produce: **nada que sobreviva.** Este archivo se borra en la tarea 13, junto con las dos
  variantes que no se elijan.

**Por qué existe esta tarea:** el spec la pide con nombre y apellido — *"antes de fijar la pantalla
del resumen se dibujan tres versiones distintas y se elige una mirándolas al lado"*.

**Y por qué importa acá más que en otro lado:** es la primera pantalla que abre la dueña. Las tres
muestras anteriores se rechazaron; ésta decide si hay una cuarta.

- [ ] **Paso 1: Escribir las tres, con los datos reales de hoy**

Crear `src/features/sistema/VariantesDelResumen.tsx`. Las tres reciben las **mismas** filas y se
dibujan una debajo de la otra, cada una con su nombre.

Lo que este plan fija es qué apuesta cada una y qué riesgo corre, que es lo que hay que comparar:

```
A — TABLA. Cinco filas, cuatro columnas, como la solapa del Excel.
    Apuesta: el reconocimiento. Es lo que ella ya sabe leer.
    Riesgo: con cuatro empresas en cero se ve vacia, y lo unico que importa —la Diferencia de
    Paris Autos— pesa lo mismo que cuatro ceros.

B — UNA CIFRA GRANDE Y LA TABLA DEBAJO. El total del grupo arriba en `text-4xl`, las cinco filas
    abajo en `text-sm`.
    Apuesta: la jerarquia. El numero que decide algo es el mas grande de la pantalla, que es la
    primera de las nueve decisiones del spec.
    Riesgo: con el total del grupo no se decide nada. Se decide por empresa.

C — TARJETAS POR EMPRESA, la que espera plata adelante. Una tarjeta por empresa, ordenadas por
    cuantos tramites esperan, y las que estan en cero plegadas abajo en una sola linea.
    Apuesta: la accion. Lo primero que se ve es donde hay algo que hacer.
    Riesgo: deja de parecerse al Excel, que es de donde viene la confianza.
```

**El JSX de las tres lo escribe quien ejecute la tarea**, con `FilaDeResumen` y los tokens de la
tarea 1. Escribir acá el código de tres pantallas de las que dos se van a tirar sería trabajo que
se tira; lo que no se puede improvisar —qué compara cada una— está arriba.

- [ ] **Paso 2: Colgarlas de la pantalla de sistema visual**

`src/features/sistema/SistemaVisual.tsx` ya existe y es donde viven las piezas para mirar. Agregar
las tres al final, bajo un título que diga que son para elegir y que dos se van a borrar.

- [ ] **Paso 3: MIRARLAS. Este paso no lo reemplaza ningún test**

```bash
cd "C:/Users/Vmagni/Desktop/GRUPO PARIS/GESTORIA" && export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && npm run dev
```

Mirar las tres **con los datos reales de hoy**: Paris Autos con 8.915.000 de diferencia y una
esperando, y cuatro empresas en cero.

Tres preguntas, en este orden:

1. **¿Cuál contesta más rápido "de dónde falta plata"?** Es la pregunta con la que se entra.
2. **¿Cuál se parece más a la solapa que ella ya usa?** El reconocimiento vale, y es la razón por
   la que las tres muestras anteriores fallaron: la app estaba organizada por verbos y su Excel
   por empresas.
3. **¿Cuál aguanta el día que las cinco tengan movimiento?** Hoy cuatro están en cero, y eso no va
   a durar.

- [ ] **Paso 4: Escribir cuál se eligió y por qué, en el `ESTADO.md`**

No en un comentario del archivo que se va a borrar: en `docs/ESTADO.md`, que es donde se lee dentro
de seis meses. Una decisión de diseño sin su porqué se revierte sola la primera vez que alguien la
mira con otro humor.

- [ ] **Paso 5: Commit**

```bash
cd "C:/Users/Vmagni/Desktop/GRUPO PARIS/GESTORIA" && git add -A && git commit -m "Tres resumenes al lado, y el que se eligio con su porque escrito"
```

---

## Tarea 6: Nivel 1 — el resumen

**Archivos:**
- Crear: `src/features/resumen/Resumen.tsx`
- Modificar: `src/components/Migas.tsx` (`nombreDeEmpresaEnCache`)

**Interfaces:**
- Consume: `useResumen()` y `FilaDeResumen` de `src/lib/resumen.ts`; la ruta `/empresa/$razonSocialId`.
- Produce: el componente `Resumen`, que ya está referenciado por `src/rutas.tsx`.

**Depende de una decisión que se toma en la tarea 5.** Este plan fija la estructura, los datos y
las reglas; **el reparto visual es la variante que se haya elegido mirándolas.** Por eso acá no hay
un JSX cerrado: escribirlo sería decidir de antemano lo que la tarea 5 existe para decidir.

**Lo que NO depende de la variante y va sí o sí:**

- [ ] **Paso 1: Cada fila es un enlace, no un `div` con `onClick`**

```tsx
<Link
  to="/empresa/$razonSocialId"
  params={{ razonSocialId: e.razon_social_id }}
  className="..."
>
```

Un `div` con `onClick` se ve igual y no se puede abrir en otra pestaña, ni copiar, ni alcanzar con
teclado. La oficina trabaja con dos empresas a la vez más seguido de lo que parece.

- [ ] **Paso 2: La empresa sin datos dice "sin datos", no un cero**

```tsx
{e.movimientos_visibles === 0 ? (
  <span className="text-2xs text-ink2">Sin datos</span>
) : (
  <span className="tnum">{formatearCorto(e.diferencia)}</span>
)}
```

El 27/08/2026 toda gestora veía las cinco tarjetas en `$ 0,00` mientras Paris Autos tenía ocho
millones y medio. **Un cero es un número y se lee como un hecho.**

- [ ] **Paso 3: Los centavos en cero no se muestran, y sólo acá**

Agregar a `src/lib/plata.ts`:

```ts
/**
 * ============================================================================
 *  LA CIFRA GRANDE, SIN CENTAVOS CUANDO SON CERO
 * ============================================================================
 *
 * `9.435.000` se lee de un golpe; `9.435.000,00` obliga a contar. En una pantalla donde el numero
 * grande es lo primero que se mira, esos dos ceros son ruido.
 *
 * SOLO PARA LAS CIFRAS GRANDES DEL RESUMEN Y DEL ENCABEZADO DE LA EMPRESA. En el extracto y en el
 * presupuesto los centavos van SIEMPRE, porque ahi la exactitud es el punto: un importe que se
 * compara contra el sitio de Habitualista no se puede redondear ni de a dos decimales.
 */
export function formatearCorto(centavos: number): string {
  return centavos % 100 === 0
    ? formatear(centavos).replace(/,00$/, "")
    : formatear(centavos);
}
```

Con su prueba, en `src/lib/plata.test.ts`:

```ts
it("la cifra grande esconde los centavos solo cuando son cero", () => {
  expect(formatearCorto(943500000)).toBe(formatear(943500000).replace(/,00$/, ""));
  expect(formatearCorto(943500042)).toBe(formatear(943500042));  // con centavos, van
});
```

- [ ] **Paso 4: La columna ESPERAN, y el guion cuando es cero**

`3` cuando hay tres esperando; **`—` cuando no hay ninguno**, no `0`. Un cero en una columna de
cuentas invita a leerlo como plata. El guion dice "nada" sin parecer un importe.

Y **no lleva el color de la marca**: si hay alguien esperando va en `text-warn`; si no, en
`text-ink2`. El teal está en el marco.

- [ ] **Paso 5: `nombreDeEmpresaEnCache`, para que las migas no parpadeen**

En `src/components/Migas.tsx`, reemplazar el `undefined` provisorio:

```tsx
import { useQueryClient } from "@tanstack/react-query";
import type { FilaDeResumen } from "../lib/resumen";

/**
 * El nombre sale del cache de `useResumen`, no de una consulta nueva.
 *
 * Pedirlo otra vez haria que las migas parpadeen "cargando" cada vez que se cambia de nivel, y
 * una tira que parpadea arriba de todo se nota mas que el contenido. Si el cache esta vacio
 * —alguien abrio la URL de una empresa directamente— devuelve `undefined` y las migas muestran el
 * guion hasta que el nivel 2 traiga el dato.
 */
function nombreDeEmpresaEnCache(id: string): string | undefined {
  const cliente = useQueryClient();
  const filas = cliente.getQueryData<FilaDeResumen[]>(["resumen"]);
  return filas?.find((f) => f.razon_social_id === id)?.nombre;
}
```

- [ ] **Paso 6: El esqueleto tiene la forma de lo que viene**

Cinco filas con cuatro columnas, no rayas genéricas. Un esqueleto que no se parece al contenido
produce un salto al cargar, y ese salto es exactamente lo que se ve barato.

- [ ] **Paso 7: Los cuatro comandos**

```bash
cd "C:/Users/Vmagni/Desktop/GRUPO PARIS/GESTORIA" && export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && npx tsc -b > /tmp/a.log 2>&1; echo "TIPOS: $?"; head -12 /tmp/a.log; npm run lint > /tmp/b.log 2>&1; echo "LINT: $?"; npm test > /tmp/c.log 2>&1; echo "TESTS: $?"; grep -E "Tests " /tmp/c.log | tail -1; npm run colores > /dev/null 2>&1; echo "COLORES: $?"
```

Esperado: los cuatro en 0.

- [ ] **Paso 8: Mirarlo, con las cuentas de verdad**

Entrar como gerencia y comprobar: cinco filas, Paris Autos con 8.915.000 en la Diferencia, una en
ESPERAN, y las cuatro empresas sin movimientos diciendo "Sin datos". **Entrar después como
gestora** y comprobar que las empresas donde no trabaja también dicen "Sin datos" y no cero.

- [ ] **Paso 9: Commit**

```bash
cd "C:/Users/Vmagni/Desktop/GRUPO PARIS/GESTORIA" && git add -A && git commit -m "Nivel 1: el resumen de las cinco empresas, y cada fila lleva a la suya"
```

---

## Tarea 7: Nivel 2 — el encabezado de la empresa

**Archivos:**
- Crear: `src/features/empresa/Empresa.tsx`, `src/features/empresa/CifrasDeLaEmpresa.tsx`

**Interfaces:**
- Consume: `useEmpresa(razonSocialId)` de `src/lib/resumen.ts`.
- Produce: el componente `Empresa`, referenciado por `src/rutas.tsx`; y `CifrasDeLaEmpresa`, que
  la tarea 8 dibuja arriba de las secciones.

**Las cuatro cifras ya se aprobaron** en la revisión del 24/08/2026 y no se rediscuten: Saldo día
de hoy, Depósito pendiente de acreditación, Saldo reservado, y la **Diferencia**, que es con la que
se decide si se manda a presentar.

Lo que cambia es dónde viven: dejan de ser una pantalla y pasan a ser el encabezado de la empresa.

- [ ] **Paso 1: Escribir `CifrasDeLaEmpresa`**

```tsx
/**
 * ============================================================================
 *  LAS CUATRO CIFRAS, Y LA CUARTA ES LA QUE DECIDE
 * ============================================================================
 *
 *  Saldo de hoy, deposito pendiente, reservado, y la DIFERENCIA. Las cuatro se pidieron por
 *  numero en la revision del 24/08/2026 y no se rediscuten.
 *
 *  ============================================================================
 *   LA DIFERENCIA ES EL NUMERO MAS GRANDE DE LA PANTALLA
 *  ============================================================================
 *
 *  Es la primera de las nueve decisiones del spec: el numero que decide algo va en `text-4xl` y
 *  su rotulo en `text-2xs`. Una app se ve barata cuando todos los textos miden parecido.
 *
 *  Las otras tres van en `text-xl`. Son contexto, no decision.
 *
 *  ============================================================================
 *   Y NINGUNA ES TEAL
 *  ============================================================================
 *
 *  El marco es teal; los numeros no. La Diferencia en rojo cuando es negativa es la unica senial
 *  que importa, y compite con cualquier otro color que se le ponga cerca.
 */
```

Las cuatro con `formatearCorto` —los centavos en cero no se muestran— y `.tnum`, para que no
bailen. La Diferencia en `text-danger` cuando es negativa.

Y el caso "sin datos": si `movimientos_visibles === 0`, en vez de las cuatro cifras va el panel que
ya existe en `Tarjeta.tsx` —*"No podés ver los movimientos de esta tarjeta"*— y se reusa, no se
copia.

- [ ] **Paso 2: `Empresa.tsx` arma la pantalla**

Lee `razonSocialId` de la ruta, pide `useEmpresa`, y dibuja el encabezado. Las secciones vienen en
la tarea 8; por ahora, debajo del encabezado va un `SkeletonLineas`.

**Si la empresa no existe** —una URL vieja, un id inventado— muestra el mismo mensaje que la ruta
inexistente: *"Esa dirección no existe"*, con el enlace al resumen. No una pantalla en blanco.

- [ ] **Paso 3: Comprobarlo, incluido el caso que se olvida**

```bash
cd "C:/Users/Vmagni/Desktop/GRUPO PARIS/GESTORIA" && export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && npx tsc -b > /tmp/a.log 2>&1; echo "TIPOS: $?"; head -10 /tmp/a.log
```

Y a mano: abrir `/empresa/00000000-0000-0000-0000-000000000000`. Tiene que decir que no existe, no
quedarse en blanco.

- [ ] **Paso 4: Commit**

```bash
cd "C:/Users/Vmagni/Desktop/GRUPO PARIS/GESTORIA" && git add -A && git commit -m "Nivel 2: las cuatro cifras pasan a ser el encabezado de la empresa"
```

---

## Tarea 8: Nivel 2 — las secciones plegables

**Archivos:**
- Crear: `src/features/empresa/SeccionPlegable.tsx`, `src/features/empresa/FilaDeTramite.tsx`
- Modificar: `src/features/empresa/Empresa.tsx`

**Interfaces:**
- Consume: `useTramites` de `src/lib/datos.ts`, `useEsperandoPlata` de `src/lib/datos.ts`.
- Produce: `SeccionPlegable` y `FilaDeTramite`.

**Las cuatro secciones, con su estado de arranque:**

| Sección | Qué trae | Arranca |
|---|---|---|
| ESPERAN PLATA | Presupuestados cuya tarjeta no cubre | **Abierta** |
| EN CURSO | Recibido, controlado, entregado, presupuestado que sí cubre, resuelto | **Abierta** |
| TERMINADOS | Devuelto | Plegada |
| ANULADOS | Anulado | Plegada |

**El criterio, y es uno solo:** abierto lo que necesita algo, plegado lo que ya pasó. Los
terminados y los anulados no acumulan ruido.

- [ ] **Paso 1: `SeccionPlegable`, con el total al lado del título**

```tsx
/**
 * ============================================================================
 *  UNA SECCION, SU CUENTA Y SU TOTAL
 * ============================================================================
 *
 *  El titulo lleva CUANTOS son y CUANTA PLATA suman, y eso se ve con la seccion plegada. Es lo
 *  que hace que plegar no esconda: "ESPERAN PLATA (2) — 648.000" dice todo lo que hace falta para
 *  decidir si abrirla.
 *
 *  Una seccion plegada que solo dice su nombre obliga a abrirla para saber si importa, y entonces
 *  quedan todas abiertas y no sirvio de nada.
 *
 *  ============================================================================
 *   ES UN `button` CON `aria-expanded`, NO UN `div` QUE ESCUCHA CLICS
 *  ============================================================================
 *
 *  Sin eso quien usa lector de pantalla escucha el titulo y no se entera de que se puede abrir, ni
 *  de si esta abierto. Y no se llega con teclado.
 */
```

El estado abierto/plegado se recuerda por empresa con `recordar.ts`, que ya existe: quien pliega
los anulados no quiere volver a plegarlos mañana.

- [ ] **Paso 2: `FilaDeTramite`, con las columnas de su Excel**

Fecha, cliente, dominio, gestora, plata. **En ese orden**, que es el de su planilla.

```tsx
/*
  LA GESTORA APARECE COMO DATO DE LA FILA, NO COMO AGRUPACION NI COMO CUENTA.

  Es la diferencia entre "de quien es este tramite" —que hace falta para saber a quien llamar— y
  "cuantos lleva cada una", que es una tabla de posiciones. El dia que exista esa tabla, los
  presupuestos se cargan tarde y redondeados, y el comprometido —que es la razon de ser del
  sistema— pasa a ser mentira.

  Por eso: nunca ordenar por gestora, nunca contar por gestora, nunca un total por gestora.
*/
```

Filas de **36 a 40 px**, no de 56. Es lo que hace que entren quince trámites en una pantalla sin
scrollear, y lo que la hace parecerse a una herramienta de trabajo y no a una landing.

- [ ] **Paso 3: Armar las cuatro secciones en `Empresa.tsx`**

Un trámite cae en ESPERAN PLATA si su id está en `useEsperandoPlata()`; si no, y no está terminado
ni anulado, cae en EN CURSO. **El criterio de "espera plata" no se recalcula acá**: sale de la
vista, que es la misma que mira la gestora.

- [ ] **Paso 4: El estado vacío de cada sección dice qué hacer**

No "Todavía no hay trámites". En EN CURSO: *"Cargá el primero con + Trámite"*, con el botón al
lado. En ESPERAN PLATA, vacía es una **buena** noticia: *"Ninguno esperando plata"*, sin botón.

- [ ] **Paso 5: Los comandos**

```bash
cd "C:/Users/Vmagni/Desktop/GRUPO PARIS/GESTORIA" && export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && npx tsc -b > /tmp/a.log 2>&1; echo "TIPOS: $?"; npm run lint > /tmp/b.log 2>&1; echo "LINT: $?"; npm run colores > /dev/null 2>&1; echo "COLORES: $?"; npm run espacios 2>&1 | grep -o "Hay [0-9]* espacios"
```

`espacios` sigue en rojo hasta la tarea 12; lo que importa acá es que **no suba** el número.

- [ ] **Paso 6: Commit**

```bash
cd "C:/Users/Vmagni/Desktop/GRUPO PARIS/GESTORIA" && git add -A && git commit -m "Las cuatro secciones de la empresa, con su cuenta y su total en el titulo"
```

---

## Tarea 9: Los movimientos plegados, y el Excel de lo que se está mirando

**Archivos:**
- Crear: `src/features/empresa/MovimientosPlegados.tsx`
- Modificar: `src/lib/excel.ts`, `src/features/empresa/Empresa.tsx`

**Interfaces:**
- Consume: `useMovimientos` de `src/lib/datos.ts`; `Operaciones` de
  `src/features/tarjeta/Operaciones.tsx`, que se reusa entero.
- Produce: `MovimientosPlegados`.

**El pedido, textual:** *"que la solapa de operaciones sea plegable para que no se acumulen tantas
operaciones viejas, que aparezcan principalmente los movimientos del día"*.

- [ ] **Paso 1: La quinta sección, plegada y abierta en "hoy"**

Arranca **plegada**. Al abrirla muestra los movimientos de hoy, con un "Ver todo" que trae los 200
que ya devuelve `useMovimientos`. El componente `Operaciones` se reusa: ya sabe dibujar el extracto,
tachar los anulados y ofrecer el botón de anular a quien corresponde.

- [ ] **Paso 2: El día se cuenta con la hora de Argentina**

```tsx
import { hoyArgentina, aFechaArgentina } from "../../lib/fechas";

const deHoy = movimientos.filter((m) => aFechaArgentina(m.fecha) === hoyArgentina());
```

**No `new Date()` a secas.** La base ya usa `hoy_argentina()` desde la tanda anterior; si el front
usara la hora del navegador, entre las 21 y las 24 las dos dirían días distintos.

- [ ] **Paso 3: Bajar a Excel lo que se está mirando**

En `src/lib/excel.ts`, la función que arma el archivo pasa a recibir **las filas visibles**, no
todas:

```ts
/**
 * ============================================================================
 *  BAJA LO QUE SE ESTA MIRANDO, NO EL GRUPO ENTERO
 * ============================================================================
 *
 * Los tramites de ESTA empresa, con las secciones que estan abiertas. Quien quiera todo lo baja
 * empresa por empresa — que es exactamente como esta su planilla hoy, una solapa por empresa.
 *
 * Bajar el grupo entero desde una pantalla que muestra una empresa produce un archivo que no se
 * parece a lo que estaba en la pantalla, y entonces hay que revisarlo a mano para confiar en el.
 */
```

El botón vive al lado de `+ Trámite`, en el encabezado de la empresa.

- [ ] **Paso 4: Comprobarlo bajando el archivo de verdad**

Abrir Paris Autos, plegar ANULADOS, bajar el Excel y **abrirlo**: no tiene que traer los anulados.
Después abrir la sección y bajarlo de nuevo: ahora sí.

- [ ] **Paso 5: Commit**

```bash
cd "C:/Users/Vmagni/Desktop/GRUPO PARIS/GESTORIA" && git add -A && git commit -m "El extracto plegado y abierto en hoy, y el Excel de lo que se esta mirando"
```

---

## Tarea 10: `+ Trámite` y `+ Dinero`, adentro de la empresa

**Archivos:**
- Modificar: `src/features/tramites/AltaTramite.tsx`, `src/features/admin/Admin.tsx`,
  `src/features/empresa/CifrasDeLaEmpresa.tsx`

**Interfaces:**
- Consume: `AltaTramite`, que ya existe; el formulario de cargar dinero, que hoy vive en
  Administración.
- Produce: los dos botones en el encabezado de la empresa.

**Por qué se mudan:** un trámite siempre pertenece a una razón social, y un depósito siempre es a
una tarjeta, y la tarjeta es de una empresa. Cargarlos desde una pantalla que ya sabe de qué
empresa se trata **quita un campo de cada formulario** — y el campo que no existe no se puede
llenar mal.

- [ ] **Paso 1: `AltaTramite` recibe la razón social y deja de preguntarla**

El selector de razón social desaparece del formulario y llega como prop. **El campo sigue
existiendo en la base y sigue siendo obligatorio**: lo que cambia es que la pantalla ya lo sabe.

- [ ] **Paso 2: Cargar dinero se muda de Administración a la empresa**

El formulario se mueve entero. En Administración queda la lista de razones sociales y tarjetas —
que es configuración— pero no el alta de movimientos, que es trabajo diario.

- [ ] **Paso 3: Gestoría no ve ninguno de los dos**

Ya está resuelto en la base —`movimientos_insert` exige `es_oficina()`— pero el botón no se muestra
igual. **Un botón que va a fallar es peor que no tenerlo:** enseña a desconfiar de la pantalla.

```tsx
{esOficina && (
  <>
    <button ...>+ Trámite</button>
    <button ...>+ Dinero</button>
  </>
)}
```

- [ ] **Paso 4: Comprobarlo con las tres cuentas**

Gerencia y contable ven los dos botones. **Gestoría no ve ninguno.** Y el circuito entero:
cargar un trámite desde Paris Autos, verlo aparecer en EN CURSO de Paris Autos y **no** en otra
empresa.

- [ ] **Paso 5: Commit**

```bash
cd "C:/Users/Vmagni/Desktop/GRUPO PARIS/GESTORIA" && git add -A && git commit -m "Cargar tramite y cargar dinero se mudan adentro de la empresa"
```

---

## Tarea 11: Nivel 3 — la ficha, podada; y Administración detrás del nombre

**Archivos:**
- Modificar: `src/features/tramites/Ficha.tsx`, `src/components/Shell.tsx`,
  `src/features/admin/Admin.tsx`

**Interfaces:**
- Consume: la ruta `/empresa/$razonSocialId/tramite/$tramiteId`, de la tarea 2.
- Produce: la ficha sin el panel de vencimientos y con `view-transition-name`.

- [ ] **Paso 1: Sacar el panel de vencimientos**

Los plazos y su cálculo **ya no existen** — se pidió quitarlos en la revisión del 24/08/2026 y la
sección se sacó de la ficha. Lo que queda es comprobar que no volvió por otro lado:

```bash
cd "C:/Users/Vmagni/Desktop/GRUPO PARIS/GESTORIA" && grep -rn "vencimiento\|plazos" src/ --include=*.tsx --include=*.ts | grep -v "\.test\." | head
```

Si aparece algo en pantalla, se saca. `src/lib/plazos.ts` queda si Administración lo usa para el
calendario de feriados; si no lo usa nadie, lo va a decir `npm run deadcode` en la tarea 13.

- [ ] **Paso 2: El `view-transition-name` de la ficha**

```tsx
<article style={{ viewTransitionName: `tramite-${id}` }}>
```

Es lo que hace que al abrir un trámite desde la lista **se vea el viaje** de la fila a la ficha, en
vez de un salto. Cuesta cero bytes: lo anima el navegador.

Y respeta `prefers-reduced-motion`, en `index.css`:

```css
@media (prefers-reduced-motion: reduce) {
  ::view-transition-group(*),
  ::view-transition-old(*),
  ::view-transition-new(*) { animation: none !important; }
}
```

- [ ] **Paso 3: Administración se entra desde el nombre de usuario**

En el `Shell`, el nombre de la derecha pasa a ser un menú con dos entradas: **Administración** y
**Salir**. Sólo lo ve la oficina; a la gestora le queda sólo Salir.

Es un `button` con `aria-expanded` y `aria-haspopup="menu"`, que se cierra con Escape y devuelve el
foco al botón. Un menú del que no se puede salir con teclado es un menú roto.

- [ ] **Paso 4: Comprobarlo, y con teclado**

Abrir el menú con Enter, moverse con flechas, cerrar con Escape y comprobar que el foco vuelve al
nombre. Es el detalle que separa una app cuidada de una que no.

- [ ] **Paso 5: Commit**

```bash
cd "C:/Users/Vmagni/Desktop/GRUPO PARIS/GESTORIA" && git add -A && git commit -m "La ficha podada, con el viaje de la fila a la ficha, y Administracion detras del nombre"
```

---

# PARTE 3 — EL ACABADO Y EL CIERRE

## Tarea 12: Las nueve decisiones que hacen que se vea cara

**Archivos:**
- Modificar: `src/index.css`, y todos los componentes de las tareas 6 a 11
- Modificar: `scripts/espacios-sanos.mjs` (nada; se corren sus hallazgos a cero)
- Modificar: `.githooks/pre-commit`

**Por qué está al final y no al principio:** el acabado se aplica sobre pantallas que existen.
Ajustar sombras y espacios de una pantalla que se va a rehacer es trabajo que se tira — y por eso
`espacios` quedó en rojo a propósito durante todo el Plan A.

**Las nueve, con lo que hay que hacer y cómo se comprueba.** "Que se vea premium" no es un criterio
que se pueda revisar; esto sí.

- [ ] **Paso 1 — Jerarquía de tamaños, de verdad**

Hoy casi todo es `text-sm` y `text-2xs`. Una app se ve barata cuando todos los textos miden
parecido, y la escala de nueve pasos ya existe **sin usar**.

**Regla:** el número que decide algo va en `text-3xl` o `text-4xl`, y su rótulo en `text-2xs`.

**Se comprueba:** en el resumen tiene que haber **al menos cuatro pasos distintos** de la escala.

```bash
cd "C:/Users/Vmagni/Desktop/GRUPO PARIS/GESTORIA" && grep -o "text-\(2xs\|xs\|sm\|base\|lg\|xl\|2xl\|3xl\|4xl\)" src/features/resumen/Resumen.tsx | sort -u | wc -l
```

Esperado: **4 o más**.

- [ ] **Paso 2 — Los números no bailan**

`.tnum` en toda cifra. Toda columna de plata **alineada a la derecha**, con ancho fijo. Los miles
siempre con punto. `formatearCorto` sólo en las cifras grandes; en el extracto y el presupuesto los
centavos van siempre.

- [ ] **Paso 3 — Seis pasos de espacio y ninguno más**

```bash
cd "C:/Users/Vmagni/Desktop/GRUPO PARIS/GESTORIA" && export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && npm run espacios > /tmp/e.log 2>&1; echo "EXIT: $?"; grep -o "Hay [0-9]* espacios" /tmp/e.log
```

Llevarlo a **cero**. Los 9 hallazgos de Plan A eran de archivos que este plan reescribió, así que
la mayoría ya no existen; los que queden se arreglan acá.

Y **entra al pre-commit**, que es el punto de tenerlo:

```sh
node scripts/espacios-sanos.mjs || exit 1
```

**Antes de conectarlo, verlo en rojo:** meter un `gap-5` a mano en cualquier `.tsx`, comprobar que
da 1 y nombra el archivo, y sacarlo.

- [ ] **Paso 4 — Elevación, no bordes**

`Panel` deja de ser un borde de 1 px y pasa a usar `--sombra-panel`, que se creó en la tarea 1. Las
tablas usan `--sombra-plana`; los menús y diálogos, `--sombra-flotante`.

**Ojo con la trampa:** `box-shadow: var(--ring), var(--shadow)` es CSS inválido —`--ring` es un
color y `--ring-sh` una sombra— y el navegador **descarta la declaración entera, en silencio**. Eso
dejó cinco pantallas sin sombra durante meses.

**Se comprueba mirando**, y además:

```bash
cd "C:/Users/Vmagni/Desktop/GRUPO PARIS/GESTORIA" && grep -rn "box-shadow.*var(--ring)[^-]" src/ ; echo "  (vacio = nadie mezclo el color con la sombra)"
```

- [ ] **Paso 5 — El foco se ve, y se ve bien**

Un anillo de **2 px en teal con 2 px de separación**, en **todo** lo que recibe foco:

```css
:focus-visible {
  outline: 2px solid var(--marca);
  outline-offset: 2px;
}
```

Es el detalle que más separa una app cuidada de una que no, y es además lo que la hace usable con
teclado. **Se comprueba con axe**, en la tarea 13.

- [ ] **Paso 6 — Las cosas se mueven de donde estaban a donde van**

Ya está el `view-transition-name` de la ficha (tarea 11). Todo lo demás —abrir una sección, cambiar
de nivel— con transiciones de **150 a 200 ms** y la curva `--ease-salida` que ya existe.

Nada más largo: una app lenta se siente barata, no cara.

Y **respeta `prefers-reduced-motion`**, que ya se agregó en la tarea 11.

- [ ] **Paso 7 — Los esqueletos tienen la forma de lo que viene**

El del resumen: cinco filas con cuatro columnas. El de la empresa: el encabezado de cifras y tres
secciones. **No rayas genéricas.** Un esqueleto que no se parece al contenido produce un salto al
cargar, y ese salto es exactamente lo que se ve barato.

- [ ] **Paso 8 — Los estados vacíos dicen qué hacer**

`EmptyState` ya existe y está bien. Falta usarlo en todos lados y que cada uno diga **la acción
siguiente**, no una lástima. *"Todavía no hay movimientos"* es peor que *"Cargá el saldo inicial de
la tarjeta para empezar"*, con el botón al lado.

- [ ] **Paso 9 — Una sola densidad, la de una tabla financiera**

Filas de **36 a 40 px**, no de 56. Suficiente para el dedo en el teléfono y suficientemente
compacto para que entren quince trámites sin scrollear.

**Se comprueba midiendo**, con el servidor levantado:

```js
// En la consola del navegador, sobre la pantalla de una empresa:
[...document.querySelectorAll('[data-fila-tramite]')].map(f => f.getBoundingClientRect().height)
```

Esperado: todas entre 36 y 40.

- [ ] **Paso 10: Los comandos, y el gate entero**

```bash
cd "C:/Users/Vmagni/Desktop/GRUPO PARIS/GESTORIA" && export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && export SUPABASE_ACCESS_TOKEN="$(grep '^SUPABASE_ACCESS_TOKEN=' .env.local | cut -d= -f2-)" && for c in "npx tsc -b" "npm run lint" "npm test" "npm run build" "npm run colores" "npm run espacios" "npm run contraste" "npm run formato:check"; do printf '%-22s ' "$c"; $c > /tmp/g.log 2>&1; echo "EXIT: $?"; done
```

Esperado: **los ocho en 0.** `espacios` y `contraste` incluidos: es la primera vez en el proyecto
que los diez guardianes están verdes a la vez.

- [ ] **Paso 11: Commit**

```bash
cd "C:/Users/Vmagni/Desktop/GRUPO PARIS/GESTORIA" && git add -A && git commit -m "Las nueve decisiones del acabado, y espacios entra al pre-commit en verde"
```

---

## Tarea 13: La verificación que no es de palabra

**Archivos:**
- Crear: `e2e/oficina.spec.ts`, `e2e/acabado.spec.ts`
- Modificar: `playwright.config.ts`, `package.json`

**Interfaces:**
- Consume: las cuentas de `.env.local`, igual que el arnés de permisos.
- Produce: el circuito de la oficina probado en el Chrome de verdad, y las capturas de referencia.

| Qué | Herramienta | Umbral |
|---|---|---|
| Contraste y accesibilidad | `@axe-core/playwright` | Cero violaciones serias |
| Que nada se corra | `toHaveScreenshot()` | Por debajo del umbral |
| Peso y velocidad | `@lhci/cli` | Rendimiento y accesibilidad **por encima de 90** |
| Espacios, color, contraste | Guardianes propios | Cero |
| **Que se vea bien** | **Mirarlo** | Los tres peores defectos de la tanda anterior los agarró alguien mirando |

- [ ] **Paso 1: El circuito de la oficina, con sesión de verdad**

Crear `e2e/oficina.spec.ts`. Entra con la cuenta de gerencia de `.env.local` y recorre:

resumen → Paris Autos → un trámite → volver con las migas → volver al resumen con el botón atrás
del navegador.

```ts
/*
  ENTRA POR LA API Y NO TIPEANDO LA CONTRASENIA EN EL FORMULARIO.

  Es lo mismo que hace el arnes de permisos: se pide la sesion a Supabase y se le pone al
  navegador. Una prueba que tipea en el formulario de login es tres veces mas lenta, y falla el
  dia que alguien cambie el texto del boton — por una razon que no tiene nada que ver con lo que
  la prueba queria comprobar.
*/
```

- [ ] **Paso 2: Correrla y verla fallar antes de que pase**

Antes de que las pantallas estén completas, esta prueba tiene que fallar nombrando qué falta. Una
prueba de circuito que pasa de entrada no está mirando el circuito.

- [ ] **Paso 3: axe, que está instalado y nunca se usó**

Crear `e2e/acabado.spec.ts`:

```ts
import AxeBuilder from "@axe-core/playwright";

test("el resumen no tiene violaciones serias de accesibilidad", async ({ page }) => {
  await entrarComoGerencia(page);
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  const serias = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serias, serias.map((v) => v.id).join(", ")).toHaveLength(0);
});
```

**Lo mismo en oscuro**, cambiando el esquema con `page.emulateMedia({ colorScheme: "dark" })`. El
teal en oscuro tiene su propio par de contraste y hay que medirlo aparte: asumir que los valores
del claro sirven es exactamente el error que `npm run contraste` existe para evitar.

- [ ] **Paso 4: Las capturas contra referencia**

```ts
await expect(page).toHaveScreenshot("resumen.png");
```

**La primera corrida genera la referencia y FALLA. Eso no es un defecto: es como funciona.** Lo que
no hay que hacer es generar la referencia sobre una pantalla que todavía no se miró — quedaría
congelado un defecto como si fuera lo correcto.

En `playwright.config.ts` ya está `maxDiffPixelRatio: 0.01`.

- [ ] **Paso 5: Lighthouse**

```bash
cd "C:/Users/Vmagni/Desktop/GRUPO PARIS/GESTORIA" && export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && npx lhci autorun --collect.url=http://localhost:5173 --collect.numberOfRuns=3 > /tmp/lh.log 2>&1; echo "EXIT: $?"; grep -E "performance|accessibility" /tmp/lh.log | head -4
```

Esperado: rendimiento y accesibilidad **por encima de 90**. Si accesibilidad da menos, axe ya lo
dijo con nombre y apellido; si rendimiento da menos, mirar qué pedazo pesa.

- [ ] **Paso 6: EL TIEMPO REAL, con dos ventanas y dos usuarios**

Es la comprobación que el spec pide por nombre, y la que ninguna otra herramienta puede hacer:
*"dos ventanas, dos usuarios, y mirarlo. No hay test unitario que pruebe esto, y esa es exactamente
la comprobación que Playwright sí puede automatizar."*

**No hace falta nada nuevo en la base.** Está comprobado que `movimientos`, `tramites` y
`tramite_eventos` ya están en la publicación `supabase_realtime`. Lo que faltaba era que las
pantallas se suscriban, y eso lo hace la invalidación de la tarea 4.

En `e2e/oficina.spec.ts`:

```ts
test("si contable carga un deposito, gerencia lo ve sin recargar", async ({ browser }) => {
  /*
    DOS CONTEXTOS DE VERDAD, no dos pestanias del mismo. Cada uno tiene su sesion, su
    almacenamiento y su conexion de tiempo real — que es exactamente la situacion que se quiere
    probar: dos personas, en dos oficinas, mirando la misma plata.

    ES LA FUNCION CENTRAL DEL PRODUCTO, no un adorno. El pedido decia, textual, que "muchas veces
    se pisan con el dinero que hay disponible en el dia".
  */
  const laOficina = await browser.newContext();
  const laGerencia = await browser.newContext();

  const pantallaContable = await laOficina.newPage();
  const pantallaGerencia = await laGerencia.newPage();

  await entrarComo(pantallaContable, "contable");
  await entrarComo(pantallaGerencia, "gerencia");

  // Las dos mirando el resumen, en la fila de Paris Autos.
  await pantallaGerencia.goto("/");
  const antes = await leerDiferenciaDeParisAutos(pantallaGerencia);

  /*
    EL DEPOSITO SE CARGA Y SE ANULA EN LA MISMA PRUEBA. La base es una sola y es la de produccion:
    dos veces en la tanda anterior una comprobacion escribio de verdad y hubo que anular
    movimientos a mano despues de verlos en la pantalla de la duenia.
  */
  const idDelDeposito = await cargarDeposito(pantallaContable, { importe: 1, concepto: "PRUEBA DE TIEMPO REAL" });

  try {
    // NADIE RECARGA NADA. Si esto falla, la suscripcion no esta llegando.
    await expect
      .poll(() => leerDiferenciaDeParisAutos(pantallaGerencia), { timeout: 10_000 })
      .not.toBe(antes);
  } finally {
    await anularDeposito(pantallaContable, idDelDeposito, "Prueba de tiempo real del Plan B");
  }

  // Y vuelve solo a donde estaba, tambien sin recargar.
  await expect
    .poll(() => leerDiferenciaDeParisAutos(pantallaGerencia), { timeout: 10_000 })
    .toBe(antes);
});
```

**Verla fallar antes de darla por buena:** comentar la línea
`void cliente.invalidateQueries({ queryKey: ["resumen"] })` de `datos.ts`, correr, comprobar que
falla por tiempo agotado, y restaurarla. Sin esa comprobación no se sabe si la prueba mira la
suscripción o simplemente espera a que TanStack refresque solo al volver el foco.

- [ ] **Paso 7: Lo que ya no importa nadie, se borra**

Recién ahora, y comprobando primero:

```bash
cd "C:/Users/Vmagni/Desktop/GRUPO PARIS/GESTORIA" && for f in Bandeja Tarjeta Listado VariantesDelResumen; do printf '%-22s ' "$f"; grep -rl "$f" src/ --include=*.tsx --include=*.ts | grep -v "$f.tsx" | tr '\n' ' '; echo; done
```

**Un archivo se borra sólo si esa línea sale vacía.** Borrar antes de comprobar es como se pierde
una función que alguien usaba y nadie recordaba.

Y `npm run deadcode`, que está en rojo desde antes, tiene que **bajar**: este plan saca pantallas
enteras.

- [ ] **Paso 8: MIRARLO. Con las tres cuentas, en claro y en oscuro, y en el teléfono**

Ningún test reemplaza esto, y está escrito porque los tres peores defectos de la tanda anterior
—los mensajes sin tilde, el botón que pedía tres cosas sin decirlo, y la gestora viendo todo en
cero— **los agarró alguien mirando**.

La lista:

- El resumen ofrece cinco empresas y la Diferencia de Paris Autos es el número más grande.
- Las cuatro empresas sin movimientos dicen **"Sin datos"**, no `$ 0,00`.
- Entrando como gestora, lo mismo en las empresas donde no trabaja.
- El botón atrás del navegador vuelve al nivel anterior, **y el scroll queda donde estaba**.
- Una URL de trámite pegada en WhatsApp abre ese trámite.
- Con Tab se llega a todo, y **el anillo teal se ve**.
- En oscuro, el teal se separa del fondo y no se ve enfermo.
- En el teléfono, las filas se tocan sin errarle.

- [ ] **Paso 9: Commit**

```bash
cd "C:/Users/Vmagni/Desktop/GRUPO PARIS/GESTORIA" && git add -A && git commit -m "El circuito de la oficina probado en el Chrome de verdad, con axe y con capturas"
```

---

## Tarea 14: Los tres revisores, y publicar

**Archivos:**
- Modificar: `CHANGELOG.md`, `docs/ESTADO.md`

**Por qué existe esta tarea:** el `CLAUDE.md` dice *"ninguna etapa cierra sin una revisión de
alguien que no la escribió"*. En la tanda anterior los tres revisores encontraron **siete defectos
de plata**, dos de ellos abiertos por esa misma tanda, y ninguno lo había agarrado una prueba.

- [ ] **Paso 1: Los tres, uno por vez y no los tres juntos**

**Lanzarlos de a uno o dos.** El 27/08/2026 los tres en paralelo costaron unos 350k tokens y el
límite de gasto mató dos en pleno vuelo, justo antes de publicar: hubo que relanzarlos enteros.

```
revisor-producto:
  Revisá los textos de las pantallas nuevas: voseo, sin jerga, sin emojis, y que cada estado
  vacío diga QUE HACER. Mirá especialmente si el resumen se entiende sin que nadie lo explique.

revisor-seguridad:
  Revisá `v_resumen_empresas`: que lleve security_invoker, que no exponga por el join nada que
  la RLS no exponga ya, y que una gestora no vea por ahí empresas donde no trabaja.

revisor-contable:
  Revisá que la suma del resumen cierre contra `v_saldos`, que la Diferencia sea contable menos
  comprometido y no otra cosa, y que ESPERAN coincida con lo que muestra la sección de la empresa.
```

- [ ] **Paso 2: `/code-review` sobre el diff de la rama contra `main`**

- [ ] **Paso 3: El gate entero**

```bash
cd "C:/Users/Vmagni/Desktop/GRUPO PARIS/GESTORIA" && export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && export SUPABASE_ACCESS_TOKEN="$(grep '^SUPABASE_ACCESS_TOKEN=' .env.local | cut -d= -f2-)" && for c in "npx tsc -b" "npm run lint" "npm test" "npm run build" "npm run secretos" "npm run migraciones" "npm run permisos" "npm run indices" "npm run colores" "npm run estados" "npm run espacios" "npm run contraste" "npm run formato:check" "npm run test:rls" "npm run e2e"; do printf '%-22s ' "$c"; $c > /tmp/g.log 2>&1; echo "EXIT: $?"; done
```

Esperado: **los quince en 0.**

- [ ] **Paso 4: El CHANGELOG, en lenguaje de quien usa el sistema**

Arriba de todo, dentro de "Sin publicar todavía". Que hable de lo que cambia para ella —una pantalla
que arranca en el resumen de las cinco empresas, sin menú— y no de rutas ni de tokens.

- [ ] **Paso 5: El ESTADO, con los números contados de nuevo**

Correr los comandos y escribir **esos** números, no los de antes. Y anotar cuál de las tres
variantes del resumen se eligió, con su porqué.

- [ ] **Paso 6: Publicar**

```bash
cd "C:/Users/Vmagni/Desktop/GRUPO PARIS/GESTORIA" && RAMA=$(git branch --show-current) && git add -A && git commit -m "Plan B cerrado: la app de la oficina, tres niveles y sin barra lateral" && git push origin "$RAMA" && git checkout main && git merge "$RAMA" --no-edit && git push origin main && git checkout "$RAMA"
```

- [ ] **Paso 7: Las tres evidencias**

1. `git rev-list --count origin/main..main` en **0**.
2. Un texto nuevo dentro del JS publicado:
   `curl -s https://proyecto-gestoria.pages.dev/ | grep -o '/assets/index-[^"]*\.js'`, y después
   `grep` de un texto de esta tanda sobre ese archivo.
3. El dato nuevo leído de la base, entrando con un usuario real.

- [ ] **Paso 8: Abrirlo y mirarlo**

Entrar a `https://proyecto-gestoria.pages.dev/` y comprobar que abre en el resumen de las cinco
empresas. Es el paso que este proyecto exige y que ningún test reemplaza.

---

## Lo que este plan NO hace

Escrito para que nadie lo suponga:

- **No construye la app de la gestora.** La cola de tareas en el teléfono, el salto en vivo de la
  tarjeta y la app instalable son el **Plan C**. Lo que sí queda listo es la vista de la que esa
  cola va a leer.
- **No manda notificaciones al teléfono.** Necesita un service worker y permisos del navegador.
- **No trae los vencimientos de vuelta.** Quedan en el historial de git.
- **No separa la base de desarrollo de la de producción.** Sigue siendo una sola, y la app lo sigue
  diciendo en pantalla. Eso es del Plan C, y **tiene que pasar antes de que haya saldos reales**.
- **No toca el libro mayor ni las policies**, salvo la vista nueva del resumen.
- **No cierra la deuda conocida:** `npm run deadcode` sigue en rojo (aunque este plan lo baja), y
  `npm run permisos` sigue devolviendo 0 cuando se saltea por falta de token — un guardián que se
  saltea en silencio y dice que salió bien es medio guardián.

---

## Lo que depende de vos

1. **Elegir una de las tres variantes del resumen** (tarea 5). Es la única decisión de diseño que
   el plan no toma solo, y es la primera pantalla que abre la dueña.
2. **Cambiar la contraseña genérica** antes de que haya saldos reales.
3. **La segunda base de Supabase**, antes de cargar el `saldo_inicial` real.
4. **Recargar los dos saldos iniciales**, que el Plan A destrabó y todavía no se hicieron.
5. **La regla escrita de gerencia:** no se deposita contra una foto de cuaderno.
