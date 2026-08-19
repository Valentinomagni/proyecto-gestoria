# Etapa 1 — El listado y el saldo

> **Para quien ejecute esto:** SUB-SKILL OBLIGATORIA — `superpowers:subagent-driven-development`
> o `superpowers:executing-plans`. Leé primero [el índice](2026-08-18-00-INDICE.md).
> **No empezar sin la etapa 0 cerrada.**

**Objetivo:** que el día que se encienda, la hoja del cuaderno `[img 01]` deje de existir y el
**disponible sea un solo número** para San Luis y San Juan.

**Requisitos que cierra:** R1–R14, R17–R20.

**Por qué sirve sola:** esas son literalmente las dos dificultades declaradas `[fuente:14-16]`.
Aunque no se construya ninguna etapa más, el objetivo del pedido `[fuente:18]` ya está cumplido.

**La exportación a Excel entra acá, no en la etapa 4.** Es deliberado: cierra la objeción "yo lo
necesito en Excel" antes de que se vuelva una excepción permanente.

---

## Tarea 1 — Migración 02: catálogos, todos administrables

**Archivos:** `supabase/migrations/*_catalogos.sql`

**La regla que ordena esta tarea, y es un pedido explícito del dueño del proyecto:** ningún
número de empresas, tarjetas ni conceptos escrito en el código. Todo es una fila que gerencia
puede agregar desde la pantalla.

- [ ] **Paso 1: las tablas.** Base en `docs/diseno/01-modelo-de-datos-y-rls.md` §2, con los
      nombres unificados del índice §4.5.

```sql
create table if not exists public.tarjetas_habitualista (
  id     uuid primary key default extensions.gen_random_uuid(),
  nombre text    not null unique,
  activa boolean not null default true
);
comment on table public.tarjetas_habitualista is
  'Cada Tarjeta Habitualista es una cuenta corriente. El saldo NO vive aca: se suma de movimientos.';
comment on column public.tarjetas_habitualista.nombre is
  'Como figura en el sitio del habitualista, columna Habitualista: "Paris Autos SA" [img 03]. Se guarda igual para que la conciliacion pueda emparejar por texto al pegar el listado.';

create table if not exists public.razones_sociales (
  id         uuid primary key default extensions.gen_random_uuid(),
  nombre     text    not null unique,
  cuit       text,
  tarjeta_id uuid    references public.tarjetas_habitualista(id),
  activa     boolean not null default true,
  orden      int     not null default 100
);
comment on column public.razones_sociales.tarjeta_id is
  'Con que Tarjeta Habitualista paga esta razon social. Editable desde Administracion: si una razon social pasa a pagar con la tarjeta de otra, es un clic y no una migracion.';

create table if not exists public.sucursales (
  id             uuid primary key default extensions.gen_random_uuid(),
  nombre         text    not null unique,
  gestionada_por text    not null,
  activa         boolean not null default true,
  constraint sucursales_gestionada_por_valido check (gestionada_por in ('contable','gerencia'))
);
comment on column public.sucursales.gestionada_por is
  'Quien lleva los tramites de esta sucursal: San Luis lo maneja contable, San Juan lo maneja gerencia [fuente:16]. ES METADATO, NO ES UN PERMISO: ninguna policy mira la sucursal. Cortar la visibilidad por sucursal seria reconstruir en la base el problema que este proyecto viene a resolver.';

create table if not exists public.gestoras (
  id        uuid primary key default extensions.gen_random_uuid(),
  nombre    text    not null unique,
  perfil_id uuid    references public.perfiles(id),
  activa    boolean not null default true
);
comment on table public.gestoras is
  'La persona que presenta y paga en el registro. Tabla aparte de perfiles A PROPOSITO: la planilla ya nombra gestoras (columna GESTOR: CARLA, MARIANA — [img 04]) y hay que poder asignarle un tramite a alguien que todavia no tiene usuario.';

create table if not exists public.tarjetas_debito (
  id                      uuid primary key default extensions.gen_random_uuid(),
  tarjeta_habitualista_id uuid    not null references public.tarjetas_habitualista(id),
  gestora_id              uuid    not null references public.gestoras(id),
  alias                   text,
  ultimos4                text,
  activa                  boolean not null default true,
  constraint tarjetas_debito_ultimos4_formato
    check (ultimos4 is null or ultimos4 ~ '^[0-9]{4}$')
);
comment on column public.tarjetas_debito.ultimos4 is
  'Ultimos cuatro digitos, para reconocer quien pago en la conciliacion. NUNCA el numero completo: este sistema no necesita poder pagar.';

-- EL CHECKLIST DEL LEGAJO. Mismo patron que conceptos: catalogo administrable.
create table if not exists public.requisitos (
  id       uuid primary key default extensions.gen_random_uuid(),
  nombre   text    not null,
  aplica_a text    not null,          -- un tipo de tramite, o 'todos'
  activo   boolean not null default true,
  orden    int     not null default 100,
  unique (nombre, aplica_a)
);

comment on table public.requisitos is
  'Los papeles que tiene que traer el legajo, por tipo de tramite. El pedido dice que administracion manda "el legajo completo del cliente (formularios)" [fuente:5] y hoy que este completo lo garantiza la costumbre. Es catalogo y no columnas por el mismo motivo que conceptos: la lista no esta cerrada.';

create table if not exists public.tramite_requisitos (
  id           bigserial primary key,
  tramite_id   uuid not null references public.tramites(id) on delete cascade,
  requisito_id uuid not null references public.requisitos(id),
  respuesta    text not null,
  nota         text,
  respondido_por uuid references public.perfiles(id),
  respondido_at  timestamptz not null default now(),
  constraint tramite_requisitos_respuesta_valida check (respuesta in ('si','no','no_aplica')),
  unique (tramite_id, requisito_id)
);

comment on column public.tramite_requisitos.respuesta is
  'si | no | no_aplica. TRES valores y no un booleano, y esa es la decision de esta tabla: pasar a controlado exige que TODOS esten CONTESTADOS, no que todos digan que si. Un checklist que bloquea por un requisito que no corresponde se termina tildando en falso, y ahi deja de ser un control y pasa a ser una mentira prolija.';

-- EL CATALOGO DE CONCEPTOS. Ver INDICE §4.2: por que no son tres columnas fijas.
create table if not exists public.conceptos (
  id     uuid primary key default extensions.gen_random_uuid(),
  nombre text    not null unique,
  activo boolean not null default true,
  orden  int     not null default 100
);
comment on table public.conceptos is
  'Los rubros en que se descompone el costo de un tramite. El pedido nombra arancel, prenda y sellados [fuente:22], pero el cuaderno [img 01] usa OTRO vocabulario: PRESUPUESTO, PREVIO, 2do. Dos listas distintas para lo mismo significa que la lista no esta cerrada, y por eso es catalogo y no columnas. Agregar "verificacion policial" es cargar una fila, no una migracion.';
```

- [ ] **Paso 2: las semillas.** **Cinco razones sociales y cinco tarjetas**, una por razón social,
      que es lo que dice la regla del pedido: *"Cada razón social del grupo tiene su propia Tarjeta
      Habitualista"* `[fuente:9]`.

      El pedido nombra tres entre paréntesis y la planilla muestra cinco pestañas `[img 04]`. La
      lectura que respeta la regla es que el paréntesis estaba incompleto. **Y como la relación es
      editable desde Administración, si DORAL o PARIS TRAC en realidad pagan con la tarjeta de
      otra, gerencia lo cambia en un clic.** Un dato editable es mejor que una suposición
      escrita en el código. Queda como P2 del índice.

```sql
insert into public.tarjetas_habitualista (nombre) values
  ('Paris Autos SA'), ('Doral Chevrolet'), ('Paris Cars'), ('Paris Motor'), ('Paris Trac')
on conflict (nombre) do nothing;

insert into public.razones_sociales (nombre, orden) values
  ('PARIS AUTOS', 10), ('DORAL CHEVROLET', 20), ('PARIS CARS', 30),
  ('PARIS MOTOR', 40), ('PARIS TRAC', 50)
on conflict (nombre) do nothing;
-- (el update que las vincula por nombre va en el archivo, idempotente)

insert into public.sucursales (nombre, gestionada_por) values
  ('San Luis', 'contable'), ('San Juan', 'gerencia')
on conflict (nombre) do nothing;

insert into public.conceptos (nombre, orden) values
  ('Arancel', 10), ('Prenda', 20), ('Sellados', 30)
on conflict (nombre) do nothing;

-- Checklist del legajo. Semilla minima y provisoria: la lista real la dictan la contable
-- y las gestoras, y se termina de cargar desde Administracion sin tocar codigo.
insert into public.requisitos (nombre, aplica_a, orden) values
  ('Formulario 08 con firmas certificadas', 'transferencia_a_cliente', 10),
  ('Formulario 08 con firmas certificadas', 'transferencia_al_concesionario', 10),
  ('Verificacion policial (formulario 12) vigente', 'transferencia_a_cliente', 20),
  ('Verificacion policial (formulario 12) vigente', 'transferencia_al_concesionario', 20),
  ('Libre deuda de patentes', 'transferencia_a_cliente', 30),
  ('Informe de dominio', 'transferencia_a_cliente', 40),
  ('Factura de la unidad', 'patentamiento_0km', 10),
  ('Formulario 01', 'patentamiento_0km', 20),
  ('Constancia de CUIT del titular', 'todos', 50),
  ('DNI del titular', 'todos', 60),
  ('Contrato de prenda', 'todos', 70)
on conflict (nombre, aplica_a) do nothing;
```

