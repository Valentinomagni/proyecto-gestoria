-- ============================================================================
--  LA GESTORA VE EL SALDO DE LA TARJETA CON LA QUE VA A PAGAR
-- ============================================================================
--
--  ============================================================================
--   HOY VE CERO. NO "SIN DATOS": CERO.
--  ============================================================================
--
--  Lo encontraron las dos revisiones, por caminos distintos, y las dos midieron lo mismo con una
--  sesion de gestora real:
--
--      v_saldos          las cinco tarjetas con contable 0 y comprometido 0
--      v_esperando_plata 0 filas
--      movimientos       0 filas
--
--  Paris Autos tiene 8.463.765,44 disponibles. Ella ve $ 0,00.
--
--  La cadena: `v_esperando_plata` y `v_saldos` son `security_invoker`, asi que corren con los
--  permisos de quien mira. Las dos suman `movimientos`, y la policy de `movimientos` pide
--  `opero_esta_tarjeta()`, que exige una fila activa en `tarjetas_debito`. ESA TABLA TIENE CERO
--  FILAS. Entonces toda gestora ve cero en toda tarjeta, y el `where contable < comprometido` de
--  `v_esperando_plata` es `0 < 0`: falso, siempre, para cualquier saldo.
--
--  Y falla en el modo mas silencioso que hay. `EsperandoPlata` hace `if (filas.length === 0)
--  return null`, asi que el panel entero desaparece: no dice "sin datos", no dice nada. Al lado
--  de cada pedido escribe "Queda disponible: $ 0,00", en gris neutro, porque 0 no es menor que 0.
--
--  Una pantalla que dice CERO se lee como un hecho. La gestora concluye que no puede salir a
--  pagar, y lo descubre parada en el registro.
--
--  ============================================================================
--   ES UNA REGRESION DE ESTA TANDA, Y CONVIENE DECIRLO
--  ============================================================================
--
--  Antes la Bandeja leia `tramites` con `estado = 'frenado_por_saldo'`, y `tramites` SI los deja
--  ver a la gestora —`gestora_id = mi_gestora_id()`—. Al cambiarlo por la vista calculada, la
--  consulta paso a depender de `movimientos`, que ella no ve. La funcion mejoro y la visibilidad
--  se rompio en el mismo commit.
--
--  ============================================================================
--   QUE SE ABRE, Y QUE NO
--  ============================================================================
--
--  Lo decidio quien manda en el producto: la gestora ve el saldo de las tarjetas DONDE TIENE
--  TRAMITES VIVOS, y nada mas. No hay tabla que mantener —una fila que alguien se olvida de
--  cargar es otro cero silencioso—, y es exactamente lo que necesita para decidir si sale a
--  pagar: cuanto hay en la tarjeta con la que va a pagar ESTE tramite.
--
--  Lo que NO se abre: las tarjetas de razones sociales donde no trabaja, y las de tramites que
--  ya se devolvieron o se anularon. `tarjetas_debito` se conserva y sigue valiendo: si alguna vez
--  se carga, suma permiso, no lo reemplaza.
-- ============================================================================

-- ------------------------------------------------------------
-- 1) El helper
--
--    `security definer` con `stable` y `set search_path = public`, como todos los de este
--    proyecto: una subconsulta suelta adentro de una policy es como se llega a la recursion
--    infinita que devuelve 500 en todas las tablas.
-- ------------------------------------------------------------

create or replace function public.tengo_tramite_en_esta_tarjeta(p_tarjeta uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.tramites t
     where t.tarjeta_id = p_tarjeta
       and t.gestora_id = public.mi_gestora_id()
       and t.estado not in ('devuelto','anulado')
  );
$$;

comment on function public.tengo_tramite_en_esta_tarjeta(uuid) is
  'Si la gestora que consulta tiene algun tramite vivo sobre esa tarjeta. Le da acceso al saldo '
  'de la tarjeta con la que va a pagar, y solo mientras tenga trabajo sobre ella.';

revoke all on function public.tengo_tramite_en_esta_tarjeta(uuid) from public, anon;
grant execute on function public.tengo_tramite_en_esta_tarjeta(uuid) to authenticated;

