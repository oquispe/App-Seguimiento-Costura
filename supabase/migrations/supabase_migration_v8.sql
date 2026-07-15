-- v8: Desglose por OP individual dentro de cada PO+Estilo+Color
-- (una misma combinación puede repartirse entre varias OPs en etapas distintas)
ALTER TABLE carga_actual ADD COLUMN IF NOT EXISTS ops JSONB DEFAULT '[]'::jsonb;
