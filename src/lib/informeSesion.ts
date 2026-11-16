import type { JugadorSesion, Peto, ResultadoAsistente } from '../types'

export interface TareaInforme {
  numero: number
  nombre: string
  tipo?: string
  duracion?: number
  imagenUrl?: string
  largo?: number
  ancho?: number
  series?: number
  tSerie?: number
  descanso?: number
  descripcion: string
  normas: string
  variantes: string
  claves: string
  petos: { nombre: string; peto: Peto }[]
  /** Análisis del asistente; solo se incluye en el informe con asistente */
  asistente?: ResultadoAsistente | null
}

export interface DatosInformeSesion {
  numero: string
  equipo: string
  fecha: string
  hora?: string
  ubicacion?: string
  asisten: JugadorSesion[]
  ausentes: JugadorSesion[]
  tareas: TareaInforme[]
  conAsistente?: boolean
}

const PETO_COLOR: Record<string, string> = { R: '#dc2626', A: '#2563eb', N: '#f97316', V: '#059669' }
const PETO_NOMBRE: Record<string, string> = { R: 'Rojo', A: 'Azul', N: 'Naranja', V: 'Verde' }

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const parrafos = (s: string) => esc(s).replace(/\n/g, '<br>')

const TIPOS_OBJ: Record<string, string> = { tactico: 'Táctico', tecnico: 'Técnico', fisico: 'Físico', psicologico: 'Psicológico' }
const lista = (items: string[]) => `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`

function bloqueAsistente(r: ResultadoAsistente) {
  const objs = r.objetivos
    .map((o) => `<div class="obj"><small>${esc(TIPOS_OBJ[o.tipo] ?? o.tipo)}</small><b>${esc(o.objetivo)}</b><p>${esc(o.explicacion)}</p></div>`)
    .join('')
  const c = r.consignas
  const cons =
    c && (c.conBalon.length || c.sinBalon.length)
      ? `<div class="g2">${([['Con balón', c.conBalon], ['Sin balón', c.sinBalon]] as [string, string[]][])
          .filter(([, v]) => v.length)
          .map(([t, v]) => `<div class="cons"><h5>Consignas - ${t}</h5>${lista(v)}</div>`)
          .join('')}</div>`
      : ''
  const rl = r.roles
  const roles = rl
    ? ([['Equipo rojo', rl.rojo, '#dc2626'], ['Equipo azul', rl.azul, '#2563eb'], ['Equipo naranja', rl.naranja, '#ea580c']] as [string, string[], string][])
        .filter(([, v]) => v.length)
        .map(([n, v, col]) => `<div class="eq" style="border-color:${col}55"><h5 style="color:${col}">${n}</h5>${lista(v)}</div>`)
        .join('')
    : ''
  return `<div class="asis-t"><div class="ah">✦ Asistente</div><div class="ab">
${r.resumen ? `<div class="res">${esc(r.resumen)}</div>` : ''}
${r.principal ? `<div class="prin"><b>Objetivo principal:</b> ${esc(r.principal)}</div>` : ''}
${objs ? `<div class="g2">${objs}</div>` : ''}${cons}
${roles ? `<h5 class="rt">Rol de los jugadores</h5><div class="g3">${roles}</div>` : ''}
</div></div>`
}

