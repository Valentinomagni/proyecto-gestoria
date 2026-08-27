-- ============================================================================
--  LA PLATA SE CONCILIA CONTRA EL LIBRO, NO SE DEDUCE DEL PASO QUE SE DIO
-- ============================================================================
--
--  ============================================================================
--   TRES DEFECTOS, Y LOS TRES SON EL MISMO
--  ============================================================================
--
--  Una revision contable encontro tres formas de que la plata quede mal, y despues nombro lo que
--  tienen en comun, que es lo que de verdad importa:
--
--      "un `if` que decide si escribir plata mirando el estado o el sello, en vez de mirar
--       CUANTO QUEDA COMPROMETIDO y CUANTO YA SE COBRO. Mientras las ramas comparen situaciones
--       en vez de saldos, cada camino nuevo hacia `resuelto` va a necesitar su propia guarda, y
--       la que falte no va a dar error."
--
--  Los tres, medidos contra la base:
--
--   1. ANULAR Y REVIVIR ESCRIBIA UNA SEGUNDA REVERSA. La rama que liberaba al resolver sumaba
--      `reserva` y `ajuste_reserva`; la rama que liberaba al anular sumaba ESOS DOS MAS
--      `reversa_reserva`. O sea que la primera no descontaba lo ya liberado. Anular un tramite
--      de 520.000 y despues revivirlo y resolverlo dejaba el comprometido de Paris Autos en
--      -68.765,44: MEDIO MILLON DE DISPONIBLE QUE NO EXISTE, y un comprometido negativo que no
--      detectaba nadie.
--
--   2. VACIAR EL PRESUPUESTO DEJABA LA RESERVA VIVA PARA SIEMPRE, Y ESTABA PASANDO HOY.
--      `h_conceptos_total_presupuesto` guarda NULL cuando la suma de lineas vivas da cero —lo
--      dice su propio comentario— y la rama de correccion exigia `new.deposito_solicitado > 0`.
--      Anular la ultima linea hacia 450000 -> NULL, la condicion daba falso, y no se escribia
--      ningun ajuste.
--
--      Medido: BALAGUER JUAN ANTONIO, `presupuestado`, pide NULL, y 450.000 comprometidos en el
--      libro. Paris Autos mostraba 971.234,56 comprometidos y 450.000 de eso colgaban de un
--      tramite que en pantalla no pide nada.
--
--   3. CORREGIR EL COSTO REAL DESPUES DE RESOLVER NO SE COBRABA. La guarda por sellos que esta
--      misma tanda agrego —correcta para no liberar dos veces la reserva— tambien tapaba la
--      escritura del pago, porque las dos estaban adentro del mismo `if`. Y el panel Costo real
--      sigue abierto en `resuelto`. Resultado medido: la ficha decia 665.000 y la tarjeta habia
--      cobrado 565.000.
--
--   4. Y LA RESERVA SE ESCRIBIA ANTES DE TIEMPO. Nacia al cambiar `deposito_solicitado`, sin
--      mirar el estado, y el panel Presupuesto esta abierto desde `recibido`. Medido: MARTORINA
--      ALEJANDRO, en `recibido`, sin gestora y sin checklist, con 128.000 comprometidos — el
--      100% del comprometido de Paris Cars.
--
--  ============================================================================
--   EL ARREGLO NO ES CUATRO PARCHES: ES DEJAR DE PREGUNTAR POR LA SITUACION
--  ============================================================================
--
--  `conciliar_tramite` no pregunta de donde venia el tramite ni que boton se apreto. Pregunta
--  dos cosas y escribe la diferencia:
--
--      cuanto dice el libro que esta comprometido   contra   cuanto DEBERIA estar
--      cuanto dice el libro que ya se cobro         contra   cuanto DEBERIA estar cobrado
--
--  Eso es IDEMPOTENTE por construccion: correrla dos veces no escribe nada la segunda. Y por eso
--  cierra los cuatro defectos de arriba con la misma cuenta, y cierra tambien los caminos que
--  todavia no se probaron — que era lo que la revision advertia.
--
--  ============================================================================
--   LOS SIGNOS LOS MANDA EL `check`, Y CONVIENE TENERLO A LA VISTA
--  ============================================================================
--
--      reversa_reserva  e  ingreso   ->  importe SIEMPRE POSITIVO
--      reserva          y  pago      ->  importe SIEMPRE NEGATIVO
--      ajuste_reserva   y  ajuste    ->  cualquiera de los dos
--
--  Por eso devolver plata de un costo real corregido PARA ABAJO no puede ser un `pago`: seria un
--  pago positivo y el check lo rechaza. Va como `ajuste`, que es exactamente para lo que existe,
--  y lleva su observacion escrita.
--
--  Y por eso una segunda reserva no puede ser un `reserva`: `movimientos_una_reserva_por_tramite`
--  deja UNA sola por tramite. La segunda en adelante son `ajuste_reserva`.
-- ============================================================================

