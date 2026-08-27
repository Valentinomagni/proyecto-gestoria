import { Panel } from "../../components/Panel";
import { SkeletonLineas } from "../../components/Skeleton";
import { formatearFechaHora } from "../../lib/fechas";
import { aCentavos, formatear } from "../../lib/plata";
import type { CambioDelTramite } from "../../lib/datos";
import { nombreDeCampo } from "./campos-del-tramite";

/**
 * ============================================================================
 *  TODO LO QUE CAMBIO EN ESTE TRAMITE
 * ============================================================================
 *
 *  UN SOLO PANEL, y no uno para el presupuesto y otro para los datos. Quien pregunta "¿por qué
 *  este trámite dice esto?" no sabe de antemano si lo que cambió fue un importe o el nombre de
 *  la gestora, y dos paneles lo obligan a buscar en los dos.
 *
 *  ============================================================================
 *   LO ESCRIBEN TRIGGERS, NO ESTA PANTALLA
 *  ============================================================================
 *
 *  Si lo escribiera la pantalla, el día que alguien cambie algo desde otro lado —una corrección
 *  a mano, una importación, un script— el historial diría que no pasó nada. Un historial con
 *  agujeros es PEOR que ninguno: se lo lee como completo.
 *
 *  Y el trigger de datos compara por diferencia de jsonb, así que una columna que se agregue
 *  mañana queda registrada por defecto. El olvido cae del lado seguro.
 */
export function CambiosDelTramite({
  cambios,
  cargando,
  gestoras,
}: {
  cambios: CambioDelTramite[];
  cargando: boolean;
  /** Para traducir el id de la gestora a su nombre. Ver `legible`. */
  gestoras: { id: string; nombre: string }[];
}) {
  if (cargando)
    return (
      <Panel>
        <SkeletonLineas cantidad={2} />
      </Panel>
    );

  // Sin cambios no se dibuja nada. Un panel vacío que dice "no hay cambios" ocupa lugar en la
  // pantalla del teléfono para no decir nada: la mayoría de los trámites nunca se corrigen.
  if (cambios.length === 0) return null;

  return (
    <Panel className="flex flex-col gap-2">
      <h2 className="text-lg">Cambios</h2>
      <p className="text-2xs text-ink2">
        Queda registrado quién lo cambió y de qué a qué. No se puede editar ni borrar.
      </p>
      <div className="flex flex-col">
        {cambios.map((c) => (
          <div key={c.id} className="border-b border-line py-2 last:border-0">
            <p className="text-sm">{describir(c, gestoras)}</p>
            <p className="text-2xs text-ink2 tnum">
              {/*
                Sin nombre significa que no lo escribió una persona: fue una migración o una
                corrección desde la consola de la base. Decir "Alguien" invitaría a buscar a
                quién, y no hay a quién.
              */}
              {c.quien_nombre ?? "El sistema"} · {formatearFechaHora(c.cuando)}
            </p>
          </div>
        ))}
      </div>
    </Panel>
  );
}

/**
 * Cómo se lee un cambio.
 *
 * Los importes pasan por el módulo de plata en vez de mostrarse crudos: el trigger los guarda
 * como texto decimal —`640000.00`— y así, sin puntos de miles, un número de siete cifras se lee
 * mal justo cuando importa distinguir 64.000 de 640.000.
 */
function describir(c: CambioDelTramite, gestoras: { id: string; nombre: string }[]): string {
  if (c.que === "deposito") {
    // Filas viejas, de cuando el total se escribía a mano. Se siguen mostrando: el historial
    // no se recorta porque haya cambiado el mecanismo.
    const antes = c.antes === null ? null : formatear(aCentavos(Number(c.antes)));
    const despues =
      c.despues === null ? "sin presupuesto" : formatear(aCentavos(Number(c.despues)));
    return antes === null ? `Presupuesto: ${despues}` : `Presupuesto: de ${antes} a ${despues}`;
  }

  if (c.que === "concepto") {
    // Un concepto llega ya armado por el trigger, con su nombre y su momento.
    return c.antes === null
      ? `Concepto agregado: ${c.despues ?? ""}`
      : `Concepto: de ${c.antes} a ${c.despues ?? ""}`;
  }

  /*
    El total del presupuesto es un caso aparte, y hay pocas filas asi: el numero es derivado y
    normalmente cambia por una linea, no por si mismo. Cuando aparece es porque lo movio una
    migracion — el arrastre del 21/08/2026 — y entonces hay que mostrarlo COMO PLATA. Sin esto
    diria "deposito_solicitado: de 655000.00 a 450000.00", con el nombre de la columna y un
    numero de seis cifras sin puntos, que es justo donde se confunde 65.000 con 650.000.
  */
  if (c.campo === "deposito_solicitado") {
    const antes = c.antes === null ? "sin presupuesto" : formatear(aCentavos(Number(c.antes)));
    const despues =
      c.despues === null ? "sin presupuesto" : formatear(aCentavos(Number(c.despues)));
    return `Total del presupuesto: de ${antes} a ${despues}`;
  }

  // Un dato. El nombre en castellano sale de la misma tabla que usa el panel de datos, así que
  // una etiqueta que cambie ahí cambia acá también y las dos no se pueden separar.
  const nombre = nombreDeCampo(c.campo ?? "");
  return `${nombre}: de ${legible(c.campo, c.antes, gestoras)} a ${legible(c.campo, c.despues, gestoras)}`;
}

/**
 * El valor de un dato, como se lee.
 *
 * ============================================================================
 *  SE VIO MIRANDO LA PANTALLA, y es la clase de defecto que no rompe nada
 * ============================================================================
 *
 * Se cambió la gestora de un trámite y el historial dijo:
 *
 *   "Gestora: de bd530d48-4422-42db-bace-de9f62ebf6ee a 07aedbfd-5945-45f9-911d-0242098be04c"
 *
 * El trigger guarda lo que hay en la columna, que es un id — y tiene que guardar eso, porque un
 * nombre puede cambiar después y el historial dejaría de coincidir con lo que pasó. Traducirlo
 * es trabajo de la pantalla.
 *
 * Una gestora que ya no está en la lista se muestra por su id: es feo, pero es verdad. Inventar
 * "Sin asignar" ahí sería decir algo que no pasó.
 */
function legible(
  campo: string | null,
  valor: string | null,
  gestoras: { id: string; nombre: string }[],
): string {
  if (valor === null || valor === "") return "vacío";
  if (campo === "gestora_id") return gestoras.find((g) => g.id === valor)?.nombre ?? valor;
  if (campo === "subtipo") {
    return valor === "plan_ahorro"
      ? "Plan de ahorro"
      : valor === "venta_directa"
        ? "Venta directa 0km"
        : valor;
  }
  return valor;
}
