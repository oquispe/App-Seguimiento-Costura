-- v7: Override de fecha de auditoría final editable desde la tabla
ALTER TABLE seguimiento ADD COLUMN IF NOT EXISTS auditoria_final_override DATE;