-- ------------------------------------------------------------
-- 1) LA CONCILIACION
-- ------------------------------------------------------------

create or replace function public.conciliar_tramite(p_tramite uuid, p_motivo text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  t                public.tramites;
  v_comprometido   numeric(14,2);   -- lo que el libro dice HOY
  v_cobrado        numeric(14,2);
  v_meta_comp      numeric(14,2);   -- lo que el libro DEBERIA decir
  v_meta_cobro     numeric(14,2);
  v_delta          numeric(14,2);
  v_hubo_reserva   boolean;
  v_fue_al_registro boolean;
begin
  select * into t from public.tramites where id = p_tramite;
  if not found then return; end if;

  if t.medio_pago <> 'tarjeta_habitualista' then return; end if;
  if t.tarjeta_id is null then return; end if;

  -- ----------------------------------------------------------
  -- Lo que el libro dice hoy
  -- ----------------------------------------------------------
  select coalesce(sum(-importe) filter (
           where tipo in ('reserva','ajuste_reserva','reversa_reserva')), 0),
         coalesce(sum(-importe) filter (where tipo in ('pago','ajuste')), 0),
         coalesce(bool_or(tipo = 'reserva'), false)
    into v_comprometido, v_cobrado, v_hubo_reserva
    from public.movimientos where tramite_id = p_tramite;

  /*
    FUE AL REGISTRO ALGUNA VEZ. Se mira el sello y no solo el estado, porque gerencia puede
    mandar un tramite para atras —es lo que se hace cuando el costo real esta mal— y la plata que
    salio por ventanilla no vuelve por cambiar un estado.

    Nada limpia los sellos al ir para atras, asi que sirven de testigo.
  */
  v_fue_al_registro := t.estado in ('resuelto','devuelto')
                       or t.resuelto_at is not null
                       or t.pagado_at is not null;

  -- ----------------------------------------------------------
  -- Lo que el libro DEBERIA decir
  -- ----------------------------------------------------------

  /*
    SOLO UN TRAMITE PRESUPUESTADO COMPROMETE PLATA, y esto arregla el defecto 4.

    Antes la reserva nacia al cambiar el importe pedido, sin mirar el estado, y el panel
    Presupuesto esta abierto desde `recibido`. Un tramite que no paso el control, sin gestora
    asignada y que puede no salir nunca, comprometia plata que la oficina veia como gastada.

    Y `and not v_fue_al_registro` no es de mas: si un tramite ya resuelto vuelve a
    `presupuestado`, su plata YA SE PAGO. Volver a comprometerla reservaria por segunda vez algo
    que el banco ya descontó.
  */
  v_meta_comp := case
    when t.estado = 'presupuestado' and not v_fue_al_registro
      then coalesce(t.deposito_solicitado, 0)
    else 0
  end;

  /*
    EL COBRO SIGUE AL COSTO REAL VIGENTE, y esto arregla el defecto 3.

    Si el tramite fue al registro, lo cobrado tiene que ser lo que dicen las lineas del costo
    real HOY. Corregir una linea despues de resolver escribe la diferencia, para arriba o para
    abajo. Antes no escribia nada: la ficha decia un numero y la tarjeta habia cobrado otro.
  */
  if v_fue_al_registro then
    select coalesce(sum(importe),0) into v_meta_cobro
      from public.tramite_conceptos
     where tramite_id = p_tramite and momento = 'real' and not anulada;
  else
    v_meta_cobro := 0;
  end if;

  -- ----------------------------------------------------------
  -- Y se escribe la DIFERENCIA, nunca el total
  -- ----------------------------------------------------------

  v_delta := v_meta_comp - v_comprometido;
  if v_delta <> 0 then
    insert into public.movimientos
      (tarjeta_id, tipo, importe, tramite_id, gestora_id, concepto, observacion, origen, creado_por)
    values (
      t.tarjeta_id,
      case
        when not v_hubo_reserva then 'reserva'          -- la primera, y hay una sola por tramite
        when v_meta_comp = 0    then 'reversa_reserva'  -- libera todo lo que quedaba
        else 'ajuste_reserva'
      end,
      -v_delta,
      p_tramite, t.gestora_id,
      case
        when not v_hubo_reserva     then 'Presupuesto - ' || t.cliente_nombre
        when t.estado = 'anulado'   then 'Anulado: libera la reserva'
        when v_meta_comp = 0 and v_fue_al_registro then 'Libera la reserva'
        when v_meta_comp = 0        then 'Presupuesto vaciado: libera la reserva'
        else 'Correccion del presupuesto'
      end,
      p_motivo, 'tramite', auth.uid());
  end if;

  v_delta := v_meta_cobro - v_cobrado;
  if v_delta <> 0 then
    insert into public.movimientos
      (tarjeta_id, tipo, importe, tramite_id, gestora_id, concepto, observacion, origen, creado_por)
    values (
      t.tarjeta_id,
      /*
        DEVOLVER NO PUEDE SER UN `pago`. El check exige que todo `pago` sea negativo, asi que un
        costo real corregido para abajo va como `ajuste` — que es para lo que existe— y por eso
        lleva observacion obligatoria, que tambien la exige un check.
      */
      case when v_delta > 0 then 'pago' else 'ajuste' end,
      -v_delta,
      p_tramite, t.gestora_id,
      case when v_delta > 0
        then 'Pago en el registro - ' || coalesce(t.seccional,'')
        else 'Correccion del costo real - ' || coalesce(t.seccional,'')
      end,
      coalesce(p_motivo, case when v_delta > 0 then null else 'El costo real bajo despues de resolverlo' end),
      'tramite', auth.uid());
  end if;
end;
$$;

revoke all on function public.conciliar_tramite(uuid, text) from public, anon, authenticated;

comment on function public.conciliar_tramite(uuid, text) is
  'Compara lo que el libro dice que esta comprometido y cobrado contra lo que deberia estar, y '
  'escribe la diferencia. Es idempotente: correrla dos veces no escribe nada la segunda. La '
  'llaman el trigger de tramites y el de las lineas del costo real.';

-- ------------------------------------------------------------
-- 2) EL TRIGGER DE TRAMITES PASA A LLAMARLA
-- ------------------------------------------------------------

