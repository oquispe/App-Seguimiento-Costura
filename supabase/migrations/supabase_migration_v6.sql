-- ─── Migración v6: Área Transfer ──────────────────────────────────────────────
-- Ejecutar en el SQL Editor de Supabase (Dashboard → SQL Editor → New query)
--
-- Motivo: el reporte rptReporteSituacionOrdenesNew1 tiene columnas
-- TRANSFER PZA y TRANSFER PDA que no estaban mapeadas. Se agrega
-- en_transfer = TRANSFER PZA + TRANSFER PDA.

ALTER TABLE carga_actual
  ADD COLUMN IF NOT EXISTS en_transfer INTEGER NOT NULL DEFAULT 0;
