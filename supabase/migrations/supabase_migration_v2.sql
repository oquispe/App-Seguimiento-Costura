-- ─── Migración v2: Etapas de producción + Compromisos por área ───────────────
-- Ejecutar en el SQL Editor de Supabase (Dashboard → SQL Editor → New query)

-- 1. Corregir tipo de linea_costura en carga_actual (era INTEGER, debe ser TEXT)
ALTER TABLE carga_actual
  ALTER COLUMN linea_costura TYPE TEXT USING COALESCE(linea_costura::TEXT, '');

ALTER TABLE carga_actual
  ALTER COLUMN linea_costura SET DEFAULT '';

-- 2. Agregar columna de ruta de producción en carga_actual
ALTER TABLE carga_actual
  ADD COLUMN IF NOT EXISTS ruta TEXT NOT NULL DEFAULT '';

-- 3. Agregar etapas de producción en carga_actual
ALTER TABLE carga_actual
  ADD COLUMN IF NOT EXISTS en_bordado          INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bordadas            INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS en_estampado        INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS estampadas          INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS en_transfer         INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS transfer_terminadas INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS en_lavanderia       INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lavadas             INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS en_acabados         INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS piezas_acabadas     INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_requeridas    INTEGER NOT NULL DEFAULT 0;

-- 4. Agregar compromisos por área en seguimiento (JSON flexible)
ALTER TABLE seguimiento
  ADD COLUMN IF NOT EXISTS compromisos JSONB NOT NULL DEFAULT '{}';
