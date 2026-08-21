# Segunda revisión — Plan de implementación

> **Para quien lo ejecute:** SUB-SKILL REQUERIDA: usar `superpowers:executing-plans` para
> implementarlo tarea por tarea. Los pasos usan casillas (`- [ ]`) para el seguimiento.

**Objetivo:** que el presupuesto sea un solo número que se descuenta solo, que los datos y los
saldos se puedan corregir, y que cada pantalla sea de gestoría **o** de la oficina — no de las dos.

**Arquitectura:** casi todo baja a la base. El total del presupuesto pasa a ser **derivado** (lo
calcula un trigger a partir de las líneas de conceptos), así el descuento en la cuenta corriente
no depende de que nadie se acuerde de nada. El historial de cambios pasa a ser **por diferencia de
jsonb**, así una columna que se agregue mañana queda registrada por defecto. En el front, la ficha
del trámite se parte en piezas y el panel "Paso siguiente" desaparece: se reemplaza por una barra
de avance arriba y un panel de datos editables.

**Stack:** React 19 + TypeScript + Vite 8 + Tailwind 4 + Supabase (Postgres/RLS/Realtime) +
TanStack Query 5 + vitest + oxlint.

---

## Antes de empezar: dos cosas verificadas hoy, 21/08/2026

El pedido incluye una pregunta directa —*"decime si vos estás actualizando la página"*— y la
respuesta va con la comprobación al lado, no con una afirmación.

**Las migraciones SÍ están aplicadas en Supabase.** Se comprobó entrando a la base remota con un
usuario real (gerencia) y leyendo lo que las últimas migraciones crearon:

```
presupuesto_historial existe: SI, 10 filas
tramites.administrativo existe: SI
checklist activo: Control de la oferta - Saldo 0 / Revision de factura del auto /
                  Revision de factura por gastos / Accesorios si/no / Entrega de vehiculo usado si/no
orden de tarjetas: 10 Paris Autos SA, 20 Paris Cars, 30 Doral Chevrolet, 40 Paris Motor, 50 Paris Trac
```

No se piden migraciones a mano porque las aplica el CLI con `npm run db:push`, usando el token que
vive en `.env.local`.

**La página SÍ se está actualizando.** El JS publicado en
`https://proyecto-gestoria.pages.dev/assets/index-C88V5Meq.js` contiene los textos de la última
tanda (`Administrativo a cargo`, `Guardar el depósito corregido`, `Modalidad`), y
`git log origin/main..main` da **0** commits sin publicar. Las propias fotos del pedido lo
confirman: la FOTO 8 muestra "Administrativo a cargo: BELEN ROSALES" y la cuenta 71783 reconocida
del paréntesis, que son cambios de la tanda anterior.

**Entonces qué falló.** No el despliegue: la implementación. Tres pedidos se tomaron
**literalmente** en vez de por lo que querían decir, y quedaron a medias:

| Lo que se pidió | Lo que se hizo | Lo que faltaba |
|---|---|---|
| Ítems del check "Accesorios sí-no" | Se creó un ítem llamado *"Accesorios si/no"* con las respuestas Está / Falta / No corresponde | Que las respuestas de **ese** ítem sean Sí y No |
| Ocultar vencimientos en gestoría | Se ocultó **sólo para el rol gestora** | Sacar la sección, para todos |
| Permitir modificar datos | Se hizo editable **sólo el depósito** | Todos los datos, incluida la gestora |

Está escrito acá porque el modo de falla es el que importa: cumplir la letra del pedido y no lo
que el pedido resuelve. Las tareas de abajo van por lo segundo.

---

## Decisiones cerradas con el usuario antes de escribir esto

1. **El presupuesto es UN solo número: la suma de los conceptos.** Desaparece el campo suelto
   "Depósito que se solicita". Lo que se reserva de la tarjeta es esa suma, y se ajusta sola cada
   vez que la gestora agrega o corrige una línea.
2. **El panel "Paso siguiente" se va entero.** Se reemplaza por una barra de avance arriba y por
   datos editables. La seccional deja de vivir en ese panel y pasa al panel de datos.
3. **Los vencimientos se sacan sólo de la ficha del trámite.** Administración conserva Plazos y
   feriados.
4. **Las cuatro columnas de la Tarjeta, sin cuenta regresiva** y sin la cifra "Proyectado para
   mañana".
5. **Se tiene que poder corregir saldos y datos.** Sobre saldos, con el mecanismo que el proyecto
   ya define: *"Nada se borra. Un movimiento se compensa con un ajuste."* El movimiento anulado
   queda tachado y su compensación abajo; el saldo queda bien. Nada se destruye porque el saldo de
   ayer tiene que seguir siendo reconstruible.

---

## Constraints globales

Copiadas del `CLAUDE.md` del proyecto. Valen para **todas** las tareas de abajo.

- **Cero emojis.** Ni en interfaz, ni en mensajes, ni en documentación. Íconos sólo de
  `lucide-react`. Ojo con `ℹ` (U+2139), que Unicode clasifica como letra.
- **No se mide a las personas.** Ni rankings, ni conteos por gestora, ni comparaciones. Hay
  guardián.
- **Español de Argentina, voseo**, tono directo, sin jerga técnica en la interfaz. Un error nunca
  muestra el mensaje crudo de la base.
- **Nada se borra.** Un trámite se anula con motivo; un movimiento se compensa con un ajuste; una
  línea del presupuesto se marca anulada con motivo.
- **Plata:** `numeric(14,2)` en Postgres y **centavos enteros** en JavaScript. Todo importe pasa
  por `src/lib/plata.ts`. **Nunca `Number("600.000")`** — da 600.
- **Toda vista lleva `security_invoker = true`.**
- **Toda policy que llame a un helper `security definer` lleva `to authenticated`.** Sin eso
  `anon` intenta ejecutar el helper revocado y la RLS devuelve 42501 (rechazo) en vez de cero
  filas (ausencia).
- **Nunca `force row level security` sobre `movimientos`.**
- **Toda migración trae adentro su bloque "cómo comprobar que quedó bien", y se corre.**
- **Nunca editar JSX con expresiones regulares ni `sed`.** Usar las herramientas de edición.
- **Comentarios en español que explican el POR QUÉ**, no el qué.
- El PATH no trae node: cada comando arranca con
  `export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH"`.
- Los códigos de salida se leen así:
  `comando > /tmp/log 2>&1; echo "EXIT: $?"; tail -20 /tmp/log`.

---

## Estructura de archivos

### Migraciones nuevas (`supabase/migrations/`)

Los nombres los genera `npm run db:nueva <nombre>`; el timestamp lo pone el CLI.

| Archivo | Responsabilidad |
|---|---|
| `*_presupuesto_es_la_suma.sql` | El total del presupuesto lo calcula la base a partir de las líneas. Una línea se quita sin borrarla. |
| `*_historial_de_todo_el_tramite.sql` | `presupuesto_historial` pasa a llamarse `tramite_cambios` y registra **cualquier** columna que cambie, por diferencia de jsonb. |
| `*_checklist_si_o_no.sql` | Los requisitos tienen tipo: `documento` (Está / Falta / No corresponde) o `si_no` (Sí / No). |
| `*_anular_un_movimiento.sql` | Función `anular_movimiento(id, motivo)` y la vista de saldos que deja de contar lo anulado. |

### Front — archivos nuevos

| Archivo | Responsabilidad |
|---|---|
| `src/features/tramites/DatosDelTramite.tsx` | El panel de datos del trámite, en modo lectura y en modo edición. Decide qué campos toca cada rol. |
| `src/features/tramites/Presupuesto.tsx` | Las líneas de conceptos: agregar, corregir el importe, quitar una línea. Sirve para presupuesto y para costo real. |
| `src/features/tramites/Checklist.tsx` | El checklist del legajo, con los dos tipos de respuesta. |
| `src/features/tramites/CambiosDelTramite.tsx` | El historial unificado de cambios. Reemplaza a `HistorialPresupuesto.tsx`. |
| `src/features/tramites/Salidas.tsx` | Frenar por saldo y anular. Sale de `Ficha.tsx`. |
| `src/features/tramites/Notas.tsx` | Las notas. Sale de `Ficha.tsx`. |
| `src/features/tramites/campos-del-tramite.ts` | Un solo lugar con el nombre en pantalla de cada columna y quién la puede editar. Lo usan el panel de datos y el de cambios. |
| `src/features/tarjeta/Operaciones.tsx` | El extracto, con el nombre del cliente y el botón de anular. |

### Front — archivos que se modifican

| Archivo | Qué cambia |
|---|---|
| `src/features/tramites/Ficha.tsx` | Queda como orquestador. Se le sacan Vencimientos, "Paso siguiente", Costos, Checklist, Salidas y Notas. |
| `src/features/tarjeta/Tarjeta.tsx` | Cuatro columnas nuevas, sin cuenta regresiva, sin "Proyectado para mañana". |
| `src/menu.ts` | El menú se arma por rol: gestoría sin "Cargar trámite". |
| `src/lib/datos.ts` | Hooks nuevos: `useCambios`, `useAnularMovimiento`, `useCorregirConcepto`. `useMovimientos` trae el nombre del cliente y si está anulado. |
| `src/lib/plazos.ts` | Se le quitan `calcular`, `plazoDe`, `plazosDeTipo`, `inicioDe` y el tipo `Vencimiento`. Queda `revisarCobertura` y los tipos. |
| `src/lib/fechas.ts` | Se le quitan `antesDelCorte`, `minutosHasta`, `sumarDiasCorridos` y `diasHabilesEntre`. |
| `src/permisos.rls.test.ts` | Pruebas nuevas de lo que se agrega. |
| `CHANGELOG.md`, `docs/ESTADO.md` | Al cierre. |

### Front — archivos que se borran

| Archivo | Por qué |
|---|---|
| `src/features/tramites/HistorialPresupuesto.tsx` | Lo reemplaza `CambiosDelTramite.tsx`. |
| `src/lib/cobertura.test.ts` | Se fusiona en `plazos.test.ts` al recortarlo. |

**Lo que se pierde y hay que saberlo:** al sacar la cuenta regresiva se van también los tests de
`antesDelCorte` y `minutosHasta`, y al sacar los vencimientos se van los de `calcular` —incluidos
los cuatro que probaban que **se niega** a calcular sin plazo confirmado, sin fecha de inicio o
sin feriados—. Quedan en el historial de git. Si algún día vuelven los vencimientos, vuelven con
sus pruebas.

---

## Tarea 1: El presupuesto es la suma de los conceptos

Cubre FOTO 3 (poder modificar presupuestos), FOTO 5 (quitar el campo de depósito) y FOTO 6
(que se descuente solo al cargarlo).

**Archivos:**
- Crear: `supabase/migrations/<generado>_presupuesto_es_la_suma.sql`

**Interfaces:**
- Consume: `public.tramite_conceptos`, `public.tramites.deposito_solicitado`,
  `public.e_tramites_cuenta_corriente()` (el trigger que ya existe y que escribe la `reserva` y el
  `ajuste_reserva` cuando `deposito_solicitado` cambia).
- Produce: la columna `tramite_conceptos.anulada`, la columna
  `tramite_conceptos.motivo_anulacion`, y la garantía de que
  `tramites.deposito_solicitado = suma(importe) where momento='presupuesto' and not anulada`.

- [ ] **Paso 1: Crear el archivo de migración**

```bash
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && npm run db:nueva presupuesto_es_la_suma
```

Anotá el nombre que imprime. **No sigas sin verlo:** una migración vacía se aplica sin error y
queda registrada como aplicada. Ya pasó el 19/08/2026.

- [ ] **Paso 2: Escribir la migración**

Escribila con la herramienta de escritura de archivos, **no con un heredoc**: los backticks y los
acentos de los comentarios se rompen al pasar por el shell.

```sql
-- ============================================================================
--  EL PRESUPUESTO ES LA SUMA DE LOS CONCEPTOS. NO HAY UN SEGUNDO NUMERO.
-- ============================================================================
--
--  ANTES HABIA DOS NUMEROS PARA LA MISMA COSA: las lineas del presupuesto (Arancel, Sellados,
--  Prenda) por un lado, y una columna suelta `deposito_solicitado` por otro. Lo que se
--  descontaba de la tarjeta era la SEGUNDA, asi que se podian cargar seis millones en conceptos
--  y reservar seiscientos mil, sin que nada avisara.
--
--  La pantalla tenia una fila "Diferencia con el deposito pedido" para tapar eso. Una fila que
--  explica una incoherencia es la senial de que la incoherencia no deberia existir.
--
--  DESDE ACA `deposito_solicitado` ES DERIVADA: la calcula este trigger. La columna se conserva
--  —no se borra— porque de ella cuelga todo lo que ya funciona: la bandeja de pedidos de fondos,
--  el trigger que escribe la reserva en la cuenta corriente, y el historial. Cambia QUIEN la
--  escribe, no que exista.
--
--  Y ESO ES LO QUE PIDE LA FOTO 6: "cuando la gestora agregue un presupuesto al tramite
--  automaticamente deberia aparecer en operaciones descontando ese presupuesto". No hace falta
--  programar nada nuevo para el descuento: `e_tramites_cuenta_corriente` ya reacciona a que
--  `deposito_solicitado` cambie, escribiendo la reserva la primera vez y un ajuste_reserva por
--  la diferencia las siguientes. Lo unico que faltaba era que ese numero se moviera solo.
--
--  ES ADITIVA: dos columnas nuevas, un indice que se vuelve parcial y dos triggers. Ninguna
--  fila existente cambia de valor.

-- ------------------------------------------------------------
-- 1) Una linea del presupuesto se QUITA, no se borra
--
--    En este proyecto no hay delete para nadie. Sin esto, una linea cargada de mas no se puede
--    sacar de ninguna manera: `importe > 0` impide ponerla en cero.
-- ------------------------------------------------------------

alter table public.tramite_conceptos
  add column if not exists anulada boolean not null default false;

alter table public.tramite_conceptos
  add column if not exists motivo_anulacion text;

comment on column public.tramite_conceptos.anulada is
  'Una linea quitada del presupuesto. No se borra: queda con su motivo, porque cuando el tramite '
  'vuelve del registro y el numero no cierra, lo que se pregunta es que se saco y por que.';

alter table public.tramite_conceptos
  drop constraint if exists tramite_conceptos_anulada_con_motivo;
alter table public.tramite_conceptos
  add constraint tramite_conceptos_anulada_con_motivo
  check (not anulada or nullif(btrim(coalesce(motivo_anulacion, '')), '') is not null);

-- El indice unico pasa a ser PARCIAL. Sin esto, una linea anulada de Arancel bloquearia para
-- siempre volver a cargar Arancel en ese tramite — que es justo lo que se hace despues de
-- quitar una linea que estaba mal.
drop index if exists public.tramite_conceptos_uno_por_momento;
create unique index if not exists tramite_conceptos_uno_por_momento
  on public.tramite_conceptos (tramite_id, concepto_id, momento) where not anulada;

-- ------------------------------------------------------------
-- 2) El presupuesto no se toca despues de pagado
--
--    Al pagar, el trigger de la cuenta corriente LIBERA la reserva entera y descuenta el costo
--    real. Si despues se cambiara una linea del presupuesto, este trigger escribiria un
--    ajuste_reserva sobre una reserva que ya no existe: plata comprometida de la nada, en una
--    tarjeta que ya cerro ese tramite.
--
--    El costo real (momento = 'real') SI se sigue cargando: es lo que se pide justo antes de
--    pasar a pagado.
-- ------------------------------------------------------------

create or replace function public.b_conceptos_no_despues_de_pagado()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_estado text;
begin
  if new.momento <> 'presupuesto' then return new; end if;
  if auth.uid() is null then return new; end if;              -- consola de la base

  select estado into v_estado from public.tramites where id = new.tramite_id;

  if v_estado in ('pagado', 'retirado', 'devuelto', 'anulado') then
    raise exception 'regla_tramite: El tramite ya esta %. El presupuesto no se cambia despues de pagar: corregilo con un ajuste en la cuenta.', v_estado;
  end if;

  return new;
end;
$$;

drop trigger if exists b_conceptos_no_despues_de_pagado on public.tramite_conceptos;
create trigger b_conceptos_no_despues_de_pagado
  before insert or update on public.tramite_conceptos
  for each row execute function public.b_conceptos_no_despues_de_pagado();

revoke execute on function public.b_conceptos_no_despues_de_pagado() from public, anon, authenticated;

-- ------------------------------------------------------------
-- 3) El total lo calcula la base
--
--    Se llama h_ porque los triggers AFTER corren por orden alfabetico y este tiene que correr
--    DESPUES de g_conceptos_historial_presupuesto, que registra la linea en el historial.
-- ------------------------------------------------------------

create or replace function public.h_conceptos_total_presupuesto()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_tramite uuid  := new.tramite_id;
  v_suma    numeric(14,2);
  v_nuevo   numeric(14,2);
begin
  select coalesce(sum(importe), 0) into v_suma
    from public.tramite_conceptos
   where tramite_id = v_tramite and momento = 'presupuesto' and not anulada;

  -- Cero se guarda como NULL y no como 0: la maquina de estados pregunta por null para saber si
  -- todavia no hay presupuesto, y un 0 significaria "se presupuesto en cero", que no existe.
  v_nuevo := case when v_suma = 0 then null else v_suma end;

  -- El `is distinct from` no es una optimizacion: sin el, cada linea de costo real dispararia un
  -- update del tramite con el mismo valor, y eso escribiria una fila de historial por nada.
  update public.tramites
     set deposito_solicitado = v_nuevo
   where id = v_tramite
     and deposito_solicitado is distinct from v_nuevo;

  return null;
end;
$$;

drop trigger if exists h_conceptos_total_presupuesto on public.tramite_conceptos;
create trigger h_conceptos_total_presupuesto
  after insert or update on public.tramite_conceptos
  for each row execute function public.h_conceptos_total_presupuesto();

revoke execute on function public.h_conceptos_total_presupuesto() from public, anon, authenticated;

-- ------------------------------------------------------------
-- 4) La maquina de estados deja de pedir el deposito por separado
--
--    Se reescribe la funcion ENTERA porque `create or replace function` reemplaza todo el
--    cuerpo. El unico cambio esta marcado con CAMBIO abajo; el resto es identico a la version
--    de 20260819181222_historial_en_after.sql y se copia tal cual a proposito: media funcion
--    pegada es como se pierde una validacion sin que nadie lo note.
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
      when 'recibido>controlado'             then rol in ('contable','gerencia')
      when 'controlado>entregado'            then rol in ('contable','gerencia')
      when 'entregado>presupuestado'         then rol in ('gestora','contable','gerencia')
      when 'presupuestado>frenado_por_saldo' then rol in ('contable','gerencia')
      when 'frenado_por_saldo>presentado'    then rol in ('gestora','contable','gerencia')
      when 'presupuestado>presentado'        then rol in ('gestora','contable','gerencia')
      when 'presentado>pagado'               then rol in ('gestora','contable','gerencia')
      when 'pagado>retirado'                 then rol in ('gestora','contable','gerencia')
      when 'retirado>devuelto'               then rol in ('contable','gerencia')
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
    -- CAMBIO: ya no se pregunta por `deposito_solicitado`. Ese numero ES la suma de las lineas,
    -- lo escribe h_conceptos_total_presupuesto, y preguntar por los dos seria preguntar dos
    -- veces lo mismo con dos mensajes distintos. Queda la pregunta que si dice algo util.
    select count(*) into lineas_presupuesto
      from public.tramite_conceptos
     where tramite_id = new.id and momento = 'presupuesto' and not anulada;
    if lineas_presupuesto = 0 then
      raise exception 'regla_tramite: Falta cargar el presupuesto: al menos un concepto con su importe';
    end if;
    new.presupuestado_at := coalesce(new.presupuestado_at, now());
  end if;

  if new.estado = 'presentado' then
    if nullif(btrim(coalesce(new.seccional,'')),'') is null then
      raise exception 'regla_tramite: Falta indicar en que seccional se presento';
    end if;
    if new.medio_pago = 'tarjeta_habitualista'
       and not exists (select 1 from public.razones_sociales r
                        where r.id = new.razon_social_id and r.tarjeta_id is not null) then
      raise exception 'regla_tramite: Esa razon social todavia no tiene Tarjeta Habitualista asignada';
    end if;
    new.presentado_at := coalesce(new.presentado_at, now());
  end if;

  if new.estado = 'pagado' then
    select coalesce(sum(importe),0) into total_real
      from public.tramite_conceptos
     where tramite_id = new.id and momento = 'real' and not anulada;
    if total_real <= 0 then
      raise exception 'regla_tramite: Falta cargar el costo real, discriminado por concepto';
    end if;
    new.pagado_at := coalesce(new.pagado_at, now());
  end if;

  if new.estado = 'retirado' then
    if nullif(btrim(coalesce(new.documentacion_retirada,'')),'') is null then
      raise exception 'regla_tramite: Anota que documentacion retiraste: titulo, cedula, chapas';
    end if;
    new.retirado_at := coalesce(new.retirado_at, now());
  end if;

  if new.estado = 'devuelto' then
    new.devuelto_at := coalesce(new.devuelto_at, now());
  end if;

  return new;
end;
$fn$;

-- ------------------------------------------------------------
-- 5) El costo real tambien deja de contar las lineas anuladas
--
--    Misma razon: si se quita una linea del costo real, el total tiene que bajar.
-- ------------------------------------------------------------

create or replace view public.v_tramite_totales with (security_invoker = true) as
select t.id as tramite_id,
       coalesce(sum(c.importe) filter (where c.momento = 'presupuesto' and not c.anulada), 0) as total_presupuesto,
       coalesce(sum(c.importe) filter (where c.momento = 'real' and not c.anulada), 0)        as total_real
  from public.tramites t
  left join public.tramite_conceptos c on c.tramite_id = t.id
 group by t.id;

comment on view public.v_tramite_totales is
  'security_invoker = true en TODA vista de este proyecto. Sin ese flag la vista corre como su duenio, saltea la RLS entera, y alguien ve lo que no tiene que ver.';

revoke insert, update, delete, truncate on public.v_tramite_totales from anon, authenticated;
grant select on public.v_tramite_totales to authenticated;

-- ============================================================================
--  COMO COMPROBAR QUE QUEDO BIEN
--
--  Elegi un tramite en estado `entregado` o `presupuestado` y guardate su id.
--
--  1) Agregar una linea mueve el total del tramite:
--       insert into public.tramite_conceptos (tramite_id, concepto_id, momento, importe)
--       values ('<id>', (select id from public.conceptos where nombre = 'Sellados'), 'presupuesto', 120000);
--
--       select deposito_solicitado from public.tramites where id = '<id>';
--     Esperado: subio 120000 respecto de antes.
--
--  2) Y ESCRIBIO SOLO EN LA CUENTA CORRIENTE, que es lo que pide la FOTO 6:
--       select tipo, importe from public.movimientos
--        where tramite_id = '<id>' order by id desc limit 3;
--     Esperado: una fila `reserva` si era la primera linea, o un `ajuste_reserva` de -120000 si
--     ya habia presupuesto. NUNCA dos filas `reserva`.
--
--  3) Quitar la linea la devuelve:
--       update public.tramite_conceptos set anulada = true, motivo_anulacion = 'cargada de mas'
--        where tramite_id = '<id>' and momento = 'presupuesto'
--          and concepto_id = (select id from public.conceptos where nombre = 'Sellados');
--
--       select deposito_solicitado from public.tramites where id = '<id>';
--     Esperado: volvio al valor de antes. Y hay un `ajuste_reserva` de +120000.
--
--  4) Anular sin motivo NO se puede. Tiene que FALLAR:
--       update public.tramite_conceptos set anulada = true where id = <n>;
--     Esperado: viola tramite_conceptos_anulada_con_motivo.
--
--  5) Y el mismo concepto se puede volver a cargar despues de quitarlo (indice parcial):
--       insert into public.tramite_conceptos (tramite_id, concepto_id, momento, importe)
--       values ('<id>', (select id from public.conceptos where nombre = 'Sellados'), 'presupuesto', 130000);
--     Esperado: entra sin violar el indice unico.
-- ============================================================================
```

