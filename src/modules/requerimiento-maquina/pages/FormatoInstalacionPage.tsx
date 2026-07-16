import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Circle, Play, Camera, Keyboard } from 'lucide-react'
import { Badge } from '../../../components/ui/Badge'
import { Spinner } from '../../../components/ui/Spinner'
import { getErrorMessage } from '../../../lib/errorUtils'
import { obtenerReporte } from '../lib/rmReports'
import {
  obtenerFormato,
  suscribirFormato,
  registrarHInicio,
  firmarOperacion,
  guardarComentarioOperacion,
  firmarFinal,
  guardarGenerales,
} from '../lib/formatoInstalacion'
import { esOperacionManIns, ordenFirmasPara, puedeFirmar, calcularHFinCompleta } from '../lib/rolFirma'
import { exportarFormatoExcel } from '../lib/exportFormatoExcel'
import { FirmaModal } from '../components/FirmaModal'
import type { BalanceReport, FormatoInstalacion, OperacionFormato, RolFirmaOperacion, RolFirmaFinal } from '../types'

function IconoMetodo({ metodo }: { metodo?: string }) {
  if (metodo === 'camara') return <Camera className="w-3 h-3" />
  if (metodo === 'manual') return <Keyboard className="w-3 h-3" />
  return null
}

function horaActual(): string {
  return new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

interface FilaOperacion {
  opKey: string
  item: number
  operario: string
  codigo: string
  descripcion: string
  maquina: string
  minutosReq: string
  esManIns: boolean
}

export function FormatoInstalacionPage() {
  const { formatoKey } = useParams<{ formatoKey: string }>()
  const navigate = useNavigate()
  const reportKey = formatoKey ?? ''

  const [reporte, setReporte] = useState<BalanceReport | null>(null)
  const [formato, setFormato] = useState<FormatoInstalacion | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [firmaAbierta, setFirmaAbierta] = useState<{ opKey: string; tipo: RolFirmaOperacion } | { tipo: RolFirmaFinal } | null>(null)
  const [accionError, setAccionError] = useState<string | null>(null)
  const [exportando, setExportando] = useState(false)

  useEffect(() => {
    if (!reportKey) return
    setCargando(true)
    Promise.all([obtenerReporte(reportKey), obtenerFormato(reportKey)])
      .then(([r, f]) => {
        if (!r) { setError(`No se encontró el reporte "${reportKey}"`); return }
        setReporte(r)
        setFormato(f)
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setCargando(false))
  }, [reportKey])

  useEffect(() => {
    if (!reportKey) return
    return suscribirFormato(reportKey, setFormato)
  }, [reportKey])

  const filas = useMemo<FilaOperacion[]>(() => {
    if (!reporte) return []
    const out: FilaOperacion[] = []
    for (const op of reporte.operarios) {
      for (const operacion of op.operaciones) {
        if (!operacion.codigo) continue
        out.push({
          opKey: `${op.item}_${operacion.codigo}`,
          item: op.item,
          operario: op.nombre,
          codigo: operacion.codigo,
          descripcion: operacion.descripcion,
          maquina: operacion.maquina,
          minutosReq: operacion.minutos_req,
          esManIns: esOperacionManIns(operacion.maquina),
        })
      }
    }
    return out
  }, [reporte])

  const iniciar = useCallback(async (opKey: string) => {
    setAccionError(null)
    try {
      await registrarHInicio(reportKey, opKey, horaActual())
    } catch (err) {
      setAccionError(getErrorMessage(err))
    }
  }, [reportKey])

  const comentarioCambiado = useCallback(async (opKey: string, valor: string) => {
    try {
      await guardarComentarioOperacion(reportKey, opKey, valor)
    } catch (err) {
      setAccionError(getErrorMessage(err))
    }
  }, [reportKey])

  const generalesCambiado = useCallback(async (campo: 'estiloSaliente' | 'comentariosGenerales', valor: string) => {
    try {
      await guardarGenerales(reportKey, { [campo]: valor })
    } catch (err) {
      setAccionError(getErrorMessage(err))
    }
  }, [reportKey])

  const exportar = useCallback(async () => {
    if (!reporte || !formato) return
    setAccionError(null)
    setExportando(true)
    try {
      await exportarFormatoExcel(reporte, formato)
    } catch (err) {
      setAccionError(getErrorMessage(err))
    } finally {
      setExportando(false)
    }
  }, [reporte, formato])

  if (cargando) {
    return <div className="flex items-center justify-center py-16"><Spinner size="lg" /></div>
  }
  if (error || !reporte || !formato) {
    return (
      <div className="p-6">
        <p className="text-sm text-red-600">{error ?? 'No se pudo cargar el formato.'}</p>
        <button onClick={() => navigate(-1)} className="mt-3 text-xs text-brand-600 hover:underline">Volver</button>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg text-ink-faint hover:bg-surface hover:text-ink">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-lg font-semibold text-ink">Formato de instalación</h1>
            <p className="text-xs text-ink-muted">{reporte.estilo_cliente || reporte.archivo_original}</p>
          </div>
        </div>
        {formato.fecha_fin ? (
          <Badge variant="verde">Cerrado {formato.fecha_fin}</Badge>
        ) : formato.fecha_inicio ? (
          <Badge variant="ambar">En curso desde {formato.fecha_inicio}</Badge>
        ) : (
          <Badge variant="slate">Sin iniciar</Badge>
        )}
      </div>

      {accionError && <p className="text-xs text-red-600">{accionError}</p>}

      <section className="border border-line rounded-xl bg-white p-4">
        <h2 className="text-xs font-semibold text-ink-muted uppercase tracking-wide mb-3">Datos generales</h2>
        <div className="grid md:grid-cols-4 gap-4">
          <div>
            <p className="text-[11px] font-medium text-ink-faint uppercase tracking-wide">Línea</p>
            <p className="text-sm text-ink">{reporte.linea || '—'}</p>
          </div>
          <div>
            <p className="text-[11px] font-medium text-ink-faint uppercase tracking-wide">Estilo entrante</p>
            <p className="text-sm text-ink">{reporte.estilo_cliente || '—'}</p>
          </div>
          <div>
            <label className="text-[11px] font-medium text-ink-faint uppercase tracking-wide">Estilo saliente</label>
            <input
              defaultValue={formato.estilo_saliente}
              onBlur={(e) => generalesCambiado('estiloSaliente', e.target.value)}
              className="block w-full text-sm border border-line rounded-lg px-2 py-1 mt-0.5"
            />
          </div>
          <div>
            <p className="text-[11px] font-medium text-ink-faint uppercase tracking-wide">Fecha inicio / fin</p>
            <p className="text-sm text-ink">{formato.fecha_inicio || '—'} {formato.fecha_fin && `/ ${formato.fecha_fin}`}</p>
          </div>
        </div>
      </section>

      <section className="border border-line rounded-xl bg-white overflow-hidden">
        <h2 className="text-xs font-semibold text-ink-muted uppercase tracking-wide px-4 pt-4">Operarios y operaciones</h2>

        {/* Móvil: una tarjeta por fila con las firmas apiladas verticalmente
            (nombre de rol completo, no abreviado) en vez de la tabla ancha,
            para no depender de scroll horizontal ni de textos truncados. */}
        <div className="divide-y divide-line md:hidden">
          {filas.map((fila) => {
            const op: OperacionFormato = formato.operaciones_json[fila.opKey] ?? {}
            const completa = calcularHFinCompleta(op, fila.esManIns)
            return (
              <div key={fila.opKey} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">{fila.item}. {fila.operario}</p>
                    <p className="text-xs text-ink-muted">
                      <span className="font-mono">{fila.codigo}</span> {fila.descripcion}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-faint">
                      {fila.maquina} · {fila.minutosReq} min
                      {fila.esManIns && <Badge variant="cyan" className="ml-1">MAN/INS</Badge>}
                    </p>
                  </div>
                  {op.h_fin ? (
                    completa ? <Badge variant="verde">Listo</Badge> : null
                  ) : null}
                </div>

                <div className="flex items-center gap-3 text-xs">
                  <span className="text-ink-faint">H.Inicio: {op.h_inicio ?? '—'}</span>
                  <span className="text-ink-faint">H.Fin: {op.h_fin ?? '—'}</span>
                  {!op.h_inicio && (
                    <button
                      onClick={() => iniciar(fila.opKey)}
                      className="flex items-center gap-1 text-brand-600 hover:underline"
                    >
                      <Play className="w-3 h-3" /> Iniciar
                    </button>
                  )}
                </div>

                <div className="space-y-1.5">
                  <p className="text-[11px] font-medium text-ink-faint uppercase tracking-wide">Firmas</p>
                  {ordenFirmasPara(fila.esManIns).map((rol) => {
                    const firmado = !!op[`firma_${rol}` as const]
                    const nombre = op[`nombre_firma_${rol}` as const]
                    const hora = op[`hora_firma_${rol}` as const]
                    const metodoFirma = op[`metodo_firma_${rol}` as const]
                    const validacion = puedeFirmar(op, rol, fila.esManIns)
                    return (
                      <button
                        key={rol}
                        disabled={firmado || !validacion.ok}
                        onClick={() => setFirmaAbierta({ opKey: fila.opKey, tipo: rol })}
                        className={`flex w-full items-start justify-between gap-2 rounded-lg border px-3 py-2 text-left ${
                          firmado
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : validacion.ok
                              ? 'border-line text-ink hover:bg-surface'
                              : 'border-line text-ink-faint opacity-50'
                        }`}
                      >
                        <span className="flex items-center gap-1.5">
                          {firmado ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <Circle className="w-4 h-4 shrink-0" />}
                          <span className="text-xs font-medium capitalize">{rol.replace('_', ' ')}</span>
                        </span>
                        <span className="max-w-[55%] text-right text-[11px]">
                          {firmado ? (
                            <span className="flex items-center justify-end gap-1">
                              {nombre} ({hora}) <IconoMetodo metodo={metodoFirma} />
                            </span>
                          ) : validacion.ok ? (
                            'Firmar'
                          ) : (
                            validacion.motivo
                          )}
                        </span>
                      </button>
                    )
                  })}
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-medium text-ink-faint uppercase tracking-wide">Comentario</label>
                  <input
                    defaultValue={op.comentario ?? ''}
                    onBlur={(e) => comentarioCambiado(fila.opKey, e.target.value)}
                    className="w-full text-xs border border-line rounded-lg px-2 py-1.5"
                  />
                </div>
              </div>
            )
          })}
        </div>

        {/* Desktop/tablet: tabla completa */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-xs mt-3">
            <thead>
              <tr className="text-left text-ink-faint border-y border-line bg-surface">
                <th className="px-3 py-2 font-medium">Item</th>
                <th className="px-3 py-2 font-medium">Operario</th>
                <th className="px-3 py-2 font-medium">Operación</th>
                <th className="px-3 py-2 font-medium">Máquina</th>
                <th className="px-3 py-2 font-medium text-right">Min</th>
                <th className="px-3 py-2 font-medium">H.Inicio</th>
                <th className="px-3 py-2 font-medium">H.Fin</th>
                <th className="px-3 py-2 font-medium">Firmas</th>
                <th className="px-3 py-2 font-medium">Comentario</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((fila) => {
                const op: OperacionFormato = formato.operaciones_json[fila.opKey] ?? {}
                const completa = calcularHFinCompleta(op, fila.esManIns)
                return (
                  <tr key={fila.opKey} className="border-b border-line last:border-0">
                    <td className="px-3 py-2 text-ink-muted">{fila.item}</td>
                    <td className="px-3 py-2 text-ink">{fila.operario}</td>
                    <td className="px-3 py-2 text-ink-muted">
                      <span className="font-mono">{fila.codigo}</span> {fila.descripcion}
                    </td>
                    <td className="px-3 py-2 text-ink-muted">
                      {fila.maquina} {fila.esManIns && <Badge variant="cyan" className="ml-1">MAN/INS</Badge>}
                    </td>
                    <td className="px-3 py-2 text-right text-ink-muted">{fila.minutosReq}</td>
                    <td className="px-3 py-2">
                      {op.h_inicio ?? (
                        <button
                          onClick={() => iniciar(fila.opKey)}
                          className="flex items-center gap-1 text-brand-600 hover:underline"
                        >
                          <Play className="w-3 h-3" /> Iniciar
                        </button>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {op.h_fin ?? (completa ? <Badge variant="verde">Listo</Badge> : '—')}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        {ordenFirmasPara(fila.esManIns).map((rol) => {
                          const firmado = !!op[`firma_${rol}` as const]
                          const nombre = op[`nombre_firma_${rol}` as const]
                          const metodoFirma = op[`metodo_firma_${rol}` as const]
                          const validacion = puedeFirmar(op, rol, fila.esManIns)
                          return (
                            <button
                              key={rol}
                              disabled={firmado || !validacion.ok}
                              title={firmado ? `${nombre} (${op[`hora_firma_${rol}` as const]}) · ${metodoFirma === 'camara' ? 'cámara' : 'manual'}` : validacion.ok ? `Firmar ${rol}` : validacion.motivo}
                              onClick={() => setFirmaAbierta({ opKey: fila.opKey, tipo: rol })}
                              className={`flex items-center gap-0.5 rounded px-1 py-0.5 ${firmado ? 'text-emerald-600' : validacion.ok ? 'text-ink-muted hover:text-ink' : 'text-ink-faint opacity-40'}`}
                            >
                              {firmado ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
                              <span className="capitalize">{rol.slice(0, 3)}</span>
                              {firmado && <IconoMetodo metodo={metodoFirma} />}
                            </button>
                          )
                        })}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        defaultValue={op.comentario ?? ''}
                        onBlur={(e) => comentarioCambiado(fila.opKey, e.target.value)}
                        className="w-32 text-xs border border-line rounded px-1.5 py-1"
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="border border-line rounded-xl bg-white p-4">
        <h2 className="text-xs font-semibold text-ink-muted uppercase tracking-wide mb-3">Firmas finales</h2>
        <div className="grid md:grid-cols-2 gap-4">
          {(['jefe_sector', 'analista_ing'] as const).map((rol) => {
            const firmado = rol === 'jefe_sector' ? formato.firmas_jefe_sector : formato.firmas_analista_ing
            const nombre = rol === 'jefe_sector' ? formato.nombre_firma_jefe_sector : formato.nombre_firma_analista_ing
            const hora = rol === 'jefe_sector' ? formato.hora_firma_jefe_sector : formato.hora_firma_analista_ing
            const metodoFirma = rol === 'jefe_sector' ? formato.metodo_firma_jefe_sector : formato.metodo_firma_analista_ing
            return (
              <div key={rol} className="flex items-center justify-between border border-line rounded-lg p-3">
                <div>
                  <p className="text-sm font-medium text-ink capitalize">{rol.replace('_', ' ')}</p>
                  {firmado ? (
                    <p className="flex items-center gap-1 text-xs text-emerald-600">
                      {nombre} · {hora} <IconoMetodo metodo={metodoFirma} />
                    </p>
                  ) : (
                    <p className="text-xs text-ink-faint">Sin firmar</p>
                  )}
                </div>
                {!firmado && (
                  <button
                    onClick={() => setFirmaAbierta({ tipo: rol })}
                    className="text-xs font-medium text-brand-600 border border-brand-200 rounded-lg px-3 py-1.5 hover:bg-brand-50"
                  >
                    Firmar
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </section>

      <section className="border border-line rounded-xl bg-white p-4">
        <h2 className="text-xs font-semibold text-ink-muted uppercase tracking-wide mb-2">Comentarios generales</h2>
        <textarea
          defaultValue={formato.comentarios_generales}
          onBlur={(e) => generalesCambiado('comentariosGenerales', e.target.value)}
          rows={2}
          className="w-full text-sm border border-line rounded-lg px-3 py-2"
        />
      </section>

      <div className="flex justify-between items-center">
        <button
          onClick={exportar}
          disabled={exportando}
          className="text-xs font-medium text-brand-600 border border-brand-200 rounded-lg px-3 py-1.5 hover:bg-brand-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {exportando ? 'Exportando…' : 'Exportar a Excel'}
        </button>
        <button
          onClick={() => navigate('/costura/requerimiento-maquina')}
          className="text-xs font-medium text-ink-muted border border-line rounded-lg px-3 py-1.5 hover:bg-surface"
        >
          Cerrar
        </button>
      </div>

      {firmaAbierta && 'opKey' in firmaAbierta && (
        <FirmaModal
          titulo={`Firmar como ${firmaAbierta.tipo}`}
          modo="operacion"
          rolEsperado={firmaAbierta.tipo}
          onClose={() => setFirmaAbierta(null)}
          onConfirm={async (empleado, rol, metodo) => {
            const fila = filas.find((f) => f.opKey === firmaAbierta.opKey)!
            await firmarOperacion({
              reportKey,
              opKey: firmaAbierta.opKey,
              tipo: rol as RolFirmaOperacion,
              nombre: empleado.nombre_completo,
              dni: empleado.dni,
              puesto: empleado.ocupacion,
              hora: horaActual(),
              esManIns: fila.esManIns,
              metodo,
            })
          }}
        />
      )}

      {firmaAbierta && !('opKey' in firmaAbierta) && (
        <FirmaModal
          titulo={`Firma final: ${firmaAbierta.tipo.replace('_', ' ')}`}
          modo="final"
          rolEsperado={firmaAbierta.tipo}
          onClose={() => setFirmaAbierta(null)}
          onConfirm={async (empleado, rol, metodo) => {
            await firmarFinal({
              reportKey,
              tipo: rol as RolFirmaFinal,
              nombre: empleado.nombre_completo,
              dni: empleado.dni,
              hora: horaActual(),
              metodo,
            })
          }}
        />
      )}
    </div>
  )
}
