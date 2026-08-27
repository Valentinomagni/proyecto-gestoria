-- ============================================================================
--  UN TRAMITE PRESUPUESTADO NO SE QUEDA SIN PRESUPUESTO
-- ============================================================================
--
--  ============================================================================
--   EL DEFECTO, VISTO EN PANTALLA CON UNA SESION DE VERDAD
--  ============================================================================
--
--  El 27/08/2026, entrando con las tres cuentas reales, la pantalla de Pedidos de fondos mostraba:
--
--      MARTINEZ DIEGO ARMANDO   pide 520.000,00
--      BALAGUER JUAN ANTONIO    pide $ 0,00
--
--  UN PEDIDO DE FONDOS DE CERO PESOS. BALAGUER esta `presupuestado` y tiene CERO lineas vivas:
--  alguien le anulo la unica que tenia, el 25/08 —"Arancel 450000.00 QUITADA: erro"— y el tramite
--  se quedo ahi.
--
--  La maquina de estados exige al menos una linea para ENTRAR a `presupuestado`:
--
--      if lineas_presupuesto = 0 then
--        raise exception 'regla_tramite: Falta cargar el presupuesto...';
--
--  Pero nada impedia VACIARLO DESPUES. La regla vigilaba la puerta de entrada y dejaba la ventana
--  abierta, que es la forma exacta que este proyecto ya tuvo tres veces con los indices unicos.
--
--  ============================================================================
--   Y NO ERA SOLO FEO: ESE MISMO TRAMITE TENIA 450.000 COMPROMETIDOS
--  ============================================================================
--
--  La reserva habia quedado huerfana, porque `h_conceptos_total_presupuesto` guarda NULL cuando la
--  suma da cero y la rama de correccion exigia `> 0`. Eso ya lo arreglo `conciliar_tramite`, que
--  libero los 450.000. Pero la conciliacion arregla la PLATA, no el estado: el tramite sigue
--  figurando presupuestado sin presupuesto, y sigue apareciendo en la lista pidiendo cero.
--
--  Son dos defectos con la misma raiz, y este es el que quedaba.
--
--  ============================================================================
--   SE ELIGE BLOQUEAR, Y NO MANDAR EL TRAMITE PARA ATRAS SOLO
--  ============================================================================
--
--  La otra opcion era que al quitar la ultima linea el tramite volviera a `entregado` por su
--  cuenta. Se descarto: un estado que cambia solo, sin que nadie lo pida, es lo que hacia
--  `frenado_por_saldo` insoportable — la pantalla decia una cosa distinta de la que la persona
--  habia hecho, y nadie sabia por que.
--
--  Bloquear es mas honesto y ademas ensenia el camino correcto: si el presupuesto esta mal, se
--  carga la linea nueva ANTES de quitar la vieja. El total se recalcula solo y la reserva se
--  ajusta por la diferencia, que es exactamente para lo que existe `ajuste_reserva`.
--
--  ES ADITIVA: un trigger nuevo y UNA fila corregida.
-- ============================================================================

-- ------------------------------------------------------------
-- 1) La regla
-- ------------------------------------------------------------

create or replace function public.b_conceptos_presupuesto_no_vacio()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_estado text;
  v_vivas  int;
begin
  -- Solo interesa el momento de ANULAR una linea del presupuesto. Cargar y corregir no vacian nada.
  if new.momento <> 'presupuesto' then return new; end if;
  if not new.anulada then return new; end if;
  if old.anulada then return new; end if;                     -- ya estaba anulada
  if auth.uid() is null then return new; end if;              -- consola de la base

  select estado into v_estado from public.tramites where id = new.tramite_id;
  if v_estado <> 'presupuestado' then return new; end if;

  /*
    SE CUENTAN LAS QUE QUEDARIAN, no las que hay. Este trigger es BEFORE, asi que la fila que se
    esta anulando todavia figura viva en la tabla: hay que excluirla a mano por su id.
  */
  select count(*) into v_vivas
    from public.tramite_conceptos
   where tramite_id = new.tramite_id and momento = 'presupuesto'
     and not anulada and id <> new.id;

  if v_vivas = 0 then
    raise exception 'regla_tramite: Ésta es la última línea del presupuesto, y un trámite presupuestado no puede quedarse sin ninguna. Si el presupuesto está mal, cargá la línea nueva primero y después quitá esta.';
  end if;

  return new;
end;
$$;

revoke execute on function public.b_conceptos_presupuesto_no_vacio() from public, anon, authenticated;

drop trigger if exists b_conceptos_presupuesto_no_vacio on public.tramite_conceptos;
create trigger b_conceptos_presupuesto_no_vacio
  before update on public.tramite_conceptos
  for each row execute function public.b_conceptos_presupuesto_no_vacio();

-- ------------------------------------------------------------
-- 2) Y el que ya estaba vacio vuelve a donde corresponde
--
--    BALAGUER quedo `presupuestado` sin presupuesto. Su lugar es `entregado`: esta en manos de la
--    gestora, esperando que se le cargue el presupuesto. Tiene gestora asignada y `entregado_at`
--    escrito, asi que vuelve a un estado que ya ocupo.
--
--    NO MUEVE PLATA: `conciliar_tramite` ya le libero los 450.000, y en `entregado` lo que
--    corresponde comprometer sigue siendo cero. Se comprueba abajo.
-- ------------------------------------------------------------

update public.tramites
   set estado = 'entregado'
 where estado = 'presupuestado'
   and not exists (
     select 1 from public.tramite_conceptos c
      where c.tramite_id = tramites.id and c.momento = 'presupuesto' and not c.anulada
   );

-- ============================================================================
--  COMO COMPROBAR QUE QUEDO BIEN
--
--  1) NO QUEDA NINGUN PRESUPUESTADO SIN PRESUPUESTO. Tiene que dar cero filas:
--       select cliente_nombre from public.tramites t
--        where t.estado = 'presupuestado'
--          and not exists (select 1 from public.tramite_conceptos c
--                           where c.tramite_id = t.id and c.momento = 'presupuesto'
--                             and not c.anulada);
--
--  2) Y NO SE PUEDE VOLVER A VACIAR. Con una sesion de gestora, sobre un presupuestado de una
--     sola linea, TIENE QUE FALLAR:
--       update tramite_conceptos set anulada = true, motivo_anulacion = 'probando'
--        where id = '<la unica linea viva>';
--     Esperado: 'Ésta es la última línea del presupuesto...'.
--
--  3) PERO QUITAR UNA DE VARIAS SI SE PUEDE. Sobre uno con tres lineas, tiene que ENTRAR. Sin
--     esta comprobacion, un guardian que bloquea todo pasaria por bueno.
--
--  4) LA PLATA NO SE MOVIO:
--       select nombre, contable, comprometido from public.v_saldos order by orden;
--     Esperado: Paris Autos en 9.435.000,00 y 520.000,00, igual que antes.
-- ============================================================================
