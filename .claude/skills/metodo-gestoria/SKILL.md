---
name: metodo-gestoria
description: El método de trabajo del proyecto Gestoría Grupo Paris — 5S, Kaizen, Poka-yoke, Andon y Genchi genbutsu, con los post mortem que los produjeron. Usar al planificar, al revisar, y al decidir si algo entra o no.
---

# El método

Salió del CLAUDE.md el 26/08/2026, cuando ese archivo llegó a 335 líneas y empezó a competir
consigo mismo. Nada se perdió: se movió acá, donde se carga cuando hace falta.


Los valores del Tablero son 5S y Kaizen. Acá se mantienen y se les agregan tres conceptos del
mismo sistema que los otros dos proyectos **practican sin nombrar** — y lo que no tiene nombre no
se puede exigir en una revisión.

Cada uno abajo tiene su mecanismo concreto en este proyecto. **Un valor sin mecanismo es una
decoración.**

### Seiri — clasificar: sacar lo que no se usa

- YAGNI. `knip` en CI para código muerto.
- **Tope de documentación, desde el día uno:** este archivo, `docs/ESTADO.md`, `docs/DOMINIO.md`
  y los planes. Ningún documento nuevo sin dueño y sin fecha de descarte.
- Toda función nueva trae escrito **qué mide, a quién ayuda y cuándo se descarta si no sirvió**.
  Sin criterio de descarte no entra: una propuesta sin fecha de revisión es un compromiso
  permanente disfrazado de experimento.

*Por qué:* el Tablero llegó a **75 documentos sin saber cuáles decían la verdad**.

### Seiton — ordenar: un lugar para cada cosa

- La tabla de nombres del plan manda. Un concepto, un nombre, en toda la base y en todo el front.
- Un módulo por asunto. `plata.ts` es el único que hace aritmética de importes; `fechas.ts` el
  único que toca calendario; `plazos.ts` el único que calcula un vencimiento.
- Los tokens de color y la escala tipográfica viven **en un solo archivo**.

*Por qué:* en el Tablero aparecieron dos `ordenarConsultas` exportadas con la misma firma y
comportamiento distinto, y la escala tipográfica vivía en un archivo y el color en otro, sin nada
que los conectara.

### Seiso — limpiar: dejarlo sin defectos a la vista

- Los cuatro comandos en 0, siempre, con la salida pegada.
- Cero advertencias toleradas. Una advertencia permanente entrena a ignorar las advertencias.

### Seiketsu — estandarizar: que lo limpio sea lo normal

- Sistema de diseño con guardianes. Plantilla de migración. Plantilla de plan.
- Toda migración trae adentro su bloque **"cómo comprobar que quedó bien"**.

### Shitsuke — disciplina: que se cumpla sin que nadie mire

- Hook de pre-commit (tipos, lint, tests afectados) y CI (la suite completa).
- **Ninguna etapa cierra sin una revisión de alguien que no la escribió.**

*Por qué:* la matriz de cobertura del Tablero **se declaró completa a sí misma**, y una revisión
independiente encontró once hallazgos adentro, incluida una contraseña en texto plano.

### Poka-yoke — a prueba de errores

**Es el concepto que mejor describe lo que este diseño hace, y ninguno de los dos proyectos
anteriores lo nombra.** Un poka-yoke no avisa del error: lo hace imposible.

Ante cada regla, la pregunta de diseño es una sola:

> **¿Puede la base hacerlo imposible, en vez de que el front lo pida por favor?**

En este proyecto son poka-yokes, y hay que reconocerlos como una familia:

| Mecanismo | Qué vuelve imposible |
|---|---|
| Índice único de una reserva por trámite | Que guardar dos veces el presupuesto debite dos veces |
| Índice único de patentamiento por dominio | Patentar dos veces el mismo 0km |
| `check` de signo por tipo de movimiento | Un ingreso negativo que da vuelta el saldo entero |
| Sin policy de UPDATE ni DELETE en `movimientos` | Que alguien edite el libro mayor y el saldo de ayer deje de ser reconstruible |
| Trigger de transición de estado | Saltearse un paso del circuito, o hacerlo con el rol que no corresponde |
| Bloqueo de columnas **por diferencia de jsonb** | Que una columna agregada mañana quede desprotegida por olvido |
| `cobros` en otra tabla, no en otra columna | Que una gestora llegue al margen por cualquier camino |
| Los guardianes de tipografía, `Panel` y casa | Que el sistema visual se separe por copia |
| `security_invoker` en toda vista | Que una vista saltee la RLS entera en silencio |

**Regla dura:** un poka-yoke que nunca se vio fallar no es un poka-yoke. Cada guardián se prueba
metiéndole la violación a mano y **mirándolo en rojo** antes de darlo por bueno.

### Andon — parar la línea cuando aparece un defecto

- **Con defectos abiertos no entran funciones nuevas.** Si estás por escribir una función nueva y
  hay hallazgos abiertos, estás en el paso equivocado.
- La app tiene un botón para avisar un problema, que adjunta solo el contexto técnico. Quien lo
  aprieta no tiene que saber explicar nada.
- **Y el sistema mismo avisa:** monitoreo de errores desde el día uno. En el Tablero, la única
  forma de enterarse de un error en producción es que alguien avise por WhatsApp — su propio
  análisis de seguridad lo marca como el mayor riesgo operativo abierto.

*Por qué el orden importa:* una función nueva encima de un cálculo roto produce números falsos
con más confianza. En Toyota es doctrina: no se mejora un proceso inestable, primero se lo
estabiliza.

### Genchi genbutsu — ir y ver

**Una pantalla no está lista cuando compila ni cuando el test pasa. Está lista cuando alguien la
miró, en el dispositivo real, con datos reales.**

- El Excel exportado se **abre y se mira**, no alcanza con que el test pase.
- Las pantallas del teléfono se prueban **en un teléfono, parado, con una mano**.
- El saldo se compara contra el sitio de Habitualista **el mismo día**.

*Por qué:* los tres peores defectos del Estudio Magni se descubrieron mirando, no testeando — el
emoji que sobrevivía al filtro, el tablero en blanco por una cabecera, y la firma que publicaba un
garabato gris. **Ningún test los agarró.**

### Kaizen — mejora continua, con evidencia

- Cada etapa cierra con una retrospectiva que produce **una** mejora concreta, escrita.
- El `CHANGELOG` se escribe **en lenguaje de usuario**, no de commit.
- `docs/ESTADO.md` lleva los números contados de nuevo, incluidos los commits sin publicar.

---

