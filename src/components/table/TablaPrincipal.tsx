import { Fragment, useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { ChevronRight, AlertCircle, ChevronDown, CalendarPlus, CalendarDays, GripVertical, MessageSquareText, RotateCcw } from 'lucide-react'
import type { Semaforo } from '../../lib/parsers/dateUtils'
import { Badge } from '../ui/Badge'
import { ubicacionActual, estaListoParaAuditar, estadoEfectivo, totalOrden, type EstadoEfectivo } from '../../lib/posicion'
import type { ItemCruzado, CompromisosEtapas, CompromisoEtapa } from '../../types'

interface Props {
  items: ItemCruzado[]
  onSelectItem: (item: ItemCruzado) => void
  agruparPor: 'semana' | 'cliente' | 'ninguno'
  onDateChange?: (itemKeys: string[], newDate: string) => void
  onCerrarAuditoria?: (itemKey: string) => void
  onReabrirAuditoria?: (itemKey: string) => void
}

type BadgeVariant = 'verde' | 'ambar' | 'rojo' | 'brand' | 'slate' | 'teal' | 'cyan'

const ESTADO_VARIANT: Record<EstadoEfectivo, BadgeVariant> = {
  Exportado:       'verde',
  Cerrado:         'teal',
  'Por auditar':   'cyan',
  'Sin datos':     'rojo',
  'Por Finalizar': 'ambar',
  Finalizando:     'brand',
  Pendiente:       'slate',
  Programada:      'brand',
  'En proceso':    'teal',
  Reprogramada:    'ambar',
  Aprobada:        'verde',
  Rechazada:       'rojo',
}

function fmtDate(d: Date | null | undefined): string {
  if (!d) return '—'
  try { return format(new Date(d), 'dd/MM/yy', { locale: es }) } catch { return '—' }
}

function toInputDate(d: Date | null | undefined): string {
  if (!d) return ''
  try { return format(new Date(d), 'yyyy-MM-dd') } catch { return '' }
}

function getPiezasPorEtapa(item: ItemCruzado): Record<string, number> {
  return {
    corte:          item.en_corte,
    bordado:        item.en_bordado,
    costura:        item.en_costura,
    estampado:      item.en_estampado,
    estampado_ext:  item.en_estampado_ext,
    transfer:       item.en_transfer,
    lavanderia:     item.en_lavanderia,
    costura_lineas: item.en_costura_lineas,
    acabado:        item.en_acabado,
    apt:            item.apt,
  }
}

// Área "final" (fuera del pipeline físico) para que la columna nunca quede en
// blanco una vez que las prendas llegan a APT: antes de cerrar la auditoría se
// ve "Auditoría" y después de cerrarla se ve "Auditado"/"Exportado".
function getEtapaFinal(item: ItemCruzado): { label: string; cantidad: number } | null {
  const efec = estadoEfectivo(item)
  if (efec === 'Exportado') return { label: 'Exportado', cantidad: item.exportado || totalOrden(item) }
  if (efec === 'Cerrado')   return { label: 'Auditado',  cantidad: item.apt || totalOrden(item) }
  if (estaListoParaAuditar(item)) return { label: 'Auditoría', cantidad: item.apt || totalOrden(item) }
  return null
}

function PosicionChips({ item }: { item: ItemCruzado }) {
  const [bitacoraAnchor, setBitacoraAnchor] = useState<DOMRect | null>(null)

  const compromisoEntries = useMemo(
    () =>
      Object.entries(item.compromisos ?? {})
        .filter(([, c]) => c.fecha_compromiso || c.notas)
        .sort((a, b) => (b[1].fecha_compromiso ?? '').localeCompare(a[1].fecha_compromiso ?? '')),
    [item.compromisos]
  )
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const abrirBitacora = (e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setBitacoraAnchor((prev) => (prev ? null : rect))
  }
  const cerrarBitacora = () => setBitacoraAnchor(null)

  if (estaListoParaAuditar(item)) {
    const etapa = getEtapaFinal(item)
    return (
      <div className="relative flex flex-wrap gap-1.5 items-center min-w-0">
        {etapa && <Badge variant="verde">{etapa.label} {etapa.cantidad}</Badge>}
        {compromisoEntries.length > 0 && (
          <HistorialLink count={compromisoEntries.length} onClick={abrirBitacora} />
        )}
        {bitacoraAnchor && (
          <BitacoraPopover entries={compromisoEntries} anchorRect={bitacoraAnchor} onClose={cerrarBitacora} />
        )}
      </div>
    )
  }

  const ubicacion = ubicacionActual(item).filter((u) => !u.ok)
  const piezas = getPiezasPorEtapa(item)
  // Compromisos de áreas por las que la prenda ya pasó (no aparecen en `ubicacion`) —
  // se muestran solo como enlace a bitácora, para no repetir la misma área/fecha
  // que ya se ve en su chip activo.
  const historialExtra = compromisoEntries.filter(([key]) => !ubicacion.some((u) => u.key === key))

  return (
    <div className="relative flex flex-wrap gap-1.5 items-center min-w-0">
      {ubicacion.map((u) => {
        const comp      = item.compromisos?.[u.key]
        const fechaComp = comp?.fecha_compromiso ?? null
        const vencido = fechaComp
          ? new Date(fechaComp + 'T12:00:00') < hoy && (piezas[u.key] ?? 0) > 0
          : false

        return (
          <AreaChip
            key={u.key}
            label={u.label}
            cantidad={u.cantidad}
            compromiso={comp}
            vencido={vencido}
            onOpenBitacora={abrirBitacora}
          />
        )
      })}
      {ubicacion.length === 0 && compromisoEntries.length === 0 && (
        <span className="text-[11px] text-slate-400 italic">Sin datos</span>
      )}
      {historialExtra.length > 0 && (
        <HistorialLink count={historialExtra.length} onClick={abrirBitacora} />
      )}
      {bitacoraAnchor && (
        <BitacoraPopover entries={compromisoEntries} anchorRect={bitacoraAnchor} onClose={cerrarBitacora} />
      )}
    </div>
  )
}

// ─── Chip de área: label + cantidad + fecha de compromiso en una sola línea ───
// Si el área tiene compromiso registrado, el chip completo es clickeable y
// abre la bitácora — evita repetir la misma área/fecha en un pill aparte.

function AreaChip({ label, cantidad, compromiso, vencido, onOpenBitacora }: {
  label: string
  cantidad: number
  compromiso: CompromisoEtapa | undefined
  vencido: boolean
  onOpenBitacora: (e: React.MouseEvent<HTMLElement>) => void
}) {
  const fechaFmt = compromiso?.fecha_compromiso
    ? format(new Date(compromiso.fecha_compromiso + 'T12:00:00'), 'dd/MM', { locale: es })
    : null
  const clickable = !!(compromiso?.fecha_compromiso || compromiso?.notas)

  return (
    <button
      type="button"
      onClick={clickable ? (e) => { e.stopPropagation(); onOpenBitacora(e) } : undefined}
      className={`inline-flex items-center gap-1.5 rounded-lg border pl-2 pr-1.5 py-1 text-[11px] font-semibold whitespace-nowrap transition-all ${
        vencido
          ? 'bg-gradient-to-r from-red-50 to-rose-50 border-red-200 text-red-700'
          : 'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200 text-amber-800'
      } ${clickable ? 'cursor-pointer hover:shadow-sm hover:-translate-y-px active:translate-y-0' : 'cursor-default'}`}
      title={clickable ? 'Ver bitácora de compromisos' : undefined}
    >
      <span>{label}</span>
      <span className={`rounded-full px-1.5 py-px text-[10px] font-bold ${vencido ? 'bg-red-600/10' : 'bg-amber-600/15'}`}>
        {cantidad}
      </span>
      {fechaFmt && (
        <span className={`flex items-center gap-0.5 pl-1 ml-0.5 border-l font-normal ${vencido ? 'border-red-300 text-red-600' : 'border-amber-300/80 text-amber-700'}`}>
          {vencido ? <AlertCircle className="w-2.5 h-2.5 shrink-0" /> : <CalendarDays className="w-2.5 h-2.5 shrink-0" />}
          {fechaFmt}
        </span>
      )}
    </button>
  )
}

// ─── Enlace discreto a la bitácora completa (historial fuera de las áreas activas) ─

function HistorialLink({ count, onClick }: { count: number; onClick: (e: React.MouseEvent<HTMLElement>) => void }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(e) }}
      className="inline-flex items-center gap-1 text-[10px] font-medium text-violet-600 hover:text-violet-800 transition-colors"
      title="Ver bitácora de compromisos"
    >
      <MessageSquareText className="w-3 h-3 shrink-0" />
      Bitácora ({count})
    </button>
  )
}

