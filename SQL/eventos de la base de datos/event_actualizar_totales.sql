DELIMITER $$

-- Eliminar eventos existentes
DROP EVENT IF EXISTS event_actualizar_totales_hora$$
DROP EVENT IF EXISTS event_actualizar_totales_dia$$
DROP EVENT IF EXISTS event_actualizar_totales_mes$$

-- Evento para actualización por hora (cada 15 minutos)
CREATE EVENT event_actualizar_totales_hora
ON SCHEDULE EVERY 15 MINUTE
STARTS CURRENT_TIMESTAMP
DO
BEGIN
    DECLARE v_success_hora BOOLEAN DEFAULT FALSE;
    DECLARE v_hora_actual TIMESTAMP;
    DECLARE v_error_message TEXT;
    
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        GET DIAGNOSTICS CONDITION 1 v_error_message = MESSAGE_TEXT;
        INSERT INTO sem_auditoria_detallada (
            tipo_operacion, tabla_afectada, usuario, datos_nuevos, 
            fecha_operacion, direccion_ip, aplicacion
        ) VALUES (
            'ERROR', 'sem_totales_hora', 'SYSTEM',
            JSON_OBJECT(
                'mensaje', 'Error en actualización de totales hora',
                'error', v_error_message,
                'hora_ejecucion', NOW()
            ),
            CURRENT_TIMESTAMP(6), '127.0.0.1', 'EVENT_actualizar_totales_hora'
        );
    END;

    SET v_hora_actual = DATE_FORMAT(NOW(), '%Y-%m-%d %H:00:00');
    SET v_success_hora = fn_process_totales_hora(v_hora_actual);

    IF v_success_hora THEN
        INSERT INTO sem_auditoria_detallada (
            tipo_operacion, tabla_afectada, usuario, datos_nuevos, 
            fecha_operacion, direccion_ip, aplicacion
        ) VALUES (
            'ACTUALIZACION', 'sem_totales_hora', 'SYSTEM',
            JSON_OBJECT(
                'mensaje', 'Actualización exitosa de totales hora',
                'hora_procesada', v_hora_actual
            ),
            CURRENT_TIMESTAMP(6), '127.0.0.1', 'EVENT_actualizar_totales_hora'
        );
    END IF;
END$$

-- Evento para actualización diaria (cada hora)
CREATE EVENT event_actualizar_totales_dia
ON SCHEDULE EVERY 1 HOUR
STARTS CURRENT_TIMESTAMP
DO
BEGIN
    DECLARE v_success_dia BOOLEAN DEFAULT FALSE;
    DECLARE v_dia_actual DATE;
    DECLARE v_error_message TEXT;
    
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        GET DIAGNOSTICS CONDITION 1 v_error_message = MESSAGE_TEXT;
        INSERT INTO sem_auditoria_detallada (
            tipo_operacion, tabla_afectada, usuario, datos_nuevos, 
            fecha_operacion, direccion_ip, aplicacion
        ) VALUES (
            'ERROR', 'sem_totales_dia', 'SYSTEM',
            JSON_OBJECT(
                'mensaje', 'Error en actualización de totales día',
                'error', v_error_message,
                'hora_ejecucion', NOW()
            ),
            CURRENT_TIMESTAMP(6), '127.0.0.1', 'EVENT_actualizar_totales_dia'
        );
    END;

    SET v_dia_actual = CURRENT_DATE();
    SET v_success_dia = fn_process_totales_dia(v_dia_actual);

    IF v_success_dia THEN
        INSERT INTO sem_auditoria_detallada (
            tipo_operacion, tabla_afectada, usuario, datos_nuevos, 
            fecha_operacion, direccion_ip, aplicacion
        ) VALUES (
            'ACTUALIZACION', 'sem_totales_dia', 'SYSTEM',
            JSON_OBJECT(
                'mensaje', 'Actualización exitosa de totales día',
                'dia_procesado', v_dia_actual
            ),
            CURRENT_TIMESTAMP(6), '127.0.0.1', 'EVENT_actualizar_totales_dia'
        );
    END IF;
END$$

-- Evento para actualización mensual (una vez al día a las 00:05)
CREATE EVENT event_actualizar_totales_mes
ON SCHEDULE EVERY 1 DAY
STARTS CURRENT_TIMESTAMP
DO
BEGIN
    DECLARE v_success_mes BOOLEAN DEFAULT FALSE;
    DECLARE v_año_actual INT;
    DECLARE v_mes_actual INT;
    DECLARE v_error_message TEXT;
    
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        GET DIAGNOSTICS CONDITION 1 v_error_message = MESSAGE_TEXT;
        INSERT INTO sem_auditoria_detallada (
            tipo_operacion, tabla_afectada, usuario, datos_nuevos, 
            fecha_operacion, direccion_ip, aplicacion
        ) VALUES (
            'ERROR', 'sem_totales_mes', 'SYSTEM',
            JSON_OBJECT(
                'mensaje', 'Error en actualización de totales mes',
                'error', v_error_message,
                'hora_ejecucion', NOW()
            ),
            CURRENT_TIMESTAMP(6), '127.0.0.1', 'EVENT_actualizar_totales_mes'
        );
    END;

    SET v_año_actual = YEAR(CURRENT_DATE());
    SET v_mes_actual = MONTH(CURRENT_DATE());
    SET v_success_mes = fn_process_totales_mes(v_año_actual, v_mes_actual);

    IF v_success_mes THEN
        INSERT INTO sem_auditoria_detallada (
            tipo_operacion, tabla_afectada, usuario, datos_nuevos, 
            fecha_operacion, direccion_ip, aplicacion
        ) VALUES (
            'ACTUALIZACION', 'sem_totales_mes', 'SYSTEM',
            JSON_OBJECT(
                'mensaje', 'Actualización exitosa de totales mes',
                'año', v_año_actual,
                'mes', v_mes_actual
            ),
            CURRENT_TIMESTAMP(6), '127.0.0.1', 'EVENT_actualizar_totales_mes'
        );
    END IF;
END$$

DELIMITER ;
