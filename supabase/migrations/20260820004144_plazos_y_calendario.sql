-- ============================================================================
--  LOS PLAZOS Y EL CALENDARIO HABIL
--
--  "Cada tramite es un reloj con plata adentro." Un tramite frenado no es una demora: es un
--  recargo. Esta migracion es el reloj.
-- ============================================================================
--
--  ============================================================================
--   LA REGLA QUE ORDENA TODO ESTO, y no es negociable
--  ============================================================================
--
--  **Un sistema que avisa un vencimiento equivocado es PEOR que uno que no avisa nada**, porque
--  el primero se deja de mirar. Una sola fecha mal calculada y nadie vuelve a confiar en el
--  resto, incluidas las que estaban bien.
--
--  De ahi sale todo el diseño de estas dos tablas:
--
--    1. NINGUN PLAZO ESTA ESCRITO EN EL CODIGO. Van acá, con la norma citada, de donde se leyó,
--       la fecha en que se verificó y quién lo verificó.
--
--    2. UN PLAZO SIN VERIFICAR NO PRODUCE UN VENCIMIENTO. Y no porque la pantalla se acuerde de
--       filtrarlo: la pantalla lee `v_plazos_usables`, que directamente no los tiene. La regla
--       vive en la base, no en un `if` que alguien puede sacar.
--
--    3. LA PANTALLA MUESTRA QUIEN VERIFICO Y CUANDO, al lado del plazo. Un número sin
--       procedencia se cree; un número con procedencia se puede discutir.
--
--  ============================================================================
--   POR QUE EL CALENDARIO ES UNA TABLA Y NO UNA FORMULA
--  ============================================================================
--
--  Los feriados argentinos NO son calculables. Los trasladables se mueven por decreto, los
--  puentes turísticos se fijan cada año en el Boletín Oficial, y Carnaval y Viernes Santo
--  dependen de la Pascua. Cualquier función que los "calcule" va a estar bien tres años y mal
--  el cuarto, y el año que esté mal nadie lo va a notar hasta que un trámite venza tarde.
--
--  Entonces se cargan. Y —esto es lo importante— **si el calendario no llega hasta la fecha que
--  hay que calcular, el sistema NO adivina: dice que no sabe.** Un vencimiento calculado sobre
--  un calendario incompleto es exactamente el aviso equivocado que arruina la confianza.
--
--  ES ADITIVA: dos tablas nuevas, una vista, y ningún dato ni policy existente se toca.

-- ------------------------------------------------------------
-- 1) Los feriados. Se cargan, no se calculan.
-- ------------------------------------------------------------

create table if not exists public.feriados (
  fecha          date primary key,
  motivo         text not null,
  norma          text,
  verificado_el  date,
  verificado_por text,
  constraint feriados_motivo_no_vacio check (btrim(motivo) <> '')
);

comment on table public.feriados is
  'Los dias no habiles, cargados uno por uno. NO se calculan: los trasladables se mueven por '
  'decreto y los puentes turisticos se fijan cada año en el Boletin Oficial. Una funcion que los '
  'calcule va a estar bien tres años y mal el cuarto, y ese año nadie lo va a notar.';

-- ------------------------------------------------------------
-- 2) Los plazos. Cada uno con su norma y su verificacion.
-- ------------------------------------------------------------

create table if not exists public.plazos (
  id             uuid primary key default gen_random_uuid(),
  clave          text not null unique,
  nombre         text not null,
  aplica_a       text not null default 'todos',
  desde          text not null,
  dias           integer not null,
  habiles        boolean not null default true,
  consecuencia   text not null,
  norma          text,
  fuente         text,
  verificado_el  date,
  verificado_por text,
  activo         boolean not null default true,
  constraint plazos_dias_positivos check (dias > 0),
  constraint plazos_aplica_valido check (aplica_a in (
    'todos','patentamiento_0km','transferencia_a_cliente','transferencia_al_concesionario')),
  -- Verificado a medias no existe: o estan los dos datos o no esta ninguno. Una fecha sin
  -- responsable es un sello, y un responsable sin fecha no dice contra que version se verifico.
  constraint plazos_verificacion_completa check (
    (verificado_el is null and verificado_por is null)
    or (verificado_el is not null and btrim(coalesce(verificado_por,'')) <> '')
  )
);

comment on column public.plazos.desde is
  'Que evento arranca el reloj. Es texto y no una FK a una tabla de eventos porque algunos '
  'arrancan FUERA del sistema — la certificacion de la primera firma de un 08 la hace un '
  'escribano — y ahi la fecha la carga una persona.';

comment on column public.plazos.consecuencia is
  'Que pasa si se vence, EN CASTELLANO Y CON EL NUMERO. "20% por año, hasta 5 años" y no '
  '"recargo". La pantalla lo muestra tal cual: un plazo sin consecuencia escrita se lee como '
  'una sugerencia.';

comment on column public.plazos.verificado_el is
  'NULL = SIN VERIFICAR, y entonces NO sale por v_plazos_usables y NO produce ningun '
  'vencimiento en pantalla. No es un adorno: es el mecanismo.';

-- ------------------------------------------------------------
-- 3) La vista que usa la pantalla: SOLO lo verificado
--
--    Este es el poka-yoke. La pantalla no filtra por "verificado": lee de un lugar donde lo no
--    verificado no existe. La diferencia importa el dia que alguien escriba una pantalla nueva
--    y se olvide del filtro — con esto, no hay filtro que olvidar.
-- ------------------------------------------------------------

create or replace view public.v_plazos_usables
with (security_invoker = true) as
  select id, clave, nombre, aplica_a, desde, dias, habiles, consecuencia,
         norma, verificado_el, verificado_por
    from public.plazos
   where activo and verificado_el is not null;

