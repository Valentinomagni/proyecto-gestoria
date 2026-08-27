---
name: marca-grupo-paris
description: La marca de Grupo Paris — isotipo, tipografía Inter, escala de nueve pasos, y la gama teal de la Tarjeta Habitualista. Usar al tocar diseño, color o tipografía.
---

# La marca


Manual completo: `tablero-contable-v2/docs/marca/IDENTIDAD-MARCA.md`. Lo mínimo:

- **Isotipo y lockup**: los archivos reales de `tablero-contable-v2/public/brand/`. Es el logo de
  Grupo Paris vectorizado con potrace desde el original, no un ícono genérico ni una
  interpretación. **Se copia, no se redibuja.** Cuando el pedido es "que sea igual", se calca:
  medido en el Estudio Magni, el redibujo daba 15,40 de diferencia y el calco 3,61.
- Blanco sobre fondos oscuros, negro sobre claros. Nunca coloreado, deformado ni con sombra.
- **Tipografía:** Inter Variable, local, sin CDN. Escala de nueve pasos, `text-2xs` a `text-4xl`.
  Nunca un tamaño a mano.
- **Color:** monocromo. El color aparece **sólo** en estados: `--done`, `--warn`, `--danger`.
  En un sistema donde lo que importa es si algo vence o si falta plata, un color "de marca" en un
  botón compite con la única señal que importa.
- **Números:** todos con `.tnum`, o las columnas bailan.
- **La trampa que costó cinco pantallas sin sombra durante meses:** `--ring` es un **color**,
  `--ring-sh` es una **sombra**. `box-shadow: var(--ring), var(--shadow)` es CSS inválido y el
  navegador **descarta la declaración entera, en silencio**.

---


## El color, enmendado el 26/08/2026

La regla original decía monocromo, con color sólo en estados. **Se enmendó a pedido:** la gama de
la Tarjeta Habitualista entra en el **marco** —la tira de arriba, la de migas— **y en un solo
acento**. El contenido sigue monocromo.

Lo que no cambió y no cambia: **un número nunca es del color de la marca.** Cuando todo es teal,
el rojo de "falta plata" deja de gritar, y ese grito es la razón de ser del sistema.

Los valores exactos se eligen midiendo contraste, en claro y en oscuro, no a ojo.
