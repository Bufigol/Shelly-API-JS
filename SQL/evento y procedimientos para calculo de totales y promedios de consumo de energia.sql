DELIMITER //

-- Eliminar elementos existentes
DROP EVENT IF EXISTS calcular_promedios_y_totales_consumo_electrico//
DROP PROCEDURE IF EXISTS calc_promedios_hora//
DROP PROCEDURE IF EXISTS calc_totales_hora//
DROP PROCEDURE IF EXISTS calc_promedios_dia//
DROP PROCEDURE IF EXISTS calc_totales_dia//
DROP PROCEDURE IF EXISTS calc_promedios_mes//
DROP PROCEDURE IF EXISTS calc_totales_mes//

-- Activar el event scheduler
SET GLOBAL event_scheduler = ON//

-- Procedimiento para calcular promedios por hora
CREATE PROCEDURE calc_promedios_hora(
    IN p_start_time TIMESTAMP,
    IN p_end_time TIMESTAMP,
    IN p_execution_id INT
)
BEGIN
    DECLARE v_hora_actual DATETIME;
    DECLARE v_processed INT DEFAULT 0;
    
    SET v_hora_actual = DATE_FORMAT(p_start_time, '%Y-%m-%d %H:00:00');
    
    WHILE v_hora_actual < p_end_time DO
        INSERT INTO promedios_energia_hora 
        (fecha_hora, promedio_watts, min_watts, max_watts, kwh_consumidos, 
         costo, expected_readings, actual_readings, quality_score)
        WITH HourlyStats AS (
            SELECT 
                COUNT(*) as total_readings,
                AVG(total_act_power) as avg_watts,
                MIN(total_act_power) as min_watts,
                MAX(total_act_power) as max_watts,
                SUM(total_act_power * 0.002778 / 1000) as kwh_total
            FROM energy_meter
            WHERE measurement_timestamp >= v_hora_actual
                AND measurement_timestamp < v_hora_actual + INTERVAL 1 HOUR
        )
        SELECT 
            v_hora_actual,
            avg_watts,
            min_watts,
            max_watts,
            kwh_total,
            kwh_total * (SELECT parameter_value FROM energy_measurement_config WHERE parameter_name = 'precio_kwh'),
            360 as expected_readings,
            total_readings,
            total_readings / 360
        FROM HourlyStats
        ON DUPLICATE KEY UPDATE
            promedio_watts = VALUES(promedio_watts),
            min_watts = VALUES(min_watts),
            max_watts = VALUES(max_watts),
            kwh_consumidos = VALUES(kwh_consumidos),
            costo = VALUES(costo),
            actual_readings = VALUES(actual_readings),
            quality_score = VALUES(quality_score),
            fecha_actualizacion = CURRENT_TIMESTAMP;
            
        SET v_processed = v_processed + 1;
        SET v_hora_actual = v_hora_actual + INTERVAL 1 HOUR;
    END WHILE;
    
    UPDATE event_execution_log 
    SET records_processed = records_processed + v_processed,
        details = JSON_SET(
            COALESCE(details, '{}'),
            '$.promedios_hora', v_processed
        )
    WHERE id = p_execution_id;
END//

