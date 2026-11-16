import { getStore } from '@netlify/blobs'

/** Almacén compartido: cada clave del localStorage de la app se guarda como un blob. */
const PREFIJOS = ['laboratorio-tareas-', 'tactics-']
const valida = (k: unknown): k is string =>
  typeof k === 'string' && k.length < 200 && PREFIJOS.some((p) => k.startsWith(p))

export default async (req: Request) => {
  const store = getStore('laboratorio')
  const json = (o: unknown, status = 200) =>
    new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })

  try {
    if (req.method === 'GET') {
      const una = new URL(req.url).searchParams.get('clave')
      if (una) {
        if (!valida(una)) return json({ error: 'Clave no válida.' }, 400)
        return json({ valor: await store.get(una, { type: 'text' }) })
      }
      const { blobs } = await store.list()
      const claves: Record<string, string> = {}
      await Promise.all(
        blobs.map(async (b) => {
          const v = await store.get(b.key, { type: 'text' })
          if (v != null) claves[b.key] = v
        }),
      )
      return json({ claves })
    }
    if (req.method === 'PUT') {
      const { clave, valor } = (await req.json()) as { clave?: unknown; valor?: unknown }
      if (!valida(clave) || typeof valor !== 'string') return json({ error: 'Datos no válidos.' }, 400)
      await store.set(clave, valor)
      return json({ ok: true })
    }
    return json({ error: 'Método no permitido.' }, 405)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Error de almacenamiento.' }, 500)
  }
}
