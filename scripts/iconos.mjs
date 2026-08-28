#!/usr/bin/env node
/**
 * ============================================================================
 *  LOS ICONOS DE LA APP INSTALABLE, DEL ISOTIPO QUE YA EXISTE
 * ============================================================================
 *
 *  ============================================================================
 *   POR QUE SE DIBUJAN Y NO SE ESCALAN
 *  ============================================================================
 *
 *  `public/brand/isotipo-negro.png` mide 133x133. Estirarlo a 512 lo deja borroso, y un icono
 *  borroso en el escritorio del telefono es de las cosas que mas baratas se ven. El SVG del mismo
 *  isotipo esta al lado y no tiene tamanio: se dibuja a la medida que haga falta.
 *
 *  ============================================================================
 *   POR QUE CON PLAYWRIGHT Y NO CON UNA LIBRERIA DE IMAGENES
 *  ============================================================================
 *
 *  Porque Playwright ya esta instalado y trae un Chrome de verdad, que es el mismo motor que va a
 *  dibujar el SVG en el telefono. Agregar `sharp` o `resvg` seria una dependencia nueva —con su
 *  binario por plataforma— para hacer algo que la que ya esta hace bien.
 *
 *  ============================================================================
 *   POR QUE EL `maskable` LLEVA MARGEN PROPIO
 *  ============================================================================
 *
 *  Android no dibuja el icono como viene: lo recorta dentro de SU forma —circulo, rombo, cuadrado
 *  redondeado, segun el telefono— y se come los bordes. La especificacion pide dejar el contenido
 *  dentro del 80% central; aca se usa el 55%, que aguanta hasta el recorte circular.
 *
 *  Sin un icono `maskable`, el isotipo aparece cortado. Y se ve en el telefono de la duenia.
 */
import { chromium } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";

/** El teal de la Tarjeta Habitualista, el mismo `--accent` del modo claro. */
const TEAL = "#0e7c8c";

const svg = readFileSync("public/brand/isotipo-blanco.svg", "utf8");

/**
 * Una pagina cuadrada con el isotipo centrado, ocupando `porcentaje` del lado.
 *
 * El `viewBox` del isotipo es 133x123 —NO es cuadrado—, asi que se lo mete en una caja cuadrada
 * con `object-fit: contain`: sin eso queda estirado a lo alto, y un logo estirado es de las cosas
 * que la duenia ve primero.
 */
function pagina(lado, porcentaje) {
  return `<!doctype html><html><body style="margin:0">
  <div style="width:${lado}px;height:${lado}px;background:${TEAL};display:flex;
              align-items:center;justify-content:center">
    <div style="width:${porcentaje}%;height:${porcentaje}%;display:flex;
                align-items:center;justify-content:center">${svg}</div>
  </div></body></html>`;
}

const QUE_HACER = [
  { archivo: "public/brand/icono-192.png", lado: 192, porcentaje: 72 },
  { archivo: "public/brand/icono-512.png", lado: 512, porcentaje: 72 },
  // El margen del maskable: el contenido no pasa del 55% del lado.
  { archivo: "public/brand/icono-maskable-512.png", lado: 512, porcentaje: 55 },
];

const navegador = await chromium.launch({ channel: "chrome" });
const pag = await navegador.newPage();

for (const { archivo, lado, porcentaje } of QUE_HACER) {
  await pag.setViewportSize({ width: lado, height: lado });
  await pag.setContent(pagina(lado, porcentaje));
  const foto = await pag.screenshot({ clip: { x: 0, y: 0, width: lado, height: lado } });
  writeFileSync(archivo, foto);
  console.log(`  ${archivo}  ${lado}x${lado}  (isotipo al ${porcentaje}%)`);
}

await navegador.close();
console.log(
  "\niconos: listos. Miralos antes de publicar: un icono recortado se ve en el telefono.",
);
