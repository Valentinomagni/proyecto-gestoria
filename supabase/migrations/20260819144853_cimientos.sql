-- ============================================================================
--  GESTORIA — MIGRACION 01: CIMIENTOS
--
--  Perfiles, roles y los helpers SECURITY DEFINER sobre los que se apoya toda la RLS del
--  proyecto. Es idempotente: correrla dos veces no falla ni cambia nada.
--
--  Se corre con `npm run db:push`, NUNCA pegando SQL a mano en el editor. En el Tablero
--  Contable hay 56 migraciones pegadas a mano, con una tabla de registro mantenida a mano y un
--  test guardian que existe porque esa lista se quedo vieja mientras se escribian nueve
--  migraciones mas, una de ellas de seguridad. Aca el registro lo lleva el CLI.
-- ============================================================================
--
--  POR QUE LOS HELPERS SON LO PRIMERO DE TODO
--
--  Toda policy de este esquema pregunta "quien sos". Si esa pregunta se hace con una subconsulta
--  a `perfiles` desde una policy DE `perfiles`, Postgres entra en recursion infinita (42P17) y
--  devuelve 500 en TODAS las tablas, no solo en esa. Ya paso en el Tablero
--  (migracion-14-FIX-URGENTE-recursion.sql): el login dejo de cargar y hubo que arreglarlo en
--  caliente.
--
--  Una funcion SECURITY DEFINER se ejecuta con los permisos de su duenio, y el duenio de una
--  tabla esta exento de RLS. Por eso `es_gerencia()` puede leer `perfiles` desde adentro de una
--  policy de `perfiles` sin volver a disparar la policy.
--
--  LAS TRES CONDICIONES QUE HACEN QUE UN HELPER SEA SEGURO, y las tres estan en cada uno:
--    security definer          -> corta la recursion
--    stable                    -> el planificador lo evalua una vez por consulta, no por fila
--    set search_path = public  -> impide que alguien secuestre la resolucion de nombres
--                                 creando un esquema propio antes en el search_path
-- ============================================================================

create extension if not exists pg_trgm with schema extensions;

-- ------------------------------------------------------------
-- 1) Perfiles
--
--    `rol` es text con check y no un enum de Postgres: un enum obliga a `alter type` para
--    agregar un valor y no se puede sacar nunca uno.
-- ------------------------------------------------------------

create table if not exists public.perfiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text        not null,
  nombre     text        not null,
  rol        text        not null default 'sin_asignar',
  activo     boolean     not null default false,
  gestora_id uuid,   -- la clave foranea se agrega en la migracion 02, cuando exista `gestoras`
  creado_at  timestamptz not null default now(),
  constraint perfiles_rol_valido
    check (rol in ('sin_asignar', 'gestora', 'contable', 'gerencia'))
);

create unique index if not exists perfiles_email_uniq on public.perfiles (lower(email));

comment on table public.perfiles is
  'Un usuario de la plataforma. La identidad la maneja Auth; esta tabla dice QUE PUEDE HACER.';

comment on column public.perfiles.rol is
  'sin_asignar | gestora | contable | gerencia. Arranca en sin_asignar A PROPOSITO: un usuario recien creado no ve NADA hasta que gerencia lo habilita. El default seguro es el que no da permisos.';

comment on column public.perfiles.activo is
  'Llave general del acceso. Los helpers de RLS exigen activo=true, asi que desactivar un perfil lo deja logueado y sin una sola fila visible. Se desactiva, NO se borra: los tramites historicos conservan quien los toco.';

comment on column public.perfiles.gestora_id is
  'A que gestora corresponde esta persona. Solo tiene sentido con rol=gestora. Es lo que ata el login con las filas de tramites que puede ver; sin esto una gestora veria cero tramites.';

-- ------------------------------------------------------------
-- 2) Alta automatica desde Auth
--
--    Sin este trigger, quien se registra queda sin fila en `perfiles` y la app le muestra una
--    pantalla vacia sin explicacion. Con el queda registrado y sin permisos, que es el estado
--    correcto para alguien a quien todavia nadie habilito.
-- ------------------------------------------------------------

create or replace function public.perfiles_alta_automatica()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfiles (id, email, nombre, rol, activo)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data->>'nombre', ''), split_part(new.email, '@', 1)),
    'sin_asignar',
    false
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists perfiles_alta_automatica on auth.users;
create trigger perfiles_alta_automatica
  after insert on auth.users
  for each row execute function public.perfiles_alta_automatica();

-- ------------------------------------------------------------
-- 3) Los helpers
--
--    `opero_esta_tarjeta()` NO esta aca: depende de `tarjetas_debito`, que se crea en la
--    migracion 02. Ponerlo antes haria fallar esta migracion.
-- ------------------------------------------------------------

create or replace function public.mi_rol()
returns text language sql security definer stable set search_path = public as $$
  select rol from public.perfiles where id = auth.uid() and activo;
$$;

create or replace function public.es_gerencia()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.perfiles
                  where id = auth.uid() and activo and rol = 'gerencia');
$$;

create or replace function public.es_contable()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.perfiles
                  where id = auth.uid() and activo and rol = 'contable');
$$;

create or replace function public.es_gestora()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.perfiles
                  where id = auth.uid() and activo and rol = 'gestora');
$$;

