-- ============================================================================
--  GESTORIA — LA CUENTA CORRIENTE DE LA TARJETA HABITUALISTA
--
--  Es el corazon del producto. Leer entera antes de tocar nada.
-- ============================================================================
--
--  POR QUE UN LIBRO MAYOR Y NO UNA COLUMNA `saldo`
--
--  El problema que dispara el proyecto entero, textual del pedido: "muchas veces nos pisamos
--  los saldos disponibles en la tarjeta habitualista por no manejar un solo listado unificado".
--  Un campo `saldo` mutable es EXACTAMENTE el objeto que se pisa: dos escrituras concurrentes y
--  gana la ultima, sin error y sin rastro. Una suma de filas insertadas no se pisa nunca.
--
--  POR QUE NADIE PUEDE HACER UPDATE NI DELETE ACA, NI GERENCIA
--
--  Un movimiento equivocado se corrige con uno de tipo `ajuste`, con su motivo. Editar el
--  original haria que el saldo de ayer deje de ser reconstruible, y sin eso la conciliacion
--  contra el listado real del habitualista no cierra nunca.
--
--  LAS DOS FECHAS, y sin esto la pantalla MIENTE
--
--  El deposito se ordena hasta las 16:00 y ACREDITA AL DIA SIGUIENTE. `fecha` es cuando se
--  ordeno; `fecha_acreditacion` es cuando la plata esta de verdad. Sin la separacion, un
--  deposito cargado a las 15:00 figura como saldo disponible hoy y alguien manda a presentar
--  un tramite contra plata que no existe — que es justo lo que el proyecto viene a evitar.
--
--  TRES CIFRAS, y cada una decide algo distinto
--    contable    = lo acreditado. Tiene que dar igual al "Saldo disponible" del sitio.
--    en_transito = ordenado hoy, acredita maniana. El sitio tampoco lo muestra.
--    comprometido= presupuestos cargados y todavia sin pagar.
--  Y las dos derivadas:
--    disponible hoy    = contable - comprometido      -> decidir si se presenta hoy
--    proyectado maniana= contable + en_transito - comprometido -> decidir cuanto depositar
--
--  ATENCION, Y ESTO ROMPE TODO EN SILENCIO:
--  NO correr nunca `alter table public.movimientos force row level security`. El duenio de una
--  tabla esta exento de RLS salvo con FORCE. Con FORCE, el trigger SECURITY DEFINER que inserta
--  la reserva deja de poder escribir, y el sintoma es el peor posible: la gestora carga el
--  presupuesto, la pantalla dice que guardo, y el saldo no se mueve.
-- ============================================================================

create table if not exists public.movimientos (
  id                 bigserial primary key,
  tarjeta_id         uuid not null references public.tarjetas_habitualista(id),
  fecha              timestamptz not null default now(),
  fecha_acreditacion date not null default current_date,
  tipo               text not null,
  importe            numeric(14,2) not null,
  tramite_id         uuid references public.tramites(id),
  gestora_id         uuid references public.gestoras(id),
  concepto           text,
  observacion        text,
  origen             text not null default 'app',
  creado_por         uuid references public.perfiles(id),
  creado_at          timestamptz not null default now(),

  constraint movimientos_tipo_valido check (tipo in (
    'saldo_inicial','ingreso','reserva','reversa_reserva','ajuste_reserva','pago','ajuste')),
  constraint movimientos_importe_no_cero check (importe <> 0),

  -- El signo lo impone LA BASE y no el front: un ingreso negativo o un pago positivo dan vuelta
  -- el saldo entero, y no hay forma de darse cuenta mirando la lista.
  constraint movimientos_signo_coherente check (
       (tipo in ('ingreso','reversa_reserva') and importe > 0)
    or (tipo in ('reserva','pago') and importe < 0)
    or (tipo in ('saldo_inicial','ajuste','ajuste_reserva'))),

  constraint movimientos_reserva_con_tramite check (
    tipo not in ('reserva','reversa_reserva','ajuste_reserva','pago') or tramite_id is not null),

  constraint movimientos_ajuste_con_motivo check (
    tipo <> 'ajuste' or nullif(btrim(coalesce(observacion,'')),'') is not null)
);