- [ ] **Paso 3: Comprobar que la migración no quedó vacía**

```bash
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && npm run migraciones > /tmp/m.log 2>&1; echo "EXIT: $?"; tail -20 /tmp/m.log
```

Esperado: `EXIT: 0`.

- [ ] **Paso 4: Aplicarla**

```bash
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && SUPABASE_ACCESS_TOKEN="$(grep '^SUPABASE_ACCESS_TOKEN=' .env.local | cut -d= -f2-)" npm run db:push > /tmp/p.log 2>&1; echo "EXIT: $?"; tail -30 /tmp/p.log
```

Esperado: `EXIT: 0` y que nombre el archivo nuevo. Si dice `Access token not provided`, el token
no está en `.env.local`: **pedíselo al usuario, no lo inventes ni lo busques en el historial.**

- [ ] **Paso 5: Correr las cinco comprobaciones del bloque de arriba**

No alcanza con que el push diga "Finished". La lección del 19/08/2026 es exactamente ésta: se
descubrió una migración vacía porque se probó que el constraint **bloqueara**, no porque el
comando dijera que terminó. Correr las cinco, con los ids reales, y pegar la salida.

**El paso 4 —anular sin motivo— tiene que salir en ROJO.** Un poka-yoke que nunca se vio fallar
no es un poka-yoke.

- [ ] **Paso 6: Commit**

```bash
git add supabase/migrations/ && git commit -m "El presupuesto es la suma de sus conceptos, y se descuenta solo"
```

---

## Tarea 2: El historial registra todos los cambios del trámite

Cubre FOTO 3 (tener el historial de cambios) y da la mitad de FOTO 8.

**Archivos:**
- Crear: `supabase/migrations/<generado>_historial_de_todo_el_tramite.sql`

**Interfaces:**
- Consume: `public.presupuesto_historial` (10 filas ya cargadas), `public.nombres_de(uuid[])`.
- Produce: la tabla `public.tramite_cambios` con las columnas
  `id, tramite_id, que, campo, antes, despues, quien, cuando`, donde `que in ('deposito','concepto','dato')`.

- [ ] **Paso 1: Crear el archivo**

```bash
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && npm run db:nueva historial_de_todo_el_tramite
```

- [ ] **Paso 2: Escribir la migración**

```sql
-- ============================================================================
--  EL HISTORIAL DEJA DE SER SOLO DEL PRESUPUESTO
-- ============================================================================
--
--  El pedido de la FOTO 8 es "que permita modificar datos, por ejemplo la gestora que realiza el
--  tramite". Un dato que se puede cambiar y no deja rastro es peor que uno que no se puede
--  cambiar: cuando el trabajo aparece con otra persona a cargo, no hay a quien preguntarle.
--
--  ============================================================================
--   SE REGISTRA POR DIFERENCIA DE JSONB, NO ENUMERANDO COLUMNAS
--  ============================================================================
--
--  Es el mismo mecanismo que ya usa `b_tramites_bloquear_campos`, y por el mismo motivo: la
--  version enumerada FALLA ABIERTA. Una columna que se agregue el mes que viene quedaria sin
--  registrar, en silencio, y el historial seguiria diciendo que no paso nada.
--
--  Con la diferencia de jsonb, la columna nueva queda registrada POR DEFECTO y hay que
--  acordarse de EXCLUIRLA si no corresponde. El olvido cae del lado seguro.
--
--  ============================================================================
--   LA TABLA SE RENOMBRA, NO SE CREA UNA NUEVA
--  ============================================================================
--
--  `presupuesto_historial` ya tiene 10 filas de correcciones reales de deposito. Crear una tabla
--  nueva al lado partiria el historial en dos y la ficha tendria que mostrar dos paneles que
--  dicen lo mismo. Renombrarla conserva cada fila y deja un solo lugar donde mirar.
--
--  ES ADITIVA EN DATOS: ninguna fila cambia de valor ni se pierde.

alter table public.presupuesto_historial rename to tramite_cambios;

alter table public.tramite_cambios add column if not exists campo text;

comment on column public.tramite_cambios.campo is
  'Que columna cambio, cuando que = dato. El nombre en pantalla lo pone el front: si viviera '
  'aca, cambiar una etiqueta obligaria a una migracion.';

alter table public.tramite_cambios drop constraint if exists presupuesto_historial_que_valido;
alter table public.tramite_cambios drop constraint if exists tramite_cambios_que_valido;
alter table public.tramite_cambios add constraint tramite_cambios_que_valido
  check (que in ('deposito','concepto','dato'));

comment on table public.tramite_cambios is
  'Cada cambio de un tramite: los datos, las lineas del presupuesto y el total. Lo escriben '
  'triggers y no la pantalla: si lo escribiera la pantalla, un cambio hecho desde otro lado no '
  'quedaria registrado y el historial diria que no paso nada. Solo insercion.';

-- ------------------------------------------------------------
-- El trigger nuevo: cualquier columna que cambie
-- ------------------------------------------------------------

create or replace function public.g_tramites_cambios_de_datos()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  /*
    LO QUE NO SE REGISTRA, Y EL MOTIVO DE CADA UNO:

      estado y los *_at        -> ya tienen su propio historial, en tramite_eventos. Registrarlos
                                  aca duplicaria cada paso de la cadena en dos paneles.
      deposito_solicitado      -> es la SUMA de los conceptos desde la migracion anterior. Su
                                  historia son las lineas, que se registran una por una. Ponerlo
                                  tambien aca mostraria dos renglones por cada importe cargado.
      actualizado_at / _por    -> los escribe el trigger de sello en cada update. Sin excluirlos,
                                  TODA fila de historial vendria acompaniada de dos filas de ruido.
  */
  ignorar text[] := array[
    'estado','deposito_solicitado','actualizado_at','actualizado_por','creado_at','creado_por',
    'controlado_at','entregado_at','presupuestado_at','presentado_at','pagado_at','retirado_at',
    'devuelto_at','autorizado_en','autorizado_por'
  ];
  viejo jsonb := to_jsonb(old) - ignorar;
  nuevo jsonb := to_jsonb(new) - ignorar;
  k     text;
begin
  if viejo is not distinct from nuevo then return null; end if;

  for k in select jsonb_object_keys(nuevo) loop
    if (viejo -> k) is distinct from (nuevo -> k) then
      insert into public.tramite_cambios (tramite_id, que, campo, antes, despues, quien)
      values (new.id, 'dato', k, viejo ->> k, nuevo ->> k, auth.uid());
    end if;
  end loop;

  return null;
end;
$$;

drop trigger if exists g_tramites_cambios_de_datos on public.tramites;
create trigger g_tramites_cambios_de_datos
  after update on public.tramites
  for each row execute function public.g_tramites_cambios_de_datos();

revoke execute on function public.g_tramites_cambios_de_datos() from public, anon, authenticated;

-- ------------------------------------------------------------
-- El de deposito se retira: ese numero ya no lo escribe una persona
-- ------------------------------------------------------------

drop trigger if exists g_tramites_historial_presupuesto on public.tramites;
drop function if exists public.g_tramites_historial_presupuesto();

-- ------------------------------------------------------------
-- RLS: se recrean policy e indice, que el rename no arrastra con el nombre nuevo
-- ------------------------------------------------------------

drop policy if exists "presupuesto_historial_select" on public.tramite_cambios;
drop policy if exists "tramite_cambios_select" on public.tramite_cambios;
create policy "tramite_cambios_select" on public.tramite_cambios for select to authenticated
  using (exists (select 1 from public.tramites x where x.id = tramite_cambios.tramite_id));

-- Sin policy de insert: lo escriben los triggers, que son SECURITY DEFINER y no pasan por RLS.
-- Sin update ni delete para nadie, igual que el libro mayor.
revoke insert, update, delete, truncate on public.tramite_cambios from anon, authenticated;
grant select on public.tramite_cambios to authenticated;

-- ============================================================================
--  COMO COMPROBAR QUE QUEDO BIEN
--
--  1) Las 10 filas viejas siguen ahi:
--       select count(*) from public.tramite_cambios;
--     Esperado: 10 o mas.
--
--  2) Cambiar un dato deja rastro. Con un tramite real:
--       update public.tramites set administrativo = 'PRUEBA HISTORIAL' where id = '<id>';
--       select campo, antes, despues from public.tramite_cambios
--        where tramite_id = '<id>' and que = 'dato' order by cuando desc limit 5;
--     Esperado: una fila con campo = 'administrativo'.
--
--  3) Y cambiar DOS datos de una deja DOS filas, no una:
--       update public.tramites set administrativo = 'OTRA', seccional = '19005' where id = '<id>';
--     Esperado: dos filas nuevas, una por columna.
--
--  4) Nadie lo puede editar ni borrar. Las dos tienen que dar false:
--       select has_table_privilege('authenticated','public.tramite_cambios','UPDATE') as u,
--              has_table_privilege('authenticated','public.tramite_cambios','DELETE') as d;
--
--  5) `npm run permisos` en verde.
-- ============================================================================
```

- [ ] **Paso 3: Aplicar y comprobar**

```bash
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && npm run migraciones > /tmp/m.log 2>&1; echo "MIG EXIT: $?"; SUPABASE_ACCESS_TOKEN="$(grep '^SUPABASE_ACCESS_TOKEN=' .env.local | cut -d= -f2-)" npm run db:push > /tmp/p.log 2>&1; echo "PUSH EXIT: $?"; tail -20 /tmp/p.log
```

Después correr las cinco comprobaciones del bloque. Esperado: `EXIT: 0` en las dos y las cinco
comprobaciones dando lo escrito.

- [ ] **Paso 4: Commit**

```bash
git add supabase/migrations/ && git commit -m "El historial del tramite registra cualquier dato que cambie"
```

---

## Tarea 3: El checklist con respuestas Sí y No

Cubre FOTO 1.

**Archivos:**
- Crear: `supabase/migrations/<generado>_checklist_si_o_no.sql`

**Interfaces:**
- Consume: `public.requisitos` (5 filas activas), `public.tramite_requisitos.respuesta`
  (`si` | `no` | `no_aplica`).
- Produce: la columna `public.requisitos.tipo` con valores `documento` | `si_no`.

- [ ] **Paso 1: Crear el archivo**

```bash
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && npm run db:nueva checklist_si_o_no
```

- [ ] **Paso 2: Escribir la migración**

```sql
-- ============================================================================
--  NO TODOS LOS ITEMS DEL CHECKLIST SON PAPELES
-- ============================================================================
--
--  El pedido de la FOTO 1: "opciones de accesorios deberian ser si-no / entrega de vehiculos
--  si-no / son opciones, deberia estar en formato de checklist".
--
--  LA TANDA ANTERIOR LO ENTENDIO AL PIE DE LA LETRA Y POR ESO SALIO MAL: creo un requisito
--  llamado literalmente "Accesorios si/no" y le dejo las tres respuestas de siempre —Esta,
--  Falta, No corresponde—. O sea que la pantalla preguntaba si el "si/no" ESTABA.
--
--  La diferencia real es de naturaleza. Los tres primeros son PAPELES: pueden estar, faltar, o
--  no corresponder a ese tramite. Los dos ultimos son HECHOS de la operacion: la venta incluye
--  accesorios o no los incluye, y hay un usado en parte de pago o no lo hay. "No corresponde" no
--  significa nada ahi, y ofrecerlo es ofrecer una respuesta que no quiere decir nada — que es
--  como un checklist se vuelve un tramite mas.
--
--  Y DE PASO SE LES ARREGLAN LOS ACENTOS. Los nombres se cargaron sin ellos y se ven en la
--  pantalla que mira la duenia de la empresa.
--
--  ES ADITIVA: una columna con default, y cinco filas que cambian de nombre.

alter table public.requisitos add column if not exists tipo text not null default 'documento';

comment on column public.requisitos.tipo is
  'documento: un papel del legajo, se contesta Esta / Falta / No corresponde. si_no: un hecho de '
  'la operacion (hay accesorios, hay usado en parte de pago), se contesta Si o No. "No '
  'corresponde" sobre un hecho no significa nada, y una respuesta que no significa nada es como '
  'un control se vuelve un trampolin.';

alter table public.requisitos drop constraint if exists requisitos_tipo_valido;
alter table public.requisitos add constraint requisitos_tipo_valido
  check (tipo in ('documento','si_no'));

update public.requisitos set tipo = 'si_no', nombre = 'Accesorios'
 where nombre = 'Accesorios si/no';

update public.requisitos set tipo = 'si_no', nombre = 'Entrega de vehículo usado'
 where nombre = 'Entrega de vehiculo usado si/no';

update public.requisitos set nombre = 'Revisión de factura del auto'
 where nombre = 'Revision de factura del auto';

update public.requisitos set nombre = 'Revisión de factura por gastos'
 where nombre = 'Revision de factura por gastos';

-- ============================================================================
--  COMO COMPROBAR QUE QUEDO BIEN
--
--  1) Los cinco, con su tipo y su nombre bien escrito:
--       select orden, nombre, tipo from public.requisitos where activo order by orden;
--     Esperado, en este orden:
--       Control de la oferta - Saldo 0      documento
--       Revisión de factura del auto        documento
--       Revisión de factura por gastos      documento
--       Accesorios                          si_no
--       Entrega de vehículo usado           si_no
--
--  2) Un tipo inventado NO entra. Tiene que FALLAR:
--       update public.requisitos set tipo = 'checkbox' where nombre = 'Accesorios';
--     Esperado: viola requisitos_tipo_valido.
--
--  3) Las respuestas ya cargadas siguen valiendo: no se toco tramite_requisitos.
--       select count(*) from public.tramite_requisitos;
--     Esperado: el mismo numero que antes de esta migracion.
-- ============================================================================
```

