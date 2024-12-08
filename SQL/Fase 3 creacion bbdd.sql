-- --------------------------------------------------------
-- Sistema de Energía y Medición (SEM)
-- Fase 3 - Definición de Tablas
-- --------------------------------------------------------

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "+00:00";

-- --------------------------------------------------------
-- TABLAS DE PROMEDIOS
-- --------------------------------------------------------

-- Promedios Horarios
CREATE TABLE sem_promedios_hora (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    shelly_id VARCHAR(12) NOT NULL,
    hora_utc TIMESTAMP(6) NOT NULL,
    hora_local TIMESTAMP(6) NOT NULL,
    -- Promedios por fase
    fase_a_voltaje_promedio DECIMAL(10,2) CHECK (fase_a_voltaje_promedio >= 0),
    fase_a_corriente_promedio DECIMAL(10,3) CHECK (fase_a_corriente_promedio >= 0),
    fase_a_potencia_activa_promedio DECIMAL(10,2),
    fase_a_factor_potencia_promedio DECIMAL(5,3) CHECK (fase_a_factor_potencia_promedio BETWEEN -1 AND 1),
    fase_b_voltaje_promedio DECIMAL(10,2) CHECK (fase_b_voltaje_promedio >= 0),
    fase_b_corriente_promedio DECIMAL(10,3) CHECK (fase_b_corriente_promedio >= 0),
    fase_b_potencia_activa_promedio DECIMAL(10,2),
    fase_b_factor_potencia_promedio DECIMAL(5,3) CHECK (fase_b_factor_potencia_promedio BETWEEN -1 AND 1),
    fase_c_voltaje_promedio DECIMAL(10,2) CHECK (fase_c_voltaje_promedio >= 0),
    fase_c_corriente_promedio DECIMAL(10,3) CHECK (fase_c_corriente_promedio >= 0),
    fase_c_potencia_activa_promedio DECIMAL(10,2),
    fase_c_factor_potencia_promedio DECIMAL(5,3) CHECK (fase_c_factor_potencia_promedio BETWEEN -1 AND 1),
    -- Promedios totales
    potencia_activa_promedio DECIMAL(10,2),
    potencia_aparente_promedio DECIMAL(10,2),
    factor_potencia_promedio DECIMAL(5,3) CHECK (factor_potencia_promedio BETWEEN -1 AND 1),
    -- Métricas de calidad
    lecturas_esperadas INT NOT NULL CHECK (lecturas_esperadas > 0),
    lecturas_recibidas INT NOT NULL CHECK (lecturas_recibidas >= 0),
    lecturas_validas INT NOT NULL CHECK (lecturas_validas >= 0),
    calidad_datos DECIMAL(5,2) CHECK (calidad_datos BETWEEN 0 AND 100),
    -- Control
    fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (shelly_id) REFERENCES sem_dispositivos(shelly_id),
    UNIQUE INDEX idx_hora_dispositivo (shelly_id, hora_utc),
    INDEX idx_hora_local (hora_local),
    INDEX idx_calidad (calidad_datos),
    INDEX idx_timestamp_range (hora_utc, hora_local),
    CHECK (hora_local > hora_utc)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
COMMENT 'Promedios horarios de mediciones eléctricas';

-- Promedios Diarios
CREATE TABLE sem_promedios_dia (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    shelly_id VARCHAR(12) NOT NULL,
    fecha_utc DATE NOT NULL,
    fecha_local DATE NOT NULL,
    -- Promedios por fase
    fase_a_voltaje_promedio DECIMAL(10,2) CHECK (fase_a_voltaje_promedio >= 0),
    fase_a_corriente_promedio DECIMAL(10,3) CHECK (fase_a_corriente_promedio >= 0),
    fase_a_potencia_promedio DECIMAL(10,2),
    fase_a_factor_potencia_promedio DECIMAL(5,3) CHECK (fase_a_factor_potencia_promedio BETWEEN -1 AND 1),
    fase_b_voltaje_promedio DECIMAL(10,2) CHECK (fase_b_voltaje_promedio >= 0),
    fase_b_corriente_promedio DECIMAL(10,3) CHECK (fase_b_corriente_promedio >= 0),
    fase_b_potencia_promedio DECIMAL(10,2),
    fase_b_factor_potencia_promedio DECIMAL(5,3) CHECK (fase_b_factor_potencia_promedio BETWEEN -1 AND 1),
    fase_c_voltaje_promedio DECIMAL(10,2) CHECK (fase_c_voltaje_promedio >= 0),
    fase_c_corriente_promedio DECIMAL(10,3) CHECK (fase_c_corriente_promedio >= 0),
    fase_c_potencia_promedio DECIMAL(10,2),
    fase_c_factor_potencia_promedio DECIMAL(5,3) CHECK (fase_c_factor_potencia_promedio BETWEEN -1 AND 1),
    -- Promedios totales
    potencia_activa_promedio DECIMAL(10,2),
    potencia_aparente_promedio DECIMAL(10,2),
    factor_potencia_promedio DECIMAL(5,3) CHECK (factor_potencia_promedio BETWEEN -1 AND 1),
    -- Métricas temporales
    horas_con_datos INT NOT NULL CHECK (horas_con_datos BETWEEN 0 AND 24),
    -- Métricas de calidad
    lecturas_esperadas INT NOT NULL CHECK (lecturas_esperadas > 0),
    lecturas_recibidas INT NOT NULL CHECK (lecturas_recibidas >= 0),
    lecturas_validas INT NOT NULL CHECK (lecturas_validas >= 0),
    calidad_datos DECIMAL(5,2) CHECK (calidad_datos BETWEEN 0 AND 100),
    -- Control
    fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (shelly_id) REFERENCES sem_dispositivos(shelly_id),
    UNIQUE INDEX idx_fecha_dispositivo (shelly_id, fecha_utc),
    INDEX idx_fecha_local (fecha_local),
    INDEX idx_calidad (calidad_datos)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
COMMENT 'Promedios diarios de mediciones eléctricas';

-- Promedios Mensuales
CREATE TABLE sem_promedios_mes (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    shelly_id VARCHAR(12) NOT NULL,
    año INT NOT NULL CHECK (año >= 2000),
    mes INT NOT NULL CHECK (mes BETWEEN 1 AND 12),
    -- Promedios por fase
    fase_a_voltaje_promedio DECIMAL(10,2) CHECK (fase_a_voltaje_promedio >= 0),
    fase_a_corriente_promedio DECIMAL(10,3) CHECK (fase_a_corriente_promedio >= 0),
    fase_a_potencia_promedio DECIMAL(10,2),
    fase_a_factor_potencia_promedio DECIMAL(5,3) CHECK (fase_a_factor_potencia_promedio BETWEEN -1 AND 1),
    fase_b_voltaje_promedio DECIMAL(10,2) CHECK (fase_b_voltaje_promedio >= 0),
    fase_b_corriente_promedio DECIMAL(10,3) CHECK (fase_b_corriente_promedio >= 0),
    fase_b_potencia_promedio DECIMAL(10,2),
    fase_b_factor_potencia_promedio DECIMAL(5,3) CHECK (fase_b_factor_potencia_promedio BETWEEN -1 AND 1),
    fase_c_voltaje_promedio DECIMAL(10,2) CHECK (fase_c_voltaje_promedio >= 0),
    fase_c_corriente_promedio DECIMAL(10,3) CHECK (fase_c_corriente_promedio >= 0),
    fase_c_potencia_promedio DECIMAL(10,2),
    fase_c_factor_potencia_promedio DECIMAL(5,3) CHECK (fase_c_factor_potencia_promedio BETWEEN -1 AND 1),
    -- Promedios totales
    potencia_activa_promedio DECIMAL(10,2),
    potencia_aparente_promedio DECIMAL(10,2),
    factor_potencia_promedio DECIMAL(5,3) CHECK (factor_potencia_promedio BETWEEN -1 AND 1),
    -- Métricas temporales
    dias_con_datos INT NOT NULL CHECK (dias_con_datos BETWEEN 0 AND 31),
    horas_con_datos INT NOT NULL CHECK (horas_con_datos BETWEEN 0 AND 744),
    -- Métricas de calidad
    lecturas_esperadas INT NOT NULL CHECK (lecturas_esperadas > 0),
    lecturas_recibidas INT NOT NULL CHECK (lecturas_recibidas >= 0),
    lecturas_validas INT NOT NULL CHECK (lecturas_validas >= 0),
    calidad_datos DECIMAL(5,2) CHECK (calidad_datos BETWEEN 0 AND 100),
    -- Control
    fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (shelly_id) REFERENCES sem_dispositivos(shelly_id),
    UNIQUE INDEX idx_año_mes_dispositivo (shelly_id, año, mes),
    INDEX idx_calidad (calidad_datos),
    INDEX idx_año_mes (año, mes)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
COMMENT 'Promedios mensuales de mediciones eléctricas';

-- --------------------------------------------------------
-- TABLAS DE TOTALES
-- --------------------------------------------------------

-- Totales Horarios
CREATE TABLE sem_totales_hora (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    shelly_id VARCHAR(12) NOT NULL,
    hora_utc TIMESTAMP(6) NOT NULL,
    hora_local TIMESTAMP(6) NOT NULL,
    -- Totales por fase
    fase_a_energia_activa DECIMAL(15,3) CHECK (fase_a_energia_activa >= 0),
    fase_a_energia_reactiva DECIMAL(15,3),
    fase_b_energia_activa DECIMAL(15,3) CHECK (fase_b_energia_activa >= 0),
    fase_b_energia_reactiva DECIMAL(15,3),
    fase_c_energia_activa DECIMAL(15,3) CHECK (fase_c_energia_activa >= 0),
    fase_c_energia_reactiva DECIMAL(15,3),
    -- Totales
    energia_activa_total DECIMAL(15,3) NOT NULL CHECK (energia_activa_total >= 0),
    energia_reactiva_total DECIMAL(15,3),
    potencia_maxima DECIMAL(10,2) CHECK (potencia_maxima >= 0),
    potencia_minima DECIMAL(10,2) CHECK (potencia_minima >= 0),
    -- Costos
    precio_kwh_periodo DECIMAL(10,2) NOT NULL CHECK (precio_kwh_periodo >= 0),
    costo_total DECIMAL(15,2) NOT NULL CHECK (costo_total >= 0),
    -- Métricas de calidad
    lecturas_validas INT NOT NULL CHECK (lecturas_validas >= 0),
    calidad_datos DECIMAL(5,2) CHECK (calidad_datos BETWEEN 0 AND 100),
    -- Control
    fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (shelly_id) REFERENCES sem_dispositivos(shelly_id),
    UNIQUE INDEX idx_hora_dispositivo (shelly_id, hora_utc),
    INDEX idx_hora_local (hora_local),
    INDEX idx_calidad (calidad_datos),
    INDEX idx_timestamp_range (hora_utc, hora_local),
    CHECK (hora_local > hora_utc),
    CHECK (potencia_maxima >= potencia_minima)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
COMMENT 'Totales horarios de consumo energético';

-- Totales Diarios
CREATE TABLE sem_totales_dia (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    shelly_id VARCHAR(12) NOT NULL,
    fecha_utc DATE NOT NULL,
    fecha_local DATE NOT NULL,
    -- Totales por fase
    fase_a_energia_activa DECIMAL(15,3) CHECK (fase_a_energia_activa >= 0),
    fase_a_energia_reactiva DECIMAL(15,3),
    fase_b_energia_activa DECIMAL(15,3) CHECK (fase_b_energia_activa >= 0),
    fase_b_energia_reactiva DECIMAL(15,3),
    fase_c_energia_activa DECIMAL(15,3) CHECK (fase_c_energia_activa >= 0),
    fase_c_energia_reactiva DECIMAL(15,3),
    -- Totales
    energia_activa_total DECIMAL(15,3) NOT NULL CHECK (energia_activa_total >= 0),
    energia_reactiva_total DECIMAL(15,3),
    potencia_maxima DECIMAL(10,2) CHECK (potencia_maxima >= 0),
    potencia_minima DECIMAL(10,2) CHECK (potencia_minima >= 0),
    -- Costos
    precio_kwh_promedio DECIMAL(10,2) NOT NULL CHECK (precio_kwh_promedio >= 0),
    costo_total DECIMAL(15,2) NOT NULL CHECK (costo_total >= 0),
    -- Métricas temporales
    horas_con_datos INT NOT NULL CHECK (horas_con_datos BETWEEN 0 AND 24),
    -- Control
    fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (shelly_id) REFERENCES sem_dispositivos(shelly_id),
    UNIQUE INDEX idx_fecha_dispositivo (shelly_id, fecha_utc),
    INDEX idx_fecha_local (fecha_local),
    CHECK (potencia_maxima >= potencia_minima)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
COMMENT 'Totales diarios de consumo energético';

-- Totales Mensuales
CREATE TABLE sem_totales_mes (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    shelly_id VARCHAR(12) NOT NULL,
    año INT NOT NULL CHECK (año >= 2000),
    mes INT NOT NULL CHECK (mes BETWEEN 1 AND 12),
    -- Totales por fase
    fase_a_energia_activa DECIMAL(15,3) CHECK (fase_a_energia_activa >= 0),
    fase_a_energia_reactiva DECIMAL(15,3),
    fase_b_energia_activa DECIMAL(15,3) CHECK (fase_b_energia_activa >= 0),
    fase_b_energia_reactiva DECIMAL(15,3),
    fase_c_energia_activa DECIMAL(15,3) CHECK (fase_c_energia_activa >= 0),
    fase_c_energia_reactiva DECIMAL(15,3),
    -- Totales
    energia_activa_total DECIMAL(15,3) NOT NULL CHECK (energia_activa_total >= 0),
    energia_reactiva_total DECIMAL(15,3),
    potencia_maxima DECIMAL(10,2) CHECK (potencia_maxima >= 0),
    potencia_minima DECIMAL(10,2) CHECK (potencia_minima >= 0),
    -- Costos
    precio_kwh_promedio DECIMAL(10,2) NOT NULL CHECK (precio_kwh_promedio >= 0),
    costo_total DECIMAL(15,2) NOT NULL CHECK (costo_total >= 0),
    -- Métricas temporales
    dias_con_datos INT NOT NULL CHECK (dias_con_datos BETWEEN 0 AND 31),
    horas_con_datos INT NOT NULL CHECK (horas_con_datos BETWEEN 0 AND 744),
    -- Control
    fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (shelly_id) REFERENCES sem_dispositivos(shelly_id),
    UNIQUE INDEX idx_año_mes_dispositivo (shelly_id, año, mes),
    INDEX idx_año_mes (año, mes),
    CHECK (potencia_maxima >= potencia_minima)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
COMMENT 'Totales mensuales de consumo energético';

-- --------------------------------------------------------
-- TABLAS DE RESUMEN POR GRUPO
-- --------------------------------------------------------

-- Promedios por Grupo
CREATE TABLE sem_grupo_promedios (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    grupo_id INT NOT NULL,
    periodo_tipo ENUM('HORA', 'DIA', 'MES') NOT NULL,
    periodo_inicio TIMESTAMP NOT NULL,
    periodo_fin TIMESTAMP NOT NULL,
    -- Métricas del grupo
    dispositivos_activos INT NOT NULL CHECK (dispositivos_activos >= 0),
    dispositivos_con_datos INT NOT NULL CHECK (dispositivos_con_datos >= 0),
    -- Promedios del grupo
    potencia_activa_promedio DECIMAL(10,2) CHECK (potencia_activa_promedio >= 0),
    potencia_aparente_promedio DECIMAL(10,2) CHECK (potencia_aparente_promedio >= 0),
    factor_potencia_promedio DECIMAL(5,3) CHECK (factor_potencia_promedio BETWEEN -1 AND 1),
    factor_utilizacion DECIMAL(5,2) CHECK (factor_utilizacion BETWEEN 0 AND 100),
    -- Métricas de calidad
    calidad_promedio DECIMAL(5,2) CHECK (calidad_promedio BETWEEN 0 AND 100),
    -- Control
    fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (grupo_id) REFERENCES sem_grupos(id),
    UNIQUE INDEX idx_grupo_periodo (grupo_id, periodo_tipo, periodo_inicio),
    INDEX idx_periodo_completo (periodo_inicio, periodo_fin, periodo_tipo),
    CHECK (periodo_fin > periodo_inicio),
    CHECK (dispositivos_con_datos <= dispositivos_activos)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
COMMENT 'Promedios por grupo de dispositivos';

-- Totales por Grupo
CREATE TABLE sem_grupo_totales (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    grupo_id INT NOT NULL,
    periodo_tipo ENUM('HORA', 'DIA', 'MES') NOT NULL,
    periodo_inicio TIMESTAMP NOT NULL,
    periodo_fin TIMESTAMP NOT NULL,
    -- Métricas del grupo
    dispositivos_total INT NOT NULL CHECK (dispositivos_total >= 0),
    dispositivos_activos INT NOT NULL CHECK (dispositivos_activos >= 0),
    dispositivos_con_datos INT NOT NULL CHECK (dispositivos_con_datos >= 0),
    -- Totales del grupo
    energia_activa_total DECIMAL(15,3) NOT NULL CHECK (energia_activa_total >= 0),
    energia_reactiva_total DECIMAL(15,3),
    potencia_maxima DECIMAL(10,2) CHECK (potencia_maxima >= 0),
    potencia_minima DECIMAL(10,2) CHECK (potencia_minima >= 0),
    -- Costos
    precio_kwh_promedio DECIMAL(10,2) NOT NULL CHECK (precio_kwh_promedio >= 0),
    costo_total DECIMAL(15,2) NOT NULL CHECK (costo_total >= 0),
    -- Control
    fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (grupo_id) REFERENCES sem_grupos(id),
    UNIQUE INDEX idx_grupo_periodo (grupo_id, periodo_tipo, periodo_inicio),
    INDEX idx_periodo_completo (periodo_inicio, periodo_fin, periodo_tipo),
    CHECK (periodo_fin > periodo_inicio),
    CHECK (potencia_maxima >= potencia_minima),
    CHECK (dispositivos_con_datos <= dispositivos_activos),
    CHECK (dispositivos_activos <= dispositivos_total)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
COMMENT 'Totales por grupo de dispositivos';

-- --------------------------------------------------------
-- TABLAS DE MÉTRICAS DEL SISTEMA
-- --------------------------------------------------------

-- Métricas Globales del Sistema
CREATE TABLE sem_metricas_sistema (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    fecha_medicion TIMESTAMP NOT NULL,
    periodo_tipo ENUM('HORA', 'DIA', 'MES') NOT NULL,
    -- Métricas de dispositivos
    dispositivos_total INT NOT NULL CHECK (dispositivos_total >= 0),
    dispositivos_activos INT NOT NULL CHECK (dispositivos_activos >= 0),
    dispositivos_con_error INT NOT NULL CHECK (dispositivos_con_error >= 0),
    grupos_activos INT NOT NULL CHECK (grupos_activos >= 0),
    -- Métricas de energía
    energia_activa_total DECIMAL(20,3) NOT NULL CHECK (energia_activa_total >= 0),
    energia_reactiva_total DECIMAL(20,3),
    potencia_maxima_sistema DECIMAL(15,2) CHECK (potencia_maxima_sistema >= 0),
    factor_utilizacion_sistema DECIMAL(5,2) CHECK (factor_utilizacion_sistema BETWEEN 0 AND 100),
    -- Costos globales
    precio_kwh_promedio DECIMAL(10,2) NOT NULL CHECK (precio_kwh_promedio >= 0),
    costo_total_sistema DECIMAL(20,2) NOT NULL CHECK (costo_total_sistema >= 0),
    -- Control
    fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE INDEX idx_fecha_periodo (fecha_medicion, periodo_tipo),
    CHECK (dispositivos_activos <= dispositivos_total),
    CHECK (dispositivos_con_error <= dispositivos_total)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
COMMENT 'Métricas globales del sistema';

-- Estadísticas de Calidad Global
CREATE TABLE sem_estadisticas_calidad (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    fecha_analisis TIMESTAMP NOT NULL,
    periodo_tipo ENUM('HORA', 'DIA', 'MES') NOT NULL,
    -- Métricas de completitud
    registros_esperados INT NOT NULL CHECK (registros_esperados > 0),
    registros_recibidos INT NOT NULL CHECK (registros_recibidos >= 0),
    registros_validos INT NOT NULL CHECK (registros_validos >= 0),
    porcentaje_completitud DECIMAL(5,2) CHECK (porcentaje_completitud BETWEEN 0 AND 100),
    -- Métricas de calidad
    registros_sospechosos INT NOT NULL CHECK (registros_sospechosos >= 0),
    registros_error INT NOT NULL CHECK (registros_error >= 0),
    registros_interpolados INT NOT NULL CHECK (registros_interpolados >= 0),
    porcentaje_calidad DECIMAL(5,2) CHECK (porcentaje_calidad BETWEEN 0 AND 100),
    -- Métricas de tiempo
    latencia_promedio INT COMMENT 'En milisegundos',
    tiempo_proceso_promedio INT COMMENT 'En milisegundos',
    -- Control
    fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE INDEX idx_fecha_periodo (fecha_analisis, periodo_tipo),
    CHECK (registros_validos <= registros_recibidos),
    CHECK (registros_recibidos <= registros_esperados)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
COMMENT 'Estadísticas de calidad de datos del sistema';

-- --------------------------------------------------------

DELIMITER //

-- --------------------------------------------------------
-- FUNCIONES UTILITARIAS
-- --------------------------------------------------------

-- Función para convertir entre zonas horarias


CREATE OR REPLACE FUNCTION sem_convert_timezone(
    ts TIMESTAMP,
    from_zone VARCHAR(50),
    to_zone VARCHAR(50)
) 
RETURNS TIMESTAMP DETERMINISTIC
BEGIN
    DECLARE offset_diff INT;
    DECLARE valid_zones BOOLEAN;
    
    -- Verificar que las zonas horarias sean válidas
    SELECT COUNT(*) = 2 INTO valid_zones
    FROM mysql.time_zone_name 
    WHERE name IN (from_zone, to_zone);
    
    -- Si las zonas no son válidas o no están instaladas, lanzar error
    IF NOT valid_zones THEN
        -- Permitir UTC como caso especial
        IF (from_zone != 'UTC' AND from_zone != 'America/Santiago') OR 
           (to_zone != 'UTC' AND to_zone != 'America/Santiago') THEN
            SIGNAL SQLSTATE '45000' 
            SET MESSAGE_TEXT = 'Zona horaria no válida o no instalada en el servidor';
        END IF;
    END IF;
    
    -- Manejo especial para conversión UTC <-> America/Santiago
    IF (from_zone = 'UTC' AND to_zone = 'America/Santiago') THEN
        -- Chile está en UTC-3 o UTC-4 dependiendo del horario de verano
        -- Aquí usamos una lógica simplificada, idealmente deberías considerar DST
        RETURN ts - INTERVAL 3 HOUR;
    ELSEIF (from_zone = 'America/Santiago' AND to_zone = 'UTC') THEN
        RETURN ts + INTERVAL 3 HOUR;
    END IF;
    
    -- Para otras zonas horarias, usar CONVERT_TZ
    RETURN CONVERT_TZ(ts, from_zone, to_zone);
    
    -- Si hay error en la conversión, retornar NULL
    RETURN NULL;
END //

-- Procedimiento de prueba para verificar que la función funcione correctamente
CREATE OR REPLACE PROCEDURE test_timezone_conversion()
BEGIN
    DECLARE test_time TIMESTAMP;
    DECLARE converted_time TIMESTAMP;
    
    SET test_time = CURRENT_TIMESTAMP;
    
    -- Probar conversión UTC -> Santiago
    SET converted_time = sem_convert_timezone(test_time, 'UTC', 'America/Santiago');
    
    -- Verificar que la conversión fue exitosa
    IF converted_time IS NULL THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Error en la conversión de zona horaria';
    END IF;
    
    -- Imprimir resultados para verificación
    SELECT 
        test_time as tiempo_original,
        converted_time as tiempo_convertido,
        TIMESTAMPDIFF(HOUR, test_time, converted_time) as diferencia_horas;
END //

-- Función auxiliar para verificar si una zona horaria está instalada
CREATE OR REPLACE FUNCTION is_timezone_available(zone_name VARCHAR(50))
RETURNS BOOLEAN DETERMINISTIC
BEGIN
    DECLARE zone_exists BOOLEAN;
    
    SELECT COUNT(*) > 0 INTO zone_exists
    FROM mysql.time_zone_name
    WHERE name = zone_name;
    
    RETURN zone_exists OR zone_name = 'UTC';
END  //

-- Función para validar período temporal
CREATE OR REPLACE FUNCTION sem_validar_periodo(
    inicio TIMESTAMP,
    fin TIMESTAMP,
    tipo ENUM('HORA', 'DIA', 'MES')
) 
RETURNS BOOLEAN DETERMINISTIC
BEGIN
    DECLARE diferencia INT;
    DECLARE max_diferencia INT;
    
    -- Validar que inicio sea menor que fin
    IF inicio >= fin THEN
        RETURN FALSE;
    END IF;
    
    -- Calcular diferencia según tipo
    SET diferencia = CASE tipo
        WHEN 'HORA' THEN TIMESTAMPDIFF(HOUR, inicio, fin)
        WHEN 'DIA' THEN TIMESTAMPDIFF(DAY, inicio, fin)
        ELSE TIMESTAMPDIFF(MONTH, inicio, fin)
    END;
    
    -- Definir máxima diferencia permitida
    SET max_diferencia = CASE tipo
        WHEN 'HORA' THEN 24
        WHEN 'DIA' THEN 31
        ELSE 12
    END;
    
    RETURN diferencia > 0 AND diferencia <= max_diferencia;
END //

-- Función para calcular precio promedio ponderado
CREATE OR REPLACE FUNCTION sem_calcular_precio_promedio(
    inicio TIMESTAMP,
    fin TIMESTAMP
) 
RETURNS DECIMAL(10,2) DETERMINISTIC
BEGIN
    DECLARE precio_promedio DECIMAL(10,2);
    DECLARE total_horas DECIMAL(10,2);
    
    WITH precios_periodo AS (
        SELECT 
            CAST(sc.valor AS DECIMAL(10,2)) as precio,
            TIMESTAMPDIFF(HOUR,
                GREATEST(inicio, sc.valido_desde),
                LEAST(fin, COALESCE(sc.valido_hasta, fin))
            ) as horas
        FROM sem_configuracion sc
        JOIN sem_tipos_parametros stp ON sc.tipo_parametro_id = stp.id
        WHERE stp.nombre = 'PRECIO_KWH'
        AND sc.valido_desde <= fin
        AND (sc.valido_hasta IS NULL OR sc.valido_hasta >= inicio)
        AND sc.activo = TRUE
    )
    SELECT 
        SUM(precio * horas) / SUM(horas) INTO precio_promedio
    FROM precios_periodo
    WHERE horas > 0;
    
    RETURN COALESCE(precio_promedio, 0);
END //

-- Función para validar calidad de datos
CREATE OR REPLACE FUNCTION sem_validar_calidad(
    lecturas_validas INT,
    lecturas_esperadas INT
) 
RETURNS DECIMAL(5,2) DETERMINISTIC
BEGIN
    IF lecturas_esperadas <= 0 THEN
        RETURN 0;
    END IF;
    
    RETURN (lecturas_validas * 100.0 / lecturas_esperadas);
END //

-- --------------------------------------------------------
-- PROCEDIMIENTOS PARA CÁLCULO DE PROMEDIOS
-- --------------------------------------------------------

-- Procedimiento para calcular promedios horarios
CREATE OR REPLACE PROCEDURE sem_calcular_promedios_hora(
    IN fecha_inicio TIMESTAMP,
    IN fecha_fin TIMESTAMP
)
proc_label:BEGIN
    DECLARE v_execution_id BIGINT;
    DECLARE v_error BOOLEAN DEFAULT FALSE;
    DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET v_error = TRUE;
    
    -- Validar período
    IF NOT sem_validar_periodo(fecha_inicio, fecha_fin, 'HORA') THEN
        SIGNAL SQLSTATE '45000' 
        SET MESSAGE_TEXT = 'Período inválido para cálculo horario';
    END IF;
    
    -- Registrar inicio de ejecución
    INSERT INTO sem_registro_auditoria (
        tipo_evento_id,
        descripcion,
        detalles
    ) VALUES (
        (SELECT id FROM sem_tipos_eventos WHERE nombre = 'CALCULO_PROMEDIOS'),
        'Inicio cálculo promedios horarios',
        JSON_OBJECT(
            'fecha_inicio', fecha_inicio,
            'fecha_fin', fecha_fin
        )
    );
    SET v_execution_id = LAST_INSERT_ID();

    START TRANSACTION;
    
    -- Calcular promedios
    INSERT INTO sem_promedios_hora (
        shelly_id,
        hora_utc,
        hora_local,
        -- Promedios por fase
        fase_a_voltaje_promedio,
        fase_a_corriente_promedio,
        fase_a_potencia_activa_promedio,
        fase_a_factor_potencia_promedio,
        fase_b_voltaje_promedio,
        fase_b_corriente_promedio,
        fase_b_potencia_activa_promedio,
        fase_b_factor_potencia_promedio,
        fase_c_voltaje_promedio,
        fase_c_corriente_promedio,
        fase_c_potencia_activa_promedio,
        fase_c_factor_potencia_promedio,
        -- Promedios totales
        potencia_activa_promedio,
        potencia_aparente_promedio,
        factor_potencia_promedio,
        -- Métricas de calidad
        lecturas_esperadas,
        lecturas_recibidas,
        lecturas_validas,
        calidad_datos
    )
    SELECT 
        m.shelly_id,
        DATE_FORMAT(m.measurement_timestamp, '%Y-%m-%d %H:00:00'),
        sem_convert_timezone(
            DATE_FORMAT(m.measurement_timestamp, '%Y-%m-%d %H:00:00'),
            'UTC',
            'America/Santiago'
        ),
        -- Promedios por fase
        AVG(m.fase_a_voltaje),
        AVG(m.fase_a_corriente),
        AVG(m.fase_a_potencia_activa),
        AVG(m.fase_a_factor_potencia),
        AVG(m.fase_b_voltaje),
        AVG(m.fase_b_corriente),
        AVG(m.fase_b_potencia_activa),
        AVG(m.fase_b_factor_potencia),
        AVG(m.fase_c_voltaje),
        AVG(m.fase_c_corriente),
        AVG(m.fase_c_potencia_activa),
        AVG(m.fase_c_factor_potencia),
        -- Promedios totales
        AVG(m.potencia_activa_total),
        AVG(m.potencia_aparente_total),
        AVG(m.factor_potencia_total),
        -- Métricas de calidad
        360 as lecturas_esperadas, -- 1 lectura cada 10 segundos
        COUNT(*) as lecturas_recibidas,
        SUM(CASE WHEN m.calidad_lectura = 'NORMAL' THEN 1 ELSE 0 END) as lecturas_validas,
        sem_validar_calidad(
            SUM(CASE WHEN m.calidad_lectura = 'NORMAL' THEN 1 ELSE 0 END),
            360
        ) as calidad_datos
    FROM sem_mediciones m
    WHERE m.measurement_timestamp BETWEEN fecha_inicio AND fecha_fin
    GROUP BY 
        m.shelly_id, 
        DATE_FORMAT(m.measurement_timestamp, '%Y-%m-%d %H:00:00')
    ON DUPLICATE KEY UPDATE
        fase_a_voltaje_promedio = VALUES(fase_a_voltaje_promedio),
        fase_a_corriente_promedio = VALUES(fase_a_corriente_promedio),
        fase_a_potencia_activa_promedio = VALUES(fase_a_potencia_activa_promedio),
        fase_a_factor_potencia_promedio = VALUES(fase_a_factor_potencia_promedio),
        fase_b_voltaje_promedio = VALUES(fase_b_voltaje_promedio),
        fase_b_corriente_promedio = VALUES(fase_b_corriente_promedio),
        fase_b_potencia_activa_promedio = VALUES(fase_b_potencia_activa_promedio),
        fase_b_factor_potencia_promedio = VALUES(fase_b_factor_potencia_promedio),
        fase_c_voltaje_promedio = VALUES(fase_c_voltaje_promedio),
        fase_c_corriente_promedio = VALUES(fase_c_corriente_promedio),
        fase_c_potencia_activa_promedio = VALUES(fase_c_potencia_activa_promedio),
        fase_c_factor_potencia_promedio = VALUES(fase_c_factor_potencia_promedio),
        potencia_activa_promedio = VALUES(potencia_activa_promedio),
        potencia_aparente_promedio = VALUES(potencia_aparente_promedio),
        factor_potencia_promedio = VALUES(factor_potencia_promedio),
        lecturas_recibidas = VALUES(lecturas_recibidas),
        lecturas_validas = VALUES(lecturas_validas),
        calidad_datos = VALUES(calidad_datos),
        fecha_actualizacion = CURRENT_TIMESTAMP;
    
    IF v_error THEN
        ROLLBACK;
        -- Registrar error
        UPDATE sem_registro_auditoria
        SET descripcion = CONCAT(descripcion, ' - Error'),
            detalles = JSON_SET(
                detalles,
                '$.error', TRUE,
                '$.fecha_error', CURRENT_TIMESTAMP
            )
        WHERE id = v_execution_id;
        
        SIGNAL SQLSTATE '45000' 
        SET MESSAGE_TEXT = 'Error en cálculo de promedios horarios';
    END IF;
    
    COMMIT;

    -- Registrar fin de ejecución
    UPDATE sem_registro_auditoria
    SET descripcion = CONCAT(descripcion, ' - Completado'),
        detalles = JSON_SET(
            detalles,
            '$.fecha_fin', CURRENT_TIMESTAMP,
            '$.registros_procesados', ROW_COUNT()
        )
    WHERE id = v_execution_id;
END //

-- Procedimiento para calcular promedios diarios
CREATE OR REPLACE PROCEDURE sem_calcular_promedios_dia(
    IN fecha_inicio DATE,
    IN fecha_fin DATE
)
proc_label:BEGIN
    DECLARE v_execution_id BIGINT;
    DECLARE v_error BOOLEAN DEFAULT FALSE;
    DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET v_error = TRUE;
    
    -- Validar período
    IF NOT sem_validar_periodo(
        TIMESTAMP(fecha_inicio), 
        TIMESTAMP(fecha_fin), 
        'DIA'
    ) THEN
        SIGNAL SQLSTATE '45000' 
        SET MESSAGE_TEXT = 'Período inválido para cálculo diario';
    END IF;
    
    -- Registrar inicio de ejecución
    INSERT INTO sem_registro_auditoria (
        tipo_evento_id,
        descripcion,
        detalles
    ) VALUES (
        (SELECT id FROM sem_tipos_eventos WHERE nombre = 'CALCULO_PROMEDIOS'),
        'Inicio cálculo promedios diarios',
        JSON_OBJECT(
            'fecha_inicio', fecha_inicio,
            'fecha_fin', fecha_fin
        )
    );
    SET v_execution_id = LAST_INSERT_ID();

    START TRANSACTION;
    
    -- Calcular promedios diarios basados en promedios horarios
    INSERT INTO sem_promedios_dia (
        shelly_id,
        fecha_utc,
        fecha_local,
        -- Promedios por fase
        fase_a_voltaje_promedio,
        fase_a_corriente_promedio,
        fase_a_potencia_promedio,
        fase_a_factor_potencia_promedio,
        fase_b_voltaje_promedio,
        fase_b_corriente_promedio,
        fase_b_potencia_promedio,
        fase_b_factor_potencia_promedio,
        fase_c_voltaje_promedio,
        fase_c_corriente_promedio,
        fase_c_potencia_promedio,
        fase_c_factor_potencia_promedio,
        -- Promedios totales
        potencia_activa_promedio,
        potencia_aparente_promedio,
        factor_potencia_promedio,
        -- Métricas temporales
        horas_con_datos,
        -- Métricas de calidad
        lecturas_esperadas,
        lecturas_recibidas,
        lecturas_validas,
        calidad_datos
    )
    SELECT 
        ph.shelly_id,
        DATE(ph.hora_utc),
        DATE(ph.hora_local),
        -- Promedios por fase
        AVG(ph.fase_a_voltaje_promedio),
        AVG(ph.fase_a_corriente_promedio),
        AVG(ph.fase_a_potencia_activa_promedio),
        AVG(ph.fase_a_factor_potencia_promedio),
        AVG(ph.fase_b_voltaje_promedio),
        AVG(ph.fase_b_corriente_promedio),
        AVG(ph.fase_b_potencia_activa_promedio),
        AVG(ph.fase_b_factor_potencia_promedio),
        AVG(ph.fase_c_voltaje_promedio),
        AVG(ph.fase_c_corriente_promedio),
        AVG(ph.fase_c_potencia_activa_promedio),
        AVG(ph.fase_c_factor_potencia_promedio),
        -- Promedios totales
        AVG(ph.potencia_activa_promedio),
        AVG(ph.potencia_aparente_promedio),
        AVG(ph.factor_potencia_promedio),
        -- Métricas temporales
        COUNT(DISTINCT HOUR(ph.hora_utc)) as horas_con_datos,
        -- Métricas de calidad
        SUM(ph.lecturas_esperadas) as lecturas_esperadas,
        SUM(ph.lecturas_recibidas) as lecturas_recibidas,
        SUM(ph.lecturas_validas) as lecturas_validas,
        sem_validar_calidad(
            SUM(ph.lecturas_validas),
            SUM(ph.lecturas_esperadas)
        ) as calidad_datos
    FROM sem_promedios_hora ph
    WHERE DATE(ph.hora_utc) BETWEEN fecha_inicio AND fecha_fin
    GROUP BY 
        ph.shelly_id, 
        DATE(ph.hora_utc),
        DATE(ph.hora_local)
    ON DUPLICATE KEY UPDATE
        fase_a_voltaje_promedio = VALUES(fase_a_voltaje_promedio),
        fase_a_corriente_promedio = VALUES(fase_a_corriente_promedio),
        fase_a_potencia_promedio = VALUES(fase_a_potencia_promedio),
        fase_a_factor_potencia_promedio = VALUES(fase_a_factor_potencia_promedio),
        fase_b_voltaje_promedio = VALUES(fase_b_voltaje_promedio),
        fase_b_corriente_promedio = VALUES(fase_b_corriente_promedio),
        fase_b_potencia_promedio = VALUES(fase_b_potencia_promedio),
        fase_b_factor_potencia_promedio = VALUES(fase_b_factor_potencia_promedio),
        fase_c_voltaje_promedio = VALUES(fase_c_voltaje_promedio),
        fase_c_corriente_promedio = VALUES(fase_c_corriente_promedio),
        fase_c_potencia_promedio = VALUES(fase_c_potencia_promedio),
        fase_c_factor_potencia_promedio = VALUES(fase_c_factor_potencia_promedio),
        potencia_activa_promedio = VALUES(potencia_activa_promedio),
        potencia_aparente_promedio = VALUES(potencia_aparente_promedio),
        factor_potencia_promedio = VALUES(factor_potencia_promedio),
        horas_con_datos = VALUES(horas_con_datos),
        lecturas_esperadas = VALUES(lecturas_esperadas),
        lecturas_recibidas = VALUES(lecturas_recibidas),
        lecturas_validas = VALUES(lecturas_validas),
        calidad_datos = VALUES(calidad_datos),
        fecha_actualizacion = CURRENT_TIMESTAMP;

    IF v_error THEN
        ROLLBACK;
        UPDATE sem_registro_auditoria
        SET descripcion = CONCAT(descripcion, ' - Error'),
            detalles = JSON_SET(
                detalles,
                '$.error', TRUE,
                '$.fecha_error', CURRENT_TIMESTAMP
            )
        WHERE id = v_execution_id;
        
        SIGNAL SQLSTATE '45000' 
        SET MESSAGE_TEXT = 'Error en cálculo de promedios diarios';
    END IF;
    
    COMMIT;

    -- Registrar fin de ejecución
    UPDATE sem_registro_auditoria
    SET descripcion = CONCAT(descripcion, ' - Completado'),
        detalles = JSON_SET(
            detalles,
            '$.fecha_fin', CURRENT_TIMESTAMP,
            '$.registros_procesados', ROW_COUNT()
        )
    WHERE id = v_execution_id;
END //

-- Procedimiento para calcular promedios mensuales

CREATE OR REPLACE PROCEDURE sem_calcular_promedios_mes(
    IN p_año INT,
    IN p_mes INT
)
proc_label:BEGIN
    DECLARE v_execution_id BIGINT;
    DECLARE v_error BOOLEAN DEFAULT FALSE;
    DECLARE v_fecha_inicio DATE;
    DECLARE v_fecha_fin DATE;
    DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET v_error = TRUE;
    
    -- Validar año y mes
    IF p_mes < 1 OR p_mes > 12 THEN
        SIGNAL SQLSTATE '45000' 
        SET MESSAGE_TEXT = 'Mes inválido';
    END IF;
    
    -- Calcular fechas del período
    SET v_fecha_inicio = DATE(CONCAT(p_año, '-', p_mes, '-01'));
    SET v_fecha_fin = LAST_DAY(v_fecha_inicio);
    
    -- Registrar inicio de ejecución
    INSERT INTO sem_registro_auditoria (
        tipo_evento_id,
        descripcion,
        detalles
    ) VALUES (
        (SELECT id FROM sem_tipos_eventos WHERE nombre = 'CALCULO_PROMEDIOS'),
        'Inicio cálculo promedios mensuales',
        JSON_OBJECT(
            'año', p_año,
            'mes', p_mes,
            'fecha_inicio', v_fecha_inicio,
            'fecha_fin', v_fecha_fin
        )
    );
    SET v_execution_id = LAST_INSERT_ID();

    START TRANSACTION;
    
    -- Calcular promedios mensuales basados en promedios diarios
    INSERT INTO sem_promedios_mes (
        shelly_id,
        año,
        mes,
        -- Promedios por fase
        fase_a_voltaje_promedio,
        fase_a_corriente_promedio,
        fase_a_potencia_promedio,
        fase_a_factor_potencia_promedio,
        fase_b_voltaje_promedio,
        fase_b_corriente_promedio,
        fase_b_potencia_promedio,
        fase_b_factor_potencia_promedio,
        fase_c_voltaje_promedio,
        fase_c_corriente_promedio,
        fase_c_potencia_promedio,
        fase_c_factor_potencia_promedio,
        -- Promedios totales
        potencia_activa_promedio,
        potencia_aparente_promedio,
        factor_potencia_promedio,
        -- Métricas temporales
        dias_con_datos,
        horas_con_datos,
        -- Métricas de calidad
        lecturas_esperadas,
        lecturas_recibidas,
        lecturas_validas,
        calidad_datos
    )
    SELECT 
        pd.shelly_id,
        p_año,
        p_mes,
        -- Promedios por fase
        AVG(pd.fase_a_voltaje_promedio),
        AVG(pd.fase_a_corriente_promedio),
        AVG(pd.fase_a_potencia_promedio),
        AVG(pd.fase_a_factor_potencia_promedio),
        AVG(pd.fase_b_voltaje_promedio),
        AVG(pd.fase_b_corriente_promedio),
        AVG(pd.fase_b_potencia_promedio),
        AVG(pd.fase_b_factor_potencia_promedio),
        AVG(pd.fase_c_voltaje_promedio),
        AVG(pd.fase_c_corriente_promedio),
        AVG(pd.fase_c_potencia_promedio),
        AVG(pd.fase_c_factor_potencia_promedio),
        -- Promedios totales
        AVG(pd.potencia_activa_promedio),
        AVG(pd.potencia_aparente_promedio),
        AVG(pd.factor_potencia_promedio),
        -- Métricas temporales
        COUNT(DISTINCT DATE(pd.fecha_utc)) as dias_con_datos,
        SUM(pd.horas_con_datos) as horas_con_datos,
        -- Métricas de calidad
        SUM(pd.lecturas_esperadas) as lecturas_esperadas,
        SUM(pd.lecturas_recibidas) as lecturas_recibidas,
        SUM(pd.lecturas_validas) as lecturas_validas,
        sem_validar_calidad(
            SUM(pd.lecturas_validas),
            SUM(pd.lecturas_esperadas)
        ) as calidad_datos
    FROM sem_promedios_dia pd
    WHERE DATE(pd.fecha_utc) BETWEEN v_fecha_inicio AND v_fecha_fin
    GROUP BY pd.shelly_id
    ON DUPLICATE KEY UPDATE
        fase_a_voltaje_promedio = VALUES(fase_a_voltaje_promedio),
        fase_a_corriente_promedio = VALUES(fase_a_corriente_promedio),
        fase_a_potencia_promedio = VALUES(fase_a_potencia_promedio),
        fase_a_factor_potencia_promedio = VALUES(fase_a_factor_potencia_promedio),
        fase_b_voltaje_promedio = VALUES(fase_b_voltaje_promedio),
        fase_b_corriente_promedio = VALUES(fase_b_corriente_promedio),
        fase_b_potencia_promedio = VALUES(fase_b_potencia_promedio),
        fase_b_factor_potencia_promedio = VALUES(fase_b_factor_potencia_promedio),
        fase_c_voltaje_promedio = VALUES(fase_c_voltaje_promedio),
        fase_c_corriente_promedio = VALUES(fase_c_corriente_promedio),
        fase_c_potencia_promedio = VALUES(fase_c_potencia_promedio),
        fase_c_factor_potencia_promedio = VALUES(fase_c_factor_potencia_promedio),
        potencia_activa_promedio = VALUES(potencia_activa_promedio),
        potencia_aparente_promedio = VALUES(potencia_aparente_promedio),
        factor_potencia_promedio = VALUES(factor_potencia_promedio),
        dias_con_datos = VALUES(dias_con_datos),
        horas_con_datos = VALUES(horas_con_datos),
        lecturas_esperadas = VALUES(lecturas_esperadas),
        lecturas_recibidas = VALUES(lecturas_recibidas),
        lecturas_validas = VALUES(lecturas_validas),
        calidad_datos = VALUES(calidad_datos),
        fecha_actualizacion = CURRENT_TIMESTAMP;

    IF v_error THEN
        ROLLBACK;
        -- Registrar error
        UPDATE sem_registro_auditoria
        SET descripcion = CONCAT(descripcion, ' - Error'),
            detalles = JSON_SET(
                detalles,
                '$.error', TRUE,
                '$.fecha_error', CURRENT_TIMESTAMP,
                '$.mensaje', 'Error en cálculo de promedios mensuales'
            )
        WHERE id = v_execution_id;
        
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Error en cálculo de promedios mensuales';
    END IF;
    
    COMMIT;

    -- Registrar fin de ejecución exitosa
    UPDATE sem_registro_auditoria
    SET descripcion = CONCAT(descripcion, ' - Completado'),
        detalles = JSON_SET(
            detalles,
            '$.fecha_fin', CURRENT_TIMESTAMP,
            '$.registros_procesados', ROW_COUNT(),
            '$.dias_procesados', DATEDIFF(v_fecha_fin, v_fecha_inicio) + 1
        )
    WHERE id = v_execution_id;
    
    -- Verificar calidad de los datos calculados
    CALL sem_validar_agregaciones_mes(p_año, p_mes);
END //

-- --------------------------------------------------------
-- PROCEDIMIENTOS PARA CÁLCULO DE TOTALES
-- --------------------------------------------------------

-- Procedimiento para calcular totales horarios



CREATE OR REPLACE PROCEDURE sem_calcular_totales_hora(
    IN fecha_inicio TIMESTAMP,
    IN fecha_fin TIMESTAMP
)
proc_label:BEGIN
    DECLARE v_execution_id BIGINT;
    DECLARE v_error BOOLEAN DEFAULT FALSE;
    DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET v_error = TRUE;
    
    -- Validar período
    IF NOT sem_validar_periodo(fecha_inicio, fecha_fin, 'HORA') THEN
        SIGNAL SQLSTATE '45000' 
        SET MESSAGE_TEXT = 'Período inválido para cálculo horario';
    END IF;
    
    -- Registrar inicio de ejecución
    INSERT INTO sem_registro_auditoria (
        tipo_evento_id,
        descripcion,
        detalles
    ) VALUES (
        (SELECT id FROM sem_tipos_eventos WHERE nombre = 'CALCULO_TOTALES'),
        'Inicio cálculo totales horarios',
        JSON_OBJECT(
            'fecha_inicio', fecha_inicio,
            'fecha_fin', fecha_fin
        )
    );
    SET v_execution_id = LAST_INSERT_ID();

    START TRANSACTION;
    
    -- Calcular totales horarios
    INSERT INTO sem_totales_hora (
        shelly_id,
        hora_utc,
        hora_local,
        -- Totales por fase
        fase_a_energia_activa,
        fase_a_energia_reactiva,
        fase_b_energia_activa,
        fase_b_energia_reactiva,
        fase_c_energia_activa,
        fase_c_energia_reactiva,
        -- Totales generales
        energia_activa_total,
        energia_reactiva_total,
        potencia_maxima,
        potencia_minima,
        -- Costos
        precio_kwh_periodo,
        costo_total,
        -- Calidad
        lecturas_validas,
        calidad_datos
    )
    SELECT 
        m.shelly_id,
        DATE_FORMAT(m.measurement_timestamp, '%Y-%m-%d %H:00:00'),
        sem_convert_timezone(
            DATE_FORMAT(m.measurement_timestamp, '%Y-%m-%d %H:00:00'),
            'UTC',
            'America/Santiago'
        ),
        -- Totales por fase
        SUM(m.fase_a_energia_activa),
        SUM(m.fase_a_energia_reactiva),
        SUM(m.fase_b_energia_activa),
        SUM(m.fase_b_energia_reactiva),
        SUM(m.fase_c_energia_activa),
        SUM(m.fase_c_energia_reactiva),
        -- Totales generales
        SUM(m.energia_activa_total),
        SUM(m.energia_reactiva_total),
        MAX(m.potencia_activa_total),
        MIN(m.potencia_activa_total),
        -- Costos usando la función correcta
        sem_calcular_precio_promedio(
            DATE_FORMAT(m.measurement_timestamp, '%Y-%m-%d %H:00:00'),
            DATE_FORMAT(m.measurement_timestamp, '%Y-%m-%d %H:59:59')
        ),
        SUM(m.energia_activa_total) * sem_calcular_precio_promedio(
            DATE_FORMAT(m.measurement_timestamp, '%Y-%m-%d %H:00:00'),
            DATE_FORMAT(m.measurement_timestamp, '%Y-%m-%d %H:59:59')
        ),
        -- Calidad
        COUNT(CASE WHEN m.calidad_lectura = 'NORMAL' THEN 1 END),
        (COUNT(CASE WHEN m.calidad_lectura = 'NORMAL' THEN 1 END) * 100.0) / NULLIF(COUNT(*), 0)
    FROM sem_mediciones m
    WHERE m.measurement_timestamp BETWEEN fecha_inicio AND fecha_fin
    GROUP BY 
        m.shelly_id,
        DATE_FORMAT(m.measurement_timestamp, '%Y-%m-%d %H:00:00')
    ON DUPLICATE KEY UPDATE
        fase_a_energia_activa = VALUES(fase_a_energia_activa),
        fase_a_energia_reactiva = VALUES(fase_a_energia_reactiva),
        fase_b_energia_activa = VALUES(fase_b_energia_activa),
        fase_b_energia_reactiva = VALUES(fase_b_energia_reactiva),
        fase_c_energia_activa = VALUES(fase_c_energia_activa),
        fase_c_energia_reactiva = VALUES(fase_c_energia_reactiva),
        energia_activa_total = VALUES(energia_activa_total),
        energia_reactiva_total = VALUES(energia_reactiva_total),
        potencia_maxima = VALUES(potencia_maxima),
        potencia_minima = VALUES(potencia_minima),
        precio_kwh_periodo = VALUES(precio_kwh_periodo),
        costo_total = VALUES(costo_total),
        lecturas_validas = VALUES(lecturas_validas),
        calidad_datos = VALUES(calidad_datos),
        fecha_actualizacion = CURRENT_TIMESTAMP;

    IF v_error THEN
        ROLLBACK;
        UPDATE sem_registro_auditoria
        SET descripcion = CONCAT(descripcion, ' - Error'),
            detalles = JSON_SET(
                detalles,
                '$.error', TRUE,
                '$.fecha_error', CURRENT_TIMESTAMP
            )
        WHERE id = v_execution_id;
        
        SIGNAL SQLSTATE '45000' 
        SET MESSAGE_TEXT = 'Error en cálculo de totales horarios';
    END IF;
    
    COMMIT;

    -- Registrar fin de ejecución
    UPDATE sem_registro_auditoria
    SET descripcion = CONCAT(descripcion, ' - Completado'),
        detalles = JSON_SET(
            detalles,
            '$.fecha_fin', CURRENT_TIMESTAMP,
            '$.registros_procesados', ROW_COUNT()
        )
    WHERE id = v_execution_id;
END 

-- Procedimiento para calcular totales diarios
CREATE OR REPLACE PROCEDURE sem_calcular_totales_dia(
    IN fecha_inicio DATE,
    IN fecha_fin DATE
)
proc_label:BEGIN
    DECLARE v_execution_id BIGINT;
    DECLARE v_error BOOLEAN DEFAULT FALSE;
    DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET v_error = TRUE;
    
    -- Validar período
    IF NOT sem_validar_periodo(
        TIMESTAMP(fecha_inicio), 
        TIMESTAMP(fecha_fin), 
        'DIA'
    ) THEN
        SIGNAL SQLSTATE '45000' 
        SET MESSAGE_TEXT = 'Período inválido para cálculo diario';
    END IF;
    
    -- Registrar inicio de ejecución
    INSERT INTO sem_registro_auditoria (
        tipo_evento_id,
        descripcion,
        detalles
    ) VALUES (
        (SELECT id FROM sem_tipos_eventos WHERE nombre = 'CALCULO_TOTALES'),
        'Inicio cálculo totales diarios',
        JSON_OBJECT(
            'fecha_inicio', fecha_inicio,
            'fecha_fin', fecha_fin
        )
    );
    SET v_execution_id = LAST_INSERT_ID();

    START TRANSACTION;
    
    -- Calcular totales diarios basados en totales horarios
    INSERT INTO sem_totales_dia (
        shelly_id,
        fecha_utc,
        fecha_local,
        fase_a_energia_activa,
        fase_a_energia_reactiva,
        fase_b_energia_activa,
        fase_b_energia_reactiva,
        fase_c_energia_activa,
        fase_c_energia_reactiva,
        energia_activa_total,
        energia_reactiva_total,
        potencia_maxima,
        potencia_minima,
        precio_kwh_promedio,
        costo_total,
        horas_con_datos
    )
    SELECT 
        th.shelly_id,
        DATE(th.hora_utc),
        DATE(th.hora_local),
        -- Totales energía por fase
        SUM(th.fase_a_energia_activa),
        SUM(th.fase_a_energia_reactiva),
        SUM(th.fase_b_energia_activa),
        SUM(th.fase_b_energia_reactiva),
        SUM(th.fase_c_energia_activa),
        SUM(th.fase_c_energia_reactiva),
        -- Totales energía global
        SUM(th.energia_activa_total),
        SUM(th.energia_reactiva_total),
        -- Potencias máxima y mínima del día
        MAX(th.potencia_maxima),
        MIN(th.potencia_minima),
        -- Precio y costo
        AVG(th.precio_kwh_periodo),
        SUM(th.costo_total),
        -- Horas con datos válidos
        COUNT(DISTINCT HOUR(th.hora_utc))
    FROM sem_totales_hora th
    WHERE DATE(th.hora_utc) BETWEEN fecha_inicio AND fecha_fin
    GROUP BY 
        th.shelly_id, 
        DATE(th.hora_utc),
        DATE(th.hora_local)
    HAVING horas_con_datos > 0
    ON DUPLICATE KEY UPDATE
        fase_a_energia_activa = VALUES(fase_a_energia_activa),
        fase_a_energia_reactiva = VALUES(fase_a_energia_reactiva),
        fase_b_energia_activa = VALUES(fase_b_energia_activa),
        fase_b_energia_reactiva = VALUES(fase_b_energia_reactiva),
        fase_c_energia_activa = VALUES(fase_c_energia_activa),
        fase_c_energia_reactiva = VALUES(fase_c_energia_reactiva),
        energia_activa_total = VALUES(energia_activa_total),
        energia_reactiva_total = VALUES(energia_reactiva_total),
        potencia_maxima = VALUES(potencia_maxima),
        potencia_minima = VALUES(potencia_minima),
        precio_kwh_promedio = VALUES(precio_kwh_promedio),
        costo_total = VALUES(costo_total),
        horas_con_datos = VALUES(horas_con_datos),
        fecha_actualizacion = CURRENT_TIMESTAMP;

    IF v_error THEN
        ROLLBACK;
        
        -- Registrar error
        UPDATE sem_registro_auditoria
        SET descripcion = CONCAT(descripcion, ' - Error'),
            detalles = JSON_SET(
                detalles,
                '$.error', TRUE,
                '$.fecha_error', CURRENT_TIMESTAMP,
                '$.mensaje', 'Error en cálculo de totales diarios'
            )
        WHERE id = v_execution_id;
        
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Error en cálculo de totales diarios';
    END IF;
    
    COMMIT;
    
    -- Registrar fin de ejecución exitosa
    UPDATE sem_registro_auditoria
    SET descripcion = CONCAT(descripcion, ' - Completado'),
        detalles = JSON_SET(
            detalles,
            '$.fecha_fin', CURRENT_TIMESTAMP,
            '$.registros_procesados', ROW_COUNT(),
            '$.dias_procesados', DATEDIFF(fecha_fin, fecha_inicio) + 1
        )
    WHERE id = v_execution_id;

    -- Verificar la calidad de los datos calculados
    CALL sem_validar_agregaciones_dia(fecha_inicio, fecha_fin);
    
    -- Validar consistencia con promedios diarios
    INSERT INTO sem_registro_auditoria (
        tipo_evento_id,
        descripcion,
        detalles
    )
    SELECT 
        (SELECT id FROM sem_tipos_eventos WHERE nombre = 'VALIDACION_DATOS'),
        'Verificación de consistencia totales-promedios diarios',
        JSON_OBJECT(
            'fecha', td.fecha_utc,
            'shelly_id', td.shelly_id,
            'diferencia_energia', ABS(td.energia_activa_total - (pd.potencia_activa_promedio * pd.horas_con_datos)) / 
                NULLIF(td.energia_activa_total, 0) * 100
        )
    FROM sem_totales_dia td
    JOIN sem_promedios_dia pd ON td.shelly_id = pd.shelly_id 
        AND td.fecha_utc = pd.fecha_utc
    WHERE td.fecha_utc BETWEEN fecha_inicio AND fecha_fin
    AND ABS(td.energia_activa_total - (pd.potencia_activa_promedio * pd.horas_con_datos)) / 
        NULLIF(td.energia_activa_total, 0) * 100 > 5;  -- Diferencia mayor al 5%

END //


-- Totales Mensuales (Faltante)
CREATE OR REPLACE PROCEDURE sem_calcular_totales_mes(
    IN p_año INT,
    IN p_mes INT
)
proc_label:BEGIN
    DECLARE v_execution_id BIGINT;
    DECLARE v_error BOOLEAN DEFAULT FALSE;
    DECLARE v_fecha_inicio DATE;
    DECLARE v_fecha_fin DATE;
    DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET v_error = TRUE;
    
    -- Validar año y mes
    IF p_año < 2000 OR p_mes < 1 OR p_mes > 12 THEN
        SIGNAL SQLSTATE '45000' 
        SET MESSAGE_TEXT = 'Año o mes inválido';
    END IF;
    
    SET v_fecha_inicio = DATE(CONCAT(p_año, '-', p_mes, '-01'));
    SET v_fecha_fin = LAST_DAY(v_fecha_inicio);
    
    START TRANSACTION;
    
    INSERT INTO sem_totales_mes (
        shelly_id,
        año,
        mes,
        fase_a_energia_activa,
        fase_a_energia_reactiva,
        fase_b_energia_activa,
        fase_b_energia_reactiva,
        fase_c_energia_activa,
        fase_c_energia_reactiva,
        energia_activa_total,
        energia_reactiva_total,
        potencia_maxima,
        potencia_minima,
        precio_kwh_promedio,
        costo_total,
        dias_con_datos,
        horas_con_datos
    )
    SELECT 
        td.shelly_id,
        p_año,
        p_mes,
        SUM(td.fase_a_energia_activa),
        SUM(td.fase_a_energia_reactiva),
        SUM(td.fase_b_energia_activa),
        SUM(td.fase_b_energia_reactiva),
        SUM(td.fase_c_energia_activa),
        SUM(td.fase_c_energia_reactiva),
        SUM(td.energia_activa_total),
        SUM(td.energia_reactiva_total),
        MAX(td.potencia_maxima),
        MIN(td.potencia_minima),
        AVG(td.precio_kwh_promedio),
        SUM(td.costo_total),
        COUNT(DISTINCT DATE(td.fecha_utc)),
        SUM(td.horas_con_datos)
    FROM sem_totales_dia td
    WHERE DATE(td.fecha_utc) BETWEEN v_fecha_inicio AND v_fecha_fin
    GROUP BY td.shelly_id;

    IF v_error THEN
        ROLLBACK;
        SIGNAL SQLSTATE '45000' 
        SET MESSAGE_TEXT = 'Error en cálculo de totales mensuales';
    END IF;
    
    COMMIT;
END //
CREATE OR REPLACE PROCEDURE sem_calcular_promedios_grupo_hora(
    IN fecha_inicio TIMESTAMP,
    IN fecha_fin TIMESTAMP
)
proc_label:BEGIN
    DECLARE v_execution_id BIGINT;
    DECLARE v_error BOOLEAN DEFAULT FALSE;
    DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET v_error = TRUE;
    
    IF NOT sem_validar_periodo(fecha_inicio, fecha_fin, 'HORA') THEN
        SIGNAL SQLSTATE '45000' 
        SET MESSAGE_TEXT = 'Período inválido para cálculo horario de grupo';
    END IF;
    
    START TRANSACTION;
    
    INSERT INTO sem_grupo_promedios (
        grupo_id,
        periodo_tipo,
        periodo_inicio,
        periodo_fin,
        dispositivos_activos,
        dispositivos_con_datos,
        potencia_activa_promedio,
        potencia_aparente_promedio,
        factor_potencia_promedio,
        factor_utilizacion,
        calidad_promedio
    )
    SELECT 
        d.grupo_id,
        'HORA',
        DATE_FORMAT(ph.hora_utc, '%Y-%m-%d %H:00:00'),
        DATE_FORMAT(ph.hora_utc, '%Y-%m-%d %H:59:59'),
        COUNT(DISTINCT d.shelly_id),
        COUNT(DISTINCT CASE WHEN ph.lecturas_validas > 0 THEN d.shelly_id END),
        AVG(ph.potencia_activa_promedio),
        AVG(ph.potencia_aparente_promedio),
        AVG(ph.factor_potencia_promedio),
        (AVG(ph.potencia_activa_promedio) / MAX(ph.potencia_activa_promedio)) * 100,
        AVG(ph.calidad_datos)
    FROM sem_dispositivos d
    JOIN sem_promedios_hora ph ON d.shelly_id = ph.shelly_id
    WHERE ph.hora_utc BETWEEN fecha_inicio AND fecha_fin
    AND d.activo = TRUE
    GROUP BY d.grupo_id, DATE_FORMAT(ph.hora_utc, '%Y-%m-%d %H:00:00');

    IF v_error THEN
        ROLLBACK;
        SIGNAL SQLSTATE '45000' 
        SET MESSAGE_TEXT = 'Error en cálculo de promedios de grupo horarios';
    END IF;
    
    COMMIT;
END //

-- --------------------------------------------------------
-- PROCEDIMIENTOS DE GRUPO - PROMEDIOS
-- --------------------------------------------------------

CREATE OR REPLACE PROCEDURE sem_calcular_promedios_grupo_dia(
    IN fecha_inicio DATE,
    IN fecha_fin DATE
)
proc_label:BEGIN
    DECLARE v_execution_id BIGINT;
    DECLARE v_error BOOLEAN DEFAULT FALSE;
    DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET v_error = TRUE;
    
    -- Validar período
    IF NOT sem_validar_periodo(
        TIMESTAMP(fecha_inicio), 
        TIMESTAMP(fecha_fin), 
        'DIA'
    ) THEN
        SIGNAL SQLSTATE '45000' 
        SET MESSAGE_TEXT = 'Período inválido para cálculo diario de grupo';
    END IF;
    
    START TRANSACTION;
    
    INSERT INTO sem_grupo_promedios (
        grupo_id,
        periodo_tipo,
        periodo_inicio,
        periodo_fin,
        dispositivos_activos,
        dispositivos_con_datos,
        potencia_activa_promedio,
        potencia_aparente_promedio,
        factor_potencia_promedio,
        factor_utilizacion,
        calidad_promedio
    )
    SELECT 
        d.grupo_id,
        'DIA',
        DATE(pd.fecha_utc),
        DATE(pd.fecha_utc) + INTERVAL 1 DAY - INTERVAL 1 SECOND,
        COUNT(DISTINCT d.shelly_id),
        COUNT(DISTINCT CASE WHEN pd.lecturas_validas > 0 THEN d.shelly_id END),
        AVG(pd.potencia_activa_promedio),
        AVG(pd.potencia_aparente_promedio),
        AVG(pd.factor_potencia_promedio),
        (AVG(pd.potencia_activa_promedio) / NULLIF(MAX(pd.potencia_activa_promedio), 0)) * 100,
        AVG(pd.calidad_datos)
    FROM sem_dispositivos d
    JOIN sem_promedios_dia pd ON d.shelly_id = pd.shelly_id
    WHERE DATE(pd.fecha_utc) BETWEEN fecha_inicio AND fecha_fin
    AND d.activo = TRUE
    GROUP BY d.grupo_id, DATE(pd.fecha_utc);

    IF v_error THEN
        ROLLBACK;
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Error en cálculo de promedios de grupo diarios';
    END IF;
    
    COMMIT;
END //

CREATE OR REPLACE PROCEDURE sem_calcular_promedios_grupo_mes(
    IN p_año INT,
    IN p_mes INT
)
proc_label:BEGIN
    DECLARE v_execution_id BIGINT;
    DECLARE v_error BOOLEAN DEFAULT FALSE;
    DECLARE v_fecha_inicio DATE;
    DECLARE v_fecha_fin DATE;
    DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET v_error = TRUE;
    
    SET v_fecha_inicio = DATE(CONCAT(p_año, '-', p_mes, '-01'));
    SET v_fecha_fin = LAST_DAY(v_fecha_inicio);
    
    START TRANSACTION;
    
    INSERT INTO sem_grupo_promedios (
        grupo_id,
        periodo_tipo,
        periodo_inicio,
        periodo_fin,
        dispositivos_activos,
        dispositivos_con_datos,
        potencia_activa_promedio,
        potencia_aparente_promedio,
        factor_potencia_promedio,
        factor_utilizacion,
        calidad_promedio
    )
    SELECT 
        d.grupo_id,
        'MES',
        v_fecha_inicio,
        v_fecha_fin,
        COUNT(DISTINCT d.shelly_id),
        COUNT(DISTINCT CASE WHEN pm.lecturas_validas > 0 THEN d.shelly_id END),
        AVG(pm.potencia_activa_promedio),
        AVG(pm.potencia_aparente_promedio),
        AVG(pm.factor_potencia_promedio),
        (AVG(pm.potencia_activa_promedio) / NULLIF(MAX(pm.potencia_activa_promedio), 0)) * 100,
        AVG(pm.calidad_datos)
    FROM sem_dispositivos d
    JOIN sem_promedios_mes pm ON d.shelly_id = pm.shelly_id
    WHERE pm.año = p_año AND pm.mes = p_mes
    AND d.activo = TRUE
    GROUP BY d.grupo_id;

    IF v_error THEN
        ROLLBACK;
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Error en cálculo de promedios de grupo mensuales';
    END IF;
    
    COMMIT;
END //

-- --------------------------------------------------------
-- PROCEDIMIENTOS DE GRUPO - TOTALES
-- --------------------------------------------------------

CREATE OR REPLACE PROCEDURE sem_calcular_totales_grupo_hora(
    IN fecha_inicio TIMESTAMP,
    IN fecha_fin TIMESTAMP
)
proc_label:BEGIN
    DECLARE v_execution_id BIGINT;
    DECLARE v_error BOOLEAN DEFAULT FALSE;
    DECLARE v_registros_procesados INT DEFAULT 0;
    DECLARE v_grupos_procesados INT DEFAULT 0;
    DECLARE CONTINUE HANDLER FOR SQLEXCEPTION 
    BEGIN
        SET v_error = TRUE;
    END;
    
    -- Validar período
    IF NOT sem_validar_periodo(fecha_inicio, fecha_fin, 'HORA') THEN
        SIGNAL SQLSTATE '45000' 
        SET MESSAGE_TEXT = 'Período inválido para cálculo horario de grupo';
    END IF;
    
    -- Registrar inicio de ejecución
    INSERT INTO sem_registro_auditoria (
        tipo_evento_id,
        descripcion,
        detalles
    ) VALUES (
        (SELECT id FROM sem_tipos_eventos WHERE nombre = 'CALCULO_TOTALES'),
        'Inicio cálculo totales de grupo por hora',
        JSON_OBJECT(
            'fecha_inicio', fecha_inicio,
            'fecha_fin', fecha_fin,
            'tipo', 'GRUPO_HORA'
        )
    );
    SET v_execution_id = LAST_INSERT_ID();

    START TRANSACTION;
    
    -- Crear tabla temporal para almacenar resultados intermedios
    CREATE TEMPORARY TABLE IF NOT EXISTS temp_totales_grupo (
        grupo_id INT,
        hora_utc TIMESTAMP,
        dispositivos_total INT,
        dispositivos_activos INT,
        dispositivos_con_datos INT,
        energia_activa_total DECIMAL(15,3),
        energia_reactiva_total DECIMAL(15,3),
        potencia_maxima DECIMAL(10,2),
        potencia_minima DECIMAL(10,2),
        precio_kwh_promedio DECIMAL(10,2),
        costo_total DECIMAL(15,2)
    );
    
    -- Calcular totales por grupo y hora
    INSERT INTO temp_totales_grupo
    WITH HourlyData AS (
        SELECT 
            d.grupo_id,
            DATE_FORMAT(th.hora_utc, '%Y-%m-%d %H:00:00') as hora_utc,
            COUNT(DISTINCT d.shelly_id) as total_dispositivos,
            COUNT(DISTINCT CASE WHEN d.activo = TRUE THEN d.shelly_id END) as dispositivos_activos,
            COUNT(DISTINCT CASE WHEN th.lecturas_validas > 0 THEN d.shelly_id END) as dispositivos_con_datos,
            SUM(th.energia_activa_total) as energia_activa,
            SUM(th.energia_reactiva_total) as energia_reactiva,
            MAX(th.potencia_maxima) as potencia_max,
            MIN(th.potencia_minima) as potencia_min,
            AVG(th.precio_kwh_periodo) as precio_promedio,
            SUM(th.costo_total) as costo
        FROM sem_dispositivos d
        JOIN sem_totales_hora th ON d.shelly_id = th.shelly_id
        WHERE th.hora_utc BETWEEN fecha_inicio AND fecha_fin
        GROUP BY 
            d.grupo_id, 
            DATE_FORMAT(th.hora_utc, '%Y-%m-%d %H:00:00')
    )
    SELECT 
        grupo_id,
        hora_utc,
        total_dispositivos,
        dispositivos_activos,
        dispositivos_con_datos,
        COALESCE(energia_activa, 0) as energia_activa_total,
        COALESCE(energia_reactiva, 0) as energia_reactiva_total,
        COALESCE(potencia_max, 0) as potencia_maxima,
        COALESCE(potencia_min, 0) as potencia_minima,
        COALESCE(precio_promedio, 0) as precio_kwh_promedio,
        COALESCE(costo, 0) as costo_total
    FROM HourlyData;
    
    -- Validar los resultados antes de insertar
    SELECT COUNT(*) INTO v_registros_procesados FROM temp_totales_grupo;
    SELECT COUNT(DISTINCT grupo_id) INTO v_grupos_procesados FROM temp_totales_grupo;
    
    -- Insertar o actualizar en la tabla final
    INSERT INTO sem_grupo_totales (
        grupo_id,
        periodo_tipo,
        periodo_inicio,
        periodo_fin,
        dispositivos_total,
        dispositivos_activos,
        dispositivos_con_datos,
        energia_activa_total,
        energia_reactiva_total,
        potencia_maxima,
        potencia_minima,
        precio_kwh_promedio,
        costo_total
    )
    SELECT 
        grupo_id,
        'HORA',
        hora_utc,
        hora_utc + INTERVAL 1 HOUR - INTERVAL 1 SECOND,
        dispositivos_total,
        dispositivos_activos,
        dispositivos_con_datos,
        energia_activa_total,
        energia_reactiva_total,
        potencia_maxima,
        potencia_minima,
        precio_kwh_promedio,
        costo_total
    FROM temp_totales_grupo
    ON DUPLICATE KEY UPDATE
        dispositivos_total = VALUES(dispositivos_total),
        dispositivos_activos = VALUES(dispositivos_activos),
        dispositivos_con_datos = VALUES(dispositivos_con_datos),
        energia_activa_total = VALUES(energia_activa_total),
        energia_reactiva_total = VALUES(energia_reactiva_total),
        potencia_maxima = VALUES(potencia_maxima),
        potencia_minima = VALUES(potencia_minima),
        precio_kwh_promedio = VALUES(precio_kwh_promedio),
        costo_total = VALUES(costo_total);

    -- Verificar consistencia de los datos calculados
    INSERT INTO sem_registro_auditoria (
        tipo_evento_id,
        descripcion,
        detalles
    )
    SELECT 
        (SELECT id FROM sem_tipos_eventos WHERE nombre = 'VALIDACION_DATOS'),
        'Validación de totales de grupo por hora',
        JSON_OBJECT(
            'grupo_id', gt.grupo_id,
            'hora', gt.periodo_inicio,
            'energia_total', gt.energia_activa_total,
            'dispositivos_activos', gt.dispositivos_activos,
            'proporcion_dispositivos_con_datos', 
                CASE 
                    WHEN gt.dispositivos_activos > 0 
                    THEN gt.dispositivos_con_datos / gt.dispositivos_activos 
                    ELSE 0 
                END
        )
    FROM sem_grupo_totales gt
    WHERE gt.periodo_inicio BETWEEN fecha_inicio AND fecha_fin
    AND gt.periodo_tipo = 'HORA'
    AND (
        gt.energia_activa_total < 0 OR
        gt.potencia_maxima < gt.potencia_minima OR
        gt.dispositivos_con_datos > gt.dispositivos_activos OR
        gt.precio_kwh_promedio <= 0
    );

    IF v_error THEN
        ROLLBACK;
        
        -- Registrar error
        UPDATE sem_registro_auditoria
        SET descripcion = CONCAT(descripcion, ' - Error'),
            detalles = JSON_SET(
                detalles,
                '$.error', TRUE,
                '$.fecha_error', CURRENT_TIMESTAMP
            )
        WHERE id = v_execution_id;
        
        -- Limpiar tabla temporal
        DROP TEMPORARY TABLE IF EXISTS temp_totales_grupo;
        
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Error en cálculo de totales de grupo por hora';
    END IF;
    
    COMMIT;

    -- Limpiar tabla temporal
    DROP TEMPORARY TABLE IF EXISTS temp_totales_grupo;
    
    -- Registrar finalización exitosa
    UPDATE sem_registro_auditoria
    SET descripcion = CONCAT(descripcion, ' - Completado'),
        detalles = JSON_SET(
            detalles,
            '$.fecha_fin', CURRENT_TIMESTAMP,
            '$.registros_procesados', v_registros_procesados,
            '$.grupos_procesados', v_grupos_procesados,
            '$.tiempo_ejecucion_ms', TIMESTAMPDIFF(MICROSECOND, fecha_creacion, CURRENT_TIMESTAMP(6)) / 1000
        )
    WHERE id = v_execution_id;

END //

CREATE OR REPLACE PROCEDURE sem_calcular_totales_grupo_dia(
    IN fecha_inicio DATE,
    IN fecha_fin DATE
)
proc_label:BEGIN
    DECLARE v_execution_id BIGINT;
    DECLARE v_error BOOLEAN DEFAULT FALSE;
    DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET v_error = TRUE;
    
    START TRANSACTION;
    
    INSERT INTO sem_grupo_totales (
        grupo_id,
        periodo_tipo,
        periodo_inicio,
        periodo_fin,
        dispositivos_total,
        dispositivos_activos,
        dispositivos_con_datos,
        energia_activa_total,
        energia_reactiva_total,
        potencia_maxima,
        potencia_minima,
        precio_kwh_promedio,
        costo_total
    )
    SELECT 
        d.grupo_id,
        'DIA',
        DATE(td.fecha_utc),
        DATE(td.fecha_utc) + INTERVAL 1 DAY - INTERVAL 1 SECOND,
        COUNT(DISTINCT d.shelly_id),
        COUNT(DISTINCT CASE WHEN d.activo = TRUE THEN d.shelly_id END),
        COUNT(DISTINCT CASE WHEN td.horas_con_datos > 0 THEN d.shelly_id END),
        SUM(td.energia_activa_total),
        SUM(td.energia_reactiva_total),
        MAX(td.potencia_maxima),
        MIN(td.potencia_minima),
        AVG(td.precio_kwh_promedio),
        SUM(td.costo_total)
    FROM sem_dispositivos d
    JOIN sem_totales_dia td ON d.shelly_id = td.shelly_id
    WHERE DATE(td.fecha_utc) BETWEEN fecha_inicio AND fecha_fin
    GROUP BY d.grupo_id, DATE(td.fecha_utc);

    IF v_error THEN
        ROLLBACK;
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Error en cálculo de totales de grupo diarios';
    END IF;
    
    COMMIT;
END //

CREATE OR REPLACE PROCEDURE sem_calcular_totales_grupo_mes(
    IN p_año INT,
    IN p_mes INT
)
proc_label:BEGIN
    DECLARE v_execution_id BIGINT;
    DECLARE v_error BOOLEAN DEFAULT FALSE;
    DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET v_error = TRUE;
    
    START TRANSACTION;
    
    INSERT INTO sem_grupo_totales (
        grupo_id,
        periodo_tipo,
        periodo_inicio,
        periodo_fin,
        dispositivos_total,
        dispositivos_activos,
        dispositivos_con_datos,
        energia_activa_total,
        energia_reactiva_total,
        potencia_maxima,
        potencia_minima,
        precio_kwh_promedio,
        costo_total
    )
    SELECT 
        d.grupo_id,
        'MES',
        DATE(CONCAT(p_año, '-', p_mes, '-01')),
        LAST_DAY(DATE(CONCAT(p_año, '-', p_mes, '-01'))),
        COUNT(DISTINCT d.shelly_id),
        COUNT(DISTINCT CASE WHEN d.activo = TRUE THEN d.shelly_id END),
        COUNT(DISTINCT CASE WHEN tm.dias_con_datos > 0 THEN d.shelly_id END),
        SUM(tm.energia_activa_total),
        SUM(tm.energia_reactiva_total),
        MAX(tm.potencia_maxima),
        MIN(tm.potencia_minima),
        AVG(tm.precio_kwh_promedio),
        SUM(tm.costo_total)
    FROM sem_dispositivos d
    JOIN sem_totales_mes tm ON d.shelly_id = tm.shelly_id
    WHERE tm.año = p_año AND tm.mes = p_mes
    GROUP BY d.grupo_id;

    IF v_error THEN
        ROLLBACK;
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Error en cálculo de totales de grupo mensuales';
    END IF;
    
    COMMIT;
END //

-- --------------------------------------------------------
-- MÉTRICAS GLOBALES DEL SISTEMA
-- --------------------------------------------------------

CREATE OR REPLACE PROCEDURE sem_calcular_metricas_sistema_hora(
    IN fecha_inicio TIMESTAMP,
    IN fecha_fin TIMESTAMP
)
proc_label:BEGIN
    DECLARE v_error BOOLEAN DEFAULT FALSE;
    DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET v_error = TRUE;
    
    START TRANSACTION;
    
    INSERT INTO sem_metricas_sistema (
        fecha_medicion,
        periodo_tipo,
        dispositivos_total,
        dispositivos_activos,
        dispositivos_con_error,
        grupos_activos,
        energia_activa_total,
        energia_reactiva_total,
        potencia_maxima_sistema,
        factor_utilizacion_sistema,
        precio_kwh_promedio,
        costo_total_sistema
    )
    SELECT 
        th.hora_utc,
        'HORA',
        COUNT(DISTINCT d.shelly_id),
        COUNT(DISTINCT CASE WHEN d.activo = TRUE THEN d.shelly_id END),
        COUNT(DISTINCT CASE WHEN em.shelly_id IS NOT NULL THEN d.shelly_id END),
        COUNT(DISTINCT d.grupo_id),
        SUM(th.energia_activa_total),
        SUM(th.energia_reactiva_total),
        MAX(th.potencia_maxima),
        (AVG(th.potencia_maxima) / NULLIF(MAX(th.potencia_maxima), 0)) * 100,
        AVG(th.precio_kwh_periodo),
        SUM(th.costo_total)
    FROM sem_totales_hora th
    JOIN sem_dispositivos d ON th.shelly_id = d.shelly_id
    LEFT JOIN sem_errores_medicion em ON d.shelly_id = em.shelly_id 
        AND em.timestamp_utc BETWEEN fecha_inicio AND fecha_fin
    WHERE th.hora_utc BETWEEN fecha_inicio AND fecha_fin
    GROUP BY th.hora_utc;

    IF v_error THEN
        ROLLBACK;
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Error en cálculo de métricas del sistema horarias';
    END IF;
    
    COMMIT;
END //

CREATE OR REPLACE PROCEDURE sem_calcular_metricas_sistema_dia(
    IN fecha_inicio DATE,
    IN fecha_fin DATE
)
proc_label:BEGIN
    DECLARE v_error BOOLEAN DEFAULT FALSE;
    DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET v_error = TRUE;
    
    START TRANSACTION;
    
    INSERT INTO sem_metricas_sistema (
        fecha_medicion,
        periodo_tipo,
        dispositivos_total,
        dispositivos_activos,
        dispositivos_con_error,
        grupos_activos,
        energia_activa_total,
        energia_reactiva_total,
        potencia_maxima_sistema,
        factor_utilizacion_sistema,
        precio_kwh_promedio,
        costo_total_sistema
    )
    SELECT 
        td.fecha_utc,
        'DIA',
        COUNT(DISTINCT d.shelly_id),
        COUNT(DISTINCT CASE WHEN d.activo = TRUE THEN d.shelly_id END),
        COUNT(DISTINCT CASE WHEN em.shelly_id IS NOT NULL THEN d.shelly_id END),
        COUNT(DISTINCT d.grupo_id),
        SUM(td.energia_activa_total),
        SUM(td.energia_reactiva_total),
        MAX(td.potencia_maxima),
        (AVG(td.potencia_maxima) / NULLIF(MAX(td.potencia_maxima), 0)) * 100,
        AVG(td.precio_kwh_promedio),
        SUM(td.costo_total)
    FROM sem_totales_dia td
    JOIN sem_dispositivos d ON td.shelly_id = d.shelly_id
    LEFT JOIN sem_errores_medicion em ON d.shelly_id = em.shelly_id 
        AND DATE(em.timestamp_utc) BETWEEN fecha_inicio
        AND DATE(em.timestamp_utc) BETWEEN fecha_inicio AND fecha_fin
    WHERE DATE(td.fecha_utc) BETWEEN fecha_inicio AND fecha_fin
    GROUP BY td.fecha_utc;

    IF v_error THEN
        ROLLBACK;
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Error en cálculo de métricas del sistema diarias';
    END IF;
    
    COMMIT;
END //

CREATE OR REPLACE PROCEDURE sem_calcular_metricas_sistema_mes(
    IN p_año INT,
    IN p_mes INT
)
proc_label:BEGIN
    DECLARE v_error BOOLEAN DEFAULT FALSE;
    DECLARE v_fecha_inicio DATE;
    DECLARE v_fecha_fin DATE;
    DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET v_error = TRUE;
    
    SET v_fecha_inicio = DATE(CONCAT(p_año, '-', p_mes, '-01'));
    SET v_fecha_fin = LAST_DAY(v_fecha_inicio);
    
    START TRANSACTION;
    
    INSERT INTO sem_metricas_sistema (
        fecha_medicion,
        periodo_tipo,
        dispositivos_total,
        dispositivos_activos,
        dispositivos_con_error,
        grupos_activos,
        energia_activa_total,
        energia_reactiva_total,
        potencia_maxima_sistema,
        factor_utilizacion_sistema,
        precio_kwh_promedio,
        costo_total_sistema
    )
    SELECT 
        v_fecha_inicio,
        'MES',
        COUNT(DISTINCT d.shelly_id),
        COUNT(DISTINCT CASE WHEN d.activo = TRUE THEN d.shelly_id END),
        COUNT(DISTINCT CASE WHEN em.shelly_id IS NOT NULL THEN d.shelly_id END),
        COUNT(DISTINCT d.grupo_id),
        SUM(tm.energia_activa_total),
        SUM(tm.energia_reactiva_total),
        MAX(tm.potencia_maxima),
        (AVG(tm.potencia_maxima) / NULLIF(MAX(tm.potencia_maxima), 0)) * 100,
        AVG(tm.precio_kwh_promedio),
        SUM(tm.costo_total)
    FROM sem_totales_mes tm
    JOIN sem_dispositivos d ON tm.shelly_id = d.shelly_id
    LEFT JOIN sem_errores_medicion em ON d.shelly_id = em.shelly_id 
        AND em.timestamp_utc BETWEEN v_fecha_inicio AND v_fecha_fin
    WHERE tm.año = p_año AND tm.mes = p_mes;

    IF v_error THEN
        ROLLBACK;
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Error en cálculo de métricas del sistema mensuales';
    END IF;
    
    COMMIT;
END //

-- Actualización de estadísticas de calidad
CREATE OR REPLACE PROCEDURE sem_actualizar_estadisticas_calidad(
    IN fecha_inicio TIMESTAMP,
    IN fecha_fin TIMESTAMP,
    IN tipo_periodo ENUM('HORA', 'DIA', 'MES')
)
proc_label:BEGIN
    DECLARE v_error BOOLEAN DEFAULT FALSE;
    DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET v_error = TRUE;
    
    START TRANSACTION;
    
    INSERT INTO sem_estadisticas_calidad (
        fecha_analisis,
        periodo_tipo,
        registros_esperados,
        registros_recibidos,
        registros_validos,
        porcentaje_completitud,
        registros_sospechosos,
        registros_error,
        registros_interpolados,
        porcentaje_calidad,
        latencia_promedio,
        tiempo_proceso_promedio
    )
    SELECT 
        COALESCE(
            CASE tipo_periodo 
                WHEN 'HORA' THEN DATE_FORMAT(m.measurement_timestamp, '%Y-%m-%d %H:00:00')
                WHEN 'DIA' THEN DATE(m.measurement_timestamp)
                ELSE DATE_FORMAT(m.measurement_timestamp, '%Y-%m-01')
            END,
            fecha_inicio
        ),
        tipo_periodo,
        COUNT(*) * (
            CASE tipo_periodo
                WHEN 'HORA' THEN 360  -- Mediciones cada 10 segundos
                WHEN 'DIA' THEN 8640  -- 24 horas * 360 mediciones
                ELSE 8640 * DAY(LAST_DAY(fecha_inicio))
            END
        ) as registros_esperados,
        COUNT(*) as registros_recibidos,
        COUNT(CASE WHEN m.calidad_lectura = 'NORMAL' THEN 1 END) as registros_validos,
        (COUNT(*) * 100.0 / NULLIF(COUNT(*) * (
            CASE tipo_periodo
                WHEN 'HORA' THEN 360
                WHEN 'DIA' THEN 8640
                ELSE 8640 * DAY(LAST_DAY(fecha_inicio))
            END
        ), 0)) as porcentaje_completitud,
        COUNT(CASE WHEN m.calidad_lectura = 'ALERTA' THEN 1 END) as registros_sospechosos,
        COUNT(CASE WHEN m.calidad_lectura = 'ERROR' THEN 1 END) as registros_error,
        COUNT(CASE WHEN m.calidad_lectura = 'INTERPOLADA' THEN 1 END) as registros_interpolados,
        (COUNT(CASE WHEN m.calidad_lectura = 'NORMAL' THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0)) as porcentaje_calidad,
        AVG(TIMESTAMPDIFF(MICROSECOND, m.measurement_timestamp, m.fecha_creacion)) / 1000 as latencia_promedio,
        NULL as tiempo_proceso_promedio
    FROM sem_mediciones m
    WHERE m.measurement_timestamp BETWEEN fecha_inicio AND fecha_fin
    GROUP BY 
        CASE tipo_periodo 
            WHEN 'HORA' THEN DATE_FORMAT(m.measurement_timestamp, '%Y-%m-%d %H')
            WHEN 'DIA' THEN DATE(m.measurement_timestamp)
            ELSE DATE_FORMAT(m.measurement_timestamp, '%Y-%m')
        END;

    IF v_error THEN
        ROLLBACK;
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Error actualizando estadísticas de calidad';
    END IF;
    
    COMMIT;
END //

-- Procedimientos de Control
CREATE OR REPLACE PROCEDURE sem_validar_agregaciones_hora(
    IN fecha_inicio TIMESTAMP,
    IN fecha_fin TIMESTAMP
)
proc_label:BEGIN
    DECLARE v_error BOOLEAN DEFAULT FALSE;
    DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET v_error = TRUE;
    
    -- Validar promedios horarios
    SELECT COUNT(*) INTO @anomalias FROM sem_promedios_hora ph
    WHERE ph.hora_utc BETWEEN fecha_inicio AND fecha_fin
    AND (
        ph.calidad_datos < 50 OR  -- Calidad muy baja
        ph.lecturas_validas < (ph.lecturas_esperadas * 0.5) OR  -- Menos del 50% de lecturas válidas
        ph.potencia_activa_promedio < 0 OR  -- Valores negativos inválidos
        ph.factor_potencia_promedio > 1  -- Factor de potencia inválido
    );
    
    IF @anomalias > 0 THEN
        INSERT INTO sem_registro_auditoria (
            tipo_evento_id,
            descripcion,
            detalles
        ) VALUES (
            (SELECT id FROM sem_tipos_eventos WHERE nombre = 'ERROR_DATOS'),
            'Anomalías detectadas en agregaciones horarias',
            JSON_OBJECT(
                'fecha_inicio', fecha_inicio,
                'fecha_fin', fecha_fin,
                'anomalias', @anomalias
            )
        );
    END IF;
    
    -- Validar totales
    SELECT COUNT(*) INTO @inconsistencias FROM sem_totales_hora th
    WHERE th.hora_utc BETWEEN fecha_inicio AND fecha_fin
    AND (
        th.energia_activa_total < 0 OR
        th.potencia_maxima < th.potencia_minima OR
        th.costo_total < 0
    );
    
    IF @inconsistencias > 0 THEN
        INSERT INTO sem_registro_auditoria (
            tipo_evento_id,
            descripcion,
            detalles
        ) VALUES (
            (SELECT id FROM sem_tipos_eventos WHERE nombre = 'ERROR_DATOS'),
            'Inconsistencias detectadas en totales horarios',
            JSON_OBJECT(
                'fecha_inicio', fecha_inicio,
                'fecha_fin', fecha_fin,
                'inconsistencias', @inconsistencias
            )
        );
    END IF;
END //

-- Las validaciones para día y mes siguen un patrón similar
CREATE OR REPLACE PROCEDURE sem_validar_agregaciones_dia(
    IN fecha_inicio DATE,
    IN fecha_fin DATE
)
proc_label:BEGIN
    DECLARE v_execution_id BIGINT;
    DECLARE v_error BOOLEAN DEFAULT FALSE;
    DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET v_error = TRUE;
    
    -- Registrar inicio de validación
    INSERT INTO sem_registro_auditoria (
        tipo_evento_id,
        descripcion,
        detalles
    ) VALUES (
        (SELECT id FROM sem_tipos_eventos WHERE nombre = 'VALIDACION_DATOS'),
        'Inicio validación agregaciones diarias',
        JSON_OBJECT(
            'fecha_inicio', fecha_inicio,
            'fecha_fin', fecha_fin
        )
    );
    SET v_execution_id = LAST_INSERT_ID();
    
    START TRANSACTION;
    
    -- 1. Validar calidad de promedios diarios
    SELECT COUNT(*) INTO @anomalias_promedios 
    FROM sem_promedios_dia pd
    WHERE pd.fecha_utc BETWEEN fecha_inicio AND fecha_fin
    AND (
        pd.calidad_datos < 50 OR                           -- Calidad muy baja
        pd.horas_con_datos < 12 OR                         -- Menos de 12 horas de datos
        pd.potencia_activa_promedio < 0 OR                 -- Potencia negativa
        pd.factor_potencia_promedio > 1 OR                 -- Factor de potencia inválido
        pd.lecturas_validas < (pd.lecturas_esperadas * 0.5) OR -- Menos del 50% de lecturas válidas
        pd.lecturas_recibidas > pd.lecturas_esperadas      -- Más lecturas de las esperadas
    );
    
    IF @anomalias_promedios > 0 THEN
        INSERT INTO sem_registro_auditoria (
            tipo_evento_id,
            descripcion,
            detalles
        ) VALUES (
            (SELECT id FROM sem_tipos_eventos WHERE nombre = 'ERROR_DATOS'),
            'Anomalías detectadas en promedios diarios',
            JSON_OBJECT(
                'fecha_inicio', fecha_inicio,
                'fecha_fin', fecha_fin,
                'anomalias', @anomalias_promedios,
                'tipo', 'PROMEDIOS'
            )
        );
    END IF;
    
    -- 2. Validar totales diarios
    SELECT COUNT(*) INTO @anomalias_totales 
    FROM sem_totales_dia td
    WHERE td.fecha_utc BETWEEN fecha_inicio AND fecha_fin
    AND (
        td.energia_activa_total < 0 OR                    -- Energía negativa
        td.potencia_maxima < td.potencia_minima OR        -- Potencia máxima menor que mínima
        td.costo_total < 0 OR                            -- Costo negativo
        td.horas_con_datos = 0 OR                        -- Sin datos
        td.horas_con_datos > 24 OR                       -- Más horas de las posibles
        td.precio_kwh_promedio <= 0                      -- Precio inválido
    );
    
    IF @anomalias_totales > 0 THEN
        INSERT INTO sem_registro_auditoria (
            tipo_evento_id,
            descripcion,
            detalles
        ) VALUES (
            (SELECT id FROM sem_tipos_eventos WHERE nombre = 'ERROR_DATOS'),
            'Anomalías detectadas en totales diarios',
            JSON_OBJECT(
                'fecha_inicio', fecha_inicio,
                'fecha_fin', fecha_fin,
                'anomalias', @anomalias_totales,
                'tipo', 'TOTALES'
            )
        );
    END IF;
    
    -- 3. Validar consistencia entre promedios y totales
    INSERT INTO sem_registro_auditoria (
        tipo_evento_id,
        descripcion,
        detalles
    )
    SELECT 
        (SELECT id FROM sem_tipos_eventos WHERE nombre = 'ERROR_DATOS'),
        'Inconsistencias entre promedios y totales diarios',
        JSON_OBJECT(
            'fecha', pd.fecha_utc,
            'shelly_id', pd.shelly_id,
            'diferencia_potencia', diferencia_potencia,
            'diferencia_horas', ABS(pd.horas_con_datos - td.horas_con_datos)
        )
    FROM sem_promedios_dia pd
    JOIN sem_totales_dia td ON pd.shelly_id = td.shelly_id 
        AND pd.fecha_utc = td.fecha_utc
    CROSS JOIN (
        SELECT ABS(pd2.potencia_activa_promedio - (td2.energia_activa_total / NULLIF(td2.horas_con_datos, 0))) / 
            NULLIF(pd2.potencia_activa_promedio, 0) * 100 as diferencia_potencia
        FROM sem_promedios_dia pd2
        JOIN sem_totales_dia td2 ON pd2.shelly_id = td2.shelly_id 
            AND pd2.fecha_utc = td2.fecha_utc
        WHERE pd2.fecha_utc BETWEEN fecha_inicio AND fecha_fin
        AND td2.horas_con_datos > 0
    ) as diff
    WHERE pd.fecha_utc BETWEEN fecha_inicio AND fecha_fin
    AND (
        diferencia_potencia > 10 OR                    -- Diferencia de potencia mayor al 10%
        ABS(pd.horas_con_datos - td.horas_con_datos) > 0  -- Diferencia en horas con datos
    );
    
    -- 4. Verificar secuencia temporal
    SELECT COUNT(*) INTO @gaps_temporales
    FROM (
        SELECT fecha_utc, 
               DATEDIFF(LEAD(fecha_utc) OVER (ORDER BY fecha_utc), fecha_utc) as diff_dias
        FROM (
            SELECT DISTINCT fecha_utc 
            FROM sem_promedios_dia 
            WHERE fecha_utc BETWEEN fecha_inicio AND fecha_fin
        ) fechas
    ) gaps
    WHERE diff_dias > 1;
    
    IF @gaps_temporales > 0 THEN
        INSERT INTO sem_registro_auditoria (
            tipo_evento_id,
            descripcion,
            detalles
        ) VALUES (
            (SELECT id FROM sem_tipos_eventos WHERE nombre = 'ERROR_DATOS'),
            'Gaps detectados en la secuencia temporal diaria',
            JSON_OBJECT(
                'fecha_inicio', fecha_inicio,
                'fecha_fin', fecha_fin,
                'gaps_detectados', @gaps_temporales
            )
        );
    END IF;
    
    IF v_error THEN
        ROLLBACK;
        
        UPDATE sem_registro_auditoria
        SET descripcion = CONCAT(descripcion, ' - Error'),
            detalles = JSON_SET(
                detalles,
                '$.error', TRUE,
                '$.fecha_error', CURRENT_TIMESTAMP
            )
        WHERE id = v_execution_id;
        
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Error en validación de agregaciones diarias';
    END IF;
    
    COMMIT;
    
    -- Registrar fin de validación
    UPDATE sem_registro_auditoria
    SET descripcion = CONCAT(descripcion, ' - Completado'),
        detalles = JSON_SET(
            detalles,
            '$.fecha_fin', CURRENT_TIMESTAMP,
            '$.anomalias_promedios', @anomalias_promedios,
            '$.anomalias_totales', @anomalias_totales,
            '$.gaps_temporales', @gaps_temporales
        )
    WHERE id = v_execution_id;
END //



CREATE OR REPLACE PROCEDURE sem_validar_agregaciones_mes(
    IN p_año INT,
    IN p_mes INT
)
proc_label:BEGIN
    DECLARE v_execution_id BIGINT;
    DECLARE v_error BOOLEAN DEFAULT FALSE;
    DECLARE v_fecha_inicio DATE;
    DECLARE v_fecha_fin DATE;
    DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET v_error = TRUE;
    
    SET v_fecha_inicio = DATE(CONCAT(p_año, '-', p_mes, '-01'));
    SET v_fecha_fin = LAST_DAY(v_fecha_inicio);
    
    -- Registrar inicio de validación
    INSERT INTO sem_registro_auditoria (
        tipo_evento_id,
        descripcion,
        detalles
    ) VALUES (
        (SELECT id FROM sem_tipos_eventos WHERE nombre = 'VALIDACION_DATOS'),
        'Inicio validación agregaciones mensuales',
        JSON_OBJECT(
            'año', p_año,
            'mes', p_mes,
            'fecha_inicio', v_fecha_inicio,
            'fecha_fin', v_fecha_fin
        )
    );
    SET v_execution_id = LAST_INSERT_ID();
    
    START TRANSACTION;
    
    -- 1. Validar calidad de promedios mensuales
    SELECT COUNT(*) INTO @anomalias_promedios 
    FROM sem_promedios_mes pm
    WHERE pm.año = p_año AND pm.mes = p_mes
    AND (
        pm.calidad_datos < 50 OR                           -- Calidad muy baja
        pm.dias_con_datos < 15 OR                          -- Menos de 15 días de datos
        pm.horas_con_datos < (pm.dias_con_datos * 12) OR   -- Promedio menor a 12 horas por día
        pm.potencia_activa_promedio < 0 OR                 -- Potencia negativa
        pm.factor_potencia_promedio > 1 OR                 -- Factor de potencia inválido
        pm.lecturas_validas < (pm.lecturas_esperadas * 0.5) OR -- Menos del 50% de lecturas válidas
        pm.horas_con_datos > (DAY(v_fecha_fin) * 24)       -- Más horas que las posibles en el mes
    );
    
    IF @anomalias_promedios > 0 THEN
        INSERT INTO sem_registro_auditoria (
            tipo_evento_id,
            descripcion,
            detalles
        ) VALUES (
            (SELECT id FROM sem_tipos_eventos WHERE nombre = 'ERROR_DATOS'),
            'Anomalías detectadas en promedios mensuales',
            JSON_OBJECT(
                'año', p_año,
                'mes', p_mes,
                'anomalias', @anomalias_promedios,
                'tipo', 'PROMEDIOS'
            )
        );
    END IF;
    
    -- 2. Validar totales mensuales
    SELECT COUNT(*) INTO @anomalias_totales 
    FROM sem_totales_mes tm
    WHERE tm.año = p_año AND tm.mes = p_mes
    AND (
        tm.energia_activa_total < 0 OR                     -- Energía negativa
        tm.potencia_maxima < tm.potencia_minima OR         -- Potencia máxima menor que mínima
        tm.costo_total < 0 OR                              -- Costo negativo
        tm.dias_con_datos = 0 OR                           -- Sin datos
        tm.dias_con_datos > DAY(v_fecha_fin) OR            -- Más días que los del mes
        tm.precio_kwh_promedio <= 0 OR                     -- Precio inválido
        tm.horas_con_datos > (DAY(v_fecha_fin) * 24)       -- Más horas que las posibles en el mes
    );
    
    IF @anomalias_totales > 0 THEN
        INSERT INTO sem_registro_auditoria (
            tipo_evento_id,
            descripcion,
            detalles
        ) VALUES (
            (SELECT id FROM sem_tipos_eventos WHERE nombre = 'ERROR_DATOS'),
            'Anomalías detectadas en totales mensuales',
            JSON_OBJECT(
                'año', p_año,
                'mes', p_mes,
                'anomalias', @anomalias_totales,
                'tipo', 'TOTALES'
            )
        );
    END IF;
    
    -- 3. Validar consistencia entre promedios y totales mensuales
    INSERT INTO sem_registro_auditoria (
        tipo_evento_id,
        descripcion,
        detalles
    )
    SELECT 
        (SELECT id FROM sem_tipos_eventos WHERE nombre = 'ERROR_DATOS'),
        'Inconsistencias entre promedios y totales mensuales',
        JSON_OBJECT(
            'año', pm.año,
            'mes', pm.mes,
            'shelly_id', pm.shelly_id,
            'diferencia_potencia', diferencia_potencia,
            'diferencia_horas', ABS(pm.horas_con_datos - tm.horas_con_datos),
            'diferencia_dias', ABS(pm.dias_con_datos - tm.dias_con_datos)
        )
    FROM sem_promedios_mes pm
    JOIN sem_totales_mes tm ON pm.shelly_id = tm.shelly_id 
        AND pm.año = tm.año 
        AND pm.mes = tm.mes
    CROSS JOIN (
        SELECT ABS(pm2.potencia_activa_promedio - (tm2.energia_activa_total / NULLIF(tm2.horas_con_datos, 0))) / 
            NULLIF(pm2.potencia_activa_promedio, 0) * 100 as diferencia_potencia
        FROM sem_promedios_mes pm2
        JOIN sem_totales_mes tm2 ON pm2.shelly_id = tm2.shelly_id 
            AND pm2.año = tm2.año 
            AND pm2.mes = tm2.mes
        WHERE pm2.año = p_año AND pm2.mes = p_mes
        AND tm2.horas_con_datos > 0
    ) as diff
    WHERE pm.año = p_año AND pm.mes = p_mes
    AND (
        diferencia_potencia > 10 OR                         -- Diferencia de potencia mayor al 10%
        ABS(pm.horas_con_datos - tm.horas_con_datos) > 0 OR -- Diferencia en horas con datos
        ABS(pm.dias_con_datos - tm.dias_con_datos) > 0      -- Diferencia en días con datos
    );
    
    -- 4. Validar coherencia con agregaciones diarias
    WITH DiasDelMes AS (
        SELECT dia.fecha_utc,
               SUM(dia.energia_activa_total) as energia_dia,
               COUNT(DISTINCT dia.shelly_id) as dispositivos_dia
        FROM sem_totales_dia dia
        WHERE DATE(dia.fecha_utc) BETWEEN v_fecha_inicio AND v_fecha_fin
        GROUP BY dia.fecha_utc
    )
    INSERT INTO sem_registro_auditoria (
        tipo_evento_id,
        descripcion,
        detalles
    )
    SELECT 
        (SELECT id FROM sem_tipos_eventos WHERE nombre = 'ERROR_DATOS'),
        'Inconsistencias con agregaciones diarias',
        JSON_OBJECT(
            'año', p_año,
            'mes', p_mes,
            'dias_mes', COUNT(*),
            'dias_con_datos', COUNT(CASE WHEN energia_dia > 0 THEN 1 END),
            'dias_sin_datos', COUNT(CASE WHEN energia_dia = 0 OR energia_dia IS NULL THEN 1 END),
            'variacion_dispositivos', MAX(dispositivos_dia) - MIN(dispositivos_dia)
        )
    FROM DiasDelMes
    HAVING COUNT(CASE WHEN energia_dia = 0 OR energia_dia IS NULL THEN 1 END) > 0
        OR MAX(dispositivos_dia) - MIN(dispositivos_dia) > 0;
    
    IF v_error THEN
        ROLLBACK;
        
        UPDATE sem_registro_auditoria
        SET descripcion = CONCAT(descripcion, ' - Error'),
            detalles = JSON_SET(
                detalles,
                '$.error', TRUE,
                '$.fecha_error', CURRENT_TIMESTAMP
            )
        WHERE id = v_execution_id;
        
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Error en validación de agregaciones mensuales';
    END IF;
    
    COMMIT;
    
    -- Registrar fin de validación
    UPDATE sem_registro_auditoria
    SET descripcion = CONCAT(descripcion, ' - Completado'),
        detalles = JSON_SET(
            detalles,
            '$.fecha_fin', CURRENT_TIMESTAMP,
            '$.anomalias_promedios', @anomalias_promedios,
            '$.anomalias_totales', @anomalias_totales
        )
    WHERE id = v_execution_id;
END //

CREATE OR REPLACE PROCEDURE sem_recalcular_periodo_especifico(
    IN fecha_inicio TIMESTAMP,
    IN fecha_fin TIMESTAMP,
    IN tipo_periodo ENUM('HORA', 'DIA', 'MES')
)
proc_label:BEGIN
    DECLARE v_error BOOLEAN DEFAULT FALSE;
    DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET v_error = TRUE;
    
    START TRANSACTION;
    
    -- Registrar inicio de recálculo
    INSERT INTO sem_registro_auditoria (
        tipo_evento_id,
        descripcion,
        detalles
    ) VALUES (
        (SELECT id FROM sem_tipos_eventos WHERE nombre = 'CALCULO_PROMEDIOS'),
        CONCAT('Inicio recálculo de período ', tipo_periodo),
        JSON_OBJECT(
            'fecha_inicio', fecha_inicio,
            'fecha_fin', fecha_fin,
            'tipo_periodo', tipo_periodo
        )
    );
    
    -- Ejecutar los cálculos según el tipo de período
    CASE tipo_periodo
        WHEN 'HORA' THEN
            -- Eliminar cálculos existentes
            DELETE FROM sem_promedios_hora 
            WHERE hora_utc BETWEEN fecha_inicio AND fecha_fin;
            DELETE FROM sem_totales_hora 
            WHERE hora_utc BETWEEN fecha_inicio AND fecha_fin;
            
            -- Recalcular
            CALL sem_calcular_promedios_hora(fecha_inicio, fecha_fin);
            CALL sem_calcular_totales_hora(fecha_inicio, fecha_fin);
            CALL sem_calcular_metricas_sistema_hora(fecha_inicio, fecha_fin);
            
        WHEN 'DIA' THEN
            -- Eliminar cálculos existentes
            DELETE FROM sem_promedios_dia 
            WHERE fecha_utc BETWEEN DATE(fecha_inicio) AND DATE(fecha_fin);
            DELETE FROM sem_totales_dia 
            WHERE fecha_utc BETWEEN DATE(fecha_inicio) AND DATE(fecha_fin);
            
            -- Recalcular
            CALL sem_calcular_promedios_dia(DATE(fecha_inicio), DATE(fecha_fin));
            CALL sem_calcular_totales_dia(DATE(fecha_inicio), DATE(fecha_fin));
            CALL sem_calcular_metricas_sistema_dia(DATE(fecha_inicio), DATE(fecha_fin));
            
        WHEN 'MES' THEN
            -- Eliminar cálculos existentes
            DELETE FROM sem_promedios_mes 
            WHERE CONCAT(año, '-', LPAD(mes, 2, '0'), '-01') 
            BETWEEN DATE_FORMAT(fecha_inicio, '%Y-%m-01') 
            AND DATE_FORMAT(fecha_fin, '%Y-%m-01');
            
            DELETE FROM sem_totales_mes 
            WHERE CONCAT(año, '-', LPAD(mes, 2, '0'), '-01') 
            BETWEEN DATE_FORMAT(fecha_inicio, '%Y-%m-01') 
            AND DATE_FORMAT(fecha_fin, '%Y-%m-01');
            
            -- Recalcular para cada mes en el rango
            SET @current_date = fecha_inicio;
            WHILE @current_date <= fecha_fin DO
                CALL sem_calcular_promedios_mes(YEAR(@current_date), MONTH(@current_date));
                CALL sem_calcular_totales_mes(YEAR(@current_date), MONTH(@current_date));
                CALL sem_calcular_metricas_sistema_mes(YEAR(@current_date), MONTH(@current_date));
                
                SET @current_date = DATE_ADD(@current_date, INTERVAL 1 MONTH);
            END WHILE;
    END CASE;
    
    -- Validar los nuevos cálculos
    CASE tipo_periodo
        WHEN 'HORA' THEN
            CALL sem_validar_agregaciones_hora(fecha_inicio, fecha_fin);
        WHEN 'DIA' THEN
            CALL sem_validar_agregaciones_dia(DATE(fecha_inicio), DATE(fecha_fin));
        WHEN 'MES' THEN
            SET @current_date = fecha_inicio;
            WHILE @current_date <= fecha_fin DO
                CALL sem_validar_agregaciones_mes(YEAR(@current_date), MONTH(@current_date));
                SET @current_date = DATE_ADD(@current_date, INTERVAL 1 MONTH);
            END WHILE;
    END CASE;
    
    -- Actualizar estadísticas de calidad
    CALL sem_actualizar_estadisticas_calidad(fecha_inicio, fecha_fin, tipo_periodo);
    
    IF v_error THEN
        ROLLBACK;
        -- Registrar error
        INSERT INTO sem_registro_auditoria (
            tipo_evento_id,
            descripcion,
            detalles
        ) VALUES (
            (SELECT id FROM sem_tipos_eventos WHERE nombre = 'ERROR_SISTEMA'),
            'Error en recálculo de período',
            JSON_OBJECT(
                'fecha_inicio', fecha_inicio,
                'fecha_fin', fecha_fin,
                'tipo_periodo', tipo_periodo,
                'error', TRUE
            )
        );
        
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Error en recálculo de período específico';
    END IF;
    
    -- Registrar finalización exitosa
    INSERT INTO sem_registro_auditoria (
        tipo_evento_id,
        descripcion,
        detalles
    ) VALUES (
        (SELECT id FROM sem_tipos_eventos WHERE nombre = 'CALCULO_PROMEDIOS'),
        CONCAT('Finalización exitosa de recálculo de período ', tipo_periodo),
        JSON_OBJECT(
            'fecha_inicio', fecha_inicio,
            'fecha_fin', fecha_fin,
            'tipo_periodo', tipo_periodo,
            'completado', TRUE
        )
    );
    
    COMMIT;
END //

-- Procedimiento helper para validación de diferencias significativas
CREATE OR REPLACE PROCEDURE sem_verificar_diferencias_significativas(
    IN shelly_id VARCHAR(12),
    IN fecha_inicio TIMESTAMP,
    IN fecha_fin TIMESTAMP,
    OUT tiene_diferencias BOOLEAN
)
proc_label:BEGIN
    DECLARE max_diferencia_potencia DECIMAL(10,2);
    DECLARE max_diferencia_energia DECIMAL(10,2);
    
    SELECT 
        MAX(ABS(LEAD(potencia_activa_promedio) OVER (ORDER BY hora_utc) - potencia_activa_promedio)) / 
        NULLIF(AVG(potencia_activa_promedio), 0) * 100 INTO max_diferencia_potencia
    FROM sem_promedios_hora
    WHERE sem_promedios_hora.shelly_id = shelly_id
    AND hora_utc BETWEEN fecha_inicio AND fecha_fin;
    
    SELECT 
        MAX(ABS(LEAD(energia_activa_total) OVER (ORDER BY hora_utc) - energia_activa_total)) / 
        NULLIF(AVG(energia_activa_total), 0) * 100 INTO max_diferencia_energia
    FROM sem_totales_hora
    WHERE sem_totales_hora.shelly_id = shelly_id
    AND hora_utc BETWEEN fecha_inicio AND fecha_fin;
    
    SET tiene_diferencias = (max_diferencia_potencia > 50 OR max_diferencia_energia > 50);
END //

-- Procedimiento para verificación periódica de integridad
CREATE OR REPLACE PROCEDURE sem_verificacion_integridad_periodica(
    IN fecha_inicio TIMESTAMP,
    IN fecha_fin TIMESTAMP
)
proc_label:BEGIN
    DECLARE v_error BOOLEAN DEFAULT FALSE;
    DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET v_error = TRUE;
    
    START TRANSACTION;
    
    -- Verificar consistencia entre promedios y totales
    INSERT INTO sem_registro_auditoria (
        tipo_evento_id,
        descripcion,
        detalles
    )
    SELECT 
        (SELECT id FROM sem_tipos_eventos WHERE nombre = 'ERROR_DATOS'),
        'Inconsistencia detectada entre promedios y totales',
        JSON_OBJECT(
            'shelly_id', ph.shelly_id,
            'hora', ph.hora_utc,
            'diferencia_porcentual', ABS(ph.potencia_activa_promedio - th.potencia_maxima) / 
                NULLIF(ph.potencia_activa_promedio, 0) * 100
        )
    FROM sem_promedios_hora ph
    JOIN sem_totales_hora th ON ph.shelly_id = th.shelly_id AND ph.hora_utc = th.hora_utc
    WHERE ph.hora_utc BETWEEN fecha_inicio AND fecha_fin
    AND ABS(ph.potencia_activa_promedio - th.potencia_maxima) / NULLIF(ph.potencia_activa_promedio, 0) * 100 > 20;
    
    -- Verificar coherencia de métricas del sistema
    INSERT INTO sem_registro_auditoria (
        tipo_evento_id,
        descripcion,
        detalles
    )
    SELECT 
        (SELECT id FROM sem_tipos_eventos WHERE nombre = 'ERROR_DATOS'),
        'Inconsistencia detectada en métricas del sistema',
        JSON_OBJECT(
            'fecha', ms.fecha_medicion,
            'tipo', 'energia_total',
            'diferencia_porcentual', ABS(ms.energia_activa_total - total_grupo.energia_total) / 
                NULLIF(ms.energia_activa_total, 0) * 100
        )
    FROM sem_metricas_sistema ms
    JOIN (
        SELECT 
            periodo_inicio,
            SUM(energia_activa_total) as energia_total
        FROM sem_grupo_totales
        WHERE periodo_inicio BETWEEN fecha_inicio AND fecha_fin
        GROUP BY periodo_inicio
    ) total_grupo ON ms.fecha_medicion = total_grupo.periodo_inicio
    WHERE ABS(ms.energia_activa_total - total_grupo.energia_total) / 
        NULLIF(ms.energia_activa_total, 0) * 100 > 1;
    
    IF v_error THEN
        ROLLBACK;
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Error en verificación de integridad periódica';
    END IF;
    
    COMMIT;
END //

-- Procedimiento para limpiar datos históricos
CREATE OR REPLACE PROCEDURE sem_limpiar_datos_historicos(
    IN dias_retencion INT
)
proc_label:BEGIN
    DECLARE v_fecha_limite TIMESTAMP;
    DECLARE v_error BOOLEAN DEFAULT FALSE;
    DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET v_error = TRUE;
    
    SET v_fecha_limite = DATE_SUB(CURRENT_TIMESTAMP, INTERVAL dias_retencion DAY);
    
    START TRANSACTION;
    
    -- Respaldar datos antes de eliminar (opcional)
    -- Aquí se podría implementar lógica para respaldar datos importantes
    
    -- Eliminar datos antiguos
    DELETE FROM sem_mediciones 
    WHERE measurement_timestamp < v_fecha_limite;
    
    DELETE FROM sem_estado_dispositivo 
    WHERE timestamp_utc < v_fecha_limite;
    
    DELETE FROM sem_errores_medicion 
    WHERE timestamp_utc < v_fecha_limite
    AND resuelto = TRUE;
    
    -- Registrar la limpieza
    INSERT INTO sem_registro_auditoria (
        tipo_evento_id,
        descripcion,
        detalles
    ) VALUES (
        (SELECT id FROM sem_tipos_eventos WHERE nombre = 'SISTEMA'),
        'Limpieza de datos históricos',
        JSON_OBJECT(
            'fecha_limite', v_fecha_limite,
            'dias_retencion', dias_retencion,
            'registros_eliminados', ROW_COUNT()
        )
    );
    
    IF v_error THEN
        ROLLBACK;
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Error en limpieza de datos históricos';
    END IF;
    
    COMMIT;
END //

DELIMITER ;