create or replace function public.e_tramites_cuenta_corriente()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.medio_pago <> 'tarjeta_habitualista' then return new; end if;
  if new.tarjeta_id is null then return new; end if;

  /*
    ALTA de un tramite preexistente: los que estaban a mitad de camino el dia del corte.

      Sin pagar todavia -> SI reserva: esa plata sigue comprometida y sigue en el banco.
      Ya pagado         -> NINGUN movimiento: el banco ya lo descontó y está dentro del
                           saldo_inicial. Generarlo lo descontaria DOS VECES.

    Se deja explicito y no se delega en la conciliacion porque un preexistente NO es un tramite
    que la app hizo avanzar: es un arrastre, y el unico estado que todavia debe plata al llegar
    es `presupuestado`.
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

  /*
    Y NADA MAS. Todo lo que antes eran cuatro ramas con sus guardas —primera carga, correccion,
    liberacion al resolver, liberacion al anular— es una sola cuenta que no depende de por donde
    se llego.
  */
  perform public.conciliar_tramite(new.id);
  return new;
end;
$$;

revoke execute on function public.e_tramites_cuenta_corriente() from public, anon, authenticated;

-- ------------------------------------------------------------
-- 3) Y LAS LINEAS DEL COSTO REAL TAMBIEN LA LLAMAN
--
--    SIN ESTO EL DEFECTO 3 QUEDA A MEDIAS. Corregir el costo real de un tramite ya resuelto no
--    cambia ninguna columna de `tramites`, asi que el trigger de arriba NO DISPARA. La ficha
--    mostraria el numero nuevo y la tarjeta seguiria con el viejo.
--
--    Las lineas de `presupuesto` ya tienen quien las mire: `h_conceptos_total_presupuesto`
--    actualiza `deposito_solicitado`, y ese update si dispara el trigger de tramites.
-- ------------------------------------------------------------

