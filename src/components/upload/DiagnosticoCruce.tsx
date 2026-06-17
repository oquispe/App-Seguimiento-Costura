import { AlertTriangle } from 'lucide-react'
import type { DiagnosticoCruce } from '../../types'

interface Props {
  diagnostico: DiagnosticoCruce
}

export function PanelDiagnostico({ diagnostico: d }: Props) {
  return (
    <div className="bg-white border border-line rounded-xl p-5">
      <h3 className="text-sm font-semibold text-ink mb-3 flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-500" />
        Diagnóstico de cruce
      </h3>

      <div className="grid grid-cols-4 gap-4 mb-4">
        <Stat label="Auditorías totales" value={d.total_auditorias} />
        <Stat label="Con PGO" value={d.con_pgo} of={d.total_auditorias} />
        <Stat label="En proceso (con Cortes)" value={d.con_cortes} of={d.total_auditorias} />
        <Stat label="Cerrados (por auditar)" value={d.cerrados.length} of={d.total_auditorias} />
      </div>

      {d.sin_pgo.length > 0 && (
        <Details title={`POs sin PGO (${d.sin_pgo.length})`} items={d.sin_pgo} color="amber" />
      )}
      {d.cerrados.length > 0 && (
        <Details title={`Cerrados — sin fila en Cortes, listos para auditar (${d.cerrados.length})`} items={d.cerrados} color="slate" />
      )}
    </div>
  )
}

function Stat({ label, value, of: total }: { label: string; value: number; of?: number }) {
  const pct = total ? Math.round((value / total) * 100) : null
  return (
    <div className="text-center">
      <div className="text-2xl font-bold text-ink">{value}</div>
      <div className="text-xs text-ink-muted mt-0.5">{label}</div>
      {pct !== null && (
        <div className="text-xs text-ink-muted">({pct}%)</div>
      )}
    </div>
  )
}

function Details({ title, items, color }: { title: string; items: string[]; color: 'amber' | 'slate' }) {
  const cls = color === 'amber' ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-slate-50 border-slate-200 text-slate-600'
  return (
    <details className={`mt-2 border rounded-lg p-3 ${cls}`}>
      <summary className="cursor-pointer text-xs font-medium">{title}</summary>
      <div className="mt-2 flex flex-wrap gap-1.5 max-h-32 overflow-auto">
        {items.map((po) => (
          <span key={po} className="bg-white border border-current/20 rounded px-2 py-0.5 text-xs font-mono">
            {po}
          </span>
        ))}
      </div>
    </details>
  )
}