-- Procedimiento para calcular promedios por día
CREATE PROCEDURE calc_promedios_dia(
    IN p_start_time TIMESTAMP,
    IN p_end_time TIMESTAMP,
    IN p_execution_id INT
)
BEGIN
    DECLARE v_dia_actual DATE;
    DECLARE v_processed INT DEFAULT 0;
    
    SET v_dia_actual = DATE(p_start_time);
    
    WHILE v_dia_actual < DATE(p_end_time) DO
        INSERT INTO promedios_energia_dia
        (fecha, promedio_watts, min_watts, max_watts, kwh_consumidos,
         costo, hours_with_data, quality_score)
        WITH DailyStats AS (
            SELECT 
                COUNT(DISTINCT HOUR(measurement_timestamp)) as hours_with_data,
                AVG(total_act_power) as avg_watts,
                MIN(total_act_power) as min_watts,
                MAX(total_act_power) as max_watts,
                SUM(total_act_power * 0.002778 / 1000) as kwh_total
            FROM energy_meter
            WHERE DATE(measurement_timestamp) = v_dia_actual
        )
        SELECT 
            v_dia_actual,
            avg_watts,
            min_watts,
            max_watts,
            kwh_total,
            kwh_total * (SELECT parameter_value FROM energy_measurement_config WHERE parameter_name = 'precio_kwh'),
            hours_with_data,
            hours_with_data / 24
        FROM DailyStats
        ON DUPLICATE KEY UPDATE
            promedio_watts = VALUES(promedio_watts),
            min_watts = VALUES(min_watts),
            max_watts = VALUES(max_watts),
            kwh_consumidos = VALUES(kwh_consumidos),
            costo = VALUES(costo),
            hours_with_data = VALUES(hours_with_data),
            quality_score = VALUES(quality_score),
            fecha_actualizacion = CURRENT_TIMESTAMP;
            
        SET v_processed = v_processed + 1;
        SET v_dia_actual = v_dia_actual + INTERVAL 1 DAY;
    END WHILE;
    
    UPDATE event_execution_log 
    SET records_processed = records_processed + v_processed,
        details = JSON_SET(
            COALESCE(details, '{}'),
            '$.promedios_dia', v_processed
        )
    WHERE id = p_execution_id;
END//

-- Procedimiento para calcular promedios por mes
CREATE PROCEDURE calc_promedios_mes(
    IN p_start_time TIMESTAMP,
    IN p_end_time TIMESTAMP,
    IN p_execution_id INT
)
BEGIN
    DECLARE v_mes_actual DATE;
    DECLARE v_processed INT DEFAULT 0;
    
    SET v_mes_actual = DATE_FORMAT(p_start_time, '%Y-%m-01');
    
    WHILE v_mes_actual < DATE(p_end_time) DO
        INSERT INTO promedios_energia_mes
        (fecha_mes, promedio_watts, min_watts, max_watts, kwh_consumidos,
         costo, days_with_data, quality_score)
        WITH MonthlyStats AS (
            SELECT 
                COUNT(DISTINCT DATE(measurement_timestamp)) as days_with_data,
                AVG(total_act_power) as avg_watts,
                MIN(total_act_power) as min_watts,
                MAX(total_act_power) as max_watts,
                SUM(total_act_power * 0.002778 / 1000) as kwh_total
            FROM energy_meter
            WHERE DATE(measurement_timestamp) >= v_mes_actual
                AND DATE(measurement_timestamp) < v_mes_actual + INTERVAL 1 MONTH
        )
        SELECT 
            v_mes_actual,
            avg_watts,
            min_watts,
            max_watts,
            kwh_total,
            kwh_total * (SELECT parameter_value FROM energy_measurement_config WHERE parameter_name = 'precio_kwh'),
            days_with_data,
            days_with_data / DAY(LAST_DAY(v_mes_actual))
        FROM MonthlyStats
        ON DUPLICATE KEY UPDATE
            promedio_watts = VALUES(promedio_watts),
            min_watts = VALUES(min_watts),
            max_watts = VALUES(max_watts),
            kwh_consumidos = VALUES(kwh_consumidos),
            costo = VALUES(costo),
            days_with_data = VALUES(days_with_data),
            quality_score = VALUES(quality_score),
            fecha_actualizacion = CURRENT_TIMESTAMP;
            
        SET v_processed = v_processed + 1;
        SET v_mes_actual = DATE_ADD(v_mes_actual, INTERVAL 1 MONTH);
    END WHILE;
    
    UPDATE event_execution_log 
    SET records_processed = records_processed + v_processed,
        details = JSON_SET(
            COALESCE(details, '{}'),
            '$.promedios_mes', v_processed
        )
    WHERE id = p_execution_id;
END//

