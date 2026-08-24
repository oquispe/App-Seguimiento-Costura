-- v14: Líneas de costura (status.xlsm / hoja StatusCorte) y compromiso del
-- Jefe de Sector por línea. Aditivo, no destructivo — seguro de re-ejecutar.

ALTER TABLE carga_actual ADD COLUMN IF NOT EXISTS lineas JSONB DEFAULT '[]';
ALTER TABLE seguimiento  ADD COLUMN IF NOT EXISTS compromisos_linea JSONB DEFAULT '{}';
