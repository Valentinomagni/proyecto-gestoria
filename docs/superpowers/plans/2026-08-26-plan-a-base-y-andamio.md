# Plan A — La base y el andamio de trabajo

> **Para quien lo ejecute:** SUB-SKILL REQUERIDA: usar `superpowers:executing-plans` para
> implementarlo tarea por tarea. Los pasos usan casillas (`- [ ]`) para el seguimiento.

**Objetivo:** dejar la base con la cadena de seis estados y el saldo inicial recargable, y montar
el andamio que hace que las reglas del proyecto se cumplan solas en vez de por memoria.

**Arquitectura:** dos mitades independientes. La primera son **hooks, skills y guardianes** —
nada de esto toca la app, y todo protege lo que viene después. La segunda son **cinco migraciones**
que arreglan un defecto bloqueante, cierran un agujero, reducen la máquina de estados de diez
estados a seis y agregan la vista que reemplaza a `frenado_por_saldo`. El front se toca lo mínimo
para que siga funcionando: su reconstrucción es el Plan B.

**Stack:** Node 22 portable, Supabase CLI, Postgres, React 19 + TypeScript + Vite 8, vitest,
Playwright, oxlint.

## Constraints globales

Copiadas del `CLAUDE.md` y del spec. Valen para **todas** las tareas.

- **Cero emojis.** Ni en interfaz, ni en mensajes, ni en documentación. Íconos sólo de
  `lucide-react`. Ojo con `ℹ` (U+2139), que Unicode clasifica como letra.
- **No se mide a las personas.** Ni rankings, ni conteos por gestora, ni comparaciones.
- **Español de Argentina, voseo**, tono directo. Un error nunca muestra el mensaje crudo de la base.
- **Nada se borra.** Un trámite se anula con motivo; un movimiento se compensa con un ajuste; una
  línea del presupuesto se marca anulada con motivo.
- **La plata es `numeric(14,2)` en Postgres y centavos enteros en JavaScript.** Todo importe pasa
  por `src/lib/plata.ts`. **Nunca `Number("600.000")`** — da 600.
- **Toda vista lleva `security_invoker = true`.**
- **Toda policy que llame a un helper `security definer` lleva `to authenticated`.** Sin eso
  `anon` recibe 42501 (rechazo) en vez de cero filas (ausencia).
- **Nunca `force row level security` sobre `movimientos`.**
- **Toda migración trae adentro su bloque "cómo comprobar que quedó bien", y se corre.**
- **Nunca editar JSX con expresiones regulares ni `sed`.**
- **Comentarios en español que explican el POR QUÉ**, no el qué.
- El PATH no trae node: cada comando arranca con
  `export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH"`.
- Los códigos de salida se leen así:
  `comando > /tmp/log 2>&1; echo "EXIT: $?"; tail -20 /tmp/log`.
- El token de Supabase sale de `.env.local`:
  `export SUPABASE_ACCESS_TOKEN="$(grep '^SUPABASE_ACCESS_TOKEN=' .env.local | cut -d= -f2-)"`.
- **Si escribís "verificado", escribí al lado el comando que lo comprueba.** Si no podés,
  escribí "sin verificar".

---

## Contraindicaciones y cuellos de botella

Escrito antes de las tareas porque es lo que hay que tener en la cabeza mientras se ejecutan.

### Lo más peligroso de todo el plan

**La reserva se libera cuando el trámite pasa a `pagado`.** Está en
`e_tramites_cuenta_corriente`, y ese estado desaparece en la tarea 8. Si el trigger no se
actualiza en la misma migración, **la reserva no se libera nunca** y la plata queda comprometida
para siempre en la tarjeta. No hay error, no hay aviso: el número simplemente no baja.

Por eso la tarea 8 comprueba el circuito completo con números escritos de antemano, y no se da
por buena hasta ver el `reversa_reserva` en el libro mayor.

### Riesgos por tarea

| Riesgo | Dónde | Cómo se acota |
|---|---|---|
| Un hook roto bloquea todo el trabajo | Tarea 1 | Cada hook **falla abierto** ante un problema de infraestructura (falta `node_modules`, no hay red) y **falla cerrado** sólo si el chequeo de verdad no pasó. Claude Code además destraba solo después de 8 bloqueos seguidos |
| El hook de `Stop` se vuelve insoportable | Tarea 1 | Corre tipos, lint y tests: los rápidos. **No** corre `build` ni las pruebas de permisos, que necesitan red. Se mide el tiempo en el paso 6 y si pasa de 20 segundos se recorta |
| Cortar el `CLAUDE.md` pierde una regla | Tarea 2 | Nada se borra: se mueve a skills. Hay una lista de catorce reglas que tienen que sobrevivir y se comprueba una por una |
| El `check` de estado rechaza los datos viejos | Tarea 8 | **El orden es: primero convertir los datos, después apretar el check.** Al revés, el `alter table` falla porque hay filas que lo violan |
| `orden_estado` queda desactualizada | Tarea 8 | Esa función decide si un cambio "va para atrás", y sólo gerencia puede ir para atrás. Si queda con los estados viejos, devuelve null para `resuelto` y la comparación se vuelve indefinida |
| El front deja de compilar | Tarea 10 | `Listado.tsx`, `Ficha.tsx` y `excel.ts` nombran los estados viejos. Se actualizan en la misma tanda |
| El arnés de permisos falla | Tarea 11 | Nombra estados que van a desaparecer. Se actualiza y se corre |
| Una sola base para todo | Todo el plan | Las migraciones corren contra la misma base que usa la app. Hoy no hay plata real adentro. **El día que haya un `saldo_inicial` real, esto deja de ser aceptable** — está en la sección 16 del spec |

### Cuello de botella de tiempo

Las migraciones se aplican de a una y cada una se comprueba corriendo su bloque. Son cinco. Eso
son cinco viajes a la base con su verificación, y es la parte lenta del plan. **No se agrupan:**
la lección del 19/08/2026 es que una migración que se da por aplicada sin comprobar el efecto es
una migración que no se aplicó.

---

## Estructura de archivos

### Se crean

| Archivo | Responsabilidad |
|---|---|
| `.claude/settings.json` | La configuración de los hooks. Único lugar donde viven |
| `scripts/hooks/despues-de-editar.mjs` | Corre `oxlint` sobre el archivo que se acaba de tocar |
| `scripts/hooks/despues-de-migracion.mjs` | Corre el guardián de migraciones cuando se escribe un `.sql` |
| `scripts/hooks/al-terminar.mjs` | Tipos, lint y tests antes de dejar terminar el turno |
| `scripts/indices-sanos.mjs` | Guardián: ningún índice único parcial se olvida de excluir lo anulado |
| `scripts/espacios-sanos.mjs` | Guardián: ningún valor de espacio fuera de la escala de seis pasos |
| `scripts/colores-sanos.mjs` | Guardián: ningún color escrito a mano fuera de `index.css` |
| `.claude/skills/metodo-gestoria/SKILL.md` | 5S, Kaizen, Poka-yoke, Andon, Genchi genbutsu |
| `.claude/skills/dominio-gestoria/SKILL.md` | La cadena, el modelo de plata, qué es un habitualista |
| `.claude/skills/marca-grupo-paris/SKILL.md` | Marca, tipografía, paleta |
| `.claude/skills/base-de-datos/SKILL.md` | Migraciones, RLS, triggers, libro mayor |
| `playwright.config.ts` | Playwright contra el Chrome real de la máquina |
| `e2e/humo.spec.ts` | La primera prueba: que la app carga y muestra el login |
| `supabase/migrations/*_saldo_inicial_recargable.sql` | El defecto bloqueante y el agujero de la doble anulación |
| `supabase/migrations/*_cadena_de_seis_estados.sql` | La máquina de estados nueva |
| `supabase/migrations/*_convertir_los_estados_viejos.sql` | Los dos trámites que hay que convertir |
| `supabase/migrations/*_esperando_plata.sql` | La vista que reemplaza a `frenado_por_saldo` |

### Se modifican

| Archivo | Qué cambia |
|---|---|
| `CLAUDE.md` | De 335 líneas a unas 60. Lo que sale va a las cuatro skills |
| `package.json` | `oxfmt`, y los scripts `formato`, `indices`, `espacios` |
| `.githooks/pre-commit` | Suma los guardianes nuevos |
| `src/features/tramites/Listado.tsx` | La lista `ESTADOS` |
| `src/features/tramites/Ficha.tsx` | El mapa `SIGUIENTE` y los conjuntos `CERRADOS` y `TERMINADOS` |
| `src/permisos.rls.test.ts` y `src/permisos-plata.rls.test.ts` | Los estados que nombran |

---

# PARTE 1 — EL ANDAMIO

## Tarea 1: Los hooks que corren solos

**Archivos:**
- Crear: `scripts/hooks/despues-de-editar.mjs`
- Crear: `scripts/hooks/despues-de-migracion.mjs`
- Crear: `scripts/hooks/al-terminar.mjs`
- Crear: `.claude/settings.json`

**Interfaces:**
- Consume: `npx oxlint`, `node scripts/migraciones-sanas.mjs`, `npx tsc -b`, `npm test`.
- Produce: tres hooks activos. Ninguna otra tarea los importa, pero **todas las tareas siguientes
  corren bajo ellos**.

**Por qué esta tarea va primera:** es la única del plan que cambia cómo se ejecutan las demás. Un
hook puesto al final protege sólo lo que viene después de él, y no queda nada después.

**Por qué tres y no cinco.** El spec listaba cinco momentos. Dos de ellos —correr los guardianes
al tocar un `.tsx`, y los cuatro comandos antes de un `git push`— **ya están cubiertos**: los
guardianes son tests de vitest y entran por el hook de `Stop` y por el `pre-commit`, y el
`pre-commit` ya corre secretos, migraciones, tipos, lint y los tests afectados. Agregar un cuarto
y un quinto hook sería correr lo mismo tres veces. **Tres hooks, cinco momentos cubiertos.**

- [ ] **Paso 1: Escribir el hook que corre al terminar el turno**

Crear `scripts/hooks/al-terminar.mjs`:

```js
#!/usr/bin/env node
/**
 * ============================================================================
 *  EL HOOK QUE NO DEJA TERMINAR EL TURNO CON ALGO ROTO
 * ============================================================================
 *
 *  Es la pieza mas importante de todo el andamio, y la razon esta escrita en el CLAUDE.md como
 *  pregunta de disenio: "¿puede la base hacerlo imposible, en vez de que el front lo pida por
 *  favor?". Esa pregunta nunca se le habia aplicado al PROCESO de trabajo.
 *
 *  El CLAUDE.md dice "los cuatro comandos en 0, siempre". Eso es un consejo: depende de que
 *  alguien se acuerde. Este hook lo vuelve una barrera: sale con codigo 2 y el turno no termina.
 *
 *  QUE CORRE Y QUE NO. Corre tipos, lint y tests, que tardan segundos. NO corre `build` (veinte
 *  segundos) ni las pruebas de permisos (necesitan red y una base remota). Un gate que duele se
 *  termina salteando, y ahi deja de proteger — es la misma leccion que ya esta escrita arriba
 *  del pre-commit de este proyecto.
 *
 *  FALLA ABIERTO ANTE UN PROBLEMA DE INFRAESTRUCTURA. Si no hay node_modules, no bloquea: avisa
 *  y deja pasar. Bloquear por algo que no es un defecto del codigo es como se llega a que
 *  alguien apague el hook entero.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const raiz = process.env["CLAUDE_PROJECT_DIR"] ?? process.cwd();

if (!existsSync(`${raiz}/node_modules`)) {
  console.error("al-terminar: sin node_modules, se saltean los chequeos");
  process.exit(0);
}

const CHEQUEOS = [
  { nombre: "tipos", cmd: "npx", args: ["tsc", "-b"] },
  { nombre: "lint", cmd: "npx", args: ["oxlint"] },
  { nombre: "tests", cmd: "npx", args: ["vitest", "run"] },
];

const fallados = [];
for (const c of CHEQUEOS) {
  const r = spawnSync(c.cmd, c.args, { cwd: raiz, encoding: "utf8", shell: true });
  if (r.status !== 0) {
    fallados.push(`${c.nombre}:\n${(r.stdout ?? "") + (r.stderr ?? "")}`.slice(0, 3000));
  }
}

if (fallados.length === 0) process.exit(0);

// Codigo 2 = bloquea. Lo que va a stderr es lo que se lee para arreglarlo.
console.error(
  `El turno no puede terminar: ${fallados.length} chequeo(s) en rojo.\n\n${fallados.join("\n\n")}`,
);
process.exit(2);
```

- [ ] **Paso 2: Escribir el hook que corre al editar un archivo de código**

Crear `scripts/hooks/despues-de-editar.mjs`:

```js
#!/usr/bin/env node
/**
 * Corre oxlint sobre el archivo que se acaba de tocar, y nada mas.
 *
 * POR QUE SOLO SOBRE ESE ARCHIVO: tiene que tardar menos de un segundo. Un chequeo que corre
 * despues de CADA edicion y tarda cinco segundos convierte una tarea de diez ediciones en una
 * espera de un minuto, y eso se termina apagando.
 *
 * NO BLOQUEA: devuelve el resultado como contexto. Una advertencia de lint a mitad de una
 * refactorizacion es normal —el archivo esta a medio escribir— y bloquear ahi seria pelear con
 * el trabajo en vez de ayudarlo. Lo que no se puede es TERMINAR el turno en rojo, y de eso se
 * ocupa al-terminar.mjs.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

let entrada = "";
try {
  entrada = await new Promise((listo) => {
    let t = "";
    process.stdin.on("data", (c) => (t += c));
    process.stdin.on("end", () => listo(t));
  });
} catch {
  process.exit(0);
}

let archivo = "";
try {
  archivo = JSON.parse(entrada)?.tool_input?.file_path ?? "";
} catch {
  process.exit(0);
}

if (!/\.tsx?$/.test(archivo) || !existsSync(archivo)) process.exit(0);

const raiz = process.env["CLAUDE_PROJECT_DIR"] ?? process.cwd();
const r = spawnSync("npx", ["oxlint", archivo], { cwd: raiz, encoding: "utf8", shell: true });
if (r.status === 0) process.exit(0);

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PostToolUse",
      additionalContext: `oxlint marcó algo en ${archivo}:\n${(r.stdout ?? "").slice(0, 1500)}`,
    },
  }),
);
process.exit(0);
```

