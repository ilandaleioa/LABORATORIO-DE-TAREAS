import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { consultarAsistente } from '../lib/api'
import { analisisLocal } from '../lib/asistenteLocal'
import { detectarJugadores, type Deteccion } from '../lib/imagenLocal'
import type { ObjetivoAsistente, ResultadoAsistente } from '../types'
import Spinner from './Spinner'
import Icon from './Icons'
import { crearInforme } from '../lib/informe'

const TIPOS: Record<string, string> = {
  tactico: 'Táctico',
  tecnico: 'Técnico',
  fisico: 'Físico',
  psicologico: 'Psicológico',
}

const EQUIPOS = [
  { k: 'rojo', nombre: 'rojo', caja: 'border-red-200 bg-gradient-to-br from-red-50 to-white', texto: 'text-red-700', punto: 'bg-red-600' },
  { k: 'azul', nombre: 'azul', caja: 'border-blue-200 bg-gradient-to-br from-blue-50 to-white', texto: 'text-blue-700', punto: 'bg-blue-600' },
  { k: 'naranja', nombre: 'naranja', caja: 'border-orange-200 bg-gradient-to-br from-orange-50 to-white', texto: 'text-orange-600', punto: 'bg-orange-500' },
] as const

interface Props {
  /** Devuelve la imagen lista para enviar (base64 JPEG). Null si aún no hay imagen. */
  obtenerImagen: () => Promise<{ base64: string; mediaType: string } | null>
  descripcion: string
  /** Descripción completa (jugadores, objetivo, normas, variantes, puntos clave) para el informe PDF; si falta se usa `descripcion` */
  descripcionInforme?: string
  /** Datos opcionales para el informe */
  nombre?: string
  categoria?: string | null
  imagenUrl?: string
  /** Si se indica, el análisis se guarda en "Tareas analizadas" */
  onAnalizado?: (r: ResultadoAsistente) => void
  /** Análisis ya guardado previamente */
  inicial?: ResultadoAsistente | null
  /** Si se indica, los botones de acción (informe, editar, reanalizar) se muestran ahí en vez de en la cabecera */
  destinoAcciones?: HTMLElement | null
}

/** Texto editable con el mismo aspecto que el texto mostrado; crece con el contenido. */
function Auto({ value, onChange, className = '', placeholder }: { value: string; onChange: (v: string) => void; className?: string; placeholder?: string }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [value])
  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={`block w-full min-w-0 resize-none overflow-hidden rounded bg-transparent p-0 outline-none ring-0 transition focus:bg-white/70 focus:ring-1 focus:ring-athletic/40 ${className}`}
    />
  )
}

