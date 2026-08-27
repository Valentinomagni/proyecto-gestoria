/**
 * ============================================================================
 *  EL CHECKLIST DEL LEGAJO
 * ============================================================================
 *
 *  ESTE COMPONENTE NACIO DE UN DEFECTO QUE SE VIO MIRANDO LA PANTALLA, no testeando.
 *
 *  La primera versión tenía un solo botón, "marcar los 4 requisitos como presentes", justo
 *  debajo de un texto que decía "una falta registrada sirve". O sea: la pantalla prometía un
 *  control y entregaba un sello de goma. No había ninguna forma de anotar que algo faltaba, que
 *  es EXACTAMENTE el dato que hace falta después, cuando el trámite vuelve del registro
 *  rechazado y nadie se acuerda si el formulario 08 estaba o no.
 *
 *  Una pantalla que dice una cosa y hace otra es peor que una que no dice nada: la primera
 *  además enseña a no leerla.
 *
 *  ============================================================================
 *   Y HAY DOS CLASES DE ITEM, QUE NO SE CONTESTAN IGUAL
 *  ============================================================================
 *
 *  LOS PAPELES se contestan Está / Falta / No corresponde. Las tres significan algo distinto y
 *  las tres hacen falta: un requisito que no aplica a ese trámite, si sólo se pudiera tildar o
 *  no tildar, se termina tildando en falso — y ahí deja de ser un control y pasa a ser una
 *  mentira prolija.
 *
 *  LOS HECHOS DE LA OPERACION se contestan Sí o No. "¿Hay accesorios?" no admite "no
 *  corresponde": o los hay o no los hay. Ofrecer una respuesta que no significa nada es invitar
 *  a usarla para no pensar.
 *
 *  LA TANDA ANTERIOR DE ESTE PEDIDO SALIO MAL POR ENTENDERLO AL PIE DE LA LETRA: se creó un
 *  requisito llamado literalmente "Accesorios si/no" y se le dejaron las tres respuestas de
 *  papel, así que la pantalla preguntaba si el "si/no" ESTABA. Queda escrito para que no se
 *  repita: la diferencia no está en el nombre del ítem, está en su naturaleza, y por eso ahora
 *  vive en una columna de la base.
 *
 *  EL ATAJO SE QUEDA, y abajo. El caso común es que venga todo, y el alta entera tiene que
 *  entrar en veinte segundos o vuelve el cuaderno. Pero deja de ser la ÚNICA opción, que es lo
 *  que lo volvía un sello.
 */

const RESPUESTAS: Record<string, { valor: string; nombre: string }[]> = {
  documento: [
    { valor: "si", nombre: "Está" },
    { valor: "no", nombre: "Falta" },
    { valor: "no_aplica", nombre: "No corresponde" },
  ],
  si_no: [
    { valor: "si", nombre: "Sí" },
    { valor: "no", nombre: "No" },
  ],
};

/** Un tipo desconocido se trata como papel: es la opción que nunca pierde información. */
function respuestasDe(tipo: string): { valor: string; nombre: string }[] {
  return RESPUESTAS[tipo] ?? RESPUESTAS["documento"] ?? [];
}

export interface Requisito {
  id: string;
  nombre: string;
  tipo: string;
}

export function Checklist({
  requisitos,
  respuestas,
  alResponder,
  alResponderTodo,
}: {
  requisitos: Requisito[];
  respuestas: Record<string, { respuesta: string; nota: string | null }>;
  alResponder: (requisitoId: string, respuesta: string) => void;
  alResponderTodo: () => void;
}) {
  const contestados = requisitos.filter((r) => respuestas[r.id] !== undefined).length;

  // Sólo los PAPELES que faltan se avisan. Que no haya accesorios no es una falta, es un dato:
  // meterlo en la misma lista haría que el aviso pierda sentido justo cuando importa.
  const faltan = requisitos.filter(
    (r) => r.tipo === "documento" && respuestas[r.id]?.respuesta === "no",
  );

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-ink2">
        Antes de pasar a gestoría hay que contestar el checklist del legajo. Se exige contestado, no
        que todo esté: una falta registrada sirve, una casilla tildada en falso no.
      </p>

      <div className="flex flex-col">
        {requisitos.map((r) => {
          const actual = respuestas[r.id]?.respuesta;
          return (
            <div
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-line py-2"
            >
              <span className={actual === undefined ? "text-sm" : "text-sm text-ink2"}>
                {r.nombre}
              </span>
              <div className="flex gap-1">
                {respuestasDe(r.tipo).map((op) => (
                  <button
                    key={op.valor}
                    type="button"
                    onClick={() => alResponder(r.id, op.valor)}
                    aria-pressed={actual === op.valor}
                    className={`min-h-11 rounded-md border px-3 py-1 text-xs ${
                      actual === op.valor
                        ? /*
                            EL "NO" DE UN HECHO NO SE PINTA DE ALERTA. Que no haya accesorios no
                            es una falta del legajo. Pintarlo igual que un papel faltante enseña
                            a leer el color como decorativo, y entonces deja de avisar nada.
                          */
                          op.valor === "no" && r.tipo === "documento"
                          ? "border-warn text-warn"
                          : "border-ink"
                        : "border-line text-ink2"
                    }`}
                  >
                    {op.nombre}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/*
        El contador dice lo que FALTA, no lo que ya se hizo. "Contestaste 3" invita a seguir de
        largo; "falta contestar 1" dice exactamente qué hacer y cuánto queda.
      */}
      <p className="text-xs text-ink2 tnum">
        {contestados === requisitos.length
          ? `Contestados los ${requisitos.length}`
          : `Falta contestar ${requisitos.length - contestados} de ${requisitos.length}`}
      </p>

      {faltan.length > 0 && (
        <p className="text-xs text-warn">
          Anotado que falta: {faltan.map((r) => r.nombre).join(", ")}. El trámite igual avanza —
          queda escrito para cuando alguien pregunte por qué volvió.
        </p>
      )}

      {contestados < requisitos.length && (
        <button
          type="button"
          onClick={alResponderTodo}
          className="min-h-11 w-fit rounded-md border border-line px-3 py-2 text-xs text-ink2"
        >
          {/*
            El atajo contesta todo que SI. Para los papeles significa que vino todo; para los
            hechos, que hay accesorios y que hay un usado en parte de pago. Eso último NO es el
            caso más común, así que el texto lo dice en vez de prometer algo que no hace.
          */}
          Vino todo, con accesorios y con usado: contestar los {requisitos.length} que sí
        </button>
      )}
    </div>
  );
}
