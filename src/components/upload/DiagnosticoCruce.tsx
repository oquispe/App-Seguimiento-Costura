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
        <Stat label="Con datos en Status" value={d.con_cortes} of={d.total_auditorias} />
        <Stat
          label="Sin datos en Status"
          value={d.sin_match.length}
          of={d.total_auditorias}
          alert={d.sin_match.length > 0}
        />
      </div>

      {d.sin_pgo.length > 0 && (
        <DetailsPO
          title={`POs sin PGO (${d.sin_pgo.length})`}
          items={d.sin_pgo}
          color="amber"
        />
      )}

      {d.sin_match.length > 0 && (
        <DetailsItems
          title={`Sin match en Status — revisar color o PO (${d.sin_match.length})`}
          items={d.sin_match}
        />
      )}
    </div>
  )
}

function Stat({ label, value, of: total, alert }: {
  label: string; value: number; of?: number; alert?: boolean
}) {
  const pct = total ? Math.round((value / total) * 100) : null
  return (
    <div className="text-center">
      <div className={`text-2xl font-bold ${alert && value > 0 ? 'text-red-600' : 'text-ink'}`}>
        {value}
      </div>
      <div className="text-xs text-ink-muted mt-0.5">{label}</div>
      {pct !== null && (
        <div className="text-xs text-ink-muted">({pct}%)</div>
      )}
    </div>
  )
}

function DetailsPO({ title, items, color }: { title: string; items: string[]; color: 'amber' | 'slate' }) {
  const cls = color === 'amber'
    ? 'bg-amber-50 border-amber-200 text-amber-700'
    : 'bg-slate-50 border-slate-200 text-slate-600'
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

function DetailsItems({ title, items }: { title: string; items: { po: string; color: string }[] }) {
  return (
    <details className="mt-2 border border-red-200 rounded-lg p-3 bg-red-50 text-red-700" open>
      <summary className="cursor-pointer text-xs font-medium">{title}</summary>
      <p className="text-xs mt-1 mb-2 text-red-600">
        Estos ítems no se encontraron en el Status de producción. Pueden estar exportados, o el color puede tener un nombre diferente en el Excel de Auditorías. En el tablero aparecen como <strong>"Sin datos"</strong>.
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5 max-h-40 overflow-auto">
        {items.map((it, i) => (
          <span key={i} className="bg-white border border-red-200 rounded px-2 py-0.5 text-xs font-mono">
            {it.po} · {it.color}
          </span>
        ))}
      </div>
    </details>
  )
}
