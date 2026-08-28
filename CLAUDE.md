# CLAUDE.md

**Gestoría — Grupo Paris.** Plataforma para los trámites del automotor y la cuenta corriente de
las Tarjetas Habitualistas, compartida entre gerencia, administración contable y gestoría.

**IMPORTANTE: esto lo revisa la dueña de la empresa. No admite defectos visibles.**

Lo que no está acá está en las skills, que se cargan cuando hacen falta:
`dominio-gestoria`, `metodo-gestoria`, `base-de-datos`, `marca-grupo-paris`.
El estado del proyecto está en `docs/ESTADO.md`.

## La regla que manda sobre todas

**Si escribís "verificado", escribí al lado el comando o el `archivo:línea` que lo comprueba.**
Si no podés, escribí "sin verificar". Las dos son respuestas válidas; inventar la primera, no.

Los dos proyectos anteriores se lastimaron **cuatro veces** con la misma forma exacta: se escribió
la conclusión sin correr la comprobación, con el sello "Verificado" al lado, y a partir de ahí
nadie volvió a probarlo. Una afirmación con ese sello deja de revisarse.

## El entorno

- **node y npm NO están en el PATH.** Todo comando arranca con
  `export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH"`.
- **Lo que arranca un proceso desde afuera del shell** —`.claude/launch.json`, una tarea
  programada— no hereda ese PATH y necesita la ruta absoluta a `node.exe`. No alcanza con apuntar
  a `npm.cmd`: ese script después invoca a `node`, que tampoco se encuentra.
- **El servidor de desarrollo usa el puerto 5173 con `strictPort`.** Esa URL está anotada en las
  redirect URLs de Supabase Auth; un cambio de puerto rompe el login con un síntoma que no apunta
  al puerto.
- **Códigos de salida:** `comando | tail` devuelve el estado de `tail`. Siempre
  `comando > /tmp/log 2>&1; echo "EXIT: $?"; tail -20 /tmp/log`.
- **`supabase db push` se cuelga esperando confirmación** en un shell no interactivo. Los scripts
  llevan `--yes`.
- **Una migración VACÍA se aplica sin error y queda registrada como aplicada.** Pasó dos veces.
  Ahora lo bloquea un hook.
- El token de cuenta sale de `.env.local`, que está en `.gitignore`:
  `export SUPABASE_ACCESS_TOKEN="$(grep '^SUPABASE_ACCESS_TOKEN=' .env.local | cut -d= -f2-)"`.
- **No hay permisos de administrador en esta máquina y no hacen falta.** Todo lo que instala npm
  vive dentro del perfil del usuario.

## Cómo se lee el código

**Antes de leer un archivo entero, buscá con `grep` y leé sólo el rango.** Un archivo se lee
completo la primera vez que se toca en una sesión, y nunca dos veces. Para cambiar diez líneas de
un archivo de setecientas, se leen esas diez con su contexto.

## Reglas duras del producto

- **Cero emojis.** Ni en la interfaz, ni en los mensajes, ni **en la documentación**. Íconos sólo
  de `lucide-react`. Ojo con `ℹ` (U+2139): Unicode lo clasifica como **letra**, no como símbolo,
  así que se escapa de cualquier filtro por categoría.
- **No se mide a las personas.** Ni rankings, ni conteos por gestora, ni comparaciones. Hay
  guardián. **El día que exista un ranking de gestoras, los presupuestos se cargan tarde y
  redondeados** — y el comprometido, que es la razón de ser del sistema, pasa a ser mentira.
- **Español de Argentina, voseo**, tono directo, sin jerga técnica en la interfaz. Un error nunca
  muestra el mensaje crudo de la base.
- **Nada se borra.** Un trámite se anula con motivo; un movimiento se compensa con un ajuste; una
  línea del presupuesto se marca anulada con motivo.