**Sobre esta semilla, dicho sin adornos:** salió de `docs/DOMINIO.md` y de fuentes secundarias,
**no de la contable**. Es un punto de partida para que la pantalla no arranque vacía, y la lista
real se termina de cargar desde Administración en una conversación de diez minutos. **Ningún
requisito de acá se da por bueno sin que alguien de la casa lo confirme.**

- [ ] **Paso 3: RLS de catálogos.** Todos leen, sólo gerencia escribe.

      *Por qué todos leen:* son los nombres de cada selector. Una gestora que no puede leer
      `razones_sociales` ve un desplegable vacío y no sabe por qué.
      *Por qué escribe sólo gerencia:* tocar una razón social o una tarjeta cambia a dónde va la
      plata de todos los trámites futuros. No es carga diaria.

**Verificación:** correr dos veces (R36). `select nombre from razones_sociales` devuelve las cinco
hojas de `[img 04]` (R14). Agregar un concepto nuevo desde SQL y verlo aparecer sin migración (R5).

---

## Tarea 2 — Migración 03: el trámite y su ciclo

**Archivos:** `supabase/migrations/*_tramites.sql`

- [ ] **Paso 1: la tabla.** Base en `docs/diseno/01-modelo-de-datos-y-rls.md` §3, **sin las
      columnas `costo_arancel` / `costo_prenda` / `costo_sellados`** (índice §4.2: van a
      `tramite_conceptos`) y **sin el estado `autorizado` como transición** (índice §4.3).

      Los cuatro datos del asunto del mail `[fuente:6]` van en columnas propias **más el asunto
      crudo completo**:

```sql
  cliente_nombre    text not null,
  cliente_cuenta    text,          -- "C.74344", "C.103188" en [img 04]
  vehiculo          text,
  oferta_referencia text,
  asunto_mail       text,
```

      **Por qué se guarda el crudo además de lo parseado:** el formato no es estable. En la misma
      planilla conviven `REF. 4097473`, `ref 4093504` y `REF4064625`. Sin el original, un parseo
      equivocado no se puede reparar sin volver al Outlook.

      **Los tres tipos, con `check` en la tabla (R13):** `patentamiento_0km`,
      `transferencia_a_cliente`, `transferencia_al_concesionario` — que son exactamente los tres
      de `[fuente:28]`. Es `text` con check y no una tabla de catálogo, a diferencia de los
      conceptos, y la razón es concreta: cada tipo alimenta un reporte distinto, así que agregar
      un cuarto **no es cargar una fila, es tocar los reportes igual**. Un catálogo acá daría la
      ilusión de que se extiende solo.

      `subtipo` nullable con check (`plan_ahorro`, `credito`, `contado`) para el
      `PATENTAMIENTO PLAN DE AHORRO` de `[img 04]`. Es P4 del índice: si resulta ser un tipo
      propio, es un update de una columna y no una migración de datos.

- [ ] **Paso 2: la máquina de estados. Diez estados, y el alta ya está autorizada.**

```
recibido -> controlado -> entregado -> presupuestado -> presentado -> pagado -> retirado -> devuelto
                                            |     ^                                     \-> anulado
                                            v     |                                        (desde cualquiera)
                                     frenado_por_saldo
```

**Cada estado es un punto de control: no avanza sin su dato.** La tabla completa de qué exige cada
paso está abajo, en el paso 2B.

      **No existe ningún estado `autorizado` ni ningún botón de aprobar.** `[fuente:21]`, textual:
      *"si el nombre del cliente esta ingresado a la plataforma ya sea sinónimo de autorización
      del mismo"*. Entonces **el alta ES la autorización**: al crear el trámite se estampan
      `autorizado_por` y `autorizado_en`, y el circuito arranca en `recibido`.

      **Y `controlado` no es la autorización: es el control de oferta y saldos** que hace contable
      `[fuente:7]` antes de que el trámite pase a gestoría. Son dos cosas distintas y por eso son
      dos momentos distintos. Sin este estado, un trámite que contable revisó y uno que nadie miró
      **se ven idénticos en pantalla**.

      R19 se comprueba así: `select count(*) from tramites where autorizado_por is null` → 0, y
      `estados.test.ts` afirma que no existe ningún estado llamado `autorizado`.

- [ ] **Paso 2B: los diez puntos de control, con quién y con qué dato.**

      **Un estado sin dato exigido no es un control, es una etiqueta.** Esta tabla es la
      especificación del trigger de transición:

      | Estado | Quién | Qué exige para entrar | Qué desbloquea |
      |---|---|---|---|
      | `recibido` | contable, gerencia | cliente, razón social, sucursal, tipo, medio de pago | existe, y ya está autorizado |
      | `controlado` | contable | checklist del legajo **contestado** entero | puede pasar a gestoría |
      | `entregado` | contable, gerencia | gestora asignada, fecha, documentación entregada | la gestora lo ve en el teléfono |
      | `presupuestado` | **gestora** | al menos una línea de concepto y el depósito solicitado | la reserva contra el saldo |
      | `frenado_por_saldo` | contable, gerencia | motivo | arranca el conteo de días perdidos |
      | `presentado` | gestora, contable, gerencia | seccional y fecha | arranca el reloj del plazo |
      | `pagado` | gestora, contable, gerencia | costo real por concepto | el pago en el libro mayor |
      | `retirado` | gestora, contable, gerencia | qué documentación retiró | la devolución |
      | `devuelto` | contable, gerencia | fecha y a quién | administración entrega la unidad |
      | `anulado` | contable, gerencia | motivo (lo exige un check) | — |
      | retroceder | **sólo gerencia** | — | — |

      **Dos matices que deciden si el control sirve o se vuelve mentira. No son opcionales:**

      **El checklist de `controlado` exige estar CONTESTADO, no tildado.** Cada ítem admite sí, no
      o no aplica. Un checklist que bloquea por un requisito que no corresponde **se termina
      tildando en falso**, y ahí deja de ser un control y pasa a ser una mentira prolija. Lo que
      el sistema garantiza es que alguien lo miró ítem por ítem, no que todo estuviera.

      **`numero_pago_registro` NO bloquea el paso a `pagado`.** Se pide con insistencia y el
      trámite queda en una lista de "sin respaldo de pago" hasta que aparezca, pero no traba el
      circuito. Si fuera obligatorio, una gestora sin el comprobante a mano **inventaría un
      número**, y un número falso es peor que uno faltante: la conciliación de la etapa 3
      emparejaría mal y nadie se enteraría. Lo que sí es obligatorio para pasar a `pagado` es el
      costo real, porque de eso depende el libro mayor.

      *Por qué la validación va en un trigger y no en el front:* la transición dispara plata. El
      trigger no mira el fuente, mira la escritura.

      **`frenado_por_saldo` es un estado real, no una casilla, y esto no es un detalle de
      modelado.** Es el trámite que no se pudo presentar porque no había plata en la tarjeta —
      exactamente lo que el pedido describe cuando dice que intentan tener siempre dinero
      disponible *"para no frenar el tramite en el registro por no poder abonarlo"* `[fuente:10]`.

      Una casilla sólo dice el ahora. Un estado deja huella en `tramite_eventos`, y de esa huella
      salen **cuántos trámites se frenaron y cuántos días se perdieron** — que es la métrica que
      justifica el proyecto entero delante de gerencia. Si arranca como casilla, a los tres meses
      ese número no existe y no hay forma de reconstruirlo.

      *Por qué retroceder es sólo de gerencia:* sin eso, un error se arregla desarmando el
      circuito y nadie se entera de que el trámite volvió atrás.

