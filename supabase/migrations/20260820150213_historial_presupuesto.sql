-- ============================================================================
--  EL HISTORIAL DEL PRESUPUESTO: QUIEN LO CAMBIO, CUANDO Y DE CUANTO A CUANTO
-- ============================================================================
--
--  Ahora que el deposito se puede corregir hasta que se paga, hace falta poder ver que se
--  corrigio. La cuenta corriente ya guarda el movimiento de ajuste, pero eso vive en el extracto
--  de la tarjeta — y cuando alguien pregunta por que el presupuesto no es el que se habia dicho,
--  abre el TRAMITE, no el extracto.
--
--  ============================================================================
--   LO ESCRIBE UN TRIGGER, NO LA PANTALLA
--  ============================================================================
--
--  Si lo escribiera la pantalla, el dia que alguien cambie un presupuesto desde otro lado —una
--  correccion a mano, una importacion, un script— el historial diria que no paso nada.
--
--  Un historial con agujeros es PEOR que ninguno: se lo lee como completo. Es el mismo motivo
--  por el que el libro mayor lo escriben triggers y no la app.
--
--  Y es de SOLO INSERCION, como el libro mayor: sin update ni delete para nadie.
--
--  ============================================================================
--   POR QUE `antes` Y `despues` SON TEXTO
--  ============================================================================
--
--  Porque la misma tabla guarda dos cosas distintas: un importe de deposito y una linea de
--  concepto con su nombre. Un numeric no puede con las dos, y dos tablas separadas para algo que
--  siempre se lee junto es peor. El texto se arma en el trigger, ya formateado para leer.
--
--  ES ADITIVA: una tabla nueva y dos triggers. Ninguna fila existente se toca.

create table if not exists public.presupuesto_historial (
  id         bigserial primary key,
  tramite_id uuid not null references public.tramites(id) on delete cascade,
  que        text not null,
  antes      text,
  despues    text,
  quien      uuid references public.perfiles(id),
  cuando     timestamptz not null default now(),
  constraint presupuesto_historial_que_valido check (que in ('deposito','concepto'))
);

comment on table public.presupuesto_historial is
  'Cada cambio del presupuesto de un tramite. Lo escribe un trigger y no la pantalla: si lo '
  'escribiera la pantalla, un cambio hecho desde otro lado no quedaria registrado y el historial '
  'diria que no paso nada. Solo insercion.';

create index if not exists presupuesto_historial_tramite_idx
  on public.presupuesto_historial (tramite_id, cuando desc);

-- ------------------------------------------------------------
-- El deposito
-- ------------------------------------------------------------

create or replace function public.g_tramites_historial_presupuesto()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.deposito_solicitado is distinct from old.deposito_solicitado then
    insert into public.presupuesto_historial (tramite_id, que, antes, despues, quien)
    values (
      new.id, 'deposito',
      case when old.deposito_solicitado is null then null
           else to_char(old.deposito_solicitado, 'FM999999999990.00') end,
      case when new.deposito_solicitado is null then null
           else to_char(new.deposito_solicitado, 'FM999999999990.00') end,
      auth.uid());
  end if;
  return new;
end;
$$;

-- AFTER y no BEFORE: en un BEFORE INSERT la fila del tramite todavia no existe y la clave
-- foranea de esta tabla falla. Ya paso una vez en este proyecto, con el historial de estados,
-- y el sintoma fue que NINGUN tramite se podia crear.
drop trigger if exists g_tramites_historial_presupuesto on public.tramites;
create trigger g_tramites_historial_presupuesto
  after update of deposito_solicitado on public.tramites
  for each row execute function public.g_tramites_historial_presupuesto();

-- ------------------------------------------------------------
-- Los conceptos
-- ------------------------------------------------------------

create or replace function public.g_conceptos_historial_presupuesto()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_nombre text;
begin
  select nombre into v_nombre from public.conceptos where id = new.concepto_id;

  insert into public.presupuesto_historial (tramite_id, que, antes, despues, quien)
  values (
    new.tramite_id, 'concepto',
    case when tg_op = 'UPDATE'
         then coalesce(v_nombre, '?') || ' ' || to_char(old.importe, 'FM999999999990.00')
         else null end,
    coalesce(v_nombre, '?') || ' ' || to_char(new.importe, 'FM999999999990.00')
      || ' (' || new.momento || ')',
    auth.uid());
  return new;
end;
$$;

drop trigger if exists g_conceptos_historial_presupuesto on public.tramite_conceptos;
create trigger g_conceptos_historial_presupuesto
  after insert or update on public.tramite_conceptos
  for each row execute function public.g_conceptos_historial_presupuesto();

revoke execute on function public.g_tramites_historial_presupuesto()  from public, anon, authenticated;
revoke execute on function public.g_conceptos_historial_presupuesto() from public, anon, authenticated;

-- ------------------------------------------------------------
-- Los nombres de varias personas de una sola vez
--
--   Misma razon que `nombre_de`: la policy de `perfiles` deja leer solo la fila propia, asi que
--   sin esto una gestora veria los cambios de sus companieras sin nombre. Devuelve UNICAMENTE
--   id y nombre: ni el rol, ni el correo, ni la gestora.
-- ------------------------------------------------------------

create or replace function public.nombres_de(personas uuid[])
returns table (id uuid, nombre text)
language sql security definer stable set search_path = public as $$
  select p.id, p.nombre from public.perfiles p where p.id = any(personas);
$$;

revoke all on function public.nombres_de(uuid[]) from public, anon;
grant execute on function public.nombres_de(uuid[]) to authenticated;

-- ------------------------------------------------------------
-- RLS: lo ve quien ve el tramite. La insercion la hace el trigger.
-- ------------------------------------------------------------

alter table public.presupuesto_historial enable row level security;

drop policy if exists "presupuesto_historial_select" on public.presupuesto_historial;
create policy "presupuesto_historial_select" on public.presupuesto_historial for select to authenticated
  using (exists (select 1 from public.tramites x where x.id = presupuesto_historial.tramite_id));

-- Sin policy de insert: lo escribe el trigger, que es SECURITY DEFINER y no pasa por RLS.
-- Sin update ni delete para nadie, igual que el libro mayor.
revoke insert, update, delete, truncate on public.presupuesto_historial from anon, authenticated;

-- ============================================================================
--  COMO COMPROBAR QUE QUEDO BIEN
--
--  1) Cambiar un deposito y ver que aparece la fila:
--       update public.tramites set deposito_solicitado = 123456
--        where cliente_nombre = 'carolina';
--       select que, antes, despues from public.presupuesto_historial
--        where tramite_id = (select id from public.tramites where cliente_nombre = 'carolina');
--
--  2) Nadie puede editar ni borrar el historial. Las dos tienen que dar false:
--       select has_table_privilege('authenticated','public.presupuesto_historial','UPDATE') as u,
--              has_table_privilege('authenticated','public.presupuesto_historial','DELETE') as d;
--
--  3) `npm run permisos` en verde.
--
--  4) LA QUE IMPORTA, y se mira: corregir un deposito desde la pantalla y ver la linea nueva en
--     el historial de la ficha, con el nombre de quien lo cambio.
-- ============================================================================
