export interface Rol {
  posicion: string
  descripcion: string
}

export interface Modificadores {
  comodines: number
  porterias: number
}

export interface ResultadoIA {
  puntos_clave: string[]
  roles: Rol[]
  dinamica_general: string
  impacto_modificadores?: string
}

export interface ObjetivoAsistente {
  tipo: 'tactico' | 'tecnico' | 'fisico' | 'psicologico'
  objetivo: string
  explicacion: string
}

export interface ResultadoAsistente {
  resumen: string
  principal: string
  objetivos: ObjetivoAsistente[]
  /** Consignas para el equipo con balón y para el equipo sin balón */
  consignas?: { conBalon: string[]; sinBalon: string[] }
  /** Rol y claves de cada equipo (rojo, azul y naranja/neutros) */
  roles?: { rojo: string[]; azul: string[]; naranja: string[] }
  /** true si es el análisis básico sin IA (basado solo en el texto) */
  basico?: boolean
}

export interface TareaAnalizada {
  id: string
  ejercicio_id: string
  nombre: string
  categoria: string | null
  imagen_url: string
  /** null mientras la tarea está pendiente de analizar */
  resultado: ResultadoAsistente | null
  /** 'pendiente' = guardada desde el Diseñador, aún sin analizar. Sin valor = analizada (datos antiguos). */
  estado?: 'pendiente' | 'analizada'
  created_at: string
}

export interface Ejercicio {
  id: string
  nombre: string
  descripcion: string
  imagen_url: string
  categoria: string | null
  /** id del ejercicio en el Diseñador, si viene de allí */
  diseno_id?: string
  created_at: string
}

export interface Analisis {
  id: string
  ejercicio_id: string
  puntos_clave: string[]
  roles: Rol[]
  dinamica_general: string
  impacto_modificadores: string | null
  modificadores: Modificadores
  es_version_modificada: boolean
  created_at: string
}

export const CATEGORIAS = [
  'Rondo',
  'Posesión',
  'Finalización',
  'Transición',
  'Presión',
  'Juego de posición',
  'Balón parado',
  'Otro',
]

export type PosicionJugador = 'Portero' | 'Defensa' | 'Centrocampista' | 'Delantero'

export const POSICIONES: PosicionJugador[] = ['Portero', 'Defensa', 'Centrocampista', 'Delantero']

export interface JugadorSesion {
  id: string
  nombre: string
  dorsal: string
  posicion: PosicionJugador
  asiste: boolean
  /** Motivo de la ausencia (solo si asiste = false) */
  motivo: string
}

export type Peto = '-' | 'R' | 'A' | 'N' | 'V'

export const PETOS: Peto[] = ['-', 'R', 'A', 'N', 'V']

export interface TecnicoTarea {
  nombre: string
  rol: string
}

/** Configuración de una tarea dentro de la sesión (paralela a Sesion.tareas por posición). */
export interface ConfigTarea {
  tipo?: string
  /** Duración total en minutos */
  duracion?: number
  largo?: number
  ancho?: number
  series?: number
  tSerie?: number
  descanso?: number
  /** Si no existe se usa la descripción del ejercicio */
  descripcion?: string
  normas?: string
  variantes?: string
  claves?: string
  tecnicos?: TecnicoTarea[]
  /** id de jugador -> peto */
  petos?: Record<string, Peto>
}

export interface Sesion {
  id: string
  fecha: string
  hora?: string
  ubicacion?: string
  equipo: string
  numero: string
  jugadores?: JugadorSesion[]
  /** ids de ejercicios; null = hueco sin elegir */
  tareas: (string | null)[]
  /** Configuración por tarea, mismo índice que `tareas` */
  config?: ConfigTarea[]
  created_at: string
}

export type PosicionPlantilla = 'Portero' | 'Defensa' | 'Medio' | 'Delantero'

export const POSICIONES_PLANTILLA: PosicionPlantilla[] = ['Portero', 'Defensa', 'Medio', 'Delantero']

export type EquipoPlantilla = 'Primer equipo' | 'Juvenil A' | 'Juvenil B'

export const EQUIPOS_PLANTILLA: EquipoPlantilla[] = ['Primer equipo', 'Juvenil A', 'Juvenil B']

export interface JugadorPlantilla {
  id: string
  dorsal: number
  nombre: string
  apellido: string
  posicion: PosicionPlantilla
  equipo?: EquipoPlantilla
  foto?: string
  created_at: string
}
