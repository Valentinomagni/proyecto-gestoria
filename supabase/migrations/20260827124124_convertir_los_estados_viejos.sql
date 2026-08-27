-- ============================================================================
--  LOS TRAMITES QUE ESTABAN EN LOS ESTADOS QUE SE FUNDIERON
-- ============================================================================
--
--  Medido contra la base el 27/08/2026, antes de escribir esto:
--
--      recibido      4        presentado          1
--      controlado    1        retirado            1
--      entregado     1        pagado              0
--      presupuestado 1        frenado_por_saldo   0
--      anulado       4
--                             TOTAL              13
--
--  Dos filas para convertir. Es barato, y por eso es el momento de hacerlo: con datos reales
--  adentro esta conversion seria una decision mucho mas cara.
--
--  ============================================================================
--   EL ORDEN NO SE PUEDE INVERTIR
--  ============================================================================
--
--  Primero se convierten los datos y DESPUES se aprieta el check. Al reves, el `alter table`
--  falla porque hay filas que lo violan, y el mensaje habla del constraint y no de las filas.
--
--  ============================================================================
--   LA PRIMERA VERSION DE ESTA MIGRACION ESTABA MAL, DE DOS FORMAS
--  ============================================================================
--
--  Una revision adversarial la agarro antes de aplicarla, y las dos cosas se comprobaron contra
--  los datos reales:
--
--   1. Mandaba `presentado` a `resuelto`. MARTINEZ esta presentado con 520.000 reservados y CERO
--      costo real: presento y no pago. Marcarlo resuelto escribiria que pago algo que no pago.
--
--   2. Decia, textual, que la conversion "NO DISPARA MOVIMIENTOS DE PLATA". Es falso: el trigger
--      dispara al pasar a `resuelto` viniendo de cualquier otro estado, incluido `retirado`.
--      Habria escrito una segunda reversa y un segundo pago sobre BALAGUER, que ya los tenia.
--
--  La conversion corre sin sesion, asi que `mi_rol()` da 'consola' y la MAQUINA DE ESTADOS la
--  deja pasar. Pero `e_tramites_cuenta_corriente` NO mira el rol: mira `origen`, y estos tramites
--  son de la app. Por eso hay que apagarlo a mano.
-- ============================================================================

-- ------------------------------------------------------------
-- 1) Los datos
-- ------------------------------------------------------------

/*
  ============================================================================
   EL TRIGGER SE APAGA MIENTRAS SE CONVIERTE, Y ESTO NO ES OPCIONAL
  ============================================================================

  `e_tramites_cuenta_corriente` dispara cuando el estado pasa a 'resuelto'. Si corre durante la
  conversion, sobre un tramite que YA estaba en `retirado`, escribe una SEGUNDA reversa_reserva y
  un SEGUNDO pago — sobre uno que ya los tenia.

  Se midio contra la base antes de escribir esto. BALAGUER, en `retirado`, tiene:

      reserva           -600,00
      reversa_reserva   +600,00
      pago          -565.000,00

  Con el trigger encendido, la conversion habria escrito otra reversa de +600 y otro pago de
  -565.000. **Medio millon descontado dos veces de Paris Autos, sin un solo error en pantalla.**

  Apagar el trigger es lo correcto y no un atajo: esto NO es una persona avanzando un tramite, es
  un arrastre de datos. La plata de estos tramites ya se movio cuando correspondia.

  (La migracion anterior le agrego a esa rama una guarda por los sellos, que por si sola tambien
  habria frenado el doble pago. El `disable` se conserva igual: dos candados sobre medio millon
  de pesos no son uno de mas, y el `disable` dice la INTENCION —esto es un arrastre— que una
  guarda por fechas no dice.)
*/
alter table public.tramites disable trigger e_tramites_cuenta_corriente;

