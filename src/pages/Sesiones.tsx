import { useEffect, useState } from 'react'
import { parsearDescripcion, actualizarSesion, crearSesion, eliminarSesion, guardarTareaAnalizada, imagenAFile, listarEjercicios, listarPlantilla, listarSesiones, obtenerTareaAnalizada } from '../lib/api'
import { blobABase64, comprimir } from '../lib/imagen'
import { CATEGORIAS, POSICIONES } from '../types'
import type { ConfigTarea, Ejercicio, JugadorSesion, Peto, PosicionJugador, ResultadoAsistente, Sesion } from '../types'
import VisorImagen from '../components/VisorImagen'
import Asistente from '../components/Asistente'
import Icon from '../components/Icons'
import { crearInformeSesion } from '../lib/informeSesion'

const MOTIVOS = ['Lesión', 'Vacaciones', 'Otro equipo']

const PETO_CLASE: Record<Peto, string> = {
  '-': 'bg-white text-neutral-400 ring-1 ring-line',
  R: 'bg-red-600 text-white',
  A: 'bg-blue-600 text-white',
  N: 'bg-orange-500 text-white',
  V: 'bg-emerald-600 text-white',
}

const etiqueta = 'text-[9px] font-extrabold uppercase tracking-widest text-neutral-500'

const input =
  'w-full rounded-xl border border-line bg-white px-3 py-2 text-sm font-semibold text-ink outline-none focus:border-athletic focus:ring-2 focus:ring-athletic/20'

const TIPOS_OBJ: Record<string, string> = { tactico: 'Táctico', tecnico: 'Técnico', fisico: 'Físico', psicologico: 'Psicológico' }

