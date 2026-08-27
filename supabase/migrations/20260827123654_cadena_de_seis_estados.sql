-- ============================================================================
--  LA CADENA BAJA DE DIEZ ESTADOS A SEIS
-- ============================================================================
--
--  ============================================================================
--   POR QUE SE FUNDEN TRES ESTADOS EN UNO
--  ============================================================================
--
--  `presentado`, `pagado` y `retirado` eran tres botones para UN SOLO VIAJE al registro. Lo
--  dicto quien lo hace, textual: "todo en el mismo momento: presenta, se paga y se retira".
--
--  Tenerlos separados obligaba a la gestora a abrir la app tres veces para registrar algo que
--  paso una vez, y ninguna de esas tres aperturas le decia nada nuevo a la oficina.
--
--  ============================================================================
--   POR QUE DESAPARECE `frenado_por_saldo`
--  ============================================================================
--
--  No es un estado del tramite: es una condicion de la tarjeta. El tramite esta presupuestado y
--  correcto; lo que falta es que la tarjeta tenga con que.
--
--  Modelarlo como estado obligaba a alguien a marcarlo Y A DESMARCARLO a mano, y ese alguien se
--  olvidaba. Ahora se deduce, en la vista `v_esperando_plata` de la migracion siguiente: si
--  entra plata, el tramite deja de estar esperando solo.
--
--  ============================================================================
--   EL PELIGRO DE ESTA MIGRACION, ESCRITO PARA QUE NO SE PASE POR ALTO
--  ============================================================================
--
--  `e_tramites_cuenta_corriente` libera la reserva cuando el estado pasa a `pagado`. Si ese
--  trigger no se actualiza aca, la reserva NO SE LIBERA NUNCA y la plata queda comprometida para
--  siempre en la tarjeta. No hay error, no hay aviso: el numero simplemente no baja.
--
--  ============================================================================
--   LA VENTANA DE CONVIVENCIA, Y POR QUE ESTA MIGRACION ES MAS LARGA DE LO QUE PARECE
--  ============================================================================
--
--  Esta migracion NO convierte los tramites viejos: eso lo hace la siguiente, a proposito y con
--  el trigger apagado. O sea que entre esta y la siguiente hay una ventana donde conviven los
--  estados de las dos cadenas, y hoy hay DOS tramites adentro de esa ventana:
--
--      1 en `presentado`   (520.000 reservados y CERO costo real: presento y no pago)
--      1 en `retirado`     (ya con su reserva liberada y su pago escrito)
--
--  Escribir solo el vocabulario nuevo abriria tres agujeros durante esa ventana, y los tres se
--  encontraron comparando contra lo que hay vivo en la base:
--
--    a) `pagado>retirado` y `retirado>devuelto` desaparecerian de la tabla de transiciones, y
--       el tramite en `retirado` quedaria trabado sin poder devolverse.
--    b) La guarda de correccion del presupuesto pasaria a mirar solo `resuelto`, asi que se
--       podria escribir un `ajuste_reserva` sobre la reserva YA LIBERADA del que esta en
--       `retirado`. Eso compromete plata que no esta comprometida por nada.
--    c) `b_conceptos_no_despues_de_pagado` dejaria de nombrar `pagado` y `retirado`, y el
--       presupuesto de esos tramites volveria a ser editable.
--
--  Por eso el vocabulario viejo SIGUE NOMBRADO en las guardas mientras la ventana exista. La
--  migracion siguiente lo saca, cuando ya no quede ningun tramite en esos estados.
--
--  ES ADITIVA EN DATOS: no cambia el estado de ningun tramite. El `check` todavia acepta los diez.
-- ============================================================================

-- ------------------------------------------------------------
-- 1) El sello del paso nuevo
-- ------------------------------------------------------------

alter table public.tramites add column if not exists resuelto_at timestamptz;

comment on column public.tramites.resuelto_at is
  'Cuando se resolvio en el registro: presento, pago y retiro, en un viaje. Reemplaza a los tres '
  'sellos presentado_at, pagado_at y retirado_at, que se conservan como historia de cuando la '
  'cadena tenia diez estados.';