comment on table public.movimientos is
  'Libro mayor de la Tarjeta Habitualista. SOLO SE INSERTA: no hay policy de update ni de delete para ningun rol, ni para gerencia. Un error se compensa con un ajuste, con su motivo escrito.';

comment on column public.movimientos.importe is
  'Con signo: positivo entra, negativo sale. numeric y NUNCA float: en float 0.1+0.2 no da 0.3, y un saldo de siete cifras acumula centavos que despues nadie puede explicar.';

comment on column public.movimientos.fecha_acreditacion is
  'Cuando la plata esta DE VERDAD. Para pago y reserva coincide con fecha: el debito es inmediato. Para un ingreso NO: el deposito se ordena hasta las 16:00 y acredita al dia siguiente. Sin esta columna, la pantalla diria que hay plata que no hay.';

comment on column public.movimientos.tipo is
  'saldo_inicial: la foto del dia que arranca el sistema. ingreso: la carga manual de dinero. reserva: el debito por el deposito que solicita la gestora. reversa_reserva + pago: al conocerse el costo real se devuelve la reserva entera y se descuenta lo que de verdad se pago. ajuste: correccion con motivo.';

-- ------------------------------------------------------------
-- Indices
-- ------------------------------------------------------------

-- El extracto: una tarjeta, lo mas nuevo arriba. `id desc` como desempate porque dos
-- movimientos del mismo segundo tienen que salir SIEMPRE en el mismo orden, o el listado
-- "salta" al recargar y parece que cambio algo.
create index if not exists movimientos_extracto_idx
  on public.movimientos (tarjeta_id, fecha desc, id desc);

create index if not exists movimientos_tramite_idx
  on public.movimientos (tramite_id) where tramite_id is not null;

-- UNA sola reserva viva por tramite. Sin esto, dos guardadas seguidas del presupuesto reservan
-- dos veces y el disponible miente HACIA ABAJO — que es la mentira que hace frenar un tramite
-- sin motivo.
create unique index if not exists movimientos_una_reserva_por_tramite
  on public.movimientos (tramite_id) where tipo = 'reserva';

-- UN solo saldo inicial por tarjeta. Es el error mas caro imaginable: duplica el saldo de
-- arranque y todo lo que se decida despues sale de un numero inventado.
create unique index if not exists movimientos_un_saldo_inicial
  on public.movimientos (tarjeta_id) where tipo = 'saldo_inicial';

-- ------------------------------------------------------------
-- Las tres cifras
-- ------------------------------------------------------------

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
         where m.tipo in ('reserva','ajuste_reserva','reversa_reserva')), 0) as comprometido
  from public.tarjetas_habitualista th
  left join public.movimientos m on m.tarjeta_id = th.id
 group by th.id, th.nombre;

comment on view public.v_saldos is
  'contable tiene que dar IGUAL al saldo del sitio de Habitualista: por eso excluye lo que esta en transito, que el sitio tampoco muestra. disponible = contable - comprometido, y proyectado = contable + en_transito - comprometido. La diferencia entre contable y disponible es exactamente lo que hoy no se ve, y es por lo que dos personas comprometen la misma plata.';

-- ------------------------------------------------------------
-- LO COBRADO AL CLIENTE. La barrera.
--
--  POR QUE ES UNA TABLA APARTE Y NO UNA COLUMNA DE `tramites`:
--
--  En Supabase TODOS los usuarios logueados son el MISMO rol de Postgres (`authenticated`). Un
--  `grant select (columna) to authenticated` le esconde la columna a la gestora Y A GERENCIA al
--  mismo tiempo: el mecanismo que parece resolverlo es incapaz de resolverlo.
--
--  RLS por fila SI alcanza cuando la fila esta en OTRA tabla: `select * from cobros` devuelve
--  CERO FILAS para una gestora, y no hay ningun `select *` sobre tramites que arrastre el dato,
--  porque el dato no esta ahi.
-- ------------------------------------------------------------

