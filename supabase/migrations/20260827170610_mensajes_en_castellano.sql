-- ============================================================================
--  LOS MENSAJES DE ERROR, EN CASTELLANO DE VERDAD
-- ============================================================================
--
--  ============================================================================
--   SIN TILDE NO ES VOSEO, Y ESO SE VE EN PANTALLA
--  ============================================================================
--
--  `src/lib/fallas.ts:207` corta el texto despues de `regla_tramite:` y lo pone LITERAL en la
--  pantalla. Lo que esta escrito aca es exactamente lo que lee la gestora.
--
--  Y estaba escrito sin una sola tilde. En rioplatense la tilde ES el voseo:
--
--      "Anota"    es tuteo o tercera persona.  "Anotá"    es voseo.
--      "Escribi"  no es nada.                  "Escribí"  es voseo.
--      "carga"    es tuteo.                    "cargá"    es voseo.
--
--  O sea que los unicos mensajes que le hablan directo a la persona —los que dan una
--  instruccion— eran justo los que perdian el voseo. Al lado, la interfaz esta impecable:
--  "Cargá el primero...", "Probá con otro texto", "Buscalo antes de cargarlo". El contraste se
--  ve en la misma pantalla, y el error aparece justo cuando algo no sale.
--
--  Ya habia precedente propio anotado en `docs/ESTADO.md`: el extracto decia "Correccion" sin
--  tilde y se registro como defecto. Es el mismo defecto, diecisiete veces.
--
--  ============================================================================
--   Y TRES MENSAJES NO DECIAN QUE HACER
--  ============================================================================
--
--   1. "Esa razon social todavia no tiene Tarjeta Habitualista asignada" era una pared: ni
--      `razon_social_id` ni `medio_pago` son editables desde la ficha, asi que la gestora no
--      podia arreglarlo ni aunque quisiera. Ahora termina diciendo a quien avisarle.
--
--   2. "Falta cargar lo que salio de verdad" obligaba a traducir: el panel de la pantalla se
--      llama "Costo real". Ahora lo nombra igual que la pantalla, y dice donde esta.
--
--   3. "No se puede pasar de % a % con el rol %" imprimia los codigos internos y le achacaba el
--      problema a QUIEN ERA la persona, en vez de a que faltaba. Ademas usaba vocabulario que no
--      coincide con la pantalla: `entregado` alli se muestra como "Entregado a gestoría".
--      Ahora nombra la causa mas comun de verdad —que alguien movio el tramite mientras vos lo
--      tenias abierto— y dice que hacer: recargar y mirar en que paso quedo.
--
--  ============================================================================
--   COMO SE ESCRIBIO ESTA MIGRACION, QUE IMPORTA MAS QUE LO QUE DICE
--  ============================================================================
--
--  Los cuerpos de las tres funciones NO SE RETIPEARON. Se extrajeron con un script de las
--  migraciones que las crearon —20260827124124 y 20260827123128— y se les cambiaron SOLO las
--  cadenas de texto, comprobando que cada una de las 17 apareciera antes de reemplazarla.
--
--  Retipear a mano una funcion de 120 lineas para arreglar tildes es exactamente como se pierde
--  una rama, y esta tanda ya estuvo a punto de perder una: la de anulacion del trigger de la
--  cuenta corriente, que habria dejado reservas vivas para siempre.
--
--  Se conto ademas que las tres funciones extraidas tuvieran los 17 `raise exception` de las
--  originales, y que `e_tramites_cuenta_corriente` tuviera CERO — por eso no se toca.
--
--  NO CAMBIA NINGUNA CONDUCTA: solo cambian las cadenas de texto.
-- ============================================================================

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
      raise exception 'regla_tramite: Un trámite nuevo entra en estado recibido';
    end if;
    new.autorizado_por := coalesce(new.autorizado_por, auth.uid());
    new.creado_por     := coalesce(new.creado_por, auth.uid());
    return new;
  end if;

  if new.estado is not distinct from old.estado then return new; end if;
  if rol = 'consola' then return new; end if;

  if new.estado = 'anulado' then
    if old.estado = 'devuelto' then
      raise exception 'regla_tramite: Un trámite ya devuelto no se anula. Corregilo con un ajuste en la cuenta.';
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
    raise exception 'regla_tramite: Ese paso no corresponde ahora. Puede que alguien haya movido el trámite mientras lo tenías abierto: recargá la pantalla y fijate en qué paso quedó.';
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
      raise exception 'regla_tramite: Para entregar el trámite hace falta elegir la gestora';
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
      raise exception 'regla_tramite: Falta indicar en qué seccional se presentó';
    end if;

    if new.medio_pago = 'tarjeta_habitualista'
       and not exists (select 1 from public.razones_sociales r
                        where r.id = new.razon_social_id and r.tarjeta_id is not null) then
      raise exception 'regla_tramite: Esa razón social todavía no tiene Tarjeta Habitualista asignada. Avisale a administración para que se la asigne: desde acá no se puede.';
    end if;

    select coalesce(sum(importe),0) into total_real
      from public.tramite_conceptos
     where tramite_id = new.id and momento = 'real' and not anulada;
    if total_real <= 0 then
      raise exception 'regla_tramite: Falta cargar el costo real, discriminado por concepto. Es el panel Costo real, más abajo.';
    end if;

    if nullif(btrim(coalesce(new.documentacion_retirada,'')),'') is null then
      raise exception 'regla_tramite: Anotá qué documentación retiraste: título, cédula, chapas';
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

