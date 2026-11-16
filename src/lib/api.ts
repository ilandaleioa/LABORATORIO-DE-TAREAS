import { comprimir, urlABase64 } from './imagen'
import { actualizarFila, actualizarPorEjercicio, blobADataUrl, eliminarFila, eliminarPorEjercicio, insertar, listar, upsertPorEjercicio } from './local'
import type { EquipoPlantilla, JugadorPlantilla, PosicionPlantilla, Sesion, Analisis, Ejercicio, Modificadores, ResultadoAsistente, ResultadoIA, TareaAnalizada } from '../types'

// Almacenamiento local (src/data/db.json + localStorage) en lugar de Supabase.

export async function listarEjercicios(): Promise<Ejercicio[]> {
  return listar<Ejercicio>('ejercicios')
}

export async function obtenerEjercicio(id: string): Promise<Ejercicio> {
  const e = listar<Ejercicio>('ejercicios').find((x) => x.id === id)
  if (!e) throw new Error('Ejercicio no encontrado.')
  return e
}

export async function crearEjercicio(input: {
  file: File
  nombre: string
  descripcion: string
  categoria: string | null
}): Promise<Ejercicio> {
  // Se guarda el archivo ORIGINAL sin tocarlo si es razonablemente pequeño; solo se reduce si es muy pesado.
  const original = input.file.size <= 1.5 * 1024 * 1024
  const imagen_url = await blobADataUrl(original ? input.file : await comprimir(input.file, 2400, 0.92))
  return insertar<Ejercicio>('ejercicios', {
    nombre: input.nombre,
    descripcion: input.descripcion,
    categoria: input.categoria,
    imagen_url,
  })
}

/** Edita la información general del ejercicio (y la copia en "Tareas analizadas"). */
export function actualizarEjercicio(
  id: string,
  datos: { nombre: string; categoria: string | null; descripcion: string; imagen_url?: string },
): Ejercicio {
  const e = actualizarFila<Ejercicio>('ejercicios', id, datos)
  // La imagen no se duplica en tareas_analizadas (se rellena al leer) para no agotar el almacenamiento.
  actualizarPorEjercicio('tareas_analizadas', id, {
    nombre: datos.nombre,
    categoria: datos.categoria,
  })
  return e
}

/** Elimina un ejercicio junto con sus análisis. */
export function eliminarEjercicio(id: string) {
  eliminarFila('ejercicios', id)
  eliminarPorEjercicio('analisis', id)
  eliminarPorEjercicio('tareas_analizadas', id)
}

/** Crea una copia del ejercicio (sin análisis). */
export function duplicarEjercicio(e: Ejercicio): Ejercicio {
  const { id: _id, created_at: _c, ...resto } = e as Ejercicio & { created_at?: string }
  return insertar<Ejercicio>('ejercicios', { ...resto, nombre: `${e.nombre} (copia)` })
}

/** Convierte la imagen guardada (data URL o URL) en un File para poder editarla en el formulario. */
export async function imagenAFile(url: string, nombre: string): Promise<File> {
  const r = await fetch(url)
  if (!r.ok) throw new Error('No se pudo cargar la imagen del ejercicio.')
  const blob = await r.blob()
  return new File([blob], nombre, { type: blob.type || 'image/jpeg' })
}

/** Separa la descripción guardada en los campos del formulario (inverso de lo que compone "Guardar ejercicio"). */
export function parsearDescripcion(texto: string) {
  let resto = texto.replace(/\r\n/g, '\n')
  const cortar = (re: RegExp) => {
    const m = resto.match(re)
    if (!m || m.index === undefined) return ''
    const val = resto.slice(m.index + m[0].length)
    resto = resto.slice(0, m.index)
    return val.trim()
  }
  const claves = cortar(/(?:^|\n\n)PUNTOS CLAVE\n/)
  const variantes = cortar(/(?:^|\n\n)VARIANTES\n/)
  const normas = cortar(/(?:^|\n\n)NORMAS\n/)
  const objetivo = cortar(/(?:^|\n\n)Objetivo:[ \t]*/i)

  let cabecera = ''
  let descripcion = resto.trim()
  if (/^Equipo A:/i.test(descripcion)) {
    const i = descripcion.indexOf('\n\n')
    cabecera = i < 0 ? descripcion : descripcion.slice(0, i)
    descripcion = i < 0 ? '' : descripcion.slice(i + 2).trim()
  }
  const num = (re: RegExp) => cabecera.match(re)?.[1] ?? ''
  const eq = (n: 'A' | 'B') => {
    const m = cabecera.match(new RegExp(`Equipo ${n}:\\s*(\\d+)\\s*jugadores?(?:\\s*\\+\\s*(\\d+)\\s*porteros?)?`, 'i'))
    return m ? { jug: m[1], por: m[2] ?? '0' } : null
  }
  const a = eq('A')
  const b = eq('B')
  const dim = cabecera.match(/Dimensiones:\s*(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)/i)
  return {
    descripcion,
    objetivo,
    normas,
    variantes,
    claves,
    jugA: a?.jug ?? '',
    porA: a?.por ?? '',
    jugB: b?.jug ?? '',
    porB: b?.por ?? '',
    colorA: cabecera.match(/Color equipo A:\s*(.+)/i)?.[1].trim() ?? 'Rojo',
    colorB: cabecera.match(/Color equipo B:\s*(.+)/i)?.[1].trim() ?? 'Azul',
    ancho: dim?.[1] ?? '',
    largo: dim?.[2] ?? '',
    comodines: num(/Comodines:\s*(\d+)/i),
    pgA: num(/Porterías grandes equipo A:\s*(\d+)/i),
    pgB: num(/Porterías grandes equipo B:\s*(\d+)/i),
    ppA: num(/Porterías pequeñas equipo A:\s*(\d+)/i),
    ppB: num(/Porterías pequeñas equipo B:\s*(\d+)/i),
  }
}

