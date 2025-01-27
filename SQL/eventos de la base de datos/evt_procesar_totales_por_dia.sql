DELIMITER //

-- Asegurarse de que los eventos están habilitados
SET GLOBAL event_scheduler = ON //

-- Eliminar el evento si existe
DROP EVENT IF EXISTS evt_procesar_totales_por_dia //

-- Crear el evento
CREATE EVENT evt_procesar_totales_por_dia
ON SCHEDULE EVERY 1 HOUR
STARTS CURRENT_TIMESTAMP + INTERVAL (
    60 - MINUTE(CONVERT_TZ(CURRENT_TIMESTAMP, @@session.time_zone, '-03:00'))
) MINUTE - INTERVAL SECOND(CONVERT_TZ(CURRENT_TIMESTAMP, @@session.time_zone, '-03:00')) SECOND
ON COMPLETION PRESERVE
DO
BEGIN
    DECLARE v_current_date DATE;
    DECLARE v_processed BOOLEAN;

    -- Obtener la fecha actual en -03:00
    SET v_current_date = CONVERT_TZ(CURDATE(), @@session.time_zone, '-03:00');

    -- Procesar el día actual
    SET v_processed = fn_process_totales_dia(v_current_date);

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
        'sem_totales_dia',
        NULL,
        'SYSTEM',
        JSON_OBJECT(
            'evento', 'evt_procesar_totales_por_dia',
            'fecha_procesada', v_current_date,
            'resultado', IF(v_processed, 'EXITOSO', 'SIN_CAMBIOS')
        ),
        CURRENT_TIMESTAMP(6),
        '127.0.0.1',
        'EVENT_SCHEDULER'
    );
END //

DELIMITER ;