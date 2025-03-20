DELIMITER //

CREATE EVENT IF NOT EXISTS `generar_resumenes_faenas_evento`
ON SCHEDULE EVERY 5 MINUTE
STARTS CURRENT_TIMESTAMP
DO
BEGIN
    DECLARE done INT DEFAULT FALSE;
    DECLARE v_faena_id INT;
    DECLARE cursor_faenas CURSOR FOR 
        SELECT f.id_Faena
        FROM api_faena f
        LEFT JOIN (
            SELECT DISTINCT id_faena 
            FROM api_resumen_Datos_por_faena
        ) r ON f.id_Faena = r.id_faena
        WHERE f.fecha_fin IS NOT NULL  -- Sólo faenas cerradas
        AND r.id_faena IS NULL;  -- Sin resumen generado
    
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;
    
    -- Abrir cursor y procesar faenas pendientes
    OPEN cursor_faenas;
    
    read_loop: LOOP
        FETCH cursor_faenas INTO v_faena_id;
        IF done THEN
            LEAVE read_loop;
        END IF;
        
        -- Generar resumen para esta faena
        CALL generar_resumen_faena_mejorado(v_faena_id);
    END LOOP;
    
    CLOSE cursor_faenas;
END //

DELIMITER ;