- [ ] **Paso 3: Aplicar y comprobar**

```bash
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && npm run migraciones > /tmp/m.log 2>&1; echo "MIG EXIT: $?"; SUPABASE_ACCESS_TOKEN="$(grep '^SUPABASE_ACCESS_TOKEN=' .env.local | cut -d= -f2-)" npm run db:push > /tmp/p.log 2>&1; echo "PUSH EXIT: $?"; tail -20 /tmp/p.log
```

**La comprobación 2 tiene que salir en rojo.** Si entra, el constraint no se aplicó.

- [ ] **Paso 4: Commit**

```bash
git add supabase/migrations/ && git commit -m "Accesorios y usado se contestan Si o No, no Esta o Falta"
```

---

## Tarea 4: Anular un movimiento de la cuenta

Cubre la parte de *"sigue sin permitir modificar o eliminar saldos"*.

**Archivos:**
- Crear: `supabase/migrations/<generado>_anular_un_movimiento.sql`

**Interfaces:**
- Consume: `public.movimientos`, `public.v_saldos`, `public.es_oficina()`.
- Produce: la columna `movimientos.corrige_movimiento_id bigint`, y la función
  `public.anular_movimiento(p_id bigint, p_motivo text) returns bigint`, que devuelve el id del
  movimiento de compensación.

- [ ] **Paso 1: Crear el archivo**

```bash
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && npm run db:nueva anular_un_movimiento
```

- [ ] **Paso 2: Escribir la migración**

```sql
-- ============================================================================
--  UN MOVIMIENTO CARGADO MAL SE ANULA. NO SE BORRA, Y NO SE EDITA.
-- ============================================================================
--
--  El pedido, textual: "sigue sin permitir modificar o eliminar saldos y datos". Es cierto y hay
--  que resolverlo: hoy un deposito de tres millones cargado con un cero de mas queda ahi para
--  siempre, y el saldo de la pantalla deja de coincidir con el sitio de Habitualista — que es
--  exactamente lo unico que esa cifra promete.
--
--  ============================================================================
--   PERO NO CON UN DELETE, Y ESTO NO ES UNA PREFERENCIA
--  ============================================================================
--
--  El libro mayor es de sola insercion porque el saldo de ayer tiene que poder reconstruirse. Un
--  delete lo rompe: al dia siguiente la conciliacion contra el listado real no cierra y nadie
--  puede decir por que. Un update es peor todavia, porque no deja ni el rastro de que hubo un
--  cambio.
--
--  ASI QUE SE COMPENSA. Anular un ingreso de 3.000.000 inserta un `ajuste` de -3.000.000 que
--  apunta al original. Los dos se suman a cero, el saldo queda bien, y en la pantalla el
--  original se ve tachado con su compensacion debajo. Para quien mira, el error desaparecio.
--  Para el libro, no se destruyo nada.
--
--  ============================================================================
--   SOLO LO QUE CARGO UNA PERSONA
--  ============================================================================
--
--  Un `ingreso`, un `saldo_inicial` o un `ajuste` los escribio alguien a mano desde
--  Administracion, y se pueden equivocar. Una `reserva`, un `pago` o un `ajuste_reserva` los
--  escribio un trigger a partir del presupuesto de un tramite: anularlos desde aca dejaria la
--  cuenta diciendo una cosa y el tramite otra. Esos se corrigen corrigiendo el presupuesto, que
--  es lo que la tarea 1 hizo posible.
--
--  ES ADITIVA: una columna, un indice, una funcion, y la vista que deja de contar lo anulado.

alter table public.movimientos
  add column if not exists corrige_movimiento_id bigint references public.movimientos(id);

comment on column public.movimientos.corrige_movimiento_id is
  'A que movimiento anula este ajuste. Los dos se suman a cero: el saldo queda bien sin haber '
  'borrado ni editado nada, y el error queda visible con su motivo en vez de desaparecer.';

-- Un ajuste, y nada mas, puede anular. Sin esto alguien podria marcar un `ingreso` como
-- correccion de otro y duplicar plata en vez de compensarla.
alter table public.movimientos drop constraint if exists movimientos_correccion_es_ajuste;
alter table public.movimientos add constraint movimientos_correccion_es_ajuste
  check (corrige_movimiento_id is null or tipo = 'ajuste');

-- Una sola anulacion por movimiento. Dos compensaciones del mismo ingreso lo restarian dos
-- veces, y el saldo quedaria peor que antes de corregirlo.
create unique index if not exists movimientos_una_anulacion_por_movimiento
  on public.movimientos (corrige_movimiento_id) where corrige_movimiento_id is not null;

-- ------------------------------------------------------------
-- La funcion. El front NO arma el ajuste: lo arma la base.
--
--   Si lo armara el front, el signo, la fecha de acreditacion y el tipo dependerian de que la
--   pantalla los calcule bien cada vez. Un signo al reves acá no da error: duplica el importe.
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

  if exists (select 1 from public.movimientos where corrige_movimiento_id = p_id) then
    raise exception 'regla_tramite: Ese movimiento ya estaba anulado';
  end if;

  /*
    LA FECHA DE ACREDITACION SE COPIA DEL ORIGINAL, no se pone hoy.

    Un deposito ordenado hoy acredita maniana. Si la compensacion acreditara hoy, el saldo
    contable bajaria hoy por una plata que todavia no habia subido, y la pantalla mostraria un
    saldo menor que el del sitio durante un dia entero. Con la misma fecha, los dos entran
    juntos y en ningun momento hay una cifra que no se pueda explicar.
  */
  insert into public.movimientos
    (tarjeta_id, tipo, importe, fecha, fecha_acreditacion, concepto, observacion,
     corrige_movimiento_id, origen, creado_por)
  values (m.tarjeta_id, 'ajuste', -m.importe, now(), m.fecha_acreditacion,
          'Anulación de ' || coalesce(m.concepto, m.tipo),
          btrim(p_motivo), p_id, 'app', auth.uid())
  returning id into v_nuevo;

  return v_nuevo;
end;
$$;

revoke all on function public.anular_movimiento(bigint, text) from public, anon;
grant execute on function public.anular_movimiento(bigint, text) to authenticated;

-- ------------------------------------------------------------
-- La vista deja de contar en transito lo que se anulo
--
--   `contable` no necesita cambiar: el ajuste ES de tipo ajuste, ya lo cuenta, y los dos se
--   anulan solos. `en_transito` si, porque filtra por tipo = 'ingreso' y el ajuste no lo es:
--   sin esta correccion, anular un deposito pendiente lo dejaria figurando como plata que llega
--   maniana.
--
--   Se usa `create or replace`: no se agrega ni se reordena ninguna columna, solo cambia una
--   expresion, y eso Postgres si lo permite.
-- ------------------------------------------------------------

create or replace view public.v_saldos with (security_invoker = true) as
select th.id as tarjeta_id,
       th.nombre,
       coalesce(sum(m.importe) filter (
         where m.tipo in ('saldo_inicial','ingreso','pago','ajuste')
           and m.fecha_acreditacion <= current_date), 0) as contable,
       coalesce(sum(m.importe) filter (
         where m.tipo = 'ingreso' and m.fecha_acreditacion > current_date
           and not exists (select 1 from public.movimientos c
                            where c.corrige_movimiento_id = m.id)), 0) as en_transito,
       coalesce(-sum(m.importe) filter (
         where m.tipo in ('reserva','ajuste_reserva','reversa_reserva')), 0) as comprometido,
       th.orden
  from public.tarjetas_habitualista th
  left join public.movimientos m on m.tarjeta_id = th.id
 group by th.id, th.nombre, th.orden;

comment on view public.v_saldos is
  'contable tiene que dar IGUAL al saldo del sitio de Habitualista: por eso excluye lo que esta '
  'en transito, que el sitio tampoco muestra. en_transito no cuenta los depositos anulados. La '
  'cuarta cifra de la pantalla, contable - comprometido, es exactamente lo que hoy no se ve, y '
  'es por lo que dos personas comprometen la misma plata.';

-- Al recrear una vista Postgres NO conserva lo revocado, y sin estas dos lineas quedaria
-- escribible otra vez. Es exactamente para lo que existe `npm run permisos`.
revoke insert, update, delete, truncate on public.v_saldos from anon, authenticated;
grant select on public.v_saldos to authenticated;

-- ============================================================================
--  COMO COMPROBAR QUE QUEDO BIEN
--
--  1) Anotate el saldo de una tarjeta:
--       select nombre, contable, en_transito from public.v_saldos order by orden;
--
--  2) Anula un ingreso real, desde la consola SQL del panel:
--       select public.anular_movimiento(
--         (select id from public.movimientos where tipo = 'ingreso' order by id desc limit 1),
--         'prueba de anulacion, 21/08/2026');
--
--  3) El saldo volvio al valor de antes:
--       select nombre, contable, en_transito from public.v_saldos order by orden;
--     Esperado: identico al paso 1.
--
--  4) Y el original SIGUE ESTANDO, con su compensacion al lado:
--       select id, tipo, importe, corrige_movimiento_id, observacion
--         from public.movimientos order by id desc limit 2;
--     Esperado: dos filas, la nueva apunta a la vieja. NINGUNA se borro.
--
--  5) Anularlo dos veces NO se puede. Tiene que FALLAR:
--       select public.anular_movimiento(<el mismo id>, 'de nuevo');
--     Esperado: 'Ese movimiento ya estaba anulado'.
--
--  6) Una reserva NO se puede anular desde aca. Tiene que FALLAR:
--       select public.anular_movimiento(
--         (select id from public.movimientos where tipo = 'reserva' limit 1), 'probando');
--     Esperado: 'Ese movimiento lo genero un tramite'.
--
--  7) Sin motivo tampoco. Tiene que FALLAR:
--       select public.anular_movimiento(<un id valido>, '   ');
--     Esperado: 'Escribi por que se anula'.
--
--  8) `npm run permisos` en verde.
-- ============================================================================
```

- [ ] **Paso 3: Aplicar y correr las ocho comprobaciones**

```bash
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && npm run migraciones > /tmp/m.log 2>&1; echo "MIG EXIT: $?"; SUPABASE_ACCESS_TOKEN="$(grep '^SUPABASE_ACCESS_TOKEN=' .env.local | cut -d= -f2-)" npm run db:push > /tmp/p.log 2>&1; echo "PUSH EXIT: $?"; tail -20 /tmp/p.log; npm run permisos > /tmp/perm.log 2>&1; echo "PERMISOS EXIT: $?"; tail -20 /tmp/perm.log
```

**Las comprobaciones 5, 6 y 7 tienen que salir en rojo.** Las tres son el poka-yoke; si alguna
pasa, la función deja pasar algo que rompe el saldo.

- [ ] **Paso 4: Commit**

```bash
git add supabase/migrations/ && git commit -m "Un movimiento cargado mal se anula con motivo, y el saldo vuelve a cerrar"
```

---

## Tarea 5: Tipos generados y los cuatro comandos en verde

Bisagra entre la base y el front. Sin esto, todo lo que sigue no compila.

**Archivos:**
- Modificar: `src/lib/database.types.ts` (lo regenera el script, no se edita a mano)

- [ ] **Paso 1: Regenerar los tipos**

```bash
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && SUPABASE_ACCESS_TOKEN="$(grep '^SUPABASE_ACCESS_TOKEN=' .env.local | cut -d= -f2-)" npm run db:tipos > /tmp/t.log 2>&1; echo "EXIT: $?"; tail -10 /tmp/t.log
```

- [ ] **Paso 2: Comprobar que los tipos traen lo nuevo**

```bash
cd "C:/Users/Vmagni/Desktop/GRUPO PARIS/GESTORIA" && for s in "tramite_cambios" "anulada" "corrige_movimiento_id" "anular_movimiento" "tipo:"; do printf '%-26s ' "$s"; grep -c "$s" src/lib/database.types.ts; done
```

Esperado: todos mayores que 0. Si `tramite_cambios` da 0, la migración de la tarea 2 no llegó.

- [ ] **Paso 3: Ver qué se rompió**

```bash
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && npx tsc -b > /tmp/tsc.log 2>&1; echo "EXIT: $?"; head -40 /tmp/tsc.log
```

Esperado: **falla**, y las fallas nombran `presupuesto_historial` en `src/lib/datos.ts` y en
`src/features/tramites/HistorialPresupuesto.tsx`. Es correcto: la tabla se renombró.

- [ ] **Paso 4: Dejar los tipos en verde AHORA, con el cambio mínimo**

El arreglo de fondo es la tarea 13. Pero dejar el compilador en rojo durante siete tareas es
exactamente lo que este proyecto no tolera: **una advertencia permanente entrena a ignorar las
advertencias**, y con `tsc` rojo de entrada nadie distingue el error nuevo del error viejo.

Así que acá va sólo el cambio mecánico. En `src/lib/datos.ts`, en `useHistorialPresupuesto`,
cambiar la tabla:

```ts
        .from("tramite_cambios")
```

y el `queryKey` a `["tramite_cambios", tramiteId]`. Nada más: el hook sigue llamándose igual y la
pantalla sigue siendo la vieja hasta la tarea 13.

Buscar cualquier otra referencia al nombre viejo y cambiarla igual:

```bash
cd "C:/Users/Vmagni/Desktop/GRUPO PARIS/GESTORIA" && grep -rn "presupuesto_historial" src/
```

- [ ] **Paso 5: Los cuatro comandos, en verde**

```bash
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && npx tsc -b > /tmp/a.log 2>&1; echo "TIPOS: $?"; head -20 /tmp/a.log; npm run lint > /tmp/b.log 2>&1; echo "LINT: $?"; npm test > /tmp/c.log 2>&1; echo "TESTS: $?"; grep -E "Tests" /tmp/c.log | tail -3
```

Esperado: **los tres en 0**. Desde acá, cualquier error que aparezca es de la tarea que se está
haciendo, y eso es lo que hace que valga la pena mirarlo.

- [ ] **Paso 6: Commit**

```bash
git add src/lib/database.types.ts src/lib/datos.ts && git commit -m "Tipos regenerados y el historial apuntando a la tabla con su nombre nuevo"
```

---

## Tarea 6: El menú se arma por rol

Cubre FOTO 7.

**Archivos:**
- Modificar: `src/menu.ts`
- Test: `src/menu.test.ts` (crear)

**Interfaces:**
- Consume: `Rol` y `puedeAdministrar` de `src/lib/roles.ts`.
- Produce: `menuPara(rol: Rol)` sigue con la misma firma. Cambia lo que devuelve para `gestora`.

- [ ] **Paso 1: Escribir el test que falla**

Crear `src/menu.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { menuPara } from "./menu";

/**
 * Lo que se prueba acá no es que el menú tenga tal o cual ítem: es que las DOS necesidades del
 * sistema no se mezclen en una sola barra. Gestoría pide la plata; la oficina la administra.
 */

describe("gestoría ve lo suyo y nada más", () => {
  it("no puede cargar un trámite: eso lo hacen contable y gerencia", () => {
    // Es el pedido de la FOTO 7, y es correcto: el trámite nace de un mail que llega a
    // administración. Una gestora parada en el registro no carga altas.
    const ids = menuPara("gestora").map((m) => m.id);
    expect(ids).not.toContain("alta");
  });

  it("tampoco entra a Administración", () => {
    expect(menuPara("gestora").map((m) => m.id)).not.toContain("admin");
  });

  it("pero sí ve sus trámites y el saldo de la tarjeta", () => {
    // El saldo es lo que le dice si lo que presupuestó se puede pagar hoy o recién mañana.
    const ids = menuPara("gestora").map((m) => m.id);
    expect(ids).toContain("tramites");
    expect(ids).toContain("tarjeta");
  });
});

describe("la oficina ve todo, y las dos mitades ven lo mismo", () => {
  it("contable y gerencia tienen exactamente el mismo menú", () => {
    // Lo pidió el usuario textual: "Sí, todo idéntico incluidos los usuarios". Antes contable no
    // veía Administración, y la consecuencia era que confirmar un plazo o atender un aviso
    // dependía de que una sola persona estuviera disponible.
    expect(menuPara("contable").map((m) => m.id)).toEqual(menuPara("gerencia").map((m) => m.id));
  });

  it("y pueden cargar trámites", () => {
    expect(menuPara("gerencia").map((m) => m.id)).toContain("alta");
    expect(menuPara("contable").map((m) => m.id)).toContain("alta");
  });
});

describe("sin rol asignado no hay menú", () => {
  it("no ve ninguna pantalla", () => {
    expect(menuPara("sin_asignar")).toHaveLength(0);
  });
});
```

- [ ] **Paso 2: Correr el test y verificar que falla por la razón esperada**

```bash
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && npx vitest run src/menu.test.ts > /tmp/v.log 2>&1; echo "EXIT: $?"; tail -30 /tmp/v.log
```

Esperado: **FALLA**, y falla en *"no puede cargar un trámite"* (hoy gestoría sí ve `alta`) y en
*"sin rol asignado no hay menú"* (hoy `sin_asignar` recibe cuatro pantallas). Que falle en esas
dos y no en otras es la señal de que el test dice lo correcto.

- [ ] **Paso 3: Cambiar `src/menu.ts`**

Reemplazar el bloque desde `export const MENU` hasta el final del archivo por:

```ts
/**
 * `corto` es para la barra de abajo del teléfono, donde cada botón tiene 75 píxeles.
 *
 * NO SE ABREVIA CON PUNTOS NI SE CORTA CON CSS. "Administraci..." obliga a adivinar, y una
 * etiqueta que se adivina se toca mal. Se elige una palabra más corta que siga siendo una
 * palabra entera.
 *
 * `roles` dice quién ve cada pantalla, y está acá y no repartido en condiciones sueltas por un
 * motivo: es la lista completa, en un solo lugar, de qué necesita cada persona. Cuando eso vive
 * en cinco archivos, nadie puede contestar "¿qué ve una gestora?" sin leerlos todos.
 */
export const MENU: {
  id: Pantalla; nombre: string; corto: string; icono: typeof Wallet; roles: Rol[];
}[] = [
  /*
    ============================================================================
     SON DOS NECESIDADES DISTINTAS, Y POR ESO SON DOS MENUS
    ============================================================================

    Lo dictó el usuario: "gestoría, viendo qué hay para presentar para poder presupuestar y pedir
    el dinero, para poder pagar en el día o proyectar para mañana; contable y gerencia para poder
    administrar lo que pide la gestora".

    GESTORIA no carga trámites. El trámite nace de un mail que le llega a administración, y el
    alta la hace quien recibe ese mail. Ofrecerle a la gestora un formulario de alta es ofrecerle
    trabajo que no es suyo, en la pantalla más chica de todas.

    SI VE LOS PEDIDOS DE FONDOS, y no es una contradicción: la RLS le muestra únicamente sus
    trámites, así que para ella esa pantalla dice "lo que pedí y todavía no me pagaron". Para la
    oficina, la misma pantalla dice "lo que me están pidiendo". Una pantalla, dos lecturas, según
    quién entra.
  */
  { id: "bandeja",  nombre: "Pedidos de fondos", corto: "Pedidos",  icono: HandCoins,
    roles: ["gestora", "contable", "gerencia"] },
  { id: "tarjeta",  nombre: "Tarjeta",           corto: "Tarjeta",  icono: Wallet,
    roles: ["gestora", "contable", "gerencia"] },
  { id: "tramites", nombre: "Trámites",          corto: "Trámites", icono: LayoutList,
    roles: ["gestora", "contable", "gerencia"] },
  { id: "alta",     nombre: "Cargar trámite",    corto: "Cargar",   icono: FilePlus,
    roles: ["contable", "gerencia"] },
  { id: "admin",    nombre: "Administración",    corto: "Ajustes",  icono: Settings,
    roles: ["contable", "gerencia"] },
];

/**
 * Qué pantallas ve cada rol. NO decide permisos: evita mostrar botones que van a fallar.
 *
 * Si alguien borra este archivo, la app se vuelve fea y sigue siendo segura. Los permisos los
 * decide la RLS.
 */
export function menuPara(rol: Rol): typeof MENU {
  return MENU.filter((m) => m.roles.includes(rol));
}
```

Y cambiar la línea 2 del archivo, la importación, por:

```ts
import { type Rol } from "./lib/roles";
```

`puedeAdministrar` deja de usarse acá, pero **no se borra de `roles.ts`**: la usa
`src/features/admin/` y el resto de las pantallas.

- [ ] **Paso 4: Correr el test y verificar que pasa**

```bash
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && npx vitest run src/menu.test.ts > /tmp/v.log 2>&1; echo "EXIT: $?"; tail -20 /tmp/v.log
```

Esperado: `EXIT: 0`, 6 tests en verde.

- [ ] **Paso 5: Comprobar que no rompió el resto**

```bash
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && npx tsc -b > /tmp/tsc.log 2>&1; echo "TIPOS: $?"; npm run lint > /tmp/l.log 2>&1; echo "LINT: $?"; tail -5 /tmp/l.log
```

Los errores de tipos que queden tienen que ser **sólo** los de `presupuesto_historial` anotados en
la tarea 5. Si aparece uno nuevo en `Shell.tsx` o en `App.tsx`, es de este cambio y se arregla acá.

- [ ] **Paso 6: Commit**

```bash
git add src/menu.ts src/menu.test.ts && git commit -m "Gestoria no carga tramites: el menu se arma por rol"
```

---

## Tarea 7: La Tarjeta con las cuatro columnas

Cubre FOTO 4.

**Archivos:**
- Modificar: `src/features/tarjeta/Tarjeta.tsx:61-117`
- Modificar: `src/lib/fechas.ts` (se le quitan `antesDelCorte` y `minutosHasta`)
- Modificar: `src/lib/fechas.test.ts` (se les quitan sus tests)

**Interfaces:**
- Consume: `useSaldos()` de `src/lib/datos.ts`, que devuelve
  `{ tarjeta_id, nombre, contable, en_transito, comprometido, orden }`.
- Produce: nada que otra tarea consuma.

- [ ] **Paso 1: Reemplazar el bloque de cifras**

En `src/features/tarjeta/Tarjeta.tsx`, borrar las líneas 61 a 117 —desde `const disponible =`
hasta el `</div>` que cierra la grilla— y poner en su lugar:

```tsx
  /*
    ============================================================================
     LAS CUATRO COLUMNAS, CON LOS NOMBRES QUE USA LA EMPRESA
    ============================================================================

    Los nombres los dictó el usuario y se copian literales. No es un detalle de redacción: la
    pantalla tiene que poder compararse contra el sitio de Habitualista sin traducir nada
    mentalmente, y "Contable" o "En tránsito" son palabras del sistema, no de la operación.

    LA CUARTA ES LA QUE DECIDE. "Diferencia entre el saldo de hoy y lo reservado" es con lo que
    se contesta la única pregunta que importa a la mañana: ¿alcanza para mandar a presentar?
    Cuando da negativo se pinta en rojo, porque significa que hay más comprometido que plata.

    LA CUENTA REGRESIVA AL CORTE SE SACO a pedido del usuario. Con ella se van `antesDelCorte` y
    `minutosHasta` de fechas.ts. La información que daba —que un depósito ordenado después de las
    16:00 acredita pasado mañana— sigue estando donde se necesita: en el formulario de Cargar
    dinero, que es el momento en que alguien decide depositar.
  */
  const diferencia = saldo.contable - saldo.comprometido;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl">Tarjeta Habitualista</h1>
        <select
          value={elegida ?? ""}
          onChange={(e) => elegir(e.target.value)}
          className={CAMPO_SUELTO}
        >
          {saldos.data?.map((s) => (
            <option key={s.tarjeta_id} value={s.tarjeta_id}>{s.nombre}</option>
          ))}
        </select>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Cifra
          rotulo="Saldo día de hoy"
          valor={saldo.contable}
          ayuda="Lo acreditado. Tiene que coincidir con el sitio."
        />
        <Cifra
          rotulo="Depósito pendiente de acreditación"
          valor={saldo.en_transito}
          ayuda="Ordenado, acredita mañana. Todavía no se puede gastar."
          apagado
        />
        <Cifra
          rotulo="Saldo reservado"
          valor={saldo.comprometido}
          ayuda="Presupuestos cargados y sin pagar."
        />
        <Cifra
          rotulo="Diferencia"
          valor={diferencia}
          ayuda="Saldo de hoy menos lo reservado. Con esto se decide si se presenta."
          destacado
          alerta={diferencia < 0}
        />
      </div>
```

- [ ] **Paso 2: Limpiar las importaciones**

En la línea 7 del mismo archivo, cambiar:

```ts
import { formatearFechaHora, hoyArgentina, minutosHasta, antesDelCorte } from "../../lib/fechas";
```

por:

```ts
import { formatearFechaHora, hoyArgentina } from "../../lib/fechas";
```

Y borrar la constante `CORTE_POR_DEFECTO` (línea 22) y su comentario, que ya no se usa.

- [ ] **Paso 3: Borrar las dos funciones de la cuenta regresiva**

En `src/lib/fechas.ts`, borrar `antesDelCorte` (línea 94) y `minutosHasta` (línea 105) con sus
comentarios. En `src/lib/fechas.test.ts`, borrar los bloques `describe` que las prueban.

Antes de borrar, comprobá que no las usa nadie más:

```bash
cd "C:/Users/Vmagni/Desktop/GRUPO PARIS/GESTORIA" && grep -rn "antesDelCorte\|minutosHasta\|CORTE_POR_DEFECTO" src/ --include=*.ts --include=*.tsx
```

Esperado después de borrar: sin resultados.

- [ ] **Paso 4: Los cuatro comandos**

```bash
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && npx tsc -b > /tmp/a.log 2>&1; echo "TIPOS: $?"; npm run lint > /tmp/b.log 2>&1; echo "LINT: $?"; npm test > /tmp/c.log 2>&1; echo "TESTS: $?"; grep -E "Tests|FAIL" /tmp/c.log | tail -5
```

Los errores de tipos que queden tienen que ser **sólo** los de `presupuesto_historial`.

- [ ] **Paso 5: Mirarlo en el navegador**

Levantar el servidor y abrir la Tarjeta. **Genchi genbutsu: esto no está listo hasta que se
mire.** Comprobar las cuatro columnas, sus nombres, y que la Diferencia se pinte en rojo si da
negativo.

- [ ] **Paso 6: Commit**

```bash
git add src/features/tarjeta/Tarjeta.tsx src/lib/fechas.ts src/lib/fechas.test.ts && git commit -m "La tarjeta muestra las cuatro cifras con los nombres de la empresa"
```

---

## Tarea 8: El extracto legible, y con Anular

Cubre FOTO 6 (que el presupuesto aparezca en operaciones) y la parte de saldos de
*"modificar o eliminar"*.

**Archivos:**
- Crear: `src/features/tarjeta/Operaciones.tsx`
- Modificar: `src/features/tarjeta/Tarjeta.tsx` (usa el componente nuevo)
- Modificar: `src/lib/datos.ts` (`useMovimientos` y `useAnularMovimiento`)

**Interfaces:**
- Consume: `public.anular_movimiento(bigint, text)` de la tarea 4.
- Produce: `useMovimientos(tarjetaId)` devuelve filas con
  `{ id, fecha, fecha_acreditacion, tipo, importe, concepto, observacion, corrige_movimiento_id, cliente, anulado }`,
  y `useAnularMovimiento()` con `.mutate({ id, motivo })`.

- [ ] **Paso 1: Cambiar `useMovimientos` en `src/lib/datos.ts`**

Reemplazar la función entera por:

```ts
/**
 * El extracto de una tarjeta.
 *
 * TRAE EL NOMBRE DEL CLIENTE, y ésa es la diferencia entre un extracto y una lista de números.
 * Antes la columna Concepto decía "reserva" — una palabra del sistema. Cuando la gestora carga
 * un presupuesto y quiere ver que se descontó, lo que busca es el apellido del cliente, no el
 * tipo de asiento.
 *
 * `anulado` sale de si existe otro movimiento que apunte a éste. Se calcula acá y no en la base
 * porque es una lectura, no una regla: la regla —que sólo se pueda anular una vez— vive en el
 * índice único.
 */
export function useMovimientos(tarjetaId: string | null) {
  return useQuery({
    queryKey: ["movimientos", tarjetaId],
    enabled: tarjetaId !== null,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("movimientos")
        .select(
          "id, fecha, fecha_acreditacion, tipo, importe, concepto, observacion, " +
            "corrige_movimiento_id, tramites(cliente_nombre)",
        )
        .eq("tarjeta_id", tarjetaId ?? "")
        .order("fecha", { ascending: false })
        .order("id", { ascending: false })
        .limit(200);
      if (error) throw error;

      const filas = data ?? [];
      const anulados = new Set(
        filas.map((m) => m.corrige_movimiento_id).filter((x): x is number => x !== null),
      );

      return filas.map((m) => ({
        id: m.id,
        fecha: m.fecha,
        fecha_acreditacion: m.fecha_acreditacion,
        tipo: m.tipo,
        importe: aNumero(m.importe),
        concepto: m.concepto,
        observacion: m.observacion,
        corrige_movimiento_id: m.corrige_movimiento_id,
        cliente: m.tramites?.cliente_nombre ?? null,
        anulado: anulados.has(m.id),
      }));
    },
  });
}

/**
 * Anular un movimiento cargado mal.
 *
 * LLAMA A LA BASE Y NO ARMA EL AJUSTE ACA. Si esta pantalla armara la compensación, el signo, la
 * fecha de acreditación y el tipo dependerían de que el front los calcule bien cada vez — y un
 * signo al revés no da error, duplica el importe.
 */
export function useAnularMovimiento() {
  return useGuardar(
    async (v: { id: number; motivo: string }) => {
      const { error } = await supabase.rpc("anular_movimiento", {
        p_id: v.id,
        p_motivo: v.motivo,
      });
      if (error) throw error;
    },
    { exito: "Movimiento anulado", invalidar: ["saldos", "movimientos"] },
  );
}
```

Si `useGuardar` no está declarado antes en el archivo, moverla arriba o importarla — comprobalo
con `grep -n "export function useGuardar" src/lib/datos.ts`.

- [ ] **Paso 2: Crear `src/features/tarjeta/Operaciones.tsx`**

```tsx
import { useState } from "react";
import { Panel } from "../../components/Panel";
import { SkeletonLineas } from "../../components/Skeleton";
import { aCentavos, formatear } from "../../lib/plata";
import { formatearFechaHora, hoyArgentina } from "../../lib/fechas";
import { BOTON_SUAVE, CAMPO_SUELTO } from "../../lib/campos";

/**
 * ============================================================================
 *  EL EXTRACTO DE LA TARJETA
 * ============================================================================
 *
 *  CALCA LA FORMA DEL SITIO que ya usan: arriba las cifras, abajo el listado de operaciones. No
 *  es estética, es la forma mental con la que ya trabajan.
 *
 *  ============================================================================
 *   POR QUE LA COLUMNA DICE EL NOMBRE DEL CLIENTE
 *  ============================================================================
 *
 *  El pedido de la FOTO 6 es que al cargar un presupuesto aparezca acá el descuento. Aparecía —
 *  pero decía "reserva", que es una palabra del sistema. Quien mira esta pantalla busca el
 *  apellido, y una fila que no lo trae obliga a abrir el trámite para saber de qué habla.
 *
 *  ============================================================================
 *   UN MOVIMIENTO ANULADO NO DESAPARECE: SE TACHA
 *  ============================================================================
 *
 *  Es la diferencia entre corregir y esconder. La fila queda, gris y tachada, con su motivo, y
 *  abajo la compensación que la neutraliza. El saldo cierra igual que si se hubiera borrado, y
 *  además queda escrito qué pasó — que es lo que hace falta cuando alguien pregunta por qué el
 *  saldo de ayer no es el que recordaba.
 */

export interface Movimiento {
  id: number;
  fecha: string;
  fecha_acreditacion: string;
  tipo: string;
  importe: number;
  concepto: string | null;
  observacion: string | null;
  corrige_movimiento_id: number | null;
  cliente: string | null;
  anulado: boolean;
}

/** Los movimientos que cargó una persona a mano. Son los únicos que se pueden anular. */
const A_MANO = ["ingreso", "saldo_inicial", "ajuste"];

export function Operaciones({
  movimientos, cargando, puedeAnular, alAnular, anulando,
}: {
  movimientos: Movimiento[];
  cargando: boolean;
  puedeAnular: boolean;
  alAnular: (id: number, motivo: string) => void;
  anulando: boolean;
}) {
  const [anulandoId, setAnulandoId] = useState<number | null>(null);
  const [motivo, setMotivo] = useState("");

  if (cargando) return <Panel><SkeletonLineas cantidad={4} /></Panel>;

  return (
    <Panel>
      <h2 className="text-lg mb-3">Operaciones</h2>

      {movimientos.length === 0 ? (
        <p className="text-sm text-ink2">Todavía no hay movimientos en esta tarjeta.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-2xs text-ink2">
              <tr className="border-b border-line">
                <th className="py-2 text-left font-normal">Fecha</th>
                <th className="py-2 text-left font-normal">Concepto</th>
                <th className="py-2 text-right font-normal">Importe</th>
                <th className="py-2 text-left font-normal">Estado</th>
                {puedeAnular && <th className="py-2 text-right font-normal">&nbsp;</th>}
              </tr>
            </thead>
            <tbody>
              {movimientos.map((m) => (
                <tr key={m.id} className={`border-b border-line ${m.anulado ? "text-ink2" : ""}`}>
                  <td className="py-2 tnum text-ink2">{formatearFechaHora(m.fecha)}</td>
                  <td className={`py-2 ${m.anulado ? "line-through" : ""}`}>
                    {describir(m)}
                    {m.observacion !== null && (
                      <span className="block text-2xs text-ink2">{m.observacion}</span>
                    )}
                  </td>
                  <td
                    className={`py-2 text-right tnum ${
                      m.anulado ? "line-through" : m.importe < 0 ? "" : "text-done"
                    }`}
                  >
                    {formatear(aCentavos(m.importe))}
                  </td>
                  <td className="py-2 text-2xs text-ink2">
                    {m.anulado
                      ? "anulado"
                      : m.fecha_acreditacion > hoyArgentina()
                        ? "en tránsito"
                        : ""}
                  </td>
                  {puedeAnular && (
                    <td className="py-2 text-right">
                      {A_MANO.includes(m.tipo) && !m.anulado && m.corrige_movimiento_id === null && (
                        <button
                          type="button"
                          onClick={() => { setAnulandoId(m.id); setMotivo(""); }}
                          className="text-2xs text-ink2 underline"
                        >
                          Anular
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/*
        EL MOTIVO SE PIDE ANTES, no después. La base lo exige igual, pero si se pidiera después
        de apretar Anular el error llegaría como un rechazo, y un rechazo enseña a desconfiar de
        la pantalla. Pedirlo antes lo convierte en parte de la tarea.
      */}
      {anulandoId !== null && (
        <div className="mt-3 flex flex-col gap-2 border-t border-line pt-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-ink2">
              Por qué se anula — queda escrito al lado del movimiento
            </span>
            <input
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Se cargó con un cero de más"
              className={CAMPO_SUELTO}
            />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={motivo.trim() === "" || anulando}
              onClick={() => { alAnular(anulandoId, motivo.trim()); setAnulandoId(null); }}
              className={BOTON_SUAVE}
            >
              {anulando ? "Anulando" : "Anular el movimiento"}
            </button>
            <button
              type="button"
              onClick={() => setAnulandoId(null)}
              className="text-sm text-ink2"
            >
              Dejarlo como está
            </button>
          </div>
          <p className="text-2xs text-ink2">
            No se borra: queda tachado con su motivo, y abajo el ajuste que lo compensa. El saldo
            vuelve a cerrar y se puede explicar qué pasó.
          </p>
        </div>
      )}
    </Panel>
  );
}

/** Qué dice la fila. El apellido primero, porque es con lo que se busca. */
function describir(m: Movimiento): string {
  if (m.cliente !== null) return `${m.concepto ?? m.tipo} — ${m.cliente}`;
  return m.concepto ?? m.tipo;
}
```

