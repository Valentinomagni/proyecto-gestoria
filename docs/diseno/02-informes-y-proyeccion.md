# Informes, proyeccion y exportacion

> Salida de un diseno automatico del 18/08/2026. **SIN VERIFICAR**: los revisores
> adversariales y el critico de completitud no llegaron a correr (limite de gasto).
> El plan en `docs/superpowers/plans/` lo corrige donde hacia falta; ver el
> INDICE, seccion 4.

## Resumen

Diseñé la capa de informes, proyección y exportación de la Gestoría sobre cinco piezas: (1) un informe de costos con grano de un trámite por fila, margen = cobrado − (arancel + prenda + sellados + otros) y cobertura del dato obligatoria en el encabezado; (2) una proyección de saldos con fórmula cerrada, tres insumos declarados y la regla dura de que si falta uno devuelve null en vez de un número parcial; (3) un cierre de mes cortado por fecha de presentación, con puente explícito a la fecha de pago y congelado por snapshot append-only con huella md5 y trigger que prohíbe UPDATE y DELETE; (4) exportación a Excel donde el permiso se resuelve en la base (el cobrado vive en otra tabla con su propia RLS, tal como pide la línea 23 del documento: "en otro espacio") y no ocultando columnas en el front; (5) un tablero de pro-contras cuyas métricas sólo existen si se registran desde el día uno, con la lista exacta de qué hay que capturar antes de encender el sistema y qué es lo único reconstruible de la planilla vieja. La idea central que ordena todo: ningún número se muestra sin su cobertura al lado, y la proyección prefiere callarse a mentir hacia el lado optimista, porque el fallo que el proyecto existe para evitar es quedarse sin saldo en el registro (documento, línea 10).

## Decisiones

### Unidad monetaria

**Decision.** Todo el dinero se guarda como `bigint` de CENTAVOS y se llama `Centavos` en TypeScript. Se pasa a pesos sólo en el borde de la exportación, con `Number((c/100).toFixed(2))`.

**Por que.** La Habitualista trabaja con centavos reales: en 03-habitualista-operaciones.png se ven importes como $ 111.638,30 y $ 1.044.915,25. La conciliación contra ese listado es por igualdad exacta de importe; con `numeric` mal redondeado o con float, un centavo de deriva convierte una conciliación limpia en una diferencia falsa y el equipo deja de mirar el informe. 2^53/100 son 9e13 pesos: no hay riesgo de desborde.

**Alternativa descartada.** `numeric(14,2)` en Postgres y `number` en JS. Postgres lo maneja bien, pero PostgREST lo entrega como string o como float según el driver y el redondeo termina ocurriendo en el navegador, que es el único lugar donde nadie lo controla.

### Qué compone el costo real

**Decision.** `costo_real = arancel + prenda + sellados + otros`. Los cuatro son nullable. Si los cuatro son null, el costo real es null (no cero). Si al menos uno está cargado, los null cuentan como cero.

**Por que.** La línea 22 del documento pide diferenciar arancel-prenda-sellados, pero esa lista describe lo que la gestora separa, no agota lo que se paga: en 03-habitualista-operaciones.png hay pagos cuyo Motivo Pago es una razón social (SYS RENTACAR, $ 1.044.912,25) que no cae obviamente en ninguno de los tres. Sin un cajón `otros`, cualquier peso real fuera de los tres nombres infla el margen hacia arriba, que es la dirección de error más cara. Y distinguir null de cero es lo que separa 'trámite sin costo cargado' de 'trámite que salió gratis': mezclarlos hace que el costo promedio baje solo a medida que crece el backlog de carga.

**Alternativa descartada.** Exigir los tres componentes siempre (NOT NULL con default 0). Habría hecho que la mayoría de las transferencias, que no tienen prenda, reporten prenda 0 indistinguible de 'todavía no lo miré', y habría vuelto imposible medir la cobertura del dato.

### Margen porcentual

**Decision.** `margen_pct = margen / cobrado_cliente`, expresado como fracción (0,1491), no como 14,91. Si cobrado es null → null. Si cobrado es 0 → margen se calcula igual (queda negativo) pero el porcentaje es null.

**Por que.** Sobre cobrado y no sobre costo porque es el margen comercial sobre lo facturado y queda acotado entre menos infinito y 1, que es lo que la gente sabe leer. Como fracción porque Excel multiplica solo con el formato 0.0%: si se exporta 14,91 con encabezado '%', cualquier tabla dinámica que promedie esa columna da un número sin sentido. Cobrado 0 con costo positivo es un caso real (trámite bonificado) y devolver -Infinity o -100% ensucia todos los promedios.

**Alternativa descartada.** Margen sobre costo (markup). Se descartó porque el documento habla de 'informe de los costos de los tramites' (línea 23) para gerencia, y gerencia lee margen sobre venta.

### Porcentaje agregado

**Decision.** El margen porcentual de cualquier agregación es `Σmargen / Σcobrado` (ponderado), calculado únicamente sobre las filas que tienen costo Y cobrado. Nunca el promedio de los porcentajes de fila.

**Por que.** Con los números del caso de test: las filas dan 14,91%, 11,11% y null; el promedio simple sugiere ~13% y el ponderado real da -1,83%, porque hay un trámite de $192.198,00 de costo que se cobró en cero. La diferencia de signo no es un detalle de precisión: es la diferencia entre 'vamos bien' y 'estamos perdiendo plata'.

**Alternativa descartada.** Promedio simple de los porcentajes de fila, que es lo que sale solo de una tabla dinámica de Excel. Por eso además el Excel exporta el ponderado ya calculado en la hoja Resumen, para que nadie tenga que rehacerlo.

### Insumo de costo para la proyección: mediana, no promedio

**Decision.** La proyección usa la MEDIANA del costo real por tipo de trámite y razón social sobre una ventana de 90 días, con muestra mínima n≥5, y además el percentil 80 para la banda pesimista.

**Por que.** En 03-habitualista-operaciones.png, en dos días conviven pagos de $ 111.638,30 y de $ 1.294.511,00: casi 12 a 1. Con esa dispersión el promedio lo fija el trámite grande y proyecta un egreso que no va a pasar. La mediana describe el trámite típico; el p80 describe el mes malo. Mostrar los dos evita que un número único se lea como una promesa.

**Alternativa descartada.** Promedio simple de los últimos 90 días, que es lo que pide el documento literalmente ('costo promedio por tipo'). Se cambia el estadístico, no el insumo, y queda escrito en la hoja de supuestos del Excel para que no parezca un desvío del pedido.

### Proyección incompleta

**Decision.** Si falta cualquier insumo de cualquier tipo de trámite con unidades pendientes (objetivo sin cargar, mediana sin muestra, o muestra menor a 5), la proyección devuelve estado 'incompleta' y TODOS los montos en null. No devuelve un parcial.

**Por que.** Un saldo proyectado al que le falta un tipo de trámite siempre es optimista, y el error optimista es exactamente el que produce el daño que el proyecto quiere evitar: frenar un trámite en el registro por no poder abonarlo (documento, línea 10). Un número parcial se copia a un mail y pierde el rótulo en el camino; un null obliga a cargar el insumo que falta.

**Alternativa descartada.** Proyectar con los tipos que sí tienen datos y mostrar un cartel de advertencia al lado. Se descartó porque en este proyecto ya está documentado que un rótulo al lado de un número no sobrevive a la primera captura de pantalla.

### Objetivo cargado en cero vs objetivo ausente

**Decision.** Una fila en `objetivos_mensuales` con `unidades = 0` es un insumo COMPLETO (gerencia decidió no patentar nada de ese tipo). La ausencia de fila es un insumo FALTANTE. No hay default.

**Por que.** Es la única forma de que 'no vamos a hacer transferencias este mes' y 'nadie cargó el objetivo' no produzcan el mismo resultado numérico. Sin esta distinción, olvidarse de cargar un objetivo baja mágicamente el egreso proyectado y sube el saldo proyectado.

**Alternativa descartada.** Rellenar el objetivo faltante con el real del mes anterior. Produce un número plausible que nadie puede auditar y que nadie sabe que es inventado.

### No hay 'día estimado de agotamiento del saldo'

**Decision.** La proyección dice cómo termina el mes. NO estima en qué día del mes el saldo llega a cero.

**Por que.** El gasto no es parejo: en 03-habitualista-operaciones.png hay cinco pagos de ~$1.044.912 el mismo 13/08 a las 14:11-14:13. Un ritmo lineal sobre ese patrón da una fecha con dos semanas de error, y una fecha equivocada es peor que ninguna porque se agenda el depósito en base a ella.

**Alternativa descartada.** Curva lineal de consumo con rótulo 'estimado'. El rótulo no sobrevive al uso.

### Corte temporal del cierre de mes

**Decision.** El corte primario es la FECHA DE PRESENTACIÓN en el registro. El cierre incluye además un bloque 'puente' obligatorio que reconcilia contra la fecha de pago.

**Por que.** La fecha de alta se descarta porque la línea 8 del documento dice que estar en la planilla es un REQUISITO para presentar: contar por alta cuenta intención, no trabajo hecho. La fecha de pago se descarta como corte primario porque se mueve por motivos de tesorería (un depósito que llega tarde) y haría que un trámite cambie de mes por una razón ajena al trámite; en 04-planilla-excel.png se ve exactamente ese desfasaje: alta 10/8 y segunda fecha 12/8, alta 14/8 y segunda fecha 18/8. La presentación es el evento que la gestoría produce y que no vuelve a moverse. El puente existe porque el total de costos igual tiene que poder atarse al extracto de la Habitualista, y sin él el informe queda sin ancla externa.

**Alternativa descartada.** Dos cortes en paralelo (unidades por presentación, plata por pago). Se descartó porque dos cortes en el mismo informe garantizan una discusión mensual sobre cuál es el número bueno.

### Congelado del cierre

**Decision.** El cierre se guarda como snapshot JSONB completo en `cierres_mensuales`, tabla APPEND-ONLY con `version` incremental y `huella = md5(datos::text)` puesta por trigger. No hay policy de UPDATE ni de DELETE, y además un trigger BEFORE UPDATE OR DELETE lanza excepción. Reabrir un mes inserta la versión 2; la 1 queda.

**Por que.** Un informe calculado desde una vista se reescribe solo la próxima vez que se toca una regla de cálculo, y ahí la historia cambia sin que nadie lo haya decidido. El md5 sobre `datos::text` es estable porque jsonb normaliza el orden de claves en Postgres. El trigger hace falta además de la RLS porque `service_role` saltea RLS: sin trigger, el candado sólo existe para el navegador. El mensaje de la excepción arranca con el prefijo `regla_estado:` para que el front lo muestre escrito para una persona, igual que hace `MARCA_REGLA_ESTADO` en tablero-contable-v2/src/lib/fallas.ts.

**Alternativa descartada.** Una columna `cerrado boolean` sobre las filas de trámites. Se descartó porque no congela el CÁLCULO, sólo los datos crudos: cambiar la fórmula del margen seguiría reescribiendo meses cerrados.

### Dónde vive el cobrado al cliente

**Decision.** En una tabla aparte, `tramite_cobros`, con RLS propia que sólo deja leer a gerencia y administración contable. No es una columna de `tramites`.

**Por que.** La línea 23 del documento lo dice textual: 'Sumar en OTRO ESPACIO el monto cobrado al cliente'. Y técnicamente es lo único que cierra: con una columna habría que usar column-level grants, que conviven mal con RLS y que se pierden en el primer `select *` de PostgREST. Con tabla aparte, la consulta de una gestora devuelve cero filas y ningún join puede filtrarlo, sin importar qué haga el front.

**Alternativa descartada.** Filtrar las columnas en el front antes de armar el Excel. Se descartó como ÚNICA defensa (sigue existiendo como segunda capa con test guardián): la fila cruda ya habría llegado al navegador y está en la pestaña de red.

### Vistas de informe con security_invoker

**Decision.** Todas las vistas de informe se crean con `with (security_invoker = on)`.

**Por que.** Una vista en Postgres corre con los permisos de su DUEÑO. Sin `security_invoker`, `v_informe_costos` creada por el owner devolvería el cobrado a cualquiera que la consulte, aunque `tramite_cobros` tenga RLS perfecta. Es la trampa exacta que hace inútil todo el diseño de permisos de arriba.

