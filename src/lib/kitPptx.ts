import type { JugadorSesion } from '../types'
import type { TareaInforme } from './informeSesion'

// Fichas ACFC en PowerPoint editable, generadas en el navegador (sin servidor).
// Línea visual: rojo ACFC, tinta, DIN Pro (con Arial de respaldo), A4 vertical.

const ROJO = 'D3291E'
const GRIS = 'A0A6AD'
const LINEA = '3A424C'
const FONDO = '1B2026'
const NEGRO = '0B0D10'
const TEXTO = 'FFFFFF'
const FUENTE = 'DIN Pro'
const W = 8.27
const H = 11.69
const M = 0.45

type Pptx = import('pptxgenjs').default
type Slide = ReturnType<Pptx['addSlide']>

async function nuevo(titulo: string): Promise<Pptx> {
  const mod = await import('pptxgenjs')
  const P = mod.default
  const p = new P()
  p.defineLayout({ name: 'A4V', width: W, height: H })
  p.layout = 'A4V'
  p.title = titulo
  p.author = 'AC Football Center'
  return p
}

function dimensiones(src: string): Promise<{ w: number; h: number }> {
  return new Promise((res) => {
    const img = new Image()
    img.onload = () => res({ w: img.naturalWidth || 4, h: img.naturalHeight || 3 })
    img.onerror = () => res({ w: 4, h: 3 })
    img.src = src
  })
}

/** Coloca la imagen dentro del recuadro sin deformarla. */
async function imagen(s: Slide, src: string | undefined, x: number, y: number, w: number, h: number) {
  s.addShape('rect', { x, y, w, h, fill: { color: 'FFFFFF' }, line: { color: LINEA, width: 0.75 } })
  if (!src) return
  const d = await dimensiones(src)
  const r = Math.min(w / d.w, h / d.h)
  const iw = d.w * r
  const ih = d.h * r
  s.addImage({ data: src, x: x + (w - iw) / 2, y: y + (h - ih) / 2, w: iw, h: ih })
}

function cabecera(s: Slide, titulo: string, sub: string, pagina?: string) {
  s.background = { color: NEGRO }
  s.addShape('rect', { x: 0, y: 0, w: W, h: 0.95, fill: { color: FONDO }, line: { color: FONDO, width: 0 } })
  s.addShape('rect', { x: 0, y: 0.95, w: W, h: 0.07, fill: { color: ROJO }, line: { color: ROJO, width: 0 } })
  s.addText('AC FOOTBALL CENTER', { x: M, y: 0.18, w: 4.5, h: 0.25, fontFace: FUENTE, fontSize: 9, bold: true, color: 'FFFFFF', charSpacing: 3 })
  s.addText(titulo, { x: M, y: 0.42, w: W - 2 * M - 1, h: 0.45, fontFace: FUENTE, fontSize: 20, bold: true, color: 'FFFFFF', fit: 'shrink' })
  s.addText(sub, { x: W - M - 3, y: 0.18, w: 3, h: 0.25, fontFace: FUENTE, fontSize: 9, color: 'FFFFFF', align: 'right' })
  s.addShape('rect', { x: 0, y: H - 0.4, w: W, h: 0.4, fill: { color: FONDO }, line: { color: FONDO, width: 0 } })
  s.addText('Athletic Club Football Center · Laboratorio de Tareas', { x: M, y: H - 0.36, w: 5, h: 0.3, fontFace: FUENTE, fontSize: 8, color: GRIS })
  if (pagina) s.addText(pagina, { x: W - M - 1, y: H - 0.36, w: 1, h: 0.3, fontFace: FUENTE, fontSize: 8, color: GRIS, align: 'right' })
}

function casilla(s: Slide, k: string, v: string, x: number, y: number, w: number) {
  s.addShape('rect', { x, y, w, h: 0.55, fill: { color: FONDO }, line: { color: LINEA, width: 0.5 } })
  s.addText(k.toUpperCase(), { x: x + 0.08, y: y + 0.03, w: w - 0.16, h: 0.2, fontFace: FUENTE, fontSize: 7, bold: true, color: GRIS, charSpacing: 1 })
  s.addText(v || '—', { x: x + 0.08, y: y + 0.23, w: w - 0.16, h: 0.28, fontFace: FUENTE, fontSize: 11, bold: true, color: TEXTO, fit: 'shrink' })
}

function bloque(s: Slide, titulo: string, txt: string, x: number, y: number, w: number, h: number, tam = 9.5) {
  s.addShape('rect', { x, y, w: 0.05, h: 0.26, fill: { color: ROJO }, line: { color: ROJO, width: 0 } })
  s.addText(titulo.toUpperCase(), { x: x + 0.12, y, w: w - 0.12, h: 0.26, fontFace: FUENTE, fontSize: 9, bold: true, color: TEXTO, charSpacing: 1.5 })
  s.addText(txt.trim() || '—', {
    x, y: y + 0.3, w, h: h - 0.3, fontFace: FUENTE, fontSize: tam, color: txt.trim() ? TEXTO : GRIS,
    valign: 'top', fit: 'shrink', paraSpaceAfter: 3,
  })
}

const nombreArchivo = (s: string) => s.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'ficha'

function dimTxt(t: { largo?: number; ancho?: number }) {
  return t.largo && t.ancho ? `${t.ancho} × ${t.largo} m` : ''
}

