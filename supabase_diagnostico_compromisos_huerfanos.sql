-- ─── Diagnóstico: compromisos/estado "huérfanos" tras re-subir Semanas/PGO/Status ──
-- Ejecutar en el SQL Editor de Supabase. Todo de solo lectura, no modifica nada.
--
-- Busca filas de "seguimiento" que SÍ tienen datos guardados (compromiso,
-- estado distinto de Pendiente, o responsable) pero cuyo item_key YA NO
-- existe en carga_actual vigente=true — es decir, el cruce actual no los
-- va a encontrar y por eso se ven "en blanco" en el dashboard.

-- 1. Cuántos hay en total
SELECT COUNT(*) AS huerfanos_con_datos
FROM seguimiento s
WHERE (s.compromisos IS NOT NULL AND s.compromisos::text <> '{}')
   OR s.estado <> 'Pendiente'
   OR s.responsable IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM carga_actual c
    WHERE c.item_key = s.item_key AND c.vigente = true
  );

-- 2. Detalle de cada uno, con el mejor candidato de coincidencia actual
--    (mismo PO + Semana, ignorando color/estilo) para ver qué tan cerca
--    está el item_key real de lo que hay guardado vigente.
WITH huerfanos AS (
  SELECT s.*
  FROM seguimiento s
  WHERE ((s.compromisos IS NOT NULL AND s.compromisos::text <> '{}')
     OR s.estado <> 'Pendiente'
     OR s.responsable IS NOT NULL)
    AND NOT EXISTS (
      SELECT 1 FROM carga_actual c
      WHERE c.item_key = s.item_key AND c.vigente = true
    )
)
SELECT
  h.item_key            AS item_key_guardado,
  h.po, h.estilo, h.color, h.semana,
  h.estado, h.responsable, h.compromisos,
  (
    SELECT string_agg(c.item_key, ' | ')
    FROM carga_actual c
    WHERE c.vigente = true
      AND split_part(c.item_key, '|', 1) = split_part(h.item_key, '|', 1) -- mismo PO
      AND split_part(c.item_key, '|', 4) = split_part(h.item_key, '|', 4) -- misma semana
  ) AS candidatos_mismo_po_y_semana
FROM huerfanos h
ORDER BY h.po, h.semana;