function construir(d: DatosInformeSesion) {
  const origen = window.location.origin
  const fechaTxt = d.fecha
    ? new Date(d.fecha + 'T12:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : 'Sin fecha'

  const dato = (k: string, v?: string | number) => (v !== undefined && v !== '' ? `<div class="dato"><small>${k}</small><b>${esc(String(v))}</b></div>` : '')

  const bloque = (titulo: string, txt: string) => (txt.trim() ? `<div class="bl"><h4>${titulo}</h4><p>${parrafos(txt.trim())}</p></div>` : '')

  const tareas = d.tareas
    .map((t, i) => {
      const medidas = [t.largo && t.ancho ? `${t.largo} × ${t.ancho} m` : t.largo ? `${t.largo} m` : '']
        .filter(Boolean)
        .join('')
      const carga = t.series || t.tSerie || t.descanso
        ? `${t.series ?? '–'} series × ${t.tSerie ?? '–'}′ · descanso ${t.descanso ?? '–'}′`
        : ''
      const petos = t.petos.filter((p) => p.peto !== '-')
      const grupos = Object.keys(PETO_COLOR)
        .map((k) => ({ k, js: petos.filter((p) => p.peto === k) }))
        .filter((g) => g.js.length)
        .map(
          (g) =>
            `<div class="pg"><span class="pd" style="background:${PETO_COLOR[g.k]}"></span><b>${PETO_NOMBRE[g.k]}:</b> ${g.js.map((j) => esc(j.nombre)).join(', ')}</div>`,
        )
        .join('')
      return `<section class="tarea${d.conAsistente || i % 2 === 1 ? ' salto' : ''}">
<header><span class="num">${t.numero}</span><h2>${esc(t.nombre)}</h2>${t.tipo ? `<span class="chip">${esc(t.tipo)}</span>` : ''}${
        t.duracion ? `<span class="dur">⏱ ${t.duracion} min</span>` : ''
      }</header>
<div class="cuerpo">
<div class="izq">${t.imagenUrl ? `<img src="${esc(t.imagenUrl)}" alt="">` : ''}
<div class="datos">${dato('Espacio', medidas)}${dato('Carga', carga)}</div>
${grupos ? `<div class="petos"><h4>Petos</h4>${grupos}</div>` : ''}</div>
<div class="der">${bloque('Descripción', t.descripcion)}${bloque('Normas', t.normas)}${bloque('Variantes', t.variantes)}${bloque('Puntos clave', t.claves)}</div>
</div>${d.conAsistente && t.asistente ? bloqueAsistente(t.asistente) : ''}</section>`
    })
    .join('')

  const ausentes = d.ausentes.length
    ? `<div class="aus"><b>Ausencias:</b> ${d.ausentes
        .map((j) => `${esc(j.nombre)} (${esc(j.motivo || 'sin motivo')})`)
        .join(' · ')}</div>`
    : ''

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Sesión ${esc(d.numero || '')} - ${esc(d.equipo || '')}</title>
<style>
@font-face{font-family:'DIN PRO';font-weight:400;src:url('${origen}/brand/fonts/DINPro.woff2') format('woff2')}
@font-face{font-family:'DIN PRO';font-weight:700;src:url('${origen}/brand/fonts/DINPro-Bold.woff2') format('woff2')}
*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{margin:0;font-family:'DIN PRO',Arial,sans-serif;color:#1b2026;background:#f5f5f5;font-size:11.5px;line-height:1.4}
.page{max-width:1000px;margin:0 auto}
.top{background:#d3291e;height:10px}
.nav{background:#fff;display:flex;align-items:center;justify-content:space-between;padding:5px 22px;border-bottom:1px solid #e5e5e5}
.nav img{height:24px}.nav b{font-size:15px}.nav span{font-size:11px;color:#666}
.main{padding:10px 22px}
.resumen{background:#fff;border-radius:10px;box-shadow:0 1px 4px rgba(0,0,0,.12);padding:6px 14px;margin-bottom:10px;display:flex;flex-wrap:wrap;align-items:center;gap:2px 18px}
h1{margin:0;font-size:15px;text-transform:uppercase}
.fila{display:flex;flex-wrap:wrap;gap:0 14px;font-size:10.5px;color:#444;text-transform:capitalize}
.dato small{display:block;color:#888;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.06em}.dato b{font-size:13px}
.asis{margin-top:10px;padding-top:10px;border-top:1px solid #eee;display:flex;gap:18px;flex-wrap:wrap}
.asis .k{font-size:18px;font-weight:700}.asis small{color:#888;font-size:9px;text-transform:uppercase;font-weight:700;display:block}
.aus{flex-basis:100%;background:#fdeceb;border-radius:6px;padding:2px 8px;font-size:10px}.aus h4{margin:0 0 4px;color:#d3291e;font-size:10px;text-transform:uppercase}.aus span{display:block}
.tarea{background:#fff;border-radius:14px;box-shadow:0 1px 4px rgba(0,0,0,.12);padding:12px 16px;margin-bottom:12px;break-inside:avoid}.salto{break-after:page}.izq img{max-height:230px;object-fit:contain}
.tarea header{display:flex;align-items:center;gap:10px;margin-bottom:10px;flex-wrap:wrap}
.num{width:26px;height:26px;border-radius:50%;background:#d3291e;color:#fff;font-weight:700;display:flex;align-items:center;justify-content:center;font-size:12px}
.tarea h2{margin:0;font-size:16px;text-transform:uppercase;flex:1}
.chip{background:#fdeceb;color:#d3291e;font-weight:700;border-radius:99px;padding:2px 10px;font-size:11px}
.dur{background:#f3f4f6;border-radius:99px;padding:2px 10px;font-weight:700}
.cuerpo{display:grid;grid-template-columns:.8fr 1.4fr;gap:16px;align-items:start}
.izq img{width:100%;border:1px solid #e5e7eb;border-radius:10px;padding:4px;background:#fff;display:block;margin-bottom:8px}
.datos{display:grid;gap:6px}
.petos{margin-top:8px;background:#f3f4f6;border-radius:8px;padding:8px 10px}.petos h4{margin:0 0 4px}
.pg{display:flex;align-items:center;gap:6px;margin-bottom:2px;font-size:10.5px}.pd{width:10px;height:10px;border-radius:50%;flex-shrink:0}
.bl{margin-bottom:8px}.bl h4,.petos h4{margin:0 0 2px;color:#d3291e;font-size:10.5px;letter-spacing:.06em;text-transform:uppercase}
.bl p{margin:0;color:#374151}
.asis-t{margin-top:10px;border-radius:10px;overflow:hidden;border:1px solid #e5e7eb}
.asis-t .ah{background:#d3291e;color:#fff;padding:5px 12px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em}
.asis-t .ab{padding:8px 12px;display:grid;gap:6px}
.asis-t .res{background:#f3f4f6;border-radius:8px;padding:6px 10px;color:#444;font-size:10.5px}
.asis-t .prin{background:#fdeceb;border-radius:8px;padding:5px 10px;font-size:10.5px}.asis-t .prin b{color:#d3291e}
.asis-t .g2{display:grid;grid-template-columns:1fr 1fr;gap:6px}.asis-t .g3{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
.asis-t .obj,.asis-t .cons,.asis-t .eq{border:1px solid #e5e7eb;border-radius:8px;padding:5px 9px;break-inside:avoid}
.asis-t .cons{border-left:3px solid #d3291e}
.asis-t .obj small{display:block;color:#d3291e;text-transform:uppercase;font-weight:700;font-size:8.5px}.asis-t .obj b{font-size:11.5px;display:block}.asis-t .obj p{margin:0;color:#555;font-size:10px}
.asis-t h5{margin:0 0 3px;font-size:10px;text-transform:uppercase;color:#d3291e}.asis-t .rt{margin-top:2px;color:#1b2026;font-size:11px}
.asis-t ul{margin:0;padding:0;list-style:none}.asis-t li{padding-left:10px;position:relative;font-size:10px;color:#374151;margin-bottom:1px}
.asis-t li:before{content:'';position:absolute;left:1px;top:5px;width:4px;height:4px;border-radius:50%;background:#d3291e}
.pie{color:#9ca3af;font-size:10px;text-align:right;margin-top:6px}
@media print{body{background:#fff}@page{size:A4;margin:8mm}.page{max-width:none}}
</style></head><body><div class="page"><div class="top"></div>
<div class="nav"><img src="${origen}/brand/logos/logo-acfc-black-transparency.png" alt="AC Football Center"><b>Laboratorio de Tareas</b><span>Informe de sesión</span></div>
<div class="main">
<section class="resumen"><h1>Sesión ${esc(d.numero || '–')}${d.equipo ? ` · ${esc(d.equipo)}` : ''}</h1>
<div class="fila">${[fechaTxt, d.hora, d.ubicacion].filter(Boolean).map((x) => `<span>${esc(String(x))}</span>`).join('')}</div>
${ausentes}</section>
${tareas}
<p class="pie">Informe generado el ${new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
</div></div>
<script>
(function(){var imgs=[].slice.call(document.images);var p=imgs.map(function(i){return i.complete?1:new Promise(function(r){i.onload=i.onerror=r})});
Promise.all(p).then(function(){setTimeout(function(){window.print()},500)})})()
</script></body></html>`
}

/** Abre el informe de la sesión en una pestaña nueva listo para imprimir o guardar como PDF */
export function crearInformeSesion(d: DatosInformeSesion) {
  const w = window.open('', '_blank')
  if (!w) {
    alert('El navegador ha bloqueado la ventana del informe. Permite las ventanas emergentes e inténtalo de nuevo.')
    return
  }
  w.document.open()
  w.document.write(construir(d))
  w.document.close()
}
