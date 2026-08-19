-- ============================================================================
--  GESTORIA — EL TRAMITE Y SU CADENA
--
--  El tramite, su ciclo de diez estados, el historial, el checklist del legajo, las notas y
--  las lineas de concepto.
--
--  LA CADENA, del pedido:
--    recibido -> controlado -> entregado -> presupuestado -> presentado -> pagado ->
--    retirado -> devuelto,  mas frenado_por_saldo y anulado.
--
--  CADA ESTADO ES UN PUNTO DE CONTROL: no se avanza sin su dato. Un estado sin dato exigido no
--  es un control, es una etiqueta.
--
--  Hoy ese orden lo garantiza la costumbre y una planilla que va por la fila 6.868. Aca lo
--  garantiza un trigger, y no solo el orden: tambien QUIEN puede hacer cada salto. La transicion
--  dispara plata —la reserva contra el saldo—, asi que dejarla librada al front no alcanza: el
--  trigger no mira el fuente, mira la escritura.
-- ============================================================================

-- ------------------------------------------------------------
-- 1) El tramite
-- ------------------------------------------------------------

create table if not exists public.tramites (
  id                uuid primary key default gen_random_uuid(),

  -- De donde viene y a quien pertenece
  razon_social_id   uuid not null references public.razones_sociales(id),
  sucursal_id       uuid not null references public.sucursales(id),
  tipo              text not null,
  subtipo           text,
  canal             text not null default 'presencial',

  -- El asunto del mail. Ver el comentario de asunto_mail: el crudo NO se pisa.
  cliente_nombre    text not null,
  cliente_cuenta    text,
  vehiculo          text,
  oferta_referencia text,
  asunto_mail       text,
  dominio           text,

  -- Gestion
  estado            text not null default 'recibido',
  gestora_id        uuid references public.gestoras(id),
  medio_pago        text not null default 'tarjeta_habitualista',
  tarjeta_id        uuid references public.tarjetas_habitualista(id),

  -- Plata que la gestora SI ve. El costo real NO esta aca: se suma de tramite_conceptos.
  deposito_solicitado numeric(14,2),

  -- Rastro del registro
  seccional             text,
  numero_pago_registro  text,

  -- Documentacion, en los dos sentidos
  documentacion_entregada text,
  documentacion_retirada  text,

  -- Fechas hito. Las escribe el trigger, no la app: un timestamp que se puede corregir a mano
  -- deja de ser una medicion, y de estas salen las metricas del analisis para gerencia.
  recibido_at    timestamptz not null default now(),
  autorizado_en  timestamptz not null default now(),
  autorizado_por uuid references public.perfiles(id),
  controlado_at  timestamptz,
  entregado_at   timestamptz,
  presupuestado_at timestamptz,
  presentado_at  timestamptz,
  pagado_at      timestamptz,
  retirado_at    timestamptz,
  devuelto_at    timestamptz,

  -- Texto libre. Separadas A PROPOSITO para que una no tape a la otra ni se pise en un update.
  observaciones         text,
  observaciones_gestora text,
  motivo_anulacion      text,
  motivo_frenado        text,

  -- Origen y auditoria
  origen          text not null default 'app',
  creado_por      uuid references public.perfiles(id),
  creado_at       timestamptz not null default now(),
  actualizado_por uuid references public.perfiles(id),
  actualizado_at  timestamptz not null default now(),

  constraint tramites_tipo_valido check (tipo in (
    'patentamiento_0km','transferencia_a_cliente','transferencia_al_concesionario')),
  constraint tramites_subtipo_valido check (
    subtipo is null or subtipo in ('plan_ahorro','credito','contado')),
  constraint tramites_canal_valido check (canal in ('presencial','runa')),
  constraint tramites_estado_valido check (estado in (
    'recibido','controlado','entregado','presupuestado','frenado_por_saldo',
    'presentado','pagado','retirado','devuelto','anulado')),
  constraint tramites_medio_pago_valido check (
    medio_pago in ('tarjeta_habitualista','transferencia','efectivo')),
  constraint tramites_origen_valido check (origen in ('app','planilla','preexistente')),
  constraint tramites_deposito_no_negativo check (coalesce(deposito_solicitado,0) >= 0),
  constraint tramites_anulado_con_motivo check (
    estado <> 'anulado' or nullif(btrim(coalesce(motivo_anulacion,'')), '') is not null),
  constraint tramites_frenado_con_motivo check (
    estado <> 'frenado_por_saldo' or nullif(btrim(coalesce(motivo_frenado,'')), '') is not null)
);

