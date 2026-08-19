-- ============================================================================
--  LAS NOTAS, CON EL NOMBRE DE QUIEN LAS ESCRIBIO
-- ============================================================================
--
--  EL PROBLEMA. `tramite_notas` guarda el `autor` como uuid, y para mostrarlo hay que leer
--  `perfiles`. Pero la policy de `perfiles` deja que una gestora lea SOLO SU PROPIA FILA —y
--  está bien que así sea: ahí viven el rol, el correo y a qué gestora pertenece cada quien—.
--  Resultado: la gestora veía las notas de sus compañeras SIN NOMBRE.
--
--  Una nota anónima no sirve para lo que estas notas existen. El objetivo pide
--  "intercomunicación": hoy alguien explica algo por WhatsApp y esa explicación no queda en
--  ningún lado. Si queda pero sin saber quién la escribió, no se puede repreguntar, y una
--  aclaración a la que no se le puede repreguntar vale la mitad.
--
--  LA SOLUCION, con el patrón que este proyecto ya usa y sin aflojar nada:
--
--    1. `nombre_de(uuid)` es SECURITY DEFINER, así que puede leer `perfiles` — y devuelve
--       EXACTAMENTE UNA COSA, el nombre. No el rol, no el correo, no la gestora. La superficie
--       que se abre es del tamaño del dato que hace falta y ni un byte más.
--
--    2. La vista lleva `security_invoker = true`, así que la RLS de `tramite_notas` sigue
--       decidiendo QUE notas se ven. Sin eso, la vista correría como su dueño y saltearía la
--       RLS entera, que es la trampa que CLAUDE.md marca para toda vista.
--
--  O sea: la vista NO amplía quién ve qué notas. Solo le pone nombre a las que ya se veían.
--
--  ES ADITIVA. No toca ninguna tabla, ninguna policy existente ni ningún dato.

-- ------------------------------------------------------------
-- 1) El nombre de una persona, y nada más que el nombre
-- ------------------------------------------------------------

create or replace function public.nombre_de(persona uuid)
returns text language sql security definer stable set search_path = public as $$
  select nombre from public.perfiles where id = persona;
$$;

comment on function public.nombre_de(uuid) is
  'El nombre visible de una persona. SECURITY DEFINER porque la policy de perfiles deja leer '
  'solo la fila propia, y una nota sin autor no sirve para repreguntar. Devuelve UNICAMENTE el '
  'nombre: el rol, el correo y la gestora siguen sin salir de perfiles.';

-- La ejecuta cualquiera que entro; anon no.
revoke all on function public.nombre_de(uuid) from public, anon;
grant execute on function public.nombre_de(uuid) to authenticated;

-- ------------------------------------------------------------
-- 2) La vista de notas con autor
-- ------------------------------------------------------------

create or replace view public.v_tramite_notas
with (security_invoker = true) as
  select
    n.id,
    n.tramite_id,
    n.texto,
    n.creado_at,
    n.autor,
    public.nombre_de(n.autor) as autor_nombre
  from public.tramite_notas n;

comment on view public.v_tramite_notas is
  'Las notas de un tramite con el nombre de quien las escribio. security_invoker = true: la RLS '
  'de tramite_notas sigue decidiendo cuales se ven, esta vista solo agrega el nombre.';

revoke all on public.v_tramite_notas from public, anon;
grant select on public.v_tramite_notas to authenticated;

-- ============================================================================
--  COMO COMPROBAR QUE QUEDO BIEN
--
--  1) La vista existe y es security_invoker (tiene que decir 'true'):
--       select c.relname,
--              (select option_value from pg_options_to_table(c.reloptions)
--                where option_name = 'security_invoker') as invoker
--         from pg_class c
--         join pg_namespace n on n.oid = c.relnamespace
--        where n.nspname = 'public' and c.relname = 'v_tramite_notas';
--
--  2) La funcion es SECURITY DEFINER, stable y con search_path fijo:
--       select p.prosecdef, p.provolatile, p.proconfig
--         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--        where n.nspname = 'public' and p.proname = 'nombre_de';
--     Esperado: prosecdef = t, provolatile = s, proconfig = {search_path=public}
--
--  3) LA QUE IMPORTA, y NO se comprueba con SQL de administrador sino con la API real:
--     entrar como gestora, abrir un tramite con una nota escrita por gerencia y ver que el
--     nombre APARECE; y entrar como gestora de la otra sucursal y ver que la nota NO aparece.
--     Lo primero es lo que esta migracion vino a arreglar; lo segundo es lo que NO tenia que
--     romper.
-- ============================================================================
