-- ============================================================================
--  LOS TRAMITES QUE YA TENIAN PRESUPUESTO CARGADO
-- ============================================================================
--
--  La migracion 20260821192919 hizo que el total del presupuesto sea la suma de sus lineas, y lo
--  mantiene un trigger. Pero un trigger solo corre cuando algo cambia: los tramites que YA
--  tenian lineas cargadas se quedaron con el total que tenian de antes.
--
--  ============================================================================
--   Y LA DERIVA MEDIDA ERA GRANDE
--  ============================================================================
--
--  No es una hipotesis. Se midio el 21/08/2026, justo despues de aplicar aquella migracion:
--
--    TRAMITE                  ESTADO          DEPOSITO      SUMAN LAS LINEAS   RESERVAS
--    MARTORINA ALEJANDRO      recibido               -           6.128.000,00          0
--    BALAGUER JUAN ANTONIO    presupuestado    655.000,00          450.000,00          1
--    VISIBILIDAD DESDE EL ALTA entregado             -               1.234,56          0
--
--  MARTORINA tenia seis millones ciento veintiocho mil presupuestados Y NINGUNA RESERVA. La
--  pantalla de la tarjeta decia que esa plata estaba disponible. Es exactamente el problema que
--  el proyecto entero viene a resolver —"nos pisamos los saldos"— y estaba adentro de los datos.
--
--  ============================================================================
--   NO SE TOCAN LOS TRAMITES CERRADOS, Y ES LA PARTE IMPORTANTE
--  ============================================================================
--
--  En `pagado`, `retirado`, `devuelto` y `anulado` la reserva YA SE LIBERO y se descontó el costo
--  real. Emparejar el total ahi escribiria un `ajuste_reserva` sobre una reserva que ya no
--  existe: plata comprometida de la nada, en un tramite que la tarjeta ya cerró.
--
--  Un arrastre que "ordena todo" es la forma mas rapida de romper lo que estaba bien. Este toca
--  unicamente lo que sigue vivo.
--
--  ============================================================================
--   ES IDEMPOTENTE
--  ============================================================================
--
--  El `is distinct from` hace que correrlo dos veces no escriba nada la segunda. Sin eso, un
--  segundo `db push` sobre una base ya emparejada seria inofensivo por casualidad y no por
--  diseño.
-- ============================================================================

update public.tramites t
   set deposito_solicitado = case when s.suma = 0 then null else s.suma end
  from (
    select tr.id,
           coalesce((select sum(c.importe)
                       from public.tramite_conceptos c
                      where c.tramite_id = tr.id
                        and c.momento = 'presupuesto'
                        and not c.anulada), 0) as suma
      from public.tramites tr
     where tr.estado not in ('pagado','retirado','devuelto','anulado')
  ) s
 where t.id = s.id
   and t.deposito_solicitado is distinct from (case when s.suma = 0 then null else s.suma end);

-- ============================================================================
--  COMO COMPROBAR QUE QUEDO BIEN
--
--  1) NINGUN tramite vivo tiene el total separado de sus lineas. Tiene que dar CERO filas:
--       select t.cliente_nombre, t.estado, t.deposito_solicitado,
--              coalesce((select sum(c.importe) from public.tramite_conceptos c
--                         where c.tramite_id = t.id and c.momento = 'presupuesto'
--                           and not c.anulada), 0) as suma
--         from public.tramites t
--        where t.estado not in ('pagado','retirado','devuelto','anulado')
--          and coalesce(t.deposito_solicitado, 0) <> coalesce((select sum(c.importe)
--                from public.tramite_conceptos c
--               where c.tramite_id = t.id and c.momento = 'presupuesto' and not c.anulada), 0);
--
--  2) Los cerrados NO se tocaron. BALAGUER retirado tiene que seguir con deposito 600.00
--     aunque sus lineas sumen 910.000:
--       select cliente_nombre, estado, deposito_solicitado from public.tramites
--        where estado in ('retirado','devuelto','pagado','anulado');
--
--  3) Y la reserva que faltaba ahora existe:
--       select t.cliente_nombre, m.tipo, m.importe from public.movimientos m
--         join public.tramites t on t.id = m.tramite_id
--        where t.cliente_nombre = 'MARTORINA ALEJANDRO';
--     Esperado: una fila `reserva` de -6128000.00.
--
--  4) Correrlo de nuevo no escribe nada: repetir el update de arriba y ver que dice UPDATE 0.
-- ============================================================================