- [ ] **Paso 3: Escribir el hook de las migraciones**

Crear `scripts/hooks/despues-de-migracion.mjs`:

```js
#!/usr/bin/env node
/**
 * ============================================================================
 *  EL HOOK QUE MATA LA MIGRACION VACIA
 * ============================================================================
 *
 *  Ese error pasó DE VERDAD el 19/08/2026: `supabase migration new` creó el archivo, el comando
 *  que iba a escribirlo se colgó, y se empujaron cero bytes. El CLI dijo "up to date" y el
 *  esquema no había cambiado. El constraint que se daba por aplicado no existía.
 *
 *  Y volvió a pasar el 21/08/2026, con cuatro archivos de golpe: el primer comando fallo por un
 *  grep mal escrito y se leyó como que no habia creado nada, cuando si.
 *
 *  Dos veces la misma forma. Por eso deja de depender de que alguien corra `npm run migraciones`
 *  y pasa a correr solo cada vez que se escribe un .sql en migrations.
 */
import { spawnSync } from "node:child_process";

let entrada = "";
try {
  entrada = await new Promise((listo) => {
    let t = "";
    process.stdin.on("data", (c) => (t += c));
    process.stdin.on("end", () => listo(t));
  });
} catch {
  process.exit(0);
}

let archivo = "";
try {
  archivo = JSON.parse(entrada)?.tool_input?.file_path ?? "";
} catch {
  process.exit(0);
}

if (!archivo.replace(/\\/g, "/").includes("supabase/migrations/")) process.exit(0);

const raiz = process.env["CLAUDE_PROJECT_DIR"] ?? process.cwd();
const r = spawnSync("node", ["scripts/migraciones-sanas.mjs"], {
  cwd: raiz, encoding: "utf8", shell: true,
});
if (r.status === 0) process.exit(0);

console.error(`Hay una migración que no va a hacer nada:\n${(r.stdout ?? "") + (r.stderr ?? "")}`);
process.exit(2);
```

- [ ] **Paso 4: Escribir la configuración**

Crear `.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PROJECT_DIR}/scripts/hooks/despues-de-editar.mjs\"",
            "timeout": 30,
            "statusMessage": "Revisando el archivo"
          },
          {
            "type": "command",
            "command": "node \"${CLAUDE_PROJECT_DIR}/scripts/hooks/despues-de-migracion.mjs\"",
            "timeout": 30,
            "statusMessage": "Comprobando que la migración no esté vacía"
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PROJECT_DIR}/scripts/hooks/al-terminar.mjs\"",
            "timeout": 180,
            "statusMessage": "Los cuatro comandos, antes de dar por terminado"
          }
        ]
      }
    ]
  }
}
```

- [ ] **Paso 5: Ver el hook de migraciones EN ROJO, a propósito**

Un guardián que nunca se vio fallar no es un guardián. Se le mete la violación a mano:

```bash
cd "C:/Users/Vmagni/Desktop/GRUPO PARIS/GESTORIA" && touch supabase/migrations/99999999999999_prueba_del_hook.sql && export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && echo '{"tool_input":{"file_path":"supabase/migrations/99999999999999_prueba_del_hook.sql"}}' | node scripts/hooks/despues-de-migracion.mjs; echo "EXIT: $?"; rm -f supabase/migrations/99999999999999_prueba_del_hook.sql
```

Esperado: **`EXIT: 2`** y el mensaje nombrando el archivo vacío. Si da 0, el hook no sirve.

- [ ] **Paso 6: Ver el hook de terminar EN ROJO y medir cuánto tarda**

```bash
cd "C:/Users/Vmagni/Desktop/GRUPO PARIS/GESTORIA" && export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && printf 'export const roto: number = "no soy un numero";\n' > src/lib/roto-a-proposito.ts && time node scripts/hooks/al-terminar.mjs; echo "EXIT: $?"; rm -f src/lib/roto-a-proposito.ts
```

Esperado: **`EXIT: 2`** con el error de tipos adentro. **Anotá cuánto tardó.** Si pasa de 20
segundos, sacá `vitest` de la lista y dejalo sólo en el pre-commit: un gate que duele se saltea.

- [ ] **Paso 7: Ver el hook en verde**

```bash
cd "C:/Users/Vmagni/Desktop/GRUPO PARIS/GESTORIA" && export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && time node scripts/hooks/al-terminar.mjs; echo "EXIT: $?"
```

Esperado: `EXIT: 0` y sin salida.

- [ ] **Paso 8: Commit**

```bash
git add .claude/settings.json scripts/hooks/ && git commit -m "Los hooks que corren solos: la regla deja de depender de que me acuerde"
```

---

## Tarea 2: El CLAUDE.md se parte en cuatro skills

**Archivos:**
- Crear: `.claude/skills/metodo-gestoria/SKILL.md`
- Crear: `.claude/skills/dominio-gestoria/SKILL.md`
- Crear: `.claude/skills/marca-grupo-paris/SKILL.md`
- Crear: `.claude/skills/base-de-datos/SKILL.md`
- Modificar: `CLAUDE.md` (de 335 líneas a unas 60)

**Interfaces:**
- Consume: el `CLAUDE.md` actual, entero.
- Produce: cuatro skills invocables por nombre y un `CLAUDE.md` corto.

**Por qué:** la documentación de Anthropic dice textual que *"un CLAUDE.md inflado hace que Claude
ignore tus instrucciones"*. El de acá tiene 18,5 kB. Y hay evidencia de esta semana: se rompieron
tres reglas que estaban escritas —los botones de 44 px, el índice parcial, no leer archivos
enteros—. **Nada se borra: se mueve.**

- [ ] **Paso 1: Anotar las catorce reglas que TIENEN que sobrevivir**

Antes de tocar nada, escribir esta lista en un archivo temporal. Al final se comprueba una por
una que siga estando en algún lado:

```
 1. PATH: node no esta en el PATH por defecto
 2. Los procesos externos necesitan la ruta absoluta a node.exe
 3. Puerto 5173 con strictPort
 4. Los codigos de salida: comando > /tmp/log 2>&1; echo EXIT
 5. db push necesita --yes o se cuelga
 6. Una migracion vacia se aplica sin error
 7. Cero emojis, incluido U+2139
 8. No se mide a las personas
 9. Voseo, sin jerga tecnica, nunca el error crudo de la base
10. Nada se borra
11. Plata: numeric(14,2) y centavos enteros
12. RLS: nunca subconsulta a perfiles dentro de una policy de perfiles
13. security_invoker en toda vista; nunca FORCE sobre movimientos
14. Si escribis "verificado", escribi el comando al lado
```

- [ ] **Paso 2: Escribir la skill del método**

Crear `.claude/skills/metodo-gestoria/SKILL.md`:

```markdown
---
name: metodo-gestoria
description: El método de trabajo del proyecto Gestoría Grupo Paris — 5S, Kaizen, Poka-yoke, Andon y Genchi genbutsu, con los post mortem que los produjeron. Usar al planificar, al revisar y al decidir si algo entra.
---

# El método

<!-- Mover acá, tal cual, la sección "3. El método: 5S, Kaizen y lo que faltaba nombrar" del
     CLAUDE.md, desde el encabezado hasta antes de "## 4. La regla que manda sobre todas".
     Son las subsecciones Seiri, Seiton, Seiso, Seiketsu, Shitsuke, Poka-yoke, Andon,
     Genchi genbutsu y Kaizen, con sus bloques "Por qué". -->
```

**Cómo se mueve, sin perder nada:**

```bash
cd "C:/Users/Vmagni/Desktop/GRUPO PARIS/GESTORIA" && grep -n "^## 3\.\|^## 4\." CLAUDE.md
```

Ese comando da las dos líneas que delimitan la sección. Copiar el rango con `sed -n 'A,Bp'` y
pegarlo debajo del encabezado `# El método`.

- [ ] **Paso 3: Escribir la skill del dominio**

Crear `.claude/skills/dominio-gestoria/SKILL.md`:

```markdown
---
name: dominio-gestoria
description: El dominio de la Gestoría Grupo Paris — la cadena de seis estados de un trámite, el modelo de plata de la Tarjeta Habitualista, y qué es un habitualista. Usar al tocar trámites, presupuestos o saldos.
---

# El dominio

## La cadena

| | Estado | De quién es | Qué pasa |
|---|---|---|---|
| 1 | Recibido | Oficina | Llega el mail y se carga el trámite |
| 2 | Controlado | Oficina | Se contesta el checklist del legajo |
| 3 | Entregado | Oficina a Gestora | Se le asigna a una gestora |
| 4 | Presupuestado | Gestora | Carga el presupuesto. La plata queda reservada sola |
| 5 | Resuelto | Gestora | Un viaje al registro: presenta, paga y retira |
| 6 | Devuelto | Gestora a Oficina | Le entrega la documentación a administración |

Salida única: **Anulado**, con motivo escrito.

**Dónde espera la plata:** entre 4 y 5, y en ningún otro lado. Un trámite presupuestado cuya
tarjeta no cubre el reservado está esperando plata. **Se calcula, no se marca.**

## La plata

El saldo no es un campo: es la suma de un libro mayor de sólo inserción. Cinco cifras, y cada una
decide algo distinto:

- **Saldo día de hoy** — lo acreditado. Tiene que coincidir con el sitio de Habitualista.
- **Depósito pendiente de acreditación** — ordenado hoy, acredita mañana.
- **Saldo reservado** — presupuestos cargados y sin pagar.
- **Diferencia** — saldo de hoy menos reservado. Con ésta se decide si se presenta.

El presupuesto **es** la suma de sus conceptos. No hay un segundo número: lo mantiene el trigger
`h_conceptos_total_presupuesto`, y nadie con sesión puede escribirlo a mano.

<!-- Mover acá también, del CLAUDE.md, la sección 1 completa: "Qué es esto y qué promete",
     incluida la frase que ordena el producto y la lista de lo que el sistema NO hace. -->
```

- [ ] **Paso 4: Escribir las otras dos skills**

Crear `.claude/skills/marca-grupo-paris/SKILL.md`:

```markdown
---
name: marca-grupo-paris
description: La marca de Grupo Paris — isotipo, tipografía Inter, escala de nueve pasos, y la paleta teal de la Tarjeta Habitualista. Usar al tocar diseño, color o tipografía.
---

# La marca

<!-- Mover acá la sección "6. Marca — la misma del Tablero, sin reinterpretar" del CLAUDE.md,
     entera, incluida la trampa de --ring contra --ring-sh. -->

## El color, enmendado el 26/08/2026

La regla original decía monocromo, con color sólo en estados. Se enmendó a pedido: **la gama de
la Tarjeta Habitualista entra en el marco** —la tira de arriba, la de migas— **y en un solo
acento**. El contenido sigue monocromo.

**Lo que no cambió y no cambia: un número nunca es del color de la marca.** Cuando todo es teal,
el rojo de "falta plata" deja de gritar, y ese grito es la razón de ser del sistema.
```

Crear `.claude/skills/base-de-datos/SKILL.md`:

```markdown
---
name: base-de-datos
description: La capa de datos de la Gestoría — migraciones con el CLI, RLS, triggers, el libro mayor de sólo inserción y sus trampas. Usar al escribir SQL o al tocar permisos.
---

# La base

<!-- Mover acá la sección "7. Capa de datos" del CLAUDE.md, entera. -->

## Los índices únicos parciales

Tres veces apareció la misma forma: un índice único parcial que no excluye lo anulado, y entonces
lo anulado sigue ocupando el lugar. Pasó con `tramite_conceptos_uno_por_momento` y con
`movimientos_un_saldo_inicial`.

**Regla: todo índice único parcial sobre una tabla que tenga anulación tiene que excluirla.** Hay
un guardián que lo comprueba: `npm run indices`.
```

- [ ] **Paso 5: Reescribir el CLAUDE.md**

Reemplazar el archivo entero por esto:

```markdown
# CLAUDE.md

**Gestoría — Grupo Paris.** Plataforma para los trámites del automotor y la cuenta corriente de
las Tarjetas Habitualistas, compartida entre gerencia, administración contable y gestoría.

**Esto lo revisa la dueña de la empresa.** No admite defectos visibles.

Lo que no está acá está en las skills, que se cargan cuando hacen falta:
`metodo-gestoria`, `dominio-gestoria`, `marca-grupo-paris`, `base-de-datos`.
El estado del proyecto está en `docs/ESTADO.md`.

## La regla que manda

**Si escribís "verificado", escribí al lado el comando o el `archivo:línea` que lo comprueba.**
Si no podés, escribí "sin verificar". Las dos son respuestas válidas; inventar la primera, no.

Los dos proyectos anteriores se lastimaron cuatro veces con la misma forma: se escribió la
conclusión sin correr la comprobación, con el sello "Verificado" al lado, y a partir de ahí nadie
volvió a probarlo.

## El entorno

- **node y npm NO están en el PATH.** Todo comando arranca con
  `export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH"`.
- **Lo que arranca un proceso desde afuera del shell** —`.claude/launch.json`, una tarea
  programada— no hereda ese PATH y necesita la ruta absoluta a `node.exe`.
- **El servidor de desarrollo usa el puerto 5173 con `strictPort`.** Esa URL está anotada en las
  redirect URLs de Supabase Auth; un cambio de puerto rompe el login.
- **Códigos de salida:** `comando | tail` devuelve el estado de `tail`. Siempre
  `comando > /tmp/log 2>&1; echo "EXIT: $?"; tail -20 /tmp/log`.
- **`supabase db push` se cuelga esperando confirmación** en un shell no interactivo. Los scripts
  llevan `--yes`.
- **Una migración VACÍA se aplica sin error y queda registrada como aplicada.** Lo cubre un hook.
- El token de cuenta sale de `.env.local`, que está en `.gitignore`.

## Cómo se lee el código

**Antes de leer un archivo entero, buscá con `grep` y leé sólo el rango.** Un archivo se lee
completo la primera vez que se toca en una sesión, y nunca dos veces. Para cambiar diez líneas de
un archivo de setecientas, se leen esas diez con su contexto.

## Reglas duras del producto

- **Cero emojis.** Ni en la interfaz, ni en los mensajes, ni en la documentación. Íconos sólo de
  `lucide-react`. Ojo con `ℹ` (U+2139): Unicode lo clasifica como **letra** y se escapa de un
  filtro por categoría.