- [ ] **Paso 3: Usarlo desde `Tarjeta.tsx`**

Borrar el `<Panel>` de Operaciones que quedó (el bloque de las líneas 119 a 153 originales) y
poner:

```tsx
      <Operaciones
        movimientos={movimientos.data ?? []}
        cargando={movimientos.isLoading}
        puedeAnular={puedeMoverSaldo(perfil?.rol ?? "sin_asignar")}
        alAnular={(id, motivo) => anular.mutate({ id, motivo })}
        anulando={anular.isPending}
      />
```

Y arriba, con los otros hooks:

```tsx
  const { perfil } = useSesion();
  const anular = useAnularMovimiento();
```

Con las importaciones:

```tsx
import { useMovimientos, useSaldos, useAnularMovimiento } from "../../lib/datos";
import { puedeMoverSaldo } from "../../lib/roles";
import { useSesion } from "../../lib/sesion";
import { Operaciones } from "./Operaciones";
```

Y sacar de las importaciones lo que quedó sin uso: `formatearFechaHora` y `hoyArgentina` ahora
viven en `Operaciones.tsx`. El compilador de tipos lo va a marcar.

- [ ] **Paso 4: Los cuatro comandos**

```bash
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && npx tsc -b > /tmp/a.log 2>&1; echo "TIPOS: $?"; head -20 /tmp/a.log; npm run lint > /tmp/b.log 2>&1; echo "LINT: $?"
```

- [ ] **Paso 5: Mirarlo, con los dos roles**

Entrar como `contable1`: tiene que ver el botón Anular en los ingresos y NO en las reservas.
Entrar como `gestoria1`: no tiene que ver ningún botón Anular.

Después anular un ingreso de prueba y comprobar en pantalla que la fila queda tachada, que abajo
aparece la compensación, y que **el saldo de hoy vuelve al valor anterior**.

- [ ] **Paso 6: Commit**

```bash
git add src/features/tarjeta/ src/lib/datos.ts && git commit -m "El extracto dice el nombre del cliente, y un movimiento mal cargado se anula"
```

---

## Tarea 9: La ficha se parte en piezas

Refactor puro: **no cambia ninguna conducta**. Se hace antes de tocar nada para que los cambios de
las tareas siguientes entren en archivos que se pueden leer enteros.

`Ficha.tsx` tiene 1083 líneas y está por crecer. Un archivo que no entra en la cabeza es un
archivo donde se edita a ciegas.

**Archivos:**
- Crear: `src/features/tramites/Salidas.tsx` — mover el componente `Salidas` tal cual está.
- Crear: `src/features/tramites/Notas.tsx` — mover el componente `Notas` tal cual está.
- Crear: `src/features/tramites/Checklist.tsx` — mover `Checklist` y `RESPUESTAS` tal cual están.
- Crear: `src/features/tramites/Presupuesto.tsx` — mover el componente `Costos`, renombrado a
  `Presupuesto`.
- Modificar: `src/features/tramites/Ficha.tsx` — importa las cuatro piezas.

- [ ] **Paso 1: Ver el estado de partida**

```bash
cd "C:/Users/Vmagni/Desktop/GRUPO PARIS/GESTORIA" && grep -n "^function \|^const RESPUESTAS" src/features/tramites/Ficha.tsx
```

Anotá el rango de líneas de cada componente.

- [ ] **Paso 2: Mover, uno por uno**

Para cada componente: cortar el bloque de `Ficha.tsx`, pegarlo en su archivo nuevo con las
importaciones que necesite, exportarlo, e importarlo desde `Ficha.tsx`.

**No usar expresiones regulares ni `sed` sobre JSX.** Ya pasó en este proyecto: dejó un `</div>`
donde iba un `</Panel>`. Usar las herramientas de edición de archivos.

Los comentarios largos **viajan con su componente**. Son la mitad del valor del código en este
proyecto.

- [ ] **Paso 3: Comprobar que no cambió nada**

```bash
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && npx tsc -b > /tmp/a.log 2>&1; echo "TIPOS: $?"; npm run lint > /tmp/b.log 2>&1; echo "LINT: $?"; npm test > /tmp/c.log 2>&1; echo "TESTS: $?"; grep -E "Tests" /tmp/c.log | tail -3; wc -l src/features/tramites/*.tsx
```

Esperado: los mismos errores de tipos que ya había —los de `presupuesto_historial`, ninguno
nuevo—, lint en 0, los mismos tests en verde, y `Ficha.tsx` por debajo de 450 líneas.

- [ ] **Paso 4: Mirar que la ficha se vea idéntica**

Abrir un trámite antes y después. **Tiene que verse exactamente igual.** Un refactor que cambia
algo en pantalla no es un refactor.

- [ ] **Paso 5: Commit**

```bash
git add src/features/tramites/ && git commit -m "La ficha se parte en piezas, sin cambiar nada de lo que hace"
```

---

## Tarea 10: Fuera Vencimientos y fuera el panel "Paso siguiente"

Cubre FOTO 2 y FOTO 5.

**Archivos:**
- Modificar: `src/features/tramites/Ficha.tsx`
- Modificar: `src/lib/plazos.ts` y `src/lib/plazos.test.ts`
- Borrar: `src/lib/cobertura.test.ts` (se fusiona)

**Interfaces:**
- Produce: `Ficha` deja de recibir `plazos` y `calendario`. `src/lib/plazos.ts` queda exportando
  únicamente `revisarCobertura`, `Plazo` y `Calendario`.

- [ ] **Paso 1: Sacar el panel de Vencimientos de la ficha**

Borrar de `src/features/tramites/Ficha.tsx`:
- el bloque `{perfil?.rol !== "gestora" && ( <Vencimientos ... /> )}` con su comentario;
- el componente `Vencimientos` entero y todo lo que sólo él usaba;
- la mutación `guardarFecha` y su comentario;
- los hooks `usePlazos` y `useCalendario` y sus importaciones;
- la importación de `../../lib/plazos`.

En el lugar donde estaba el panel, dejar este comentario:

```tsx
      {/*
        ============================================================================
         ACA VIVIAN LOS VENCIMIENTOS, Y SE SACARON A PEDIDO
        ============================================================================

        Textual: "quitar esta sección, es información innecesaria que genera solamente ruido
        visual y complejidad".

        Y era cierto en el estado en que estaba: de los cinco plazos, tres seguían sin confirmar y
        los feriados sin cargar, así que el panel no mostraba ninguna fecha — mostraba cinco
        renglones explicando qué faltaba para poder mostrarla. Media pantalla ocupada por un
        cartel de "todavía no".

        Administración conserva Plazos y feriados: el día que estén confirmados, volver a mostrar
        esto es traer un componente del historial de git. Lo que no se hace es dejarlo puesto
        mientras no diga nada, porque un panel que nunca dice nada enseña a saltear esa parte de
        la pantalla — y después no se lee tampoco cuando empieza a decir algo.
      */}
```

- [ ] **Paso 2: Sacar el panel "Paso siguiente" y poner la barra de avance**

Borrar todo el bloque `{paso ? ( <Panel ...> ... </Panel> ) : ( ... )}` (líneas 236 a 368 del
archivo original) y poner, **justo debajo del título con el nombre del cliente**:

```tsx
      {/*
        ============================================================================
         UNA BARRA DE AVANCE, NO UN PANEL DE FORMULARIO
        ============================================================================

        El pedido fue sacar el panel entero, y tenía razón: pedía de nuevo el depósito —que ahora
        es la suma de los conceptos y se edita en el panel Presupuesto— y la seccional, que es un
        dato del trámite y vive con los demás datos. Un panel que repite campos que están más
        abajo obliga a decidir cuál de los dos es el verdadero.

        EL BOTON SIGUE SIENDO UNO SOLO, el del paso que sigue. Nadie elige un estado de una
        lista: elegir de una lista es como se saltea un paso sin querer.

        Y SI FALTA UN DATO, LO DICE LA BASE. El trigger devuelve el motivo escrito en castellano
        —"Falta indicar en qué seccional se presentó"— y `clasificarFalla` lo muestra tal cual.
        Que la validación viva en un solo lado es lo que evita que la pantalla deje pasar algo
        que la base rechaza, o al revés.
      */}
      {paso ? (
        <Panel className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-2xs text-ink2">Paso siguiente</p>
            <p className="text-sm">{paso.boton}</p>
          </div>
          <button
            type="button"
            onClick={() => avanzar.mutate(paso.estado)}
            disabled={avanzar.isPending}
            className={BOTON}
          >
            {avanzar.isPending ? "Guardando" : paso.boton}
          </button>
        </Panel>
      ) : (
        <Panel>
          <p className="text-sm text-ink2">
            El trámite está {nombreDeEstado(t.estado).toLowerCase()}. No hay paso siguiente.
          </p>
        </Panel>
      )}
```

El `Checklist` deja de estar adentro de ese panel y pasa a ser un panel propio, que se dibuja sólo
cuando el trámite está en `recibido`:

```tsx
      {t.estado === "recibido" && (
        <Panel className="flex flex-col gap-3">
          <h2 className="text-lg">Checklist del legajo</h2>
          <Checklist
            requisitos={requisitos.data ?? []}
            respuestas={respuestas.data ?? {}}
            alResponder={(requisitoId, respuesta) => responder.mutate({ requisitoId, respuesta })}
            alResponderTodo={() => responderTodo.mutate(undefined)}
          />
        </Panel>
      )}
```

- [ ] **Paso 3: Recortar `src/lib/plazos.ts`**

Borrar `calcular`, `plazoDe`, `plazosDeTipo`, `inicioDe` y el tipo `Vencimiento`. Dejar
`revisarCobertura` y los tipos `Plazo` y `Calendario`, que usan `datos.ts` y `Calendario.tsx`.

Al principio del archivo, reemplazar el comentario de cabecera por:

```ts
/**
 * ============================================================================
 *  LOS PLAZOS: HOY SOLO SE CONFIGURAN, NO SE MUESTRAN
 * ============================================================================
 *
 *  Este módulo llegó a calcular vencimientos por trámite. El 21/08/2026 se sacó ese panel de la
 *  ficha a pedido del usuario: con tres de los cinco plazos sin confirmar y los feriados sin
 *  cargar, no mostraba fechas — mostraba renglones explicando qué faltaba.
 *
 *  QUEDA `revisarCobertura`, que es lo que Administración usa para avisar hasta dónde llega el
 *  calendario de feriados cargado. Eso sí sirve hoy: la fecha de acreditación de un depósito
 *  depende de los feriados, y un calendario que se quedó corto hace que la app diga que la plata
 *  entra un día antes de que entre.
 *
 *  El resto —`calcular` y los cuatro tests que probaban que SE NIEGA a calcular sin datos
 *  confirmados— está en el historial de git. Si vuelven los vencimientos, vuelven con sus
 *  pruebas: son más valiosas que el cálculo.
 */
```

- [ ] **Paso 4: Recortar los tests y fusionar cobertura**

En `src/lib/plazos.test.ts`, borrar los `describe` de `se niega a calcular`, `cuando sí calcula`,
`elegir el plazo que corresponde`, `la aritmética de días hábiles` y `a qué trámite le corre cada
plazo`. Copiar adentro el contenido de `src/lib/cobertura.test.ts` y borrar ese archivo.

Los tests de `sumarDiasHabiles` que estaban en `plazos.test.ts` **se mueven a
`src/lib/fechas.test.ts`**, no se borran: esa función sigue viva porque la usa `proximoDiaHabil`,
que es la que calcula cuándo acredita un depósito.

- [ ] **Paso 5: Los cuatro comandos**

```bash
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && npx tsc -b > /tmp/a.log 2>&1; echo "TIPOS: $?"; head -20 /tmp/a.log; npm run lint > /tmp/b.log 2>&1; echo "LINT: $?"; npm test > /tmp/c.log 2>&1; echo "TESTS: $?"; grep -E "Tests|FAIL" /tmp/c.log | tail -5; npm run deadcode > /tmp/d.log 2>&1; echo "MUERTO: $?"; tail -20 /tmp/d.log
```

Esperado: tipos y lint en 0, tests en verde, y `deadcode` sin nombrar nada de `plazos.ts` ni de
`fechas.ts`. Si nombra algo, se borra: **una advertencia permanente entrena a ignorar las
advertencias.**

- [ ] **Paso 6: Mirarlo**

Abrir un trámite en cada estado —`recibido`, `entregado`, `presupuestado`, `pagado`— y comprobar
que no queda ningún panel de Vencimientos, que la barra de avance está arriba, y que el checklist
aparece sólo en `recibido`.

- [ ] **Paso 7: Commit**

```bash
git add src/features/tramites/ src/lib/plazos.ts src/lib/plazos.test.ts src/lib/fechas.test.ts && git rm src/lib/cobertura.test.ts && git commit -m "Fuera los vencimientos de la ficha y fuera el panel de paso siguiente"
```

---

## Tarea 11: Los datos del trámite se pueden modificar

Cubre FOTO 8.

**Archivos:**
- Crear: `src/features/tramites/campos-del-tramite.ts`
- Crear: `src/features/tramites/DatosDelTramite.tsx`
- Modificar: `src/features/tramites/Ficha.tsx`

**Interfaces:**
- Consume: `useGestoras()`, `useAdministrativos()` de `src/lib/datos.ts`; `Database` de
  `src/lib/database.types.ts`.
- Produce: `CAMPOS: CampoEditable[]` y `nombreDeCampo(columna: string): string`, que también usa
  el panel de cambios de la tarea 13.

- [ ] **Paso 1: Escribir el test que falla**

Crear `src/features/tramites/campos-del-tramite.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { CAMPOS, camposPara, nombreDeCampo } from "./campos-del-tramite";

/**
 * Este archivo decide QUE PUEDE TOCAR CADA ROL en la pantalla. No decide permisos: los decide el
 * trigger `b_tramites_bloquear_campos` de la base. Lo que se prueba acá es que la pantalla no le
 * ofrezca a una gestora un campo que la base le va a rechazar — porque un formulario que se
 * rechaza al guardar enseña a desconfiar de la pantalla entera.
 */

/** Los que el trigger de la base tiene en su lista `permitidos` para una gestora. */
const PERMITIDOS_A_LA_GESTORA = [
  "deposito_solicitado", "seccional", "numero_pago_registro", "observaciones_gestora",
  "documentacion_retirada", "dominio",
];

describe("la pantalla no le ofrece a la gestora nada que la base le rechace", () => {
  it("todos los campos que se le ofrecen están en la lista del trigger", () => {
    for (const c of camposPara("gestora")) {
      expect(PERMITIDOS_A_LA_GESTORA).toContain(c.columna);
    }
  });

  it("y no le ofrece la gestora ni el administrativo, que son de la oficina", () => {
    const columnas = camposPara("gestora").map((c) => c.columna);
    expect(columnas).not.toContain("gestora_id");
    expect(columnas).not.toContain("administrativo");
  });
});

describe("la oficina puede cambiar quién hace el trámite", () => {
  it("gerencia edita la gestora asignada", () => {
    // Es el ejemplo textual del pedido: "que permita modificar datos, por ejemplo la gestora
    // que realiza el trámite".
    expect(camposPara("gerencia").map((c) => c.columna)).toContain("gestora_id");
  });

  it("y contable tiene exactamente lo mismo que gerencia", () => {
    expect(camposPara("contable").map((c) => c.columna))
      .toEqual(camposPara("gerencia").map((c) => c.columna));
  });
});

describe("cada columna tiene un nombre en castellano", () => {
  it("ninguna se muestra con el nombre de la base", () => {
    // Si esto falla, el panel de cambios diría "gestora_id" en vez de "Gestora".
    for (const c of CAMPOS) {
      expect(c.nombre).not.toContain("_");
      expect(c.nombre.length).toBeGreaterThan(2);
    }
  });

  it("y una columna desconocida no rompe: se muestra como viene", () => {
    expect(nombreDeCampo("gestora_id")).toBe("Gestora");
    expect(nombreDeCampo("una_columna_nueva")).toBe("una_columna_nueva");
  });
});
```

- [ ] **Paso 2: Correr y verificar que falla**

```bash
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && npx vitest run src/features/tramites/campos-del-tramite.test.ts > /tmp/v.log 2>&1; echo "EXIT: $?"; tail -20 /tmp/v.log
```

Esperado: falla con `Cannot find module './campos-del-tramite'`.

- [ ] **Paso 3: Escribir `src/features/tramites/campos-del-tramite.ts`**

