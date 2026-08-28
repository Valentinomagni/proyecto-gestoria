-- ============================================================================
--  EL `case` NO ALCANZABA: EL PERMISO DE EJECUTAR SE MIRA AL PLANIFICAR
-- ============================================================================
--
--  La migracion anterior guardo las llamadas a los helpers detras de
--  `case when current_role = 'authenticated' then ... else false end`, razonando que la rama no
--  se evalua para `anon` y por lo tanto no hace falta el permiso.
--
--  ES FALSO, Y SE MIDIO: despues de aplicarla, `anon` recibia 42501 en `v_saldos` y en
--  `v_resumen_empresas`, que es exactamente la regresion que el `case` pretendia evitar.
--
--  POSTGRES COMPRUEBA EL PERMISO DE `execute` AL PLANIFICAR LA CONSULTA, no al recorrer las
--  filas. La rama muerta se planifica igual, y el rechazo llega antes de que exista una fila que
--  pudiera tomar el otro camino. Ninguna forma de escribir la condicion evita esto: el arreglo
--  tiene que estar en los permisos, no en la expresion.
--
--  ============================================================================
--   UNA SOLA FUNCION EN VEZ DE DOS PERMISOS SUELTOS
--  ============================================================================
--
--  Se podria darle `execute` sobre los dos helpers a `anon` — son inofensivos, los dos filtran
--  por `auth.uid()`, que sin sesion es nulo, y devuelven `false` sin mirar ninguna fila.
--
--  Pero eso deja el "o" repartido en cada vista que lo necesite, y la proxima vista lo va a
--  copiar mal. La pregunta es UNA —"esta persona puede leer los movimientos de esta tarjeta"— y
--  ahora tiene UN solo lugar donde se contesta y se cambia.
--
--  `p_tarjeta` acepta nulo a proposito: una razon social todavia sin tarjeta no tiene nada que
--  esconder, y para ella la respuesta es la del rol.
-- ============================================================================

create or replace function public.puedo_ver_tarjeta(p_tarjeta uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
     and (
       public.es_oficina()
       or (p_tarjeta is not null and public.tengo_tramite_en_esta_tarjeta(p_tarjeta))
     );
$$;

comment on function public.puedo_ver_tarjeta(uuid) is
  'Si quien consulta puede leer los movimientos de esa tarjeta. Sin sesion, false. '
  'Es la unica fuente de esa respuesta: no derivarla de un conteo de filas.';

-- Sin sesion devuelve false sin leer nada, asi que `anon` puede ejecutarla y recibe AUSENCIA
-- (cero filas) en vez de RECHAZO (42501), que es lo que hace diagnosticable un login vencido.
revoke all on function public.puedo_ver_tarjeta(uuid) from public;
grant execute on function public.puedo_ver_tarjeta(uuid) to anon, authenticated;

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
  public.puedo_ver_tarjeta(th.id)                              as puedo_ver
from public.tarjetas_habitualista th
left join public.movimientos m on m.tarjeta_id = th.id
group by th.id, th.nombre, th.orden;

alter view public.v_saldos set (security_invoker = true);
revoke all on public.v_saldos from anon, authenticated;
grant select on public.v_saldos to anon, authenticated;

-- El resumen pregunta por su propia tarjeta y no hereda la respuesta del join: asi contesta
-- tambien para una razon social sin tarjeta, donde no hay fila de la que heredar.
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
  public.puedo_ver_tarjeta(r.tarjeta_id)                       as puedo_ver
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