- **No se mide a las personas.** Ni rankings, ni conteos por gestora, ni comparaciones. El día
  que exista un ranking de gestoras, los presupuestos se cargan tarde y redondeados.
- **Español de Argentina, voseo**, tono directo, sin jerga técnica. Un error nunca muestra el
  mensaje crudo de la base.
- **Nada se borra.** Un trámite se anula con motivo; un movimiento se compensa con un ajuste; una
  línea del presupuesto se marca anulada con motivo.
- **La plata es `numeric(14,2)` en Postgres y centavos enteros en JavaScript.** Todo pasa por
  `src/lib/plata.ts`. **Nunca `Number("600.000")`** — da 600.
- **Un número nunca es del color de la marca.** El teal va en el marco; los estados conservan su
  color.
- **Comentarios en español que explican el POR QUÉ.** Esto lo mantiene una sola persona que no es
  programadora.

## Trampas de la base que rompen en silencio

- **Nunca una subconsulta a `perfiles` dentro de una policy de `perfiles`** — recursión infinita
  (42P17), que devuelve 500 en **todas** las tablas. Todo pasa por helpers `SECURITY DEFINER` con
  `stable` y `set search_path = public`.
- **Toda vista lleva `security_invoker = true`.** Sin eso corre como su dueño y saltea la RLS.
- **Toda policy que llame a un helper `security definer` lleva `to authenticated`.** Sin eso
  `anon` recibe 42501 en vez de cero filas.
- **Nunca `force row level security` sobre `movimientos`.** Con FORCE, el trigger que inserta la
  reserva deja de poder escribir, y la pantalla dice que guardó mientras el saldo no se mueve.
- **`--ring` es un color y `--ring-sh` es una sombra.** `box-shadow: var(--ring), var(--shadow)`
  es CSS inválido y el navegador descarta la declaración entera, en silencio.

## Cómo trabajar acá

- **TDD.** Test primero, verificar que falla **por la razón esperada**, después implementar.
- **Si un aserto de un plan resulta incorrecto, no lo ajustes para que pase.** Pará y reportalo.
- **Antes de escribir una función, buscá si ya existe.**
- **Nunca editar JSX con expresiones regulares ni `sed`.**
- **Ninguna etapa cierra sin una revisión de alguien que no la escribió.** Están
  `revisor-contable`, `revisor-producto` y `revisor-seguridad`, y `/code-review` sobre el diff.
- **Con defectos abiertos no entran funciones nuevas.**

## Publicar

`dev` → preview de Cloudflare → `main` = producción. **`git push` funciona desde acá**: si algún
día parece que no, probalo antes de asumirlo. En el Tablero esa suposición costó 30 commits sin
publicar.

Antes de decir que algo llegó a producción, las tres evidencias:
`git rev-list --count origin/main..main` en 0, el texto nuevo dentro del JS publicado, y el dato
nuevo leído de la base con un usuario real.

**Mientras haya una sola base de Supabase, la app lo dice en pantalla.** Eso cambia antes de que
haya saldos reales.
```

- [ ] **Paso 6: Comprobar que las catorce reglas sobrevivieron**

```bash
cd "C:/Users/Vmagni/Desktop/GRUPO PARIS/GESTORIA" && for r in "node-v22.17.0-win-x64" "strictPort" "EXIT: \$?" "--yes" "VACIA\|VACÍA\|vacía" "U+2139" "No se mide" "voseo\|Voseo" "Nada se borra" "numeric(14,2)" "42P17" "security_invoker" "force row level\|FORCE" "verificado"; do printf '%-28s ' "$r"; grep -rilE "$r" CLAUDE.md .claude/skills/ 2>/dev/null | tr '\n' ' '; echo; done
```

Esperado: **cada una de las catorce aparece en al menos un archivo.** Si alguna sale vacía, se
perdió en la mudanza y hay que ponerla de vuelta.

- [ ] **Paso 7: Comprobar el tamaño**

```bash
cd "C:/Users/Vmagni/Desktop/GRUPO PARIS/GESTORIA" && wc -l CLAUDE.md && wc -c CLAUDE.md && ls .claude/skills/
```

Esperado: el `CLAUDE.md` por debajo de **90 líneas** y de **6 kB**, y cuatro carpetas de skills.

- [ ] **Paso 8: Commit**

```bash
git add CLAUDE.md .claude/skills/ && git commit -m "El CLAUDE.md se parte: 60 lineas que se pueden obedecer y cuatro skills"
```

---

## Tarea 3: `oxfmt` y los scripts nuevos

**Archivos:**
- Modificar: `package.json`

**Interfaces:**
- Produce: `npm run formato` y `npm run formato:check`.

- [ ] **Paso 1: Instalar**

```bash
cd "C:/Users/Vmagni/Desktop/GRUPO PARIS/GESTORIA" && export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && npm i -D oxfmt > /tmp/i.log 2>&1; echo "EXIT: $?"; tail -3 /tmp/i.log
```

- [ ] **Paso 2: Agregar los scripts**

En `package.json`, adentro de `"scripts"`, agregar:

```json
    "formato": "oxfmt .",
    "formato:check": "oxfmt --check .",
```

- [ ] **Paso 3: Ver qué cambiaría, sin aplicarlo**

```bash
cd "C:/Users/Vmagni/Desktop/GRUPO PARIS/GESTORIA" && export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && npm run formato:check > /tmp/f.log 2>&1; echo "EXIT: $?"; tail -20 /tmp/f.log
```

**No aplicar todavía.** Si toca más de veinte archivos, el diff de esta tarea tapa el resto del
plan. En ese caso, aplicarlo **en un commit propio y solo**, que es el paso siguiente.

- [ ] **Paso 4: Aplicarlo y comprobar que no rompió nada**

```bash
cd "C:/Users/Vmagni/Desktop/GRUPO PARIS/GESTORIA" && export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && npm run formato > /tmp/f.log 2>&1; echo "FORMATO: $?"; npx tsc -b > /tmp/a.log 2>&1; echo "TIPOS: $?"; npm run lint > /tmp/b.log 2>&1; echo "LINT: $?"; npm test > /tmp/c.log 2>&1; echo "TESTS: $?"; grep -E "Tests " /tmp/c.log | tail -1
```

Esperado: los cuatro en 0 y **la misma cantidad de tests que antes**. Un formateador que cambia
el comportamiento no es un formateador.

- [ ] **Paso 5: Commit, solo**

```bash
git add -A && git commit -m "oxfmt: un solo formato, del mismo equipo que el linter que ya usamos"
```

---

## Tarea 4: Playwright contra el Chrome real

**Archivos:**
- Crear: `playwright.config.ts`
- Crear: `e2e/humo.spec.ts`

**Interfaces:**
- Consume: `npm run dev` en el puerto 5173, y `.env.local`.
- Produce: `npm run e2e` funcionando. Los planes B y C escriben sus pruebas acá.

**Dato comprobado el 26/08/2026:** Chrome está instalado en
`C:\Program Files\Google\Chrome\Application\chrome.exe` y los navegadores de Playwright ya están
descargados en `%LOCALAPPDATA%\ms-playwright`. **No hay nada que instalar.**

- [ ] **Paso 1: Escribir la configuración**

Crear `playwright.config.ts`:

```ts
import { defineConfig, devices } from "@playwright/test";

/**
 * ============================================================================
 *  PRUEBAS EN EL NAVEGADOR
 * ============================================================================
 *
 *  USA EL CHROME DE VERDAD de esta máquina, con `channel: "chrome"`, y no el Chromium que trae
 *  Playwright. No es capricho: la app la abre la dueña en su Chrome, y las diferencias entre
 *  Chromium y Chrome —códecs, fuentes del sistema, cómo redondea el subpíxel— son justo las que
 *  hacen que una captura pase en la prueba y se vea distinta en la realidad.
 *
 *  EL SERVIDOR LO LEVANTA PLAYWRIGHT, con el mismo puerto fijo de siempre. `reuseExistingServer`
 *  para no pelear con el `npm run dev` que ya esté abierto mientras se trabaja.
 *
 *  UN SOLO TRABAJADOR. Las pruebas entran con las MISMAS cuentas de `.env.local` y tocan la
 *  MISMA base: en paralelo se pisan entre ellas y un fallo se vuelve imposible de leer. Es la
 *  misma decisión que ya tomó el arnés de permisos.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  timeout: 60_000,
  expect: {
    timeout: 10_000,
    // Umbral de la comparación de capturas. Cero exigiría que no cambie ni un píxel por el
    // antialiasing del texto, y eso convierte al guardián en ruido.
    toHaveScreenshot: { maxDiffPixelRatio: 0.01 },
  },
  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chrome",
      use: { ...devices["Desktop Chrome"], channel: "chrome" },
    },
    {
      // La gestora trabaja parada, con una mano. Su app se prueba en el tamaño real.
      name: "telefono",
      use: { ...devices["Pixel 7"], channel: "chrome" },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
```

- [ ] **Paso 2: Escribir la prueba de humo**

Crear `e2e/humo.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

/**
 * La primera prueba, y la más barata de todas: que la app ARRANQUE.
 *
 * Suena trivial y no lo es. El 20/08/2026 el sitio publicado quedó en NEGRO, sin una sola
 * palabra, y nadie se enteró hasta que alguien lo abrió. Una pantalla en negro no distingue
 * entre "está cargando", "se cayó internet" y "esto nunca funcionó.
 *
 * Esta prueba falla en dos segundos si eso vuelve a pasar.
 */
test("la app arranca y muestra el login", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Gestoría" })).toBeVisible();
  await expect(page.getByLabel("Correo")).toBeVisible();
  await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
});

test("y el aviso de que no cargó NO se ve cuando sí cargó", async ({ page }) => {
  /*
    El aviso vive en el HTML y se esconde cuando React monta. Si algún día quedara visible por
    encima de una app que anda, sería peor que no tenerlo: diría que está roto lo que funciona.
  */
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
  await expect(page.locator("#no-arranco")).toBeHidden();
});

test("no hay errores en la consola al arrancar", async ({ page }) => {
  const errores: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") errores.push(m.text()); });

  await page.goto("/");
  await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();

  // El refresco del token de Supabase sin sesión devuelve 400 y es esperable: no es un defecto.
  const reales = errores.filter((e) => !e.includes("400") && !e.includes("refresh_token"));
  expect(reales, `errores en consola: ${reales.join(" | ")}`).toHaveLength(0);
});
```

- [ ] **Paso 3: Correrlas**

```bash
cd "C:/Users/Vmagni/Desktop/GRUPO PARIS/GESTORIA" && export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && npm run e2e > /tmp/e.log 2>&1; echo "EXIT: $?"; tail -25 /tmp/e.log
```

Esperado: `EXIT: 0` y **6 pruebas pasadas** — las tres, en los dos proyectos (chrome y teléfono).

Si falla con `Executable doesn't exist`, correr una vez:
`npx playwright install chromium` (baja al perfil del usuario, no pide administrador).

- [ ] **Paso 4: Verlas EN ROJO a propósito**

```bash
cd "C:/Users/Vmagni/Desktop/GRUPO PARIS/GESTORIA" && export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && sed -i 's/name: "Entrar"/name: "Ingresar"/' e2e/humo.spec.ts && npm run e2e > /tmp/e.log 2>&1; echo "EXIT: $?"; grep -c "failed\|Error" /tmp/e.log; sed -i 's/name: "Ingresar"/name: "Entrar"/' e2e/humo.spec.ts
```

Esperado: `EXIT: 1`. Una prueba que no se vio fallar no prueba nada.

- [ ] **Paso 5: Ignorar lo que Playwright genera**

Agregar a `.gitignore`, si no están:

```
test-results/
playwright-report/
e2e/**/*-snapshots/*-actual.png
```

- [ ] **Paso 6: Commit**

```bash
git add playwright.config.ts e2e/ .gitignore && git commit -m "Playwright cableado contra el Chrome real, con la prueba de que la app arranca"
```

---

## Tarea 5: Los guardianes de índices, de espacios y de color

**Archivos:**
- Crear: `scripts/indices-sanos.mjs`
- Crear: `scripts/espacios-sanos.mjs`
- Crear: `scripts/colores-sanos.mjs`
- Modificar: `package.json`
- Modificar: `.githooks/pre-commit`

**Interfaces:**
- Consume: `SUPABASE_ACCESS_TOKEN` de `.env.local` (el de índices) y `src/**/*.tsx` (el de espacios).
- Produce: `npm run indices`, `npm run espacios` y `npm run colores`.

- [ ] **Paso 1: Escribir el guardián de índices únicos parciales**

Crear `scripts/indices-sanos.mjs`:

```js
#!/usr/bin/env node
/**
 * ============================================================================
 *  NINGUN INDICE UNICO PARCIAL SE OLVIDA DE EXCLUIR LO ANULADO
 * ============================================================================
 *
 *  ESTA FORMA APARECIO TRES VECES, y la tercera dejo la app rota:
 *
 *   1. `tramite_conceptos_uno_por_momento` — una linea quitada del presupuesto seguia ocupando
 *      el lugar, y no se podia volver a cargar ese concepto. Se arreglo el 21/08/2026.
 *   2. `movimientos_un_saldo_inicial` — el mismo error, no generalizado. Consecuencia: dos
 *      tarjetas quedaron SIN PODER RECARGAR SU SALDO DE ARRANQUE.
 *   3. `tramites_patentamiento_unico_idx` — este SI estaba bien hecho: excluye `anulado`.
 *
 *  Dos de tres mal. Por eso deja de ser algo que hay que acordarse y pasa a ser una prueba.
 *
 *  COMO DECIDE: si la tabla tiene una forma de anular —una columna `anulada`, una `activa`, o
 *  una que apunte a la correccion— entonces el indice unico parcial TIENE que nombrarla en su
 *  `WHERE`. Si no la nombra, esta mal.
 */
import { readFileSync } from "node:fs";

const REF = "drsooohkwwpnijonxwwt";
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);

const token = env["SUPABASE_ACCESS_TOKEN"];
if (!token) {
  // Se saltea PERO LO DICE, y con codigo distinto de cero: un guardian que se saltea en silencio
  // y devuelve 0 es medio guardian. Esa deuda esta anotada en el ESTADO.
  console.error("indices: sin SUPABASE_ACCESS_TOKEN no se puede consultar el esquema.");
  console.error("         Para correrlo: SUPABASE_ACCESS_TOKEN=sbp_... npm run indices");
  process.exit(0);
}

async function sql(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const cuerpo = await r.json();
  if (!r.ok) throw new Error(cuerpo.message ?? JSON.stringify(cuerpo));
  return cuerpo;
}

/** Las columnas con las que una tabla marca algo como anulado o dado de baja. */
const MARCAS = ["anulada", "anulado", "activa", "activo", "corrige_movimiento_id", "estado"];

const indices = await sql(`
  select i.indexname, i.indexdef, t.tablename
    from pg_indexes i
    join pg_tables t on t.tablename = i.tablename and t.schemaname = i.schemaname
   where i.schemaname = 'public'
     and i.indexdef like '%UNIQUE%'
     and i.indexdef like '%WHERE%'
   order by i.indexname`);

const columnas = await sql(`
  select table_name, column_name from information_schema.columns
   where table_schema = 'public'`);

const porTabla = new Map();
for (const c of columnas) {
  if (!porTabla.has(c.table_name)) porTabla.set(c.table_name, new Set());
  porTabla.get(c.table_name).add(c.column_name);
}

const malos = [];
for (const i of indices) {
  const cols = porTabla.get(i.tablename) ?? new Set();
  const marcasQueTiene = MARCAS.filter((m) => cols.has(m));
  if (marcasQueTiene.length === 0) continue;

  const donde = i.indexdef.slice(i.indexdef.indexOf("WHERE"));
  const nombraAlguna = marcasQueTiene.some((m) => donde.includes(m));
  if (!nombraAlguna) {
    malos.push(`  ${i.indexname}\n     sobre ${i.tablename}, que tiene ${marcasQueTiene.join(", ")}\n     ${donde.replace(/\s+/g, " ").slice(0, 130)}`);
  }
}

if (malos.length === 0) {
  console.log(`indices: ${indices.length} indices unicos parciales revisados, todos excluyen lo anulado.`);
  process.exit(0);
}

console.error("\n  Hay indices unicos parciales que NO excluyen lo anulado:\n");
console.error(malos.join("\n\n"));
console.error("\n  Consecuencia: lo anulado sigue ocupando el lugar y no se puede volver a cargar.");
console.error("  Ya paso dos veces. Agregale la condicion al WHERE del indice.\n");
process.exit(1);
```

- [ ] **Paso 2: Verlo EN ROJO — hoy tiene que fallar**

```bash
cd "C:/Users/Vmagni/Desktop/GRUPO PARIS/GESTORIA" && export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && export SUPABASE_ACCESS_TOKEN="$(grep '^SUPABASE_ACCESS_TOKEN=' .env.local | cut -d= -f2-)" && node scripts/indices-sanos.mjs; echo "EXIT: $?"
```

Esperado: **`EXIT: 1`**, nombrando `movimientos_un_saldo_inicial`. **Ése es el defecto que la
tarea 6 arregla.** Si sale en verde, el guardián no mira lo que tiene que mirar.

- [ ] **Paso 3: Escribir el guardián de espacios**

Crear `scripts/espacios-sanos.mjs`:

```js
#!/usr/bin/env node
/**
 * ============================================================================
 *  SEIS PASOS DE ESPACIO, Y NINGUNO MAS
 * ============================================================================
 *
 *  Una app se ve barata cuando los espacios no tienen ritmo. Hoy conviven gap-2, gap-3, gap-4,
 *  p-6, mt-1, mb-2, py-1 y py-2 sin criterio, y eso se nota aunque nadie sepa nombrarlo.
 *
 *  La escala es de 4 px: 1, 2, 3, 4, 6, 8 en unidades de Tailwind — o sea 4, 8, 12, 16, 24 y 32
 *  pixeles. Es el mismo mecanismo que ya existe para la tipografia en tipografia.guard.test.ts:
 *  la regla que no tiene guardian se incumple sola, y hay tres pruebas de esta semana.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const PERMITIDOS = new Set(["0", "px", "1", "2", "3", "4", "6", "8", "auto", "full"]);
const CLASE = /\b(?:gap|gap-x|gap-y|p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|space-x|space-y)-([\w.[\]]+)/g;

function archivos(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? archivos(p) : p.endsWith(".tsx") ? [p] : [];
  });
}

const malos = [];
for (const p of archivos("src")) {
  const texto = readFileSync(p, "utf8");
  texto.split("\n").forEach((linea, i) => {
    for (const m of linea.matchAll(CLASE)) {
      const valor = m[1];
      if (PERMITIDOS.has(valor)) continue;
      // Un valor arbitrario entre corchetes se permite si lleva su porque en la misma linea.
      if (valor.startsWith("[") && linea.includes("//")) continue;
      malos.push(`  ${p}:${i + 1}  ${m[0]}`);
    }
  });
}

if (malos.length === 0) {
  console.log("espacios: todos dentro de la escala de seis pasos.");
  process.exit(0);
}

console.error("\n  Hay espacios fuera de la escala (4, 8, 12, 16, 24, 32 px):\n");
console.error(malos.slice(0, 40).join("\n"));
if (malos.length > 40) console.error(`\n  ...y ${malos.length - 40} mas.`);
console.error("\n  Usa 1, 2, 3, 4, 6 u 8. Un valor arbitrario necesita un comentario que lo explique.\n");
process.exit(1);
```

- [ ] **Paso 4: Correrlo y decidir qué hacer con lo que encuentre**

```bash
cd "C:/Users/Vmagni/Desktop/GRUPO PARIS/GESTORIA" && export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && node scripts/espacios-sanos.mjs; echo "EXIT: $?"
```

**Es esperable que falle**, y con muchos hallazgos: el front actual no siguió esa escala.

**Decisión, y hay que tomarla acá:** el front se rehace entero en el Plan B, así que arreglar
`Listado.tsx` hoy es trabajo que se tira. Entonces el guardián se agrega **sin** conectarlo al
pre-commit todavía, con esta línea en el `package.json`:

```json
    "espacios": "node scripts/espacios-sanos.mjs",
```

y una nota en `docs/ESTADO.md` bajo "Deuda conocida":

```markdown
- **`npm run espacios` está en rojo a propósito.** El front actual no sigue la escala de seis
  pasos. Se conecta al pre-commit al terminar el Plan B, que es cuando el front se rehace. Hasta
  entonces sirve como medida de cuánto falta.
```

- [ ] **Paso 5: Escribir el guardián de color**

Crear `scripts/colores-sanos.mjs`:

```js
#!/usr/bin/env node
/**
 * ============================================================================
 *  NINGUN COLOR ESCRITO A MANO FUERA DE index.css
 * ============================================================================
 *
 *  `src/index.css` es el unico origen de verdad del color. Todo lo demas usa tokens:
 *  text-ink, bg-surface, border-line, text-danger.
 *
 *  POR QUE HACE FALTA UN GUARDIAN AHORA Y NO ANTES: hasta hoy la app era monocroma, y escribir
 *  un color a mano se notaba enseguida. Con la paleta teal de Habitualista entrando en el marco,
 *  un `bg-cyan-700` suelto se va a ver "casi bien" — y eso es peor, porque nadie lo corrige.
 *
 *  Es el mismo mecanismo que tipografia.guard.test.ts: la regla que no tiene guardian se
 *  incumple sola. En el Tablero Contable esa fractura dejo 571 tamanios de letra escritos a mano
 *  en 20 valores distintos.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/** Las familias de color que trae Tailwind y que este proyecto NO usa: usa sus tokens. */
const FAMILIAS = [
  "slate", "gray", "zinc", "neutral", "stone", "red", "orange", "amber", "yellow",
  "lime", "green", "emerald", "teal", "cyan", "sky", "blue", "indigo", "violet",
  "purple", "fuchsia", "pink", "rose",
];

const CLASE_DE_TAILWIND = new RegExp(
  `\b(?:text|bg|border|ring|fill|stroke|from|via|to|shadow|decoration|outline|accent|caret|divide|placeholder)-(?:${FAMILIAS.join("|")})-\d{2,3}\b`,
  "g",
);
/*
  OJO CON EL ESCAPADO. Arriba es un template literal y las barras van DOBLES, porque
  adentro de comillas invertidas una barra-b es un retroceso y barra-d es una d a secas. Aca
  abajo es un
  literal de expresion regular y van simples.

  Es el error mas facil de cometer en este archivo y el sintoma es el peor de todos: el
  guardian corre, no encuentra nada, y parece que esta todo bien.
*/
const COLOR_A_MANO = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(|\boklch\(/g;

function archivos(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return archivos(p);
    return /\.tsx?$/.test(p) ? [p] : [];
  });
}

const malos = [];
for (const p of archivos("src")) {
  // El propio index.css no se revisa, y los tests tampoco: ahi un color literal es el dato.
  if (p.includes(".test.") || p.includes(".guard.")) continue;

  readFileSync(p, "utf8").split("
").forEach((linea, i) => {
    for (const m of linea.matchAll(CLASE_DE_TAILWIND)) {
      malos.push(`  ${p}:${i + 1}  ${m[0]}   -> usa un token: text-ink, bg-surface, text-danger`);
    }
    for (const m of linea.matchAll(COLOR_A_MANO)) {
      malos.push(`  ${p}:${i + 1}  ${m[0]}   -> el color va en src/index.css, no acá`);
    }
  });
}

if (malos.length === 0) {
  console.log("colores: ningun color escrito a mano fuera de index.css.");
  process.exit(0);
}

console.error("
  Hay colores escritos a mano fuera de src/index.css:
");
console.error(malos.slice(0, 40).join("
"));
if (malos.length > 40) console.error(`
  ...y ${malos.length - 40} mas.`);
console.error("
  El color vive en un solo archivo. Si falta un token, agregalo ahi.
");
process.exit(1);
```

- [ ] **Paso 6: Verlo EN ROJO, a propósito**

```bash
cd "C:/Users/Vmagni/Desktop/GRUPO PARIS/GESTORIA" && export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && printf 'export const MAL = "bg-cyan-700 text-red-500";
export const PEOR = "#0E7C8C";
' > src/lib/color-a-proposito.ts && node scripts/colores-sanos.mjs; echo "EXIT: $?"; rm -f src/lib/color-a-proposito.ts
```

Esperado: **`EXIT: 1`** y las tres violaciones nombradas con su archivo y su línea. Si sale en
verde, el guardián no mira lo que dice mirar.

- [ ] **Paso 7: Verlo en verde sobre el código real**

```bash
cd "C:/Users/Vmagni/Desktop/GRUPO PARIS/GESTORIA" && export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && node scripts/colores-sanos.mjs; echo "EXIT: $?"
```

Esperado: **`EXIT: 0`**. Hoy la app es monocroma y usa tokens, así que tiene que pasar. Si
encuentra algo, es un color escrito a mano que ya estaba y hay que sacarlo.

**Éste sí se conecta al pre-commit**, a diferencia del de espacios: está en verde desde el primer
día, y esa es exactamente la condición para que un guardián sirva.

- [ ] **Paso 8: Agregar los scripts y conectar al pre-commit los dos que están en verde**

En `package.json`:

```json
    "indices": "node scripts/indices-sanos.mjs",
    "espacios": "node scripts/espacios-sanos.mjs",
    "colores": "node scripts/colores-sanos.mjs",
```

En `.githooks/pre-commit`, después de la línea de `migraciones-sanas.mjs`:

```sh
node scripts/indices-sanos.mjs || exit 1
node scripts/colores-sanos.mjs || exit 1
```

- [ ] **Paso 9: Commit**

```bash
git add scripts/indices-sanos.mjs scripts/espacios-sanos.mjs scripts/colores-sanos.mjs package.json .githooks/pre-commit docs/ESTADO.md && git commit -m "Dos guardianes: los indices que olvidan lo anulado y los espacios fuera de escala"
```

---

# PARTE 2 — LA BASE

## Tarea 6: El saldo inicial se puede recargar, y una anulación no se anula

**Archivos:**
- Crear: `supabase/migrations/<generado>_saldo_inicial_recargable.sql`

**Interfaces:**
- Consume: `public.movimientos`, `public.anular_movimiento(bigint, text)`.
- Produce: el índice `movimientos_un_saldo_inicial` en su forma parcial correcta, y
  `anular_movimiento` con una comprobación más.

**El defecto, medido el 26/08/2026:**

```
SALDO INICIAL POR TARJETA
  Paris Autos SA   2.505.627,92  ANULADO
  Paris Cars       5.000.000,00  ANULADO
```

Las dos tarjetas están **sin poder recargar su saldo de arranque**. Es lo primero de todo el plan.

- [ ] **Paso 1: Crear la migración**

```bash
cd "C:/Users/Vmagni/Desktop/GRUPO PARIS/GESTORIA" && export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && npx supabase migration new saldo_inicial_recargable 2>&1 | tail -1
```

**Anotá el nombre que imprime.** No sigas sin verlo.

- [ ] **Paso 2: Escribirla**

Escribir con la herramienta de escritura de archivos, **no con un heredoc**: los acentos y los
backticks se rompen al pasar por el shell.

