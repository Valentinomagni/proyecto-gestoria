-- ============================================================================
--  EL ORDEN DE LAS TARJETAS LO DECIDE EL USO, NO EL ALFABETO
-- ============================================================================
--
--  La pantalla del saldo abre en la primera de la lista, y hasta hoy ordenaba por nombre: abria
--  en Doral Chevrolet. Las que mas se usan son Paris Autos y Paris Cars, asi que la pantalla que
--  se mira treinta veces por dia arrancaba siempre en la tarjeta equivocada.
--
--  La columna `orden` ya existia y ya decia lo correcto para Paris Autos. Faltaban dos cosas:
--  subir Paris Cars al segundo lugar, y que la VISTA exponga `orden` para que el front pueda
--  usarlo. Sin lo segundo el front no tenia con que ordenar y caia en el nombre.

update public.tarjetas_habitualista set orden = 20 where nombre = 'Paris Cars';
update public.tarjetas_habitualista set orden = 30 where nombre = 'Doral Chevrolet';

-- La vista se repite ENTERA y no se le "agrega una columna": una vista no se altera, se
-- reemplaza. Dejarla escrita completa es lo que permite leer en el diff que lo demas no cambio.
--
-- ============================================================================
--  Y `orden` VA AL FINAL, QUE NO ES UNA CUESTION DE GUSTO
-- ============================================================================
--
-- `create or replace view` SOLO puede AGREGAR columnas al final. No puede insertar una en el
-- medio ni reordenarlas. La primera version de esta migracion puso `orden` en tercer lugar y
-- Postgres respondio:
--
--     cannot change name of view column "contable" to "orden"  (42P16)
--
-- Que es un error que parece de otra cosa: no habla de la columna que se agrego, habla de la
-- que quedo corrida. La alternativa —`drop view` y crearla de nuevo— obligaria a rehacer todo
-- lo que dependa de ella y a acordarse de volver a poner los permisos, asi que es peor.
create or replace view public.v_saldos with (security_invoker = true) as
select th.id as tarjeta_id,
       th.nombre,
       -- Acreditado: lo unico que de verdad esta en la cuenta hoy.
       coalesce(sum(m.importe) filter (
         where m.tipo in ('saldo_inicial','ingreso','pago','ajuste')
           and m.fecha_acreditacion <= current_date), 0) as contable,
       -- Ordenado y todavia sin acreditar.
       coalesce(sum(m.importe) filter (
         where m.tipo = 'ingreso' and m.fecha_acreditacion > current_date), 0) as en_transito,
       -- Presupuestos cargados y sin pagar.
       coalesce(-sum(m.importe) filter (
         where m.tipo in ('reserva','ajuste_reserva','reversa_reserva')), 0) as comprometido,
       -- Ultima, por lo de arriba. El front ordena por esta columna.
       th.orden
  from public.tarjetas_habitualista th
  left join public.movimientos m on m.tarjeta_id = th.id
 group by th.id, th.nombre, th.orden;

comment on view public.v_saldos is
  'contable tiene que dar IGUAL al saldo del sitio de Habitualista: por eso excluye lo que esta '
  'en transito, que el sitio tampoco muestra. disponible = contable - comprometido, y proyectado '
  '= contable + en_transito - comprometido. La diferencia entre contable y disponible es '
  'exactamente lo que hoy no se ve, y es por lo que dos personas comprometen la misma plata.';

-- LOS PERMISOS SE VUELVEN A PONER, y esta linea no es de mas: al recrear una vista con otras
-- columnas, Postgres NO conserva lo revocado. Sin esto la vista quedaria escribible otra vez y
-- `npm run permisos` se pondria en rojo — que es exactamente para lo que existe ese guardian.
revoke insert, update, delete, truncate on public.v_saldos from anon, authenticated;
grant select on public.v_saldos to authenticated;

-- ============================================================================
--  COMO COMPROBAR QUE QUEDO BIEN
--
--  1) El orden quedo por uso:
--       select nombre, orden from public.tarjetas_habitualista order by orden;
--     Esperado: Paris Autos SA 10, Paris Cars 20, Doral Chevrolet 30, Paris Motor 40,
--               Paris Trac 50.
--
--  2) La vista expone `orden` y sigue siendo de solo lectura:
--       npm run permisos
--     Esperado: los tres controles en verde.
--
--  3) LA QUE IMPORTA, y se mira: entrar a Tarjeta y ver que abre en Paris Autos SA.
-- ============================================================================