comment on view public.v_plazos_usables is
  'Los plazos que SI se pueden mostrar como vencimiento. La pantalla lee de aca y no de la '
  'tabla, asi no hay ningun filtro que alguien pueda olvidarse de poner.';

-- ------------------------------------------------------------
-- 4) Permisos y RLS
-- ------------------------------------------------------------

alter table public.feriados enable row level security;
alter table public.plazos   enable row level security;

-- Los ve todo el mundo que entro: son datos normativos, no datos de nadie. Y una gestora
-- NECESITA verlos, porque el vencimiento es de su tramite.
drop policy if exists "feriados_select" on public.feriados;
create policy "feriados_select" on public.feriados for select to authenticated using (true);

drop policy if exists "plazos_select" on public.plazos;
create policy "plazos_select" on public.plazos for select to authenticated using (true);

-- Los edita gerencia. Confirmar un plazo es una decision de la empresa, no un dato operativo.
drop policy if exists "feriados_write" on public.feriados;
create policy "feriados_write" on public.feriados for all to authenticated
  using (public.es_gerencia()) with check (public.es_gerencia());

drop policy if exists "plazos_write" on public.plazos;
create policy "plazos_write" on public.plazos for all to authenticated
  using (public.es_gerencia()) with check (public.es_gerencia());

-- Nada se borra, y ninguna vista se escribe. Igual que el resto del esquema.
revoke delete, truncate on public.feriados from anon, authenticated;
revoke delete, truncate on public.plazos   from anon, authenticated;
revoke insert, update, delete, truncate on public.v_plazos_usables from anon, authenticated;
grant select on public.v_plazos_usables to authenticated;

-- ------------------------------------------------------------
-- 5) Los cinco plazos del dominio, TODOS SIN VERIFICAR salvo los dos que se leyeron completos
--
--    Esto NO es sembrar datos: es cargar la lista de lo que hay que confirmar, con la fuente de
--    cada uno a la vista. Los que tienen `verificado_el` en NULL no producen ningun vencimiento
--    hasta que una gestora o gerencia los confirme desde la pantalla.
--
--    Quien los puede confirmar mejor que cualquier pagina web son LAS GESTORAS: viven estos
--    plazos todos los dias.
-- ------------------------------------------------------------

insert into public.plazos (clave, nombre, aplica_a, desde, dias, habiles, consecuencia, norma, fuente, verificado_el, verificado_por)
values
  ('mora_08',
   'Mora de la transferencia',
   'todos',
   'certificacion_primera_firma',
   90, true,
   'Recargo del 20% por año de mora, hasta 5 años. En una transferencia a habitualista se calcula sobre el arancel SIN el beneficio, que es lo que la vuelve cara: a tiempo sale cero.',
   'Arancel 14, Anexo I DNRPA',
   'Anexo I del 01/09/2024, texto citado literal',
   date '2026-08-18',
   'Lectura completa del Anexo I DNRPA (01/09/2024)'),

  ('inscripcion_inicial_tardia',
   'Inscripción inicial fuera de término',
   'patentamiento_0km',
   'factura',
   5, true,
   'Recargo de $1.220 por año, contado desde el 5° día hábil.',
   'Arancel 13 art. 9, Anexo I DNRPA',
   'Anexo I del 01/09/2024, texto citado literal',
   date '2026-08-18',
   'Lectura completa del Anexo I DNRPA (01/09/2024)'),

  ('presentacion_habitualista',
   'Presentación de la inicial por habitualista',
   'patentamiento_0km',
   'recibido',
   3, true,
   'SIN CONFIRMAR. Se menciona 72 horas hábiles, o 96 si el registro está a más de 100 km.',
   'Digesto DNRPA (sección no encontrada)',
   'Sólo fuentes secundarias. La sección del Digesto que se buscó NO lo contenía.',
   null, null),

  ('vigencia_08',
   'Vigencia del formulario 08',
   'todos',
   'certificacion_primera_firma',
   90, true,
   'SIN CONFIRMAR. Vencido, hay que certificar firmas de nuevo: el cliente tiene que volver.',
   null,
   'Fuentes secundarias coincidentes entre sí. No se leyó la norma.',
   null, null),

  ('vigencia_12',
   'Vigencia del formulario 12 (verificación policial)',
   'todos',
   'verificacion_policial',
   150, true,
   'SIN CONFIRMAR. Vencido, hay que hacer la verificación policial de nuevo.',
   null,
   'Una sola fuente secundaria.',
   null, null)
on conflict (clave) do nothing;

-- ============================================================================
--  COMO COMPROBAR QUE QUEDO BIEN
--
--  1) La vista NO deja pasar lo no verificado. Tiene que dar 2 y 5:
--       select (select count(*) from public.v_plazos_usables) as usables,
--              (select count(*) from public.plazos)           as todos;
--
--  2) No se puede marcar verificado a medias. Las dos tienen que FALLAR:
--       update public.plazos set verificado_el = current_date where clave = 'vigencia_08';
--       update public.plazos set verificado_por = 'alguien'   where clave = 'vigencia_08';
--     y esta tiene que ANDAR:
--       update public.plazos set verificado_el = current_date, verificado_por = 'Carla'
--        where clave = 'vigencia_08';
--     (despues volverlo a null los dos, que para eso se prueba en desarrollo)
--
--  3) La vista es security_invoker y no se puede escribir:
--       npm run permisos
--
--  4) LA QUE IMPORTA, y no se comprueba con SQL: que la pantalla de un tramite con un plazo sin
--     confirmar NO muestre ninguna cuenta regresiva, y diga por que. Eso se mira.
-- ============================================================================