-- Procedimiento para calcular totales por hora
CREATE PROCEDURE calc_totales_hora(
    IN p_start_time TIMESTAMP,
    IN p_end_time TIMESTAMP,
    IN p_execution_id INT
)
BEGIN
    DECLARE v_hora_actual DATETIME;
    DECLARE v_processed INT DEFAULT 0;
    
    SET v_hora_actual = DATE_FORMAT(p_start_time, '%Y-%m-%d %H:00:00');
    
    WHILE v_hora_actual < p_end_time DO
        INSERT INTO totales_energia_hora 
        (fecha_hora, total_watts_hora, total_kwh, costo_total, readings_in_period, quality_score)
        WITH HourlyStats AS (
            SELECT 
                COUNT(*) as total_readings,
                AVG(total_act_power) as avg_watts,
                SUM(total_act_power * 0.002778 / 1000) as kwh_total
            FROM energy_meter
            WHERE measurement_timestamp >= v_hora_actual
                AND measurement_timestamp < v_hora_actual + INTERVAL 1 HOUR
        )
        SELECT 
            v_hora_actual,
            avg_watts,
            kwh_total,
            kwh_total * (SELECT parameter_value FROM energy_measurement_config WHERE parameter_name = 'precio_kwh'),
            total_readings,
            total_readings / 360
        FROM HourlyStats
        ON DUPLICATE KEY UPDATE
            total_watts_hora = VALUES(total_watts_hora),
            total_kwh = VALUES(total_kwh),
            costo_total = VALUES(costo_total),
            readings_in_period = VALUES(readings_in_period),
            quality_score = VALUES(quality_score),
            fecha_actualizacion = CURRENT_TIMESTAMP;
            
        SET v_processed = v_processed + 1;
        SET v_hora_actual = v_hora_actual + INTERVAL 1 HOUR;
    END WHILE;
    
    UPDATE event_execution_log 
    SET records_processed = records_processed + v_processed,
        details = JSON_SET(
            COALESCE(details, '{}'),
            '$.totales_hora', v_processed
        )
    WHERE id = p_execution_id;
END//

-- Procedimiento para calcular totales por día
CREATE PROCEDURE calc_totales_dia(
    IN p_start_time TIMESTAMP,
    IN p_end_time TIMESTAMP,
    IN p_execution_id INT
)
BEGIN
    DECLARE v_dia_actual DATE;
    DECLARE v_processed INT DEFAULT 0;
    
    SET v_dia_actual = DATE(p_start_time);
    
    WHILE v_dia_actual < DATE(p_end_time) DO
        INSERT INTO totales_energia_dia
        (fecha, total_watts_dia, total_kwh, costo_total, hours_with_data, quality_score)
        WITH DailyStats AS (
            SELECT 
                COUNT(DISTINCT HOUR(measurement_timestamp)) as hours_with_data,
                AVG(total_act_power) as avg_watts,
                SUM(total_act_power * 0.002778 / 1000) as kwh_total
            FROM energy_meter
            WHERE DATE(measurement_timestamp) = v_dia_actual
        )
        SELECT 
            v_dia_actual,
            avg_watts,
            kwh_total,
            kwh_total * (SELECT parameter_value FROM energy_measurement_config WHERE parameter_name = 'precio_kwh'),
            hours_with_data,
            hours_with_data / 24
        FROM DailyStats
        ON DUPLICATE KEY UPDATE
            total_watts_dia = VALUES(total_watts_dia),
            total_kwh = VALUES(total_kwh),
            costo_total = VALUES(costo_total),
            hours_with_data = VALUES(hours_with_data),
            quality_score = VALUES(quality_score),
            fecha_actualizacion = CURRENT_TIMESTAMP;
            
        SET v_processed = v_processed + 1;
        SET v_dia_actual = v_dia_actual + INTERVAL 1 DAY;
    END WHILE;
    
    UPDATE event_execution_log 
    SET records_processed = records_processed + v_processed,
        details = JSON_SET(
            COALESCE(details, '{}'),
            '$.totales_dia', v_processed
        )
    WHERE id = p_execution_id;
END//

