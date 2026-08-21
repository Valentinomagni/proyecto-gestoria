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
--  existe para explicar una incoherencia es la senial de que la incoherencia no deberia existir.
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
-- ============================================================================

-- ------------------------------------------------------------
-- 1) Una linea del presupuesto se QUITA, no se borra
--
--    En este proyecto no hay delete para nadie. Sin esto, una linea cargada de mas no se puede
--    sacar de ninguna manera: el check `importe > 0` impide hasta ponerla en cero.
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
--    pasar a pagado, y quitar una linea mal cargada del costo real tiene que seguir siendo
--    posible mientras el tramite este vivo.
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
  v_tramite uuid := new.tramite_id;
  v_suma    numeric(14,2);
  v_nuevo   numeric(14,2);
begin
  select coalesce(sum(importe), 0) into v_suma
    from public.tramite_conceptos
   where tramite_id = v_tramite and momento = 'presupuesto' and not anulada;

  -- Cero se guarda como NULL y no como 0: la maquina de estados pregunta por null para saber si
  -- todavia no hay presupuesto, y un 0 significaria "se presupuesto en cero", que no existe.
  v_nuevo := case when v_suma = 0 then null else v_suma end;

  -- El `is distinct from` no es una optimizacion: sin el, cada linea de costo real dispararia
  -- un update del tramite con el mismo valor, y eso escribiria una fila de historial por nada.
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

-- Al recrear una vista Postgres NO conserva lo revocado. Sin estas dos lineas quedaria
-- escribible otra vez y `npm run permisos` se pondria en rojo, que es para lo que existe.
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
--  4) Anular sin motivo NO se puede. TIENE QUE FALLAR:
--       update public.tramite_conceptos set anulada = true where id = <n>;
--     Esperado: viola tramite_conceptos_anulada_con_motivo.
--
--  5) Y el mismo concepto se puede volver a cargar despues de quitarlo (indice parcial):
--       insert into public.tramite_conceptos (tramite_id, concepto_id, momento, importe)
--       values ('<id>', (select id from public.conceptos where nombre = 'Sellados'), 'presupuesto', 130000);
--     Esperado: entra sin violar el indice unico.
-- ============================================================================