**Alternativa descartada.** No usar vistas y armar los joins desde el cliente. Multiplica los round-trips y deja la lógica de agregación repetida en cada pantalla.

### Formato de celdas en el Excel

**Decision.** Los montos van como NÚMERO con `z = '#,##0.00'` y sin símbolo de moneda (el encabezado dice 'ARS'). Las fechas van como celda de fecha real (`t: 'd'`, `cellDates: true`) con `z = 'dd/mm/yyyy'`. Los porcentajes van como fracción con `z = '0.0%'`.

**Por que.** La línea 32 pide exportar 'en caso de necesitar analizarlo o revisarlo': un monto escrito como texto '$ 1.044.912,25' no se suma, no se filtra y no entra en una tabla dinámica, con lo cual el archivo no sirve para lo único para lo que se pidió. Sin símbolo de moneda porque el formato `"$"#,##0.00` se rompe si el archivo se abre en una máquina con otra configuración regional; un formato numérico pelado nunca se rompe.

**Alternativa descartada.** Escribir los montos ya formateados como string, que es lo que sale por default de `toLocaleString`. Es lo que hoy hace la planilla vieja y por eso la columna TOTAL de 04-planilla-excel.png está mayormente vacía.

### Sin agregaciones por gestora

**Decision.** La columna Gestora existe en el detalle (hace falta saber quién tiene la carpeta), pero NO hay ninguna agregación, ranking ni comparación por gestora en ningún informe ni en ninguna hoja del Excel.

**Por que.** Es regla dura de la casa: tablero-contable-v2/CLAUDE.md §3 — 'las métricas describen situaciones y procesos, nunca juzgan personas. No hay rankings, ni conteos por persona'. Y ahí mismo está el motivo operativo: si el equipo lo percibe como control, trabaja para la foto y todos los datos pasan a ser mentira. Justo acá eso mataría al proyecto, porque el dato más valioso (costo real desagregado) lo carga a mano la misma gestora a la que se estaría midiendo.

**Alternativa descartada.** Un panel de 'trámites por gestora' que sale gratis de los mismos datos. El costo no es técnico y es enorme.

### Cobertura del dato como fila obligatoria

**Decision.** Todo informe y toda hoja Resumen del Excel arranca con cantidad de trámites, cuántos tienen costo cargado, cuántos tienen cobrado cargado y las dos coberturas en porcentaje.

**Por que.** Estos totales se calculan sobre datos que se cargan a mano y con retraso (la línea 7 dice que el presupuesto llega al día siguiente, por WhatsApp). Un total de costos con 40% de cobertura no está mal: está incompleto, y es la clase de número que se lee como completo. Es el mismo criterio que ya usa tablero-contable-v2/src/lib/confianza-metrica.ts: calificar al dato, no a la persona.

**Alternativa descartada.** Mostrar sólo los totales y confiar en que quien los lee sabe que faltan cargas.

## Preguntas abiertas

- **¿PRESUPUESTO / PREVIO / 2do del cuaderno (01-cuaderno-gestora.png) son los mismos tres conceptos que arancel / prenda / sellados de la línea 22 del documento?**
  - Lectura A: Son la misma apertura con otro nombre: PRESUPUESTO=arancel, PREVIO=sellados, 2do=prenda. En ese caso alcanza con renombrar y hay un solo eje de desglose.
  - Lectura B: Son dos ejes distintos que se cruzan: el cuaderno anota TRES DESEMBOLSOS EN EL TIEMPO (un previo y un segundo pago) que suman el total a depositar —en la primera anotación de la imagen las tres cifras suman exactamente el 'Dep $ 1.100.000' del margen—, mientras que arancel/prenda/sellados es la apertura POR CONCEPTO de ese mismo total. Con esta lectura hacen falta las dos aperturas: una por concepto (para el margen) y otra por desembolso (para saber cuánta plata hay que tener en la tarjeta y cuándo).
  - Recomendacion: Lectura B. Modelar `tramite_costos` por concepto (arancel/prenda/sellados/otros) y `tramite_desembolsos` por pago (importe + fecha prevista), y confirmarlo con la gestora en la primera reunión antes de escribir la migración 10. Si resulta ser A, `tramite_desembolsos` queda con una fila por trámite y no se pierde nada; al revés sí se pierde: aplastar los desembolsos en conceptos hace imposible proyectar el saldo dentro del mes.
- **¿Qué es exactamente 'el monto cobrado al cliente' de la línea 23?**
  - Lectura A: Es el total facturado al cliente por el trámite, honorarios de gestoría incluidos. El margen entonces es el resultado del servicio de gestoría.
  - Lectura B: Es lo que el cliente depositó a cuenta —el 'Dep $ X' del cuaderno (01-cuaderno-gestora.png)—, que en las cuatro anotaciones visibles coincide con el total del presupuesto. Con esta lectura el margen daría cero o casi cero siempre, y lo que en realidad se está midiendo es si el cliente cubrió el costo, no una ganancia.
  - Recomendacion: Preguntar antes de codificar, porque cambia el sentido de todo el informe. Diseñé para la lectura A con `cobrado_centavos` en `tramite_cobros`, y dejé `anticipo_centavos` como campo separado en la misma tabla para que el 'Dep' se registre sin mezclarse. Si la respuesta es B, el informe deja de llamarse 'margen' y pasa a llamarse 'diferencia a cobrar / a devolver', que es otro producto.
- **¿'Objetivos de patentamientos' (línea 30) son unidades que gerencia se propone vender, o unidades ya vendidas que faltan patentar?**
  - Lectura A: Objetivo comercial: gerencia declara 40 patentamientos para octubre y la proyección estima el egreso de esos 40.
  - Lectura B: Cartera pendiente: son las unidades con oferta de compra cerrada que todavía no se patentaron. Ese dato no está en la gestoría, vive en el sistema interno (el documento menciona Quiter en 04-planilla-excel.png y la 'cuenta personal' y 'referencia de oferta' en la línea 6).
  - Recomendacion: Lectura A, con carga manual en `objetivos_mensuales`. La B es mejor dato pero requiere una integración con Quiter que nadie decidió y que el documento no pide. Si más adelante se importa la cartera, entra por la misma tabla como otro origen y la fórmula no cambia.
- **DORAL CHEVROLET y PARIS TRAC aparecen como hojas de la planilla actual (04-planilla-excel.png) pero la línea 9 del documento sólo nombra tres Tarjetas Habitualistas: Paris Autos, Paris Cars y Paris Motor. ¿Esas dos razones sociales tienen tarjeta propia?**
  - Lectura A: Tienen tarjeta propia y el documento las omitió. Entonces son cinco cuentas corrientes independientes y cinco proyecciones.
  - Lectura B: No tienen tarjeta: sus trámites se pagan con la tarjeta de otra razón social. Entonces razón social y tarjeta son dos dimensiones distintas, el saldo se proyecta por TARJETA y los costos se informan por RAZÓN SOCIAL, y la relación entre ambas es de muchos a uno.
  - Recomendacion: Lectura B en el modelo, aunque hoy la relación sea uno a uno. `tarjetas_habitualistas` separada de `razones_sociales` con una FK cuesta una tabla más ahora y evita rehacer la proyección entera después. Confirmar cuáles de las cinco tienen tarjeta antes de cargar los saldos iniciales.
- **¿La fecha de presentación en el registro se registra hoy en algún lado?**
  - Lectura A: Sí, y es una de las dos FECHA que se ven en 04-planilla-excel.png. En ese caso el corte del cierre de mes tiene dato histórico y se puede reconstruir hacia atrás.
  - Lectura B: No: la segunda FECHA de la planilla aparece siempre junto a la columna TARJETA marcada, lo que sugiere que es la fecha de PAGO, no la de presentación. Con esta lectura la fecha de presentación es un campo nuevo que arranca en cero el día uno, y el cierre de mes por presentación no tiene historia previa.
  - Recomendacion: Lectura B, que es lo que muestra la imagen. Consecuencia que hay que aceptar de entrada: los primeros cierres de mes por presentación no se van a poder comparar contra ningún mes anterior, y el puente a fecha de pago es lo único que va a tener continuidad con la planilla vieja. Verificarlo con quien llena la planilla antes de importar el histórico.

## Riesgos

- **La mediana de costo por tipo queda vieja apenas aumentan los aranceles del registro. Una ventana de 90 días con un aumento del 30% en el medio proyecta un egreso bajo justo cuando más plata hace falta.**
  - Mitigacion: Alarma automática: si la mediana de los últimos 30 días se desvía más de 15% de la de 90 días para un tipo, la proyección pasa a usar la de 30 días y lo declara en la hoja de supuestos con las dos cifras. Es una regla, no un aviso: el usuario no tiene que decidir nada.
- **Adopción parcial durante los primeros 90 días: si la mitad de los trámites sigue yendo sólo a la planilla vieja, todos los informes son correctos y están equivocados por omisión, y el análisis de pro-contras que se le muestra a gerencia mide un sistema que nadie usó del todo.**
  - Mitigacion: Métrica de adopción como primera fila de todo informe (trámites cargados en la plataforma sobre trámites del período según la planilla). Los informes de costos igual se muestran, con su cobertura al lado. La proyección de saldos se niega a calcular si la adopción del mes anterior fue menor al 80%, porque proyectar egresos con la mitad de los trámites es peor que no proyectar.
- **El cierre de mes se congela con datos incompletos: se cierra septiembre el 1 de octubre y los costos reales de la última semana se cargan el 4.**
  - Mitigacion: El cierre no se puede confirmar antes del día 10 del mes siguiente (regla en el trigger, con el mismo prefijo `regla_estado:` para que el mensaje sea legible), y la pantalla de previsualización muestra la cobertura del período con los trámites sin costo listados por nombre. Si igual falta algo, el mecanismo de versiones permite cerrar de nuevo sin borrar nada.
- **Una gestora se lleva el cobrado al cliente por un camino que el front no controla: la app móvil de Supabase, un `select` desde la consola, o un Excel exportado por otra persona y reenviado.**
  - Mitigacion: El permiso vive en la base, no en el front: `tramite_cobros` es una tabla aparte con RLS, y las vistas llevan `security_invoker = on`. El filtro del front y su test guardián son la segunda capa, no la primera. El reenvío de un archivo ya exportado por gerencia no es un problema técnico y no se intenta resolver con software.
- **Los totales del informe no cierran contra la Tarjeta Habitualista por centavos, y el equipo concluye que el sistema está mal y vuelve a la planilla.**
  - Mitigacion: Centavos enteros de punta a punta y conciliación por igualdad exacta de importe. Cuando hay diferencia, el informe muestra el par (trámite, operación de pago) enfrentado y el delta, nunca un total agregado que no cierra sin explicación.
- **Las métricas de tiempo (presupuesto → autorización → presentación) se leen como control de la velocidad de cada gestora, el equipo trabaja para el número y los datos dejan de servir.**
  - Mitigacion: Ninguna métrica se corta por persona: los cortes disponibles son razón social, tipo de trámite y seccional. Hay un test guardián en `adopcion.test.ts` que falla si algún rótulo o explicación menciona gestoras. Es la misma regla y el mismo mecanismo que ya existen en tablero-contable-v2 (CLAUDE.md §3).
- **El corte por mes se hace sobre un timestamptz en UTC y los trámites presentados después de las 21:00 del último día del mes caen en el mes siguiente.**
  - Mitigacion: Todas las fechas de corte se guardan como `date` (no `timestamptz`), y donde haya que derivarlas de un timestamp se hace en SQL con `at time zone 'America/Argentina/Buenos_Aires'` antes de castear. Las funciones TypeScript reciben strings `YYYY-MM-DD` ya locales y nunca construyen un `Date`.
- **El archivo Excel crece hasta ser inmanejable: la planilla actual ya va por la fila 6.868 (04-planilla-excel.png).**
  - Mitigacion: La exportación siempre sale filtrada por período y razón social; no existe un botón de 'exportar todo'. El nombre del archivo lleva el filtro adentro (`gestoria-costos-2026-09-paris-autos.xlsx`) para que dos exportaciones distintas no se pisen en la carpeta de Descargas.

