-- ─── Migración v11: método de identificación en firmas (cámara vs manual) ────
-- Extensión de la Fase 2 del módulo Costura > Requerimiento de Máquina.
-- Ejecutar en el SQL Editor de Supabase (Dashboard → SQL Editor → New query)
--
-- Registra si cada firma se hizo escaneando con la cámara (BarcodeScanner,
-- vía BarcodeDetector nativo) o tipeando el DNI/código a mano (o con lector
-- USB tipo teclado). Las firmas por operación (mecanico/operario/supervisor/
-- auditor) viven dentro de operaciones_json, así que el método se guarda ahí
-- mismo como 'metodo_firma_<rol>'; las firmas finales (jefe_sector/
-- analista_ing) son columnas propias de la tabla, así que necesitan columna
-- nueva cada una.

-- 1. Columnas nuevas para el método de las firmas finales.
ALTER TABLE rm_formato_instalacion
  ADD COLUMN IF NOT EXISTS metodo_firma_jefe_sector  TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS metodo_firma_analista_ing TEXT NOT NULL DEFAULT '';

-- 2. rm_formato_firmar_operacion: agrega p_metodo al final con default 'manual'
--    (mantiene compatible cualquier llamada vieja que no lo mande).
CREATE OR REPLACE FUNCTION rm_formato_firmar_operacion(
  p_report_key TEXT,
  p_op_key TEXT,
  p_tipo TEXT,
  p_nombre TEXT,
  p_dni TEXT,
  p_puesto TEXT,
  p_hora TEXT,
  p_es_man_ins BOOLEAN,
  p_metodo TEXT DEFAULT 'manual'
) RETURNS void AS $$
DECLARE
  v_op JSONB;
  v_new_op JSONB;
  v_es_man_ins BOOLEAN;
  v_tiene_operario BOOLEAN;
  v_tiene_supervisor BOOLEAN;
  v_tiene_auditor BOOLEAN;
  v_h_fin TEXT;
BEGIN
  IF p_tipo NOT IN ('mecanico', 'operario', 'supervisor', 'auditor') THEN
    RAISE EXCEPTION 'Tipo invalido: %', p_tipo;
  END IF;
  IF p_metodo NOT IN ('camara', 'manual') THEN
    RAISE EXCEPTION 'Metodo invalido: %', p_metodo;
  END IF;

  INSERT INTO rm_formato_instalacion (report_key) VALUES (p_report_key)
    ON CONFLICT (report_key) DO NOTHING;

  SELECT COALESCE(operaciones_json -> p_op_key, '{}'::jsonb)
    INTO v_op
    FROM rm_formato_instalacion WHERE report_key = p_report_key FOR UPDATE;

  v_new_op := v_op || jsonb_build_object(
    'firma_' || p_tipo, true,
    'nombre_firma_' || p_tipo, p_nombre,
    'dni_firma_' || p_tipo, p_dni,
    'puesto_firma_' || p_tipo, p_puesto,
    'hora_firma_' || p_tipo, p_hora,
    'metodo_firma_' || p_tipo, p_metodo
  );

  v_es_man_ins := COALESCE((v_op ->> 'es_man_ins')::boolean, false) OR COALESCE(p_es_man_ins, false);
  IF v_es_man_ins THEN
    v_new_op := v_new_op || jsonb_build_object('es_man_ins', true);
  END IF;

  v_h_fin := v_new_op ->> 'h_fin';
  IF v_h_fin IS NULL OR v_h_fin = '' THEN
    v_tiene_operario := COALESCE((v_new_op ->> 'firma_operario')::boolean, false);
    v_tiene_supervisor := COALESCE((v_new_op ->> 'firma_supervisor')::boolean, false);
    v_tiene_auditor := COALESCE((v_new_op ->> 'firma_auditor')::boolean, false);

    IF v_es_man_ins THEN
      IF v_tiene_operario AND v_tiene_supervisor THEN
        v_new_op := v_new_op || jsonb_build_object('h_fin', p_hora);
      END IF;
    ELSE
      IF v_tiene_operario AND v_tiene_supervisor AND v_tiene_auditor THEN
        v_new_op := v_new_op || jsonb_build_object('h_fin', p_hora);
      END IF;
    END IF;
  END IF;

  UPDATE rm_formato_instalacion
    SET operaciones_json = jsonb_set(operaciones_json, ARRAY[p_op_key], v_new_op, true),
        actualizado_at = NOW()
    WHERE report_key = p_report_key;
