-- ============================================================================
--  GESTORIA — un check que faltaba en la migracion 01.
--
--  EL HUECO: `rol = 'gestora'` con `gestora_id` en null pasaba sin problema. Esa persona
--  entraria al sistema, `mi_gestora_id()` devolveria null, y la policy de tramites la filtraria
--  por un null que no coincide con nada. Resultado: ve CERO TRAMITES, sin ningun error, sin
--  ningun aviso, y sin forma de darse cuenta de que la mal configurada es su cuenta.
--
--  Es el peor tipo de falla que puede tener este sistema: la pantalla anda, no dice nada, y
--  esta vacia. La persona concluye que el sistema no sirve.
--
--  El check NO necesita que exista la tabla `gestoras`: solo mira dos columnas de la misma
--  fila. La clave foranea si la necesita, y va en la migracion de catalogos.
-- ============================================================================
--
--  NOTA HISTORICA, porque el hallazgo vale mas que el arreglo:
--
--  Este archivo se empujo VACIO la primera vez. `supabase migration new` lo creo, el comando
--  que iba a escribirlo se colgo, y el push posterior aplico cero bytes — sin error, y
--  registrando la version como aplicada. El CLI decia "up to date" y el esquema no habia
--  cambiado.
--
--  Es la misma forma exacta del chip del Tablero que decia "Base de datos al dia" mientras
--  nueve migraciones seguian sin mirarse. Se descubrio porque se probo que el check BLOQUEARA,
--  en vez de confiar en el "Finished" del comando. De ahi salio scripts/migraciones-sanas.mjs.
-- ============================================================================

alter table public.perfiles drop constraint if exists perfiles_gestora_coherente;
alter table public.perfiles add constraint perfiles_gestora_coherente
  check (rol <> 'gestora' or gestora_id is not null);

comment on constraint perfiles_gestora_coherente on public.perfiles is
  'Una gestora sin gestora_id veria cero tramites sin ningun error. Este check lo vuelve imposible en vez de improbable.';

-- ============================================================================
--  COMO COMPROBAR QUE QUEDO BIEN
--
--    update public.perfiles set rol = 'gestora' where email = 'gestoria1@grupoparis.com';
--
--  Tiene que FALLAR con 23514 (violacion de check). Si pasa, el check no se aplico, y el
--  "Finished" del comando de migracion no alcanza como evidencia.
-- ============================================================================
