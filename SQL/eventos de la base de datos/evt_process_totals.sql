DELIMITER //

-- Asegurarse que los eventos están habilitados
SET GLOBAL event_scheduler = ON //

-- Eliminar el evento si existe
DROP EVENT IF EXISTS evt_process_totals //

-- Crear el evento
CREATE EVENT evt_process_totals
ON SCHEDULE  EVERY 5 MINUTE
STARTS CURRENT_TIMESTAMP + INTERVAL (60 - MINUTE(CONVERT_TZ(CURRENT_TIMESTAMP, @@session.time_zone, '-03:00'))
) MINUTE - INTERVAL SECOND(CONVERT_TZ(CURRENT_TIMESTAMP, @@session.time_zone, '-03:00')) SECOND
ON COMPLETION PRESERVE
DO
BEGIN
    DECLARE v_previous_hour TIMESTAMP;
    DECLARE v_current_hour TIMESTAMP;
    DECLARE v_processed_previous BOOLEAN;
    DECLARE v_processed_current BOOLEAN;
    
    -- Obtener la hora actual y la anterior
    SET v_current_hour = DATE_FORMAT(NOW(), '%Y-%m-%d %H:00:00');
    SET v_previous_hour = DATE_SUB(v_current_hour, INTERVAL 1 HOUR);
    
    -- Procesar ambas horas
    SET v_processed_previous = fn_process_totales_hora(v_previous_hour);
    SET v_processed_current = fn_process_totales_hora(v_current_hour);
    
    -- Registrar la ejecución del evento
    INSERT INTO sem_auditoria_detallada (
        tipo_operacion,
        tabla_afectada,
        registro_id,
        usuario,
        datos_nuevos,
        fecha_operacion,
        direccion_ip,
        aplicacion
    ) VALUES (
        'EVENT',
        'sem_totales_hora',
        NULL,
        'SYSTEM',
        JSON_OBJECT(
            'evento', 'evt_process_totals',
            'hora_anterior_procesada', v_previous_hour,
            'resultado_hora_anterior', IF(v_processed_previous, 'EXITOSO', 'SIN_CAMBIOS'),
            'hora_actual_procesada', v_current_hour,
            'resultado_hora_actual', IF(v_processed_current, 'EXITOSO', 'SIN_CAMBIOS'),
            'total_periodos_actualizados', v_processed_previous + v_processed_current
        ),
        CURRENT_TIMESTAMP(6),
        '127.0.0.1',
        'EVENT_SCHEDULER'
    );
END //

DELIMITER ;