// ─── Badge de días restantes ──────────────────────────────────────────────────

const BADGE_STYLE: Record<Semaforo, { pill: string; dot: string; label: (d: number) => string } | null> = {
  rojo:       { pill: 'bg-red-100 text-red-700 border border-red-200',         dot: 'bg-red-500',     label: (d) => d < 0 ? `Venció ${Math.abs(d)}d` : `${d}d` },
  ambar:      { pill: 'bg-amber-100 text-amber-700 border border-amber-200',   dot: 'bg-amber-400',   label: (d) => `${d}d` },
  verde:      { pill: 'bg-emerald-100 text-emerald-700 border border-emerald-200', dot: 'bg-emerald-500', label: (d) => `${d}d` },
  'sin-fecha': null,
}

function DaysBadge({ valor, dias }: { valor: Semaforo; dias: number | null | undefined }) {
  const cfg = BADGE_STYLE[valor]
  if (!cfg || dias === null || dias === undefined) return null
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap ${cfg.pill}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
      {cfg.label(dias)}
    </span>
  )
}

// ─── Celda de fecha de auditoría final editable ───────────────────────────────

interface DateCellProps {
  item: ItemCruzado
  isDragTarget: boolean
  onFillHandleMouseDown: (itemKey: string, date: string) => void
  onDateChange: (itemKey: string, date: string) => void
}

