-- ============================================================================
--  LOS HELPERS QUE LEEN `perfiles` DEJAN DE SER EJECUTABLES POR CUALQUIERA
-- ============================================================================
--
--  LO MIDIO LA REVISION DE SEGURIDAD DEL 28/08/2026, en `pg_proc.proacl`: siete funciones
--  `security definer` seguian con `=X/postgres` —o sea, EXECUTE para PUBLIC— y con `anon=X`:
--
--      mi_gestora_id, es_gestora, es_gerencia, es_contable, mi_rol,
--      puede_ver_cobros, opero_esta_tarjeta
--
--  Contradice de frente una decision escrita en `20260820142433`, que dice, textual:
--
--      "Darle EXECUTE a anon haria desaparecer el error, y seria el arreglo equivocado... Una
--       linea de mas para revisar para siempre, y un precedente para la proxima."
--
--  El precedente ya estaba puesto, en siete funciones, sin que nadie lo decidiera. Y de ahi salia
--  algo peor: el encabezado de `20260828183055` dice que `mi_gestora_id()` tiene `anon=X` a
--  proposito, y era cierto POR ACCIDENTE — nadie se lo habia revocado.
--
--  ============================================================================
--   HOY NO SE SACA NADA, Y ESA NO ES LA RAZON PARA DEJARLO
--  ============================================================================
--
--  Las siete filtran por `auth.uid()`, que sin sesion es nulo, asi que devuelven false o null sin
--  leer una fila. No hay fuga. Lo que hay es superficie que nadie decidio, y un permiso que
--  sobrevive a que la funcion cambie: el dia que una de estas devuelva algo mas que un booleano,
--  el grant sigue puesto.
--
--  ============================================================================
--   LAS DOS QUE `anon` SI NECESITA, Y POR QUE
--  ============================================================================
--
--  Medido antes de revocar, no supuesto:
--
--   - De las OCHO vistas con SELECT para `anon`, solo dos nombran un helper: `v_cola_de_gestora`
--     llama a `mi_gestora_id()`, y `v_saldos` / `v_resumen_empresas` llaman a `puedo_ver_tarjeta()`.
--   - Las 44 policies del esquema aplican TODAS a `authenticated`. Ninguna alcanza a `anon`, asi
--     que ninguna evalua un helper con ese rol.
--
--  Postgres comprueba el permiso de `execute` AL PLANIFICAR: sin el grant, quien no entro recibe
--  42501 (RECHAZO) en vez de cero filas (AUSENCIA). Por eso `mi_gestora_id` conserva `anon`, ahora
--  escrito y con su motivo. `puedo_ver_tarjeta` ya lo tenia escrito desde su propia migracion.
-- ============================================================================

revoke all on function public.es_gestora() from public, anon;
revoke all on function public.es_gerencia() from public, anon;
revoke all on function public.es_contable() from public, anon;
revoke all on function public.mi_rol() from public, anon;
revoke all on function public.puede_ver_cobros() from public, anon;
revoke all on function public.opero_esta_tarjeta(uuid) from public, anon;

-- `mi_gestora_id` pierde PUBLIC pero conserva `anon`, con el motivo escrito arriba.
revoke all on function public.mi_gestora_id() from public;
grant execute on function public.mi_gestora_id() to anon, authenticated;

comment on function public.mi_gestora_id() is
  'La gestora de quien consulta, o null sin sesion. `anon` PUEDE ejecutarla a proposito: '
  '`v_cola_de_gestora` la llama y esta otorgada a anon, y Postgres mira el permiso de execute al '
  'planificar — sin esto, quien no entro recibiria 42501 en vez de cero filas.';

-- Y las seis que se acaban de revocar siguen siendo de `authenticated`, que es quien las usa.
grant execute on function public.es_gestora() to authenticated;
grant execute on function public.es_gerencia() to authenticated;
grant execute on function public.es_contable() to authenticated;
grant execute on function public.mi_rol() to authenticated;
grant execute on function public.puede_ver_cobros() to authenticated;
grant execute on function public.opero_esta_tarjeta(uuid) to authenticated;
