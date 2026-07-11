-- ─── Migración v10: Formato de Instalación (QR + firmas) ─────────────────────
-- Fase 2 del módulo Costura > Requerimiento de Máquina.
-- Ejecutar en el SQL Editor de Supabase (Dashboard → SQL Editor → New query)
--
-- Diseño: en el Python original (Proyecto_Balance/Balance/server.py) el merge
-- no-destructivo de operaciones_json y el cálculo de H.FIN ocurren en el backend
-- Flask antes de escribir a SQLite. Acá no hay backend propio (el cliente habla
-- directo con Supabase), así que esa lógica se replica como funciones Postgres
-- (RPC) para que el merge sea atómico: varias personas pueden firmar la misma
-- operación desde dispositivos distintos casi al mismo tiempo (operario en su
-- celular, supervisor en el suyo), y un read-modify-write hecho en JS tendría
-- condición de carrera entre esos dispositivos.

-- 1. Tabla principal. report_key = mismo report_key de rm_reports (relación 1:1
--    con el balance ya cargado; a diferencia del original no hace falta
--    reconstruir formato_key = op_estilo_filename porque report_key ya es único).
CREATE TABLE IF NOT EXISTS rm_formato_instalacion (
  report_key                   TEXT PRIMARY KEY REFERENCES rm_reports(report_key) ON DELETE CASCADE,
  estilo_saliente               TEXT NOT NULL DEFAULT '',
  fecha_inicio                  TEXT NOT NULL DEFAULT '',
  fecha_fin                     TEXT NOT NULL DEFAULT '',
  operaciones_json              JSONB NOT NULL DEFAULT '{}',
  firmas_jefe_sector            BOOLEAN NOT NULL DEFAULT false,
  firmas_analista_ing           BOOLEAN NOT NULL DEFAULT false,
  nombre_firma_jefe_sector      TEXT NOT NULL DEFAULT '',
  dni_firma_jefe_sector         TEXT NOT NULL DEFAULT '',
  hora_firma_jefe_sector        TEXT NOT NULL DEFAULT '',
  nombre_firma_analista_ing     TEXT NOT NULL DEFAULT '',
  dni_firma_analista_ing        TEXT NOT NULL DEFAULT '',
  hora_firma_analista_ing       TEXT NOT NULL DEFAULT '',
  comentarios_generales         TEXT NOT NULL DEFAULT '',
  actualizado_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE rm_formato_instalacion ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_rm_formato_instalacion" ON rm_formato_instalacion FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE rm_formato_instalacion;

-- 2. Registrar H.INICIO de una operación (botón "⏱ Iniciar").
--    fecha_inicio general del formato se fija solo con el primer H.INICIO de
--    toda su vida (server.py:1298-1356).
CREATE OR REPLACE FUNCTION rm_formato_registrar_h_inicio(
  p_report_key TEXT,
  p_op_key TEXT,
  p_h_inicio TEXT
) RETURNS void AS $$
DECLARE
  v_op JSONB;
  v_es_primera BOOLEAN;
BEGIN
  INSERT INTO rm_formato_instalacion (report_key) VALUES (p_report_key)
    ON CONFLICT (report_key) DO NOTHING;

  SELECT COALESCE(operaciones_json -> p_op_key, '{}'::jsonb), (fecha_inicio = '')
    INTO v_op, v_es_primera
    FROM rm_formato_instalacion WHERE report_key = p_report_key FOR UPDATE;

  UPDATE rm_formato_instalacion
    SET operaciones_json = jsonb_set(operaciones_json, ARRAY[p_op_key], v_op || jsonb_build_object('h_inicio', p_h_inicio), true),
        fecha_inicio = CASE WHEN v_es_primera THEN p_h_inicio ELSE fecha_inicio END,
        actualizado_at = NOW()
    WHERE report_key = p_report_key;
END;
$$ LANGUAGE plpgsql;

-- 3. Firma de un rol operativo sobre una operación (mecanico | operario |
--    supervisor | auditor). Calcula H.FIN atómicamente:
--    - MAN/INS: se completa cuando firman operario + supervisor.
--    - Resto: se completa cuando firman operario + supervisor + auditor.
--    - mecanico nunca participa en la condición de H.FIN (server.py:1412-1441).
--    A diferencia del original (que detecta es_man_ins de forma inconsistente
--    entre cliente/servidor, ver hallazgo del agente de exploración), acá el
--    cliente SIEMPRE manda p_es_man_ins explícito en cada firma, evitando la
--    condición de carrera del Python original.
CREATE OR REPLACE FUNCTION rm_formato_firmar_operacion(
  p_report_key TEXT,
  p_op_key TEXT,
  p_tipo TEXT,
  p_nombre TEXT,
  p_dni TEXT,
  p_puesto TEXT,
  p_hora TEXT,
  p_es_man_ins BOOLEAN
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
    'hora_firma_' || p_tipo, p_hora
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

-- 4. Comentario de una operación (autoguardado al perder foco).
CREATE OR REPLACE FUNCTION rm_formato_comentario_operacion(
  p_report_key TEXT,
  p_op_key TEXT,
  p_comentario TEXT
) RETURNS void AS $$
DECLARE
  v_op JSONB;
BEGIN
  INSERT INTO rm_formato_instalacion (report_key) VALUES (p_report_key)
    ON CONFLICT (report_key) DO NOTHING;

  SELECT COALESCE(operaciones_json -> p_op_key, '{}'::jsonb)
    INTO v_op
    FROM rm_formato_instalacion WHERE report_key = p_report_key FOR UPDATE;

  UPDATE rm_formato_instalacion
    SET operaciones_json = jsonb_set(operaciones_json, ARRAY[p_op_key], v_op || jsonb_build_object('comentario', p_comentario), true),
        actualizado_at = NOW()
    WHERE report_key = p_report_key;
END;
$$ LANGUAGE plpgsql;

-- 5. Firma final (jefe_sector | analista_ing). Cuando ambas están completas,
--    fija fecha_fin (solo fecha, sin hora, igual que el original) una única vez.
CREATE OR REPLACE FUNCTION rm_formato_firmar_final(
  p_report_key TEXT,
  p_tipo TEXT,
  p_nombre TEXT,
  p_dni TEXT,
  p_hora TEXT
) RETURNS void AS $$
DECLARE
  v_jefe_ok BOOLEAN;
  v_analista_ok BOOLEAN;
  v_fecha_fin TEXT;
BEGIN
  IF p_tipo NOT IN ('jefe_sector', 'analista_ing') THEN
    RAISE EXCEPTION 'Tipo invalido: %', p_tipo;
  END IF;

  INSERT INTO rm_formato_instalacion (report_key) VALUES (p_report_key)
    ON CONFLICT (report_key) DO NOTHING;

  IF p_tipo = 'jefe_sector' THEN
    UPDATE rm_formato_instalacion
      SET firmas_jefe_sector = true,
          nombre_firma_jefe_sector = p_nombre,
          dni_firma_jefe_sector = p_dni,
          hora_firma_jefe_sector = p_hora,
          actualizado_at = NOW()
      WHERE report_key = p_report_key;
  ELSE
    UPDATE rm_formato_instalacion
      SET firmas_analista_ing = true,
          nombre_firma_analista_ing = p_nombre,
          dni_firma_analista_ing = p_dni,
          hora_firma_analista_ing = p_hora,
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

-- 6. Resetear firmas finales (equivalente a /limpiar-firmas) — no toca las
--    firmas por operación.
CREATE OR REPLACE FUNCTION rm_formato_limpiar_firmas(p_report_key TEXT) RETURNS void AS $$
BEGIN
  UPDATE rm_formato_instalacion
    SET firmas_jefe_sector = false, firmas_analista_ing = false,
        nombre_firma_jefe_sector = '', dni_firma_jefe_sector = '', hora_firma_jefe_sector = '',
        nombre_firma_analista_ing = '', dni_firma_analista_ing = '', hora_firma_analista_ing = '',
        fecha_fin = '', actualizado_at = NOW()
    WHERE report_key = p_report_key;
END;
$$ LANGUAGE plpgsql;

-- 7. Guardar campos generales editables (estilo_saliente, comentarios). Un
--    parámetro NULL preserva el valor existente; '' explícito lo vacía.
CREATE OR REPLACE FUNCTION rm_formato_guardar_generales(
  p_report_key TEXT,
  p_estilo_saliente TEXT DEFAULT NULL,
  p_comentarios_generales TEXT DEFAULT NULL
) RETURNS void AS $$
BEGIN
  INSERT INTO rm_formato_instalacion (report_key) VALUES (p_report_key)
    ON CONFLICT (report_key) DO NOTHING;

  UPDATE rm_formato_instalacion
    SET estilo_saliente = COALESCE(p_estilo_saliente, estilo_saliente),
        comentarios_generales = COALESCE(p_comentarios_generales, comentarios_generales),
        actualizado_at = NOW()
    WHERE report_key = p_report_key;
END;
$$ LANGUAGE plpgsql;

-- 8. Eventos operativos (paradas de máquina, etc.) — upsert por id y delete.
CREATE OR REPLACE FUNCTION rm_formato_evento_upsert(
  p_report_key TEXT,
  p_op_key TEXT,
  p_evento JSONB
) RETURNS void AS $$
DECLARE
  v_op JSONB;
  v_eventos JSONB;
  v_evento_id TEXT;
  v_nuevo_arr JSONB := '[]'::jsonb;
  v_item JSONB;
  v_found BOOLEAN := false;
BEGIN
  INSERT INTO rm_formato_instalacion (report_key) VALUES (p_report_key)
    ON CONFLICT (report_key) DO NOTHING;

  SELECT COALESCE(operaciones_json -> p_op_key, '{}'::jsonb)
    INTO v_op
    FROM rm_formato_instalacion WHERE report_key = p_report_key FOR UPDATE;

  v_eventos := COALESCE(v_op -> 'eventos', '[]'::jsonb);
  v_evento_id := p_evento ->> 'id';

  FOR v_item IN SELECT * FROM jsonb_array_elements(v_eventos) LOOP
    IF v_item ->> 'id' = v_evento_id THEN
      v_nuevo_arr := v_nuevo_arr || jsonb_build_array(p_evento);
      v_found := true;
    ELSE
      v_nuevo_arr := v_nuevo_arr || jsonb_build_array(v_item);
    END IF;
  END LOOP;

  IF NOT v_found THEN
    v_nuevo_arr := v_nuevo_arr || jsonb_build_array(p_evento);
  END IF;

  UPDATE rm_formato_instalacion
    SET operaciones_json = jsonb_set(operaciones_json, ARRAY[p_op_key], v_op || jsonb_build_object('eventos', v_nuevo_arr), true),
        actualizado_at = NOW()
    WHERE report_key = p_report_key;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION rm_formato_evento_delete(
  p_report_key TEXT,
  p_op_key TEXT,
  p_evento_id TEXT
) RETURNS void AS $$
DECLARE
  v_op JSONB;
  v_eventos JSONB;
  v_nuevo_arr JSONB := '[]'::jsonb;
  v_item JSONB;
BEGIN
  SELECT COALESCE(operaciones_json -> p_op_key, '{}'::jsonb)
    INTO v_op
    FROM rm_formato_instalacion WHERE report_key = p_report_key FOR UPDATE;

  v_eventos := COALESCE(v_op -> 'eventos', '[]'::jsonb);

  FOR v_item IN SELECT * FROM jsonb_array_elements(v_eventos) LOOP
    IF v_item ->> 'id' != p_evento_id THEN
      v_nuevo_arr := v_nuevo_arr || jsonb_build_array(v_item);
    END IF;
  END LOOP;

  UPDATE rm_formato_instalacion
    SET operaciones_json = jsonb_set(operaciones_json, ARRAY[p_op_key], v_op || jsonb_build_object('eventos', v_nuevo_arr), true),
        actualizado_at = NOW()
    WHERE report_key = p_report_key;
END;
$$ LANGUAGE plpgsql;

-- 9. Privilegios: solo usuarios autenticados pueden ejecutar estas funciones
--    (mismo patrón que la RLS del resto de las tablas del proyecto).
REVOKE ALL ON FUNCTION rm_formato_registrar_h_inicio(TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION rm_formato_firmar_operacion(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION rm_formato_comentario_operacion(TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION rm_formato_firmar_final(TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION rm_formato_limpiar_firmas(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION rm_formato_guardar_generales(TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION rm_formato_evento_upsert(TEXT, TEXT, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION rm_formato_evento_delete(TEXT, TEXT, TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION rm_formato_registrar_h_inicio(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION rm_formato_firmar_operacion(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION rm_formato_comentario_operacion(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION rm_formato_firmar_final(TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION rm_formato_limpiar_firmas(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION rm_formato_guardar_generales(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION rm_formato_evento_upsert(TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION rm_formato_evento_delete(TEXT, TEXT, TEXT) TO authenticated;
