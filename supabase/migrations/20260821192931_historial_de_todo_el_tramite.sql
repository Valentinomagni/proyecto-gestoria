-- ============================================================================
--  EL HISTORIAL DEJA DE SER SOLO DEL PRESUPUESTO
-- ============================================================================
--
--  El pedido de la FOTO 8 es "que permita modificar datos, por ejemplo la gestora que realiza el
--  tramite". Un dato que se puede cambiar y no deja rastro es peor que uno que no se puede
--  cambiar: cuando el trabajo aparece con otra persona a cargo, no hay a quien preguntarle.
--
--  ============================================================================
--   SE REGISTRA POR DIFERENCIA DE JSONB, NO ENUMERANDO COLUMNAS
--  ============================================================================
--
--  Es el mismo mecanismo que ya usa `b_tramites_bloquear_campos`, y por el mismo motivo: la
--  version enumerada FALLA ABIERTA. Una columna que se agregue el mes que viene quedaria sin
--  registrar, en silencio, y el historial seguiria diciendo que no paso nada.
--
--  Con la diferencia de jsonb, la columna nueva queda registrada POR DEFECTO y hay que
--  acordarse de EXCLUIRLA si no corresponde. El olvido cae del lado seguro.
--
--  ============================================================================
--   LA TABLA SE RENOMBRA, NO SE CREA UNA NUEVA
--  ============================================================================
--
--  `presupuesto_historial` ya tiene 10 filas de correcciones reales de deposito. Crear una tabla
--  nueva al lado partiria el historial en dos y la ficha tendria que mostrar dos paneles que
--  dicen lo mismo. Renombrarla conserva cada fila y deja un solo lugar donde mirar.
--
--  ES ADITIVA EN DATOS: ninguna fila cambia de valor ni se pierde.
-- ============================================================================

alter table if exists public.presupuesto_historial rename to tramite_cambios;

alter table public.tramite_cambios add column if not exists campo text;

comment on column public.tramite_cambios.campo is
  'Que columna cambio, cuando que = dato. El nombre en pantalla lo pone el front: si viviera '
  'aca, cambiar una etiqueta obligaria a una migracion.';

alter table public.tramite_cambios drop constraint if exists presupuesto_historial_que_valido;
alter table public.tramite_cambios drop constraint if exists tramite_cambios_que_valido;
alter table public.tramite_cambios add constraint tramite_cambios_que_valido
  check (que in ('deposito','concepto','dato'));

comment on table public.tramite_cambios is
  'Cada cambio de un tramite: los datos, las lineas del presupuesto y el total. Lo escriben '
  'triggers y no la pantalla: si lo escribiera la pantalla, un cambio hecho desde otro lado no '
  'quedaria registrado y el historial diria que no paso nada. Solo insercion.';

-- ------------------------------------------------------------
-- El trigger nuevo: cualquier columna que cambie
-- ------------------------------------------------------------

create or replace function public.g_tramites_cambios_de_datos()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  /*
    LO QUE NO SE REGISTRA, Y EL MOTIVO DE CADA UNO:

      estado y los *_at        -> ya tienen su propio historial, en tramite_eventos. Registrarlos
                                  aca duplicaria cada paso de la cadena en dos paneles.
      deposito_solicitado      -> es la SUMA de los conceptos desde la migracion anterior. Su
                                  historia son las lineas, que se registran una por una. Ponerlo
                                  tambien aca mostraria dos renglones por cada importe cargado.
      actualizado_at / _por    -> los escribe el trigger de sello en CADA update. Sin excluirlos,
                                  toda fila de historial vendria con dos filas de ruido al lado.
  */
  ignorar text[] := array[
    'estado','deposito_solicitado','actualizado_at','actualizado_por','creado_at','creado_por',
    'controlado_at','entregado_at','presupuestado_at','presentado_at','pagado_at','retirado_at',
    'devuelto_at','autorizado_en','autorizado_por'
  ];
  viejo jsonb := to_jsonb(old) - ignorar;
  nuevo jsonb := to_jsonb(new) - ignorar;
  k     text;
begin
  if viejo is not distinct from nuevo then return null; end if;

  for k in select jsonb_object_keys(nuevo) loop
    if (viejo -> k) is distinct from (nuevo -> k) then
      insert into public.tramite_cambios (tramite_id, que, campo, antes, despues, quien)
      values (new.id, 'dato', k, viejo ->> k, nuevo ->> k, auth.uid());
    end if;
  end loop;

  return null;
end;
$$;

drop trigger if exists g_tramites_cambios_de_datos on public.tramites;
create trigger g_tramites_cambios_de_datos
  after update on public.tramites
  for each row execute function public.g_tramites_cambios_de_datos();

revoke execute on function public.g_tramites_cambios_de_datos() from public, anon, authenticated;

-- ------------------------------------------------------------
-- El de deposito se retira: ese numero ya no lo escribe una persona
--
--   Desde la migracion anterior lo calcula un trigger a partir de las lineas. Su historia son
--   las lineas, y cada una ya se registra por separado. Dejar los dos mostraria dos renglones
--   por cada importe cargado, diciendo lo mismo dos veces.
-- ------------------------------------------------------------

drop trigger if exists g_tramites_historial_presupuesto on public.tramites;
drop function if exists public.g_tramites_historial_presupuesto();

-- ------------------------------------------------------------
-- RLS: se recrea la policy, que el rename arrastra con el nombre viejo
-- ------------------------------------------------------------

alter table public.tramite_cambios enable row level security;

drop policy if exists "presupuesto_historial_select" on public.tramite_cambios;
drop policy if exists "tramite_cambios_select" on public.tramite_cambios;
create policy "tramite_cambios_select" on public.tramite_cambios for select to authenticated
  using (exists (select 1 from public.tramites x where x.id = tramite_cambios.tramite_id));

-- Sin policy de insert: lo escriben los triggers, que son SECURITY DEFINER y no pasan por RLS.
-- Sin update ni delete para nadie, igual que el libro mayor.
revoke insert, update, delete, truncate on public.tramite_cambios from anon, authenticated;
grant select on public.tramite_cambios to authenticated;

-- ============================================================================
--  COMO COMPROBAR QUE QUEDO BIEN
--
--  1) Las 10 filas viejas siguen ahi:
--       select count(*) from public.tramite_cambios;
--     Esperado: 10 o mas.
--
--  2) Cambiar un dato deja rastro. Con un tramite real:
--       update public.tramites set administrativo = 'PRUEBA HISTORIAL' where id = '<id>';
--       select campo, antes, despues from public.tramite_cambios
--        where tramite_id = '<id>' and que = 'dato' order by cuando desc limit 5;
--     Esperado: una fila con campo = 'administrativo'.
--
--  3) Y cambiar DOS datos de una deja DOS filas, no una:
--       update public.tramites set administrativo = 'OTRA', seccional = '19005' where id = '<id>';
--     Esperado: dos filas nuevas, una por columna.
--
--  4) Y un update que no cambia nada NO deja ninguna fila:
--       update public.tramites set administrativo = 'OTRA' where id = '<id>';
--     Esperado: cero filas nuevas. Si aparece una, el trigger esta registrando el sello.
--
--  5) Nadie lo puede editar ni borrar. Las dos tienen que dar false:
--       select has_table_privilege('authenticated','public.tramite_cambios','UPDATE') as u,
--              has_table_privilege('authenticated','public.tramite_cambios','DELETE') as d;
--
--  6) `npm run permisos` en verde.
-- ============================================================================
