-- ============================================================================
--  GESTORIA — el libro mayor, de solo insercion tambien a nivel de PERMISO
--
--  QUE ENCONTRE, y lo encontre corriendo la comprobacion que la migracion anterior traia
--  escrita adentro:
--
--      select has_table_privilege('authenticated','public.movimientos','UPDATE');  -- true
--      select has_table_privilege('authenticated','public.movimientos','DELETE');  -- true
--
--  Supabase otorga todos los permisos de tabla a `anon` y `authenticated` por defecto. Hoy la
--  RLS lo bloquea igual —no hay policy de update ni de delete, y sin policy se deniega—, asi que
--  el libro mayor NO estaba expuesto.
--
--  PERO ERA UN SOLO CANDADO SOBRE LA TABLA MAS CRITICA DEL SISTEMA. El dia que alguien corra
--  `alter table movimientos disable row level security` siguiendo un consejo generico, el
--  permiso ya esta dado y el libro mayor se vuelve editable sin que nadie lo note.
--
--  Con el revoke son dos mecanismos independientes: hay que romper los DOS para que el saldo de
--  ayer deje de ser reconstruible. Es la diferencia entre improbable e imposible.
--
--  Y ES BARATO: el trigger que inserta las reservas es SECURITY DEFINER, corre como el duenio
--  de la tabla, y el duenio no pasa por estos grants. Sigue funcionando igual.
-- ============================================================================

revoke update, delete, truncate on public.movimientos from anon, authenticated;

-- Mismo criterio para el historial de estados: lo escribe un trigger y no se corrige nunca.
-- Un historial editable no es un historial.
revoke update, delete, truncate on public.tramite_eventos from anon, authenticated;

-- Y para las notas: se escriben, no se editan ni se borran, como todo en este proyecto.
revoke update, delete, truncate on public.tramite_notas from anon, authenticated;

-- `anon` no tiene por que escribir NADA en el dominio. La RLS ya lo frena, pero el permiso
-- tampoco tiene motivo para existir.
revoke insert, update, delete, truncate on public.movimientos      from anon;
revoke insert, update, delete, truncate on public.tramites         from anon;
revoke insert, update, delete, truncate on public.tramite_conceptos from anon;
revoke insert, update, delete, truncate on public.cobros           from anon;

-- ============================================================================
--  COMO COMPROBAR QUE QUEDO BIEN
--
--    select has_table_privilege('authenticated','public.movimientos','UPDATE') u,
--           has_table_privilege('authenticated','public.movimientos','DELETE') d,
--           has_table_privilege('authenticated','public.movimientos','INSERT') i;
--
--  u y d en FALSE, i en true: se inserta y nunca se edita.
--
--  Y despues, la prueba que de verdad importa: cargar un presupuesto desde la app y ver que el
--  saldo se mueve. Si el revoke hubiera roto el trigger, el sintoma seria que la pantalla dice
--  que guardo y el saldo no cambia.
-- ============================================================================
