DELIMITER //

CREATE TRIGGER `after_faena_insert_set_id_externo` AFTER INSERT ON `api_faena` FOR EACH ROW
BEGIN
    DECLARE v_identificador_externo VARCHAR(45);
    DECLARE v_primera_entrada_timestamp TIMESTAMP;
    DECLARE v_unix_timestamp BIGINT;
    DECLARE v_id_externo VARCHAR(100);
    
    -- Skip processing if trigger is disabled via session variable
    IF @TRIGGER_DISABLED IS NULL THEN
        -- Obtener el identificador externo de la máquina asociada
        SELECT identificador_externo INTO v_identificador_externo
        FROM api_maquina
        WHERE id_Maquina = NEW.id_maquina;
        
        -- Obtener el timestamp de la primera entrada de datos (que debe existir)
        SELECT timestamp_dato INTO v_primera_entrada_timestamp
        FROM api_datos_por_faena
        WHERE id_faena = NEW.id_Faena
        ORDER BY timestamp_dato ASC
        LIMIT 1;
        
        -- Si existe entrada de datos, generar el ID externo
        IF v_primera_entrada_timestamp IS NOT NULL THEN
            -- Convertir timestamp a Unix (segundos desde 1970-01-01)
            SET v_unix_timestamp = UNIX_TIMESTAMP(v_primera_entrada_timestamp);
            
            -- Generar el id externo con el formato [identificador_maquina]_[unix_timestamp]
            SET v_id_externo = CONCAT(v_identificador_externo, '_', v_unix_timestamp);
            
            -- Actualizar la faena con el id_Faena_externo generado
            UPDATE api_faena
            SET id_Faena_externo = v_id_externo
            WHERE id_Faena = NEW.id_Faena;
        ELSE
            -- En caso de que no exista aún el dato (aunque no debería ocurrir según la lógica del sistema)
            -- Usar el timestamp de creación de la faena como alternativa
            SET v_unix_timestamp = UNIX_TIMESTAMP(NEW.fecha_inico);
            
            -- Generar el id externo con el formato [identificador_maquina]_[unix_timestamp]
            SET v_id_externo = CONCAT(v_identificador_externo, '_', v_unix_timestamp);
            
            -- Actualizar la faena con el id_Faena_externo generado
            UPDATE api_faena
            SET id_Faena_externo = v_id_externo
            WHERE id_Faena = NEW.id_Faena;
        END IF;
    END IF;
END//

DELIMITER ;