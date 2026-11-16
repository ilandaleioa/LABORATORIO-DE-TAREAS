import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// En desarrollo (npm run dev) sirve las funciones de /api como lo haría Vercel,
// leyendo ANTHROPIC_API_KEY y ANTHROPIC_MODEL del archivo .env
function apiLocal(env: Record<string, string>): Plugin {
  return {
    name: 'api-local',
    apply: 'serve',
    configureServer(server) {
      Object.assign(process.env, env)
      server.middlewares.use(async (req, res, next) => {
        const m = req.url?.match(/^\/api\/([\w-]+)/)
        if (!m) return next()
        try {
          const mod = await server.ssrLoadModule(`/api/${m[1]}.ts`)
          const chunks: Buffer[] = []
          for await (const c of req) chunks.push(c as Buffer)
          const raw = Buffer.concat(chunks).toString('utf8')
          const vreq = Object.assign(req, { body: raw ? JSON.parse(raw) : {} })
          const vres = Object.assign(res, {
            status(code: number) {
              res.statusCode = code
              return vres
            },
            json(data: unknown) {
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify(data))
              return vres
            },
          })
          await mod.default(vreq, vres)
        } catch (e) {
          console.error(e)
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Error en la función local: ' + (e as Error).message }))
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), apiLocal(loadEnv(mode, process.cwd(), ''))],
}))
