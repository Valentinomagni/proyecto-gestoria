# Etapa 3 — Conciliación con la Tarjeta Habitualista

> SUB-SKILL OBLIGATORIA — `superpowers:subagent-driven-development`. Leé
> [el índice](2026-08-18-00-INDICE.md).

**Objetivo:** que el saldo del sistema deje de ser una hipótesis y pase a tener respaldo.

**Requisitos que cierra:** R24–R29.

**Por qué sirve sola:** sin esto el sistema es una simulación prolija. Con esto, cada peso de
diferencia tiene una fila con nombre. Y es el **único** mecanismo que detecta el pisón residual:
alguien pagó algo que nunca se cargó.

## Y algo más importante que eso: es el seguro contra la adopción parcial

El riesgo más grande del proyecto entero no es técnico. Es que **gerencia, que maneja San Juan, no
cargue sus trámites**. Si eso pasa, el saldo unificado sigue fragmentado y el problema del pedido
`[fuente:16]` queda intacto, con una pantalla linda encima.

Ninguna otra etapa detecta eso. **Ésta sí, y sin pedirle nada a nadie:** los pagos de San Juan
aparecen en el resumen real del habitualista y no en el sistema, así que caen como
`no_registrada`. La conciliación **mide la adopción faltante en pesos**, automáticamente, sin
encuestas y sin preguntar.

Eso cambia cómo se lee esta etapa. No es "la que le pone respaldo al saldo": es **la que avisa si
el proyecto está funcionando**. Por eso no es opcional, y por eso la lista de `no_registrada` es
la primera que hay que mirar cada mañana, antes que la de diferencias de importe.

---

## Tarea 1 — Pegar el listado de Operaciones de Pago

**Archivos:** `supabase/migrations/*_conciliacion.sql`, `src/lib/operaciones.ts` + test

- [ ] **Paso 1: la tabla `operaciones_pago`**, con las columnas exactas de `[img 03]`: número de
      pago, habitualista, canal, fecha, importe, seccional RPA, motivo de pago, observación.

      **`numero_pago` es único.** Es lo que hace que pegar dos veces el mismo listado no duplique
      nada (R26). En `[img 03]` son `0001420388`, `0001420382`, `0001419242`…

- [ ] **Paso 2: el parser.** Se copia la tabla de la pantalla y se pega; llega como texto separado
      por tabulaciones. **Sin ninguna librería**: veinte líneas de código propio.

      *Por qué pegar y no subir un archivo:* es lo que la persona ya está haciendo — tiene la
      pantalla abierta. Pedirle que exporte, guarde y suba agrega tres pasos donde hoy hay uno.

      **Test obligatorio (R25):** las quince filas de `[img 03]` transcritas literalmente, con sus
      trampas reales:
      - importes con formato argentino: `$ 1.044.912,25`, `$ 680.725,00`
      - fechas con hora y con `a. m.` / `p. m.`: `18/08/2026 12:19 p. m.`
      - seccionales con guion adentro: `19009 - Av Ejercito de los Andes 575`
      - motivos de pago heterogéneos: `AF725SQ`, `CASTRO AA301GU`, `SYS RENTACAR`,
        `PARIS AUTOS AA734DI`, `dominguez`, `ochoa`

- [ ] **Paso 3: R24, que es un grep.** `grep -ri "habitualista" src/ | grep -i "fetch\|axios\|http"`
      → **sin resultados**. No hay scraping, no hay credenciales guardadas, el sistema no puede
      pagar nada.

**Verificación:** pegar el mismo listado dos veces y comparar
`select count(*) from operaciones_pago`.

---

## Tarea 2 — El emparejamiento

**Archivos:** `src/lib/conciliacion.ts` + test

**Ésta es la parte difícil y hay que decirlo:** el campo "Motivo Pago" de `[img 03]` no tiene
formato. Convive un dominio solo (`AF725SQ`), un apellido con dominio (`CASTRO AA301GU`), una
razón social (`SYS RENTACAR`) y un apellido en minúscula (`ochoa`). **Ningún algoritmo va a
emparejar todo, y el diseño tiene que asumirlo en vez de fingir lo contrario.**

