import type { VercelRequest, VercelResponse } from '@vercel/node'

// Rellena automáticamente la ficha de un ejercicio (nombre, categoría, descripción, normas,
// variantes y puntos clave) a partir de su imagen. La API key solo existe en el servidor.

const MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_BASE64_CHARS = 4_000_000
const CATEGORIAS = ['Rondo', 'Posesión', 'Finalización', 'Transición', 'Presión', 'Juego de posición', 'Balón parado', 'Otro']

const SYSTEM_PROMPT = `Eres un entrenador de fútbol de élite. Recibirás la imagen de un ejercicio de entrenamiento (normalmente un diagrama táctico). Observa el espacio, los jugadores y colores, balones, porterías, flechas de movimiento y pase, y cualquier texto visible, y redacta la ficha del ejercicio.

Responde ÚNICAMENTE con JSON válido, sin texto adicional, sin markdown ni bloques de código, con exactamente este esquema:
{
  "nombre": "string (corto, ej.: Rondo 5v2)",
  "categoria": "una de: ${CATEGORIAS.join(' | ')}",
  "descripcion": "string (2-4 frases: espacio aproximado, nº de jugadores y roles, mecánica). NO incluyas aquí el objetivo",
  "objetivo": "string (1-2 frases: qué se pretende conseguir con la tarea; propuesta de objetivos principales)",
  "normas": ["string", "..."],
  "variantes": ["string", "..."],
  "claves": ["string", "..."]
}
Si el entrenador aporta su propia descripción (puede incluir qué es cada elemento: jugadores, portero, balón, porterías, colores), esa descripción MANDA sobre lo que veas en la imagen: úsala como base, respétala y deduce de ella y de la imagen las normas, variantes y puntos clave coherentes. En ese caso, en "descripcion" devuelve su texto sin cambiar su contenido (solo ortografía y puntuación).
Escribe en español. Entre 3 y 5 elementos en normas, variantes y claves. No inventes elementos que no se vean; si algo es una suposición razonable (p. ej. dimensiones), di "aprox.".`

function extraerJSON(texto: string): unknown {
  const ini = texto.indexOf('{')
  const fin = texto.lastIndexOf('}')
  if (ini === -1 || fin <= ini) throw new Error('Sin JSON en la respuesta')
  return JSON.parse(texto.slice(ini, fin + 1))
}

const lista = (v: unknown): string =>
  (Array.isArray(v) ? v : [])
    .map((x) => String(x).trim().replace(/^[-•*]\s*/, ''))
    .filter(Boolean)
    .map((x) => `- ${x}`)
    .join('\n')

function validar(x: unknown) {
  const o = x as Record<string, unknown>
  const descripcion = String(o?.descripcion ?? '').trim()
  if (!o || !descripcion) throw new Error('Esquema inválido')
  const cat = String(o.categoria ?? '').trim()
  return {
    nombre: String(o.nombre ?? '').trim().slice(0, 120),
    categoria: CATEGORIAS.find((c) => c.toLowerCase() === cat.toLowerCase()) ?? '',
    descripcion: descripcion.slice(0, 2000),
    objetivo: String(o.objetivo ?? '').trim().slice(0, 500),
    normas: lista(o.normas).slice(0, 1000),
    variantes: lista(o.variantes).slice(0, 1000),
    claves: lista(o.claves).slice(0, 1000),
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Método no permitido' })
  }

  const esClave = (v?: string) => Boolean(v) && !String(v).startsWith('PEGA_')
  const proveedor =
    process.env.AI_PROVIDER === 'anthropic'
      ? 'anthropic'
      : process.env.AI_PROVIDER === 'openai' || esClave(process.env.OPENAI_API_KEY)
        ? 'openai'
        : 'anthropic'
  const apiKey = proveedor === 'openai' ? process.env.OPENAI_API_KEY : process.env.ANTHROPIC_API_KEY
  const model = proveedor === 'openai' ? process.env.OPENAI_MODEL || 'gpt-4o' : process.env.ANTHROPIC_MODEL
  if (!esClave(apiKey) || !model) {
    return res.status(500).json({
      error:
        proveedor === 'openai'
          ? 'Servidor sin configurar: falta OPENAI_API_KEY.'
          : 'Servidor sin configurar: faltan ANTHROPIC_API_KEY o ANTHROPIC_MODEL.',
    })
  }

  const body = (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body) ?? {}
  const { imagen_base64, media_type, descripcion } = body as { imagen_base64?: string; media_type?: string; descripcion?: string }

  if (!imagen_base64 || typeof imagen_base64 !== 'string' || imagen_base64.length > MAX_BASE64_CHARS) {
    return res.status(400).json({ error: 'Imagen ausente o demasiado grande.' })
  }
  if (!media_type || !MEDIA_TYPES.includes(media_type)) {
    return res.status(400).json({ error: 'Tipo de imagen no soportado.' })
  }

  const desc = String(descripcion ?? '').trim().slice(0, 3000)
  const texto = desc
    ? `Descripción del entrenador (dictada o escrita por él):
${desc}

Rellena la ficha de este ejercicio teniéndola en cuenta.`
    : 'Rellena la ficha de este ejercicio.'
  let ultimoError = ''

  for (let intento = 1; intento <= 2; intento++) {
    try {
      const textoUsuario = intento > 1 ? texto + '\n\nIMPORTANTE: responde solo con el objeto JSON, nada más.' : texto
      const r =
        proveedor === 'openai'
          ? await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
              body: JSON.stringify({
                model,
                max_tokens: 2000,
                response_format: { type: 'json_object' },
                messages: [
                  { role: 'system', content: SYSTEM_PROMPT },
                  {
                    role: 'user',
                    content: [
                      { type: 'image_url', image_url: { url: `data:${media_type};base64,${imagen_base64}` } },
                      { type: 'text', text: textoUsuario },
                    ],
                  },
                ],
              }),
            })
          : await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: { 'content-type': 'application/json', 'x-api-key': apiKey!, 'anthropic-version': '2023-06-01' },
              body: JSON.stringify({
                model,
                max_tokens: 2000,
                system: SYSTEM_PROMPT,
                messages: [
                  {
                    role: 'user',
                    content: [
                      { type: 'image', source: { type: 'base64', media_type, data: imagen_base64 } },
                      { type: 'text', text: textoUsuario },
                    ],
                  },
                ],
              }),
            })

      if (!r.ok) {
        console.error('Error de la API de IA', proveedor, r.status, await r.text())
        if (r.status < 500 && r.status !== 429) {
          return res.status(502).json({ error: `Error de la API de IA (${r.status}). Revisa la clave y el modelo configurados.` })
        }
        ultimoError = `Error ${r.status} de la API de IA.`
        continue
      }

      const data = (await r.json()) as {
        content?: { type: string; text?: string }[]
        choices?: { message?: { content?: string } }[]
      }
      const salida =
        proveedor === 'openai'
          ? (data.choices?.[0]?.message?.content ?? '')
          : (data.content ?? []).filter((b) => b.type === 'text').map((b) => b.text ?? '').join('')
      return res.status(200).json({ resultado: validar(extraerJSON(salida)), modelo: model })
    } catch (e) {
      ultimoError = 'El modelo no devolvió un JSON válido.'
      console.error('Intento', intento, e)
    }
  }

  return res.status(502).json({ error: `${ultimoError} Inténtalo de nuevo.` })
}