create or replace function public.i_conceptos_reales_concilian()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_tramite uuid := coalesce(new.tramite_id, old.tramite_id);
  v_momento text := coalesce(new.momento, old.momento);
begin
  if v_momento = 'real' then
    perform public.conciliar_tramite(v_tramite);
  end if;
  return null;
end;
$$;

revoke execute on function public.i_conceptos_reales_concilian() from public, anon, authenticated;

drop trigger if exists i_conceptos_reales_concilian on public.tramite_conceptos;
create trigger i_conceptos_reales_concilian
  after insert or update or delete on public.tramite_conceptos
  for each row execute function public.i_conceptos_reales_concilian();

-- ------------------------------------------------------------
-- 4) LA GESTORA NO PUEDE ESCRIBIR LOS SELLOS
--
--    ============================================================================
--     ERA UN AGUJERO QUE ESTA MISMA TANDA ABRIO
--    ============================================================================
--
--    `pagado_at` estaba en la lista de permitidos de `b_tramites_bloquear_campos` desde antes, y
--    no molestaba a nadie. Pero esta tanda le agrego a la conciliacion una guarda que se apoya
--    JUSTO en ese sello, para no liberar dos veces la reserva.
--
--    Resultado, probado por la revision con una sesion de gestora real: escribir `pagado_at` a
--    mano —un update que ni siquiera cambia el estado, asi que la maquina de estados lo deja
--    pasar— apagaba para siempre los movimientos de plata de ese tramite. 520.000 comprometidos
--    en Paris Autos que ya no bajan nunca, sin un solo error en pantalla.
--
--    Los cuatro sellos los escribe `c_tramites_transicion`, que corre DESPUES de este guardia,
--    asi que sacarlos de la lista no rompe nada. Es la misma razon por la que `resuelto_at` nunca
--    hizo falta que estuviera — y esa asimetria era el defecto.
-- ------------------------------------------------------------

create or replace function public.b_tramites_bloquear_campos()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  permitidos text[] := array[
    'deposito_solicitado','seccional','numero_pago_registro','observaciones_gestora',
    'documentacion_retirada','dominio','estado','actualizado_at','actualizado_por'
  ];
begin
  if auth.uid() is null then return new; end if;              -- consola de la base
  if public.es_gerencia() or public.es_contable() then return new; end if;

  if not public.es_gestora() then
    raise exception 'regla_tramite: Tu usuario no tiene permiso para modificar trámites';
  end if;

  if (to_jsonb(new) - permitidos) is distinct from (to_jsonb(old) - permitidos) then
    raise exception 'regla_tramite: Una gestora sólo puede cargar el presupuesto, los costos, el dominio, la seccional, el número de pago y sus observaciones';
  end if;

  return new;
