import { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { X, AlertTriangle, CheckCircle2, Trash2 } from 'lucide-react'
import { Badge } from '../ui/Badge'
import { Spinner } from '../ui/Spinner'
import { SemaforoDot } from '../ui/Semaforo'
import { useSeguimiento } from '../../hooks/useSeguimiento'
import { ubicacionActual, ubicacionActualOp, ubicacionLineas, opListo, estaListoParaAuditar, totalOrden } from '../../lib/posicion'
import { getErrorMessage } from '../../lib/errorUtils'
import type { ItemCruzado, OpDetalle, CompromisoEtapa, CompromisosEtapas, CompromisoLinea, CompromisosLinea } from '../../types'

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
          {item.produccion_cerrada
            ? 'Producción cerrada — listo para auditar'
            : `Todas las prendas en APT (${item.apt}) — listo para auditar`}
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
            Acabado: <strong className="text-ink">{item.en_acabado}</strong>
            {' · '}APT: <strong className="text-ink">{item.apt}</strong>
          </span>
        </div>
      )}
    </div>
  )
}

// ─── OPs individuales (un PO+Estilo+Color puede repartirse en varias OPs) ────

function OpsSection({ ops }: { ops: OpDetalle[] }) {
  if (ops.length <= 1) return null

  return (
    <section className="p-4 border-b border-line">
      <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-wide mb-3">
        OPs de esta orden ({ops.length})
      </h3>
      <div className="space-y-2">
        {ops.map((op) => {
          const listo = opListo(op)
          const ubicacion = ubicacionActualOp(op)
          return (
            <div key={op.op} className="flex flex-wrap items-center gap-1.5 border border-line rounded-lg px-2.5 py-1.5">
              <span className="text-xs font-mono font-semibold text-ink shrink-0">OP {op.op || '—'}</span>
              {listo ? (
                <Badge variant="verde">Listo · APT {op.apt}</Badge>
              ) : ubicacion.length > 0 ? (
                ubicacion.map((u) => (
                  <Badge key={u.key} variant="ambar">{u.label} {u.cantidad}</Badge>
                ))
              ) : (
                <Badge variant="sin-fecha">Sin datos</Badge>
              )}
            </div>
          )
        })}
      </div>
    </section>
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

  const quitarComp = (key: string) => {
    const { [key]: _omit, ...resto } = compromisos
    onChange(resto)
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
              <div className="flex items-center gap-2">
                {vencido && (
                  <div className="flex items-center gap-1 text-red-600">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="text-xs font-medium">Vencida</span>
                  </div>
                )}
                {compromisos[u.key] && (
                  <button
                    type="button"
                    onClick={() => quitarComp(u.key)}
                    title="Quitar este compromiso"
                    className="p-1 rounded hover:bg-red-50 text-ink-muted hover:text-red-600 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
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

// ─── Compromisos por línea de costura ─────────────────────────────────────────

const COMPROMISO_LINEA_VACIO: CompromisoLinea = { fecha_jefe_sector: null }

function CompromisosLineaSection({
  item,
  compromisosLinea,
  onChange,
}: {
  item: ItemCruzado
  compromisosLinea: CompromisosLinea
  onChange: (c: CompromisosLinea) => void
}) {
  const lineas = ubicacionLineas(item)
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)

  if (lineas.length === 0) {
    return <p className="text-sm text-ink-muted">No hay líneas con prendas pendientes.</p>
  }

  const setFecha = (key: string, value: string | null) => {
    onChange({
      ...compromisosLinea,
      [key]: { ...(compromisosLinea[key] ?? COMPROMISO_LINEA_VACIO), fecha_jefe_sector: value },
    })
  }

  const quitar = (key: string) => {
    const { [key]: _omit, ...resto } = compromisosLinea
    onChange(resto)
  }

  return (
    <div className="space-y-3">
      {lineas.map((l) => {
        const comp = compromisosLinea[l.key] ?? COMPROMISO_LINEA_VACIO
        const fecha = comp.fecha_jefe_sector
          ? new Date(comp.fecha_jefe_sector + 'T12:00:00')
          : null
        const vencido = fecha && fecha < hoy

        return (
          <div key={l.key} className="border border-line rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-ink">{l.label}</span>
                <Badge variant="ambar">{l.cantidad}</Badge>
              </div>
              <div className="flex items-center gap-2">
                {vencido && (
                  <div className="flex items-center gap-1 text-red-600">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="text-xs font-medium">Vencida</span>
                  </div>
                )}
                {compromisosLinea[l.key] && (
                  <button
                    type="button"
                    onClick={() => quitar(l.key)}
                    title="Quitar esta fecha"
                    className="p-1 rounded hover:bg-red-50 text-ink-muted hover:text-red-600 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
            <div>
              <label className="text-xs text-ink-muted block mb-0.5">Fecha Jefe de Sector</label>
              <input
                type="date"
                value={comp.fecha_jefe_sector ?? ''}
                onChange={(ev) => setFecha(l.key, ev.target.value || null)}
                className={`w-full border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                  vencido ? 'border-red-400 bg-red-50' : 'border-line'
                }`}
              />
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
  const [compromisosLinea, setCompromisosLinea] = useState<CompromisosLinea>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!item) return
    setCompromisos(item.compromisos ?? {})
    setCompromisosLinea(item.compromisos_linea ?? {})
  }, [item])

  const [guardadoOk, setGuardadoOk] = useState(false)
  const [guardadoError, setGuardadoError] = useState<string | null>(null)

  const handleGuardar = useCallback(async () => {
    if (!item) return
    setSaving(true)
    setGuardadoOk(false)
    setGuardadoError(null)
    try {
      const updated: ItemCruzado = { ...item, compromisos, compromisos_linea: compromisosLinea }
      await guardarSeguimiento(updated)
      onUpdated(updated)
      setGuardadoOk(true)
      setTimeout(() => setGuardadoOk(false), 4000)
    } catch (err) {
      setGuardadoError(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }, [item, compromisos, compromisosLinea, guardarSeguimiento, onUpdated])

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

        {/* Banner "Guardado" */}
        {guardadoOk && (
          <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 border-b border-emerald-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="text-sm font-medium text-emerald-700">
              ✓ Datos guardados — las fechas ya se ven en la tabla
            </span>
          </div>
        )}
        {/* Banner de error */}
        {guardadoError && (
          <div className="flex items-start gap-2 px-4 py-2 bg-red-50 border-b border-red-200">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-700">Error al guardar</p>
              <p className="text-xs text-red-600 mt-0.5 font-mono break-all">{guardadoError}</p>
              {guardadoError.includes('auditoria_final_override') && (
                <p className="text-xs text-red-700 mt-1 font-medium">
                  Falta correr la migración SQL en Supabase:
                  <code className="ml-1 bg-red-100 rounded px-1">ALTER TABLE seguimiento ADD COLUMN IF NOT EXISTS auditoria_final_override DATE;</code>
                </p>
              )}
            </div>
          </div>
        )}

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
            {item.op && item.ops.length <= 1 && (
              <p className="text-xs text-ink-muted mb-3">
                OP: <span className="text-ink font-medium font-mono">{item.op}</span>
              </p>
            )}
            <RutaProgreso item={item} />
          </section>

          <OpsSection ops={item.ops ?? []} />

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
          </section>

          {/* Compromisos por línea de costura */}
          <section className="p-4 border-t border-line">
            <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-wide mb-3">
              Fecha Jefe de Sector (por línea)
            </h3>
            <CompromisosLineaSection
              item={item}
              compromisosLinea={compromisosLinea}
              onChange={setCompromisosLinea}
            />
            <button
              onClick={handleGuardar}
              disabled={saving}
              className={`mt-4 w-full py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2 ${
                guardadoOk
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'bg-brand-600 text-white hover:bg-brand-700'
              }`}
            >
              {saving && <Spinner size="sm" />}
              {guardadoOk ? '✓ Guardado — ya se ve en la tabla' : 'Guardar compromisos'}
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