comment on table public.tramites is
  'Un patentamiento o una transferencia. REGLA QUE NO SE ROMPE: en esta tabla no va NINGUN importe que la gestora no pueda ver. Lo cobrado al cliente vive en public.cobros, que es otra fila y por eso otra RLS. Si alguien agrega aca una columna de margen o de ganancia, rompe la unica barrera que protege ese dato.';

comment on column public.tramites.oferta_referencia is
  'La referencia de la oferta de compra. NO describe el tramite: LO UBICA. Es la llave para volver del sistema al cliente en Quiter, junto con cliente_cuenta. Tiene indice propio y es campo de busqueda de primera clase.';

comment on column public.tramites.asunto_mail is
  'El asunto del correo COMPLETO, sin parsear. Las cuatro columnas de arriba salen de el. Se guarda el crudo porque el formato NO es estable —conviven "REF. 4097473", "ref 4093504" y "REF4064625" en la misma planilla— y sin el original un parseo equivocado no se puede reparar sin volver al Outlook.';

comment on column public.tramites.canal is
  'presencial | runa. RUNA lo maneja administracion y esos tramites NO pasan por gestoria. Sirve para que el reporte de cierre pueda decir cuantos patentamientos del mes pasaron por este circuito: sin ese numero, el reporte parece describir toda la operacion cuando describe una parte.';

comment on column public.tramites.tarjeta_id is
  'La tarjeta contra la que este tramite movio plata. La escribe el trigger la PRIMERA vez que genera un movimiento y despues NO cambia, aunque cambie la tarjeta de la razon social. Sin esto, cambiar la tarjeta de una razon social dejaria reservas vivas sin revertir en la tarjeta vieja: dos saldos mal y ninguna alarma.';

comment on column public.tramites.deposito_solicitado is
  'Lo que la gestora pide que le depositen. En el cuaderno es el renglon "Dep $": 1.100.000, 800.000, 670.000. OJO: NO es la suma de las lineas de concepto —GARAY suma 666.000 y pide 670.000—, es el deposito redondeado. Es este numero el que reserva saldo.';

comment on column public.tramites.origen is
  'app | planilla | preexistente. Los tramites a mitad de camino el dia del corte entran como preexistente: el trigger de cuenta corriente NO les genera el pago, porque esa plata ya esta dentro del saldo_inicial. Sin esa distincion, el saldo de arranque queda doblemente bajo.';

comment on column public.tramites.numero_pago_registro is
  'El numero del comprobante del registro. NO es obligatorio para pasar a pagado, A PROPOSITO: si lo fuera, una gestora sin el comprobante a mano inventaria un numero, y un numero falso emparejaria mal en la conciliacion sin que nadie se entere. Un dato faltante se ve; uno inventado, no.';

-- ------------------------------------------------------------
-- 2) Historial de estados
-- ------------------------------------------------------------

create table if not exists public.tramite_eventos (
  id             bigserial primary key,
  tramite_id     uuid not null references public.tramites(id) on delete cascade,
  estado_desde   text,
  estado_hasta   text not null,
  por            uuid references public.perfiles(id),
  rol_al_momento text,
  nota           text,
  at             timestamptz not null default now()
);

comment on table public.tramite_eventos is
  'Quien movio el tramite, cuando y desde donde. Reemplaza a la foto del cuaderno que hoy llega por WhatsApp: el pedido dice "Necesitamos llevar ese registro en un formato de listado". De aca salen ademas las metricas del analisis para gerencia.';

