import { FilePlus, HandCoins, LayoutList, Settings, Wallet } from "lucide-react";
import { puedeAdministrar, type Rol } from "./lib/roles";

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

export const MENU: { id: Pantalla; nombre: string; icono: typeof Wallet; soloGerencia?: boolean }[] = [
  { id: "bandeja", nombre: "Pedidos de fondos", icono: HandCoins },
  { id: "tarjeta", nombre: "Tarjeta", icono: Wallet },
  { id: "tramites", nombre: "Trámites", icono: LayoutList },
  { id: "alta", nombre: "Cargar trámite", icono: FilePlus },
  { id: "admin", nombre: "Administración", icono: Settings, soloGerencia: true },
];

/** Qué pantallas ve cada rol. NO decide permisos: evita mostrar botones que van a fallar. */
export function menuPara(rol: Rol): typeof MENU {
  return MENU.filter((m) => !m.soloGerencia || puedeAdministrar(rol));
}
