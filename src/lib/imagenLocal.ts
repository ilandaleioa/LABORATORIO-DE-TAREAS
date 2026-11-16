// Análisis de la imagen SIN IA: detecta en el navegador los jugadores dibujados como círculos
// de color (azules, rojos, amarillos/naranjas) mediante segmentación por color y componentes conexas.
// También intenta distinguir al portero (azul más oscuro), los círculos rojos huecos y las líneas
// del campo (área / portería). Está pensado para pizarras tácticas tipo TacticalPad. No es infalible.

export type LadoPorteria = 'arriba' | 'abajo' | 'izquierda' | 'derecha'

export interface Deteccion {
  azules: number // jugadores azules (sin contar al portero)
  rojos: number // incluye camisetas rojiblancas (rayas)
  neutros: number // amarillos/naranjas: se interpretan como comodines
  porteros: number // azul oscuro, solo si destaca frente al resto de azules
  porteria: LadoPorteria | null // lado donde se ven líneas de área/portería
  balon: boolean // mancha oscura pequeña y compacta (balón)
}

// 0 nada, 1 azul (el portero es una mancha azul de tono más oscuro: se decide después), 2 rojo, 3 neutro,
// 5 trazo rojo oscuro (jugadores dibujados como círculos huecos)
type Clase = 0 | 1 | 2 | 3 | 5

function clasificar(r: number, g: number, b: number): Clase {
  if (b > 130 && b > r + 50 && b > g + 50) return 1
  if (r > 170 && g < 90 && b < 90) return 2 // rojo
  if (r > 200 && g > 150 && b < 90) return 3 // amarillo / naranja
  if (r >= g - 2 && r - b > 25 && r < 150) return 5 // trazo rojo oscuro sobre el césped
  return 0
}

function cargar(src: string): Promise<HTMLImageElement> {
  return new Promise((ok, ko) => {
    const img = new Image()
    img.onload = () => ok(img)
    img.onerror = () => ko(new Error('No se pudo leer la imagen.'))
    img.src = src
  })
}

