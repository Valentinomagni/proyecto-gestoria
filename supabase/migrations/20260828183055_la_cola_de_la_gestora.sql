-- ============================================================================
--  LA COLA DE LA GESTORA
-- ============================================================================
--
--  Una fila por tramite vivo de quien consulta, con DOS respuestas ya tomadas: en que bloque va y
--  que boton le toca. El navegador no decide ninguna de las dos.
--
--  ============================================================================
--   POR QUE ACA Y NO EN EL NAVEGADOR
--  ============================================================================
--
--  Porque "la tarjeta cubre este presupuesto" NO es una comparacion entre dos numeros. La plata es
--  de la TARJETA y se la reparten todos los presupuestos vivos de esa tarjeta: con 500.000 y tres
--  presupuestos de 200.000, cubre dos y media. Esa cuenta ya vive en `v_esperando_plata` y es la
--  parte dificil.
--
--  Si el front la rehiciera, el dia que cambie el criterio —que entre el deposito en transito, que
--  cambie que cuenta como comprometido— la pantalla de la gestora seguiria con el viejo. Y no
--  daria error: mostraria una tarjeta en el bloque equivocado. Es `frenado_por_saldo` de nuevo,
--  que es el defecto que este sistema vino a matar.
--
--  ============================================================================
--   POR QUE UN `left join` A `v_esperando_plata` Y NO UN `exists`
--  ============================================================================
--
--  Porque de ahi sale tambien `falta`, que es el numero que la pantalla necesita para explicar la
--  ausencia del boton. Un `exists` diria que si o que no y habria que ir a buscar el cuanto por
--  separado — dos consultas que pueden contestar cosas distintas.
--
--  ============================================================================
--   QUE NO ESTA EN LA COLA
--  ============================================================================
--
--  `recibido` y `controlado` son de la oficina: la gestora todavia no lo tiene en la mano.
--  `anulado` no esta porque no hay nada que hacer con el. `devuelto` esta SOLO si se devolvio hoy,
--  y por eso mide contra `hoy_argentina()` y no contra `now()`: a las 21:30 de Argentina `now()`
--  en UTC ya es maniana, y la lista de "terminados hoy" se vaciaria sola a mitad de la tarde.
--
--  ============================================================================
--   LOS PERMISOS DE LOS HELPERS, COMPROBADOS ANTES Y NO SUPUESTOS
--  ============================================================================
--
--  `mi_gestora_id()` y `hoy_argentina()` tienen las dos `anon=X`, medido en `pg_proc.proacl` antes
--  de escribir esto. Importa porque Postgres comprueba el permiso de `execute` AL PLANIFICAR la
--  consulta, no al recorrer las filas: una vista que llama a un helper revocado le contesta a
--  quien no tiene sesion 42501 (RECHAZO) en vez de cero filas (AUSENCIA), y eso manda a buscar un
--  problema de permisos donde solo falta haber entrado. Costo dos migraciones el 28/08/2026.
-- ============================================================================

create or replace view public.v_cola_de_gestora as
select
  t.id                                        as tramite_id,
  t.cliente_nombre,
  t.dominio,
  t.oferta_referencia,
  r.nombre                                    as empresa,
  t.razon_social_id,
  t.tarjeta_id,
  t.estado,
  case
    when t.estado = 'devuelto'                       then 'terminado'
    when t.estado = 'presupuestado'
     and e.tramite_id is not null                    then 'esperando'
    else 'te_toca'
  end                                         as bloque,
  case
    when t.estado = 'entregado'                      then 'presupuestar'
    when t.estado = 'presupuestado'
     and e.tramite_id is null                        then 'ir_al_registro'
    when t.estado = 'resuelto'                       then 'devolver'
    else 'ninguna'
  end                                         as accion,
  coalesce(t.deposito_solicitado, 0::numeric) as pide,
  coalesce(e.falta, 0::numeric)               as falta,
  -- El momento que ordena cada bloque: desde cuando esta esperando esto.
  coalesce(t.presupuestado_at, t.entregado_at, t.recibido_at) as desde
from public.tramites t
join public.razones_sociales r on r.id = t.razon_social_id
left join public.v_esperando_plata e on e.tramite_id = t.id
where t.gestora_id = public.mi_gestora_id()
  and (
    t.estado in ('entregado', 'presupuestado', 'resuelto')
    or (t.estado = 'devuelto' and t.devuelto_at >= hoy_argentina())
  );

-- Recrear una vista NO conserva lo revocado. Se vuelve a poner, siempre.
alter view public.v_cola_de_gestora set (security_invoker = true);
revoke all on public.v_cola_de_gestora from anon, authenticated;
grant select on public.v_cola_de_gestora to anon, authenticated;

comment on view public.v_cola_de_gestora is
  'La cola de quien consulta: un tramite por fila, con su bloque y su accion ya decididos. '
  'El bloque `esperando` sale de v_esperando_plata y NO se recalcula en ningun otro lado.';