- [ ] **Paso 1: el emparejamiento en cascada**, del más fuerte al más débil, y cada resultado
      **declara con cuál nivel se resolvió**:

      | Nivel | Regla |
      |---|---|
      | 1 | `numero_pago` igual al `numero_pago_registro` cargado en el trámite. Exacto, sin ambigüedad. |
      | 2 | Dominio extraído del motivo + importe exacto + misma tarjeta |
      | 3 | Dominio + importe dentro de una tolerancia + misma tarjeta y fecha cercana |
      | 4 | Apellido por similitud (`pg_trgm`) + importe exacto + misma tarjeta |

      **El nivel 1 necesita normalizar antes de comparar.** Los números del sitio vienen con ceros
      a la izquierda —`0001420388`, `0001419242` en `[img 03]`— y una persona que copia a mano
      escribe `1420388`. Se comparan **sin ceros a la izquierda y sin espacios**, de los dos lados.
      Comparar el texto crudo hace que el nivel 1 no empareje casi nunca y **degrade en silencio**
      a los niveles débiles, que es peor que no tenerlo.

      **El dominio del nivel 2, con los dos formatos argentinos y ninguno más:**

      | Formato | Patrón | En los datos reales |
      |---|---|---|
      | Mercosur | `^[A-Z]{2}[0-9]{3}[A-Z]{2}$` | `AF725SQ`, `AA301GU`, `AD920PW`, `AA734DI` |
      | Viejo | `^[A-Z]{3}[0-9]{3}$` | `KJL164`, `KXS462` |

      **Y tiene que RECHAZAR `VG504373` y `505796`**, que aparecen en la columna C de `[img 04]`.
      No son dominios: son identificadores internos de la unidad. Un patrón laxo del tipo
      "letras y números" los tomaría como patente y emparejaría trámites equivocados **con
      apariencia de acierto**, que es la peor salida posible de esta etapa.

      Los seis casos de arriba van como test, los cuatro que deben emparejar y los dos que no.

- [ ] **Paso 2: las cuatro salidas** (R27), y ninguna se llama "error":

      | Salida | Qué significa | Qué se hace |
      |---|---|---|
      | `conciliada` | Hay correspondencia | Nada |
      | `no_registrada` | Está en el banco y no en el sistema | **Alguien pagó algo que no se cargó.** Es el hallazgo más valioso de esta etapa. |
      | `sin_respaldo` | Está en el sistema y no en el banco | Puede ser un desfasaje de fecha, o un pago que no se hizo |
      | `dudosa` | Emparejó por nivel 3 o 4 | La revisa una persona y confirma |

- [ ] **Paso 3: R28 — la conciliación NUNCA crea un trámite sola.** La función es pura y su tipo
      de retorno no tiene forma de crear nada. Si el sistema pudiera dar de alta un trámite a
      partir de un pago del banco, el listado dejaría de ser el registro de lo que se autorizó,
      que es su razón de ser `[fuente:21]`.

- [ ] **Paso 4: la salida justificada.** Una diferencia se puede pasar a `justificada` **con un
      motivo escrito** (lo exige un check).

      *Por qué hace falta:* el sitio del habitualista incluye operaciones de otras sucursales y de
      trámites que no pasaron por la plataforma. Si esas aparecen como diferencia todos los días,
      **el equipo aprende a ignorar la pantalla entera** — y ahí la conciliación deja de servir
      justo cuando aparezca la diferencia real.

**Verificación:** `conciliacion.test.ts` con un caso armado de cada una de las cuatro salidas, y
uno por cada nivel de la cascada.

---

## Tarea 3 — La bandeja y el sello

**Archivos:** `src/features/conciliacion/*`

- [ ] **Paso 1: la bandeja de diferencias**, agrupada por salida, con el monto total de cada
      grupo.
- [ ] **Paso 2: el sello (R29).** La pantalla dice **siempre** cuándo fue la última conciliación,
      y marca el saldo con `--warn` pasadas 24 horas. **El sello no se puede escribir a mano:** lo
      escribe la corrida.

      *Por qué esto es una tarea del plan y no un detalle:* es el corte del modo de falla número 1
      del índice §9. "El saldo está conciliado" escrito sin fecha es la repetición exacta del
      *"NO hay npm. Verificado"* del Tablero — una afirmación cierta un día que nadie vuelve a
      probar porque ya está escrita. Con el sello, la afirmación **caduca sola**.

- [ ] **Paso 3: `conciliaciones_corridas`, una fila por corrida, aunque dé cero diferencias.**

      Sin las corridas limpias, la serie de diferencias por mes empieza cuando el sistema ya
      funciona bien, y una serie así no prueba nada. Es un insumo del análisis de la etapa 4.

- [ ] **Paso 4: test con reloj falso** para el umbral de las 24 horas.

**Verificación:** mirar la pantalla al día siguiente sin conciliar y ver el saldo en ámbar.

---

## Cierre de la etapa

- [ ] Los cuatro comandos en 0.
- [ ] R24–R29 con evidencia al lado.
- [ ] **Una conciliación real, con el listado real del día, mirada por la contable.** El número de
      diferencias de esa primera corrida se anota en `docs/ESTADO.md`, sea el que sea. Si da
      feo, da feo: ése es el punto de partida honesto.
- [ ] Revisión independiente.
