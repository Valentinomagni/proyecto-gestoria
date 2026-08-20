-- ============================================================================
--  LAS FECHAS QUE ARRANCAN EL RELOJ, Y HASTA DONDE LLEGA EL CALENDARIO
-- ============================================================================
--
--  ============================================================================
--   POR QUE ESTA MIGRACION EXISTE: SE VIO EN PANTALLA
--  ============================================================================
--
--  Con los plazos ya cargados, la ficha de un tramite mostraba las dos veces lo mismo:
--  "Falta cargar la fecha desde la que corre el plazo". Y era CORRECTO — pero tambien
--  definitivo: esas fechas no existian en ningun lado del sistema, asi que el vencimiento no
--  se iba a poder mostrar nunca.
--
--  Un mecanismo impecable sin forma de alimentarlo no es un mecanismo, es una promesa.
--
--  Las tres fechas ocurren FUERA de este sistema y por eso las carga una persona:
--    - la certificacion de la primera firma del 08 la hace un escribano
--    - la verificacion policial la hace la policia
--    - la factura la emite el concesionario
--
--  ============================================================================
--   Y EL SEGUNDO ARREGLO, que es mas sutil y mas importante
--  ============================================================================
--
--  Hasta donde llega el calendario de feriados se estaba ADIVINANDO: se tomaba el año del
--  ultimo feriado cargado y se asumia que ese año estaba completo. Es exactamente la clase de
--  suposicion que hace daño en la direccion que duele: si faltan feriados, el vencimiento sale
--  ANTES de lo real, y el sistema da por vencido algo que no vencio.
--
--  Ahora la cobertura se DECLARA. Alguien carga los feriados de un año y despues dice "el
--  calendario llega hasta acá". Mientras ese parametro este vacio, ningun plazo en dias habiles
--  produce un vencimiento — y la pantalla dice que faltan los feriados.
--
--  Un dato declarado por una persona vale mas que uno deducido por un programa, cuando lo que
--  esta en juego es si una fecha se muestra o no.
--
--  ES ADITIVA: tres columnas nulables y una fila de parametro. Nada existente se toca.

-- ------------------------------------------------------------
-- 1) Las tres fechas de arranque, en el tramite
-- ------------------------------------------------------------

alter table public.tramites
  add column if not exists certificacion_primera_firma date,
  add column if not exists verificacion_policial       date,
  add column if not exists factura_fecha               date;

comment on column public.tramites.certificacion_primera_firma is
  'Cuando se certifico la primera firma del formulario 08. La hace un escribano FUERA de este '
  'sistema, asi que la carga una persona. Arranca el reloj de la mora y el de la vigencia del 08.';

comment on column public.tramites.verificacion_policial is
  'Fecha del formulario 12. La hace la policia, fuera de este sistema.';

comment on column public.tramites.factura_fecha is
  'Fecha de la factura del 0km. La emite el concesionario. Arranca el reloj de la inscripcion '
  'inicial fuera de termino.';

-- Ninguna es obligatoria, y eso es deliberado: obligarlas al dar de alta romperia el requisito
-- duro de que un tramite entre en menos de veinte segundos. Se cargan cuando se tienen, y hasta
-- entonces la pantalla dice que faltan en vez de inventar una fecha de arranque.

-- ------------------------------------------------------------
-- 2) Hasta donde llega el calendario. Se declara, no se deduce.
-- ------------------------------------------------------------

insert into public.parametros (clave, valor, descripcion, verificado_el, verificado_por)
values (
  'calendario_cubre_hasta',
  '',
  'Ultimo dia hasta el que los feriados estan cargados, en formato AAAA-MM-DD. VACIO significa '
  'que el calendario no se cargo, y entonces NINGUN plazo en dias habiles muestra vencimiento. '
  'Lo completa quien termino de cargar un año: es una afirmacion de una persona, no algo que el '
  'sistema pueda deducir mirando que feriados hay. Deducirlo daria vencimientos ANTES de lo '
  'real, que es el error que hace daño.',
  null, null
)
on conflict (clave) do nothing;

-- ============================================================================
--  COMO COMPROBAR QUE QUEDO BIEN
--
--  1) Las tres columnas existen y son nulables (tiene que dar 3 filas, todas YES):
--       select column_name, is_nullable, data_type
--         from information_schema.columns
--        where table_schema='public' and table_name='tramites'
--          and column_name in ('certificacion_primera_firma','verificacion_policial','factura_fecha');
--
--  2) El parametro existe y esta VACIO, que es el estado correcto de arranque:
--       select clave, valor = '' as vacio from parametros where clave='calendario_cubre_hasta';
--
--  3) LA QUE IMPORTA, y se mira: cargar la fecha de certificacion en un tramite y ver que el
--     vencimiento pasa de "falta la fecha" a "faltan los feriados" — y no directamente a una
--     cuenta regresiva. Si saltea el segundo aviso, la comprobacion de cobertura no esta
--     funcionando y el sistema estaria mostrando fechas optimistas.
-- ============================================================================
