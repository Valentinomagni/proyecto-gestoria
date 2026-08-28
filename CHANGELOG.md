# Qué cambió

Escrito para quien usa el sistema, no para quien lo programa. Lo último, arriba.

Una entrada por cada vez que la app llega a producción. Si algo cambió y no está acá, es porque
todavía no salió.

---

## Sin publicar todavía — lo que está listo en la versión de prueba

### La app de la oficina: se entra por las empresas — 28/08/2026

**La pantalla de entrada ahora es el resumen de las cinco empresas**, cada una con sus cuatro
cifras y la Diferencia bien grande, que es la que decide. Antes había que elegir una tarjeta de
una lista para recién ahí ver algo.

**De ahí se entra a la empresa, y de la empresa al trámite.** Las tres pantallas están una adentro
de la otra y arriba se ve el camino recorrido, con el tramo anterior clickeable. **El botón "atrás"
del navegador funciona**: antes salía de la aplicación entera.

**Cargar un trámite y cargar dinero se mudaron adentro de la empresa.** Los dos formularios ya
saben de qué empresa se trata, así que tienen un campo menos — y el campo que no existe no se
puede llenar mal.

**Los trámites de una empresa vienen agrupados y plegados** según haga falta algo o no: lo que
está en curso abierto, lo terminado y lo anulado plegado. Nada se borra: lo anulado sigue estando,
sin hacer ruido.

**El extracto de la cuenta abre en el día de hoy** y se pliega. Lo que se está mirando se puede
bajar a Excel, tal como está filtrado.

**Si alguien carga un depósito, la pantalla del otro se actualiza sola**, sin recargar. Es la razón
de ser del sistema: que dos personas no se pisen con la plata disponible del día.

**Administración pasó a estar detrás del nombre**, arriba a la derecha. Se entra dos veces al mes;
tenerla siempre a la vista le daba el mismo peso que a la pantalla que se mira treinta veces
por día.

**Una empresa que todavía no tiene movimientos ahora muestra sus ceros y explica por qué**. Decía
"Sin datos", que es lo que corresponde cuando alguien no tiene permiso para verla — pero a
gerencia, que ve todo, le aparecía en tres de sus cinco empresas. Ahora "Sin datos" lo ve
únicamente quien de verdad no puede ver esa tarjeta.

### La cadena se simplificó, y el saldo inicial se puede volver a cargar — 27/08/2026

**El trámite pasa de diez estados a seis.** Presentar, pagar y retirar eran tres pasos separados
para un solo viaje al registro: la gestora presenta, le liquidan, paga y retira en la misma
ventanilla. Ahora es un paso, **Resuelto en el registro**, que pide de una vez la seccional, lo
que salió de verdad y qué documentación retiró.

Las tres preguntas que hacían los tres pasos siguen estando: fundir los estados no aflojó ningún
control, sólo juntó el momento en que se contestan.

**"Frenado por falta de saldo" dejó de ser un estado.** Alguien tenía que marcarlo, y sobre todo
tenía que **desmarcarlo** cuando entraba plata — y eso se olvidaba, así que la pantalla decía que
estaba detenido algo que ya podía salir. Ahora se calcula: un trámite presupuestado cuya tarjeta
no alcanza está esperando plata, y **deja de estarlo solo** en cuanto el depósito acredita.

En Pedidos de fondos hay un bloque nuevo, **Esperando plata**, agrupado por tarjeta y con
**cuánto falta depositar** en cada una. Está agrupado y no listado uno por uno a propósito: la
plata es de la tarjeta y se la reparten todos los presupuestos vivos, así que se deposita **una
vez** la diferencia de la tarjeta y salen todos. Listarlo trámite por trámite haría pensar que
hay que depositar el triple.

**El botón dice de antemano qué va a pedir.** "Resolver en el registro" necesita tres cosas —la
seccional, el costo real y qué documentación retiraste— y la base las valida de a una, así que
antes había que apretar cuatro veces y leer tres errores rojos para completarlas. Ahora el panel
lo dice antes: *"Vas a necesitar la seccional, el costo real por concepto y qué documentación
retiraste"*. Vale para todos los pasos, no sólo para ése.

**Y los mensajes de error están escritos en castellano de verdad.** Decían "Anota que
documentacion retiraste" y "Escribi por que se anula", sin una sola tilde. Sin tilde eso no es
voseo: "Anota" es otra persona. Los diecisiete ahora están acentuados, y tres que no decían qué
hacer ahora lo dicen — el de la razón social sin tarjeta termina indicando a quién avisarle,
porque desde la ficha no se puede arreglar.