/** Resumen del Asistente para una tarea de la sesión + botón que abre el análisis completo embebido. */
function AsistenteTarea({ ejercicio }: { ejercicio: Ejercicio }) {
  const [resultado, setResultado] = useState<ResultadoAsistente | null>(() => obtenerTareaAnalizada(ejercicio.id)?.resultado ?? null)
  const [abierto, setAbierto] = useState(false)

  useEffect(() => {
    setResultado(obtenerTareaAnalizada(ejercicio.id)?.resultado ?? null)
  }, [ejercicio.id])

  useEffect(() => {
    if (!abierto) return
    const onKey = (ev: KeyboardEvent) => ev.key === 'Escape' && setAbierto(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [abierto])

  const secundarios = resultado?.objetivos.slice(0, 3) ?? []

  return (
    <>
      <div className="space-y-2 rounded-xl bg-athletic-light/60 p-3 ring-1 ring-athletic/20">
        <p className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wide text-athletic">
          <Icon name="sparkles" className="h-4 w-4" /> Asistente
        </p>
        {resultado ? (
          <>
            {resultado.principal && (
              <p className="text-xs leading-snug text-ink">
                <span className="font-extrabold text-athletic">Objetivo principal: </span>
                {resultado.principal}
              </p>
            )}
            {secundarios.length > 0 && (
              <ul className="space-y-1">
                {secundarios.map((o, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-[11px] leading-snug text-neutral-700">
                    <Icon name={o.tipo} className="mt-px h-3.5 w-3.5 shrink-0 text-athletic" />
                    <span>
                      <span className="font-extrabold uppercase text-athletic">{TIPOS_OBJ[o.tipo] ?? o.tipo}: </span>
                      {o.objetivo}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className="text-xs leading-snug text-neutral-600">Esta tarea aún no tiene análisis del asistente.</p>
        )}
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="w-full rounded-lg bg-athletic px-3 py-1.5 text-xs font-bold text-white transition hover:opacity-90"
        >
          {resultado ? 'Ver análisis completo' : '✨ Analizar con el asistente'}
        </button>
      </div>

      {abierto && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-6" onClick={() => setAbierto(false)}>
          <div className="relative max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-t-2xl bg-neutral-50 shadow-lift sm:rounded-2xl" onClick={(ev) => ev.stopPropagation()}>
            <button
              type="button"
              onClick={() => setAbierto(false)}
              aria-label="Cerrar"
              className="absolute right-3 top-2.5 z-10 text-2xl leading-none text-white/80 hover:text-white"
            >
              ×
            </button>
            <Asistente
              inicial={resultado}
              onAnalizado={(r) => {
                guardarTareaAnalizada(ejercicio, r)
                setResultado(r)
              }}
              descripcion={ejercicio.descripcion ?? ''}
              nombre={ejercicio.nombre}
              categoria={ejercicio.categoria}
              imagenUrl={ejercicio.imagen_url}
              obtenerImagen={async () => {
                if (!ejercicio.imagen_url) return null
                const f = await imagenAFile(ejercicio.imagen_url, ejercicio.nombre)
                return { base64: await blobABase64(await comprimir(f, 1400, 0.8)), mediaType: 'image/jpeg' }
              }}
            />
          </div>
        </div>
      )}
    </>
  )
}

export default function Sesiones() {
  const [sesiones, setSesiones] = useState<Sesion[]>(() => listarSesiones())
  const [ejercicios, setEjercicios] = useState<Ejercicio[]>([])
  const [activaId, setActivaId] = useState<string | null>(null)
  const [vista, setVista] = useState<'lista' | 'detalle'>('lista')
  const [selector, setSelector] = useState<number | null>(null)
  const [busca, setBusca] = useState('')
  const [menuInforme, setMenuInforme] = useState(false)
  const [pestana, setPestana] = useState<'datos' | 'sesion'>('datos')
  const [nuevoJ, setNuevoJ] = useState<{ nombre: string; dorsal: string; posicion: PosicionJugador }>({
    nombre: '',
    dorsal: '',
    posicion: 'Centrocampista',
  })

  useEffect(() => {
    listarEjercicios().then(setEjercicios)
  }, [])

  const activa = sesiones.find((s) => s.id === activaId) ?? null
  const porId = (id: string | null) => ejercicios.find((e) => e.id === id) ?? null

  const guardar = (parche: Partial<Sesion>) => {
    if (!activa) return
    const nueva = actualizarSesion(activa.id, parche)
    setSesiones((prev) => prev.map((s) => (s.id === nueva.id ? nueva : s)))
  }

  const nueva = () => {
    const s = crearSesion()
    setSesiones((prev) => [s, ...prev])
    setActivaId(s.id)
    setPestana('datos')
    setVista('detalle')
  }

  const abrir = (id: string) => {
    setActivaId(id)
    setPestana('datos')
    setVista('detalle')
  }

  const borrar = () => {
    if (!activa || !window.confirm('¿Borrar esta sesión?')) return
    eliminarSesion(activa.id)
    setSesiones(sesiones.filter((s) => s.id !== activa.id))
    setActivaId(null)
    setVista('lista')
  }

  const elegir = (idx: number, id: string) => {
    if (!activa) return
    guardar({ tareas: activa.tareas.map((t, i) => (i === idx ? id : t)) })
    setSelector(null)
    setBusca('')
  }

  const quitar = (idx: number) => {
    if (!activa) return
    guardar({ tareas: activa.tareas.map((t, i) => (i === idx ? null : t)) })
  }

  const eliminarHueco = (idx: number) => {
    if (!activa) return
    guardar({
      tareas: activa.tareas.filter((_, i) => i !== idx),
      config: (activa.config ?? []).filter((_, i) => i !== idx),
    })
  }

  const cfg = (idx: number): ConfigTarea => activa?.config?.[idx] ?? {}
  const cambiarCfg = (idx: number, parche: Partial<ConfigTarea>) => {
    if (!activa) return
    const config = activa.tareas.map((_, i) => activa.config?.[i] ?? {})
    config[idx] = { ...config[idx], ...parche }
    guardar({ config })
  }
  const num = (v: string) => (v === '' ? undefined : Math.max(0, Number(v)))

  const jugadores = activa?.jugadores ?? []
  const asisten = jugadores.filter((j) => j.asiste)
  const ausentes = jugadores.filter((j) => !j.asiste)

  const cambiarJugador = (id: string, parche: Partial<JugadorSesion>) =>
    guardar({ jugadores: jugadores.map((j) => (j.id === id ? { ...j, ...parche } : j)) })

  const anadirJugador = () => {
    const nombre = nuevoJ.nombre.trim()
    if (!nombre) return
    const j: JugadorSesion = { id: crypto.randomUUID(), nombre, dorsal: nuevoJ.dorsal.trim(), posicion: nuevoJ.posicion, asiste: true, motivo: '' }
    guardar({ jugadores: [...jugadores, j] })
    setNuevoJ({ ...nuevoJ, nombre: '', dorsal: '' })
  }

  const anterior = activa ? sesiones.find((s) => s.id !== activa.id && (s.jugadores?.length ?? 0) > 0 && (!activa.equipo || s.equipo === activa.equipo)) : undefined
  const importarAnterior = () => {
    if (!anterior?.jugadores) return
    guardar({ jugadores: anterior.jugadores.map((j) => ({ ...j, id: crypto.randomUUID(), asiste: true, motivo: '' })) })
  }

  const cambiarEquipo = (equipo: string) => {
    if (!activa) return
    const deLaPlantilla = listarPlantilla().filter((p) => p.equipo === equipo)
    if (deLaPlantilla.length === 0) {
      guardar({ equipo })
      return
    }
    if (jugadores.length > 0 && !window.confirm(`¿Sustituir los jugadores actuales por la plantilla de ${equipo}?`)) {
      guardar({ equipo })
      return
    }
    const lista: JugadorSesion[] = deLaPlantilla.map((p) => ({
      id: crypto.randomUUID(),
      nombre: `${p.nombre} ${p.apellido}`.trim(),
      dorsal: String(p.dorsal ?? ''),
      posicion: p.posicion === 'Medio' ? 'Centrocampista' : p.posicion,
      asiste: true,
      motivo: '',
    }))
    guardar({ equipo, jugadores: lista })
  }

  const informePDF = (conAsistente: boolean) => {
    setMenuInforme(false)
    if (!activa) return
    const aNumero = (v?: string) => (v && Number(v) > 0 ? Number(v) : undefined)
    const tareas = activa.tareas.flatMap((tid, idx) => {
      const e = porId(tid)
      if (!e) return []
      const c = cfg(idx)
      const ficha = parsearDescripcion(e.descripcion ?? '')
      const textoEj = [ficha.descripcion, ficha.objetivo && `Objetivo: ${ficha.objetivo}`].filter(Boolean).join('\n\n')
      return [
        {
          numero: idx + 1,
          nombre: e.nombre,
          tipo: c.tipo ?? e.categoria ?? undefined,
          duracion: c.duracion,
          imagenUrl: e.imagen_url,
          largo: c.largo ?? aNumero(ficha.largo),
          ancho: c.ancho ?? aNumero(ficha.ancho),
          series: c.series,
          tSerie: c.tSerie,
          descanso: c.descanso,
          descripcion: c.descripcion ?? textoEj,
          normas: c.normas ?? ficha.normas ?? '',
          variantes: c.variantes ?? ficha.variantes ?? '',
          claves: c.claves ?? ficha.claves ?? '',
          petos: asisten.map((j) => ({ nombre: j.nombre, peto: c.petos?.[j.id] ?? ('-' as Peto) })),
          asistente: conAsistente ? (obtenerTareaAnalizada(e.id)?.resultado ?? null) : null,
        },
      ]
    })
    if (tareas.length === 0) {
      alert('Añade al menos una tarea a la sesión para crear el informe.')
      return
    }
    crearInformeSesion({
      numero: activa.numero,
      equipo: activa.equipo,
      fecha: activa.fecha,
      hora: activa.hora,
      ubicacion: activa.ubicacion,
      asisten,
      ausentes,
      tareas,
      conAsistente,
    })
  }

  const visibles = ejercicios.filter((e) => e.nombre.toLowerCase().includes(busca.toLowerCase()))

  return (
    <div className="space-y-5">
      <div
        className={
          vista === 'detalle' && activa
            ? 'sticky top-[65px] z-10 -mx-4 -mt-5 space-y-3 bg-surface px-4 pb-3 pt-5 md:-mx-6 md:-mt-8 md:px-6 md:pt-8 print:static'
            : 'space-y-3'
        }
      >
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-extrabold">Sesiones</h1>
        <button
          onClick={nueva}
          className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-sm font-bold text-white transition hover:bg-black"
        >
          <span className="text-base leading-none">+</span> Nueva sesión
        </button>
        {vista === 'detalle' && activa && (
          <>
            <button
              onClick={() => setVista('lista')}
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-1.5 text-sm font-bold text-neutral-600 ring-1 ring-line hover:text-ink"
            >
              ← Listado
            </button>
            <span className="text-sm font-extrabold">
              Sesión {activa.numero || '–'}
              {activa.equipo ? ` · ${activa.equipo}` : ''}
            </span>
          </>
        )}
      </div>

      {vista === 'detalle' && activa && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-full bg-white p-1 ring-1 ring-line">
            {(['datos', 'sesion'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPestana(p)}
                className={`rounded-full px-5 py-1.5 text-xs font-extrabold uppercase tracking-wide transition ${
                  pestana === p ? 'bg-athletic text-white' : 'text-neutral-500 hover:text-ink'
                }`}
              >
                {p === 'datos' ? 'Datos' : 'Sesión'}
              </button>
            ))}
          </div>
          <div className="relative">
            <button
              onClick={() => setMenuInforme((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-full bg-athletic px-4 py-2 text-xs font-extrabold uppercase tracking-wide text-white transition hover:opacity-90"
            >
              <Icon name="file" className="h-4 w-4" /> Crear informe <span aria-hidden>▾</span>
            </button>
            {menuInforme && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuInforme(false)} />
                <div className="absolute left-0 z-20 mt-1 w-56 overflow-hidden rounded-xl bg-white shadow-lift ring-1 ring-line">
                  <button onClick={() => informePDF(true)} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-bold hover:bg-athletic-light">
                    <Icon name="sparkles" className="h-4 w-4 text-athletic" /> Con asistente
                  </button>
                  <button onClick={() => informePDF(false)} className="flex w-full items-center gap-2 border-t border-line px-4 py-2.5 text-left text-sm font-bold hover:bg-athletic-light">
                    <Icon name="file" className="h-4 w-4 text-athletic" /> Sin asistente
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      </div>

      {vista === 'lista' ? (
        sesiones.length === 0 ? (
          <div className="card py-10 text-center">
            <p className="mb-4 text-neutral-600">Aún no hay sesiones.</p>
            <button onClick={nueva} className="btn-primary">
              Crear la primera
            </button>
          </div>
        ) : (
          <div className="space-y-6">
          {Array.from(new Set(sesiones.map((s) => s.equipo || '')))
            .sort((a, b) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b)))
            .map((eq) => (
          <section key={eq} className="space-y-3">
            <h2 className="text-sm font-extrabold uppercase tracking-widest text-neutral-500">{eq || 'Sin equipo'}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sesiones
              .filter((s) => (s.equipo || '') === eq)
              .sort((a, b) => (parseInt(a.numero) || Infinity) - (parseInt(b.numero) || Infinity) || (a.fecha ?? '').localeCompare(b.fecha ?? ''))
              .map((s) => {
                const nTareas = s.tareas.filter(Boolean).length
                const nAsisten = (s.jugadores ?? []).filter((j) => j.asiste).length
                const fecha = s.fecha ? s.fecha.split('-').reverse().join('/') : 'Sin fecha'
                return (
                  <button
                    key={s.id}
                    onClick={() => abrir(s.id)}
                    className="rounded-2xl bg-white p-4 text-left shadow-card ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:ring-athletic/40"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-base font-extrabold">Sesión {s.numero || '–'}</span>
                      {s.equipo && <span className="chip !px-2 !py-0.5">{s.equipo}</span>}
                    </div>
                    <p className="mt-1 text-sm font-semibold text-neutral-600">
                      {fecha}
                      {s.hora ? ` · ${s.hora}` : ''}
                    </p>
                    {s.ubicacion && <p className="text-xs font-semibold text-neutral-500">{s.ubicacion}</p>}
                    <div className="mt-3 flex gap-2 text-xs font-bold">
                      <span className="rounded-full bg-neutral-100 px-3 py-1">{nTareas} tareas</span>
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">{nAsisten} jugadores</span>
                    </div>
                  </button>
                )
              })}
          </div>
          </section>
            ))}
          </div>
        )
      ) : !activa ? null : (
        <>
          {pestana === 'datos' && (
            <div className="space-y-5">
              <section className="grid gap-3 rounded-2xl bg-white p-4 shadow-card ring-1 ring-black/5 sm:grid-cols-2 lg:grid-cols-5">
                <label className="space-y-1 text-xs font-bold uppercase tracking-wide text-neutral-500">
                  Fecha
                  <input type="date" className={input} value={activa.fecha} onChange={(e) => guardar({ fecha: e.target.value })} />
                </label>
                <label className="space-y-1 text-xs font-bold uppercase tracking-wide text-neutral-500">
                  Hora
                  <input type="time" className={input} value={activa.hora ?? ''} onChange={(e) => guardar({ hora: e.target.value })} />
                </label>
                <label className="space-y-1 text-xs font-bold uppercase tracking-wide text-neutral-500">
                  Ubicación
                  <input className={input} value={activa.ubicacion ?? ''} placeholder="Sin definir" onChange={(e) => guardar({ ubicacion: e.target.value })} />
                </label>
                <label className="space-y-1 text-xs font-bold uppercase tracking-wide text-neutral-500">
                  Equipo
                  <select className={input} value={activa.equipo} onChange={(e) => cambiarEquipo(e.target.value)}>
                    <option value="">Selecciona equipo</option>
                    {!['Primer equipo', 'Juvenil A', 'Juvenil B'].includes(activa.equipo) && activa.equipo && (
                      <option value={activa.equipo}>{activa.equipo}</option>
                    )}
                    <option value="Primer equipo">Primer equipo</option>
                    <option value="Juvenil A">Juvenil A</option>
                    <option value="Juvenil B">Juvenil B</option>
                  </select>
                </label>
                <label className="space-y-1 text-xs font-bold uppercase tracking-wide text-neutral-500">
                  Nº de sesión
                  <input className={input} value={activa.numero} placeholder="1" onChange={(e) => guardar({ numero: e.target.value })} />
                </label>
              </section>

              <section className="space-y-4 rounded-2xl bg-white p-4 shadow-card ring-1 ring-black/5">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-base font-extrabold">Jugadores</h2>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">Asisten: {asisten.length}</span>
                  <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700">No asisten: {ausentes.length}</span>
                  {jugadores.length === 0 && anterior && (
                    <button onClick={importarAnterior} className="ml-auto rounded-full px-3 py-1.5 text-xs font-bold text-neutral-600 ring-1 ring-line hover:text-athletic">
                      Importar plantilla de la sesión {anterior.numero || '–'}
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-end gap-2">
                  <input className={`${input} !w-20`} placeholder="Dorsal" value={nuevoJ.dorsal} onChange={(e) => setNuevoJ({ ...nuevoJ, dorsal: e.target.value })} />
                  <input
                    className={`${input} !w-56`}
                    placeholder="Nombre del jugador"
                    value={nuevoJ.nombre}
                    onChange={(e) => setNuevoJ({ ...nuevoJ, nombre: e.target.value })}
                    onKeyDown={(e) => e.key === 'Enter' && anadirJugador()}
                  />
                  <select className={`${input} !w-44`} value={nuevoJ.posicion} onChange={(e) => setNuevoJ({ ...nuevoJ, posicion: e.target.value as PosicionJugador })}>
                    {POSICIONES.map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                  <button onClick={anadirJugador} className="rounded-full bg-ink px-4 py-2 text-sm font-bold text-white hover:bg-black">
                    + Añadir
                  </button>
                </div>

                {jugadores.length === 0 ? (
                  <p className="py-4 text-center text-sm text-neutral-500">Aún no hay jugadores en esta sesión.</p>
                ) : (
                  POSICIONES.map((pos) => {
                    const grupo = jugadores.filter((j) => j.posicion === pos)
                    if (grupo.length === 0) return null
                    return (
                      <div key={pos} className="space-y-2">
                        <p className="text-xs font-extrabold uppercase tracking-widest text-neutral-500">{pos}</p>
                        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                          {grupo.map((j) => (
                            <div key={j.id} className={`space-y-2 rounded-xl p-2.5 ring-1 ${j.asiste ? 'ring-line' : 'bg-red-50/60 ring-red-200'}`}>
                              <div className="flex items-center gap-2">
                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-athletic text-xs font-extrabold text-white">
                                  {j.dorsal || '–'}
                                </span>
                                <span className="min-w-0 flex-1 truncate text-xs font-extrabold uppercase">{j.nombre}</span>
                                <select
                                  className="rounded-lg border border-line bg-white px-2 py-1 text-xs font-bold"
                                  value={j.asiste ? 'si' : 'no'}
                                  onChange={(e) => cambiarJugador(j.id, { asiste: e.target.value === 'si', motivo: e.target.value === 'si' ? '' : j.motivo })}
                                >
                                  <option value="si">Sí</option>
                                  <option value="no">No</option>
                                </select>
                                <button
                                  onClick={() => guardar({ jugadores: jugadores.filter((x) => x.id !== j.id) })}
                                  title="Quitar jugador"
                                  aria-label="Quitar jugador"
                                  className="text-neutral-400 hover:text-red-600"
                                >
                                  <Icon name="trash" className="h-4 w-4" />
                                </button>
                              </div>
                              {!j.asiste && (
                                <div className="flex gap-2">
                                  <select
                                    className="rounded-lg border border-line bg-white px-2 py-1 text-xs font-semibold"
                                    value={MOTIVOS.includes(j.motivo) ? j.motivo : ''}
                                    onChange={(e) => cambiarJugador(j.id, { motivo: e.target.value })}
                                  >
                                    <option value="">Motivo…</option>
                                    {MOTIVOS.map((m) => (
                                      <option key={m}>{m}</option>
                                    ))}
                                  </select>
                                  <input
                                    className="min-w-0 flex-1 rounded-lg border border-line bg-white px-2 py-1 text-xs font-semibold"
                                    placeholder="Detalle del motivo"
                                    value={j.motivo}
                                    onChange={(e) => cambiarJugador(j.id, { motivo: e.target.value })}
                                  />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })
                )}

                {ausentes.length > 0 && (
                  <div className="rounded-xl bg-neutral-50 p-3 ring-1 ring-line">
                    <p className="mb-2 text-xs font-extrabold uppercase tracking-widest text-neutral-500">Resumen de ausencias</p>
                    <ul className="space-y-1 text-sm">
                      {ausentes.map((j) => (
                        <li key={j.id}>
                          <span className="font-bold">{j.nombre}</span>
                          <span className="text-neutral-600"> — {j.motivo || 'Sin motivo indicado'}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            </div>
          )}

          {pestana === 'sesion' && (
          <>
          <section className="space-y-3">
            <div className="grid items-start gap-4 xl:grid-cols-2">
            {activa.tareas.map((tid, idx) => {
              const e = porId(tid)
              const c = cfg(idx)
              // Datos metidos en el ejercicio (Nuevo ejercicio / Diseñador): valores por defecto si la sesión no los ha cambiado
              const ficha = e ? parsearDescripcion(e.descripcion ?? '') : null
              const aNumero = (v?: string) => (v && Number(v) > 0 ? Number(v) : undefined)
              const largoEj = c.largo ?? aNumero(ficha?.largo)
              const anchoEj = c.ancho ?? aNumero(ficha?.ancho)
              const textoEj = ficha
                ? [
                    ficha.descripcion,
                    ficha.objetivo && `Objetivo: ${ficha.objetivo}`,
                  ]
                    .filter(Boolean)
                    .join('\n\n')
                : ''
              const campo = (label: string, valor: number | undefined, clave: keyof ConfigTarea, compacto = false) => (
                <label className="block space-y-1">
                  <span className={`${etiqueta} ${compacto ? 'block whitespace-nowrap !tracking-normal' : ''}`}>{label}</span>
                  <input
                    type="number"
                    min={0}
                    value={valor ?? ''}
                    placeholder="0"
                    onChange={(ev) => cambiarCfg(idx, { [clave]: num(ev.target.value) })}
                    className={`w-full rounded-xl border border-line bg-white text-center font-extrabold outline-none focus:border-athletic ${compacto ? 'px-1 py-1.5 text-xs' : 'px-3 py-2.5 text-sm'}`}
                  />
                </label>
              )
              return (
                <article key={idx} className="rounded-2xl bg-white p-4 shadow-card ring-1 ring-black/5">
                  <header className="mb-3 flex flex-wrap items-center gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-athletic text-xs font-extrabold text-white">
                      {idx + 1}
                    </span>
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
                      <span className={etiqueta}>Nombre:</span>
                      <span className="truncate text-sm font-extrabold uppercase">{e ? e.nombre : 'Sin tarea'}</span>
                      <span className={etiqueta}>Tipo:</span>
                      <select
                        className="rounded-lg border border-line bg-white px-2 py-1 text-xs font-bold"
                        value={c.tipo ?? e?.categoria ?? ''}
                        onChange={(ev) => cambiarCfg(idx, { tipo: ev.target.value })}
                      >
                        <option value="">–</option>
                        {[...CATEGORIAS, ...(c.tipo && !CATEGORIAS.includes(c.tipo) ? [c.tipo] : [])].map((t) => (
                          <option key={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <label className="flex items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-1 text-sm font-extrabold">
                        <span aria-hidden>⏱</span>
                        <input
                          type="number"
                          min={0}
                          value={c.duracion ?? ''}
                          placeholder="0"
                          aria-label="Duración en minutos"
                          onChange={(ev) => cambiarCfg(idx, { duracion: num(ev.target.value) })}
                          className="w-10 bg-transparent text-center outline-none"
                        />
                        <span className="text-[10px] font-bold text-neutral-500">min</span>
                      </label>
                      <button onClick={() => setSelector(idx)} title="Cambiar tarea" aria-label="Cambiar tarea" className="rounded-lg p-2 text-neutral-500 ring-1 ring-line hover:text-athletic">
                        <Icon name="pencil" className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => (activa.tareas.length > 1 ? eliminarHueco(idx) : quitar(idx))}
                        title="Quitar tarea"
                        aria-label="Quitar tarea"
                        className="rounded-lg bg-red-50 p-2 text-red-600 hover:bg-red-100"
                      >
                        <Icon name="trash" className="h-4 w-4" />
                      </button>
                    </div>
                  </header>

                  {!e ? (
                    <button
                      onClick={() => setSelector(idx)}
                      className="w-full rounded-xl border-2 border-dashed border-line py-8 text-sm font-bold text-neutral-500 transition hover:border-athletic hover:text-athletic"
                    >
                      + Añadir tarea {idx + 1}
                    </button>
                  ) : (
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)]">
                      {/* Campo + medidas */}
                      <div className="space-y-3">
                        <VisorImagen src={e.imagen_url} alt={e.nombre} disenoId={e.diseno_id} />
                        <div className="grid grid-cols-2 gap-2">
                          {campo('Largo (m)', largoEj, 'largo', true)}
                          {campo('Ancho (m)', anchoEj, 'ancho', true)}
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">
                          {campo('Nº series', c.series, 'series', true)}
                          {campo("T/serie (')", c.tSerie, 'tSerie', true)}
                          {campo("Descanso (')", c.descanso, 'descanso', true)}
                        </div>
                        <AsistenteTarea ejercicio={e} />
                      </div>

                      {/* Descripción + roles técnicos */}
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <p className={etiqueta}>Descripción</p>
                          <textarea
                            rows={10}
                            value={c.descripcion ?? textoEj}
                            onChange={(ev) => cambiarCfg(idx, { descripcion: ev.target.value })}
                            className="w-full resize-y rounded-xl border border-line bg-white p-3 text-xs font-semibold leading-relaxed outline-none focus:border-athletic"
                          />
                        </div>
                        <div className="grid gap-3">
                          {([
                            ['Normas', 'normas'],
                            ['Variantes', 'variantes'],
                            ['Puntos clave', 'claves'],
                          ] as const).map(([titulo, clave]) => (
                            <div key={clave} className="space-y-1">
                              <p className={etiqueta}>{titulo}</p>
                              <textarea
                                rows={4}
                                value={c[clave] ?? ficha?.[clave] ?? ''}
                                onChange={(ev) => cambiarCfg(idx, { [clave]: ev.target.value })}
                                className="w-full resize-y rounded-xl border border-line bg-white p-3 text-xs font-semibold leading-relaxed outline-none focus:border-athletic"
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Petos */}
                      <div className="space-y-1">
                        <p className={etiqueta}>Petos</p>
                        {asisten.length === 0 ? (
                          <p className="rounded-xl p-3 text-xs text-neutral-500 ring-1 ring-line">Añade jugadores que asistan en la pestaña Datos.</p>
                        ) : (
                          <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-neutral-50 p-2 ring-1 ring-line">
                            {asisten.map((j) => {
                              const p = c.petos?.[j.id] ?? '-'
                              return (
                                <div key={j.id} className="flex items-center gap-1 rounded-lg bg-white px-1.5 py-1 ring-1 ring-line">
                                  <span className="min-w-0 flex-1 truncate text-[10px] font-extrabold uppercase">{j.nombre}</span>
                                  <select
                                    value={p}
                                    onChange={(e) => cambiarCfg(idx, { petos: { ...cfg(idx).petos, [j.id]: e.target.value as Peto } })}
                                    title="Color del peto"
                                    className={`h-5 w-5 shrink-0 cursor-pointer appearance-none rounded text-[10px] font-extrabold !text-transparent ${PETO_CLASE[p]}`}
                                  >
                                    <option value="-" className="bg-white text-neutral-500">Sin peto</option>
                                    <option value="A" className="bg-blue-600 text-white">Azul</option>
                                    <option value="N" className="bg-orange-500 text-white">Naranja</option>
                                    <option value="R" className="bg-red-600 text-white">Rojo</option>
                                    <option value="V" className="bg-emerald-600 text-white">Verde</option>
                                  </select>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </article>
              )
            })}
            </div>
            <div className="flex items-center justify-between">
              <button
                onClick={() => guardar({ tareas: [...activa.tareas, null], config: [...activa.tareas.map((_, i) => activa.config?.[i] ?? {}), {}] })}
                className="rounded-full bg-ink px-4 py-2 text-sm font-bold text-white hover:bg-black"
              >
                + Añadir otra tarea
              </button>
              <div className="flex items-center gap-4">
                <button onClick={borrar} className="text-sm font-bold text-neutral-400 hover:text-red-600">
                  Borrar sesión
                </button>
              </div>
            </div>
          </section>
          </>
          )}
        </>
      )}

      {selector !== null && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-6" onClick={() => setSelector(null)}>
          <div className="flex max-h-[85vh] w-full max-w-4xl flex-col rounded-t-2xl bg-white shadow-lift sm:rounded-2xl" onClick={(ev) => ev.stopPropagation()}>
            <div className="flex items-center gap-3 border-b border-line p-4">
              <h2 className="shrink-0 text-base font-extrabold">Elegir tarea {selector + 1}</h2>
              <input autoFocus className={input} placeholder="Buscar tarea…" value={busca} onChange={(e) => setBusca(e.target.value)} />
              <button onClick={() => setSelector(null)} className="text-2xl leading-none text-neutral-400 hover:text-ink" aria-label="Cerrar">
                ×
              </button>
            </div>
            <div className="overflow-y-auto p-4">
              {visibles.length === 0 ? (
                <p className="py-8 text-center text-neutral-500">No hay tareas en la biblioteca.</p>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {visibles.map((e) => (
                    <button
                      key={e.id}
                      onClick={() => elegir(selector, e.id)}
                      className="overflow-hidden rounded-xl bg-white text-left shadow-card ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:ring-athletic/40"
                    >
                      <img src={e.imagen_url} alt={e.nombre} loading="lazy" className="aspect-[4/3] w-full object-cover" />
                      <div className="p-2.5">
                        <p className="line-clamp-2 text-sm font-bold leading-snug">{e.nombre}</p>
                        {e.categoria && <span className="chip mt-1.5 !px-2 !py-0.5">{e.categoria}</span>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