function DateCell({ item, isDragTarget, onFillHandleMouseDown, onDateChange }: DateCellProps) {
  const [editing, setEditing] = useState(false)
  const [tempDate, setTempDate] = useState('')

  const override = item.auditoria_final_override
  const displayDate = override
    ? format(new Date(override + 'T12:00:00'), 'dd/MM/yy', { locale: es })
    : fmtDate(item.auditoria_final)
  const originalDate = override ? fmtDate(item.auditoria_final) : null
  const inputDefault = override ?? toInputDate(item.auditoria_final)
  const hasDate = !!(override || item.auditoria_final)
  // Ya cerrado (Aprobada/Rechazada) o exportado: la fecha ya no puede estar
  // "vencida" — no tiene sentido marcarla en rojo, eso ya quedó atrás.
  const estadoFinal = estadoEfectivo(item)
  const cerrado = estadoFinal === 'Cerrado' || estadoFinal === 'Exportado'

  const openEditor = (e: React.MouseEvent) => {
    e.stopPropagation()
    setTempDate(inputDefault)
    setEditing(true)
  }

  const save = (val: string) => {
    if (val) onDateChange(item.item_key, val)
    setEditing(false)
  }

  const handleFillMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    const dateStr = override ?? toInputDate(item.auditoria_final)
    if (dateStr) onFillHandleMouseDown(item.item_key, dateStr)
  }

  /* ── Modo edición: input de fecha ── */
  if (editing) {
    return (
      <td className="px-4 py-2.5 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
        <input
          type="date"
          autoFocus
          value={tempDate}
          className="border border-brand-400 rounded px-1.5 py-0.5 text-xs w-32 focus:outline-none focus:ring-1 focus:ring-brand-400"
          onChange={(e) => setTempDate(e.target.value)}
          onBlur={() => save(tempDate)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save(tempDate)
            if (e.key === 'Escape') setEditing(false)
          }}
        />
      </td>
    )
  }

  /* ── Sin fecha: botón sutil que aparece al hover de la fila ── */
  if (!hasDate) {
    return (
      <td
        className={`px-4 py-2.5 whitespace-nowrap transition-colors ${isDragTarget ? 'bg-blue-100' : ''}`}
        onClick={openEditor}
      >
        <button
          className="flex items-center gap-1 text-xs text-ink-faint border border-dashed border-line rounded px-2 py-0.5
                     opacity-0 group-hover:opacity-100 group-hover:text-brand-500 group-hover:border-brand-300
                     hover:bg-brand-50 transition-all duration-150 select-none pointer-events-none"
          tabIndex={-1}
        >
          <CalendarPlus className="w-3 h-3 shrink-0" />
          <span>Definir</span>
        </button>
      </td>
    )
  }

  /* ── Con fecha: fecha + badge de días + handle de arrastre ── */
  return (
    <td
      className={`px-4 py-2.5 cursor-pointer transition-colors ${isDragTarget ? 'bg-blue-100' : ''}`}
      onClick={openEditor}
      title="Click para editar fecha"
    >
      <div className="flex items-center gap-2 group/datecell">
        {/* Fecha */}
        <div className="flex flex-col select-none min-w-0">
          <span className={`text-xs font-medium leading-tight whitespace-nowrap ${override ? 'text-ink' : 'text-ink-muted'}`}>
            {displayDate}
          </span>
          {originalDate && (
            <span className="text-[10px] text-ink-faint leading-tight whitespace-nowrap">
              ant: {originalDate}
            </span>
          )}
        </div>

        {/* Badge días — solo si sigue abierto; cerrado/exportado ya no tiene "días pendientes" */}
        {!cerrado && <DaysBadge valor={item.semaforo} dias={item.dias_auditoria_final} />}

        {/* Handle de arrastre — solo al hover */}
        <span
          className="flex items-center opacity-0 group-hover/datecell:opacity-100 cursor-ns-resize shrink-0 ml-auto transition-opacity"
          title="Arrastrar para aplicar a varias filas"
          onMouseDown={handleFillMouseDown}
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="w-3.5 h-3.5 text-slate-400" />
        </span>
      </div>
    </td>
  )
}

