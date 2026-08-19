-- ============================================================================
--  GESTORIA — CATALOGOS
--
--  Razones sociales, tarjetas habitualista, sucursales, gestoras, tarjetas de debito,
--  conceptos de costo y requisitos del legajo.
--
--  LA REGLA QUE ORDENA ESTE ARCHIVO, y es un pedido explicito del duenio del proyecto:
--  NINGUN NUMERO DE EMPRESAS, TARJETAS NI CONCEPTOS ESCRITO EN EL CODIGO. Todo es una fila que
--  gerencia puede agregar desde la pantalla. Agregar la sexta razon social es cargar una fila,
--  no correr una migracion.
-- ============================================================================

-- ------------------------------------------------------------
-- 1) Tarjetas Habitualista
--
--    Cada una es una cuenta corriente. El saldo NO vive aca: se suma del libro de movimientos.
--    Un campo `saldo` mutable con dos escritores es exactamente el objeto que se pisa, y el
--    pison de saldos entre San Luis y San Juan es el problema que este proyecto viene a
--    resolver.
-- ------------------------------------------------------------

create table if not exists public.tarjetas_habitualista (
  id     uuid primary key default gen_random_uuid(),
  nombre text    not null unique,
  activa boolean not null default true,
  orden  int     not null default 100
);

comment on table public.tarjetas_habitualista is
  'Cada Tarjeta Habitualista es una cuenta corriente. El saldo NO vive aca: se suma de movimientos.';

comment on column public.tarjetas_habitualista.nombre is
  'Como figura en el sitio del habitualista, columna Habitualista: "Paris Autos SA". Se guarda igual para que la conciliacion pueda emparejar por texto al pegar el listado de Operaciones de Pago.';

-- ------------------------------------------------------------
-- 2) Razones sociales
--
--    El pedido nombra tres tarjetas entre parentesis y la planilla real muestra CINCO hojas:
--    PARIS AUTOS, DORAL CHEVROLET, PARIS CARS, PARIS MOTOR, PARIS TRAC. El duenio del proyecto
--    confirmo que son cinco. La relacion con la tarjeta es EDITABLE: si una razon social pasa a
--    pagar con la tarjeta de otra, es un clic y no una migracion.
-- ------------------------------------------------------------

create table if not exists public.razones_sociales (
  id         uuid primary key default gen_random_uuid(),
  nombre     text    not null unique,
  cuit       text,
  tarjeta_id uuid    references public.tarjetas_habitualista(id),
  activa     boolean not null default true,
  orden      int     not null default 100
);

comment on column public.razones_sociales.tarjeta_id is
  'Con que Tarjeta Habitualista paga esta razon social. NULL = todavia no definido: el sistema bloquea presentar un tramite suyo con medio de pago tarjeta_habitualista. Un null que frena es mejor que un default que le factura a la tarjeta equivocada.';

-- ------------------------------------------------------------
-- 3) Sucursales
--
--    ES METADATO, NO ES UN PERMISO. Ninguna policy de RLS mira la sucursal, y eso es
--    deliberado: cortar la visibilidad por sucursal seria reconstruir en la base el problema
--    que el proyecto viene a resolver, que es justamente que no hay un listado unificado.
-- ------------------------------------------------------------

create table if not exists public.sucursales (
  id             uuid primary key default gen_random_uuid(),
  nombre         text    not null unique,
  gestionada_por text    not null,
  activa         boolean not null default true,
  constraint sucursales_gestionada_por_valido check (gestionada_por in ('contable','gerencia'))
);

comment on column public.sucursales.gestionada_por is
  'Quien lleva los tramites de esta sucursal: San Luis lo maneja contable, San Juan lo maneja gerencia. ES METADATO Y NO UN PERMISO: ninguna policy mira la sucursal.';

-- ------------------------------------------------------------
-- 4) Gestoras
--
--    Tabla aparte de `perfiles` A PROPOSITO: la planilla ya nombra gestoras (columna GESTOR:
--    CARLA, MARIANA) y hay que poder asignarle un tramite a alguien que todavia no tiene
--    usuario en la plataforma. Si la gestora fuera solo un perfil, habria que crear una cuenta
--    de Auth para poder registrar una asignacion, que es poner el carro adelante del caballo.
-- ------------------------------------------------------------

create table if not exists public.gestoras (
  id        uuid primary key default gen_random_uuid(),
  nombre    text    not null unique,
  perfil_id uuid    references public.perfiles(id),
  activa    boolean not null default true
);

comment on column public.gestoras.perfil_id is
  'El login de esta gestora, si lo tiene. Nullable: la asignacion de un tramite no depende de que exista el usuario.';

-- La clave foranea que quedo pendiente en la migracion de cimientos, ahora que gestoras existe.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'perfiles_gestora_fk') then
    alter table public.perfiles add constraint perfiles_gestora_fk
      foreign key (gestora_id) references public.gestoras(id);
  end if;
end $$;

