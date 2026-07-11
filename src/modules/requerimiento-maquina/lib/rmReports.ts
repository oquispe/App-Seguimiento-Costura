import { supabase } from '../../../lib/supabase'
import type { BalanceReport, EmpleadoRow } from '../types'

interface RmReportRow {
  report_key: string
  archivo_original: string
  estilo_cliente: string | null
  cliente: string | null
  tarifado: string | null
  varia_tarifado: string | null
  d_prenda: string | null
  op: string | null
  usuario_prenda: string | null
  tela: string | null
  linea: string | null
  nro_operarios: string | null
  tiempo_std: string | null
  eficiencia: string | null
  cuota_diaria: string | null
  cuota_diaria_minuto: string | null
  minutos_disponibles: string | null
  minutos_disponibles_total: string | null
  minutos_libres_total: string | null
  operarios_json: BalanceReport['operarios']
  estado: string
  cargado_por: string | null
  cargado_at: string
}

function toRow(report: BalanceReport, cargadoPor: string): Omit<RmReportRow, 'cargado_at'> & { cargado_at: string } {
  return {
    report_key: report.report_key,
    archivo_original: report.archivo_original,
    estilo_cliente: report.estilo_cliente,
    cliente: report.cliente,
    tarifado: report.tarifado,
    varia_tarifado: report.varia_tarifado,
    d_prenda: report.d_prenda,
    op: report.op,
    usuario_prenda: report.usuario_prenda,
    tela: report.tela,
    linea: report.linea,
    nro_operarios: report.nro_operarios,
    tiempo_std: report.tiempo_std,
    eficiencia: report.eficiencia,
    cuota_diaria: report.cuota_diaria,
    cuota_diaria_minuto: report.cuota_diaria_minuto,
    minutos_disponibles: report.minutos_disponibles,
    minutos_disponibles_total: report.minutos_disponibles_total,
    minutos_libres_total: report.minutos_libres_total,
    operarios_json: report.operarios,
    estado: report.estado,
    cargado_por: cargadoPor,
    cargado_at: new Date().toISOString(),
  }
}

function fromRow(row: RmReportRow): BalanceReport {
  return {
    report_key: row.report_key,
    archivo_original: row.archivo_original,
    estilo_cliente: row.estilo_cliente,
    cliente: row.cliente,
    tarifado: row.tarifado,
    varia_tarifado: row.varia_tarifado,
    d_prenda: row.d_prenda,
    op: row.op,
    usuario_prenda: row.usuario_prenda,
    tela: row.tela,
    linea: row.linea,
    nro_operarios: row.nro_operarios,
    tiempo_std: row.tiempo_std,
    eficiencia: row.eficiencia,
    cuota_diaria: row.cuota_diaria,
    cuota_diaria_minuto: row.cuota_diaria_minuto,
    minutos_disponibles: row.minutos_disponibles,
    minutos_disponibles_total: row.minutos_disponibles_total,
    minutos_libres_total: row.minutos_libres_total,
    operarios: row.operarios_json ?? [],
    estado: row.estado,
  }
}

/** Upsert de un reporte de balance por report_key (nuevo = insert, existente = update). */
export async function guardarReporte(
  report: BalanceReport,
  cargadoPor: string
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from('rm_reports')
    .upsert(toRow(report, cargadoPor), { onConflict: 'report_key' })

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function obtenerReporte(reportKey: string): Promise<BalanceReport | null> {
  const { data, error } = await supabase
    .from('rm_reports')
    .select('*')
    .eq('report_key', reportKey)
    .maybeSingle()

  if (error) throw error
  return data ? fromRow(data as RmReportRow) : null
}

export async function listarReportes(): Promise<BalanceReport[]> {
  const { data, error } = await supabase
    .from('rm_reports')
    .select('*')
    .order('cargado_at', { ascending: false })

  if (error) throw error
  return (data as RmReportRow[]).map(fromRow)
}

export async function eliminarReporte(reportKey: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from('rm_reports').delete().eq('report_key', reportKey)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

/** Upsert masivo del directorio de empleados (reemplaza por DNI). */
export async function guardarEmpleados(empleados: EmpleadoRow[]): Promise<{ ok: boolean; error?: string; cantidad: number }> {
  if (empleados.length === 0) return { ok: false, error: 'Sin empleados para guardar', cantidad: 0 }

  const rows = empleados.map((e) => ({
    dni: e.dni,
    nombre_completo: e.nombre_completo,
    ocupacion: e.ocupacion,
    centro_costo: e.centro_costo,
    codigo: e.codigo,
    actualizado_at: new Date().toISOString(),
  }))

  const { error } = await supabase.from('rm_empleados').upsert(rows, { onConflict: 'dni' })
  if (error) return { ok: false, error: error.message, cantidad: 0 }
  return { ok: true, cantidad: rows.length }
}

export async function listarEmpleados(): Promise<EmpleadoRow[]> {
  const { data, error } = await supabase.from('rm_empleados').select('*').order('nombre_completo')
  if (error) throw error
  return (data as (EmpleadoRow & { actualizado_at: string })[]).map((r) => ({
    dni: r.dni,
    nombre_completo: r.nombre_completo,
    ocupacion: r.ocupacion,
    centro_costo: r.centro_costo,
    codigo: r.codigo,
  }))
}

/** Busca un empleado por DNI o código (entrada de QR/lector de código de barras o texto manual). */
export async function buscarEmpleado(query: string): Promise<EmpleadoRow | null> {
  const q = query.trim()
  if (!q) return null

  const toEmpleado = (r: EmpleadoRow): EmpleadoRow => ({
    dni: r.dni,
    nombre_completo: r.nombre_completo,
    ocupacion: r.ocupacion,
    centro_costo: r.centro_costo,
    codigo: r.codigo,
  })

  const porDni = await supabase.from('rm_empleados').select('*').eq('dni', q).maybeSingle()
  if (porDni.error) throw porDni.error
  if (porDni.data) return toEmpleado(porDni.data as EmpleadoRow)

  const porCodigo = await supabase.from('rm_empleados').select('*').eq('codigo', q).maybeSingle()
  if (porCodigo.error) throw porCodigo.error
  if (porCodigo.data) return toEmpleado(porCodigo.data as EmpleadoRow)

  return null
}