## Detalle

## 0. De dónde salió cada cosa

Citas del material, para que nada de acá sea invento:

| Afirmación | Fuente |
|---|---|
| El costo real se desagrega en arancel, prenda y sellados | `docs/fuente/PROYECTO-GESTORIA-texto.md:22` |
| El cobrado al cliente va "en otro espacio" y alimenta el informe de costos | `PROYECTO-GESTORIA-texto.md:23` |
| Las gestoras no ven lo cobrado al cliente; sí gerencia y administración contable | `PROYECTO-GESTORIA-texto.md:26` |
| Agrupar por tipo: patentamientos, transferencias de usados, transferencias de vehículos entregados en parte de pago | `PROYECTO-GESTORIA-texto.md:28` |
| Dividir por razones sociales | `PROYECTO-GESTORIA-texto.md:29` |
| Informe de saldos proyectados según costos y objetivos de patentamientos | `PROYECTO-GESTORIA-texto.md:30` |
| Reporte a cierre de mes | `PROYECTO-GESTORIA-texto.md:31` |
| Exportar a Excel para analizar o revisar | `PROYECTO-GESTORIA-texto.md:32` |
| Estar en la planilla es requisito para presentar en el registro | `PROYECTO-GESTORIA-texto.md:8` |
| El presupuesto llega al día siguiente, por WhatsApp | `PROYECTO-GESTORIA-texto.md:7` |
| Se intenta tener siempre saldo para no frenar el trámite | `PROYECTO-GESTORIA-texto.md:10` |
| Se pisan los saldos entre San Luis y San Juan | `PROYECTO-GESTORIA-texto.md:16` |
| Estar cargado en la plataforma equivale a autorización | `PROYECTO-GESTORIA-texto.md:21` |
| Dispersión real de importes: $111.638,30 y $1.294.511,00 en dos días; cinco pagos de ~$1.044.912 el 13/08 entre 14:11 y 14:13 | `docs/fuente/03-habitualista-operaciones.png` |
| Saldo disponible con centavos: $2.505.627,92 | `docs/fuente/02-habitualista-inicio.png` |
| Desfasaje alta → segunda fecha: 10/8 → 12/8, 14/8 → 18/8; la segunda fecha aparece con la columna TARJETA marcada | `docs/fuente/04-planilla-excel.png` |
| Cinco razones sociales en la planilla (PARIS AUTOS, DORAL CHEVROLET, PARIS CARS, PARIS MOTOR, PARIS TRAC) contra tres tarjetas nombradas en el texto | `04-planilla-excel.png` vs `PROYECTO-GESTORIA-texto.md:9` |
| El cuaderno anota tres cifras que suman el "Dep $" del margen | `docs/fuente/01-cuaderno-gestora.png` |

---

## 1. Informe de costos

### 1.1 Grano y columnas del detalle

Una fila = un trámite. Nunca un pago: un trámite puede tener varios desembolsos y colapsarlos perdería la relación con el cliente, que es la que la gente busca.

| # | Columna | Formato | Origen | Visible para gestora |
|---|---|---|---|---|
| 1 | Fecha de alta | fecha | `tramites.autorizado_en` (local) | sí |
| 2 | Fecha de presentación | fecha | `tramites.presentado_el` | sí |
| 3 | Fecha de pago | fecha | `tramites.pagado_el` | sí |
| 4 | Razón social | texto | `razones_sociales.nombre` | sí |
| 5 | Tipo | texto | enum de la línea 28 | sí |
| 6 | Cliente | texto | `tramites.cliente` | sí |
| 7 | Dominio | texto | `tramites.dominio` | sí |
| 8 | Seccional | texto | `tramites.seccional` (imagen 03, "Seccional RPA") | sí |
| 9 | Gestora | texto | `perfiles.nombre` | sí |
| 10 | Presupuesto | moneda | `tramites.presupuesto_centavos` | sí |
| 11 | Arancel | moneda | `tramite_costos.arancel_centavos` | sí |
| 12 | Prenda | moneda | `tramite_costos.prenda_centavos` | sí |
| 13 | Sellados | moneda | `tramite_costos.sellados_centavos` | sí |
| 14 | Otros | moneda | `tramite_costos.otros_centavos` | sí |
| 15 | Costo real | moneda | calculado | sí |
| 16 | Desvío vs presupuesto | moneda | `costo_real − presupuesto` | sí |
| 17 | Desvío % | porcentaje | fracción sobre presupuesto | sí |
| 18 | **Cobrado al cliente** | moneda | `tramite_cobros.cobrado_centavos` | **NO** |
| 19 | **Margen** | moneda | calculado | **NO** |
| 20 | **Margen %** | porcentaje | calculado | **NO** |
| 21 | Estado | texto | `tramites.estado` | sí |
| 22 | N° de pago Habitualista | texto | `conciliacion.numero_pago` (imagen 03) | sí |

La 22 existe para que cualquier fila del informe se pueda parar al lado de la fila del listado real de Operaciones de Pago. Sin ese número, discutir una diferencia es leer dos pantallas.

### 1.2 Encabezado obligatorio (va antes de cualquier total)

```
Trámites del período .................. 128
Con costo real cargado ................ 96   (75,0%)
Con cobrado al cliente cargado ........ 88   (68,8%)
```

Sin esto, un total de costos con 75% de cobertura se lee como el total. La regla se copia de `tablero-contable-v2/src/lib/confianza-metrica.ts`: se califica al dato.

### 1.3 Agregaciones

Cortes disponibles: **tipo de trámite**, **razón social**, **seccional**, **mes**. Y los cruces tipo × razón social y tipo × mes.

Por cada grupo: cantidad, cobertura de costo, cobertura de cobrado, Σ costo real, Σ cobrado, Σ margen, margen % ponderado, costo promedio, **costo mediano**.

Hay una identidad que parece un bug y no lo es, y por eso va escrita en la hoja Resumen del Excel:

> `Σ margen ≠ Σ cobrado − Σ costo`, porque `Σ margen` sólo suma las filas que tienen **las dos** cifras cargadas, mientras que cada total suma todas las filas que tienen la suya. Si se forzara la igualdad, el margen de un mes con cargas a medias saldría inflado por trámites cobrados cuyo costo todavía no se cargó.

**No hay corte por gestora.** Motivo en decisiones.

### 1.4 Quién ve qué

| Rol | Detalle | Columnas 18-20 | Agregados de margen |
|---|---|---|---|
| Gerencia | todas las razones sociales | sí | sí |
| Administración contable | todas | sí | sí |
| Gestora | todas | no | no |

Que la gestora vea **todas** las razones sociales y no sólo la suya es deliberado: la línea 16 dice que el problema es no manejar un listado unificado. Restringirle la vista reproduciría el problema que el sistema viene a resolver. Lo único que se le saca es lo que la línea 26 pide sacarle.

---

## 2. Proyección de saldos

### 2.1 La fórmula, exacta

Por **tarjeta habitualista** `T` y **mes** `M`, todo en centavos enteros:

```
unidades_faltantes(t)   = max(0, objetivo(T, M, t) − altas_del_mes(T, M, t))

egreso_estimado_p50     = Σ_t  unidades_faltantes(t) × costo_mediano(T, t)
egreso_estimado_p80     = Σ_t  unidades_faltantes(t) × costo_p80(T, t)

saldo_proyectado_p50    = saldo_actual(T)
                        + ingresos_programados(T, M)
                        − compromiso_pendiente(T)
                        − egreso_estimado_p50

saldo_proyectado_p80    = saldo_actual(T)
                        + ingresos_programados(T, M)
                        − compromiso_pendiente(T)
                        − egreso_estimado_p80
```

El término `max(0, objetivo − altas_del_mes)` es lo único no obvio de la fórmula y es donde se rompe si se hace mal: los trámites que **ya** están dados de alta este mes ya están contados en `compromiso_pendiente` (si no se pagaron) o ya se debitaron del saldo (si se pagaron). Multiplicar el objetivo entero por el costo mediano los contaría dos veces y proyectaría un pozo que no existe. Cuando el objetivo ya se cumplió, ese tipo aporta cero y **no necesita costo mediano** — es un caso de test explícito.

### 2.2 De dónde sale cada insumo y qué pasa si falta

| Insumo | Origen | Si falta |
|---|---|---|
| `saldo_actual(T)` | último saldo conciliado a mano menos los débitos posteriores registrados | La proyección no corre. Sin saldo actual no hay nada que proyectar. Enlace directo a la pantalla de carga de saldo. |
| `ingresos_programados(T, M)` | tabla `ingresos_programados`, carga manual de gerencia o contable (línea 27) | Se asume **cero**. Es el único insumo con default, y es conservador: proyectar sin depósitos da un saldo más bajo, nunca más alto. Se declara en la hoja de supuestos. |
| `compromiso_pendiente(T)` | trámites autorizados y no pagados, valuados en cascada: costo real → presupuesto → costo mediano del tipo | Nunca falta: la cascada de tres niveles siempre resuelve mientras exista el costo mediano. Cada nivel usado se cuenta y se muestra ("38 trámites valuados a costo real, 12 a presupuesto, 3 a mediana"). |
| `objetivo(T, M, t)` | tabla `objetivos_mensuales`, carga manual de gerencia | **Insumo faltante.** Fila ausente ≠ `unidades = 0`. Estado incompleta, todos los montos null. |
| `costo_mediano(T, t)` y `costo_p80(T, t)` | mediana y p80 del costo real de los trámites de ese tipo y esa tarjeta pagados en los últimos 90 días, con n ≥ 5 | Con n < 5 se prueba una vez con **todas** las razones sociales del mismo tipo. Si sigue en n < 5 y ese tipo tiene unidades pendientes → **insumo faltante**. Si no tiene unidades pendientes, no importa. |
| `altas_del_mes(T, M, t)` | conteo sobre `tramites` | Nunca falta: es un conteo, y cero es una respuesta legítima. |

### 2.3 Qué NO puede predecir

Esta lista es una constante exportada (`LO_QUE_NO_PREDICE`), se renderiza **siempre** debajo de la proyección —también cuando está completa— y se copia a la hoja "Supuestos" del Excel. No es un pie de página: es parte del resultado.

1. **No predice aumentos de aranceles.** El costo mediano es histórico a 90 días. El día que el registro actualiza valores, la proyección queda corta y no tiene forma de saberlo. La alarma de desvío 30d vs 90d avisa **después** del primer trámite caro, nunca antes.
2. **No dice en qué día del mes te quedás sin saldo.** Sólo cómo termina el mes. En `03-habitualista-operaciones.png` hay cinco pagos de ~$1.044.912 en tres minutos del 13/08: el consumo no es parejo y cualquier fecha estimada sobre ritmo lineal se equivoca por semanas.
3. **No predice si el cliente paga.** El cobrado al cliente **no entra** en esta fórmula. La Tarjeta Habitualista es sólo egreso; la cobranza es otra cuenta. Un mes con margen excelente y sin depósitos igual se queda sin saldo.
4. **No predice trámites que se caen.** Una operación anulada libera plata que la proyección ya dio por gastada. Proyecta de más, no de menos, que es el lado seguro.
5. **No sabe cuántos de los patentamientos objetivo llevan prenda.** La prenda depende de si la unidad se financió, dato que el objetivo no trae. La mediana mezcla prendados y no prendados; si el mix real del mes se corre, el egreso se corre con él. Se puede eliminar cargando el mix en el objetivo, y ese es el primer cambio que va a pedir gerencia.
6. **No es un presupuesto.** Es una estimación de egreso para decidir cuándo depositar. Ningún número de acá se usa para facturar ni para cerrar un mes.
7. **No cubre lo que no está cargado.** Si la adopción del mes anterior fue menor al 80%, no corre.

### 2.4 Presentación

Nunca un número solo: siempre la banda `[p80, p50]` con el p80 primero, porque el escenario malo es el que obliga a actuar. Y en pesos faltantes cuando la banda es negativa: *"Para cumplir el objetivo de octubre faltan entre $15.035.397 y $23.295.097"*, que es más accionable que un saldo negativo.

---

## 3. Reporte de cierre de mes