### Los saldos se corrigieron, y la gestoría ya ve con cuánto cuenta — 27/08/2026

**Había plata figurando como comprometida que no lo estaba.** Paris Autos mostraba 971.234,56
reservados, y **451.234,56 de eso no correspondía a ningún presupuesto vivo**: 450.000 colgaban de
un trámite al que le habían quitado su única línea —así que en pantalla no pedía nada— y el resto
de otro que ni siquiera había pasado el control. Paris Cars mostraba 128.000 por lo mismo, que era
todo su reservado.

```
Paris Autos   971.234,56 reservados  →  520.000,00
Paris Cars       128.000,00          →           0
```

**No es plata que aparece.** Es plata que nunca estuvo comprometida y que la pantalla venía
mostrando como gastada: el disponible que se veía era menor que el real.

**La cuenta dejó de deducirse del paso que se dio y pasa a compararse contra el libro.** Antes el
sistema decidía si mover plata según qué botón se había apretado, y cada camino nuevo necesitaba su
propia regla — la que faltara no daba error, sólo un número mal. Ahora compara lo que el libro dice
que está reservado y cobrado contra lo que debería estar, y escribe la diferencia. Eso arregló, con
la misma cuenta, cuatro formas distintas de que la plata quedara mal:

- Quitar la última línea de un presupuesto dejaba la reserva viva **para siempre**.
- Anular un trámite y después revivirlo devolvía la reserva **dos veces**, y el reservado quedaba
  en negativo.
- Corregir el costo real después de resolver **no se cobraba**: la ficha decía un número y la
  tarjeta otro.
- Y la reserva nacía apenas se cargaba un importe, aunque el trámite no hubiera pasado el control.
  Ahora la plata se compromete cuando el trámite se presupuesta, que es cuando de verdad se pide.

**La gestoría ve el saldo de las tarjetas donde tiene trámites.** Hasta hoy veía las cinco en
**$ 0,00** — no "sin datos": cero, que es un número y se lee como un hecho. Salía al registro
creyendo que no había con qué pagar, y Paris Autos tenía ocho millones y medio.

Y una tarjeta cuyos movimientos no se pueden ver ahora dice **"sin datos"** y no un importe. Un
cero que en realidad significa "no sé" es la peor forma de equivocarse que tiene una pantalla de
plata.

**El día se cuenta con la hora de Argentina.** La base trabajaba en horario de Londres, así que
entre las 21 y las 24 daba por acreditado un depósito que en realidad entraba al día siguiente.

**Y ya no aparece un pedido de fondos de $ 0,00.** Un trámite al que le habían quitado su única
línea de presupuesto seguía figurando como presupuestado y pidiendo cero. Ahora no se puede quitar
la última línea: si el presupuesto está mal, se carga la línea nueva primero y después se saca la
vieja — así el total y la reserva se ajustan solos por la diferencia.

**El saldo inicial de una tarjeta se puede volver a cargar después de anularlo.** Antes decía que
el dato ya había sido ingresado, y dos tarjetas quedaron sin poder arrancar. Era un defecto, y era
el que bloqueaba todo lo demás.

**Una anulación ya no se puede anular.** Se podía, y el resultado era la plata de vuelta en el
saldo mientras la pantalla mostraba el movimiento tachado: la cuenta diciendo una cosa y la
pantalla otra. Si hay que revertir una anulación, se carga el movimiento de nuevo — queda más
largo en el extracto y queda explicable.

**Un costo real anulado ya no se cobra.** Si alguien quitaba una línea de lo que salió de verdad,
el sistema la seguía descontando de la tarjeta igual. La mitad gemela del cálculo, la del
presupuesto, sí la excluía: las dos mitades del mismo número no coincidían.

**Y corregir un trámite ya pagado no descuenta la plata dos veces.** Si se lo mandaba para atrás
para arreglar un importe y se lo volvía a cerrar, el sistema devolvía la reserva otra vez y
cobraba el pago otra vez. Sin ningún aviso, sobre la cifra que la gestoría usa para decidir si
puede pagar en el día.

### Lo que cambió en la segunda revisión — 24/08/2026

**El presupuesto es un solo número.** Antes había dos: la suma de los conceptos y, aparte, un
"depósito que se solicita" que se escribía a mano — y era **ése** el que se descontaba de la
tarjeta. La pantalla llegaba a tener una fila llamada "Diferencia con el depósito pedido" para
explicar por qué no coincidían.

Ahora el presupuesto **es** la suma de sus conceptos. Apenas se agrega, se corrige o se quita una
línea, la reserva de la tarjeta se ajusta sola y el movimiento aparece en Operaciones con el
apellido del cliente al lado. Si hace falta pedir de más —el arancel real recién se sabe en la
ventanilla— se carga como un concepto más, con su nombre.

