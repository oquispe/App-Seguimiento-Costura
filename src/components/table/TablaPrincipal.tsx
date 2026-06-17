import { Fragment, useState, useCallback } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { ChevronRight, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { SemaforoDot } from '../ui/Semaforo'
import { Badge } from '../ui/Badge'
import { ubicacionActual, estaListoParaAuditar, estadoEfectivo } from '../../lib/posicion'
import type { ItemCruzado, EstadoAuditoria, CompromisosEtapas } from '../../types'

interface Props {
  items: ItemCruzado[]
  onSelectItem: (item: ItemCruzado) => void
  agruparPor: 'semana' | 'cliente' | 'ninguno'
}

const ESTADO_VARIANT: Record<EstadoAuditoria, 'verde' | 'ambar' | 'rojo' | 'brand' | 'slate' | 'teal'> = {
  Aprobada:    'verde',
  Rechazada:   'rojo',
  Pendiente:   'slate',
  Programada:  'brand',
  'En proceso': 'teal',
  Reprogramada: 'ambar',
}

function fmtDate(d: Date | null | undefined): string {
  if (!d) return '—'
  try { return format(new Date(d), 'dd/MM/yy', { locale: es }) } catch { return '—' }
}

/** Detecta si algún compromiso de área está vencido (fecha pasada + aún hay piezas) */
function tieneCompromisoVencido(
  compromisos: CompromisosEtapas,
  item: ItemCruzado
): boolean {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const piezasPorEtapa: Record<string, number> = {
    costura:    item.en_estanteria + item.en_proceso,
    bordado:    item.en_bordado,
    estampado:  item.en_estampado,
    transfer:   item.en_transfer,
    lavanderia: item.en_lavanderia,
    acabados:   item.en_acabados,
  }
  return Object.entries(compromisos).some(([etapa, comp]) => {
    if (!comp.fecha_compromiso) return false
    const fecha = new Date(comp.fecha_compromiso + 'T12:00:00')
    const piezas = piezasPorEtapa[etapa] ?? 0
    return fecha < hoy && piezas > 0
  })
}

/**
 * Chips de posición de producción: de un vistazo, dónde están las prendas AHORA.
 * Etapas superadas → "OK" (sin números). Etapa(s) con piezas detenidas → cantidad.
 */
function PosicionChips({ item }: { item: ItemCruzado }) {
  const vencido = tieneCompromisoVencido(item.compromisos, item)

  if (estaListoParaAuditar(item)) {
    return <div className="min-w-0" />
  }

  const ubicacion = ubicacionActual(item).filter((u) => !u.ok)

  return (
    <div className="flex flex-wrap gap-1 items-center min-w-0">
      {ubicacion.map((u) => (
        <Badge key={u.key} variant="ambar">
          {u.label} {u.cantidad}
        </Badge>
      ))}
      {vencido && (
        <span title="Compromiso vencido">
          <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
        </span>
      )}
    </div>
  )
}

function RowItem({ item, onClick }: { item: ItemCruzado; onClick: () => void }) {
  const isVencidaPendiente = item.semaforo === 'rojo' && item.estado === 'Pendiente'
  return (
    <tr
      className={`border-b border-line hover:bg-blue-50 cursor-pointer transition-colors ${
        isVencidaPendiente ? 'bg-red-50' : ''
      }`}
      onClick={onClick}
    >
      <td className="px-4 py-2.5 text-sm text-ink-muted whitespace-nowrap">{item.semana}</td>
      <td className="px-4 py-2.5 text-sm font-medium text-ink">{item.cliente}</td>
      <td className="px-4 py-2.5 text-sm text-ink">{item.estilo}</td>
      <td className="px-4 py-2.5 text-sm font-mono text-ink">{item.po}</td>
      <td className="px-4 py-2.5 text-sm text-ink">{item.color}</td>
      <td className="px-4 py-2.5 text-sm text-center text-ink-muted">{item.cant_prog ?? '—'}</td>
      <td className="px-4 py-2.5 text-sm text-ink-muted text-center">{item.externa || '—'}</td>
      <td className="px-4 py-2.5 max-w-xs">
        <PosicionChips item={item} />
      </td>
      <td className="px-4 py-2.5 text-sm text-ink-muted whitespace-nowrap">{fmtDate(item.fin_entrega)}</td>
      <td className="px-4 py-2.5 whitespace-nowrap">
        <div className="flex items-center gap-1.5">
          <SemaforoDot valor={item.semaforo} dias={item.dias_auditoria_final} showLabel />
          <span className="text-xs text-ink-muted">{fmtDate(item.auditoria_final)}</span>
        </div>
      </td>
      <td className="px-4 py-2.5">
        {estadoEfectivo(item) === 'Por auditar' ? (
          <Badge variant="cyan">Por auditar</Badge>
        ) : (
          <Badge variant={ESTADO_VARIANT[item.estado]}>{item.estado}</Badge>
        )}
      </td>
      <td className="px-4 py-2.5 text-sm text-ink-muted">{item.responsable || '—'}</td>
      <td className="px-4 py-2.5">
        <ChevronRight className="w-4 h-4 text-ink-muted" />
      </td>
    </tr>
  )
}

/** Clave de agrupación tolerante a mayúsculas/espacios. */
function claveAgrupacion(v: string): string {
  return v.trim().toUpperCase().replace(/\s+/g, ' ')
}

/** Agrupa preservando el orden de primera aparición (secuencia del Excel). */
function agruparPorClave<T>(items: T[], clave: (it: T) => string): Map<string, { label: string; items: T[] }> {
  const groups = new Map<string, { label: string; items: T[] }>()
  for (const it of items) {
    const raw = clave(it)
    const key = claveAgrupacion(raw)
    if (!groups.has(key)) groups.set(key, { label: raw, items: [] })
    groups.get(key)!.items.push(it)
  }
  return groups
}

// ─── Cabeceras colapsables ────────────────────────────────────────────────────

function SemanaHeader({ label, count, open, onToggle }: { label: string; count: number; open: boolean; onToggle: () => void }) {
  return (
    <tr className="bg-brand-600 cursor-pointer select-none hover:bg-brand-700 transition-colors" onClick={onToggle}>
      <td colSpan={13} className="px-4 py-2">
        <div className="flex items-center gap-2">
          {open
            ? <ChevronDown className="w-4 h-4 text-white/80 shrink-0" />
            : <ChevronRight className="w-4 h-4 text-white/80 shrink-0" />}
          <span className="text-sm font-bold text-white uppercase tracking-wide">{label}</span>
          <span className="text-xs text-white/60 font-normal">({count} ítems)</span>
        </div>
      </td>
    </tr>
  )
}

function ClienteHeader({ label, count, open, onToggle }: { label: string; count: number; open: boolean; onToggle: () => void }) {
  return (
    <tr className="bg-blue-50 border-y border-blue-100 cursor-pointer select-none hover:bg-blue-100 transition-colors" onClick={onToggle}>
      <td colSpan={13} className="px-4 py-1.5 pl-10">
        <div className="flex items-center gap-2">
          {open
            ? <ChevronDown className="w-3.5 h-3.5 text-brand-500 shrink-0" />
            : <ChevronRight className="w-3.5 h-3.5 text-brand-500 shrink-0" />}
          <span className="text-sm font-semibold text-brand-700">{label}</span>
          <span className="text-xs text-ink-muted font-normal">({count} ítems)</span>
        </div>
      </td>
    </tr>
  )
}

function GrupoSemana({ semanaKey, semanaGrupo, onSelectItem }: {
  semanaKey: string
  semanaGrupo: { label: string; items: ItemCruzado[] }
  onSelectItem: (item: ItemCruzado) => void
}) {
  const [semanaOpen, setSemanaOpen] = useState(true)
  const [clientesOpen, setClientesOpen] = useState<Record<string, boolean>>({})
  const clientes = agruparPorClave(semanaGrupo.items, (it) => it.cliente)

  const toggleCliente = useCallback((key: string) => {
    setClientesOpen((prev) => ({ ...prev, [key]: !(prev[key] ?? true) }))
  }, [])

  return (
    <Fragment>
      <SemanaHeader
        label={semanaGrupo.label}
        count={semanaGrupo.items.length}
        open={semanaOpen}
        onToggle={() => setSemanaOpen((v) => !v)}
      />
      {semanaOpen && Array.from(clientes.entries()).map(([clienteKey, clienteGrupo]) => {
        const isOpen = clientesOpen[clienteKey] ?? true
        return (
          <Fragment key={`s-${semanaKey}-c-${clienteKey}`}>
            <ClienteHeader
              label={clienteGrupo.label}
              count={clienteGrupo.items.length}
              open={isOpen}
              onToggle={() => toggleCliente(clienteKey)}
            />
            {isOpen && clienteGrupo.items.map((it) => (
              <RowItem key={it.item_key} item={it} onClick={() => onSelectItem(it)} />
            ))}
          </Fragment>
        )
      })}
    </Fragment>
  )
}

export function TablaPrincipal({ items, onSelectItem, agruparPor }: Props) {
  let content: React.ReactNode

  if (agruparPor === 'ninguno') {
    content = items.map((it) => (
      <RowItem key={it.item_key} item={it} onClick={() => onSelectItem(it)} />
    ))
  } else if (agruparPor === 'semana') {
    const semanas = agruparPorClave(items, (it) => it.semana)
    content = Array.from(semanas.entries()).map(([semanaKey, semanaGrupo]) => (
      <GrupoSemana
        key={`s-${semanaKey}`}
        semanaKey={semanaKey}
        semanaGrupo={semanaGrupo}
        onSelectItem={onSelectItem}
      />
    ))
  } else {
    const groups = agruparPorClave(items, (it) => it.cliente)
    content = Array.from(groups.entries()).map(([key, grupo]) => (
      <Fragment key={`c-${key}`}>
        <ClienteHeader label={grupo.label} count={grupo.items.length} open={true} onToggle={() => {}} />
        {grupo.items.map((it) => (
          <RowItem key={it.item_key} item={it} onClick={() => onSelectItem(it)} />
        ))}
      </Fragment>
    ))
  }

  return (
    <div className="bg-white border border-line rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[1200px]">
          <thead className="bg-surface border-b border-line">
            <tr className="text-xs text-ink-muted uppercase tracking-wide">
              <th className="text-left px-4 py-2.5">Semana</th>
              <th className="text-left px-4 py-2.5">Cliente</th>
              <th className="text-left px-4 py-2.5">Estilo</th>
              <th className="text-left px-4 py-2.5">PO</th>
              <th className="text-left px-4 py-2.5">Color</th>
              <th className="text-center px-4 py-2.5">Prog.</th>
              <th className="text-center px-4 py-2.5">Ext.</th>
              <th className="text-left px-4 py-2.5">Posición Producción</th>
              <th className="text-left px-4 py-2.5">FEC_EXFACT</th>
              <th className="text-left px-4 py-2.5">Audit. Final</th>
              <th className="text-left px-4 py-2.5">Estado</th>
              <th className="text-left px-4 py-2.5">Responsable</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={13} className="px-4 py-12 text-center text-ink-muted">
                  Sin datos. Carga los archivos Excel para comenzar.
                </td>
              </tr>
            ) : content}
          </tbody>
        </table>
      </div>
    </div>
  )
}