END;
$$ LANGUAGE plpgsql;

-- 3. rm_formato_firmar_final: agrega p_metodo y lo guarda en la columna nueva.
CREATE OR REPLACE FUNCTION rm_formato_firmar_final(
  p_report_key TEXT,
  p_tipo TEXT,
  p_nombre TEXT,
  p_dni TEXT,
  p_hora TEXT,
  p_metodo TEXT DEFAULT 'manual'
) RETURNS void AS $$
DECLARE
  v_jefe_ok BOOLEAN;
  v_analista_ok BOOLEAN;
  v_fecha_fin TEXT;
BEGIN
  IF p_tipo NOT IN ('jefe_sector', 'analista_ing') THEN
    RAISE EXCEPTION 'Tipo invalido: %', p_tipo;
  END IF;
  IF p_metodo NOT IN ('camara', 'manual') THEN
    RAISE EXCEPTION 'Metodo invalido: %', p_metodo;
  END IF;

  INSERT INTO rm_formato_instalacion (report_key) VALUES (p_report_key)
    ON CONFLICT (report_key) DO NOTHING;

  IF p_tipo = 'jefe_sector' THEN
    UPDATE rm_formato_instalacion
      SET firmas_jefe_sector = true,
          nombre_firma_jefe_sector = p_nombre,
          dni_firma_jefe_sector = p_dni,
          hora_firma_jefe_sector = p_hora,
          metodo_firma_jefe_sector = p_metodo,
          actualizado_at = NOW()
      WHERE report_key = p_report_key;
  ELSE
    UPDATE rm_formato_instalacion
      SET firmas_analista_ing = true,
          nombre_firma_analista_ing = p_nombre,
          dni_firma_analista_ing = p_dni,
          hora_firma_analista_ing = p_hora,
          metodo_firma_analista_ing = p_metodo,
          actualizado_at = NOW()
      WHERE report_key = p_report_key;
  END IF;

  SELECT firmas_jefe_sector, firmas_analista_ing, fecha_fin
    INTO v_jefe_ok, v_analista_ok, v_fecha_fin
    FROM rm_formato_instalacion WHERE report_key = p_report_key;

  IF v_jefe_ok AND v_analista_ok AND v_fecha_fin = '' THEN
    UPDATE rm_formato_instalacion
      SET fecha_fin = to_char(NOW(), 'DD/MM/YYYY')
      WHERE report_key = p_report_key;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 4. rm_formato_limpiar_firmas: también resetea el método al limpiar.
CREATE OR REPLACE FUNCTION rm_formato_limpiar_firmas(p_report_key TEXT) RETURNS void AS $$
BEGIN
  UPDATE rm_formato_instalacion
    SET firmas_jefe_sector = false, firmas_analista_ing = false,
        nombre_firma_jefe_sector = '', dni_firma_jefe_sector = '', hora_firma_jefe_sector = '', metodo_firma_jefe_sector = '',
        nombre_firma_analista_ing = '', dni_firma_analista_ing = '', hora_firma_analista_ing = '', metodo_firma_analista_ing = '',
        fecha_fin = '', actualizado_at = NOW()
    WHERE report_key = p_report_key;
END;
$$ LANGUAGE plpgsql;

-- 5. Privilegios sobre las nuevas signatures (mismo patrón que v9/v10).
REVOKE ALL ON FUNCTION rm_formato_firmar_operacion(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION rm_formato_firmar_final(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION rm_formato_firmar_operacion(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION rm_formato_firmar_final(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