comment on column public.tramite_eventos.rol_al_momento is
  'El rol que tenia esa persona cuando lo hizo. Sin esto, cambiarle el rol a alguien reescribe la lectura de todo su historial.';

-- ------------------------------------------------------------
-- 3) Lineas de concepto: presupuesto y costo real, en la MISMA tabla
--
--    De ahi sale gratis el desvio entre lo estimado y lo real, sin ninguna estructura nueva.
-- ------------------------------------------------------------

create table if not exists public.tramite_conceptos (
  id          bigserial primary key,
  tramite_id  uuid not null references public.tramites(id) on delete cascade,
  concepto_id uuid not null references public.conceptos(id),
  momento     text not null,
  importe     numeric(14,2) not null,
  creado_por  uuid references public.perfiles(id),
  creado_at   timestamptz not null default now(),
  constraint tramite_conceptos_momento_valido check (momento in ('presupuesto','real')),
  constraint tramite_conceptos_importe_positivo check (importe > 0)
);

create unique index if not exists tramite_conceptos_uno_por_momento
  on public.tramite_conceptos (tramite_id, concepto_id, momento);

comment on table public.tramite_conceptos is
  'Las lineas de costo de un tramite. La MISMA tabla sirve para lo estimado y lo real, con la columna momento: de ahi sale gratis el desvio, sin ninguna estructura nueva.';

-- ------------------------------------------------------------
-- 4) Checklist del legajo
-- ------------------------------------------------------------

create table if not exists public.tramite_requisitos (
  id             bigserial primary key,
  tramite_id     uuid not null references public.tramites(id) on delete cascade,
  requisito_id   uuid not null references public.requisitos(id),
  respuesta      text not null,
  nota           text,
  respondido_por uuid references public.perfiles(id),
  respondido_at  timestamptz not null default now(),
  constraint tramite_requisitos_respuesta_valida check (respuesta in ('si','no','no_aplica')),
  unique (tramite_id, requisito_id)
);

comment on column public.tramite_requisitos.respuesta is
  'si | no | no_aplica. TRES valores y no un booleano, y esa es la decision de esta tabla: pasar a controlado exige que TODOS esten CONTESTADOS, no que todos digan que si. Un checklist que bloquea por un requisito que no corresponde se termina tildando en falso, y ahi deja de ser un control y pasa a ser una mentira prolija.';

-- ------------------------------------------------------------
-- 5) Notas: la "intercomunicacion" del OBJETIVO
--
--    NO es un chat. Un canal de mensajes nuevo compite con WhatsApp, que ya esta abierto en el
--    telefono de todos, y pierde. Es una anotacion sobre el tramite, que es lo que hoy se
--    pierde cuando alguien explica algo por WhatsApp y esa explicacion no queda en ningun lado.
-- ------------------------------------------------------------

create table if not exists public.tramite_notas (
  id         bigserial primary key,
  tramite_id uuid not null references public.tramites(id) on delete cascade,
  texto      text not null,
  autor      uuid not null references public.perfiles(id),
  creado_at  timestamptz not null default now(),
  constraint tramite_notas_texto_no_vacio check (btrim(texto) <> '')
);

-- ------------------------------------------------------------
-- 6) Indices, cada uno con su motivo
-- ------------------------------------------------------------

create index if not exists tramites_abiertos_idx
  on public.tramites (razon_social_id, recibido_at desc)
  where estado not in ('devuelto','anulado');

create index if not exists tramites_gestora_abiertos_idx
  on public.tramites (gestora_id, estado)
  where estado not in ('devuelto','anulado') and gestora_id is not null;

create index if not exists tramites_presentado_idx on public.tramites (presentado_at) where presentado_at is not null;
create index if not exists tramites_pagado_idx     on public.tramites (pagado_at)     where pagado_at is not null;

