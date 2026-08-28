-- ============================================================================
--  UNA TARJETA VACIA NO ES UNA TARJETA PROHIBIDA
-- ============================================================================
--
--  ESTO SE ENCONTRO EL 28/08/2026, revisando el plan B contra la base de verdad, y lo veia la
--  duenia de la empresa.
--
--  `movimientos_visibles` es un `count(m.id)`. La pantalla decidia con `count > 0`, y una tarjeta
--  SIN MOVIMIENTOS cuenta cero igual que una que no se puede leer. Resultado: gerencia abria
--  Doral Chevrolet y leia
--
--      "No podes ver los movimientos de esta tarjeta.
--       No quiere decir que este en cero: quiere decir que no hay datos para mostrarte.
--       Vas a ver el saldo de las empresas donde tengas tramites."
--
--  Las dos frases son falsas para ella: puede verlos, y no depende de tener tramites — eso es
--  vocabulario de gestora mostrado a la duenia. Tres de sus cinco empresas decian "Sin datos".
--
--  ============================================================================
--   POR QUE UNA COLUMNA NUEVA Y NO ARREGLARLO EN LA PANTALLA
--  ============================================================================
--
--  Porque la pantalla no tiene con que. "No hay filas" es la misma respuesta para "no hay nada" y
--  para "no te lo muestro": la RLS borra las filas, no las marca. La unica parte del sistema que
--  sabe la diferencia es la que decide el permiso, y por eso la respuesta se calcula con LOS
--  MISMOS HELPERS QUE USA LA POLICY. Cualquier otra fuente se desincroniza el dia que la policy
--  cambie, y lo hace en silencio.
--
--  ============================================================================
--   POR QUE EL `case` Y NO UN `or` PELADO
--  ============================================================================
--
--  `es_oficina()` y `tengo_tramite_en_esta_tarjeta()` estan revocados para `anon`. Una vista que
--  los llame sin guarda le contesta a quien no tiene sesion 42501 (RECHAZO) en vez de cero filas
--  (AUSENCIA) — la trampa que CLAUDE.md ya tiene anotada, porque manda a buscar un problema de
--  permisos donde solo falta haber entrado.
--
--  El `case` corta antes de llamarlos. Es seguro: los dos helpers son `stable`, no `immutable`,
--  asi que el planificador no los pliega fuera de la rama. Medido, no supuesto: la prueba de
--  `anon` vuelve a dar 200 con cero filas.
--
--  ============================================================================
--   POR QUE LA COLUMNA VA ULTIMA
--  ============================================================================
--
--  `create or replace view` no puede renombrar ni reordenar columnas. Lo nuevo va al final o hay
--  que tirar la vista, y tirarla se lleva puesta `v_resumen_empresas`, que depende de ella.
-- ============================================================================

create or replace view public.v_saldos as
select
  th.id                                                        as tarjeta_id,
  th.nombre,
  coalesce(
    sum(m.importe) filter (
      where m.tipo = any (array['saldo_inicial', 'ingreso', 'pago', 'ajuste'])
        and m.fecha_acreditacion <= hoy_argentina()
    ),
    0::numeric
  )                                                            as contable,
  coalesce(
    sum(m.importe) filter (
      where m.tipo = 'ingreso'
        and m.fecha_acreditacion > hoy_argentina()
        and not m.anulado
    ),
    0::numeric
  )                                                            as en_transito,
  coalesce(
    -sum(m.importe) filter (
      where m.tipo = any (array['reserva', 'ajuste_reserva', 'reversa_reserva'])
    ),
    0::numeric
  )                                                            as comprometido,
  th.orden,
  count(m.id)                                                  as movimientos_visibles,
  -- La respuesta de permiso, no de conteo. Ver el encabezado.
  case
    when current_role = 'authenticated'
      then es_oficina() or tengo_tramite_en_esta_tarjeta(th.id)
    else false
  end                                                          as puedo_ver
from public.tarjetas_habitualista th
left join public.movimientos m on m.tarjeta_id = th.id
group by th.id, th.nombre, th.orden;

-- Recrear una vista NO conserva lo revocado. Se vuelve a poner, siempre.
alter view public.v_saldos set (security_invoker = true);
revoke all on public.v_saldos from anon, authenticated;
grant select on public.v_saldos to anon, authenticated;

create or replace view public.v_resumen_empresas as
select
  r.id                                                         as razon_social_id,
  r.nombre,
  r.tarjeta_id,
  coalesce(s.contable, 0::numeric)                             as contable,
  coalesce(s.en_transito, 0::numeric)                          as en_transito,
  coalesce(s.comprometido, 0::numeric)                         as comprometido,
  coalesce(s.contable, 0::numeric) - coalesce(s.comprometido, 0::numeric) as diferencia,
  coalesce(e.esperan, 0::bigint)                               as esperan,
  coalesce(s.movimientos_visibles, 0::bigint)                  as movimientos_visibles,
  r.orden,
  /*
    Una razon social SIN tarjeta todavia no tiene nada que esconder, y contestarle "no podes ver"
    a la oficina seria repetir el mismo defecto un renglon mas abajo. Para ella la respuesta es la
    del rol; para las que tienen tarjeta, la de la tarjeta.
  */
  coalesce(
    s.puedo_ver,
    current_role = 'authenticated' and es_oficina()
  )                                                            as puedo_ver
from public.razones_sociales r
left join public.v_saldos s on s.tarjeta_id = r.tarjeta_id
left join (
  select v.tarjeta_id, count(*) as esperan
  from public.v_esperando_plata v
  group by v.tarjeta_id
) e on e.tarjeta_id = r.tarjeta_id
where r.activa;

alter view public.v_resumen_empresas set (security_invoker = true);
revoke all on public.v_resumen_empresas from anon, authenticated;
grant select on public.v_resumen_empresas to anon, authenticated;

comment on column public.v_saldos.puedo_ver is
  'Si esta persona puede leer los movimientos de esta tarjeta. Se calcula con los helpers de la '
  'policy. NO usar movimientos_visibles = 0 para esto: una tarjeta vacia tambien cuenta cero.';

comment on column public.v_resumen_empresas.puedo_ver is
  'Lo mismo que v_saldos.puedo_ver. Para una razon social sin tarjeta, la respuesta es la del rol.';
