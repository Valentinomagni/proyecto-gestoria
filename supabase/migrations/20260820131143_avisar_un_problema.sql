-- ============================================================================
--  ANDON: EL BOTON DE PARAR LA LINEA
-- ============================================================================
--
--  En Toyota el andon es la cuerda que cualquiera puede tirar cuando ve un defecto, y lo que la
--  hace funcionar no es la cuerda: es que tirarla NO tenga costo para quien la tira.
--
--  ============================================================================
--   QUIEN APRIETA ESTE BOTON NO TIENE QUE SABER EXPLICAR NADA
--  ============================================================================
--
--  Es la regla de diseño de esta tabla. Una gestora parada en el registro, con el legajo en una
--  mano y el telefono en la otra, no va a redactar un informe. Va a escribir "no me deja
--  guardar" o directamente nada, y eso TIENE QUE ALCANZAR.
--
--  Por eso `texto` puede quedar vacio: el aviso vale igual. Lo que hace falta para encontrar el
--  problema no lo escribe la persona, lo adjunta la app sola —en que pantalla estaba, con que
--  rol, en que tramite, que navegador, si habia internet—. Exigir una descripcion es como se
--  consigue que nadie avise.
--
--  ============================================================================
--   Y NO SE MIDE A NADIE CON ESTO
--  ============================================================================
--
--  Queda registrado QUIEN aviso, y para una sola cosa: para poder volver a preguntarle. No para
--  contar avisos por persona. Un tablero de "quien avisa mas problemas" convierte el andon en
--  algo que conviene no tocar, y ahi se apaga — que es exactamente el modo de falla que este
--  proyecto tiene escrito como el mas probable.
--
--  ============================================================================
--   LO QUE ESTA TABLA NO GUARDA
--  ============================================================================
--
--  Ningun dato de un cliente. El contexto que adjunta la app es TECNICO: pantalla, rol, id del
--  tramite, navegador. Nunca el nombre del cliente, ni el dominio, ni un importe. El id alcanza
--  para que quien lo mire abra el tramite; el resto seria copiar datos personales a una tabla
--  que despues alguien exporta sin pensarlo.
--
--  ES ADITIVA: una tabla nueva y nada mas.

create table if not exists public.avisos (
  id          bigserial primary key,
  texto       text,
  contexto    jsonb not null default '{}'::jsonb,
  quien       uuid references public.perfiles(id),
  creado_at   timestamptz not null default now(),
  -- Lo que sigue lo escribe quien ATIENDE el aviso, no quien lo manda.
  atendido_at timestamptz,
  atendido_por uuid references public.perfiles(id),
  resolucion  text,
  -- Atendido a medias no existe, igual que en `plazos`: o esta la fecha y quien lo atendio, o
  -- no esta ninguno de los dos.
  constraint avisos_atencion_completa check (
    (atendido_at is null and atendido_por is null)
    or (atendido_at is not null and atendido_por is not null)
  )
);

comment on table public.avisos is
  'El boton de avisar un problema. `texto` PUEDE quedar vacio a proposito: quien aprieta no '
  'tiene que saber explicar nada, y exigir una descripcion es como se consigue que nadie avise. '
  'El contexto tecnico lo adjunta la app sola.';

comment on column public.avisos.contexto is
  'Contexto TECNICO y nada mas: pantalla, rol, id de tramite, navegador, si habia internet. '
  'NUNCA nombre de cliente, dominio ni importe. El id del tramite alcanza para abrirlo.';

comment on column public.avisos.quien is
  'Para poder volver a preguntarle, y para nada mas. NO se cuentan avisos por persona: un '
  'tablero de quien avisa mas convierte el andon en algo que conviene no tocar.';

create index if not exists avisos_sin_atender_idx
  on public.avisos (creado_at desc) where atendido_at is null;

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------

alter table public.avisos enable row level security;

-- CUALQUIERA QUE ENTRO PUEDE AVISAR. Es el punto entero del andon: si avisar dependiera de
-- tener cierto rol, la persona que ve el problema —que casi siempre es la que menos permisos
-- tiene— no podria tirar de la cuerda.
drop policy if exists "avisos_insert" on public.avisos;
create policy "avisos_insert" on public.avisos for insert to authenticated
  with check (quien = auth.uid());

-- Cada uno ve LOS SUYOS, para saber que llego. Gerencia y contable ven todos, porque son
-- quienes los atienden.
drop policy if exists "avisos_select" on public.avisos;
create policy "avisos_select" on public.avisos for select to authenticated
  using (quien = auth.uid() or public.es_gerencia() or public.es_contable());

-- Marcar uno como atendido lo hace quien lo atiende.
drop policy if exists "avisos_update" on public.avisos;
create policy "avisos_update" on public.avisos for update to authenticated
  using (public.es_gerencia() or public.es_contable())
  with check (public.es_gerencia() or public.es_contable());

revoke delete, truncate on public.avisos from anon, authenticated;

-- ============================================================================
--  COMO COMPROBAR QUE QUEDO BIEN
--
--  1) Un aviso SIN texto se puede guardar, que es el punto de toda la tabla:
--       insert into public.avisos (texto, contexto) values (null, '{"pantalla":"tarjeta"}');
--     (desde la consola; desde la API hace falta `quien = auth.uid()`)
--
--  2) No se puede marcar atendido a medias. Las dos tienen que FALLAR:
--       update public.avisos set atendido_at = now() where id = 1;
--       update public.avisos set atendido_por = '...' where id = 1;
--
--  3) Nadie puede borrar un aviso:
--       select has_table_privilege('authenticated','public.avisos','DELETE');  -- false
--
--  4) LA QUE IMPORTA, y se mira: entrar como GESTORA —el rol con menos permisos— y comprobar
--     que el boton de avisar existe y que el aviso se guarda. Si el andon no funciona para
--     quien menos permisos tiene, no funciona.
-- ============================================================================
