-- ============================================================================
--  QUE LOS CAMBIOS LLEGUEN SOLOS, SIN RECARGAR
-- ============================================================================
--
--  ============================================================================
--   ESTA MIGRACION ARREGLA ALGO QUE SE DABA POR HECHO Y NUNCA FUNCIONO
--  ============================================================================
--
--  La app ya se suscribia a `movimientos` y `tramites` para que el saldo se actualice solo
--  cuando otra persona carga un movimiento. Eso esta descrito en el codigo como "la funcion
--  central del producto": sin eso, dos personas miran el mismo numero viejo y comprometen la
--  misma plata.
--
--  Al ir a agregar `tramite_eventos` a la publicacion se comprobo lo que hay:
--
--      select tablename from pg_publication_tables where pubname = 'supabase_realtime';
--      -> VACIO
--
--  O sea que **nunca llego nada**. El front se suscribia, no daba error, y simplemente no
--  pasaba nada. Es la peor forma de fallar que tiene Realtime: en silencio, sin sintoma, y con
--  una pantalla que parece andar porque igual se refresca cuando la pestania vuelve al foco.
--
--  Se dio por funcionando porque se vio el saldo cambiar — pero cambiaba por el refresco de
--  TanStack Query al volver el foco, no por Realtime. Comprobar la cosa PARECIDA es exactamente
--  el error que este proyecto tiene documentado cuatro veces.
--
--  ============================================================================
--   LA RLS SIGUE MANDANDO
--  ============================================================================
--
--  Realtime respeta las policies: una gestora solo recibe eventos de tramites que puede ver.
--  Eso NO hay que programarlo ni se puede olvidar — sale de que la policy de select ya dice lo
--  correcto. Publicar una tabla no abre nada que la RLS no abriera igual.
--
--  ES ADITIVA: no toca datos, ni policies, ni permisos.

do $$
declare t text;
begin
  foreach t in array array['tramites','tramite_eventos','movimientos']
  loop
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ============================================================================
--  COMO COMPROBAR QUE QUEDO BIEN
--
--  1) Las tres estan publicadas:
--       select tablename from pg_publication_tables
--        where pubname = 'supabase_realtime' and schemaname = 'public' order by tablename;
--     Esperado: movimientos, tramite_eventos, tramites.
--
--  2) LA QUE IMPORTA, y no se comprueba con SQL: abrir la app en DOS ventanas con dos usuarios
--     distintos, mover un tramite en una, y ver que en la otra aparece la novedad SIN RECARGAR.
--     Si no aparece, el problema es esta publicacion y no el codigo del front — y no va a haber
--     ningun error que lo diga.
-- ============================================================================
