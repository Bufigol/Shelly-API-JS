DELIMITER //

CREATE TRIGGER after_maquina_update
AFTER UPDATE ON api_maquina
FOR EACH ROW
BEGIN
    -- Verificar si el id_equipo ha cambiado
    IF OLD.id_equipo <> NEW.id_equipo THEN
        -- Insertar registro en la tabla de logs
        INSERT INTO api_log_maquinas_equipos (
            id_maquina,
            id_equipo_antiguo,
            id_equipo_nuevo,
            fecha_actualizacion
        ) VALUES (
            NEW.id_Maquina,
            OLD.id_equipo,
            NEW.id_equipo,
            NOW()
        );
    END IF;
END//

DELIMITER ;