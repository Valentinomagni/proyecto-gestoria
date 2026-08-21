-- ============================================================================
--  UN MOVIMIENTO CARGADO MAL SE ANULA. NO SE BORRA, Y NO SE EDITA.
-- ============================================================================
--
--  El pedido, textual: "sigue sin permitir modificar o eliminar saldos y datos". Es cierto y hay
--  que resolverlo: hoy un deposito de tres millones cargado con un cero de mas queda ahi para
--  siempre, y el saldo de la pantalla deja de coincidir con el sitio de Habitualista — que es
--  exactamente lo unico que esa cifra promete.
--
--  ============================================================================
--   PERO NO CON UN DELETE, Y ESTO NO ES UNA PREFERENCIA
--  ============================================================================
--
--  El libro mayor es de sola insercion porque el saldo de ayer tiene que poder reconstruirse. Un
--  delete lo rompe: al dia siguiente la conciliacion contra el listado real no cierra y nadie
--  puede decir por que. Un update es peor todavia, porque no deja ni el rastro de que hubo un
--  cambio.
--
--  ASI QUE SE COMPENSA. Anular un ingreso de 3.000.000 inserta un `ajuste` de -3.000.000 que
--  apunta al original. Los dos se suman a cero, el saldo queda bien, y en la pantalla el
--  original se ve tachado con su compensacion debajo. Para quien mira, el error desaparecio.
--  Para el libro, no se destruyo nada.
--
--  ============================================================================
--   SOLO LO QUE CARGO UNA PERSONA
--  ============================================================================
--
--  Un `ingreso`, un `saldo_inicial` o un `ajuste` los escribio alguien a mano desde
--  Administracion, y se pueden equivocar. Una `reserva`, un `pago` o un `ajuste_reserva` los
--  escribio un trigger a partir del presupuesto de un tramite: anularlos desde aca dejaria la
--  cuenta diciendo una cosa y el tramite otra. Esos se corrigen corrigiendo el presupuesto, que
--  es lo que la migracion 20260821192919 hizo posible.
--
--  ES ADITIVA: una columna, un indice, una funcion, y la vista que deja de contar lo anulado.
-- ============================================================================

alter table public.movimientos
  add column if not exists corrige_movimiento_id bigint references public.movimientos(id);

comment on column public.movimientos.corrige_movimiento_id is
  'A que movimiento anula este ajuste. Los dos se suman a cero: el saldo queda bien sin haber '
  'borrado ni editado nada, y el error queda visible con su motivo en vez de desaparecer.';

-- Un ajuste, y nada mas, puede anular. Sin esto alguien podria marcar un `ingreso` como
-- correccion de otro y DUPLICAR plata en vez de compensarla.
alter table public.movimientos drop constraint if exists movimientos_correccion_es_ajuste;
alter table public.movimientos add constraint movimientos_correccion_es_ajuste
  check (corrige_movimiento_id is null or tipo = 'ajuste');

-- Una sola anulacion por movimiento. Dos compensaciones del mismo ingreso lo restarian dos
-- veces, y el saldo quedaria peor que antes de corregirlo.
create unique index if not exists movimientos_una_anulacion_por_movimiento
  on public.movimientos (corrige_movimiento_id) where corrige_movimiento_id is not null;

-- ------------------------------------------------------------
-- La funcion. El front NO arma el ajuste: lo arma la base.
--
--   Si lo armara el front, el signo, la fecha de acreditacion y el tipo dependerian de que la
--   pantalla los calcule bien cada vez. Y un signo al reves aca no da error: duplica el importe.
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

  if exists (select 1 from public.movimientos where corrige_movimiento_id = p_id) then
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

  return v_nuevo;
end;
$$;

revoke all on function public.anular_movimiento(bigint, text) from public, anon;
grant execute on function public.anular_movimiento(bigint, text) to authenticated;

comment on function public.anular_movimiento(bigint, text) is
  'Anula un movimiento cargado a mano compensandolo con un ajuste de signo contrario. No borra '
  'ni edita nada: el saldo de ayer tiene que seguir siendo reconstruible. Solo la oficina, y '
  'solo sobre lo que cargo una persona.';