-- Procedimiento para calcular totales por mes
CREATE PROCEDURE calc_totales_mes(
    IN p_start_time TIMESTAMP,
    IN p_end_time TIMESTAMP,
    IN p_execution_id INT
)
BEGIN
    DECLARE v_mes_actual DATE;
    DECLARE v_processed INT DEFAULT 0;
    
    SET v_mes_actual = DATE_FORMAT(p_start_time, '%Y-%m-01');
    
    WHILE v_mes_actual < DATE(p_end_time) DO
        INSERT INTO totales_energia_mes
        (anio, mes, total_watts_mes, total_kwh, costo_total, days_with_data, quality_score)
        WITH MonthlyStats AS (
            SELECT 
                COUNT(DISTINCT DATE(measurement_timestamp)) as days_with_data,
                AVG(total_act_power) as avg_watts,
                SUM(total_act_power * 0.002778 / 1000) as kwh_total
            FROM energy_meter
            WHERE DATE(measurement_timestamp) >= v_mes_actual
                AND DATE(measurement_timestamp) < v_mes_actual + INTERVAL 1 MONTH
        )
        SELECT 
            YEAR(v_mes_actual),
            MONTH(v_mes_actual),
            avg_watts,
            kwh_total,
            kwh_total * (SELECT parameter_value FROM energy_measurement_config WHERE parameter_name = 'precio_kwh'),
            days_with_data,
            days_with_data / DAY(LAST_DAY(v_mes_actual))
        FROM MonthlyStats
        ON DUPLICATE KEY UPDATE
            total_watts_mes = VALUES(total_watts_mes),
            total_kwh = VALUES(total_kwh),
            costo_total = VALUES(costo_total),
            days_with_data = VALUES(days_with_data),
            quality_score = VALUES(quality_score),
            fecha_actualizacion = CURRENT_TIMESTAMP;
            
        SET v_processed = v_processed + 1;
        SET v_mes_actual = DATE_ADD(v_mes_actual, INTERVAL 1 MONTH);
    END WHILE;
    
    UPDATE event_execution_log 
    SET records_processed = records_processed + v_processed,
        details = JSON_SET(
            COALESCE(details, '{}'),
            '$.totales_mes', v_processed
        )
    WHERE id = p_execution_id;
END//

-- Crear el evento principal
CREATE EVENT IF NOT EXISTS calcular_promedios_y_totales_consumo_electrico
ON SCHEDULE EVERY 5 MINUTE
STARTS CURRENT_TIMESTAMP
ENABLE
DO
BEGIN
    DECLARE v_execution_id INT;
    DECLARE v_start_time TIMESTAMP;
    DECLARE v_end_time TIMESTAMP;
    DECLARE CONTINUE HANDLER FOR SQLEXCEPTION
    BEGIN
        UPDATE event_execution_log 
        SET status = 'ERROR',
            error_message = CONCAT('Error en la ejecución: ', CURRENT_TIMESTAMP),
            details = JSON_SET(
                COALESCE(details, '{}'),
                '$.error_time', CURRENT_TIMESTAMP(3)
            )
        WHERE id = v_execution_id;
    END;
    
    -- Inicializar período
    SET v_start_time = CURRENT_TIMESTAMP - INTERVAL 2 HOUR;
    SET v_end_time = CURRENT_TIMESTAMP;
    
    -- Crear entrada en el log
    INSERT INTO event_execution_log (event_name, execution_start, status)
    VALUES ('calcular_promedios_y_totales_consumo_electrico', CURRENT_TIMESTAMP(3), 'RUNNING');
    SET v_execution_id = LAST_INSERT_ID();
    
    -- Calcular promedios por hora
    CALL calc_promedios_hora(v_start_time, v_end_time, v_execution_id);
    
    -- Calcular totales por hora
    CALL calc_totales_hora(v_start_time, v_end_time, v_execution_id);
    
    -- Ajustar período para cálculos diarios
    SET v_start_time = CURRENT_TIMESTAMP - INTERVAL 2 DAY;
    
    -- Calcular promedios por día
    CALL calc_promedios_dia(v_start_time, v_end_time, v_execution_id);
    
    -- Calcular totales por día
    CALL calc_totales_dia(v_start_time, v_end_time, v_execution_id);
    
    -- Ajustar período para cálculos mensuales
    SET v_start_time = CURRENT_TIMESTAMP - INTERVAL 2 MONTH;
    
    -- Calcular promedios por mes
    CALL calc_promedios_mes(v_start_time, v_end_time, v_execution_id);
    
    -- Calcular totales por mes
    CALL calc_totales_mes(v_start_time, v_end_time, v_execution_id);
    
    -- Marcar como completado
    UPDATE event_execution_log 
    SET status = 'COMPLETED',
        details = JSON_SET(
            COALESCE(details, '{}'),
            '$.completion_time', CURRENT_TIMESTAMP(3)
        )
    WHERE id = v_execution_id;
END //

DELIMITER ;