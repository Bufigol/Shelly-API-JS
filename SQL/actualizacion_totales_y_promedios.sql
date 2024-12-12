DELIMITER //

drop event actualizacion_totales_y_promedios //

CREATE EVENT actualizacion_totales_y_promedios
ON SCHEDULE EVERY 1 MINUTE
DO
BEGIN
-- Declaración de variables
    DECLARE v_hora_actual TIMESTAMP;
    DECLARE v_existe_registro INT;
    DECLARE v_success BOOLEAN;
    
-- Obtener la hora actual redondeada a la hora anterior
    SET v_hora_actual = DATE_FORMAT(NOW(), '%Y-%m-%d %H:00:00');
    
-- Verificar si existe un registro para la hora actual
    SELECT COUNT(*) INTO v_existe_registro
    FROM sem_totales_hora
    WHERE hora_local = v_hora_actual;

-- Bloque IF-ELSE para actualizar o crear registros
    IF v_existe_registro > 0 THEN
    
    -- Existe registro, actualizar
        SET v_success = fn_update_existing_totales_hora(v_hora_actual);
        
    -- Registrar resultado en auditoría
        IF NOT v_success THEN
            INSERT INTO sem_auditoria_detallada ( tipo_operacion, tabla_afectada, registro_id, usuario, datos_nuevos, aplicacion ) 
            VALUES ( 'UPDATE', 'sem_totales_hora', NULL, 'SYSTEM', JSON_OBJECT( 'hora_local', v_hora_actual, 'estado', 'ERROR', 'mensaje', 'Error al actualizar totales hora' ), 'EVENT_actualizacion_totales_y_promedios' );
        END IF;
    ELSE
	-- No existe registro, crear nuevo
        SET v_success = fn_create_new_totales_hora(v_hora_actual);
	-- Registrar resultado en auditoría
        IF NOT v_success THEN
            INSERT INTO sem_auditoria_detallada ( tipo_operacion, tabla_afectada, registro_id, usuario, datos_nuevos, aplicacion ) 
            VALUES ( 'INSERT', 'sem_totales_hora', NULL, 'SYSTEM', JSON_OBJECT( 'hora_local', v_hora_actual, 'estado', 'ERROR', 'mensaje', 'Error al crear totales hora' ), 'EVENT_actualizacion_totales_y_promedios' );
        END IF;
    END IF;

END //

DELIMITER ;