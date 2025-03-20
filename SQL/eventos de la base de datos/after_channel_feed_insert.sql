CREATE DEFINER=`root`@`%` TRIGGER `after_channel_feed_insert` AFTER INSERT ON `api_channel_feeds` FOR EACH ROW BEGIN
    DECLARE v_faena_activa_id INT;
    DECLARE v_id_maquina INT;
    DECLARE v_ultimo_t_alto_timestamp TIMESTAMP;
    DECLARE v_tiempo_transcurrido INT;
    DECLARE v_temp_inicio_faena DOUBLE;
    DECLARE v_temp_fin_faena DOUBLE;
    DECLARE v_tiempo_fin_faena DOUBLE;
    DECLARE v_calidad_temperatura VARCHAR(45);
    
    -- Skip processing if trigger is disabled via session variable
    IF @TRIGGER_DISABLED IS NULL THEN
        -- Obtener parámetros de configuración
        SELECT CAST(valor AS DOUBLE) INTO v_temp_inicio_faena
        FROM api_configuracion
        WHERE id_api_configuracion = 1;  -- inicio faena
        
        SELECT CAST(valor AS DOUBLE) INTO v_temp_fin_faena
        FROM api_configuracion
        WHERE id_api_configuracion = 14;  -- fin faena
        
        SELECT CAST(valor AS DOUBLE) INTO v_tiempo_fin_faena
        FROM api_configuracion
        WHERE id_api_configuracion = 15;  -- tiempo en minutos para fin faena
        
        -- Obtener id_maquina para este channel_id
        SELECT id_Maquina INTO v_id_maquina
        FROM api_maquina 
        WHERE id_equipo = NEW.channel_id;
        
        -- Verificar si hay una faena activa para esta máquina
        SELECT id_Faena INTO v_faena_activa_id
        FROM api_faena
        WHERE id_maquina = v_id_maquina 
        AND fecha_fin IS NULL;
        
        -- Determinar la calidad de temperatura
        SET v_calidad_temperatura = determinar_calidad_temperatura(NEW.field7);
        
        -- APERTURA DE FAENA: Si temperatura > v_temp_inicio_faena y no hay faena activa -> crear nueva faena
        IF NEW.field7 > v_temp_inicio_faena AND v_faena_activa_id IS NULL THEN
            INSERT INTO api_faena (
                fecha_inico,
                id_maquina
            ) VALUES (
                NEW.created_at,
                v_id_maquina
            );
            
            SET v_faena_activa_id = LAST_INSERT_ID();
        END IF;
        
        -- PROCESAMIENTO DE DATOS: Si hay faena activa, insertar datos
        IF v_faena_activa_id IS NOT NULL THEN
            -- Insertar datos en api_datos_por_faena
            INSERT INTO api_datos_por_faena (
                id_faena,
                timestamp_dato,
                temperatura,
                latitud,
                longitud,
                calidad_temperatura
            ) VALUES (
                v_faena_activa_id,
                NEW.created_at,
                NEW.field7,
                NEW.latitude,
                NEW.longitude,
                v_calidad_temperatura
            );
            
            -- CIERRE DE FAENA: Si temperatura <= v_temp_fin_faena, verificar si debemos cerrar la faena
            IF NEW.field7 <= v_temp_fin_faena THEN
                -- Obtener timestamp del último registro con T > v_temp_fin_faena
                SELECT timestamp_dato INTO v_ultimo_t_alto_timestamp
                FROM api_datos_por_faena
                WHERE id_faena = v_faena_activa_id
                AND temperatura > v_temp_fin_faena
                ORDER BY timestamp_dato DESC
                LIMIT 1;
                
                -- Solo proceder si encontramos un timestamp válido
                IF v_ultimo_t_alto_timestamp IS NOT NULL THEN
                    -- Calcular tiempo transcurrido en minutos
                    SET v_tiempo_transcurrido = TIMESTAMPDIFF(MINUTE, v_ultimo_t_alto_timestamp, NEW.created_at);
                    
                    -- Si han pasado el tiempo establecido o más
                    IF v_tiempo_transcurrido >= v_tiempo_fin_faena THEN
                        -- Eliminar registros posteriores al último T > v_temp_fin_faena
                        DELETE FROM api_datos_por_faena 
                        WHERE id_faena = v_faena_activa_id
                        AND timestamp_dato > v_ultimo_t_alto_timestamp;
                        
                        -- Cerrar la faena
                        UPDATE api_faena 
                        SET fecha_fin = v_ultimo_t_alto_timestamp
                        WHERE id_Faena = v_faena_activa_id;
                    END IF;
                END IF;
            END IF;
        END IF;
    END IF;
END