- [ ] **Paso 2C: los datos de respaldo y control.**

      Pedido textual del dueño del proyecto: *"debería poder cargar la referencia de la oferta,
      que es un dato que me permite ubicar el trámite o el cliente, datos varios para tenerlo como
      respaldo y control"*.

      **`oferta_referencia` no es un campo más y no se trata como tal.** Los otros datos describen
      el trámite; éste lo **ubica**, y es la llave para volver del sistema al cliente en Quiter.
      Concretamente:
      - índice propio;
      - campo de búsqueda de primera clase, junto con cliente y dominio;
      - visible en **cada fila** del listado, en la ficha y en la exportación;
      - se parsea del asunto del mail y se puede corregir a mano.

      **`cliente_cuenta`** (la "cuenta personal" del asunto: `C.74344`, `C.103188` en `[img 04]`)
      cumple el mismo rol y va con el mismo tratamiento. Son los dos datos que cruzan al sistema
      interno.

      El resto del bloque de respaldo:

      | Dato | Para qué |
      |---|---|
      | `asunto_mail` crudo y completo | El original nunca se pisa. El formato no es estable —conviven `REF. 4097473`, `ref 4093504` y `REF4064625`— y sin el crudo un parseo mal hecho no se repara sin volver al Outlook |
      | `vehiculo`, `dominio` | Identificación de la unidad. El dominio es nullable: un 0km entra sin patente |
      | `observaciones` y `observaciones_gestora` | **Separadas a propósito**, para que una no tape a la otra ni se pise en un update |
      | `documentacion_entregada`, `documentacion_retirada` | Qué se le dio a la gestora y qué volvió del registro: título, cédula, chapas |
      | Adjuntos | Foto del legajo y comprobante del registro. **Se reusa el patrón del Tablero**, que ya tiene adjuntos con su RLS resuelta (`src/lib/adjuntos.ts` y migración 42) |

      **El criterio para que esto no se convierta en un formulario de treinta campos:** de los
      datos de arriba, **ninguno es obligatorio salvo el cliente**. Se completan cuando se saben.
      R40 sigue mandando: menos de veinte segundos y cinco campos obligatorios en el alta.

- [ ] **Paso 2D: `tramite_notas`, que es la intercomunicación del OBJETIVO.**

      Ver índice §4.4C. Notas cortas atadas al trámite, con autor y fecha, **visibles para los tres
      roles**. No es un chat: es una anotación sobre el objeto.

```sql
create table if not exists public.tramite_notas (
  id         bigserial primary key,
  tramite_id uuid not null references public.tramites(id) on delete cascade,
  texto      text not null,
  autor      uuid not null references public.perfiles(id),
  creado_at  timestamptz not null default now(),
  constraint tramite_notas_texto_no_vacio check (btrim(texto) <> '')
);
comment on table public.tramite_notas is
  'La linea del OBJETIVO pide "intercomunicacion entre gerencia, administracion contable y gestoria" [fuente:18]. Esto NO es un chat: un canal de mensajes nuevo compite con WhatsApp, que ya esta abierto en el telefono de todos, y pierde. Es una anotacion sobre el tramite, que es lo que hoy se pierde cuando alguien explica algo por WhatsApp y esa explicacion no queda en ningun lado.';
```

      RLS: se lee si se puede leer el trámite; se escribe la propia; **no se edita ni se borra**,
      como todo lo demás en este proyecto.

      **Criterio de descarte, escrito de antemano:** si a los tres meses hay menos de una nota cada
      diez trámites, se saca. Significaría que la comunicación sigue pasando por otro lado, y una
      función que nadie usa igual hay que mantenerla.

- [ ] **Paso 3: el bloqueo de columnas por rol.**

      **La RLS de Postgres decide FILAS, no COLUMNAS.** Una gestora con permiso de update sobre su
      propia fila puede, sin esto, hacer desde la consola del navegador:
      `update tramites set razon_social_id = '...' where id = '...'` y mandarle el gasto a otra
      razón social.

      El trigger compara por **diferencia de jsonb** contra una lista de permitidos, no enumerando
      los prohibidos: así una columna que se agregue mañana queda protegida por defecto. La
      versión enumerada —que es la que usa hoy el Tablero— **falla abierta, y en silencio**.

      Ojo con el orden: los triggers BEFORE corren por orden alfabético del nombre. Por eso el de
      `actualizado_at` se llama `a_tramites_...` y este `b_tramites_...`.

- [ ] **Paso 4: los índices, con su motivo.**

```sql
-- Un 0km se patenta UNA vez. Existe porque duplicar es el error mas barato de cometer
-- copiando de un mail a una planilla, y hoy no lo atrapa nada. Excluye anulados, asi que
-- recargar un tramite mal anulado sigue siendo posible.
create unique index if not exists tramites_patentamiento_unico_idx
  on public.tramites (upper(dominio))
  where tipo = 'patentamiento_0km' and estado <> 'anulado' and dominio is not null;

-- Buscar por nombre de cliente escrito a medias. R4.
create index if not exists tramites_cliente_trgm_idx
  on public.tramites using gin (cliente_nombre extensions.gin_trgm_ops);
```

- [ ] **Paso 5: RLS.** Gerencia y contable ven todo. Una gestora ve **sus** trámites
      (`gestora_id = mi_gestora_id()`), y sólo puede actualizarlos en los estados donde le toca.
      **Ninguna policy mira la sucursal** — ver el comentario de la tarea 1.

**Verificación:** correr dos veces. Con un JWT de gestora, intentar cambiar `razon_social_id` →
falla. Intentar `delete` → falla (no hay policy). Cargar dos patentamientos con el mismo dominio →
el segundo falla con 23505 y `fallas.ts` lo traduce (R33).

---

## Tarea 2B — Plazos: el reloj de cada trámite

**Archivos:** `supabase/migrations/*_plazos.sql`, `src/lib/plazos.ts` + test,
`src/features/admin/Plazos.tsx`

**Leer `docs/DOMINIO.md` antes de esta tarea.** Es corta de construir y es la que le da sentido a
todo lo demás.

- [ ] **Paso 1: la tabla.** Ningún plazo en el código.

```sql
create table if not exists public.plazos (
  id            uuid primary key default extensions.gen_random_uuid(),
  nombre        text not null unique,
  aplica_a      text not null,          -- tipo de tramite, o 'todos'
  dias          int  not null,
  habiles       boolean not null default true,
  desde_campo   text not null,          -- de que fecha del tramite se cuenta
  norma         text not null,          -- "Anexo I DNRPA, arancel 14"
  consecuencia  text not null,          -- que pasa si se vence, en castellano
  verificado_el date,
  verificado_por text,
  activo        boolean not null default true
);

comment on column public.plazos.verificado_el is
  'Cuando alguien confirmo por ultima vez que este plazo sigue vigente. La pantalla lo muestra AL LADO del vencimiento. Un plazo sin verificar NO se muestra como vencimiento: se muestra como pendiente de confirmar. Motivo: el anexo de aranceles publicado es del 01/09/2024 y varios plazos no se pudieron verificar en la fuente primaria.';

comment on column public.plazos.consecuencia is
  'Que pasa concretamente si se vence, escrito para una persona. Ejemplo: "recargo del 20% del arancel por cada ano o fraccion, hasta cinco". Sin esto, un aviso de vencimiento es una alarma sin motivo, y las alarmas sin motivo se apagan.';
```

- [ ] **Paso 2: la semilla, toda marcada como SIN VERIFICAR.** Con lo que encontré, y ni uno se
      muestra como vencimiento hasta que alguien lo confirme:

      | Plazo | Días | Norma | Estado |
      |---|---|---|---|
      | Transferencia — mora | 90 hábiles | Anexo I, arancel 14 | **verificado** en el anexo |
      | Transferencia al concesionario (art. 9) | desde el 5° día hábil | Anexo I, arancel 13 | **verificado** en el anexo |
      | Inscripción inicial — habitualista | 72 horas hábiles (96 a más de 100 km) | Digesto | **sin verificar** |
      | Formulario 08 desde certificación de firma | 90 hábiles | — | **sin verificar** |
      | Formulario 12 (verificación policial) | 150 hábiles | — | **sin verificar** |

- [ ] **Paso 3: preguntarles a las gestoras.** Ellas viven estos plazos todos los días y los saben
      mejor que cualquier página web. Es más rápido, más confiable, y **las mete en el proyecto
      desde antes de que exista**, que vale más que el dato.

- [ ] **Paso 4: los feriados, como dato.**

```sql
create table if not exists public.feriados (
  fecha  date primary key,
  motivo text not null
);
comment on table public.feriados is
  'Dias no laborables. Sin esto, un tramite entregado el viernes y presentado el lunes figura con cuatro dias de demora y dos de ellos la oficina estuvo cerrada. Los carga gerencia desde Administracion; se siembra el ano en curso y se revisa cada enero.';
```

