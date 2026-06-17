import type { ItemCruzado, EstadoAuditoria, LlaveCruce } from '../../types'
import type { Semaforo } from '../../lib/parsers/dateUtils'
import { estadoEfectivo } from '../../lib/posicion'

export interface Filtros {
  cliente: string
  semana: string
  estado: EstadoAuditoria | 'Por auditar' | ''
  responsable: string
  semaforo: Semaforo | ''
}

interface Props {
  items: ItemCruzado[]
  filtros: Filtros
  onChange: (f: Filtros) => void
  llave: LlaveCruce
  onLlaveChange: (l: LlaveCruce) => void
}

const ESTADOS: (EstadoAuditoria | 'Por auditar')[] = ['Pendiente', 'Por auditar', 'Programada', 'En proceso', 'Aprobada', 'Rechazada', 'Reprogramada']
const SEMAFOROS: { value: Semaforo; label: string }[] = [
  { value: 'rojo', label: 'Rojo (urgente)' },
  { value: 'ambar', label: 'Ámbar (próximo)' },
  { value: 'verde', label: 'Verde (a tiempo)' },
  { value: 'sin-fecha', label: 'Sin fecha' },
]

function unique(items: ItemCruzado[], key: keyof ItemCruzado): string[] {
  return Array.from(new Set(items.map((i) => String(i[key] ?? '').trim()).filter(Boolean))).sort()
}

export function PanelFiltros({ items, filtros, onChange, llave, onLlaveChange }: Props) {
  const set = (k: keyof Filtros, v: string) => onChange({ ...filtros, [k]: v })

  return (
    <div className="bg-white border border-line rounded-xl p-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Select
          label="Cliente"
          value={filtros.cliente}
          onChange={(v) => set('cliente', v)}
          options={unique(items, 'cliente')}
        />
        <Select
          label="Semana"
          value={filtros.semana}
          onChange={(v) => set('semana', v)}
          options={unique(items, 'semana')}
        />
        <Select
          label="Estado"
          value={filtros.estado}
          onChange={(v) => set('estado', v)}
          options={ESTADOS}
        />
        <Select
          label="Responsable"
          value={filtros.responsable}
          onChange={(v) => set('responsable', v)}
          options={unique(items, 'responsable')}
        />
        <div>
          <label className="block text-xs font-medium text-ink-muted mb-1">Semáforo</label>
          <select
            value={filtros.semaforo}
            onChange={(e) => set('semaforo', e.target.value)}
            className="w-full border border-line rounded-lg px-2 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">Todos</option>
            {SEMAFOROS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-muted mb-1">Llave cruce</label>
          <select
            value={llave}
            onChange={(e) => onLlaveChange(e.target.value as LlaveCruce)}
            className="w-full border border-line rounded-lg px-2 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="PO">PO</option>
            <option value="PO+COLOR">PO + Color</option>
          </select>
        </div>
      </div>
    </div>
  )
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div>
      <label className="block text-xs font-medium text-ink-muted mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-line rounded-lg px-2 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand-500"
      >
        <option value="">Todos</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}

export function aplicarFiltros(items: ItemCruzado[], f: Filtros): ItemCruzado[] {
  return items.filter((it) => {
    if (f.cliente && it.cliente !== f.cliente) return false
    if (f.semana && it.semana !== f.semana) return false
    if (f.estado && estadoEfectivo(it) !== f.estado) return false
    if (f.responsable && it.responsable !== f.responsable) return false
    if (f.semaforo && it.semaforo !== f.semaforo) return false
    return true
  })
}
