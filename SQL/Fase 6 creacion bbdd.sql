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
        9, -- ID para CALCULO_TOTALES
        'Inicio cálculo totales horarios',
        JSON_OBJECT(
            'fecha_inicio', v_fecha_inicio,
            'fecha_fin', v_fecha_fin,
            'ventana_minutos', ventana_minutos
        )
    );
    
    SET v_execution_id = LAST_INSERT_ID();

    INSERT INTO sem_totales_hora (
        shelly_id,
        hora_utc,
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
        DATE_FORMAT(m.timestamp_utc, '%Y-%m-%d %H:00:00'),
        ADDTIME(DATE_FORMAT(m.timestamp_utc, '%Y-%m-%d %H:00:00'), '03:00:00'),
        SUM(m.energia_activa),
        SUM(m.energia_reactiva),
        MAX(m.potencia_activa),
        MIN(m.potencia_activa),
        (SELECT valor FROM sem_configuracion sc 
         JOIN sem_tipos_parametros stp ON sc.tipo_parametro_id = stp.id 
         WHERE stp.nombre = 'PRECIO_KWH' AND sc.activo = TRUE 
         LIMIT 1),
        SUM(m.energia_activa) * (
            SELECT valor FROM sem_configuracion sc 
            JOIN sem_tipos_parametros stp ON sc.tipo_parametro_id = stp.id 
            WHERE stp.nombre = 'PRECIO_KWH' AND sc.activo = TRUE 
            LIMIT 1
        ),
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