-- ------------------------------------------------------------
-- 5) Tarjetas de debito
--
--    Cada gestora maneja la suya y con ella paga en el registro. Una Habitualista tiene varias:
--    la pantalla de inicio del sitio muestra "Tarjeta Habiente: 4" sobre una sola cuenta.
-- ------------------------------------------------------------

create table if not exists public.tarjetas_debito (
  id                      uuid primary key default gen_random_uuid(),
  tarjeta_habitualista_id uuid    not null references public.tarjetas_habitualista(id),
  gestora_id              uuid    not null references public.gestoras(id),
  alias                   text,
  ultimos4                text,
  activa                  boolean not null default true,
  constraint tarjetas_debito_ultimos4_formato
    check (ultimos4 is null or ultimos4 ~ '^[0-9]{4}$')
);

create unique index if not exists tarjetas_debito_unica
  on public.tarjetas_debito (tarjeta_habitualista_id, gestora_id) where activa;

comment on column public.tarjetas_debito.ultimos4 is
  'Ultimos cuatro digitos, para reconocer quien pago en la conciliacion. NUNCA el numero completo: este sistema no necesita poder pagar, solo poder reconocer.';

-- ------------------------------------------------------------
-- 6) Conceptos de costo
--
--    POR QUE ES CATALOGO Y NO TRES COLUMNAS FIJAS: el pedido dice "diferenciando
--    arancel-prenda-sellados", pero el cuaderno de la gestora usa OTRO vocabulario entero
--    —PRESUPUESTO, PREVIO, 2do—. Dos listas distintas para la misma cosa significa que la lista
--    NO ESTA CERRADA. Con columnas fijas, el dia que aparezca "verificacion policial" hace falta
--    una migracion y tocar cinco pantallas. Con catalogo es cargar una fila.
-- ------------------------------------------------------------

create table if not exists public.conceptos (
  id     uuid primary key default gen_random_uuid(),
  nombre text    not null unique,
  activo boolean not null default true,
  orden  int     not null default 100
);

comment on table public.conceptos is
  'Los rubros en que se descompone el costo de un tramite. Es catalogo y no columnas porque la lista no esta cerrada: el pedido nombra tres y el cuaderno usa otros tres distintos.';

-- ------------------------------------------------------------
-- 7) Requisitos del legajo
--
--    El checklist que hace contable antes de pasar el tramite a gestoria. Mismo patron que
--    conceptos, y por el mismo motivo.
-- ------------------------------------------------------------

create table if not exists public.requisitos (
  id       uuid primary key default gen_random_uuid(),
  nombre   text    not null,
  aplica_a text    not null,
  activo   boolean not null default true,
  orden    int     not null default 100,
  unique (nombre, aplica_a)
);

comment on column public.requisitos.aplica_a is
  'Un tipo de tramite, o "todos". El pedido dice que administracion manda "el legajo completo del cliente (formularios)", y hoy que este completo lo garantiza la costumbre.';

-- ------------------------------------------------------------
-- 8) Parametros
--
--    Valores de operacion que NO van escritos en el codigo. Hoy: la hora de corte de depositos.
--
--    POR QUE: el duenio del proyecto conto que el deposito se ordena hasta las 16:00 y acredita
--    al dia siguiente. Un banco cambia un horario de corte sin avisarle a nadie, y un `16`
--    escrito en el codigo convierte ese cambio en un error silencioso que hace perder un dia por
--    vez hasta que alguien lo note.
-- ------------------------------------------------------------

create table if not exists public.parametros (
  clave          text primary key,
  valor          text not null,
  descripcion    text not null,
  verificado_el  date,
  verificado_por text
);

-- ------------------------------------------------------------
-- SEMILLAS. Todas idempotentes.
-- ------------------------------------------------------------

insert into public.tarjetas_habitualista (nombre, orden) values
  ('Paris Autos SA', 10), ('Doral Chevrolet', 20), ('Paris Cars', 30),
  ('Paris Motor', 40), ('Paris Trac', 50)
on conflict (nombre) do nothing;

insert into public.razones_sociales (nombre, orden) values
  ('PARIS AUTOS', 10), ('DORAL CHEVROLET', 20), ('PARIS CARS', 30),
  ('PARIS MOTOR', 40), ('PARIS TRAC', 50)
on conflict (nombre) do nothing;

-- Vinculo inicial uno a uno, que es lo que dice la regla del pedido: "cada razon social del
-- grupo tiene su propia Tarjeta Habitualista". Editable desde Administracion.
update public.razones_sociales r set tarjeta_id = t.id
  from public.tarjetas_habitualista t
 where r.tarjeta_id is null and (
       (r.nombre = 'PARIS AUTOS'     and t.nombre = 'Paris Autos SA')
    or (r.nombre = 'DORAL CHEVROLET' and t.nombre = 'Doral Chevrolet')
    or (r.nombre = 'PARIS CARS'      and t.nombre = 'Paris Cars')
    or (r.nombre = 'PARIS MOTOR'     and t.nombre = 'Paris Motor')
    or (r.nombre = 'PARIS TRAC'      and t.nombre = 'Paris Trac'));

