/**
 * Traduce el rol de un perfil a QUE SE MUESTRA.
 *
 * ============================================================================
 *  ESTE ARCHIVO NO DECIDE PERMISOS. LOS DECIDE LA BASE.
 * ============================================================================
 *
 *  Lo unico que hace es evitar mostrar botones que van a fallar. Si alguien borra este archivo,
 *  la app se vuelve fea y sigue siendo segura; si alguien borra las policies, la app se ve igual
 *  y deja de serlo.
 *
 *  Esa distincion es la que separa "esconder un boton" de "que el dato no se pueda tocar", y es
 *  la razon de que la RLS este donde esta. Escrito aca arriba a proposito: es la confusion que
 *  lleva a creer que alcanza con no dibujar el boton.
 */

export type Rol = "sin_asignar" | "gestora" | "contable" | "gerencia";

export const ROLES: Rol[] = ["sin_asignar", "gestora", "contable", "gerencia"];

/** Como se nombra cada rol en pantalla. */
export function nombreDeRol(rol: Rol): string {
  switch (rol) {
    case "gerencia":
      return "Gerencia";
    case "contable":
      return "Administración contable";
    case "gestora":
      return "Gestoría";
    case "sin_asignar":
      return "Sin asignar";
  }
}

/** Quien puede ver lo cobrado al cliente y el margen. Espeja al helper puede_ver_cobros(). */
export function puedeVerCobros(rol: Rol): boolean {
  return rol === "gerencia" || rol === "contable";
}

/** Quien puede mover plata: cargar ingresos y ajustes. El pedido dice MODIFICAR, no ver. */
export function puedeMoverSaldo(rol: Rol): boolean {
  return rol === "gerencia" || rol === "contable";
}

/*
  ACA VIVIA `puedeAdministrar`, y se fue el 21/08/2026.

  Decidia quien ve Administracion, y era el unico lugar desde donde se lo llamaba: el menu. Con
  el menu armado por rol —cada pantalla dice que roles la ven, en `src/menu.ts`— esta funcion
  pasaba a ser una segunda fuente para la misma decision, y dos fuentes para una decision es como
  se separan.

  La regla no cambio: gerencia y contable son la misma oficina y ven exactamente lo mismo. Vive
  en la constante OFICINA de `menu.ts`, con su porque, y sigue espejando a `es_oficina()` de la
  base, que es quien decide de verdad.
*/

/** Un rol sin asignar no ve nada hasta que gerencia lo habilita. */
export function estaHabilitado(rol: Rol, activo: boolean): boolean {
  return activo && rol !== "sin_asignar";
}

export function esRolValido(v: string): v is Rol {
  return (ROLES as string[]).includes(v);
}
