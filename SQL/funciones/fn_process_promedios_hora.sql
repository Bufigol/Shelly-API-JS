DELIMITER //

DROP FUNCTION IF EXISTS fn_process_promedios_hora //

CREATE FUNCTION fn_process_promedios_hora(
    p_hora_local TIMESTAMP
) RETURNS BOOLEAN
DETERMINISTIC
BEGIN
    DECLARE v_id_promedios_hora BIGINT;
    DECLARE v_success BOOLEAN DEFAULT FALSE;
    DECLARE v_registro_existe BOOLEAN;
    DECLARE v_datos_anteriores JSON;
    DECLARE v_siguiente_hora TIMESTAMP;
    
    -- Definir el intervalo de hora
    SET v_siguiente_hora = DATE_ADD(p_hora_local, INTERVAL 1 HOUR);
    
    -- Verificar si existe el registro
    SELECT COUNT(*) > 0, id INTO v_registro_existe, v_id_promedios_hora
    FROM sem_promedios_hora 
    WHERE hora_local = p_hora_local
    LIMIT 1;

    -- Guardar datos anteriores para auditoría si existe el registro
    IF v_registro_existe THEN
        SELECT JSON_OBJECT(
            'hora_local', hora_local,
            'potencia_activa_promedio', potencia_activa_promedio,
            'potencia_aparente_promedio', potencia_aparente_promedio,
            'factor_potencia_promedio', factor_potencia_promedio,
            'lecturas_validas', lecturas_validas,
            'calidad_datos', calidad_datos
        ) INTO v_datos_anteriores
        FROM sem_promedios_hora 
        WHERE id = v_id_promedios_hora;
    END IF;

    -- Crear o actualizar registro usando UPSERT
    INSERT INTO sem_promedios_hora (
        shelly_id,
        hora_local,
        potencia_activa_promedio,
        potencia_aparente_promedio,
        factor_potencia_promedio,
        lecturas_esperadas,
        lecturas_recibidas,
        lecturas_validas,
        calidad_datos
    )
    SELECT 
        m.shelly_id,
        p_hora_local,
        AVG(m.potencia_activa),
        AVG(m.potencia_aparente),
        AVG(m.factor_potencia),
        (SELECT COALESCE(lecturas_esperadas, 360)
         FROM sem_control_calidad 
         WHERE shelly_id = m.shelly_id 
         AND inicio_periodo <= p_hora_local 
         AND fin_periodo > p_hora_local
         LIMIT 1),
        COUNT(*),
        SUM(CASE WHEN m.calidad_lectura IN ('NORMAL', 'INTERPOLADA') THEN 1 ELSE 0 END),
        (COUNT(*) * 100.0 / (
            SELECT COALESCE(lecturas_esperadas, 360)
            FROM sem_control_calidad 
            WHERE shelly_id = m.shelly_id 
            AND inicio_periodo <= p_hora_local 
            AND fin_periodo > p_hora_local
            LIMIT 1
        ))
    FROM sem_mediciones m
    WHERE m.timestamp_local >= p_hora_local
    AND m.timestamp_local < v_siguiente_hora
    AND m.fase = 'TOTAL'
    GROUP BY m.shelly_id
    ON DUPLICATE KEY UPDATE
        potencia_activa_promedio = VALUES(potencia_activa_promedio),
        potencia_aparente_promedio = VALUES(potencia_aparente_promedio),
        factor_potencia_promedio = VALUES(factor_potencia_promedio),
        lecturas_esperadas = VALUES(lecturas_esperadas),
        lecturas_recibidas = VALUES(lecturas_recibidas),
        lecturas_validas = VALUES(lecturas_validas),
        calidad_datos = VALUES(calidad_datos),
        fecha_actualizacion = CURRENT_TIMESTAMP;

    -- Registrar en auditoría si hubo cambios
    IF ROW_COUNT() > 0 THEN
        INSERT INTO sem_auditoria_detallada (
            tipo_operacion,
            tabla_afectada,
            registro_id,
            usuario,
            datos_anteriores,
            datos_nuevos,
            fecha_operacion,
            direccion_ip,
            aplicacion
        ) VALUES (
            IF(v_registro_existe, 'UPDATE', 'INSERT'),
            'sem_promedios_hora',
            COALESCE(v_id_promedios_hora, LAST_INSERT_ID()),
            'SYSTEM',
            v_datos_anteriores,
            (SELECT JSON_OBJECT(
                'hora_local', hora_local,
                'potencia_activa_promedio', potencia_activa_promedio,
                'potencia_aparente_promedio', potencia_aparente_promedio,
                'factor_potencia_promedio', factor_potencia_promedio,
                'lecturas_validas', lecturas_validas,
                'calidad_datos', calidad_datos
            ) FROM sem_promedios_hora WHERE id = COALESCE(v_id_promedios_hora, LAST_INSERT_ID())),
            CURRENT_TIMESTAMP(6),
            '127.0.0.1',
            'EVENT_actualizacion_totales_y_promedios'
        );
        SET v_success = TRUE;
    END IF;

    RETURN v_success;
END //

DELIMITER ;