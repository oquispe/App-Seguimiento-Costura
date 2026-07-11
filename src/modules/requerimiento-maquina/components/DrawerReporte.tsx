import { X, Trash2, ClipboardCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '../../../components/ui/Badge'
import type { BalanceReport } from '../types'

interface Props {
  report: BalanceReport | null
  onClose: () => void
  onDelete: (reportKey: string) => void
  deleting: boolean
}

function Campo({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-[11px] font-medium text-ink-faint uppercase tracking-wide">{label}</p>
      <p className="text-sm text-ink">{value || '—'}</p>
    </div>
  )
}

export function DrawerReporte({ report, onClose, onDelete, deleting }: Props) {
  const navigate = useNavigate()
  if (!report) return null

  const totalOperaciones = report.operarios.reduce((acc, o) => acc + o.operaciones.length, 0)
  const totalMaquinas = new Set(
    report.operarios.flatMap((o) => o.operaciones.map((op) => op.maquina).filter(Boolean))
  ).size

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-2xl h-full bg-white shadow-xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-line shrink-0">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-ink truncate">{report.estilo_cliente || report.archivo_original}</h2>
            <p className="text-xs text-ink-muted truncate">{report.archivo_original}</p>
          </div>
          <button onClick={onClose} className="shrink-0 p-1.5 rounded-lg text-ink-faint hover:bg-surface hover:text-ink">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <section className="p-4 border-b border-line grid grid-cols-3 gap-4">
            <Campo label="Cliente" value={report.cliente} />
            <Campo label="Línea" value={report.linea} />
            <Campo label="OP" value={report.op} />
            <Campo label="Tela" value={report.tela} />
            <Campo label="D. de prenda" value={report.d_prenda} />
            <Campo label="Usuario de prenda" value={report.usuario_prenda} />
            <Campo label="Tarifado" value={report.tarifado} />
            <Campo label="Tiempo std" value={report.tiempo_std} />
            <Campo label="Eficiencia" value={report.eficiencia ? `${report.eficiencia}%` : null} />
            <Campo label="Cuota diaria" value={report.cuota_diaria} />
            <Campo label="Cuota diaria (min)" value={report.cuota_diaria_minuto} />
            <Campo label="Nro. operarios" value={report.nro_operarios} />
            <Campo label="Minutos disponibles" value={report.minutos_disponibles} />
            <Campo label="Minutos disp. total" value={report.minutos_disponibles_total} />
            <Campo label="Minutos libres total" value={report.minutos_libres_total} />
          </section>

          <section className="p-4 border-b border-line flex items-center gap-4">
            <Badge variant="brand">{report.operarios.length} operarios</Badge>
            <Badge variant="teal">{totalOperaciones} operaciones</Badge>
            <Badge variant="cyan">{totalMaquinas} tipos de máquina</Badge>
          </section>

          <section className="p-4">
            <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-wide mb-3">
              Operarios y operaciones
            </h3>
            <div className="space-y-3">
              {report.operarios.map((op) => (
                <div key={op.item} className="border border-line rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 bg-surface">
                    <span className="text-sm font-medium text-ink">
                      {op.item}. {op.nombre}
                    </span>
                    {op.efc_indiv && (
                      <Badge variant={Number(op.efc_indiv) >= 0.95 ? 'verde' : 'ambar'}>
                        {(Number(op.efc_indiv) * 100).toFixed(1)}% efic.
                      </Badge>
                    )}
                  </div>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-ink-faint border-b border-line">
                        <th className="px-3 py-1.5 font-medium">Código</th>
                        <th className="px-3 py-1.5 font-medium">Descripción</th>
                        <th className="px-3 py-1.5 font-medium">Máquina</th>
                        <th className="px-3 py-1.5 font-medium text-right">T.Std</th>
                        <th className="px-3 py-1.5 font-medium text-right">Min. req.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {op.operaciones.map((o, i) => (
                        <tr key={i} className="border-b border-line last:border-0">
                          <td className="px-3 py-1.5 font-mono text-ink-muted">{o.codigo}</td>
                          <td className="px-3 py-1.5 text-ink">{o.descripcion}</td>
                          <td className="px-3 py-1.5 text-ink-muted">{o.maquina}</td>
                          <td className="px-3 py-1.5 text-right text-ink-muted">{o.t_std}</td>
                          <td className="px-3 py-1.5 text-right text-ink-muted">{o.minutos_req}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="flex justify-between px-3 py-1.5 bg-surface text-xs text-ink-muted">
                    <span>Total: <strong className="text-ink">{op.total_minutos ?? '—'}</strong> min</span>
                    <span>Libres: <strong className="text-ink">{op.minutos_libres ?? '—'}</strong> min</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="shrink-0 border-t border-line px-4 py-3 flex justify-between">
          <button
            onClick={() => navigate(`/costura/requerimiento-maquina/formato/${encodeURIComponent(report.report_key)}`)}
            className="flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:bg-brand-50 rounded-lg px-3 py-1.5"
          >
            <ClipboardCheck className="w-3.5 h-3.5" />
            Abrir formato de instalación
          </button>
          <button
            onClick={() => onDelete(report.report_key)}
            disabled={deleting}
            className="flex items-center gap-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg px-3 py-1.5 disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {deleting ? 'Eliminando…' : 'Eliminar reporte'}
          </button>
        </div>
      </div>
    </div>
  )
}
