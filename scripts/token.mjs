/**
 * ============================================================================
 *  SALTEARSE EN UNA MAQUINA SE PERDONA. SALTEARSE EN CI, NO
 * ============================================================================
 *
 *  Tres guardianes consultan el esquema de la base y necesitan `SUPABASE_ACCESS_TOKEN`: `permisos`,
 *  `indices` y `estados`. Los tres salían con 0 cuando el token no estaba.
 *
 *  El motivo original es bueno: en un repo recién clonado el primer commit no debería exigir un
 *  token de cuenta. Pero deja un agujero que el ESTADO tiene anotado desde el Plan A —
 *
 *      "salir en verde y no haber mirado nada se ven iguales"
 *
 *  — y ese agujero es peor en el único lugar donde el guardián de verdad tiene que correr: **en CI
 *  el token SIEMPRE está**, porque es un secreto del repositorio. Si falta ahí, no es que alguien
 *  clonó el proyecto: es que el secreto se venció, se borró, o el workflow dejó de pasarlo. Y ese
 *  es exactamente el día en que el guardián deja de mirar sin que nadie se entere.
 *
 *  Entonces: sin token, **en una máquina se saltea diciéndolo, y en CI falla**.
 *
 *  ============================================================================
 *   POR QUE `CI` Y NO OTRA COSA
 *  ============================================================================
 *
 *  `CI=true` la ponen GitHub Actions, Cloudflare Pages y prácticamente todo lo que corre sin una
 *  persona mirando. Es la convención, no un invento de este proyecto.
 */
import { existsSync, readFileSync } from "node:fs";

/**
 * El token de la cuenta de Supabase, o `null` si no está y se puede seguir sin él.
 *
 * **Si estamos en CI y no está, corta el proceso con 1.** No devuelve `null`: quien llama no tiene
 * que acordarse de comprobarlo, que es como se vuelve a abrir el mismo agujero.
 */
export function tokenODecirlo(guardian) {
  const delEntorno = process.env["SUPABASE_ACCESS_TOKEN"];
  if (delEntorno !== undefined && delEntorno.trim() !== "") return delEntorno.trim();

  // También se acepta desde `.env.local`, que es donde vive de este lado y está en `.gitignore`.
  if (existsSync(".env.local")) {
    const m = /^SUPABASE_ACCESS_TOKEN=(.*)$/m.exec(readFileSync(".env.local", "utf8"));
    if (m !== null && m[1].trim() !== "") return m[1].trim();
  }

  if (process.env["CI"] !== undefined && process.env["CI"] !== "") {
    console.error(`\n  ${guardian}: FALTA SUPABASE_ACCESS_TOKEN, Y ESTO ES CI.`);
    console.error("  Acá el token siempre tiene que estar: es un secreto del repositorio. Que");
    console.error("  falte no significa que alguien clonó el proyecto — significa que el secreto");
    console.error("  se venció, se borró, o el workflow dejó de pasarlo.");
    console.error("  Salir en verde acá sería un guardián apagado sin que nadie se entere.\n");
    process.exit(1);
  }

  console.log(`${guardian}: sin SUPABASE_ACCESS_TOKEN no se puede consultar el esquema.`);
  console.log(`           SE SALTEA, y no comprobó nada.`);
  console.log(`           Para correrlo: SUPABASE_ACCESS_TOKEN=sbp_... npm run ${guardian}`);
  return null;
}
