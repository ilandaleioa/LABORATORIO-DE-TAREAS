import { useRef, useState } from 'react'
import { actualizarJugadorPlantilla, crearJugadorPlantilla, eliminarJugadorPlantilla, listarPlantilla } from '../lib/api'
import { EQUIPOS_PLANTILLA, POSICIONES_PLANTILLA } from '../types'
import type { EquipoPlantilla, JugadorPlantilla, PosicionPlantilla } from '../types'
import Icon from '../components/Icons'

const input =
  'w-full rounded-xl border border-line bg-white px-3 py-2 text-sm font-semibold text-ink outline-none focus:border-athletic focus:ring-2 focus:ring-athletic/20'

interface Form {
  dorsal: string
  nombre: string
  apellido: string
  posicion: PosicionPlantilla
  equipo: EquipoPlantilla
  foto: string
}
const vacio: Form = { dorsal: '', nombre: '', apellido: '', posicion: 'Portero', equipo: 'Primer equipo', foto: '' }

// Reduce la imagen a 256px máx. y la guarda como data URL (el almacenamiento es localStorage).
function leerFoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('No se pudo leer la imagen.'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Archivo de imagen no válido.'))
      img.onload = () => {
        const lado = 256
        const esc = Math.min(1, lado / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.width * esc)
        canvas.height = Math.round(img.height * esc)
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', 0.85))
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })
}