async function fichaTarea(s: Slide, t: TareaInforme, pagina?: string, subCab?: string) {
  cabecera(s, `${t.numero ? t.numero + '. ' : ''}${t.nombre}`, subCab ?? 'FICHA DE TAREA', pagina)
  const gap = 0.12
  const cw = (W - 2 * M - 3 * gap) / 4
  const y0 = 1.25
  casilla(s, 'Tipo', t.tipo ?? '', M, y0, cw)
  casilla(s, 'Duración', t.duracion ? `${t.duracion} min` : '', M + (cw + gap), y0, cw)
  casilla(s, 'Dimensiones', dimTxt(t), M + 2 * (cw + gap), y0, cw)
  const series = t.series ? `${t.series}${t.tSerie ? ` × ${t.tSerie} min` : ''}${t.descanso ? ` · desc. ${t.descanso}"` : ''}` : ''
  casilla(s, 'Series', series, M + 3 * (cw + gap), y0, cw)

  await imagen(s, t.imagenUrl, M, 1.95, W - 2 * M, 4.1)

  const half = (W - 2 * M - 0.25) / 2
  bloque(s, 'Descripción', t.descripcion, M, 6.25, W - 2 * M, 1.5)
  bloque(s, 'Normas', t.normas, M, 7.85, half, 1.75)
  bloque(s, 'Puntos clave', t.claves, M + half + 0.25, 7.85, half, 1.75)
  bloque(s, 'Variantes', t.variantes, M, 9.7, W - 2 * M, 1.5)
}

export async function descargarFichaTarea(t: TareaInforme) {
  const p = await nuevo(t.nombre)
  await fichaTarea(p.addSlide(), t)
  await p.writeFile({ fileName: `ACFC - Tarea - ${nombreArchivo(t.nombre)}.pptx` })
}

export interface DatosSesionPptx {
  numero: string
  equipo: string
  fecha: string
  hora?: string
  ubicacion?: string
  asisten: JugadorSesion[]
  ausentes: JugadorSesion[]
  tareas: TareaInforme[]
}

/** Ficha de sesión (portada con estructura) + una ficha de tarea por ejercicio. */
export async function descargarFichaSesion(d: DatosSesionPptx) {
  const titulo = `Sesión ${d.numero || ''} ${d.equipo || ''}`.trim()
  const p = await nuevo(titulo)
  const s = p.addSlide()
  const fecha = d.fecha
    ? new Date(d.fecha + 'T12:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : 'Sin fecha'
  cabecera(s, titulo, 'FICHA DE SESIÓN', `1 / ${d.tareas.length + 1}`)

  const gap = 0.12
  const cw = (W - 2 * M - 3 * gap) / 4
  const total = d.tareas.reduce((a, t) => a + (t.duracion ?? 0), 0)
  casilla(s, 'Fecha', fecha, M, 1.25, cw)
  casilla(s, 'Hora', d.hora ?? '', M + (cw + gap), 1.25, cw)
  casilla(s, 'Lugar', d.ubicacion ?? '', M + 2 * (cw + gap), 1.25, cw)
  casilla(s, 'Duración', total ? `${total} min` : '', M + 3 * (cw + gap), 1.25, cw)

  // Estructura: barra proporcional a los minutos
  s.addText('ESTRUCTURA DE LA SESIÓN', { x: M, y: 2.0, w: 5, h: 0.26, fontFace: FUENTE, fontSize: 9, bold: true, color: TEXTO, charSpacing: 1.5 })
  const bw = W - 2 * M
  const n = d.tareas.length
  let x = M
  d.tareas.forEach((t, i) => {
    const w = total ? (bw * (t.duracion ?? 0)) / total : bw / n
    if (w <= 0) return
    s.addShape('rect', { x, y: 2.35, w, h: 0.5, fill: { color: i % 2 ? '3A424C' : ROJO }, line: { color: NEGRO, width: 1 } })
    s.addText(`${t.numero}${t.duracion ? ` · ${t.duracion}'` : ''}`, { x, y: 2.35, w, h: 0.5, fontFace: FUENTE, fontSize: 10, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle', fit: 'shrink' })
    x += w
  })

  // Tareas: cuadrícula 2×2 con dibujo
  const colW = (bw - 0.2) / 2
  const rowH = 2.7
  for (let i = 0; i < Math.min(n, 4); i++) {
    const t = d.tareas[i]
    const cx = M + (i % 2) * (colW + 0.2)
    const cy = 3.15 + Math.floor(i / 2) * (rowH + 0.15)
    s.addText(`${t.numero}. ${t.nombre}`, { x: cx, y: cy, w: colW, h: 0.3, fontFace: FUENTE, fontSize: 10.5, bold: true, color: TEXTO, fit: 'shrink' })
    s.addText([t.tipo, t.duracion ? `${t.duracion} min` : '', dimTxt(t)].filter(Boolean).join(' · '), { x: cx, y: cy + 0.3, w: colW, h: 0.22, fontFace: FUENTE, fontSize: 8, color: GRIS })
    await imagen(s, t.imagenUrl, cx, cy + 0.55, colW, rowH - 0.55)
  }

  // Jugadores
  const ys = 3.15 + 2 * (rowH + 0.15) + 0.05
  const nombres = d.asisten.map((j) => `${j.dorsal ? j.dorsal + ' ' : ''}${j.nombre}`).join(' · ')
  bloque(s, `Asisten (${d.asisten.length})`, nombres, M, ys, W - 2 * M - 2.2, H - 0.5 - ys, 8.5)
  bloque(s, `Ausentes (${d.ausentes.length})`, d.ausentes.map((j) => `${j.nombre}${j.motivo ? ` (${j.motivo})` : ''}`).join(' · '), W - M - 2.0, ys, 2.0, H - 0.5 - ys, 8.5)

  for (let i = 0; i < d.tareas.length; i++) {
    await fichaTarea(p.addSlide(), d.tareas[i], `${i + 2} / ${d.tareas.length + 1}`, `SESIÓN ${d.numero || ''} · FICHA DE TAREA`.trim())
  }
  await p.writeFile({ fileName: `ACFC - Sesión - ${nombreArchivo(titulo)}.pptx` })
}
