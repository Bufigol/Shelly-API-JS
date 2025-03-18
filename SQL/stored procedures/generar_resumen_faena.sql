USE `teltonika`;
DROP procedure IF EXISTS `generar_resumen_faena_mejorado`;

USE `teltonika`;
DROP procedure IF EXISTS `teltonika`.`generar_resumen_faena_mejorado`;
;
DELIMITER $$
USE `teltonika`$$

CREATE DEFINER=`root`@`%` PROCEDURE `generar_resumen_faena_mejorado`(IN p_id_faena INT)
main_proc: BEGIN
    DECLARE v_total_distancia DOUBLE DEFAULT 0;
    DECLARE v_longitud_tramo DOUBLE DEFAULT 0;
    DECLARE v_distancia_acumulada DOUBLE DEFAULT 0;
    DECLARE v_temperatura_max DOUBLE;
    DECLARE v_temperatura_min DOUBLE;
    DECLARE v_temperatura_promedio DOUBLE;
    DECLARE v_latitud_inicio DOUBLE;
    DECLARE v_longitud_inicio DOUBLE;
    DECLARE v_latitud_final DOUBLE;
    DECLARE v_longitud_final DOUBLE;
    DECLARE v_punto_anterior_lat DOUBLE;
    DECLARE v_punto_anterior_lon DOUBLE;
    DECLARE v_punto_actual_lat DOUBLE;
    DECLARE v_punto_actual_lon DOUBLE;
    DECLARE v_distancia_entre_puntos DOUBLE;
    DECLARE v_numero_pasadas INT DEFAULT 0;
    DECLARE v_cumple_rango TINYINT DEFAULT 1;
    DECLARE v_punto_inicio_tramo INT DEFAULT 1;
    DECLARE v_temperatura_umbral_min DOUBLE;
    DECLARE v_temperatura_umbral_max DOUBLE;
    DECLARE v_verde_min DOUBLE;
    DECLARE v_verde_max DOUBLE;
    DECLARE v_porcentaje_verde_requerido DOUBLE;
    DECLARE v_puntos_verdes INT DEFAULT 0;
    DECLARE v_total_puntos INT DEFAULT 0;
    DECLARE v_porcentaje_verde DOUBLE DEFAULT 0;
    DECLARE i INT DEFAULT 1;
    
    -- Obtener los umbrales de temperatura para verificar cumplimiento
    SELECT CAST(valor AS DOUBLE) INTO v_temperatura_umbral_min
    FROM api_configuracion
    WHERE id_api_configuracion = 2;  -- Valor mínimo semáforo rojo por debajo (90°C)
    
    -- Obtener temperatura máxima de otro parámetro 
    SELECT CAST(valor AS DOUBLE) INTO v_temperatura_umbral_max
    FROM api_configuracion
    WHERE id_api_configuracion = 16;  -- Máximo semáforo rojo por alto (160°C)
    
    -- Obtener los límites del rango verde (entre amarillo bajo y amarillo alto)
    SELECT CAST(valor AS DOUBLE) INTO v_verde_min
    FROM api_configuracion
    WHERE id_api_configuracion = 4;  -- Valor mínimo semáforo amarillo por debajo (100°C)
    
    SELECT CAST(valor AS DOUBLE) INTO v_verde_max
    FROM api_configuracion
    WHERE id_api_configuracion = 8;  -- Valor mínimo semáforo amarillo por alto (150°C)
    
    -- Obtener el porcentaje verde requerido
    SELECT CAST(valor AS DOUBLE) INTO v_porcentaje_verde_requerido
    FROM api_configuracion
    WHERE id_api_configuracion = 17;  -- Porcentaje verde en faena (90%)
    
    -- Prevenir procesamiento recursivo si ya está en progreso
    IF @GENERATING_SUMMARY IS TRUE THEN
        SIGNAL SQLSTATE '45000' 
        SET MESSAGE_TEXT = 'Procesamiento recursivo detectado y evitado';
        LEAVE main_proc;
    END IF;
    
    -- Verificar si la faena existe y está cerrada
    IF NOT EXISTS (
        SELECT 1 FROM api_faena 
        WHERE id_Faena = p_id_faena 
        AND fecha_fin IS NOT NULL
    ) THEN
        SIGNAL SQLSTATE '45000' 
        SET MESSAGE_TEXT = 'Faena no encontrada o no finalizada';
        LEAVE main_proc;
    END IF;
    
    -- Calcular la distancia total de la faena
    -- Primero obtenemos los datos ordenados por tiempo
    DROP TEMPORARY TABLE IF EXISTS temp_puntos_ordenados;
    CREATE TEMPORARY TABLE temp_puntos_ordenados AS
    SELECT 
        idDatos_por_faena, 
        timestamp_dato, 
        temperatura, 
        latitud, 
        longitud,
        calidad_temperatura
    FROM api_datos_por_faena
    WHERE id_faena = p_id_faena
    ORDER BY timestamp_dato;
    
    -- Calcular distancia total y obtener puntos iniciales/finales
    SELECT 
        latitud INTO v_latitud_inicio
    FROM temp_puntos_ordenados
    ORDER BY timestamp_dato
    LIMIT 1;
    
    SELECT 
        longitud INTO v_longitud_inicio
    FROM temp_puntos_ordenados
    ORDER BY timestamp_dato
    LIMIT 1;
    
    SELECT 
        latitud INTO v_latitud_final
    FROM temp_puntos_ordenados
    ORDER BY timestamp_dato DESC
    LIMIT 1;
    
    SELECT 
        longitud INTO v_longitud_final
    FROM temp_puntos_ordenados
    ORDER BY timestamp_dato DESC
    LIMIT 1;
    
    -- Calcular distancia total iterando por los puntos
    SELECT COUNT(*) INTO v_numero_pasadas FROM temp_puntos_ordenados;
    
    -- Si hay menos de 2 puntos, no podemos calcular distancia
    IF v_numero_pasadas < 2 THEN
        SIGNAL SQLSTATE '45000' 
        SET MESSAGE_TEXT = 'No hay suficientes puntos para calcular distancia';
        LEAVE main_proc;
    END IF;
    
    -- Calcular la distancia total y verificar cumplimiento de rangos
    SET v_punto_anterior_lat = NULL;
    SET v_punto_anterior_lon = NULL;
    SET v_total_distancia = 0;
    
    BEGIN
        DECLARE done INT DEFAULT FALSE;
        DECLARE cur CURSOR FOR 
            SELECT latitud, longitud, temperatura 
            FROM temp_puntos_ordenados
            ORDER BY timestamp_dato;
        DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;
        
        OPEN cur;
        
        read_loop: LOOP
            FETCH cur INTO v_punto_actual_lat, v_punto_actual_lon, v_temperatura_max;
            
            IF done THEN
                LEAVE read_loop;
            END IF;
            
            -- Calcular distancia incremental si tenemos un punto anterior
            IF v_punto_anterior_lat IS NOT NULL AND v_punto_anterior_lon IS NOT NULL THEN
                SET v_distancia_entre_puntos = calcular_distancia_en_metros(
                    v_punto_anterior_lat, 
                    v_punto_anterior_lon, 
                    v_punto_actual_lat, 
                    v_punto_actual_lon
                );
                SET v_total_distancia = v_total_distancia + v_distancia_entre_puntos;
            END IF;
            
            -- Establecer punto actual como anterior para la próxima iteración
            SET v_punto_anterior_lat = v_punto_actual_lat;
            SET v_punto_anterior_lon = v_punto_actual_lon;
        END LOOP;
        
        CLOSE cur;
    END;
    
    -- Calcular el tamaño de cada tramo (20% de la distancia total)
    SET v_longitud_tramo = v_total_distancia / 5;
    
    -- Procesar cada uno de los 5 tramos
    SET i = 1;
    WHILE i <= 5 DO
        -- Calcular estadísticas para el tramo i
        SET v_distancia_acumulada = 0;
        SET v_punto_anterior_lat = NULL;
        SET v_punto_anterior_lon = NULL;
        SET v_temperatura_max = -999;
        SET v_temperatura_min = 999;
        SET v_temperatura_promedio = 0;
        SET v_numero_pasadas = 0;
        SET v_puntos_verdes = 0;
        SET v_total_puntos = 0;
        
        -- Recorrer los puntos nuevamente para este tramo
        BEGIN
            DECLARE done INT DEFAULT FALSE;
            DECLARE temp_suma DOUBLE DEFAULT 0;
            DECLARE temp_count INT DEFAULT 0;
            DECLARE v_temp DOUBLE;
            DECLARE cur CURSOR FOR 
                SELECT latitud, longitud, temperatura 
                FROM temp_puntos_ordenados
                ORDER BY timestamp_dato;
            DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;
            
            OPEN cur;
            
            tramo_loop: LOOP
                FETCH cur INTO v_punto_actual_lat, v_punto_actual_lon, v_temp;
                
                IF done THEN
                    LEAVE tramo_loop;
                END IF;
                
                -- Calcular distancia incremental si tenemos un punto anterior
                IF v_punto_anterior_lat IS NOT NULL AND v_punto_anterior_lon IS NOT NULL THEN
                    SET v_distancia_entre_puntos = calcular_distancia_en_metros(
                        v_punto_anterior_lat, 
                        v_punto_anterior_lon, 
                        v_punto_actual_lat, 
                        v_punto_actual_lon
                    );
                    SET v_distancia_acumulada = v_distancia_acumulada + v_distancia_entre_puntos;
                END IF;
                
                -- Establecer punto actual como anterior para la próxima iteración
                SET v_punto_anterior_lat = v_punto_actual_lat;
                SET v_punto_anterior_lon = v_punto_actual_lon;
                
                -- Verificar si estamos dentro del tramo actual
                IF v_distancia_acumulada <= (i * v_longitud_tramo) AND 
                   v_distancia_acumulada > ((i-1) * v_longitud_tramo) THEN
                    -- Actualizar estadísticas para este tramo
                    SET temp_suma = temp_suma + v_temp;
                    SET temp_count = temp_count + 1;
                    
                    -- Incrementar contador total de puntos para este tramo
                    SET v_total_puntos = v_total_puntos + 1;
                    
                    -- Verificar si la temperatura está en el rango verde
                    -- El rango verde es: desde valor mínimo semáforo amarillo por debajo (100°C)
                    -- hasta valor mínimo semáforo amarillo por alto (150°C)
                    IF v_temp >= v_verde_min AND v_temp < v_verde_max THEN
                        SET v_puntos_verdes = v_puntos_verdes + 1;
                    END IF;
                    
                    IF v_temp > v_temperatura_max THEN
                        SET v_temperatura_max = v_temp;
                    END IF;
                    IF v_temp < v_temperatura_min THEN
                        SET v_temperatura_min = v_temp;
                    END IF;
                END IF;
                
                -- Si pasamos del tramo actual, salimos del loop
                IF v_distancia_acumulada > (i * v_longitud_tramo) THEN
                    LEAVE tramo_loop;
                END IF;
            END LOOP;
            
            CLOSE cur;
            
            -- Calcular promedio si tenemos datos
            IF temp_count > 0 THEN
                SET v_temperatura_promedio = temp_suma / temp_count;
                SET v_numero_pasadas = temp_count;
                
                -- Calcular el porcentaje de puntos verdes
                IF v_total_puntos > 0 THEN
                    SET v_porcentaje_verde = (v_puntos_verdes * 100.0) / v_total_puntos;
                    
                    -- Determinar cumplimiento según el porcentaje verde
                    -- Se cumple si el porcentaje de lecturas en rango verde (100-150°C)
                    -- es igual o mayor que el porcentaje requerido (90%)
                    IF v_porcentaje_verde >= v_porcentaje_verde_requerido THEN
                        SET v_cumple_rango = 1;
                    ELSE
                        SET v_cumple_rango = 0;
                    END IF;
                ELSE
                    SET v_cumple_rango = 0;
                END IF;
            ELSE
                SET v_temperatura_promedio = 0;
                SET v_temperatura_max = 0;
                SET v_temperatura_min = 0;
                SET v_cumple_rango = 0;
            END IF;
        END;
        
        -- Insertar o actualizar el resumen para este tramo
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
            p_id_faena,
            i,
            v_temperatura_max,
            v_temperatura_min,
            v_temperatura_promedio,
            v_latitud_inicio,
            v_longitud_inicio,
            v_latitud_final,
            v_longitud_final,
            v_numero_pasadas,
            v_cumple_rango
        )
        ON DUPLICATE KEY UPDATE
            temperatura_maxima = v_temperatura_max,
            temperatura_minima = v_temperatura_min,
            promedio_temperatura = v_temperatura_promedio,
            latitud_inicio = v_latitud_inicio,
            longitud_inicio = v_longitud_inicio,
            latitud_final = v_latitud_final,
            longitud_final = v_longitud_final,
            numero_pasadas = v_numero_pasadas,
            cumple_rango_temperatura = v_cumple_rango;
        
        SET i = i + 1;
    END WHILE;
    
    -- Limpiar
    DROP TEMPORARY TABLE IF EXISTS temp_puntos_ordenados;
END