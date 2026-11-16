/**
 * Sincroniza el localStorage de la app (laboratorio-tareas-*, tactics-*) con un almacén compartido
 * en Netlify (función /api/datos) para que lo que añade un usuario lo vean y conserven los demás.
 * Las listas de filas con `id` se fusionan (unión por id; la versión local gana en conflicto) y los
 * borrados se propagan con `_borrados`. Solo actúa en el sitio publicado, no en localhost.
 */
const PREFIJOS = ['laboratorio-tareas-', 'tactics-']
const esNuestra = (k: string | null): k is string => !!k && PREFIJOS.some((p) => k.startsWith(p))

const enLocal = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) || location.hostname.endsWith('.localhost')
const sincronizado = new Map<string, string>() // último valor igual en local y servidor

type Fila = { id?: unknown }
const esObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x)
const esFilas = (x: unknown): x is Fila[] => Array.isArray(x) && x.every((f) => esObj(f) && 'id' in f)

function fusionar(r: unknown, l: unknown): unknown {
  if (esFilas(r) && esFilas(l)) {
    const m = new Map<unknown, Fila>(r.map((f) => [f.id, f]))
    for (const f of l) m.set(f.id, f)
    return [...m.values()]
  }
  if (esObj(r) && esObj(l)) {
    const out: Record<string, unknown> = {}
    for (const k of new Set([...Object.keys(r), ...Object.keys(l)])) {
      if (k === '_borrados') out[k] = [...new Set([...((r[k] as string[]) ?? []), ...((l[k] as string[]) ?? [])])]
      else out[k] = k in r && k in l ? fusionar(r[k], l[k]) : (l[k] ?? r[k])
    }
    const b = new Set((out._borrados as string[] | undefined) ?? [])
    if (b.size) for (const k of Object.keys(out)) if (esFilas(out[k])) out[k] = (out[k] as Fila[]).filter((f) => !b.has(String(f.id)))
    return out
  }
  return l ?? r
}

function fusionarTexto(remoto: string, local: string): string {
  try {
    return JSON.stringify(fusionar(JSON.parse(remoto), JSON.parse(local)))
  } catch {
    return local
  }
}

function guardarLocal(k: string, v: string) {
  try {
    localStorage.setItem(k, v)
  } catch {
    /* sin espacio */
  }
}

function claves(): string[] {
  const out: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (esNuestra(k)) out.push(k)
  }
  return out
}

async function remoto(k: string): Promise<string | null> {
  const r = await fetch(`/api/datos?clave=${encodeURIComponent(k)}`)
  if (!r.ok) throw new Error(String(r.status))
  return ((await r.json()) as { valor: string | null }).valor
}

async function subirCambios() {
  for (const k of claves()) {
    const local = localStorage.getItem(k) ?? ''
    if (sincronizado.get(k) === local) continue
    try {
      const rem = await remoto(k)
      const final = rem == null ? local : fusionarTexto(rem, local)
      if (final !== rem) {
        const r = await fetch('/api/datos', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clave: k, valor: final }),
        })
        if (!r.ok) throw new Error(String(r.status))
      }
      // Solo se actualiza lo local si no ha cambiado mientras tanto
      if (localStorage.getItem(k) === local) {
        if (final !== local) guardarLocal(k, final)
        sincronizado.set(k, final)
      }
    } catch {
      /* se reintenta en el siguiente ciclo */
    }
  }
}

async function traerCambios(): Promise<boolean> {
  let cambio = false
  const r = await fetch('/api/datos')
  if (!r.ok) throw new Error(String(r.status))
  const { claves: rem } = (await r.json()) as { claves?: Record<string, string> }
  for (const [k, v] of Object.entries(rem ?? {})) {
    if (!esNuestra(k)) continue
    const local = localStorage.getItem(k)
    if (local === v) {
      sincronizado.set(k, v)
      continue
    }
    if (local != null && sincronizado.get(k) !== local) continue // hay cambios locales pendientes: los fusiona subirCambios
    guardarLocal(k, v)
    sincronizado.set(k, v)
    cambio = true
  }
  return cambio
}

export async function iniciarSync(): Promise<void> {
  if (enLocal) return
  try {
    const ctl = new AbortController()
    const t = setTimeout(() => ctl.abort(), 6000)
    const r = await fetch('/api/datos', { signal: ctl.signal })
    clearTimeout(t)
    if (!r.ok) return
    const { claves: rem } = (await r.json()) as { claves?: Record<string, string> }
    for (const [k, v] of Object.entries(rem ?? {})) {
      if (!esNuestra(k)) continue
      const local = localStorage.getItem(k)
      const final = local == null ? v : fusionarTexto(v, local)
      guardarLocal(k, final)
      if (final === v) sincronizado.set(k, v)
    }
  } catch {
    return // sin servidor: se trabaja en local sin sincronizar
  }
  void subirCambios()
  setInterval(() => void subirCambios(), 3000)
  // Cambios de otros usuarios: se traen periódicamente y la pantalla se refresca si no estás editando.
  setInterval(async () => {
    if (document.visibilityState !== 'visible') return
    try {
      const cambio = await traerCambios()
      if (cambio) window.dispatchEvent(new Event('datos-remotos'))
    } catch {
      /* ignorar */
    }
  }, 20000)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void subirCambios()
  })
}
