import { useCallback, useEffect, useMemo, useState } from 'react'
import { Wrench, Users as UsersIcon } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { DropZone } from '../../../components/upload/DropZone'
import { Badge } from '../../../components/ui/Badge'
import { Spinner } from '../../../components/ui/Spinner'
import { getErrorMessage } from '../../../lib/errorUtils'
import { cn } from '../../../lib/utils'
import { parseBalanceExcel } from '../lib/parseBalanceExcel'
import { parseEmpleados } from '../lib/parseEmpleados'
import { guardarReporte, listarReportes, eliminarReporte, guardarEmpleados } from '../lib/rmReports'
import { DrawerReporte } from '../components/DrawerReporte'
import type { BalanceReport, EmpleadoRow } from '../types'
import type { ParseResult } from '../../../types'

function StatCard({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-line bg-white p-4 text-center">
      <div className={cn('text-2xl font-bold', accent ? 'text-brand-600' : 'text-ink')}>{value}</div>
      <div className="mt-1 text-xs text-ink-muted">{label}</div>
    </div>
  )
}

export function ReportesPage() {
  const [reportes, setReportes] = useState<BalanceReport[]>([])
  const [cargandoLista, setCargandoLista] = useState(true)
  const [errorLista, setErrorLista] = useState<string | null>(null)

  const [parseResult, setParseResult] = useState<ParseResult<BalanceReport> | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [guardadoMsg, setGuardadoMsg] = useState<string | null>(null)

  const [empleadosResult, setEmpleadosResult] = useState<ParseResult<EmpleadoRow> | null>(null)
  const [guardandoEmpleados, setGuardandoEmpleados] = useState(false)
  const [mostrarEmpleados, setMostrarEmpleados] = useState(false)

  const [selected, setSelected] = useState<BalanceReport | null>(null)
  const [eliminando, setEliminando] = useState(false)

  const [filtroLinea, setFiltroLinea] = useState('')
  const [filtroCliente, setFiltroCliente] = useState('')

  const cargarLista = useCallback(() => {
    setCargandoLista(true)
    listarReportes()
      .then(setReportes)
      .catch((err) => setErrorLista(getErrorMessage(err)))
      .finally(() => setCargandoLista(false))
  }, [])

  useEffect(() => {
    cargarLista()
  }, [cargarLista])

  const handleParsedBalance = useCallback(async (result: ParseResult<BalanceReport>, _buffer: ArrayBuffer, fileName: string) => {
    // El parser no conoce el nombre real del archivo subido (DropZone lo aísla) —
    // se asigna acá, ya que report_key debe ser el nombre de archivo para calzar
    // con el modelo del backend Python original (data.json queda indexado por filename).
    if (result.rows.length > 0) {
      result.rows[0] = { ...result.rows[0], report_key: fileName, archivo_original: fileName }
    }
    setParseResult(result)
    setGuardadoMsg(null)
    if (result.rows.length === 0) return

    setGuardando(true)
    try {
      const { data } = await supabase.auth.getUser()
      const cargadoPor = data.user?.email ?? 'desconocido'
      const res = await guardarReporte(result.rows[0], cargadoPor)
      if (res.ok) {
        setGuardadoMsg(`Reporte "${result.rows[0].report_key}" guardado.`)
        cargarLista()
      } else {
        setGuardadoMsg(`Error al guardar: ${res.error}`)
      }
    } finally {
      setGuardando(false)
    }
  }, [cargarLista])

  const handleParsedEmpleados = useCallback(async (result: ParseResult<EmpleadoRow>) => {
    setEmpleadosResult(result)
    if (result.rows.length === 0) return

    setGuardandoEmpleados(true)
    try {
      await guardarEmpleados(result.rows)
    } finally {
      setGuardandoEmpleados(false)
    }
  }, [])

  const handleDelete = useCallback(async (reportKey: string) => {
    setEliminando(true)
    try {
      const res = await eliminarReporte(reportKey)
      if (res.ok) {
        setSelected(null)
        cargarLista()
      }
    } finally {
      setEliminando(false)
    }
  }, [cargarLista])

  const lineas = useMemo(
    () => Array.from(new Set(reportes.map((r) => r.linea).filter((v): v is string => !!v))).sort(),
    [reportes]
  )
  const clientes = useMemo(
    () => Array.from(new Set(reportes.map((r) => r.cliente).filter((v): v is string => !!v))).sort(),
    [reportes]
  )

  const reportesFiltrados = useMemo(
    () =>
      reportes.filter(
        (r) =>
          (!filtroLinea || r.linea === filtroLinea) &&
          (!filtroCliente || r.cliente === filtroCliente)
      ),
    [reportes, filtroLinea, filtroCliente]
  )

  const eficienciaProm = useMemo(() => {
    const valores = reportes.map((r) => Number(r.eficiencia)).filter((v) => !Number.isNaN(v))
    if (valores.length === 0) return null
    return valores.reduce((acc, v) => acc + v, 0) / valores.length
  }, [reportes])

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            <Wrench size={18} />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-ink">Requerimiento de Máquina</h1>
            <p className="text-xs text-ink-muted">{reportes.length} reportes cargados</p>
          </div>
        </div>
        <button
          onClick={() => setMostrarEmpleados((v) => !v)}
          className="flex items-center gap-1.5 text-xs font-medium text-ink-muted hover:text-ink border border-line rounded-lg px-3 py-1.5 hover:bg-surface"
        >
          <UsersIcon className="w-3.5 h-3.5" />
          Cargar empleados
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Reportes cargados" value={reportes.length} />
        <StatCard label="Líneas activas" value={lineas.length} />
        <StatCard label="Clientes" value={clientes.length} />
        <StatCard label="Eficiencia prom." value={eficienciaProm != null ? `${eficienciaProm.toFixed(1)}%` : '—'} accent />
      </div>

      <div className="rounded-xl border border-line bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-ink">Cargar nuevo balance de línea</h2>
        <div className="flex flex-col gap-4 md:flex-row">
          <div className="flex-1">
            <DropZone<BalanceReport>
              label="Cargar Excel de balance de línea"
              onParsed={handleParsedBalance}
              parse={parseBalanceExcel}
              result={parseResult}
              loading={guardando}
            />
          </div>
          {mostrarEmpleados && (
            <div className="flex-1">
              <DropZone<EmpleadoRow>
                label="Cargar registros.xlsx (empleados)"
                onParsed={handleParsedEmpleados}
                parse={parseEmpleados}
                result={empleadosResult}
                loading={guardandoEmpleados}
              />
            </div>
          )}
        </div>

        {guardadoMsg && (
          <p className={`mt-3 text-xs ${guardadoMsg.startsWith('Error') ? 'text-red-600' : 'text-emerald-600'}`}>
            {guardadoMsg}
          </p>
        )}
      </div>

      <div className="rounded-xl border border-line bg-white p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-muted">Cliente</label>
            <select
              value={filtroCliente}
              onChange={(e) => setFiltroCliente(e.target.value)}
              className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs text-ink"
            >
              <option value="">Todos los clientes</option>
              {clientes.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-muted">Línea</label>
            <select
              value={filtroLinea}
              onChange={(e) => setFiltroLinea(e.target.value)}
              className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs text-ink"
            >
              <option value="">Todas las líneas</option>
              {lineas.map((l) => (
                <option key={l} value={l}>Línea {l}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-line bg-white overflow-hidden">
        <h2 className="px-4 pt-4 pb-3 text-sm font-semibold text-ink">Reportes cargados</h2>
        {cargandoLista ? (
          <div className="flex items-center justify-center py-12">
            <Spinner />
          </div>
        ) : errorLista ? (
          <p className="p-4 text-sm text-red-600">{errorLista}</p>
        ) : reportesFiltrados.length === 0 ? (
          <p className="p-8 text-sm text-ink-muted text-center">
            Sin reportes cargados todavía. Sube un Excel de balance de línea arriba.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-faint uppercase tracking-wide border-b border-line bg-surface">
                <th className="px-4 py-2 font-medium">Estilo cliente</th>
                <th className="px-4 py-2 font-medium">Cliente</th>
                <th className="px-4 py-2 font-medium">Línea</th>
                <th className="px-4 py-2 font-medium">OP</th>
                <th className="px-4 py-2 font-medium text-right">Operarios</th>
                <th className="px-4 py-2 font-medium text-right">Eficiencia</th>
                <th className="px-4 py-2 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {reportesFiltrados.map((r) => (
                <tr
                  key={r.report_key}
                  onClick={() => setSelected(r)}
                  className="border-b border-line last:border-0 hover:bg-surface cursor-pointer"
                >
                  <td className="px-4 py-2 font-medium text-ink">{r.estilo_cliente || '—'}</td>
                  <td className="px-4 py-2 text-ink-muted">{r.cliente || '—'}</td>
                  <td className="px-4 py-2 text-ink-muted">{r.linea || '—'}</td>
                  <td className="px-4 py-2 text-ink-muted">{r.op || '—'}</td>
                  <td className="px-4 py-2 text-right text-ink-muted">{r.operarios.length}</td>
                  <td className="px-4 py-2 text-right text-ink-muted">{r.eficiencia ? `${r.eficiencia}%` : '—'}</td>
                  <td className="px-4 py-2"><Badge variant="slate">{r.estado}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <DrawerReporte report={selected} onClose={() => setSelected(null)} onDelete={handleDelete} deleting={eliminando} />
    </div>
  )
}
