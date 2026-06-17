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
  cliente: string
  color: string
  ruta: string              // "(CORTE),(COSTURA),(ACABADO)"
  // Costura
  en_estanteria: number     // piezas esperando costura
  en_proceso: number        // piezas siendo cosidas
  confeccionadas: number    // salida de costura (van a siguiente etapa)
  // Bordado
  en_bordado: number
  bordadas: number
  // Estampado
  en_estampado: number
  estampadas: number
  // Transfer
  en_transfer: number
  transfer_terminadas: number
  // Lavandería
  en_lavanderia: number
  lavadas: number
  // Acabados (única etapa final: ingreso = lista para auditar, no hay columna de salida)
  ingresos_acabados_1ra: number  // INGRESOS ACABADOS 1RA
  ingresos_acabados_2da: number  // INGRESOS ACABADOS 2DA
  en_acabados: number            // = ingresos_acabados_1ra + ingresos_acabados_2da
  piezas_acabadas: number        // = en_acabados (no existe columna de "salida" de acabados)
  // Totales
  total_requeridas: number  // PRENDAS REQUERIDAS OP
  linea_costura: string     // nombre del taller/línea de costura (texto)
}

// ─── Ítem cruzado principal ────────────────────────────────────────────────────

export interface ItemCruzado {
  item_key: string
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
  ruta: string
  // Costura
  en_estanteria: number
  en_proceso: number
  confeccionadas: number
  // Bordado
  en_bordado: number
  bordadas: number
  // Estampado
  en_estampado: number
  estampadas: number
  // Transfer
  en_transfer: number
  transfer_terminadas: number
  // Lavandería
  en_lavanderia: number
  lavadas: number
  // Acabados
  ingresos_acabados_1ra: number
  ingresos_acabados_2da: number
  en_acabados: number
  piezas_acabadas: number
  // Totales cortes
  total_requeridas: number
  linea_costura: string
  // true si el PO no aparece en Status Cortes → se asume producción 100% cerrada (ya en bodega)
  produccion_cerrada: boolean
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

// ─── Seguimiento (tabla Supabase) ──────────────────────────────────────────────

export interface SeguimientoRecord {
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
}

export interface ComentarioRecord {
  id?: number
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
  // POs sin fila en Status Cortes: se asumen cerrados (producción terminada, listos para auditar)
  cerrados: string[]
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
