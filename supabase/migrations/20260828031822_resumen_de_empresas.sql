-- ============================================================================
--  UNA FILA POR EMPRESA, QUE ES LA PUERTA DE ENTRADA DE LA OFICINA
-- ============================================================================
--
--  Es el nivel 1 de la app de la oficina: las cinco empresas con sus cifras y cuantos tramites
--  estan esperando plata en cada una. Cada fila lleva a la empresa.
--
--  ============================================================================
--   POR QUE UNA VISTA Y NO UNA CUENTA EN EL FRONT
--  ============================================================================
--
--  Porque estos numeros los miran DOS apps. Si cada una hiciera su cuenta, el dia que alguien
--  cambie el criterio las dos mostrarian numeros distintos del mismo hecho, y entonces nadie le
--  cree a ninguna. Ya paso con "esperando plata" cuando era un estado que se marcaba a mano.
--
--  ============================================================================
--   `esperan` SALE DE LA VISTA, NO DE UN `count` PROPIO
--  ============================================================================
--
--  Contar aca los tramites presupuestados cuya tarjeta no cubre seria escribir por segunda vez la
--  regla que ya vive en `v_esperando_plata`. Dos copias de una regla se separan: la primera vez
--  que alguien cambie el criterio va a cambiar una sola, y el resumen va a decir 3 mientras la
--  pantalla de la empresa muestra 2.
--
--  ============================================================================
--   `movimientos_visibles` VIAJA HASTA ACA, Y NO ES DE MAS
--  ============================================================================
--
--  Una tarjeta cuyos movimientos no se pueden leer sale con los mismos ceros que una vacia. El
--  27/08/2026 toda gestora veia las cinco tarjetas en $ 0,00 mientras Paris Autos tenia ocho
--  millones y medio: un cero es un numero y se lee como un hecho.
--
--  El resumen tiene que poder escribir "Sin datos" en esa fila, y para eso necesita el dato.
--
--  ============================================================================
--   UNA RAZON SOCIAL POR TARJETA, COMPROBADO
--  ============================================================================
--
--  Medido el 27/08/2026: las cinco razones sociales activas apuntan cada una a su tarjeta, uno a
--  uno. Por eso el `left join` no duplica filas. Si algun dia dos apuntaran a la misma, la plata
--  de esa tarjeta se contaria dos veces en el total del grupo — y por eso hay una prueba en el
--  arnes que compara la suma de esta vista contra la de `v_saldos`.
--
--  ES ADITIVA: una vista nueva. No toca ninguna fila ni ninguna policy.
-- ============================================================================

create or replace view public.v_resumen_empresas with (security_invoker = true) as
select r.id                                as razon_social_id,
       r.nombre,
       r.tarjeta_id,
       coalesce(s.contable, 0)             as contable,
       coalesce(s.en_transito, 0)          as en_transito,
       coalesce(s.comprometido, 0)         as comprometido,
       coalesce(s.contable, 0) - coalesce(s.comprometido, 0) as diferencia,
       coalesce(e.esperan, 0)              as esperan,
       coalesce(s.movimientos_visibles, 0) as movimientos_visibles,
       r.orden
  from public.razones_sociales r
  left join public.v_saldos s on s.tarjeta_id = r.tarjeta_id
  left join (
    select tarjeta_id, count(*) as esperan
      from public.v_esperando_plata
     group by tarjeta_id
  ) e on e.tarjeta_id = r.tarjeta_id
 where r.activa;

comment on view public.v_resumen_empresas is
  'Una fila por razon social activa, con las cifras de su tarjeta y cuantos tramites estan '
  'esperando plata. Es la puerta de entrada de la oficina. `movimientos_visibles` en 0 significa '
  'QUE NO SE VEN LOS MOVIMIENTOS, no que la empresa este en cero: la pantalla tiene que decir '
  '"Sin datos" y no un importe.';

revoke insert, update, delete, truncate on public.v_resumen_empresas from anon, authenticated;
grant select on public.v_resumen_empresas to authenticated;

-- ============================================================================
--  COMO COMPROBAR QUE QUEDO BIEN
--
--  1) Cinco filas, una por empresa activa:
--       select nombre, contable, comprometido, diferencia, esperan
--         from public.v_resumen_empresas order by orden;
--     Esperado hoy: Paris Autos 11.940.627,92 / 820.000,00, Paris Cars 5.000.000,00 / 0, y las
--     otras tres en cero.
--
--  2) LA SUMA CIERRA CONTRA v_saldos, que es de donde sale:
--       select (select sum(contable) from public.v_resumen_empresas) as resumen,
--              (select sum(contable) from public.v_saldos) as saldos;
--     Esperado: IGUALES. Si difieren, hay dos razones sociales apuntando a la misma tarjeta y el
--     `left join` esta duplicando su plata.
--
--  3) Es de solo lectura y lleva security_invoker:
--       select has_table_privilege('authenticated','public.v_resumen_empresas','UPDATE') as u,
--              has_table_privilege('authenticated','public.v_resumen_empresas','SELECT') as s;
--       select reloptions from pg_class where relname = 'v_resumen_empresas';
--     Esperado: u en false, s en true, y `security_invoker=true` en las opciones.
--
--  4) CON SESION DE GESTORA, las empresas donde no trabaja dan `movimientos_visibles = 0`.
--     Lo cubre `npm run test:rls`.
-- ============================================================================
