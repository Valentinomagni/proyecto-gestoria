-- ============================================================================
--  EL EXTRACTO DE UNA TARJETA COMPARTIDA NO DICE DE QUE CLIENTE ES CADA RESERVA
-- ============================================================================
--
--  LO ENCONTRO LA REVISION DE SEGURIDAD DEL 28/08/2026, y la cadena completa es esta:
--
--   1. `movimientos_select` es POR TARJETA, no por tramite:
--      `es_gestora() and tengo_tramite_en_esta_tarjeta(tarjeta_id)`. Un solo tramite vivo abre los
--      186 movimientos de PARIS AUTOS.
--
--   2. El trigger de la cuenta corriente escribe el nombre del cliente ADENTRO del concepto:
--      `'Presupuesto - ' || t.cliente_nombre`.
--
--   3. La pantalla pide `tramites(cliente_nombre)` embebido —que la RLS SI esconde— y cuando viene
--      nulo cae al `concepto` crudo. O sea que cae al nombre justo cuando el nombre estaba
--      escondido.
--
--  Resultado: una gestora podia leer apellido de cliente e importe de los tramites que la policy
--  de `tramites` le esconde a proposito.
--
--  MEDIDO EL 28/08/2026: cero filas. Hay una sola gestora con tramites y los cinco tramites sin
--  gestora asignada no generaron movimientos. Es LATENTE, y se activa el dia que dos gestoras
--  trabajen sobre la misma tarjeta — que es el caso normal de esta empresa.
--
--  ============================================================================
--   POR QUE NO SE ACHICA LA POLICY
--  ============================================================================
--
--  Porque la gestora NECESITA ver todos los movimientos de la tarjeta: el saldo es la suma, y
--  `v_saldos` la calcula sumando lo que ella puede leer. Si la policy pasara a ser por tramite, su
--  saldo dejaria de ser el saldo de la tarjeta y pasaria a ser "la parte que le toca" — un numero
--  que no existe, y con el que saldria a pagar.
--
--  El problema no es que vea la FILA. Es que la fila diga de quien es.
--
--  ============================================================================
--   POR QUE UN `exists` Y NO UN HELPER NUEVO
--  ============================================================================
--
--  La vista es `security_invoker`, asi que el `exists` sobre `tramites` corre con la RLS de quien
--  consulta. La pregunta "¿este tramite lo puede ver?" ya esta contestada por la policy de
--  `tramites`, y preguntarsela asi es la unica forma que no se puede desincronizar de ella.
--
--  Un helper aparte seria una segunda regla, y el dia que cambie la policy quedaria la vieja.
-- ============================================================================

/*
  SOLO LAS COLUMNAS QUE LA PANTALLA USA. `origen`, `creado_por` y `creado_at` no se exponen: no se
  dibujan en ningun lado, y una columna que viaja sin que nadie la mire es superficie de mas.
*/
create or replace view public.v_movimientos as
select
  m.id,
  m.tarjeta_id,
  m.tramite_id,
  m.fecha,
  m.fecha_acreditacion,
  m.tipo,
  m.importe,
  /*
    EL CONCEPTO SE TAPA, NO SE BORRA LA FILA. Sin fila, el saldo dejaria de cerrar contra la suma
    de lo que se muestra, y una pantalla de plata que no cierra es peor que una que dice de menos.

    Un movimiento SIN tramite —un deposito, un ajuste— no tiene a quien esconder: pasa entero.
  */
  case
    when m.tramite_id is null then m.concepto
    when exists (select 1 from public.tramites t where t.id = m.tramite_id) then m.concepto
    else null
  end as concepto,
  -- La observacion la escribe una persona y puede decir cualquier cosa. Misma regla.
  case
    when m.tramite_id is null then m.observacion
    when exists (select 1 from public.tramites t where t.id = m.tramite_id) then m.observacion
    else null
  end as observacion,
  /*
    Y LA GESTORA TAMPOCO. No es el nombre del cliente, pero es QUIEN — y la regla del producto es
    que aca no se mide a las personas. Con este id y la tabla `gestoras` se arma exactamente el
    conteo por gestora que el proyecto tiene prohibido, sobre tramites que ni siquiera se ven.
  */
  case
    when m.tramite_id is null then m.gestora_id
    when exists (select 1 from public.tramites t where t.id = m.tramite_id) then m.gestora_id
    else null
  end as gestora_id,
  m.corrige_movimiento_id,
  m.anulado
from public.movimientos m;

-- Recrear una vista NO conserva lo revocado. Se vuelve a poner, siempre.
alter view public.v_movimientos set (security_invoker = true);
revoke all on public.v_movimientos from anon, authenticated;
grant select on public.v_movimientos to anon, authenticated;

comment on view public.v_movimientos is
  'El extracto de una tarjeta. Igual que `movimientos`, pero con `concepto` y `observacion` en '
  'null cuando el movimiento cuelga de un tramite que quien consulta no puede ver. El nombre del '
  'cliente viaja adentro del concepto: sin esto, una tarjeta compartida los muestra todos.';

-- ============================================================================
--  Y DE PASO: LOS GRANTS HEREDADOS DE `v_esperando_plata`
-- ============================================================================
--
--  La misma revision midio que `anon` tiene SELECT sobre `v_esperando_plata` por los defaults de
--  Supabase, y no porque alguien lo haya escrito. Importa porque `v_cola_de_gestora` esta otorgada
--  a `anon` y le hace `left join`: sin ese grant heredado, quien no entro recibiria 42501
--  (RECHAZO) en vez de cero filas (AUSENCIA) — justo la regresion que esa migracion decia evitar.
--
--  Funciona por accidente. Se escribe, para que un `revoke all` de limpieza no lo rompa en
--  silencio.
grant select on public.v_esperando_plata to anon;

comment on view public.v_esperando_plata is
  'Los tramites presupuestados cuya tarjeta no cubre, con cuanto falta. `anon` tiene SELECT A '
  'PROPOSITO: `v_cola_de_gestora` le hace join y sin esto quien no entro recibiria rechazo en vez '
  'de ausencia. La vista es security_invoker, asi que sin sesion devuelve cero filas.';