// ─── Estado con área dominante ───────────────────────────────────────────────

type AreaColor = 'rojo' | 'ambar' | 'verde'

const AREA_COLOR: Record<string, AreaColor> = {
  corte:          'rojo',
  bordado:        'ambar',
  costura:        'ambar',
  estampado:      'ambar',
  estampado_ext:  'ambar',
  transfer:       'ambar',
  lavanderia:     'ambar',
  costura_lineas: 'ambar',
  acabado:        'verde',
  apt:            'verde',
}

const AREA_LABEL: Record<string, string> = {
  corte: 'Corte', bordado: 'Bordado', costura: 'Costura',
  estampado: 'Estampado', estampado_ext: 'Est.Ext', transfer: 'Transfer',
  lavanderia: 'Lavandería', costura_lineas: 'Cost.L', acabado: 'Acabado', apt: 'APT',
}

const PILL: Record<AreaColor, string> = {
  rojo:  'bg-red-100 text-red-700 border-red-200',
  ambar: 'bg-amber-100 text-amber-700 border-amber-200',
  verde: 'bg-emerald-100 text-emerald-700 border-emerald-200',
}
const DOT: Record<AreaColor, string> = {
  rojo:  'bg-red-500',
  ambar: 'bg-amber-400',
  verde: 'bg-emerald-500',
}

