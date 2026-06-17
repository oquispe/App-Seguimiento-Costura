-- ─── Migración v3: Ingresos a Acabados separados por calidad (1ra/2da) ────────
-- Ejecutar en el SQL Editor de Supabase (Dashboard → SQL Editor → New query)
--
-- Motivo: el Excel real de Status Cortes no tiene una columna "TOTAL PRENDAS
-- ACABADOS" / "PIEZAS ACABADAS" como se asumía antes. Solo existen
-- "INGRESOS ACABADOS 1RA" e "INGRESOS ACABADOS 2DA". en_acabados y
-- piezas_acabadas pasan a calcularse como la suma de estas dos columnas.

ALTER TABLE carga_actual
  ADD COLUMN IF NOT EXISTS ingresos_acabados_1ra INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ingresos_acabados_2da INTEGER NOT NULL DEFAULT 0;
