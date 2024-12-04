DELIMITER //

DROP PROCEDURE IF EXISTS RecalcularEstadisticasEnergia//

CREATE PROCEDURE RecalcularEstadisticasEnergia(
    IN fecha_inicio DATETIME,
    IN fecha_fin DATETIME,
    IN precio_kwh DECIMAL(10,2),
    IN umbral_calidad DECIMAL(4,2)
)
BEGIN
    -- Declarar variables para manejo de errores
    DECLARE exit handler for SQLEXCEPTION
    BEGIN
        -- Rollback en caso de error
        ROLLBACK;
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Error en la ejecución del procedimiento RecalcularEstadisticasEnergia';
    END;

    -- Validar parámetros
    IF fecha_inicio IS NULL THEN
        SET fecha_inicio = (SELECT MIN(measurement_timestamp) FROM energy_meter WHERE measurement_timestamp IS NOT NULL);
    END IF;

    IF fecha_fin IS NULL THEN
        SET fecha_fin = NOW();
    END IF;

    IF precio_kwh IS NULL THEN
        SET precio_kwh = 151.85;
    END IF;

    IF umbral_calidad IS NULL THEN
        SET umbral_calidad = 0.8;
    END IF;

    -- Iniciar transacción
    START TRANSACTION;

    -- Eliminar registros existentes en el rango de fechas especificado
    DELETE FROM promedios_energia_hora 
    WHERE fecha_hora BETWEEN fecha_inicio AND fecha_fin;

    DELETE FROM promedios_energia_dia 
    WHERE fecha BETWEEN DATE(fecha_inicio) AND DATE(fecha_fin);

    DELETE FROM promedios_energia_mes 
    WHERE fecha_mes BETWEEN DATE_FORMAT(fecha_inicio, '%Y-%m-01') 
    AND DATE_FORMAT(fecha_fin, '%Y-%m-01');

    DELETE FROM totales_energia_hora 
    WHERE fecha_hora BETWEEN fecha_inicio AND fecha_fin;

    DELETE FROM totales_energia_dia 
    WHERE fecha BETWEEN DATE(fecha_inicio) AND DATE(fecha_fin);

    DELETE FROM totales_energia_mes 
    WHERE CONCAT(anio, '-', LPAD(mes, 2, '0'), '-01') BETWEEN 
        DATE_FORMAT(fecha_inicio, '%Y-%m-01') AND DATE_FORMAT(fecha_fin, '%Y-%m-01');

    -- Recalcular promedios por hora
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
        AVG(CASE WHEN em.reading_quality = 'GOOD' THEN em.total_act_power ELSE NULL END) as promedio_watts,
        MIN(CASE WHEN em.reading_quality = 'GOOD' THEN em.total_act_power ELSE NULL END) as min_watts,
        MAX(CASE WHEN em.reading_quality = 'GOOD' THEN em.total_act_power ELSE NULL END) as max_watts,
        (AVG(CASE WHEN em.reading_quality = 'GOOD' THEN em.total_act_power ELSE NULL END) * 1) / 1000 as kwh_consumidos,
        ((AVG(CASE WHEN em.reading_quality = 'GOOD' THEN em.total_act_power ELSE NULL END) * 1) / 1000) * precio_kwh as costo,
        360 as expected_readings,
        COUNT(*) as actual_readings,
        COUNT(CASE WHEN em.reading_quality = 'GOOD' THEN 1 END) / 360.0 as quality_score
    FROM energy_meter em
    WHERE em.measurement_timestamp BETWEEN fecha_inicio AND fecha_fin
        AND em.measurement_timestamp IS NOT NULL
    GROUP BY DATE_FORMAT(em.measurement_timestamp, '%Y-%m-%d %H:00:00')
    HAVING quality_score >= umbral_calidad
    ORDER BY fecha_hora;

    -- Recalcular promedios por día
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
        AVG(CASE WHEN em.reading_quality = 'GOOD' THEN em.total_act_power ELSE NULL END) as promedio_watts,
        MIN(CASE WHEN em.reading_quality = 'GOOD' THEN em.total_act_power ELSE NULL END) as min_watts,
        MAX(CASE WHEN em.reading_quality = 'GOOD' THEN em.total_act_power ELSE NULL END) as max_watts,
        (AVG(CASE WHEN em.reading_quality = 'GOOD' THEN em.total_act_power ELSE NULL END) * 24) / 1000 as kwh_consumidos,
        ((AVG(CASE WHEN em.reading_quality = 'GOOD' THEN em.total_act_power ELSE NULL END) * 24) / 1000) * precio_kwh as costo,
        COUNT(DISTINCT HOUR(em.measurement_timestamp)) as hours_with_data,
        COUNT(DISTINCT HOUR(em.measurement_timestamp)) / 24.0 as quality_score
    FROM energy_meter em
    WHERE em.measurement_timestamp BETWEEN fecha_inicio AND fecha_fin
        AND em.measurement_timestamp IS NOT NULL
    GROUP BY DATE(em.measurement_timestamp)
    HAVING quality_score >= umbral_calidad
    ORDER BY fecha;

    -- Recalcular promedios por mes
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
        AVG(CASE WHEN em.reading_quality = 'GOOD' THEN em.total_act_power ELSE NULL END) as promedio_watts,
        MIN(CASE WHEN em.reading_quality = 'GOOD' THEN em.total_act_power ELSE NULL END) as min_watts,
        MAX(CASE WHEN em.reading_quality = 'GOOD' THEN em.total_act_power ELSE NULL END) as max_watts,
        (AVG(CASE WHEN em.reading_quality = 'GOOD' THEN em.total_act_power ELSE NULL END) * 24 * 
            DAY(LAST_DAY(em.measurement_timestamp))) / 1000 as kwh_consumidos,
        ((AVG(CASE WHEN em.reading_quality = 'GOOD' THEN em.total_act_power ELSE NULL END) * 24 * 
            DAY(LAST_DAY(em.measurement_timestamp))) / 1000) * precio_kwh as costo,
        COUNT(DISTINCT DATE(em.measurement_timestamp)) as days_with_data,
        COUNT(DISTINCT DATE(em.measurement_timestamp)) / DAY(LAST_DAY(em.measurement_timestamp)) as quality_score
    FROM energy_meter em
    WHERE em.measurement_timestamp BETWEEN fecha_inicio AND fecha_fin
        AND em.measurement_timestamp IS NOT NULL
    GROUP BY DATE_FORMAT(em.measurement_timestamp, '%Y-%m-01')
    HAVING quality_score >= umbral_calidad
    ORDER BY fecha_mes;

    -- Recalcular totales por hora
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
        AVG(em.total_act_power) as total_watts_hora,
        (MAX(emd.total_act_energy) - MIN(emd.total_act_energy)) as total_kwh,
        ((MAX(emd.total_act_energy) - MIN(emd.total_act_energy)) * precio_kwh) as costo_total,
        COUNT(*) as readings_in_period,
        COUNT(*) / 360.0 as quality_score
    FROM device_status ds
    JOIN energy_meter em ON ds.em0_id = em.id
    JOIN energy_meter_data emd ON ds.emdata0_id = emd.id
    WHERE ds.sys_timestamp BETWEEN fecha_inicio AND fecha_fin
        AND ds.sys_timestamp IS NOT NULL
    GROUP BY DATE_FORMAT(ds.sys_timestamp, '%Y-%m-%d %H:00:00')
    HAVING quality_score >= umbral_calidad
    ORDER BY fecha_hora;

    -- Recalcular totales por día
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
        AVG(em.total_act_power) as total_watts_dia,
        (MAX(emd.total_act_energy) - MIN(emd.total_act_energy)) as total_kwh,
        ((MAX(emd.total_act_energy) - MIN(emd.total_act_energy)) * precio_kwh) as costo_total,
        COUNT(DISTINCT HOUR(ds.sys_timestamp)) as hours_with_data,
        COUNT(DISTINCT HOUR(ds.sys_timestamp)) / 24.0 as quality_score
    FROM device_status ds
    JOIN energy_meter em ON ds.em0_id = em.id
    JOIN energy_meter_data emd ON ds.emdata0_id = emd.id
    WHERE ds.sys_timestamp BETWEEN fecha_inicio AND fecha_fin
        AND ds.sys_timestamp IS NOT NULL
    GROUP BY DATE(ds.sys_timestamp)
    HAVING quality_score >= umbral_calidad
    ORDER BY fecha;

    -- Recalcular totales por mes
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
        AVG(em.total_act_power) as total_watts_mes,
        (MAX(emd.total_act_energy) - MIN(emd.total_act_energy)) as total_kwh,
        ((MAX(emd.total_act_energy) - MIN(emd.total_act_energy)) * precio_kwh) as costo_total,
        COUNT(DISTINCT DATE(ds.sys_timestamp)) as days_with_data,
        COUNT(DISTINCT DATE(ds.sys_timestamp)) / DAY(LAST_DAY(ds.sys_timestamp)) as quality_score
    FROM device_status ds
    JOIN energy_meter em ON ds.em0_id = em.id
    JOIN energy_meter_data emd ON ds.emdata0_id = emd.id
    WHERE ds.sys_timestamp BETWEEN fecha_inicio AND fecha_fin
        AND ds.sys_timestamp IS NOT NULL
    GROUP BY YEAR(ds.sys_timestamp), MONTH(ds.sys_timestamp)
    HAVING quality_score >= umbral_calidad
    ORDER BY anio, mes;

    -- Commit de la transacción
    COMMIT;

    -- Retornar resumen de la operación
    SELECT 
        'Recálculo completado' as mensaje,
        fecha_inicio as fecha_desde,
        fecha_fin as fecha_hasta,
        precio_kwh as precio_utilizado,
        umbral_calidad as umbral_calidad_utilizado;

END //

DELIMITER ;