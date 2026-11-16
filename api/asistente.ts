import type { VercelRequest, VercelResponse } from '@vercel/node'

// Asistente: la IA analiza el ejercicio y explica qué objetivos se pueden cumplir con él.
// La API key de Anthropic solo existe aquí (variable de entorno del servidor).

const MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_BASE64_CHARS = 4_000_000

const SYSTEM_PROMPT = `Eres un entrenador y analista táctico de fútbol de élite. Recibirás la imagen de un ejercicio de entrenamiento y, opcionalmente, su descripción. Analiza el ejercicio (espacio, número de jugadores, estructura, reglas visibles) y explica qué objetivos de entrenamiento se pueden cumplir con él.

Responde ÚNICAMENTE con JSON válido, sin texto adicional, sin markdown ni bloques de código, con exactamente este esquema:
{
  "resumen": "string (2-3 frases: qué es el ejercicio y cómo funciona)",
  "objetivos": [
    { "tipo": "tactico" | "tecnico" | "fisico" | "psicologico", "objetivo": "string (título corto)", "explicacion": "string (por qué el ejercicio lo trabaja y cómo potenciarlo)" }
  ],
  "principal": "string (el objetivo principal más claro del ejercicio, en una frase)",
  "consignas": {
    "conBalon": ["string (consigna breve para el equipo con balón)"],
    "sinBalon": ["string (consigna breve para el equipo sin balón)"]
  },
  "roles": {
    "rojo": ["string (clave que debe cumplir cada jugador del equipo rojo)"],
    "azul": ["string (clave que debe cumplir cada jugador del equipo azul)"],
    "naranja": ["string (clave que debe cumplir cada jugador naranja/neutro/comodín)"]
  }
}
En "roles" explica el rol de los jugadores de cada equipo (rojo, azul y naranja, este último = comodines/neutros) con 3 o 4 claves accionables por equipo, según lo que se vea o describa en el ejercicio. Si en la imagen no hay jugadores de un color, devuelve para ese equipo una lista vacía.
Entre 3 y 5 consignas para cada equipo (con balón = el que ataca/posee; sin balón = el que defiende/presiona), claras y accionables, como las daría un entrenador durante el ejercicio.
Escribe en español. Entre 4 y 8 objetivos, priorizando los más relevantes y sin inventar elementos que no se vean ni se describan.`

const TIPOS = ['tactico', 'tecnico', 'fisico', 'psicologico']

function extraerJSON(texto: string): unknown {
  const ini = texto.indexOf('{')
  const fin = texto.lastIndexOf('}')
  if (ini === -1 || fin <= ini) throw new Error('Sin JSON en la respuesta')
  return JSON.parse(texto.slice(ini, fin + 1))
}

function validar(x: unknown) {
  const o = x as Record<string, unknown>
  if (!o || !Array.isArray(o.objetivos) || o.objetivos.length === 0) throw new Error('Esquema inválido')
  const objetivos = (o.objetivos as Record<string, unknown>[])
    .map((b) => {
      const tipo = String(b?.tipo ?? '').toLowerCase()
      return {
        tipo: TIPOS.includes(tipo) ? tipo : 'tactico',
        objetivo: String(b?.objetivo ?? '').trim(),
        explicacion: String(b?.explicacion ?? '').trim(),
      }
    })
    .filter((b) => b.objetivo)
  if (objetivos.length === 0) throw new Error('Sin objetivos')
  const lista = (v: unknown) =>
    Array.isArray(v) ? v.map((s) => String(s ?? '').trim()).filter(Boolean) : []
  const c = (o.consignas ?? {}) as Record<string, unknown>
  const r = (o.roles ?? {}) as Record<string, unknown>
  return {
    resumen: String(o.resumen ?? ''),
    principal: String(o.principal ?? ''),
    objetivos,
    consignas: { conBalon: lista(c.conBalon), sinBalon: lista(c.sinBalon) },
    roles: { rojo: lista(r.rojo), azul: lista(r.azul), naranja: lista(r.naranja) },
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Método no permitido' })
  }

  // Proveedor: OpenAI si hay OPENAI_API_KEY (o AI_PROVIDER=openai); si no, Anthropic.
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
  const { imagen_base64, media_type, descripcion } = body as {
    imagen_base64?: string
    media_type?: string
    descripcion?: string
  }

  if (!imagen_base64 || typeof imagen_base64 !== 'string' || imagen_base64.length > MAX_BASE64_CHARS) {
    return res.status(400).json({ error: 'Imagen ausente o demasiado grande.' })
  }
  if (!media_type || !MEDIA_TYPES.includes(media_type)) {
    return res.status(400).json({ error: 'Tipo de imagen no soportado.' })
  }

  const texto = `Descripción del ejercicio:\n${String(descripcion ?? '').slice(0, 4000) || '(sin descripción)'}`
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
                max_tokens: 2500,
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
              headers: {
                'content-type': 'application/json',
                'x-api-key': apiKey!,
                'anthropic-version': '2023-06-01',
              },
              body: JSON.stringify({
                model,
                max_tokens: 2500,
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