create or replace function public.b_conceptos_no_despues_de_pagado()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_estado text;
begin
  if new.momento <> 'presupuesto' then return new; end if;
  if auth.uid() is null then return new; end if;              -- consola de la base

  select estado into v_estado from public.tramites where id = new.tramite_id;

  if v_estado in ('resuelto', 'devuelto', 'anulado') then
    raise exception 'regla_tramite: El trámite ya está %. El presupuesto no se cambia después de resolverlo: corregilo con un ajuste en la cuenta.', v_estado;
  end if;

  return new;
end;
$$;

create or replace function public.anular_movimiento(p_id bigint, p_motivo text)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  m       public.movimientos;
  v_nuevo bigint;
begin
  if not public.es_oficina() then
    raise exception 'regla_tramite: Sólo gerencia y administración contable pueden anular un movimiento';
  end if;

  if nullif(btrim(coalesce(p_motivo, '')), '') is null then
    raise exception 'regla_tramite: Escribí por qué se anula. Un movimiento sin motivo no se puede explicar después.';
  end if;

  select * into m from public.movimientos where id = p_id;
  if not found then
    raise exception 'regla_tramite: Ese movimiento no existe';
  end if;

  if m.tipo not in ('ingreso','saldo_inicial','ajuste') then
    raise exception 'regla_tramite: Ese movimiento lo generó un trámite. Se corrige cambiando el presupuesto del trámite, no desde la cuenta.';
  end if;

  /*
    NO SE ANULA UNA ANULACION, y esto cierra un agujero del 21/08/2026.

    La compensacion que esta misma funcion escribe es de tipo `ajuste`, asi que pasaba el filtro
    de arriba. Anularla habria devuelto la plata al saldo contable mientras el original seguia
    marcado como anulado en la pantalla: la cuenta diciendo una cosa y la pantalla otra.

    Si hay que revertir una anulacion, se carga el movimiento de nuevo. Queda mas largo en el
    extracto y queda explicable, que es lo que importa.

    VA ANTES DE LA COMPROBACION DE `anulado` a proposito: si alguien apunta a una compensacion,
    el mensaje que tiene que leer es este, que le dice que hacer, y no "ya estaba anulado", que
    ademas seria falso.
  */
  if m.corrige_movimiento_id is not null then
    raise exception 'regla_tramite: Ese movimiento ES la anulación de otro. Si hay que revertirla, cargá el movimiento de nuevo.';
  end if;

  /*
    ANTES ESTO ERA UN `exists` CONTRA LA OTRA FILA. Ahora mira la columna, que dice lo mismo y
    es la misma que mira el indice: si las dos leyeran cosas distintas, la funcion podria dejar
    anular dos veces algo que el indice considera vivo.
  */
  if m.anulado then
    raise exception 'regla_tramite: Ese movimiento ya estaba anulado';
  end if;

  /*
    LA FECHA DE ACREDITACION SE COPIA DEL ORIGINAL, no se pone hoy.

    Un deposito ordenado hoy acredita maniana. Si la compensacion acreditara hoy, el saldo
    contable bajaria hoy por una plata que todavia no habia subido, y la pantalla mostraria un
    saldo menor que el del sitio durante un dia entero. Con la misma fecha, los dos entran
    juntos y en ningun momento hay una cifra que no se pueda explicar.
  */
  insert into public.movimientos
    (tarjeta_id, tipo, importe, fecha, fecha_acreditacion, concepto, observacion,
     corrige_movimiento_id, origen, creado_por)
  values (m.tarjeta_id, 'ajuste', -m.importe, now(), m.fecha_acreditacion,
          'Anulación de ' || coalesce(m.concepto, m.tipo),
          btrim(p_motivo), p_id, 'app', auth.uid())
  returning id into v_nuevo;

  -- Se marca acá, en la misma transacción que la compensación: si una falla, no queda ninguna.
  update public.movimientos set anulado = true where id = p_id;

  return v_nuevo;
end;
$$;
-- Al recrear una funcion Postgres NO conserva lo revocado. Hay que volver a ponerlo cada vez.
revoke execute on function public.b_conceptos_no_despues_de_pagado() from public, anon, authenticated;
revoke all on function public.anular_movimiento(bigint, text) from public, anon;
grant execute on function public.anular_movimiento(bigint, text) to authenticated;

-- ============================================================================
--  COMO COMPROBAR QUE QUEDO BIEN
--
--  1) Los 17 mensajes tienen tilde donde corresponde:
--       select proname, pg_get_functiondef(oid) from pg_proc
--        where proname in ('c_tramites_transicion','b_conceptos_no_despues_de_pagado',
--                          'anular_movimiento');
--
--  2) NINGUNA CONDUCTA CAMBIO. `npm run test:rls` tiene que seguir en 48, con los mismos
--     rechazos. Si alguna prueba pasa a fallar, se perdio una guarda al reescribir.
-- ============================================================================
