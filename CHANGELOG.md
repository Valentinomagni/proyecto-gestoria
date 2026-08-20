# Qué cambió

Escrito para quien usa el sistema, no para quien lo programa. Lo último, arriba.

Una entrada por cada vez que la app llega a producción. Si algo cambió y no está acá, es porque
todavía no salió.

---

## Sin publicar todavía — lo que está listo en la versión de prueba

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
