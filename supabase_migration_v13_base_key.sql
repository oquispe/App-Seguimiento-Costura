-- ─── Migración v13: base_key para seguimiento persistente entre semanas ──────
-- Problema que resuelve: item_key = PO|ESTILO|COLOR|SEMANA cambia cada semana,
-- así que "seguimiento" (estado, compromisos, comentarios) quedaba huérfano
-- cada vez que un ítem avanzaba de semana, aunque siguiera siendo el mismo
-- PO+Estilo+Color. Esta migración introduce base_key = PO|ESTILO|COLOR (sin
-- semana) como identidad persistente de "seguimiento"/"comentarios", separada
-- de la identidad semanal item_key que sigue usando "carga_actual".
--
-- Ejecutar TODO este script de una sola vez (una sola ejecución en el SQL
-- Editor), no por partes — usa una transacción y tablas temporales que no
-- sobreviven entre ejecuciones separadas.

-- ═══ PARTE 0: Diagnóstico de solo lectura (antes de tocar nada) ═══════════════
-- Cuántas filas de "seguimiento" van a colapsar en el mismo base_key
-- (= cuántas tenían datos "huérfanos" por el bug de la semana).
SELECT
  split_part(item_key,'|',1) || '|' || split_part(item_key,'|',2) || '|' || split_part(item_key,'|',3) AS base_key,
  COUNT(*) AS filas_seguimiento
FROM seguimiento
GROUP BY 1
HAVING COUNT(*) > 1
ORDER BY 2 DESC;

BEGIN;

-- ═══ PARTE 1: Agregar columna base_key y respaldarla desde item_key ══════════
ALTER TABLE carga_actual ADD COLUMN IF NOT EXISTS base_key TEXT;
ALTER TABLE seguimiento  ADD COLUMN IF NOT EXISTS base_key TEXT;
ALTER TABLE comentarios  ADD COLUMN IF NOT EXISTS base_key TEXT;

UPDATE carga_actual
SET base_key = split_part(item_key,'|',1) || '|' || split_part(item_key,'|',2) || '|' || split_part(item_key,'|',3)
WHERE base_key IS NULL;

UPDATE seguimiento
SET base_key = split_part(item_key,'|',1) || '|' || split_part(item_key,'|',2) || '|' || split_part(item_key,'|',3)
WHERE base_key IS NULL;

UPDATE comentarios
SET base_key = split_part(item_key,'|',1) || '|' || split_part(item_key,'|',2) || '|' || split_part(item_key,'|',3)
WHERE base_key IS NULL;

-- ═══ PARTE 2: Fusionar compromisos JSONB por área, "más reciente y no vacío gana" ═══
-- Para cada base_key + área (ej. "corte", "costura"), se queda el valor de la
-- fila con mayor updated_at que tenga esa área presente en compromisos — así
-- un compromiso de la semana anterior no se pierde solo porque una fila más
-- nueva (de otra semana) no tocó esa área en particular.
CREATE TEMP TABLE compromisos_merge AS
WITH expandido AS (
  SELECT s.base_key, s.updated_at, kv.key AS area, kv.value AS compromiso
  FROM seguimiento s, jsonb_each(COALESCE(s.compromisos, '{}'::jsonb)) AS kv
),
mejor_por_area AS (
  SELECT DISTINCT ON (base_key, area) base_key, area, compromiso
  FROM expandido
  ORDER BY base_key, area, updated_at DESC
)
SELECT base_key, jsonb_object_agg(area, compromiso) AS compromisos
FROM mejor_por_area
GROUP BY base_key;

-- ═══ PARTE 3: Quitar el FK viejo de comentarios (item_key) para poder
--             borrar filas duplicadas de seguimiento sin CASCADE ═══════════════
ALTER TABLE comentarios DROP CONSTRAINT IF EXISTS comentarios_item_key_fkey;

-- ═══ PARTE 4: Quedarse con UNA fila de seguimiento por base_key
--             (la de mayor updated_at = la edición más reciente) ═════════════
CREATE TEMP TABLE seguimiento_keeper AS
SELECT DISTINCT ON (base_key) item_key, base_key
FROM seguimiento
ORDER BY base_key, updated_at DESC, item_key DESC;

DELETE FROM seguimiento s
WHERE NOT EXISTS (
  SELECT 1 FROM seguimiento_keeper k WHERE k.item_key = s.item_key
);

-- Aplicar los compromisos fusionados sobre la fila que quedó
UPDATE seguimiento s
SET compromisos = cm.compromisos
FROM compromisos_merge cm
WHERE s.base_key = cm.base_key;

-- ═══ PARTE 5: base_key pasa a ser la llave primaria de seguimiento ══════════
ALTER TABLE seguimiento ALTER COLUMN base_key SET NOT NULL;
ALTER TABLE seguimiento DROP CONSTRAINT IF EXISTS seguimiento_pkey;
ALTER TABLE seguimiento ADD CONSTRAINT seguimiento_pkey PRIMARY KEY (base_key);

-- ═══ PARTE 6: comentarios ahora referencia a seguimiento(base_key) ══════════
ALTER TABLE comentarios ALTER COLUMN base_key SET NOT NULL;
ALTER TABLE comentarios
  ADD CONSTRAINT comentarios_base_key_fkey
  FOREIGN KEY (base_key) REFERENCES seguimiento(base_key) ON DELETE CASCADE;

-- ═══ PARTE 7: carga_actual también necesita base_key obligatorio + índice ═══
ALTER TABLE carga_actual ALTER COLUMN base_key SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_carga_actual_base_key ON carga_actual(base_key);
CREATE INDEX IF NOT EXISTS idx_seguimiento_base_key   ON seguimiento(base_key);
CREATE INDEX IF NOT EXISTS idx_comentarios_base_key   ON comentarios(base_key);

COMMIT;

-- ═══ PARTE 8: Verificación (solo lectura, correr después del COMMIT) ═══════
-- Debe devolver 0 filas: ya no debe haber más de una fila de seguimiento por base_key.
-- SELECT base_key, COUNT(*) FROM seguimiento GROUP BY base_key HAVING COUNT(*) > 1;