**Al mirar los datos apareció lo que ese cambio venía a evitar:** un trámite tenía **$6.128.000
presupuestados y ninguna reserva**. La pantalla de la tarjeta decía que esa plata estaba
disponible. Los trámites que ya tenían presupuesto cargado quedaron emparejados; los ya pagados o
retirados no se tocaron, porque ahí la reserva ya se había liberado.

**Se puede corregir el presupuesto.** Cada línea tiene **Corregir** y **Quitar**. Una línea quitada
no desaparece: queda tachada con el motivo escrito, porque cuando el trámite vuelve del registro y
el número no cierra, lo que se pregunta es qué se sacó y por qué.

**Se pueden corregir los datos del trámite, incluida la gestora que lo hace.** Cambiarla hace que
el trámite le aparezca a ella y deje de aparecerle a la anterior. Cada cambio queda registrado con
el nombre de quien lo hizo, en **un solo panel** que ahora muestra todo junto: los datos, los
importes y el total.

**Se puede anular un movimiento cargado mal.** Un depósito con un cero de más se anula escribiendo
el motivo: queda tachado, con su compensación abajo, y el saldo vuelve a cerrar. No se borra nada,
porque el saldo de ayer tiene que poder reconstruirse.

**La Tarjeta muestra cuatro columnas con los nombres de la empresa:** Saldo día de hoy, Depósito
pendiente de acreditación, Saldo reservado, y la Diferencia entre las dos primeras — que es con la
que se decide si se manda a presentar.

**Accesorios y Entrega de vehículo usado se contestan Sí o No.** No son papeles que puedan faltar:
son hechos de la operación, y "No corresponde" sobre un hecho no significa nada.

**Gestoría dejó de tener "Cargar trámite".** El trámite nace de un mail que le llega a
administración, y el alta la hace quien recibe ese mail.

**Se sacaron dos cosas de la pantalla:** la sección de Vencimientos de la ficha —con tres de los
cinco plazos sin confirmar no mostraba fechas, mostraba renglones explicando qué faltaba— y la
cuenta regresiva al corte de las 16:00. Administración conserva los plazos y los feriados; el día
que estén confirmados, los vencimientos vuelven.

### La cuenta corriente de la Tarjeta Habitualista

La pantalla calca la del sitio: arriba las cifras, abajo el listado de operaciones. Pero muestra
**cinco números en vez de uno**, y ésa es toda la diferencia:

- **Contable** — lo que ya está acreditado. Tiene que coincidir con el sitio.
- **En tránsito** — lo que se depositó hoy y acredita mañana. Todavía no se puede gastar.
- **Comprometido** — los presupuestos cargados que aún no se pagaron.
- **Disponible hoy** — contable menos comprometido. **Con éste se decide si se manda a
  presentar.**
- **Proyectado para mañana** — lo que va a haber cuando acredite lo de hoy.

Arriba de todo hay una cuenta regresiva al corte de las 16:00. Pasada esa hora deja de decir
cuánto falta y dice la consecuencia: lo que se ordene ahora acredita pasado mañana.

**El saldo se actualiza solo.** Si gerencia carga un depósito en San Juan, la pantalla de
administración en San Luis cambia sin que nadie recargue nada. Es lo que hace que dos personas
dejen de comprometer la misma plata.

### Los trámites, de punta a punta

Un trámite se carga **pegando el asunto del mail** que manda administración: lo que el sistema
reconoce lo completa solo —cliente, cuenta, referencia de oferta, tipo y modalidad— y lo que no
reconoce lo deja vacío, sin inventar. El asunto original queda guardado siempre.

Después el trámite avanza por un solo botón, el del paso que sigue. Nadie elige un estado de una
lista, así que no se puede saltear un paso sin querer:

recibido → controlado → entregado a gestoría → presupuestado → presentado → pagado → retirado →
devuelto.

En cada paso el sistema pide lo que ese paso necesita y **no deja avanzar sin eso**: el checklist
del legajo antes de pasar a gestoría, la gestora al entregarlo, el depósito al presupuestar, la
seccional al presentar.

Cuando se carga el presupuesto, la plata **queda reservada sola**. Cuando se paga, se libera la
reserva y se descuenta lo que realmente costó. Nadie tiene que acordarse de hacer ninguna de las
dos cosas.

### El checklist del legajo

Cada requisito se contesta **Está**, **Falta** o **No corresponde**. Se exige contestado, no que
esté todo: una falta anotada sirve, y queda escrita para cuando el trámite vuelva del registro y
alguien pregunte por qué.