-- ------------------------------------------------------------
-- 2) El orden nuevo. `resuelto` ocupa el lugar que tenian los tres.
--
--    ESTA FUNCION DECIDE SI UN CAMBIO VA PARA ATRAS, y solo gerencia puede ir para atras. Si
--    quedara con los estados viejos devolveria null para `resuelto`, la comparacion se volveria
--    indefinida y la regla dejaria de aplicarse sin que nadie lo note.
--
--    LOS TRES VIEJOS PASAN A COMPARTIR EL 5 CON `resuelto`, y eso es deliberado: al quedar
--    empatados, `presentado>pagado` deja de ser "para adelante" y cae en la tabla de
--    transiciones de abajo, que es donde se decide de verdad. La tabla los sigue nombrando
--    mientras la ventana exista.
-- ------------------------------------------------------------

create or replace function public.orden_estado(p text)
returns int language sql immutable as $$
  select case p
    when 'recibido' then 1
    when 'controlado' then 2
    when 'entregado' then 3
    when 'presupuestado' then 4
    when 'frenado_por_saldo' then 4
    when 'resuelto' then 5
    when 'presentado' then 5
    when 'pagado' then 5
    when 'retirado' then 5
    when 'devuelto' then 6
    when 'anulado' then 99 end;
$$;

-- ------------------------------------------------------------
-- 3) El check acepta el estado nuevo. Todavia acepta los viejos.
-- ------------------------------------------------------------

alter table public.tramites drop constraint if exists tramites_estado_valido;
alter table public.tramites add constraint tramites_estado_valido check (estado = any (array[
  'recibido','controlado','entregado','presupuestado','resuelto','devuelto','anulado',
  'frenado_por_saldo','presentado','pagado','retirado'
]));

-- ------------------------------------------------------------
-- 4) La maquina de estados
--
--    Se reescribe ENTERA porque `create or replace function` reemplaza todo el cuerpo. Antes de
--    escribirla se leyo `pg_get_functiondef` de la vigente y se fueron marcando una por una las
--    guardas que tenia, para que ninguna se cayera al pasar de tres estados a uno.
-- ------------------------------------------------------------

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
      -- La cadena nueva.
      when 'recibido>controlado'     then rol in ('contable','gerencia')
      when 'controlado>entregado'    then rol in ('contable','gerencia')
      when 'entregado>presupuestado' then rol in ('gestora','contable','gerencia')
      when 'presupuestado>resuelto'  then rol in ('gestora','contable','gerencia')
      when 'resuelto>devuelto'       then rol in ('gestora','contable','gerencia')

      /*
        LA CADENA VIEJA, SOLO MIENTRAS DURE LA VENTANA. Hoy hay un tramite en `retirado`: sin
        estas lineas se quedaria trabado, porque `retirado>devuelto` no existiria en ningun
        lado y el mensaje de error diria que no se puede pasar de un estado a otro sin explicar
        que el problema es que la cadena cambio abajo suyo.

        La migracion siguiente las saca, junto con los estados del `check`.
      */
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
    -- NO SE PREGUNTA POR `deposito_solicitado`. Ese numero ES la suma de las lineas, lo escribe
    -- h_conceptos_total_presupuesto, y preguntar por los dos seria preguntar dos veces lo mismo
    -- con dos mensajes distintos. Queda la pregunta que si dice algo util.
    select count(*) into lineas_presupuesto
      from public.tramite_conceptos
     where tramite_id = new.id and momento = 'presupuesto' and not anulada;
    if lineas_presupuesto = 0 then
      raise exception 'regla_tramite: Falta cargar el presupuesto: al menos un concepto con su importe';
    end if;
    new.presupuestado_at := coalesce(new.presupuestado_at, now());
  end if;

  /*
    EL PASO NUEVO. Pide de una vez lo que ese momento produce, porque es UN viaje: donde se
    presento, cuanto salio de verdad, y que documentacion se retiro.

    Las cuatro preguntas de abajo son EXACTAMENTE las que hacian por separado `presentado`
    (seccional y razon social con tarjeta), `pagado` (costo real) y `retirado` (documentacion).
    Ninguna se perdio: fundir los estados no afloja ningun control, solo junta el momento en que
    se contestan.
  */
  if new.estado = 'resuelto' then
    if nullif(btrim(coalesce(new.seccional,'')),'') is null then
      raise exception 'regla_tramite: Falta indicar en que seccional se presento';
    end if;

    if new.medio_pago = 'tarjeta_habitualista'
       and not exists (select 1 from public.razones_sociales r
                        where r.id = new.razon_social_id and r.tarjeta_id is not null) then
      raise exception 'regla_tramite: Esa razon social todavia no tiene Tarjeta Habitualista asignada';
    end if;

    select coalesce(sum(importe),0) into total_real
      from public.tramite_conceptos
     where tramite_id = new.id and momento = 'real' and not anulada;
    if total_real <= 0 then
      raise exception 'regla_tramite: Falta cargar lo que salio de verdad, discriminado por concepto';
    end if;

    if nullif(btrim(coalesce(new.documentacion_retirada,'')),'') is null then
      raise exception 'regla_tramite: Anota que documentacion retiraste: titulo, cedula, chapas';
    end if;

    new.resuelto_at   := coalesce(new.resuelto_at, now());
    -- Los sellos viejos se completan igual, para que lo que ya existe siga leyendose.
    new.presentado_at := coalesce(new.presentado_at, now());
    new.pagado_at     := coalesce(new.pagado_at, now());
    new.retirado_at   := coalesce(new.retirado_at, now());
  end if;

  /*
    LOS TRES ESTADOS VIEJOS CONSERVAN SUS PREGUNTAS mientras dure la ventana. Sin esto, el
    tramite que hoy esta en `presentado` podria pasar a `pagado` SIN costo real cargado, y el
    trigger de la cuenta corriente escribiria un `pago` de cero contra una reserva de 520.000.
  */
  if new.estado = 'presentado' then
    if nullif(btrim(coalesce(new.seccional,'')),'') is null then
      raise exception 'regla_tramite: Falta indicar en que seccional se presento';
    end if;
    new.presentado_at := coalesce(new.presentado_at, now());
  end if;

  if new.estado = 'pagado' then
    select coalesce(sum(importe),0) into total_real
      from public.tramite_conceptos
     where tramite_id = new.id and momento = 'real' and not anulada;
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

