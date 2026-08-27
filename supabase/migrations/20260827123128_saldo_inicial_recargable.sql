-- ============================================================================
--  EL SALDO INICIAL SE PUEDE VOLVER A CARGAR DESPUES DE ANULARLO
-- ============================================================================
--
--  ============================================================================
--   EL DEFECTO, Y ES BLOQUEANTE
--  ============================================================================
--
--  Medido el 26/08/2026 contra la base, y vuelto a medir el 27/08/2026 antes de escribir esto:
--
--      id 8    Paris Autos SA   2.505.627,92  ANULADO
--      id 98   Paris Cars       5.000.000,00  ANULADO
--
--  Las dos tarjetas estan sin poder recargar su saldo de arranque. Al intentarlo, la base
--  responde que el dato ya fue ingresado.
--
--  La causa, leida del indice vivo:
--
--      CREATE UNIQUE INDEX movimientos_un_saldo_inicial ON public.movimientos
--        USING btree (tarjeta_id) WHERE (tipo = 'saldo_inicial'::text)
--
--  Es un indice unico parcial y NO excluye los anulados. El anulado sigue ocupando el lugar,
--  aunque su plata ya se compenso a cero.
--
--  ============================================================================
--   ES LA TERCERA VEZ QUE APARECE ESTA FORMA
--  ============================================================================
--
--  La primera fue `tramite_conceptos_uno_por_momento`, arreglada el 21/08/2026 con exactamente
--  este mismo cambio y con el porque escrito al lado. No se generalizo, y cinco dias despues
--  volvio a morder en otro lado.
--
--  Por eso ademas de arreglar este indice, esta tanda trae un guardian —`npm run indices`— que
--  falla si aparece cualquier indice unico parcial que se olvide de excluir lo anulado. La
--  regla que no tiene guardian se incumple sola.
--
--  ============================================================================
--   Y DE PASO SE CIERRA UN AGUJERO QUE SE ABRIO EL 21/08/2026
--  ============================================================================
--
--  `anular_movimiento` acepta como objetivo cualquier `ajuste`. Pero la compensacion que ella
--  misma escribe ES un ajuste. O sea que se podia anular la anulacion.
--
--  El resultado seria un saldo contable que vuelve a subir mientras `en_transito` sigue
--  excluyendo el original —porque hay una correccion apuntandolo— y la pantalla mostrando el
--  movimiento TACHADO con la plata de vuelta adentro. La pantalla diciendo una cosa y el saldo
--  otra es exactamente lo que este proyecto no puede permitirse.
--
--  Se cierra con una condicion: no se anula lo que ya es una anulacion.
--
--  ES ADITIVA: no borra ni cambia el importe de ninguna fila. Lo unico que escribe sobre datos
--  existentes es marcar `anulado = true` en lo que YA estaba anulado, que es poner al dia una
--  columna nueva con un hecho que ya era cierto.
-- ============================================================================

-- ------------------------------------------------------------
-- 1) El indice pasa a excluir lo anulado
--
--    LA FORMA OBVIA NO COMPILA, y conviene saberlo antes de intentarla:
--
--        create unique index ... where tipo = 'saldo_inicial'
--          and not exists (select 1 from movimientos c where c.corrige_movimiento_id = id);
--
--    UN INDICE NO PUEDE MIRAR OTRAS FILAS. Su predicado tiene que ser inmutable y depender solo
--    de la fila que se indexa; una subconsulta no lo es, y Postgres lo rechaza al crearlo.
--
--    Entonces la columna guarda el dato en la propia fila: `anulado` se marca cuando alguien la
--    anula, y el indice mira esa columna. Es redundante con `corrige_movimiento_id` de la otra
--    fila, y esa redundancia es el precio de que el indice pueda existir. La escribe la misma
--    funcion que crea la compensacion, en la misma transaccion, asi que no puede quedar
--    desincronizada.
-- ------------------------------------------------------------

alter table public.movimientos
  add column if not exists anulado boolean not null default false;

comment on column public.movimientos.anulado is
  'Si este movimiento fue compensado por un ajuste. Es redundante con corrige_movimiento_id de '
  'la fila que lo anula, y la redundancia es a proposito: un indice unico parcial no puede mirar '
  'otras filas, y sin esta columna no se puede impedir dos saldos iniciales vivos por tarjeta.';