- [ ] **Paso 5: el calendario, materializado. No se calcula por fila.**

      La primera versión de esto usaba un `generate_series` adentro de la función, **y no escala**:
      el listado calcula el vencimiento de cada fila, y un `generate_series` de doscientos días
      más una subconsulta a feriados, por cada una de mil filas, hace que la pantalla tarde
      segundos. Se descubre recién con datos reales, que es cuando ya duele.

      Va una tabla de calendario con la cuenta acumulada de días hábiles:

```sql
create table if not exists public.calendario (
  fecha   date primary key,
  habil   boolean not null,
  n_habil int     not null
);
comment on column public.calendario.n_habil is
  'Cuenta acumulada de dias habiles desde el origen del calendario. Con esto, sumar N dias habiles es una busqueda por indice en vez de un recorrido, y RESTAR dos fechas en dias habiles es una resta de enteros. Lo segundo es lo que necesitan las metricas de la etapa 4.';

create or replace function public.regenerar_calendario(p_desde date, p_hasta date)
returns void language plpgsql as $$
begin
  delete from public.calendario where fecha between p_desde and p_hasta;
  insert into public.calendario (fecha, habil, n_habil)
  select d::date,
         h,
         sum(case when h then 1 else 0 end) over (order by d)
    from (
      select d,
             extract(isodow from d) < 6
               and not exists (select 1 from public.feriados f where f.fecha = d::date) as h
        from generate_series(p_desde, p_hasta, interval '1 day') d
    ) x;
end;
$$;
```

      **Se regenera cuando cambian los feriados, no en cada consulta.** Un trigger sobre
      `feriados` la vuelve a armar para el año tocado.

- [ ] **Paso 6: sumar y restar días hábiles, las dos operaciones que hacen falta.**

```sql
-- Fecha resultante de sumar N dias habiles. Dos busquedas por indice.
create or replace function public.mas_dias_habiles(p_desde date, p_dias int)
returns date language sql stable as $$
  select c2.fecha
    from public.calendario c1
    join public.calendario c2 on c2.n_habil = c1.n_habil + p_dias and c2.habil
   where c1.fecha = p_desde
   order by c2.fecha limit 1;
$$;

-- Dias habiles entre dos fechas. Una resta de enteros.
create or replace function public.entre_dias_habiles(p_desde date, p_hasta date)
returns int language sql stable as $$
  select c2.n_habil - c1.n_habil
    from public.calendario c1, public.calendario c2
   where c1.fecha = p_desde and c2.fecha = p_hasta;
$$;
```

      **`entre_dias_habiles` no es un extra:** es lo que necesitan las métricas de la etapa 4
      —días entre alta y pago, días perdidos por falta de saldo— y de paso resuelve la queja del
      Tablero de que *"una tarea entregada el viernes y revisada el lunes figuraba con cuatro días
      de espera"*. Con el calendario ya armado, sale gratis.

      **Devolver `null` es el peor modo de falla posible acá**, porque significa un vencimiento que
      simplemente no se muestra. Dos protecciones: el calendario se siembra de 2015 a 2035, y hay
      un test que pide 90 días hábiles cruzando enero y Semana Santa y **afirma que no es null**.

- [ ] **Paso 7: la vista de vencimientos, respetando `desde_campo`.**

      `vence_el` **no se guarda** (índice §4): corregir un plazo tiene que corregir todos los
      vencimientos de una, no dejar filas viejas.

      Y cada plazo cuenta desde **su** fecha, no todos desde la presentación: la mora del
      formulario 08 corre desde la certificación de la firma, y el plazo del artículo 9 desde el
      quinto día hábil de la adquisición. Por eso `plazos.desde_campo` existe, y por eso la vista
      lo respeta con un `case` explícito sobre columnas conocidas — **nunca SQL dinámico**:

```sql
create or replace view public.v_tramites_vencimiento with (security_invoker = true) as
select t.id as tramite_id, p.id as plazo_id, p.nombre as plazo,
       p.consecuencia, p.verificado_el,
       public.mas_dias_habiles(
         case p.desde_campo
           when 'recibido_at'   then t.recibido_at::date
           when 'entregado_at'  then t.entregado_at::date
           when 'presentado_at' then t.presentado_at::date
           when 'pagado_at'     then t.pagado_at::date
         end, p.dias) as vence_el
  from public.tramites t
  join public.plazos p
    on p.activo and (p.aplica_a = t.tipo or p.aplica_a = 'todos')
 where t.estado not in ('devuelto','anulado')
   and case p.desde_campo
         when 'recibido_at'   then t.recibido_at
         when 'entregado_at'  then t.entregado_at
         when 'presentado_at' then t.presentado_at
         when 'pagado_at'     then t.pagado_at
       end is not null;
```

      **La primera versión de esta vista filtraba por `presentado_at is not null` y contaba todo
      desde ahí**, ignorando la columna `desde_campo` que la tabla ya tenía. Habría dado
      vencimientos correctos para un plazo y equivocados para los otros tres, **sin ningún síntoma
      visible** — el peor tipo de error para un sistema cuya razón de ser es avisar vencimientos.

- [ ] **Paso 7: `plazos.ts`, sólo presentación.** Recibe `vence_el` y `verificado_el` de la base y
      devuelve el texto y el estado del semáforo: en término, por vencer, vencido, **o pendiente
      de confirmar** cuando `verificado_el` es null (R42).

      **Ninguna aritmética de fechas acá.** El guardián de `fechas.ts` lo hace cumplir: el Tablero
      se quemó tres veces con fechas y siempre por lo mismo — alguien escribió
      `new Date().getMonth()` en otro archivo.

- [ ] **Paso 8: `tramites.canal`.** Una columna, `presencial` | `runa`.

      **Corregido el 19/08.** La versión anterior decía que servía para comparar el costo por
      canal. No: RUNA ya se usa y lo maneja administración, así que esos trámites **no entran a
      este circuito** y no hay nada que comparar.

      Para lo que sirve ahora es para que el reporte de cierre pueda decir **cuántos de los
      patentamientos del mes pasaron por gestoría**. Sin ese número, el reporte parece describir
      toda la operación cuando describe una parte, y gerencia sacaría conclusiones sobre un total
      que no es el total. Ver `docs/DOMINIO.md` §5.1.

**Verificación:**
- `select public.mas_dias_habiles('2026-12-24', 5)` salta fines de semana y los feriados cargados.
- `select public.mas_dias_habiles('2026-01-02', 90)` **no devuelve null** (cruza enero y Semana Santa).
- `select public.entre_dias_habiles('2026-08-14','2026-08-17')` devuelve **1**, no 3: el viernes al
  lunes es un día hábil. Es la queja textual del Tablero, resuelta acá desde el principio.
- Cargar un feriado nuevo y ver que los vencimientos de esa semana se corren solos.
- El listado de mil filas con su columna de vencimiento carga **sin demora perceptible**. Si
  tarda, el calendario no se está usando y volvió el recorrido por fila.
- La pantalla muestra un plazo sin verificar como **pendiente de confirmar**, no como una fecha.
- `grep -rn "getMonth\|getDate\|toISOString().slice" src/lib/plazos.ts` → sin resultados.

---

## Tarea 3 — Migración 04: conceptos del trámite

**Archivos:** `supabase/migrations/*_conceptos.sql`

- [ ] **Paso 1: la tabla.**

```sql
create table if not exists public.tramite_conceptos (
  id          bigserial primary key,
  tramite_id  uuid not null references public.tramites(id) on delete cascade,
  concepto_id uuid not null references public.conceptos(id),
  momento     text not null,
  importe     numeric(14,2) not null,
  creado_por  uuid references public.perfiles(id),
  creado_at   timestamptz not null default now(),
  constraint tramite_conceptos_momento_valido check (momento in ('presupuesto','real')),
  constraint tramite_conceptos_importe_positivo check (importe > 0)
);
create unique index if not exists tramite_conceptos_uno_por_momento
  on public.tramite_conceptos (tramite_id, concepto_id, momento);
```

      **La misma tabla sirve para las dos cosas** —lo estimado y lo real— con `momento`. De ahí
      sale gratis el desvío de la etapa 2, sin ninguna estructura nueva.

- [ ] **Paso 2: la vista de totales.**

```sql
create or replace view public.v_tramite_totales with (security_invoker = true) as
select t.id as tramite_id,
       coalesce(sum(c.importe) filter (where c.momento = 'presupuesto'), 0) as total_presupuesto,
       coalesce(sum(c.importe) filter (where c.momento = 'real'), 0)        as total_real
  from public.tramites t
  left join public.tramite_conceptos c on c.tramite_id = t.id
 group by t.id;
```

      **`security_invoker = true` en TODA vista de este proyecto.** Sin ese flag la vista corre
      como su dueño, saltea la RLS entera, y una gestora ve lo que no tiene que ver. La migración
      de endurecimiento trae una consulta que lista las vistas de `public` que no lo tienen.

