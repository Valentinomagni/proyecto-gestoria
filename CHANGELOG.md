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

### Lo que el sistema no deja hacer

- **No se borra nada.** Un trámite se anula con motivo; un movimiento se compensa con un ajuste.
  El sistema directamente no tiene con qué borrar.
- **No se puede editar el libro de movimientos.** El saldo de ayer siempre se puede reconstruir.
- **No se puede guardar dos veces el mismo presupuesto** ni patentar dos veces el mismo 0km.
- **No hay ningún ranking de gestoras**, ni conteos por persona, ni comparaciones. No es un
  olvido: es una decisión, y hay una prueba automática que falla si alguien la agrega.

### Lo que todavía no hace, y hay que saberlo

- **No calcula vencimientos.** Los plazos del registro están sin confirmar, y hasta que no lo
  estén el sistema prefiere no avisar nada antes que avisar mal.
- **La fecha de acreditación no contempla feriados.** Un depósito ordenado el jueves anterior a
  un feriado va a figurar como acreditado un día antes de lo real.
- **La base es la misma que la de desarrollo.** La app lo dice en pantalla, arriba a la
  izquierda. Eso cambia antes de que haya saldos reales.
