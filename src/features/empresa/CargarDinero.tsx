import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Panel } from "../../components/Panel";
import { aPesos, formatear, parsear } from "../../lib/plata";
import { hoyArgentina, proximoDiaHabil } from "../../lib/fechas";
import { supabase } from "../../lib/supabase";
import { BOTON, BOTON_SUAVE, CAMPO } from "../../lib/campos";
import { useCalendario, useGuardar } from "../../lib/datos";

/**
 * ============================================================================
 *  CARGAR DINERO, ADENTRO DE LA EMPRESA
 * ============================================================================
 *
 *  Vivía en Administración, junto a la lista de usuarios y el calendario de feriados. Se mudó
 *  porque no es configuración: es trabajo diario, y **un depósito siempre es a una tarjeta, y la
 *  tarjeta es de una empresa**.
 *
 *  ============================================================================
 *   EL CAMPO QUE DESAPARECIO ES LA MITAD DEL ARREGLO
 *  ============================================================================
 *
 *  El formulario tenía un selector de tarjeta. Acá no hace falta: la pantalla ya sabe de qué
 *  empresa se trata. **El campo que no existe no se puede llenar mal** — y elegir la tarjeta
 *  equivocada en un depósito es de los errores más caros que tiene este sistema, porque la plata
 *  aparece en una empresa que no la recibió y falta en la que sí.
 *
 *  ============================================================================
 *   LA FECHA DE ACREDITACION ES LA RAZON DE SER DE ESTE FORMULARIO
 *  ============================================================================
 *
 *  Un depósito ordenado hoy acredita mañana, así que hasta entonces NO es saldo disponible. Si se
 *  cargara como disponible, alguien mandaría a presentar contra plata que todavía no está.
 *
 *  Y los feriados salen de la tabla: un depósito ordenado el jueves antes de un feriado no
 *  acredita el viernes.
 */
export function CargarDinero({
  tarjetaId,
  razonSocialId,
  nombreDeEmpresa,
}: {
  tarjetaId: string;
  razonSocialId: string;
  nombreDeEmpresa: string;
}) {
  const navegar = useNavigate();
  const calendario = useCalendario();

  const [importe, setImporte] = useState("");
  const [tipo, setTipo] = useState<"ingreso" | "saldo_inicial">("ingreso");
  const [acreditaManiana, setAcreditaManiana] = useState(true);
  const [observacion, setObservacion] = useState("");

  const volver = (): void =>
    void navegar({ to: "/empresa/$razonSocialId", params: { razonSocialId } });

  const guardar = useGuardar(
    async () => {
      const centavos = parsear(importe);
      if (centavos === null) throw new Error("importe invalido");

      const { error } = await supabase.from("movimientos").insert({
        tarjeta_id: tarjetaId,
        tipo,
        importe: aPesos(centavos),
        fecha_acreditacion:
          tipo === "saldo_inicial" || !acreditaManiana
            ? hoyArgentina()
            : proximoDiaHabil(calendario.data?.feriados ?? new Set()),
        concepto: tipo === "saldo_inicial" ? "Saldo inicial del corte" : "Depósito",
        ...(observacion.trim() !== "" && { observacion: observacion.trim() }),
      });
      if (error) throw error;
      volver();
    },
    {
      exito: "Movimiento cargado",
      invalidar: ["saldos", "movimientos", "resumen", "esperando_plata"],
    },
  );

  const centavos = parsear(importe);

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 p-6">
      <h1 className="text-xl">Cargar dinero en {nombreDeEmpresa}</h1>

      <Panel className="flex flex-col gap-3">
        <p className="text-xs text-ink2">
          Un depósito ordenado hoy acredita mañana. Hasta entonces figura como en tránsito y no como
          disponible: si contara hoy, alguien podría mandar a presentar contra plata que todavía no
          está.
        </p>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-ink2">Qué es</span>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as "ingreso" | "saldo_inicial")}
            className={CAMPO}
          >
            <option value="ingreso">Un depósito</option>
            <option value="saldo_inicial">El saldo inicial del corte</option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-ink2">Importe</span>
          <input
            inputMode="decimal"
            value={importe}
            onChange={(e) => setImporte(e.target.value)}
            placeholder="2.505.627,92"
            className={`${CAMPO} tnum`}
          />
          {/*
            LO QUE SE ENTENDIO, DEBAJO DE LO QUE SE ESCRIBIO. `1.100.000` y `1100000` se escriben
            las dos formas en el cuaderno, y esta linea confirma cual se leyo antes de guardar.
          */}
          {centavos !== null && (
            <span className="tnum text-2xs text-ink2">{formatear(centavos)}</span>
          )}
        </label>

        {tipo === "ingreso" && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={acreditaManiana}
              onChange={(e) => setAcreditaManiana(e.target.checked)}
            />
            Acredita mañana
          </label>
        )}

        {tipo === "saldo_inicial" && (
          <p className="text-xs text-warn">
            El saldo inicial se carga UNA sola vez por tarjeta, y tiene que ser exactamente el que
            muestra el sitio ese día. Es la línea de largada de todo lo demás.
          </p>
        )}

        <label className="flex flex-col gap-1">
          <span className="text-xs text-ink2">Observación</span>
          <input
            value={observacion}
            onChange={(e) => setObservacion(e.target.value)}
            className={CAMPO}
          />
        </label>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={centavos === null || guardar.isPending}
            onClick={() => guardar.mutate(undefined)}
            className={BOTON}
          >
            {guardar.isPending ? "Guardando" : "Cargar"}
          </button>
          <button type="button" onClick={volver} className={BOTON_SUAVE}>
            Volver
          </button>
        </div>
      </Panel>
    </div>
  );
}
