DELIMITER //

CREATE DEFINER=`root`@`localhost` FUNCTION `fn_process_totales_dia`(
    p_fecha_local DATE
) RETURNS tinyint(1)
    DETERMINISTIC
BEGIN
    DECLARE v_id_totales_dia BIGINT;
    DECLARE v_success BOOLEAN DEFAULT FALSE;
    DECLARE v_precio_kwh DECIMAL(10,2);
    DECLARE v_registro_existe BOOLEAN;
    DECLARE v_datos_anteriores JSON;
    DECLARE v_siguiente_dia DATE;
    DECLARE v_intervalo_segundos INT DEFAULT 10;
    
    -- Definir el intervalo del día
    SET v_siguiente_dia = DATE_ADD(p_fecha_local, INTERVAL 1 DAY);
    
    -- Verificar si existe el registro
    SELECT EXISTS(
        SELECT 1 
        FROM sem_totales_dia 
        WHERE fecha_local = p_fecha_local
        LIMIT 1
    ) INTO v_registro_existe;
    
    -- Si existe, obtener el ID
    IF v_registro_existe THEN
        SELECT id INTO v_id_totales_dia
        FROM sem_totales_dia 
        WHERE fecha_local = p_fecha_local
        LIMIT 1;
    END IF;
    
    -- Obtener precio kWh vigente
    SELECT CAST(valor AS DECIMAL(10,2))
    INTO v_precio_kwh
    FROM sem_configuracion c
    JOIN sem_tipos_parametros tp ON c.tipo_parametro_id = tp.id
    WHERE tp.nombre = 'PRECIO_KWH'
    AND c.activo = 1
    AND c.valido_desde <= p_fecha_local
    AND (c.valido_hasta IS NULL OR c.valido_hasta > p_fecha_local)
    LIMIT 1;

    -- Guardar datos anteriores para auditoría si existe el registro
    IF v_registro_existe THEN
        SELECT JSON_OBJECT(
            'fecha_local', fecha_local,
            'energia_activa_total', energia_activa_total,
            'energia_reactiva_total', energia_reactiva_total,
            'potencia_maxima', potencia_maxima,
            'potencia_minima', potencia_minima,
            'precio_kwh_promedio', precio_kwh_promedio,
            'costo_total', costo_total,
            'horas_con_datos', horas_con_datos
        ) INTO v_datos_anteriores
        FROM sem_totales_dia 
        WHERE id = v_id_totales_dia;
    END IF;

    -- Crear o actualizar registro usando UPSERT
    INSERT INTO sem_totales_dia (
        shelly_id,
        fecha_local,
        energia_activa_total,
        energia_reactiva_total,
        potencia_maxima,
        potencia_minima,
        precio_kwh_promedio,
        costo_total,
        horas_con_datos
    )
    SELECT 
        m.shelly_id,
        p_fecha_local,
       -- Cálculo corregido de energía activa en kWh: (SUM(potencia_activa) * intervalo_segundos) / (3600 * 1000)
        (SUM(m.potencia_activa * v_intervalo_segundos) / (3600 * 1000)) AS energia_activa_total,
        -- Cálculo corregido de energía reactiva en kvarh:  (SUM(potencia_aparente * SQRT(1 - POWER(factor_potencia, 2))) * intervalo_segundos) / (3600 * 1000)
         (SUM(m.potencia_aparente * v_intervalo_segundos * SQRT(1 - POWER(m.factor_potencia, 2))) / (3600 * 1000)) as energia_reactiva_total,
        MAX(m.potencia_activa) as potencia_maxima,
        MIN(m.potencia_activa) as potencia_minima,
        v_precio_kwh as precio_kwh_promedio,
        -- Cálculo del costo basado en la energía activa corregida
        (SUM(m.potencia_activa * v_intervalo_segundos) / (3600 * 1000)) * v_precio_kwh as costo_total,
        COUNT(DISTINCT HOUR(m.timestamp_local)) as horas_con_datos
    FROM sem_mediciones m
    WHERE m.timestamp_local >= p_fecha_local
    AND m.timestamp_local < v_siguiente_dia
    AND m.fase = 'TOTAL'
    AND m.calidad_lectura IN ('NORMAL', 'INTERPOLADA')
    GROUP BY m.shelly_id
    ON DUPLICATE KEY UPDATE
        energia_activa_total = VALUES(energia_activa_total),
        energia_reactiva_total = VALUES(energia_reactiva_total),
        potencia_maxima = VALUES(potencia_maxima),
        potencia_minima = VALUES(potencia_minima),
        precio_kwh_promedio = VALUES(precio_kwh_promedio),
        costo_total = VALUES(costo_total),
        horas_con_datos = VALUES(horas_con_datos),
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
            'sem_totales_dia',
            COALESCE(v_id_totales_dia, LAST_INSERT_ID()),
            'SYSTEM',
            v_datos_anteriores,
             (SELECT JSON_OBJECT(
                'fecha_local', fecha_local,
                'energia_activa_total', energia_activa_total,
                'energia_reactiva_total', energia_reactiva_total,
                 'potencia_maxima', potencia_maxima,
                 'potencia_minima', potencia_minima,
                'precio_kwh_promedio', precio_kwh_promedio,
                'costo_total', costo_total,
                'horas_con_datos', horas_con_datos,
                'estado_actualizacion', 'EXITOSO'
            ) FROM sem_totales_dia WHERE id = COALESCE(v_id_totales_dia, LAST_INSERT_ID())),
            CURRENT_TIMESTAMP(6),
            '127.0.0.1',
            'EVENT_actualizacion_totales_diarios'
        );
        SET v_success = TRUE;
    END IF;

    RETURN v_success;
END //