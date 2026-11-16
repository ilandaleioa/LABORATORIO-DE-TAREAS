import type { VercelRequest, VercelResponse } from '@vercel/node'

// Función serverless: la API key de Anthropic solo existe aquí (variable de entorno del servidor).

const MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_BASE64_CHARS = 4_000_000 // ~3 MB de imagen; Vercel limita el body a 4,5 MB

const SYSTEM_PROMPT = `Eres un analista táctico de fútbol de élite. Vas a recibir la imagen de un ejercicio de entrenamiento y su descripción. Identifica: 1) los puntos clave del ejercicio (objetivo, mecánica, condicionantes), 2) los roles que debe cumplir cada jugador o posición representada en el ejercicio, con una descripción breve y accionable de cada rol.

Si se indican modificadores (comodines, porterías añadidas), analiza específicamente cómo cambian los puntos clave y los roles respecto al ejercicio base. Recibirás el análisis base: compáralo explícitamente y explica el impacto (superioridad o inferioridad numérica, cambios de rol, nuevas referencias espaciales, nuevas opciones de finalización o de salida de balón, cambios de intensidad o de toma de decisiones). Los comodines son jugadores neutros (o de apoyo) que siempre juegan con el equipo que tiene el balón; las porterías añadidas son porterías adicionales que crean nuevos objetivos de finalización o referencias de orientación.

Responde ÚNICAMENTE con JSON válido, sin texto adicional, sin markdown ni bloques de código, con exactamente este esquema:
{
  "puntos_clave": ["string", "..."],
  "roles": [{ "posicion": "string", "descripcion": "string" }],
  "dinamica_general": "string (2-4 frases con la dinámica global del ejercicio)",
  "impacto_modificadores": "string (solo si hay modificadores: explicación comparativa frente al ejercicio base; si no, cadena vacía)"
}
Escribe en español. Entre 3 y 7 puntos clave. Un rol por cada posición o jugador distinto representado.`

interface Rol {
  posicion: string
  descripcion: string
}
interface Resultado {
  puntos_clave: string[]
  roles: Rol[]
  dinamica_general: string
  impacto_modificadores: string
}

function extraerJSON(texto: string): unknown {
  const ini = texto.indexOf('{')
  const fin = texto.lastIndexOf('}')
  if (ini === -1 || fin <= ini) throw new Error('Sin JSON en la respuesta')
  return JSON.parse(texto.slice(ini, fin + 1))
}

function validar(x: unknown): Resultado {
  const o = x as Record<string, unknown>
  if (!o || !Array.isArray(o.puntos_clave) || !Array.isArray(o.roles)) {
    throw new Error('Esquema inválido')
  }
  const roles = (o.roles as Record<string, unknown>[]).map((r) => ({
    posicion: String(r?.posicion ?? '').trim(),
    descripcion: String(r?.descripcion ?? '').trim(),
  }))
  if (roles.some((r) => !r.posicion)) throw new Error('Rol sin posición')
  return {
    puntos_clave: (o.puntos_clave as unknown[]).map((p) => String(p)),
    roles,
    dinamica_general: String(o.dinamica_general ?? ''),
    impacto_modificadores: String(o.impacto_modificadores ?? ''),
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
  const { imagen_base64, media_type, descripcion, modificadores, analisis_base } = body as {
    imagen_base64?: string
    media_type?: string
    descripcion?: string
    modificadores?: { comodines?: number; porterias?: number }
    analisis_base?: unknown
  }

  if (!imagen_base64 || typeof imagen_base64 !== 'string' || imagen_base64.length > MAX_BASE64_CHARS) {
    return res.status(400).json({ error: 'Imagen ausente o demasiado grande.' })
  }
  if (!media_type || !MEDIA_TYPES.includes(media_type)) {
    return res.status(400).json({ error: 'Tipo de imagen no soportado.' })
  }

  const comodines = Math.max(0, Math.min(20, Number(modificadores?.comodines) || 0))
  const porterias = Math.max(0, Math.min(20, Number(modificadores?.porterias) || 0))
  const hayMods = comodines > 0 || porterias > 0

  let texto = `Descripción del ejercicio:\n${String(descripcion ?? '').slice(0, 4000) || '(sin descripción)'}\n\n`
  if (hayMods) {
    texto += `Modificadores activos: ${comodines} comodín(es) añadido(s), ${porterias} portería(s) añadida(s).\n`
    if (analisis_base) {
      texto += `\nAnálisis base (ejercicio sin modificadores):\n${JSON.stringify(analisis_base).slice(0, 8000)}\n`
    }
    texto += '\nAnaliza el ejercicio CON estos modificadores y rellena "impacto_modificadores" comparando contra el análisis base.'
  } else {
    texto += 'Modificadores activos: ninguno. Haz el análisis base del ejercicio.'
  }

  const MAX_INTENTOS = 2
  let ultimoError = ''

  for (let intento = 1; intento <= MAX_INTENTOS; intento++) {
    try {
      const textoUsuario = intento > 1 ? texto + '\n\nIMPORTANTE: responde solo con el objeto JSON, nada más.' : texto
      const r =
        proveedor === 'openai'
          ? await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
              body: JSON.stringify({
                model,
                max_tokens: 3000,
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
                max_tokens: 3000,
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
        const detalle = await r.text()
        console.error('Error de la API de IA', proveedor, r.status, detalle)
        // Errores de cliente/auth no se reintentan
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
      const resultado = validar(extraerJSON(salida))
      return res.status(200).json({ resultado, modelo: model })
    } catch (e) {
      ultimoError = 'El modelo no devolvió un JSON válido.'
      console.error('Intento', intento, e)
    }
  }

  return res.status(502).json({ error: `${ultimoError} Inténtalo de nuevo.` })
}