insert into public.sucursales (nombre, gestionada_por) values
  ('San Luis', 'contable'), ('San Juan', 'gerencia')
on conflict (nombre) do nothing;

-- Las dos que nombra la planilla en la columna GESTOR.
insert into public.gestoras (nombre) values ('Carla'), ('Mariana')
on conflict (nombre) do nothing;

insert into public.conceptos (nombre, orden) values
  ('Arancel', 10), ('Prenda', 20), ('Sellados', 30)
on conflict (nombre) do nothing;

-- Semilla MINIMA y provisoria del checklist. Salio de docs/DOMINIO.md y de fuentes
-- secundarias, NO de la contable. Es un punto de partida para que la pantalla no arranque
-- vacia; la lista real se termina de cargar desde Administracion en una conversacion de diez
-- minutos. Ningun requisito de aca se da por bueno sin que alguien de la casa lo confirme.
insert into public.requisitos (nombre, aplica_a, orden) values
  ('Formulario 08 con firmas certificadas', 'transferencia_a_cliente', 10),
  ('Formulario 08 con firmas certificadas', 'transferencia_al_concesionario', 10),
  ('Verificacion policial vigente', 'transferencia_a_cliente', 20),
  ('Verificacion policial vigente', 'transferencia_al_concesionario', 20),
  ('Libre deuda de patentes', 'transferencia_a_cliente', 30),
  ('Informe de dominio', 'transferencia_a_cliente', 40),
  ('Factura de la unidad', 'patentamiento_0km', 10),
  ('Formulario 01', 'patentamiento_0km', 20),
  ('DNI del titular', 'todos', 50),
  ('Constancia de CUIT', 'todos', 60)
on conflict (nombre, aplica_a) do nothing;

insert into public.parametros (clave, valor, descripcion) values
  ('corte_deposito_hora', '16:00',
   'Hasta que hora se puede ordenar un deposito para que acredite al dia siguiente. Pasada esa hora, acredita al subsiguiente.'),
  ('corte_deposito_dias_habiles', '1',
   'Cuantos dias habiles tarda en acreditar un deposito ordenado antes de la hora de corte.')
on conflict (clave) do nothing;

-- ------------------------------------------------------------
-- El helper que faltaba en cimientos, ahora que tarjetas_debito existe.
--
-- Una gestora ve el saldo de las tarjetas donde tiene tarjeta de debito, y de ninguna otra.
-- Ve el saldo porque lo necesita para decidir si presenta: el pedido dice que solo gerencia y
-- contable pueden MODIFICAR saldos, no verlos.
-- ------------------------------------------------------------

create or replace function public.opero_esta_tarjeta(p_tarjeta uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.tarjetas_debito td
     where td.tarjeta_habitualista_id = p_tarjeta
       and td.activa
       and td.gestora_id = public.mi_gestora_id()
  );
$$;

grant execute on function public.opero_esta_tarjeta(uuid) to authenticated;

-- ------------------------------------------------------------
-- RLS de catalogos: TODOS LEEN, SOLO GERENCIA ESCRIBE.
--
--   Leen todos porque son los nombres de cada selector: una gestora que no puede leer
--   razones_sociales ve un desplegable vacio y no sabe por que.
--
--   Escribe gerencia porque tocar una razon social o una tarjeta cambia a donde va la plata de
--   todos los tramites futuros. No es una tarea de carga diaria.
-- ------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array[
    'tarjetas_habitualista','razones_sociales','sucursales','gestoras',
    'tarjetas_debito','conceptos','requisitos','parametros'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%s_select" on public.%I', t, t);
    execute format('create policy "%s_select" on public.%I for select to authenticated using (true)', t, t);
    execute format('drop policy if exists "%s_write" on public.%I', t, t);
    execute format('create policy "%s_write" on public.%I for all to authenticated using (public.es_gerencia()) with check (public.es_gerencia())', t, t);
  end loop;
end $$;

-- ============================================================================
--  COMO COMPROBAR QUE QUEDO BIEN
--
--  1) Las cinco razones sociales, cada una con su tarjeta:
--       select r.nombre, t.nombre as tarjeta
--         from public.razones_sociales r
--         left join public.tarjetas_habitualista t on t.id = r.tarjeta_id
--        order by r.orden;
--     Ninguna con tarjeta en null.
--
--  2) Los catalogos tienen filas:
--       select 'conceptos', count(*) from public.conceptos
--       union all select 'requisitos', count(*) from public.requisitos
--       union all select 'gestoras', count(*) from public.gestoras
--       union all select 'sucursales', count(*) from public.sucursales;
--
--  3) La hora de corte esta y NO esta en el codigo:
--       select clave, valor from public.parametros;
--
--  4) Con un JWT de gestora: el select de razones_sociales devuelve filas, y un insert falla.
--     Lo cubre el arnes de permisos.
-- ============================================================================
