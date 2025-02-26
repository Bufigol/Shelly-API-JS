DELIMITER //

-- Procedimiento para generar el resumen de una faena
CREATE PROCEDURE generar_resumen_faena(IN p_faena_id INT)
BEGIN
    DECLARE v_porcentaje_verde DOUBLE;
    DECLARE v_valor_verde VARCHAR(45);
    DECLARE v_done INT DEFAULT FALSE;
    DECLARE v_punto_id INT;
    DECLARE v_lat DOUBLE;
    DECLARE v_lon DOUBLE;
    DECLARE v_temp DOUBLE;
    DECLARE v_calidad VARCHAR(45);
    DECLARE v_timestamp TIMESTAMP;
    DECLARE v_max_dist DOUBLE DEFAULT 0;
    DECLARE v_p1_lat DOUBLE;
    DECLARE v_p1_lon DOUBLE;
    DECLARE v_p2_lat DOUBLE;
    DECLARE v_p2_lon DOUBLE;
    DECLARE v_segment_min_dist DOUBLE;
    DECLARE v_segment_max_dist DOUBLE;
    DECLARE v_segment_p1_lat DOUBLE;
    DECLARE v_segment_p1_lon DOUBLE;
    DECLARE v_segment_p2_lat DOUBLE;
    DECLARE v_segment_p2_lon DOUBLE;
    
    -- Cursor para obtener todos los puntos de la faena
    DECLARE punto_cursor CURSOR FOR 
        SELECT idDatos_por_faena, latitud, longitud, temperatura, calidad_temperatura, timestamp_dato
        FROM api_datos_por_faena
        WHERE id_faena = p_faena_id
        ORDER BY timestamp_dato;
    
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done = TRUE;
    
    -- Obtener configuración - porcentaje verde
    SELECT CAST(valor AS DOUBLE) INTO v_porcentaje_verde
    FROM api_configuracion
    WHERE id_api_configuracion = 17;  -- porcentaje verde en faena
    
    -- Obtener nombre semáforo verde
    SELECT valor INTO v_valor_verde
    FROM api_configuracion
    WHERE id_api_configuracion = 7;   -- nombre semaforo verde

    -- Crear tablas temporales para el procesamiento
    DROP TEMPORARY TABLE IF EXISTS temp_puntos;
    CREATE TEMPORARY TABLE temp_puntos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        original_id INT,
        lat DOUBLE,
        lon DOUBLE,
        temp DOUBLE,
        calidad VARCHAR(45),
        timestamp_punto TIMESTAMP,
        distance_from_start DOUBLE DEFAULT 0,
        segment INT DEFAULT 0
    );
    
    -- Llenamos la tabla con los puntos de la faena
    OPEN punto_cursor;
    read_loop: LOOP
        FETCH punto_cursor INTO v_punto_id, v_lat, v_lon, v_temp, v_calidad, v_timestamp;
        IF v_done THEN
            LEAVE read_loop;
        END IF;
        
        INSERT INTO temp_puntos(original_id, lat, lon, temp, calidad, timestamp_punto)
        VALUES (v_punto_id, v_lat, v_lon, v_temp, v_calidad, v_timestamp);
    END LOOP;
    CLOSE punto_cursor;
    
    -- 1. Encontrar los dos puntos más distantes (extremos reales de la faena)
    DROP TEMPORARY TABLE IF EXISTS temp_distancias;
    CREATE TEMPORARY TABLE temp_distancias AS
    SELECT p1.id AS id1, p1.lat AS lat1, p1.lon AS lon1, 
           p2.id AS id2, p2.lat AS lat2, p2.lon AS lon2, 
           calcular_distancia_en_metros(p1.lat, p1.lon, p2.lat, p2.lon) as dist
    FROM temp_puntos p1
    CROSS JOIN temp_puntos p2
    WHERE p1.id < p2.id
    ORDER BY dist DESC
    LIMIT 1;
    
    -- Obtener los puntos extremos
    SELECT lat1, lon1, lat2, lon2, dist 
    INTO v_p1_lat, v_p1_lon, v_p2_lat, v_p2_lon, v_max_dist
    FROM temp_distancias;
    
    -- 2. Calcular la distancia de cada punto desde el punto extremo p1
    UPDATE temp_puntos 
    SET distance_from_start = calcular_distancia_en_metros(v_p1_lat, v_p1_lon, lat, lon);
    
    -- 3. Dividir la distancia total en 5 segmentos y asignar cada punto a un segmento
    UPDATE temp_puntos
    SET segment = FLOOR(5 * distance_from_start / v_max_dist) + 1;
    
    -- Corregir los puntos que caen exactamente en el límite entre segmentos
    UPDATE temp_puntos SET segment = 5 WHERE segment > 5;
    
    -- 4. Procesar estadísticas para cada segmento
    DELETE FROM api_resumen_Datos_por_faena WHERE id_faena = p_faena_id;
    
    -- Para cada segmento (1 a 5)
    SET @i = 1;
    segmentos_loop: WHILE @i <= 5 DO
        -- Encontrar los límites del segmento
        SET v_segment_min_dist = (@i-1) * v_max_dist / 5;
        SET v_segment_max_dist = @i * v_max_dist / 5;
        
        -- Encontrar los puntos más cercanos a los límites del segmento
        SELECT lat, lon INTO v_segment_p1_lat, v_segment_p1_lon
        FROM temp_puntos
        ORDER BY ABS(distance_from_start - v_segment_min_dist)
        LIMIT 1;
        
        SELECT lat, lon INTO v_segment_p2_lat, v_segment_p2_lon
        FROM temp_puntos
        ORDER BY ABS(distance_from_start - v_segment_max_dist)
        LIMIT 1;
        
        -- Obtener estadísticas del segmento
        DROP TEMPORARY TABLE IF EXISTS temp_stats;
        CREATE TEMPORARY TABLE temp_stats AS
        SELECT 
            MAX(temp) AS max_temp,
            MIN(temp) AS min_temp,
            AVG(temp) AS avg_temp,
            COUNT(*) AS punto_count,
            SUM(CASE WHEN calidad = v_valor_verde THEN 1 ELSE 0 END) AS verde_count
        FROM temp_puntos
        WHERE segment = @i;
        
        -- Obtener valores de las estadísticas
        SELECT max_temp, min_temp, avg_temp, punto_count, verde_count 
        INTO @max_temp, @min_temp, @avg_temp, @punto_count, @verde_count
        FROM temp_stats;
        
        -- Calcular número de pasadas
        DROP TEMPORARY TABLE IF EXISTS temp_pasadas;
        CREATE TEMPORARY TABLE temp_pasadas AS
        SELECT COUNT(*) AS num_pasadas
        FROM (
            SELECT 
                DATE_FORMAT(timestamp_punto, '%Y-%m-%d %H:%i') AS time_group,
                COUNT(*) AS segment_visits
            FROM temp_puntos
            WHERE segment = @i
            GROUP BY time_group
        ) AS segment_changes;
        
        SELECT num_pasadas INTO @pasadas FROM temp_pasadas;
        
        -- Si no hay pasadas pero hay puntos, al menos hay una pasada
        IF @pasadas = 0 AND @punto_count > 0 THEN
            SET @pasadas = 1;
        END IF;
        
        -- Verificar si cumple con el porcentaje de verde requerido
        SET @verde_pct = IF(@punto_count > 0, (@verde_count / @punto_count * 100), 0);
        SET @cumple_rango = IF(@verde_pct >= v_porcentaje_verde, 1, 0);
        
        -- Insertar el registro de resumen para este segmento
        INSERT INTO api_resumen_Datos_por_faena (
            id_faena,
            cuarto,
            temperatura_maxima,
            temperatura_minima,
            promedio_temperatura,
            latitud_inicio,
            longitud_inicio,
            latitud_final,
            longitud_final,
            numero_pasadas,
            cumple_rango_temperatura
        ) VALUES (
            p_faena_id,
            @i,
            @max_temp,
            @min_temp,
            @avg_temp,
            v_segment_p1_lat,
            v_segment_p1_lon,
            v_segment_p2_lat,
            v_segment_p2_lon,
            @pasadas,
            @cumple_rango
        );
        
        SET @i = @i + 1;
    END WHILE segmentos_loop;
    
    -- Limpiar las tablas temporales
    DROP TEMPORARY TABLE IF EXISTS temp_puntos;
    DROP TEMPORARY TABLE IF EXISTS temp_distancias;
    DROP TEMPORARY TABLE IF EXISTS temp_stats;
    DROP TEMPORARY TABLE IF EXISTS temp_pasadas;
END//

DELIMITER ;