---
name: dominio-gestoria
description: El dominio de la Gestoría Grupo Paris — qué resuelve el sistema, la cadena de seis estados de un trámite, y el modelo de plata de la Tarjeta Habitualista. Usar al tocar trámites, presupuestos o saldos.
---

# El dominio


Hoy la operación vive en tres lugares que no se hablan: una foto de un cuaderno que llega por
WhatsApp, una planilla de Excel de más de 6.800 filas, y el sitio de la Tarjeta Habitualista que
cada uno mira por su cuenta. San Luis lo lleva contable y San Juan lo lleva gerencia, y **se pisan
los saldos** porque no hay un listado unificado.

**Posicionamiento:** una herramienta de trabajo tan seria como la plata que administra. Sin ruido
visual, sin nada que compita con los números.

**La frase que ordena el producto**, y no está en el pedido con estas palabras pero es lo que el
pedido describe: **cada trámite es un reloj con plata adentro.** Un trámite frenado no es una
demora, es un recargo. Ver `docs/DOMINIO.md`, que es de lectura obligatoria antes de tocar la
lógica de plazos.

**Lo que el sistema NO hace**, escrito para que nadie lo suponga: no entra al sitio de
Habitualista, no guarda credenciales, no paga nada, no reemplaza a Quiter, no controla si el
cliente pagó, **no mide personas**, y no decide por nadie.

---


## La cadena: seis estados y una salida

| | Estado | De quién es | Qué pasa |
|---|---|---|---|
| 1 | **Recibido** | Oficina | Llega el mail y se carga el trámite |
| 2 | **Controlado** | Oficina | Se contesta el checklist del legajo |
| 3 | **Entregado** | Oficina a Gestora | Se le asigna a una gestora |
| 4 | **Presupuestado** | Gestora | Carga el presupuesto. La plata queda reservada sola |
| 5 | **Resuelto** | Gestora | Un viaje al registro: presenta, paga y retira |
| 6 | **Devuelto** | Gestora a Oficina | Le entrega la documentacion a administracion |

Salida unica: **Anulado**, con motivo escrito.

**Por que 5 es un solo paso.** Lo dicto quien lo hace: *"todo en el mismo momento: presenta, se
paga y se retira"*. Antes eran tres estados y tres botones para un solo viaje a la ventanilla.

**Donde espera la plata:** entre 4 y 5, y en ningun otro lado. Un tramite presupuestado cuya
tarjeta no cubre lo reservado esta esperando plata. **Se calcula, no se marca:** vive en la vista
`v_esperando_plata`. Antes era el estado `frenado_por_saldo`, que alguien tenia que marcar y
sobre todo DESMARCAR cuando entraba plata, y eso se olvidaba.

## La plata

**El saldo no es un campo: es la suma de un libro mayor de solo insercion.** Un campo mutable con
dos escritores es exactamente el objeto que se pisa, y el pison de saldos es el problema que el
proyecto viene a resolver.

Cuatro cifras en pantalla, y cada una decide algo distinto:

| Cifra | Que es | Para que sirve |
|---|---|---|
| **Saldo dia de hoy** | Lo acreditado | Tiene que coincidir con el sitio de Habitualista |
| **Deposito pendiente de acreditacion** | Ordenado hoy, acredita maniana | Todavia no se puede gastar |
| **Saldo reservado** | Presupuestos cargados y sin pagar | |
| **Diferencia** | Saldo de hoy menos reservado | **Con esta se decide si se presenta** |

**El presupuesto ES la suma de sus conceptos.** No hay un segundo numero: lo mantiene el trigger
`h_conceptos_total_presupuesto`, y nadie con sesion puede escribirlo a mano —lo impide
`b_tramites_total_derivado`—.

Se midio el 21/08/2026 por que hacia falta: habia un tramite con **$6.128.000 presupuestados y
CERO reservado**, porque los dos numeros eran independientes y nadie los comparaba.

## Los tipos de movimiento

| Tipo | Quien lo escribe | Cuando |
|---|---|---|
| `saldo_inicial` | Una persona, desde Administracion | La foto del dia que arranca el sistema |
| `ingreso` | Una persona | Un deposito |
| `reserva` | Un trigger | Al cargar el presupuesto |
| `ajuste_reserva` | Un trigger | Al corregirlo, **por la diferencia** |
| `reversa_reserva` | Un trigger | Al resolverse: devuelve la reserva entera |
| `pago` | Un trigger | Al resolverse: descuenta lo que salio de verdad |
| `ajuste` | Una persona | Correccion con motivo, o anulacion de otro movimiento |

**Los tres primeros y el ultimo los puede anular la oficina**; los que escribe un trigger, no:
esos se corrigen corrigiendo el presupuesto del tramite.