-- ------------------------------------------------------------
-- La vista deja de contar en transito lo que se anulo
--
--   `contable` no necesita cambiar: el ajuste ES de tipo ajuste, ya lo cuenta, y los dos se
--   anulan solos. `en_transito` si, porque filtra por tipo = 'ingreso' y el ajuste no lo es:
--   sin esta correccion, anular un deposito pendiente lo dejaria figurando como plata que llega
--   maniana.
--
--   Se usa `create or replace`: no se agrega ni se reordena ninguna columna, solo cambia una
--   expresion, y eso Postgres si lo permite. Agregar una en el medio daria 42P16.
-- ------------------------------------------------------------

create or replace view public.v_saldos with (security_invoker = true) as
select th.id as tarjeta_id,
       th.nombre,
       -- Acreditado: lo unico que de verdad esta en la cuenta hoy.
       coalesce(sum(m.importe) filter (
         where m.tipo in ('saldo_inicial','ingreso','pago','ajuste')
           and m.fecha_acreditacion <= current_date), 0) as contable,
       -- Ordenado y todavia sin acreditar, sin contar lo que se anulo.
       coalesce(sum(m.importe) filter (
         where m.tipo = 'ingreso' and m.fecha_acreditacion > current_date
           and not exists (select 1 from public.movimientos c
                            where c.corrige_movimiento_id = m.id)), 0) as en_transito,
       -- Presupuestos cargados y sin pagar.
       coalesce(-sum(m.importe) filter (
         where m.tipo in ('reserva','ajuste_reserva','reversa_reserva')), 0) as comprometido,
       -- Ultima, por lo del `create or replace`. El front ordena por esta columna.
       th.orden
  from public.tarjetas_habitualista th
  left join public.movimientos m on m.tarjeta_id = th.id
 group by th.id, th.nombre, th.orden;

comment on view public.v_saldos is
  'contable tiene que dar IGUAL al saldo del sitio de Habitualista: por eso excluye lo que esta '
  'en transito, que el sitio tampoco muestra. en_transito no cuenta los depositos anulados. La '
  'cuarta cifra de la pantalla, contable - comprometido, es exactamente lo que hoy no se ve, y '
  'es por lo que dos personas comprometen la misma plata.';

-- Al recrear una vista Postgres NO conserva lo revocado, y sin estas dos lineas quedaria
-- escribible otra vez. Es exactamente para lo que existe `npm run permisos`.
revoke insert, update, delete, truncate on public.v_saldos from anon, authenticated;
grant select on public.v_saldos to authenticated;

-- ============================================================================
--  COMO COMPROBAR QUE QUEDO BIEN
--
--  1) Anotate el saldo de una tarjeta:
--       select nombre, contable, en_transito from public.v_saldos order by orden;
--
--  2) Anula un ingreso real, desde la consola SQL del panel:
--       select public.anular_movimiento(
--         (select id from public.movimientos where tipo = 'ingreso' order by id desc limit 1),
--         'prueba de anulacion, 21/08/2026');
--
--  3) El saldo volvio al valor de antes:
--       select nombre, contable, en_transito from public.v_saldos order by orden;
--     Esperado: identico al paso 1.
--
--  4) Y el original SIGUE ESTANDO, con su compensacion al lado:
--       select id, tipo, importe, corrige_movimiento_id, observacion
--         from public.movimientos order by id desc limit 2;
--     Esperado: dos filas, la nueva apunta a la vieja. NINGUNA se borro.
--
--  5) Anularlo dos veces NO se puede. TIENE QUE FALLAR:
--       select public.anular_movimiento(<el mismo id>, 'de nuevo');
--     Esperado: 'Ese movimiento ya estaba anulado'.
--
--  6) Una reserva NO se puede anular desde aca. TIENE QUE FALLAR:
--       select public.anular_movimiento(
--         (select id from public.movimientos where tipo = 'reserva' limit 1), 'probando');
--     Esperado: 'Ese movimiento lo genero un tramite'.
--
--  7) Sin motivo tampoco. TIENE QUE FALLAR:
--       select public.anular_movimiento(<un id valido>, '   ');
--     Esperado: 'Escribi por que se anula'.
--
--  8) `npm run permisos` en verde.
-- ============================================================================
