import type { KPIs } from '../../types'

interface Props {
  kpis: KPIs
}

export function KPICards({ kpis }: Props) {
  const cards = [
    { label: 'Total POs', value: kpis.total, color: 'text-ink' },
    { label: 'Auditadas', value: kpis.auditadas, color: 'text-emerald-600' },
    { label: 'Pendientes', value: kpis.pendientes, color: 'text-amber-600' },
    { label: 'Vencidas', value: kpis.vencidas, color: 'text-red-700', danger: true },
    { label: '% Cumplimiento', value: `${kpis.pct_cumplimiento.toFixed(1)}%`, color: 'text-brand' },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {cards.map((c) => (
        <div
          key={c.label}
          className={`rounded-xl p-4 text-center border ${
            c.danger ? 'bg-red-50 border-red-100' : 'bg-white border-line'
          }`}
        >
          <div className={`text-2xl font-bold ${c.color}`}>{c.value}</div>
          <div className={`text-xs mt-1 ${c.danger ? 'text-red-700' : 'text-ink-muted'}`}>{c.label}</div>
        </div>
      ))}
    </div>
  )
}

export function calcularKPIs(items: import('../../types').ItemCruzado[]): KPIs {
  const total = items.length
  const auditadas = items.filter((i) => i.estado === 'Aprobada' || i.estado === 'Rechazada').length
  const pendientes = items.filter((i) => i.estado === 'Pendiente').length
  const vencidas = items.filter(
    (i) => i.semaforo === 'rojo' && i.estado === 'Pendiente'
  ).length
  const pct_cumplimiento = total > 0 ? (auditadas / total) * 100 : 0

  // Por persona
  const personaMap = new Map<string, { total: number; aprobadas: number; vencidas: number }>()
  for (const it of items) {
    const key = it.responsable?.trim() || 'Sin asignar'
    if (!personaMap.has(key)) personaMap.set(key, { total: 0, aprobadas: 0, vencidas: 0 })
    const p = personaMap.get(key)!
    p.total++
    if (it.estado === 'Aprobada') p.aprobadas++
    if (it.semaforo === 'rojo' && it.estado === 'Pendiente') p.vencidas++
  }

  const por_persona = Array.from(personaMap.entries()).map(([responsable, p]) => ({
    responsable,
    total: p.total,
    aprobadas: p.aprobadas,
    vencidas: p.vencidas,
    pct: p.total > 0 ? (p.aprobadas / p.total) * 100 : 0,
  }))

  return { total, auditadas, pendientes, vencidas, pct_cumplimiento, por_persona }
}