```ts
import type { Rol } from "../../lib/roles";

/**
 * ============================================================================
 *  QUE DATO SE EDITA, COMO SE LLAMA EN CASTELLANO, Y QUIEN LO PUEDE TOCAR
 * ============================================================================
 *
 *  Una sola tabla, y no tres listas repartidas. Cuando esto vive en cinco lugares, nadie puede
 *  contestar "¿qué puede cambiar una gestora?" sin leerlos todos, y la respuesta termina siendo
 *  distinta en cada uno.
 *
 *  ============================================================================
 *   ESTO NO DECIDE PERMISOS. LOS DECIDE LA BASE.
 *  ============================================================================
 *
 *  El trigger `b_tramites_bloquear_campos` compara el trámite viejo y el nuevo por diferencia de
 *  jsonb y rechaza cualquier columna que ese rol no tenga permitida. Si alguien borra este
 *  archivo, la app se vuelve fea y sigue siendo segura.
 *
 *  Lo que hace este archivo es que la pantalla no OFREZCA lo que la base va a rechazar. Un
 *  formulario que se rechaza al guardar enseña a desconfiar de la pantalla entera, y después no
 *  se confía tampoco en los campos que sí andaban.
 *
 *  Hay un test que compara esta lista contra la del trigger. Si algún día se agrega un campo
 *  acá y no allá, falla antes de llegar a producción.
 */

export interface CampoEditable {
  /** La columna real de `public.tramites`. */
  columna: string;
  /** Cómo se llama en la pantalla. Nunca el nombre de la base. */
  nombre: string;
  /** Qué escribe la persona. `gestora` y `administrativo` traen su propia lista. */
  como: "texto" | "gestora" | "administrativo" | "modalidad";
  /** Una línea de ayuda, cuando el nombre solo no alcanza. */
  ayuda?: string;
  /** Quiénes lo pueden editar. La oficina son contable y gerencia, y tienen lo mismo. */
  roles: Rol[];
}

const OFICINA: Rol[] = ["contable", "gerencia"];
const TODOS: Rol[] = ["gestora", "contable", "gerencia"];

export const CAMPOS: CampoEditable[] = [
  { columna: "cliente_nombre", nombre: "Cliente", como: "texto", roles: OFICINA },
  { columna: "oferta_referencia", nombre: "Referencia de la oferta", como: "texto",
    ayuda: "Con esto se ubica el trámite después", roles: OFICINA },
  { columna: "cliente_cuenta", nombre: "Cuenta personal", como: "texto",
    ayuda: "En el asunto del mail viene entre paréntesis", roles: OFICINA },
  { columna: "vehiculo", nombre: "Vehículo", como: "texto", roles: OFICINA },

  /*
    EL DOMINIO LO PUEDE CARGAR LA GESTORA, y es el único dato del vehículo que puede tocar. Es
    correcto: en un patentamiento 0km la patente no existe hasta que ella la trae del registro.
  */
  { columna: "dominio", nombre: "Dominio", como: "texto", roles: TODOS },

  { columna: "subtipo", nombre: "Modalidad", como: "modalidad",
    ayuda: "Sólo en patentamientos", roles: OFICINA },

  /*
    ESTE ES EL PEDIDO, TEXTUAL: "que permita modificar datos, por ejemplo la gestora que realiza
    el trámite". Pasa de verdad: una gestora se enferma, se va de vacaciones, o el trámite se
    reparte distinto. Sin poder cambiarlo, el trabajo le sigue apareciendo a quien no está y no
    le aparece a quien lo tiene en la mano.
  */
  { columna: "gestora_id", nombre: "Gestora", como: "gestora",
    ayuda: "A quién le aparece el trámite", roles: OFICINA },

  { columna: "administrativo", nombre: "Administrativo a cargo", como: "administrativo",
    ayuda: "Quién lo lleva desde administración", roles: OFICINA },

  { columna: "seccional", nombre: "Seccional", como: "texto",
    ayuda: "Dónde se presentó. Hace falta para marcarlo como presentado", roles: TODOS },
  { columna: "numero_pago_registro", nombre: "N° de pago", como: "texto",
    ayuda: "Con él la conciliación empareja sola", roles: TODOS },
  { columna: "documentacion_retirada", nombre: "Documentación retirada", como: "texto",
    ayuda: "Título, cédula y chapas", roles: TODOS },
  { columna: "observaciones_gestora", nombre: "Observaciones de gestoría", como: "texto",
    roles: TODOS },
];

/** Los campos que ese rol puede editar. */
export function camposPara(rol: Rol): CampoEditable[] {
  return CAMPOS.filter((c) => c.roles.includes(rol));
}

/**
 * El nombre en pantalla de una columna.
 *
 * Devuelve la columna cruda si no la conoce, en vez de romper. Lo usa el panel de cambios, que
 * lee columnas escritas por un trigger que registra CUALQUIERA que cambie — incluida una que se
 * agregue mañana y todavía no esté en esta lista. Mostrar `una_columna_nueva` es feo; una
 * pantalla en blanco es peor.
 */
export function nombreDeCampo(columna: string): string {
  return CAMPOS.find((c) => c.columna === columna)?.nombre ?? columna;
}
```

- [ ] **Paso 4: Correr el test y verificar que pasa**

```bash
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && npx vitest run src/features/tramites/campos-del-tramite.test.ts > /tmp/v.log 2>&1; echo "EXIT: $?"; tail -20 /tmp/v.log
```

Esperado: `EXIT: 0`, 6 tests en verde.

- [ ] **Paso 5: Escribir `src/features/tramites/DatosDelTramite.tsx`**

```tsx
import { useState } from "react";
import { Pencil } from "lucide-react";
import { Panel } from "../../components/Panel";
import { BOTON, BOTON_SUAVE, CAMPO } from "../../lib/campos";
import type { Rol } from "../../lib/roles";
import { camposPara, type CampoEditable } from "./campos-del-tramite";

/**
 * ============================================================================
 *  LOS DATOS DEL TRAMITE, Y SE PUEDEN CORREGIR
 * ============================================================================
 *
 *  El pedido: "que permita modificar datos, por ejemplo la gestora que realiza el trámite".
 *
 *  Antes esta ficha era de sólo lectura y los datos se cargaban una única vez, en el alta. Un
 *  apellido mal tipeado quedaba mal para siempre; una gestora que se enfermaba dejaba el trámite
 *  asignado a quien no estaba.
 *
 *  ============================================================================
 *   SE EDITA TODO JUNTO, Y SE GUARDA UNA VEZ
 *  ============================================================================
 *
 *  No hay un lápiz por campo. Quien corrige un trámite corrige varias cosas de una: llegó el
 *  legajo y trae el dominio, la cuenta y la seccional. Un botón por campo convierte eso en cinco
 *  guardadas, y cada guardada es una oportunidad de que una falle y nadie se entere.
 *
 *  Y ADEMAS UNA SOLA GUARDADA ES UN SOLO UPDATE, así que el trigger de historial escribe las
 *  cinco filas en el mismo instante y en el panel de cambios se leen como lo que fueron: una
 *  corrección, no cinco.
 */
export function DatosDelTramite({
  tramite, rol, gestoras, administrativos, alGuardar, guardando,
}: {
  tramite: Record<string, unknown>;
  rol: Rol;
  gestoras: { id: string; nombre: string; activa: boolean }[];
  administrativos: string[];
  alGuardar: (cambios: Record<string, string | null>) => void;
  guardando: boolean;
}) {
  const [editando, setEditando] = useState(false);
  const [campos, setCampos] = useState<Record<string, string>>({});
  const editables = camposPara(rol);

  const leer = (c: CampoEditable): string => {
    const v = tramite[c.columna];
    return campos[c.columna] ?? (v === null || v === undefined ? "" : String(v));
  };

  function guardar(): void {
    /*
      SE MANDA SOLO LO QUE CAMBIO, y no el formulario entero. Si se mandara todo, el trigger de
      historial vería como "cambio" cada campo que se volvió a escribir con el mismo valor... no,
      no lo vería —compara valor contra valor—, pero sí se mandarían columnas que este rol no
      puede tocar, y el trigger que bloquea campos rechazaría la guardada entera con un mensaje
      sobre un campo que la persona ni miró.
    */
    const cambios: Record<string, string | null> = {};
    for (const c of editables) {
      const escrito = campos[c.columna];
      if (escrito === undefined) continue;
      const antes = tramite[c.columna];
      const limpio = escrito.trim() === "" ? null : escrito.trim();
      if (limpio !== (antes ?? null)) cambios[c.columna] = limpio;
    }
    alGuardar(cambios);
    setCampos({});
    setEditando(false);
  }

  return (
    <Panel className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg">Datos del trámite</h2>
        {editables.length > 0 && !editando && (
          <button
            type="button"
            onClick={() => setEditando(true)}
            className="flex items-center gap-1 text-sm text-ink2"
          >
            <Pencil aria-hidden="true" size={14} /> Corregir
          </button>
        )}
      </div>

      {editando ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            {editables.map((c) => (
              <label key={c.columna} className="flex flex-col gap-1">
                <span className="text-xs text-ink2">
                  {c.nombre}
                  {c.ayuda !== undefined && <span className="block text-2xs">{c.ayuda}</span>}
                </span>

                {c.como === "gestora" ? (
                  <select
                    value={leer(c)}
                    onChange={(e) => setCampos((x) => ({ ...x, [c.columna]: e.target.value }))}
                    className={CAMPO}
                  >
                    <option value="">Sin asignar</option>
                    {/*
                      Las dadas de baja no se ofrecen, pero la que YA está asignada sí aparece
                      aunque esté de baja: sin eso el selector mostraría vacío y guardar sin
                      querer le sacaría el trámite a quien lo tiene.
                    */}
                    {gestoras
                      .filter((g) => g.activa || g.id === tramite["gestora_id"])
                      .map((g) => (
                        <option key={g.id} value={g.id}>{g.nombre}</option>
                      ))}
                  </select>
                ) : c.como === "modalidad" ? (
                  <select
                    value={leer(c)}
                    onChange={(e) => setCampos((x) => ({ ...x, [c.columna]: e.target.value }))}
                    className={CAMPO}
                    disabled={tramite["tipo"] !== "patentamiento_0km"}
                  >
                    <option value="">Sin especificar</option>
                    <option value="plan_ahorro">Plan de ahorro</option>
                    <option value="venta_directa">Venta directa 0km</option>
                  </select>
                ) : c.como === "administrativo" ? (
                  <>
                    <input
                      list="administrativos-conocidos"
                      value={leer(c)}
                      onChange={(e) => setCampos((x) => ({ ...x, [c.columna]: e.target.value }))}
                      className={CAMPO}
                    />
                    <datalist id="administrativos-conocidos">
                      {administrativos.map((a) => <option key={a} value={a} />)}
                    </datalist>
                  </>
                ) : (
                  <input
                    value={leer(c)}
                    onChange={(e) => setCampos((x) => ({ ...x, [c.columna]: e.target.value }))}
                    className={CAMPO}
                  />
                )}
              </label>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={guardar} disabled={guardando} className={BOTON}>
              {guardando ? "Guardando" : "Guardar los cambios"}
            </button>
            <button
              type="button"
              onClick={() => { setCampos({}); setEditando(false); }}
              className={BOTON_SUAVE}
            >
              Dejarlo como está
            </button>
          </div>

          <p className="text-2xs text-ink2">
            Cada cambio queda registrado abajo, con tu nombre y la fecha.
          </p>
        </>
      ) : (
        <div className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          {LECTURA.map((l) => (
            <div key={l.columna}>
              <p className="text-2xs text-ink2">{l.nombre}</p>
              <p className={l.tnum ? "tnum" : ""}>{l.mostrar(tramite, gestoras)}</p>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

/**
 * Lo que se muestra cuando NO se está editando.
 *
 * Es una lista aparte de `CAMPOS` porque en lectura se muestran cosas que no se editan —el tipo
 * de trámite, por ejemplo— y porque la gestora se muestra por su nombre y no por su id.
 */
const LECTURA: {
  columna: string;
  nombre: string;
  tnum?: boolean;
  mostrar: (t: Record<string, unknown>, g: { id: string; nombre: string }[]) => string;
}[] = [
  { columna: "oferta_referencia", nombre: "Referencia de la oferta", tnum: true,
    mostrar: (t) => texto(t["oferta_referencia"]) },
  { columna: "cliente_cuenta", nombre: "Cuenta personal", tnum: true,
    mostrar: (t) => texto(t["cliente_cuenta"]) },
  { columna: "vehiculo", nombre: "Vehículo", mostrar: (t) => texto(t["vehiculo"]) },
  { columna: "dominio", nombre: "Dominio", mostrar: (t) => texto(t["dominio"]) },
  { columna: "subtipo", nombre: "Modalidad",
    mostrar: (t) => t["subtipo"] === "plan_ahorro" ? "Plan de ahorro"
      : t["subtipo"] === "venta_directa" ? "Venta directa 0km" : "—" },
  { columna: "gestora_id", nombre: "Gestora",
    mostrar: (t, g) => g.find((x) => x.id === t["gestora_id"])?.nombre ?? "—" },
  { columna: "administrativo", nombre: "Administrativo a cargo",
    mostrar: (t) => texto(t["administrativo"]) },
  { columna: "seccional", nombre: "Seccional", mostrar: (t) => texto(t["seccional"]) },
  { columna: "numero_pago_registro", nombre: "N° de pago", tnum: true,
    mostrar: (t) => texto(t["numero_pago_registro"]) },
  { columna: "documentacion_retirada", nombre: "Documentación retirada",
    mostrar: (t) => texto(t["documentacion_retirada"]) },
];

/** Una raya y no una celda vacía: una celda vacía no distingue "no hay dato" de "no cargó". */
function texto(v: unknown): string {
  return v === null || v === undefined || v === "" ? "—" : String(v);
}
```

- [ ] **Paso 6: Usarlo desde `Ficha.tsx`**

Reemplazar el `<Panel>` de datos que empieza en la línea 217 original —el que tiene los
componentes `Dato`— por:

```tsx
      <DatosDelTramite
        tramite={t as unknown as Record<string, unknown>}
        rol={perfil?.rol ?? "sin_asignar"}
        gestoras={gestoras.data ?? []}
        administrativos={administrativos.data ?? []}
        alGuardar={(cambios) => corregir.mutate(cambios)}
        guardando={corregir.isPending}
      />

      {/*
        El asunto original del mail queda afuera del panel de datos a propósito: no se edita
        nunca. Es la fuente, y una fuente que se puede corregir deja de servir para comprobar
        contra ella si un dato se cargó bien.
      */}
      {t.asunto_mail ? (
        <details>
          <summary className="text-2xs text-ink2 cursor-pointer">Asunto original del mail</summary>
          <p className="text-2xs text-ink2 mt-1 whitespace-pre-wrap">{t.asunto_mail}</p>
        </details>
      ) : null}
```

Agregar la mutación, al lado de las otras:

```tsx
  /**
   * Corregir datos del trámite, SIN moverlo de paso.
   *
   * Va aparte de `avanzar` porque corregir un tipeo no puede obligar a avanzar la cadena, y
   * porque `avanzar` manda `estado` en el parche: si esto lo reusara, cada corrección dispararía
   * la máquina de estados y sus validaciones para no cambiar de estado.
   */
  const corregir = useGuardar(
    async (cambios: Record<string, string | null>) => {
      if (Object.keys(cambios).length === 0) return;
      const { error } = await supabase.from("tramites").update(cambios).eq("id", id);
      if (error) throw error;
    },
    {
      exito: "Datos corregidos",
      invalidar: ["tramite", "tramites", "tramite_cambios"],
    },
  );
```

Y borrar el componente `Dato`, que ya no se usa.

- [ ] **Paso 7: Los cuatro comandos y mirarlo**

```bash
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && npx tsc -b > /tmp/a.log 2>&1; echo "TIPOS: $?"; head -20 /tmp/a.log; npm run lint > /tmp/b.log 2>&1; echo "LINT: $?"; npm test > /tmp/c.log 2>&1; echo "TESTS: $?"; grep -E "Tests" /tmp/c.log | tail -3
```

Después, en el navegador y con los tres roles:

1. Como **gerencia**: abrir un trámite, apretar Corregir, cambiar la gestora, guardar. Comprobar
   que en el panel de datos figura la gestora nueva.
2. Entrar como **esa gestora** y comprobar que el trámite ahora le aparece.
3. Como **gestoría**: apretar Corregir y comprobar que sólo ofrece dominio, seccional, N° de pago,
   documentación retirada y observaciones. **No** la gestora ni el administrativo.
4. Como **contable**: comprobar que ofrece exactamente lo mismo que gerencia.

- [ ] **Paso 8: Commit**

```bash
git add src/features/tramites/ && git commit -m "Los datos del tramite se corrigen, incluida la gestora que lo hace"
```

---

## Tarea 12: El presupuesto se edita en pantalla

Cubre FOTO 3 y termina FOTO 5.

**Archivos:**
- Modificar: `src/features/tramites/Presupuesto.tsx`
- Modificar: `src/features/tramites/Ficha.tsx`
- Modificar: `src/lib/datos.ts`

**Interfaces:**
- Consume: `tramite_conceptos.anulada` y `motivo_anulacion` de la tarea 1.
- Produce: `useCorregirConcepto()` y `useQuitarConcepto()` en `src/lib/datos.ts`.

- [ ] **Paso 1: Agregar los dos hooks a `src/lib/datos.ts`**

```ts
/**
 * Corregir el importe de una línea del presupuesto.
 *
 * NO HACE FALTA TOCAR NADA MAS: el trigger `h_conceptos_total_presupuesto` recalcula el total del
 * trámite, y eso dispara el de la cuenta corriente, que escribe el `ajuste_reserva` por la
 * diferencia. La reserva original nunca se toca, porque editarla haría que el saldo de ayer deje
 * de ser reconstruible.
 */
export function useCorregirConcepto() {
  return useGuardar(
    async (v: { id: number; importe: number }) => {
      const { error } = await supabase
        .from("tramite_conceptos")
        .update({ importe: v.importe })
        .eq("id", v.id);
      if (error) throw error;
    },
    {
      exito: "Importe corregido",
      invalidar: ["tramite_conceptos", "tramite", "tramites", "saldos", "movimientos", "tramite_cambios"],
    },
  );
}

/**
 * Quitar una línea del presupuesto.
 *
 * ES UN UPDATE Y NO UN DELETE, y no es una limitación técnica: en este proyecto no hay delete
 * para nadie. La línea queda con su motivo escrito, porque cuando el trámite vuelve del registro
 * y el número no cierra, lo que se pregunta es qué se sacó y por qué.
 */
export function useQuitarConcepto() {
  return useGuardar(
    async (v: { id: number; motivo: string }) => {
      const { error } = await supabase
        .from("tramite_conceptos")
        .update({ anulada: true, motivo_anulacion: v.motivo })
        .eq("id", v.id);
      if (error) throw error;
    },
    {
      exito: "Línea quitada del presupuesto",
      invalidar: ["tramite_conceptos", "tramite", "tramites", "saldos", "movimientos", "tramite_cambios"],
    },
  );
}
```

Y en `useConceptosDelTramite`, agregar `anulada, motivo_anulacion` al `select` y **no filtrarlas**:
las anuladas se muestran tachadas.

- [ ] **Paso 2: Reescribir `src/features/tramites/Presupuesto.tsx`**

