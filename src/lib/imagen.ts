export const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp']
export const MAX_BYTES = 10 * 1024 * 1024 // 10 MB de entrada

export function validarImagen(file: File): string | null {
  if (!TIPOS_PERMITIDOS.includes(file.type)) return 'Formato no válido. Usa JPG, PNG o WebP.'
  if (file.size > MAX_BYTES) return 'La imagen supera los 10 MB.'
  return null
}

function cargar(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('No se pudo leer la imagen.'))
    img.src = src
  })
}

/** Reduce la imagen (lado máx. 1600px) y la convierte a JPEG para limitar tamaño. */
export async function comprimir(blob: Blob, maxLado = 1600, calidad = 0.85): Promise<Blob> {
  const url = URL.createObjectURL(blob)
  try {
    const img = await cargar(url)
    const escala = Math.min(1, maxLado / Math.max(img.width, img.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.width * escala)
    canvas.height = Math.round(img.height * escala)
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return await new Promise((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Error al comprimir.'))), 'image/jpeg', calidad),
    )
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function blobABase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(String(fr.result).split(',')[1])
    fr.onerror = () => reject(new Error('Error al codificar la imagen.'))
    fr.readAsDataURL(blob)
  })
}

/** Descarga una imagen por URL y la prepara (base64 JPEG comprimido) para el análisis. */
export async function urlABase64(url: string): Promise<{ base64: string; mediaType: string }> {
  const r = await fetch(url)
  if (!r.ok) throw new Error('No se pudo descargar la imagen del ejercicio.')
  const jpg = await comprimir(await r.blob(), 1400, 0.8)
  return { base64: await blobABase64(jpg), mediaType: 'image/jpeg' }
}
