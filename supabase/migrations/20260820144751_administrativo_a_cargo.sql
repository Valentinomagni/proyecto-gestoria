-- ============================================================================
--  EL ADMINISTRATIVO A CARGO
-- ============================================================================
--
--  Quien de administracion se hizo cargo de este tramite. Es un dato de interes: sirve para
--  saber a quien preguntarle cuando algo del legajo no cierra, que hoy se resuelve preguntando
--  en voz alta hasta que alguien contesta.
--
--  ES UN TEXTO LIBRE, y fue una decision explicita y no una simplificacion: la lista de quienes
--  pueden quedar a cargo todavia no esta cerrada, y un catalogo obligaria a darla de alta antes
--  de poder cargar el primer tramite. El dia que se estabilice, pasarlo a catalogo es una
--  migracion chica.
--
--  LO QUE SE PIERDE POR SER TEXTO LIBRE, dicho de frente: no se va a poder filtrar bien, porque
--  el mismo nombre va a entrar escrito de tres formas. Se compensa en la pantalla con una lista
--  de sugerencias armada con lo ya cargado, que empuja a repetir la forma en vez de inventarla.
--  Es lo unico que se puede hacer contra eso, y no lo resuelve del todo.
--
--  ES ADITIVA: una columna nulable y nada mas.

alter table public.tramites
  add column if not exists administrativo text;

comment on column public.tramites.administrativo is
  'Quien de administracion quedo a cargo. Texto libre a proposito: la lista de personas todavia '
  'no esta cerrada y un catalogo obligaria a darla de alta antes del primer tramite.';

-- ============================================================================
--  NO SE AGREGA A LOS CAMPOS QUE PUEDE TOCAR UNA GESTORA, Y ES A PROPOSITO
--
--  El trigger `b_tramites_bloquear_campos` compara por DIFERENCIA de jsonb contra una lista de
--  permitidos. Al no sumar `administrativo` a esa lista, la columna nace protegida: una gestora
--  no puede asignar ni cambiar el administrativo a cargo.
--
--  Esa es exactamente la razon por la que ese trigger compara por diferencia en vez de enumerar
--  lo prohibido: la version enumerada falla ABIERTA, y en silencio.
-- ============================================================================

-- ============================================================================
--  COMO COMPROBAR QUE QUEDO BIEN
--
--  1) La columna existe y es nulable:
--       select column_name, is_nullable, data_type from information_schema.columns
--        where table_schema='public' and table_name='tramites' and column_name='administrativo';
--     Esperado: una fila, YES, text.
--
--  2) Que NO este en la lista de permitidos del trigger (tiene que dar false):
--       select prosrc like '%administrativo%' from pg_proc p
--         join pg_namespace n on n.oid = p.pronamespace
--        where n.nspname='public' and p.proname='b_tramites_bloquear_campos';
--
--  3) LA QUE IMPORTA, y se mira: entrar como gestora, abrir un tramite suyo, y comprobar que el
--     campo no se puede editar desde ahi.
-- ============================================================================
