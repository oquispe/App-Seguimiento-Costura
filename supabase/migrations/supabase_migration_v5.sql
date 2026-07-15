-- ─── Migración v5: Posición en producción (modelo nuevo) ──────────────────────
-- Ejecutar en el SQL Editor de Supabase (Dashboard → SQL Editor → New query)
--
-- Motivo: el parser de cortes cambió de un modelo de flujo (entradas/salidas
-- por etapa) a un modelo de posición (foto actual de dónde están las prendas).
-- El nuevo archivo fuente es rptReporteSituacionOrdenesNew1.xlsm.
-- Las columnas antiguas se conservan para no perder historial; las nuevas
-- se agregan con IF NOT EXISTS.

ALTER TABLE carga_actual
  -- Orden de producción (reemplaza a linea_costura que era TEXT)
  ADD COLUMN IF NOT EXISTS op               TEXT    NOT NULL DEFAULT '',
  -- Posición actual de las prendas por área
  ADD COLUMN IF NOT EXISTS en_corte         INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS en_costura       INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS en_estampado_ext INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS en_costura_lineas INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS en_acabado       INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS apt              INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS exportado        INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS porc_exp         NUMERIC(6,2) NOT NULL DEFAULT 0;

-- Nota: en_bordado, en_estampado, en_lavanderia y total_requeridas ya existen
-- desde la migración v2 y se reutilizan directamente.