```tsx
import { useState } from "react";
import { Plus } from "lucide-react";
import { Panel } from "../../components/Panel";
import { aCentavos, aPesos, formatear, parsear } from "../../lib/plata";
import { CAMPO_SUELTO } from "../../lib/campos";

/**
 * ============================================================================
 *  EL PRESUPUESTO ES LA SUMA DE SUS CONCEPTOS. NO HAY UN SEGUNDO NUMERO.
 * ============================================================================
 *
 *  Antes esta pantalla mostraba dos totales: la "Suma" de las líneas y, aparte, un "Depósito que
 *  se solicita" que se escribía a mano — y era ése el que se descontaba de la tarjeta. Había
 *  hasta una fila llamada "Diferencia con el depósito pedido" para explicar por qué no
 *  coincidían.
 *
 *  Una fila que existe para explicar una incoherencia es la señal de que la incoherencia no
 *  debería existir.
 *
 *  Ahora hay un solo número, y es el total. Lo que se reserva de la tarjeta es exactamente eso,
 *  y lo mantiene un trigger: apenas se agrega, se corrige o se quita una línea, la reserva se
 *  ajusta sola y el movimiento aparece en el extracto. Si hace falta pedir de más —el arancel
 *  real recién se sabe en la ventanilla— se carga como un concepto más, con su nombre.
 *
 *  ============================================================================
 *   UNA LINEA QUITADA SE VE TACHADA, NO DESAPARECE
 *  ============================================================================
 *
 *  Acá nada se borra. Y en este caso importa más que en otros: cuando el trámite vuelve del
 *  registro y el número no cierra, la pregunta es qué se sacó y por qué. Una línea que desaparece
 *  no deja con qué contestarla.
 */

export interface Linea {
  id: number;
  concepto_id: string;
  importe: number;
  anulada: boolean;
  motivo_anulacion: string | null;
}

export function Presupuesto({
  titulo, ayuda, lineas, conceptos, editable,
  alAgregar, alCorregir, alQuitar, guardando,
}: {
  titulo: string;
  ayuda: string;
  lineas: Linea[];
  conceptos: { id: string; nombre: string }[];
  editable: boolean;
  alAgregar: (conceptoId: string, importe: number) => void;
  alCorregir: (id: number, importe: number) => void;
  alQuitar: (id: number, motivo: string) => void;
  guardando: boolean;
}) {
  const [conceptoId, setConceptoId] = useState("");
  const [importe, setImporte] = useState("");
  const [corrigiendo, setCorrigiendo] = useState<number | null>(null);
  const [nuevoImporte, setNuevoImporte] = useState("");
  const [quitando, setQuitando] = useState<number | null>(null);
  const [motivo, setMotivo] = useState("");

  const nombre = (id: string): string => conceptos.find((c) => c.id === id)?.nombre ?? "";
  const vivas = lineas.filter((l) => !l.anulada);
  const suma = vivas.reduce((s, l) => s + l.importe, 0);

  return (
    <Panel className="flex flex-col gap-3">
      <div>
        <h2 className="text-lg">{titulo}</h2>
        <p className="text-2xs text-ink2">{ayuda}</p>
      </div>

      {lineas.length > 0 ? (
        <div className="flex flex-col gap-1 text-sm">
          {lineas.map((l) => (
            <div key={l.id} className="border-b border-line py-1">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className={l.anulada ? "text-ink2 line-through" : ""}>{nombre(l.concepto_id)}</span>
                <span className="flex items-baseline gap-3">
                  <span className={`tnum ${l.anulada ? "text-ink2 line-through" : ""}`}>
                    {formatear(aCentavos(l.importe))}
                  </span>
                  {editable && !l.anulada && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setCorrigiendo(l.id);
                          setNuevoImporte(String(l.importe));
                          setQuitando(null);
                        }}
                        className="text-2xs text-ink2 underline"
                      >
                        Corregir
                      </button>
                      <button
                        type="button"
                        onClick={() => { setQuitando(l.id); setMotivo(""); setCorrigiendo(null); }}
                        className="text-2xs text-ink2 underline"
                      >
                        Quitar
                      </button>
                    </>
                  )}
                </span>
              </div>

              {l.anulada && l.motivo_anulacion !== null && (
                <p className="text-2xs text-ink2">Quitada: {l.motivo_anulacion}</p>
              )}

              {corrigiendo === l.id && (
                <div className="mt-2 flex flex-wrap items-end gap-2">
                  <input
                    inputMode="decimal"
                    value={nuevoImporte}
                    onChange={(e) => setNuevoImporte(e.target.value)}
                    className={`w-36 ${CAMPO_SUELTO} tnum`}
                  />
                  <button
                    type="button"
                    disabled={parsear(nuevoImporte) === null || guardando}
                    onClick={() => {
                      const c = parsear(nuevoImporte);
                      if (c === null) return;
                      alCorregir(l.id, aPesos(c));
                      setCorrigiendo(null);
                    }}
                    className="rounded-md border border-line px-3 py-2 text-sm disabled:opacity-50"
                  >
                    Guardar el importe
                  </button>
                  <button type="button" onClick={() => setCorrigiendo(null)} className="text-sm text-ink2">
                    Cancelar
                  </button>
                </div>
              )}

              {quitando === l.id && (
                <div className="mt-2 flex flex-wrap items-end gap-2">
                  <input
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    placeholder="Por qué se quita"
                    className={`min-w-48 flex-1 ${CAMPO_SUELTO}`}
                  />
                  <button
                    type="button"
                    disabled={motivo.trim() === "" || guardando}
                    onClick={() => { alQuitar(l.id, motivo.trim()); setQuitando(null); }}
                    className="rounded-md border border-line px-3 py-2 text-sm disabled:opacity-50"
                  >
                    Quitar la línea
                  </button>
                  <button type="button" onClick={() => setQuitando(null)} className="text-sm text-ink2">
                    Cancelar
                  </button>
                </div>
              )}
            </div>
          ))}

          <div className="flex justify-between py-1 text-base">
            <span>{titulo === "Presupuesto" ? "Total que se pide" : "Total"}</span>
            <span className="tnum">{formatear(aCentavos(suma))}</span>
          </div>
        </div>
      ) : (
        <p className="text-sm text-ink2">Todavía no hay conceptos cargados.</p>
      )}

      {editable && (
        <div className="flex flex-wrap items-end gap-2">
          <select
            value={conceptoId}
            onChange={(e) => setConceptoId(e.target.value)}
            className={CAMPO_SUELTO}
          >
            <option value="">Concepto</option>
            {conceptos.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
          <input
            inputMode="decimal"
            value={importe}
            onChange={(e) => setImporte(e.target.value)}
            placeholder="450.000"
            className={`w-32 ${CAMPO_SUELTO} tnum`}
          />
          <button
            type="button"
            disabled={conceptoId === "" || parsear(importe) === null || guardando}
            onClick={() => {
              const c = parsear(importe);
              if (c === null) return;
              alAgregar(conceptoId, aPesos(c));
              setImporte("");
              setConceptoId("");
            }}
            className="flex items-center gap-1 rounded-md border border-line px-3 py-2 text-sm disabled:opacity-50"
          >
            <Plus aria-hidden="true" size={14} /> Agregar
          </button>
        </div>
      )}
    </Panel>
  );
}
```

- [ ] **Paso 3: Usarlo desde `Ficha.tsx`**

Reemplazar los dos `<Costos>` por:

```tsx
      {/*
        EL PRESUPUESTO NO SE TOCA DESPUES DE PAGADO. La base lo impide con un trigger; acá se
        deja de ofrecer para que el rechazo no llegue como una sorpresa. La razón está escrita
        en la migración: al pagar se libera la reserva entera, así que un cambio posterior
        escribiría un ajuste sobre una reserva que ya no existe.
      */}
      <Presupuesto
        titulo="Presupuesto"
        ayuda="Es lo que se reserva de la tarjeta. Cambia solo cuando cambia una línea."
        lineas={presupuesto}
        conceptos={conceptos.data ?? []}
        editable={!["pagado", "retirado", "devuelto", "anulado"].includes(t.estado)}
        alAgregar={(conceptoId, importe) =>
          agregarLinea.mutate({ conceptoId, momento: "presupuesto", importe })}
        alCorregir={(idLinea, importe) => corregirConcepto.mutate({ id: idLinea, importe })}
        alQuitar={(idLinea, motivo) => quitarConcepto.mutate({ id: idLinea, motivo })}
        guardando={agregarLinea.isPending || corregirConcepto.isPending || quitarConcepto.isPending}
      />

      <Presupuesto
        titulo="Costo real"
        ayuda="Lo que de verdad se pagó en la ventanilla. Se carga antes de marcarlo como pagado."
        lineas={reales}
        conceptos={conceptos.data ?? []}
        editable={!["retirado", "devuelto", "anulado"].includes(t.estado)}
        alAgregar={(conceptoId, importe) =>
          agregarLinea.mutate({ conceptoId, momento: "real", importe })}
        alCorregir={(idLinea, importe) => corregirConcepto.mutate({ id: idLinea, importe })}
        alQuitar={(idLinea, motivo) => quitarConcepto.mutate({ id: idLinea, motivo })}
        guardando={agregarLinea.isPending || corregirConcepto.isPending || quitarConcepto.isPending}
      />
```

Y arriba, con los otros hooks:

```tsx
  const corregirConcepto = useCorregirConcepto();
  const quitarConcepto = useQuitarConcepto();
```

Cambiar el cálculo de `presupuesto` y `reales` para que las anuladas también lleguen:

```tsx
  const presupuesto = (lineas.data ?? []).filter((l) => l.momento === "presupuesto");
  const reales = (lineas.data ?? []).filter((l) => l.momento === "real");
```

Y borrar `sumaPresupuesto` y `sumaReal`, que ahora los calcula el componente.

Borrar también del `avanzar` la rama de `deposito_solicitado` entera —ese campo ya no se escribe
desde la pantalla— y el `<label>` del depósito con su botón "Guardar el depósito corregido".

- [ ] **Paso 4: Los cuatro comandos y mirarlo con números reales**

```bash
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && npx tsc -b > /tmp/a.log 2>&1; echo "TIPOS: $?"; head -20 /tmp/a.log; npm run lint > /tmp/b.log 2>&1; echo "LINT: $?"; npm test > /tmp/c.log 2>&1; echo "TESTS: $?"; grep -E "Tests" /tmp/c.log | tail -3
```

Después, **el circuito completo con la calculadora al lado**, que es donde se agarran los errores
de plata:

1. Anotar el saldo reservado de una tarjeta.
2. Como gestoría, agregar Arancel 500.000 a un trámite en `entregado`.
3. Comprobar que el reservado subió **exactamente 500.000** y que en Operaciones hay una fila
   `Reserva — <apellido>` de -500.000.
4. Corregir esa línea a 620.000. Comprobar que el reservado subió 120.000 más y que hay un
   ajuste de -120.000. **La reserva original tiene que seguir intacta.**
5. Agregar Sellados 80.000. Total 700.000.
6. Quitar Sellados con motivo. Comprobar que el reservado bajó 80.000 y que la línea queda
   tachada con su motivo.
7. Volver a cargar Sellados. **Tiene que dejar** — es la prueba del índice parcial.

- [ ] **Paso 5: Commit**

```bash
git add src/features/tramites/ src/lib/datos.ts && git commit -m "El presupuesto se corrige linea por linea y la reserva lo sigue sola"
```

---

## Tarea 13: El panel de cambios, unificado

Cubre la segunda mitad de FOTO 3.

**Archivos:**
- Crear: `src/features/tramites/CambiosDelTramite.tsx`
- Borrar: `src/features/tramites/HistorialPresupuesto.tsx`
- Modificar: `src/lib/datos.ts` (`useHistorialPresupuesto` pasa a `useCambios`)
- Modificar: `src/features/tramites/Ficha.tsx`

**Interfaces:**
- Consume: `public.tramite_cambios` de la tarea 2, `nombreDeCampo` de la tarea 11.
- Produce: `useCambios(tramiteId)` devuelve
  `{ id, que, campo, antes, despues, quien_nombre, cuando }[]`.

- [ ] **Paso 1: Cambiar el hook en `src/lib/datos.ts`**

Renombrar `useHistorialPresupuesto` a `useCambios`, apuntarlo a `tramite_cambios`, agregar `campo`
al select, y cambiar el `queryKey` a `["tramite_cambios", tramiteId]`. El tipo exportado
`CambioDePresupuesto` pasa a llamarse `CambioDelTramite` y suma `campo: string | null`.

Comprobar que no quedó ninguna referencia al nombre viejo:

```bash
cd "C:/Users/Vmagni/Desktop/GRUPO PARIS/GESTORIA" && grep -rn "presupuesto_historial\|useHistorialPresupuesto\|CambioDePresupuesto" src/
```

Esperado después: sin resultados.

- [ ] **Paso 2: Crear `src/features/tramites/CambiosDelTramite.tsx`**

```tsx
import { Panel } from "../../components/Panel";
import { SkeletonLineas } from "../../components/Skeleton";
import { formatearFechaHora } from "../../lib/fechas";
import { aCentavos, formatear } from "../../lib/plata";
import type { CambioDelTramite } from "../../lib/datos";
import { nombreDeCampo } from "./campos-del-tramite";

/**
 * ============================================================================
 *  TODO LO QUE CAMBIO EN ESTE TRAMITE
 * ============================================================================
 *
 *  UN SOLO PANEL, y no uno para el presupuesto y otro para los datos. Quien pregunta "¿por qué
 *  este trámite dice esto?" no sabe de antemano si lo que cambió fue un importe o el nombre de
 *  la gestora, y dos paneles lo obligan a buscar en los dos.
 *
 *  ============================================================================
 *   LO ESCRIBEN TRIGGERS, NO ESTA PANTALLA
 *  ============================================================================
 *
 *  Si lo escribiera la pantalla, el día que alguien cambie algo desde otro lado —una corrección
 *  a mano, una importación, un script— el historial diría que no pasó nada. Un historial con
 *  agujeros es PEOR que ninguno: se lo lee como completo.
 *
 *  Y el trigger de datos compara por diferencia de jsonb, así que una columna que se agregue
 *  mañana queda registrada por defecto. El olvido cae del lado seguro.
 */
export function CambiosDelTramite({
  cambios, cargando,
}: {
  cambios: CambioDelTramite[];
  cargando: boolean;
}) {
  if (cargando) return <Panel><SkeletonLineas cantidad={2} /></Panel>;

  // Sin cambios no se dibuja nada. Un panel vacío que dice "no hay cambios" ocupa lugar en la
  // pantalla del teléfono para no decir nada: la mayoría de los trámites nunca se corrigen.
  if (cambios.length === 0) return null;

  return (
    <Panel className="flex flex-col gap-2">
      <h2 className="text-lg">Cambios</h2>
      <p className="text-2xs text-ink2">
        Queda registrado quién lo cambió y de qué a qué. No se puede editar ni borrar.
      </p>
      <div className="flex flex-col">
        {cambios.map((c) => (
          <div key={c.id} className="border-b border-line py-2 last:border-0">
            <p className="text-sm">{describir(c)}</p>
            <p className="text-2xs text-ink2 tnum">
              {c.quien_nombre ?? "Alguien"} · {formatearFechaHora(c.cuando)}
            </p>
          </div>
        ))}
      </div>
    </Panel>
  );
}

/**
 * Cómo se lee un cambio.
 *
 * Los importes pasan por el módulo de plata en vez de mostrarse crudos: el trigger los guarda
 * como texto decimal —`640000.00`— y así, sin puntos de miles, un número de siete cifras se lee
 * mal justo cuando importa distinguir 64.000 de 640.000.
 */
function describir(c: CambioDelTramite): string {
  if (c.que === "deposito") {
    const antes = c.antes === null ? null : formatear(aCentavos(Number(c.antes)));
    const despues = c.despues === null ? "sin presupuesto" : formatear(aCentavos(Number(c.despues)));
    return antes === null ? `Presupuesto: ${despues}` : `Presupuesto: de ${antes} a ${despues}`;
  }

  if (c.que === "concepto") {
    // Un concepto llega ya armado por el trigger, con su nombre y su momento.
    return c.antes === null
      ? `Concepto agregado: ${c.despues ?? ""}`
      : `Concepto: de ${c.antes} a ${c.despues ?? ""}`;
  }

  // Un dato. El nombre en castellano sale de la misma tabla que usa el panel de datos, así que
  // una etiqueta que cambie ahí cambia acá también y no se pueden separar.
  const nombre = nombreDeCampo(c.campo ?? "");
  const antes = c.antes ?? "vacío";
  const despues = c.despues ?? "vacío";
  return `${nombre}: de ${antes} a ${despues}`;
}
```

- [ ] **Paso 3: Cambiarlo en `Ficha.tsx` y borrar el archivo viejo**

En `src/features/tramites/Ficha.tsx`, cambiar la declaración del hook. Donde dice:

```tsx
  const historial = useHistorialPresupuesto(id);
```

poner:

```tsx
  const cambios = useCambios(id);
```

Cambiar la importación desde `../../lib/datos`: sacar `useHistorialPresupuesto`, poner
`useCambios`. Cambiar la importación del componente:

```tsx
import { CambiosDelTramite } from "./CambiosDelTramite";
```

Y reemplazar la línea que lo dibuja. Donde dice:

```tsx
      <HistorialPresupuesto cambios={historial.data ?? []} cargando={historial.isLoading} />
```

poner:

```tsx
      <CambiosDelTramite cambios={cambios.data ?? []} cargando={cambios.isLoading} />
```

Después borrar `src/features/tramites/HistorialPresupuesto.tsx`.

Y comprobar que ninguna mutación quedó invalidando la clave vieja:

```bash
cd "C:/Users/Vmagni/Desktop/GRUPO PARIS/GESTORIA" && grep -rn "presupuesto_historial" src/
```

Esperado: sin resultados. Si queda una, la pantalla no se refresca al corregir algo y el
historial parece vacío hasta recargar — que es la clase de defecto que se cree "de la base".

- [ ] **Paso 4: Los cuatro comandos y mirarlo**

```bash
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && npx tsc -b > /tmp/a.log 2>&1; echo "TIPOS: $?"; npm run lint > /tmp/b.log 2>&1; echo "LINT: $?"; npm test > /tmp/c.log 2>&1; echo "TESTS: $?"; grep -E "Tests" /tmp/c.log | tail -3; npm run deadcode > /tmp/d.log 2>&1; echo "MUERTO: $?"; tail -15 /tmp/d.log
```

En pantalla: cambiar la gestora de un trámite y comprobar que aparece
`Gestora: de <nombre> a <nombre>` con tu nombre y la fecha. Corregir un importe y comprobar que la
línea del concepto aparece en el mismo panel, no en otro.

**Comprobar también que las 10 filas viejas siguen ahí**, en el trámite al que pertenecen.

- [ ] **Paso 5: Commit**

```bash
git add src/features/tramites/ src/lib/datos.ts && git rm src/features/tramites/HistorialPresupuesto.tsx && git commit -m "Un solo panel con todo lo que cambio en el tramite"
```

---

## Tarea 14: El checklist con las dos formas de contestar

Cubre FOTO 1 en la pantalla.