-- ------------------------------------------------------------
-- 5) LA PARTE PELIGROSA: la reserva se libera en `resuelto`
--
--    Se reescribe la funcion ENTERA, y eso tiene SEIS cambios de conducta, no uno. La primera
--    version de este plan decia que era uno solo y se equivocaba; una revision adversarial
--    encontro cuatro, y comparar linea por linea contra la funcion viva encontro los otros dos:
--
--      1. La rama que libera la reserva deja de mirar `pagado` y mira `resuelto`.
--      2. La rama de ALTA de preexistentes conserva su filtro por estado. Sin el, un
--         preexistente ya pagado reservaria plata que el banco ya descontó — dos veces.
--      3. La rama de correccion del presupuesto conserva su guarda.
--      4. La rama de ANULACION se conserva. Casi se pierde, y perderla significaba que anular un
--         tramite presupuestado dejara la reserva viva PARA SIEMPRE, sin error y sin forma de
--         arreglarlo desde la app.
--      5. El costo real pasa a excluir las lineas ANULADAS. La version viva suma
--         `where momento = 'real'` a secas: una linea del costo real que alguien anulo se sigue
--         cobrando. Es un defecto propio, no tiene nada que ver con el cambio de cadena, y se
--         arregla aca porque esta linea se reescribe igual. La rama gemela, la del presupuesto,
--         ya excluia lo anulado — o sea que las dos mitades del mismo calculo no coincidian.
--      6. La liberacion de la reserva pasa a mirar TAMBIEN los sellos, y no solo el estado
--         anterior. Con la version viva, mandar un tramite ya pagado para atras y volver a
--         cerrarlo escribia una SEGUNDA reversa y un SEGUNDO pago: plata devuelta dos veces y
--         cobrada dos veces, en silencio. Esta explicado entero abajo, en la rama 3.
--
--    `create or replace function` reemplaza el cuerpo entero: lo que no se vuelve a escribir, se
--    borra. Media funcion pegada es como se pierde una validacion sin que nadie lo note.
-- ------------------------------------------------------------

create or replace function public.e_tramites_cuenta_corriente()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_reservado numeric(14,2);
  v_real      numeric(14,2);
