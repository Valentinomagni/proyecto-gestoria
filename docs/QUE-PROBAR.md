# Qué probar

Escrito para la primera prueba completa, con los tres planes cerrados. La idea es que puedas
recorrerlo de arriba abajo y anotar lo que no coincida, para que la próxima versión arregle cosas
concretas.

**Dónde:** https://proyecto-gestoria.pages.dev

**Con qué cuentas:** las tres de siempre. La app se dibuja distinta según con cuál entres, así que
conviene probar las tres.

---

## Lo primero que hay que saber

**Ahora son dos aplicaciones sobre la misma base**, y la dirección de entrada es la misma para
todos. Lo que ves depende de tu rol:

| Entrás como | Ves al abrir |
|---|---|
| Gerencia o administración | El resumen de las cinco empresas |
| Gestoría | Tu lista de trabajo del día |

No hay que elegir nada ni pasar por ningún menú.

**Hay datos de prueba en la base.** Están a propósito y se ven: un trámite llamado `PRUEBA
ESPERANDO PLATA` en DORAL CHEVROLET, y movimientos de un peso y de 45.000 —todos anulados y
compensados, el saldo cierra— que dejan las pruebas automáticas. Se terminan cuando exista la
segunda base de Supabase (`docs/SEGUNDA-BASE.md`).

---

## 1. La oficina — entrando como gerencia

### El resumen

- [ ] Se ven las **cinco empresas**, cada una con cuatro cifras: saldo del día, depósito pendiente,
      saldo reservado y **Diferencia**, que es la más grande porque es con la que se decide.
- [ ] Abajo de todo, el total del grupo.
- [ ] Una empresa que espera plata tiene una **marca al costado** y dice cuántos trámites esperan.
- [ ] **Doral Chevrolet, Paris Motor y Paris Trac muestran `$ 0`**, no "Sin datos". Están vacías, y
      ese cero es cierto. *(Esto se arregló el 28/08: antes decían "Sin datos" y al abrirlas decían
      que no podías verlas.)*

### Adentro de una empresa

- [ ] Las cuatro cifras arriba, con la Diferencia destacada.
- [ ] Los trámites **agrupados y plegados** según haga falta algo: lo que está en curso abierto, lo
      terminado y lo anulado plegado.
- [ ] Los botones **+ Trámite** y **+ Dinero**, arriba a la derecha.
- [ ] El extracto de la cuenta: **arranca plegado y abre en el día de hoy**.
- [ ] El botón de bajar a Excel baja **lo que estás mirando**, tal como está filtrado.
- [ ] En una empresa vacía, el extracto dice *"Todavía no hay movimientos en esta tarjeta"* y
      explica que los ceros son ciertos.

### La navegación

- [ ] Arriba se ve el camino: **Grupo Paris › la empresa › el trámite**, y el tramo anterior se
      puede tocar.
- [ ] **El botón "atrás" del navegador funciona** y te devuelve donde estabas, con el scroll donde
      lo dejaste. *(Antes sacaba de la aplicación.)*
- [ ] Cualquier pantalla se puede **mandar por mensaje**: la dirección apunta a lo que estás viendo.
- [ ] **Administración** está detrás de tu nombre, arriba a la derecha.

---

## 2. La gestora — entrando como gestoría, y desde el teléfono

**Probala en el teléfono.** Es donde se usa, y está hecha para una mano.

- [ ] Al abrir: *"Hola \<nombre\>"* y abajo el **saldo de las tarjetas donde trabaja**. No hay
      selector de empresa.
- [ ] **Te toca a vos** — lo que puede hacer ahora. Cada trámite con cliente, dominio, empresa, una
      frase que dice qué falta, y **un botón** que dice exactamente qué sigue.
- [ ] **Esperando a la oficina** — lo que está frenado por falta de plata. **Sin botón**, y
      diciendo **cuánto falta depositar**.
- [ ] **Terminados hoy** — lo que devolvió hoy.
- [ ] Los tres bloques se dibujan **siempre**, aunque estén vacíos, y el que esté vacío lo dice con
      palabras.
- [ ] **No ve** el resumen de las cinco empresas, ni los botones + Trámite y + Dinero.

### El salto, que es la función central

Hace falta **dos ventanas a la vez**: una con la gestora y otra con gerencia.

- [ ] En la ventana de la gestora, mirá el trámite que está en *Esperando a la oficina*.
- [ ] En la de gerencia, entrá a esa empresa y cargá un depósito que alcance.
- [ ] **Sin tocar nada en el teléfono**, la tarjeta se mueve al bloque de arriba y le aparece el
      botón. Debería *verse viajar*, no desaparecer y reaparecer.

### Tocando el nombre del cliente

- [ ] Se abre la ficha, **en una sola columna**: datos del trámite, presupuesto con sus líneas, y
      las **notas**.
- [ ] Las líneas anuladas del presupuesto se ven **tachadas**, no escondidas.
- [ ] Las notas son por donde la oficina le deja escrito lo que hoy se dice por WhatsApp, y por
      donde ella contesta. Quedan con el nombre de quien la escribió y **no se pueden editar ni
      borrar**.
- [ ] El botón "atrás" la devuelve a su lista.

---

## 3. La app instalable

- [ ] En el teléfono, el navegador ofrece **instalarla**. Queda con su ícono en el escritorio.
- [ ] Abierta desde el ícono, no se ve la barra del navegador.
- [ ] **Poné el teléfono en modo avión y abrí la app.** Tiene que **abrir** y decir *"Sin
      conexión"*, con un botón **Probar de nuevo**.
- [ ] **No tiene que mostrarte ningún importe.** Es a propósito: un saldo de hace un rato se lee
      igual que el de ahora, y con ese número se sale a pagar.
- [ ] Sacá el modo avión, apretá **Probar de nuevo**: vuelve la lista sin recargar.

---

## 4. Lo que no está, y está decidido

Para que no lo busques:

- **No manda avisos al teléfono.** El salto funciona con la app abierta. Un aviso push necesita
  permisos del navegador y es otra etapa.
- **No hay vencimientos ni plazos.** Quedaron fuera del rediseño.
- **No se borra nada.** Todo se anula con motivo y queda a la vista.
- **Hay una sola base de Supabase**, y la app lo dice arriba a la izquierda. Se separa antes de que
  haya saldos reales.
- **Las contraseñas siguen siendo genéricas**, porque estamos en prueba. Se cambian antes del
  primer saldo real, y las cambia cada persona.

---

## Cómo contarme lo que encuentres

Lo que más sirve, en este orden:

1. **Con qué cuenta entraste** y **desde dónde** (la computadora o el teléfono).
2. **Qué esperabas ver** y **qué viste**.
3. Si es un número que está mal: **el número que muestra** y el que debería mostrar.
4. Si hay un cartel de error: **el código**, si lo trae.

Una foto de la pantalla vale más que una descripción, sobre todo para las cosas de tamaño, color o
espaciado.
