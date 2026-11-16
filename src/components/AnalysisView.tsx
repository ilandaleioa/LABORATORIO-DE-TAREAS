import type { Analisis } from '../types'

export function fechaCorta(iso: string) {
  return new Date(iso).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })
}

export function etiquetaMods(a: Analisis) {
  if (!a.es_version_modificada) return 'Base'
  const m = a.modificadores
  return `+${m.comodines} comodín · +${m.porterias} portería`
}

export default function AnalysisView({ analisis }: { analisis: Analisis }) {
  return (
    <div className="space-y-4">
      {analisis.dinamica_general && (
        <section className="card">
          <h3 className="section-title !mt-0">Dinámica general</h3>
          <p className="text-sm leading-relaxed">{analisis.dinamica_general}</p>
        </section>
      )}

      {analisis.es_version_modificada && analisis.impacto_modificadores && (
        <section className="card border-l-4 border-athletic !bg-athletic-light/40">
          <h3 className="section-title !mt-0">Impacto de los cambios</h3>
          <p className="text-sm leading-relaxed">{analisis.impacto_modificadores}</p>
        </section>
      )}

      <section className="card">
        <h3 className="section-title !mt-0">Puntos clave</h3>
        <ul className="space-y-2">
          {analisis.puntos_clave.map((p, i) => (
            <li key={i} className="flex gap-2 text-sm leading-relaxed">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-bold text-white">
                {i + 1}
              </span>
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="section-title">Roles</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {analisis.roles.map((r, i) => (
            <article key={i} className="card border-t-4 border-ink">
              <h4 className="font-bold">{r.posicion}</h4>
              <p className="mt-1 text-sm leading-relaxed text-neutral-700">{r.descripcion}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
