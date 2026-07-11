import { supabase } from '../../../lib/supabase'
import type { FormatoInstalacion, RolFirmaOperacion, RolFirmaFinal, MetodoFirma } from '../types'

interface FormatoRow {
  report_key: string
  estilo_saliente: string
  fecha_inicio: string
  fecha_fin: string
  operaciones_json: FormatoInstalacion['operaciones_json']
  firmas_jefe_sector: boolean
  firmas_analista_ing: boolean
  nombre_firma_jefe_sector: string
  dni_firma_jefe_sector: string
  hora_firma_jefe_sector: string
  metodo_firma_jefe_sector: string
  nombre_firma_analista_ing: string
  dni_firma_analista_ing: string
  hora_firma_analista_ing: string
  metodo_firma_analista_ing: string
  comentarios_generales: string
  actualizado_at: string
}

function fromRow(row: FormatoRow): FormatoInstalacion {
  return { ...row, operaciones_json: row.operaciones_json ?? {} }
}

const VACIO = (reportKey: string): FormatoInstalacion => ({
  report_key: reportKey,
  estilo_saliente: '',
  fecha_inicio: '',
  fecha_fin: '',
  operaciones_json: {},
  firmas_jefe_sector: false,
  firmas_analista_ing: false,
  nombre_firma_jefe_sector: '',
  dni_firma_jefe_sector: '',
  hora_firma_jefe_sector: '',
  metodo_firma_jefe_sector: '',
  nombre_firma_analista_ing: '',
  dni_firma_analista_ing: '',
  hora_firma_analista_ing: '',
  metodo_firma_analista_ing: '',
  comentarios_generales: '',
  actualizado_at: '',
})

/** Trae el formato de un report_key, o un objeto vacío si aún no existe fila. */
export async function obtenerFormato(reportKey: string): Promise<FormatoInstalacion> {
  const { data, error } = await supabase
    .from('rm_formato_instalacion')
    .select('*')
    .eq('report_key', reportKey)
    .maybeSingle()

  if (error) throw error
  return data ? fromRow(data as FormatoRow) : VACIO(reportKey)
}

/** Suscripción Realtime a cambios del formato de un report_key (multi-dispositivo). */
export function suscribirFormato(reportKey: string, onChange: (formato: FormatoInstalacion) => void) {
  const channel = supabase
    .channel(`rm_formato_instalacion:${reportKey}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'rm_formato_instalacion', filter: `report_key=eq.${reportKey}` },
      (payload) => {
        if (payload.new && Object.keys(payload.new).length > 0) {
          onChange(fromRow(payload.new as FormatoRow))
        }
      }
    )
    .subscribe()

  return () => { supabase.removeChannel(channel) }
}

export async function registrarHInicio(reportKey: string, opKey: string, hInicio: string): Promise<void> {
  const { error } = await supabase.rpc('rm_formato_registrar_h_inicio', {
    p_report_key: reportKey,
    p_op_key: opKey,
    p_h_inicio: hInicio,
  })
  if (error) throw error
}

export async function firmarOperacion(params: {
  reportKey: string
  opKey: string
  tipo: RolFirmaOperacion
  nombre: string
  dni: string
  puesto: string
  hora: string
  esManIns: boolean
  metodo: MetodoFirma
}): Promise<void> {
  const { error } = await supabase.rpc('rm_formato_firmar_operacion', {
    p_report_key: params.reportKey,
    p_op_key: params.opKey,
    p_tipo: params.tipo,
    p_nombre: params.nombre,
    p_dni: params.dni,
    p_puesto: params.puesto,
    p_hora: params.hora,
    p_es_man_ins: params.esManIns,
    p_metodo: params.metodo,
  })
  if (error) throw error
}

export async function guardarComentarioOperacion(reportKey: string, opKey: string, comentario: string): Promise<void> {
  const { error } = await supabase.rpc('rm_formato_comentario_operacion', {
    p_report_key: reportKey,
    p_op_key: opKey,
    p_comentario: comentario,
  })
  if (error) throw error
}

export async function firmarFinal(params: {
  reportKey: string
  tipo: RolFirmaFinal
  nombre: string
  dni: string
  hora: string
  metodo: MetodoFirma
}): Promise<void> {
  const { error } = await supabase.rpc('rm_formato_firmar_final', {
    p_report_key: params.reportKey,
    p_tipo: params.tipo,
    p_nombre: params.nombre,
    p_dni: params.dni,
    p_hora: params.hora,
    p_metodo: params.metodo,
  })
  if (error) throw error
}

export async function limpiarFirmasFinales(reportKey: string): Promise<void> {
  const { error } = await supabase.rpc('rm_formato_limpiar_firmas', { p_report_key: reportKey })
  if (error) throw error
}

export async function guardarGenerales(reportKey: string, campos: { estiloSaliente?: string; comentariosGenerales?: string }): Promise<void> {
  const { error } = await supabase.rpc('rm_formato_guardar_generales', {
    p_report_key: reportKey,
    p_estilo_saliente: campos.estiloSaliente ?? null,
    p_comentarios_generales: campos.comentariosGenerales ?? null,
  })
  if (error) throw error
}

export async function upsertEvento(reportKey: string, opKey: string, evento: { id: string; tipo: string; descripcion: string; hora: string }): Promise<void> {
  const { error } = await supabase.rpc('rm_formato_evento_upsert', {
    p_report_key: reportKey,
    p_op_key: opKey,
    p_evento: evento,
  })
  if (error) throw error
}

export async function eliminarEvento(reportKey: string, opKey: string, eventoId: string): Promise<void> {
  const { error } = await supabase.rpc('rm_formato_evento_delete', {
    p_report_key: reportKey,
    p_op_key: opKey,
    p_evento_id: eventoId,
  })
  if (error) throw error
}
