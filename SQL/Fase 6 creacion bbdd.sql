-- Primero creamos una función auxiliar para obtener el timestamp más reciente
DELIMITER //


CREATE FUNCTION fn_get_last_timestamp()
RETURNS TIMESTAMP
DETERMINISTIC
BEGIN
    DECLARE v_last_timestamp TIMESTAMP;
    
    SELECT MAX(timestamp_utc)
    INTO v_last_timestamp
    FROM sem_mediciones;
    
    RETURN v_last_timestamp;
END //


-- Modificamos el procedimiento de cálculo de promedios horarios

drop procedure sem_calcular_promedios_hora //
CREATE  PROCEDURE sem_calcular_promedios_hora(
    IN ventana_minutos INT -- Ventana de tiempo hacia atrás en minutos
)
proc_label:BEGIN
    DECLARE v_fecha_fin TIMESTAMP;
    DECLARE v_fecha_inicio TIMESTAMP;
    DECLARE v_execution_id BIGINT;
    DECLARE v_error BOOLEAN DEFAULT FALSE;
    DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET v_error = TRUE;

    -- Obtenemos el timestamp más reciente
    SET v_fecha_fin = fn_get_last_timestamp();
    SET v_fecha_inicio = DATE_SUB(v_fecha_fin, INTERVAL ventana_minutos MINUTE);

    START TRANSACTION;
    
    -- Registrar inicio de ejecución
    INSERT INTO sem_registro_auditoria (
        tipo_evento_id,
        descripcion,
        detalles
    ) VALUES (
        8, -- ID para CALCULO_PROMEDIOS
        'Inicio cálculo promedios horarios',
        JSON_OBJECT(
            'fecha_inicio', v_fecha_inicio,
            'fecha_fin', v_fecha_fin,
            'ventana_minutos', ventana_minutos
        )
    );
    
    SET v_execution_id = LAST_INSERT_ID();

    -- Insertar promedios
    INSERT INTO sem_promedios_hora (
        shelly_id,
        hora_utc,
        hora_local,
        fase_a_voltaje_promedio,
        fase_a_corriente_promedio,
        fase_a_potencia_activa_promedio,
        fase_b_voltaje_promedio,
        fase_b_corriente_promedio,
        fase_b_potencia_activa_promedio,
        fase_c_voltaje_promedio,
        fase_c_corriente_promedio,
        fase_c_potencia_activa_promedio,
        potencia_activa_promedio,
        lecturas_esperadas,
        lecturas_recibidas,
        lecturas_validas,
        calidad_datos
    )
    SELECT 
        m.shelly_id,
        DATE_FORMAT(m.timestamp_utc, '%Y-%m-%d %H:00:00'),
        ADDTIME(DATE_FORMAT(m.timestamp_utc, '%Y-%m-%d %H:00:00'), '03:00:00'),
        AVG(CASE WHEN m.fase = 'A' THEN NULLIF(m.voltaje, 0) END),
        AVG(CASE WHEN m.fase = 'A' THEN m.corriente END),
        AVG(CASE WHEN m.fase = 'A' THEN m.potencia_activa END),
        AVG(CASE WHEN m.fase = 'B' THEN NULLIF(m.voltaje, 0) END),
        AVG(CASE WHEN m.fase = 'B' THEN m.corriente END),
        AVG(CASE WHEN m.fase = 'B' THEN m.potencia_activa END),
        AVG(CASE WHEN m.fase = 'C' THEN NULLIF(m.voltaje, 0) END),
        AVG(CASE WHEN m.fase = 'C' THEN m.corriente END),
        AVG(CASE WHEN m.fase = 'C' THEN m.potencia_activa END),
        SUM(m.potencia_activa),
        360,
        COUNT(*),
        SUM(CASE WHEN m.calidad_lectura = 'NORMAL' THEN 1 ELSE 0 END),
        (SUM(CASE WHEN m.calidad_lectura = 'NORMAL' THEN 1 ELSE 0 END) * 100.0) / COUNT(*)
    FROM sem_mediciones m
    WHERE m.timestamp_utc BETWEEN v_fecha_inicio AND v_fecha_fin
    GROUP BY 
        m.shelly_id,
        DATE_FORMAT(m.timestamp_utc, '%Y-%m-%d %H:00:00');

    IF v_error THEN
        ROLLBACK;
        UPDATE sem_registro_auditoria
        SET descripcion = CONCAT(descripcion, ' - Error'),
            detalles = JSON_SET(
                detalles,
                '$.error', TRUE,
                '$.fecha_error', v_fecha_fin
            )
        WHERE id = v_execution_id;
    ELSE
        COMMIT;
        UPDATE sem_registro_auditoria
        SET descripcion = CONCAT(descripcion, ' - Completado'),
            detalles = JSON_SET(
                detalles,
                '$.fecha_fin', v_fecha_fin,
                '$.registros_procesados', ROW_COUNT()
            )
        WHERE id = v_execution_id;
    END IF;