begin
  if new.medio_pago <> 'tarjeta_habitualista' then return new; end if;
  if new.tarjeta_id is null then return new; end if;

  /*
    ALTA de un tramite preexistente: los que estaban a mitad de camino el dia del corte.

      Sin pagar todavia -> SI reserva: esa plata sigue comprometida y sigue en el banco.
      Ya pagado         -> NINGUN movimiento: el banco ya lo descontó y está dentro del
                           saldo_inicial. Generarlo lo descontaria DOS VECES.

    EL FILTRO POR ESTADO NO SE PUEDE SACAR, y casi se saca. Se le agrega `presupuestado` de la
    cadena nueva y se le conservan los tres viejos mientras exista la ventana.
  */
  if tg_op = 'INSERT' then
    if new.origen = 'preexistente'
       and new.estado in ('presupuestado','frenado_por_saldo','presentado')
       and coalesce(new.deposito_solicitado,0) > 0 then
      insert into public.movimientos
        (tarjeta_id, tipo, importe, tramite_id, gestora_id, concepto, origen, creado_por)
      values (new.tarjeta_id, 'reserva', -new.deposito_solicitado, new.id, new.gestora_id,
              'Presupuesto al corte - ' || new.cliente_nombre, 'preexistente', auth.uid());
    end if;
    return new;
  end if;

  if new.origen <> 'app' then return new; end if;

  -- 1) Primera carga del deposito solicitado -> reserva.
  if coalesce(old.deposito_solicitado,0) = 0 and coalesce(new.deposito_solicitado,0) > 0 then
    insert into public.movimientos
      (tarjeta_id, tipo, importe, tramite_id, gestora_id, concepto, origen, creado_por)
    values (new.tarjeta_id, 'reserva', -new.deposito_solicitado, new.id, new.gestora_id,
            'Presupuesto - ' || new.cliente_nombre, 'tramite', auth.uid());

  /*
    2) Correccion del deposito -> ajuste POR LA DIFERENCIA. La reserva original NUNCA se toca:
       editarla haria que el saldo de ayer deje de ser reconstruible.

       LA GUARDA POR ESTADO TAMPOCO SE PUEDE SACAR. Antes decia `<> 'pagado'`. Ahora nombra el
       estado nuevo Y LOS DOS VIEJOS QUE YA LIBERARON SU RESERVA: despues de cualquiera de los
       tres, un ajuste comprometeria plata que no esta comprometida por nada. Hoy hay un tramite
       en `retirado`, asi que sacar esos dos nombres no seria teorico.
  */
  elsif coalesce(old.deposito_solicitado,0) > 0
        and coalesce(new.deposito_solicitado,0) > 0
        and new.deposito_solicitado is distinct from old.deposito_solicitado
        and new.estado not in ('resuelto','pagado','retirado') then
    insert into public.movimientos
      (tarjeta_id, tipo, importe, tramite_id, gestora_id, concepto, origen, creado_por)
    values (new.tarjeta_id, 'ajuste_reserva',
            -(new.deposito_solicitado - old.deposito_solicitado),
            new.id, new.gestora_id, 'Correccion del presupuesto', 'tramite', auth.uid());
  end if;

  /*
    3) RESUELTO -> se devuelve TODO lo reservado y se descuenta el costo real.

    ANTES ESTO MIRABA `pagado`. Es el punto mas delicado de la migracion: si mirara un estado que
    ya no existe, la reserva no se liberaria nunca y no habria ningun error que lo dijera.

    SE NOMBRA `pagado` TAMBIEN, y no es de mas: mientras dure la ventana el tramite que hoy esta
    en `presentado` puede pasar a `pagado`, y si esta rama no lo mirara su reserva de 520.000
    quedaria comprometida para siempre.

    ============================================================================
     Y SE MIRAN LOS SELLOS, QUE ES UN AGUJERO QUE YA ESTABA ABIERTO
    ============================================================================

    La version viva pregunta solo `old.estado is distinct from 'pagado'`. Eso alcanza mientras
    nadie vaya para atras — pero ir para atras SE PUEDE, gerencia lo tiene permitido, y es
    exactamente lo que alguien hace cuando se equivoco en el costo real.

    El circuito era: resuelto -> presupuestado -> resuelto. En la segunda vuelta `old.estado` es
    `presupuestado`, la condicion da verdadero, y se escribe UNA SEGUNDA reversa por el total
    reservado MAS UN SEGUNDO PAGO. La reversa se calcula sobre `reserva` y `ajuste_reserva`
    solamente, sin descontar la reversa anterior, asi que devuelve plata que ya se habia
    devuelto: el disponible sube por una plata que no existe, y el pago se cobra dos veces.

    Sin error, sin aviso, y sobre la cifra que la gestora usa para decidir si puede pagar.

    Los sellos son el testigo correcto porque NADA los limpia: ir para atras cambia el estado y
    deja las fechas donde estaban. Si `pagado_at` o `resuelto_at` ya tienen valor, la plata de
    este tramite ya se movio y no se vuelve a mover.
  */
  if new.estado in ('resuelto','pagado')
     and old.estado not in ('resuelto','pagado')
     and old.pagado_at is null
     and old.resuelto_at is null then
    select coalesce(sum(-importe), 0) into v_reservado
      from public.movimientos
     where tramite_id = new.id and tipo in ('reserva','ajuste_reserva');

    if v_reservado <> 0 then
      insert into public.movimientos
        (tarjeta_id, tipo, importe, tramite_id, gestora_id, concepto, origen, creado_por)
      values (new.tarjeta_id, 'reversa_reserva', v_reservado, new.id, new.gestora_id,
              'Libera la reserva', 'tramite', auth.uid());
    end if;

    -- `not anulada`: ver el punto 5 del encabezado. La version viva no lo tenia y cobraba las
    -- lineas del costo real que alguien habia anulado.
    select coalesce(sum(importe),0) into v_real
      from public.tramite_conceptos
     where tramite_id = new.id and momento = 'real' and not anulada;

    if v_real > 0 then
      insert into public.movimientos
        (tarjeta_id, tipo, importe, tramite_id, gestora_id, concepto, origen, creado_por)
      values (new.tarjeta_id, 'pago', -v_real, new.id, new.gestora_id,
              'Pago en el registro - ' || coalesce(new.seccional,''), 'tramite', auth.uid());
    end if;
  end if;

  /*
    4) ANULACION. DOS COMPORTAMIENTOS DISTINTOS, y tratarlos igual inventa plata:
         antes de resolverse  -> se revierte la reserva y el disponible vuelve;
         despues de resolverse-> NO se devuelve nada, porque la plata se fue de verdad. Si el
                                 registro reintegra algo, entra como ingreso con su motivo.

    ESTE BLOQUE CASI DESAPARECE, y una revision adversarial lo agarro. La primera version de esta
    migracion tenia tres bloques donde la funcion vigente tiene cuatro, y como `create or replace
    function` reemplaza el cuerpo entero, este se perdia.

    La consecuencia habria sido: anular un tramite presupuestado deja la reserva viva PARA
    SIEMPRE. El comprometido de la tarjeta nunca baja, la Diferencia queda mal para siempre, y no
    hay error ni aviso. Y no habria forma de arreglarlo desde la app: `anular_movimiento` rechaza
    los movimientos que genero un tramite, y `b_conceptos_no_despues_de_pagado` impide tocar el
    presupuesto de un tramite anulado.

    LA LISTA NOMBRA LOS TRES: `resuelto` de la cadena nueva, y `pagado` y `retirado` de la vieja,
    que son los dos estados donde la plata ya se fue. El tramite que hoy esta en `retirado` cae
    justo ahi.
  */
  if new.estado = 'anulado' and old.estado is distinct from 'anulado' then
    if old.estado not in ('resuelto','pagado','retirado') then
      select coalesce(sum(-importe), 0) into v_reservado
        from public.movimientos
       where tramite_id = new.id and tipo in ('reserva','ajuste_reserva','reversa_reserva');
      if v_reservado > 0 then
        insert into public.movimientos
          (tarjeta_id, tipo, importe, tramite_id, gestora_id, concepto, origen, creado_por)
        values (new.tarjeta_id, 'reversa_reserva', v_reservado, new.id, new.gestora_id,
                'Anulado: libera la reserva', 'tramite', auth.uid());
      end if;
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function public.e_tramites_cuenta_corriente() from public, anon, authenticated;