/*
  ============================================================================
   `pagado` Y `retirado` VAN A RESUELTO. `presentado` NO.
  ============================================================================

  La primera version de este plan mandaba los tres a `resuelto`, razonando que "ya habian ido al
  registro". Mirando los datos, eso es falso para `presentado`.

  MARTINEZ DIEGO ARMANDO esta en `presentado` con 520.000 reservados y CERO costo real cargado:
  presento la documentacion y no pago. En la cadena nueva `resuelto` significa las tres cosas
  juntas —presento, pago y retiro—, asi que marcarlo resuelto seria escribir que pago algo que no
  pago, y ademas liberaria su reserva de 520.000 sin descontar nada.

  Un tramite presentado y sin pagar todavia debe plata. Eso, en la cadena nueva, es
  `presupuestado`. La seccional que ya tiene cargada se conserva: la va a necesitar igual.
*/
update public.tramites
   set estado = 'resuelto',
       resuelto_at = coalesce(resuelto_at, retirado_at, pagado_at, now())
 where estado in ('pagado','retirado');

update public.tramites
   set estado = 'presupuestado'
 where estado = 'presentado';

-- Un tramite frenado por saldo estaba, en realidad, presupuestado esperando plata. Ahora eso se
-- deduce de la tarjeta y no se marca. El motivo escrito se conserva: es historia.
update public.tramites
   set estado = 'presupuestado'
 where estado = 'frenado_por_saldo';

alter table public.tramites enable trigger e_tramites_cuenta_corriente;

-- ------------------------------------------------------------
-- 2) Y recien ahora el check se aprieta
-- ------------------------------------------------------------

alter table public.tramites drop constraint if exists tramites_estado_valido;
alter table public.tramites add constraint tramites_estado_valido check (estado = any (array[
  'recibido','controlado','entregado','presupuestado','resuelto','devuelto','anulado'
]));

-- ------------------------------------------------------------
-- 3) `orden_estado` se queda con los siete
-- ------------------------------------------------------------

create or replace function public.orden_estado(p text)
returns int language sql immutable as $$
  select case p
    when 'recibido' then 1
    when 'controlado' then 2
    when 'entregado' then 3
    when 'presupuestado' then 4
    when 'resuelto' then 5
    when 'devuelto' then 6
    when 'anulado' then 99 end;
$$;

-- ------------------------------------------------------------
-- 4) SE CIERRA LA VENTANA DE CONVIVENCIA
--
--    La migracion anterior dejo el vocabulario viejo nombrado a proposito en cuatro lugares,
--    porque mientras hubiera tramites en esos estados sacarlo los habria dejado trabados o sin
--    proteccion. Ya no hay ninguno —el paso 1 los convirtio, y el paso 2 hace imposible que
--    vuelvan— asi que ahora se saca.
--
--    NO ES COSMETICA. Un nombre de estado que no puede existir mas, dejado adentro de una
--    guarda, es una linea que nadie va a poder explicar en seis meses: parece que protege algo y
--    no protege nada. Y peor, invita a copiarla.
-- ------------------------------------------------------------

-- 4.a) La maquina de estados se queda con las cinco transiciones de la cadena nueva.
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
      when 'recibido>controlado'     then rol in ('contable','gerencia')
      when 'controlado>entregado'    then rol in ('contable','gerencia')
      when 'entregado>presupuestado' then rol in ('gestora','contable','gerencia')
      when 'presupuestado>resuelto'  then rol in ('gestora','contable','gerencia')
      when 'resuelto>devuelto'       then rol in ('gestora','contable','gerencia')
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

    Las cuatro preguntas son EXACTAMENTE las que hacian por separado `presentado` (seccional y
    razon social con tarjeta), `pagado` (costo real) y `retirado` (documentacion). Ninguna se
    perdio: fundir los estados no afloja ningun control, solo junta el momento en que se
    contestan.
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

  if new.estado = 'devuelto' then
    new.devuelto_at := coalesce(new.devuelto_at, now());
  end if;

  return new;
end;
$fn$;