END //

-- Modificamos el cálculo de totales horarios
drop PROCEDURE sem_calcular_totales_hora;
CREATE PROCEDURE sem_calcular_totales_hora(
    IN ventana_minutos INT
)
proc_label:BEGIN
    DECLARE v_fecha_fin TIMESTAMP;
    DECLARE v_fecha_inicio TIMESTAMP;
    DECLARE v_execution_id BIGINT;
    DECLARE v_error BOOLEAN DEFAULT FALSE;
    DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET v_error = TRUE;

    -- Obtenemos el timestamp más reciente
    SET v_fecha_fin = fn_get_last_timestamp();
    SET v_fecha_inicio = DATE_SUB(v_fecha_fin, INTERVAL ventana_minutos MINUTE);

    START TRANSACTION;
    
    INSERT INTO sem_registro_auditoria (
        tipo_evento_id,
        descripcion,
        detalles
    ) VALUES (
        9,
        'Inicio cálculo totales horarios',
        JSON_OBJECT(
            'fecha_inicio', v_fecha_inicio,
            'fecha_fin', v_fecha_fin,
            'ventana_minutos', ventana_minutos
        )
    );
    
    SET v_execution_id = LAST_INSERT_ID();

    -- Calculamos totales por hora y fase
    INSERT INTO sem_totales_hora (
        shelly_id,
        hora_utc,
        hora_local,
        fase_a_energia_activa,
        fase_a_energia_reactiva,
        fase_b_energia_activa,
        fase_b_energia_reactiva,
        fase_c_energia_activa,
        fase_c_energia_reactiva,
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
        hora_utc,
        SUBTIME(hora_utc, '03:00:00') as hora_local,
        SUM(CASE WHEN fase = 'A' THEN energia_activa ELSE 0 END) as fase_a_energia_activa,
        SUM(CASE WHEN fase = 'A' THEN energia_reactiva ELSE 0 END) as fase_a_energia_reactiva,
        SUM(CASE WHEN fase = 'B' THEN energia_activa ELSE 0 END) as fase_b_energia_activa,
        SUM(CASE WHEN fase = 'B' THEN energia_reactiva ELSE 0 END) as fase_b_energia_reactiva,
        SUM(CASE WHEN fase = 'C' THEN energia_activa ELSE 0 END) as fase_c_energia_activa,
        SUM(CASE WHEN fase = 'C' THEN energia_reactiva ELSE 0 END) as fase_c_energia_reactiva,
        SUM(energia_activa) as energia_activa_total,
        SUM(energia_reactiva) as energia_reactiva_total,
        MAX(potencia_activa) as potencia_maxima,
        MIN(potencia_activa) as potencia_minima,
        151.85 as precio_kwh_periodo,
        SUM(energia_activa) * 151.85 as costo_total,
        SUM(CASE WHEN calidad_lectura = 'NORMAL' THEN 1 ELSE 0 END) as lecturas_validas,
        (SUM(CASE WHEN calidad_lectura = 'NORMAL' THEN 1 ELSE 0 END) * 100.0) / COUNT(*) as calidad_datos
    FROM (
        SELECT 
            shelly_id,
            fase,
            DATE_FORMAT(timestamp_utc, '%Y-%m-%d %H:00:00') as hora_utc,
            energia_activa,
            energia_reactiva,
            potencia_activa,
            calidad_lectura
        FROM sem_mediciones
        WHERE timestamp_utc BETWEEN v_fecha_inicio AND v_fecha_fin
    ) m
    GROUP BY 
        m.shelly_id,
        m.hora_utc;

    IF v_error THEN
        ROLLBACK;
        UPDATE sem_registro_auditoria
        SET descripcion = CONCAT(descripcion, ' - Error'),
            detalles = JSON_SET(
                detalles,
                '$.error', TRUE,
                '$.fecha_error', v_fecha_fin
            )
        WHERE id = v_execution_id;
    ELSE
        COMMIT;
        UPDATE sem_registro_auditoria
        SET descripcion = CONCAT(descripcion, ' - Completado'),
            detalles = JSON_SET(
                detalles,
                '$.fecha_fin', v_fecha_fin,
                '$.registros_procesados', ROW_COUNT()
            )
        WHERE id = v_execution_id;
    END IF;
END //

-- Modificamos el evento de cálculos frecuentes
DROP EVENT IF EXISTS sem_evento_calculos_frecuentes //

CREATE EVENT sem_evento_calculos_frecuentes
ON SCHEDULE EVERY 5 MINUTE
DO
BEGIN
    -- Calcular los últimos 15 minutos
    CALL sem_calcular_promedios_hora(15);
    CALL sem_calcular_totales_hora(15);
    
    -- Si hay datos más antiguos sin procesar, calcular la última hora completa
    CALL sem_calcular_promedios_hora(60);
    CALL sem_calcular_totales_hora(60);
END //

DELIMITER ;