```sql
-- ============================================================================
--  EL SALDO INICIAL SE PUEDE VOLVER A CARGAR DESPUES DE ANULARLO
-- ============================================================================
--
--  ============================================================================
--   EL DEFECTO, Y ES BLOQUEANTE
--  ============================================================================
--
--  Medido el 26/08/2026 contra la base:
--
--      Paris Autos SA   2.505.627,92  ANULADO
--      Paris Cars       5.000.000,00  ANULADO
--
--  Las dos tarjetas estan sin poder recargar su saldo de arranque. Al intentarlo, la base
--  responde que el dato ya fue ingresado.
--
--  La causa: `movimientos_un_saldo_inicial` es un indice unico parcial sobre
--  `where tipo = 'saldo_inicial'`, y NO excluye los anulados. El anulado sigue ocupando el
--  lugar, aunque su plata ya se compenso a cero.
--
--  ============================================================================
--   ES LA TERCERA VEZ QUE APARECE ESTA FORMA
--  ============================================================================
--
--  La primera fue `tramite_conceptos_uno_por_momento`, arreglada el 21/08/2026 con exactamente
--  este mismo cambio y con el porque escrito al lado. No se generalizo, y cinco dias despues
--  volvio a morder en otro lado.
--
--  Por eso ademas de arreglar este indice, esta tanda trae un guardian —`npm run indices`— que
--  falla si aparece cualquier indice unico parcial que se olvide de excluir lo anulado. La
--  regla que no tiene guardian se incumple sola.
--
--  ============================================================================
--   Y DE PASO SE CIERRA UN AGUJERO QUE SE ABRIO EL 21/08/2026
--  ============================================================================
--
--  `anular_movimiento` acepta como objetivo cualquier `ajuste`. Pero la compensacion que ella
--  misma escribe ES un ajuste. O sea que se podia anular la anulacion.
--
--  El resultado seria un saldo contable que vuelve a subir mientras `en_transito` sigue
--  excluyendo el original —porque hay una correccion apuntandolo— y la pantalla mostrando el
--  movimiento TACHADO con la plata de vuelta adentro. La pantalla diciendo una cosa y el saldo
--  otra es exactamente lo que este proyecto no puede permitirse.
--
--  Se cierra con una condicion: no se anula lo que ya es una anulacion.
--
--  ES ADITIVA: no toca ninguna fila.
-- ============================================================================

-- ------------------------------------------------------------
-- 1) El indice pasa a excluir lo anulado
-- ------------------------------------------------------------

-- ------------------------------------------------------------
-- 1) El indice pasa a excluir lo anulado
--
--    LA FORMA OBVIA NO COMPILA, y conviene saberlo antes de intentarla:
--
--        create unique index ... where tipo = 'saldo_inicial'
--          and not exists (select 1 from movimientos c where c.corrige_movimiento_id = id);
--
--    UN INDICE NO PUEDE MIRAR OTRAS FILAS. Su predicado tiene que ser inmutable y depender solo
--    de la fila que se indexa; una subconsulta no lo es, y Postgres lo rechaza al crearlo.
--
--    Entonces la columna guarda el dato en la propia fila: `anulado` se marca cuando alguien la
--    anula, y el indice mira esa columna. Es redundante con `corrige_movimiento_id` de la otra
--    fila, y esa redundancia es el precio de que el indice pueda existir. La escribe el mismo
--    trigger que crea la compensacion, asi que no puede quedar desincronizada.
-- ------------------------------------------------------------

alter table public.movimientos
  add column if not exists anulado boolean not null default false;

comment on column public.movimientos.anulado is
  'Si este movimiento fue compensado por un ajuste. Es redundante con corrige_movimiento_id de '
  'la fila que lo anula, y la redundancia es a proposito: un indice unico parcial no puede mirar '
  'otras filas, y sin esta columna no se puede impedir dos saldos iniciales vivos por tarjeta.';

-- Se pone al dia lo que ya estaba anulado antes de que existiera la columna.
update public.movimientos m
   set anulado = true
 where not m.anulado
   and exists (select 1 from public.movimientos c where c.corrige_movimiento_id = m.id);

drop index if exists public.movimientos_un_saldo_inicial;
create unique index if not exists movimientos_un_saldo_inicial
  on public.movimientos (tarjeta_id)
  where tipo = 'saldo_inicial' and not anulado;

-- ------------------------------------------------------------
-- 2) La funcion marca la columna, y no deja anular una anulacion
-- ------------------------------------------------------------

create or replace function public.anular_movimiento(p_id bigint, p_motivo text)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  m       public.movimientos;
  v_nuevo bigint;
begin
  if not public.es_oficina() then
    raise exception 'regla_tramite: Solo gerencia y administracion contable pueden anular un movimiento';
  end if;

  if nullif(btrim(coalesce(p_motivo, '')), '') is null then
    raise exception 'regla_tramite: Escribi por que se anula. Un movimiento sin motivo no se puede explicar despues.';
  end if;

  select * into m from public.movimientos where id = p_id;
  if not found then
    raise exception 'regla_tramite: Ese movimiento no existe';
  end if;

  if m.tipo not in ('ingreso','saldo_inicial','ajuste') then
    raise exception 'regla_tramite: Ese movimiento lo genero un tramite. Se corrige cambiando el presupuesto del tramite, no desde la cuenta.';
  end if;

  /*
    NO SE ANULA UNA ANULACION, y esto cierra un agujero del 21/08/2026.

    La compensacion que esta misma funcion escribe es de tipo `ajuste`, asi que pasaba el filtro
    de arriba. Anularla habria devuelto la plata al saldo contable mientras el original seguia
    marcado como anulado en la pantalla: la cuenta diciendo una cosa y la pantalla otra.

    Si hay que revertir una anulacion, se carga el movimiento de nuevo. Queda mas largo en el
    extracto y queda explicable, que es lo que importa.
  */
  if m.corrige_movimiento_id is not null then
    raise exception 'regla_tramite: Ese movimiento ES la anulacion de otro. Si hay que revertirla, carga el movimiento de nuevo.';
  end if;

  if m.anulado then
    raise exception 'regla_tramite: Ese movimiento ya estaba anulado';
  end if;

  insert into public.movimientos
    (tarjeta_id, tipo, importe, fecha, fecha_acreditacion, concepto, observacion,
     corrige_movimiento_id, origen, creado_por)
  values (m.tarjeta_id, 'ajuste', -m.importe, now(), m.fecha_acreditacion,
          'Anulación de ' || coalesce(m.concepto, m.tipo),
          btrim(p_motivo), p_id, 'app', auth.uid())
  returning id into v_nuevo;

  -- Se marca acá, en la misma transacción que la compensación: si una falla, no queda ninguna.
  update public.movimientos set anulado = true where id = p_id;

  return v_nuevo;
end;
$$;

revoke all on function public.anular_movimiento(bigint, text) from public, anon;
grant execute on function public.anular_movimiento(bigint, text) to authenticated;

-- ------------------------------------------------------------
-- 3) La vista usa la columna, que es mas barata que el `not exists`
-- ------------------------------------------------------------

create or replace view public.v_saldos with (security_invoker = true) as
select th.id as tarjeta_id,
       th.nombre,
       coalesce(sum(m.importe) filter (
         where m.tipo in ('saldo_inicial','ingreso','pago','ajuste')
           and m.fecha_acreditacion <= current_date), 0) as contable,
       coalesce(sum(m.importe) filter (
         where m.tipo = 'ingreso' and m.fecha_acreditacion > current_date
           and not m.anulado), 0) as en_transito,
       coalesce(-sum(m.importe) filter (
         where m.tipo in ('reserva','ajuste_reserva','reversa_reserva')), 0) as comprometido,
       th.orden
  from public.tarjetas_habitualista th
  left join public.movimientos m on m.tarjeta_id = th.id
 group by th.id, th.nombre, th.orden;

comment on view public.v_saldos is
  'contable tiene que dar IGUAL al saldo del sitio de Habitualista. en_transito no cuenta los '
  'depositos anulados. La cuarta cifra de la pantalla, contable - comprometido, es lo que hoy no '
  'se ve, y es por lo que dos personas comprometen la misma plata.';

revoke insert, update, delete, truncate on public.v_saldos from anon, authenticated;
grant select on public.v_saldos to authenticated;

-- ============================================================================
--  COMO COMPROBAR QUE QUEDO BIEN
--
--  1) Los anulados de antes quedaron marcados:
--       select tipo, importe, anulado from public.movimientos where tipo = 'saldo_inicial';
--     Esperado: los dos con anulado = true.
--
--  2) Y AHORA SI SE PUEDE CARGAR UNO NUEVO — es el defecto que esta migracion arregla:
--       insert into public.movimientos (tarjeta_id, tipo, importe, concepto)
--       values ((select id from public.tarjetas_habitualista where nombre = 'Paris Autos SA'),
--               'saldo_inicial', 9435000, 'Saldo inicial del corte');
--     Esperado: ENTRA. Antes de esta migracion daba error de clave duplicada.
--
--  3) Pero DOS vivos no. Repetir el insert de arriba: TIENE QUE FALLAR con clave duplicada.
--
--  4) Anular una anulacion NO se puede:
--       select public.anular_movimiento(
--         (select id from public.movimientos where corrige_movimiento_id is not null limit 1),
--         'probando');
--     Esperado: 'Ese movimiento ES la anulacion de otro'.
--
--  5) `npm run indices` en verde. Antes de esta migracion daba 1.
-- ============================================================================
```

- [ ] **Paso 3: Aplicar**

```bash
cd "C:/Users/Vmagni/Desktop/GRUPO PARIS/GESTORIA" && export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && export SUPABASE_ACCESS_TOKEN="$(grep '^SUPABASE_ACCESS_TOKEN=' .env.local | cut -d= -f2-)" && npm run migraciones > /tmp/m.log 2>&1; echo "MIGRACIONES: $?" && npm run db:push > /tmp/p.log 2>&1; echo "PUSH: $?"; tail -8 /tmp/p.log
```

Esperado: los dos en 0.

- [ ] **Paso 4: Correr las cinco comprobaciones**

Las cinco del bloque, con SQL real contra la base. **La 3 y la 4 tienen que salir en rojo.**

- [ ] **Paso 5: El guardián de índices, ahora en verde**

```bash
cd "C:/Users/Vmagni/Desktop/GRUPO PARIS/GESTORIA" && export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && export SUPABASE_ACCESS_TOKEN="$(grep '^SUPABASE_ACCESS_TOKEN=' .env.local | cut -d= -f2-)" && npm run indices; echo "EXIT: $?"
```

Esperado: **`EXIT: 0`**. En la tarea 5 daba 1. Ese cambio de 1 a 0 es la prueba de que el
guardián mira lo que dice mirar.

- [ ] **Paso 6: Regenerar los tipos y commitear**

```bash
cd "C:/Users/Vmagni/Desktop/GRUPO PARIS/GESTORIA" && export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && export SUPABASE_ACCESS_TOKEN="$(grep '^SUPABASE_ACCESS_TOKEN=' .env.local | cut -d= -f2-)" && npm run db:tipos > /tmp/t.log 2>&1; echo "TIPOS: $?"; grep -c "anulado" src/lib/database.types.ts && npx tsc -b > /tmp/a.log 2>&1; echo "TSC: $?"; head -5 /tmp/a.log
```

```bash
git add -A && git commit -m "El saldo inicial se puede recargar, y una anulacion ya no se anula"
```

---

## Tarea 7: La cadena de seis estados

**Archivos:**
- Crear: `supabase/migrations/<generado>_cadena_de_seis_estados.sql`

**Interfaces:**
- Consume: `public.c_tramites_transicion()`, `public.orden_estado(text)`,
  `public.e_tramites_cuenta_corriente()`.
- Produce: la máquina de estados con `recibido, controlado, entregado, presupuestado, resuelto,
  devuelto, anulado`, y la columna `tramites.resuelto_at`.

**LO MÁS PELIGROSO DEL PLAN ESTÁ ACÁ.** La reserva se libera cuando el trámite pasa a `pagado`, y
ese estado desaparece. Si el trigger de la cuenta corriente no se actualiza en esta misma
migración, la reserva no se libera nunca y la plata queda comprometida para siempre, **sin ningún
error**.

- [ ] **Paso 1: Crear la migración y agregar el estado y la columna**

```bash
cd "C:/Users/Vmagni/Desktop/GRUPO PARIS/GESTORIA" && export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && npx supabase migration new cadena_de_seis_estados 2>&1 | tail -1
```

Escribir, **en este orden exacto**:

```sql
-- ============================================================================
--  LA CADENA BAJA DE DIEZ ESTADOS A SEIS
-- ============================================================================
--
--  ============================================================================
--   POR QUE SE FUNDEN TRES ESTADOS EN UNO
--  ============================================================================
--
--  `presentado`, `pagado` y `retirado` eran tres botones para UN SOLO VIAJE al registro. Lo
--  dicto quien lo hace, textual: "todo en el mismo momento: presenta, se paga y se retira".
--
--  Tenerlos separados obligaba a la gestora a abrir la app tres veces para registrar algo que
--  paso una vez, y ninguna de esas tres aperturas le decia nada nuevo a la oficina.
--
--  ============================================================================
--   POR QUE DESAPARECE `frenado_por_saldo`
--  ============================================================================
--
--  No es un estado del tramite: es una condicion de la tarjeta. El tramite esta presupuestado y
--  correcto; lo que falta es que la tarjeta tenga con que.
--
--  Modelarlo como estado obligaba a alguien a marcarlo Y A DESMARCARLO a mano, y ese alguien se
--  olvidaba. Ahora se deduce, en la vista `v_esperando_plata` de la migracion siguiente: si
--  entra plata, el tramite deja de estar esperando solo.
--
--  ============================================================================
--   EL PELIGRO DE ESTA MIGRACION, ESCRITO PARA QUE NO SE PASE POR ALTO
--  ============================================================================
--
--  `e_tramites_cuenta_corriente` libera la reserva cuando el estado pasa a `pagado`. Si ese
--  trigger no se actualiza acá, la reserva NO SE LIBERA NUNCA y la plata queda comprometida para
--  siempre en la tarjeta. No hay error, no hay aviso: el numero simplemente no baja.
--
--  Por eso el trigger se reescribe en esta misma migracion, y el bloque de comprobacion recorre
--  el circuito completo con numeros escritos de antemano.
--
--  ES ADITIVA EN DATOS: los tramites que estan en los estados viejos se convierten en la
--  migracion SIGUIENTE, a proposito. Acá el `check` todavia acepta los diez.

-- ------------------------------------------------------------
-- 1) El sello del paso nuevo
-- ------------------------------------------------------------

alter table public.tramites add column if not exists resuelto_at timestamptz;

comment on column public.tramites.resuelto_at is
  'Cuando se resolvio en el registro: presento, pago y retiro, en un viaje. Reemplaza a los tres '
  'sellos presentado_at, pagado_at y retirado_at, que se conservan como historia de cuando la '
  'cadena tenia diez estados.';

-- ------------------------------------------------------------
-- 2) El orden nuevo. `resuelto` ocupa el lugar que tenian los tres.
--
--    ESTA FUNCION DECIDE SI UN CAMBIO VA PARA ATRAS, y solo gerencia puede ir para atras. Si
--    quedara con los estados viejos devolveria null para `resuelto`, la comparacion se volveria
--    indefinida y la regla dejaria de aplicarse sin que nadie lo note.
--
--    Los tres estados viejos siguen mapeados mientras exista un tramite en ellos. Se sacan
--    cuando el `check` se apriete, en la migracion siguiente.
-- ------------------------------------------------------------

create or replace function public.orden_estado(p text)
returns int language sql immutable as $$
  select case p
    when 'recibido' then 1
    when 'controlado' then 2
    when 'entregado' then 3
    when 'presupuestado' then 4
    when 'frenado_por_saldo' then 4
    when 'resuelto' then 5
    when 'presentado' then 5
    when 'pagado' then 5
    when 'retirado' then 5
    when 'devuelto' then 6
    when 'anulado' then 99 end;
$$;

-- ------------------------------------------------------------
-- 3) El check acepta el estado nuevo. Todavia acepta los viejos.
-- ------------------------------------------------------------

alter table public.tramites drop constraint if exists tramites_estado_valido;
alter table public.tramites add constraint tramites_estado_valido check (estado = any (array[
  'recibido','controlado','entregado','presupuestado','resuelto','devuelto','anulado',
  'frenado_por_saldo','presentado','pagado','retirado'
]));

-- ------------------------------------------------------------
-- 4) La maquina de estados
--
--    Se reescribe ENTERA porque `create or replace function` reemplaza todo el cuerpo. Media
--    funcion pegada es como se pierde una validacion sin que nadie lo note.
-- ------------------------------------------------------------

create or replace function public.c_tramites_transicion()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare
  rol                text := coalesce(public.mi_rol(), 'consola');
  ok                 boolean := false;
  sin_contestar      int;
  total_real         numeric(14,2);
  lineas_presupuesto int;
begin
  if tg_op = 'INSERT' then
    if new.estado <> 'recibido' and new.origen = 'app' then
      raise exception 'regla_tramite: Un tramite nuevo entra en estado recibido';
    end if;
    new.autorizado_por := coalesce(new.autorizado_por, auth.uid());
    new.creado_por     := coalesce(new.creado_por, auth.uid());
    return new;
  end if;

  if new.estado is not distinct from old.estado then return new; end if;
  if rol = 'consola' then return new; end if;

  if new.estado = 'anulado' then
    if old.estado = 'devuelto' then
      raise exception 'regla_tramite: Un tramite ya devuelto no se anula. Corregilo con un ajuste.';
    end if;
    ok := rol in ('gerencia','contable');
  elsif public.orden_estado(new.estado) < public.orden_estado(old.estado) then
    ok := (rol = 'gerencia');
  else
    ok := case old.estado || '>' || new.estado
      when 'recibido>controlado'     then rol in ('contable','gerencia')
      when 'controlado>entregado'    then rol in ('contable','gerencia')
      when 'entregado>presupuestado' then rol in ('gestora','contable','gerencia')
      when 'presupuestado>resuelto'  then rol in ('gestora','contable','gerencia')
      when 'resuelto>devuelto'       then rol in ('gestora','contable','gerencia')
      else false
    end;
  end if;

  if not ok then
    raise exception 'regla_tramite: No se puede pasar de % a % con el rol %', old.estado, new.estado, rol;
  end if;

  if new.estado = 'controlado' then
    select count(*) into sin_contestar
      from public.requisitos r
     where r.activo and (r.aplica_a = new.tipo or r.aplica_a = 'todos')
       and not exists (select 1 from public.tramite_requisitos tr
                        where tr.tramite_id = new.id and tr.requisito_id = r.id);
    if sin_contestar > 0 then
      raise exception 'regla_tramite: Faltan % requisitos del legajo por contestar', sin_contestar;
    end if;
    new.controlado_at := coalesce(new.controlado_at, now());
  end if;

  if new.estado = 'entregado' then
    if new.gestora_id is null then
      raise exception 'regla_tramite: Para entregar el tramite hace falta elegir la gestora';
    end if;
    new.entregado_at := coalesce(new.entregado_at, now());
  end if;

  if new.estado = 'presupuestado' then
    select count(*) into lineas_presupuesto
      from public.tramite_conceptos
     where tramite_id = new.id and momento = 'presupuesto' and not anulada;
    if lineas_presupuesto = 0 then
      raise exception 'regla_tramite: Falta cargar el presupuesto: al menos un concepto con su importe';
    end if;
    new.presupuestado_at := coalesce(new.presupuestado_at, now());
  end if;

  /*
    EL PASO NUEVO. Pide de una vez lo que ese momento produce, porque es UN viaje:
    donde se presento, cuanto salio de verdad, y que documentacion se retiro.
  */
  if new.estado = 'resuelto' then
    if nullif(btrim(coalesce(new.seccional,'')),'') is null then
      raise exception 'regla_tramite: Falta indicar en que seccional se presento';
    end if;

    if new.medio_pago = 'tarjeta_habitualista'
       and not exists (select 1 from public.razones_sociales r
                        where r.id = new.razon_social_id and r.tarjeta_id is not null) then
      raise exception 'regla_tramite: Esa razon social todavia no tiene Tarjeta Habitualista asignada';
    end if;

    select coalesce(sum(importe),0) into total_real
      from public.tramite_conceptos
     where tramite_id = new.id and momento = 'real' and not anulada;
    if total_real <= 0 then
      raise exception 'regla_tramite: Falta cargar lo que salio de verdad, discriminado por concepto';
    end if;

    if nullif(btrim(coalesce(new.documentacion_retirada,'')),'') is null then
      raise exception 'regla_tramite: Anota que documentacion retiraste: titulo, cedula, chapas';
    end if;

    new.resuelto_at   := coalesce(new.resuelto_at, now());
    -- Los sellos viejos se completan igual, para que lo que ya existe siga leyendose.
    new.presentado_at := coalesce(new.presentado_at, now());
    new.pagado_at     := coalesce(new.pagado_at, now());
    new.retirado_at   := coalesce(new.retirado_at, now());
  end if;

  if new.estado = 'devuelto' then
    new.devuelto_at := coalesce(new.devuelto_at, now());
  end if;

  return new;
end;
$fn$;
```

- [ ] **Paso 2: Reescribir el trigger de la cuenta corriente, en la MISMA migración**

Seguir en el mismo archivo:

```sql
-- ------------------------------------------------------------
-- 5) LA PARTE PELIGROSA: la reserva se libera en `resuelto`
--
--    Se reescribe la funcion entera. El unico cambio de conducta es que la rama que liberaba la
--    reserva y descontaba el costo real deja de mirar `pagado` y mira `resuelto`. Si esto no se
--    hiciera, la reserva no se liberaria NUNCA y la plata quedaria comprometida para siempre.
-- ------------------------------------------------------------

create or replace function public.e_tramites_cuenta_corriente()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_reservado numeric(14,2);
  v_real      numeric(14,2);
begin
  if new.medio_pago <> 'tarjeta_habitualista' then return new; end if;
  if new.tarjeta_id is null then return new; end if;

  if tg_op = 'INSERT' then
    if new.origen = 'preexistente'
       and coalesce(new.deposito_solicitado,0) > 0 then
      insert into public.movimientos
        (tarjeta_id, tipo, importe, tramite_id, gestora_id, concepto, origen, creado_por)
      values (new.tarjeta_id, 'reserva', -new.deposito_solicitado, new.id, new.gestora_id,
              'Presupuesto - ' || new.cliente_nombre, 'tramite', auth.uid());
    end if;
    return new;
  end if;

  if new.origen <> 'app' then return new; end if;

  -- La primera vez que hay presupuesto: se reserva.
  if coalesce(old.deposito_solicitado,0) = 0 and coalesce(new.deposito_solicitado,0) > 0 then
    insert into public.movimientos
      (tarjeta_id, tipo, importe, tramite_id, gestora_id, concepto, origen, creado_por)
    values (new.tarjeta_id, 'reserva', -new.deposito_solicitado, new.id, new.gestora_id,
            'Presupuesto - ' || new.cliente_nombre, 'tramite', auth.uid());

  -- Si cambia: un ajuste POR LA DIFERENCIA. La reserva original nunca se toca, porque editarla
  -- haria que el saldo de ayer deje de ser reconstruible.
  elsif coalesce(old.deposito_solicitado,0) > 0
        and coalesce(new.deposito_solicitado,0) > 0
        and new.deposito_solicitado is distinct from old.deposito_solicitado then
    insert into public.movimientos
      (tarjeta_id, tipo, importe, tramite_id, gestora_id, concepto, origen, creado_por)
    values (new.tarjeta_id, 'ajuste_reserva',
            -(new.deposito_solicitado - old.deposito_solicitado),
            new.id, new.gestora_id, 'Correccion del presupuesto', 'tramite', auth.uid());
  end if;

  -- ============================================================================
  --  AL RESOLVERSE: se libera la reserva entera y se descuenta lo que de verdad salio.
  --
  --  ANTES ESTO MIRABA `pagado`. Cambia acá con la cadena de seis estados, y es el punto mas
  --  delicado de toda la migracion: si mirara un estado que ya no existe, la reserva no se
  --  liberaria nunca y no habria ningun error que lo dijera.
  -- ============================================================================
  if new.estado = 'resuelto' and old.estado is distinct from 'resuelto' then
    select coalesce(sum(-importe), 0) into v_reservado
      from public.movimientos
     where tramite_id = new.id and tipo in ('reserva','ajuste_reserva');

    if v_reservado <> 0 then
      insert into public.movimientos
        (tarjeta_id, tipo, importe, tramite_id, gestora_id, concepto, origen, creado_por)
      values (new.tarjeta_id, 'reversa_reserva', v_reservado, new.id, new.gestora_id,
              'Libera la reserva', 'tramite', auth.uid());
    end if;

    select coalesce(sum(importe),0) into v_real
      from public.tramite_conceptos
     where tramite_id = new.id and momento = 'real' and not anulada;

    if v_real > 0 then
      insert into public.movimientos
        (tarjeta_id, tipo, importe, tramite_id, gestora_id, concepto, origen, creado_por)
      values (new.tarjeta_id, 'pago', -v_real, new.id, new.gestora_id,
              'Pago en el registro', 'tramite', auth.uid());
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function public.e_tramites_cuenta_corriente() from public, anon, authenticated;

-- ============================================================================
--  COMO COMPROBAR QUE QUEDO BIEN
--
--  EL CIRCUITO ENTERO, con los numeros escritos de antemano. No alcanza con que el push termine.
--
--  Elegi un tramite en `entregado` con tarjeta y gestora, y anota el comprometido de su tarjeta.
--
--  1) Cargar el presupuesto:
--       insert into public.tramite_conceptos (tramite_id, concepto_id, momento, importe)
--       values ('<id>', (select id from public.conceptos where nombre='Arancel'), 'presupuesto', 500000);
--       update public.tramites set estado = 'presupuestado' where id = '<id>';
--     Esperado: comprometido subio 500000 y hay un movimiento `reserva` de -500000.
--
--  2) Cargar el costo real, la seccional y la documentacion, y resolver:
--       insert into public.tramite_conceptos (tramite_id, concepto_id, momento, importe)
--       values ('<id>', (select id from public.conceptos where nombre='Arancel'), 'real', 487300);
--       update public.tramites
--          set estado = 'resuelto', seccional = '19005 - Marconi 29',
--              documentacion_retirada = 'Titulo, cedula y chapas'
--        where id = '<id>';
--
--  3) LA COMPROBACION QUE IMPORTA — la reserva se libero y se descontó lo real:
--       select tipo, importe from public.movimientos where tramite_id = '<id>' order by id;
--     Esperado, en este orden:
--       reserva          -500000.00
--       reversa_reserva   500000.00
--       pago             -487300.00
--
--       select comprometido from public.v_saldos where tarjeta_id = '<la tarjeta>';
--     Esperado: EXACTAMENTE el mismo que antes del paso 1. Si quedo en 500000, la reserva no se
--     libero y ESTA MIGRACION ESTA MAL.
--
--  4) Resolver sin costo real NO se puede. Con otro tramite presupuestado, TIENE QUE FALLAR:
--       update public.tramites set estado='resuelto', seccional='x', documentacion_retirada='y'
--        where id = '<otro>';
--     Esperado: 'Falta cargar lo que salio de verdad'.
--
--  5) Y saltearse un paso tampoco. TIENE QUE FALLAR:
--       update public.tramites set estado = 'resuelto' where id = '<uno en recibido>';
--     Esperado: 'No se puede pasar de recibido a resuelto'.
-- ============================================================================
```

- [ ] **Paso 3: Aplicar**

```bash
cd "C:/Users/Vmagni/Desktop/GRUPO PARIS/GESTORIA" && export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && export SUPABASE_ACCESS_TOKEN="$(grep '^SUPABASE_ACCESS_TOKEN=' .env.local | cut -d= -f2-)" && npm run migraciones > /tmp/m.log 2>&1; echo "MIGRACIONES: $?" && npm run db:push > /tmp/p.log 2>&1; echo "PUSH: $?"; tail -8 /tmp/p.log
```

- [ ] **Paso 4: Correr las cinco comprobaciones, y no seguir sin la 3**

**La comprobación 3 es la que decide si esta migración está bien.** Si el comprometido no vuelve
exactamente a donde estaba, parar y arreglar antes de seguir.

- [ ] **Paso 5: Commit**

```bash
git add supabase/migrations/ && git commit -m "La cadena baja a seis estados, y la reserva se libera al resolverse"
```

---

## Tarea 8: Convertir los dos trámites viejos y cerrar el check

**Archivos:**
- Crear: `supabase/migrations/<generado>_convertir_los_estados_viejos.sql`

**Interfaces:**
- Consume: la máquina de estados de la tarea 7.
- Produce: `tramites_estado_valido` aceptando **sólo** los siete estados de la cadena nueva.

**Medido el 26/08/2026:** hay **1 trámite en `presentado`** y **1 en `retirado`**. Ninguno en
`pagado` ni en `frenado_por_saldo`. Son dos filas.

**El orden importa y no se puede invertir:** primero se convierten los datos, después se aprieta
el `check`. Al revés, el `alter table` falla porque hay filas que lo violan.

- [ ] **Paso 1: Contar antes, para poder comparar después**

```bash
cd "C:/Users/Vmagni/Desktop/GRUPO PARIS/GESTORIA" && export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && export SUPABASE_ACCESS_TOKEN="$(grep '^SUPABASE_ACCESS_TOKEN=' .env.local | cut -d= -f2-)" && node -e '
const t=require("fs").readFileSync(".env.local","utf8").split("\n").find(l=>l.startsWith("SUPABASE_ACCESS_TOKEN=")).split("=")[1];
fetch("https://api.supabase.com/v1/projects/drsooohkwwpnijonxwwt/database/query",{method:"POST",headers:{Authorization:`Bearer ${t}`,"Content-Type":"application/json"},body:JSON.stringify({query:"select estado, count(*) as n from public.tramites group by estado order by estado"})}).then(r=>r.json()).then(d=>console.table(d));'
```