-- ------------------------------------------------------------
-- 6) El presupuesto tampoco se toca despues de RESUELTO
--
--    `b_conceptos_no_despues_de_pagado` nombraba los estados de la cadena vieja. Sin este cambio,
--    el presupuesto de un tramite resuelto volveria a ser editable, y editarlo escribiria un
--    `ajuste_reserva` sobre una reserva que ya se libero.
--
--    LOS VIEJOS SE CONSERVAN: sacar `pagado` y `retirado` de esta lista dejaria editable el
--    presupuesto del tramite que hoy esta en `retirado`. La lista se achica en la migracion
--    siguiente, cuando ya no quede nadie en esos estados.
-- ------------------------------------------------------------

create or replace function public.b_conceptos_no_despues_de_pagado()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_estado text;
begin
  if new.momento <> 'presupuesto' then return new; end if;
  if auth.uid() is null then return new; end if;              -- consola de la base

  select estado into v_estado from public.tramites where id = new.tramite_id;

  if v_estado in ('resuelto', 'pagado', 'retirado', 'devuelto', 'anulado') then
    raise exception 'regla_tramite: El tramite ya esta %. El presupuesto no se cambia despues de resolverlo: corregilo con un ajuste en la cuenta.', v_estado;
  end if;

  return new;
end;
$$;

