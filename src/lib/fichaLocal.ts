import type { Deteccion } from './imagenLocal'
import type { FichaEjercicio } from './api'

// Ficha base SIN IA: se construye a partir del nº de jugadores detectados por color en la imagen.
// No ve flechas, espacio ni texto: son plantillas por tipo de ejercicio que el usuario debe revisar.

const lista = (xs: string[]) => xs.map((x) => `- ${x}`).join('\n')

/** Si el usuario ya escribió o dictó una descripción, se respeta tal cual y solo se completa el resto. */
export function fichaLocal(det: Deteccion, descripcionUsuario = ''): FichaEjercicio | null {
  const f = construirFicha(det)
  if (f && descripcionUsuario.trim()) f.descripcion = descripcionUsuario.trim()
  return f
}

function construirFicha(det: Deteccion): FichaEjercicio | null {
  const a = det.azules
  const d = det.rojos
  const n = det.neutros
  if (a + d === 0) return null

  const total = a + d + n
  const nombre = `${a}vs${d}${n ? ` + ${n} comodín${n > 1 ? 'es' : ''}` : ''}`
  const comodin = n
    ? ` Además hay ${n} jugador${n > 1 ? 'es' : ''} neutro${n > 1 ? 's' : ''} (comodín) que siempre juega${n > 1 ? 'n' : ''} con el equipo que tiene el balón.`
    : ''

  // Con portero o portería a la vista: ejercicio de finalización.
  // Se asume que el equipo del portero (azul) defiende y el rojo ataca; el usuario puede corregirlo.
  if (det.porteros > 0 || det.porteria) {
    const lado = det.porteria ? ` situada ${det.porteria}` : ''
    const pt = det.porteros > 0
    const balon = det.balon ? ' Hay un balón en juego.' : ''
    return {
      nombre: `${d}vs${a}${pt ? ' + portero' : ''}`,
      categoria: 'Finalización',
      descripcion:
        `Ejercicio de finalización: ${d} atacante${d === 1 ? '' : 's'} (rojos) ${d === 1 ? 'busca' : 'buscan'} marcar en la portería${lado}, defendida por ${a} defensor${a === 1 ? '' : 'es'} (azules)${pt ? ' y un portero' : ''}.${balon}${comodin}

` +
        `Objetivo: mejorar la toma de decisiones en el último tercio, la calidad del remate y la coordinación defensiva ante la portería.`,
      normas: lista([
        'Los atacantes buscan finalizar lo antes posible, con un máximo de toques por jugada.',
        pt ? 'El portero participa en cada acción; si atrapa el balón, se reinicia la jugada.' : 'Se reinicia la jugada tras cada remate.',
        'Si los defensores recuperan el balón, intentan sacarlo fuera del área o pasar a una zona marcada.',
      ]),
      variantes: lista([
        'Limitar el número de toques antes del remate.',
        'Añadir un atacante o un defensor para cambiar la superioridad numérica.',
        'Exigir un centro o pase al segundo palo antes de finalizar.',
      ]),
      claves: lista([
        'Ocupar bien los espacios de ataque y fijar a los defensores antes de pasar.',
        'Elegir bien entre pasar o rematar.',
        'Remate orientado y con intención, buscando el rechace.',
        'Los defensores cierran el pasillo central y protegen la zona del penalti.',
      ]),
    }
  }

  // Superioridad: rondo / posesión
  if (a > d) {
    const rondo = d <= 3
    const dif = a - d
    return {
      nombre,
      categoria: rondo ? 'Rondo' : 'Posesión',
      descripcion:
        `${rondo ? 'Rondo' : 'Ejercicio de posesión'} ${a}vs${d} (${total} jugadores) en un espacio reducido. ` +
        `${a} jugadores (azules) mantienen la posesión mientras ${d} defensor${d > 1 ? 'es' : ''} (rojos) intenta${d > 1 ? 'n' : ''} robar o interceptar el balón.${comodin}\n\n` +
        `Objetivo: mejorar la circulación rápida del balón, el pase y control orientado, el movimiento sin balón para ofrecer líneas de pase y la presión coordinada de los defensores.`,
      normas: lista([
        'Los atacantes juegan a 1-2 toques como máximo.',
        'Si los defensores roban o interceptan el balón, o este sale del espacio, el jugador que perdió la posesión pasa a defender.',
        'Se cuentan los pases consecutivos antes de perder el balón.',
      ]),
      variantes: lista([
        'Limitar a un toque para aumentar la velocidad.',
        'Prohibir el pase al compañero contiguo para obligar a jugar al lado opuesto.',
        d < 4 ? 'Reducir el espacio o añadir un defensor más para aumentar la dificultad.' : 'Reducir el espacio para aumentar la presión.',
        dif >= 3 ? 'Exigir un número mínimo de pases antes de poder cambiar de orientación.' : 'Exigir cambio de orientación tras un número de pases.',
      ]),
      claves: lista([
        'Perfil corporal abierto antes de recibir.',
        'Pasar y moverse constantemente para crear ángulos.',
        'Pase tenso y preciso al pie de apoyo del compañero.',
        'Los defensores presionan juntos, cerrando líneas de pase.',
      ]),
    }
  }

  // Igualdad
  if (a === d) {
    return {
      nombre,
      categoria: 'Juego de posición',
      descripcion:
        `Ejercicio de igualdad numérica ${a}vs${d} (${total} jugadores). Dos equipos (azul y rojo) compiten por la posesión del balón en un espacio delimitado.${comodin}\n\n` +
        `Objetivo: mejorar la toma de decisiones, el desmarque y la transición rápida entre ataque y defensa.`,
      normas: lista([
        'Gana el equipo que enlace más pases consecutivos o logre el objetivo marcado.',
        'Tras robo o salida del balón, cambia la posesión de inmediato.',
        'Se limita el número de toques para dar velocidad al juego.',
      ]),
      variantes: lista([
        'Añadir un comodín que juegue siempre con el equipo con balón.',
        'Añadir porterías o zonas de finalización.',
        'Limitar a un toque o reducir el espacio.',
      ]),
      claves: lista([
        'Desmarques de apoyo y de ruptura continuos.',
        'Reacción inmediata tras la pérdida y tras la recuperación.',
        'Comunicación entre compañeros.',
      ]),
    }
  }

  // Inferioridad
  return {
    nombre,
    categoria: 'Presión',
    descripcion:
      `Ejercicio ${a}vs${d} (${total} jugadores) en inferioridad numérica para el equipo azul frente al rojo.${comodin}\n\n` +
      `Objetivo: trabajar la presión, la cobertura y la solidaridad defensiva, y la salida de balón en inferioridad.`,
    normas: lista([
      'El equipo en inferioridad debe conservar o recuperar el balón con juego simple.',
      'Si recupera el balón, intenta enlazar un número de pases o salir a una zona.',
    ]),
    variantes: lista(['Añadir un comodín para equilibrar la situación.', 'Reducir o ampliar el espacio de juego.']),
    claves: lista([
      'Apoyos cercanos y ayudas permanentes.',
      'Pase seguro y orientación del cuerpo al recibir.',
      'Concentración y comunicación bajo presión.',
    ]),
  }
}
