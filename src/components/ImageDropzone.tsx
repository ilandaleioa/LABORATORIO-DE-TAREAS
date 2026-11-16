import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { validarImagen } from '../lib/imagen'

interface Props {
  file: File | null
  onChange: (f: File | null) => void
  /** id del ejercicio en el Diseñador, para abrirlo ahí al pulsar «editar» */
  disenoId?: string
}

export default function ImageDropzone({ file, onChange, disenoId }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [zoom, setZoom] = useState(false)

  useEffect(() => {
    if (!zoom) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setZoom(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [zoom])

  useEffect(() => {
    if (!file) return setPreview(null)
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  function aceptar(f: File | undefined) {
    if (!f) return
    const err = validarImagen(f)
    setError(err)
    if (!err) onChange(f)
  }

  return (
    <div>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setOver(false)
          aceptar(e.dataTransfer.files[0])
        }}
        className={`flex min-h-[7rem] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-2 text-center transition ${
          over ? 'border-athletic bg-athletic-light' : 'border-neutral-300 bg-white'
        }`}
      >
        {preview ? (
          <img
            src={preview}
            alt="Vista previa del ejercicio"
            title="Pulsa para ampliar"
            onClick={(e) => {
              e.stopPropagation()
              setZoom(true)
            }}
            className="max-h-[70vh] w-full cursor-zoom-in rounded-lg object-contain"
          />
        ) : (
          <>
            <span className="text-3xl">🖼️</span>
            <p className="mt-2 text-sm font-semibold">Toca para elegir o arrastra la imagen</p>
            <p className="text-xs text-neutral-500">JPG, PNG o WebP · máx. 10 MB</p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => aceptar(e.target.files?.[0])}
        />
      </div>
      {file && (
        <div className="mt-1 flex justify-center gap-3">
          <button
            type="button"
            title="Ver a pantalla grande"
            aria-label="Ver a pantalla grande"
            onClick={() => setZoom(true)}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-300 bg-white text-lg text-neutral-700"
          >
            🔍
          </button>
          <a
            href={disenoId ? `#/disenador?abrir=${encodeURIComponent(disenoId)}` : '#/disenador'}
            onClick={(ev) => { if (!disenoId && !window.confirm('Esta tarea no se creó en el Diseñador (viene de una imagen), así que no hay nada que editar allí. ¿Abrir el Diseñador en blanco de todas formas?')) ev.preventDefault() }}
            title="Editar en el diseñador"
            aria-label="Editar en el diseñador"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-300 bg-white text-lg text-neutral-700"
          >
            ✏️
          </a>
          <button
            type="button"
            title="Cambiar imagen"
            aria-label="Cambiar imagen"
            onClick={() => inputRef.current?.click()}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-300 bg-white text-lg text-neutral-700"
          >
            🔄
          </button>
          <button
            type="button"
            title="Quitar imagen"
            aria-label="Quitar imagen"
            onClick={() => onChange(null)}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-300 bg-white text-lg text-athletic"
          >
            🗑️
          </button>
        </div>
      )}
      {zoom && preview && createPortal(
        <div
          onClick={() => setZoom(false)}
          className="fixed inset-0 z-[2000] flex cursor-zoom-out items-center justify-center bg-black/90 p-2"
        >
          <img src={preview} alt="Ejercicio ampliado" className="h-full w-full rounded-lg object-contain" />
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
      {error && <p className="mt-2 text-sm font-medium text-red-700">{error}</p>}
    </div>
  )
}