create table if not exists public.cobros (
  tramite_id     uuid primary key references public.tramites(id) on delete cascade,
  monto_cobrado  numeric(14,2) not null,
  observacion    text,
  creado_por     uuid references public.perfiles(id),
  creado_at      timestamptz not null default now(),
  actualizado_at timestamptz not null default now(),
  constraint cobros_monto_no_negativo check (monto_cobrado >= 0)
);

comment on table public.cobros is
  'Lo que se le cobro al cliente. Uno por tramite: el duenio del proyecto confirmo que el cobro es tramite por tramite, porque son todos clientes distintos. Vive aca y NO en tramites porque en Supabase todos los logueados son el mismo rol de Postgres, asi que un permiso por columna no puede distinguir una gestora de gerencia. La unica barrera real es que el dato este en otra fila.';

alter table public.cobros enable row level security;

drop policy if exists "cobros_select" on public.cobros;
create policy "cobros_select" on public.cobros for select to authenticated
  using (public.puede_ver_cobros());

drop policy if exists "cobros_write" on public.cobros;
create policy "cobros_write" on public.cobros for all to authenticated
  using (public.puede_ver_cobros()) with check (public.puede_ver_cobros());

-- La lectura conjunta. Con security_invoker, la gestora consulta LA MISMA vista y le llega null
-- en monto_cobrado: sin error, sin fila faltante, y sin una pantalla distinta que mantener.
create or replace view public.v_tramites with (security_invoker = true) as
select t.*, c.monto_cobrado
  from public.tramites t
  left join public.cobros c on c.tramite_id = t.id;

-- ------------------------------------------------------------
-- La encuesta de adopcion. Va desde el dia uno aunque su pantalla llegue despues: si el
-- cobrado y la linea de base arrancan el mes 2, el "antes" no existe y no se reconstruye.
-- ------------------------------------------------------------

create table if not exists public.encuestas_adopcion (
  id        bigserial primary key,
  momento   text not null,
  rol       text not null,
  respuesta jsonb not null,
  creado_at timestamptz not null default now(),
  constraint encuestas_momento_valido check (momento in ('dia_0','dia_30','dia_90'))
);

alter table public.encuestas_adopcion enable row level security;
drop policy if exists "encuestas_select" on public.encuestas_adopcion;
create policy "encuestas_select" on public.encuestas_adopcion for select to authenticated
  using (public.puede_ver_cobros());
drop policy if exists "encuestas_write" on public.encuestas_adopcion;
create policy "encuestas_write" on public.encuestas_adopcion for all to authenticated
  using (public.es_gerencia()) with check (public.es_gerencia());

-- ------------------------------------------------------------
-- El tramite se queda con SU tarjeta. Corre DESPUES de c_ por orden alfabetico.
--
--  EL CASO QUE ROMPE SIN ESTO, y es normal que pase: gerencia cambia con que tarjeta paga una
--  razon social —la pantalla lo permite a proposito—. En ese momento hay tramites con reserva
--  viva contra la tarjeta vieja. Si el trigger de pago resolviera la tarjeta ACTUAL, escribiria
--  la reversa en la nueva y dejaria la reserva de la vieja SIN REVERTIR PARA SIEMPRE. Dos
--  saldos mal, ninguna alarma, y la unica pista aparece meses despues.
-- ------------------------------------------------------------

create or replace function public.d_tramites_fijar_tarjeta()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.tarjeta_id is null and new.medio_pago = 'tarjeta_habitualista' then
    select r.tarjeta_id into new.tarjeta_id
      from public.razones_sociales r where r.id = new.razon_social_id;
  end if;

  -- Una vez que hubo movimientos, la tarjeta no se cambia mas.
  if tg_op = 'UPDATE' and old.tarjeta_id is not null
     and new.tarjeta_id is distinct from old.tarjeta_id
     and exists (select 1 from public.movimientos where tramite_id = new.id) then
    raise exception 'regla_tramite: Este tramite ya movio plata en otra tarjeta y no se puede cambiar';
  end if;

  return new;
end;
$$;

drop trigger if exists d_tramites_fijar_tarjeta on public.tramites;
create trigger d_tramites_fijar_tarjeta before insert or update on public.tramites
  for each row execute function public.d_tramites_fijar_tarjeta();