-- 4.b) El trigger de la cuenta corriente se queda con el vocabulario nuevo.
--
--      LAS GUARDAS POR SELLO SE CONSERVAN. No son parte de la ventana: cierran el agujero de ir
--      para atras y volver a resolver, que existe igual en la cadena nueva.
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

    EL FILTRO POR ESTADO NO SE PUEDE SACAR, y casi se saca. En la cadena nueva el unico estado
    que todavia debe plata es `presupuestado`.
  */
  if tg_op = 'INSERT' then
    if new.origen = 'preexistente'
       and new.estado = 'presupuestado'
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

       LA GUARDA POR ESTADO TAMPOCO SE PUEDE SACAR: despues de resolverse la reserva YA SE
       LIBERO, asi que un ajuste sobre ella comprometeria plata que no esta comprometida por nada.
  */
  elsif coalesce(old.deposito_solicitado,0) > 0
        and coalesce(new.deposito_solicitado,0) > 0
        and new.deposito_solicitado is distinct from old.deposito_solicitado
        and new.estado <> 'resuelto' then
    insert into public.movimientos
      (tarjeta_id, tipo, importe, tramite_id, gestora_id, concepto, origen, creado_por)
    values (new.tarjeta_id, 'ajuste_reserva',
            -(new.deposito_solicitado - old.deposito_solicitado),
            new.id, new.gestora_id, 'Correccion del presupuesto', 'tramite', auth.uid());
  end if;

  /*
    3) RESUELTO -> se devuelve TODO lo reservado y se descuenta el costo real.

    ANTES ESTO MIRABA `pagado`. Es el punto mas delicado de la cadena nueva: si mirara un estado
    que ya no existe, la reserva no se liberaria nunca y no habria ningun error que lo dijera.

    Y SE MIRA EL SELLO, que cierra un agujero que ya estaba abierto: ir para atras se puede
    —gerencia lo tiene permitido, y es lo que alguien hace cuando se equivoco en el costo real— y
    al volver a resolver se escribia una SEGUNDA reversa por todo lo reservado mas un SEGUNDO
    pago. Plata devuelta dos veces y cobrada dos veces, sin un solo error en pantalla.

    El sello es el testigo correcto porque NADA lo limpia: ir para atras cambia el estado y deja
    las fechas donde estaban.
  */
  if new.estado = 'resuelto' and old.estado <> 'resuelto'
     and old.resuelto_at is null and old.pagado_at is null then
    select coalesce(sum(-importe), 0) into v_reservado
      from public.movimientos
     where tramite_id = new.id and tipo in ('reserva','ajuste_reserva');

    if v_reservado <> 0 then
      insert into public.movimientos
        (tarjeta_id, tipo, importe, tramite_id, gestora_id, concepto, origen, creado_por)
      values (new.tarjeta_id, 'reversa_reserva', v_reservado, new.id, new.gestora_id,
              'Libera la reserva', 'tramite', auth.uid());
    end if;

    /*
      `not anulada` NO ES COSMETICA: la version que habia antes de esta tanda sumaba
      `where momento = 'real'` a secas, asi que una linea del costo real que alguien anulaba se
      seguia cobrando. La rama gemela, la del presupuesto, si excluia lo anulado — o sea que las
      dos mitades del mismo calculo no coincidian.
    */
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

    ESTE BLOQUE CASI DESAPARECE, y una revision adversarial lo agarro. La primera version de la
    migracion de la cadena tenia tres bloques donde la funcion vigente tenia cuatro, y como
    `create or replace function` reemplaza el cuerpo entero, este se perdia.

    La consecuencia habria sido: anular un tramite presupuestado deja la reserva viva PARA
    SIEMPRE. El comprometido de la tarjeta nunca baja, la Diferencia queda mal para siempre, y no
    hay error ni aviso. Y no habria forma de arreglarlo desde la app.

    SE MIRA EL SELLO ADEMAS DEL ESTADO, por lo mismo que la rama 3: un tramite que se resolvio y
    despues volvio para atras ya gasto su plata de verdad, aunque su estado de hoy no lo diga.
  */
  if new.estado = 'anulado' and old.estado <> 'anulado' then
    if old.estado <> 'resuelto' and old.resuelto_at is null and old.pagado_at is null then
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

-- 4.c) El presupuesto se cierra en los cuatro estados de la cadena nueva donde ya no se toca.
create or replace function public.b_conceptos_no_despues_de_pagado()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_estado text;
begin
  if new.momento <> 'presupuesto' then return new; end if;
  if auth.uid() is null then return new; end if;              -- consola de la base

  select estado into v_estado from public.tramites where id = new.tramite_id;

  if v_estado in ('resuelto', 'devuelto', 'anulado') then
    raise exception 'regla_tramite: El tramite ya esta %. El presupuesto no se cambia despues de resolverlo: corregilo con un ajuste en la cuenta.', v_estado;
  end if;

  return new;