-- ------------------------------------------------------------
-- 2) La policy suma ese camino
--
--    `to authenticated` NO ES DECORATIVO: sin el, `anon` intenta ejecutar un helper revocado y
--    recibe 42501 —un rechazo— en vez de cero filas —una ausencia—. Y eso manda a buscar un
--    problema de permisos donde solo falta una sesion.
-- ------------------------------------------------------------

drop policy if exists "movimientos_select" on public.movimientos;
create policy "movimientos_select" on public.movimientos for select to authenticated
  using (
    public.es_oficina()
    or (public.es_gestora() and (
          public.opero_esta_tarjeta(tarjeta_id)
       or public.tengo_tramite_en_esta_tarjeta(tarjeta_id)
    ))
  );

-- ------------------------------------------------------------
-- 3) LA VISTA DICE CUANTAS FILAS PUDO VER, Y ESO ES LO QUE ARREGLA EL CERO
--
--    ============================================================================
--     ESTE ES EL ARREGLO QUE SOBREVIVE AL DE ARRIBA
--    ============================================================================
--
--    Cargar el permiso alcanza para hoy. Pero la vista hace `left join` y `coalesce(...,0)`, asi
--    que NO PUEDE distinguir "esta tarjeta esta en cero" de "no veo sus movimientos". Las dos
--    salen 0, y el front no tiene con que decidir.
--
--    El dia que aparezca un rol nuevo, o una tarjeta donde la gestora no trabaje, el cero
--    silencioso vuelve. Con esta columna el front puede decir "sin datos", que es la verdad, en
--    vez de un numero que se lee como un hecho.
--
--    `count(m.id)` y no `count(*)`: con `left join`, `count(*)` cuenta la fila de la tarjeta aun
--    cuando no hay ningun movimiento, y daria 1 donde la respuesta es 0.
--
--    LA COLUMNA NUEVA VA AL FINAL, DESPUES DE `orden`, Y NO DONDE QUEDA LINDO. `create or replace
--    view` no puede renombrar ni reordenar columnas: si se mete en el medio, Postgres lee que la
--    quinta columna paso de llamarse `orden` a `movimientos_visibles` y rechaza la migracion con
--    42P16. Se probo, y ese es el error que devolvio.
-- ------------------------------------------------------------

create or replace view public.v_saldos with (security_invoker = true) as
select th.id as tarjeta_id,
       th.nombre,
       coalesce(sum(m.importe) filter (
         where m.tipo in ('saldo_inicial','ingreso','pago','ajuste')
           and m.fecha_acreditacion <= public.hoy_argentina()), 0) as contable,
       coalesce(sum(m.importe) filter (
         where m.tipo = 'ingreso' and m.fecha_acreditacion > public.hoy_argentina()
           and not m.anulado), 0) as en_transito,
       coalesce(-sum(m.importe) filter (
         where m.tipo in ('reserva','ajuste_reserva','reversa_reserva')), 0) as comprometido,
       th.orden,
       count(m.id) as movimientos_visibles
  from public.tarjetas_habitualista th
  left join public.movimientos m on m.tarjeta_id = th.id
 group by th.id, th.nombre, th.orden;

comment on view public.v_saldos is
  'contable tiene que dar IGUAL al saldo del sitio de Habitualista. en_transito no cuenta los '
  'depositos anulados. `movimientos_visibles` en 0 significa QUE NO SE VEN LOS MOVIMIENTOS, no '
  'que la tarjeta este en cero: la pantalla tiene que decir "sin datos" y no un importe.';

revoke insert, update, delete, truncate on public.v_saldos from anon, authenticated;
grant select on public.v_saldos to authenticated;

-- ============================================================================
--  COMO COMPROBAR QUE QUEDO BIEN
--
--  1) CON UNA SESION DE GESTORA, y esto es lo que importa. Contra la API, no en la consola SQL:
--     tiene que ver el saldo de las tarjetas de SUS tramites, con numeros de verdad.
--     Lo cubre `npm run test:rls`.
--
--  2) Y NO las otras. Una gestora sin tramites en Doral Chevrolet tiene que ver
--     `movimientos_visibles = 0` en esa tarjeta, no un saldo.
--
--  3) La oficina sigue viendo las cinco con sus movimientos.
--
--  4) `anon` sigue recibiendo CERO FILAS y no un 42501:
--       set local role anon; select * from public.v_saldos;
-- ============================================================================