-- Se pone al dia lo que ya estaba anulado antes de que existiera la columna.
update public.movimientos m
   set anulado = true
 where not m.anulado
   and exists (select 1 from public.movimientos c where c.corrige_movimiento_id = m.id);

drop index if exists public.movimientos_un_saldo_inicial;
create unique index if not exists movimientos_un_saldo_inicial
  on public.movimientos (tarjeta_id)
  where tipo = 'saldo_inicial' and not anulado;

-- ------------------------------------------------------------
-- 2) La funcion marca la columna, y no deja anular una anulacion
--
--    SE REESCRIBE ENTERA A PROPOSITO Y CON LA VIVA AL LADO. `create or replace function`
--    reemplaza el cuerpo COMPLETO: lo que no se vuelva a escribir aca, deja de existir sin que
--    nadie avise. Antes de escribir esto se leyo `pg_get_functiondef` de la funcion vigente y se
--    comprobo que estan las cinco guardas y el comentario de la fecha de acreditacion.
-- ------------------------------------------------------------

create or replace function public.anular_movimiento(p_id bigint, p_motivo text)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  m       public.movimientos;
  v_nuevo bigint;
begin
  if not public.es_oficina() then
    raise exception 'regla_tramite: Solo gerencia y administracion contable pueden anular un movimiento';
  end if;

  if nullif(btrim(coalesce(p_motivo, '')), '') is null then
    raise exception 'regla_tramite: Escribi por que se anula. Un movimiento sin motivo no se puede explicar despues.';
  end if;

  select * into m from public.movimientos where id = p_id;
  if not found then
    raise exception 'regla_tramite: Ese movimiento no existe';
  end if;

  if m.tipo not in ('ingreso','saldo_inicial','ajuste') then
    raise exception 'regla_tramite: Ese movimiento lo genero un tramite. Se corrige cambiando el presupuesto del tramite, no desde la cuenta.';
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
    raise exception 'regla_tramite: Ese movimiento ES la anulacion de otro. Si hay que revertirla, carga el movimiento de nuevo.';
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

revoke all on function public.anular_movimiento(bigint, text) from public, anon;
grant execute on function public.anular_movimiento(bigint, text) to authenticated;

-- ------------------------------------------------------------
-- 3) La vista usa la columna, que es mas barata que el `not exists`
--
--    Y AL RECREAR UNA VISTA POSTGRES NO CONSERVA LO REVOCADO: el `revoke` de abajo no es
--    decorativo, hay que volver a ponerlo cada vez.
-- ------------------------------------------------------------

create or replace view public.v_saldos with (security_invoker = true) as
select th.id as tarjeta_id,
       th.nombre,
       coalesce(sum(m.importe) filter (
         where m.tipo in ('saldo_inicial','ingreso','pago','ajuste')
           and m.fecha_acreditacion <= current_date), 0) as contable,
       coalesce(sum(m.importe) filter (
         where m.tipo = 'ingreso' and m.fecha_acreditacion > current_date
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

-- ============================================================================
--  COMO COMPROBAR QUE QUEDO BIEN
--
--  1) Los anulados de antes quedaron marcados:
--       select tipo, importe, anulado from public.movimientos where tipo = 'saldo_inicial';
--     Esperado: los dos con anulado = true.
--
--  2) Y AHORA SI SE PUEDE CARGAR UNO NUEVO — es el defecto que esta migracion arregla:
--       insert into public.movimientos (tarjeta_id, tipo, importe, concepto)
--       values ((select id from public.tarjetas_habitualista where nombre = 'Paris Autos SA'),
--               'saldo_inicial', 9435000, 'Saldo inicial del corte');
--     Esperado: ENTRA. Antes de esta migracion daba error de clave duplicada.
--
--  3) Pero DOS vivos no. Repetir el insert de arriba: TIENE QUE FALLAR con clave duplicada.
--
--  4) Anular una anulacion NO se puede:
--       select public.anular_movimiento(
--         (select id from public.movimientos where corrige_movimiento_id is not null limit 1),
--         'probando');
--     Esperado: 'Ese movimiento ES la anulacion de otro'.
--
--  5) `npm run indices` en verde. Antes de esta migracion daba 1.
-- ============================================================================