end;
$$;

revoke execute on function public.b_tramites_bloquear_campos() from public, anon, authenticated;

-- ------------------------------------------------------------
-- 5) UN MOVIMIENTO NO PUEDE NACER ANULADO NI FABRICAR UNA COMPENSACION
--
--    `movimientos_insert` nombra los tipos permitidos uno por uno y no mira las dos columnas de
--    las que ahora depende el invariante. Es la misma forma que ya mordio dos veces: columna
--    nueva, guardian que es una lista explicita, nadie toco la lista.
--
--    Se probo, con rollback: un `ingreso` con `anulado = true` entraba, subia el `contable`
--    —que no filtra anulados— y la pantalla lo dibujaba TACHADO. Y una compensacion escrita a
--    mano dejaba el original con `anulado = false`, que devolvia el defecto bloqueante del saldo
--    inicial.
--
--    `anular_movimiento` sigue pudiendo escribir las dos: es SECURITY DEFINER y no pasa por RLS.
-- ------------------------------------------------------------

drop policy if exists "movimientos_insert" on public.movimientos;
create policy "movimientos_insert" on public.movimientos for insert to authenticated
  with check (
    public.es_oficina()
    and tipo in ('saldo_inicial','ingreso','ajuste')
    and not anulado
    and corrige_movimiento_id is null
  );

-- ------------------------------------------------------------
-- 6) LA VISTA DEJA DE PREGUNTARLE LA FECHA A UTC
--
--    `current_date` en una base que corre en UTC es el dia siguiente entre las 21:00 y las 23:59
--    de Argentina. En esas tres horas un deposito que acredita maniana se contaba como acreditado
--    HOY: salia de `en_transito`, subia el disponible, y podia sacar una tarjeta de la lista de
--    "esperando plata" antes de que el banco la hubiera acreditado.
--
--    El front ya usa `hoyArgentina()`, asi que durante esas tres horas el front y la vista no
--    coincidian sobre que dia era.
-- ------------------------------------------------------------

create or replace function public.hoy_argentina()
returns date language sql stable as $$
  select (now() at time zone 'America/Argentina/Buenos_Aires')::date;
$$;

comment on function public.hoy_argentina() is
  'El dia de hoy en Buenos Aires. La base corre en UTC, asi que `current_date` adelanta el dia '
  'entre las 21:00 y las 23:59 de Argentina. Toda vista que decida si algo esta acreditado tiene '
  'que usar esta y no `current_date`.';

grant execute on function public.hoy_argentina() to authenticated;

create or replace view public.v_saldos with (security_invoker = true) as
select th.id as tarjeta_id,
       th.nombre,
       coalesce(sum(m.importe) filter (
         where m.tipo in ('saldo_inicial','ingreso','pago','ajuste')
           and m.fecha_acreditacion <= public.hoy_argentina()), 0) as contable,
       coalesce(sum(m.importe) filter (
         where m.tipo = 'ingreso' and m.fecha_acreditacion > public.hoy_argentina()
           and not m.anulado), 0) as en_transito,
       coalesce(-sum(m.importe) filter (
         where m.tipo in ('reserva','ajuste_reserva','reversa_reserva')), 0) as comprometido,
       th.orden
  from public.tarjetas_habitualista th
  left join public.movimientos m on m.tarjeta_id = th.id
 group by th.id, th.nombre, th.orden;

comment on view public.v_saldos is
  'contable tiene que dar IGUAL al saldo del sitio de Habitualista. en_transito no cuenta los '
  'depositos anulados. La cuarta cifra de la pantalla, contable - comprometido, es lo que hoy no '
  'se ve, y es por lo que dos personas comprometen la misma plata.';

