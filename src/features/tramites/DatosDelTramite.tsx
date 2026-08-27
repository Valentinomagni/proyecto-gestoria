import { useState } from "react";
import { Pencil } from "lucide-react";
import { Panel } from "../../components/Panel";
import { BOTON, BOTON_SUAVE, CAMPO } from "../../lib/campos";
import type { Rol } from "../../lib/roles";
import { camposPara, type CambiosDeDatos, type CampoEditable } from "./campos-del-tramite";

/**
 * ============================================================================
 *  LOS DATOS DEL TRAMITE, Y SE PUEDEN CORREGIR
 * ============================================================================
 *
 *  El pedido: "que permita modificar datos, por ejemplo la gestora que realiza el trámite".
 *
 *  Antes esta ficha era de sólo lectura y los datos se cargaban una única vez, en el alta. Un
 *  apellido mal tipeado quedaba mal para siempre; una gestora que se enfermaba dejaba el trámite
 *  asignado a quien no estaba, y el trabajo no le aparecía a quien lo tenía en la mano.
 *
 *  ============================================================================
 *   SE EDITA TODO JUNTO, Y SE GUARDA UNA VEZ
 *  ============================================================================
 *
 *  No hay un lápiz por campo. Quien corrige un trámite corrige varias cosas de una: llegó el
 *  legajo y trae el dominio, la cuenta y la seccional. Un botón por campo convierte eso en cinco
 *  guardadas, y cada guardada es una oportunidad de que una falle y nadie se entere.
 *
 *  Y ADEMAS UNA SOLA GUARDADA ES UN SOLO UPDATE, así que el trigger de historial escribe las
 *  cinco filas en el mismo instante y en el panel de cambios se leen como lo que fueron: una
 *  corrección, no cinco.
 */
