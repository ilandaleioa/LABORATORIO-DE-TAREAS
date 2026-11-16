import type { Modificadores } from '../types'

interface Props {
  valor: Modificadores
  onChange: (m: Modificadores) => void
  onReanalizar: () => void
  cargando: boolean
  puedeReanalizar: boolean
}

function Contador({
  etiqueta,
  n,
  onMas,
  onMenos,
}: {
  etiqueta: string
  n: number
  onMas: () => void
  onMenos: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-neutral-50 p-3 ring-1 ring-line">
      <div>
        <p className="text-sm font-semibold">{etiqueta}</p>
        <p className="text-2xl font-extrabold tabular-nums">{n}</p>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onMenos}
          disabled={n === 0}
          aria-label={`Quitar ${etiqueta.toLowerCase()}`}
          className="btn-ghost h-12 w-12 !p-0 text-xl"
        >
          −
        </button>
        <button
          type="button"
          onClick={onMas}
          aria-label={`Añadir ${etiqueta.toLowerCase()}`}
          className="btn-dark h-12 w-12 !p-0 text-xl"
        >
          +
        </button>
      </div>
    </div>
  )
}

export default function ModificadoresPanel({ valor, onChange, onReanalizar, cargando, puedeReanalizar }: Props) {
  const sinCambios = valor.comodines === 0 && valor.porterias === 0
  return (
    <section className="card space-y-3">
      <h3 className="section-title !mt-0">Modificadores del ejercicio</h3>
      <Contador
        etiqueta="Comodines"
        n={valor.comodines}
        onMas={() => onChange({ ...valor, comodines: Math.min(10, valor.comodines + 1) })}
        onMenos={() => onChange({ ...valor, comodines: Math.max(0, valor.comodines - 1) })}
      />
      <Contador
        etiqueta="Porterías"
        n={valor.porterias}
        onMas={() => onChange({ ...valor, porterias: Math.min(10, valor.porterias + 1) })}
        onMenos={() => onChange({ ...valor, porterias: Math.max(0, valor.porterias - 1) })}
      />
      <button
        type="button"
        onClick={onReanalizar}
        disabled={cargando || sinCambios || !puedeReanalizar}
        className="btn-primary w-full"
      >
        {cargando ? 'Analizando…' : 'Reanalizar con estos cambios'}
      </button>
      {!puedeReanalizar && (
        <p className="text-xs text-neutral-500">Primero genera el análisis base del ejercicio.</p>
      )}
      {puedeReanalizar && sinCambios && (
        <p className="text-xs text-neutral-500">Añade al menos un comodín o una portería.</p>
      )}
    </section>
  )
}
