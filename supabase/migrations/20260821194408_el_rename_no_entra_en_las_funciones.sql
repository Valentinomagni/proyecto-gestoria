-- ============================================================================
--  RENOMBRAR UNA TABLA NO LA RENOMBRA ADENTRO DE LAS FUNCIONES
-- ============================================================================
--
--  ============================================================================
--   EL DEFECTO, Y COMO SE ENCONTRO
--  ============================================================================
--
--  La migracion 20260821192931 hizo `alter table presupuesto_historial rename to
--  tramite_cambios`. Postgres actualiza solo las dependencias que resuelve por OID: claves
--  foraneas, indices, vistas, policies. El cuerpo de una funcion plpgsql NO es una de esas
--  cosas: es TEXTO, y se resuelve recien cuando la funcion corre.
--
--  Asi que `g_conceptos_historial_presupuesto` —el trigger que registra cada linea del
--  presupuesto— siguio insertando en `public.presupuesto_historial`, que ya no existe.
--
--  CONSECUENCIA: no se podia guardar NINGUNA linea de presupuesto. Ni una. El error era
--
--      42P01: relation "public.presupuesto_historial" does not exist
--
--  y salia recien al intentar guardar, nunca al aplicar la migracion.
--
--  ============================================================================
--   LO QUE VALE MAS QUE EL ARREGLO
--  ============================================================================
--
--  El `db push` dijo "Finished" y las cinco migraciones quedaron registradas como aplicadas. Si
--  la comprobacion hubiera sido leer esa salida, esto se publicaba roto — y el sintoma le habria
--  aparecido a la duenia de la empresa al cargar un presupuesto, que es la primera cosa que hace
--  una gestora.
--
--  Se encontro porque la comprobacion de la migracion INSERTA UNA LINEA DE VERDAD y compara el
--  total contra un numero escrito de antemano. Es la misma leccion del 19/08/2026 con la
--  migracion vacia: se prueba que la cosa HAGA lo suyo, no que el comando termine.
--
--  ============================================================================
--   Y DE PASO, EL NOMBRE
--  ============================================================================
--
--  La funcion se llamaba `g_conceptos_historial_presupuesto` y escribe en `tramite_cambios`. Un
--  nombre que no coincide con lo que hace es la proxima confusion esperando. Se renombra a
--  `g_conceptos_cambios`.
--
--  ES ADITIVA: no toca ninguna fila.
-- ============================================================================

drop trigger if exists g_conceptos_historial_presupuesto on public.tramite_conceptos;
drop function if exists public.g_conceptos_historial_presupuesto();

create or replace function public.g_conceptos_cambios()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_nombre text;
begin
  select nombre into v_nombre from public.conceptos where id = new.concepto_id;

  /*
    QUE SE ESCRIBE EN CADA CASO, y las tres lineas son distintas a proposito:

      alta      -> "Arancel 500000.00 (presupuesto)"
      correccion-> de "Arancel 500000.00" a "Arancel 620000.00 (presupuesto)"
      quitada   -> de "Arancel 620000.00" a "Arancel 620000.00 QUITADA: <motivo>"

    La tercera es nueva. Sin ella, quitar una linea aparecia en el historial como un cambio de
    importe de X a X — o sea, como si no hubiera pasado nada. Y lo que hay que poder contestar
    despues es justamente que se saco y por que.
  */
  insert into public.tramite_cambios (tramite_id, que, antes, despues, quien)
  values (
    new.tramite_id, 'concepto',
    case when tg_op = 'UPDATE'
         then coalesce(v_nombre, '?') || ' ' || to_char(old.importe, 'FM999999999990.00')
         else null end,
    coalesce(v_nombre, '?') || ' ' || to_char(new.importe, 'FM999999999990.00')
      || case when new.anulada and not coalesce(old.anulada, false)
              then ' QUITADA: ' || coalesce(new.motivo_anulacion, '')
              else ' (' || new.momento || ')' end,
    auth.uid());

  return null;
end;
$$;

drop trigger if exists g_conceptos_cambios on public.tramite_conceptos;
create trigger g_conceptos_cambios
  after insert or update on public.tramite_conceptos
  for each row execute function public.g_conceptos_cambios();

revoke execute on function public.g_conceptos_cambios() from public, anon, authenticated;

-- ============================================================================
--  COMO COMPROBAR QUE QUEDO BIEN
--
--  1) NINGUNA funcion nombra ya la tabla vieja. Tiene que dar CERO filas:
--       select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--        where n.nspname = 'public' and p.prokind = 'f'
--          and p.prosrc like '%presupuesto_historial%';
--
--  2) Y LA QUE IMPORTA: guardar una linea de presupuesto de verdad y ver que entra.
--       insert into public.tramite_conceptos (tramite_id, concepto_id, momento, importe)
--       values ('<un tramite vivo>', (select id from public.conceptos where nombre='Sellados'),
--               'presupuesto', 1000);
--     Esperado: entra, y hay una fila nueva en tramite_cambios con que = 'concepto'.
--
--  3) Quitarla se lee como quitada, no como un cambio de importe de X a X:
--       update public.tramite_conceptos set anulada = true, motivo_anulacion = 'probando'
--        where tramite_id = '<id>' and momento = 'presupuesto'
--          and concepto_id = (select id from public.conceptos where nombre='Sellados');
--       select antes, despues from public.tramite_cambios
--        where tramite_id = '<id>' order by cuando desc limit 1;
--     Esperado: despues termina en 'QUITADA: probando'.
-- ============================================================================
