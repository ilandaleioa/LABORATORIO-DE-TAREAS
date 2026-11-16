import { renderToStaticMarkup } from 'react-dom/server'
import Icon from '../components/Icons'
import type { ResultadoAsistente } from '../types'

export interface DatosInforme {
  nombre: string
  categoria?: string | null
  imagenUrl: string
  descripcion: string
  resultado: ResultadoAsistente
}

const TIPOS: Record<string, string> = { tactico: 'Táctico', tecnico: 'Técnico', fisico: 'Físico', psicologico: 'Psicológico' }
const COLORES: Record<string, string> = {
  rojo: '#dc2626', azul: '#2563eb', verde: '#16a34a', amarillo: '#facc15', naranja: '#f97316',
  blanco: '#ffffff', negro: '#171717', morado: '#9333ea', rosa: '#ec4899', gris: '#9ca3af',
}
const SECCIONES = ['NORMAS', 'VARIANTES', 'PUNTOS CLAVE']

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const ico = (n: string) => renderToStaticMarkup(<Icon name={n} className="ico" />)
const lista = (items?: string[]) => (items?.length ? `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : '')

function analizarDescripcion(texto: string) {
  const equipos: { n: string; txt: string; color: string }[] = []
  let comodines = 0
  let total = 0
  const colores: Record<string, string> = {}
  const normas: string[] = []
  const secciones: { titulo: string; items: string[] }[] = []
  const intro: string[] = []
  let objetivo = ''
  let actual: 'intro' | 'normas' | { titulo: string; items: string[] } = 'intro'
  for (const linea of texto.split('\n')) {
    const t = linea.trim()
    if (!t) continue
    const c = t.match(/^Color equipo ([AB]):\s*(.+)$/i)
    if (c) { colores[c[1].toUpperCase()] = c[2].trim().toLowerCase(); continue }
    const e = t.match(/^Equipo ([AB]):\s*(.+)$/i)
    if (e) {
      equipos.push({ n: e[1].toUpperCase(), txt: e[2], color: '' })
      total += Number(e[2].match(/(\d+)\s*jugador/i)?.[1] ?? 0)
      continue
    }
    const cm = t.match(/^Comodines:\s*(\d+)/i)
    if (cm) { comodines = Number(cm[1]); continue }
    if (SECCIONES.includes(t.toUpperCase()) && t === t.toUpperCase()) {
      if (t === 'NORMAS') actual = 'normas'
      else { const s = { titulo: t, items: [] as string[] }; secciones.push(s); actual = s }
      continue
    }
    const o = t.match(/^Objetivo:\s*(.*)$/i)
    if (o) { objetivo = o[1]; continue }
    const limpio = t.replace(/^[-•·*–]\s*/, '')
    if (actual === 'intro') intro.push(t)
    else if (actual === 'normas') normas.push(limpio)
    else actual.items.push(limpio)
  }
  equipos.forEach((q) => (q.color = colores[q.n] ?? ''))
  return { equipos, comodines, total: total + comodines, normas, secciones, intro, objetivo }
}

const punto = (c: string) => `<span class="dot" style="background:${COLORES[c] ?? (c || '#9ca3af')}"></span>`

function construir(d: DatosInforme) {
  const r = d.resultado
  const a = analizarDescripcion(d.descripcion)
  const origen = window.location.origin
  const fecha = new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })

  const leyenda = [
    ...a.equipos.map((q) => `<span>${punto(q.color)}<b>Equipo ${q.n}:</b> ${esc(q.txt)}</span>`),
    a.comodines ? `<span>${punto('amarillo')}<b>Comodines:</b> ${a.comodines}</span>` : '',
  ].join('')

  const jugadores = a.equipos.length
    ? `<section class="card jug"><div class="jt">${ico('users')}<p>Jugadores y dimensiones</p></div><div><p class="tot">${a.total} en total</p>${a.equipos
        .map((q) => `<p class="sm">${punto(q.color)}Equipo ${q.n}${q.color ? ` (${q.color})` : ''}: ${esc(q.txt)}</p>`)
        .join('')}${a.comodines ? `<p class="sm">${punto('amarillo')}${a.comodines} comodín${a.comodines > 1 ? 'es' : ''}</p>` : ''}</div></section>`
    : ''

  const normas = a.normas.length
    ? `<section class="card"><h3 class="ntit">${ico('calendar')} Normas</h3>${lista(a.normas)}</section>`
    : ''

  const secciones = a.secciones
    .filter((s) => s.items.length)
    .map((s) => `<h3 class="sec">${esc(s.titulo)}</h3>${lista(s.items)}`)
    .join('')

  const objetivos = r.objetivos.filter((o) => o.tipo !== 'fisico')
  const fisico = r.objetivos.filter((o) => o.tipo === 'fisico')
  const tarjeta = (o: (typeof r.objetivos)[number]) =>
    `<div class="obj"><span class="oi">${ico(o.tipo)}</span><div><small>${esc(TIPOS[o.tipo] ?? o.tipo)}</small><b>${esc(o.objetivo)}</b><p>${esc(o.explicacion)}</p></div></div>`

  const cons = r.consignas
  const consHtml =
    cons && (cons.conBalon.length || cons.sinBalon.length)
      ? `<div class="g2">${[['Con balón', cons.conBalon, 'ball'], ['Sin balón', cons.sinBalon, 'shield']]
          .map(([t, v, i]) => `<div class="cons"><h4>${ico(i as string)} Consignas - ${t}</h4>${lista(v as string[])}</div>`)
          .join('')}</div>`
      : ''

  const eqs = r.roles
    ? ([['Equipo rojo', r.roles.rojo, '#dc2626', '#fef2f2'], ['Equipo azul', r.roles.azul, '#2563eb', '#eff6ff'], ['Equipo naranja', r.roles.naranja, '#ea580c', '#fff7ed']] as [string, string[], string, string][])
        .filter(([, v]) => v.length)
        .map(([n, v, c, bg]) => `<div class="eq" style="border-color:${c}33;background:linear-gradient(135deg,${bg},#fff)"><h4 style="color:${c}">${ico('shirt')} ${n}</h4>${lista(v)}</div>`)
        .join('')
    : ''

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Informe - ${esc(d.nombre)}</title>
<style>
@font-face{font-family:'DIN PRO';font-weight:400;src:url('${origen}/brand/fonts/DINPro.woff2') format('woff2')}
@font-face{font-family:'DIN PRO';font-weight:700;src:url('${origen}/brand/fonts/DINPro-Bold.woff2') format('woff2')}
*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{margin:0;font-family:'DIN PRO',Arial,sans-serif;color:#1b2026;background:#f5f5f5;font-size:11.5px;line-height:1.4}
.page{max-width:1000px;margin:0 auto;background:#f5f5f5}
.top{background:#d3291e;height:10px}
.nav{background:#fff;display:flex;align-items:center;justify-content:space-between;padding:10px 22px;border-bottom:1px solid #e5e5e5}
.nav img{height:34px}.nav b{font-size:15px}.nav span{font-size:11px;color:#666}
.main{padding:16px 22px}
.cols{display:grid;grid-template-columns:.78fr 1fr;gap:14px;align-items:start}
.card{background:#fff;border-radius:14px;box-shadow:0 1px 4px rgba(0,0,0,.12);padding:12px 14px;margin-bottom:12px}
.left img{width:100%;border-radius:14px;background:#fff;padding:5px;box-shadow:0 1px 4px rgba(0,0,0,.12);margin-bottom:12px;display:block}
.ico{width:16px;height:16px;flex-shrink:0}
.jug{display:flex;gap:14px;align-items:center}.jt{display:flex;gap:8px;align-items:center;color:#d3291e;width:100px;flex-shrink:0}
.jt .ico{width:28px;height:28px}.jt p{margin:0;font-size:10px;font-weight:700;text-transform:uppercase;line-height:1.2}
.tot{font-size:18px;font-weight:700;margin:0 0 2px}.sm{margin:0;font-size:11px;color:#444;display:flex;align-items:center;gap:6px}
.dot{display:inline-block;width:10px;height:10px;border-radius:50%;flex-shrink:0;box-shadow:0 0 0 2px #fff,0 0 0 3px #ddd}
.ntit{margin:0 0 6px;color:#d3291e;text-transform:uppercase;font-size:13px;display:flex;gap:6px;align-items:center}
ul{margin:0;padding:0;list-style:none}li{position:relative;padding-left:12px;margin-bottom:3px;color:#374151}
li:before{content:'';position:absolute;left:1px;top:6px;width:4px;height:4px;border-radius:50%;background:#d3291e}
h1{margin:0;font-size:26px;line-height:1.1}.right{padding:16px 18px}
.chip{display:inline-block;margin:8px 0;background:#fdeceb;color:#d3291e;font-weight:700;border-radius:99px;padding:2px 10px;font-size:11px}
.ley{display:flex;flex-wrap:wrap;gap:6px 16px;background:#f3f4f6;border-radius:8px;padding:8px 12px;font-size:10.5px;margin-bottom:10px}
.ley span{display:flex;align-items:center;gap:6px}
.sec{margin:10px 0 4px;color:#d3291e;font-size:12px;letter-spacing:.06em;border-left:3px solid #d3291e;padding-left:7px;text-transform:uppercase}
.right p{margin:0 0 5px;color:#374151}
.objbar{display:flex;gap:8px;align-items:flex-start;background:#fdeceb;border-radius:8px;padding:8px 12px;margin:8px 0}
.objbar .ico{color:#d3291e;margin-top:1px}.objbar b{color:#d3291e;text-transform:uppercase}
.fecha{border-top:1px solid #eee;padding-top:8px;margin-top:10px;color:#9ca3af;font-size:10px;display:flex;gap:6px;align-items:center}
.asis{background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.12);margin-top:6px}
.obj,.cons,.eq,.res,.prin,.fis,.card{break-inside:avoid}
.ah{background:#d3291e;color:#fff;padding:10px 18px;font-size:19px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;display:flex;gap:10px;align-items:center}
.ah .ico{width:22px;height:22px}.ab{padding:14px 18px;display:grid;gap:10px}
.res{display:flex;gap:12px;align-items:center;background:#f3f4f6;border-radius:12px;padding:10px 14px;color:#444}
.res .ico{width:30px;height:30px;color:#d3291e}
.prin{background:#fdeceb;border-radius:8px;padding:8px 14px;display:flex;gap:8px;align-items:center;color:#444}.prin b{color:#d3291e}.prin .ico{color:#d3291e}
.g2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.obj{border:1px solid #e5e7eb;border-radius:12px;padding:10px 12px;display:flex;gap:10px;box-shadow:0 1px 3px rgba(0,0,0,.08)}
.oi{background:#fdeceb;color:#d3291e;border-radius:10px;width:36px;height:36px;display:flex;align-items:center;justify-content:center;flex-shrink:0}.oi .ico{width:20px;height:20px}
.obj small{display:block;color:#d3291e;text-transform:uppercase;font-weight:700;font-size:9px}.obj b{font-size:13px;display:block;margin:1px 0 2px}.obj p{margin:0;color:#555;font-size:10.5px}
.fis{background:#fdeceb;border-radius:12px;padding:8px 14px;display:flex;gap:12px;align-items:center;font-size:10.5px;color:#444}
.fis .oi{background:none}.fis>div{display:flex;gap:12px;align-items:center}
.cons{border:1px solid #e5e7eb;border-left:3px solid #d3291e;border-radius:12px;padding:10px 12px}
.cons h4,.eq h4{margin:0 0 6px;font-size:11px;text-transform:uppercase;display:flex;gap:6px;align-items:center}.cons h4{color:#d3291e}
.rt{margin:4px 0 -4px;font-size:13px;font-weight:700;text-transform:uppercase;display:flex;gap:6px;align-items:center}
.g3{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.eq{border:1px solid;border-radius:12px;padding:10px 12px}
@media print{body{background:#fff}@page{size:A4;margin:8mm}.page{max-width:none}}
</style></head><body><div class="page"><div class="top"></div>
<div class="nav"><img src="${origen}/brand/logos/logo-acfc-black-transparency.png" alt="AC Football Center"><b>Laboratorio de Tareas</b><span>${fecha}</span></div>
<div class="main"><div class="cols">
<div class="left">${d.imagenUrl ? `<img src="${esc(d.imagenUrl)}" alt="">` : ''}${jugadores}${normas}</div>
<div class="card right"><h1>${esc(d.nombre)}</h1>${d.categoria ? `<span class="chip">${esc(d.categoria)}</span>` : ''}
${leyenda ? `<div class="ley">${leyenda}</div>` : ''}
${a.intro.length ? `<h3 class="sec">Descripción</h3><p>${esc(a.intro.join(' '))}</p>` : ''}
${a.objetivo ? `<div class="objbar">${ico('target')}<span><b>Objetivo:</b> ${esc(a.objetivo)}</span></div>` : ''}
${secciones}
<p class="fecha">${ico('calendar')} Informe generado el ${fecha}</p></div></div>
<section class="asis"><div class="ah">${ico('sparkles')} Asistente</div><div class="ab">
<div class="res">${ico('bot')}<span>${esc(r.resumen)}</span></div>
<div class="prin">${ico('target')}<span><b>Objetivo principal:</b> ${esc(r.principal)}</span></div>
<div class="g2">${objetivos.map(tarjeta).join('')}</div>
${fisico.map((o) => `<div class="fis"><span class="oi">${ico('fisico')}</span><div><div><small style="color:#d3291e;text-transform:uppercase;font-weight:700;font-size:9px;display:block">Físico</small><b style="font-size:13px">${esc(o.objetivo)}</b></div><span>${esc(o.explicacion)}</span></div></div>`).join('')}
${consHtml}
${eqs ? `<div class="rt">${ico('users')} Rol de los jugadores</div><div class="g3">${eqs}</div>` : ''}
</div></section></div></div>
<script>window.addEventListener('load',()=>setTimeout(()=>window.print(),700))</script></body></html>`
}

/** Abre el informe en una pestaña nueva listo para imprimir o guardar como PDF */
export function crearInforme(d: DatosInforme) {
  const w = window.open('', '_blank')
  if (!w) {
    alert('El navegador ha bloqueado la ventana del informe. Permite las ventanas emergentes e inténtalo de nuevo.')
    return
  }
  w.document.open()
  w.document.write(construir(d))
  w.document.close()
}