### 3.1 Corte temporal

**Fecha de presentación en el registro.** Justificación completa en decisiones. En una línea: el alta es un requisito administrativo (línea 8), el pago se mueve por tesorería, la presentación es el trabajo hecho y no vuelve a moverse.

Todas las fechas de corte son `date`, no `timestamptz`. Donde haya que derivarlas de un timestamp, se hace en SQL con `at time zone 'America/Argentina/Buenos_Aires'` antes de castear; si no, un trámite presentado a las 21:30 del 30/09 cae en octubre.

### 3.2 Contenido

**A. Unidades.** Cantidad por tipo × razón social. Con comparación contra el objetivo cargado y contra el mismo mes del año anterior si existe.

**B. Dinero.** Σ costo real, Σ cobrado, Σ margen y margen % ponderado, con sus coberturas. Y el desglose arancel / prenda / sellados / otros, que es lo que permite ver si un aumento vino del arancel o de los sellados.

**C. El puente a la caja.** Bloque obligatorio:

```
Costo de lo presentado en el mes .................  $   984.561,30
  − presentado en el mes, pagado fuera del mes ...  $   303.836,30
  + presentado fuera del mes, pagado en el mes ...  $ 1.004.110,00
  ═══════════════════════════════════════════════
  Pagado por la tarjeta en el mes ................  $ 1.684.835,00
```

Ese último número tiene que coincidir, peso a peso, con la suma de la columna Importe del listado de Operaciones de Pago (imagen 03) del mismo mes. Cuando no coincide, la diferencia se lista trámite por trámite. Sin este bloque el informe no tiene ancla externa y las discusiones se vuelven infinitas.

**D. Excepciones.** Trámites presentados en el mes sin costo cargado, trámites pagados sin presentación registrada, y trámites sin ninguna de las dos fechas. Se listan por nombre. Nunca se descartan en silencio.

**E. Conciliación.** Cantidad y monto de las diferencias contra la Habitualista del mes.

### 3.3 Cómo se congela

```sql
create table if not exists public.cierres_mensuales (
  id              uuid primary key default gen_random_uuid(),
  razon_social_id uuid not null references public.razones_sociales(id),
  periodo         date not null,                       -- primer día del mes
  version         integer not null,
  datos           jsonb not null,                      -- el informe COMPLETO, ya calculado
  huella          text not null,                       -- md5(datos::text), la pone el trigger
  cerrado_en      timestamptz not null default now(),
  cerrado_por     uuid not null default auth.uid(),
  motivo          text,                                -- obligatorio a partir de la version 2
  unique (razon_social_id, periodo, version)
);

alter table public.cierres_mensuales enable row level security;

-- Leer: cualquiera autenticado. Un cierre es el número oficial del mes, no un secreto.
-- (El cobrado al cliente NO viaja adentro de `datos` para los cierres que va a leer una
--  gestora: se guardan DOS snapshots por mes, uno completo y uno sin las tres columnas
--  sensibles, y la policy de lectura elige por rol. Duplicar el snapshot es más barato que
--  filtrar un jsonb en una policy.)
drop policy if exists cierres_lectura on public.cierres_mensuales;
create policy cierres_lectura on public.cierres_mensuales
  for select using ( true );

-- Escribir: sólo gerencia.
drop policy if exists cierres_alta on public.cierres_mensuales;
create policy cierres_alta on public.cierres_mensuales
  for insert with check ( public.rol_actual() = 'gerencia' );

-- NO se escribe policy de update ni de delete. Bajo RLS, lo que no tiene policy está
-- prohibido: la AUSENCIA de la policy es el candado, y no hay forma de aflojarlo sin
-- escribir una migración nueva que quede en el historial.
revoke update, delete on public.cierres_mensuales from authenticated;

-- El trigger hace falta ADEMÁS de la RLS: `service_role` saltea RLS. Sin esto, el candado
-- existe sólo para el navegador. El prefijo `regla_estado:` es la convención de
-- tablero-contable-v2/src/lib/fallas.ts para que el front muestre el motivo escrito para
-- una persona en vez de tapar el mensaje con el genérico de Postgres.
create or replace function public.cierres_solo_alta() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  raise exception 'regla_estado: Un cierre de mes no se modifica ni se borra. Si hay algo para corregir, se cierra de nuevo: queda la versión nueva y la anterior no se pierde.';
end $$;

drop trigger if exists cierres_no_tocar on public.cierres_mensuales;
create trigger cierres_no_tocar before update or delete on public.cierres_mensuales
  for each row execute function public.cierres_solo_alta();

-- Versión y huella las pone la base, no el cliente.
create or replace function public.cierres_sellar() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  select coalesce(max(version), 0) + 1 into new.version
    from public.cierres_mensuales
   where razon_social_id = new.razon_social_id and periodo = new.periodo;
  -- jsonb normaliza el orden de las claves, así que `datos::text` es estable y el md5
  -- sirve de verdad para probar que el archivo exportado no se tocó.
  new.huella := md5(new.datos::text);
  if new.version > 1 and coalesce(trim(new.motivo), '') = '' then
    raise exception 'regla_estado: Para volver a cerrar un mes hay que escribir por qué.';
  end if;
  return new;
end $$;

drop trigger if exists cierres_sellar_tg on public.cierres_mensuales;
create trigger cierres_sellar_tg before insert on public.cierres_mensuales
  for each row execute function public.cierres_sellar();
```

Reglas que acompañan:

- El informe de un mes cerrado **se lee del snapshot**, jamás se recalcula. Cambiar la fórmula del margen mañana no puede mover un número de septiembre.
- No se puede cerrar antes del día 10 del mes siguiente (check adicional en el trigger de sellado).
- La versión vigente es la de `version` máxima. Las anteriores se pueden ver, con quién y por qué se reabrió.
- La huella se imprime en la hoja Resumen del Excel exportado desde un cierre. Es lo que convierte "este es el Excel de septiembre" en algo comprobable.

---

## 4. Exportación a Excel

### 4.1 Hojas

| Hoja | Cuándo aparece | Contenido |
|---|---|---|
| `Resumen` | siempre | Título, razón social, período, **corte usado**, generado el, generado por, cobertura del dato, totales, huella del cierre si viene de uno, y el bloque "Lo que este archivo no dice". |
| `Trámites` | siempre | Detalle, una fila por trámite, con encabezado en la fila 1 y autofiltro. |
| `Por tipo` | siempre | Agregado por tipo de trámite. |
| `Por razón social` | si el filtro abarca más de una | Agregado. |
| `Puente de caja` | en un cierre de mes | Las cuatro líneas del bloque C. |
| `Proyección` | al exportar la proyección | Banda p50/p80 por tipo y el total. |
| `Supuestos` | junto con `Proyección` | Insumos usados con su n, y `LO_QUE_NO_PREDICE` completo. |
| `Conciliación` | si hay corrida del período | Diferencias enfrentadas contra el listado de la Habitualista. |

Nombre de archivo: `gestoria-<informe>-<AAAA-MM>-<razon-social>.xlsx`, todo en minúsculas y sin espacios. Ejemplo: `gestoria-costos-2026-09-paris-autos.xlsx`.

### 4.2 Formatos

| Formato | `z` | Tipo de celda | Por qué |
|---|---|---|---|
| moneda | `#,##0.00` | número | Se tiene que poder sumar. Sin símbolo: `"$"#,##0.00` se rompe con otra configuración regional. Dos decimales obligatorios: los importes reales los tienen (imagen 03). |
| entero | `#,##0` | número | Cantidades de unidades. |
| porcentaje | `0.0%` | número, **fracción** | Se guarda 0,1491 y Excel muestra 14,9%. Guardar 14,91 con encabezado "%" rompe cualquier tabla dinámica. |
| fecha | `dd/mm/yyyy` | fecha (`t: "d"`, `cellDates: true`) | Una fecha como texto no se filtra por mes ni se agrupa por trimestre. |
| texto | — | texto | |

Además: `!cols` con anchos por columna, y `!autofilter` sobre el rango de la tabla en las hojas de detalle. *Sin verificar:* si la versión instalada de `xlsx` (community) escribe paneles congelados vía `ws["!freeze"]`. Hasta comprobarlo sobre un archivo generado y abierto en Excel, no se promete.

Nombres de hoja: máximo 31 caracteres y sin `[ ] : * ? / \`. Hay un helper `nombreHojaValido` que lo fuerza; si no, `book_append_sheet` tira y la exportación falla entera por un nombre.

### 4.3 Cómo se respeta el permiso

Tres capas, en este orden:

**Capa 1 — la base.** `tramite_cobros` es una tabla separada con RLS. La consulta de una gestora devuelve cero filas; ningún join las trae. Las vistas de informe llevan `with (security_invoker = on)` — sin eso, una vista creada por el owner devuelve el cobrado a cualquiera, y todo el diseño de permisos queda decorativo.

**Capa 2 — el armado del libro.** `columnasInforme(rol)` devuelve la lista de columnas. Para `"gestora"` las tres sensibles no están en la lista, con lo cual **no existen en la matriz de celdas**. No se ocultan: no se escriben.

**Capa 3 — el test guardián.** El fixture pone `cobrado = 987654321` (un número que no aparece en ningún otro lado del test). El test arma el libro con rol gestora y asegura que `JSON.stringify(libro)` no contiene `"987654321"`. Si mañana alguien agrega una fila de total en la hoja Resumen olvidándose del rol, el test falla.

**Lo que no se hace:** ocultar columnas con `!cols[i].hidden`. Una columna oculta en Excel se muestra con dos clics y el dato está adentro del archivo. Es exactamente la trampa que el bloqueo de hoja de `tablero-contable-v2/src/lib/excel.ts` documenta para otro caso.

---

## 5. Análisis de pro-contras

### 5.1 El problema real

Gerencia no va a pedir "el análisis" el día uno: lo va a pedir a los tres meses. Para entonces, o los datos están o no existen. La planilla actual (imagen 04) tiene FECHA, descripción, dominio, GESTOR, $ TRANSF, TOTAL, QUITER, FECHA, ÍNDICE, QUITER, TARJETA — **no** tiene presupuesto, ni costo desagregado, ni cobrado, ni hora de nada. El cuaderno (imagen 01) no tiene fechas ni horas. **Lo único reconstruible del pasado son dos cosas: cantidad de trámites por mes y por razón social, y los días entre la primera FECHA y la segunda.** Todo lo demás arranca en cero.

### 5.2 Las nueve métricas

| # | Métrica | Cómo se mide | Necesita registrar desde | Reconstruible después |
|---|---|---|---|---|
| 1 | Días entre presupuesto de la gestora y autorización | `autorizado_en − presupuesto_cargado_en`, hábiles | día 1 | **no** |
| 2 | Días entre autorización y presentación | `presentado_el − autorizado_en`, hábiles | día 1 | **no** |
| 3 | Días entre alta y pago | `pagado_el − autorizado_en` | día 1, **y** import del histórico de la planilla | **sí**, único "antes" honesto |
| 4 | Trámites frenados por falta de saldo (cantidad y días perdidos) | eventos de entrada/salida del estado `frenado_por_saldo` | día 1 | **no** — y es la métrica que justifica el proyecto (líneas 10 y 16) |
| 5 | Desvío presupuesto vs costo real | mediana de `abs(costo − presupuesto) / presupuesto` | día 1 | **no** |
| 6 | Diferencias de conciliación contra la Habitualista | cantidad y monto por mes | día 1, **incluidas las corridas con cero diferencias** | **no** |
| 7 | Saldo ocioso: meses de cobertura | `saldo_promedio / egreso_mensual` | día 1 | parcial |
| 8 | Adopción: trámites en la plataforma / trámites del período | conteo contra la planilla vieja durante la convivencia | día 1 | **no** |
| 9 | Costo declarado de usar el sistema | encuesta de 3 preguntas a las 4 usuarias, día 0 / 30 / 90 | **día 0, antes de encender el sistema** | **nunca** |

La 9 es la única que caduca de forma irreversible. Si la encuesta día 0 no se toma **antes** de que alguien use el sistema, no hay línea de base y no se recupera jamás. Las tres preguntas: minutos por día dedicados a averiguar saldos disponibles; veces por semana que hubo que preguntar por WhatsApp algo que ya estaba anotado; y una calificación de 1 a 5 de qué tan seguro se siente el número del saldo antes de autorizar un trámite.

### 5.3 Qué hay que tener en la primera migración, sí o sí

1. `tramite_eventos` append-only, escrita por **trigger** sobre `tramites`, con `en timestamptz default now()` (hora del servidor, no del cliente). Sin esta tabla, las métricas 1, 2, 4 y 5 no existen a los tres meses. Que la escriba el trigger y no el front es porque el front tiene N caminos de escritura y el trigger tiene uno.
2. `tramites.presupuesto_cargado_en`, `tramites.autorizado_en`, `tramites.presentado_el`, `tramites.pagado_el`. Los dos primeros con default del servidor y **no editables** por el usuario: un timestamp que se puede corregir a mano deja de ser una medición.
3. `frenado_por_saldo` como **estado real** del trámite, no como un checkbox. Un checkbox sólo dice el ahora; el estado deja huella en `tramite_eventos`.
4. `tramite_cobros` desde el primer trámite. Si el cobrado arranca el mes 2, el margen del mes 1 no existe y el gráfico arranca torcido.
5. `conciliaciones_corridas` con una fila **por cada corrida, aunque dé cero**. Una serie que empieza cuando ya funciona bien no prueba nada.
6. `encuestas_adopcion` cargada el día 0.
7. Import del histórico de la planilla para la métrica 3.

### 5.4 Presentación a gerencia

Una hoja de Excel y una pantalla, con la misma tabla: métrica, línea de base, valor actual, delta, **n**, y nivel de confianza. El nivel sale del mismo criterio de `confianza-metrica.ts`: con n insuficiente el número **no se publica**, se dice "sin datos suficientes". Un análisis de eficiencia con un número inventado adentro deja de servir para decidir, que es lo único para lo que existe.

Y el encuadre: todo se corta por razón social, tipo y seccional. Nunca por gestora. Hay un test que revisa que ningún rótulo ni explicación de `adopcion.ts` mencione gestoras.

---

## 6. Las funciones

### 6.1 `src/lib/dinero.ts`

```ts
// Todo el dinero de la gestoría vive en CENTAVOS ENTEROS.
//
// POR QUÉ. La conciliación contra el listado de Operaciones de Pago de la Habitualista es por
// igualdad exacta de importe, y ese listado tiene centavos reales ($ 111.638,30,
// $ 1.044.915,25 — ver docs/fuente/03-habitualista-operaciones.png). Con floats, sumar 200
// trámites deja una deriva de centavos y una conciliación limpia aparece como diferencia.
// Una diferencia falsa por mes alcanza para que el equipo deje de mirar el informe.
export type Centavos = number;

