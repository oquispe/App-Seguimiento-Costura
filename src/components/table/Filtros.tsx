import { useState, useMemo } from 'react'
import { Info, X } from 'lucide-react'
import type { ItemCruzado, LlaveCruce } from '../../types'
import type { Semaforo } from '../../lib/parsers/dateUtils'
import { estadoEfectivo, type EstadoEfectivo } from '../../lib/posicion'

export interface Filtros {
  cliente: string
  semana: string
  estado: EstadoEfectivo | ''
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

// Orden de display: de más avanzado a más inicial
const ESTADOS: EstadoEfectivo[] = [
  'Exportado', 'Cerrado', 'Por auditar', 'Sin datos',
  'Por Finalizar', 'Finalizando', 'Pendiente', 'Programada', 'En proceso', 'Reprogramada',
]

const SEMAFOROS: { value: Semaforo; label: string }[] = [
  { value: 'rojo',      label: '🔴 Urgente' },
  { value: 'ambar',     label: '🟡 Próximo' },
  { value: 'verde',     label: '🟢 A tiempo' },
  { value: 'sin-fecha', label: '⚪ Sin fecha' },
]

// Colores de los chips por estado
const CHIP: Record<string, string> = {
  'Exportado':     'bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-200',
  'Cerrado':       'bg-teal-100    text-teal-800    border-teal-300    hover:bg-teal-200',
  'Por auditar':   'bg-cyan-100    text-cyan-800    border-cyan-300    hover:bg-cyan-200',
  'Sin datos':     'bg-red-100     text-red-800     border-red-300     hover:bg-red-200',
  'Por Finalizar': 'bg-amber-100   text-amber-800   border-amber-300   hover:bg-amber-200',
  'Finalizando':   'bg-indigo-100  text-indigo-800  border-indigo-300  hover:bg-indigo-200',
  'Pendiente':     'bg-slate-100   text-slate-700   border-slate-300   hover:bg-slate-200',
  'Programada':    'bg-indigo-100  text-indigo-800  border-indigo-300  hover:bg-indigo-200',
  'En proceso':    'bg-teal-100    text-teal-800    border-teal-300    hover:bg-teal-200',
  'Reprogramada':  'bg-amber-100   text-amber-800   border-amber-300   hover:bg-amber-200',
}

// Leyenda explicativa
const LEYENDA: { estado: EstadoEfectivo; desc: string }[] = [
  { estado: 'Exportado',     desc: 'Prendas despachadas al cliente' },
  { estado: 'Cerrado',       desc: 'Auditoría completada (aprobada o rechazada)' },
  { estado: 'Por auditar',   desc: 'Prendas en APT — listas para auditar' },
  { estado: 'Sin datos',     desc: 'PO+Color no encontrado en el Status — revisar si el color coincide o si ya salió del sistema' },
  { estado: 'Por Finalizar', desc: 'Todas las prendas llegaron a Acabado, faltan pasar a APT' },
  { estado: 'Finalizando',   desc: 'Parte de las prendas están en Acabado' },
  { estado: 'Programada',    desc: 'Fecha de auditoría coordinada' },
  { estado: 'En proceso',    desc: 'Auditoría en curso' },
  { estado: 'Reprogramada',  desc: 'Se cambió la fecha de auditoría' },
  { estado: 'Pendiente',     desc: 'En producción — aún sin llegar a Acabado' },
]

function unique(items: ItemCruzado[], key: keyof ItemCruzado): string[] {
  return Array.from(
    new Set(items.map((i) => String(i[key] ?? '').trim()).filter(Boolean))
  ).sort()
}

export function PanelFiltros({ items, filtros, onChange, llave, onLlaveChange }: Props) {
  const [showLeyenda, setShowLeyenda] = useState(false)

  const set = (k: keyof Filtros, v: string) => onChange({ ...filtros, [k]: v })

  const limpiarTodo = () =>
    onChange({ cliente: '', semana: '', estado: '', responsable: '', semaforo: '' })

  // Cuenta de ítems por estado efectivo (solo los visibles = sin filtros de estado)
  const counts = useMemo(() => {
    const m: Partial<Record<EstadoEfectivo, number>> = {}
    for (const it of items) {
      const e = estadoEfectivo(it)
      m[e] = (m[e] ?? 0) + 1
    }
    return m
  }, [items])

  const filtrosActivos = [filtros.cliente, filtros.semana, filtros.estado, filtros.responsable, filtros.semaforo]
    .filter(Boolean).length

  return (
    <div className="bg-white border border-line rounded-xl p-4 space-y-3">

      {/* Fila 1: dropdowns */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <Select label="Cliente"      value={filtros.cliente}      onChange={(v) => set('cliente', v)}      options={unique(items, 'cliente')} />
        <Select label="Semana"       value={filtros.semana}       onChange={(v) => set('semana', v)}       options={unique(items, 'semana')} />
        <Select label="Responsable"  value={filtros.responsable}  onChange={(v) => set('responsable', v)}  options={unique(items, 'responsable')} />

        <div>
          <label className="block text-xs font-medium text-ink-muted mb-1">Semáforo</label>
          <select value={filtros.semaforo} onChange={(e) => set('semaforo', e.target.value)}
            className="w-full border border-line rounded-lg px-2 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand-500">
            <option value="">Todos</option>
            {SEMAFOROS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-ink-muted mb-1">Llave cruce</label>
          <select value={llave} onChange={(e) => onLlaveChange(e.target.value as LlaveCruce)}
            className="w-full border border-line rounded-lg px-2 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand-500">
            <option value="PO">PO</option>
            <option value="PO+COLOR">PO + Color</option>
          </select>
        </div>
      </div>

      {/* Fila 2: chips de estado */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-ink-muted">
            Filtrar por estado
            {filtros.estado && <span className="ml-1 text-brand-600">· {filtros.estado} seleccionado</span>}
          </span>
          <button onClick={() => setShowLeyenda(v => !v)}
            className="flex items-center gap-1 text-xs text-ink-muted hover:text-ink transition-colors">
            <Info className="w-3.5 h-3.5" />
            {showLeyenda ? 'Ocultar leyenda' : '¿Qué significa cada estado?'}
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5 items-center">
          {ESTADOS.map(e => {
            const count = counts[e] ?? 0
            if (count === 0) return null
            const active = filtros.estado === e
            return (
              <button key={e} onClick={() => set('estado', active ? '' : e)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all
                  ${CHIP[e] ?? 'bg-slate-100 text-slate-700 border-slate-300'}
                  ${active ? 'ring-2 ring-offset-1 ring-brand-500 shadow-sm scale-105' : ''}`}>
                {e}
                <span className="bg-black/10 rounded-full px-1.5 py-0.5 font-bold leading-none">{count}</span>
              </button>
            )
          })}

          {filtrosActivos > 0 && (
            <button onClick={limpiarTodo}
              className="ml-auto flex items-center gap-1 text-xs text-ink-muted hover:text-red-600 transition-colors border border-dashed border-slate-300 rounded-full px-2.5 py-1">
              <X className="w-3 h-3" />
              Limpiar filtros ({filtrosActivos})
            </button>
          )}
        </div>
      </div>

      {/* Fila 3: leyenda colapsable */}
      {showLeyenda && (
        <div className="border-t border-line pt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2">
          {LEYENDA.map(({ estado, desc }) => (
            <div key={estado} className="flex items-start gap-2">
              <span className={`shrink-0 inline-block px-2 py-0.5 rounded-full text-xs font-medium border
                ${CHIP[estado] ?? 'bg-slate-100 text-slate-700 border-slate-300'}`}>
                {estado}
              </span>
              <span className="text-xs text-ink-muted leading-tight pt-0.5">{desc}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Select({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: string[]
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-ink-muted mb-1">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full border border-line rounded-lg px-2 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand-500">
        <option value="">Todos</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}

export function aplicarFiltros(items: ItemCruzado[], f: Filtros): ItemCruzado[] {
  return items.filter((it) => {
    if (f.cliente     && it.cliente      !== f.cliente)          return false
    if (f.semana      && it.semana       !== f.semana)           return false
    if (f.estado      && estadoEfectivo(it) !== f.estado)        return false
    if (f.responsable && it.responsable  !== f.responsable)      return false
    if (f.semaforo    && it.semaforo     !== f.semaforo)         return false
    return true
  })
}
