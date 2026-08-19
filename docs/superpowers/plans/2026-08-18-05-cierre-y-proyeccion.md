# Etapa 4 — Cierre de mes, proyección y el análisis para gerencia

> SUB-SKILL OBLIGATORIA — `superpowers:subagent-driven-development`. Leé
> [el índice](2026-08-18-00-INDICE.md). Diseño de origen: `docs/diseno/02-informes-y-proyeccion.md`.

**Objetivo:** lo que se le muestra a gerencia.

**Requisitos que cierra:** R15, R16, R23.

**Por qué va cuarta y no antes:** un informe de proyección sobre datos que nadie carga produce
números falsos con más confianza. Esta etapa **necesita al menos dos meses de uso real** para que
las medianas de costo signifiquen algo.

---

## Tarea 1 — Reporte de cierre de mes

**Archivos:** `src/lib/cierre-mes.ts` + test, `src/features/cierre/*`,
`supabase/migrations/*_cierres.sql`

- [ ] **Paso 1: el corte temporal es la FECHA DE PRESENTACIÓN en el registro.** Decidido, y hay
      que sostenerlo:
      - el **alta** es un requisito administrativo `[fuente:8]` y depende de cuándo administración
        mandó el mail;
      - el **pago** se mueve por tesorería y por cuándo había saldo;
      - la **presentación** es el trabajo hecho, y no vuelve a moverse.

      Cualquiera de los otros dos hace que el mismo trabajo caiga en un mes distinto según algo
      que no depende de quien lo hizo.

- [ ] **Paso 2: el contenido.** Patentamientos y transferencias, por razón social y por tipo, con
      costo total y margen. **Nunca por gestora** (R35).
- [ ] **Paso 3: se congela.** Cerrado un mes, el reporte guarda sus números en `cierres_mensuales`
      y deja de recalcularse. Si después aparece un trámite con fecha vieja, **no cambia el
      cerrado**: aparece en una lista de "posteriores al cierre", con su fecha.

      *Por qué:* un reporte que cambia después de mostrado hace que nadie confíe en el anterior.

- [ ] **Paso 4: la prueba que vale más que los tests.** El primer mes se compara **contra el
      conteo hecho a mano sobre el Excel**. Tienen que dar igual. Si no dan, se investiga antes de
      publicar el reporte, y se escribe cuál de los dos estaba mal.

**Verificación:** el conteo a mano contra el reporte, con los dos números escritos.

---

## Tarea 2 — Proyección de saldos

**Archivos:** `src/lib/proyeccion.ts` + test, `src/features/proyeccion/*`,
`supabase/migrations/*_objetivos.sql`

- [ ] **Paso 1: `objetivos_mensuales` e `ingresos_programados`**, carga manual de gerencia
      `[fuente:27]`.

- [ ] **Paso 2: la fórmula, exacta**, por tarjeta y mes, todo en centavos enteros:

```
unidades_faltantes(t) = max(0, objetivo(t) − altas_del_mes(t))

egreso_estimado_p50 = Σ_t unidades_faltantes(t) × costo_mediano(t)
egreso_estimado_p80 = Σ_t unidades_faltantes(t) × costo_p80(t)

saldo_proyectado = saldo_actual + ingresos_programados − comprometido − egreso_estimado
```

      **`max(0, objetivo − altas_del_mes)` es lo único no obvio y es donde se rompe si se hace
      mal.** Los trámites que **ya** se dieron de alta este mes ya están contados: en
      `comprometido` si no se pagaron, o ya descontados del saldo si se pagaron. Multiplicar el
      objetivo entero por el costo mediano **los contaría dos veces** y proyectaría un pozo que no
      existe.

      Caso de test explícito: **objetivo ya cumplido → ese tipo aporta cero, y ni siquiera hace
      falta su costo mediano.**