revoke execute on function public.b_conceptos_no_despues_de_pagado() from public, anon, authenticated;

-- ------------------------------------------------------------
-- 7) La gestora tiene que poder cerrar su propio tramite
--
--    LA POLICY NOMBRA LOS ESTADOS UNO POR UNO, y `resuelto` no existia cuando se escribio. Sin
--    este cambio la gestora aprieta el boton y NO PASA NADA: la clausula `using` no la deja, el
--    update afecta cero filas, y PostgREST no devuelve error por cero filas. La pantalla diria
--    que guardo y el tramite se quedaria donde estaba.
--
--    Es la peor forma de fallar que hay, y es la que este proyecto tiene documentada como la que
--    hace perder la confianza en la herramienta entera.
--
--    LOS VIEJOS SE CONSERVAN mientras dure la ventana, por lo mismo: sacarlos dejaria a la
--    gestora sin poder mover el tramite que hoy esta en `presentado`, con el mismo silencio.
-- ------------------------------------------------------------

drop policy if exists "tramites_update_gestora" on public.tramites;
create policy "tramites_update_gestora" on public.tramites for update to authenticated
  using (
    public.es_gestora() and gestora_id = public.mi_gestora_id()
    and estado in ('entregado','presupuestado','resuelto',
                   'frenado_por_saldo','presentado','pagado','retirado')
  )
  with check (public.es_gestora() and gestora_id = public.mi_gestora_id());

-- ============================================================================
--  COMO COMPROBAR QUE QUEDO BIEN
--
--  EL CIRCUITO ENTERO, con los numeros escritos de antemano. No alcanza con que el push termine.
--
--  Elegi un tramite en `entregado` con tarjeta y gestora, y anota el comprometido de su tarjeta.
--
--  1) Cargar el presupuesto y presupuestar.
--     Esperado: comprometido subio por el importe, y hay un movimiento `reserva` negativo.
--
--  2) Cargar el costo real, la seccional y la documentacion, y resolver.
--
--  3) LA COMPROBACION QUE IMPORTA — la reserva se libero y se descontó lo real:
--       select tipo, importe from public.movimientos where tramite_id = '<id>' order by id;
--     Esperado, en este orden: reserva negativa, reversa_reserva positiva por lo mismo, y pago
--     negativo por el costo real.
--       select comprometido from public.v_saldos where tarjeta_id = '<la tarjeta>';
--     Esperado: EXACTAMENTE el mismo que antes del paso 1. Si quedo arriba, la reserva no se
--     libero y ESTA MIGRACION ESTA MAL.
--
--  4) Resolver sin costo real NO se puede. TIENE QUE FALLAR con 'Falta cargar lo que salio de
--     verdad'.
--
--  5) Y saltearse un paso tampoco: de `recibido` a `resuelto` TIENE QUE FALLAR.
--
--  6) ANULAR UN TRAMITE PRESUPUESTADO DEVUELVE LA PLATA. Esta comprobacion existe porque esa
--     rama casi se pierde en la primera version de esta migracion. El comprometido tiene que
--     volver EXACTAMENTE a donde estaba.
--
--  7) Y anular uno YA RESUELTO no devuelve nada, porque la plata se fue de verdad: NINGUN
--     movimiento nuevo. Si aparece una reversa, se estaria inventando plata.
--
--  8) El presupuesto de un tramite resuelto NO se toca: TIENE QUE FALLAR.
--
--  9) Y la gestora SI puede cerrar el suyo: de `resuelto` a `devuelto` el estado CAMBIA. Si el
--     update afecta cero filas SIN ERROR, la policy se olvido de `resuelto`.
--
-- 10) LA VENTANA: el tramite que hoy esta en `retirado` sigue pudiendo pasar a `devuelto`, y el
--     que esta en `presentado` sigue pudiendo pasar a `pagado`. Si alguno quedo trabado, esta
--     migracion se llevo puesto el vocabulario viejo antes de tiempo.
-- ============================================================================