-- Los dos datos que cruzan al sistema interno. Por eso tienen indice propio.
create index if not exists tramites_oferta_idx  on public.tramites (upper(oferta_referencia)) where oferta_referencia is not null;
create index if not exists tramites_cuenta_idx  on public.tramites (upper(cliente_cuenta))    where cliente_cuenta is not null;
create index if not exists tramites_dominio_idx on public.tramites (upper(dominio))           where dominio is not null;

create index if not exists tramites_cliente_trgm_idx
  on public.tramites using gin (cliente_nombre extensions.gin_trgm_ops);

-- Un 0km se patenta UNA vez. Existe porque duplicar es el error mas barato de cometer copiando
-- de un mail a una planilla, y hoy no lo atrapa nada. Excluye anulados, asi que recargar un
-- tramite mal anulado sigue siendo posible.
create unique index if not exists tramites_patentamiento_unico_idx
  on public.tramites (upper(dominio))
  where tipo = 'patentamiento_0km' and estado <> 'anulado' and dominio is not null;

create index if not exists tramite_eventos_tramite_idx on public.tramite_eventos (tramite_id, at desc);
create index if not exists tramite_conceptos_tramite_idx on public.tramite_conceptos (tramite_id, momento);

-- ------------------------------------------------------------
-- 7) Vista de totales
-- ------------------------------------------------------------

create or replace view public.v_tramite_totales with (security_invoker = true) as
select t.id as tramite_id,
       coalesce(sum(c.importe) filter (where c.momento = 'presupuesto'), 0) as total_presupuesto,
       coalesce(sum(c.importe) filter (where c.momento = 'real'), 0)        as total_real
  from public.tramites t
  left join public.tramite_conceptos c on c.tramite_id = t.id
 group by t.id;

comment on view public.v_tramite_totales is
  'security_invoker = true en TODA vista de este proyecto. Sin ese flag la vista corre como su duenio, saltea la RLS entera, y alguien ve lo que no tiene que ver.';

-- ------------------------------------------------------------
-- 8) Trigger de sello. Se llama a_ porque los BEFORE corren por orden alfabetico.
-- ------------------------------------------------------------

create or replace function public.a_tramites_sello()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.actualizado_at := now();
  new.actualizado_por := auth.uid();
  return new;
end;
$$;

drop trigger if exists a_tramites_sello on public.tramites;
create trigger a_tramites_sello before update on public.tramites
  for each row execute function public.a_tramites_sello();

-- ------------------------------------------------------------
-- 9) Bloqueo de columnas por rol
--
--    LA RLS DE POSTGRES DECIDE FILAS, NO COLUMNAS. Una gestora con permiso de update sobre su
--    propia fila puede, sin esto, hacer desde la consola del navegador:
--        update tramites set razon_social_id = '...' where id = '...';
--    y mandarle el gasto a otra razon social.
--
--    La comparacion se hace por DIFERENCIA de jsonb en vez de enumerar los campos prohibidos:
--    asi una columna que se agregue maniana queda protegida POR DEFECTO. La version enumerada
--    —que es la que usa hoy el Tablero— falla abierta, y en silencio.
-- ------------------------------------------------------------

create or replace function public.b_tramites_bloquear_campos()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  permitidos text[] := array[
    'deposito_solicitado','seccional','numero_pago_registro','observaciones_gestora',
    'documentacion_retirada','dominio','estado','presentado_at','pagado_at','retirado_at',
    'presupuestado_at','actualizado_at','actualizado_por'
  ];
begin
  if auth.uid() is null then return new; end if;              -- consola de la base
  if public.es_gerencia() or public.es_contable() then return new; end if;

  if not public.es_gestora() then
    raise exception 'regla_tramite: Tu usuario no tiene permiso para modificar tramites';
  end if;

  if (to_jsonb(new) - permitidos) is distinct from (to_jsonb(old) - permitidos) then
    raise exception 'regla_tramite: Una gestora solo puede cargar el presupuesto, los costos, el dominio, la seccional, el numero de pago y sus observaciones';
  end if;

  return new;
