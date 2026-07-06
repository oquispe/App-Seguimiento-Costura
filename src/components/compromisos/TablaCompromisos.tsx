import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Badge } from '../ui/Badge'
import type { CompromisoRow } from '../../lib/compromisos'

type SortKey = 'fecha_compromiso' | 'cliente' | 'area'
type FiltroEstado = 'todos' | 'vencido' | 'vigente'

function fmtFecha(s: string | null): string {
  if (!s) return '—'
  try {
    return format(new Date(s + 'T12:00:00'), 'dd/MM/yy', { locale: es })
  } catch {
    return '—'
  }
}

export function TablaCompromisos({ rows }: { rows: CompromisoRow[] }) {
  const [filtroArea, setFiltroArea] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('todos')
  const [sortKey, setSortKey] = useState<SortKey>('fecha_compromiso')
  const [sortAsc, setSortAsc] = useState(true)

  const areas = useMemo(
    () => Array.from(new Set(rows.map((r) => r.areaLabel))).sort(),
    [rows]
  )

  const filtradas = useMemo(() => {
    let out = rows
    if (filtroArea) out = out.filter((r) => r.areaLabel === filtroArea)
    if (filtroEstado === 'vencido') out = out.filter((r) => r.vencido)
    if (filtroEstado === 'vigente') out = out.filter((r) => !r.vencido)

    const sorted = [...out].sort((a, b) => {
      let cmp = 0
      if (sortKey === 'fecha_compromiso') cmp = (a.fecha_compromiso ?? '').localeCompare(b.fecha_compromiso ?? '')
      else if (sortKey === 'cliente') cmp = a.cliente.localeCompare(b.cliente)
      else cmp = a.areaLabel.localeCompare(b.areaLabel)
      return sortAsc ? cmp : -cmp
    })
    return sorted
  }, [rows, filtroArea, filtroEstado, sortKey, sortAsc])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((v) => !v)
    else { setSortKey(key); setSortAsc(true) }
  }

  const th = (key: SortKey, label: string) => (
    <th
      onClick={() => toggleSort(key)}
      className="px-3 py-2 text-left font-semibold text-ink-muted cursor-pointer select-none hover:text-ink whitespace-nowrap"
    >
      {label} {sortKey === key && (sortAsc ? '▲' : '▼')}
    </th>
  )

  if (rows.length === 0) {
    return (
      <div className="text-center py-10 text-sm text-ink-muted bg-white border border-line rounded-xl">
        No hay compromisos registrados en los ítems visibles.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={filtroArea}
          onChange={(e) => setFiltroArea(e.target.value)}
          className="text-xs border border-line rounded-lg px-2 py-1.5 bg-white text-ink"
        >
          <option value="">Todas las áreas</option>
          {areas.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <div className="flex items-center gap-1">
          {(['todos', 'vencido', 'vigente'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFiltroEstado(f)}
              className={`text-xs px-2 py-1 rounded-lg transition-colors ${filtroEstado === f ? 'bg-brand-600 text-white' : 'bg-white border border-line text-ink-muted hover:bg-surface'}`}
            >
              {f === 'todos' ? 'Todos' : f === 'vencido' ? 'Vencidos' : 'Vigentes'}
            </button>
          ))}
        </div>
        <span className="text-xs text-ink-muted ml-auto">{filtradas.length} de {rows.length}</span>
      </div>

      <div className="overflow-x-auto bg-white border border-line rounded-xl">
        <table className="w-full text-xs">
          <thead className="bg-surface border-b border-line">
            <tr>
              {th('cliente', 'Cliente')}
              <th className="px-3 py-2 text-left font-semibold text-ink-muted whitespace-nowrap">Estilo</th>
              <th className="px-3 py-2 text-left font-semibold text-ink-muted whitespace-nowrap">PO</th>
              <th className="px-3 py-2 text-left font-semibold text-ink-muted whitespace-nowrap">Color</th>
              {th('area', 'Área')}
              <th className="px-3 py-2 text-right font-semibold text-ink-muted whitespace-nowrap">Comprometidos</th>
              {th('fecha_compromiso', 'F. Compromiso')}
              <th className="px-3 py-2 text-left font-semibold text-ink-muted whitespace-nowrap">Próx. Reunión</th>
              <th className="px-3 py-2 text-left font-semibold text-ink-muted whitespace-nowrap">Estado</th>
              <th className="px-3 py-2 text-left font-semibold text-ink-muted">Notas</th>
            </tr>
          </thead>
          <tbody>
            {filtradas.map((r, i) => (
              <tr key={`${r.item_key}-${r.area}`} className={`border-b border-line last:border-0 ${i % 2 === 1 ? 'bg-surface/40' : ''}`}>
                <td className="px-3 py-2 whitespace-nowrap">{r.cliente}</td>
                <td className="px-3 py-2 whitespace-nowrap">{r.estilo}</td>
                <td className="px-3 py-2 whitespace-nowrap">{r.po}</td>
                <td className="px-3 py-2 whitespace-nowrap">{r.color}</td>
                <td className="px-3 py-2 whitespace-nowrap">{r.areaLabel}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">{r.comprometidos ?? '—'}</td>
                <td className="px-3 py-2 whitespace-nowrap">{fmtFecha(r.fecha_compromiso)}</td>
                <td className="px-3 py-2 whitespace-nowrap">{fmtFecha(r.proxima_reunion)}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <Badge variant={r.vencido ? 'rojo' : 'verde'}>{r.vencido ? 'Vencido' : 'Vigente'}</Badge>
                </td>
                <td className="px-3 py-2 max-w-xs truncate" title={r.notas}>{r.notas || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
