-- ─── Migración v12: remapear item_key viejos tras el fix de estilo ───────────
-- Ejecutar en el SQL Editor de Supabase (Dashboard → SQL Editor → New query)
--
-- Contexto: el commit 2645c16 cambió el formato de item_key de
--   PO|COLOR|SEMANA               (3 partes, formato viejo)
-- a
--   PO|ESTILO|COLOR|SEMANA        (4 partes, formato nuevo)
-- para evitar que dos estilos distintos con el mismo PO+Color+Semana
-- colisionaran en un solo item_key. "carga_actual" se reconstruye completa
-- en cada publicación, así que se autorepara. Pero "seguimiento" (donde viven
-- compromisos/estado/resultado/responsable, con item_key como PK) y
-- "comentarios" (FK a seguimiento) NUNCA se tocan al publicar — siguen con
-- el item_key viejo, y al recalcular con el código nuevo el cruce ya no los
-- encuentra: los compromisos/estado parecen "borrados" pero siguen en la
-- base, solo huérfanos bajo la llave anterior.
--
-- Este script:
--   PARTE 1 (solo lectura) — dimensiona el problema, revísala primero.
--   PARTE 2 (escribe)      — remapea automáticamente los casos sin ambigüedad.
--   PARTE 3 (solo lectura) — lista lo que quedó pendiente de revisión manual.

-- ─── PARTE 1: Diagnóstico (no modifica nada) ─────────────────────────────────

-- Mapeo candidato: cada item_key viejo (3 partes) contra carga_actual vigente,
-- igualando PO + Color + Semana e ignorando el Estilo.
CREATE TEMP TABLE mapeo_candidato AS
WITH viejos AS (
  SELECT item_key AS old_key,
         split_part(item_key, '|', 1) AS po,
         split_part(item_key, '|', 2) AS color,
         split_part(item_key, '|', 3) AS semana
  FROM seguimiento
  WHERE array_length(regexp_split_to_array(item_key, '\|'), 1) = 3
),
candidatos AS (
  SELECT v.old_key, c.item_key AS new_key
  FROM viejos v
  JOIN carga_actual c
    ON c.vigente = true
   AND split_part(c.item_key, '|', 1) = v.po
   AND split_part(c.item_key, '|', 3) = v.color
   AND split_part(c.item_key, '|', 4) = v.semana
),
conteo AS (
  SELECT old_key, COUNT(DISTINCT new_key) AS n_estilos
  FROM candidatos
  GROUP BY old_key
)
SELECT c.old_key, c.new_key
FROM candidatos c
JOIN conteo n ON n.old_key = c.old_key AND n.n_estilos = 1;

-- Mapeo final: descarta los que colisionarían con un item_key que YA existe
-- en seguimiento (caso raro: ya se creó un registro fresco bajo la llave nueva).
CREATE TEMP TABLE mapeo_final AS
SELECT m.*
FROM mapeo_candidato m
WHERE NOT EXISTS (SELECT 1 FROM seguimiento s2 WHERE s2.item_key = m.new_key);

-- Resumen: cuántos hay en total, cuántos se resuelven solos, cuántos quedan pendientes.
SELECT
  (SELECT COUNT(*) FROM seguimiento WHERE array_length(regexp_split_to_array(item_key, '\|'), 1) = 3) AS total_item_keys_viejos,
  (SELECT COUNT(*) FROM mapeo_final) AS se_migran_automatico,
  (SELECT COUNT(*) FROM seguimiento WHERE array_length(regexp_split_to_array(item_key, '\|'), 1) = 3)
    - (SELECT COUNT(*) FROM mapeo_final) AS quedan_pendientes_revision;

-- Detalle de los que quedan pendientes (ambiguos: mismo PO+Color+Semana con
-- varios estilos vigentes distintos, o sin match en carga_actual vigente).
SELECT s.item_key, s.cliente, s.estilo, s.po, s.color, s.semana,
       s.estado, s.responsable, s.compromisos
FROM seguimiento s
WHERE array_length(regexp_split_to_array(s.item_key, '\|'), 1) = 3
  AND s.item_key NOT IN (SELECT old_key FROM mapeo_final)
ORDER BY s.po, s.color, s.semana;

-- ─── PARTE 2: Migración (ejecutar solo después de revisar la Parte 1) ────────
-- Descomenta y corre este bloque cuando estés conforme con el resumen de arriba.

-- BEGIN;
--
-- ALTER TABLE comentarios DROP CONSTRAINT IF EXISTS comentarios_item_key_fkey;
--
-- UPDATE comentarios c
-- SET item_key = m.new_key
-- FROM mapeo_final m
-- WHERE c.item_key = m.old_key;
--
-- UPDATE seguimiento s
-- SET item_key = m.new_key
-- FROM mapeo_final m
-- WHERE s.item_key = m.old_key;
--
-- ALTER TABLE comentarios
--   ADD CONSTRAINT comentarios_item_key_fkey
--   FOREIGN KEY (item_key) REFERENCES seguimiento(item_key) ON DELETE CASCADE;
--
-- COMMIT;

-- ─── PARTE 3: Verificación posterior (solo lectura) ──────────────────────────
-- Vuelve a correr después de la Parte 2 — debería devolver 0 filas si todo
-- lo automatizable ya se migró (lo que quede son los casos ambiguos de la
-- Parte 1, a resolver a mano cambiando manualmente el compromiso/estado
-- desde la UI hacia el ítem correcto).

-- SELECT COUNT(*) AS item_keys_viejos_restantes
-- FROM seguimiento
-- WHERE array_length(regexp_split_to_array(item_key, '\|'), 1) = 3;
