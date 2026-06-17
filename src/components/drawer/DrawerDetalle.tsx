import { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { X, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Badge } from '../ui/Badge'
import { Spinner } from '../ui/Spinner'
import { SemaforoDot } from '../ui/Semaforo'
import { useSeguimiento } from '../../hooks/useSeguimiento'
import { ubicacionActual, estaListoParaAuditar, totalOrden } from '../../lib/posicion'
import type { ItemCruzado, CompromisoEtapa, CompromisosEtapas } from '../../types'

interface Props {
  item: ItemCruzado | null
  onClose: () => void
  onUpdated: (updated: ItemCruzado) => void
}

function fmtFull(d: Date | null | undefined): string {
  if (!d) return '—'
  try { return format(new Date(d), "dd/MM/yyyy", { locale: es }) } catch { return '—' }
}

// ─── Barra de progreso por etapa ──────────────────────────────────────────────

function RutaProgreso({ item }: { item: ItemCruzado }) {
  const total = totalOrden(item)

  if (estaListoParaAuditar(item)) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
        <span className="text-sm font-medium text-emerald-700">
          Producción completa — listo para auditar
          {item.produccion_cerrada && ' (sin fila en Status Cortes)'}
        </span>
      </div>
    )
  }

  const ubicacion = ubicacionActual(item)

  if (ubicacion.length === 0) {
    return <p className="text-sm text-ink-muted">Sin datos de producción.</p>
  }

  return (
    <div className="space-y-2">
      {ubicacion.map((u) => (
        <div key={u.key} className="grid grid-cols-[90px_1fr] gap-2 items-center">
          <span className="text-xs text-ink-muted font-medium">{u.label}</span>
          {u.ok ? (
            <span className="text-xs text-teal-600 font-medium">OK — superada</span>
          ) : (
            <span className="text-xs text-amber-600 font-medium">{u.cantidad} aquí ahora</span>
          )}
        </div>
      ))}
      {total > 0 && (
        <div className="pt-1 border-t border-line flex justify-between text-xs text-ink-muted">
          <span>Total requerido: <strong className="text-ink">{total}</strong> pzas</span>
          <span>
            Ingresos Acabados: <strong className="text-ink">{item.ingresos_acabados_1ra}</strong> 1ra
            {' · '}<strong className="text-ink">{item.ingresos_acabados_2da}</strong> 2da
          </span>
        </div>
      )}
    </div>
  )
}

// ─── Compromisos por área ─────────────────────────────────────────────────────

const COMPROMISO_VACIO: CompromisoEtapa = {
  comprometidos:    null,
  fecha_compromiso: null,
  proxima_reunion:  null,
  notas:            '',
}