-- El nombre dice QUE PROTEGE, no quien es. Si maniana un cuarto rol tiene que ver los cobros,
-- se toca esta funcion y NO las policies que la usan.
create or replace function public.puede_ver_cobros()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.perfiles
                  where id = auth.uid() and activo and rol in ('gerencia','contable'));
$$;

create or replace function public.mi_gestora_id()
returns uuid language sql security definer stable set search_path = public as $$
  select gestora_id from public.perfiles
   where id = auth.uid() and activo and rol = 'gestora';
$$;

-- ------------------------------------------------------------
-- 4) Nadie se auto-promueve
--
--    La policy de update de `perfiles` deja editar la fila propia, para poder cambiarse el
--    nombre. Sin este trigger, eso alcanza para hacer, desde la consola del navegador:
--        update perfiles set rol = 'gerencia' where id = auth.uid();
--    Es exactamente el agujero de la migracion 39 del Tablero.
--
--    `auth.uid() is null` deja pasar al editor SQL, que es el unico lugar autorizado a designar
--    la primera gerencia. Sin esa salida, nadie podria habilitar a nadie: el huevo y la gallina.
--
--    Se define DESPUES de los helpers porque usa es_gerencia().
-- ------------------------------------------------------------

create or replace function public.perfiles_bloquear_campos_sensibles()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.es_gerencia() then
    if new.rol        is distinct from old.rol
    or new.activo     is distinct from old.activo
    or new.gestora_id is distinct from old.gestora_id
    or new.email      is distinct from old.email then
      raise exception 'regla_tramite: Solo gerencia puede cambiar el rol, el estado o la gestora de un usuario';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists perfiles_bloquear_campos_sensibles on public.perfiles;
create trigger perfiles_bloquear_campos_sensibles
  before update on public.perfiles
  for each row execute function public.perfiles_bloquear_campos_sensibles();

-- ------------------------------------------------------------
-- 5) Permisos de ejecucion
--
--    LA TRAMPA: en Postgres toda funcion nace con EXECUTE para PUBLIC, y `anon` HEREDA de
--    PUBLIC. Revocarle solo a `anon` NO LE SACA NADA. Esa linea le costo a la migracion 43 del
--    Tablero una proteccion que parecia existir y no existia.
--
--    Las funciones de trigger no son endpoints y no las ejecuta nadie a mano.
-- ------------------------------------------------------------

grant execute on function public.mi_rol()           to authenticated;
grant execute on function public.es_gerencia()      to authenticated;
grant execute on function public.es_contable()      to authenticated;
grant execute on function public.es_gestora()       to authenticated;
grant execute on function public.puede_ver_cobros() to authenticated;
grant execute on function public.mi_gestora_id()    to authenticated;

revoke execute on function public.perfiles_alta_automatica()           from public, anon, authenticated;
revoke execute on function public.perfiles_bloquear_campos_sensibles() from public, anon, authenticated;

-- ------------------------------------------------------------
-- 6) RLS de perfiles — ACA ESTA LA TRAMPA DE LA RECURSION
--
--    Ni una subconsulta a `perfiles` en estas policies. Todo pasa por los helpers.
-- ------------------------------------------------------------

alter table public.perfiles enable row level security;

drop policy if exists "perfiles_select" on public.perfiles;
create policy "perfiles_select" on public.perfiles for select
  using (
    id = auth.uid()          -- columna de la propia fila, sin subconsulta
    or public.es_gerencia()  -- helper SECURITY DEFINER
    or public.es_contable()
  );

drop policy if exists "perfiles_update_propio" on public.perfiles;
create policy "perfiles_update_propio" on public.perfiles for update
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "perfiles_update_gerencia" on public.perfiles;
create policy "perfiles_update_gerencia" on public.perfiles for update
  using (public.es_gerencia()) with check (public.es_gerencia());

-- Sin policy de insert ni de delete: las filas las crea el trigger sobre auth.users, que es
-- SECURITY DEFINER y no pasa por RLS. Y no se borran nunca: se desactivan.

-- ============================================================================
--  COMO COMPROBAR QUE QUEDO BIEN
--
--  1) No hay recursion. Esto tiene que devolver filas, no 42P17:
--       select id, email, rol, activo from public.perfiles limit 5;
--
--  2) Designar la primera gerencia. Se hace DESDE EL EDITOR SQL, que es el unico lugar donde
--     auth.uid() es null y el trigger anti-autopromocion deja pasar. Antes hay que crear el
--     usuario desde el panel (Authentication -> Add user, con Auto Confirm User tildado):
--       update public.perfiles set rol = 'gerencia', activo = true
--        where lower(email) = 'la-cuenta-real@ejemplo.com';
--
--  3) Un usuario no se puede promover. Logueado como contable, esto tiene que FALLAR:
--       update public.perfiles set rol = 'gerencia' where id = auth.uid();
--
--  4) Los helpers existen y son SECURITY DEFINER, stable y con search_path fijo:
--       select p.proname, p.prosecdef, p.provolatile, p.proconfig
--         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--        where n.nspname = 'public'
--          and p.proname in ('mi_rol','es_gerencia','es_contable','es_gestora',
--                            'puede_ver_cobros','mi_gestora_id');
--     Las seis con prosecdef = true, provolatile = 's', proconfig = {search_path=public}.
-- ============================================================================