- [ ] **Paso 2B: el costo mediano es un mal estimador para el patentamiento, y hay que decirlo.**

      Sale de `docs/DOMINIO.md` §1.2: **el arancel de inscripción inicial es el 1% del valor del
      vehículo**, no un monto fijo. En los pagos reales de `[img 03]` conviven $192.198 y
      $1.294.511 — casi siete veces de diferencia. **Una mediana sobre eso no estima nada**: dice
      cuánto costó el auto del medio, no cuánto va a costar el mix del mes que viene.

      La corrección, y es chica:

      | Insumo disponible | Cómo se estima |
      |---|---|
      | `objetivos_mensuales` trae **valor estimado** de las unidades | `tasa_mediana × valor_estimado`, donde la tasa es la mediana de `costo_real / valor_vehiculo` de los últimos 90 días |
      | El objetivo trae **sólo unidades** | Se cae al costo mediano absoluto, **y la hoja de supuestos lo declara**: *"estimado sobre el costo mediano histórico; si el mix de valores del mes cambia, esta cifra se corre con él"* |

      La tasa es mucho más estable que el monto, porque es la misma alícuota para todos. Y para las
      transferencias, donde el arancel es fijo o cero, el costo mediano sí sirve: la corrección
      aplica al patentamiento.

      Esto **agrega una columna opcional** a `objetivos_mensuales` y una línea a la hoja de
      supuestos. No cambia la fórmula ni la estructura.

      *Por qué importa que quede escrito:* sin esto, la proyección da un número con cara de firme
      construido sobre una mediana que no representa nada, y alguien decide un depósito con él.
      Es exactamente el tipo de error que el proyecto declara como el peor: un número inventado
      con apariencia de oficial.

- [ ] **Paso 3: qué pasa cuando falta un insumo.** Cada uno tiene su regla, y ninguna es
      "asumir algo razonable":

      | Insumo | Si falta |
      |---|---|
      | Saldo actual | **La proyección no corre.** Enlace a la pantalla de carga. |
      | Ingresos programados | Se asume **cero**. Es el único con default, y es conservador: proyecta un saldo más bajo, nunca más alto. Se declara en los supuestos. |
      | Objetivo del mes | **Insumo faltante.** Fila ausente **no** es "objetivo cero". Estado incompleto, montos en null. |
      | Costo mediano | Necesita n ≥ 5 de los últimos 90 días. Con menos, se reintenta con todas las razones sociales del mismo tipo. Si sigue corto **y ese tipo tiene unidades pendientes** → insumo faltante. |

      **Cada nivel de valuación usado se cuenta y se muestra:** *"38 trámites valuados a costo
      real, 12 a presupuesto, 3 a mediana"*. Un número sin eso al lado parece más firme de lo que
      es.

- [ ] **Paso 4: la banda, nunca un número solo.** Siempre `[p80, p50]`, **con el p80 primero**,
      porque el escenario malo es el que obliga a actuar. Y cuando la banda es negativa, se dice
      en pesos faltantes: *"Para cumplir el objetivo de octubre faltan entre $15.035.397 y
      $23.295.097"*, que es accionable; un saldo negativo, no.

- [ ] **Paso 5: `LO_QUE_NO_PREDICE`**, constante exportada, **renderizada siempre** —también
      cuando la proyección está completa— y copiada a la hoja "Supuestos" del Excel. No es un pie
      de página: es parte del resultado. Las siete están en
      `docs/diseno/02-informes-y-proyeccion.md` §2.3. Las tres que más importan:

      1. **No predice aumentos de aranceles.** La mediana es histórica a 90 días; el día que el
         registro actualiza valores, la proyección queda corta y no tiene cómo saberlo.
      2. **No dice en qué día del mes te quedás sin saldo.** En `[img 03]` hay cinco pagos de
         ~$1.044.912 en tres minutos: el consumo no es parejo y cualquier fecha estimada sobre
         ritmo lineal se equivoca por semanas.
      3. **No predice si el cliente paga.** La Habitualista es sólo egreso. Un mes con margen
         excelente y sin depósitos igual se queda sin saldo.

**Verificación:** tres casos de test con números escritos a mano, incluido el de objetivo
cumplido. Y la pantalla mirada con un insumo faltante a propósito, para ver que dice "sin datos
suficientes" y no un cero.

---

## Tarea 3 — El análisis de pro-contras

**Archivos:** `docs/PRO-CONTRAS.md`, `src/features/adopcion/*`, `src/lib/adopcion.ts` + test

`[fuente:24]` pide *"análisis de pro-contras para demostrar a gerencia la eficiencia de
utilizarla"*.