/** El Asistente analiza el ejercicio y devuelve los objetivos que se pueden cumplir. No guarda nada. */
export async function consultarAsistente(
  imagen: { base64: string; mediaType: string },
  descripcion: string,
): Promise<ResultadoAsistente> {
  let r: Response
  try {
    r = await fetch('/api/asistente', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imagen_base64: imagen.base64, media_type: imagen.mediaType, descripcion }),
    })
  } catch {
    throw new Error('Sin conexión con el servidor del asistente.')
  }
  const json = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(json.error ?? 'Error al consultar el asistente.')
  if (!json.resultado) {
    throw new Error('El servidor del asistente no respondió. Si estás en local, reinicia "npm run dev" o usa "npx vercel dev".')
  }
  return json.resultado as ResultadoAsistente
}

export interface FichaEjercicio {
  nombre: string
  categoria: string
  descripcion: string
  objetivo?: string
  normas: string
  variantes: string
  claves: string
}

/** La IA lee la imagen del ejercicio y propone la ficha completa. No guarda nada. */
export async function rellenarDesdeImagen(imagen: { base64: string; mediaType: string }, descripcion?: string): Promise<FichaEjercicio> {
  let r: Response
  try {
    r = await fetch('/api/rellenar-ejercicio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imagen_base64: imagen.base64, media_type: imagen.mediaType, descripcion }),
    })
  } catch {
    throw new Error('Sin conexión con el servidor.')
  }
  const json = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(json.error ?? 'Error al analizar la imagen.')
  if (!json.resultado) {
    throw new Error('El servidor no respondió. Si estás en local, reinicia "npm run dev" o usa "npx vercel dev".')
  }
  return json.resultado as FichaEjercicio
}

export async function listarAnalisis(ejercicioId: string): Promise<Analisis[]> {
  return listar<Analisis>('analisis').filter((a) => a.ejercicio_id === ejercicioId)
}

/** Llama al endpoint serverless y guarda el resultado en la tabla analisis. */
export async function analizarYGuardar(
  ejercicio: Ejercicio,
  modificadores: Modificadores,
  base: Analisis | null,
): Promise<Analisis> {
  const esModificada = modificadores.comodines > 0 || modificadores.porterias > 0
  const img = await urlABase64(ejercicio.imagen_url)

  let r: Response
  try {
    r = await fetch('/api/analizar-ejercicio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imagen_base64: img.base64,
        media_type: img.mediaType,
        descripcion: ejercicio.descripcion,
        modificadores: esModificada ? modificadores : { comodines: 0, porterias: 0 },
        analisis_base: esModificada && base
          ? { puntos_clave: base.puntos_clave, roles: base.roles, dinamica_general: base.dinamica_general }
          : undefined,
      }),
    })
  } catch {
    throw new Error('Sin conexión con el servidor de análisis.')
  }

  const json = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(json.error ?? 'Error al analizar el ejercicio.')
  const res = json.resultado as ResultadoIA

  return insertar<Analisis>('analisis', {
    ejercicio_id: ejercicio.id,
    puntos_clave: res.puntos_clave,
    roles: res.roles,
    dinamica_general: res.dinamica_general,
    impacto_modificadores: res.impacto_modificadores || null,
    modificadores: esModificada ? modificadores : { comodines: 0, porterias: 0 },
    es_version_modificada: esModificada,
  })
}

/** Rellena la imagen desde el ejercicio (las filas nuevas no la guardan para no duplicarla). */
function conImagen(ts: TareaAnalizada[]): TareaAnalizada[] {
  const imgs = new Map(listar<Ejercicio>('ejercicios').map((e) => [e.id, e.imagen_url]))
  return ts.map((t) => ({ ...t, imagen_url: imgs.get(t.ejercicio_id) ?? t.imagen_url }))
}

export async function listarTareasAnalizadas(): Promise<TareaAnalizada[]> {
  return conImagen(listar<TareaAnalizada>('tareas_analizadas'))
}

export function obtenerTareaAnalizada(ejercicioId: string): TareaAnalizada | null {
  return listar<TareaAnalizada>('tareas_analizadas').find((t) => t.ejercicio_id === ejercicioId) ?? null
}

