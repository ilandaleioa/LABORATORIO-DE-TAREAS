import { useEffect, useRef, useState } from 'react'
import { listarEjercicios, registrarDesdeDisenador } from '../lib/api'

// Migración única: vuelve a generar las miniaturas de los ejercicios ya guardados con el diseño
// actual del Diseñador (p. ej. zonas en gris claro). Se hace de uno en uno con un iframe oculto.
const CLAVE = 'miniaturas_diseno_v2'

export default function RegenerarMiniaturas() {
  const [cola, setCola] = useState<string[]>([])
  const [actual, setActual] = useState<string | null>(null)
  const ref = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    try {
      if (localStorage.getItem(CLAVE)) return
    } catch {
      return
    }
    listarEjercicios().then((es) => {
      const ids = es.filter((e) => e.diseno_id).map((e) => e.diseno_id as string)
      if (!ids.length) {
        try { localStorage.setItem(CLAVE, '1') } catch { /* sin almacenamiento */ }
        return
      }
      setCola(ids)
      setActual(ids[0])
    })
  }, [])

  useEffect(() => {
    if (!actual) return
    const siguiente = () => {
      setCola((c) => {
        const resto = c.slice(1)
        if (!resto.length) {
          try { localStorage.setItem(CLAVE, '1') } catch { /* sin almacenamiento */ }
        }
        setActual(resto[0] ?? null)
        return resto
      })
    }
    const alMensaje = (e: MessageEvent) => {
      if (e.source !== ref.current?.contentWindow) return
      const d = e.data
      if (!d || String(d.disenoId) !== actual) return
      if (d.acfc === 'ejercicio-guardado') {
        try {
          registrarDesdeDisenador({
            disenoId: actual,
            nombre: String(d.nombre || 'Ejercicio sin título'),
            tipo: String(d.tipo || ''),
            descripcion: String(d.descripcion || ''),
            imagen: String(d.imagen || ''),
          })
        } catch { /* se deja la miniatura anterior */ }
        siguiente()
      } else if (d.acfc === 'regenerar-fallo') {
        siguiente()
      }
    }
    window.addEventListener('message', alMensaje)
    const tope = window.setTimeout(siguiente, 15000)
    return () => {
      window.removeEventListener('message', alMensaje)
      window.clearTimeout(tope)
    }
  }, [actual])

  if (!actual || !cola.length) return null
  return (
    <iframe
      key={actual}
      ref={ref}
      title="Regenerar miniaturas"
      src={`/disenador/index.html?regenerar=${encodeURIComponent(actual)}`}
      aria-hidden
      tabIndex={-1}
      style={{ position: 'fixed', left: -10000, top: 0, width: 1280, height: 800, border: 0, opacity: 0, pointerEvents: 'none' }}
    />
  )
}
