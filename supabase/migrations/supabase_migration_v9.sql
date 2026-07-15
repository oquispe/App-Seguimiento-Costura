-- ─── Migración v9: Módulo Costura > Requerimiento de Máquina ─────────────────
-- Fase 1: carga de balance de línea (Excel) + directorio de empleados.
-- Ejecutar en el SQL Editor de Supabase (Dashboard → SQL Editor → New query)

-- 1. Reportes de balance de línea (uno por archivo Excel cargado)
CREATE TABLE IF NOT EXISTS rm_reports (
  report_key                 TEXT PRIMARY KEY,
  archivo_original           TEXT NOT NULL,
  estilo_cliente              TEXT,
  cliente                     TEXT,
  tarifado                    TEXT,
  varia_tarifado               TEXT,
  d_prenda                    TEXT,
  op                          TEXT,
  usuario_prenda               TEXT,
  tela                        TEXT,
  linea                       TEXT,
  nro_operarios                TEXT,
  tiempo_std                  TEXT,
  eficiencia                  TEXT,
  cuota_diaria                 TEXT,
  cuota_diaria_minuto           TEXT,
  minutos_disponibles           TEXT,
  minutos_disponibles_total     TEXT,
  minutos_libres_total          TEXT,
  operarios_json               JSONB NOT NULL DEFAULT '[]',
  estado                       TEXT NOT NULL DEFAULT 'NO CONSOLIDADO',
  cargado_por                  TEXT,
  cargado_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rm_reports_linea  ON rm_reports(linea);
CREATE INDEX IF NOT EXISTS idx_rm_reports_estilo ON rm_reports(estilo_cliente);
CREATE INDEX IF NOT EXISTS idx_rm_reports_op     ON rm_reports(op);

-- 2. Directorio de empleados (registros.xlsx) — usado para el flujo de
--    confirmación de identidad de la Fase 2 (QR/DNI).
CREATE TABLE IF NOT EXISTS rm_empleados (
  dni             TEXT PRIMARY KEY,
  nombre_completo TEXT,
  ocupacion       TEXT,
  centro_costo    TEXT,
  codigo          TEXT,
  actualizado_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rm_empleados_codigo ON rm_empleados(codigo);

-- 3. RLS (mismo patrón permisivo que el resto de las tablas del proyecto)
ALTER TABLE rm_reports   ENABLE ROW LEVEL SECURITY;
ALTER TABLE rm_empleados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all_rm_reports"   ON rm_reports   FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_rm_empleados" ON rm_empleados FOR ALL TO authenticated USING (true) WITH CHECK (true);