function getDominanteArea(item: ItemCruzado) {
  const total = item.total_requeridas || item.cant_prog || 0
  const areas = [
    { key: 'corte',          cantidad: item.en_corte },
    { key: 'bordado',        cantidad: item.en_bordado },
    { key: 'costura',        cantidad: item.en_costura },
    { key: 'estampado',      cantidad: item.en_estampado },
    { key: 'estampado_ext',  cantidad: item.en_estampado_ext },
    { key: 'transfer',       cantidad: item.en_transfer },
    { key: 'lavanderia',     cantidad: item.en_lavanderia },
    { key: 'costura_lineas', cantidad: item.en_costura_lineas },
    { key: 'acabado',        cantidad: item.en_acabado },
    { key: 'apt',            cantidad: item.apt },
  ]
  const dom = areas.reduce((max, a) => a.cantidad > max.cantidad ? a : max, { key: '', cantidad: 0 })
  if (dom.cantidad === 0 || !dom.key) return null
  return {
    key:    dom.key,
    label:  AREA_LABEL[dom.key] ?? dom.key,
    pct:    total > 0 ? Math.round((dom.cantidad / total) * 100) : 0,
    color:  (AREA_COLOR[dom.key] ?? 'ambar') as AreaColor,
  }
}

function EstadoCell({ item }: { item: ItemCruzado }) {
  const efec      = estadoEfectivo(item)
  const listo     = estaListoParaAuditar(item)
  const dominante = getDominanteArea(item)

  // Exportado
  if (efec === 'Exportado') {
    const pct = item.porc_exp > 0
      ? Math.round(item.porc_exp)
      : item.total_requeridas > 0 ? Math.round((item.exportado / item.total_requeridas) * 100) : 0
    return (
      <td className="px-4 py-2.5 whitespace-nowrap">
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold border ${PILL.verde}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${DOT.verde}`} />
          Exportado {pct > 0 ? `${pct}%` : ''}
        </span>
      </td>
    )
  }

  if (efec === 'Cerrado') {
    return (
      <td className="px-4 py-2.5 whitespace-nowrap">
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold border ${PILL.verde}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${DOT.verde}`} />
          Cerrado
        </span>
      </td>
    )
  }

  const color = listo ? 'verde' : (dominante?.color ?? 'ambar')
  const pillLabel = listo
    ? 'APT · Listo'
    : dominante
      ? `${dominante.label} ${dominante.pct > 0 ? `${dominante.pct}%` : ''}`
      : '—'

  return (
    <td className="px-4 py-2.5 whitespace-nowrap">
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold border ${PILL[color]}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${DOT[color]}`} />
        {pillLabel}
      </span>
    </td>
  )
}

// ─── Vista previa de bitácora de compromisos ──────────────────────────────────

function BitacoraPopover({ entries, anchorRect, onClose }: {
  entries: [string, CompromisoEtapa][]
  anchorRect: DOMRect
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    // capture=true: el scroll horizontal de la tabla no burbujea hasta window,
    // así que hay que escucharlo en fase de captura para cerrar el popover.
    document.addEventListener('mousedown', handler)
    document.addEventListener('scroll', onClose, true)
    window.addEventListener('resize', onClose)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('scroll', onClose, true)
      window.removeEventListener('resize', onClose)
    }
  }, [onClose])

  const ANCHO = 256
  const left = Math.min(anchorRect.left, window.innerWidth - ANCHO - 8)
  const top = anchorRect.bottom + 4

  // Portal a document.body: escapa del contenedor con overflow-x-auto de la
  // tabla, que si no recortaría este popover y lo dejaría invisible.
  return createPortal(
    <div
      ref={ref}
      className="fixed z-50 bg-white border border-line rounded-lg shadow-lg p-3 space-y-2"
      style={{ top, left, width: ANCHO }}
      onClick={(e) => e.stopPropagation()}
    >
      <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide">Bitácora de compromisos</p>
      {entries.length === 0 ? (
        <p className="text-xs text-ink-muted">Sin compromisos registrados.</p>
      ) : (
        entries.map(([key, comp]) => (
          <div key={key} className="border-t border-line pt-2 first:border-0 first:pt-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-ink">{AREA_LABEL[key] ?? key}</span>
              <span className="text-[10px] text-ink-muted whitespace-nowrap">
                {comp.fecha_compromiso
                  ? format(new Date(comp.fecha_compromiso + 'T12:00:00'), 'dd/MM/yy', { locale: es })
                  : '—'}
              </span>
            </div>
            <p className="text-xs text-ink-muted mt-0.5 break-words">
              {comp.notas || <span className="italic text-ink-faint">Sin comentario</span>}
            </p>
          </div>
        ))
      )}
    </div>,
    document.body
  )
}

// ─── Fila principal ───────────────────────────────────────────────────────────

interface RowItemProps {
  item: ItemCruzado
  onClick: () => void
  isDragTarget: boolean
  onFillHandleMouseDown: (itemKey: string, date: string) => void
  onDateChange: (itemKey: string, date: string) => void
  onCerrarAuditoria?: (itemKey: string) => void
  onReabrirAuditoria?: (itemKey: string) => void
}

function BtnCerrarAuditoria({ item, onCerrar, onReabrir, onOpen }: {
  item: ItemCruzado
  onCerrar?: (itemKey: string) => void
  onReabrir?: (itemKey: string) => void
  onOpen: () => void
}) {
  const efec    = estadoEfectivo(item)
  const closed  = efec === 'Cerrado' || efec === 'Exportado'
  // Solo se puede reabrir lo que cerramos manualmente (Aprobada/Rechazada).
  // "Exportado" viene del Status subido, no de un click nuestro — no hay nada que deshacer.
  const cerradoManual = item.estado === 'Aprobada' || item.estado === 'Rechazada'
  const piezas  = getPiezasPorEtapa(item)
  const hoy     = new Date(); hoy.setHours(0, 0, 0, 0)
  const hayVencido = Object.entries(item.compromisos ?? {}).some(([key, comp]) => {
    if (!comp.fecha_compromiso) return false
    return new Date(comp.fecha_compromiso + 'T12:00:00') < hoy && (piezas[key] ?? 0) > 0
  })

  if (closed) {
    return (
      <span className="inline-flex items-center gap-1">
        <span className="text-xs px-2.5 py-1 rounded-lg font-medium border bg-emerald-50 text-emerald-700 border-emerald-200 whitespace-nowrap">
          ✓ Auditado
        </span>
        {cerradoManual && (
          <button
            onClick={(e) => { e.stopPropagation(); onReabrir?.(item.item_key) }}
            className="p-1 rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors"
            title="Reabrir auditoría (por error la cerré)"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        )}
      </span>
    )
  }

  if (hayVencido) {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); onOpen() }}
        className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg font-medium border bg-red-50 text-red-700 border-red-200 hover:bg-red-100 transition-colors whitespace-nowrap"
        title="Hay compromisos vencidos — abre el detalle"
      >
        <AlertCircle className="w-3 h-3 shrink-0" />
        Revisar
      </button>
    )
  }

  return (
    <button
      onClick={(e) => { e.stopPropagation(); onCerrar?.(item.item_key) }}
      className="text-xs px-2.5 py-1 rounded-lg font-medium border bg-white text-slate-600 border-slate-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 transition-colors whitespace-nowrap"
    >
      Cerrar Audit.
    </button>
  )
}

function RowItem({ item, onClick, isDragTarget, onFillHandleMouseDown, onDateChange, onCerrarAuditoria, onReabrirAuditoria }: RowItemProps) {
  const isVencidaPendiente = item.semaforo === 'rojo' && item.estado === 'Pendiente'
  return (
    <tr
      data-item-key={item.item_key}
      className={`group border-b border-line hover:bg-blue-50 cursor-pointer transition-colors ${
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
      <DateCell
        item={item}
        isDragTarget={isDragTarget}
        onFillHandleMouseDown={onFillHandleMouseDown}
        onDateChange={onDateChange}
      />
      <EstadoCell item={item} />
      <td className="px-4 py-2.5">
        <BtnCerrarAuditoria item={item} onCerrar={onCerrarAuditoria} onReabrir={onReabrirAuditoria} onOpen={onClick} />
      </td>
      <td className="px-2 py-2.5">
        <ChevronRight className="w-4 h-4 text-ink-muted" />
      </td>
    </tr>
  )
}

