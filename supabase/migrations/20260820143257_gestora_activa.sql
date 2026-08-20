-- ============================================================================
--  UNA GESTORA DADA DE BAJA NO PUEDE RECIBIR TRABAJO NUEVO
-- ============================================================================
--
--  ============================================================================
--   LO QUE APARECIO AL ESCRIBIR LA PRUEBA, Y AHORRO UNA MIGRACION ENTERA
--  ============================================================================
--
--  El plan daba por hecho que habia que cambiar la RLS para que la gestora viera su tramite
--  desde el alta. Se escribio la prueba primero —contra la API real, con la gestora de verdad—
--  y paso EN VERDE sin tocar nada.
--
--  O sea que la policy de lectura ya decia lo correcto: `gestora_id = mi_gestora_id()`, sin
--  exigir ningun estado. Lo unico que faltaba era que el formulario de alta MANDARA el dato,
--  que es cambio de pantalla y no de base.
--
--  Vale escribirlo porque es la razon por la que las pruebas van primero: la que se supone rota
--  a veces no lo esta, y sin correrla se habrian cambiado policies que estaban bien — con todo
--  el riesgo de tocar `tramites` a cambio de nada.
--
--  ============================================================================
--   LO QUE SI FALTABA
--  ============================================================================
--
--  Poder asignar al alta abre un caso que antes no existia: elegir a alguien que ya no entra al
--  sistema. Un tramite asignado a una gestora dada de baja queda INVISIBLE para gestoria
--  —porque ella no entra— e invisible para quien lo asigno, que ya lo dio por delegado. Nadie
--  se entera hasta que alguien pregunta por que ese tramite no avanza, y para entonces pasaron
--  dias.
--
--  Es exactamente la clase de agujero que este proyecto cierra en la base y no en la pantalla:
--  el selector va a mostrar solo las activas, pero eso es cortesia. Esto es el cerrojo.
--
--  ES ADITIVA: un trigger nuevo, ninguna fila tocada, ninguna policy cambiada.

create or replace function public.a_tramites_gestora_activa()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.gestora_id is not null
     and not exists (select 1 from public.gestoras g where g.id = new.gestora_id and g.activa) then
    raise exception 'regla_tramite: Esa gestora esta dada de baja. Elegi otra o dejalo sin asignar.';
  end if;
  return new;
end;
$$;

-- Corre en INSERT y tambien cuando cambia `gestora_id`, no solo al crear: reasignar a alguien
-- dado de baja tiene el mismo efecto que asignarselo desde el principio.
drop trigger if exists a_tramites_gestora_activa on public.tramites;
create trigger a_tramites_gestora_activa
  before insert or update of gestora_id on public.tramites
  for each row execute function public.a_tramites_gestora_activa();

-- Las funciones de trigger no son endpoints y no las ejecuta nadie a mano.
revoke execute on function public.a_tramites_gestora_activa() from public, anon, authenticated;

-- ============================================================================
--  COMO COMPROBAR QUE QUEDO BIEN
--
--  1) El trigger existe sobre tramites:
--       select tgname from pg_trigger
--        where tgrelid = 'public.tramites'::regclass and tgname = 'a_tramites_gestora_activa';
--
--  2) Asignar una gestora dada de baja FALLA. Las dos lineas del medio tienen que dar error:
--       update public.gestoras set activa = false where nombre = 'Mariana';
--       update public.tramites set gestora_id =
--              (select id from public.gestoras where nombre = 'Mariana')
--        where cliente_nombre = 'carolina';
--       update public.gestoras set activa = true where nombre = 'Mariana';
--
--  3) LA QUE IMPORTA: `npm run test:rls`, que ademas comprueba que la gestora VE el tramite en
--     estado `recibido` y que la gestora de la otra ficha NO lo ve.
-- ============================================================================
