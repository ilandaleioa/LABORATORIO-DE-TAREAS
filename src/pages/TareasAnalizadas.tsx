import { useEffect, useMemo, useState } from 'react'
import { listarTareasAnalizadas, quitarTareaAnalizada } from '../lib/api'
import type { TareaAnalizada } from '../types'
import Spinner from '../components/Spinner'

const SIN_TIPO = 'Sin categoría'
const PENDIENTES = 'Pendientes de analizar'

export default function TareasAnalizadas() {
  const [items, setItems] = useState<TareaAnalizada[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const cargar = () => listarTareasAnalizadas().then(setItems).catch((e) => setError(e.message))
  useEffect(() => {
    cargar()
  }, [])

  const esPendiente = (t: TareaAnalizada) => t.estado === 'pendiente' || !t.resultado

  const grupos = useMemo(() => {
    const m = new Map<string, TareaAnalizada[]>()
    for (const t of items ?? []) {
      // Las pendientes van juntas, en su propio bloque al principio
      const k = esPendiente(t) ? PENDIENTES : t.categoria || SIN_TIPO
      m.set(k, [...(m.get(k) ?? []), t])
    }
    return [...m.entries()].sort((a, b) =>
      a[0] === PENDIENTES ? -1 : b[0] === PENDIENTES ? 1 : a[0].localeCompare(b[0]),
    )
  }, [items])

  if (error) return <p className="card text-red-700">{error}</p>
  if (!items) return <Spinner texto="Cargando tareas analizadas…" />

  return (
    <div className="space-y-6">
      <div>
        <p className="kicker mb-2">Análisis guardados</p>
        <h1 className="page-title">Tareas analizadas</h1>
      </div>

      {grupos.length === 0 ? (
        <div className="card py-10 text-center">
          <p className="mb-3 text-neutral-600">
            Aún no hay tareas analizadas. Abre un ejercicio y pulsa «Analizar objetivos»: se guardará aquí, agrupado por tipo de tarea.
          </p>
          <a href="#/tareas" className="btn-primary">Ir a la librería</a>
        </div>
      ) : (
        grupos.map(([tipo, tareas]) => (
          <section key={tipo} className="space-y-3">
            <h2 className="flex items-center gap-2 border-b border-line pb-2 text-base font-extrabold uppercase tracking-wide text-ink">
              {tipo}
              <span className="chip !px-2 !py-0.5">{tareas.length}</span>
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {tareas.map((t) => (
                <article key={t.id} className="card-hover overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-black/5">
                  <a href={`#/ejercicio/${t.ejercicio_id}`} className="flex gap-3 p-3">
                    {t.imagen_url ? (
                      <img src={t.imagen_url} alt={t.nombre} loading="lazy" className="h-20 w-28 shrink-0 rounded-lg bg-neutral-200 object-cover ring-1 ring-black/5" />
                    ) : (
                      <div className="h-20 w-28 shrink-0 rounded-lg bg-neutral-200 ring-1 ring-black/5" />
                    )}
                    <div className="min-w-0">
                      <p className="font-bold leading-snug">{t.nombre}</p>
                      {t.resultado ? (
                        t.resultado.principal && (
                          <p className="mt-1 line-clamp-3 text-sm text-neutral-600">{t.resultado.principal}</p>
                        )
                      ) : (
                        <>
                          {t.categoria && <p className="mt-0.5 text-xs text-neutral-500">{t.categoria}</p>}
                          <span className="chip mt-1.5 !px-2 !py-0.5">Pendiente de analizar</span>
                        </>
                      )}
                    </div>
                  </a>
                  <div className="flex items-center justify-between border-t border-neutral-100 bg-neutral-50/60 px-3 py-2 text-xs text-neutral-500">
                    <span>
                      {t.resultado ? `${t.resultado.objetivos.length} objetivos · ` : 'Sin analizar · '}
                      {new Date(t.created_at).toLocaleDateString('es-ES')}
                    </span>
                    <button
                      className="link-action"
                      onClick={() => {
                        if (confirm('¿Quitar de Tareas analizadas?')) {
                          quitarTareaAnalizada(t.id)
                          cargar()
                        }
                      }}
                    >
                      Quitar
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  )
}
