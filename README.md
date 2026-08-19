# Gestoría — Grupo Paris

Plataforma compartida entre gerencia, administración contable y gestoría para los trámites del
automotor y la cuenta corriente de las Tarjetas Habitualistas.

Reemplaza tres cosas que hoy no se hablan: una foto de un cuaderno que llega por WhatsApp, una
planilla de Excel de más de 6.800 filas, y el sitio de la Tarjeta Habitualista que cada uno mira
por su cuenta.

**Estado: en construcción.** No está en uso todavía.

---

## Arrancarlo

```sh
export PATH="$HOME/tools/node-v22.17.0-win-x64:$PATH"
npm install
npm run dev
```

**Ni `node` ni `npm` están en el PATH por defecto de esta máquina.** Esa primera línea no es
opcional, y cualquier cosa que arranque un proceso desde afuera del shell —el `launch.json`, una
tarea programada— tiene que llamar a `node.exe` con ruta absoluta. Está explicado en `CLAUDE.md`.

## Los cuatro comandos

Ninguno se declara "en verde" sin la salida pegada y el código de salida al lado. Y ojo:
`comando | tail` devuelve el estado de `tail`, no del comando.

| Qué | Comando |
|---|---|
| Tipos | `npx tsc -b` |
| Lint | `npx oxlint` |
| Tests | `npx vitest run` |
| Build | `npx vite build` |

## Base de datos

Las migraciones se corren con el CLI de Supabase, **nunca pegando SQL a mano en el editor**:

```sh
npm run db:nueva <nombre>   # crea la migración
npm run db:seco             # muestra qué se aplicaría, sin aplicarlo
npm run db:push             # la aplica
npm run db:tipos            # regenera src/lib/database.types.ts
```

## Dónde está cada cosa

| Documento | Para qué |
|---|---|
| `CLAUDE.md` | Cómo se trabaja acá. **Se lee antes de tocar nada.** |
| `docs/DOMINIO.md` | Qué es realmente un trámite: plazos, aranceles y el corte de las 16:00. Obligatorio antes de tocar la lógica de plazos o de saldos. |
| `docs/superpowers/plans/` | El plan, por etapas. El `00-INDICE` primero. |
| `docs/DECISIONES-DE-STACK.md` | Qué se eligió, qué se descartó y por qué. |
| `docs/AGENTES.md` | Los seis revisores especializados del proyecto. |
| `docs/fuente/` | El pedido original y sus imágenes. |

## Lo que este sistema NO hace

Escrito para que nadie lo suponga: no entra al sitio de Habitualista, no guarda credenciales, no
paga nada, no reemplaza a Quiter, no controla si el cliente pagó, **no mide personas**, y no
decide por nadie.
