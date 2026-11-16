import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  src?: string
  alt: string
  /** id del ejercicio en el Diseñador, para abrirlo ahí al pulsar «editar» */
  disenoId?: string
}

/** Imagen del ejercicio en solo lectura: se amplía al pulsarla y tiene botón para retocarla en el diseñador. */
export default function VisorImagen({ src, alt, disenoId }: Props) {
  const [zoom, setZoom] = useState(false)

  useEffect(() => {
    if (!zoom) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setZoom(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [zoom])

  const hrefEditar = disenoId ? `#/disenador?abrir=${encodeURIComponent(disenoId)}` : '#/disenador'

  return (
    <div className="relative">
      <img
        src={src}
        alt={alt}
        title="Pulsa para ampliar"
        onClick={() => setZoom(true)}
        className="max-h-[70vh] w-full cursor-zoom-in rounded-xl border border-line bg-white object-contain p-2"
      />
      <div className="absolute right-2 top-2 flex gap-1.5">
        <button
          type="button"
          title="Ver a pantalla grande"
          aria-label="Ver a pantalla grande"
          onClick={() => setZoom(true)}
          className="flex h-7 w-7 items-center justify-center rounded-full border border-neutral-300 bg-white/90 text-sm shadow"
        >
          🔍
        </button>
        <a
          href={hrefEditar}
          onClick={(ev) => { if (!disenoId && !window.confirm('Esta tarea no se creó en el Diseñador (viene de una imagen), así que no hay nada que editar allí. ¿Abrir el Diseñador en blanco de todas formas?')) ev.preventDefault() }}
          title="Editar en el diseñador"
          aria-label="Editar en el diseñador"
          className="flex h-7 w-7 items-center justify-center rounded-full border border-neutral-300 bg-white/90 text-sm shadow"
        >
          ✏️
        </a>
      </div>
      {zoom && src && createPortal(
        <div
          onClick={() => setZoom(false)}
          className="fixed inset-0 z-[2000] flex cursor-zoom-out items-center justify-center bg-black/90 p-2"
        >
          <img src={src} alt={`${alt} ampliado`} className="h-full w-full rounded-lg object-contain" />
          <a
            href={hrefEditar}
            onClick={(ev) => { if (!disenoId && !window.confirm('Esta tarea no se creó en el Diseñador (viene de una imagen), así que no hay nada que editar allí. ¿Abrir el Diseñador en blanco de todas formas?')) ev.preventDefault() }}
            className="absolute left-4 top-4 rounded-full bg-white px-3 py-1 text-sm font-bold"
          >
            ✏️ Editar en el diseñador
          </a>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={() => setZoom(false)}
            className="absolute right-4 top-4 rounded-full bg-white px-3 py-1 text-lg font-bold"
          >
            ✕
          </button>
        </div>,
        document.body,
      )}
    </div>
  )
}
