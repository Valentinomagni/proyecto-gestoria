/**
 * ============================================================================
 *  LAS CLASES DE LOS CONTROLES. Un campo se dibuja igual en toda la app o no se dibuja.
 * ============================================================================
 *
 *  POR QUE EXISTE ESTE ARCHIVO. La misma cadena de clases estaba copiada en DIEZ lugares de
 *  seis archivos, y ademas con tres constantes distintas llamadas `INPUT` en tres archivos
 *  distintos. Es exactamente la falla que el Tablero Contable dejo escrita: la escala
 *  tipografica vivia en un archivo y el color en otro, sin nada que los conectara, y aparecieron
 *  dos funciones exportadas con la misma firma y comportamiento distinto.
 *
 *  Con la clase copiada, cualquier arreglo hay que hacerlo diez veces. El que se hace nueve
 *  veces es peor que el que no se hace: deja la app con dos aspectos y nadie sabe cual es el
 *  bueno.
 *
 *  ============================================================================
 *   POR QUE `min-h-11`, QUE SON 44 PIXELES
 *  ============================================================================
 *
 *  Se midio en un telefono de 375 px: en el formulario de alta habia ONCE controles de menos de
 *  40 px de alto. 44 px es el minimo que recomienda Apple y 48 dp el de Android; abajo de eso
 *  el dedo erra y hay que reintentar.
 *
 *  Y acá el minuto importa de verdad: el alta entera tiene que entrar en menos de veinte
 *  segundos o vuelve el cuaderno. Un campo que hay que tocar dos veces se come ese presupuesto
 *  sin que nadie pueda explicar por que el sistema "es lento".
 *
 *  ============================================================================
 *   POR QUE `text-base` Y NO `text-sm` EN LOS QUE SE ESCRIBEN
 *  ============================================================================
 *
 *  Safari en iPhone HACE ZOOM SOLO cuando se toca un campo de texto de menos de 16 px, y
 *  despues no vuelve. La pantalla queda corrida y hay que pellizcar para volver, con una mano
 *  sola, parada. No es un detalle estetico: es la diferencia entre que el formulario se pueda
 *  usar en el registro o no.
 */

/** Un campo de texto o un select que ocupa todo el ancho. */
export const CAMPO =
  "w-full min-h-11 rounded-md border border-line bg-surface2 px-3 py-2 text-base sm:text-sm";

/** Un campo que NO ocupa todo el ancho: filtros, selects al lado de otra cosa. */
export const CAMPO_SUELTO =
  "min-h-11 rounded-md border border-line bg-surface2 px-3 py-2 text-base sm:text-sm";

/**
 * La caja de un campo que lleva ALGO MAS adentro: una lupa, un signo.
 *
 * VA APARTE Y NO ES `CAMPO` CON UN ICONO ENCIMA. Se midió: con el relleno vertical de `CAMPO`,
 * al input le quedaban 26 px de los 44 de la caja, así que tocar arriba o abajo del renglón no
 * abría el teclado. Acá el relleno es sólo horizontal y el de adentro se estira a todo el alto,
 * con `items-stretch`: toda la caja es el campo.
 */
export const CAMPO_CON_ICONO =
  "flex w-full min-h-11 items-stretch gap-2 rounded-md border border-line bg-surface2 px-3";

/** Lo que va adentro de `CAMPO_CON_ICONO`. Sin borde propio: el borde lo pone la caja. */
export const CAMPO_ADENTRO = "w-full bg-transparent text-base outline-none sm:text-sm";

/**
 * El botón de la acción principal de la pantalla. Uno solo por pantalla.
 *
 * Trae el `flex` adentro porque TODOS llevan ícono y texto: dejarlo afuera obliga a repetir
 * `flex items-center gap-2` en cada uno, que es exactamente como empezó la copia que este
 * archivo vino a terminar.
 */
export const BOTON =
  "flex w-fit min-h-11 items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 " +
  "text-sm text-accent-ink disabled:opacity-50";

/** El mismo, ocupando todo el ancho: el de un formulario que es toda la pantalla. */
export const BOTON_ANCHO =
  "flex w-full min-h-11 items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 " +
  "text-sm text-accent-ink disabled:opacity-50";

/** El botón de una acción secundaria. */
export const BOTON_SUAVE =
  "flex w-fit min-h-11 items-center justify-center gap-2 rounded-md border border-line px-3 " +
  "py-2 text-sm disabled:opacity-40";
