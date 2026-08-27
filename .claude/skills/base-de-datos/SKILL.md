---
name: base-de-datos
description: La capa de datos de la Gestoría — migraciones con el CLI de Supabase, RLS, triggers, el libro mayor de sólo inserción y sus trampas. Usar al escribir SQL o al tocar permisos.
---

# La base


- **Las migraciones se corren con el CLI**, no pegando SQL a mano: `npm run db:push`. Los tipos
  se generan con `npm run db:tipos` y hay un chequeo en CI que falla si quedaron viejos.
- **`supabase db push` pide confirmación y se cuelga esperándola** en un shell no interactivo.
  Los scripts llevan `--yes`. Sin eso el comando queda colgado hasta que lo mata el timeout, y
  no imprime nada que explique por qué.
- **Una migración VACÍA se aplica sin error y queda registrada como aplicada.** Pasó el
  19/08/2026: `supabase migration new` creó el archivo, el comando que iba a escribirlo se
  colgó, y se empujaron cero bytes. El CLI dijo "up to date" y el esquema no había cambiado —
  el constraint que se daba por aplicado no existía. Lo cubre `npm run migraciones`, que corre
  en el pre-commit. **Y la lección que vale más que el script: se descubrió porque se probó
  que el constraint BLOQUEARA, no porque el comando dijera "Finished".**
- **Se puede correr SQL sin la clave secreta**, con el token de cuenta contra
  `POST https://api.supabase.com/v1/projects/<ref>/database/query`. Es lo que usa el editor SQL
  del panel. Sirve para las comprobaciones de cada migración; **no reemplaza** las pruebas de
  permisos, que van contra la API real con usuarios reales.
  **Consecuencia: acá no existe `esquema.ts`.** Ese archivo en el Tablero es código de producción
  cuyo único trabajo es sobrevivir a que el esquema del código y el de la base se separen; acá el
  problema no llega a existir.
- **El saldo no es un campo: es la suma de un libro mayor de sólo-inserción.** Un campo mutable
  con dos escritores es exactamente el objeto que se pisa, y el pisón de saldos es el problema que
  el proyecto viene a resolver.
- **RLS: nunca una subconsulta a `perfiles` dentro de una policy de `perfiles`** — recursión
  infinita (42P17), que devuelve 500 en **todas** las tablas. Todo pasa por helpers
  `SECURITY DEFINER` con `stable` y `set search_path = public`.
- **Toda vista lleva `security_invoker = true`.** Sin eso corre como su dueño y saltea la RLS
  entera.
- **Nunca correr `force row level security` sobre `movimientos`.** El dueño de una tabla está
  exento de RLS salvo con FORCE; con FORCE, el trigger que inserta la reserva deja de poder
  escribir, y el síntoma es el peor posible: la pantalla dice que guardó y el saldo no se mueve.
- **La plata es `numeric(14,2)` en Postgres y centavos enteros en JavaScript.** En JavaScript
  `1234.10` no es exactamente 1234,10 y sumar miles deriva. Un solo módulo, con guardián.

---


## Los índices únicos parciales

**Tres veces apareció la misma forma:** un índice único parcial que no excluye lo anulado, y
entonces lo anulado sigue ocupando el lugar y no se puede volver a cargar.

| Índice | Estaba |
|---|---|
| `tramite_conceptos_uno_por_momento` | **Mal.** Arreglado el 21/08/2026 |
| `movimientos_un_saldo_inicial` | **Mal.** Dejó dos tarjetas sin poder recargar su saldo |
| `tramites_patentamiento_unico_idx` | Bien: excluye `anulado` |

**Regla: todo índice único parcial sobre una tabla que tenga anulación tiene que excluirla.**
Hay un guardián que lo comprueba: `npm run indices`.
