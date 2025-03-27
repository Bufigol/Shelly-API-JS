-- --------------------------------------------------------
-- Script completo para crear la base de datos del sistema
-- --------------------------------------------------------

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "+00:00";

-- --------------------------------------------------------
-- Creación de la base de datos
-- --------------------------------------------------------

CREATE DATABASE IF NOT EXISTS `testingshelly` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE `testingshelly`;

-- --------------------------------------------------------
-- Tablas Principales
-- --------------------------------------------------------

-- Tabla api_clientes (debe crearse primero por las dependencias)
CREATE TABLE IF NOT EXISTS `api_clientes` (
  `idClientes` int NOT NULL AUTO_INCREMENT,
  `id_cliente_externo` varchar(45) NOT NULL,
  `nombre_cliente` varchar(45) NOT NULL,
  PRIMARY KEY (`idClientes`),
  UNIQUE KEY `nombre_UNIQUE` (`id_cliente_externo`),
  UNIQUE KEY `idClientes_UNIQUE` (`idClientes`),
  UNIQUE KEY `nombre_cliente_UNIQUE` (`nombre_cliente`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Tabla api_equipo (debe crearse antes de api_maquina)
CREATE TABLE IF NOT EXISTS `api_equipo` (
  `chanel_id` int NOT NULL,
  `fecha_creacion` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `fecha_actualizacion` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `device_id` varchar(255) DEFAULT NULL,
  `status` text,
  `mac_address` varchar(45) DEFAULT NULL,
  `product_id` varchar(100) DEFAULT NULL,
  `firmware` varchar(50) DEFAULT NULL,
  `timezone` varchar(255) DEFAULT NULL,
  `apikey` varchar(50) NOT NULL,
  PRIMARY KEY (`chanel_id`),
  UNIQUE KEY `chanel_id_UNIQUE` (`chanel_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Tabla api_maquina
CREATE TABLE IF NOT EXISTS `api_maquina` (
  `id_Maquina` int NOT NULL AUTO_INCREMENT,
  `identificador_externo` varchar(45) NOT NULL,
  `id_equipo` int NOT NULL,
  `fecha_creacion` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `fecha_actualizacion` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_Maquina`),
  UNIQUE KEY `id_Maquina_UNIQUE` (`id_Maquina`),
  UNIQUE KEY `identificador_externo_UNIQUE` (`identificador_externo`),
  KEY `fk_equipo-maquina_channel_id_idx` (`id_equipo`),
  CONSTRAINT `fk_equipo-maquina_channel_id` FOREIGN KEY (`id_equipo`) REFERENCES `api_equipo` (`chanel_id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Tabla api_faena
CREATE TABLE IF NOT EXISTS `api_faena` (
  `id_Faena` int NOT NULL AUTO_INCREMENT,
  `id_Faena_externo` varchar(45) DEFAULT NULL,
  `fecha_inico` timestamp NOT NULL,
  `fecha_fin` timestamp NULL DEFAULT NULL,
  `id_maquina` int DEFAULT '1',
  `id_cliente` int DEFAULT '1',
  PRIMARY KEY (`id_Faena`),
  KEY `fk_maquina-faena_id_maquina_idx` (`id_maquina`),
  KEY `fk_cliente-faena_id_cliente_idx` (`id_cliente`),
  CONSTRAINT `fk_cliente-faena_id_cliente` FOREIGN KEY (`id_cliente`) REFERENCES `api_clientes` (`idClientes`),
  CONSTRAINT `fk_maquina-faena_id_maquina` FOREIGN KEY (`id_maquina`) REFERENCES `api_maquina` (`id_Maquina`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Tabla api_datos_por_faena
CREATE TABLE IF NOT EXISTS `api_datos_por_faena` (
  `idDatos_por_faena` int NOT NULL AUTO_INCREMENT,
  `id_faena` int NOT NULL,
  `timestamp_dato` timestamp NOT NULL,
  `temperatura` double DEFAULT NULL,
  `latitud` double DEFAULT NULL,
  `longitud` double DEFAULT NULL,
  `calidad_temperatura` varchar(45) DEFAULT NULL,
  PRIMARY KEY (`idDatos_por_faena`),
  KEY `fk_id_faena_idx` (`id_faena`),
  CONSTRAINT `fk_id_faena` FOREIGN KEY (`id_faena`) REFERENCES `api_faena` (`id_Faena`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Tabla api_channel_feeds
CREATE TABLE IF NOT EXISTS `api_channel_feeds` (
  `idchannel_feeds` int NOT NULL AUTO_INCREMENT,
  `channel_id` int NOT NULL,
  `field1` double DEFAULT NULL,
  `field2` double DEFAULT NULL,
  `field3` double DEFAULT NULL,
  `field4` double DEFAULT NULL,
  `field5` double DEFAULT NULL,
  `field6` double DEFAULT NULL,
  `field7` double DEFAULT NULL,
  `field8` double DEFAULT NULL,
  `field9` double DEFAULT NULL,
  `field10` double DEFAULT NULL,
  `field11` double DEFAULT NULL,
  `field12` double DEFAULT NULL,
  `field13` double DEFAULT NULL,
  `field14` double DEFAULT NULL,
  `field15` double DEFAULT NULL,
  `field16` double DEFAULT NULL,
  `field17` double DEFAULT NULL,
  `field18` double DEFAULT NULL,
  `field19` double DEFAULT NULL,
  `field20` double DEFAULT NULL,
  `latitude` double DEFAULT NULL,
  `longitude` double DEFAULT NULL,
  `elevation` double DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `status` varchar(255) DEFAULT NULL,
  `usage` double DEFAULT NULL,
  `nt` varchar(255) DEFAULT NULL,
  `log` text,
  PRIMARY KEY (`idchannel_feeds`),
  KEY `fk_channel_feed-equipo-channel_id_idx` (`channel_id`),
  CONSTRAINT `fk_channel_feed-equipo-channel_id` FOREIGN KEY (`channel_id`) REFERENCES `api_equipo` (`chanel_id`)
) ENGINE=InnoDB AUTO_INCREMENT=4321 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Tabla api_resumen_Datos_por_faena
CREATE TABLE IF NOT EXISTS `api_resumen_Datos_por_faena` (
  `id_resumen_datos_faena` int NOT NULL AUTO_INCREMENT,
  `id_faena` int NOT NULL,
  `cuarto` enum('1','2','3','4','5') NOT NULL,
  `temperatura_maxima` double NOT NULL,
  `temperatura_minima` double NOT NULL,
  `promedio_temperatura` double NOT NULL,
  `latitud_inicio` double NOT NULL,
  `longitud_inicio` double NOT NULL,
  `latitud_final` double NOT NULL,
  `longitud_final` double NOT NULL,
  `numero_pasadas` int NOT NULL,
  `cumple_rango_temperatura` tinyint NOT NULL DEFAULT '1',
  PRIMARY KEY (`id_resumen_datos_faena`),
  UNIQUE KEY `uk_faena_cuarto` (`id_faena`,`cuarto`),
  CONSTRAINT `fk_faena-resumen_datos_por_faena-id_faena` FOREIGN KEY (`id_faena`) REFERENCES `api_faena` (`id_Faena`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------
-- Tablas de Autenticación y Seguridad
-- --------------------------------------------------------

-- Tabla api_usuario
CREATE TABLE IF NOT EXISTS `api_usuario` (
  `id_Usuario` int NOT NULL AUTO_INCREMENT,
  `email` varchar(50) NOT NULL,
  `password` varchar(150) NOT NULL,
  `fecha_creacion` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `fecha_actualizacion` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_Usuario`),
  UNIQUE KEY `id_Usuario_UNIQUE` (`id_Usuario`),
  UNIQUE KEY `email_UNIQUE` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Tabla api_permisos
CREATE TABLE IF NOT EXISTS `api_permisos` (
  `id_Permisos` int NOT NULL AUTO_INCREMENT,
  `nombre_pemiso` varchar(45) NOT NULL,
  PRIMARY KEY (`id_Permisos`),
  UNIQUE KEY `id_Permisos_UNIQUE` (`id_Permisos`),
  UNIQUE KEY `nombre_pemiso_UNIQUE` (`nombre_pemiso`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Tabla api_usuarios_permisos
CREATE TABLE IF NOT EXISTS `api_usuarios_permisos` (
  `id_usuario` int NOT NULL,
  `id_permiso` int NOT NULL,
  `fecha_otorgacion` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `fecha_caducidad` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id_usuario`,`id_permiso`),
  KEY `fk_Permisos-usuarios_permisos-id_Permisos_idx` (`id_permiso`),
  CONSTRAINT `fk_Permisos-usuarios_permisos-id_Permisos` FOREIGN KEY (`id_permiso`) REFERENCES `api_permisos` (`id_Permisos`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_usuario-usuario_permisos_id-Usuario` FOREIGN KEY (`id_usuario`) REFERENCES `api_usuario` (`id_Usuario`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Tabla para reseteo de contraseñas (necesaria para el servicio de autenticación)
CREATE TABLE IF NOT EXISTS `api_password_reset` (
  `id_reset` int NOT NULL AUTO_INCREMENT,
  `id_usuario` int NOT NULL,
  `token` varchar(255) NOT NULL,
  `expires_at` timestamp NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_reset`),
  KEY `fk_reset_usuario_idx` (`id_usuario`),
  CONSTRAINT `fk_reset_usuario` FOREIGN KEY (`id_usuario`) REFERENCES `api_usuario` (`id_Usuario`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------
-- Tablas de Configuración y Logging
-- --------------------------------------------------------

-- Tabla api_configuracion
CREATE TABLE IF NOT EXISTS `api_configuracion` (
  `id_api_configuracion` int NOT NULL AUTO_INCREMENT,
  `nombre_parametro` varchar(45) NOT NULL,
  `tipo_de_dato` enum('DOUBLE','VARCHAR') NOT NULL,
  `valor` varchar(45) NOT NULL,
  PRIMARY KEY (`id_api_configuracion`)
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Tabla api_log_maquinas_equipos
CREATE TABLE IF NOT EXISTS `api_log_maquinas_equipos` (
  `id_log_maquinas_equipos` int NOT NULL AUTO_INCREMENT,
  `id_maquina` int NOT NULL,
  `id_equipo_antiguo` int NOT NULL,
  `id_equipo_nuevo` int NOT NULL,
  `fecha_actualizacion` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_log_maquinas_equipos`),
  UNIQUE KEY `id_log_maquinas_equipos_UNIQUE` (`id_log_maquinas_equipos`),
  KEY `fk_maquina-log_idmaquina_idx` (`id_maquina`),
  KEY `fk_equipo-log_id_equipo_antiguo_idx` (`id_equipo_antiguo`),
  KEY `fk_equipo-log_id_equipo_nuevo_idx` (`id_equipo_nuevo`),
  CONSTRAINT `channel id antiguo` FOREIGN KEY (`id_equipo_antiguo`) REFERENCES `api_equipo` (`chanel_id`),
  CONSTRAINT `channel id nuevo` FOREIGN KEY (`id_equipo_nuevo`) REFERENCES `api_equipo` (`chanel_id`),
  CONSTRAINT `fk_maquina-log_id_maquina` FOREIGN KEY (`id_maquina`) REFERENCES `api_maquina` (`id_Maquina`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Tabla api_log_modificaciones_usuario
CREATE TABLE IF NOT EXISTS `api_log_modificaciones_usuario` (
  `idapi_log_modificaciones_usuario` INT NOT NULL AUTO_INCREMENT,
  `time_stamp_modificacion` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `id_usuario_implicado` INT NOT NULL,
  `accion` TEXT NOT NULL,
  PRIMARY KEY (`idapi_log_modificaciones_usuario`),
  INDEX `fk_usuario_idx` (`id_usuario_implicado` ASC),
  CONSTRAINT `fk_usuario`
    FOREIGN KEY (`id_usuario_implicado`)
    REFERENCES `api_usuario` (`id_Usuario`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Tabla api_errores
CREATE TABLE IF NOT EXISTS `api_errores` (
  `idapi_errores` int NOT NULL AUTO_INCREMENT,
  `mensaje_de_error` json NOT NULL,
  `timestamp_error` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`idapi_errores`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------
-- Funciones SQL
-- --------------------------------------------------------

DELIMITER //

-- Función para calcular distancia entre dos puntos en metros usando la fórmula de Haversine
CREATE FUNCTION IF NOT EXISTS `calcular_distancia_en_metros`(lat1 DOUBLE, lon1 DOUBLE, lat2 DOUBLE, lon2 DOUBLE) 
RETURNS DOUBLE DETERMINISTIC
BEGIN
    DECLARE R DOUBLE DEFAULT 6371000;
    DECLARE phi1 DOUBLE;
    DECLARE phi2 DOUBLE;
    DECLARE delta_phi DOUBLE;
    DECLARE delta_lambda DOUBLE;
    DECLARE a DOUBLE;
    DECLARE c DOUBLE;
    DECLARE d DOUBLE;
    
    SET phi1 = RADIANS(lat1);
    SET phi2 = RADIANS(lat2);
    SET delta_phi = RADIANS(lat2 - lat1);
    SET delta_lambda = RADIANS(lon2 - lon1);
    
    SET a = SIN(delta_phi/2) * SIN(delta_phi/2) +
            COS(phi1) * COS(phi2) *
            SIN(delta_lambda/2) * SIN(delta_lambda/2);
    SET c = 2 * ATAN2(SQRT(a), SQRT(1-a));
    SET d = R * c;
    
    RETURN d;
END//

DELIMITER ;

-- --------------------------------------------------------
-- Inserción de datos iniciales
-- --------------------------------------------------------

-- Insertar permisos básicos
INSERT INTO `api_permisos` (`nombre_pemiso`) VALUES 
('visualizador'),
('editor')
ON DUPLICATE KEY UPDATE `nombre_pemiso` = VALUES(`nombre_pemiso`);

-- Insertar configuración por defecto
INSERT INTO `api_configuracion` (`id_api_configuracion`, `nombre_parametro`, `tipo_de_dato`, `valor`) VALUES
(1, 'temperatura_inicio_faena', 'DOUBLE', '105'),
(2, 'rojo_bajo_valor', 'DOUBLE', '90'),
(3, 'rojo_bajo_nombre', 'VARCHAR', 'ROJO_BAJO'),
(4, 'amarillo_bajo_valor', 'DOUBLE', '100'),
(5, 'amarillo_bajo_nombre', 'VARCHAR', 'AMARILLO_BAJO'),
(6, 'verde_valor', 'DOUBLE', '125'),
(7, 'verde_nombre', 'VARCHAR', 'VERDE'),
(8, 'amarillo_alto_valor', 'DOUBLE', '150'),
(9, 'amarillo_alto_nombre', 'VARCHAR', 'AMARILLO_ALTO'),
(10, 'rojo_alto_valor', 'DOUBLE', '160'),
(11, 'rojo_alto_nombre', 'VARCHAR', 'ROJO_ALTO'),
(12, 'fuera_rango_nombre', 'VARCHAR', 'FUERA_DE_RANGO'),
(13, 'rango_temperatura_optimo', 'DOUBLE', '120'),
(14, 'temperatura_fin_faena', 'DOUBLE', '70'),
(15, 'tiempo_fin_faena', 'DOUBLE', '15'),
(16, 'maximo_rojo_alto', 'DOUBLE', '180'),
(17, 'porcentaje_verde_requerido', 'DOUBLE', '90')
ON DUPLICATE KEY UPDATE 
  `nombre_parametro` = VALUES(`nombre_parametro`),
  `tipo_de_dato` = VALUES(`tipo_de_dato`);

-- Crear un usuario de prueba (admin@ejemplo.com / password123)
-- La contraseña se debe hashear con bcrypt en producción, aquí se usa un hash generado previamente
INSERT INTO `api_usuario` (`email`, `password`) VALUES
('admin@ejemplo.com', '$2b$10$IXm33QBka0iQxOK9bELF/uHQ2QzdCZUTDQNrP6YHlRiwIC8y4fJlC')
ON DUPLICATE KEY UPDATE `email` = VALUES(`email`);

-- Asignar permisos al usuario admin
INSERT INTO `api_usuarios_permisos` (`id_usuario`, `id_permiso`) 
SELECT 
  (SELECT `id_Usuario` FROM `api_usuario` WHERE `email` = 'admin@ejemplo.com'), 
  `id_Permisos` 
FROM `api_permisos` 
WHERE `nombre_pemiso` IN ('visualizador', 'editor')
ON DUPLICATE KEY UPDATE `fecha_otorgacion` = CURRENT_TIMESTAMP;

-- --------------------------------------------------------
-- Triggers
-- --------------------------------------------------------
DELIMITER //
-- Trigger after_channel_feed_insert
DROP TRIGGER IF EXISTS `after_channel_feed_insert`//

CREATE TRIGGER `after_channel_feed_insert` AFTER INSERT ON `api_channel_feeds` FOR EACH ROW 
BEGIN
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
END//

-- Función para determinar la calidad de temperatura según configuración
CREATE FUNCTION IF NOT EXISTS `determinar_calidad_temperatura`(p_temperatura DOUBLE) 
RETURNS VARCHAR(45) DETERMINISTIC
BEGIN
    DECLARE v_rojo_bajo_valor DOUBLE;
    DECLARE v_rojo_bajo_nombre VARCHAR(45);
    DECLARE v_amarillo_bajo_valor DOUBLE;
    DECLARE v_amarillo_bajo_nombre VARCHAR(45);
    DECLARE v_verde_valor DOUBLE;
    DECLARE v_verde_nombre VARCHAR(45);
    DECLARE v_amarillo_alto_valor DOUBLE;
    DECLARE v_amarillo_alto_nombre VARCHAR(45);
    DECLARE v_rojo_alto_valor DOUBLE;
    DECLARE v_rojo_alto_nombre VARCHAR(45);
    DECLARE v_maximo_rojo_alto DOUBLE;
    DECLARE v_fuera_rango_nombre VARCHAR(45);
    DECLARE v_calidad VARCHAR(45);
    
    -- Obtener los rangos definidos en la configuración
    SELECT CAST(valor AS DOUBLE) INTO v_rojo_bajo_valor FROM api_configuracion WHERE id_api_configuracion = 2;
    SELECT valor INTO v_rojo_bajo_nombre FROM api_configuracion WHERE id_api_configuracion = 3;
    
    SELECT CAST(valor AS DOUBLE) INTO v_amarillo_bajo_valor FROM api_configuracion WHERE id_api_configuracion = 4;
    SELECT valor INTO v_amarillo_bajo_nombre FROM api_configuracion WHERE id_api_configuracion = 5;
    
    SELECT CAST(valor AS DOUBLE) INTO v_verde_valor FROM api_configuracion WHERE id_api_configuracion = 6;
    SELECT valor INTO v_verde_nombre FROM api_configuracion WHERE id_api_configuracion = 7;
    
    SELECT CAST(valor AS DOUBLE) INTO v_amarillo_alto_valor FROM api_configuracion WHERE id_api_configuracion = 8;
    SELECT valor INTO v_amarillo_alto_nombre FROM api_configuracion WHERE id_api_configuracion = 9;
    
    SELECT CAST(valor AS DOUBLE) INTO v_rojo_alto_valor FROM api_configuracion WHERE id_api_configuracion = 10;
    SELECT valor INTO v_rojo_alto_nombre FROM api_configuracion WHERE id_api_configuracion = 11;
    
    SELECT valor INTO v_fuera_rango_nombre FROM api_configuracion WHERE id_api_configuracion = 12;
    
    SELECT CAST(valor AS DOUBLE) INTO v_maximo_rojo_alto FROM api_configuracion WHERE id_api_configuracion = 16;
    
    -- Determinar la calidad de temperatura
    IF p_temperatura < v_rojo_bajo_valor THEN
        SET v_calidad = v_rojo_bajo_nombre;
    ELSEIF p_temperatura < v_amarillo_bajo_valor THEN
        SET v_calidad = v_amarillo_bajo_nombre;
    ELSEIF p_temperatura < v_amarillo_alto_valor THEN
        SET v_calidad = v_verde_nombre;
    ELSEIF p_temperatura < v_rojo_alto_valor THEN
        SET v_calidad = v_amarillo_alto_nombre;
    ELSEIF p_temperatura <= v_maximo_rojo_alto THEN
        SET v_calidad = v_rojo_alto_nombre;
    ELSE
        SET v_calidad = v_fuera_rango_nombre;
    END IF;
    
    RETURN v_calidad;
END//

-- --------------------------------------------------------
-- Procedimientos Almacenados
-- --------------------------------------------------------

-- Procedimiento para generar resumen de faena
DROP PROCEDURE IF EXISTS `generar_resumen_faena_mejorado`;
CREATE PROCEDURE IF NOT EXISTS `generar_resumen_faena_mejorado`(IN p_id_faena INT)
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
END//