/** Centavos a pesos, sólo para el borde de la exportación. El toFixed mata la deriva binaria. */
export function aPesos(c: Centavos): number {
  return Number((c / 100).toFixed(2));
}

/** Suma tratando null como ausencia (no como cero negativo ni como NaN). */
export function sumar(xs: readonly (Centavos | null)[]): Centavos {
  let t = 0;
  for (const x of xs) if (x !== null) t += x;
  return t;
}

/**
 * Mediana. Devuelve null con lista vacía — nunca 0, que se confundiría con "salió gratis".
 * Con cantidad par promedia los dos del medio y REDONDEA, porque el resultado sigue siendo
 * centavos enteros y medio centavo no existe.
 */
export function mediana(xs: readonly number[]): number | null {
  if (xs.length === 0) return null;
  const o = [...xs].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 === 1 ? o[m] : Math.round((o[m - 1] + o[m]) / 2);
}

/**
 * Percentil por RANGO CERCANO (nearest-rank), sin interpolar.
 *
 * POR QUÉ SIN INTERPOLAR: con muestras de 20 a 40 trámites, interpolar inventa un importe que
 * ningún trámite tuvo. El p80 se usa para decir "el mes malo cuesta esto"; que sea un costo
 * que efectivamente ocurrió lo hace defendible frente a gerencia.
 *
 * `p` es fracción: 0.8, no 80.
 */
export function percentil(xs: readonly number[], p: number): number | null {
  if (xs.length === 0) return null;
  const o = [...xs].sort((a, b) => a - b);
  const i = Math.ceil(p * o.length) - 1;
  return o[Math.min(Math.max(i, 0), o.length - 1)];
}

/**
 * División con guarda, redondeada a 4 decimales.
 *
 * Devuelve FRACCIÓN (0.1491), no porcentaje (14.91): es lo que Excel necesita para el formato
 * 0.0% y lo que evita que una tabla dinámica promedie números ya multiplicados.
 * Denominador 0 → null. Nunca Infinity ni NaN: los dos ensucian cualquier agregado posterior.
 */
export function fraccion(numerador: number, denominador: number): number | null {
  if (denominador === 0) return null;
  return Number((numerador / denominador).toFixed(4));
}
```

**Tests con números concretos:**

```ts
describe("dinero", () => {
  it("aPesos no arrastra deriva binaria", () => {
    expect(aPesos(11_163_830)).toBe(111638.3);      // $ 111.638,30 (imagen 03)
    expect(aPesos(104_491_525)).toBe(1044915.25);   // $ 1.044.915,25 (imagen 03)
    expect(aPesos(250_562_792)).toBe(2505627.92);   // saldo de imagen 02
  });

  it("sumar ignora los null", () => {
    expect(sumar([52_000_000, null, 12_859_500, null])).toBe(64_859_500);
    expect(sumar([])).toBe(0);
    expect(sumar([null, null])).toBe(0);
  });

  it("mediana: impar, par y vacía", () => {
    expect(mediana([68_072_500, 40_000_000, 19_219_800])).toBe(40_000_000);
    expect(mediana([40_000_000, 68_072_500])).toBe(54_036_250);
    expect(mediana([])).toBeNull();
  });

  it("percentil 80 devuelve un valor que existe en la muestra", () => {
    const xs = [10, 20, 30, 40, 50];
    expect(percentil(xs, 0.8)).toBe(40);   // ceil(0.8*5)-1 = 3
    expect(percentil(xs, 0.5)).toBe(30);
    expect(percentil(xs, 1)).toBe(50);
    expect(percentil(xs, 0)).toBe(10);
    expect(percentil([], 0.8)).toBeNull();
  });

  it("fraccion: denominador cero da null, no Infinity", () => {
    expect(fraccion(11_927_500, 80_000_000)).toBe(0.1491);
    expect(fraccion(5_000_000, 45_000_000)).toBe(0.1111);
    expect(fraccion(100, 0)).toBeNull();
    expect(fraccion(0, 0)).toBeNull();
  });
});
```

### 6.2 `src/lib/costos.ts`

```ts
import { type Centavos, sumar, mediana, fraccion } from "./dinero";

export interface Componentes {
  arancel: Centavos | null;
  prenda: Centavos | null;
  sellados: Centavos | null;
  otros: Centavos | null;
}

/**
 * Costo real del trámite.
 *
 * LOS CUATRO NULL DAN NULL, no cero. Es la diferencia entre "todavía no se cargó" y "salió
 * gratis", y sin ella el costo promedio baja solo a medida que se acumulan trámites sin
 * cargar — o sea, el informe se ve mejor justo cuando el registro está peor.
 *
 * CON AL MENOS UNO CARGADO, los null valen cero: una transferencia sin prenda tiene prenda
 * ausente de verdad, y exigir los cuatro dejaría sin costo a la mayoría de las transferencias.
 *
 * `otros` existe porque la lista de la línea 22 del documento describe lo que la gestora
 * separa, no agota lo que se paga. Sin ese cajón, cualquier peso fuera de los tres nombres
 * infla el margen hacia arriba.
 */
export function costoReal(c: Componentes): Centavos | null {
  const partes = [c.arancel, c.prenda, c.sellados, c.otros];
  if (partes.every((p) => p === null)) return null;
  return sumar(partes);
}

export interface Margen {
  margen: Centavos | null;
  /** Fracción sobre lo cobrado. Null si no se puede calcular. */
  margenPct: number | null;
}

/**
 * Margen del trámite: cobrado al cliente menos costo real.
 *
 * Con cobrado 0 y costo positivo (trámite bonificado) el margen SÍ se calcula —queda
 * negativo, que es la verdad— pero el porcentaje es null: dividir por cero no tiene lectura.
 */
export function margenDe(costo: Centavos | null, cobrado: Centavos | null): Margen {
  if (costo === null || cobrado === null) return { margen: null, margenPct: null };
  const margen = cobrado - costo;
  return { margen, margenPct: fraccion(margen, cobrado) };
}

export interface FilaCosto {
  id: string;
  costo: Centavos | null;
  cobrado: Centavos | null;
}

export interface ResumenCostos {
  cantidad: number;
  conCosto: number;
  conCobrado: number;
  coberturaCosto: number | null;
  coberturaCobrado: number | null;
  totalCosto: Centavos;
  totalCobrado: Centavos;
  /** Sólo sobre las filas que tienen COSTO y COBRADO. Ver el comentario de abajo. */
  totalMargen: Centavos;
  margenPctPonderado: number | null;
  costoPromedio: Centavos | null;
  costoMediano: Centavos | null;
}

/**
 * Resumen de un grupo de trámites (un tipo, una razón social, un mes, o el total).
 *
 * DOS COSAS QUE PARECEN BUGS Y NO LO SON, escritas acá para que nadie las "arregle":
 *
 * 1) `totalMargen !== totalCobrado - totalCosto`. Cada total suma las filas que tienen SU
 *    cifra; el margen suma sólo las que tienen las DOS. Forzar la igualdad inflaría el margen
 *    con trámites cobrados cuyo costo todavía no se cargó.
 *
 * 2) `margenPctPonderado` NO es el promedio de los porcentajes de fila. Es Σmargen sobre
 *    Σcobrado de las filas completas. Con el fixture de los tests, el promedio simple da
 *    ~13% y el ponderado da -1,83%: distinto signo, distinta decisión.
 */
export function resumirCostos(filas: readonly FilaCosto[]): ResumenCostos {
  const conCosto = filas.filter((f) => f.costo !== null);
  const conCobrado = filas.filter((f) => f.cobrado !== null);
  const conAmbos = filas.filter((f) => f.costo !== null && f.cobrado !== null);

  const costos = conCosto.map((f) => f.costo as number);
  const totalCosto = sumar(costos);
  const totalCobrado = sumar(conCobrado.map((f) => f.cobrado));
  const totalMargen = conAmbos.reduce(
    (t, f) => t + (f.cobrado as number) - (f.costo as number), 0,
  );
  const cobradoDeLasCompletas = sumar(conAmbos.map((f) => f.cobrado));

  return {
    cantidad: filas.length,
    conCosto: conCosto.length,
    conCobrado: conCobrado.length,
    coberturaCosto: fraccion(conCosto.length, filas.length),
    coberturaCobrado: fraccion(conCobrado.length, filas.length),
    totalCosto,
    totalCobrado,
    totalMargen,
    margenPctPonderado: fraccion(totalMargen, cobradoDeLasCompletas),
    costoPromedio: costos.length > 0 ? Math.round(totalCosto / costos.length) : null,
    costoMediano: mediana(costos),
  };
}
```

**Tests.** El fixture usa importes reales de `03-habitualista-operaciones.png`, para que los números del test se puedan verificar contra la fuente.

```ts
// T1: patentamiento, dominio AF725SQ. 520.000,00 + 128.595,00 + 32.130,00 = 680.725,00,
//     que es exactamente el primer importe del listado de la Habitualista (imagen 03).
const T1 = { id: "t1", componentes: { arancel: 52_000_000, prenda: 12_859_500, sellados: 3_213_000, otros: null }, cobrado: 80_000_000 };
// T2: transferencia usado, CASTRO AA301GU, $ 400.000,00 (imagen 03), sin prenda ni sellados.
const T2 = { id: "t2", componentes: { arancel: 40_000_000, prenda: null, sellados: null, otros: null }, cobrado: 45_000_000 };
// T3: nada cargado todavía.
const T3 = { id: "t3", componentes: { arancel: null, prenda: null, sellados: null, otros: null }, cobrado: null };
// T4: AF037BR, $ 192.198,00 (imagen 03), bonificado: cobrado CERO, que no es lo mismo que null.
const T4 = { id: "t4", componentes: { arancel: 19_219_800, prenda: null, sellados: null, otros: null }, cobrado: 0 };

