# Diseño AC Football Center (fuente: https://acfootballcenter.eus/)

## Estructura
- `public/brand/logos/` — logo negro (PNG transparente), logo blanco (SVG), favicons ACFC (webp 32/180/192) y favicon campus.
- `public/brand/fonts/` — DIN Pro Regular y Bold (woff2 + woff). `Akrobat-Bold.svg` es un SVG del rótulo de la web (no es fuente instalable).
- `public/brand/imagenes/` — hero, imagen social y textura de footer.
- `public/brand/referencia-css/` — CSS original del tema hijo, del menú y del dashboard, y el HTML de la home, solo como referencia.
- `src/acfc-brand.css` — @font-face + variables CSS + estilo de botón de la web.

## Paleta
| Token | Color | Uso |
|---|---|---|
| rojo | #d3291e | acento / CTA |
| rojo oscuro | #b6170d | hover |
| tinta | #1b2026 | títulos, texto, borde botón |
| pizarra | #353c45 | |
| negro | #202020 | |
| gris | #707070 | texto secundario |
| línea | #c4c4c4 | bordes |
| fondo | #f8f8f8 | fondo |
| blanco | #ffffff | |

## Tipografía
DIN PRO (400 y 700) para cuerpo, títulos y menú; fallback Helvetica. Botones: 1.2em, `text-transform: capitalize`, radio 0, borde 2px.

## Cómo activarlo en la app
1. En `src/main.tsx`: `import './acfc-brand.css'`.
2. En `tailwind.config.js`: `colors.athletic = { DEFAULT:'#d3291e', dark:'#b6170d', light:'#fde8ec' }` y `fontFamily.sans = ['DIN PRO','Helvetica','Arial','sans-serif']`.
