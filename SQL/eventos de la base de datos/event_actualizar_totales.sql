DELIMITER $$

DROP EVENT IF EXISTS event_actualizar_totales$$

CREATE EVENT event_actualizar_totales
ON SCHEDULE
    EVERY 5 MINUTE
    STARTS CURRENT_TIMESTAMP - INTERVAL (MINUTE(CURRENT_TIMESTAMP) % 5) MINUTE
    + INTERVAL (5 - (MINUTE(CURRENT_TIMESTAMP) % 5)) MINUTE
DO
BEGIN
    -- Declarar variables (deben estar al inicio del bloque)
    DECLARE v_success_hora BOOLEAN DEFAULT FALSE;
    DECLARE v_success_dia BOOLEAN DEFAULT FALSE;
    DECLARE v_success_mes BOOLEAN DEFAULT FALSE;
    DECLARE v_hora_actual TIMESTAMP;
    DECLARE v_hora_anterior TIMESTAMP;
    DECLARE v_dia_actual DATE;
    DECLARE v_dia_anterior DATE;
    DECLARE v_año_actual INT;
    DECLARE v_mes_actual INT;
    DECLARE v_error_message TEXT;
    
    -- Declarar handler para errores (debe estar después de las declaraciones)
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        GET DIAGNOSTICS CONDITION 1 
            v_error_message = MESSAGE_TEXT;
        
        INSERT INTO sem_auditoria_detallada (
            tipo_operacion,
            tabla_afectada,
            usuario,
            datos_nuevos,
            fecha_operacion,
            direccion_ip,
            aplicacion
        ) VALUES (
            'ERROR',
            'MULTIPLE',
            'SYSTEM',
            JSON_OBJECT(
                'mensaje', 'Error en actualización de totales',
                'error', v_error_message,
                'hora_ejecucion', NOW(),
                'minuto_ejecucion', MINUTE(NOW())
            ),
            CURRENT_TIMESTAMP(6),
            '127.0.0.1',
            'EVENT_actualizar_totales'
        );
    END;

    -- Verificar si es momento de ejecutar (después de las declaraciones)
    IF MINUTE(NOW()) MOD 5 = 0 THEN
        -- Configurar tiempos
        SET v_hora_actual = DATE_FORMAT(NOW(), '%Y-%m-%d %H:00:00');
        SET v_hora_anterior = DATE_SUB(v_hora_actual, INTERVAL 1 HOUR);
        SET v_dia_actual = CURRENT_DATE();
        SET v_dia_anterior = DATE_SUB(v_dia_actual, INTERVAL 1 DAY);
        SET v_año_actual = YEAR(CURRENT_DATE());
        SET v_mes_actual = MONTH(CURRENT_DATE());

        -- Log de inicio
        INSERT INTO sem_auditoria_detallada (
            tipo_operacion, tabla_afectada, usuario, datos_nuevos, 
            fecha_operacion, direccion_ip, aplicacion
        ) VALUES (
            'INICIO_PROCESO', 'MULTIPLE', 'SYSTEM',
            JSON_OBJECT(
                'mensaje', 'Iniciando actualización de totales',
                'hora_actual', v_hora_actual,
                'minuto_ejecucion', MINUTE(NOW())
            ),
            CURRENT_TIMESTAMP(6), '127.0.0.1', 'EVENT_actualizar_totales'
        );

        -- Procesar hora actual
        SET v_success_hora = fn_process_totales_hora(v_hora_actual);
        
        -- Procesar día actual
        SET v_success_dia = fn_process_totales_dia(v_dia_actual);
        
        -- Procesar mes actual
        SET v_success_mes = fn_process_totales_mes(v_año_actual, v_mes_actual);

        -- Registro final
        INSERT INTO sem_auditoria_detallada (
            tipo_operacion,
            tabla_afectada,
            usuario,
            datos_nuevos,
            fecha_operacion,
            direccion_ip,
            aplicacion
        ) VALUES (
            'FIN_PROCESO',
            'MULTIPLE',
            'SYSTEM',
            JSON_OBJECT(
                'mensaje', 'Finalización de proceso',
                'hora_ejecucion', NOW(),
                'minuto_ejecucion', MINUTE(NOW()),
                'resultados', JSON_OBJECT(
                    'hora', v_success_hora,
                    'dia', v_success_dia,
                    'mes', v_success_mes
                )
            ),
            CURRENT_TIMESTAMP(6),
            '127.0.0.1',
            'EVENT_actualizar_totales'
        );
    END IF;
END$$

DELIMITER ;