function CompromisosSection({
  item,
  compromisos,
  onChange,
}: {
  item: ItemCruzado
  compromisos: CompromisosEtapas
  onChange: (c: CompromisosEtapas) => void
}) {
  const ubicacion = ubicacionActual(item).filter((u) => !u.ok || compromisos[u.key])
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)

  if (ubicacion.length === 0) {
    return <p className="text-sm text-ink-muted">No hay áreas con piezas detenidas.</p>
  }

  const setComp = (key: string, field: keyof CompromisoEtapa, value: unknown) => {
    onChange({
      ...compromisos,
      [key]: { ...(compromisos[key] ?? COMPROMISO_VACIO), [field]: value },
    })
  }

  return (
    <div className="space-y-3">
      {ubicacion.map((u) => {
        const comp = compromisos[u.key] ?? COMPROMISO_VACIO
        const fechaComp = comp.fecha_compromiso
          ? new Date(comp.fecha_compromiso + 'T12:00:00')
          : null
        const vencido = fechaComp && fechaComp < hoy && u.cantidad > 0

        return (
          <div key={u.key} className="border border-line rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-ink">{u.label}</span>
                <Badge variant="ambar">{u.cantidad}</Badge>
              </div>
              {vencido && (
                <div className="flex items-center gap-1 text-red-600">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-xs font-medium">Vencida</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-[140px_1fr] gap-2">
              <div>
                <label className="text-xs text-ink-muted block mb-0.5">Fecha compromiso</label>
                <input
                  type="date"
                  value={comp.fecha_compromiso ?? ''}
                  onChange={(ev) => setComp(u.key, 'fecha_compromiso', ev.target.value || null)}
                  className={`w-full border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                    vencido ? 'border-red-400 bg-red-50' : 'border-line'
                  }`}
                />
              </div>
              <div>
                <label className="text-xs text-ink-muted block mb-0.5">Comentario</label>
                <input
                  type="text"
                  value={comp.notas}
                  onChange={(ev) => setComp(u.key, 'notas', ev.target.value)}
                  className="w-full border border-line rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="Observaciones..."
                />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Drawer principal ─────────────────────────────────────────────────────────

export function DrawerDetalle({ item, onClose, onUpdated }: Props) {
  const { guardarSeguimiento } = useSeguimiento()
  const [compromisos, setCompromisos] = useState<CompromisosEtapas>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!item) return
    setCompromisos(item.compromisos ?? {})
  }, [item])

  const handleGuardar = useCallback(async () => {
    if (!item) return
    setSaving(true)
    try {
      const updated: ItemCruzado = { ...item, compromisos }
      await guardarSeguimiento(updated)
      onUpdated(updated)
    } finally {
      setSaving(false)
    }
  }, [item, compromisos, guardarSeguimiento, onUpdated])

  if (!item) return null

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40 transition-opacity" onClick={onClose} />

      <div className="fixed right-0 top-0 h-full w-full max-w-lg bg-white z-50 shadow-xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-line">
          <div>
            <h2 className="font-semibold text-ink">{item.cliente} · {item.estilo}</h2>
            <p className="text-xs text-ink-muted font-mono mt-0.5">PO: {item.po} · {item.color}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface transition-colors">
            <X className="w-5 h-5 text-ink-muted" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Datos PGO */}
          <section className="p-4 border-b border-line bg-surface">
            <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-wide mb-3">Datos PGO</h3>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <span className="text-xs text-ink-muted block mb-0.5">FEC_EXFACT</span>
                <span className="text-sm font-medium text-ink">{fmtFull(item.fin_entrega)}</span>
              </div>
              <div className="col-span-2">
                <span className="text-xs text-ink-muted block mb-0.5">Auditoría Final</span>
                <div className="flex items-center gap-1.5">
                  <SemaforoDot valor={item.semaforo} dias={item.dias_auditoria_final} showLabel />
                  <span className="text-sm font-medium text-ink">{fmtFull(item.auditoria_final)}</span>
                </div>
              </div>
              <InfoField label="Cant. Prog." value={String(item.cant_prog ?? '—')} />
              <InfoField label="Externa"     value={item.externa ?? '—'} />
              <InfoField label="Semana"      value={item.semana} />
            </div>
          </section>

          {/* Posición en Ruta */}
          <section className="p-4 border-b border-line">
            <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-wide mb-1">
              Posición en Ruta
            </h3>
            {item.ruta && (
              <p className="text-xs text-ink-muted font-mono mb-3 bg-surface rounded px-2 py-1">
                {item.ruta}
              </p>
            )}
            {item.linea_costura && (
              <p className="text-xs text-ink-muted mb-3">
                Línea costura: <span className="text-ink font-medium">{item.linea_costura}</span>
              </p>
            )}
            <RutaProgreso item={item} />
          </section>

          {/* Compromisos por área */}
          <section className="p-4">
            <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-wide mb-3">
              Compromisos por Área
            </h3>
            <CompromisosSection
              item={item}
              compromisos={compromisos}
              onChange={setCompromisos}
            />
            <button
              onClick={handleGuardar}
              disabled={saving}
              className="mt-4 w-full bg-brand-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving && <Spinner size="sm" />}
              Guardar compromisos
            </button>
          </section>
        </div>
      </div>
    </>
  )
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs text-ink-muted block mb-0.5">{label}</span>
      <span className="text-sm font-medium text-ink">{value}</span>
    </div>
  )
}
