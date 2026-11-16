// Adaptador: ejecuta los handlers estilo Vercel (api/*.ts) dentro de Netlify Functions.
type Handler = (req: any, res: any) => unknown

export function adaptar(handler: Handler) {
  return async (request: Request): Promise<Response> => {
    const raw = await request.text()
    let body: unknown = {}
    try {
      body = raw ? JSON.parse(raw) : {}
    } catch {
      body = {}
    }
    const headers = new Headers()
    let status = 200
    let payload = ''
    const res = {
      setHeader(k: string, v: string) {
        headers.set(k, v)
      },
      status(c: number) {
        status = c
        return res
      },
      json(d: unknown) {
        headers.set('content-type', 'application/json')
        payload = JSON.stringify(d)
        return res
      },
    }
    await handler({ method: request.method, body, headers: Object.fromEntries(request.headers) }, res)
    return new Response(payload, { status, headers })
  }
}
