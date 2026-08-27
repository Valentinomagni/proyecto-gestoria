import { FilePlus, HandCoins, LayoutList, Settings, Wallet } from "lucide-react";
import { type Rol } from "./lib/roles";

/**
 * El menu, en su propio archivo y no adentro de App.tsx.
 *
 * DOS RAZONES, y las dos se vieron trabajando:
 *
 *  1. `Shell` necesita el menu, y `App` necesita a `Shell`. Con el menu adentro de App eso es
 *     una importacion circular: funciona hasta que un dia deja de funcionar, y el error que
 *     tira no menciona el ciclo.
 *
 *  2. Un archivo que exporta un componente Y una constante rompe el refresco rapido de Vite
 *     ("MENU export is incompatible"). El sintoma es que cada cambio recarga la pagina entera y
 *     se pierde lo que habia cargado a medias en un formulario. Cuesta mas de lo que parece:
 *     desalienta justo lo que este proyecto exige, que es ir y mirar.
 *
 * Seiton: un lugar para cada cosa. El menu es configuracion, no es una pantalla.
 */

export type Pantalla = "tarjeta" | "bandeja" | "tramites" | "alta" | "admin";

/**
 * `corto` es para la barra de abajo del telefono, donde cada boton tiene 75 pixeles.
 *
 * NO SE ABREVIA CON PUNTOS NI SE CORTA CON CSS. "Administraci..." obliga a adivinar, y una
 * etiqueta que se adivina se toca mal. Se elige una palabra mas corta que siga siendo una
 * palabra entera.
 */
/**
 * La oficina.
 *
 * GERENCIA Y CONTABLE SON LA MISMA OFICINA, y por eso tienen exactamente lo mismo. El usuario lo
 * confirmó textual: "Sí, todo idéntico incluidos los usuarios". Antes Administración era sólo de
 * gerencia, y la consecuencia era que confirmar un plazo, cargar un feriado o atender un aviso
 * dependía de que una sola persona estuviera disponible.
 *
 * Espeja al helper `es_oficina()` de la base, que es quien decide de verdad.
 */
const OFICINA: Rol[] = ["contable", "gerencia"];

/** Las tres que trabajan con trámites todos los días. */
const TODAS: Rol[] = ["gestora", "contable", "gerencia"];

export const MENU: {
  id: Pantalla;
  nombre: string;
  corto: string;
  icono: typeof Wallet;
  roles: Rol[];
}[] = [
  /*
    ============================================================================
     SON DOS NECESIDADES DISTINTAS, Y POR ESO SON DOS MENUS
    ============================================================================

    Lo dictó el usuario: "gestoría, viendo qué hay para presentar para poder presupuestar y pedir
    el dinero, para poder pagar en el día o proyectar para mañana; contable y gerencia para poder
    administrar lo que pide la gestora".

    GESTORIA NO CARGA TRAMITES. El trámite nace de un mail que le llega a administración, y el
    alta la hace quien recibe ese mail. Ofrecerle a la gestora un formulario de alta es ofrecerle
    trabajo que no es suyo, en la pantalla más chica de todas.

    SI VE LOS PEDIDOS DE FONDOS, y no es una contradicción: la RLS le muestra únicamente sus
    trámites, así que para ella esa pantalla dice "lo que pedí y todavía no me pagaron". Para la
    oficina, la misma pantalla dice "lo que me están pidiendo". Una pantalla, dos lecturas, según
    quién entra.

    Y `roles` vive acá y no repartido en condiciones sueltas porque es la lista completa, en un
    solo lugar, de qué necesita cada persona. Cuando eso vive en cinco archivos, nadie puede
    contestar "¿qué ve una gestora?" sin leerlos todos.
  */
  { id: "bandeja", nombre: "Pedidos de fondos", corto: "Pedidos", icono: HandCoins, roles: TODAS },
  { id: "tarjeta", nombre: "Tarjeta", corto: "Tarjeta", icono: Wallet, roles: TODAS },
  { id: "tramites", nombre: "Trámites", corto: "Trámites", icono: LayoutList, roles: TODAS },
  { id: "alta", nombre: "Cargar trámite", corto: "Cargar", icono: FilePlus, roles: OFICINA },
  { id: "admin", nombre: "Administración", corto: "Ajustes", icono: Settings, roles: OFICINA },
];

/**
 * Qué pantallas ve cada rol. NO decide permisos: evita mostrar botones que van a fallar.
 *
 * Un rol sin asignar no recibe ninguna, y eso es correcto: todas las cuentas nuevas nacen así.
 * La pantalla que les toca explica que falta el rol y a quién avisarle. Un menú lleno de
 * pantallas que van a fallar sería peor que ninguno.
 */
export function menuPara(rol: Rol): typeof MENU {
  return MENU.filter((m) => m.roles.includes(rol));
}