- [ ] **Paso 3: R2 y R3.** Un trámite no pasa a `presupuestado` sin al menos una línea de
      concepto. Y el sistema muestra la suma de las líneas **junto al depósito que pide la
      gestora, con la diferencia**.

      **Caso de test obligatorio, con los números reales de `[img 01]`:** GARAY AGUSTINA NAHIR,
      450.000 + 200.000 + 16.000 = **666.000**, contra un depósito solicitado de **670.000** → la
      diferencia es **4.000**.

      Eso no es un detalle: el cuaderno pide depósitos redondeados hacia arriba, y esos cuatro mil
      pesos existen en todas las filas. Si el sistema no los muestra, alguien va a creer que el
      sistema está mal.

**Verificación:** el test de GARAY en verde. Guardar un presupuesto sin líneas → rechazado.

---

## Tarea 4 — Migración 05: la cuenta corriente

Es el corazón del producto. **Leer entera antes de escribir nada.**

**Archivos:** `supabase/migrations/*_cuenta-corriente.sql`

- [ ] **Paso 1: el libro mayor.** Base en `docs/diseno/01-modelo-de-datos-y-rls.md` §4, tabla
      renombrada a `movimientos`.

      **Sólo se inserta. No hay policy de update ni de delete para ningún rol, ni para gerencia
      (R9).** Se comprueba con
      `select has_table_privilege('authenticated','public.movimientos','UPDATE')` → `false`.
      Un error se compensa con un `ajuste`, con su motivo escrito. Editar el original haría que el
      saldo de ayer deje de ser reconstruible, y sin eso la conciliación de la etapa 3 no cierra
      nunca.

      El check de signo lo impone la base, no el front: un ingreso negativo o un pago positivo dan
      vuelta el saldo entero y no hay forma de darse cuenta mirando la lista.

- [ ] **Paso 1B: dos fechas por movimiento. Sin esto, la pantalla miente.**

```sql
  fecha               timestamptz not null default now(),
  fecha_acreditacion  date,
```

      `fecha` es cuándo se ordenó; `fecha_acreditacion` es cuándo la plata está de verdad. **Un
      depósito se ordena hasta las 16:00 y acredita al día siguiente** (índice §4.4F).

      Sin las dos fechas, un depósito cargado a las 15:00 figura como saldo disponible hoy y la
      pantalla **dice que hay plata que no hay**. Es el peor error que este sistema puede cometer:
      alguien manda a presentar un trámite contra un saldo inexistente y se frena en el registro,
      que es exactamente lo que el proyecto viene a evitar `[fuente:10]`.

      Para `pago` y `reserva`, las dos fechas coinciden: el débito es inmediato. Para `ingreso`, no.

- [ ] **Paso 1C: la hora de corte, como dato.**

```sql
create table if not exists public.parametros (
  clave          text primary key,
  valor          text not null,
  descripcion    text not null,
  verificado_el  date,
  verificado_por text
);

insert into public.parametros (clave, valor, descripcion) values
  ('corte_deposito_hora', '16:00',
   'Hasta que hora se puede ordenar un deposito para que acredite al dia siguiente. Pasada esa hora, acredita al subsiguiente.'),
  ('corte_deposito_dias', '1',
   'Cuantos dias habiles tarda en acreditar un deposito ordenado antes de la hora de corte.')
on conflict (clave) do nothing;
```

      **Ni la hora ni la latencia van escritas en el código.** Un banco cambia un horario de corte
      sin avisarle a nadie, y un `16` en el código convierte ese cambio en un error silencioso que
      hace perder un día por vez hasta que alguien lo note. Misma regla que los plazos.

- [ ] **Paso 2: las cinco cifras.** Índice §4.4F.

```sql
create or replace view public.v_saldos with (security_invoker = true) as
select th.id as tarjeta_id, th.nombre,
       -- Acreditado: lo unico que de verdad esta en la cuenta hoy.
       coalesce(sum(m.importe) filter (
         where m.tipo in ('saldo_inicial','ingreso','pago','ajuste')
           and m.fecha_acreditacion <= current_date), 0)                       as contable,
       -- Ordenado y todavia no acreditado.
       coalesce(sum(m.importe) filter (
         where m.tipo = 'ingreso' and m.fecha_acreditacion > current_date), 0) as en_transito,
       -- Presupuestos cargados y sin pagar.
       coalesce(-sum(m.importe) filter (
         where m.tipo in ('reserva','ajuste_reserva','reversa_reserva')), 0)   as comprometido
  from public.tarjetas_habitualista th
  left join public.movimientos m on m.tarjeta_id = th.id
 group by th.id, th.nombre;
```

      Las dos cifras derivadas se calculan sobre esas tres, en una segunda vista o en el front:

      | Cifra | Fórmula | Para qué se usa |
      |---|---|---|
      | **Disponible hoy** | `contable − comprometido` | Decidir si se manda a presentar hoy |
      | **Proyectado mañana** | `contable + en_transito − comprometido` | **Decidir cuánto depositar antes de las 16:00** |

      **`contable` tiene que dar igual al "Saldo disponible" del sitio** `[img 02]`, que ese día
      decía `$ 2.505.627,92`. Ese es el número que se concilia en la etapa 3, y **por eso excluye
      lo que está en tránsito**: el sitio tampoco lo muestra.

      **`proyectado mañana` es literalmente lo que se pidió:** *"un proyectado para poder decidir
      con un día de anticipación"*.

      La diferencia entre `contable` y `disponible hoy` es exactamente lo que hoy no se ve, y es
      por lo que **"muchas veces se pisan con el dinero que hay disponible en el día"**.

- [ ] **Paso 3: la sincronización desde el trámite. Acá está la parte fina del modelo de
      permisos.**

      El pedido dice que **sólo gerencia y contable modifican saldos** `[fuente:27]` **y** que el
      monto aproximado de la gestora **debita del saldo** `[fuente:21]`. Las dos cosas a la vez
      cierran de una sola manera: **la gestora no tiene insert sobre `movimientos`, ni uno.** El
      débito lo escribe un trigger `SECURITY DEFINER`, que corre como el dueño de la tabla.

      - Presupuesto cargado → un movimiento `reserva` (negativo).
      - Presupuesto corregido → un `ajuste_reserva` por la **diferencia**. La reserva original
        nunca se toca.
      - Trámite pagado → `reversa_reserva` por **todo** lo reservado, más un `pago` por el costo
        real. Así el comprometido vuelve a cero y el contable baja por lo que de verdad se pagó.

      **CONSECUENCIA QUE HAY QUE ESCRIBIR EN EL ARCHIVO, arriba del trigger:** no correr nunca
      `alter table public.movimientos force row level security`. El dueño de una tabla está exento
      de RLS salvo que se active FORCE. Con FORCE, este trigger deja de poder insertar, y el
      síntoma es el peor posible: **la gestora carga el presupuesto, la pantalla dice que guardó,
      y el saldo no se mueve.** Es el tipo de consejo genérico de seguridad que alguien va a
      aplicar de buena fe.

- [ ] **Paso 3B: el trámite se queda con SU tarjeta. Esto rompe saldos en silencio si falta.**

      `tramites.tarjeta_id`, escrito por el trigger **la primera vez que genera un movimiento**, y
      de ahí en más **todos los movimientos de ese trámite van a esa tarjeta**, no a la que la
      razón social tenga en ese momento.

      **El caso que lo rompe, y es perfectamente normal que pase:** gerencia cambia con qué Tarjeta
      Habitualista paga una razón social —cosa que la pantalla de Administración permite a
      propósito, porque es un dato editable. En ese momento hay trámites con reserva viva contra la
      tarjeta vieja. Si el trigger de pago resuelve la tarjeta **actual**, escribe la reversa y el
      pago en la tarjeta nueva, y deja **la reserva de la vieja sin revertir para siempre**.

      Resultado: dos saldos mal, ninguna alarma, y la única pista es una diferencia que aparece
      meses después. Es exactamente la clase de error que este proyecto existe para no tener.

```sql
alter table public.tramites add column if not exists tarjeta_id uuid references public.tarjetas_habitualista(id);
comment on column public.tramites.tarjeta_id is
  'La tarjeta contra la que este tramite movio plata. La escribe el trigger la PRIMERA vez que genera un movimiento y despues no cambia, aunque cambie la tarjeta de la razon social. Sin esto, cambiar la tarjeta de una razon social deja reservas vivas sin revertir en la tarjeta vieja.';
```

      El trigger: si `new.tarjeta_id is null`, lo resuelve de la razón social y lo escribe. Si ya
      está, lo usa. Y un check impide cambiarlo una vez que hay movimientos.

