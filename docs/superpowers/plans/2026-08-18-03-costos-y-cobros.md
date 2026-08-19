# Etapa 2 — Costo real y lo cobrado al cliente

> SUB-SKILL OBLIGATORIA — `superpowers:subagent-driven-development`. Leé
> [el índice](2026-08-18-00-INDICE.md). No empezar sin la etapa 1 cerrada y **usándose**.

**Objetivo:** contestar "cuánto nos costó de verdad y cuánto le cobramos", por trámite y por mes.

**Requisitos que cierra:** R11, R21, R22.

**Por qué sirve sola:** hoy eso no se contesta. Las columnas `$ TRANSF` y `TOTAL` de la planilla
`[img 04]` están **vacías en todas las filas visibles**. No es que el dato esté desordenado: no
está.

**Las tablas ya existen** (etapa 1, tarea 4B). Esta etapa es lo que se ve y lo que se calcula.

---

## Tarea 1 — Cargar el costo real

**Archivos:** `src/features/tramites/CostoReal.tsx`, `src/lib/costos.ts` + test

- [ ] **Paso 1: el formulario**, con las mismas líneas de concepto que el presupuesto, pero con
      `momento = 'real'`. Los conceptos salen del catálogo, así que si apareció uno nuevo desde
      la etapa 1 ya está disponible acá sin tocar nada.
- [ ] **Paso 2: obligatorio para pasar a `pagado`.** Lo exige el trigger de transición, no el
      front. Si el front fuera el único guardián, alcanzaría con un cliente HTTP para saltearlo.
- [ ] **Paso 3: el pago escribe los dos movimientos** — `reversa_reserva` por todo lo reservado y
      `pago` por el costo real. Ya está en la migración 05; acá se comprueba con datos reales.

**Verificación:** presupuesto 670.000 y costo real 666.000 → después del pago, `comprometido`
vuelve a 0 y `contable` bajó **666.000**, no 670.000.

---

## Tarea 2 — El desvío, lado a lado

**Archivos:** `src/features/tramites/FichaTramite.tsx`

- [ ] **Paso 1: dos columnas en la ficha** — presupuesto y real, línea por línea — y el desvío en
      pesos y en porcentaje.
- [ ] **Paso 2: el desvío se colorea sólo cuando importa**, con `--warn` por encima del umbral. La
      marca es monocroma; el color sólo comunica estado.
- [ ] **Paso 3: `costos.ts` puro**, con test. Caso obligatorio: un concepto que está en el
      presupuesto y **no** en el real (y al revés) no rompe el cálculo ni se cuenta como cero
      silencioso — se muestra como faltante.

**Verificación:** los tres casos en verde, y una ficha real mirada en pantalla.

---

## Tarea 3 — Cobros y margen

**Archivos:** `src/features/cobros/*`, `src/lib/margen.ts` + test

- [ ] **Paso 1: la pantalla de cobros**, invisible para gestoras. No "con el botón escondido":
      **la ruta no existe** para ese rol, y aunque la escriba a mano la base no le devuelve filas.
- [ ] **Paso 2: margen por trámite** = cobrado − costo real. Sólo para gerencia y contable.

- [ ] **Paso 2B: un cobro por trámite. Confirmado, y simplifica.**

      Yo había dejado abierta la posibilidad de que una operación comercial —un 0km con un usado en
      parte de pago— tuviera dos trámites y un solo cobro, y había diseñado una agrupación por
      `oferta_referencia` por las dudas.

      **Respuesta del dueño del proyecto el 19/08, textual:** *"el cobro es por cada operación
      individual, es decir trámite por trámite, son todos clientes distintos y distintos cobros por
      eso mismo"*.

      Entonces `cobros` uno a uno con el trámite es correcto, **y se descarta la agrupación por
      oferta para el cobro**. Menos estructura, menos código, y el margen por trámite significa
      exactamente lo que parece.

      La referencia de oferta **sigue siendo campo de primera clase**, pero por lo que se pidió que
      fuera: **ubicar el trámite y el cliente**. No agrupar cobros.
- [ ] **Paso 3: el informe de costos**, con grano de un trámite por fila, agrupable por razón
      social, tipo y mes.

- [ ] **Paso 4: R11 comprobado por los cuatro caminos, no por uno.** Esto es lo más importante de
      la etapa y se verifica a mano:

      | Camino | Cómo se comprueba |
      |---|---|
      | La pantalla | Loguearse **como gestora real** y recorrer todas las vistas |
      | La API | Con un JWT de gestora: `select * from cobros` → 0 filas |
      | La exportación | `exportar.test.ts`: ninguna clave del objeto contiene `cobrado` ni `margen` |
      | La vista conjunta | `select * from v_tramites` como gestora → `monto_cobrado` en null |

**Verificación:** los cuatro caminos, con la salida de cada uno pegada. Tres de los cuatro no los
cubre ningún test que se escriba solo.

---

## Cierre de la etapa

- [ ] Los cuatro comandos en 0.
- [ ] R11, R21 y R22 comprobados con evidencia escrita al lado.
- [ ] Revisión independiente, con foco en R11: **que alguien que no escribió esto intente llegar
      al cobrado desde una cuenta de gestora.**
- [ ] Entrada en el `CHANGELOG`, en lenguaje de usuario.
