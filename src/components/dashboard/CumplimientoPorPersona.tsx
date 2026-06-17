import type { PersonaKPI } from '../../types'

interface Props {
  personas: PersonaKPI[]
}

export function CumplimientoPorPersona({ personas }: Props) {
  const sorted = [...personas].sort((a, b) => b.pct - a.pct)

  return (
    <div className="bg-white border border-line rounded-xl overflow-hidden">
      <div className="p-4 border-b border-line">
        <h3 className="font-semibold text-ink text-sm">Cumplimiento por responsable</h3>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-surface text-xs text-ink-muted uppercase">
          <tr>
            <th className="text-left px-4 py-2">Responsable</th>
            <th className="text-center px-4 py-2">Total</th>
            <th className="text-center px-4 py-2">Aprobadas</th>
            <th className="text-center px-4 py-2">Vencidas</th>
            <th className="text-left px-4 py-2 w-48">% Cumplimiento</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {sorted.map((p) => (
            <tr key={p.responsable} className="hover:bg-surface transition-colors">
              <td className="px-4 py-2.5 font-medium text-ink">{p.responsable}</td>
              <td className="px-4 py-2.5 text-center text-ink-muted">{p.total}</td>
              <td className="px-4 py-2.5 text-center text-emerald-600 font-medium">{p.aprobadas}</td>
              <td className="px-4 py-2.5 text-center text-red-600 font-medium">{p.vencidas}</td>
              <td className="px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-surface rounded-full h-2">
                    <div
                      className="h-2 rounded-full transition-all"
                      style={{
                        width: `${p.pct}%`,
                        backgroundColor: p.pct >= 80 ? '#10B981' : p.pct >= 50 ? '#F59E0B' : '#EF4444',
                      }}
                    />
                  </div>
                  <span className="text-xs text-ink-muted w-10 text-right">
                    {p.pct.toFixed(0)}%
                  </span>
                </div>
              </td>
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-ink-muted">
                Sin datos de responsables
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
