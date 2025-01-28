-- Asegurarse que los eventos estén habilitados
SET GLOBAL event_scheduler = ON;

-- Eliminar el evento si ya existe
DROP EVENT IF EXISTS event_actualizar_totales;

-- Crear el evento
DELIMITER $$

CREATE EVENT event_actualizar_totales
ON SCHEDULE EVERY 5 MINUTE
STARTS CURRENT_TIMESTAMP
DO
BEGIN
    -- Declarar variables para manejar resultados
    DECLARE v_success_hora BOOLEAN;
    DECLARE v_success_dia BOOLEAN;
    DECLARE v_success_mes BOOLEAN;
    DECLARE v_hora_actual TIMESTAMP;
    DECLARE v_dia_actual DATE;
    DECLARE v_año_actual INT;
    DECLARE v_mes_actual INT;
    
    -- Obtener los valores actuales de tiempo
    SET v_hora_actual = DATE_FORMAT(NOW(), '%Y-%m-%d %H:00:00');
    SET v_dia_actual = CURRENT_DATE();
    SET v_año_actual = YEAR(CURRENT_DATE());
    SET v_mes_actual = MONTH(CURRENT_DATE());
    
    -- Registrar inicio de la actualización
    INSERT INTO sem_auditoria_detallada (
        tipo_operacion,
        tabla_afectada,
        usuario,
        datos_nuevos,
        fecha_operacion,
        direccion_ip,
        aplicacion
    ) VALUES (
        'INICIO_PROCESO',
        'MULTIPLE',
        'SYSTEM',
        JSON_OBJECT(
            'mensaje', 'Iniciando actualización de totales',
            'hora_ejecucion', NOW()
        ),
        CURRENT_TIMESTAMP(6),
        '127.0.0.1',
        'EVENT_actualizar_totales'
    );

    -- Actualizar totales por hora
    SET v_success_hora = fn_process_totales_hora(v_hora_actual);
    
    -- Actualizar totales por día
    SET v_success_dia = fn_process_totales_dia(v_dia_actual);
    
    -- Actualizar totales por mes
    SET v_success_mes = fn_process_totales_mes(v_año_actual, v_mes_actual);
    
    -- Registrar resultado de la actualización
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
            'mensaje', 'Finalización de actualización de totales',
            'hora_ejecucion', NOW(),
            'resultados', JSON_OBJECT(
                'actualizacion_hora', v_success_hora,
                'actualizacion_dia', v_success_dia,
                'actualizacion_mes', v_success_mes
            )
        ),
        CURRENT_TIMESTAMP(6),
        '127.0.0.1',
        'EVENT_actualizar_totales'
    );
    
END $$

DELIMITER ;