**Archivos:**
- Modificar: `src/features/tramites/Checklist.tsx`
- Modificar: `src/lib/datos.ts` (`useRequisitos` trae `tipo`)

**Interfaces:**
- Consume: `requisitos.tipo` de la tarea 3.
- Produce: `Checklist` recibe requisitos con `{ id, nombre, tipo }`.

- [ ] **Paso 1: Traer `tipo` en `useRequisitos`**

En `src/lib/datos.ts`, agregar `tipo` al `select` de `useRequisitos`.

- [ ] **Paso 2: Cambiar el componente**

En `src/features/tramites/Checklist.tsx`, reemplazar la constante `RESPUESTAS` y el bloque que
dibuja los botones por:

```tsx
/**
 * ============================================================================
 *  DOS FORMAS DE CONTESTAR, PORQUE HAY DOS CLASES DE ITEM
 * ============================================================================
 *
 *  LOS PAPELES se contestan Está / Falta / No corresponde. Las tres significan algo distinto y
 *  las tres hacen falta: un requisito que no aplica a ese trámite, si sólo se pudiera tildar o
 *  no tildar, se termina tildando en falso — y ahí deja de ser un control y pasa a ser una
 *  mentira prolija.
 *
 *  LOS HECHOS DE LA OPERACION se contestan Sí o No. "¿Hay accesorios?" no admite "no
 *  corresponde": o los hay o no los hay. Ofrecer una tercera respuesta que no significa nada es
 *  invitar a usarla para no pensar.
 *
 *  La tanda anterior de este pedido creó un requisito llamado literalmente "Accesorios si/no" y
 *  le dejó las tres respuestas de papel, así que la pantalla preguntaba si el "si/no" ESTABA.
 *  Queda escrito para que no se repita: la diferencia no está en el nombre del ítem, está en su
 *  naturaleza, y por eso ahora vive en una columna de la base.
 */
const RESPUESTAS: Record<string, { valor: string; nombre: string }[]> = {
  documento: [
    { valor: "si", nombre: "Está" },
    { valor: "no", nombre: "Falta" },
    { valor: "no_aplica", nombre: "No corresponde" },
  ],
  si_no: [
    { valor: "si", nombre: "Sí" },
    { valor: "no", nombre: "No" },
  ],
};

/** Un tipo desconocido se trata como papel: es la opción que nunca pierde información. */
function respuestasDe(tipo: string): { valor: string; nombre: string }[] {
  return RESPUESTAS[tipo] ?? RESPUESTAS["documento"] ?? [];
}
```

Y adentro del `map`, cambiar `RESPUESTAS.map(...)` por `respuestasDe(r.tipo).map(...)`, y el
resaltado en `warn` por:

```tsx
                    className={`rounded-md border px-2 py-1 text-xs ${
                      actual === op.valor
                        ? op.valor === "no" && r.tipo === "documento"
                          ? "border-warn text-warn"
                          : "border-ink"
                        : "border-line text-ink2"
                    }`}
```

El "No" de un hecho **no se pinta de alerta**: que no haya accesorios no es una falta, es un dato.
Pintarlo igual que un papel faltante enseña a leer el color como decorativo.

Cambiar también el tipo de la prop:

```tsx
  requisitos: { id: string; nombre: string; tipo: string }[];
```

Y el texto de arriba, que hoy habla sólo de papeles:

```tsx
      <p className="text-sm text-ink2">
        Antes de pasar a gestoría hay que contestar el checklist del legajo. Se exige contestado,
        no que todo esté: una falta registrada sirve, una casilla tildada en falso no.
      </p>
```

Y el botón de atajo, que hoy dice "marcar los 5 como presentes":

```tsx
        {/*
          El atajo marca todo en "sí". Para los papeles significa que vino todo; para los hechos,
          que hay accesorios y hay usado. NO es el caso más común de los dos últimos, así que el
          texto lo dice en vez de prometer algo que no hace.
        */}
        Vino todo y hay accesorios y usado: contestar los {requisitos.length} con Sí
```

- [ ] **Paso 3: Los cuatro comandos y mirarlo**

```bash
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && npx tsc -b > /tmp/a.log 2>&1; echo "TIPOS: $?"; npm run lint > /tmp/b.log 2>&1; echo "LINT: $?"; npm test > /tmp/c.log 2>&1; echo "TESTS: $?"; grep -E "Tests" /tmp/c.log | tail -3
```

En pantalla: abrir un trámite en `recibido`. Los tres primeros ítems tienen que ofrecer tres
botones; **Accesorios y Entrega de vehículo usado, dos: Sí y No.** Contestar los cinco y avanzar.

- [ ] **Paso 4: Commit**

```bash
git add src/features/tramites/Checklist.tsx src/lib/datos.ts && git commit -m "Accesorios y usado se contestan Si o No en la pantalla"
```

---

## Tarea 15: Las pruebas de permisos de todo lo nuevo

Andon: con esto sin hacer, nada se publica.

**Archivos:**
- Modificar: `src/permisos.rls.test.ts`

**Interfaces:**
- Consume: los usuarios de prueba de `.env.local` (`PRUEBA_GERENCIA`, `PRUEBA_CONTABLE`,
  `PRUEBA_GESTORA`, `PRUEBA_SIN_ASIGNAR`).

- [ ] **Paso 1: Agregar los bloques nuevos**

```ts
describe("la plata del presupuesto no se puede tocar por la puerta de atrás", () => {
  it("una gestora NO puede escribir el total del trámite a mano", async () => {
    /*
      Es el poka-yoke central de la tarea 1: el total es la suma de las líneas. Si se pudiera
      escribir directo, volvería a haber dos números para la misma cosa — y el que decide cuánto
      se reserva sería el escrito a mano, que es exactamente el problema que se sacó.
    */
    const { error } = await gestora
      .from("tramites").update({ deposito_solicitado: 99999999 }).eq("id", creado);
    expect(error).not.toBeNull();
  });

  it("y no se puede quitar una línea sin decir por qué", async () => {
    const { data: linea } = await gestora
      .from("tramite_conceptos").select("id").eq("tramite_id", creado).limit(1);
    const id = linea?.[0]?.id;
    if (id === undefined) throw new Error("hace falta una línea de presupuesto para esta prueba");

    const { error } = await gestora
      .from("tramite_conceptos").update({ anulada: true }).eq("id", id);
    expect(error).not.toBeNull();
  });
});

describe("los movimientos siguen sin poder editarse ni borrarse", () => {
  it("ni gerencia puede editar el libro mayor", async () => {
    const { data: m } = await gerencia.from("movimientos").select("id").limit(1);
    const id = m?.[0]?.id;
    if (id === undefined) throw new Error("hace falta un movimiento para esta prueba");

    const { error } = await gerencia.from("movimientos").update({ importe: 1 }).eq("id", id);
    expect(error).not.toBeNull();
  });

  it("una gestora no puede anular un movimiento", async () => {
    // La función lo rechaza por rol, no la RLS: es SECURITY DEFINER y comprueba es_oficina().
    const { data: m } = await gerencia.from("movimientos").select("id").eq("tipo", "ingreso").limit(1);
    const id = m?.[0]?.id;
    if (id === undefined) throw new Error("hace falta un ingreso para esta prueba");

    const { error } = await gestora.rpc("anular_movimiento", { p_id: id, p_motivo: "probando" });
    expect(error).not.toBeNull();
  });

  it("y una reserva no se anula desde la cuenta, ni siendo gerencia", async () => {
    const { data: m } = await gerencia.from("movimientos").select("id").eq("tipo", "reserva").limit(1);
    const id = m?.[0]?.id;
    if (id === undefined) throw new Error("hace falta una reserva para esta prueba");

    const { error } = await gerencia.rpc("anular_movimiento", { p_id: id, p_motivo: "probando" });
    expect(error).not.toBeNull();
  });
});

describe("el historial de cambios es de sólo lectura", () => {
  it("nadie puede editarlo", async () => {
    const { data: c } = await gerencia.from("tramite_cambios").select("id").limit(1);
    const id = c?.[0]?.id;
    if (id === undefined) return;  // sin filas todavía, no hay nada que probar

    const { error } = await gerencia.from("tramite_cambios").update({ antes: "otro" }).eq("id", id);
    expect(error).not.toBeNull();
  });

  it("y sin sesión no devuelve nada, sin dar error", async () => {
    // CERO FILAS Y NO 42501: la ausencia y el rechazo son cosas distintas, y confundirlas manda
    // a buscar un problema de permisos donde sólo falta una sesión.
    const { data, error } = await anonimo.from("tramite_cambios").select("*");
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});

describe("contable y gerencia pueden exactamente lo mismo", () => {
  it("las dos pueden cambiar la gestora de un trámite", async () => {
    for (const [quien, cliente] of [["gerencia", gerencia], ["contable", contable]] as const) {
      const { error } = await cliente
        .from("tramites").update({ administrativo: `prueba ${quien}` }).eq("id", creado);
      expect(error, `${quien} tendría que poder`).toBeNull();
    }
  });
});
```

**Restaurar los datos ANTES de afirmar, no después.** Ya pasó en este proyecto: un aserto que
falla lanza, el código de restauración de abajo no corre, y la corrida siguiente empieza con la
base sucia y saltea cinco pruebas.

- [ ] **Paso 2: Correr las pruebas**

```bash
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && npm run test:rls > /tmp/rls.log 2>&1; echo "EXIT: $?"; grep -E "Tests|FAIL|passed|failed" /tmp/rls.log | tail -45
```

Esperado: todas en verde. Si alguna de las que esperan `error` pasa en verde por la razón
equivocada —por ejemplo porque no había fila para probar— arreglá el arnés, no el aserto.

- [ ] **Paso 3: Comprobar que el arnés no ensucia la base**

```bash
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && npm run test:rls > /dev/null 2>&1; npm run test:rls > /dev/null 2>&1; echo "corrido dos veces"
```

Y después contar los trámites de prueba con la consulta de la tarea 1. **Tiene que haber los
mismos que antes.**

- [ ] **Paso 4: Commit**

```bash
git add src/permisos.rls.test.ts && git commit -m "Pruebas de permisos de lo nuevo: el total, las anulaciones y el historial"
```

---

## Tarea 16: Cierre — todo en verde, publicado y mirado

**Archivos:**
- Modificar: `CHANGELOG.md`
- Modificar: `docs/ESTADO.md`

- [ ] **Paso 1: Los cinco guardianes y los cuatro comandos**

```bash
cd "C:/Users/Vmagni/Desktop/GRUPO PARIS/GESTORIA" && export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && for c in "npx tsc -b" "npm run lint" "npm test" "npm run build" "npm run deadcode" "npm run secretos" "npm run migraciones" "npm run permisos"; do printf '%-22s ' "$c"; $c > /tmp/g.log 2>&1; echo "EXIT: $?"; done && npm run test:rls > /tmp/rls.log 2>&1; echo "RLS EXIT: $?"; grep -E "Tests" /tmp/rls.log | tail -2
```

Esperado: **todos en 0.** Si alguno no da 0, se arregla antes de seguir. Andon: con un defecto
abierto no se publica.

- [ ] **Paso 2: Escribir la entrada del CHANGELOG**

En lenguaje de usuario, no de commit. Agregar arriba de todo, dentro de "Sin publicar todavía":

```markdown
### Lo que cambió en esta revisión

**El presupuesto es un solo número.** Antes había dos —la suma de los conceptos y un "depósito
que se solicita" escrito aparte— y el que se descontaba de la tarjeta era el segundo. Ahora el
presupuesto **es** la suma de sus conceptos: apenas se agrega, se corrige o se quita una línea, la
reserva de la tarjeta se ajusta sola y el movimiento aparece en Operaciones con el apellido del
cliente al lado. Si hace falta pedir de más, se carga como un concepto con su nombre.

**Se puede corregir el presupuesto.** Cada línea tiene Corregir y Quitar. Una línea quitada no
desaparece: queda tachada con el motivo escrito, porque cuando el trámite vuelve del registro y el
número no cierra, lo que se pregunta es qué se sacó y por qué.

**Se pueden corregir los datos del trámite**, incluida **la gestora que lo hace**. Cambiarla hace
que el trámite le aparezca a ella y deje de aparecerle a la anterior. Cada cambio queda registrado
con el nombre de quien lo hizo, en un solo panel que ahora muestra todo junto: los datos, los
importes y el total.

**Se puede anular un movimiento cargado mal.** Un depósito con un cero de más se anula escribiendo
el motivo: queda tachado, con su compensación abajo, y el saldo vuelve a cerrar. No se borra
nada, porque el saldo de ayer tiene que poder reconstruirse.

**La Tarjeta muestra cuatro columnas con los nombres de la empresa:** Saldo día de hoy, Depósito
pendiente de acreditación, Saldo reservado, y la Diferencia entre las dos primeras — que es con la
que se decide si se manda a presentar.

**Accesorios y Entrega de vehículo usado se contestan Sí o No.** No son papeles que puedan faltar:
son hechos de la operación, y "No corresponde" sobre un hecho no significa nada.

**Gestoría dejó de tener "Cargar trámite".** El trámite nace de un mail que le llega a
administración, y el alta la hace quien recibe ese mail.

**Se sacó la sección de Vencimientos de la ficha.** Con tres de los cinco plazos sin confirmar,
no mostraba fechas: mostraba renglones explicando qué faltaba. Administración conserva los plazos
y los feriados; el día que estén confirmados, se vuelve a mostrar.

**Se sacó la cuenta regresiva al corte** de la pantalla de la Tarjeta.
```

- [ ] **Paso 3: Actualizar `docs/ESTADO.md` con los números contados de nuevo**

```bash
cd "C:/Users/Vmagni/Desktop/GRUPO PARIS/GESTORIA" && export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH" && npm test 2>&1 | grep -E "Tests +[0-9]+" | tail -2 && npm run test:rls 2>&1 | grep -E "Tests +[0-9]+" | tail -2 && ls supabase/migrations/*.sql | wc -l && git log --oneline origin/main..main | wc -l
```

Escribir esos números, no los de antes.

- [ ] **Paso 4: Publicar**

```bash
cd "C:/Users/Vmagni/Desktop/GRUPO PARIS/GESTORIA" && git add -A && git commit -m "Segunda revision: el presupuesto, los datos y los saldos se corrigen" && git push origin dev && git checkout main && git merge dev --no-edit && git push origin main && echo "PUSH OK a main" && git checkout dev
```

- [ ] **Paso 5: Comprobar que llegó, con las tres evidencias**

Esperar a que termine el despliegue y después:

```bash
cd "C:/Users/Vmagni/Desktop/GRUPO PARIS/GESTORIA" && echo "sin publicar: $(git log --oneline origin/main..main | wc -l)" && JS=$(curl -s https://proyecto-gestoria.pages.dev/ | grep -o '/assets/index-[^"]*\.js' | head -1) && echo "JS: $JS" && curl -s "https://proyecto-gestoria.pages.dev$JS" > /tmp/pub.js && for s in "Total que se pide" "Saldo reservado" "Anular el movimiento" "Corregir" "Datos del tr"; do printf '%-24s ' "$s"; grep -c "$s" /tmp/pub.js; done
```

Esperado: `sin publicar: 0` y **todos los textos en 1 o más**. Si alguno da 0, el despliegue no
tomó los cambios y no se reporta nada como terminado.

- [ ] **Paso 6: Mirarlo en producción, con los tres usuarios**

**Éste es el paso que no se puede saltear.** Los tres peores defectos de los proyectos hermanos se
descubrieron mirando, no testeando, y esta app la revisa la dueña de la empresa.

Entrar a `https://proyecto-gestoria.pages.dev/` y recorrer la cadena entera:

1. **Como contable o gerencia:** cargar un trámite pegando el asunto del mail. Contestar el
   checklist —los dos últimos con Sí o No— y marcarlo como controlado. Asignarle una gestora y
   entregarlo.
2. **Como gestoría:** el trámite tiene que aparecer. Cargar el presupuesto con dos conceptos.
   Ir a Tarjeta y comprobar que el Saldo reservado subió por exactamente esa suma y que el
   movimiento figura en Operaciones con el apellido. Comprobar que **no** hay "Cargar trámite" en
   el menú, ni panel de Vencimientos en la ficha.
3. **Como gerencia:** verlo en Pedidos de fondos con el disponible al lado. Corregir un importe y
   comprobar que la reserva sigue el cambio. Cambiar la gestora asignada y comprobar en Cambios
   que quedó registrado.
4. **Como la gestora nueva:** comprobar que ahora le aparece a ella.
5. Seguir hasta `devuelto`, cargando el costo real, y comprobar que al pagar se libera la reserva.
6. En un **teléfono de verdad**, parado y con una mano: abrir un trámite y cargar un presupuesto.

- [ ] **Paso 7: Reportar con la evidencia al lado**

Al usuario le corresponde saber tres cosas: qué quedó hecho, qué no, y **cómo comprobarlo él
mismo**. Escribir la salida real de los comandos, no una afirmación de que dieron bien.

---

## Lo que este plan NO hace, escrito para que nadie lo suponga

- **No trae de vuelta los vencimientos.** Los plazos y los feriados se siguen configurando desde
  Administración, pero no se muestra ninguna cuenta regresiva en ningún trámite.
- **No trae la cuenta regresiva al corte de las 16:00.** El aviso de que un depósito ordenado
  tarde acredita pasado mañana queda sólo en el formulario de Cargar dinero.
- **No permite borrar de verdad** ni un movimiento, ni un trámite, ni una línea de presupuesto.
  Se anulan con motivo y quedan a la vista. Es una regla del proyecto, no una limitación: sin eso
  el saldo de ayer deja de poder reconstruirse y la conciliación contra el sitio no cierra nunca.
- **No separa la base de desarrollo de la de producción.** Sigue siendo una sola, y la app lo
  sigue diciendo en pantalla. Eso tiene que cambiar antes de que se cargue un `saldo_inicial`
  real.
- **No rota ninguna clave**, por decisión explícita del usuario.

---

## Lo que depende del usuario, y frena cosas

1. **Cambiar la contraseña genérica `Paris2026!`** antes de que haya saldos reales.
2. **La segunda base de Supabase**, antes de cargar el `saldo_inicial` real. Hoy hay una sola y el
   cupo gratuito de la cuenta está en el tope: hace falta una segunda cuenta con otro correo, o el
   plan Pro.
3. **Confirmar los tres plazos que faltan y cargar los feriados**, si algún día se quieren los
   vencimientos de vuelta.
4. **La regla escrita de gerencia:** no se deposita contra una foto de cuaderno.
