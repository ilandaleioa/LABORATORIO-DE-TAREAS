import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import ImageDropzone from '../components/ImageDropzone'
import VisorImagen from '../components/VisorImagen'
import Spinner from '../components/Spinner'
import Asistente from '../components/Asistente'
import { blobABase64, comprimir } from '../lib/imagen'
import {
  actualizarEjercicio,
  crearEjercicio,
  guardarTareaAnalizada,
  imagenAFile,
  obtenerEjercicio,
  obtenerTareaAnalizada,
  parsearDescripcion,
  rellenarDesdeImagen,
  type FichaEjercicio,
} from '../lib/api'
import { blobADataUrl } from '../lib/local'
import { detectarJugadores } from '../lib/imagenLocal'
import { fichaLocal } from '../lib/fichaLocal'
import { CATEGORIAS, type Ejercicio } from '../types'

const COLORES: Record<string, string> = {
  Azul: '#1d4ed8',
  Rojo: '#dc2626',
  Amarillo: '#facc15',
  Verde: '#16a34a',
  Naranja: '#f97316',
  Blanco: '#ffffff',
  Negro: '#171717',
  Rosa: '#ec4899',
  Morado: '#7c3aed',
  Gris: '#9ca3af',
}

/** Textarea que empieza baja (rows) y crece según el contenido. */
function AutoTextarea({ className = '', rows = 2, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight + 2}px`
  }, [props.value])
  return <textarea ref={ref} rows={rows} className={`${className} resize-none overflow-hidden`} {...props} />
}

/** Botón para ocultar/mostrar el contenido de una sección (el título siempre se queda visible). */
function BotonOcultar({ oculto, onClick }: { oculto: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={!oculto}
      className="ml-2 rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-bold normal-case tracking-normal text-neutral-600 hover:bg-neutral-200"
    >
      {oculto ? '▸ Mostrar' : '▾ Ocultar'}
    </button>
  )
}

/** Sin `editarId` crea un ejercicio nuevo; con `editarId` carga ese ejercicio en el mismo formulario para editarlo. */
export default function NuevoEjercicio({ editarId, soloLectura = false }: { editarId?: string; soloLectura?: boolean }) {
  const [ocultas, setOcultas] = useState<Set<string>>(new Set())
  const oculta = (k: string) => ocultas.has(k)
  const alternar = (k: string) =>
    setOcultas((s) => {
      const n = new Set(s)
      if (n.has(k)) n.delete(k)
      else n.add(k)
      return n
    })
  const toggle = (k: string) => soloLectura ? null : <BotonOcultar oculto={oculta(k)} onClick={() => alternar(k)} />
  const [destinoAcciones, setDestinoAcciones] = useState<HTMLElement | null>(null)
  const [original, setOriginal] = useState<Ejercicio | null>(null)
  const [cargando, setCargando] = useState(!!editarId)
  const [file, setFile] = useState<File | null>(null)
  const archivoOriginal = useRef<File | null>(null)
  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [objetivo, setObjetivo] = useState('')
  const [normas, setNormas] = useState('')
  const [variantes, setVariantes] = useState('')
  const [claves, setClaves] = useState('')
  const [categoria, setCategoria] = useState('')
  const [largo, setLargo] = useState('')
  const [ancho, setAncho] = useState('')
  const [jugTotal, setJugTotal] = useState('0')
  const [jugA, setJugA] = useState('0')
  const [porA, setPorA] = useState('0')
  const [jugB, setJugB] = useState('0')
  const [porB, setPorB] = useState('0')
  const [comodines, setComodines] = useState('0')
  const [colorA, setColorA] = useState('Rojo')
  const [colorB, setColorB] = useState('Azul')
  const [pgA, setPgA] = useState('0')
  const [pgB, setPgB] = useState('0')
  const [ppA, setPpA] = useState('0')
  const [ppB, setPpB] = useState('0')
  // Con nombre, categoría y descripción ya se proponen objetivo, normas, variantes y puntos clave
  const datosListos = !!(nombre.trim() && categoria && descripcion.trim())
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rellenando, setRellenando] = useState(false)
  const [avisoIA, setAvisoIA] = useState<string | null>(null)
  const peticion = useRef(0)

  /** true si el texto de "Descripción" lo ha escrito o dictado el usuario (no la IA): entonces se respeta. */
  const descEsMia = useRef(false)
  const [dictando, setDictando] = useState(false)
  const reconocimiento = useRef<any>(null)

  /** true si el usuario ha tocado normas, variantes o puntos clave: entonces no se sobrescriben solos. */
  const textosEditados = useRef(false)
  const ultimaClave = useRef('')

  // Modo edición: rellena el formulario con los datos guardados
  useEffect(() => {
    if (!editarId) return
    let vivo = true
    ;(async () => {
      try {
        const e = await obtenerEjercicio(editarId)
        const p = parsearDescripcion(e.descripcion ?? '')
        const img = await imagenAFile(e.imagen_url, `${e.nombre}.jpg`).catch(() => null)
        if (!vivo) return
        setOriginal(e)
        setNombre(e.nombre)
        setCategoria(e.categoria ?? '')
        setDescripcion(p.descripcion)
        setObjetivo(p.objetivo)
        setNormas(p.normas)
        setVariantes(p.variantes)
        setClaves(p.claves)
        setLargo(p.largo)
        setAncho(p.ancho)
        setJugTotal(String((parseInt(p.jugA, 10) || 0) + (parseInt(p.porA, 10) || 0) + (parseInt(p.jugB, 10) || 0) + (parseInt(p.porB, 10) || 0) + (parseInt(p.comodines, 10) || 0)))
        setJugA(p.jugA || '0')
        setPorA(p.porA || '0')
        setJugB(p.jugB || '0')
        setPorB(p.porB || '0')
        setComodines(p.comodines || '0')
        setPgA(p.pgA || '0')
        setPgB(p.pgB || '0')
        setPpA(p.ppA || '0')
        setPpB(p.ppB || '0')
        if (p.colorA in COLORES) setColorA(p.colorA)
        if (p.colorB in COLORES) setColorB(p.colorB)
        // Lo guardado no se regenera solo con IA; si aún no tiene objetivo/normas/variantes/claves, se proponen
        textosEditados.current = !!(p.objetivo.trim() || p.normas.trim() || p.variantes.trim() || p.claves.trim())
        descEsMia.current = true
        archivoOriginal.current = img
        setFile(img)
      } catch (err) {
        if (vivo) setError((err as Error).message)
      } finally {
        if (vivo) setCargando(false)
      }
    })()
    return () => {
      vivo = false
    }
  }, [editarId])

  /** Resumen de jugadores y porterías para que la IA genere normas/variantes/claves coherentes. */
  function contextoDatos() {
    const n = (v: string) => parseInt(v, 10) || 0
    const partes = [
      `Equipo A (${colorA}): ${n(jugA)} jugadores + ${n(porA)} porteros`,
      `Equipo B (${colorB}): ${n(jugB)} jugadores + ${n(porB)} porteros`,
    ]
    if (parseFloat(ancho) > 0 && parseFloat(largo) > 0) partes.push(`Dimensiones del campo: ${ancho} x ${largo} m (ancho x largo)`)
    if (n(comodines)) partes.push(`Comodines: ${n(comodines)}`)
    if (n(pgA) || n(pgB)) partes.push(`Porterías grandes: A ${n(pgA)}, B ${n(pgB)}`)
    if (n(ppA) || n(ppB)) partes.push(`Porterías pequeñas: A ${n(ppA)}, B ${n(ppB)}`)
    return datosListos ? `Datos del ejercicio: ${partes.join('; ')}.` : ''
  }

  // Cuando jugadores, porterías y descripción están completos (y cada vez que cambian), se proponen
  // normas, variantes y puntos clave. Siguen siendo editables; si el usuario los edita, ya no se tocan.
  useEffect(() => {
    if (soloLectura || !file || !datosListos || !descEsMia.current || textosEditados.current) return
    // El objetivo no entra en la clave: lo rellena la propia IA y no debe provocar otra regeneración
    const clave = [descripcion.trim(), largo, ancho, jugA, porA, jugB, porB, comodines, pgA, pgB, ppA, ppB, colorA, colorB].join('|')
    if (clave === ultimaClave.current) return
    const t = setTimeout(() => {
      ultimaClave.current = clave
      void generar(file, descripcion)
    }, 1500)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, datosListos, descripcion, objetivo, largo, ancho, jugA, porA, jugB, porB, comodines, pgA, pgB, ppA, ppB, colorA, colorB])

  /** La IA (o, sin ella, el detector local) propone la ficha. Si hay descripción del usuario, la respeta y la usa. */
  async function generar(f: File, descUsuario: string, forzar = false) {
    setAvisoIA(null)
    const id = ++peticion.current
    setRellenando(true)
    const base64 = await blobABase64(await comprimir(f, 1400, 0.8))
    const conDesc = descUsuario.trim().length > 0
    let ficha: FichaEjercicio | null = null
    let jug: { ja: number; pa: number; jb: number; pb: number } | null = null
    let extra: { c: number; g: number } | null = null
    let aviso = conDesc
      ? 'Normas, variantes y puntos clave generados con IA a partir de tu descripción y la imagen. Revísalos.'
      : 'Campos rellenados con IA. Revísalos y corrige lo que haga falta.'
    try {
      const ctx = contextoDatos()
      const obj = objetivo.trim()
      const texto = [ctx, descUsuario.trim() && `Descripción de la tarea: ${descUsuario.trim()}`, obj && `Objetivo de la tarea: ${obj}`].filter(Boolean).join('\n')
      ficha = await rellenarDesdeImagen({ base64, mediaType: 'image/jpeg' }, texto)
      // El recuento de jugadores sale de contar los círculos de la imagen, no del texto de la IA
      // (que a veces se equivoca, p. ej. "5v2" con 4 azules, 4 rojos y 2 comodines).
      try {
        const det = await detectarJugadores(base64)
        if (det.azules + det.rojos > 0) {
          jug = { ja: det.azules, pa: det.porteros, jb: det.rojos, pb: 0 }
          extra = { c: det.neutros, g: det.porteria ? 1 : 0 }
        }
      } catch {
        /* sin detector: se usa el número que diga la IA */
      }
    } catch (err) {
      // Sin IA: ficha base según los elementos detectados por color en la imagen
      try {
        const det = await detectarJugadores(base64)
        ficha = fichaLocal(det, descUsuario)
        jug = { ja: det.azules, pa: det.porteros, jb: det.rojos, pb: 0 }
        extra = { c: det.neutros, g: det.porteria ? 1 : 0 }
        const partes = [`${det.azules} azules`, `${det.rojos} rojos`]
        if (det.neutros) partes.push(`${det.neutros} neutros`)
        if (det.porteros) partes.push('portero')
        if (det.porteria) partes.push(`portería ${det.porteria}`)
        if (det.balon) partes.push('balón')
        aviso = ficha
          ? `Detectado por IA: ficha base según lo detectado (${partes.join(', ')}). Es una plantilla: revísala y ajústala.`
          : `No se pudo autorrellenar (${(err as Error).message}) y no se detectaron jugadores. Puedes escribirlo a mano.`
      } catch {
        aviso = `No se pudo autorrellenar: ${(err as Error).message} Puedes escribirlo a mano.`
      }
    }
    if (id !== peticion.current) return // se cambió o quitó la imagen mientras tanto
    if (ficha) {
      // Nombre por defecto: el del archivo (sin extensión); si no tiene uno útil, el de la ficha
      const nombreArchivo = f.name.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').trim()
      const nombreDefecto = nombreArchivo && !/^(image|imagen|blob|captura)\d*$/i.test(nombreArchivo) ? nombreArchivo : ficha.nombre
      setNombre((n) => n.trim() || nombreDefecto)
      setCategoria((c) => c || ficha!.categoria)
      if (!jug) {
        const m = `${ficha.nombre} ${ficha.descripcion}`.match(/(\d+)\s*(?:vs\.?|contra|v)\s*(\d+)/i)
        if (m) {
          const pa = /portero/i.test(`${ficha.nombre} ${ficha.descripcion}`) ? 1 : 0
          jug = { ja: Number(m[1]), pa, jb: Number(m[2]), pb: 0 }
        }
      }
      if (jug) {
        const { ja, pa, jb, pb } = jug
        setJugA((x) => (x && x !== '0' ? x : String(ja)))
        setPorA((x) => (x && x !== '0' ? x : String(pa)))
        setJugB((x) => (x && x !== '0' ? x : String(jb)))
        setPorB((x) => (x && x !== '0' ? x : String(pb)))
      }
      if (extra) {
        const { c, g } = extra
        setComodines((x) => (x && x !== '0' ? x : String(c)))
        setPgA((x) => (x && x !== '0' ? x : String(g)))
        setPgB((x) => x || '0')
        setPpA((x) => x || '0')
        setPpB((x) => x || '0')
      }
      // El objetivo viene aparte; si la ficha lo trae dentro de la descripción ("Objetivo: …"), se separa.
      const m = ficha.descripcion.match(/\n*\s*Objetivo:\s*([\s\S]*)$/i)
      const objetivoIA = (ficha.objetivo || m?.[1] || '').trim()
      const descIA = m ? ficha.descripcion.slice(0, m.index).trim() : ficha.descripcion
      // Propuesta inicial de objetivos: solo si el campo está vacío (nunca pisa lo que haya escrito el usuario)
      if (objetivoIA) setObjetivo((o) => (forzar ? objetivoIA : o.trim() || objetivoIA))
      if (!conDesc) {
        setDescripcion(descIA)
        descEsMia.current = false
      }
      // No se pisan los textos que el usuario ya ha editado (salvo petición explícita)
      if (datosListos && descEsMia.current && (forzar || !textosEditados.current)) {
        setNormas(ficha.normas)
        setVariantes(ficha.variantes)
        setClaves(ficha.claves)
        textosEditados.current = false
      }
    }
    setAvisoIA(aviso)
    setRellenando(false)
  }

  function elegirImagen(f: File | null) {
    setFile(f)
    setAvisoIA(null)
    if (!editarId) textosEditados.current = false
    ultimaClave.current = ''
    if (editarId) return void setFile(f) // al editar no se rellena con IA por sorpresa
    if (!f) {
      peticion.current++
      return setRellenando(false)
    }
    void generar(f, descEsMia.current ? descripcion : '')
  }

  /** Dictado por voz (Web Speech API del navegador; funciona en Chrome y Edge). */
  function alternarDictado() {
    if (dictando) {
      reconocimiento.current?.stop()
      return
    }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) {
      setAvisoIA('Tu navegador no admite dictado por voz. Usa Chrome o Edge.')
      return
    }
    const rec = new SR()
    rec.lang = 'es-ES'
    rec.continuous = true
    rec.interimResults = true
    const base = descripcion.trim()
    let finales = ''
    rec.onresult = (ev: any) => {
      let provisional = ''
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const t = ev.results[i][0].transcript
        if (ev.results[i].isFinal) finales += t.trim() + ' '
        else provisional += t
      }
      descEsMia.current = true
      setDescripcion([base, (finales + provisional).trim()].filter(Boolean).join(' ').slice(0, 2000))
    }
    rec.onerror = (ev: any) => {
      if (ev.error !== 'no-speech' && ev.error !== 'aborted') {
        setAvisoIA(ev.error === 'not-allowed' ? 'Permite el acceso al micrófono en el navegador para dictar.' : `Error del micrófono: ${ev.error}`)
      }
    }
    rec.onend = () => setDictando(false)
    reconocimiento.current = rec
    rec.start()
    setDictando(true)
  }

  /** Descripción completa tal y como se guarda: jugadores, texto, objetivo, normas, variantes y puntos clave. */
  function componerDescripcion() {
    const equipo = (n: string, j: string, p: string) => {
      const nj = parseInt(j, 10) || 0
      const np = parseInt(p, 10) || 0
      return `Equipo ${n}: ${nj} jugador${nj === 1 ? '' : 'es'}${np > 0 ? ` + ${np} portero${np > 1 ? 's' : ''}` : ''}`
    }
    const c = parseInt(comodines, 10) || 0
    const n = (v: string) => parseInt(v, 10) || 0
    const dimOk = parseFloat(ancho) > 0 && parseFloat(largo) > 0
    const lineaJug =
      `${equipo('A', jugA, porA)}\n${equipo('B', jugB, porB)}\nColor equipo A: ${colorA}\nColor equipo B: ${colorB}` +
      (dimOk ? `\nDimensiones: ${ancho.replace(',', '.')} x ${largo.replace(',', '.')} m (ancho x largo)` : '') +
      (c > 0 ? `\nComodines: ${c}` : '') +
      (n(pgA) > 0 ? `\nPorterías grandes equipo A: ${n(pgA)}` : '') +
      (n(pgB) > 0 ? `\nPorterías grandes equipo B: ${n(pgB)}` : '') +
      (n(ppA) > 0 ? `\nPorterías pequeñas equipo A: ${n(ppA)}` : '') +
      (n(ppB) > 0 ? `\nPorterías pequeñas equipo B: ${n(ppB)}` : '')
    return [
      lineaJug,
      descripcion.trim(),
      objetivo.trim() && `Objetivo: ${objetivo.trim()}`,
      normas.trim() && `NORMAS\n${normas.trim()}`,
      variantes.trim() && `VARIANTES\n${variantes.trim()}`,
      claves.trim() && `PUNTOS CLAVE\n${claves.trim()}`,
    ]
      .filter(Boolean)
      .join('\n\n')
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    if (!file && !(editarId && original)) return setError('Selecciona una imagen del ejercicio.')
    setError(null)
    setGuardando(true)
    try {
      const descripcionFinal = componerDescripcion()

      if (editarId && original) {
        // Solo se reemplaza la imagen si el usuario eligió otra distinta
        const cambioImagen = file && file !== archivoOriginal.current
        const imagen_url = cambioImagen
          ? await blobADataUrl(file.size <= 1.5 * 1024 * 1024 ? file : await comprimir(file, 2400, 0.92))
          : undefined
        actualizarEjercicio(editarId, {
          nombre: nombre.trim() || 'Ejercicio sin nombre',
          categoria: categoria || null,
          descripcion: descripcionFinal,
          ...(imagen_url ? { imagen_url } : {}),
        })
        window.location.hash = `#/ejercicio/${editarId}`
        return
      }

      const ej = await crearEjercicio({
        file: file!,
        nombre: nombre.trim() || 'Ejercicio sin nombre',
        descripcion: descripcionFinal,
        categoria: categoria || null,
      })
      window.location.hash = `#/ejercicio/${ej.id}`
    } catch (err) {
      setError((err as Error).message)
      setGuardando(false)
    }
  }

  if (cargando) return <Spinner texto="Cargando ejercicio…" />
  if (guardando) return <Spinner texto="Guardando ejercicio…" />
  if (editarId && !original) return <p className="card text-red-700">{error ?? 'Ejercicio no encontrado.'}</p>

  return (
    <form onSubmit={guardar} className="mx-auto w-full">
      {editarId && !soloLectura && (
        <a href={`#/ejercicio/${editarId}`} className="mb-2 inline-block text-sm font-semibold text-athletic">
          ← Volver al ejercicio
        </a>
      )}
      <p className="kicker mb-2">Ficha de tarea</p><h1 className="page-title mb-3">{soloLectura ? 'Ejercicio' : editarId ? 'Editar ejercicio' : 'Nuevo ejercicio'}</h1>

      <div className={`grid gap-4 lg:items-start ${original ? 'lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)] xl:grid-cols-[minmax(0,4fr)_minmax(0,5fr)_minmax(0,6fr)]' : 'lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)]'}`}>
      {/* Columna izquierda: imagen + datos generales a su lado, y debajo colores y equipos */}
      <fieldset disabled={soloLectura} className="solo-lectura min-w-0 space-y-2.5 lg:sticky lg:top-20">
      <div className="grid gap-3">
      <div>
        <span className="label">Imagen del ejercicio{toggle('imagen')}</span>
        {rellenando && (
          <p className="mt-2 animate-pulse text-sm font-semibold text-athletic">Analizando la imagen y rellenando la ficha…</p>
        )}
        <div className={oculta('imagen') ? 'hidden' : ''}>
          {soloLectura ? (
            <VisorImagen src={original?.imagen_url} alt={nombre} disenoId={original?.diseno_id} />
          ) : (
            <ImageDropzone file={file} onChange={elegirImagen} disenoId={original?.diseno_id} />
          )}
          {avisoIA && !rellenando && <p className="mt-2 text-sm text-neutral-600">{avisoIA}</p>}
        </div>
      </div>

      </div>


      <div>
      <div className="grid grid-cols-2 gap-2">
        {(
          [
            ['colorA', 'Color equipo A', colorA, setColorA],
            ['colorB', 'Color equipo B', colorB, setColorB],
          ] as const
        ).map(([id, etiqueta, valor, set]) => (
          <div key={id}>
            <label className="label" htmlFor={id}>
              {etiqueta}
            </label>
            <div className="flex items-center gap-2">
              <span className="h-6 w-6 shrink-0 rounded-full border border-neutral-300" style={{ backgroundColor: COLORES[valor] }} aria-hidden="true" />
              <select id={id} className="field" value={valor} onChange={(e) => set(e.target.value)}>
                {Object.keys(COLORES).map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
        ))}
      </div>
      </div>

      <fieldset className="rounded-xl border border-line bg-white p-3 shadow-card">
        <div className="grid grid-cols-2 gap-2">
          <div className="order-first col-span-2 mx-auto w-full sm:w-1/2">
            <label className="label" htmlFor="jugTotal">
              Jugadores total
            </label>
            <input id="jugTotal" className="field" type="number" inputMode="numeric" min={0} max={60} value={jugTotal} onChange={(e) => setJugTotal(e.target.value)} placeholder="Ej.: 8" />
          </div>
          <div className="order-1">
            <label className="label" htmlFor="jugA">
              <span className="mr-1.5 inline-block h-3 w-3 rounded-full border border-neutral-300 align-middle" style={{ backgroundColor: COLORES[colorA] }} aria-hidden="true" />Jugadores equipo A
            </label>
            <input id="jugA" className="field" type="number" inputMode="numeric" min={0} max={30} value={jugA} onChange={(e) => setJugA(e.target.value)} placeholder="Ej.: 4" />
          </div>
          <div className="order-3">
            <label className="label" htmlFor="porA">
              <span className="mr-1.5 inline-block h-3 w-3 rounded-full border border-neutral-300 align-middle" style={{ backgroundColor: COLORES[colorA] }} aria-hidden="true" />Porteros equipo A
            </label>
            <input id="porA" className="field" type="number" inputMode="numeric" min={0} max={4} value={porA} onChange={(e) => setPorA(e.target.value)} placeholder="Ej.: 1" />
          </div>
          <div className="order-2">
            <label className="label" htmlFor="jugB">
              <span className="mr-1.5 inline-block h-3 w-3 rounded-full border border-neutral-300 align-middle" style={{ backgroundColor: COLORES[colorB] }} aria-hidden="true" />Jugadores equipo B
            </label>
            <input id="jugB" className="field" type="number" inputMode="numeric" min={0} max={30} value={jugB} onChange={(e) => setJugB(e.target.value)} placeholder="Ej.: 2" />
          </div>
          <div className="order-4">
            <label className="label" htmlFor="porB">
              <span className="mr-1.5 inline-block h-3 w-3 rounded-full border border-neutral-300 align-middle" style={{ backgroundColor: COLORES[colorB] }} aria-hidden="true" />Porteros equipo B
            </label>
            <input id="porB" className="field" type="number" inputMode="numeric" min={0} max={4} value={porB} onChange={(e) => setPorB(e.target.value)} placeholder="Ej.: 0" />
          </div>
          {(
            [
              ['pgA', 'Porterías grandes equipo A', pgA, setPgA, 'order-5'],
              ['pgB', 'Porterías grandes equipo B', pgB, setPgB, 'order-6'],
            ] as const
          ).map(([id, etiqueta, valor, set, orden]) => (
            <div key={id} className={orden}>
              <label className="label" htmlFor={id}>
                <span className="mr-1.5 inline-block h-3 w-3 rounded-full border border-neutral-300 align-middle" style={{ backgroundColor: COLORES[id.endsWith('A') ? colorA : colorB] }} aria-hidden="true" />
                {etiqueta}
              </label>
              <input id={id} className="field" type="number" inputMode="numeric" min={0} max={10} value={valor} onChange={(e) => set(e.target.value)} placeholder="0" />
            </div>
          ))}
          <div className="order-7 col-span-2 mx-auto w-full sm:w-1/2">
            <label className="label" htmlFor="comodines">
              Nº de comodines
            </label>
            <input id="comodines" className="field" type="number" inputMode="numeric" min={0} max={10} value={comodines} onChange={(e) => setComodines(e.target.value)} placeholder="0" />
          </div>
        </div>
      </fieldset>

      <fieldset className="rounded-xl border border-line bg-white p-3 shadow-card">
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ['ppA', 'Porterías pequeñas equipo A', ppA, setPpA],
              ['ppB', 'Porterías pequeñas equipo B', ppB, setPpB],
            ] as const
          ).map(([id, etiqueta, valor, set]) => (
            <div key={id}>
              <label className="label" htmlFor={id}>
                <span className="mr-1.5 inline-block h-3 w-3 rounded-full border border-neutral-300 align-middle" style={{ backgroundColor: COLORES[id.endsWith('A') ? colorA : colorB] }} aria-hidden="true" />
                {etiqueta}
              </label>
              <input id={id} className="field" type="number" inputMode="numeric" min={0} max={10} value={valor} onChange={(e) => set(e.target.value)} placeholder="0" />
            </div>
          ))}
        </div>
      </fieldset>
      </fieldset>

      {/* Columna derecha: textos */}
      <div className="space-y-2.5">
      <div ref={setDestinoAcciones} className="flex flex-wrap gap-2 empty:hidden" />

      {soloLectura ? (
        <a href={`#/ejercicio/${editarId}/editar`} className="btn-primary flex">Editar información</a>
      ) : (
      <div className="flex gap-2">
        <button type="submit" className="btn-primary flex-1" disabled={rellenando}>
          {editarId ? 'Guardar cambios' : 'Guardar ejercicio'}
        </button>
        {editarId && (
          <a
            href={`#/ejercicio/${editarId}`}
            className="btn-ghost flex-1"
          >
            Cancelar
          </a>
        )}
      </div>
      )}
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 p-2 text-sm font-medium text-red-800">{error}</p>
      )}

      <fieldset disabled={soloLectura} className="solo-lectura min-w-0 space-y-2.5">
      <fieldset className="space-y-2 rounded-xl border border-line bg-white p-3 pt-1 shadow-card">
        <legend className="px-2 text-xs font-extrabold uppercase tracking-wide text-neutral-800">Datos generales{toggle('datos')}</legend>
      <div className={oculta('datos') ? 'hidden' : 'space-y-2'}>
      <div className="grid gap-2">
      <div>
        <label className="label" htmlFor="nombre">
          Nombre
        </label>
        <input id="nombre" className="field" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={120} placeholder="Ej.: Rondo 5v2 con comodín" />
      </div>

      <div>
        <label className="label" htmlFor="cat">
          Categoría
        </label>
        <select id="cat" className="field" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
          <option value="">Selecciona…</option>
          {CATEGORIAS.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label" htmlFor="largo">
            Largo (m)
          </label>
          <input id="largo" className="field" type="number" inputMode="decimal" min={0} max={150} step="any" value={largo} onChange={(e) => setLargo(e.target.value)} placeholder="Ej.: 40" />
        </div>
        <div>
          <label className="label" htmlFor="ancho">
            Ancho (m)
          </label>
          <input id="ancho" className="field" type="number" inputMode="decimal" min={0} max={100} step="any" value={ancho} onChange={(e) => setAncho(e.target.value)} placeholder="Ej.: 30" />
        </div>
      </div>
      </div>
      </fieldset>
      <div>
        <div className="flex items-center justify-between gap-2">
          <label className="label" htmlFor="desc">
            Descripción{toggle('desc')}
          </label>
          {!soloLectura && <button
            type="button"
            onClick={alternarDictado}
            aria-pressed={dictando}
            className={`mb-1 rounded-full px-3 py-1 text-xs font-bold ${dictando ? 'animate-pulse bg-athletic text-white' : 'bg-neutral-200 text-neutral-800'}`}
          >
            {dictando ? '⏹ Parar dictado' : '🎤 Dictar'}
          </button>}
        </div>
        <div className={oculta('desc') ? 'hidden' : ''}>
        <AutoTextarea
          id="desc"
          rows={3}
          className="field"
          value={descripcion}
          onChange={(e) => {
            descEsMia.current = true
            setDescripcion(e.target.value)
          }}
          maxLength={2000}
          placeholder="Explica el ejercicio y qué es cada elemento (jugadores, portero, balón, porterías…). Puedes dictarlo con el micro."
        />
        {!soloLectura && !(datosListos && descEsMia.current) && (
          <p className="mt-2 text-sm text-neutral-500">Completa nombre, categoría y descripción: te propondré objetivo, normas, variantes y puntos clave (podrás editarlos).</p>
        )}
        {!soloLectura && file && datosListos && descEsMia.current && (
          <button type="button" onClick={() => void generar(file, descripcion, true)} disabled={rellenando} className="mt-2 text-sm font-semibold text-athletic disabled:opacity-50">
            {rellenando ? 'Generando propuestas…' : '✨ Proponer objetivo, normas, variantes y puntos clave'}
          </button>
        )}
        </div>
      </div>

      <div>
        <label className="label" htmlFor="objetivo">
          Objetivo{toggle('objetivo')}
        </label>
        <div className={oculta('objetivo') ? 'hidden' : ''}>
        <AutoTextarea
          id="objetivo"
          rows={2}
          className="field"
          value={objetivo}
          onChange={(e) => setObjetivo(e.target.value)}
          maxLength={500}
          placeholder="¿Qué se pretende conseguir con la tarea? Ej.: mantener la posesión bajo presión."
        />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="label" htmlFor="normas">
            Normas{toggle('normas')}
          </label>
          <div className={oculta('normas') ? 'hidden' : ''}>
          <AutoTextarea id="normas" rows={3} className="field" value={normas} onChange={(e) => {
              textosEditados.current = true
              setNormas(e.target.value)
            }} maxLength={1000} />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="variantes">
            Variantes{toggle('variantes')}
          </label>
          <div className={oculta('variantes') ? 'hidden' : ''}>
          <AutoTextarea id="variantes" rows={3} className="field" value={variantes} onChange={(e) => {
              textosEditados.current = true
              setVariantes(e.target.value)
            }} maxLength={1000} />
          </div>
        </div>

        <div className="md:col-span-2">
        <label className="label" htmlFor="claves">
          Puntos clave{toggle('claves')}
        </label>
        <div className={oculta('claves') ? 'hidden' : ''}>
        <AutoTextarea id="claves" rows={3} className="field" value={claves} onChange={(e) => {
              textosEditados.current = true
              setClaves(e.target.value)
            }} maxLength={1000} />
        </div>
        </div>
      </div>

      </fieldset>

      </div>

      {original && (
      <div className="lg:col-span-2 xl:col-span-1 xl:sticky xl:top-20 xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto">
      <Asistente
        inicial={obtenerTareaAnalizada(original.id)?.resultado ?? null}
        onAnalizado={(r) => guardarTareaAnalizada(original, r)}
        destinoAcciones={destinoAcciones}
        descripcion={descripcion}
        descripcionInforme={componerDescripcion()}
        nombre={nombre || undefined}
        categoria={categoria || null}
        imagenUrl={original.imagen_url}
        obtenerImagen={async () => {
          if (!file) return null
          return { base64: await blobABase64(await comprimir(file, 1400, 0.8)), mediaType: 'image/jpeg' }
        }}
      />
      </div>
      )}
      </div>
    </form>
  )
}
