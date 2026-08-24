-- ============================================================================
--  EL ARRASTRE DE LOS TOTALES TAMBIEN TIENE QUE QUEDAR ESCRITO
-- ============================================================================
--
--  ============================================================================
--   EL HUECO, Y COMO SE VIO
--  ============================================================================
--
--  El panel de Cambios de la ficha dice, textual: "Queda registrado quien lo cambio y de que a
--  que. No se puede editar ni borrar."
--
--  Se abrio la ficha de BALAGUER JUAN ANTONIO despues de aplicar el arrastre y el panel mostraba
--  la ultima linea en "Presupuesto: de 640.000 a 655.000", mientras el total arriba decia
--  450.000. O sea: el numero cambio y el historial no lo dijo.
--
--  No fue un olvido del trigger. Fueron dos cosas, las dos correctas por separado:
--    - el arrastre (20260821194117) corre SIN sesion, y ahi `auth.uid()` es null;
--    - y `deposito_solicitado` esta en la lista de columnas que el trigger de datos IGNORA a
--      proposito, porque es derivada y su historia son las lineas del presupuesto.
--
--  Pero este cambio en particular NO salio de una linea: lo hizo una migracion. Es el unico caso
--  en que ese numero se movio sin que se moviera una linea, y por eso es el unico que hay que
--  escribir a mano.
--
--  ============================================================================
--   POR QUE VALE LA PENA UNA MIGRACION POR TRES FILAS
--  ============================================================================
--
--  Un historial con agujeros es PEOR que ninguno: se lo lee como completo. Y el agujero cae
--  justo sobre la cifra de la que cuelga la reserva de la Tarjeta. Alguien que compare el panel
--  contra el total va a encontrar una diferencia que nadie puede explicar — que es exactamente
--  la clase de cosa que hace que se deje de confiar en la pantalla entera.
--
--  Los valores de `antes` son los MEDIDOS antes de correr el arrastre, y estan copiados de la
--  tabla que quedo escrita en la cabecera de 20260821194117. No se inventa ninguno.
--
--  ES IDEMPOTENTE: el `not exists` hace que correrla dos veces no escriba nada la segunda.
-- ============================================================================

insert into public.tramite_cambios (tramite_id, que, campo, antes, despues, quien)
select v.id::uuid, 'dato', 'deposito_solicitado', v.antes, v.despues, null
  from (values
    -- id del tramite                          antes        despues
    ('bd305c64-506a-4b87-8acf-22c5e9db3c9b', null,        '6128000.00'),  -- MARTORINA ALEJANDRO
    ('fff3b1e4-80e5-4197-bbd9-f3b0c3ed52ff', '655000.00', '450000.00'),   -- BALAGUER, presupuestado
    ('636720d8-9b20-4c66-b115-18e80d3b60cc', null,        '1234.56')      -- el tramite del arnes
  ) as v(id, antes, despues)
 where exists (select 1 from public.tramites t where t.id = v.id::uuid)
   and not exists (
     select 1 from public.tramite_cambios c
      where c.tramite_id = v.id::uuid
        and c.que = 'dato' and c.campo = 'deposito_solicitado'
   );

comment on table public.tramite_cambios is
  'Cada cambio de un tramite: los datos, las lineas del presupuesto y el total. Lo escriben '
  'triggers y no la pantalla: si lo escribiera la pantalla, un cambio hecho desde otro lado no '
  'quedaria registrado y el historial diria que no paso nada. Solo insercion. Las filas con '
  'quien = null las escribio una migracion, no una persona.';

-- ============================================================================
--  COMO COMPROBAR QUE QUEDO BIEN
--
--  1) Las tres filas estan, y dicen de cuanto a cuanto:
--       select t.cliente_nombre, c.antes, c.despues
--         from public.tramite_cambios c join public.tramites t on t.id = c.tramite_id
--        where c.que = 'dato' and c.campo = 'deposito_solicitado';
--     Esperado: MARTORINA (null -> 6128000.00), BALAGUER (655000.00 -> 450000.00) y el del arnes.
--
--  2) Correrla de nuevo NO duplica nada: repetir el insert y ver que dice INSERT 0 0.
--
--  3) Y LA QUE IMPORTA, que se mira: abrir la ficha de BALAGUER y ver que el panel Cambios ya
--     explica por que el total dice 450.000 y no 655.000.
-- ============================================================================
