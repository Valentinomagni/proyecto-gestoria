-- ============================================================================
--  "NADA SE BORRA" DEJA DE SER UNA REGLA ESCRITA Y PASA A SER IMPOSIBLE
-- ============================================================================
--
--  COMO APARECIO ESTO. Al aplicar la migracion anterior se comprobaron los permisos de la vista
--  nueva —como pide la plantilla— y el resultado no fue el que decia el SQL escrito: la vista
--  tenia INSERT, UPDATE, DELETE y TRUNCATE para `authenticated`, a pesar de que la migracion
--  hacia `revoke all ... from public, anon` y despues `grant select ... to authenticated`.
--
--  El motivo: Supabase deja PERMISOS POR DEFECTO en el esquema `public` que le dan TODO a
--  `authenticated` sobre cada objeto nuevo. El `revoke` apuntaba a `anon`, no a `authenticated`,
--  y el `grant select` no agregaba nada porque ya tenia todo.
--
--  Al mirar el esquema entero aparecio que le pasaba a LAS VEINTIUN tablas y vistas.
--
--  ============================================================================
--   POR QUE NO ALCANZA CON DECIR "IGUAL LO FRENA LA RLS"
--  ============================================================================
--
--  Para DELETE es cierto: hay policies y sin policy de delete no se borra una fila. Aun asi
--  este proyecto ya decidio una vez que un solo cerrojo no alcanza —fue con `movimientos`, y
--  esta escrito en CLAUDE.md—. Dos cerrojos cuestan una linea y valen un incidente.
--
--  PARA `TRUNCATE` NO ES CIERTO, Y ESA ES LA PARTE SERIA: **truncate no pasa por row level
--  security**. No hay policy que lo detenga, porque las policies son por fila y truncate no
--  mira filas. Es el unico permiso de esta lista que hoy no tiene absolutamente nada debajo.
--
--  Hoy no es alcanzable desde la API —PostgREST no expone truncate— asi que esto no es un
--  agujero abierto: es el cerrojo que faltaba en la puerta que no tiene alarma.
--
--  ============================================================================
--   Y ADEMAS ES LA REGLA DEL PRODUCTO, HECHA IMPOSIBLE
--  ============================================================================
--
--  CLAUDE.md lo dice sin matices: "Nada se borra. Un tramite se anula con motivo; un movimiento
--  se compensa con un ajuste." Hasta hoy eso era una frase en un archivo que alguien tenia que
--  leer y respetar. Desde aca, el borrado NO ESTA DISPONIBLE: es la pregunta de diseño de este
--  proyecto —¿puede la base hacerlo imposible, en vez de que el front lo pida por favor?—
--  aplicada a la regla mas facil de romper sin querer.
--
--  LAS VISTAS ADEMAS QUEDAN DE SOLO LECTURA. Una vista simple en Postgres es actualizable: se
--  puede insertar y modificar A TRAVES de ella. Una vista es una forma de mirar, nunca una
--  puerta de entrada; si hace falta escribir, se escribe en la tabla.
--
--  ES ADITIVA EN EL SENTIDO QUE IMPORTA: no toca datos, no toca policies y no le saca a la app
--  nada de lo que usa. La app nunca borra: anula, compensa y desactiva.

-- ------------------------------------------------------------
-- 1) Los objetos que ya existen
-- ------------------------------------------------------------

do $$
declare obj record;
begin
  for obj in
    select c.relname, c.relkind
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind in ('r','v')
  loop
    -- Para todos: se van borrar y vaciar. Nunca hicieron falta.
    execute format('revoke delete, truncate on public.%I from anon, authenticated', obj.relname);

    -- Las vistas ademas dejan de ser escribibles. Mirar no es escribir.
    if obj.relkind = 'v' then
      execute format('revoke insert, update on public.%I from anon, authenticated', obj.relname);
    end if;
  end loop;
end $$;

-- ------------------------------------------------------------
-- 2) Los objetos que se creen mañana
--
--    Sin esto, la proxima tabla nace otra vez con todo, y el arreglo dura hasta la migracion
--    siguiente. Los permisos por defecto se guardan POR ROL QUE CREA, asi que se toca el rol
--    con el que corre el CLI.
-- ------------------------------------------------------------

alter default privileges in schema public
  revoke delete, truncate on tables from anon, authenticated;

alter default privileges for role postgres in schema public
  revoke delete, truncate on tables from anon, authenticated;

-- ============================================================================
--  COMO COMPROBAR QUE QUEDO BIEN
--
--  1) Que no quede NINGUN objeto con delete o truncate para anon/authenticated.
--     Tiene que devolver CERO filas:
--
--       select table_name, grantee, privilege_type
--         from information_schema.role_table_grants
--        where table_schema = 'public'
--          and grantee in ('anon','authenticated')
--          and privilege_type in ('DELETE','TRUNCATE')
--        order by table_name;
--
--  2) Que ninguna VISTA quede escribible. Tiene que devolver CERO filas:
--
--       select g.table_name, g.grantee, g.privilege_type
--         from information_schema.role_table_grants g
--         join pg_class c on c.relname = g.table_name
--         join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
--        where g.table_schema = 'public' and c.relkind = 'v'
--          and g.grantee in ('anon','authenticated')
--          and g.privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE');
--
--  3) Que la app siga funcionando, que es lo que esto NO tenia que romper: dar de alta un
--     tramite, avanzarlo hasta pagado y ver que el saldo se mueve. Si algo de la app borraba
--     una fila, aca deja de andar — y era un defecto, no una funcion.
--
--  LAS TRES SE CORREN SOLAS con `npm run permisos`, que ademas es la que va a avisar el dia que
--  una migracion futura vuelva a dejar la puerta abierta.
-- ============================================================================
