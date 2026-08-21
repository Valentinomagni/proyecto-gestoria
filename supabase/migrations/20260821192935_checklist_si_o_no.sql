-- ============================================================================
--  NO TODOS LOS ITEMS DEL CHECKLIST SON PAPELES
-- ============================================================================
--
--  El pedido de la FOTO 1: "opciones de accesorios deberian ser si-no / entrega de vehiculos
--  si-no / son opciones, deberia estar en formato de checklist".
--
--  LA TANDA ANTERIOR LO ENTENDIO AL PIE DE LA LETRA Y POR ESO SALIO MAL: creo un requisito
--  llamado literalmente "Accesorios si/no" y le dejo las tres respuestas de siempre —Esta,
--  Falta, No corresponde—. O sea que la pantalla preguntaba si el "si/no" ESTABA.
--
--  La diferencia real es de naturaleza. Los tres primeros son PAPELES: pueden estar, faltar, o
--  no corresponder a ese tramite. Los dos ultimos son HECHOS de la operacion: la venta incluye
--  accesorios o no los incluye, y hay un usado en parte de pago o no lo hay. "No corresponde" no
--  significa nada ahi, y ofrecer una respuesta que no significa nada es invitar a usarla para no
--  pensar — que es exactamente como un control se vuelve un tramite mas.
--
--  Y DE PASO SE LES ARREGLAN LOS ACENTOS. Los nombres se cargaron sin ellos y se ven en la
--  pantalla que mira la duenia de la empresa.
--
--  ES ADITIVA: una columna con default, y cuatro filas que cambian de nombre.
-- ============================================================================

alter table public.requisitos add column if not exists tipo text not null default 'documento';

comment on column public.requisitos.tipo is
  'documento: un papel del legajo, se contesta Esta / Falta / No corresponde. si_no: un hecho de '
  'la operacion (hay accesorios, hay usado en parte de pago), se contesta Si o No. "No '
  'corresponde" sobre un hecho no significa nada, y una respuesta que no significa nada es como '
  'un control se vuelve un tramite mas.';

alter table public.requisitos drop constraint if exists requisitos_tipo_valido;
alter table public.requisitos add constraint requisitos_tipo_valido
  check (tipo in ('documento','si_no'));

update public.requisitos set tipo = 'si_no', nombre = 'Accesorios'
 where nombre = 'Accesorios si/no';

update public.requisitos set tipo = 'si_no', nombre = 'Entrega de vehículo usado'
 where nombre = 'Entrega de vehiculo usado si/no';

update public.requisitos set nombre = 'Revisión de factura del auto'
 where nombre = 'Revision de factura del auto';

update public.requisitos set nombre = 'Revisión de factura por gastos'
 where nombre = 'Revision de factura por gastos';

-- ============================================================================
--  COMO COMPROBAR QUE QUEDO BIEN
--
--  1) Los cinco, con su tipo y su nombre bien escrito:
--       select orden, nombre, tipo from public.requisitos where activo order by orden;
--     Esperado, en este orden:
--       Control de la oferta - Saldo 0      documento
--       Revisión de factura del auto        documento
--       Revisión de factura por gastos      documento
--       Accesorios                          si_no
--       Entrega de vehículo usado           si_no
--
--  2) Un tipo inventado NO entra. TIENE QUE FALLAR:
--       update public.requisitos set tipo = 'checkbox' where nombre = 'Accesorios';
--     Esperado: viola requisitos_tipo_valido.
--
--  3) Las respuestas ya cargadas siguen valiendo: no se toco tramite_requisitos.
--       select count(*) from public.tramite_requisitos;
--     Esperado: el mismo numero que antes de esta migracion.
-- ============================================================================
