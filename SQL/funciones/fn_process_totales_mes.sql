DELIMITER //

CREATE DEFINER=`root`@`localhost` FUNCTION `fn_process_totales_mes`(
    p_anio INT,
    p_mes INT
) RETURNS tinyint(1)
    DETERMINISTIC
BEGIN
    DECLARE v_id_totales_mes BIGINT;
    DECLARE v_success BOOLEAN DEFAULT FALSE;
    DECLARE v_registro_existe BOOLEAN;
    DECLARE v_datos_anteriores JSON;
    DECLARE v_primer_dia_mes DATE;
    DECLARE v_ultimo_dia_mes DATE;
    DECLARE v_intervalo_segundos INT DEFAULT 10;
    DECLARE v_total_costo DECIMAL(15,2) DEFAULT 0;
    DECLARE v_total_energia_activa DECIMAL(15,3) DEFAULT 0;

    -- Definir el intervalo del mes
    SET v_primer_dia_mes = DATE(CONCAT(p_anio, '-', LPAD(p_mes, 2, '0'), '-01'));
    SET v_ultimo_dia_mes = LAST_DAY(v_primer_dia_mes);

    -- Verificar si existe el registro
    SELECT EXISTS(
        SELECT 1 
        FROM sem_totales_mes
        WHERE anio = p_anio AND mes = p_mes
        LIMIT 1
    ) INTO v_registro_existe;
    
    -- Si existe, obtener el ID
    IF v_registro_existe THEN
        SELECT id INTO v_id_totales_mes
        FROM sem_totales_mes
        WHERE anio = p_anio AND mes = p_mes
        LIMIT 1;
    END IF;

    -- Guardar datos anteriores para auditoría si existe el registro
    IF v_registro_existe THEN
        SELECT JSON_OBJECT(
            'anio', anio,
            'mes', mes,
            'energia_activa_total', energia_activa_total,
            'energia_reactiva_total', energia_reactiva_total,
            'potencia_maxima', potencia_maxima,
            'potencia_minima', potencia_minima,
            'precio_kwh_promedio', precio_kwh_promedio,
            'costo_total', costo_total,
            'dias_con_datos', dias_con_datos,
             'horas_con_datos', horas_con_datos
        ) INTO v_datos_anteriores
        FROM sem_totales_mes
        WHERE id = v_id_totales_mes;
    END IF;


   -- Calcular el costo total y la energia activa total ponderando el precio del kWh por el consumo diario
    SELECT 
        SUM(daily_cost),
        SUM(daily_energy)
    INTO
        v_total_costo,
        v_total_energia_activa
    FROM
    (
        SELECT
            (SUM(m.potencia_activa * v_intervalo_segundos) / (3600 * 1000)) * 
            (SELECT CAST(valor AS DECIMAL(10,2))
                FROM sem_configuracion c
                JOIN sem_tipos_parametros tp ON c.tipo_parametro_id = tp.id
                WHERE tp.nombre = 'PRECIO_KWH'
                AND c.activo = 1
                AND c.valido_desde <= DATE(m.timestamp_local)
                AND (c.valido_hasta IS NULL OR c.valido_hasta > DATE(m.timestamp_local))
                LIMIT 1
            ) as daily_cost,
           (SUM(m.potencia_activa * v_intervalo_segundos) / (3600 * 1000)) AS daily_energy
        FROM sem_mediciones m
        WHERE m.timestamp_local >= v_primer_dia_mes
        AND m.timestamp_local <= v_ultimo_dia_mes
        AND m.fase = 'TOTAL'
        AND m.calidad_lectura IN ('NORMAL', 'INTERPOLADA')
        GROUP BY DATE(m.timestamp_local)
    ) as daily_data;

    -- Crear o actualizar registro usando UPSERT
    INSERT INTO sem_totales_mes (
        shelly_id,
        anio,
        mes,
        energia_activa_total,
        energia_reactiva_total,
        potencia_maxima,
        potencia_minima,
        precio_kwh_promedio,
        costo_total,
         dias_con_datos,
        horas_con_datos
    )
    SELECT 
        m.shelly_id,
        p_anio,
        p_mes,
        -- Cálculo corregido de energía activa en kWh: (SUM(potencia_activa) * intervalo_segundos) / (3600 * 1000)
        (SUM(m.potencia_activa * v_intervalo_segundos) / (3600 * 1000)) AS energia_activa_total,
         -- Cálculo corregido de energía reactiva en kvarh:  (SUM(potencia_aparente * SQRT(1 - POWER(factor_potencia, 2))) * intervalo_segundos) / (3600 * 1000)
        (SUM(m.potencia_aparente * v_intervalo_segundos * SQRT(1 - POWER(m.factor_potencia, 2))) / (3600 * 1000)) as energia_reactiva_total,
        MAX(m.potencia_activa) as potencia_maxima,
        MIN(m.potencia_activa) as potencia_minima,
       -- Cálculo del precio kwh promedio ponderado
        IFNULL(v_total_costo / v_total_energia_activa, 0) as precio_kwh_promedio,
        -- Costo total calculado previamente
        v_total_costo as costo_total,
         COUNT(DISTINCT DATE(m.timestamp_local)) as dias_con_datos,
        COUNT(DISTINCT HOUR(m.timestamp_local)) as horas_con_datos
    FROM sem_mediciones m
    WHERE m.timestamp_local >= v_primer_dia_mes
    AND m.timestamp_local <= v_ultimo_dia_mes
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
        dias_con_datos = VALUES(dias_con_datos),
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
            'sem_totales_mes',
            COALESCE(v_id_totales_mes, LAST_INSERT_ID()),
            'SYSTEM',
            v_datos_anteriores,
            (SELECT JSON_OBJECT(
                'anio', anio,
                'mes', mes,
                'energia_activa_total', energia_activa_total,
                'energia_reactiva_total', energia_reactiva_total,
                'potencia_maxima', potencia_maxima,
                'potencia_minima', potencia_minima,
                'precio_kwh_promedio', precio_kwh_promedio,
                'costo_total', costo_total,
                'dias_con_datos', dias_con_datos,
                 'horas_con_datos', horas_con_datos,
                'estado_actualizacion', 'EXITOSO'
            ) FROM sem_totales_mes WHERE id = COALESCE(v_id_totales_mes, LAST_INSERT_ID())),
            CURRENT_TIMESTAMP(6),
            '127.0.0.1',
            'EVENT_actualizacion_totales_mensuales'
        );
        SET v_success = TRUE;
    END IF;

    RETURN v_success;
END