// ─── Cabeceras colapsables ────────────────────────────────────────────────────

function claveAgrupacion(v: string): string {
  return v.trim().toUpperCase().replace(/\s+/g, ' ')
}

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

interface RowSharedProps {
  isDragTargetSet: Set<string>
  onFillHandleMouseDown: (itemKey: string, date: string) => void
  onDateChange: (itemKey: string, date: string) => void
  onSelectItem: (item: ItemCruzado) => void
  onCerrarAuditoria?: (itemKey: string) => void
  onReabrirAuditoria?: (itemKey: string) => void
}

function GrupoSemana({ semanaKey, semanaGrupo, shared }: {
  semanaKey: string
  semanaGrupo: { label: string; items: ItemCruzado[] }
  shared: RowSharedProps
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
              <RowItem
                key={it.item_key}
                item={it}
                onClick={() => shared.onSelectItem(it)}
                isDragTarget={shared.isDragTargetSet.has(it.item_key)}
                onFillHandleMouseDown={shared.onFillHandleMouseDown}
                onDateChange={shared.onDateChange}
                onCerrarAuditoria={shared.onCerrarAuditoria}
                onReabrirAuditoria={shared.onReabrirAuditoria}
              />
            ))}
          </Fragment>
        )
      })}
    </Fragment>
  )
}

