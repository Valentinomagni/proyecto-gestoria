-- ============================================================================
--  LAS SEIS POLICIES QUE DECIAN `es_gerencia() OR es_contable()` A MANO
-- ============================================================================
--
--  COMO APARECIERON. La migracion anterior convirtio a `es_oficina()` todas las policies que
--  nombraban SOLO a gerencia, y despues se corrio su propio bloque de comprobacion: "no queda
--  ninguna policy colgada de es_gerencia". Devolvio SEIS.
--
--  Eran las que ya nombraban a los dos roles con un `or` escrito a mano. Hoy hacen exactamente
--  lo mismo que `es_oficina()`, asi que **no hay ningun cambio de comportamiento en esta
--  migracion**. Lo que cambia es donde vive la decision.
--
--  ============================================================================
--   POR QUE IGUAL HAY QUE TOCARLAS, SI HOY HACEN LO MISMO
--  ============================================================================
--
--  El helper existe para que el dia que un cuarto rol tenga que administrar se toque UNA
--  funcion y ninguna policy. Con seis policies que repiten la lista a mano, ese dia se van a
--  cambiar las otras y estas seis van a quedar atras — en silencio, y sobre `tramites` y
--  `movimientos`, que son las dos tablas donde menos se puede fallar.
--
--  Un helper que no es el unico lugar que decide no es un helper: es una copia mas.
--
--  Y ES LA COMPROBACION LA QUE ENCONTRO ESTO, no una relectura. Por eso cada migracion trae
--  adentro como comprobarse, y por eso se corre de verdad en vez de confiar en que el comando
--  dijo "Finished".
--
--  ES ADITIVA EN DATOS Y NEUTRA EN COMPORTAMIENTO: cada policy queda diciendo lo mismo.

-- ------------------------------------------------------------
-- tramites
-- ------------------------------------------------------------

drop policy if exists "tramites_select" on public.tramites;
create policy "tramites_select" on public.tramites for select to authenticated
  using (
    public.es_oficina()
    or (public.es_gestora() and gestora_id = public.mi_gestora_id())
  );

drop policy if exists "tramites_insert" on public.tramites;
create policy "tramites_insert" on public.tramites for insert to authenticated
  with check (public.es_oficina());

drop policy if exists "tramites_update_oficina" on public.tramites;
create policy "tramites_update_oficina" on public.tramites for update to authenticated
  using (public.es_oficina()) with check (public.es_oficina());

-- ------------------------------------------------------------
-- tramite_requisitos
--
--   Sigue siendo solo de oficina, y a proposito: el checklist del legajo es el control que hace
--   administracion ANTES de mandar el tramite a gestoria. Que lo conteste quien lo recibe seria
--   controlarse a si mismo.
-- ------------------------------------------------------------

drop policy if exists "tramite_requisitos_write" on public.tramite_requisitos;
create policy "tramite_requisitos_write" on public.tramite_requisitos for all to authenticated
  using (public.es_oficina()) with check (public.es_oficina());

-- ------------------------------------------------------------
-- movimientos
--
--   La gestora VE el saldo de las tarjetas donde tiene tarjeta de debito —sin ver el saldo no
--   puede decidir si presenta— pero no escribe ni una fila: el debito lo escribe el trigger,
--   que es SECURITY DEFINER. Eso no cambia acá.
-- ------------------------------------------------------------

drop policy if exists "movimientos_select" on public.movimientos;
create policy "movimientos_select" on public.movimientos for select to authenticated
  using (
    public.es_oficina()
    or (public.es_gestora() and public.opero_esta_tarjeta(tarjeta_id))
  );

drop policy if exists "movimientos_insert" on public.movimientos;
create policy "movimientos_insert" on public.movimientos for insert to authenticated
  with check (
    public.es_oficina()
    and tipo in ('saldo_inicial','ingreso','ajuste')
  );

-- ============================================================================
--  COMO COMPROBAR QUE QUEDO BIEN
--
--  1) Ahora si, CERO policies colgadas de es_gerencia:
--       select tablename, policyname from pg_policies
--        where schemaname = 'public'
--          and (qual like '%es_gerencia%' or with_check like '%es_gerencia%');
--
--  2) Y las seis quedaron nombrando a es_oficina (esperado: 6 o mas):
--       select count(*) from pg_policies
--        where schemaname = 'public'
--          and (qual like '%es_oficina%' or with_check like '%es_oficina%');
--
--  3) LA QUE IMPORTA, porque esta migracion toca `tramites` y `movimientos`:
--     `npm run test:rls`, que comprueba contra la API real que la gestora sigue sin llegar al
--     margen por ninguno de los cuatro caminos y que el libro mayor sigue siendo de solo
--     insercion. Si algo de esto se rompio, ahi se ve.
-- ============================================================================