end;
$$;

drop trigger if exists b_tramites_bloquear_campos on public.tramites;
create trigger b_tramites_bloquear_campos before update on public.tramites
  for each row execute function public.b_tramites_bloquear_campos();

-- ------------------------------------------------------------
-- 10) La maquina de estados
-- ------------------------------------------------------------

create or replace function public.orden_estado(p text)
returns int language sql immutable as $$
  select case p
    when 'recibido' then 1 when 'controlado' then 2 when 'entregado' then 3
    when 'presupuestado' then 4 when 'frenado_por_saldo' then 4 when 'presentado' then 5
    when 'pagado' then 6 when 'retirado' then 7 when 'devuelto' then 8
    when 'anulado' then 99 end;
$$;

create or replace function public.c_tramites_transicion()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  rol       text := coalesce(public.mi_rol(), 'consola');
  ok        boolean := false;
  sin_contestar int;
  total_real numeric(14,2);
  lineas_presupuesto int;
begin
  -- ALTA. El alta ES la autorizacion: el pedido dice que si el nombre del cliente esta
  -- ingresado a la plataforma, eso ya es sinonimo de autorizacion. No hay boton de aprobar.
  if tg_op = 'INSERT' then
    if new.estado <> 'recibido' and new.origen = 'app' then
      raise exception 'regla_tramite: Un tramite nuevo entra en estado recibido';
    end if;
    new.autorizado_por := coalesce(new.autorizado_por, auth.uid());
    new.creado_por     := coalesce(new.creado_por, auth.uid());
    insert into public.tramite_eventos (tramite_id, estado_desde, estado_hasta, por, rol_al_momento)
      values (new.id, null, new.estado, auth.uid(), rol);
    return new;
  end if;

  if new.estado is not distinct from old.estado then return new; end if;
  if rol = 'consola' then return new; end if;   -- importaciones y arreglos desde el editor SQL

  -- Anular: en cualquier momento MENOS desde devuelto. Ese tramite ya volvio a administracion y
  -- la unidad se entrego: anularlo es reescribir historia. Si hubo un error, se corrige con un
  -- ajuste con motivo, que es lo que de verdad paso.
  if new.estado = 'anulado' then
    if old.estado = 'devuelto' then
      raise exception 'regla_tramite: Un tramite ya devuelto no se anula. Corregilo con un ajuste.';
    end if;
    ok := rol in ('gerencia','contable');

  -- Retroceder: solo gerencia. Sin esto, un error se arregla desarmando el circuito y nadie se
  -- entera de que el tramite volvio atras.
  elsif public.orden_estado(new.estado) < public.orden_estado(old.estado) then
    ok := (rol = 'gerencia');

  else
    ok := case old.estado || '>' || new.estado
      when 'recibido>controlado'                then rol in ('contable','gerencia')
      when 'controlado>entregado'               then rol in ('contable','gerencia')
      when 'entregado>presupuestado'            then rol in ('gestora','contable','gerencia')
      when 'presupuestado>frenado_por_saldo'    then rol in ('contable','gerencia')
      when 'frenado_por_saldo>presentado'       then rol in ('gestora','contable','gerencia')
      when 'presupuestado>presentado'           then rol in ('gestora','contable','gerencia')
      when 'presentado>pagado'                  then rol in ('gestora','contable','gerencia')
      when 'pagado>retirado'                    then rol in ('gestora','contable','gerencia')
      when 'retirado>devuelto'                  then rol in ('contable','gerencia')
      else false
    end;
  end if;

  if not ok then
    raise exception 'regla_tramite: No se puede pasar de % a % con el rol %', old.estado, new.estado, rol;
  end if;

  -- ------------------------------------------------------------
  -- REQUISITOS DE CONTENIDO. Van aca y no en el front porque son la razon de ser del paso.
  -- ------------------------------------------------------------

  -- controlado: el checklist tiene que estar CONTESTADO entero. No tildado: contestado.
  if new.estado = 'controlado' then
    select count(*) into sin_contestar
      from public.requisitos r
     where r.activo and (r.aplica_a = new.tipo or r.aplica_a = 'todos')
       and not exists (select 1 from public.tramite_requisitos tr
                        where tr.tramite_id = new.id and tr.requisito_id = r.id);
    if sin_contestar > 0 then
      raise exception 'regla_tramite: Faltan % requisitos del legajo por contestar', sin_contestar;
    end if;
  end if;

  -- entregado: hay que saber a quien se le entrego.
  if new.estado = 'entregado' and new.gestora_id is null then
    raise exception 'regla_tramite: Para entregar el tramite hace falta elegir la gestora';
  end if;

  -- presupuestado: el deposito solicitado y al menos una linea de concepto.
  if new.estado = 'presupuestado' then
    if coalesce(new.deposito_solicitado,0) <= 0 then
      raise exception 'regla_tramite: Falta el monto del deposito que se solicita';
    end if;
    select count(*) into lineas_presupuesto
      from public.tramite_conceptos where tramite_id = new.id and momento = 'presupuesto';
    if lineas_presupuesto = 0 then
      raise exception 'regla_tramite: Falta detallar al menos un concepto del presupuesto';
    end if;
    new.presupuestado_at := coalesce(new.presupuestado_at, now());
  end if;

  -- presentado: donde se presento, y que la razon social tenga tarjeta si paga con ella.
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

  -- pagado: el costo REAL. El numero de pago NO se exige: ver el comentario de esa columna.
  if new.estado = 'pagado' then
    select coalesce(sum(importe),0) into total_real
      from public.tramite_conceptos where tramite_id = new.id and momento = 'real';
    if total_real <= 0 then
      raise exception 'regla_tramite: Falta cargar el costo real, discriminado por concepto';
    end if;
    new.pagado_at := coalesce(new.pagado_at, now());
  end if;

  -- retirado: que documentacion volvio del registro.
  if new.estado = 'retirado' and nullif(btrim(coalesce(new.documentacion_retirada,'')),'') is null then
    raise exception 'regla_tramite: Anota que documentacion retiraste: titulo, cedula, chapas';
  end if;

  if new.estado = 'controlado' then new.controlado_at := coalesce(new.controlado_at, now()); end if;
  if new.estado = 'entregado'  then new.entregado_at  := coalesce(new.entregado_at, now());  end if;
  if new.estado = 'devuelto'   then new.devuelto_at   := coalesce(new.devuelto_at, now());   end if;

  insert into public.tramite_eventos (tramite_id, estado_desde, estado_hasta, por, rol_al_momento)
    values (new.id, old.estado, new.estado, auth.uid(), rol);

  return new;