Si vino todo, hay un botón que contesta los cuatro de una.

### Los pedidos de fondos

Una pantalla con lo que está esperando plata, separado entre **lo de hoy** y **lo de días
anteriores** —porque el acuerdo es pagar en el día o al siguiente, y lo que se pasó de eso no es
lo mismo que lo de recién—. Cada pedido muestra cuánto queda disponible si se atiende.

### Las notas del trámite

Lo que hoy se explica por WhatsApp y después nadie encuentra. Queda pegado al trámite, con el
nombre de quien lo escribió y la fecha. **No se puede editar ni borrar**: por eso sirve de
respaldo.

### Bajar a Excel

Baja **lo que estás mirando**, con los filtros puestos. La plata sale como número —se puede
sumar y ordenar, no hay que retipear nada— y la fecha sale como fecha. El aviso dice cuántos
trámites salieron, para que puedas comparar de un vistazo con la pantalla.

### En el teléfono

La gestora trabaja parada en el registro y con una mano, así que en el teléfono el menú va
**abajo**, donde llega el pulgar. El listado son fichas apiladas en vez de una tabla, y los
botones son grandes.

### Los vencimientos

Cada trámite muestra qué plazos le corren, cuándo vencen y **qué pasa si se pasan**, con la norma
citada y el nombre de quien confirmó ese plazo al lado.

**Y lo más importante de esta función es cuándo no muestra nada.** Si el plazo no está
confirmado, si falta la fecha desde la que corre, o si faltan feriados por cargar, el sistema
**no muestra ninguna cuenta regresiva** y dice qué falta. Avisar un vencimiento equivocado es
peor que no avisar nada: alcanza una fecha mal para que nadie vuelva a mirar el resto.

Los plazos los confirma gerencia desde Administración. Quien mejor los sabe son las gestoras: los
viven todos los días.

### Si el trámite no sigue

Dos salidas, y las dos piden un motivo escrito:

- **Frenar por falta de saldo** — aparece en los pedidos de fondos hasta que entre plata.
- **Anular** — el trámite queda en el listado, con su historial. Acá nada se borra: si dentro de
  seis meses alguien busca ese cliente, tiene que encontrar el trámite y por qué no salió.

### Avisar un problema

Un botón en todas las pantallas, para todos. **No hace falta explicar nada**: con apretar
mandar alcanza. La app adjunta sola en qué pantalla estabas, con qué rol y el detalle técnico —
nunca el nombre de un cliente ni un importe.

Los avisos llegan a Administración, arriba de todo. Quien los atiende escribe qué hizo, para que
quien avisó sepa que sirvió.

**No se cuentan avisos por persona.** Queda quién avisó sólo para poder repreguntar.

### Bajar un respaldo

Un archivo con todo lo que hay en la base. La lista de tablas sale del esquema real, así que una
tabla nueva entra sola. Si algo no se pudo leer, el aviso lo dice: un respaldo incompleto que se
presenta como completo es peor que ninguno.

No incluye las cuentas de acceso, que viven en otro lado. Sirve para recuperar datos, no para
rehacer el sistema entero.

### Si la aplicación no carga

En vez de una pantalla en negro, ahora dice que no cargó, ofrece reintentar, y pide las dos cosas
con las que después se puede encontrar el problema: la hora exacta y desde dónde entraste.

### Lo que el sistema no deja hacer

- **No se borra nada.** Un trámite se anula con motivo; un movimiento se compensa con un ajuste.
  El sistema directamente no tiene con qué borrar.
- **No se puede editar el libro de movimientos.** El saldo de ayer siempre se puede reconstruir.
- **No se puede guardar dos veces el mismo presupuesto** ni patentar dos veces el mismo 0km.
- **No hay ningún ranking de gestoras**, ni conteos por persona, ni comparaciones. No es un
  olvido: es una decisión, y hay una prueba automática que falla si alguien la agrega.

### Lo que todavía no hace, y hay que saberlo

- **Los vencimientos todavía no se muestran**, y no por un defecto: faltan confirmar tres de los
  cinco plazos y falta cargar los feriados. En cuanto eso esté, aparecen solos. Mientras tanto la
  pantalla dice exactamente qué falta.
- **La fecha de acreditación de un depósito ya contempla feriados**, pero sólo los que estén
  cargados. Mientras el calendario esté vacío cuenta únicamente sábados y domingos.
- **La base es la misma que la de desarrollo.** La app lo dice en pantalla, arriba a la
  izquierda. Eso cambia antes de que haya saldos reales.
