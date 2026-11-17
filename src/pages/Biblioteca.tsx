import { useEffect, useMemo, useState } from 'react'
import { duplicarEjercicio, eliminarEjercicio, listarEjercicios, listarTareasAnalizadas, parsearDescripcion } from '../lib/api'
import { descargarFichaTarea } from '../lib/kitPptx'
import type { Ejercicio } from '../types'
import Spinner from '../components/Spinner'
import Icon from '../components/Icons'

export default function Biblioteca() {
  const [items, setItems] = useState<Ejercicio[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [analizadas, setAnalizadas] = useState<Set<string>>(new Set())
  const [filtro, setFiltro] = useState<string>('Todas')

  useEffect(() => {
    listarEjercicios().then(setItems).catch((e) => setError(e.message))
    listarTareasAnalizadas()
      .then((ts) =>
        setAnalizadas(new Set(ts.filter((t) => t.resultado && t.estado !== 'pendiente').map((t) => t.ejercicio_id))),
      )
      .catch(() => {})
  }, [])

  const categorias = useMemo(() => {
    const set = new Set((items ?? []).map((i) => i.categoria).filter(Boolean) as string[])
    return ['Todas', ...Array.from(set).sort()]
  }, [items])

  const accion =
    'inline-flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-100 hover:text-athletic'

  const borrar = (e: Ejercicio) => {
    if (!window.confirm(`¿Borrar "${e.nombre}"? Esta acción no se puede deshacer.`)) return
    try {
      eliminarEjercicio(e.id)
      setItems((prev) => (prev ?? []).filter((x) => x.id !== e.id))
    } catch (err) {
      window.alert((err as Error).message)
    }
  }

  const ficha = (e: Ejercicio) => {
    const f = parsearDescripcion(e.descripcion ?? '')
    const n = (v: string) => (Number(v) > 0 ? Number(v) : undefined)
    descargarFichaTarea({
      numero: 0,
      nombre: e.nombre,
      tipo: e.categoria ?? undefined,
      imagenUrl: e.imagen_url,
      largo: n(f.largo),
      ancho: n(f.ancho),
      descripcion: [f.descripcion, f.objetivo && `Objetivo: ${f.objetivo}`].filter(Boolean).join('\n\n'),
      normas: f.normas,
      variantes: f.variantes,
      claves: f.claves,
      petos: [],
    }).catch((err) => window.alert('No se pudo crear el PowerPoint: ' + (err as Error).message))
  }

  const duplicar = (e: Ejercicio) => {
    try {
      const copia = duplicarEjercicio(e)
      setItems((prev) => [copia, ...(prev ?? [])])
    } catch (err) {
      window.alert((err as Error).message)
    }
  }

  if (error) return <p className="card text-red-700">{error}</p>
  if (!items) return <Spinner texto="Cargando ejercicios…" />

  const visibles =
    filtro === 'Todas'
      ? items
      : filtro === 'Analizadas'
        ? items.filter((i) => analizadas.has(i.id))
        : items.filter((i) => i.categoria === filtro)

  return (
    <div className="space-y-4">
      <div><p className="kicker mb-2">Librería de ejercicios</p><h1 className="page-title">Tareas</h1></div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
        <button
          onClick={() => setFiltro(filtro === 'Analizadas' ? 'Todas' : 'Analizadas')}
          className={`shrink-0 rounded-full px-5 py-2 text-sm font-bold transition ${
            filtro === 'Analizadas'
              ? 'bg-athletic text-white shadow-sm'
              : 'bg-athletic/10 text-athletic ring-1 ring-athletic/30 hover:bg-athletic/20'
          }`}
        >
          Analizadas
        </button>
          <p className="text-sm font-semibold text-neutral-500">
            {visibles.length} {visibles.length === 1 ? 'tarea' : 'tareas'}
          </p>
          <a
            href="#/disenador"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-sm font-bold text-white transition hover:bg-black active:scale-[0.98]"
          >
            <span className="text-base leading-none">+</span> Nueva tarea
          </a>
        </div>
      </div>

      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
        {categorias.map((c) => (
          <button
            key={c}
            onClick={() => setFiltro(c)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-bold transition ${
              filtro === c ? 'bg-ink text-white shadow-sm' : 'bg-white text-neutral-600 ring-1 ring-line hover:text-ink hover:ring-neutral-400'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {visibles.length === 0 ? (
        <div className="card py-10 text-center">
          <p className="mb-4 text-neutral-600">Aún no hay tareas{filtro !== 'Todas' ? ' en este filtro' : ''}.</p>
          <a href="#/disenador" className="btn-primary">
            Crear el primero
          </a>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 lg:gap-4 xl:grid-cols-5 2xl:grid-cols-6">
          {visibles.map((e) => (
            <div
              key={e.id}
              className="group overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-black/5 transition duration-200 hover:-translate-y-0.5 hover:shadow-lift hover:ring-athletic/30"
            >
              <a href={`#/ejercicio/${e.id}`} className="block">
                <div className="relative overflow-hidden bg-neutral-200">
                  {analizadas.has(e.id) && (
                    <span
                      title="Analizada"
                      className="absolute left-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-athletic text-xs font-extrabold text-white shadow"
                    >
                      A
                    </span>
                  )}
                  <img src={e.imagen_url} alt={e.nombre} loading="lazy" className="aspect-[4/3] w-full object-cover transition duration-300 group-hover:scale-105" />
                </div>
                <div className="px-3.5 pb-1 pt-3.5">
                  <p className="line-clamp-2 text-sm font-bold leading-snug group-hover:text-athletic">{e.nombre}</p>
                  {e.categoria && (
                    <span className="chip mt-2 !px-2.5 !py-0.5">
                      {e.categoria}
                    </span>
                  )}
                </div>
              </a>
              <div className="flex items-center gap-1 px-2.5 pb-2.5 pt-1.5">
                <a href={`#/ejercicio/${e.id}`} title="Ver" aria-label="Ver" className={accion}>
                  <Icon name="eye" className="h-4 w-4" />
                </a>
                <a href={`#/ejercicio/${e.id}/editar`} title="Editar" aria-label="Editar" className={accion}>
                  <Icon name="pencil" className="h-4 w-4" />
                </a>
                <button type="button" onClick={() => ficha(e)} title="Ficha PowerPoint" aria-label="Ficha PowerPoint" className={`${accion} !w-auto px-2 text-[10px] font-extrabold tracking-wide`}>
                  FICHA
                </button>
                <button type="button" onClick={() => duplicar(e)} title="Duplicar" aria-label="Duplicar" className={accion}>
                  <Icon name="copy" className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => borrar(e)}
                  title="Borrar"
                  aria-label="Borrar"
                  className={`${accion} ml-auto hover:!bg-red-50 hover:!text-red-600`}
                >
                  <Icon name="trash" className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
