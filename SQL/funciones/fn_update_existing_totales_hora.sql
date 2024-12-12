DELIMITER //

DROP FUNCTION IF EXISTS fn_update_existing_totales_hora //

CREATE FUNCTION fn_update_existing_totales_hora(
    p_hora_local TIMESTAMP
) RETURNS BOOLEAN
DETERMINISTIC
BEGIN
    DECLARE v_id_totales_hora BIGINT;
    DECLARE v_success BOOLEAN DEFAULT FALSE;
    DECLARE v_precio_kwh DECIMAL(10,2);
    
    -- Obtener el ID del registro a actualizar
    SELECT id 
    INTO v_id_totales_hora 
    FROM sem_totales_hora 
    WHERE hora_local = p_hora_local;
    
    -- Obtener el precio del kWh vigente
    SELECT CAST(valor AS DECIMAL(10,2))
    INTO v_precio_kwh
    FROM sem_configuracion c
    JOIN sem_tipos_parametros tp ON c.tipo_parametro_id = tp.id
    WHERE tp.nombre = 'PRECIO_KWH'
    AND c.activo = 1
    AND c.valido_desde <= p_hora_local
    AND (c.valido_hasta IS NULL OR c.valido_hasta > p_hora_local)
    LIMIT 1;
    
    -- Intentar actualizar usando la función de actualización existente
    IF fn_actualizar_totales_hora(v_id_totales_hora, p_hora_local) THEN
        -- Actualización exitosa
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
            'UPDATE', 
            'sem_totales_hora', 
            v_id_totales_hora, 
            'SYSTEM', 
            (SELECT JSON_OBJECT(
                'hora_local', hora_local,
                'energia_activa_total', energia_activa_total,
                'energia_reactiva_total', energia_reactiva_total,
                'precio_kwh_periodo', precio_kwh_periodo,
                'costo_total', costo_total
            ) FROM sem_totales_hora WHERE id = v_id_totales_hora),
            (SELECT JSON_OBJECT(
                'hora_local', hora_local,
                'energia_activa_total', energia_activa_total,
                'energia_reactiva_total', energia_reactiva_total,
                'precio_kwh_periodo', precio_kwh_periodo,
                'costo_total', costo_total,
                'estado_actualizacion', 'EXITOSO'
            ) FROM sem_totales_hora WHERE id = v_id_totales_hora),
            CURRENT_TIMESTAMP(6),
            '127.0.0.1',
            'EVENT_actualizacion_totales_y_promedios'
        );
        
        SET v_success = TRUE;
    ELSE
        -- Manejar el error
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
            'UPDATE', 
            'sem_totales_hora', 
            v_id_totales_hora, 
            'SYSTEM', 
            NULL, 
            JSON_OBJECT(
                'hora_local', p_hora_local,
                'precio_kwh', v_precio_kwh,
                'estado_actualizacion', 'ERROR',
                'mensaje', 'Error en actualización de totales por hora'
            ),
            CURRENT_TIMESTAMP(6),
            '127.0.0.1',
            'EVENT_actualizacion_totales_y_promedios'
        );
        
        SET v_success = FALSE;
    END IF;
    
    RETURN v_success;
END //

DELIMITER ;