revoke insert, update, delete, truncate on public.v_saldos from anon, authenticated;
grant select on public.v_saldos to authenticated;

-- ------------------------------------------------------------
-- 7) Y SE ARREGLA LO QUE YA ESTABA MAL EN LOS DATOS
--
--    La conciliacion es idempotente, asi que correrla sobre TODOS los tramites no toca los que
--    estan bien y arregla los que no. Es la forma correcta de reparar: la misma cuenta que de
--    ahora en mas mantiene el libro sano.
--
--    Lo que va a mover, medido antes de escribir esto:
--
--      BALAGUER JUAN ANTONIO   presupuestado, pide NULL   ->  libera 450.000,00
--      MARTORINA ALEJANDRO     recibido,  pide 128.000    ->  libera 128.000,00
--      VISIBILIDAD DESDE...    entregado, pide 1.234,56   ->  libera   1.234,56
--      MARTINEZ DIEGO ARMANDO  presupuestado, 520.000     ->  no se toca
--      BALAGUER (el resuelto)  resuelto, 565.000 cobrado  ->  no se toca
--
--    Paris Autos pasa de 971.234,56 comprometidos a 520.000,00, y Paris Cars de 128.000,00 a 0.
--    NO ES PLATA QUE APARECE: es plata que nunca estuvo comprometida y que la pantalla mostraba
--    como gastada. El disponible sube porque el numero de antes estaba mal.
-- ------------------------------------------------------------

do $$
declare r record;
begin
  for r in select id from public.tramites order by recibido_at loop
    perform public.conciliar_tramite(
      r.id,
      'Conciliacion del 27/08/2026: la reserva no seguia al presupuesto vigente');
  end loop;
end $$;

-- ============================================================================
--  COMO COMPROBAR QUE QUEDO BIEN
--
--  1) NO QUEDA NINGUNA RESERVA HUERFANA. Tiene que dar CERO filas:
--       select t.cliente_nombre, t.estado, t.deposito_solicitado,
--              coalesce(sum(-m.importe),0) as comprometido
--         from public.tramites t
--         left join public.movimientos m on m.tramite_id = t.id
--          and m.tipo in ('reserva','ajuste_reserva','reversa_reserva')
--        group by 1,2,3
--       having coalesce(sum(-m.importe),0) <> 0
--          and (t.estado <> 'presupuestado'
--               or coalesce(sum(-m.importe),0) <> coalesce(t.deposito_solicitado,0));
--
--  2) EL COMPROMETIDO NUNCA ES NEGATIVO:
--       select nombre, comprometido from public.v_saldos where comprometido < 0;
--     Esperado: cero filas.
--
--  3) Y ES IDEMPOTENTE. Correr la conciliacion de nuevo NO tiene que escribir nada:
--       select count(*) from public.movimientos;   -- anotar
--       do $x$ declare r record; begin
--         for r in select id from public.tramites loop
--           perform public.conciliar_tramite(r.id); end loop; end $x$;
--       select count(*) from public.movimientos;   -- TIENE QUE DAR EL MISMO NUMERO
--
--  4) LA GESTORA YA NO PUEDE ESCRIBIR UN SELLO. Con su sesion, TIENE QUE FALLAR:
--       update tramites set pagado_at = now() where id = '<uno suyo>';
--     Esperado: 'Una gestora sólo puede cargar el presupuesto...'.
--
--  5) UN MOVIMIENTO NO NACE ANULADO. Con gerencia, TIENE QUE FALLAR:
--       insert into movimientos (tarjeta_id, tipo, importe, concepto, anulado)
--       values ('<tarjeta>', 'ingreso', 1, 'prueba', true);
--
--  6) LA FECHA ES LA DE ARGENTINA:
--       select public.hoy_argentina(), current_date;
--     Entre las 21 y las 24 de Argentina tienen que dar DISTINTO.
-- ============================================================================
