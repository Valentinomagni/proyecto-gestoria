-- ============================================================================
--  CONTABLE Y GERENCIA: LOS MISMOS PERMISOS, SIN EXCEPCIONES
-- ============================================================================
--
--  POR QUE. En la practica son la misma oficina. Hoy contable no entra a Administracion, asi
--  que no puede confirmar un plazo, cargar un feriado ni atender un aviso — y entonces la mitad
--  del sistema depende de que una sola persona este disponible.
--
--  SE HACE CON UN HELPER Y NO CAMBIANDO CADA POLICY A MANO. `es_oficina()` dice QUE PROTEGE, no
--  quien es. El dia que un cuarto rol tenga que administrar, se toca esta funcion y ninguna
--  policy. Es la misma razon por la que existe `puede_ver_cobros()`.
--
--  ============================================================================
--   LO QUE ESTA MIGRACION CIERRA, Y HOY ESTABA ABIERTO
--  ============================================================================
--
--  El guardian de campos sensibles decia "si no sos gerencia, no toques rol ni activo". O sea
--  que gerencia SI podia cambiarse el rol a si misma. Con contable adentro del mismo grupo eso
--  se vuelve mas facil de tocar sin querer.
--
--  Entonces se invierte la regla: **NADIE se cambia el rol a si mismo, ni gerencia**. Es mas
--  fuerte que lo que habia, y ademas mantiene verdadera la prueba de permisos que dice que
--  nadie se auto-promueve.
--
--  ES ADITIVA EN DATOS: no toca ninguna fila. Solo cambia quien puede tocarlas.

-- ------------------------------------------------------------
-- 1) El helper
-- ------------------------------------------------------------

create or replace function public.es_oficina()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.perfiles
                  where id = auth.uid() and activo and rol in ('gerencia','contable'));
$$;

comment on function public.es_oficina() is
  'Gerencia y contable son la misma oficina y tienen los mismos permisos. El nombre dice QUE '
  'protege y no quien es: el dia que un cuarto rol administre, se toca esta funcion y ninguna '
  'policy.';

revoke all on function public.es_oficina() from public, anon;
grant execute on function public.es_oficina() to authenticated;

-- ------------------------------------------------------------
-- 2) Nadie se cambia el rol a si mismo. Ni gerencia.
-- ------------------------------------------------------------

create or replace function public.perfiles_bloquear_campos_sensibles()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;   -- consola de la base

  -- LA REGLA NUEVA, y es mas fuerte que la anterior: la propia fila nunca cambia de rol.
  -- Antes solo estaba impedido para quien no era gerencia; ahora no lo puede hacer nadie.
  if new.id = auth.uid() and new.rol is distinct from old.rol then
    raise exception 'regla_tramite: Nadie puede cambiarse el rol a si mismo. Pediselo a otra persona de la oficina.';
  end if;

  if not public.es_oficina() then
    if new.rol        is distinct from old.rol
    or new.activo     is distinct from old.activo
    or new.gestora_id is distinct from old.gestora_id
    or new.email      is distinct from old.email then
      raise exception 'regla_tramite: Solo la oficina puede cambiar el rol, el estado o la gestora de un usuario';
    end if;
  end if;

  return new;
end;
$$;

-- ------------------------------------------------------------
-- 3) Todas las policies que decian es_gerencia() pasan a es_oficina()
--
--    Se enumeran una por una a proposito. Un `do $$` que las recorriera dejaria el cambio
--    invisible en el diff, y este es exactamente el tipo de cambio que hay que poder leer.
-- ------------------------------------------------------------

drop policy if exists "perfiles_select" on public.perfiles;
create policy "perfiles_select" on public.perfiles for select
  using (id = auth.uid() or public.es_oficina());

drop policy if exists "perfiles_update_gerencia" on public.perfiles;
create policy "perfiles_update_gerencia" on public.perfiles for update
  using (public.es_oficina()) with check (public.es_oficina());

drop policy if exists "encuestas_write" on public.encuestas_adopcion;
create policy "encuestas_write" on public.encuestas_adopcion for all to authenticated
  using (public.es_oficina()) with check (public.es_oficina());

drop policy if exists "feriados_write" on public.feriados;
create policy "feriados_write" on public.feriados for all to authenticated
  using (public.es_oficina()) with check (public.es_oficina());

drop policy if exists "plazos_write" on public.plazos;
create policy "plazos_write" on public.plazos for all to authenticated
  using (public.es_oficina()) with check (public.es_oficina());

drop policy if exists "avisos_update" on public.avisos;
create policy "avisos_update" on public.avisos for update to authenticated
  using (public.es_oficina()) with check (public.es_oficina());

drop policy if exists "avisos_select" on public.avisos;
create policy "avisos_select" on public.avisos for select to authenticated
  using (quien = auth.uid() or public.es_oficina());

-- Los catalogos: se escribieron con un bucle, asi que se rehacen con el mismo bucle.
do $$
declare t text;
begin
  foreach t in array array['razones_sociales','sucursales','gestoras','conceptos',
                           'tarjetas_habitualista','tarjetas_debito','requisitos','parametros']
  loop
    execute format('drop policy if exists "%s_write" on public.%I', t, t);
    execute format('create policy "%s_write" on public.%I for all to authenticated using (public.es_oficina()) with check (public.es_oficina())', t, t);
  end loop;
end $$;

-- ============================================================================
--  COMO COMPROBAR QUE QUEDO BIEN
--
--  1) No queda ninguna policy colgada de es_gerencia(). Tiene que dar CERO filas:
--       select tablename, policyname from pg_policies
--        where schemaname = 'public'
--          and (qual like '%es_gerencia%' or with_check like '%es_gerencia%');
--
--  2) El helper es SECURITY DEFINER, stable y con search_path fijo:
--       select prosecdef, provolatile, proconfig from pg_proc p
--         join pg_namespace n on n.oid = p.pronamespace
--        where n.nspname = 'public' and p.proname = 'es_oficina';
--     Esperado: t, s, {search_path=public}
--
--  3) LA QUE IMPORTA, contra la API real y con usuarios reales: `npm run test:rls`. Ahi esta
--     la prueba de que nadie se cambia el rol a si mismo, que ahora tambien corre para gerencia.
-- ============================================================================