- [ ] **Paso 3C: anular con reserva viva, y desde dónde se puede anular.**

      Anular un trámite con reserva viva **revierte la reserva en el mismo trigger**, no a mano. Si
      queda librado a que alguien se acuerde, el comprometido se llena de reservas fantasma y el
      disponible baja para siempre.

      **Y no se puede anular un `devuelto`.** Ese trámite ya volvió a administración y la unidad se
      entregó: anularlo es reescribir historia. Si hubo un error, se corrige con un ajuste con
      motivo, que es lo que de verdad pasó.

- [ ] **Paso 4: una sola reserva viva por trámite.**

```sql
create unique index if not exists movimientos_una_reserva_por_tramite
  on public.movimientos (tramite_id) where tipo = 'reserva';
```

      Sin esto, dos guardadas seguidas del presupuesto reservan dos veces y el disponible miente
      **hacia abajo** — que es la mentira que hace frenar un trámite sin motivo.

- [ ] **Paso 5: `saldos.ts`, la función pura, con TDD.**

      Casos obligatorios:
      - **`pisón` (R8):** San Juan presupuesta 1.000.000; el `disponible` que devuelve la consulta
        de San Luis baja 1.000.000 **en la misma transacción**. Este test es el proyecto entero en
        una línea.
      - Presupuesto 670.000 y costo real 666.000 → después del pago, `comprometido` vuelve a 0 y
        `contable` bajó 666.000, no 670.000.
      - Corregir el presupuesto tres veces no reserva tres veces.
      - Anular un trámite con reserva viva → la reserva se revierte y el disponible vuelve.
      - Saldo negativo: se muestra, no se oculta ni se recorta a cero. El pedido dice que intentan
        tener siempre dinero disponible `[fuente:10]`; taparlo sería sacar justo la señal que
        importa.

**Verificación:** los cinco casos en verde. Y con un JWT de gestora,
`insert into movimientos (tipo) values ('ingreso')` → **42501** (R12).

---

## Tarea 4B — La barrera del cobrado, creada desde el día uno

**Archivos:** `supabase/migrations/*_cobros.sql`, `supabase/migrations/*_encuestas.sql`

**Las pantallas de cobros son de la etapa 2. Las tablas van acá, y hay dos motivos distintos.**

- [ ] **Paso 1: `cobros`.** Tabla 1:1 con `tramites` (PK = `tramite_id`), con RLS propia que sólo
      deja pasar a gerencia y contable, vía el helper `puede_ver_cobros()`.

      *Por qué el helper se llama por lo que protege y no por quién es:* si mañana un cuarto rol
      tiene que ver los cobros, se toca la función y **no** las policies que la usan.

      *Por qué es una tabla aparte y no una columna de `tramites`:* **en Supabase todos los
      usuarios logueados son el mismo rol de Postgres (`authenticated`).** Un `grant select (col)
      ... to authenticated` le esconde la columna a la gestora **y a gerencia al mismo tiempo** —
      o sea que el mecanismo que parece resolverlo es incapaz de resolverlo. RLS por fila sí
      alcanza cuando la fila está en otra tabla: `select * from cobros` devuelve **cero filas**
      para una gestora, y no hay ningún `select *` sobre `tramites` que arrastre el dato, porque
      el dato no está ahí.

      Y en `comment on table public.tramites`, una línea que lo diga: **en esa tabla no va ningún
      importe que la gestora no pueda ver.** Más un test que compara
      `information_schema.columns` de `tramites` contra una lista blanca, para que el día que
      alguien agregue `margen` o `ganancia` el test falle antes que el permiso.

- [ ] **Paso 2: la vista conjunta.**

```sql
create or replace view public.v_tramites with (security_invoker = true) as
select t.*, c.monto_cobrado
  from public.tramites t
  left join public.cobros c on c.tramite_id = t.id;
```

      Con `security_invoker`, la gestora consulta **la misma vista** y le llega `null` en
      `monto_cobrado`: sin error, sin fila faltante, sin una pantalla distinta que mantener.

- [ ] **Paso 3: `encuestas_adopcion`.** Guarda las respuestas del día 0 de la etapa 0, más las de
      los 30 y 90 días.

**Por qué las dos tablas van en la etapa 1 y no cuando se usan:** si el cobrado arranca el mes 2,
**el margen del mes 1 no existe** y el gráfico que se le muestra a gerencia arranca torcido para
siempre. Y la de cobros es además la única barrera que protege el dato de `[fuente:26]`: cuanto
antes exista, menos chances hay de que alguien meta un importe donde no va.

**Verificación:** con un JWT de gestora, `select * from cobros` → **0 filas** (R11). Con uno de
contable → las filas. Y `select * from v_tramites` como gestora devuelve las mismas filas que
`tramites`, con `monto_cobrado` en null.

---

## Tarea 5 — Administración de catálogos

**Archivos:** `src/features/admin/*`

- [ ] **Paso 1: pantalla de Administración**, sólo gerencia: razones sociales, tarjetas
      habitualista, sucursales, gestoras, tarjetas de débito y conceptos. Alta, baja lógica
      (`activa`), edición, y **el vínculo razón social → tarjeta**.
- [ ] **Paso 2:** que agregar una sexta razón social o un cuarto concepto se pueda hacer entero
      desde acá, sin tocar código (R5, R14).

**Verificación:** agregar `verificación policial` como concepto y usarlo en un trámite, **sin
correr ninguna migración**.

---

## Tarea 6 — Alta de trámite en menos de 20 segundos

**Archivos:** `src/features/tramites/AltaTramite.tsx`, `src/lib/asunto.ts` + test

R40 es un requisito duro, no una aspiración: **menos de 20 segundos y no más de 6 campos
obligatorios.** Si tarda más que escribir a mano, el cuaderno vuelve.

- [ ] **Paso 1: pegar el asunto del mail.** Un solo campo grande arriba. Se pega el asunto
      completo y `asunto.ts` intenta separar nombre, cuenta, vehículo y referencia.

      **El parseo es best-effort y así se muestra:** lo que reconoció aparece ya cargado en los
      campos de abajo, editable. Lo que no reconoció queda vacío. **Nunca falla ni bloquea** — el
      crudo se guarda siempre.

      Casos de test con las filas reales de `[img 04]`:
      - `PATENTAMIENTO PLAN DE AHORRO- C.74344 MUÑOZ ELIZABETH - UNIDAD PE...`
      - `PATENTAMIENTO CITROEN C3 T200 FEEL PK (108198) VICENCIO LUNA MACA...`
      - `TRANSFERENCIA CHEVROLET CRUZE A PARÍS AUTOS`
      - `PATENTAMIENTO C3 (34913) BALAGUER JUAN ANTONIO (REF. 4097473)`
      - Las tres variantes de referencia que conviven: `REF. 4097473`, `ref 4093504`, `REF4064625`

- [ ] **Paso 2: los seis obligatorios y nada más.** Razón social, sucursal, tipo, cliente, gestora
      y medio de pago. Todo lo demás es opcional y se completa después.

      El dominio es **nullable a propósito**: un 0km entra al circuito sin patente y la recibe
      recién en el registro.

- [ ] **Paso 3: valores por defecto que se acuerden.** Última razón social y última sucursal
      usadas. La sucursal arranca según `gestionada_por` del rol de quien carga.

- [ ] **Paso 4: cronometrarlo con la clienta, tres veces, sobre datos reales.** Si da más de 20
      segundos, **el problema es el formulario, no la persona**, y se rehace.

**Verificación:** el cronómetro, con testigo, y el número anotado en `docs/ESTADO.md`.

---

## Tarea 6B — El control de contable: checklist y ficha

**Archivos:** `src/features/tramites/Control.tsx`, `src/features/tramites/FichaTramite.tsx`,
`src/lib/requisitos.ts` + test

Es el paso que hoy existe en la cabeza de la contable y en ningún registro.

- [ ] **Paso 1: la pantalla de control.** Los requisitos que aplican a ese tipo de trámite, cada
      uno con tres botones: **sí, no, no aplica**, y un campo de nota.

      Pasar a `controlado` exige que **todos estén contestados**. `respuesta = 'no'` **no**
      bloquea (R49): deja el trámite avanzar con la falta registrada y visible. Lo que el sistema
      garantiza es que alguien lo miró ítem por ítem, no que estuviera todo.