end;
$$;

drop trigger if exists c_tramites_transicion on public.tramites;
create trigger c_tramites_transicion before insert or update on public.tramites
  for each row execute function public.c_tramites_transicion();

-- Las funciones de trigger NO son endpoints. En Postgres toda funcion nace con EXECUTE para
-- PUBLIC y anon HEREDA de PUBLIC: revocarle solo a anon no le saca nada.
revoke execute on function public.a_tramites_sello()          from public, anon, authenticated;
revoke execute on function public.b_tramites_bloquear_campos() from public, anon, authenticated;
revoke execute on function public.c_tramites_transicion()     from public, anon, authenticated;

-- ------------------------------------------------------------
-- 11) RLS
--
--    NINGUNA POLICY MIRA LA SUCURSAL. Contable ve San Juan y gerencia ve San Luis, completos.
--    Cortar la visibilidad por sucursal seria reconstruir en la base el problema que este
--    proyecto viene a resolver: que no hay un listado unificado y por eso se pisan los saldos.
-- ------------------------------------------------------------

alter table public.tramites enable row level security;

drop policy if exists "tramites_select" on public.tramites;
create policy "tramites_select" on public.tramites for select to authenticated
  using (
    public.es_gerencia() or public.es_contable()
    or (public.es_gestora() and gestora_id = public.mi_gestora_id())
  );

