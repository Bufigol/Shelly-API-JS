DELIMITER //

CREATE FUNCTION fn_actualizar_totales_hora(
    p_id_totales_hora BIGINT,
    p_hora_local TIMESTAMP
) RETURNS BOOLEAN
DETERMINISTIC
BEGIN
    DECLARE v_success BOOLEAN DEFAULT FALSE;
    DECLARE v_siguiente_hora TIMESTAMP;
    DECLARE v_precio_kwh DECIMAL(10,2);
    
    -- Calculamos la siguiente hora para el intervalo
    SET v_siguiente_hora = DATE_ADD(p_hora_local, INTERVAL 1 HOUR);
    
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
    
    -- Actualizar los totales
    UPDATE sem_totales_hora t
    SET 
        energia_activa_total = (
            SELECT SUM(energia_activa)
            FROM sem_mediciones 
            WHERE shelly_id = t.shelly_id 
            AND timestamp_local >= p_hora_local 
            AND timestamp_local < v_siguiente_hora
            AND fase = 'TOTAL'
            AND calidad_lectura IN ('NORMAL', 'INTERPOLADA')
        ),
        energia_reactiva_total = (
            SELECT SUM(energia_reactiva)
            FROM sem_mediciones 
            WHERE shelly_id = t.shelly_id 
            AND timestamp_local >= p_hora_local 
            AND timestamp_local < v_siguiente_hora
            AND fase = 'TOTAL'
            AND calidad_lectura IN ('NORMAL', 'INTERPOLADA')
        ),
        potencia_maxima = (
            SELECT MAX(potencia_activa)
            FROM sem_mediciones 
            WHERE shelly_id = t.shelly_id 
            AND timestamp_local >= p_hora_local 
            AND timestamp_local < v_siguiente_hora
            AND fase = 'TOTAL'
            AND calidad_lectura IN ('NORMAL', 'INTERPOLADA')
        ),
        potencia_minima = (
            SELECT MIN(potencia_activa)
            FROM sem_mediciones 
            WHERE shelly_id = t.shelly_id 
            AND timestamp_local >= p_hora_local 
            AND timestamp_local < v_siguiente_hora
            AND fase = 'TOTAL'
            AND calidad_lectura IN ('NORMAL', 'INTERPOLADA')
        ),
        precio_kwh_periodo = v_precio_kwh,
        costo_total = (
            SELECT COALESCE(SUM(energia_activa), 0) * v_precio_kwh / 1000
            FROM sem_mediciones 
            WHERE shelly_id = t.shelly_id 
            AND timestamp_local >= p_hora_local 
            AND timestamp_local < v_siguiente_hora
            AND fase = 'TOTAL'
            AND calidad_lectura IN ('NORMAL', 'INTERPOLADA')
        ),
        lecturas_validas = (
            SELECT COUNT(*)
            FROM sem_mediciones 
            WHERE shelly_id = t.shelly_id 
            AND timestamp_local >= p_hora_local 
            AND timestamp_local < v_siguiente_hora
            AND fase = 'TOTAL'
            AND calidad_lectura IN ('NORMAL', 'INTERPOLADA')
        ),
        calidad_datos = (
            SELECT (COUNT(*) * 100.0 / (
                SELECT lecturas_esperadas 
                FROM sem_control_calidad 
                WHERE shelly_id = t.shelly_id 
                AND inicio_periodo <= p_hora_local 
                AND fin_periodo > p_hora_local
                LIMIT 1
            ))
            FROM sem_mediciones 
            WHERE shelly_id = t.shelly_id 
            AND timestamp_local >= p_hora_local 
            AND timestamp_local < v_siguiente_hora
            AND fase = 'TOTAL'
            AND calidad_lectura IN ('NORMAL', 'INTERPOLADA')
        ),
        fecha_actualizacion = CURRENT_TIMESTAMP
    WHERE id = p_id_totales_hora;

    -- Verificar si la actualización fue exitosa
    IF ROW_COUNT() > 0 THEN
        SET v_success = TRUE;
    END IF;

    RETURN v_success;
END //

DELIMITER ;