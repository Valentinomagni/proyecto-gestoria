-- ============================================================================
--  ESPERAR PLATA SE DEDUCE, NO SE MARCA
-- ============================================================================
--
--  `frenado_por_saldo` era un estado que alguien tenia que marcar Y DESMARCAR a mano. El
--  desmarcado es el que se olvidaba: entraba plata y el tramite seguia figurando frenado.
--
--  Un tramite esta esperando plata si esta presupuestado y su tarjeta no alcanza. Eso no es una
--  propiedad del tramite: es una comparacion entre el tramite y la tarjeta, y las comparaciones
--  se calculan.
--
--  ============================================================================
--   POR QUE UNA VISTA Y NO UNA CONSULTA EN CADA PANTALLA
--  ============================================================================
--
--  Porque la miran DOS apps: la oficina para saber a quien le debe plata, y la gestora para
--  saber si puede salir. Si cada una hiciera su propia cuenta, el dia que una cambie el criterio
--  las dos mostrarian numeros distintos del mismo hecho — y entonces nadie le cree a ninguna.
--
--  `security_invoker = true`, como toda vista de este proyecto: sin eso corre como su duenio y
--  saltea la RLS entera.
--
--  ============================================================================
--   EL PLAN TENIA UNA COLUMNA `alcanza` Y ERA SIEMPRE FALSA
--  ============================================================================
--
--  Decia `(s.contable >= s.comprometido) as alcanza`, con un `where s.contable < s.comprometido`
--  tres lineas mas abajo. O sea que solo podia devolver `false`, en todas las filas, para siempre.
--
--  Una columna que siempre dice lo mismo es peor que no tenerla: alguien la va a leer, le va a
--  creer, y va a escribir una pantalla que se ramifica sobre una constante.
--
--  En su lugar va `falta`, que es la pregunta que de verdad se hace quien mira esto: la gestoria
--  no necesita que le confirmen que no alcanza —para eso esta en la lista—, necesita saber
--  CUANTO PEDIR. Es la razon de ser de esta vista.
--
--  ES ADITIVA: una vista nueva. No toca ninguna fila ni ninguna policy.
-- ============================================================================

create or replace view public.v_esperando_plata with (security_invoker = true) as
select t.id            as tramite_id,
       t.cliente_nombre,
       t.dominio,
       t.oferta_referencia,
       t.gestora_id,
       t.razon_social_id,
       t.tarjeta_id,
       t.deposito_solicitado as pide,
       t.presupuestado_at,
       /*
         CUANTO FALTA EN LA TARJETA, que no es lo mismo que cuanto pide este tramite.

         La plata es de la tarjeta y se la reparten TODOS los presupuestos vivos. Si la tarjeta
         tiene 100 y hay tres tramites que piden 60 cada uno, ninguno de los tres puede salir
         tranquilo aunque cualquiera de ellos entre solo en los 100. Lo que hay que depositar es
         la diferencia de la tarjeta, una sola vez, no la suma de lo que pide cada uno.

         Sale igual en todas las filas de la misma tarjeta, y eso es correcto: es una propiedad
         de la tarjeta, no del tramite.
       */
       (s.comprometido - s.contable) as falta
  from public.tramites t
  join public.v_saldos s on s.tarjeta_id = t.tarjeta_id
 where t.estado = 'presupuestado'
   and t.medio_pago = 'tarjeta_habitualista'
   and coalesce(t.deposito_solicitado, 0) > 0
   and s.contable < s.comprometido;

comment on view public.v_esperando_plata is
  'Los tramites presupuestados cuya tarjeta no cubre lo reservado, con cuanto falta depositar en '
  'esa tarjeta. Reemplaza al estado frenado_por_saldo, que alguien tenia que marcar y desmarcar '
  'a mano — y el desmarcado se olvidaba. La miran las dos apps para que muestren el mismo numero '
  'del mismo hecho.';

revoke insert, update, delete, truncate on public.v_esperando_plata from anon, authenticated;
grant select on public.v_esperando_plata to authenticated;

-- ============================================================================
--  COMO COMPROBAR QUE QUEDO BIEN
--
--  1) La vista existe y es de solo lectura. Las dos primeras dan false, la tercera true:
--       select has_table_privilege('authenticated','public.v_esperando_plata','UPDATE') as u,
--              has_table_privilege('authenticated','public.v_esperando_plata','DELETE') as d,
--              has_table_privilege('authenticated','public.v_esperando_plata','SELECT') as s;
--
--  2) Lleva security_invoker. Tiene que aparecer en las opciones:
--       select relname, reloptions from pg_class where relname = 'v_esperando_plata';
--
--  3) EL COMPORTAMIENTO, que es lo que importa. Solo aparecen tramites de tarjetas donde
--     contable < comprometido:
--       select nombre, contable, comprometido, contable >= comprometido as alcanza
--         from public.v_saldos order by orden;
--       select cliente_nombre, pide, falta from public.v_esperando_plata;
--
--  4) Y SE ACTUALIZA SOLA. Cargar un ingreso que cubra la diferencia y volver a mirar:
--       insert into public.movimientos (tarjeta_id, tipo, importe, fecha_acreditacion, concepto)
--       values ('<la tarjeta>', 'ingreso', <lo que dijo `falta`>, current_date, 'Prueba');
--       select cliente_nombre from public.v_esperando_plata;
--     Esperado: los tramites de esa tarjeta DESAPARECIERON de la vista sin que nadie los toque.
--     Eso es lo que el estado no hacia.
--
--     Y es la comprobacion de que `falta` esta bien calculado: depositando EXACTAMENTE lo que
--     decia, la lista tiene que quedar vacia para esa tarjeta. Ni un peso de mas, ni de menos.
-- ============================================================================