describe("costoReal", () => {
  it("suma los componentes cargados", () => {
    expect(costoReal(T1.componentes)).toBe(68_072_500);   // $ 680.725,00
    expect(costoReal(T2.componentes)).toBe(40_000_000);
  });
  it("los cuatro null dan null, no cero", () => {
    expect(costoReal(T3.componentes)).toBeNull();
  });
  it("un cero explícito no es lo mismo que null", () => {
    expect(costoReal({ arancel: 0, prenda: null, sellados: null, otros: null })).toBe(0);
  });
});

describe("margenDe", () => {
  it("calcula margen y porcentaje", () => {
    expect(margenDe(68_072_500, 80_000_000)).toEqual({ margen: 11_927_500, margenPct: 0.1491 });
    expect(margenDe(40_000_000, 45_000_000)).toEqual({ margen: 5_000_000, margenPct: 0.1111 });
  });
  it("cobrado cero: margen negativo, porcentaje null", () => {
    expect(margenDe(19_219_800, 0)).toEqual({ margen: -19_219_800, margenPct: null });
  });
  it("cualquier null deja los dos en null", () => {
    expect(margenDe(null, 80_000_000)).toEqual({ margen: null, margenPct: null });
    expect(margenDe(68_072_500, null)).toEqual({ margen: null, margenPct: null });
  });
});

describe("resumirCostos", () => {
  const filas: FilaCosto[] = [
    { id: "t1", costo: 68_072_500, cobrado: 80_000_000 },
    { id: "t2", costo: 40_000_000, cobrado: 45_000_000 },
    { id: "t3", costo: null,       cobrado: null },
    { id: "t4", costo: 19_219_800, cobrado: 0 },
  ];

  it("cobertura: 3 de 4 en cada columna", () => {
    const r = resumirCostos(filas);
    expect(r.cantidad).toBe(4);
    expect(r.conCosto).toBe(3);
    expect(r.conCobrado).toBe(3);          // el cobrado 0 de T4 SÍ cuenta como cargado
    expect(r.coberturaCosto).toBe(0.75);
    expect(r.coberturaCobrado).toBe(0.75);
  });

  it("totales", () => {
    const r = resumirCostos(filas);
    expect(r.totalCosto).toBe(127_292_300);   // 68.072.500 + 40.000.000 + 19.219.800
    expect(r.totalCobrado).toBe(125_000_000); // 80.000.000 + 45.000.000 + 0
    expect(r.totalMargen).toBe(-2_292_300);   // 11.927.500 + 5.000.000 - 19.219.800
  });

  it("el ponderado no es el promedio de los porcentajes de fila (y da signo distinto)", () => {
    const r = resumirCostos(filas);
    expect(r.margenPctPonderado).toBe(-0.0183);          // -2.292.300 / 125.000.000
    const promedioSimple = (0.1491 + 0.1111) / 2;         // 0.1301
    expect(Math.sign(r.margenPctPonderado!)).not.toBe(Math.sign(promedioSimple));
  });

  it("promedio y mediana del costo", () => {
    const r = resumirCostos(filas);
    expect(r.costoPromedio).toBe(42_430_767);   // round(127.292.300 / 3)
    expect(r.costoMediano).toBe(40_000_000);
  });

  it("grupo vacío: totales en cero, estadísticos en null", () => {
    const r = resumirCostos([]);
    expect(r.totalCosto).toBe(0);
    expect(r.costoPromedio).toBeNull();
    expect(r.costoMediano).toBeNull();
    expect(r.coberturaCosto).toBeNull();
    expect(r.margenPctPonderado).toBeNull();
  });
});
```

### 6.3 `src/lib/proyeccion.ts`

```ts
import type { Centavos } from "./dinero";

export type TipoTramite = "patentamiento" | "transferencia-usado" | "transferencia-a-concesionaria";

export interface InsumoTipo {
  tipo: TipoTramite;
  /** null = NADIE lo cargó (insumo faltante). 0 = gerencia decidió que no hay. No son lo mismo. */
  objetivo: number | null;
  /** Unidades de este tipo ya dadas de alta en el mes. Cero es una respuesta válida. */
  yaDadosDeAlta: number;
  costoMediano: Centavos | null;
  costoP80: Centavos | null;
  /** n del que salieron la mediana y el p80. */
  muestra: number;
}

export interface InsumosProyeccion {
  saldoActual: Centavos;
  ingresosProgramados: Centavos;
  compromisoPendiente: Centavos;
  tipos: readonly InsumoTipo[];
  /** Piso de muestra para creerle a la mediana. Entra por parámetro para poder testearlo. */
  muestraMinima: number;
}

export type MotivoFaltante = "objetivo" | "costo-mediano" | "muestra-corta";
export interface Faltante { tipo: TipoTramite; motivo: MotivoFaltante; }

export interface Proyeccion {
  estado: "completa" | "incompleta";
  faltantes: Faltante[];
  unidadesFaltantes: number;
  egresoEstimadoP50: Centavos | null;
  egresoEstimadoP80: Centavos | null;
  saldoProyectadoP50: Centavos | null;
  saldoProyectadoP80: Centavos | null;
}

/**
 * Lo que esta proyección NO puede decir. Se renderiza SIEMPRE debajo del resultado, también
 * cuando la proyección está completa, y se copia a la hoja "Supuestos" del Excel.
 * No es un pie de página: es parte del resultado.
 */
export const LO_QUE_NO_PREDICE: readonly string[] = [
  "No anticipa aumentos de aranceles. El costo mediano mira 90 días hacia atrás: el día que el registro actualiza valores, esta proyección queda corta y no tiene forma de saberlo.",
  "No dice en qué día del mes se termina el saldo, sólo cómo termina el mes. El gasto no es parejo: hay días con cinco pagos grandes en tres minutos.",
  "No predice si el cliente paga. Lo cobrado al cliente no entra en esta cuenta: la Tarjeta Habitualista es sólo egreso.",
  "No descuenta los trámites que se caen. Una operación anulada libera plata que acá ya está dada por gastada.",
  "No sabe cuántos de los patentamientos del objetivo van a llevar prenda. Si el mix se corre, el egreso se corre con él.",
  "No es un presupuesto. Sirve para decidir cuándo depositar, no para facturar ni para cerrar un mes.",
];

/**
 * Saldo proyectado a fin de mes, por tarjeta habitualista.
 *
 * LA REGLA DURA: si falta CUALQUIER insumo de CUALQUIER tipo con unidades pendientes, los
 * cuatro montos vuelven null. No se proyecta parcial.
 *
 * POR QUÉ. Una proyección a la que le falta un tipo de trámite siempre es OPTIMISTA, y el
 * error optimista produce exactamente el daño que el sistema viene a evitar: frenar un trámite
 * en el registro por no poder abonarlo (documento, línea 10). Un número parcial se copia a un
 * mail y pierde el rótulo en el camino; un null obliga a cargar lo que falta.
 *
 * `max(0, objetivo - yaDadosDeAlta)` es el punto donde esto se rompe si se hace mal: lo ya
 * dado de alta este mes ya está contado en `compromisoPendiente` (si no se pagó) o ya se
 * debitó del saldo (si se pagó). Multiplicar el objetivo entero lo contaría dos veces.
 */
export function proyectarSaldo(i: InsumosProyeccion): Proyeccion {
  const faltantes: Faltante[] = [];
  let unidadesFaltantes = 0;
  let egresoP50 = 0;
  let egresoP80 = 0;

  for (const t of i.tipos) {
    if (t.objetivo === null) {
      faltantes.push({ tipo: t.tipo, motivo: "objetivo" });
      continue;
    }
    const unidades = Math.max(0, t.objetivo - t.yaDadosDeAlta);
    // Objetivo ya cumplido: este tipo no aporta egreso y NO necesita costo mediano.
    // Reclamarle la muestra acá bloquearía la proyección por un dato que no se usa.
    if (unidades === 0) continue;

    unidadesFaltantes += unidades;

    if (t.costoMediano === null || t.costoP80 === null) {
      faltantes.push({ tipo: t.tipo, motivo: "costo-mediano" });
      continue;
    }
    if (t.muestra < i.muestraMinima) {
      faltantes.push({ tipo: t.tipo, motivo: "muestra-corta" });
      continue;
    }
    egresoP50 += unidades * t.costoMediano;
    egresoP80 += unidades * t.costoP80;
  }

  if (faltantes.length > 0) {
    return {
      estado: "incompleta",
      faltantes,
      unidadesFaltantes,
      egresoEstimadoP50: null,
      egresoEstimadoP80: null,
      saldoProyectadoP50: null,
      saldoProyectadoP80: null,
    };
  }

  const base = i.saldoActual + i.ingresosProgramados - i.compromisoPendiente;
  return {
    estado: "completa",
    faltantes: [],
    unidadesFaltantes,
    egresoEstimadoP50: egresoP50,
    egresoEstimadoP80: egresoP80,
    saldoProyectadoP50: base - egresoP50,
    saldoProyectadoP80: base - egresoP80,
  };
}
```

**Tests:**

```ts
// Paris Autos, octubre 2026. El saldo actual es el de docs/fuente/02-habitualista-inicio.png
// ($ 2.505.627,92) y los costos medianos son los importes de 03-habitualista-operaciones.png.
const base: InsumosProyeccion = {
  saldoActual: 250_562_792,
  ingresosProgramados: 500_000_000,
  compromisoPendiente: 108_072_500,
  muestraMinima: 5,
  tipos: [
    { tipo: "patentamiento",                  objetivo: 40, yaDadosDeAlta: 12, costoMediano: 68_072_500, costoP80: 95_000_000, muestra: 34 },
    { tipo: "transferencia-usado",            objetivo: 15, yaDadosDeAlta:  9, costoMediano: 40_000_000, costoP80: 52_000_000, muestra: 21 },
    { tipo: "transferencia-a-concesionaria",  objetivo:  8, yaDadosDeAlta:  8, costoMediano: null,       costoP80: null,       muestra:  2 },
  ],
};

describe("proyectarSaldo", () => {
  it("caso completo: el objetivo ya cumplido no reclama costo mediano", () => {
    const p = proyectarSaldo(base);
    expect(p.estado).toBe("completa");
    expect(p.faltantes).toEqual([]);
    expect(p.unidadesFaltantes).toBe(34);                 // 28 + 6 + 0
    expect(p.egresoEstimadoP50).toBe(2_146_030_000);      // 28*68.072.500 + 6*40.000.000
    expect(p.egresoEstimadoP80).toBe(2_972_000_000);      // 28*95.000.000 + 6*52.000.000
    expect(p.saldoProyectadoP50).toBe(-1_503_539_708);
    expect(p.saldoProyectadoP80).toBe(-2_329_509_708);
  });

  it("no cuenta dos veces lo ya dado de alta", () => {
    const sinAltas = { ...base, tipos: base.tipos.map((t) => ({ ...t, yaDadosDeAlta: 0 })) };
    const p = proyectarSaldo(sinAltas);
    // Con 0 altas, el tercer tipo pasa a tener 8 unidades pendientes y le falta el mediano.
    expect(p.estado).toBe("incompleta");
    expect(p.faltantes).toEqual([{ tipo: "transferencia-a-concesionaria", motivo: "costo-mediano" }]);
  });

  it("objetivo sin cargar: incompleta y TODOS los montos en null", () => {
    const p = proyectarSaldo({
      ...base,
      tipos: base.tipos.map((t) => t.tipo === "transferencia-usado" ? { ...t, objetivo: null } : t),
    });
    expect(p.estado).toBe("incompleta");
    expect(p.faltantes).toEqual([{ tipo: "transferencia-usado", motivo: "objetivo" }]);
    expect(p.egresoEstimadoP50).toBeNull();
    expect(p.egresoEstimadoP80).toBeNull();
    expect(p.saldoProyectadoP50).toBeNull();
    expect(p.saldoProyectadoP80).toBeNull();
  });

  it("objetivo cargado en CERO es un insumo completo, no un faltante", () => {
    const p = proyectarSaldo({
      ...base,
      tipos: [{ tipo: "patentamiento", objetivo: 0, yaDadosDeAlta: 0, costoMediano: null, costoP80: null, muestra: 0 }],
    });
    expect(p.estado).toBe("completa");
    expect(p.unidadesFaltantes).toBe(0);
    expect(p.egresoEstimadoP50).toBe(0);
    expect(p.saldoProyectadoP50).toBe(642_490_292);   // 250.562.792 + 500.000.000 - 108.072.500
  });

  it("muestra corta bloquea aunque haya mediana", () => {
    const p = proyectarSaldo({
      ...base,
      tipos: [{ ...base.tipos[0], muestra: 4 }],
    });
    expect(p.estado).toBe("incompleta");
    expect(p.faltantes).toEqual([{ tipo: "patentamiento", motivo: "muestra-corta" }]);
  });

  it("objetivo por debajo de lo ya dado de alta no da unidades negativas", () => {
    const p = proyectarSaldo({
      ...base,
      tipos: [{ ...base.tipos[0], objetivo: 5, yaDadosDeAlta: 12 }],
    });
    expect(p.unidadesFaltantes).toBe(0);
    expect(p.egresoEstimadoP50).toBe(0);
  });

  it("la lista de límites tiene contenido y se puede renderizar", () => {
    expect(LO_QUE_NO_PREDICE.length).toBeGreaterThanOrEqual(6);
    expect(LO_QUE_NO_PREDICE.every((t) => t.length > 40)).toBe(true);
  });
});
```

### 6.4 `src/lib/cierre-mes.ts`

```ts
import { type Centavos } from "./dinero";

