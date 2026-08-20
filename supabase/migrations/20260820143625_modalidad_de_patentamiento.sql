-- ============================================================================
--  LA MODALIDAD ES SOLO DE UN PATENTAMIENTO, Y TIENE EXACTAMENTE DOS VALORES
-- ============================================================================
--
--  Un 0km se compra de dos formas y solo dos: PLAN DE AHORRO o VENTA DIRECTA. `credito` y
--  `contado` no eran modalidades: son formas de PAGO, y para eso ya existe otra columna
--  (`medio_pago`). Estaban de mas y ensuciaban el dato.
--
--  Y UNA TRANSFERENCIA NO TIENE MODALIDAD. Hasta hoy el campo se mostraba igual, invitando a
--  llenar algo que no significa nada — que despues sale en el Excel y alguien lo lee como si
--  dijera algo.
--
--  ============================================================================
--   QUE PASA CON LO QUE YA ESTABA CARGADO
--  ============================================================================
--
--  Los que decian `credito` o `contado` pasan a `venta_directa`, que es lo que de verdad eran:
--  un 0km comprado fuera de un plan de ahorro. Los de plan de ahorro no se tocan. Y las
--  transferencias que tuvieran modalidad quedan en NULL, porque ese dato no existe para ellas.
--
--  ES LA UNICA MIGRACION DE ESTA TANDA QUE TOCA DATOS, y por eso lo dice arriba.

-- ============================================================================
--  EL ORDEN DE ESTAS TRES OPERACIONES NO ES INDIFERENTE
-- ============================================================================
--
--  La restriccion vieja se borra PRIMERO, antes de convertir los datos. La primera version de
--  esta migracion los convertia primero y fallo, con un error que a primera vista no tenia
--  sentido: "la fila con subtipo `venta_directa` viola tramites_subtipo_valido", justo el valor
--  que la restriccion nueva permite.
--
--  La explicacion es que la que estaba mirando era la VIEJA —la que solo admite plan_ahorro,
--  credito y contado— porque todavia no se habia borrado. O sea: no se puede escribir el valor
--  nuevo mientras siga viva la regla que no lo conoce.
--
--  Es la clase de error que se lee como un problema del dato y es un problema del orden.

alter table public.tramites drop constraint if exists tramites_subtipo_valido;

update public.tramites
   set subtipo = 'venta_directa'
 where tipo = 'patentamiento_0km'
   and subtipo in ('credito','contado');

update public.tramites
   set subtipo = null
 where tipo <> 'patentamiento_0km'
   and subtipo is not null;

-- Y recien ahora la regla nueva. Sin esta restriccion la regla viviria solo en la pantalla, y
-- la primera consulta que alguien escriba por afuera la rompe sin enterarse.
alter table public.tramites add constraint tramites_subtipo_valido check (
  subtipo is null
  or (tipo = 'patentamiento_0km' and subtipo in ('plan_ahorro','venta_directa'))
);

comment on column public.tramites.subtipo is
  'Como se compro el 0km: plan_ahorro o venta_directa, y nada mas. Solo aplica a '
  'patentamiento_0km, porque una transferencia no tiene modalidad. La forma de PAGO es otra '
  'cosa y vive en medio_pago.';

-- ============================================================================
--  COMO COMPROBAR QUE QUEDO BIEN
--
--  1) No quedo ningun subtipo fuera de los dos valores, ni ninguno en una transferencia:
--       select tipo, subtipo, count(*) from public.tramites group by 1,2 order by 1,2;
--
--  2) El check bloquea. Tiene que FALLAR:
--       update public.tramites set subtipo = 'contado' where tipo = 'patentamiento_0km';
--
--  3) Y tambien tiene que FALLAR ponerle modalidad a una transferencia:
--       update public.tramites set subtipo = 'plan_ahorro' where tipo = 'transferencia_a_cliente';
-- ============================================================================
