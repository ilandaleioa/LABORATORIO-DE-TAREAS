import { useRef } from 'react'

/**
 * Los datos viven en el localStorage del navegador, que es distinto en cada dirección
 * (localhost, Netlify…). Este botón exporta/importa una copia para pasarlos de uno a otro.
 */
const PREFIJOS = ['laboratorio-tareas-', 'tactics-']

function claves(): string[] {
  const out: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k && PREFIJOS.some((p) => k.startsWith(p))) out.push(k)
  }
  return out
}

export default function CopiaSeguridad() {
  const input = useRef<HTMLInputElement>(null)

  const exportar = () => {
    const datos: Record<string, string> = {}
    for (const k of claves()) datos[k] = localStorage.getItem(k) ?? ''
    const blob = new Blob([JSON.stringify({ version: 1, datos })], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `laboratorio-tareas-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const importar = async (file: File) => {
    try {
      const json = JSON.parse(await file.text()) as { datos?: Record<string, string> }
      const datos = json.datos
      if (!datos || typeof datos !== 'object') throw new Error('formato')
      const ks = Object.keys(datos).filter((k) => PREFIJOS.some((p) => k.startsWith(p)))
      if (!ks.length) throw new Error('vacío')
      if (!window.confirm('Esto reemplazará los datos de este navegador por los del archivo. ¿Continuar?')) return
      for (const k of ks) localStorage.setItem(k, String(datos[k]))
      window.location.reload()
    } catch {
      window.alert('El archivo no es una copia válida del Laboratorio de Tareas.')
    }
  }

  const cls =
    'rounded-full px-3 py-2 text-xs font-bold text-ink ring-1 ring-line transition hover:text-athletic'
  return (
    <div className="ml-2 hidden items-center gap-1 sm:flex">
      <button type="button" onClick={exportar} title="Descargar copia de los datos" className={cls}>
        Exportar
      </button>
      <button type="button" onClick={() => input.current?.click()} title="Cargar copia de los datos" className={cls}>
        Importar
      </button>
      <input
        ref={input}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) void importar(f)
        }}
      />
    </div>
  )
}
