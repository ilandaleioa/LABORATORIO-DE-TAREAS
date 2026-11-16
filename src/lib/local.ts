import semilla from '../data/db.json'

/**
 * Almacén local (sustituye a Supabase de momento).
 * Parte de src/data/db.json y persiste los cambios en localStorage del navegador.
 */
const CLAVE = 'laboratorio-tareas-db'

type Tabla = 'ejercicios' | 'analisis' | 'tareas_analizadas' | 'sesiones' | 'plantillas'
type Db = Record<Tabla, Record<string, unknown>[]>

function leer(): Db {
  try {
    const raw = localStorage.getItem(CLAVE)
    if (raw) {
      const db = JSON.parse(raw) as Db
      db.tareas_analizadas ??= []
      db.sesiones ??= []
      db.plantillas ??= []
      return db
    }
  } catch {
    /* ignorar y usar la semilla */
  }
  const db = structuredClone(semilla) as unknown as Db
  db.tareas_analizadas ??= []
  db.sesiones ??= []
  db.plantillas ??= []
  return db
}

function guardar(db: Db) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(db))
  } catch {
    throw new Error('No hay espacio en el almacenamiento local (imagen demasiado grande).')
  }
}

export function listar<T>(tabla: Tabla): T[] {
  return [...leer()[tabla]].sort((a, b) =>
    String(b.created_at).localeCompare(String(a.created_at)),
  ) as T[]
}

export function insertar<T>(tabla: Tabla, fila: Record<string, unknown>): T {
  const db = leer()
  const nueva = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...fila }
  db[tabla].push(nueva)
  guardar(db)
  return nueva as T
}

export function blobADataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(String(fr.result))
    fr.onerror = () => reject(new Error('Error al leer la imagen.'))
    fr.readAsDataURL(blob)
  })
}

/** Inserta o reemplaza (por ejercicio_id) una fila de la tabla. */
export function upsertPorEjercicio<T>(tabla: Tabla, fila: Record<string, unknown>): T {
  const db = leer()
  const i = db[tabla].findIndex((x) => x.ejercicio_id === fila.ejercicio_id)
  const nueva = { id: i >= 0 ? db[tabla][i].id : crypto.randomUUID(), created_at: new Date().toISOString(), ...fila }
  if (i >= 0) db[tabla][i] = nueva
  else db[tabla].push(nueva)
  guardar(db)
  return nueva as T
}

/** Anota ids borrados para que la sincronización con otros usuarios no los reviva. */
function lapida(db: Db, ids: unknown[]) {
  const d = db as unknown as { _borrados?: string[] }
  d._borrados = [...new Set([...(d._borrados ?? []), ...ids.map(String)])].slice(-2000)
}

export function eliminarFila(tabla: Tabla, id: string) {
  const db = leer()
  lapida(db, [id])
  db[tabla] = db[tabla].filter((x) => x.id !== id)
  guardar(db)
}

/** Elimina las filas asociadas a un ejercicio. */
export function eliminarPorEjercicio(tabla: Tabla, ejercicioId: string) {
  const db = leer()
  lapida(db, db[tabla].filter((x) => x.ejercicio_id === ejercicioId).map((x) => x.id))
  db[tabla] = db[tabla].filter((x) => x.ejercicio_id !== ejercicioId)
  guardar(db)
}

/** Actualiza campos de una fila existente. */
export function actualizarFila<T>(tabla: Tabla, id: string, parche: Record<string, unknown>): T {
  const db = leer()
  const i = db[tabla].findIndex((x) => x.id === id)
  if (i < 0) throw new Error('Registro no encontrado.')
  db[tabla][i] = { ...db[tabla][i], ...parche }
  guardar(db)
  return db[tabla][i] as T
}

/** Actualiza campos de las filas de un ejercicio (p. ej. tareas_analizadas). */
export function actualizarPorEjercicio(tabla: Tabla, ejercicioId: string, parche: Record<string, unknown>) {
  const db = leer()
  db[tabla] = db[tabla].map((x) => (x.ejercicio_id === ejercicioId ? { ...x, ...parche } : x))
  guardar(db)
}