/** Guarda (o actualiza) el análisis del asistente de un ejercicio en "Tareas analizadas". */
export function guardarTareaAnalizada(ejercicio: Ejercicio, resultado: ResultadoAsistente): TareaAnalizada {
  return upsertPorEjercicio<TareaAnalizada>('tareas_analizadas', {
    ejercicio_id: ejercicio.id,
    nombre: ejercicio.nombre,
    categoria: ejercicio.categoria,
    resultado,
    estado: 'analizada',
  })
}

const CATEGORIA_DISENADOR: Record<string, string> = {
  Posesiones: 'Posesión',
  Finalizaciones: 'Finalización',
  'Juegos reducidos': 'Juego de posición',
}

/**
 * Registra un ejercicio guardado en el Diseñador como «pendiente de analizar»:
 * crea (o actualiza) el ejercicio en la librería y su fila en Tareas analizadas.
 * Si ya estaba analizado, conserva el análisis y solo refresca nombre e imagen.
 */
/**
 * Si la descripción guardada ya tiene estructura (equipos, objetivo, normas…), solo se sustituye
 * el texto libre por el que viene del Diseñador; el resto se conserva.
 */
function fusionarDescripcion(guardada: string, nueva: string): string {
  const g = guardada.replace(/\r\n/g, '\n')
  const libre = parsearDescripcion(g).descripcion
  if (!libre) {
    // Sin texto libre: se conserva TODO lo estructurado y solo se añade el texto del Diseñador
    const extra = nueva.trim()
    if (!g.trim()) return nueva
    if (!extra) return guardada
    if (/^Equipo A:/i.test(g.trim())) {
      const j = g.indexOf('\n\n')
      return j < 0 ? `${g.trim()}\n\n${extra}` : `${g.slice(0, j)}\n\n${extra}${g.slice(j)}`
    }
    return `${extra}\n\n${g.trim()}`
  }
  const i = g.indexOf(libre)
  return i < 0 ? nueva : g.slice(0, i) + nueva.trim() + g.slice(i + libre.length)
}

export function registrarDesdeDisenador(d: {
  disenoId: string
  nombre: string
  tipo: string
  descripcion: string
  imagen: string
}): TareaAnalizada {
  const categoria = d.tipo ? (CATEGORIA_DISENADOR[d.tipo] ?? 'Otro') : null
  const previo = listar<Ejercicio>('ejercicios').find((e) => e.diseno_id === d.disenoId)
  let ejercicio: Ejercicio
  if (previo) {
    ejercicio = actualizarFila<Ejercicio>('ejercicios', previo.id, {
      nombre: d.nombre,
      categoria,
      descripcion: fusionarDescripcion(previo.descripcion ?? '', d.descripcion),
      ...(d.imagen ? { imagen_url: d.imagen } : {}),
    })
  } else {
    ejercicio = insertar<Ejercicio>('ejercicios', {
      nombre: d.nombre,
      descripcion: d.descripcion,
      categoria,
      imagen_url: d.imagen,
      diseno_id: d.disenoId,
    })
  }
  const existente = obtenerTareaAnalizada(ejercicio.id)
  const analizada = !!existente?.resultado
  return upsertPorEjercicio<TareaAnalizada>('tareas_analizadas', {
    ejercicio_id: ejercicio.id,
    nombre: ejercicio.nombre,
    categoria: ejercicio.categoria,
    resultado: existente?.resultado ?? null,
    estado: analizada ? 'analizada' : 'pendiente',
  })
}

export function quitarTareaAnalizada(id: string) {
  eliminarFila('tareas_analizadas', id)
}

export function listarSesiones(): Sesion[] {
  return listar<Sesion>('sesiones')
}

export function crearSesion(): Sesion {
  return insertar<Sesion>('sesiones', {
    fecha: new Date().toISOString().slice(0, 10),
    equipo: '',
    numero: String(listar('sesiones').length + 1),
    tareas: [null],
  })
}

export function actualizarSesion(id: string, parche: Partial<Omit<Sesion, 'id'>>): Sesion {
  return actualizarFila<Sesion>('sesiones', id, parche)
}

export function eliminarSesion(id: string) {
  eliminarFila('sesiones', id)
}

export function listarPlantilla(): JugadorPlantilla[] {
  return listar<JugadorPlantilla>('plantillas').sort((a, b) => a.dorsal - b.dorsal)
}

export function crearJugadorPlantilla(j: { dorsal: number; nombre: string; apellido: string; posicion: PosicionPlantilla; equipo?: EquipoPlantilla; foto?: string }): JugadorPlantilla {
  return insertar<JugadorPlantilla>('plantillas', j)
}

export function actualizarJugadorPlantilla(id: string, parche: Partial<Omit<JugadorPlantilla, 'id'>>): JugadorPlantilla {
  return actualizarFila<JugadorPlantilla>('plantillas', id, parche)
}

export function eliminarJugadorPlantilla(id: string) {
  eliminarFila('plantillas', id)
}