drop policy if exists "tramites_insert" on public.tramites;
create policy "tramites_insert" on public.tramites for insert to authenticated
  with check (public.es_gerencia() or public.es_contable());

drop policy if exists "tramites_update_oficina" on public.tramites;
create policy "tramites_update_oficina" on public.tramites for update to authenticated
  using (public.es_gerencia() or public.es_contable())
  with check (public.es_gerencia() or public.es_contable());

drop policy if exists "tramites_update_gestora" on public.tramites;
create policy "tramites_update_gestora" on public.tramites for update to authenticated
  using (
    public.es_gestora() and gestora_id = public.mi_gestora_id()
    and estado in ('entregado','presupuestado','frenado_por_saldo','presentado','pagado','retirado')
  )
  with check (public.es_gestora() and gestora_id = public.mi_gestora_id());

-- Sin policy de delete para nadie. Un tramite se anula, no se borra: el dia que falte uno la
-- pregunta va a ser quien lo borro y no va a haber respuesta.

-- Las tablas hijas heredan la visibilidad del tramite. Esta subconsulta SI esta permitida: es a
-- OTRA tabla, asi que hereda su RLS en vez de recursar. Lo prohibido es la subconsulta a
-- perfiles DESDE perfiles.
do $$
declare t text;
begin
  foreach t in array array['tramite_eventos','tramite_conceptos','tramite_requisitos','tramite_notas']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%s_select" on public.%I', t, t);
    execute format('create policy "%s_select" on public.%I for select to authenticated using (exists (select 1 from public.tramites x where x.id = %I.tramite_id))', t, t, t);
  end loop;
end $$;

-- Escritura de las hijas: quien puede tocar el tramite puede cargar sus lineas.
drop policy if exists "tramite_conceptos_write" on public.tramite_conceptos;
create policy "tramite_conceptos_write" on public.tramite_conceptos for all to authenticated
  using (exists (select 1 from public.tramites x where x.id = tramite_conceptos.tramite_id))
  with check (exists (select 1 from public.tramites x where x.id = tramite_conceptos.tramite_id));

drop policy if exists "tramite_requisitos_write" on public.tramite_requisitos;
create policy "tramite_requisitos_write" on public.tramite_requisitos for all to authenticated
  using (public.es_gerencia() or public.es_contable())
  with check (public.es_gerencia() or public.es_contable());

-- Las notas son de los tres roles: es la "intercomunicacion" del OBJETIVO. Se escribe la propia
-- y NO se edita ni se borra, como todo lo demas en este proyecto.
drop policy if exists "tramite_notas_insert" on public.tramite_notas;
create policy "tramite_notas_insert" on public.tramite_notas for insert to authenticated
  with check (autor = auth.uid()
              and exists (select 1 from public.tramites x where x.id = tramite_notas.tramite_id));

-- Los eventos los escribe el trigger, que es SECURITY DEFINER: sin policy de insert.

-- ============================================================================
--  COMO COMPROBAR QUE QUEDO BIEN
--
--  1) Los diez estados y ninguno mas:
--       select unnest(enum_range(null)) is null; -- no aplica: es un check, no un enum
--       select pg_get_constraintdef(oid) from pg_constraint where conname='tramites_estado_valido';
--
--  2) El indice que impide patentar dos veces el mismo dominio existe:
--       select indexdef from pg_indexes where indexname='tramites_patentamiento_unico_idx';
--
--  3) La vista de totales tiene security_invoker:
--       select c.relname, c.reloptions from pg_class c join pg_namespace n on n.oid=c.relnamespace
--        where n.nspname='public' and c.relkind='v';
--     TODAS tienen que decir {security_invoker=true}.
--
--  4) Un tramite nuevo no puede nacer en otro estado, y no se puede saltear un paso. Lo cubre
--     el arnes de permisos con usuarios reales.
-- ============================================================================