-- ------------------------------------------------------------
-- La sincronizacion con la cuenta corriente. ACA ESTA LA PARTE FINA DEL MODELO DE PERMISOS.
--
--  El pedido dice que SOLO gerencia y contable modifican saldos, Y que el monto que carga la
--  gestora debita del saldo. Las dos cosas a la vez cierran de UNA sola manera: la gestora NO
--  tiene insert sobre movimientos, ni uno. El debito lo escribe este trigger, que es SECURITY
--  DEFINER y por lo tanto corre como el duenio de la tabla.
-- ------------------------------------------------------------

create or replace function public.e_tramites_cuenta_corriente()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_reservado numeric(14,2);
  v_real      numeric(14,2);
begin
  if new.medio_pago <> 'tarjeta_habitualista' then return new; end if;
  if new.tarjeta_id is null then return new; end if;

  -- ALTA de un tramite preexistente: los que estaban a mitad de camino el dia del corte.
  --
  --   Sin pagar todavia -> SI reserva: esa plata sigue comprometida y sigue en el banco.
  --   Ya pagado         -> NINGUN movimiento: el banco ya lo descontó y está dentro del
  --                        saldo_inicial. Generarlo lo descontaria DOS VECES.
  if tg_op = 'INSERT' then
    if new.origen = 'preexistente'
       and new.estado in ('presupuestado','frenado_por_saldo','presentado')
       and coalesce(new.deposito_solicitado,0) > 0 then
      insert into public.movimientos
        (tarjeta_id, tipo, importe, tramite_id, gestora_id, concepto, origen, creado_por)
      values (new.tarjeta_id, 'reserva', -new.deposito_solicitado, new.id, new.gestora_id,
              'Presupuesto al corte - ' || new.cliente_nombre, 'preexistente', auth.uid());
    end if;
    return new;
  end if;

  if new.origen <> 'app' then return new; end if;

  -- 1) Primera carga del deposito solicitado -> reserva.
  if coalesce(old.deposito_solicitado,0) = 0 and coalesce(new.deposito_solicitado,0) > 0 then
    insert into public.movimientos
      (tarjeta_id, tipo, importe, tramite_id, gestora_id, concepto, origen, creado_por)
    values (new.tarjeta_id, 'reserva', -new.deposito_solicitado, new.id, new.gestora_id,
            'Presupuesto - ' || new.cliente_nombre, 'tramite', auth.uid());

  -- 2) Correccion del deposito -> ajuste POR LA DIFERENCIA. La reserva original NUNCA se toca:
  --    editarla haria que el saldo de ayer deje de ser reconstruible.
  elsif coalesce(old.deposito_solicitado,0) > 0
        and coalesce(new.deposito_solicitado,0) > 0
        and new.deposito_solicitado is distinct from old.deposito_solicitado
        and new.estado <> 'pagado' then
    insert into public.movimientos
      (tarjeta_id, tipo, importe, tramite_id, gestora_id, concepto, origen, creado_por)
    values (new.tarjeta_id, 'ajuste_reserva',
            -(new.deposito_solicitado - old.deposito_solicitado),
            new.id, new.gestora_id, 'Correccion del presupuesto', 'tramite', auth.uid());
  end if;

  -- 3) Pago -> se devuelve TODO lo reservado y se descuenta el costo real.
  if new.estado = 'pagado' and old.estado is distinct from 'pagado' then
    select coalesce(sum(-importe), 0) into v_reservado
      from public.movimientos
     where tramite_id = new.id and tipo in ('reserva','ajuste_reserva');

    if v_reservado <> 0 then
      insert into public.movimientos
        (tarjeta_id, tipo, importe, tramite_id, gestora_id, concepto, origen, creado_por)
      values (new.tarjeta_id, 'reversa_reserva', v_reservado, new.id, new.gestora_id,
              'Libera la reserva', 'tramite', auth.uid());
    end if;

    select coalesce(sum(importe),0) into v_real
      from public.tramite_conceptos where tramite_id = new.id and momento = 'real';

    if v_real > 0 then
      insert into public.movimientos
        (tarjeta_id, tipo, importe, tramite_id, gestora_id, concepto, origen, creado_por)
      values (new.tarjeta_id, 'pago', -v_real, new.id, new.gestora_id,
              'Pago en el registro - ' || coalesce(new.seccional,''), 'tramite', auth.uid());
    end if;
  end if;

  -- 4) Anulacion. DOS COMPORTAMIENTOS DISTINTOS, y tratarlos igual inventa plata:
  --      antes de pagar  -> se revierte la reserva y el disponible vuelve;
  --      despues de pagar-> NO se devuelve nada, porque la plata se fue de verdad. Si el
  --                         registro reintegra algo, entra como ingreso con su motivo.
  if new.estado = 'anulado' and old.estado is distinct from 'anulado' then
    if old.estado <> 'pagado' and old.estado <> 'retirado' then
      select coalesce(sum(-importe), 0) into v_reservado
        from public.movimientos
       where tramite_id = new.id and tipo in ('reserva','ajuste_reserva','reversa_reserva');
      if v_reservado > 0 then
        insert into public.movimientos
          (tarjeta_id, tipo, importe, tramite_id, gestora_id, concepto, origen, creado_por)
        values (new.tarjeta_id, 'reversa_reserva', v_reservado, new.id, new.gestora_id,
                'Anulado: libera la reserva', 'tramite', auth.uid());
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists e_tramites_cuenta_corriente on public.tramites;
create trigger e_tramites_cuenta_corriente after insert or update on public.tramites
  for each row execute function public.e_tramites_cuenta_corriente();