export async function detectarJugadores(base64: string, mediaType = 'image/jpeg'): Promise<Deteccion> {
  const img = await cargar(`data:${mediaType};base64,${base64}`)
  const ancho = Math.min(1000, img.width)
  const alto = Math.round((img.height * ancho) / img.width)
  const canvas = document.createElement('canvas')
  canvas.width = ancho
  canvas.height = alto
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(img, 0, 0, ancho, alto)
  const { data } = ctx.getImageData(0, 0, ancho, alto)

  const mapa = new Uint8Array(ancho * alto)
  for (let i = 0; i < ancho * alto; i++) {
    mapa[i] = clasificar(data[i * 4], data[i * 4 + 1], data[i * 4 + 2])
  }

  // Componentes conexas por clase; se descartan manchas pequeñas (ruido, balón, flechas)
  const minArea = Math.max(40, Math.round(ancho * alto * 0.0004))
  const maxArea = ancho * alto * 0.02
  const visto = new Uint8Array(ancho * alto)
  const cuenta = [0, 0, 0, 0, 0, 0]
  const rojos: { x0: number; x1: number; y0: number; y1: number; area: number }[] = []
  const aros: { x0: number; x1: number; y0: number; y1: number }[] = []
  const k = ancho / 640 // las medidas en píxeles se escriben para 640 de ancho
  const pila: number[] = []

  for (let ini = 0; ini < mapa.length; ini++) {
    const c = mapa[ini]
    if (!c || visto[ini]) continue
    let area = 0
    let sumaG = 0
    let x0 = ancho, x1 = 0, y0 = alto, y1 = 0
    pila.length = 0
    pila.push(ini)
    visto[ini] = 1
    const vecinos8 = c === 5 // los aros finos se rompen fácilmente: conectividad 8
    while (pila.length) {
      const p = pila.pop()!
      area++
      sumaG += data[p * 4 + 1]
      const x = p % ancho
      const y = (p - x) / ancho
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if ((dx === 0 && dy === 0) || (!vecinos8 && dx !== 0 && dy !== 0)) continue
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || ny < 0 || nx >= ancho || ny >= alto) continue
          const q = ny * ancho + nx
          if (!visto[q] && mapa[q] === c) {
            visto[q] = 1
            pila.push(q)
          }
        }
      }
    }
    if (c === 5) {
      // Aro: caja casi cuadrada del tamaño de un jugador y hueca por dentro
      const bw = x1 - x0 + 1
      const bh = y1 - y0 + 1
      const asp = bw / bh
      if (bw >= 12 * k && bw <= 50 * k && bh >= 12 * k && bh <= 50 * k && asp > 0.7 && asp < 1.4 && area < bw * bh * 0.6 && area >= 20) aros.push({ x0, x1, y0, y1 })
    } else if (c === 2) {
      // Rojo: los jugadores rojiblancos (rayas) se parten en trozos; se agrupan más abajo
      if (area >= 6) rojos.push({ x0, x1, y0, y1, area })
    } else if (area >= minArea && area <= maxArea) {
      // azul oscuro (verde medio bajo) = posible portero; azul claro = jugador
      if (c === 1 && sumaG / area < 140) cuenta[4]++
      else cuenta[c]++
    }
  }

  // Agrupa los trozos rojos cercanos (rayas de una misma camiseta) y cuenta cada grupo como un jugador
  const grupo = rojos.map((_, i) => i)
  const raiz = (i: number): number => (grupo[i] === i ? i : (grupo[i] = raiz(grupo[i])))
  const cerca = 5 * k
  for (let i = 0; i < rojos.length; i++) {
    for (let j = i + 1; j < rojos.length; j++) {
      const A = rojos[i], B = rojos[j]
      if (A.x0 - cerca <= B.x1 && B.x0 - cerca <= A.x1 && A.y0 - cerca <= B.y1 && B.y0 - cerca <= A.y1) grupo[raiz(i)] = raiz(j)
    }
  }
  const grupos = new Map<number, { x0: number; x1: number; y0: number; y1: number; area: number }>()
  rojos.forEach((r, i) => {
    const g = grupos.get(raiz(i))
    if (!g) grupos.set(raiz(i), { ...r })
    else {
      g.x0 = Math.min(g.x0, r.x0)
      g.x1 = Math.max(g.x1, r.x1)
      g.y0 = Math.min(g.y0, r.y0)
      g.y1 = Math.max(g.y1, r.y1)
      g.area += r.area
    }
  })
  // Solo valen grupos con forma y tamaño de jugador (círculo ~12-50 px): descarta bordes discontinuos rojos,
  // flechas, marcos y trazos largos que antes se contaban como jugadores
  const camisetas = [...grupos.values()].filter((g) => {
    if (g.area < minArea || g.area > maxArea) return false
    const bw = g.x1 - g.x0 + 1
    const bh = g.y1 - g.y0 + 1
    const asp = bw / bh
    return bw >= 12 * k && bw <= 50 * k && bh >= 12 * k && bh <= 50 * k && asp > 0.65 && asp < 1.55
  })
  // Los aros que rodean a una camiseta roja ya contada (su contorno oscuro) no se cuentan otra vez
  const margen = 8 * k
  const arosSueltos = aros.filter((a) => {
    const cx = (a.x0 + a.x1) / 2
    const cy = (a.y0 + a.y1) / 2
    return !camisetas.some((c) => cx >= c.x0 - margen && cx <= c.x1 + margen && cy >= c.y0 - margen && cy <= c.y1 + margen)
  })
  const nRojos = camisetas.length + arosSueltos.length

  // Portero: solo si hay un único azul oscuro y el resto de azules son claros (si todos son oscuros, son jugadores)
  let azules = cuenta[1]
  let porteros = cuenta[4]
  if (!(porteros === 1 && azules >= 2)) {
    azules += porteros
    porteros = 0
  }

  // Líneas del campo (blancas/verdosas claras) dentro de la zona de césped
  let gx0 = ancho, gx1 = 0, gy0 = alto, gy1 = 0
  for (let i = 0; i < ancho * alto; i++) {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2]
    if (g > r + 20 && g > b + 20 && g > 60) {
      const x = i % ancho
      const y = (i - x) / ancho
      if (x < gx0) gx0 = x
      if (x > gx1) gx1 = x
      if (y < gy0) gy0 = y
      if (y > gy1) gy1 = y
    }
  }
  let porteria: LadoPorteria | null = null
  if (gx1 > gx0 && gy1 > gy0) {
    let n = 0, sx = 0, sy = 0
    for (let y = gy0; y <= gy1; y++) {
      for (let x = gx0; x <= gx1; x++) {
        const i = (y * ancho + x) * 4
        const r = data[i], g = data[i + 1], b = data[i + 2]
        if (r > 110 && g > 140 && b > 110 && Math.max(r, g, b) - Math.min(r, g, b) < 70) {
          n++
          sx += x
          sy += y
        }
      }
    }
    const zona = (gx1 - gx0) * (gy1 - gy0)
    if (n > zona * 0.003) {
      const fx = (sx / n - gx0) / (gx1 - gx0) // 0..1
      const fy = (sy / n - gy0) / (gy1 - gy0)
      const dx = Math.abs(fx - 0.5)
      const dy = Math.abs(fy - 0.5)
      if (Math.max(dx, dy) > 0.12) {
        porteria = dy >= dx ? (fy < 0.5 ? 'arriba' : 'abajo') : fx < 0.5 ? 'izquierda' : 'derecha'
      }
    }
  }

  // Balón: mancha pequeña, compacta y casi negra/gris oscura (los textos sueltos se descartan por forma y número)
  const oscuro = new Uint8Array(ancho * alto)
  for (let i = 0; i < ancho * alto; i++) {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2]
    if (Math.max(r, g, b) < 110 && Math.max(r, g, b) - Math.min(r, g, b) < 45 && g - r < 20 && b - r < 40) oscuro[i] = 1
  }
  const visto2 = new Uint8Array(ancho * alto)
  let candidatos = 0
  for (let ini = 0; ini < oscuro.length; ini++) {
    if (!oscuro[ini] || visto2[ini]) continue
    let area = 0
    let x0 = ancho, x1 = 0, y0 = alto, y1 = 0
    pila.length = 0
    pila.push(ini)
    visto2[ini] = 1
    while (pila.length) {
      const p = pila.pop()!
      area++
      const x = p % ancho
      const y = (p - x) / ancho
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || ny < 0 || nx >= ancho || ny >= alto) continue
          const q = ny * ancho + nx
          if (!visto2[q] && oscuro[q]) {
            visto2[q] = 1
            pila.push(q)
          }
        }
      }
    }
    const bw = x1 - x0 + 1
    const bh = y1 - y0 + 1
    const asp = bw / bh
    if (bw >= 5 * k && bw <= 22 * k && bh >= 5 * k && bh <= 22 * k && asp > 0.65 && asp < 1.55 && area / (bw * bh) > 0.45) candidatos++
  }

  return { azules, rojos: nRojos, neutros: cuenta[3], porteros, porteria, balon: candidatos >= 1 && candidatos <= 3 }
}
