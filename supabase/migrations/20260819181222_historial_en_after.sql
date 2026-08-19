-- ============================================================================
--  GESTORIA — el historial se escribe en un AFTER, no en un BEFORE
--
--  EL BUG, y lo encontro la prueba de humo del circuito completo antes de que existiera una
--  sola pantalla:
--
--      ERROR 23503: insert or update on table "tramite_eventos" violates foreign key constraint
--      DETAIL: Key (tramite_id)=(...) is not present in table "tramites".
--
--  `c_tramites_transicion` es un trigger BEFORE INSERT y escribia la fila del historial
--  apuntando a `new.id`. En un BEFORE INSERT la fila del tramite TODAVIA NO EXISTE, asi que la
--  clave foranea la rechaza. Resultado: NINGUN tramite se podia crear.
--
--  Habria reventado con el primer alta que alguien intentara desde la app, el primer dia.
--
--  LA SEPARACION CORRECTA, y vale como regla del proyecto:
--    BEFORE -> validar y sellar campos, que es lo unico que puede modificar NEW;
--    AFTER  -> escribir en otras tablas, porque recien ahi la fila existe.
--
--  Se descubrio corriendo el circuito con numeros reales, no leyendo el codigo: el SQL era
--  sintacticamente perfecto.
-- ============================================================================

-- 1) El trigger BEFORE queda solo con lo suyo: validar y sellar. Ya no toca tramite_eventos.
create or replace function public.c_tramites_transicion()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare
  rol                text := coalesce(public.mi_rol(), 'consola');
  ok                 boolean := false;
  sin_contestar      int;
  total_real         numeric(14,2);
  lineas_presupuesto int;
begin
  if tg_op = 'INSERT' then
    if new.estado <> 'recibido' and new.origen = 'app' then
      raise exception 'regla_tramite: Un tramite nuevo entra en estado recibido';
    end if;
    new.autorizado_por := coalesce(new.autorizado_por, auth.uid());
    new.creado_por     := coalesce(new.creado_por, auth.uid());
    return new;
  end if;

  if new.estado is not distinct from old.estado then return new; end if;
  if rol = 'consola' then return new; end if;

  if new.estado = 'anulado' then
    if old.estado = 'devuelto' then
      raise exception 'regla_tramite: Un tramite ya devuelto no se anula. Corregilo con un ajuste.';
    end if;
    ok := rol in ('gerencia','contable');
  elsif public.orden_estado(new.estado) < public.orden_estado(old.estado) then
    ok := (rol = 'gerencia');
  else
    ok := case old.estado || '>' || new.estado
      when 'recibido>controlado'             then rol in ('contable','gerencia')
      when 'controlado>entregado'            then rol in ('contable','gerencia')
      when 'entregado>presupuestado'         then rol in ('gestora','contable','gerencia')
      when 'presupuestado>frenado_por_saldo' then rol in ('contable','gerencia')
      when 'frenado_por_saldo>presentado'    then rol in ('gestora','contable','gerencia')
      when 'presupuestado>presentado'        then rol in ('gestora','contable','gerencia')
      when 'presentado>pagado'               then rol in ('gestora','contable','gerencia')
      when 'pagado>retirado'                 then rol in ('gestora','contable','gerencia')
      when 'retirado>devuelto'               then rol in ('contable','gerencia')
      else false
    end;
  end if;

  if not ok then
    raise exception 'regla_tramite: No se puede pasar de % a % con el rol %', old.estado, new.estado, rol;
  end if;

  if new.estado = 'controlado' then
    select count(*) into sin_contestar
      from public.requisitos r
     where r.activo and (r.aplica_a = new.tipo or r.aplica_a = 'todos')
       and not exists (select 1 from public.tramite_requisitos tr
                        where tr.tramite_id = new.id and tr.requisito_id = r.id);
    if sin_contestar > 0 then
      raise exception 'regla_tramite: Faltan % requisitos del legajo por contestar', sin_contestar;
    end if;
    new.controlado_at := coalesce(new.controlado_at, now());
  end if;

  if new.estado = 'entregado' then
    if new.gestora_id is null then
      raise exception 'regla_tramite: Para entregar el tramite hace falta elegir la gestora';
    end if;
    new.entregado_at := coalesce(new.entregado_at, now());
  end if;

  if new.estado = 'presupuestado' then
    if coalesce(new.deposito_solicitado,0) <= 0 then
      raise exception 'regla_tramite: Falta el monto del deposito que se solicita';
    end if;
    select count(*) into lineas_presupuesto
      from public.tramite_conceptos where tramite_id = new.id and momento = 'presupuesto';
    if lineas_presupuesto = 0 then
      raise exception 'regla_tramite: Falta detallar al menos un concepto del presupuesto';
    end if;
    new.presupuestado_at := coalesce(new.presupuestado_at, now());
  end if;

  if new.estado = 'presentado' then
    if nullif(btrim(coalesce(new.seccional,'')),'') is null then
      raise exception 'regla_tramite: Falta indicar en que seccional se presento';
    end if;
    if new.medio_pago = 'tarjeta_habitualista'
       and not exists (select 1 from public.razones_sociales r
                        where r.id = new.razon_social_id and r.tarjeta_id is not null) then
      raise exception 'regla_tramite: Esa razon social todavia no tiene Tarjeta Habitualista asignada';
    end if;
    new.presentado_at := coalesce(new.presentado_at, now());
  end if;

  if new.estado = 'pagado' then
    select coalesce(sum(importe),0) into total_real
      from public.tramite_conceptos where tramite_id = new.id and momento = 'real';
    if total_real <= 0 then
      raise exception 'regla_tramite: Falta cargar el costo real, discriminado por concepto';
    end if;
    new.pagado_at := coalesce(new.pagado_at, now());
  end if;

  if new.estado = 'retirado' then
    if nullif(btrim(coalesce(new.documentacion_retirada,'')),'') is null then
      raise exception 'regla_tramite: Anota que documentacion retiraste: titulo, cedula, chapas';
    end if;
    new.retirado_at := coalesce(new.retirado_at, now());
  end if;

  if new.estado = 'devuelto' then
    new.devuelto_at := coalesce(new.devuelto_at, now());
  end if;

  return new;
end;
$fn$;

-- 2) El historial, en un AFTER. Recien aca la fila del tramite existe.
create or replace function public.f_tramites_historial()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare rol text := coalesce(public.mi_rol(), 'consola');
begin
  if tg_op = 'INSERT' then
    insert into public.tramite_eventos (tramite_id, estado_desde, estado_hasta, por, rol_al_momento)
      values (new.id, null, new.estado, auth.uid(), rol);
  elsif new.estado is distinct from old.estado then
    insert into public.tramite_eventos (tramite_id, estado_desde, estado_hasta, por, rol_al_momento)
      values (new.id, old.estado, new.estado, auth.uid(), rol);
  end if;
  return null;  -- en un AFTER el valor de retorno se ignora
end;
$fn$;

drop trigger if exists f_tramites_historial on public.tramites;
create trigger f_tramites_historial after insert or update on public.tramites
  for each row execute function public.f_tramites_historial();

revoke execute on function public.f_tramites_historial() from public, anon, authenticated;

-- ============================================================================
--  COMO COMPROBAR QUE QUEDO BIEN
--
--  Crear un tramite y recorrer el circuito. El alta tiene que funcionar, y tiene que quedar una
--  fila de historial por cada cambio de estado:
--
--    select estado_desde, estado_hasta, at from public.tramite_eventos order by at;
-- ============================================================================