revoke execute on function public.d_tramites_fijar_tarjeta()     from public, anon, authenticated;
revoke execute on function public.e_tramites_cuenta_corriente()  from public, anon, authenticated;

-- ------------------------------------------------------------
-- RLS de movimientos
-- ------------------------------------------------------------

alter table public.movimientos enable row level security;

-- La gestora VE el saldo de las tarjetas donde tiene tarjeta de debito. El pedido dice que solo
-- gerencia y contable pueden MODIFICAR saldos: dice modificar, no ver. Sin ver el saldo no
-- puede decidir si presenta.
drop policy if exists "movimientos_select" on public.movimientos;
create policy "movimientos_select" on public.movimientos for select to authenticated
  using (
    public.es_gerencia() or public.es_contable()
    or (public.es_gestora() and public.opero_esta_tarjeta(tarjeta_id))
  );

-- Solo gerencia y contable insertan A MANO, y solo ingresos, saldo inicial y ajustes. El resto
-- lo escribe el trigger, que es SECURITY DEFINER y no pasa por esta policy.
drop policy if exists "movimientos_insert" on public.movimientos;
create policy "movimientos_insert" on public.movimientos for insert to authenticated
  with check (
    (public.es_gerencia() or public.es_contable())
    and tipo in ('saldo_inicial','ingreso','ajuste')
  );

-- SIN policy de update ni de delete. Para nadie, ni para gerencia.

-- ============================================================================
--  COMO COMPROBAR QUE QUEDO BIEN
--
--  1) Nadie puede editar ni borrar el libro mayor:
--       select has_table_privilege('authenticated','public.movimientos','UPDATE') as u,
--              has_table_privilege('authenticated','public.movimientos','DELETE') as d;
--     Los dos en false.
--
--  2) No existe ninguna columna de saldo persistido:
--       select table_name, column_name from information_schema.columns
--        where table_schema='public' and column_name ilike '%saldo%';
--     Solo la vista, ninguna tabla base.
--
--  3) Los dos indices unicos existen:
--       select indexname from pg_indexes
--        where indexname in ('movimientos_una_reserva_por_tramite','movimientos_un_saldo_inicial');
--
--  4) Las vistas, TODAS con security_invoker:
--       select c.relname, c.reloptions from pg_class c join pg_namespace n on n.oid=c.relnamespace
--        where n.nspname='public' and c.relkind='v';
--
--  5) El circuito completo con numeros, que es la unica prueba que vale. Lo cubre el arnes de
--     permisos: presupuesto 670.000, costo real 666.000, y al pagar el comprometido tiene que
--     volver a 0 y el contable haber bajado 666.000 y NO 670.000.
-- ============================================================================
