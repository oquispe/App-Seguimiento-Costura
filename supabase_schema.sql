-- ─── Tablero de Auditorías Finales de Confección ─────────────────────────────
-- Ejecutar en el SQL Editor de Supabase

-- 1. Tabla principal de seguimiento
CREATE TABLE IF NOT EXISTS seguimiento (
  item_key       TEXT PRIMARY KEY,
  cliente        TEXT,
  estilo         TEXT,
  po             TEXT,
  color          TEXT,
  cant_prog      INTEGER,
  externa        TEXT,
  semana         TEXT,
  estado         TEXT NOT NULL DEFAULT 'Pendiente'
                 CHECK (estado IN ('Pendiente','Programada','En proceso','Aprobada','Rechazada','Reprogramada')),
  resultado      TEXT,
  fecha_solicitada DATE,
  fecha_auditoria  DATE,
  solicitado_por TEXT,
  responsable    TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Tabla de comentarios (bitácora)
CREATE TABLE IF NOT EXISTS comentarios (
  id         BIGSERIAL PRIMARY KEY,
  item_key   TEXT NOT NULL REFERENCES seguimiento(item_key) ON DELETE CASCADE,
  autor      TEXT NOT NULL,
  texto      TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Tabla de mapeo de columnas (persistencia de remapeos manuales)
CREATE TABLE IF NOT EXISTS mapeo_columnas (
  fuente  TEXT PRIMARY KEY,
  mapeo   JSONB NOT NULL DEFAULT '{}'
);

-- 4. Índices
CREATE INDEX IF NOT EXISTS idx_comentarios_item_key ON comentarios(item_key);
CREATE INDEX IF NOT EXISTS idx_seguimiento_estado   ON seguimiento(estado);
CREATE INDEX IF NOT EXISTS idx_seguimiento_responsable ON seguimiento(responsable);

-- 5. Trigger para updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_seguimiento_updated_at ON seguimiento;
CREATE TRIGGER trg_seguimiento_updated_at
  BEFORE UPDATE ON seguimiento
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 6. Tabla de carga actual (foto semanal compartida)
CREATE TABLE IF NOT EXISTS carga_actual (
  item_key          TEXT PRIMARY KEY,
  semana            TEXT,
  cliente           TEXT,
  estilo            TEXT,
  po                TEXT,
  color             TEXT,
  cant_prog         INTEGER,
  externa           TEXT,
  fin_entrega       DATE,
  auditoria         DATE,
  auditoria_final   DATE,
  en_estanteria     INTEGER DEFAULT 0,
  en_proceso        INTEGER DEFAULT 0,
  confeccionadas    INTEGER DEFAULT 0,
  linea_costura     INTEGER DEFAULT 0,
  vigente           BOOLEAN NOT NULL DEFAULT TRUE,
  cargado_por       TEXT,
  cargado_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_carga_actual_vigente ON carga_actual(vigente);
CREATE INDEX IF NOT EXISTS idx_carga_actual_semana  ON carga_actual(semana);

-- 7. Snapshots semanales (historial opcional)
CREATE TABLE IF NOT EXISTS snapshots_semana (
  semana      TEXT PRIMARY KEY,
  snapshot    JSONB NOT NULL,
  cargado_por TEXT,
  cargado_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. RLS (Row Level Security)
ALTER TABLE seguimiento      ENABLE ROW LEVEL SECURITY;
ALTER TABLE comentarios      ENABLE ROW LEVEL SECURITY;
ALTER TABLE mapeo_columnas   ENABLE ROW LEVEL SECURITY;
ALTER TABLE carga_actual     ENABLE ROW LEVEL SECURITY;
ALTER TABLE snapshots_semana ENABLE ROW LEVEL SECURITY;

-- Políticas: solo usuarios autenticados
CREATE POLICY "auth_all_seguimiento"     ON seguimiento     FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_comentarios"     ON comentarios     FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_mapeo_columnas"  ON mapeo_columnas  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_carga_actual"    ON carga_actual    FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_snapshots"       ON snapshots_semana FOR ALL TO authenticated USING (true) WITH CHECK (true);
