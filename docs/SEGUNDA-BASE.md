# Separar la base de desarrollo de la de producción

Hoy hay **una sola base de Supabase** y la app lo dice en pantalla, arriba a la izquierda:
"Base compartida con desarrollo". Esto es lo que hay que hacer para que sean dos, y en qué orden.

**Cuándo:** antes de cargar el `saldo_inicial` real. Hasta entonces todo lo que se carga es de
prueba y se puede tirar. Después ya no.

---

## Por qué importa, con lo que se ve hoy

No es una precaución teórica. Con una sola base:

- **Las pruebas escriben en la base que mirás.** El arnés de permisos deja dos movimientos de un
  peso por corrida, anulados; la prueba del salto carga y anula 45.000 en Doral Chevrolet. Están
  todos compensados —el saldo cierra— pero se ven en el extracto del día.
- **Una prueba se apoya en que algo no exista, y otra lo crea.** Pasó el 28/08/2026: una prueba
  comprobaba que DORAL CHEVROLET estaba vacía, y el trámite que hacía falta para probar el salto
  le dejó su reserva. Se arregló apuntando a otra empresa, pero va a volver a pasar.
- **Un `db push` equivocado toca producción.** Hoy no hay dónde equivocarse sin consecuencias.

---

## Lo que depende de vos

1. **El cupo.** El plan gratuito de Supabase permite **dos proyectos por cuenta**, y los dos están
   usados. Hay tres caminos, y es una decisión de plata y de quién administra, no técnica:
   - pausar un proyecto viejo que ya no se use;
   - pagar el plan Pro;
   - crear el segundo proyecto con otra cuenta.

2. **Crear el proyecto nuevo.** En la misma región (South America, São Paulo) para que la latencia
   no cambie entre las dos.

3. **Pasarme la URL y las claves.** La `anon` viaja en el navegador y es pública por diseño. La
   `service_role` **no se pega en ningún lado, ni en el chat**: va sola a `.env.local`, que está
   en `.gitignore`.

4. **Decidir cuál es cuál.** Lo natural es que **la base actual quede como producción** —ya tiene
   las razones sociales, las sucursales, los conceptos y las cuentas— y la nueva sea la de
   desarrollo. Así producción no se muda y no hay ningún momento en que los datos reales viajen.

---

## Lo que hago yo, después, y en este orden

1. Correr las migraciones sobre la base nueva:
   `npx supabase link --project-ref <ref-nuevo> && npx supabase db push --yes`.
2. Comprobar que quedaron las mismas: `npx supabase migration list --linked` en las dos, y
   comparar la lista completa. No alcanza con el conteo.
3. Crear las cuatro cuentas de prueba con sus roles, y **comprobar entrando con cada una**.
4. Cargar los datos de arranque: razones sociales, sucursales, conceptos, requisitos, tarjetas.
   **No los movimientos.** El `saldo_inicial` real se carga una sola vez, a mano, con el número
   que dé el banco.
5. Apuntar `.env.local` y el `playwright.config.ts` a la base NUEVA: de ahí en adelante las
   pruebas escriben ahí.
6. Agregar `VITE_SUPABASE_URL_PRODUCCION` a las variables de Cloudflare Pages, con la URL de
   producción. Con eso el cartel de "Base compartida con desarrollo" **se apaga solo** en
   producción y sigue prendido en desarrollo. Nadie tiene que acordarse de bajarlo.
7. Anotar las URL de desarrollo **y** de producción en las *Additional redirect URLs* de Supabase
   Auth del proyecto nuevo.

   **Si esto se olvida, el login falla con un síntoma que no apunta al problema:** parece que las
   credenciales están mal. Es la trampa que el `CLAUDE.md` ya tiene anotada para el puerto 5173.
8. Comprobar las tres evidencias de siempre, con un usuario real, contra la base nueva.

---

## Lo que hay que revisar después, y no es opcional

- **Las contraseñas genéricas.** Están así a propósito mientras se prueba. Se cambian antes de que
  haya un solo saldo real, y **las cambia cada persona**, no yo.
- **El arnés de permisos.** En cuanto exista la segunda base, apunta a desarrollo y se termina la
  acumulación de filas de prueba en la base que mirás.
- **Los movimientos de prueba que ya están.** Están todos anulados y compensados, así que el saldo
  es correcto, pero ensucian el extracto. Con la base separada se puede decidir si se limpian —hay
  que hacerlo con una migración, no a mano: nada se borra sin dejar rastro.