- [ ] **Paso 2: el saldo de la oferta, al lado del checklist.** `[fuente:7]` dice que contable
      hace *"control de la oferta y análisis de saldos"*. El análisis se hace en el sistema
      interno; acá se registra **el resultado** y quién lo firmó, que es lo que hoy no queda.

- [ ] **Paso 3: la ficha del trámite**, que es la pantalla donde vive todo el respaldo:
      la cadena completa con quién hizo cada paso y cuándo (de `tramite_eventos`), el checklist,
      las líneas de presupuesto contra las reales, los adjuntos, las dos observaciones, y arriba
      de todo **cliente, referencia de oferta y cuenta personal**.

- [ ] **Paso 4: la ficha se imprime.** Sale con el isotipo negro sobre blanco. Es lo que reemplaza
      la hoja del cuaderno cuando alguien necesita el papel.

**Verificación:** intentar pasar a `controlado` con un requisito sin contestar → rechazado. Con
uno contestado `no` → pasa, y la falta queda visible en la ficha.

---

## Tarea 7 — La pantalla Tarjeta: calca de lo que ya usan

**Archivos:** `src/features/tarjeta/*`

**Restricción textual del pedido** `[fuente:34]`: *"Quisiera un formato similar a lo que estamos
acostumbradas a manejar, como la imagen de la pagina de la Tarjeta Habitualista, con un saldo
inicial y listado de operaciones"*.

Eso no es una sugerencia estética: es la forma mental con la que ya trabajan. Se calca.

- [ ] **Paso 0: la cuenta regresiva al corte, arriba de todo.**

      *"Faltan 2 h 15 para el corte de depósitos"*, y al lado **el proyectado de mañana**. Es la
      información más accionable del sistema entero y hoy no existe en ningún lado.

      Pasada la hora de corte **cambia de pregunta**: deja de decir *"¿cuánto depositás?"* y pasa a
      *"lo que ordenes ahora acredita pasado mañana"*. Es la consecuencia real de haber llegado
      tarde, y decirla es lo que evita que alguien crea que todavía llega.

      La hora sale de `parametros`, nunca del código. Y el cálculo de "mañana" usa días hábiles:
      un depósito ordenado el viernes a las 15:00 **no acredita el sábado**.

- [ ] **Paso 1: arriba, cuatro `<Panel>`** — Contable, En tránsito, Comprometido, Disponible hoy
      (**R7**) — con la misma disposición que las tarjetas de `[img 02]`. Cifra en `text-4xl` con
      `.tnum`.

      **En tránsito se muestra distinto**: en gris, con la fecha de acreditación al lado
      (*"acredita mañana"*). No es plata que se pueda usar hoy y la pantalla no puede dar a
      entender que sí.

      Y **R6**, que se comprueba de una vez: `select table_name, column_name from
      information_schema.columns where column_name ilike '%saldo%' and table_schema='public'` no
      devuelve **ninguna tabla base**, sólo la vista. Si aparece una tabla, alguien persistió un
      saldo y el problema del pedido volvió.

      **Disponible es el que manda visualmente**, no Contable, porque es el número con el que se
      decide. Cuando Disponible es menor que Comprometido, va en `--warn`.

- [ ] **Paso 2: abajo, el listado de movimientos**, con las columnas de `[img 03]`: fecha,
      importe, concepto, seccional, gestora, observación. TanStack Table con selector de columnas
      —el mismo botón "Columnas" que ya conocen— y TanStack Virtual.

- [ ] **Paso 3: selector de tarjeta arriba de todo.** Y el encabezado dice **siempre** qué razón
      social se está mirando: ninguna vista mezcla dos sin decirlo en el título (R14).

- [ ] **Paso 4: Realtime.** Suscripción a `movimientos` filtrada por tarjeta, que invalida
      `['saldos', tarjetaId]`.

      **R10 se comprueba a ojo, no con un test:** dos navegadores, dos usuarios distintos, los dos
      en Tarjeta. Cargar un presupuesto en uno y **ver bajar el disponible en el otro sin
      recargar**. Esa demostración es lo que se le muestra a gerencia; es el problema del pedido
      resuelto delante de ellos.

- [ ] **Paso 5: carga manual de ingresos**, sólo gerencia y contable (R12). Y `saldo_inicial`, una
      sola vez por tarjeta, el día que arranca.

- [ ] **Paso 6: el arranque en caliente. Esto explota el primer día si no está resuelto.**

      El sistema no arranca con la operación en cero: el día del corte hay **decenas de trámites a
      mitad de camino**, unos ya pagados y otros no. Cargarlos sin distinguir rompe el saldo de
      entrada, y de las dos formas posibles:

      | Trámite al corte | Qué pasa si se carga sin cuidado | Qué corresponde |
      |---|---|---|
      | Presupuestado, **sin pagar** | Si no genera reserva, el disponible queda alto y se compromete plata dos veces | **Sí genera reserva.** Esa plata todavía está en el banco y sigue comprometida |
      | Ya **pagado**, sin retirar | Si genera el movimiento de pago, **descuenta de nuevo** algo que el banco ya descontó: el saldo queda doblemente bajo | **No genera ningún movimiento.** Ese pago ya está adentro del `saldo_inicial` |

      La regla, entonces, y va escrita en el trigger:

      > **`saldo_inicial` es el saldo REAL del banco el día del corte.** Todo lo que el banco ya
      > descontó está adentro de ese número. Un trámite preexistente **nunca** genera un `pago`;
      > sólo genera `reserva` si al corte todavía no se había pagado.

      Implementación: `tramites.origen` admite un tercer valor, `preexistente`. El trigger de la
      cuenta corriente lo trata así, y el de la máquina de estados le permite **nacer en el estado
      donde de verdad está** —`presentado`, `pagado`, `retirado`— en vez de obligarlo a recorrer el
      circuito desde el principio inventando fechas que nadie sabe.

      **El orden del corte importa y es un procedimiento, no código:** se toma el saldo real de la
      tarjeta, se anota, se carga como `saldo_inicial`, y **recién después** se cargan los trámites
      abiertos. Al revés, las reservas se apoyan sobre un saldo que todavía no existe y el
      disponible queda en negativo sin motivo.

      **Verificación del corte, y es la única que vale:** cargado todo, `contable` tiene que dar
      **exactamente** el saldo que muestra el sitio de la Tarjeta Habitualista ese día. Si no da,
      no se enciende. Ese número es la línea de largada de todo lo demás.

**Verificación:** la prueba de los dos navegadores, mirada. Y el `contable` de una tarjeta
comparado a mano contra el sitio de Habitualista el mismo día.

---

## Tarea 8 — Bandeja de solicitudes de fondos

**Archivos:** `src/features/solicitudes/*`

Esta pantalla reemplaza la foto del cuaderno `[img 01]`, **y es la pantalla más importante del
sistema**: es donde se toma la única decisión que el sistema existe para ayudar a tomar.

- [ ] **Paso 1: la bandeja.** Una fila por trámite presupuestado y no pagado: cliente, razón
      social, gestora, las líneas de concepto, la suma, el depósito pedido y **la diferencia**.

- [ ] **Paso 2: es una lista diaria que se vacía, no una cola de urgencias.**

      Corregido el 19/08 con la respuesta del dueño del proyecto: *"el plazo real es diario, van y
      piden plata para pagar y como tarde está al día siguiente"*. Ver índice §4.4E.

      **La bandeja tiene tres bloques, en este orden:**

      | Bloque | Qué lleva | Por qué está arriba |
      |---|---|---|
      | **Atrasadas** | Pedidos de ayer o antes, sin resolver | El acuerdo interno es pagar en el día o al siguiente. Una de anteayer **es una excepción** y tiene que verse como tal, no perdida en una lista |
      | **De hoy** | Lo pedido hoy | Es el trabajo del día. Se vacía |
      | **Frenadas por saldo** | Las que esperan plata | Separadas, porque no dependen de quien mira la bandeja |

      **El vencimiento legal es el desempate dentro de cada bloque**, no el orden principal. Sólo
      manda cuando el saldo no alcanza para todo, que es el caso que el pedido describe cuando
      dice que intentan tener siempre dinero disponible `[fuente:10]`.

      *Por qué se escribe así y no al revés:* una pantalla optimizada para racionar plata escasa,
      en una operación donde normalmente alcanza y se resuelve en el día, **haría ver difícil algo
      que es fácil**. Lo que hay que hacer fácil es lo que pasa todos los días.

- [ ] **Paso 2B: el contador del día, arriba de todo.**

      *"Quedan 3 de 11 pedidos de hoy"*, y si hay atrasados, cuántos. Es la única cifra que dice si
      el día está cerrado, y es lo que convierte la bandeja en algo que se vacía en vez de una
      lista que crece.