end;
$$;

revoke execute on function public.b_conceptos_no_despues_de_pagado() from public, anon, authenticated;

-- 4.d) La policy de la gestora se queda con los tres estados que puede tocar.
--
--      SIN `resuelto` LA GESTORA NO PUEDE CERRAR SU TRAMITE Y NO VE NINGUN ERROR: la clausula
--      `using` no la deja, el update afecta cero filas, y PostgREST no devuelve error por cero
--      filas. La pantalla diria que guardo y el tramite se quedaria donde estaba. Es la peor
--      forma de fallar que hay.
drop policy if exists "tramites_update_gestora" on public.tramites;
create policy "tramites_update_gestora" on public.tramites for update to authenticated
  using (
    public.es_gestora() and gestora_id = public.mi_gestora_id()
    and estado in ('entregado','presupuestado','resuelto')
  )
  with check (public.es_gestora() and gestora_id = public.mi_gestora_id());

-- ------------------------------------------------------------
-- 5) El check del motivo de frenado ya no tiene estado que vigilar
--
--    La columna `motivo_frenado` NO se borra: aca nada se borra, y lo que se escribio explica
--    por que un tramite estuvo detenido.
-- ------------------------------------------------------------

alter table public.tramites drop constraint if exists tramites_frenado_con_motivo;

comment on column public.tramites.motivo_frenado is
  'Historia: por que un tramite estuvo frenado cuando `frenado_por_saldo` era un estado. Desde el '
  '27/08/2026 esperar plata se deduce de la tarjeta y no se marca, asi que esta columna ya no se '
  'escribe. No se borra: lo que dice sigue explicando algo que paso.';

-- ============================================================================
--  COMO COMPROBAR QUE QUEDO BIEN
--
--  1) No quedo ningun tramite en un estado viejo. Tiene que dar CERO filas:
--       select estado, count(*) from public.tramites
--        where estado in ('presentado','pagado','retirado','frenado_por_saldo')
--        group by estado;
--
--  1b) Y cada uno fue a donde correspondia. Habia 1 en `presentado` y 1 en `retirado`:
--       select estado, count(*) from public.tramites group by estado order by estado;
--      Esperado: `presupuestado` en 2 (el que ya estaba mas el que estaba presentado sin pagar)
--      y `resuelto` en 1 (el que estaba retirado). Si `resuelto` quedo en 2, se convirtio de mas.
--
--  2) Y el total de tramites es el MISMO que antes: 13.
--       select count(*) from public.tramites;
--
--  3) Un estado viejo ya no entra. TIENE QUE FALLAR:
--       update public.tramites set estado = 'pagado'
--        where id = (select id from public.tramites limit 1);
--     Esperado: viola tramites_estado_valido.
--
--  4) LA CONVERSION NO MOVIO PLATA. Es la comprobacion que importa de esta migracion:
--       select nombre, contable, comprometido from public.v_saldos order by orden;
--     Esperado: IDENTICO a lo anotado antes. Si Paris Autos bajo 565.000, el trigger disparo y
--     el `disable trigger` no funciono.
--
--     Y en el libro, sobre el tramite que estaba en `retirado`:
--       select tipo, importe from public.movimientos
--        where tramite_id = (select id from public.tramites where estado = 'resuelto'
--                             order by resuelto_at limit 1)
--        order by id;
--     Esperado: EXACTAMENTE tres filas —reserva, reversa_reserva, pago— y no seis.
--
--  5) Los sellos viejos se conservan:
--       select cliente_nombre, presentado_at, retirado_at, resuelto_at from public.tramites
--        where resuelto_at is not null;
--     Esperado: los que ya tenian presentado_at o retirado_at los conservan.
--
--  6) EL TRIGGER QUEDO ENCENDIDO. Se apago a mano en esta migracion, y si por lo que sea
--     quedara apagado, la app dejaria de mover plata SIN NINGUN ERROR: se cargarian presupuestos
--     y el comprometido no se movería. Es el peor final posible de esta migracion.
--       select tgenabled from pg_trigger
--        where tgrelid = 'public.tramites'::regclass and tgname = 'e_tramites_cuenta_corriente';
--     Esperado: 'O' (encendido). Si dice 'D', esta apagado.
-- ============================================================================
