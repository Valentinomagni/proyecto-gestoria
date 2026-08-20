-- ============================================================================
--  EL CHECKLIST DEL LEGAJO, CON LO QUE DE VERDAD SE CONTROLA
-- ============================================================================
--
--  Los diez requisitos anteriores salieron de leer normativa. Estos cinco salieron de la primera
--  prueba real, dichos por quien hace el control todos los dias. Ganan los segundos: un checklist
--  que no espeja el control real se contesta de memoria y ahi deja de ser un control.
--
--  ============================================================================
--   LOS VIEJOS SE DESACTIVAN, NO SE BORRAN
--  ============================================================================
--
--  Hay tramites con respuestas ya cargadas contra los requisitos viejos. Borrarlos dejaria esas
--  respuestas apuntando a nada, y ademas es la regla de la casa. Con `activo = false` desaparecen
--  del checklist de los tramites nuevos y las respuestas viejas siguen siendo legibles.
--
--  ============================================================================
--   EL EFECTO EN LA MAQUINA DE ESTADOS, que es el motivo de que esto sea una migracion
--  ============================================================================
--
--  El trigger que deja pasar de `recibido` a `controlado` exige que esten contestados TODOS los
--  requisitos ACTIVOS. Al desactivar los diez viejos y activar cinco nuevos, un tramite que
--  estaba en `recibido` con el checklist a medio contestar pasa a necesitar contestar los cinco
--  nuevos.
--
--  Es lo correcto —son los que de verdad se controlan— pero hay que saberlo antes: quien tenga
--  un tramite a mitad de camino va a ver el checklist en blanco de nuevo.

update public.requisitos set activo = false where activo;

insert into public.requisitos (nombre, aplica_a, orden, activo) values
  ('Control de la oferta - Saldo 0',   'todos', 10, true),
  ('Revision de factura del auto',     'todos', 20, true),
  ('Revision de factura por gastos',   'todos', 30, true),
  ('Accesorios si/no',                 'todos', 40, true),
  ('Entrega de vehiculo usado si/no',  'todos', 50, true)
on conflict (nombre, aplica_a) do update set activo = true, orden = excluded.orden;

-- ============================================================================
--  COMO COMPROBAR QUE QUEDO BIEN
--
--  1) Quedan exactamente cinco activos, todos para 'todos':
--       select count(*) as activos, count(*) filter (where aplica_a = 'todos') as para_todos
--         from public.requisitos where activo;
--     Esperado: 5 y 5.
--
--  2) Los viejos siguen ahi, desactivados (no se borro ninguno):
--       select count(*) from public.requisitos where not activo;   -- esperado: 10
--
--  3) Ninguna respuesta ya cargada quedo apuntando a un requisito que no existe:
--       select count(*) from public.tramite_requisitos tr
--        where not exists (select 1 from public.requisitos r where r.id = tr.requisito_id);
--     Esperado: 0.
--
--  4) LA QUE IMPORTA, y se mira: abrir un tramite en estado `recibido` y ver los cinco puntos
--     nuevos, cada uno con Esta / Falta / No corresponde.
-- ============================================================================
