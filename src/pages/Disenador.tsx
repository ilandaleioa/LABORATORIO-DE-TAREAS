import { useEffect, useRef, useState } from 'react'
import { registrarDesdeDisenador } from '../lib/api'

// Diseñador de tareas (herramienta independiente, copiada de disenador-tareas-ac-center).
// Se sirve desde /disenador/index.html y se incrusta aquí. Al guardar un ejercicio, el diseñador
// avisa (postMessage) y se registra en «Tareas analizadas» como pendiente de analizar.
export default function Disenador() {
  const ref = useRef<HTMLIFrameElement>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  // #/disenador?abrir=<id> abre ese ejercicio ya guardado para retocarlo
  const abrir = new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('abrir')


  useEffect(() => {
    const alMensaje = (e: MessageEvent) => {
      if (e.source !== ref.current?.contentWindow) return
      const d = e.data
      if (!d || d.acfc !== 'ejercicio-guardado' || !d.disenoId) return
      try {
        registrarDesdeDisenador({
          disenoId: String(d.disenoId),
          nombre: String(d.nombre || 'Ejercicio sin título'),
          tipo: String(d.tipo || ''),
          descripcion: String(d.descripcion || ''),
          imagen: String(d.imagen || ''),
        })
        setAviso('Ejercicio guardado y enviado a Tareas (pendiente de analizar).')
      } catch (err) {
        setAviso(err instanceof Error ? err.message : 'No se pudo enviar a Tareas.')
      }
      window.setTimeout(() => setAviso(null), 6000)
    }
    window.addEventListener('message', alMensaje)
    return () => window.removeEventListener('message', alMensaje)
  }, [])

  return (
    <div id="disenador-caja" className="relative bg-white">
      <iframe
        ref={ref}
        src={abrir ? `/disenador/index.html?abrir=${encodeURIComponent(abrir)}` : '/disenador/index.html'}
        title="Diseñador de tareas"
        className="block w-full border-0"
        style={{ height: 'calc(100vh - 62px)' }}
        allow="fullscreen"
      />
      {aviso && (
        <div className="fixed bottom-6 left-1/2 z-30 -translate-x-1/2 rounded-xl bg-ink px-4 py-3 text-sm font-bold text-white shadow-lg">
          {aviso}{' '}
          <a href="#/" className="underline">Ver</a>
        </div>
      )}
    </div>
  )
}
