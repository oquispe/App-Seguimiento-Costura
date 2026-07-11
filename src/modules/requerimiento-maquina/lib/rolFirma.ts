import type { RolFirmaOperacion, RolFirmaFinal, OperacionFormato } from '../types'

/**
 * Puerto TS de la clasificación por palabra clave de ocupación
 * (Proyecto_Balance/Balance/web/static/js/scanner.js:195-205). El orden
 * if/elif importa: una ocupación como "SUPERVISOR DE CALIDAD" cae en
 * auditor porque CALIDAD se evalúa antes que SUPERVISOR.
 */
export function clasificarRolOperacion(ocupacion: string): RolFirmaOperacion | null {
  const o = ocupacion.toUpperCase()
  if (o.includes('AUDITOR') || o.includes('CALIDAD')) return 'auditor'
  if (o.includes('SUPERVISOR')) return 'supervisor'
  if (o.includes('MAQUINISTA') || o.includes('OPERARIO') || o.includes('COSTUR')) return 'operario'
  if (o.includes('MECANICO') || o.includes('MECÁNICO')) return 'mecanico'
  return null
}

export function clasificarRolFinal(ocupacion: string): RolFirmaFinal | null {
  const o = ocupacion.toUpperCase()
  if (o.includes('JEFE') || o.includes('GERENTE') || o.includes('COORDINADOR')) return 'jefe_sector'
  if (o.includes('ANALISTA') || o.includes('ANALISTA') || o.includes('INGENIERO')) return 'analista_ing'
  return null
}

/**
 * Una operación es MAN/INS (sin máquina, solo requiere operario+supervisor)
 * cuando su campo `maquina` es "MAN"/"INS" (con o sin punto) —
 * Proyecto_Balance/Balance/web/templates/index.html:2168. Se deriva del
 * balance ya cargado en vez de depender de un flag guardado aparte, así el
 * cliente siempre puede mandar `es_man_ins` explícito en cada firma (ver
 * `rm_formato_firmar_operacion` en supabase_migration_v10.sql).
 */
export function esOperacionManIns(maquina: string): boolean {
  const m = maquina.trim().toUpperCase()
  return m === 'MAN' || m === 'MAN.' || m === 'INS' || m === 'INS.'
}

/**
 * Orden mandatorio de firma por operación (index.html:3207-3215): en MAN/INS
 * solo participan operario y supervisor (mecánico/auditor quedan excluidos,
 * no solo "no requeridos"); en el resto participan las 4 firmas en orden.
 */
export function ordenFirmasPara(esManIns: boolean): RolFirmaOperacion[] {
  return esManIns ? ['operario', 'supervisor'] : ['mecanico', 'operario', 'supervisor', 'auditor']
}

const CAMPO_FIRMA: Record<RolFirmaOperacion, keyof OperacionFormato> = {
  mecanico: 'firma_mecanico',
  operario: 'firma_operario',
  supervisor: 'firma_supervisor',
  auditor: 'firma_auditor',
}

/**
 * Valida que el rol pueda firmar ahora: debe estar en el orden permitido
 * para esta operación y todas las firmas anteriores de ese orden ya deben
 * estar hechas (index.html:3217-3244).
 */
export function puedeFirmar(op: OperacionFormato, tipo: RolFirmaOperacion, esManIns: boolean): { ok: true } | { ok: false; motivo: string } {
  const orden = ordenFirmasPara(esManIns)
  const indice = orden.indexOf(tipo)
  if (indice === -1) {
    return { ok: false, motivo: esManIns ? 'Operación MAN/INS solo requiere OPERARIO y SUPERVISOR' : `Esta operación requiere ${orden.join(', ')}` }
  }
  for (let i = 0; i < indice; i++) {
    if (!op[CAMPO_FIRMA[orden[i]]]) {
      return { ok: false, motivo: `Falta la firma de ${orden[i]} antes de ${tipo}` }
    }
  }
  return { ok: true }
}

/**
 * Réplica de la lógica autoritativa de H.FIN (server.py:1414-1440): en
 * operaciones MAN/INS basta operario+supervisor; en el resto se exige
 * también auditor. El mecánico nunca participa en esta condición.
 */
export function calcularHFinCompleta(op: OperacionFormato, esManIns: boolean): boolean {
  const tieneOperario = !!op.firma_operario
  const tieneSupervisor = !!op.firma_supervisor
  const tieneAuditor = !!op.firma_auditor
  if (esManIns) return tieneOperario && tieneSupervisor
  return tieneOperario && tieneSupervisor && tieneAuditor
}