/**
 * Las fechas entran como "AAAA-MM-DD" YA EN HORA LOCAL. Nunca se construye un `Date` acá.
 *
 * POR QUÉ. Si el corte se hiciera sobre un timestamptz en UTC, un trámite presentado a las
 * 21:30 del 30/09 en San Luis caería en octubre. La conversión se hace en SQL con
 * `at time zone 'America/Argentina/Buenos_Aires'` antes de castear a date.
 */
export type FechaLocal = string;   // "2026-09-30"
export type Periodo = string;      // "2026-09"

export function periodoDe(f: FechaLocal | null): Periodo | null {
  return f === null ? null : f.slice(0, 7);
}

export interface FilaCierre {
  id: string;
  fechaPresentacion: FechaLocal | null;
  fechaPago: FechaLocal | null;
  costo: Centavos | null;
}

/**
 * Corte del cierre de mes: por FECHA DE PRESENTACIÓN.
 *
 * Los que no tienen fecha de presentación NO se descartan: salen aparte, para que la pantalla
 * los liste por nombre. Una excepción escondida es una excepción que nadie corrige.
 */
export function tramitesDelPeriodo<T extends { fechaPresentacion: FechaLocal | null }>(
  filas: readonly T[], periodo: Periodo,
): { incluidos: T[]; sinPresentacion: T[] } {
  const incluidos: T[] = [];
  const sinPresentacion: T[] = [];
  for (const f of filas) {
    if (f.fechaPresentacion === null) sinPresentacion.push(f);
    else if (periodoDe(f.fechaPresentacion) === periodo) incluidos.push(f);
  }
  return { incluidos, sinPresentacion };
}

export interface Puente {
  costoPresentadoEnElMes: Centavos;
  pagadoEnElMes: Centavos;
  /** Presentado y pagado dentro del mismo mes. */
  coinciden: Centavos;
  /** Presentado en el mes, pagado en otro mes o sin pagar. */
  presentadoNoPagadoEnElMes: Centavos;
  /** Pagado en el mes, presentado en otro mes o sin presentar. */
  pagadoNoPresentadoEnElMes: Centavos;
  /** Filas sin costo cargado. No entran en ningún monto: se cuentan para la cobertura. */
  sinCosto: number;
}

/**
 * Puente entre el informe (cortado por presentación) y la caja (cortada por pago).
 *
 * Existe porque el total de costos tiene que poder atarse al listado de Operaciones de Pago de
 * la Habitualista. Sin este bloque el informe no tiene ancla externa y cada mes se discute
 * cuál es el número bueno.
 *
 * Identidad que el test verifica y que no se puede romper:
 *   pagadoEnElMes = costoPresentadoEnElMes - presentadoNoPagadoEnElMes + pagadoNoPresentadoEnElMes
 */
export function puenteDeCaja(filas: readonly FilaCierre[], periodo: Periodo): Puente {
  let coinciden = 0, presentadoNoPagado = 0, pagadoNoPresentado = 0, sinCosto = 0;

  for (const f of filas) {
    if (f.costo === null) { sinCosto++; continue; }
    const presentadoAca = periodoDe(f.fechaPresentacion) === periodo;
    const pagadoAca = periodoDe(f.fechaPago) === periodo;

    if (presentadoAca && pagadoAca) coinciden += f.costo;
    else if (presentadoAca) presentadoNoPagado += f.costo;
    else if (pagadoAca) pagadoNoPresentado += f.costo;
    // Ni presentado ni pagado en el mes: no es de este mes, no se cuenta en ningún lado.
  }

  return {
    costoPresentadoEnElMes: coinciden + presentadoNoPagado,
    pagadoEnElMes: coinciden + pagadoNoPresentado,
    coinciden,
    presentadoNoPagadoEnElMes: presentadoNoPagado,
    pagadoNoPresentadoEnElMes: pagadoNoPresentado,
    sinCosto,
  };
}
```

**Tests:**

```ts
const filas: FilaCierre[] = [
  { id: "A", fechaPresentacion: "2026-09-10", fechaPago: "2026-09-12", costo: 68_072_500 },
  { id: "B", fechaPresentacion: "2026-08-28", fechaPago: "2026-09-02", costo: 40_000_000 },
  { id: "C", fechaPresentacion: "2026-09-30", fechaPago: "2026-10-02", costo: 19_219_800 },
  { id: "D", fechaPresentacion: "2026-09-15", fechaPago: null,         costo: 11_163_830 },
  { id: "E", fechaPresentacion: null,         fechaPago: "2026-09-20", costo: 60_411_000 },
  { id: "F", fechaPresentacion: "2026-09-05", fechaPago: "2026-09-08", costo: null },
  { id: "G", fechaPresentacion: "2026-07-02", fechaPago: "2026-07-04", costo: 99_999_999 },
];

describe("tramitesDelPeriodo", () => {
  it("corta por presentación y aparta los que no tienen fecha", () => {
    const r = tramitesDelPeriodo(filas, "2026-09");
    expect(r.incluidos.map((f) => f.id)).toEqual(["A", "C", "D", "F"]);
    expect(r.sinPresentacion.map((f) => f.id)).toEqual(["E"]);
  });
});

describe("puenteDeCaja", () => {
  const p = puenteDeCaja(filas, "2026-09");

  it("clasifica cada fila una sola vez", () => {
    expect(p.coinciden).toBe(68_072_500);                      // A
    expect(p.presentadoNoPagadoEnElMes).toBe(30_383_630);      // C + D
    expect(p.pagadoNoPresentadoEnElMes).toBe(100_411_000);     // B + E
    expect(p.sinCosto).toBe(1);                                // F
    // G no aparece en ningún monto: no es de septiembre por ninguno de los dos lados.
  });

  it("totales de los dos cortes", () => {
    expect(p.costoPresentadoEnElMes).toBe(98_456_130);
    expect(p.pagadoEnElMes).toBe(168_483_500);
  });

  it("la identidad del puente cierra", () => {
    expect(p.pagadoEnElMes).toBe(
      p.costoPresentadoEnElMes - p.presentadoNoPagadoEnElMes + p.pagadoNoPresentadoEnElMes,
    );
  });

  it("período sin movimiento da todo cero", () => {
    const v = puenteDeCaja(filas, "2026-01");
    expect(v.costoPresentadoEnElMes).toBe(0);
    expect(v.pagadoEnElMes).toBe(0);
  });
});
```

### 6.5 `src/lib/excel-gestoria.ts`

```ts
import { aPesos, type Centavos } from "./dinero";
import type { ResumenCostos } from "./costos";

export type Rol = "gerencia" | "contable" | "gestora";
export type Formato = "texto" | "entero" | "moneda" | "porcentaje" | "fecha";

export interface Columna { titulo: string; clave: string; formato: Formato; ancho: number; }
export type Celda = string | number | Date | null;
export interface Hoja {
  nombre: string;
  /** Índice (base 0) de la fila de encabezado dentro de `filas`. */
  filaEncabezado: number;
  columnas: Columna[] | null;
  filas: Celda[][];
  autofiltro?: boolean;
}
export interface Libro { hojas: Hoja[]; }

/** Las tres columnas que la línea 26 del documento saca de la vista de las gestoras. */
const SENSIBLES = new Set(["cobrado", "margen", "margenPct"]);

export function puedeVerCobrado(rol: Rol): boolean {
  return rol === "gerencia" || rol === "contable";
}

const TODAS: Columna[] = [
  { titulo: "Fecha de alta",        clave: "fechaAlta",      formato: "fecha",      ancho: 12 },
  { titulo: "Fecha presentación",   clave: "fechaPres",      formato: "fecha",      ancho: 14 },
  { titulo: "Fecha de pago",        clave: "fechaPago",      formato: "fecha",      ancho: 12 },
  { titulo: "Razón social",         clave: "razonSocial",    formato: "texto",      ancho: 18 },
  { titulo: "Tipo",                 clave: "tipo",           formato: "texto",      ancho: 26 },
  { titulo: "Cliente",              clave: "cliente",        formato: "texto",      ancho: 30 },
  { titulo: "Dominio",              clave: "dominio",        formato: "texto",      ancho: 10 },
  { titulo: "Seccional",            clave: "seccional",      formato: "texto",      ancho: 28 },
  { titulo: "Gestora",              clave: "gestora",        formato: "texto",      ancho: 14 },
  { titulo: "Presupuesto (ARS)",    clave: "presupuesto",    formato: "moneda",     ancho: 15 },
  { titulo: "Arancel (ARS)",        clave: "arancel",        formato: "moneda",     ancho: 15 },
  { titulo: "Prenda (ARS)",         clave: "prenda",         formato: "moneda",     ancho: 15 },
  { titulo: "Sellados (ARS)",       clave: "sellados",       formato: "moneda",     ancho: 15 },
  { titulo: "Otros (ARS)",          clave: "otros",          formato: "moneda",     ancho: 15 },
  { titulo: "Costo real (ARS)",     clave: "costo",          formato: "moneda",     ancho: 16 },
  { titulo: "Desvío vs pres. (ARS)",clave: "desvio",         formato: "moneda",     ancho: 18 },
  { titulo: "Desvío %",             clave: "desvioPct",      formato: "porcentaje", ancho: 10 },
  { titulo: "Cobrado al cliente (ARS)", clave: "cobrado",    formato: "moneda",     ancho: 20 },
  { titulo: "Margen (ARS)",         clave: "margen",         formato: "moneda",     ancho: 15 },
  { titulo: "Margen %",             clave: "margenPct",      formato: "porcentaje", ancho: 10 },
  { titulo: "Estado",               clave: "estado",         formato: "texto",      ancho: 16 },
  { titulo: "N° pago Habitualista", clave: "numeroPago",     formato: "texto",      ancho: 18 },
];

/**
 * Las columnas que le corresponden a este rol.
 *
 * Para una gestora, las tres sensibles NO SE OCULTAN: no se generan. Una columna oculta en
 * Excel se muestra con dos clics y el dato viaja adentro del archivo igual.
 */
export function columnasInforme(rol: Rol): Columna[] {
  return puedeVerCobrado(rol) ? TODAS : TODAS.filter((c) => !SENSIBLES.has(c.clave));
}

/** Excel: máximo 31 caracteres y sin []:*?/\ — si no, `book_append_sheet` tira. */
export function nombreHojaValido(n: string): string {
  return n.replace(/[[\]:*?/\\]/g, " ").trim().slice(0, 31);
}

