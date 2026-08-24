// ─── Fuentes de datos parseadas ───────────────────────────────────────────────

export interface AuditoriaRow {
  semana: string
  cliente: string
  estilo: string
  po: string
  color: string
  cant_prog: number | null
  externa: string | null
}

export interface PgoRow {
  po: string
  cliente: string
  estilo: string
  color: string
  fin_entrega: Date | null
  auditoria: Date | null
  auditoria_final: Date | null
}

export interface CortesRow {
  po: string
  op: string
  cliente: string
  estilo: string
  color: string
  ruta: string
  // Prendas en cada área = Columna01 + Columna02 (según Hoja2 del reporte)
  en_corte: number          // Por Cortar + En Corte
  en_bordado: number        // Bordado Pza + Bordado Pda
  en_costura: number        // Estanteria + Costura Proceso
  en_estampado: number      // Estampado Pza Chincha + Estampado Pda Chincha
  en_estampado_ext: number  // Estampado Pza Ext + Estampado Pda Ext
  en_transfer: number        // Transfer Pza + Transfer Pda
  en_lavanderia: number     // Lavanderia_Pda
  en_costura_lineas: number // Costura Lineas
  en_acabado: number        // Acabado
  apt: number               // Apt (prendas listas)
  exportado: number         // Exportado
  porc_exp: number          // Porc Exp (% exportado)
  total_requeridas: number  // Requerida
  // Desglose por OP individual: un mismo PO+Estilo+Color puede repartirse
  // entre varias OPs, cada una en una etapa de producción distinta.
  ops: OpDetalle[]
}

/** Cantidad de prendas (Estantería + Proceso) que tiene una línea de costura. */
export interface LineaDetalle {
  linea: string
  en_estanteria: number
  en_proceso: number
  cantidad: number
}

/** Fila cruda del reporte StatusCorte (status.xlsm), a nivel PO+OP+Línea. */
export interface LineaRow {
  po: string
  op: string
  estilo: string
  color: string
  linea: string
  en_estanteria: number
  en_proceso: number
}

/** Avance de una OP individual dentro de un PO+Estilo+Color. */
export interface OpDetalle {
  op: string
  ruta: string
  en_corte: number
  en_bordado: number
  en_costura: number
  en_estampado: number
  en_estampado_ext: number
  en_transfer: number
  en_lavanderia: number
  en_costura_lineas: number
  en_acabado: number
  apt: number
  exportado: number
  total_requeridas: number
}

// ─── Ítem cruzado principal ────────────────────────────────────────────────────

export interface ItemCruzado {
  item_key: string
  // Llave persistente (PO|Estilo|Color, sin semana) para el seguimiento —
  // ver makeBaseKey() en lib/parsers/normalize.ts.
  base_key: string
  semana: string
  cliente: string
  estilo: string
  po: string
  color: string
  cant_prog: number | null
  externa: string | null
  // PGO
  fin_entrega: Date | null
  auditoria: Date | null
  auditoria_final: Date | null
  // Ruta de producción
  op: string
  ruta: string
  // Prendas en cada área (de rptReporteSituacionOrdenes)
  en_corte: number
  en_bordado: number
  en_costura: number
  en_estampado: number
  en_estampado_ext: number
  en_transfer: number
  en_lavanderia: number
  en_costura_lineas: number
  en_acabado: number
  apt: number
  exportado: number
  porc_exp: number
  total_requeridas: number
  // true si el PO no aparece en el reporte → producción 100% cerrada (ya en bodega)
  produccion_cerrada: boolean
  // Desglose por OP individual (ver CortesRow.ops)
  ops: OpDetalle[]
  // Desglose por línea de costura (ver CortesRow.lineas)
  lineas: LineaDetalle[]
  // Semáforo
  dias_fin_entrega: number | null
  dias_auditoria_final: number | null
  semaforo: 'rojo' | 'ambar' | 'verde' | 'sin-fecha'
  // Seguimiento (de Supabase)
  estado: EstadoAuditoria
  resultado: string | null
  fecha_solicitada: string | null
  fecha_auditoria: string | null
  solicitado_por: string | null
  responsable: string | null
  compromisos: CompromisosEtapas
  compromisos_linea: CompromisosLinea
  auditoria_final_override: string | null
}

export type EstadoAuditoria =
  | 'Pendiente'
  | 'Programada'
  | 'En proceso'
  | 'Aprobada'
  | 'Rechazada'
  | 'Reprogramada'

// ─── Compromisos por área ─────────────────────────────────────────────────────

export interface CompromisoEtapa {
  comprometidos: number | null    // pzas que el área se compromete a pasar
  fecha_compromiso: string | null // YYYY-MM-DD: cuándo compromete terminar
  proxima_reunion: string | null  // YYYY-MM-DD: próxima revisión con el área
  notas: string
}

export type CompromisosEtapas = Record<string, CompromisoEtapa>

// ─── Compromisos por línea de costura ─────────────────────────────────────────

export interface CompromisoLinea {
  fecha_jefe_sector: string | null // YYYY-MM-DD: compromiso de ingreso del Jefe de Sector
}

export type CompromisosLinea = Record<string, CompromisoLinea>

// ─── Seguimiento (tabla Supabase) ──────────────────────────────────────────────

export interface SeguimientoRecord {
  base_key: string
  item_key: string
  cliente: string | null
  estilo: string | null
  po: string | null
  color: string | null
  cant_prog: number | null
  externa: string | null
  semana: string | null
  estado: EstadoAuditoria
  resultado: string | null
  fecha_solicitada: string | null
  fecha_auditoria: string | null
  solicitado_por: string | null
  responsable: string | null
  compromisos: CompromisosEtapas | null
  compromisos_linea: CompromisosLinea | null
  auditoria_final_override: string | null
}

export interface ComentarioRecord {
  id?: number
  base_key: string
  item_key: string
  autor: string
  texto: string
  created_at?: string
}

// ─── Diagnóstico de cruce ─────────────────────────────────────────────────────

export interface DiagnosticoCruce {
  total_auditorias: number
  con_pgo: number
  sin_pgo: string[]
  con_cortes: number
  // Ítems sin match en Status (PO+Color): produccion_cerrada=true
  sin_match: { po: string; color: string }[]
}

// ─── Mapeo manual de columnas ─────────────────────────────────────────────────

export type FuenteExcel = 'auditorias' | 'pgo' | 'cortes'

export interface MapeoColumnas {
  fuente: FuenteExcel
  mapeo: Record<string, string>
}

// ─── Parse result ─────────────────────────────────────────────────────────────

export interface ParseResult<T> {
  rows: T[]
  leidas: number
  validas: number
  omitidas: number
  errores: string[]
  columnasFaltantes: string[]
}

// ─── KPIs ─────────────────────────────────────────────────────────────────────

export interface KPIs {
  total: number
  auditadas: number
  pendientes: number
  vencidas: number
  pct_cumplimiento: number
  por_persona: PersonaKPI[]
}

export interface PersonaKPI {
  responsable: string
  total: number
  aprobadas: number
  vencidas: number
  pct: number
}

// ─── Llave de cruce ───────────────────────────────────────────────────────────

export type LlaveCruce = 'PO' | 'PO+COLOR'
