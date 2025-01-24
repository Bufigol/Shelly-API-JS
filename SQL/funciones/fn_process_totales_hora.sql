DELIMITER //

DROP FUNCTION IF EXISTS fn_process_totales_hora //

CREATE FUNCTION fn_process_totales_hora(
    p_hora_local TIMESTAMP
) RETURNS BOOLEAN
DETERMINISTIC
BEGIN
    DECLARE v_id_totales_hora BIGINT;
    DECLARE v_success BOOLEAN DEFAULT FALSE;
    DECLARE v_precio_kwh DECIMAL(10,2);
    DECLARE v_registro_existe BOOLEAN;
    DECLARE v_datos_anteriores JSON;
    DECLARE v_siguiente_hora TIMESTAMP;
    DECLARE v_intervalo_segundos INT DEFAULT 10;  -- Intervalo entre mediciones
    
    -- Definir el intervalo de hora
    SET v_siguiente_hora = DATE_ADD(p_hora_local, INTERVAL 1 HOUR);
    
    -- Verificar si existe el registro - Corregida la consulta
    SELECT EXISTS(
        SELECT 1 
        FROM sem_totales_hora 
        WHERE hora_local = p_hora_local
        LIMIT 1
    ) INTO v_registro_existe;
    
    -- Si existe, obtener el ID
    IF v_registro_existe THEN
        SELECT id INTO v_id_totales_hora
        FROM sem_totales_hora 
        WHERE hora_local = p_hora_local
        LIMIT 1;
    END IF;
    
    -- Obtener precio kWh vigente
    SELECT CAST(valor AS DECIMAL(10,2))
    INTO v_precio_kwh
    FROM sem_configuracion c
    JOIN sem_tipos_parametros tp ON c.tipo_parametro_id = tp.id
    WHERE tp.nombre = 'PRECIO_KWH'
    AND c.activo = 1
    AND c.valido_desde <= p_hora_local
    AND (c.valido_hasta IS NULL OR c.valido_hasta > p_hora_local)
    LIMIT 1;

    -- Guardar datos anteriores para auditoría si existe el registro
    IF v_registro_existe THEN
        SELECT JSON_OBJECT(
            'hora_local', hora_local,
            'energia_activa_total', energia_activa_total,
            'energia_reactiva_total', energia_reactiva_total,
            'precio_kwh_periodo', precio_kwh_periodo,
            'costo_total', costo_total,
            'lecturas_validas', lecturas_validas,
            'calidad_datos', calidad_datos
        ) INTO v_datos_anteriores
        FROM sem_totales_hora 
        WHERE id = v_id_totales_hora;
    END IF;

    -- Crear o actualizar registro usando UPSERT
    INSERT INTO sem_totales_hora (
        shelly_id,
        hora_local,
        energia_activa_total,
        energia_reactiva_total,
        potencia_maxima,
        potencia_minima,
        precio_kwh_periodo,
        costo_total,
        lecturas_validas,
        calidad_datos
    )
    SELECT 
        m.shelly_id,
        p_hora_local,
        -- Cálculo corregido de energía activa en kWh: (potencia * intervalo_segundos) / (3600 * 1000)
        (SUM(m.potencia_activa * v_intervalo_segundos) / (3600 * 1000)) as energia_activa_total,
        -- Cálculo corregido de energía reactiva en kvarh
        (SUM(m.potencia_aparente * v_intervalo_segundos * SQRT(1 - POWER(m.factor_potencia, 2))) / (3600 * 1000)) as energia_reactiva_total,
        MAX(m.potencia_activa) as potencia_maxima,
        MIN(m.potencia_activa) as potencia_minima,
        v_precio_kwh as precio_kwh_periodo,
        -- Cálculo del costo basado en la energía activa corregida
        (SUM(m.potencia_activa * v_intervalo_segundos) / (3600 * 1000)) * v_precio_kwh as costo_total,
        COUNT(*) as lecturas_validas,
        (COUNT(*) * 100.0 / (
            SELECT COALESCE(lecturas_esperadas, 360)
            FROM sem_control_calidad 
            WHERE shelly_id = m.shelly_id 
            AND inicio_periodo <= p_hora_local 
            AND fin_periodo > p_hora_local
            LIMIT 1
        )) as calidad_datos
    FROM sem_mediciones m
    WHERE m.timestamp_local >= p_hora_local
    AND m.timestamp_local < v_siguiente_hora
    AND m.fase = 'TOTAL'
    AND m.calidad_lectura IN ('NORMAL', 'INTERPOLADA')
    GROUP BY m.shelly_id
    ON DUPLICATE KEY UPDATE
        energia_activa_total = VALUES(energia_activa_total),
        energia_reactiva_total = VALUES(energia_reactiva_total),
        potencia_maxima = VALUES(potencia_maxima),
        potencia_minima = VALUES(potencia_minima),
        precio_kwh_periodo = VALUES(precio_kwh_periodo),
        costo_total = VALUES(costo_total),
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
            'sem_totales_hora',
            COALESCE(v_id_totales_hora, LAST_INSERT_ID()),
            'SYSTEM',
            v_datos_anteriores,
            (SELECT JSON_OBJECT(
                'hora_local', hora_local,
                'energia_activa_total', energia_activa_total,
                'energia_reactiva_total', energia_reactiva_total,
                'precio_kwh_periodo', precio_kwh_periodo,
                'costo_total', costo_total,
                'estado_actualizacion', 'EXITOSO'
            ) FROM sem_totales_hora WHERE id = COALESCE(v_id_totales_hora, LAST_INSERT_ID())),
            CURRENT_TIMESTAMP(6),
            '127.0.0.1',
            'EVENT_actualizacion_totales_y_promedios'
        );
        SET v_success = TRUE;
    END IF;

    RETURN v_success;
END //

DELIMITER ;