export default function Plantillas() {
  const [jugadores, setJugadores] = useState<JugadorPlantilla[]>(() => listarPlantilla())
  const [form, setForm] = useState<Form>(vacio)
  const [editId, setEditId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [filtro, setFiltro] = useState<PosicionPlantilla | 'Todos'>('Todos')

  const [filtroEquipo, setFiltroEquipo] = useState<EquipoPlantilla | 'Todos'>('Todos')

  const [ver, setVer] = useState<JugadorPlantilla | null>(null)

  const formRef = useRef<HTMLFormElement>(null)
  const recargar =() => setJugadores(listarPlantilla())

  const guardar = (e: React.FormEvent) => {
    e.preventDefault()
    const dorsal = Number(form.dorsal)
    const nombre = form.nombre.trim()
    const apellido = form.apellido.trim()
    if (!Number.isInteger(dorsal) || dorsal < 1 || dorsal > 99) return setError('El dorsal debe ser un número entre 1 y 99.')
    if (!nombre || !apellido) return setError('Nombre y primer apellido son obligatorios.')
    if (jugadores.some((j) => j.dorsal === dorsal && (j.equipo ?? 'Primer equipo') === form.equipo && j.id !== editId)) return setError(`El dorsal ${dorsal} ya está asignado en ${form.equipo}.`)
    const datos = { dorsal, nombre, apellido, posicion: form.posicion, equipo: form.equipo, foto: form.foto || undefined }
    if (editId) actualizarJugadorPlantilla(editId, datos)
    else crearJugadorPlantilla(datos)
    setError('')
    setEditId(null)
    setForm(vacio)
    recargar()
  }

  const editar = (j: JugadorPlantilla) => {
    setEditId(j.id)
    setForm({ dorsal: String(j.dorsal), nombre: j.nombre, apellido: j.apellido, posicion: j.posicion, equipo: j.equipo ?? 'Primer equipo', foto: j.foto ?? '' })
    setError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
    setTimeout(() => formRef.current?.querySelector<HTMLInputElement>('input[type=number]')?.focus({ preventScroll: true }), 0)
  }

  // Copia los datos al formulario como alta nueva; el dorsal se deja vacío porque no puede repetirse en el equipo.
  const duplicar = (j: JugadorPlantilla) => {
    setEditId(null)
    setForm({ dorsal: '', nombre: j.nombre, apellido: j.apellido, posicion: j.posicion, equipo: j.equipo ?? 'Primer equipo', foto: j.foto ?? '' })
    setError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
    setTimeout(() => formRef.current?.querySelector<HTMLInputElement>('input[type=number]')?.focus({ preventScroll: true }), 0)
  }

  const elegirFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const foto = await leerFoto(file)
      setForm((f) => ({ ...f, foto }))
      setError('')
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const cancelar = () => {
    setEditId(null)
    setForm(vacio)
    setError('')
  }

  const borrar = (j: JugadorPlantilla) => {
    if (!window.confirm(`¿Eliminar a ${j.nombre} ${j.apellido}?`)) return
    eliminarJugadorPlantilla(j.id)
    if (editId === j.id) cancelar()
    recargar()
  }

  const visibles = jugadores.filter(
    (j) => (filtro === 'Todos' || j.posicion === filtro) && (filtroEquipo === 'Todos' || (j.equipo ?? 'Primer equipo') === filtroEquipo),
  )

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-extrabold">Plantillas</h1>
        <span className="text-sm font-bold text-neutral-500">{jugadores.length} jugadores</span>
      </div>

      <form ref={formRef} onSubmit={guardar} className="grid gap-3 rounded-2xl bg-white p-4 shadow-card ring-1 ring-black/5 sm:grid-cols-2 lg:grid-cols-[64px_100px_1fr_1fr_160px_160px_auto] lg:items-end">
        <div className="space-y-1 text-xs font-bold uppercase tracking-wide text-neutral-500">
          Foto
          <div className="relative">
            <label className="flex h-[38px] w-[38px] cursor-pointer items-center justify-center overflow-hidden rounded-full border border-line bg-white text-lg text-neutral-400 hover:border-athletic hover:text-athletic" title="Subir foto">
              {form.foto ? <img src={form.foto} alt="" className="h-full w-full object-cover" /> : '+'}
              <input type="file" accept="image/*" className="hidden" onChange={elegirFoto} />
            </label>
            {form.foto && (
              <button type="button" onClick={() => setForm({ ...form, foto: '' })} title="Quitar foto" aria-label="Quitar foto" className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-ink text-[10px] leading-none text-white">
                ×
              </button>
            )}
          </div>
        </div>
        <label className="space-y-1 text-xs font-bold uppercase tracking-wide text-neutral-500">
          Dorsal
          <input type="number" min={1} max={99} inputMode="numeric" className={input} value={form.dorsal} onChange={(e) => setForm({ ...form, dorsal: e.target.value })} />
        </label>
        <label className="space-y-1 text-xs font-bold uppercase tracking-wide text-neutral-500">
          Nombre
          <input className={input} value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
        </label>
        <label className="space-y-1 text-xs font-bold uppercase tracking-wide text-neutral-500">
          Primer apellido
          <input className={input} value={form.apellido} onChange={(e) => setForm({ ...form, apellido: e.target.value })} />
        </label>
        <label className="space-y-1 text-xs font-bold uppercase tracking-wide text-neutral-500">
          Posición
          <select className={input} value={form.posicion} onChange={(e) => setForm({ ...form, posicion: e.target.value as PosicionPlantilla })}>
            {POSICIONES_PLANTILLA.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs font-bold uppercase tracking-wide text-neutral-500">
          Equipo
          <select className={input} value={form.equipo} onChange={(e) => setForm({ ...form, equipo: e.target.value as EquipoPlantilla })}>
            {EQUIPOS_PLANTILLA.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <div className="flex gap-2">
          <button type="submit" className="btn-primary whitespace-nowrap">
            {editId ? 'Guardar' : '+ Dar de alta'}
          </button>
          {editId && (
            <button type="button" onClick={cancelar} className="rounded-full px-4 py-2 text-sm font-bold text-neutral-600 ring-1 ring-line hover:text-ink">
              Cancelar
            </button>
          )}
        </div>
        {error && <p className="text-sm font-bold text-red-600 sm:col-span-2 lg:col-span-7">{error}</p>}
      </form>

      <div className="no-scrollbar flex gap-2 overflow-x-auto">
        {(['Todos', ...EQUIPOS_PLANTILLA] as const).map((e) => (
          <button
            key={e}
            onClick={() => setFiltroEquipo(e)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-bold transition ${filtroEquipo === e ? 'bg-athletic text-white' : 'bg-white text-neutral-600 ring-1 ring-line hover:text-ink'}`}
          >
            {e === 'Todos' ? 'Todos los equipos' : e}
          </button>
        ))}
      </div>

      <div className="no-scrollbar flex gap-2 overflow-x-auto">
        {(['Todos', ...POSICIONES_PLANTILLA] as const).map((p) => (
          <button
            key={p}
            onClick={() => setFiltro(p)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-bold transition ${filtro === p ? 'bg-ink text-white' : 'bg-white text-neutral-600 ring-1 ring-line hover:text-ink'}`}
          >
            {p === 'Todos' ? 'Todos' : p + 's'}
          </button>
        ))}
      </div>

      {visibles.length === 0 ? (
        <div className="card py-10 text-center text-neutral-600">{jugadores.length === 0 ? 'Aún no hay jugadores en la plantilla.' : 'No hay jugadores con este filtro.'}</div>
      ) : (
        <div className="space-y-6">
          {POSICIONES_PLANTILLA.map((pos) => {
            const grupo = visibles.filter((j) => j.posicion === pos).sort((a, b) => a.dorsal - b.dorsal)
            if (grupo.length === 0) return null
            return (
              <section key={pos} className="space-y-3">
                <h2 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-neutral-600">
                  {pos}s
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-neutral-500 ring-1 ring-line">{grupo.length}</span>
                </h2>
                <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
                  {grupo.map((j) => (
                    <li key={j.id} className="flex flex-col items-center rounded-2xl bg-white p-2.5 text-center shadow-card ring-1 ring-black/5">
                      {j.foto ? (
                        <div className="relative h-16 w-16 shrink-0">
                          <img src={j.foto} alt={`${j.nombre} ${j.apellido}`} className="h-16 w-16 rounded-full object-cover" />
                          <span className="absolute -bottom-1 -right-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-athletic px-1 text-xs font-extrabold text-white ring-2 ring-white">{j.dorsal}</span>
                        </div>
                      ) : (
                        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-athletic text-xl font-extrabold text-white">{j.dorsal}</span>
                      )}
                      <p className="mt-2 w-full truncate text-xs font-extrabold uppercase">
                        {j.nombre} {j.apellido}
                      </p>
                      <div className="mt-0.5">
                        <span className="chip !px-2.5 !py-0.5">{j.posicion}</span>
                        <span className="ml-1.5 text-xs font-bold text-neutral-500">{j.equipo ?? 'Primer equipo'}</span>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <button onClick={() => setVer(j)} title="Ver" aria-label="Ver" className="text-neutral-400 hover:text-athletic">
                          <Icon name="eye" className="h-4 w-4" />
                        </button>
                        <button onClick={() => editar(j)} className="rounded-full px-2.5 py-1 text-[11px] font-bold text-neutral-600 ring-1 ring-line hover:text-athletic">
                          Editar
                        </button>
                        <button onClick={() => duplicar(j)} title="Duplicar" aria-label="Duplicar" className="text-neutral-400 hover:text-athletic">
                          <Icon name="copy" className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => borrar(j)} title="Eliminar" aria-label="Eliminar" className="text-neutral-400 hover:text-red-600">
                          <Icon name="trash" className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      )}

      {ver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setVer(null)}>
          <div className="w-full max-w-xs rounded-2xl bg-white p-6 text-center shadow-card" onClick={(e) => e.stopPropagation()}>
            {ver.foto ? (
              <img src={ver.foto} alt={`${ver.nombre} ${ver.apellido}`} className="mx-auto h-40 w-40 rounded-full object-cover" />
            ) : (
              <div className="mx-auto flex h-40 w-40 items-center justify-center rounded-full bg-neutral-100 text-sm font-bold text-neutral-400">Sin foto</div>
            )}
            <p className="mt-4 text-lg font-extrabold uppercase">
              {ver.nombre} {ver.apellido}
            </p>
            <p className="mt-1 text-sm font-bold text-neutral-500">
              #{ver.dorsal} · {ver.posicion} · {ver.equipo ?? 'Primer equipo'}
            </p>
            <button onClick={() => setVer(null)} className="btn-primary mt-5">
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
