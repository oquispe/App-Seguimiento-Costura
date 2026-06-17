-- ─── Migración v4: Orden de fila del Excel ───────────────────────────────────
-- Ejecutar en el SQL Editor de Supabase (Dashboard → SQL Editor → New query)
--
-- Motivo: los ítems dentro de cada semana/cliente deben mostrarse en el mismo
-- orden que tenían en el Excel fuente. Se guarda el índice de fila (0, 1, 2…)
-- al publicar y se usa para ordenar al leer.

ALTER TABLE carga_actual
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
