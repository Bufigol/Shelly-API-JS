DELIMITER //

DROP PROCEDURE IF EXISTS RecalcularEstadisticasEnergia//

CREATE PROCEDURE RecalcularEstadisticasEnergia(
    IN fecha_inicio DATETIME,
    IN fecha_fin DATETIME,
    IN precio_kwh DECIMAL(10,2),
    IN umbral_calidad DECIMAL(4,2)
)
BEGIN
    -- Declaración de variables
    DECLARE registros_encontrados INT;
    DECLARE fecha_primer_registro DATETIME;
    DECLARE fecha_ultimo_registro DATETIME;
    DECLARE mensaje_error VARCHAR(255);
    DECLARE precio_configurado DECIMAL(10,2);
    DECLARE umbral_configurado DECIMAL(4,2);
    DECLARE done BOOLEAN DEFAULT FALSE;
    
    -- Manejador de errores
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        GET DIAGNOSTICS CONDITION 1 
            mensaje_error = MESSAGE_TEXT;
        SELECT CONCAT('Error: ', mensaje_error) AS error_message;
    END;

    -- Obtener rango de datos disponibles
    SELECT 
        COALESCE(MIN(measurement_timestamp), NOW() - INTERVAL 24 HOUR),
        COALESCE(MAX(measurement_timestamp), NOW())
    INTO 
        fecha_primer_registro,
        fecha_ultimo_registro
    FROM energy_meter
    WHERE measurement_timestamp IS NOT NULL;

    -- Configurar fechas
    SET fecha_inicio = COALESCE(fecha_inicio, fecha_primer_registro);
    SET fecha_fin = COALESCE(fecha_fin, fecha_ultimo_registro);

    -- Obtener configuraciones
    SELECT COALESCE(CAST(parameter_value AS DECIMAL(10,2)), 151.85)
    INTO precio_configurado
    FROM energy_measurement_config
    WHERE parameter_name = 'precio_kwh'
    LIMIT 1;

    SELECT COALESCE(CAST(parameter_value AS DECIMAL(4,2)), 0.8)
    INTO umbral_configurado
    FROM energy_measurement_config
    WHERE parameter_name = 'umbral_calidad'
    LIMIT 1;

    -- Establecer valores por defecto
    SET precio_kwh = COALESCE(precio_kwh, precio_configurado);
    SET umbral_calidad = COALESCE(umbral_calidad, umbral_configurado);

    -- Verificar datos disponibles
    SELECT COUNT(*) INTO registros_encontrados
    FROM energy_meter
    WHERE measurement_timestamp BETWEEN fecha_inicio AND fecha_fin;

    IF registros_encontrados = 0 THEN
        SELECT 
            'No hay registros para procesar' as mensaje,
            fecha_inicio as fecha_desde,
            fecha_fin as fecha_hasta;
        SET done = TRUE;
    END IF;

    IF NOT done THEN
        START TRANSACTION;
        
        -- Limpiar tablas
        TRUNCATE TABLE promedios_energia_hora;
        TRUNCATE TABLE promedios_energia_dia;
        TRUNCATE TABLE promedios_energia_mes;
        TRUNCATE TABLE totales_energia_hora;
        TRUNCATE TABLE totales_energia_dia;
        TRUNCATE TABLE totales_energia_mes;

        -- Calcular promedios por hora con manejo mejorado de NULL
        INSERT INTO promedios_energia_hora (
            fecha_hora,
            promedio_watts,
            min_watts,
            max_watts,
            kwh_consumidos,
            costo,
            expected_readings,
            actual_readings,
            quality_score
        )
        SELECT 
            DATE_FORMAT(em.measurement_timestamp, '%Y-%m-%d %H:00:00') as fecha_hora,
            AVG(NULLIF(em.total_act_power, 0)) as promedio_watts,
            MIN(NULLIF(em.total_act_power, 0)) as min_watts,
            MAX(NULLIF(em.total_act_power, 0)) as max_watts,
            COALESCE(AVG(NULLIF(em.total_act_power, 0)) / 1000, 0) as kwh_consumidos,
            COALESCE((AVG(NULLIF(em.total_act_power, 0)) / 1000) * precio_kwh, 0) as costo,
            360 as expected_readings,
            COUNT(*) as actual_readings,
            COUNT(*) / 360.0 as quality_score
        FROM energy_meter em
        WHERE em.measurement_timestamp BETWEEN fecha_inicio AND fecha_fin
            AND em.reading_quality = 'GOOD'
        GROUP BY DATE_FORMAT(em.measurement_timestamp, '%Y-%m-%d %H:00:00')
        HAVING quality_score >= umbral_calidad
        ORDER BY fecha_hora;

        -- Calcular promedios por día
        INSERT INTO promedios_energia_dia (
            fecha,
            promedio_watts,
            min_watts,
            max_watts,
            kwh_consumidos,
            costo,
            hours_with_data,
            quality_score
        )
        SELECT 
            DATE(em.measurement_timestamp) as fecha,
            AVG(NULLIF(em.total_act_power, 0)) as promedio_watts,
            MIN(NULLIF(em.total_act_power, 0)) as min_watts,
            MAX(NULLIF(em.total_act_power, 0)) as max_watts,
            COALESCE(AVG(NULLIF(em.total_act_power, 0)) * 24 / 1000, 0) as kwh_consumidos,
            COALESCE((AVG(NULLIF(em.total_act_power, 0)) * 24 / 1000) * precio_kwh, 0) as costo,
            COUNT(DISTINCT HOUR(em.measurement_timestamp)) as hours_with_data,
            COUNT(DISTINCT HOUR(em.measurement_timestamp)) / 24.0 as quality_score
        FROM energy_meter em
        WHERE em.measurement_timestamp BETWEEN fecha_inicio AND fecha_fin
            AND em.reading_quality = 'GOOD'
        GROUP BY DATE(em.measurement_timestamp)
        HAVING quality_score >= umbral_calidad
        ORDER BY fecha;

        -- Calcular promedios por mes
        INSERT INTO promedios_energia_mes (
            fecha_mes,
            promedio_watts,
            min_watts,
            max_watts,
            kwh_consumidos,
            costo,
            days_with_data,
            quality_score
        )
        SELECT 
            DATE_FORMAT(em.measurement_timestamp, '%Y-%m-01') as fecha_mes,
            AVG(NULLIF(em.total_act_power, 0)) as promedio_watts,
            MIN(NULLIF(em.total_act_power, 0)) as min_watts,
            MAX(NULLIF(em.total_act_power, 0)) as max_watts,
            COALESCE(AVG(NULLIF(em.total_act_power, 0)) * 24 * DAY(LAST_DAY(em.measurement_timestamp)) / 1000, 0) as kwh_consumidos,
            COALESCE((AVG(NULLIF(em.total_act_power, 0)) * 24 * DAY(LAST_DAY(em.measurement_timestamp)) / 1000) * precio_kwh, 0) as costo,
            COUNT(DISTINCT DATE(em.measurement_timestamp)) as days_with_data,
            COUNT(DISTINCT DATE(em.measurement_timestamp)) / DAY(LAST_DAY(em.measurement_timestamp)) as quality_score
        FROM energy_meter em
        WHERE em.measurement_timestamp BETWEEN fecha_inicio AND fecha_fin
            AND em.reading_quality = 'GOOD'
        GROUP BY DATE_FORMAT(em.measurement_timestamp, '%Y-%m-01')
        HAVING quality_score >= umbral_calidad
        ORDER BY fecha_mes;

        -- Calcular totales usando energy_meter_data
        INSERT INTO totales_energia_hora (
            fecha_hora,
            total_watts_hora,
            total_kwh,
            costo_total,
            readings_in_period,
            quality_score
        )
        SELECT 
            DATE_FORMAT(ds.sys_timestamp, '%Y-%m-%d %H:00:00') as fecha_hora,
            AVG(NULLIF(em.total_act_power, 0)) as total_watts_hora,
            COALESCE((MAX(emd.total_act_energy) - MIN(emd.total_act_energy)), 0) as total_kwh,
            COALESCE((MAX(emd.total_act_energy) - MIN(emd.total_act_energy)) * precio_kwh, 0) as costo_total,
            COUNT(*) as readings_in_period,
            COUNT(*) / 360.0 as quality_score
        FROM device_status ds
        INNER JOIN energy_meter em ON ds.em0_id = em.id
        INNER JOIN energy_meter_data emd ON ds.emdata0_id = emd.id
        WHERE ds.sys_timestamp BETWEEN fecha_inicio AND fecha_fin
            AND em.reading_quality = 'GOOD'
        GROUP BY DATE_FORMAT(ds.sys_timestamp, '%Y-%m-%d %H:00:00')
        HAVING quality_score >= umbral_calidad
        ORDER BY fecha_hora;

        -- Calcular totales por día
        INSERT INTO totales_energia_dia (
            fecha,
            total_watts_dia,
            total_kwh,
            costo_total,
            hours_with_data,
            quality_score
        )
        SELECT 
            DATE(ds.sys_timestamp) as fecha,
            AVG(NULLIF(em.total_act_power, 0)) as total_watts_dia,
            COALESCE((MAX(emd.total_act_energy) - MIN(emd.total_act_energy)), 0) as total_kwh,
            COALESCE((MAX(emd.total_act_energy) - MIN(emd.total_act_energy)) * precio_kwh, 0) as costo_total,
            COUNT(DISTINCT HOUR(ds.sys_timestamp)) as hours_with_data,
            COUNT(DISTINCT HOUR(ds.sys_timestamp)) / 24.0 as quality_score
        FROM device_status ds
        INNER JOIN energy_meter em ON ds.em0_id = em.id
        INNER JOIN energy_meter_data emd ON ds.emdata0_id = emd.id
        WHERE ds.sys_timestamp BETWEEN fecha_inicio AND fecha_fin
            AND em.reading_quality = 'GOOD'
        GROUP BY DATE(ds.sys_timestamp)
        HAVING quality_score >= umbral_calidad
        ORDER BY fecha;

        -- Calcular totales por mes
        INSERT INTO totales_energia_mes (
            anio,
            mes,
            total_watts_mes,
            total_kwh,
            costo_total,
            days_with_data,
            quality_score
        )
        SELECT 
            YEAR(ds.sys_timestamp) as anio,
            MONTH(ds.sys_timestamp) as mes,
            AVG(NULLIF(em.total_act_power, 0)) as total_watts_mes,
            COALESCE((MAX(emd.total_act_energy) - MIN(emd.total_act_energy)), 0) as total_kwh,
            COALESCE((MAX(emd.total_act_energy) - MIN(emd.total_act_energy)) * precio_kwh, 0) as costo_total,
            COUNT(DISTINCT DATE(ds.sys_timestamp)) as days_with_data,
            COUNT(DISTINCT DATE(ds.sys_timestamp)) / DAY(LAST_DAY(ds.sys_timestamp)) as quality_score
        FROM device_status ds
        INNER JOIN energy_meter em ON ds.em0_id = em.id
        INNER JOIN energy_meter_data emd ON ds.emdata0_id = emd.id
        WHERE ds.sys_timestamp BETWEEN fecha_inicio AND fecha_fin
            AND em.reading_quality = 'GOOD'
        GROUP BY YEAR(ds.sys_timestamp), MONTH(ds.sys_timestamp)
        HAVING quality_score >= umbral_calidad
        ORDER BY anio, mes;

        COMMIT;

        -- Retornar resumen
        SELECT 
            'Recálculo completado exitosamente' as mensaje,
            fecha_inicio as fecha_desde,
            fecha_fin as fecha_hasta,
            precio_kwh as precio_utilizado,
            umbral_calidad as umbral_calidad_utilizado,
            registros_encontrados as total_registros_procesados,
            (SELECT COUNT(*) FROM promedios_energia_hora) as registros_hora_generados,
            (SELECT COUNT(*) FROM promedios_energia_dia) as registros_dia_generados,
            (SELECT COUNT(*) FROM promedios_energia_mes) as registros_mes_generados;
    END IF;
END //

DELIMITER ;