- [ ] **Paso 3: cada fila muestra su reloj y su consecuencia.** No "vence el 12/09" a secas, sino
      **"vence en 6 días hábiles — pasado eso, recargo del 20% del arancel"**, con la fecha de
      verificación del plazo al lado.

      *Por qué la consecuencia y no sólo la fecha:* una alarma sin motivo se apaga. Con el motivo
      en pesos, se atiende.

      Y si el plazo está **sin verificar**, la fila lo dice así y **no** muestra un vencimiento.

- [ ] **Paso 4: "Disponible después".** Al lado de cada solicitud, **cuánto queda si se aprueba
      ésta**. Es el número que hoy no existe y por el que gerencia deposita a ciegas.

- [ ] **Paso 5: agrupada por tarjeta**, porque la decisión de depositar es por tarjeta.

      **Y sólo entran los trámites con `medio_pago = 'tarjeta_habitualista'`.** Los que se pagan
      por transferencia o en efectivo no pasan por la cuenta corriente, así que no tienen depósito
      que pedir. Siguen apareciendo en el listado y **siguen teniendo su reloj de vencimiento** —
      que un trámite no consuma saldo no lo exime del plazo.

- [ ] **Paso 6: el desempate con vencimientos faltantes.** Dentro de cada bloque,
      `order by vence_el asc nulls last`.

      Un trámite cuyo plazo todavía no fue verificado **no puede encabezar el desempate**: no
      sabemos que sea urgente. Va al final del bloque, visible, marcado como pendiente de
      confirmar. Poner un desconocido arriba es inventar una prioridad.

- [ ] **Paso 6: el color, sólo acá y sólo por estado.** `--warn` por vencer, `--danger` vencido.
      La marca es monocroma justamente para que estos dos colores signifiquen algo.

**Verificación:** que la fila de GARAY muestre 666.000, 670.000 y 4.000 (R3). Y **mirarla con la
contable**: si con esa pantalla abierta no puede decir en diez segundos a cuál le deposita
primero, la pantalla está mal, no ella.

---

## Tarea 9 — Listado, filtros y exportación

**Archivos:** `src/features/tramites/Listado.tsx`, `src/lib/exportar.ts` + test

- [ ] **Paso 1: el listado** con TanStack Table + Virtual. Filtros por razón social, tipo, estado,
      gestora, sucursal y mes. **Búsqueda única por cliente, dominio, referencia de oferta o
      cuenta personal** (R4, R50): una sola caja, que busca en los cuatro.

      Columnas por defecto: cliente, **referencia de oferta**, dominio, razón social, tipo,
      estado, gestora, vencimiento. El resto se agrega desde el selector de columnas.

- [ ] **Paso 1B: las tres listas de control**, que son filtros guardados y no pantallas nuevas:
      - **Sin respaldo de pago** — pagados sin número de pago del registro (R51).
      - **Sin devolver** — retirados hace más de N días que no volvieron a administración.
      - **Por vencer** — el reloj en ámbar, ordenado por el que vence antes.

      *Por qué son filtros y no pantallas:* una pantalla nueva por cada control es cómo se llega a
      quince pantallas que nadie abre. Un filtro guardado vive dentro del listado que ya se usa
      todos los días.
- [ ] **Paso 2: exportación** con `write-excel-file` (R17). Formato de número `#.##0,00` y fecha
      `dd/mm/aaaa`, ancho de columna calculado, encabezados en negrita.
- [ ] **Paso 3: el permiso viaja con la exportación.**

      **R11 no es sólo de pantalla.** `exportar.test.ts`: con `puedeVerCobros = false`, **ninguna
      clave del objeto exportado contiene `cobrado` ni `margen`**. Se filtra en el armado del
      objeto, no escondiendo una columna al final — esconder la columna deja el dato en el
      archivo.

- [ ] **Paso 4: abrir el archivo y mirarlo.** No alcanza con que el test pase. Los peores defectos
      de estos proyectos se descubrieron mirando, no testeando.

**Verificación:** el `.xlsx` abierto en Excel, con los números alineados y las fechas como fechas.
Y el test de R11 en verde.

---

## Tarea 10 — El teléfono de la gestora

**Archivos:** `src/features/movil/*`

**Si la alternativa a sacar una foto es abrir una app de escritorio, gana la foto.**

- [ ] **Paso 1: dos pantallas y nada más.**

      1. **Mis trámites** — los suyos, agrupados por estado, cada uno con **un solo botón: el del
         paso siguiente**. La gestora nunca elige un estado de una lista; el sistema sabe cuál
         sigue. Cuatro pasos suyos en la cadena: presupuestar, presentar, pagar, retirar.
      2. **La ficha del trámite** — el formulario del paso que toca, y nada más.

      **Qué muestra cada fila:** cliente, **referencia de oferta**, dominio, razón social, y su
      reloj (`vence en N días hábiles`). La referencia va acá y no escondida en un detalle, porque
      es con lo que la gestora ubica el trámite cuando alguien le pregunta por teléfono.

- [ ] **Paso 2: el formulario de cada paso, campo por campo.**

      | Paso | Qué pide | Obligatorio |
      |---|---|---|
      | Presupuestar | líneas de concepto, depósito solicitado | sí, las dos |
      | Presentar | seccional, fecha | sí |
      | Pagar | costo real por concepto, **número de pago del registro** | costo real sí; **número de pago no** |
      | Retirar | qué documentación retiró | sí |

      **El número de pago se pide con insistencia y no bloquea (R51).** Va destacado, con su
      motivo escrito en la pantalla: *"con esto el sistema empareja solo el pago contra el
      resumen del habitualista"*. Si no está, el trámite queda en la lista "sin respaldo de pago"
      y se completa después.

      *Por qué no bloquea:* si fuera obligatorio, una gestora sin el comprobante a mano
      **inventaría un número**, y un número falso emparejaría mal en la conciliación de la etapa 3
      sin que nadie se entere. Un dato faltante se ve; uno inventado, no.

- [ ] **Paso 3: botones de al menos 44 px**, campos numéricos con teclado numérico, y que entre
      todo sin scroll horizontal.

- [ ] **Paso 4: borrador local.** Lo que escribió se guarda en el dispositivo mientras completa.
      Si se corta la señal en el registro, no pierde nada. **No hay sincronización diferida**, y
      es deliberado: una cola de mutaciones reconciliándose sola sobre un libro de plata puede
      duplicar un débito.

- [ ] **Paso 5: el estado del depósito visible sin preguntar.**

      *Por qué es el punto más importante de la tarea:* lo que hoy le duele a la gestora no es
      escribir en el cuaderno — es **perseguir por WhatsApp preguntando si depositaron**. Ahí gana
      el sistema. Si el argumento es "ordenamos la información", pierde.

- [ ] **Paso 6: lo que la gestora NO ve, y no por un botón escondido.**

      Ni el cobrado al cliente, ni el margen, ni los trámites de otras gestoras, ni el saldo de
      tarjetas donde no tiene tarjeta de débito. **La ruta no existe para su rol, y aunque la
      escriba a mano la base no le devuelve filas.** Se comprueba con un JWT de gestora, no
      mirando la pantalla.

      Lo que sí ve, y lo necesita: **el saldo de sus tarjetas**, porque `[fuente:27]` dice
      *modificar*, no *ver*, y sin el saldo no puede decidir si presenta.

- [ ] **Paso 7: probarlo en un teléfono real, parado, con una mano.** No en el emulador del
      navegador.

**Verificación:** una gestora real completa un trámite de punta a punta desde su teléfono —
presupuestar, presentar, pagar, retirar— sin ayuda y sin instructivo.

---

## Cierre de la etapa

- [ ] Los cuatro comandos en 0, con la salida pegada.
- [ ] **R1–R14 y R17–R20 comprobados uno por uno**, con la evidencia de cada uno escrita al lado
      (test, consulta SQL, o "mirado en pantalla el día tal").
- [ ] La prueba de los dos navegadores, mirada por vos y por alguien más.
- [ ] El `contable` de una tarjeta comparado contra el sitio de Habitualista.
- [ ] El cronómetro de R40, tres veces, con la clienta.
- [ ] **Revisión independiente** por alguien que no escribió esto.
- [ ] Entrada nueva en el `CHANGELOG` de `src/lib/version.ts`, en lenguaje de usuario.
- [ ] Preview de Cloudflare mirada antes del merge a `main`.

**Y recién ahí, la regla de gerencia de la tarea 0 de la etapa anterior entra en vigencia: no se
deposita contra una foto.** Sin ese anuncio, todo esto es una pantalla más que nadie abre.