export function DatosDelTramite({
  tramite,
  rol,
  gestoras,
  administrativos,
  alGuardar,
  guardando,
}: {
  tramite: Record<string, unknown>;
  rol: Rol;
  gestoras: { id: string; nombre: string; activa: boolean }[];
  administrativos: string[];
  alGuardar: (cambios: CambiosDeDatos) => void;
  guardando: boolean;
}) {
  const [editando, setEditando] = useState(false);
  const [campos, setCampos] = useState<Record<string, string>>({});
  const editables = camposPara(rol);

  const leer = (c: CampoEditable): string => {
    const escrito = campos[c.columna];
    if (escrito !== undefined) return escrito;
    const v = tramite[c.columna];
    return v === null || v === undefined ? "" : String(v);
  };

  const escribir = (columna: string, valor: string): void =>
    setCampos((x) => ({ ...x, [columna]: valor }));

  function guardar(): void {
    /*
      SE MANDA SOLO LO QUE CAMBIO, y no el formulario entero.

      Mandar todo pasaría por el trigger que bloquea campos con columnas que este rol no puede
      tocar, y ese trigger rechaza la guardada ENTERA con un mensaje sobre un campo que la
      persona ni miró. Mandar sólo lo tocado hace que el rechazo, si llega, hable de algo que
      efectivamente se escribió.
    */
    const cambios: CambiosDeDatos = {};
    for (const c of editables) {
      const escrito = campos[c.columna];
      if (escrito === undefined) continue;
      const antes = tramite[c.columna] ?? null;
      const limpio = escrito.trim() === "" ? null : escrito.trim();
      // Una columna `not null` no se puede vaciar: se ignora en vez de mandar algo que la base
      // va a rechazar con un mensaje que no explica nada.
      if (limpio === null && c.obligatorio === true) continue;
      if (limpio !== antes) cambios[c.columna] = limpio;
    }
    alGuardar(cambios);
    setCampos({});
    setEditando(false);
  }

  return (
    <Panel className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg">Datos del trámite</h2>
        {editables.length > 0 && !editando && (
          <button
            type="button"
            onClick={() => setEditando(true)}
            className="flex min-h-11 items-center gap-1 text-sm text-ink2"
          >
            <Pencil aria-hidden="true" size={14} /> Corregir
          </button>
        )}
      </div>

      {editando ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            {editables.map((c) => (
              <label key={c.columna} className="flex flex-col gap-1">
                <span className="text-xs text-ink2">
                  {c.nombre}
                  {c.ayuda !== undefined && <span className="block text-2xs">{c.ayuda}</span>}
                </span>

                {c.como === "gestora" ? (
                  <select
                    value={leer(c)}
                    onChange={(e) => escribir(c.columna, e.target.value)}
                    className={CAMPO}
                  >
                    <option value="">Sin asignar</option>
                    {/*
                      Las dadas de baja no se ofrecen, pero la que YA está asignada sí aparece
                      aunque esté de baja: sin eso el selector mostraría vacío y guardar sin
                      querer le sacaría el trámite a quien lo tiene.
                    */}
                    {gestoras
                      .filter((g) => g.activa || g.id === tramite["gestora_id"])
                      .map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.nombre}
                        </option>
                      ))}
                  </select>
                ) : c.como === "modalidad" ? (
                  <select
                    value={leer(c)}
                    onChange={(e) => escribir(c.columna, e.target.value)}
                    className={CAMPO}
                    // Una transferencia no tiene modalidad: la base lo impide con un check, así
                    // que ofrecerla acá sería ofrecer algo que se va a rechazar.
                    disabled={tramite["tipo"] !== "patentamiento_0km"}
                  >
                    <option value="">Sin especificar</option>
                    <option value="plan_ahorro">Plan de ahorro</option>
                    <option value="venta_directa">Venta directa 0km</option>
                  </select>
                ) : c.como === "administrativo" ? (
                  <>
                    <input
                      list="administrativos-conocidos"
                      value={leer(c)}
                      onChange={(e) => escribir(c.columna, e.target.value)}
                      className={CAMPO}
                    />
                    <datalist id="administrativos-conocidos">
                      {administrativos.map((a) => (
                        <option key={a} value={a} />
                      ))}
                    </datalist>
                  </>
                ) : (
                  <input
                    value={leer(c)}
                    onChange={(e) => escribir(c.columna, e.target.value)}
                    className={CAMPO}
                  />
                )}
              </label>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={guardar} disabled={guardando} className={BOTON}>
              {guardando ? "Guardando" : "Guardar los cambios"}
            </button>
            <button
              type="button"
              onClick={() => {
                setCampos({});
                setEditando(false);
              }}
              className={BOTON_SUAVE}
            >
              Dejarlo como está
            </button>
          </div>

          <p className="text-2xs text-ink2">
            Cada cambio queda registrado abajo, con tu nombre y la fecha.
          </p>
        </>
      ) : (
        <div className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          {LECTURA.map((l) => (
            <div key={l.columna}>
              <p className="text-2xs text-ink2">{l.nombre}</p>
              <p className={l.tnum === true ? "tnum" : ""}>{l.mostrar(tramite, gestoras)}</p>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

/**
 * Lo que se muestra cuando NO se está editando.
 *
 * Es una lista aparte de `CAMPOS` porque en lectura se muestran cosas que no se editan —la
 * modalidad traducida, por ejemplo— y porque la gestora se muestra por su NOMBRE y no por su id.
 */
const LECTURA: {
  columna: string;
  nombre: string;
  tnum?: boolean;
  mostrar: (t: Record<string, unknown>, g: { id: string; nombre: string }[]) => string;
}[] = [
  {
    columna: "oferta_referencia",
    nombre: "Referencia de la oferta",
    tnum: true,
    mostrar: (t) => texto(t["oferta_referencia"]),
  },
  {
    columna: "cliente_cuenta",
    nombre: "Cuenta personal",
    tnum: true,
    mostrar: (t) => texto(t["cliente_cuenta"]),
  },
  { columna: "vehiculo", nombre: "Vehículo", mostrar: (t) => texto(t["vehiculo"]) },
  { columna: "dominio", nombre: "Dominio", mostrar: (t) => texto(t["dominio"]) },
  {
    columna: "subtipo",
    nombre: "Modalidad",
    mostrar: (t) =>
      t["subtipo"] === "plan_ahorro"
        ? "Plan de ahorro"
        : t["subtipo"] === "venta_directa"
          ? "Venta directa 0km"
          : "—",
  },
  {
    columna: "gestora_id",
    nombre: "Gestora",
    mostrar: (t, g) => g.find((x) => x.id === t["gestora_id"])?.nombre ?? "—",
  },
  {
    columna: "administrativo",
    nombre: "Administrativo a cargo",
    mostrar: (t) => texto(t["administrativo"]),
  },
  { columna: "seccional", nombre: "Seccional", mostrar: (t) => texto(t["seccional"]) },
  {
    columna: "numero_pago_registro",
    nombre: "N° de pago",
    tnum: true,
    mostrar: (t) => texto(t["numero_pago_registro"]),
  },
  {
    columna: "documentacion_retirada",
    nombre: "Documentación retirada",
    mostrar: (t) => texto(t["documentacion_retirada"]),
  },
  {
    columna: "observaciones_gestora",
    nombre: "Observaciones de gestoría",
    mostrar: (t) => texto(t["observaciones_gestora"]),
  },
];

/** Una raya y no una celda vacía: una celda vacía no distingue "no hay dato" de "no cargó". */
function texto(v: unknown): string {
  return v === null || v === undefined || v === "" ? "—" : String(v);
}