- [ ] **Paso 1: la métrica que encabeza todo — pesos de recargo evitados.**

      Es la mejor que tiene el proyecto y sale de `docs/DOMINIO.md`: cada trámite presentado
      dentro de su plazo es un recargo que no se pagó, y el recargo tiene fórmula publicada. Un
      número en pesos, sacado de la propia base, en el idioma de gerencia.

      **Con su honestidad al lado, que es lo que la hace creíble:** no todo trámite en término se
      habría vencido sin el sistema. Entonces el número que se publica es **recargo evitado sobre
      los trámites que llegaron a estar a menos de X días de vencer** — los que de verdad
      estuvieron en riesgo. Un número chico y defendible vale más que uno grande y discutible.

- [ ] **Paso 2: cobertura del circuito, no comparación de canales.**

      **Contestado el 19/08 y hay que corregir lo que yo había escrito.** Textual: *"sí usamos
      RUNA, pero queda desafectado y solamente lo maneja administración"*.

      Los patentamientos que van por RUNA **no pasan por gestoría ni por la Tarjeta Habitualista**.
      No hay comparación de costo por canal que hacer: el canal barato ya se usa donde corresponde,
      y ese ahorro **ya lo están tomando**. Se descarta esa parte del informe.

      Lo que sí queda, y es distinto: **cuántos trámites del mes pasaron por este circuito**. Sin
      ese número, el reporte parece describir toda la operación cuando describe una parte, y
      gerencia sacaría conclusiones sobre un total que no es el total. Una línea que diga *"de los
      N patentamientos del mes, M pasaron por gestoría"* evita eso.

- [ ] **Paso 3: las nueve métricas restantes.** Tabla completa en
      `docs/diseno/02-informes-y-proyeccion.md` §5.2. Las cuatro que mueven la aguja:
      - días entre alta y pago (**la única con "antes" honesto**, porque sale del histórico);
      - **trámites frenados por falta de saldo, y días perdidos** — y por eso
        `frenado_por_saldo` es un estado desde la etapa 1;
      - desvío entre presupuesto y costo real;
      - la encuesta de adopción, contra la línea de base del día 0.

- [ ] **Paso 2: ningún número sin la consulta al lado.** `docs/PRO-CONTRAS.md` lleva, debajo de
      cada cifra, el SQL que la produce. **R23 se comprueba corriendo las consultas del documento
      y comparando.**

      *Por qué esto y no un informe lindo:* un análisis de eficiencia con un número inventado
      adentro deja de servir para decidir, que es lo único para lo que existe.

- [ ] **Paso 3: con n insuficiente, el número NO se publica.** Se dice "sin datos suficientes".
      Un promedio sobre cuatro casos presentado como sólido es peor que no tener el promedio.

- [ ] **Paso 4: el encuadre.** Todo se corta por razón social, tipo y seccional. **Nunca por
      gestora.** Un test revisa que ningún rótulo ni explicación de `adopcion.ts` mencione
      gestoras.

      Esto no es corrección política: el día que exista un ranking de gestoras, los presupuestos
      se cargan tarde y redondeados, y `comprometido` —que es la razón de ser del sistema— pasa a
      ser mentira.

**Verificación:** correr las consultas del documento y comparar contra la pantalla, número por
número.

---

## Tarea 4 — Exportación completa

**Archivos:** `src/lib/excel-gestoria.ts` + test

- [ ] **Paso 1: las hojas** — trámites, movimientos, cierre del mes, proyección, supuestos.
- [ ] **Paso 2: `LO_QUE_NO_PREDICE` va en la hoja "Supuestos"**, para que viaje con el archivo.
      Un Excel reenviado por mail pierde el contexto de la pantalla; los supuestos tienen que ir
      adentro.
- [ ] **Paso 3: el permiso viaja con el archivo** (R11). Mismo mecanismo que en la etapa 1.

**Verificación:** generar el archivo, **abrirlo y mirarlo**, con una cuenta de gestora y con una
de gerencia.

---

## Cierre de la etapa

- [ ] Los cuatro comandos en 0.
- [ ] R15, R16 y R23 con evidencia.
- [ ] El reporte del primer mes contra el conteo a mano.
- [ ] Revisión independiente, con foco en los números.
- [ ] Entrada en el `CHANGELOG`.