export default function Asistente({ obtenerImagen, descripcion, descripcionInforme, nombre = 'Ejercicio', categoria, imagenUrl = '', onAnalizado, inicial = null, destinoAcciones = null }: Props) {
  const [resultado, setResultado] = useState<ResultadoAsistente | null>(inicial)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [borrador, setBorrador] = useState<ResultadoAsistente | null>(null)

  const [textoCons, setTextoCons] = useState({ conBalon: '', sinBalon: '' })
  const [textoRoles, setTextoRoles] = useState({ rojo: '', azul: '', naranja: '' })

  function editar() {
    if (!resultado) return
    setBorrador(structuredClone(resultado))
    setTextoRoles({
      rojo: (resultado.roles?.rojo ?? []).join('\n'),
      azul: (resultado.roles?.azul ?? []).join('\n'),
      naranja: (resultado.roles?.naranja ?? []).join('\n'),
    })
    setTextoCons({
      conBalon: (resultado.consignas?.conBalon ?? []).join('\n'),
      sinBalon: (resultado.consignas?.sinBalon ?? []).join('\n'),
    })
  }

  function guardarEdicion() {
    if (!borrador) return
    const limpio: ResultadoAsistente = {
      ...borrador,
      resumen: borrador.resumen.trim(),
      principal: borrador.principal.trim(),
      objetivos: borrador.objetivos.filter((o) => o.objetivo.trim() || o.explicacion.trim()),
      consignas: {
        conBalon: textoCons.conBalon.split('\n').map((s) => s.trim()).filter(Boolean),
        sinBalon: textoCons.sinBalon.split('\n').map((s) => s.trim()).filter(Boolean),
      },
      roles: {
        rojo: textoRoles.rojo.split('\n').map((s) => s.trim()).filter(Boolean),
        azul: textoRoles.azul.split('\n').map((s) => s.trim()).filter(Boolean),
        naranja: textoRoles.naranja.split('\n').map((s) => s.trim()).filter(Boolean),
      },
    }
    setResultado(limpio)
    setBorrador(null)
    guardarResultado(limpio)
  }

  /** Guarda el análisis; si falla (p. ej. almacenamiento lleno) lo avisa en pantalla. */
  function guardarResultado(r: ResultadoAsistente): boolean {
    try {
      onAnalizado?.(r)
      return true
    } catch (e) {
      setError(`No se pudo guardar como tarea analizada: ${(e as Error).message}`)
      return false
    }
  }

  function cambiarObjetivo(i: number, parche: Partial<ObjetivoAsistente>) {
    setBorrador((b) => b && { ...b, objetivos: b.objetivos.map((o, j) => (j === i ? { ...o, ...parche } : o)) })
  }

  async function analizar() {
    setError(null)
    setCargando(true)
    let img: { base64: string; mediaType: string } | null = null
    try {
      img = await obtenerImagen()
      if (!img) throw new Error('No hay imagen seleccionada.')
      const r = await consultarAsistente(img, descripcion)
      setResultado(r)
      guardarResultado(r)
    } catch (e) {
      // Respaldo sin IA: análisis de la imagen por color + análisis del texto
      let det: Deteccion | undefined
      if (img) {
        try {
          det = await detectarJugadores(img.base64, img.mediaType)
        } catch {
          /* se ignora: se analiza solo el texto */
        }
      }
      const r = analisisLocal(descripcion, det)
      setResultado(r)
      if (guardarResultado(r)) {
        setError(
          `No se pudo usar la IA (${(e as Error).message}) Se muestra un análisis básico ${det ? 'de la imagen y el texto' : 'basado solo en el texto'}.`,
        )
      }
    } finally {
      setCargando(false)
    }
  }

  const claseBoton = `inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-athletic transition hover:bg-athletic-light ${destinoAcciones ? 'bg-white ring-1 ring-athletic/40' : 'bg-white'}`
  const claseBotonCabecera = 'inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-athletic transition hover:bg-athletic-light'
  const visible = !!resultado && !cargando && !borrador
  const acciones =
    visible && resultado ? (
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => crearInforme({ nombre, categoria, imagenUrl, descripcion: descripcionInforme || descripcion, resultado })}
          className={claseBoton}
        >
          <Icon name="file" className="h-3.5 w-3.5" /> Crear informe
        </button>
        <button type="button" onClick={editar} className={claseBoton}>
          <Icon name="pencil" className="h-3.5 w-3.5" /> Editar
        </button>
      </div>
    ) : null
  const reanalizar = visible ? (
    <button
      type="button"
      onClick={() => {
        if (confirm('Volver a analizar sustituirá el análisis actual (incluidas tus ediciones). ¿Continuar?')) analizar()
      }}
      className={claseBotonCabecera}
    >
      <Icon name="play" className="h-3.5 w-3.5" /> Volver a analizar
    </button>
  ) : null

  return (
    <section className="overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-black/5">
      <div className="flex items-center justify-between gap-2 bg-athletic px-5 py-3 text-white">
        <h2 className="flex items-center gap-2.5 text-xl font-extrabold uppercase tracking-wide">
          <Icon name="sparkles" className="h-6 w-6" />
          Asistente
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {acciones && !destinoAcciones && acciones}
          {reanalizar}
        </div>
      </div>
      {acciones && destinoAcciones && createPortal(acciones, destinoAcciones)}
      <div className="space-y-4 p-4 md:p-5">

      {!resultado && !cargando && (
        <>
          <p className="text-sm text-neutral-600">
            La IA analiza el ejercicio y te explica qué objetivos se pueden cumplir con él.
          </p>
          <button type="button" onClick={analizar} className="btn-primary w-full">
            ✨ Analizar objetivos
          </button>
        </>
      )}

      {cargando && <Spinner texto="El asistente está analizando el ejercicio…" />}

      {error && (
        <p className="rounded-xl bg-amber-50 p-3 text-sm font-medium text-amber-900" role="alert">
          {error}
        </p>
      )}

      {borrador && !cargando && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-xl bg-neutral-100 px-4 py-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-athletic ring-1 ring-black/5">
              <Icon name="bot" className="h-6 w-6" />
            </span>
            <Auto
              className="text-[13px] leading-relaxed text-neutral-700"
              value={borrador.resumen}
              onChange={(v) => setBorrador({ ...borrador, resumen: v })}
            />
          </div>
          <div className="flex items-start gap-2.5 rounded-lg bg-athletic-light px-4 py-2.5 text-[13px] text-ink">
            <Icon name="target" className="mt-0.5 h-5 w-5 shrink-0 text-athletic" />
            <span className="shrink-0 font-extrabold text-athletic">Objetivo principal:</span>
            <Auto value={borrador.principal} onChange={(v) => setBorrador({ ...borrador, principal: v })} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {borrador.objetivos.map((o, i) => {
              const ultimoSuelto = borrador.objetivos.length % 2 === 1 && i === borrador.objetivos.length - 1 && i > 0
              const tipoSel = (
                <select
                  className="rounded bg-transparent text-[11px] font-extrabold uppercase tracking-wide text-athletic outline-none"
                  value={o.tipo}
                  onChange={(e) => cambiarObjetivo(i, { tipo: e.target.value as ObjetivoAsistente['tipo'] })}
                >
                  {Object.entries(TIPOS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              )
              const eliminar = (
                <button
                  type="button"
                  className="shrink-0 text-[11px] font-semibold text-red-700"
                  onClick={() => setBorrador({ ...borrador, objetivos: borrador.objetivos.filter((_, j) => j !== i) })}
                >
                  Eliminar
                </button>
              )
              return ultimoSuelto ? (
                <article key={i} className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-athletic-light px-4 py-3 sm:col-span-2">
                  <Icon name="refresh" className="h-6 w-6 shrink-0 text-athletic" />
                  <span className="shrink-0">
                    {tipoSel}
                    <Auto
                      className="text-sm font-extrabold leading-snug"
                      placeholder="Objetivo"
                      value={o.objetivo}
                      onChange={(v) => cambiarObjetivo(i, { objetivo: v })}
                    />
                  </span>
                  <span className="hidden h-8 w-px bg-athletic/20 sm:block" />
                  <Auto
                    className="min-w-0 flex-1 text-xs leading-relaxed text-neutral-700"
                    placeholder="Explicación"
                    value={o.explicacion}
                    onChange={(v) => cambiarObjetivo(i, { explicacion: v })}
                  />
                  {eliminar}
                </article>
              ) : (
                <article key={i} className="flex gap-3 rounded-xl border border-line bg-white p-3.5 shadow-card">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-athletic-light text-athletic">
                    <Icon name={o.tipo} className="h-6 w-6" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      {tipoSel}
                      {eliminar}
                    </div>
                    <Auto
                      className="text-sm font-extrabold leading-snug"
                      placeholder="Objetivo"
                      value={o.objetivo}
                      onChange={(v) => cambiarObjetivo(i, { objetivo: v })}
                    />
                    <Auto
                      className="mt-0.5 text-xs leading-relaxed text-neutral-700"
                      placeholder="Explicación"
                      value={o.explicacion}
                      onChange={(v) => cambiarObjetivo(i, { explicacion: v })}
                    />
                  </div>
                </article>
              )
            })}
          </div>

          <button
            type="button"
            className="link-action !text-sm"
            onClick={() =>
              setBorrador({ ...borrador, objetivos: [...borrador.objetivos, { tipo: 'tactico', objetivo: '', explicacion: '' }] })
            }
          >
            + Añadir objetivo
          </button>

          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ['Con balón', 'conBalon', 'ball'],
                ['Sin balón', 'sinBalon', 'shield'],
              ] as const
            ).map(([titulo, k, icono]) => (
              <section key={k} className="rounded-xl border border-athletic/40 border-l-4 border-l-athletic bg-white p-4">
                <h3 className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide text-athletic">
                  <Icon name={icono} className="h-5 w-5" /> Consignas - {titulo}
                </h3>
                <Auto
                  className="mt-2 text-xs leading-snug text-neutral-700"
                  placeholder="Una consigna por línea"
                  value={textoCons[k]}
                  onChange={(v) => setTextoCons({ ...textoCons, [k]: v })}
                />
              </section>
            ))}
          </div>

          <div className="space-y-2">
            <h3 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-ink">
              <Icon name="users" className="h-5 w-5 text-athletic" /> Rol de los jugadores
            </h3>
            <div className="grid gap-3 sm:grid-cols-3">
              {EQUIPOS.map((e) => (
                <section key={e.k} className={`rounded-xl border p-4 ${e.caja}`}>
                  <h4 className={`flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide ${e.texto}`}>
                    <Icon name="shirt" className="h-5 w-5" /> Equipo {e.nombre}
                  </h4>
                  <Auto
                    className="mt-2 text-xs leading-snug text-neutral-700"
                    placeholder="Un rol por línea"
                    value={textoRoles[e.k]}
                    onChange={(v) => setTextoRoles({ ...textoRoles, [e.k]: v })}
                  />
                </section>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button type="button" onClick={guardarEdicion} className="btn-primary flex-1">
              Guardar cambios
            </button>
            <button type="button" onClick={() => setBorrador(null)} className="btn-ghost flex-1">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {resultado && !cargando && !borrador && (
        <div className="space-y-4">
          {resultado.resumen && (
            <div className="flex items-center gap-3 rounded-xl bg-neutral-100 px-4 py-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-athletic ring-1 ring-black/5">
                <Icon name="bot" className="h-6 w-6" />
              </span>
              <p className="text-[13px] leading-relaxed text-neutral-700">{resultado.resumen}</p>
            </div>
          )}
          {resultado.principal && (
            <p className="flex items-center gap-2.5 rounded-lg bg-athletic-light px-4 py-2.5 text-[13px] text-ink">
              <Icon name="target" className="h-5 w-5 shrink-0 text-athletic" />
              <span className="font-extrabold text-athletic">Objetivo principal:</span> {resultado.principal}
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {resultado.objetivos.map((o, i) => {
              const ultimoSuelto = resultado.objetivos.length % 2 === 1 && i === resultado.objetivos.length - 1 && i > 0
              return ultimoSuelto ? (
                <article key={i} className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-athletic-light px-4 py-3 sm:col-span-2">
                  <Icon name="refresh" className="h-6 w-6 shrink-0 text-athletic" />
                  <span className="shrink-0">
                    <span className="block text-[11px] font-extrabold uppercase tracking-wide text-athletic">{TIPOS[o.tipo] ?? o.tipo}</span>
                    <span className="block text-sm font-extrabold leading-snug">{o.objetivo}</span>
                  </span>
                  <span className="hidden h-8 w-px bg-athletic/20 sm:block" />
                  <p className="min-w-0 flex-1 text-xs leading-relaxed text-neutral-700">{o.explicacion}</p>
                </article>
              ) : (
                <article key={i} className="flex gap-3 rounded-xl border border-line bg-white p-3.5 shadow-card">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-athletic-light text-athletic">
                    <Icon name={o.tipo} className="h-6 w-6" />
                  </span>
                  <div className="min-w-0">
                    <span className="text-[11px] font-extrabold uppercase tracking-wide text-athletic">{TIPOS[o.tipo] ?? o.tipo}</span>
                    <h3 className="text-sm font-extrabold leading-snug">{o.objetivo}</h3>
                    <p className="mt-0.5 text-xs leading-relaxed text-neutral-700">{o.explicacion}</p>
                  </div>
                </article>
              )
            })}
          </div>
          {resultado.consignas && (resultado.consignas.conBalon.length > 0 || resultado.consignas.sinBalon.length > 0) && (
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ['Con balón', resultado.consignas.conBalon, 'ball'],
                  ['Sin balón', resultado.consignas.sinBalon, 'shield'],
                ] as [string, string[], string][]
              ).map(([titulo, lista, icono]) => (
                <section key={titulo} className="rounded-xl border border-athletic/40 border-l-4 border-l-athletic bg-white p-4">
                  <h3 className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide text-athletic">
                    <Icon name={icono} className="h-5 w-5" /> Consignas - {titulo}
                  </h3>
                  <ul className="mt-2 space-y-1">
                    {lista.map((c, i) => (
                      <li key={i} className="flex gap-2 text-xs leading-snug text-neutral-700">
                        <span className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-athletic" />
                        {c}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
          {resultado.roles && EQUIPOS.some((e) => resultado.roles![e.k].length > 0) && (
            <div className="space-y-2">
              <h3 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-ink">
                <Icon name="users" className="h-5 w-5 text-athletic" /> Rol de los jugadores
              </h3>
              <div className="grid gap-3 sm:grid-cols-3">
                {EQUIPOS.filter((e) => resultado.roles![e.k].length > 0).map((e) => (
                  <section key={e.k} className={`rounded-xl border p-4 ${e.caja}`}>
                    <h4 className={`flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide ${e.texto}`}>
                      <Icon name="shirt" className="h-5 w-5" /> Equipo {e.nombre}
                    </h4>
                    <ul className="mt-2 space-y-1">
                      {resultado.roles![e.k].map((c, i) => (
                        <li key={i} className="flex gap-2 text-xs leading-snug text-neutral-700">
                          <span className={`mt-[6px] h-1 w-1 shrink-0 rounded-full ${e.punto}`} />
                          {c}
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      </div>
    </section>
  )
}