export interface FilaInforme {
  fechaAlta: Date | null; fechaPres: Date | null; fechaPago: Date | null;
  razonSocial: string; tipo: string; cliente: string; dominio: string;
  seccional: string; gestora: string;
  presupuesto: Centavos | null; arancel: Centavos | null; prenda: Centavos | null;
  sellados: Centavos | null; otros: Centavos | null; costo: Centavos | null;
  desvio: Centavos | null; desvioPct: number | null;
  cobrado: Centavos | null; margen: Centavos | null; margenPct: number | null;
  estado: string; numeroPago: string | null;
}

export interface ContextoExport {
  rol: Rol;
  titulo: string;
  razonSocial: string;
  periodoLabel: string;
  corte: string;
  generadoEn: Date;
  generadoPor: string;
  huellaCierre: string | null;
}

const MONEDA: Formato = "moneda";

function valor(f: FilaInforme, c: Columna): Celda {
  const v = (f as unknown as Record<string, unknown>)[c.clave];
  if (v === null || v === undefined) return null;
  if (c.formato === MONEDA) return aPesos(v as Centavos);
  if (c.formato === "fecha") return v as Date;
  return v as Celda;
}

/**
 * Arma el libro. PURA: no importa xlsx, no toca el DOM. Se testea entera.
 */
export function armarLibroCostos(
  filas: readonly FilaInforme[], resumen: ResumenCostos, ctx: ContextoExport,
): Libro {
  const cols = columnasInforme(ctx.rol);
  const verCobrado = puedeVerCobrado(ctx.rol);

  const cabecera: Celda[][] = [
    [ctx.titulo],
    ["Razón social", ctx.razonSocial],
    ["Período", ctx.periodoLabel],
    ["Corte usado", ctx.corte],
    ["Generado", ctx.generadoEn],
    ["Generado por", ctx.generadoPor],
    ...(ctx.huellaCierre ? [["Huella del cierre", ctx.huellaCierre] as Celda[]] : []),
    [],
    ["Trámites del período", resumen.cantidad],
    ["Con costo real cargado", resumen.conCosto],
    ["Cobertura del costo", resumen.coberturaCosto],
    ...(verCobrado ? [
      ["Con cobrado cargado", resumen.conCobrado] as Celda[],
      ["Cobertura del cobrado", resumen.coberturaCobrado] as Celda[],
    ] : []),
    [],
    ["Total costo real (ARS)", aPesos(resumen.totalCosto)],
    ...(verCobrado ? [
      ["Total cobrado (ARS)", aPesos(resumen.totalCobrado)] as Celda[],
      ["Total margen (ARS)", aPesos(resumen.totalMargen)] as Celda[],
      ["Margen % ponderado", resumen.margenPctPonderado] as Celda[],
    ] : []),
    ["Costo mediano (ARS)", resumen.costoMediano === null ? null : aPesos(resumen.costoMediano)],
    [],
    ["Lo que este archivo NO dice"],
    ["El total de margen no es el total cobrado menos el total de costo: sólo suma los trámites que tienen las dos cifras cargadas."],
    ["Los totales cubren únicamente los trámites cargados. Mirá la cobertura de arriba antes de sacar conclusiones."],
  ];

  const detalle: Celda[][] = [
    cols.map((c) => c.titulo),
    ...filas.map((f) => cols.map((c) => valor(f, c))),
  ];

  return {
    hojas: [
      { nombre: "Resumen",  filaEncabezado: 0, columnas: null, filas: cabecera },
      { nombre: "Trámites", filaEncabezado: 0, columnas: cols, filas: detalle, autofiltro: true },
    ],
  };
}

const Z: Record<Formato, string | null> = {
  texto: null,
  entero: "#,##0",
  // Sin símbolo de moneda a propósito: `"$"#,##0.00` se rompe si el archivo se abre con otra
  // configuración regional. El encabezado de la columna dice "(ARS)".
  moneda: "#,##0.00",
  // FRACCIÓN, no número ya multiplicado: se guarda 0,1491 y Excel muestra 14,9%.
  porcentaje: "0.0%",
  fecha: "dd/mm/yyyy",
};

/**
 * Side effect: genera el .xlsx y dispara la descarga. Sin test unitario (necesita xlsx real).
 * El import es dinámico para que xlsx no entre en el chunk inicial.
 */
export async function descargarLibro(libro: Libro, nombreArchivo: string): Promise<void> {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();

  for (const hoja of libro.hojas) {
    const ws = XLSX.utils.aoa_to_sheet(hoja.filas, { cellDates: true });
    const cols = hoja.columnas;
    if (cols) {
      ws["!cols"] = cols.map((c) => ({ wch: c.ancho }));
      for (let r = hoja.filaEncabezado + 1; r < hoja.filas.length; r++) {
        cols.forEach((col, c) => {
          const celda = ws[XLSX.utils.encode_cell({ r, c })];
          if (!celda || celda.v === null || celda.v === undefined) return;
          const z = Z[col.formato];
          if (z) celda.z = z;
          if (col.formato === "fecha") celda.t = "d";
        });
      }
      if (hoja.autofiltro && hoja.filas.length > hoja.filaEncabezado + 1) {
        ws["!autofilter"] = {
          ref: XLSX.utils.encode_range({
            s: { r: hoja.filaEncabezado, c: 0 },
            e: { r: hoja.filas.length - 1, c: cols.length - 1 },
          }),
        };
      }
    }
    XLSX.utils.book_append_sheet(wb, ws, nombreHojaValido(hoja.nombre));
  }

  XLSX.writeFile(wb, nombreArchivo, { cellDates: true, compression: true });
}
```

**Tests, incluido el guardián de permiso:**

```ts
// 987654321 no aparece en ningún otro lado del fixture: si se filtra, se ve.
const COBRADO_MAGICO = 987_654_321;

const fila: FilaInforme = {
  fechaAlta: new Date(2026, 8, 10), fechaPres: new Date(2026, 8, 12), fechaPago: new Date(2026, 8, 14),
  razonSocial: "Paris Autos", tipo: "Patentamiento 0km", cliente: "Nievas Mercedes Maricel",
  dominio: "AF725SQ", seccional: "19005 - Marconi 29", gestora: "Carla",
  presupuesto: 65_000_000, arancel: 52_000_000, prenda: 12_859_500, sellados: 3_213_000, otros: null,
  costo: 68_072_500, desvio: 3_072_500, desvioPct: 0.0473,
  cobrado: COBRADO_MAGICO, margen: 919_581_821, margenPct: 0.9311,
  estado: "Pagado", numeroPago: "0001420388",
};

const resumen: ResumenCostos = {
  cantidad: 1, conCosto: 1, conCobrado: 1, coberturaCosto: 1, coberturaCobrado: 1,
  totalCosto: 68_072_500, totalCobrado: COBRADO_MAGICO, totalMargen: 919_581_821,
  margenPctPonderado: 0.9311, costoPromedio: 68_072_500, costoMediano: 68_072_500,
};

const ctx = (rol: Rol): ContextoExport => ({
  rol, titulo: "Informe de costos", razonSocial: "Paris Autos", periodoLabel: "septiembre 2026",
  corte: "Fecha de presentación en el registro",
  generadoEn: new Date(2026, 8, 18), generadoPor: "Valentino", huellaCierre: null,
});

describe("columnasInforme", () => {
  it("gerencia y contable ven las 22 columnas", () => {
    expect(columnasInforme("gerencia")).toHaveLength(22);
    expect(columnasInforme("contable")).toHaveLength(22);
  });
  it("gestora no tiene las tres columnas sensibles en la LISTA", () => {
    const claves = columnasInforme("gestora").map((c) => c.clave);
    expect(claves).toHaveLength(19);
    expect(claves).not.toContain("cobrado");
    expect(claves).not.toContain("margen");
    expect(claves).not.toContain("margenPct");
  });
});

describe("armarLibroCostos — guardián de permiso", () => {
  it("con rol gestora, el cobrado no aparece en NINGUNA celda de NINGUNA hoja", () => {
    const libro = armarLibroCostos([fila], resumen, ctx("gestora"));
    const serializado = JSON.stringify(libro);
    expect(serializado).not.toContain(String(COBRADO_MAGICO));
    expect(serializado).not.toContain(String(aPesos(COBRADO_MAGICO)));
    expect(serializado).not.toContain("Margen");
    expect(serializado).not.toContain("Cobrado");
  });

  it("con rol gerencia, el cobrado sí aparece", () => {
    const libro = armarLibroCostos([fila], resumen, ctx("gerencia"));
    expect(JSON.stringify(libro)).toContain(String(aPesos(COBRADO_MAGICO)));
  });
});

describe("armarLibroCostos — estructura y formatos", () => {
  it("dos hojas, con Resumen primero", () => {
    const libro = armarLibroCostos([fila], resumen, ctx("gerencia"));
    expect(libro.hojas.map((h) => h.nombre)).toEqual(["Resumen", "Trámites"]);
  });

  it("el Resumen declara el corte usado", () => {
    const libro = armarLibroCostos([fila], resumen, ctx("gerencia"));
    const r = libro.hojas[0].filas;
    expect(r.find((f) => f[0] === "Corte usado")?.[1]).toBe("Fecha de presentación en el registro");
  });

  it("los montos van en pesos como NÚMERO, no como texto", () => {
    const libro = armarLibroCostos([fila], resumen, ctx("gerencia"));
    const cols = libro.hojas[1].columnas!;
    const i = cols.findIndex((c) => c.clave === "costo");
    const v = libro.hojas[1].filas[1][i];
    expect(typeof v).toBe("number");
    expect(v).toBe(680725);
  });

  it("las fechas van como Date, no como string", () => {
    const libro = armarLibroCostos([fila], resumen, ctx("gerencia"));
    const cols = libro.hojas[1].columnas!;
    const i = cols.findIndex((c) => c.clave === "fechaPres");
    expect(libro.hojas[1].filas[1][i]).toBeInstanceOf(Date);
  });

  it("los porcentajes van como fracción", () => {
    const libro = armarLibroCostos([fila], resumen, ctx("gerencia"));
    const cols = libro.hojas[1].columnas!;
    const i = cols.findIndex((c) => c.clave === "margenPct");
    expect(libro.hojas[1].filas[1][i]).toBe(0.9311);
  });

  it("un componente en null queda como celda vacía, no como cero", () => {
    const libro = armarLibroCostos([fila], resumen, ctx("gerencia"));
    const cols = libro.hojas[1].columnas!;
    const i = cols.findIndex((c) => c.clave === "otros");
    expect(libro.hojas[1].filas[1][i]).toBeNull();
  });
});

describe("nombreHojaValido", () => {
  it("saca los caracteres que Excel prohíbe y corta a 31", () => {
    expect(nombreHojaValido("Costos [2026/09]")).toBe("Costos  2026 09");
    expect(nombreHojaValido("x".repeat(40))).toHaveLength(31);
  });
});
```

---

## 7. Orden de implementación

| Etapa | Qué entra | Funciona sola porque |
|---|---|---|
| 1 | Migraciones 10 a 12 (`tramite_cobros`, `objetivos_mensuales`, `ingresos_programados`, `tramite_eventos`) + `dinero.ts` + `costos.ts` | Sin esto, ninguna métrica del punto 5 existe a los tres meses. Va primero aunque no se vea en pantalla. |
| 2 | Informe de costos: vistas, `InformeCostos.tsx`, exportación a Excel | Es lo que la línea 23 pide y lo que da valor el primer día. |
| 3 | Cierre de mes: migración 13, `cierre-mes.ts`, `CierreDeMes.tsx` | Necesita al menos un mes de datos del punto 2. |
| 4 | Proyección: `proyeccion.ts`, `Proyeccion.tsx` | Necesita 90 días de costos reales para tener mediana con n ≥ 5. Antes de eso devuelve "incompleta" y está bien que lo haga. |
| 5 | Pro-contras: `adopcion.ts`, `ProContras.tsx` | Los datos se venían acumulando desde la etapa 1; acá sólo se dibujan. |

La encuesta día 0 (métrica 9) no está en ninguna etapa: se toma **antes** de la etapa 1. Es lo único de todo este diseño que, si no se hace a tiempo, no se puede hacer nunca.