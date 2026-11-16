import type { ObjetivoAsistente, ResultadoAsistente } from '../types'
import type { Deteccion } from './imagenLocal'

// Análisis básico SIN IA: deduce objetivos a partir del texto (nombre, categoría, descripción).
// No ve la imagen; se usa como respaldo cuando la IA no está disponible.

type Tipo = ObjetivoAsistente['tipo']
interface Regla {
  claves: RegExp
  tipo: Tipo
  objetivo: string
  explicacion: string
}

const REGLAS: Regla[] = [
  {
    claves: /rondo|posesi[oó]n|circulaci[oó]n|conservar|mantener(?:\s+la)?\s+posesi/,
    tipo: 'tactico',
    objetivo: 'Conservación y circulación del balón',
    explicacion: 'Mantener la posesión bajo presión obliga a moverse para ofrecer líneas de pase y a mover el balón con rapidez. Limitar los toques aumenta la exigencia.',
  },
  {
    claves: /pase|control|toque|orientad/,
    tipo: 'tecnico',
    objetivo: 'Pase y control orientado',
    explicacion: 'Muchas repeticiones de pase y recepción en espacio reducido mejoran la precisión, el perfil corporal y el primer control hacia el espacio libre.',
  },
  {
    claves: /sin balón|desmarque|apoyo|l[ií]neas? de pase|ofrec/,
    tipo: 'tactico',
    objetivo: 'Movimiento sin balón y desmarques de apoyo',
    explicacion: 'El jugador sin balón debe crear ángulos y distancias de pase adecuados; se puede reforzar exigiendo movimiento constante.',
  },
  {
    claves: /presi[oó]n|robar|interceptar|defensor|recuperar|defens/,
    tipo: 'tactico',
    objetivo: 'Presión y coordinación defensiva',
    explicacion: 'Los defensores trabajan la presión conjunta, el cierre de líneas de pase y la reacción inmediata tras la pérdida o la recuperación.',
  },
  {
    claves: /finaliza|porter[ií]a|gol|disparo|remate|tiro/,
    tipo: 'tecnico',
    objetivo: 'Finalización y toma de decisión ante portería',
    explicacion: 'Se entrena la elección entre pasar o finalizar, la calidad del remate y la ocupación de zonas de ataque.',
  },
  {
    claves: /transici[oó]n|contraataque|p[eé]rdida|tras la p[eé]rdida|ataque-defensa/,
    tipo: 'tactico',
    objetivo: 'Transiciones ataque-defensa',
    explicacion: 'Reaccionar en los primeros segundos tras ganar o perder el balón: pasar de atacar a defender (y al revés) con orden.',
  },
  {
    claves: /juego de posici[oó]n|superioridad|inferioridad|comod[ií]n|l[ií]nea|espacios?/,
    tipo: 'tactico',
    objetivo: 'Uso de superioridades y ocupación de espacios',
    explicacion: 'Las superioridades numéricas o los jugadores de apoyo permiten buscar al hombre libre y ocupar espacios con criterio.',
  },
  {
    claves: /bal[oó]n parado|c[oó]rner|falta|saque/,
    tipo: 'tactico',
    objetivo: 'Automatización de acciones a balón parado',
    explicacion: 'Repetir movimientos pactados, ocupación de zonas y asignación de tareas para ataque y defensa.',
  },
  {
    claves: /intensidad|resistencia|sprint|velocidad|f[ií]sic|duraci[oó]n|series/,
    tipo: 'fisico',
    objetivo: 'Intensidad y condición física específica',
    explicacion: 'Ajustando series, duración y descansos se puede orientar el ejercicio hacia la resistencia o la potencia con balón.',
  },
]

export function analisisLocal(texto: string, det?: Deteccion): ResultadoAsistente {
  // Si se detectaron jugadores en la imagen, se añaden al texto para que apliquen las mismas reglas
  const hayDet = det && det.azules + det.rojos > 0
  const t = (texto + (hayDet ? ` ${det!.azules}vs${det!.rojos}` : '')).toLowerCase()
  const objetivos: ObjetivoAsistente[] = []

  for (const r of REGLAS) {
    if (r.claves.test(t)) objetivos.push({ tipo: r.tipo, objetivo: r.objetivo, explicacion: r.explicacion })
  }

  if (det && det.neutros > 0) {
    objetivos.push({
      tipo: 'tactico',
      objetivo: 'Juego con comodines (jugadores neutros)',
      explicacion: `Se ven ${det.neutros} jugador(es) neutro(s) en la imagen: dan superioridad al equipo con balón y obligan a buscar al hombre libre.`,
    })
  }

  // Formato "5vs2", "5 v 2", "5x2", "5 contra 2" (el texto del usuario manda sobre la imagen)
  const m = t.match(/(\d+)\s*(?:vs?|x|contra)\s*(\d+)/)
  let resumen = 'Ejercicio descrito en texto.'
  if (det && hayDet) {
    resumen = `En la imagen se detectan ${det.azules} jugadores azules y ${det.rojos} rojos${det.neutros ? ` y ${det.neutros} neutros` : ''}.`
  }
  if (m) {
    const a = Number(m[1])
    const d = Number(m[2])
    if (!hayDet) resumen = `Ejercicio de ${a} contra ${d}.`
    if (a > d) {
      objetivos.push({
        tipo: 'psicologico',
        objetivo: 'Toma de decisiones con superioridad numérica',
        explicacion: `Con ${a - d} jugador(es) de más, el equipo debe encontrar al hombre libre rápidamente y mantener la concentración para no perder la ventaja.`,
      })
    } else if (a < d) {
      objetivos.push({
        tipo: 'psicologico',
        objetivo: 'Competir en inferioridad numérica',
        explicacion: 'Obliga a ser más preciso, a ahorrar toques y a cooperar bajo presión.',
      })
    }
  }

  // Siempre hay unos objetivos mínimos
  if (objetivos.length === 0) {
    objetivos.push(
      { tipo: 'tactico', objetivo: 'Comprensión del juego y de las reglas del ejercicio', explicacion: 'Añade más detalles a la descripción (jugadores, espacio, normas) para obtener objetivos más concretos.' },
      { tipo: 'tecnico', objetivo: 'Repetición de gestos técnicos con balón', explicacion: 'Cualquier ejercicio con balón permite trabajar pase, control y conducción según las normas que se impongan.' },
    )
  }

  const unicos = objetivos.filter((o, i, arr) => arr.findIndex((x) => x.objetivo === o.objetivo) === i).slice(0, 8)
  const hayNeutros = !det || det.neutros > 0 || /comod[ií]n|neutro/.test(t)
  return {
    resumen,
    principal: unicos[0].objetivo,
    objetivos: unicos,
    roles: {
      rojo: [
        'Atacar o defender según la fase: si tiene balón, ofrecer líneas de pase y moverlo rápido.',
        'Ocupar espacios con criterio y mantener distancias de apoyo entre compañeros.',
        'Tras perder el balón, presionar de inmediato para recuperarlo.',
      ],
      azul: [
        'Si tiene balón, circular con pocos toques y buscar al hombre libre.',
        'Si no lo tiene, cerrar líneas de pase y presionar de forma coordinada.',
        'Comunicarse y mantener el perfil corporal abierto para recibir.',
      ],
      naranja: hayNeutros
        ? [
            'Jugar siempre con el equipo que tiene el balón (comodín): ser opción de pase constante.',
            'Moverse para crear superioridad y ofrecer una línea de pase segura.',
            'Jugar a pocos toques para no frenar la circulación.',
          ]
        : [],
    },
    basico: true,
  }
}