- **La plata es `numeric(14,2)` en Postgres y centavos enteros en JavaScript.** Todo importe pasa
  por `src/lib/plata.ts`. **Nunca `Number("600.000")`** — da 600, y el error es silencioso.
- **Ningún plazo ni arancel escrito en el código.** Van en tablas, con la norma citada y la fecha
  de verificación.
- **Un número nunca es del color de la marca.** El teal va en el marco; los estados conservan su
  color. Ver `marca-grupo-paris`. **Los valores están medidos, no elegidos a ojo:**
  `npm run contraste` calcula el contraste real de los ocho pares que existen en pantalla, en
  claro y en oscuro, y comprueba que los **dos** bloques de modo oscuro digan lo mismo.
- **Comentarios en español que explican el POR QUÉ**, no el qué. La densidad alta es deliberada:
  esto lo mantiene una sola persona que no es programadora.

## Trampas de la base que rompen en silencio

- **Nunca una subconsulta a `perfiles` dentro de una policy de `perfiles`** — recursión infinita
  (42P17), que devuelve 500 en **todas** las tablas. Todo pasa por helpers `SECURITY DEFINER` con
  `stable` y `set search_path = public`.
- **Toda vista lleva `security_invoker = true`.** Sin eso corre como su dueño y saltea la RLS
  entera. Y al recrear una vista, Postgres **no conserva lo revocado**: hay que volver a ponerlo.
- **Toda policy que llame a un helper `security definer` lleva `to authenticated`.** Sin eso
  `anon` intenta ejecutar el helper revocado y recibe 42501 (rechazo) en vez de cero filas
  (ausencia) — y eso manda a buscar un problema de permisos donde sólo falta una sesión.
- **Nunca `force row level security` sobre `movimientos`.** Con FORCE, el trigger que inserta la
  reserva deja de poder escribir, y el síntoma es el peor posible: la pantalla dice que guardó y
  el saldo no se mueve.
- **Todo índice único parcial tiene que excluir lo anulado.** Ya mordió dos veces. Lo comprueba
  `npm run indices`.
- **`--ring` es un color y `--ring-sh` es una sombra.** `box-shadow: var(--ring), var(--shadow)`
  es CSS inválido y el navegador **descarta la declaración entera, en silencio**.

## Cómo trabajar acá

- **TDD.** Test primero, verificar que falla **por la razón esperada**, después implementar.
- **Si un aserto de un plan resulta incorrecto, no lo ajustes para que pase.** Pará y reportalo.
- **Antes de escribir una función, buscá si ya existe.** La duplicación es un defecto.
- **Nunca editar JSX con expresiones regulares ni `sed`.** Ya dejó un `</div>` donde iba un
  `</Panel>`.
- **Ninguna etapa cierra sin una revisión de alguien que no la escribió.** Están
  `revisor-contable`, `revisor-producto` y `revisor-seguridad`, y `/code-review` sobre el diff.
- **Con defectos abiertos no entran funciones nuevas.** Una función nueva encima de un cálculo
  roto produce números falsos con más confianza.
- **Un guardián que nunca se vio fallar no es un guardián.** Cada uno se prueba metiéndole la
  violación a mano y mirándolo en rojo.

## Publicar

`dev` → preview de Cloudflare → `main` = producción. **`git push` funciona desde acá**: si algún
día parece que no, probalo antes de asumirlo. En el Tablero esa suposición costó **30 commits sin
publicar**, incluido el arreglo de un defecto de seguridad.

Antes de decir que algo llegó a producción, **las tres evidencias**:

1. `git rev-list --count origin/main..main` en 0.
2. El texto nuevo dentro del JS publicado:
   `curl -s https://proyecto-gestoria.pages.dev/ | grep -o '/assets/index-[^"]*\.js'`, y después
   `grep` de un texto de esta tanda sobre ese archivo.
3. El dato nuevo leído de la base entrando con un usuario real.

**Mientras haya una sola base de Supabase, la app lo dice en pantalla.** Eso cambia antes de que
haya saldos reales.
