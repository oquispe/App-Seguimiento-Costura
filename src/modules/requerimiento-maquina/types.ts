// ─── Balance de línea (Excel de "requerimiento de máquina") ──────────────────

export interface OperacionBalance {
  codigo: string
  descripcion: string
  maquina: string
  t_std: string
  cantidad: string
  potencial: string
  minutos_req: string
}

export interface OperarioBalance {
  item: number
  nombre: string
  operaciones: OperacionBalance[]
  total_minutos: string | null
  minutos_libres: string | null
  indice_desocup: string | null
  efc_indiv: string | null
}

export interface BalanceReport {
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
  operarios: OperarioBalance[]
  estado: string
}

// ─── Directorio de empleados (registros.xlsx) ─────────────────────────────────

export interface EmpleadoRow {
  dni: string
  nombre_completo: string
  ocupacion: string
  centro_costo: string
  codigo: string
}

// ─── Formato de instalación (QR + firmas) ─────────────────────────────────────

/** Roles que firman por operación, en el orden mandatorio de firma. */
export type RolFirmaOperacion = 'mecanico' | 'operario' | 'supervisor' | 'auditor'

/** Roles que firman el cierre general del formato. */
export type RolFirmaFinal = 'jefe_sector' | 'analista_ing'

/** Cómo se identificó la persona al firmar: cámara (BarcodeScanner) o tipeado/lector USB. */
export type MetodoFirma = 'camara' | 'manual'

export interface EventoOperacion {
  id: string
  tipo: string
  descripcion: string
  hora: string
}

/** Progreso/firmas de una operación puntual, indexado por opKey = `${item}_${codigo}`. */
export interface OperacionFormato {
  h_inicio?: string
  h_fin?: string
  es_man_ins?: boolean
  comentario?: string
  eventos?: EventoOperacion[]
  firma_mecanico?: boolean
  nombre_firma_mecanico?: string
  dni_firma_mecanico?: string
  puesto_firma_mecanico?: string
  hora_firma_mecanico?: string
  metodo_firma_mecanico?: MetodoFirma
  firma_operario?: boolean
  nombre_firma_operario?: string
  dni_firma_operario?: string
  puesto_firma_operario?: string
  hora_firma_operario?: string
  metodo_firma_operario?: MetodoFirma
  firma_supervisor?: boolean
  nombre_firma_supervisor?: string
  dni_firma_supervisor?: string
  puesto_firma_supervisor?: string
  hora_firma_supervisor?: string
  metodo_firma_supervisor?: MetodoFirma
  firma_auditor?: boolean
  nombre_firma_auditor?: string
  dni_firma_auditor?: string
  puesto_firma_auditor?: string
  hora_firma_auditor?: string
  metodo_firma_auditor?: MetodoFirma
}

export interface FormatoInstalacion {
  report_key: string
  estilo_saliente: string
  fecha_inicio: string
  fecha_fin: string
  operaciones_json: Record<string, OperacionFormato>
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