// ─── Tooltip de arrastre ──────────────────────────────────────────────────────

function DragTooltip({ count, visible }: { count: number; visible: boolean }) {
  if (!visible || count <= 1) return null
  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-blue-600 text-white text-xs px-3 py-1.5 rounded-full shadow-lg pointer-events-none">
      Aplicar fecha a {count} {count === 1 ? 'fila' : 'filas'} — suelta para confirmar
    </div>
  )
}

// ─── Tabla principal ──────────────────────────────────────────────────────────

export function TablaPrincipal({ items, onSelectItem, agruparPor, onDateChange, onCerrarAuditoria, onReabrirAuditoria }: Props) {
  // Drag state
  const [dragInfo, setDragInfo] = useState<{ date: string; startIdx: number; endIdx: number } | null>(null)
  const isDraggingRef = useRef(false)
  const onDateChangeRef = useRef(onDateChange)
  const itemsRef = useRef(items)
  useEffect(() => { onDateChangeRef.current = onDateChange }, [onDateChange])
  useEffect(() => { itemsRef.current = items }, [items])

  const itemKeyToIdx = useMemo(() => {
    const map = new Map<string, number>()
    items.forEach((it, i) => map.set(it.item_key, i))
    return map
  }, [items])
  const itemKeyToIdxRef = useRef(itemKeyToIdx)
  useEffect(() => { itemKeyToIdxRef.current = itemKeyToIdx }, [itemKeyToIdx])

  const dragTargetSet = useMemo((): Set<string> => {
    if (!dragInfo) return new Set()
    const { startIdx, endIdx } = dragInfo
    const min = Math.min(startIdx, endIdx)
    const max = Math.max(startIdx, endIdx)
    return new Set(items.slice(min, max + 1).map((it) => it.item_key))
  }, [dragInfo, items])

  const handleFillHandleMouseDown = useCallback((itemKey: string, date: string) => {
    const startIdx = itemKeyToIdxRef.current.get(itemKey) ?? 0
    isDraggingRef.current = true
    setDragInfo({ date, startIdx, endIdx: startIdx })

    const handleMouseMove = (e: MouseEvent) => {
      // Busca el <tr data-item-key> más cercano al cursor — funciona sobre cualquier columna
      const el = document.elementFromPoint(e.clientX, e.clientY) as Element | null
      const tr = el?.closest<HTMLElement>('[data-item-key]')
      if (tr) {
        const key = tr.dataset.itemKey
        if (key) {
          const idx = itemKeyToIdxRef.current.get(key)
          if (idx !== undefined) {
            setDragInfo((prev) => prev ? { ...prev, endIdx: idx } : null)
          }
        }
      }
    }

    const handleMouseUp = () => {
      isDraggingRef.current = false
      setDragInfo((prev) => {
        if (prev && onDateChangeRef.current) {
          const { startIdx: si, endIdx: ei, date: d } = prev
          const min = Math.min(si, ei)
          const max = Math.max(si, ei)
          const keys = itemsRef.current.slice(min, max + 1).map((it) => it.item_key)
          if (keys.length >= 1) onDateChangeRef.current(keys, d)
        }
        return null
      })
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [])

  const handleDateChange = useCallback((itemKey: string, date: string) => {
    onDateChange?.([itemKey], date)
  }, [onDateChange])

  const shared: RowSharedProps = useMemo(() => ({
    isDragTargetSet: dragTargetSet,
    onFillHandleMouseDown: handleFillHandleMouseDown,
    onDateChange: handleDateChange,
    onSelectItem,
    onCerrarAuditoria,
    onReabrirAuditoria,
  }), [dragTargetSet, handleFillHandleMouseDown, handleDateChange, onSelectItem, onCerrarAuditoria, onReabrirAuditoria])

  let content: React.ReactNode

  if (agruparPor === 'ninguno') {
    content = items.map((it) => (
      <RowItem
        key={it.item_key}
        item={it}
        onClick={() => onSelectItem(it)}
        isDragTarget={dragTargetSet.has(it.item_key)}
        onFillHandleMouseDown={handleFillHandleMouseDown}
        onDateChange={handleDateChange}
        onCerrarAuditoria={onCerrarAuditoria}
        onReabrirAuditoria={onReabrirAuditoria}
      />
    ))
  } else if (agruparPor === 'semana') {
    const semanas = agruparPorClave(items, (it) => it.semana)
    content = Array.from(semanas.entries()).map(([semanaKey, semanaGrupo]) => (
      <GrupoSemana
        key={`s-${semanaKey}`}
        semanaKey={semanaKey}
        semanaGrupo={semanaGrupo}
        shared={shared}
      />
    ))
  } else {
    const groups = agruparPorClave(items, (it) => it.cliente)
    content = Array.from(groups.entries()).map(([key, grupo]) => (
      <Fragment key={`c-${key}`}>
        <ClienteHeader label={grupo.label} count={grupo.items.length} open={true} onToggle={() => {}} />
        {grupo.items.map((it) => (
          <RowItem
            key={it.item_key}
            item={it}
            onClick={() => onSelectItem(it)}
            isDragTarget={dragTargetSet.has(it.item_key)}
            onFillHandleMouseDown={handleFillHandleMouseDown}
            onDateChange={handleDateChange}
            onCerrarAuditoria={onCerrarAuditoria}
            onReabrirAuditoria={onReabrirAuditoria}
          />
        ))}
      </Fragment>
    ))
  }

  return (
    <>
      <DragTooltip count={dragTargetSet.size} visible={!!dragInfo} />
      <div className="bg-white border border-line rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[1200px]" style={{ userSelect: dragInfo ? 'none' : undefined }}>
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
                <th className="text-left px-4 py-2.5">Auditoría</th>
                <th className="px-2 py-2.5" />
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
    </>
  )
}
