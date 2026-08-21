-- ============================================================================
--  EL TOTAL DEL PRESUPUESTO NO SE ESCRIBE A MANO
-- ============================================================================
--
--  La migracion 20260821192919 hizo que `deposito_solicitado` sea la suma de las lineas. Pero
--  "es la suma" era, hasta aca, una PROMESA del trigger: nada impedia escribir esa columna
--  directamente.
--
--  Y `deposito_solicitado` esta en la lista de columnas que una gestora puede tocar, en
--  `b_tramites_bloquear_campos`. Asi que desde la consola del navegador alcanzaba con
--
--      update tramites set deposito_solicitado = 99999999 where id = '...';
--
--  para mover el comprometido de la tarjeta sin que exista ni una linea que lo explique. Es
--  exactamente "se pisan los saldos", que es el problema que el proyecto viene a resolver.
--
--  La pregunta de diseño de este proyecto es siempre la misma: ¿puede la base hacerlo IMPOSIBLE,
--  en vez de que el front lo pida por favor? Acá puede.
--
--  ============================================================================
--   POR QUE HACE FALTA UNA MARCA DE TRANSACCION, Y NO ALCANZA CON `security definer`
--  ============================================================================
--
--  El recalculo lo hace `h_conceptos_total_presupuesto`, que es SECURITY DEFINER. Pero
--  SECURITY DEFINER cambia el DUENIO de la ejecucion, no `auth.uid()`: adentro de ese trigger,
--  `auth.uid()` sigue siendo la gestora que cargo la linea. Un guardia que mirara solamente el
--  usuario bloquearia tambien al recalculo, y entonces no se podria cargar ningun presupuesto.
--
--  Por eso el recalculo deja una marca con `set_config(..., true)`. El tercer parametro en true
--  la hace LOCAL A LA TRANSACCION: se borra sola al terminar, no se puede filtrar a la siguiente
--  consulta, y no hay forma de encenderla desde afuera de una transaccion que ya paso por el
--  recalculo.
--
--  ============================================================================
--   Y LA COLUMNA SIGUE EN LA LISTA DE PERMITIDOS
--  ============================================================================
--
--  Podria parecer mas simple sacar `deposito_solicitado` de `permitidos`. No lo es: esa lista la
--  mira `b_tramites_bloquear_campos` comparando el tramite viejo contra el nuevo, y el update
--  del recalculo tambien pasa por ahi con `auth.uid()` de la gestora. Sacarla de la lista
--  bloquearia el recalculo. La columna se queda permitida, y este trigger decide QUIEN la
--  escribe.
--
--  ES ADITIVA: no toca ninguna fila.
-- ============================================================================

-- ------------------------------------------------------------
-- 1) El recalculo deja su marca
--
--    Se reescribe la funcion entera: `create or replace` reemplaza todo el cuerpo.
-- ------------------------------------------------------------

create or replace function public.h_conceptos_total_presupuesto()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_tramite uuid := new.tramite_id;
  v_suma    numeric(14,2);
  v_nuevo   numeric(14,2);
begin
  select coalesce(sum(importe), 0) into v_suma
    from public.tramite_conceptos
   where tramite_id = v_tramite and momento = 'presupuesto' and not anulada;

  -- Cero se guarda como NULL y no como 0: la maquina de estados pregunta por null para saber si
  -- todavia no hay presupuesto, y un 0 significaria "se presupuesto en cero", que no existe.
  v_nuevo := case when v_suma = 0 then null else v_suma end;

  -- El `is distinct from` no es una optimizacion: sin el, cada linea de costo real dispararia
  -- un update del tramite con el mismo valor, y eso escribiria una fila de historial por nada.
  if v_nuevo is distinct from (select deposito_solicitado from public.tramites where id = v_tramite) then
    -- La marca es LOCAL A LA TRANSACCION. Ver la cabecera: sin ella, el guardia de abajo
    -- bloquearia este mismo update, porque adentro de un SECURITY DEFINER `auth.uid()` sigue
    -- siendo la persona que cargo la linea.
    perform set_config('app.total_derivado', '1', true);

    update public.tramites set deposito_solicitado = v_nuevo where id = v_tramite;

    perform set_config('app.total_derivado', '', true);
  end if;

  return null;
end;
$$;

revoke execute on function public.h_conceptos_total_presupuesto() from public, anon, authenticated;

-- ------------------------------------------------------------
-- 2) El guardia
--
--    Se llama b_ y va despues de b_tramites_bloquear_campos por orden alfabetico, que es como
--    Postgres ordena los triggers BEFORE del mismo evento.
-- ------------------------------------------------------------

create or replace function public.b_tramites_total_derivado()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.deposito_solicitado is not distinct from old.deposito_solicitado then return new; end if;

  -- Consola de la base y migraciones: no hay sesion, y es donde vive el arrastre de datos.
  if auth.uid() is null then return new; end if;

  -- El recalculo, y solo el, deja esta marca.
  if coalesce(current_setting('app.total_derivado', true), '') = '1' then return new; end if;

  raise exception 'regla_tramite: El total del presupuesto es la suma de sus conceptos. Para cambiarlo, agrega, corregi o quita una linea del presupuesto.';
end;
$$;

drop trigger if exists b_tramites_total_derivado on public.tramites;
create trigger b_tramites_total_derivado
  before update on public.tramites
  for each row execute function public.b_tramites_total_derivado();

revoke execute on function public.b_tramites_total_derivado() from public, anon, authenticated;

comment on column public.tramites.deposito_solicitado is
  'El total del presupuesto. ES DERIVADO: lo calcula h_conceptos_total_presupuesto como la suma '
  'de las lineas no anuladas de momento = presupuesto. Nadie con sesion lo puede escribir a mano; '
  'lo impide b_tramites_total_derivado. De el cuelga la reserva de la Tarjeta Habitualista, asi '
  'que un valor escrito a mano seria plata comprometida sin ninguna linea que la explique.';

-- ============================================================================
--  COMO COMPROBAR QUE QUEDO BIEN
--
--  1) Cargar una linea SIGUE ANDANDO — es lo primero, porque este guardia mal hecho rompe el
--     presupuesto entero:
--       insert into public.tramite_conceptos (tramite_id, concepto_id, momento, importe)
--       values ('<tramite vivo>', (select id from public.conceptos where nombre='Sellados'),
--               'presupuesto', 1000);
--       select deposito_solicitado from public.tramites where id = '<tramite vivo>';
--     Esperado: subio 1000.
--
--  2) Y ESCRIBIRLO A MANO NO. Contra la API, con una gestora logueada:
--       update tramites set deposito_solicitado = 99999999 where id = '<uno suyo>';
--     Esperado: 'El total del presupuesto es la suma de sus conceptos'.
--     Esta comprobacion NO se puede hacer desde la consola SQL del panel: ahi auth.uid() es null
--     y el guardia deja pasar a proposito, porque es donde corren las migraciones. Va en
--     `npm run test:rls`, contra la API real y con un usuario real.
--
--  3) La marca no sobrevive a la transaccion:
--       select current_setting('app.total_derivado', true);
--     Esperado: vacio o null, en una sesion nueva.
-- ============================================================================
