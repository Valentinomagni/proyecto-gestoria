import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { FilePlus, HandCoins, LayoutList, Settings, Wallet } from "lucide-react";
import { Shell } from "./components/Shell";
import { Tarjeta } from "./features/tarjeta/Tarjeta";
import { Bandeja } from "./features/solicitudes/Bandeja";
import { Listado } from "./features/tramites/Listado";
import { AltaTramite } from "./features/tramites/AltaTramite";
import { Ficha } from "./features/tramites/Ficha";
import { Admin } from "./features/admin/Admin";
import { useSaldosEnVivo } from "./lib/datos";
import { puedeAdministrar, type Rol } from "./lib/roles";

/**
 * El armado de la app.
 *
 * Sin router todavia: hoy son seis pantallas y una sola persona por vez. Cuando haga falta un
 * enlace directo a un tramite —para mandarlo por WhatsApp— entra TanStack Router, que ya esta
 * instalado. Agregarlo ahora seria andamiaje sin caso de uso.
 */

export type Pantalla = "tarjeta" | "bandeja" | "tramites" | "alta" | "admin";

export const MENU: { id: Pantalla; nombre: string; icono: typeof Wallet; soloGerencia?: boolean }[] = [
  { id: "bandeja", nombre: "Pedidos de fondos", icono: HandCoins },
  { id: "tarjeta", nombre: "Tarjeta", icono: Wallet },
  { id: "tramites", nombre: "Trámites", icono: LayoutList },
  { id: "alta", nombre: "Cargar trámite", icono: FilePlus },
  { id: "admin", nombre: "Administración", icono: Settings, soloGerencia: true },
];

export function App() {
  const cliente = useQueryClient();
  const [pantalla, setPantalla] = useState<Pantalla>("bandeja");
  const [tramiteAbierto, setTramiteAbierto] = useState<string | null>(null);

  // El saldo se entera solo cuando otro lo mueve. Es la funcion central del producto: sin esto,
  // dos personas miran el mismo numero viejo y comprometen la misma plata.
  useSaldosEnVivo(cliente);

  function abrir(id: string): void {
    setTramiteAbierto(id);
  }

  return (
    <Shell pantalla={pantalla} alNavegar={(p: Pantalla) => { setPantalla(p); setTramiteAbierto(null); }}>
      {tramiteAbierto !== null ? (
        <Ficha id={tramiteAbierto} alVolver={() => setTramiteAbierto(null)} />
      ) : pantalla === "bandeja" ? (
        <Bandeja alAbrir={abrir} />
      ) : pantalla === "tarjeta" ? (
        <Tarjeta />
      ) : pantalla === "tramites" ? (
        <Listado alAbrir={abrir} />
      ) : pantalla === "alta" ? (
        <AltaTramite alGuardar={() => setPantalla("tramites")} />
      ) : (
        <Admin />
      )}
    </Shell>
  );
}

/** Qué pantallas ve cada rol. NO decide permisos: evita mostrar botones que van a fallar. */
export function menuPara(rol: Rol): typeof MENU {
  return MENU.filter((m) => !m.soloGerencia || puedeAdministrar(rol));
}
