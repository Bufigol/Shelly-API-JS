DELIMITER //

DROP FUNCTION IF EXISTS fn_create_new_totales_hora //

CREATE FUNCTION fn_create_new_totales_hora(
    p_hora_local TIMESTAMP
) RETURNS BOOLEAN
DETERMINISTIC
BEGIN
    DECLARE v_id_totales_hora BIGINT;
    DECLARE v_success BOOLEAN DEFAULT FALSE;
    DECLARE v_precio_kwh DECIMAL(10,2);
    
    -- Obtenemos el precio del kWh vigente
    SELECT CAST(valor AS DECIMAL(10,2))
    INTO v_precio_kwh
    FROM sem_configuracion c
    JOIN sem_tipos_parametros tp ON c.tipo_parametro_id = tp.id
    WHERE tp.nombre = 'PRECIO_KWH'
    AND c.activo = 1
    AND c.valido_desde <= p_hora_local
    AND (c.valido_hasta IS NULL OR c.valido_hasta > p_hora_local)
    LIMIT 1;
    
    -- Crear registros iniciales para dispositivos activos que tienen mediciones en la hora
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
    SELECT DISTINCT
        d.shelly_id,
        p_hora_local,
        0, -- energia_activa_total
        0, -- energia_reactiva_total 
        0, -- potencia_maxima
        0, -- potencia_minima
        COALESCE(v_precio_kwh, 0), -- precio_kwh_periodo
        0, -- costo_total
        0, -- lecturas_validas
        0.00  -- calidad_datos
    FROM sem_dispositivos d 
    INNER JOIN sem_mediciones m ON d.shelly_id = m.shelly_id
    WHERE d.activo = 1
    AND m.timestamp_local >= p_hora_local
    AND m.timestamp_local < DATE_ADD(p_hora_local, INTERVAL 1 HOUR)
    AND m.fase = 'TOTAL'
    AND NOT EXISTS (
        SELECT 1 
        FROM sem_totales_hora th 
        WHERE th.shelly_id = d.shelly_id 
        AND th.hora_local = p_hora_local
    )
    GROUP BY d.shelly_id;

    -- Si se insertaron registros, establecer éxito y actualizar valores
    IF ROW_COUNT() > 0 THEN
        SET v_success = TRUE;
        
        -- Actualizamos los valores para todos los registros creados
        UPDATE sem_totales_hora t
        SET 
            energia_activa_total = (
                SELECT COALESCE(SUM(energia_activa), 0)
                FROM sem_mediciones 
                WHERE shelly_id = t.shelly_id 
                AND timestamp_local >= t.hora_local 
                AND timestamp_local < DATE_ADD(t.hora_local, INTERVAL 1 HOUR)
                AND fase = 'TOTAL'
                AND calidad_lectura IN ('NORMAL', 'INTERPOLADA')
            ),
            energia_reactiva_total = (
                SELECT COALESCE(SUM(energia_reactiva), 0)
                FROM sem_mediciones 
                WHERE shelly_id = t.shelly_id 
                AND timestamp_local >= t.hora_local 
                AND timestamp_local < DATE_ADD(t.hora_local, INTERVAL 1 HOUR)
                AND fase = 'TOTAL'
                AND calidad_lectura IN ('NORMAL', 'INTERPOLADA')
            ),
            potencia_maxima = (
                SELECT MAX(potencia_activa)
                FROM sem_mediciones 
                WHERE shelly_id = t.shelly_id 
                AND timestamp_local >= t.hora_local 
                AND timestamp_local < DATE_ADD(t.hora_local, INTERVAL 1 HOUR)
                AND fase = 'TOTAL'
                AND calidad_lectura IN ('NORMAL', 'INTERPOLADA')
            ),
            potencia_minima = (
                SELECT MIN(potencia_activa)
                FROM sem_mediciones 
                WHERE shelly_id = t.shelly_id 
                AND timestamp_local >= t.hora_local 
                AND timestamp_local < DATE_ADD(t.hora_local, INTERVAL 1 HOUR)
                AND fase = 'TOTAL'
                AND calidad_lectura IN ('NORMAL', 'INTERPOLADA')
            ),
            costo_total = energia_activa_total * v_precio_kwh / 1000,
            lecturas_validas = (
                SELECT COUNT(*)
                FROM sem_mediciones 
                WHERE shelly_id = t.shelly_id 
                AND timestamp_local >= t.hora_local 
                AND timestamp_local < DATE_ADD(t.hora_local, INTERVAL 1 HOUR)
                AND fase = 'TOTAL'
                AND calidad_lectura IN ('NORMAL', 'INTERPOLADA')
            ),
            calidad_datos = (
                SELECT (COUNT(*) * 100.0 / (
                    SELECT COALESCE(lecturas_esperadas, 360) 
                    FROM sem_control_calidad 
                    WHERE shelly_id = t.shelly_id 
                    AND inicio_periodo <= t.hora_local 
                    AND fin_periodo > t.hora_local
                    LIMIT 1
                ))
                FROM sem_mediciones 
                WHERE shelly_id = t.shelly_id 
                AND timestamp_local >= t.hora_local 
                AND timestamp_local < DATE_ADD(t.hora_local, INTERVAL 1 HOUR)
                AND fase = 'TOTAL'
                AND calidad_lectura IN ('NORMAL', 'INTERPOLADA')
            ),
            fecha_actualizacion = CURRENT_TIMESTAMP
        WHERE hora_local = p_hora_local;
    END IF;

    RETURN v_success;
END //

DELIMITER ;