**Anotá el total.** Después de la conversión tiene que ser el mismo número de trámites.

- [ ] **Paso 2: Escribir la migración**

```sql
-- ============================================================================
--  LOS TRAMITES QUE ESTABAN EN LOS ESTADOS QUE SE FUNDIERON
-- ============================================================================
--
--  Medido el 26/08/2026, antes de escribir esto:
--
--      presentado   1
--      retirado     1
--      pagado       0
--      frenado_por_saldo  0
--
--  Dos filas. Es barato, y por eso es el momento de hacerlo: con datos reales adentro esta
--  conversion seria una decision mucho mas cara.
--
--  ============================================================================
--   EL ORDEN NO SE PUEDE INVERTIR
--  ============================================================================
--
--  Primero se convierten los datos y DESPUES se aprieta el check. Al reves, el `alter table`
--  falla porque hay filas que lo violan, y el mensaje habla del constraint y no de las filas.
--
--  ============================================================================
--   POR QUE `presentado` TAMBIEN PASA A `resuelto`
--  ============================================================================
--
--  Un tramite presentado, en la cadena vieja, ya habia ido al registro. En la cadena nueva ese
--  viaje es un solo paso. Dejarlo en `presupuestado` seria decir que todavia no fue, y eso lo
--  volveria a mostrar como "esperando plata" a una gestora que ya lo resolvio.
--
--  La conversion corre sin sesion, asi que `mi_rol()` da 'consola' y la maquina de estados la
--  deja pasar sin validar la transicion. Es correcto: no es una persona avanzando un tramite,
--  es un arrastre de datos.
--
--  Y NO DISPARA MOVIMIENTOS DE PLATA: el trigger de la cuenta corriente mira que el estado pase
--  a `resuelto` VINIENDO de otro, y `presentado` no estaba en la cadena vieja como pagado, asi
--  que no habia reserva liberada. Se comprueba en el bloque de abajo.

-- ------------------------------------------------------------
-- 1) Los datos
-- ------------------------------------------------------------

update public.tramites
   set estado = 'resuelto',
       resuelto_at = coalesce(resuelto_at, retirado_at, pagado_at, presentado_at, now())
 where estado in ('presentado','pagado','retirado');

-- Un tramite frenado por saldo estaba, en realidad, presupuestado esperando plata. Ahora eso se
-- deduce de la tarjeta y no se marca. El motivo escrito se conserva: es historia.
update public.tramites
   set estado = 'presupuestado'
 where estado = 'frenado_por_saldo';

-- ------------------------------------------------------------
-- 2) Y recien ahora el check se aprieta
-- ------------------------------------------------------------

alter table public.tramites drop constraint if exists tramites_estado_valido;
alter table public.tramites add constraint tramites_estado_valido check (estado = any (array[
  'recibido','controlado','entregado','presupuestado','resuelto','devuelto','anulado'
]));

-- ------------------------------------------------------------
-- 3) `orden_estado` se queda con los siete
-- ------------------------------------------------------------

create or replace function public.orden_estado(p text)
returns int language sql immutable as $$
  select case p
    when 'recibido' then 1
    when 'controlado' then 2
    when 'entregado' then 3
    when 'presupuestado' then 4
    when 'resuelto' then 5
    when 'devuelto' then 6
    when 'anulado' then 99 end;
$$;

-- ------------------------------------------------------------
-- 4) El check del motivo de frenado ya no tiene estado que vigilar
--
--    La columna `motivo_frenado` NO se borra: aca nada se borra, y lo que se escribio explica
--    por que un tramite estuvo detenido.
-- ------------------------------------------------------------

alter table public.tramites drop constraint if exists tramites_frenado_con_motivo;

comment on column public.tramites.motivo_frenado is
  'Historia: por que un tramite estuvo frenado cuando `frenado_por_saldo` era un estado. Desde el '
  '26/08/2026 esperar plata se deduce de la tarjeta y no se marca, asi que esta columna ya no se '
  'escribe. No se borra: lo que dice sigue explicando algo que paso.';

-- ============================================================================
--  COMO COMPROBAR QUE QUEDO BIEN
--
--  1) No quedo ningun tramite en un estado viejo. Tiene que dar CERO filas:
--       select estado, count(*) from public.tramites
--        where estado in ('presentado','pagado','retirado','frenado_por_saldo')
--        group by estado;
--
--  2) Y el total de tramites es el MISMO que antes de la migracion:
--       select count(*) from public.tramites;
--
--  3) Un estado viejo ya no entra. TIENE QUE FALLAR:
--       update public.tramites set estado = 'pagado'
--        where id = (select id from public.tramites limit 1);
--     Esperado: viola tramites_estado_valido.
--
--  4) La conversion NO movio plata:
--       select nombre, contable, comprometido from public.v_saldos order by orden;
--     Esperado: identico a lo anotado antes de esta migracion.
--
--  5) Los sellos viejos se conservan:
--       select cliente_nombre, presentado_at, retirado_at, resuelto_at from public.tramites
--        where resuelto_at is not null;
--     Esperado: los que ya tenian presentado_at o retirado_at los conservan.
-- ============================================================================
```

- [ ] **Paso 3: Aplicar y correr las cinco comprobaciones**

```bash
cd "C:/Users/Vmagni/Desktop/GRUPO PARIS/GESTORIA" && export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && export SUPABASE_ACCESS_TOKEN="$(grep '^SUPABASE_ACCESS_TOKEN=' .env.local | cut -d= -f2-)" && npm run migraciones > /tmp/m.log 2>&1; echo "MIGRACIONES: $?" && npm run db:push > /tmp/p.log 2>&1; echo "PUSH: $?"; tail -8 /tmp/p.log
```

La **4** es la que importa: si los saldos se movieron, la conversión disparó movimientos que no
debía y hay que revisarla.

- [ ] **Paso 4: Commit**

```bash
git add supabase/migrations/ && git commit -m "Los dos tramites viejos convertidos, y el check con los siete estados"
```

---

## Tarea 9: La vista de "esperando plata"

**Archivos:**
- Crear: `supabase/migrations/<generado>_esperando_plata.sql`

**Interfaces:**
- Consume: `public.tramites`, `public.v_saldos`.
- Produce: la vista `public.v_esperando_plata` con las columnas
  `tramite_id, cliente_nombre, dominio, oferta_referencia, gestora_id, razon_social_id,
  tarjeta_id, pide, presupuestado_at, alcanza`.

- [ ] **Paso 1: Escribir la migración**

```sql
-- ============================================================================
--  ESPERAR PLATA SE DEDUCE, NO SE MARCA
-- ============================================================================
--
--  `frenado_por_saldo` era un estado que alguien tenia que marcar Y DESMARCAR a mano. El
--  desmarcado es el que se olvidaba: entraba plata y el tramite seguia figurando frenado.
--
--  Un tramite esta esperando plata si esta presupuestado y su tarjeta no alcanza. Eso no es una
--  propiedad del tramite: es una comparacion entre el tramite y la tarjeta, y las comparaciones
--  se calculan.
--
--  ============================================================================
--   POR QUE UNA VISTA Y NO UNA CONSULTA EN CADA PANTALLA
--  ============================================================================
--
--  Porque la miran DOS apps: la oficina para saber a quien le debe plata, y la gestora para
--  saber si puede salir. Si cada una hiciera su propia cuenta, el dia que una cambie el criterio
--  las dos mostrarian numeros distintos del mismo hecho — y entonces nadie le cree a ninguna.
--
--  `security_invoker = true`, como toda vista de este proyecto: sin eso corre como su duenio y
--  saltea la RLS entera.
--
--  ES ADITIVA: una vista nueva. No toca ninguna fila ni ninguna policy.

create or replace view public.v_esperando_plata with (security_invoker = true) as
select t.id            as tramite_id,
       t.cliente_nombre,
       t.dominio,
       t.oferta_referencia,
       t.gestora_id,
       t.razon_social_id,
       t.tarjeta_id,
       t.deposito_solicitado as pide,
       t.presupuestado_at,
       -- Alcanza si lo acreditado cubre TODO lo reservado de esa tarjeta, no solo este tramite:
       -- la plata es de la tarjeta y se la reparten todos los presupuestos vivos.
       (s.contable >= s.comprometido) as alcanza
  from public.tramites t
  join public.v_saldos s on s.tarjeta_id = t.tarjeta_id
 where t.estado = 'presupuestado'
   and t.medio_pago = 'tarjeta_habitualista'
   and coalesce(t.deposito_solicitado, 0) > 0
   and s.contable < s.comprometido;

comment on view public.v_esperando_plata is
  'Los tramites presupuestados cuya tarjeta no cubre lo reservado. Reemplaza al estado '
  'frenado_por_saldo, que alguien tenia que marcar y desmarcar a mano — y el desmarcado se '
  'olvidaba. La miran las dos apps para que muestren el mismo numero del mismo hecho.';

revoke insert, update, delete, truncate on public.v_esperando_plata from anon, authenticated;
grant select on public.v_esperando_plata to authenticated;

-- ============================================================================
--  COMO COMPROBAR QUE QUEDO BIEN
--
--  1) La vista existe y es de solo lectura. Las dos primeras dan false, la tercera true:
--       select has_table_privilege('authenticated','public.v_esperando_plata','UPDATE') as u,
--              has_table_privilege('authenticated','public.v_esperando_plata','DELETE') as d,
--              has_table_privilege('authenticated','public.v_esperando_plata','SELECT') as s;
--
--  2) Lleva security_invoker. Tiene que aparecer en las opciones:
--       select relname, reloptions from pg_class
--        where relname = 'v_esperando_plata';
--
--  3) EL COMPORTAMIENTO, que es lo que importa. Con una tarjeta que alcanza, la vista esta
--     vacia para esa tarjeta:
--       select nombre, contable, comprometido, contable >= comprometido as alcanza
--         from public.v_saldos order by orden;
--       select cliente_nombre, pide from public.v_esperando_plata;
--     Esperado: solo aparecen tramites de tarjetas donde contable < comprometido.
--
--  4) Y SE ACTUALIZA SOLA. Cargar un ingreso que cubra la diferencia y volver a mirar:
--       insert into public.movimientos (tarjeta_id, tipo, importe, fecha_acreditacion, concepto)
--       values ('<la tarjeta>', 'ingreso', <la diferencia>, current_date, 'Prueba de cobertura');
--       select cliente_nombre from public.v_esperando_plata;
--     Esperado: los tramites de esa tarjeta DESAPARECIERON de la vista sin que nadie los toque.
--     Eso es lo que el estado no hacia.
-- ============================================================================
```

- [ ] **Paso 2: Aplicar y correr las cuatro comprobaciones**

```bash
cd "C:/Users/Vmagni/Desktop/GRUPO PARIS/GESTORIA" && export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && export SUPABASE_ACCESS_TOKEN="$(grep '^SUPABASE_ACCESS_TOKEN=' .env.local | cut -d= -f2-)" && npm run migraciones > /tmp/m.log 2>&1; echo "MIGRACIONES: $?" && npm run db:push > /tmp/p.log 2>&1; echo "PUSH: $?"; npm run permisos > /tmp/perm.log 2>&1; echo "PERMISOS: $?"; tail -6 /tmp/perm.log
```

La **4** es la prueba de que la vista hace lo que el estado no hacía.

- [ ] **Paso 3: Regenerar los tipos**

```bash
cd "C:/Users/Vmagni/Desktop/GRUPO PARIS/GESTORIA" && export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && export SUPABASE_ACCESS_TOKEN="$(grep '^SUPABASE_ACCESS_TOKEN=' .env.local | cut -d= -f2-)" && npm run db:tipos > /tmp/t.log 2>&1; echo "EXIT: $?"; grep -c "v_esperando_plata\|resuelto_at" src/lib/database.types.ts
```

- [ ] **Paso 4: Commit**

```bash
git add -A && git commit -m "Esperar plata se deduce de la tarjeta, no lo marca una persona"
```

---

## Tarea 10: El front se pone al día con la cadena nueva

**Archivos:**
- Modificar: `src/features/tramites/Listado.tsx` (la constante `ESTADOS`)
- Modificar: `src/features/tramites/Ficha.tsx` (`SIGUIENTE`, `CERRADOS`, `TERMINADOS`)
- Modificar: `src/features/solicitudes/Bandeja.tsx` (usa `frenado_por_saldo`)

**Interfaces:**
- Consume: los tipos regenerados de la tarea 9.
- Produce: la app compilando y funcionando con seis estados.

**Alcance, y es importante:** esto es **lo mínimo para que la app no se rompa entre el Plan A y el
Plan B**. No se rediseña nada: el front se rehace entero en el Plan B. Si una pantalla queda fea
pero funciona, está bien.

- [ ] **Paso 1: Encontrar todo lo que nombra un estado viejo**

```bash
cd "C:/Users/Vmagni/Desktop/GRUPO PARIS/GESTORIA" && grep -rn "presentado\|pagado\|retirado\|frenado_por_saldo" src/ --include=*.ts --include=*.tsx | grep -v "\.test\." | grep -v "presupuestado"
```

Trabajar sobre esa lista. **No usar `sed` sobre JSX.**

- [ ] **Paso 2: La lista de estados**

En `src/features/tramites/Listado.tsx`, reemplazar la constante `ESTADOS`:

```ts
export const ESTADOS: { valor: string; nombre: string }[] = [
  { valor: "recibido", nombre: "Recibido" },
  { valor: "controlado", nombre: "Controlado" },
  { valor: "entregado", nombre: "Entregado a gestoría" },
  { valor: "presupuestado", nombre: "Presupuestado" },
  { valor: "resuelto", nombre: "Resuelto en el registro" },
  { valor: "devuelto", nombre: "Devuelto" },
  { valor: "anulado", nombre: "Anulado" },
];
```

- [ ] **Paso 3: El paso siguiente en la ficha**

En `src/features/tramites/Ficha.tsx`, reemplazar `SIGUIENTE`, `CERRADOS` y `TERMINADOS`:

```ts
/**
 * Que sigue despues de cada estado. Espeja la maquina de estados de la base.
 *
 * `presupuestado > resuelto` es UN paso porque es UN viaje al registro: la gestora presenta,
 * paga y retira en la misma ventanilla. Antes eran tres botones para el mismo momento.
 */
const SIGUIENTE: Record<string, { estado: string; boton: string } | undefined> = {
  recibido: { estado: "controlado", boton: "Marcar como controlado" },
  controlado: { estado: "entregado", boton: "Entregar a la gestora" },
  entregado: { estado: "presupuestado", boton: "Cargar el presupuesto" },
  presupuestado: { estado: "resuelto", boton: "Resolver en el registro" },
  resuelto: { estado: "devuelto", boton: "Entregar a administración" },
};

/** Estados en los que el presupuesto ya no se toca: la reserva ya se liberó. */
const CERRADOS = new Set(["resuelto", "devuelto", "anulado"]);

/** Y en estos tampoco se toca el costo real: el trámite ya terminó. */
const TERMINADOS = new Set(["devuelto", "anulado"]);
```

- [ ] **Paso 4: La bandeja deja de mirar un estado que ya no existe**

En `src/features/solicitudes/Bandeja.tsx`, borrar la consulta de `frenado_por_saldo` y su bloque.
El listado de "esperando plata" real llega con el Plan B; por ahora la bandeja muestra sólo los
presupuestados, que es lo que ya hacía en su primer bloque.

Reemplazar:

```tsx
  const presupuestados = useTramites({ estado: "presupuestado" });
  const frenados = useTramites({ estado: "frenado_por_saldo" });
  const saldos = useSaldos();
```

por:

```tsx
  const presupuestados = useTramites({ estado: "presupuestado" });
  const saldos = useSaldos();
```

y borrar el bloque `{(frenados.data ?? []).length > 0 && ( ... )}` completo, junto con la
condición `(frenados.data ?? []).length === 0` del estado vacío.

- [ ] **Paso 5: Las salidas del trámite**

En `src/features/tramites/Salidas.tsx`, la línea que decide si se puede frenar:

```tsx
  // La base decide de verdad; esto sólo evita mostrar un botón que va a fallar.
  const sePuedeFrenar = estado === "presupuestado";
```

**Frenar deja de existir como estado.** Reemplazar el componente para que ofrezca sólo anular:

```tsx
  const sePuedeAnular = estado !== "devuelto" && estado !== "anulado";

  if (!sePuedeAnular) return null;
```

y borrar del JSX el botón "Frenar por falta de saldo", su rama en el texto y la prop `alFrenar`.
En `Ficha.tsx`, sacar `alFrenar` de donde se pasa el componente.

- [ ] **Paso 6: Los cuatro comandos**

```bash
cd "C:/Users/Vmagni/Desktop/GRUPO PARIS/GESTORIA" && export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && npx tsc -b > /tmp/a.log 2>&1; echo "TIPOS: $?"; head -15 /tmp/a.log; npm run lint > /tmp/b.log 2>&1; echo "LINT: $?"; npm test > /tmp/c.log 2>&1; echo "TESTS: $?"; grep -E "Tests |FAIL" /tmp/c.log | tail -3; npm run build > /tmp/d.log 2>&1; echo "BUILD: $?"
```

Esperado: los cuatro en 0.

- [ ] **Paso 7: Mirarlo, que es lo que este proyecto exige**

Levantar el servidor y abrir un trámite en cada estado. Comprobar:

- El listado ofrece **siete** estados en el filtro, no diez.
- Un trámite presupuestado muestra el botón **"Resolver en el registro"**.
- No aparece por ningún lado "Frenar por falta de saldo".

- [ ] **Paso 8: Commit**

```bash
git add -A && git commit -m "El front habla la cadena de seis estados"
```

---

## Tarea 11: El arnés de permisos se pone al día

**Archivos:**
- Modificar: `src/permisos.rls.test.ts`
- Modificar: `src/permisos-plata.rls.test.ts`

- [ ] **Paso 1: Ver qué se rompió**

```bash
cd "C:/Users/Vmagni/Desktop/GRUPO PARIS/GESTORIA" && export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && npm run test:rls > /tmp/rls.log 2>&1; echo "EXIT: $?"; grep -E "Tests |FAIL|AssertionError" /tmp/rls.log | head -15
```

Anotar cuáles fallan y por qué. **Si falla algo que no nombra un estado, parar:** eso es un
defecto real de las migraciones, no del arnés.

- [ ] **Paso 2: Cambiar lo que nombra estados viejos**

```bash
cd "C:/Users/Vmagni/Desktop/GRUPO PARIS/GESTORIA" && grep -n "presentado\|pagado\|retirado\|frenado_por_saldo" src/permisos*.rls.test.ts
```

Reemplazar cada aparición por el estado equivalente de la cadena nueva. **Cambiar el aserto, no
el sentido de la prueba:** si una probaba que una gestora no puede pasar de `recibido` a
`pagado`, ahora prueba que no puede pasar de `recibido` a `resuelto`.

- [ ] **Paso 3: Agregar la prueba del paso nuevo**

Al final de `src/permisos-plata.rls.test.ts`:

```ts
describe("resolver un tramite pide todo lo que ese momento produce", () => {
  let elTramite = "";

  beforeAll(async () => {
    const { data } = await gerencia
      .from("tramites").select("id").eq("cliente_nombre", NOMBRE_DE_PRUEBA)
      .order("recibido_at").limit(1);
    elTramite = String(data?.[0]?.id ?? "");
  });

  it("hay un tramite con el que probar", () => {
    expect(elTramite).not.toBe("");
  });

  it("no se puede saltear de recibido a resuelto", async () => {
    /*
      El boton de la pantalla es uno solo, el del paso siguiente, asi que este salto no se puede
      hacer desde la app. Pero SI desde la consola del navegador, y por eso lo impide la base.
    */
    const { error } = await gerencia
      .from("tramites").update({ estado: "resuelto" }).eq("id", elTramite);
    expect(error).not.toBeNull();
  });

  it("y los estados viejos ya no existen", async () => {
    // El check se apreto a siete valores. Un estado de la cadena anterior tiene que ser
    // rechazado por la base, no ignorado en silencio.
    const { error } = await gerencia
      .from("tramites").update({ estado: "pagado" }).eq("id", elTramite);
    expect(error).not.toBeNull();
  });
});
```

- [ ] **Paso 4: Correr, y correr dos veces**

```bash
cd "C:/Users/Vmagni/Desktop/GRUPO PARIS/GESTORIA" && export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && npm run test:rls > /tmp/rls.log 2>&1; echo "PRIMERA: $?"; grep -E "Tests " /tmp/rls.log | tail -1; npm run test:rls > /tmp/rls2.log 2>&1; echo "SEGUNDA: $?"; grep -E "Tests " /tmp/rls2.log | tail -1
```

Esperado: las dos en 0 **y con el mismo número de pruebas**. Correrlo dos veces es lo que agarra
un arnés que ensucia la base que prueba — ya pasó una vez en este proyecto.

- [ ] **Paso 5: Commit**

```bash
git add src/permisos*.rls.test.ts && git commit -m "El arnes de permisos habla la cadena nueva"
```

---

# PARTE 3 — CIERRE

## Tarea 12: Los tres revisores, y publicar

**Archivos:**
- Modificar: `CHANGELOG.md`
- Modificar: `docs/ESTADO.md`

**Por qué existe esta tarea:** el `CLAUDE.md` dice *"ninguna etapa cierra sin una revisión de
alguien que no la escribió"*, y en toda la reconstrucción anterior eso no se cumplió ni una vez.
Un revisor que corre en su propia ventana ve el diff y **no** el razonamiento que lo produjo.

- [ ] **Paso 1: Los tres revisores, sobre lo que a cada uno le toca**

Invocarlos con el `Agent`, uno por uno, con este alcance:

```
revisor-seguridad:
  Revisá las migraciones de esta tanda (las cinco de docs/superpowers/plans/2026-08-26-plan-a).
  Mirá especialmente: que anular_movimiento no deje un camino para revertir una anulacion, que
  v_esperando_plata lleve security_invoker y no exponga nada que la RLS no exponga ya, y que
  ninguna policy nueva se olvide de `to authenticated`.

revisor-contable:
  Revisá que la reserva se libere exactamente una vez al pasar a `resuelto`, que el costo real se
  descuente por su valor y que el comprometido de la tarjeta vuelva a donde estaba. Mirá tambien
  la conversion de los dos tramites viejos: que no haya movido plata.

revisor-producto:
  Revisá los textos nuevos de la interfaz y de los errores de la base. Que esten en voseo, sin
  jerga tecnica, sin emojis, y que cada error diga QUE HACER y no solo que algo salio mal.
```

**Anotar lo que encuentre cada uno.** Si hay hallazgos de corrección, se arreglan antes de
publicar. Si son de estilo, se anotan.

- [ ] **Paso 2: `/code-review` sobre el diff**

```
/code-review
```

Sobre el diff de la rama contra `main`.

- [ ] **Paso 3: Todos los guardianes y todos los comandos**

```bash
cd "C:/Users/Vmagni/Desktop/GRUPO PARIS/GESTORIA" && export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && export SUPABASE_ACCESS_TOKEN="$(grep '^SUPABASE_ACCESS_TOKEN=' .env.local | cut -d= -f2-)" && for c in "npx tsc -b" "npm run lint" "npm test" "npm run build" "npm run secretos" "npm run migraciones" "npm run permisos" "npm run indices" "npm run colores" "npm run formato:check"; do printf '%-24s ' "$c"; $c > /tmp/g.log 2>&1; echo "EXIT: $?"; done; npm run test:rls > /tmp/rls.log 2>&1; echo "RLS: $?"; npm run e2e > /tmp/e.log 2>&1; echo "E2E: $?"
```

Esperado: **todos en 0.** `npm run espacios` queda afuera a propósito: está en rojo hasta el
Plan B, y eso está anotado en el `ESTADO.md`.

- [ ] **Paso 4: El CHANGELOG, en lenguaje de usuario**

Agregar arriba de todo, dentro de "Sin publicar todavía":

```markdown
### La cadena se simplificó, y el saldo inicial se puede volver a cargar — 26/08/2026

**El trámite pasa de diez estados a seis.** Presentar, pagar y retirar eran tres pasos separados
para un solo viaje al registro: la gestora presenta, le liquidan, paga y retira en la misma
ventanilla. Ahora es un paso, **Resuelto**, que pide de una vez la seccional, lo que salió de
verdad y qué documentación retiró.

**"Frenado por falta de saldo" dejó de ser un estado.** Alguien tenía que marcarlo, y sobre todo
tenía que **desmarcarlo** cuando entraba plata — y eso se olvidaba. Ahora se calcula: un trámite
presupuestado cuya tarjeta no alcanza está esperando plata, y **deja de estarlo solo** en cuanto
el depósito acredita.

**El saldo inicial de una tarjeta se puede volver a cargar después de anularlo.** Antes decía que
el dato ya había sido ingresado, y dos tarjetas quedaron sin poder arrancar. Era un defecto.

**Y una anulación ya no se puede anular.** Se podía, y el resultado era la plata de vuelta en el
saldo mientras la pantalla mostraba el movimiento tachado. Si hay que revertir una anulación, se
carga el movimiento de nuevo: queda más largo en el extracto y queda explicable.
```

- [ ] **Paso 5: El ESTADO, con los números contados de nuevo**

```bash
cd "C:/Users/Vmagni/Desktop/GRUPO PARIS/GESTORIA" && export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && npm test 2>&1 | grep -E "Test Files|Tests " | tail -2 && npm run test:rls 2>&1 | grep -E "Tests " | tail -1 && npm run e2e 2>&1 | grep -E "passed" | tail -1 && ls supabase/migrations/*.sql | wc -l && find src -name "*.ts*" | wc -l && wc -l CLAUDE.md
```

Escribir **esos** números, no los de antes.

- [ ] **Paso 6: Publicar**

```bash
cd "C:/Users/Vmagni/Desktop/GRUPO PARIS/GESTORIA" && RAMA=$(git branch --show-current) && git add -A && git commit -m "Plan A cerrado: la base con seis estados y el andamio que hace cumplir las reglas" && git push origin "$RAMA" && git checkout main && git merge "$RAMA" --no-edit && git push origin main && echo "PUSH OK a main" && git checkout "$RAMA"
```

- [ ] **Paso 7: Comprobar que llegó, con las tres evidencias**

```bash
cd "C:/Users/Vmagni/Desktop/GRUPO PARIS/GESTORIA" && echo "sin publicar: $(git rev-list --count origin/main..main)" && JS=$(curl -s https://proyecto-gestoria.pages.dev/ | grep -o '/assets/index-[^"]*\.js' | head -1) && echo "JS: $JS" && curl -s "https://proyecto-gestoria.pages.dev$JS" > /tmp/pub.js && for s in "Resolver en el registro" "Resuelto en el registro"; do printf '%-30s ' "$s"; grep -c "$s" /tmp/pub.js; done && for s in "Frenado por saldo" "Marcar como pagado" "Marcar como retirado"; do printf '%-30s (debe dar 0) ' "$s"; grep -c "$s" /tmp/pub.js; done
```

Esperado: `sin publicar: 0`, los dos textos nuevos en 1 o más, y los tres viejos en **0**.

- [ ] **Paso 8: Abrirlo y mirarlo**

Entrar a `https://proyecto-gestoria.pages.dev/`, abrir un trámite presupuestado y comprobar que
el botón dice **"Resolver en el registro"**. Es el paso que este proyecto exige y que ningún test
reemplaza.

---

## Lo que este plan NO hace

- **No rediseña ninguna pantalla.** El front se toca lo mínimo para que compile y funcione con la
  cadena nueva. La reconstrucción entera —resumen, empresa, trámite, sin barra lateral, color
  nuevo— es el Plan B.
- **No enciende el router.** `@tanstack/react-router` sigue instalado y apagado; entra en el Plan B,
  porque la navegación es la app misma.
- **No toca el color.** La paleta teal es del Plan B.
- **No conecta el guardián de espacios al pre-commit.** Está en rojo a propósito hasta que el
  front se rehaga.
- **No agrega Radix, Lighthouse ni la PWA.** Son del Plan B y del Plan C.
- **No separa la base de desarrollo de la de producción.** Sigue siendo una sola.
