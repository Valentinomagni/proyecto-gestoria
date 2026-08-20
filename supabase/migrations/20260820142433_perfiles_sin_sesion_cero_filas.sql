-- ============================================================================
--  SIN SESION SE VEN CERO FILAS, NO UN ERROR DE PERMISOS
-- ============================================================================
--
--  ============================================================================
--   EL DEFECTO QUE ESTO ARREGLA, Y COMO SE ENCONTRO
--  ============================================================================
--
--  Lo agarro el arnes de permisos, corriendo contra la API real: despues de pasar `perfiles` a
--  `es_oficina()`, un cliente SIN SESION que leia `perfiles` recibia el error 42501 —permiso
--  denegado— en vez de una lista vacia.
--
--  LA CAUSA es una diferencia de una linea entre los dos helpers:
--
--    `es_gerencia()` nunca tuvo un `revoke ... from public`, asi que conservo el EXECUTE que
--    toda funcion de Postgres trae por defecto para PUBLIC. `anon` hereda de PUBLIC, la podia
--    ejecutar, le daba false, y la policy devolvia cero filas.
--
--    `es_oficina()` SI hace `revoke all ... from public, anon`, que es lo correcto. Entonces
--    cuando `anon` evalua la policy, la llamada a la funcion explota antes de poder dar false.
--
--  ============================================================================
--   POR QUE SE ARREGLA EN LA POLICY Y NO DANDOLE EXECUTE A ANON
--  ============================================================================
--
--  Darle EXECUTE a `anon` haria desaparecer el error, y seria el arreglo equivocado: dejaria a
--  cualquiera sin sesion pudiendo ejecutar una funcion SECURITY DEFINER que lee `perfiles`.
--  Inofensiva hoy, porque para `anon` siempre devuelve false. Una linea de mas para revisar
--  para siempre, y un precedente para la proxima.
--
--  Lo correcto es que `anon` NUNCA LLEGUE a evaluar la policy. Con `to authenticated`, Postgres
--  ni siquiera la considera para ese rol: no hay policy que aplique, y sin policy que aplique la
--  RLS devuelve cero filas. Que es exactamente lo que tiene que pasar.
--
--  LA REGLA QUE QUEDA ESCRITA: toda policy que llame a un helper `security definer` tiene que
--  decir `to authenticated`. Sin eso, `anon` intenta ejecutar el helper y la ausencia se
--  convierte en un rechazo.
--
--  ES ADITIVA EN DATOS: no toca ninguna fila, y para quien entro no cambia absolutamente nada.

drop policy if exists "perfiles_select" on public.perfiles;
create policy "perfiles_select" on public.perfiles for select to authenticated
  using (
    id = auth.uid()          -- columna de la propia fila, sin subconsulta: nada de recursion
    or public.es_oficina()
  );

drop policy if exists "perfiles_update_gerencia" on public.perfiles;
create policy "perfiles_update_gerencia" on public.perfiles for update to authenticated
  using (public.es_oficina()) with check (public.es_oficina());

-- La de update de la fila propia ya decia `to authenticated`? No: se recrea igual, por la misma
-- razon, para que las tres policies de esta tabla queden dichas de la misma forma.
drop policy if exists "perfiles_update_propio" on public.perfiles;
create policy "perfiles_update_propio" on public.perfiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- ============================================================================
--  COMO COMPROBAR QUE QUEDO BIEN
--
--  1) Las tres policies de perfiles aplican solo a authenticated. Tiene que dar {authenticated}
--     en las tres:
--       select policyname, roles from pg_policies
--        where schemaname='public' and tablename='perfiles' order by policyname;
--
--  2) Y que no quede NINGUNA policy del esquema que llame a un helper sin decir a quien aplica.
--     Tiene que dar CERO filas:
--       select tablename, policyname, roles from pg_policies
--        where schemaname = 'public'
--          and (qual like '%es_oficina%' or with_check like '%es_oficina%'
--            or qual like '%es_gestora%' or with_check like '%es_gestora%'
--            or qual like '%puede_ver_cobros%' or with_check like '%puede_ver_cobros%')
--          and roles = '{public}';
--
--  3) LA QUE IMPORTA, y es la que lo encontro: `npm run test:rls`. El test dice, textual, que
--     sin loguearse se ven cero filas Y NO ES UN ERROR.
-- ============================================================================
