-- --------------------------------------------------------
-- Sistema de Energía y Medición (SEM)
-- Script de creación de base de datos - Fase 2
-- Estructura de Datos de Medición
-- --------------------------------------------------------

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";
SET FOREIGN_KEY_CHECKS = 0;

-- --------------------------------------------------------
-- Tabla: Estado del Dispositivo
-- Descripción: Almacena el estado general del dispositivo
-- --------------------------------------------------------
CREATE TABLE sem_estado_dispositivo (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    shelly_id VARCHAR(12) NOT NULL,
    timestamp_utc TIMESTAMP(6) NOT NULL,
    timestamp_local TIMESTAMP(6) NOT NULL,
    estado_conexion ENUM('CONECTADO', 'DESCONECTADO', 'ERROR') NOT NULL,
    rssi_wifi INT,
    direccion_ip VARCHAR(45),
    temperatura_celsius DECIMAL(5,2),
    uptime_segundos BIGINT,
    fecha_creacion TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP(6),
    FOREIGN KEY (shelly_id) REFERENCES sem_dispositivos(shelly_id),
    INDEX idx_estado_timestamp (timestamp_utc),
    INDEX idx_estado_dispositivo (shelly_id)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
COMMENT 'Estado general del dispositivo Shelly';

-- --------------------------------------------------------
-- Tabla: Mediciones Eléctricas
-- Descripción: Almacena las mediciones eléctricas detalladas
-- --------------------------------------------------------
CREATE TABLE sem_mediciones (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    shelly_id VARCHAR(12) NOT NULL,
    timestamp_utc TIMESTAMP(6) NOT NULL,
    timestamp_local TIMESTAMP(6) NOT NULL,
    fase ENUM('A', 'B', 'C', 'TOTAL') NOT NULL,
    voltaje DECIMAL(10,2),
    corriente DECIMAL(10,3),
    potencia_activa DECIMAL(10,2),
    potencia_aparente DECIMAL(10,2),
    factor_potencia DECIMAL(5,3),
    frecuencia DECIMAL(6,2),
    energia_activa DECIMAL(15,3),
    energia_reactiva DECIMAL(15,3),
    calidad_lectura ENUM('NORMAL', 'ALERTA', 'ERROR', 'INTERPOLADA') NOT NULL,
    validacion_detalle JSON,
    intervalo_segundos INT DEFAULT 10,
    fecha_creacion TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP(6),
    FOREIGN KEY (shelly_id) REFERENCES sem_dispositivos(shelly_id),
    INDEX idx_mediciones_timestamp (timestamp_utc),
    INDEX idx_mediciones_dispositivo (shelly_id),
    INDEX idx_mediciones_calidad (calidad_lectura)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
COMMENT 'Mediciones eléctricas detalladas';

-- --------------------------------------------------------
-- Tabla: Control de Calidad
-- Descripción: Control de calidad de las mediciones
-- --------------------------------------------------------
CREATE TABLE sem_control_calidad (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    shelly_id VARCHAR(12) NOT NULL,
    inicio_periodo TIMESTAMP NOT NULL,
    fin_periodo TIMESTAMP NOT NULL,
    lecturas_esperadas INT NOT NULL,
    lecturas_recibidas INT NOT NULL,
    lecturas_validas INT NOT NULL,
    lecturas_alertas INT NOT NULL,
    lecturas_error INT NOT NULL,
    lecturas_interpoladas INT NOT NULL,
    porcentaje_calidad DECIMAL(5,2) NOT NULL,
    estado_validacion ENUM('PENDIENTE', 'VALIDADO', 'ERROR') NOT NULL,
    detalles_validacion JSON,
    fecha_validacion TIMESTAMP NULL,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (shelly_id) REFERENCES sem_dispositivos(shelly_id),
    INDEX idx_calidad_periodo (inicio_periodo, fin_periodo),
    INDEX idx_calidad_dispositivo (shelly_id),
    INDEX idx_calidad_estado (estado_validacion)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
COMMENT 'Control de calidad de mediciones';

-- --------------------------------------------------------
-- Tabla: Errores de Medición
-- Descripción: Registro de errores en mediciones
-- --------------------------------------------------------
CREATE TABLE sem_errores_medicion (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    shelly_id VARCHAR(12) NOT NULL,
    timestamp_utc TIMESTAMP(6) NOT NULL,
    tipo_error ENUM('CONEXION', 'DATO_INVALIDO', 'FUERA_RANGO', 'TIMEOUT', 'OTRO') NOT NULL,
    nivel_error ENUM('ALERTA', 'ERROR') NOT NULL,
    descripcion TEXT NOT NULL,
    datos_error JSON,
    resuelto BOOLEAN DEFAULT FALSE,
    fecha_resolucion TIMESTAMP NULL,
    notas_resolucion TEXT,
    fecha_creacion TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP(6),
    FOREIGN KEY (shelly_id) REFERENCES sem_dispositivos(shelly_id),
    INDEX idx_errores_timestamp (timestamp_utc),
    INDEX idx_errores_dispositivo (shelly_id),
    INDEX idx_errores_tipo (tipo_error),
    INDEX idx_errores_nivel (nivel_error),
    INDEX idx_errores_resuelto (resuelto)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
COMMENT 'Registro de errores en mediciones';

-- --------------------------------------------------------
-- Funciones de Validación
-- --------------------------------------------------------

DELIMITER //

-- Función para validar voltaje (220V ±10% nominal, con rangos de alerta)
CREATE FUNCTION sem_validar_voltaje(voltaje DECIMAL(10,2)) 
RETURNS VARCHAR(10) DETERMINISTIC
BEGIN
    IF voltaje BETWEEN 198 AND 242 THEN
        RETURN 'NORMAL';
    ELSEIF voltaje BETWEEN 180 AND 260 THEN
        RETURN 'ALERTA';
    ELSEIF voltaje IS NULL THEN
        RETURN 'ERROR';
    ELSE
        RETURN 'ERROR';
    END IF;
END //

-- Función para validar corriente (0-200A según especificaciones Shelly Pro 3EM)
CREATE FUNCTION sem_validar_corriente(corriente DECIMAL(10,3)) 
RETURNS VARCHAR(10) DETERMINISTIC
BEGIN
    IF corriente BETWEEN 0 AND 200 THEN
        RETURN 'NORMAL';
    ELSEIF corriente IS NULL THEN
        RETURN 'ERROR';
    ELSE
        RETURN 'ERROR';
    END IF;
END //

-- Función para validar factor de potencia (-1 a 1, con alerta en valores negativos)
CREATE FUNCTION sem_validar_factor_potencia(fp DECIMAL(5,3)) 
RETURNS VARCHAR(10) DETERMINISTIC
BEGIN
    IF fp BETWEEN 0 AND 1 THEN
        RETURN 'NORMAL';
    ELSEIF fp BETWEEN -1 AND 0 THEN
        RETURN 'ALERTA';
    ELSEIF fp IS NULL THEN
        RETURN 'ERROR';
    ELSE
        RETURN 'ERROR';
    END IF;
END //

-- Función para validar frecuencia (50Hz ±0.5Hz nominal, con rangos de alerta)
CREATE FUNCTION sem_validar_frecuencia(freq DECIMAL(6,2)) 
RETURNS VARCHAR(10) DETERMINISTIC
BEGIN
    IF freq BETWEEN 49.5 AND 50.5 THEN
        RETURN 'NORMAL';
    ELSEIF freq BETWEEN 49 AND 51 THEN
        RETURN 'ALERTA';
    ELSEIF freq IS NULL THEN
        RETURN 'ERROR';
    ELSE
        RETURN 'ERROR';
    END IF;
END //

DELIMITER ;

-- --------------------------------------------------------
-- Triggers de Validación
-- --------------------------------------------------------

DELIMITER //

-- Trigger para validar mediciones antes de insertar
CREATE TRIGGER sem_validar_medicion_before_insert
BEFORE INSERT ON sem_mediciones
FOR EACH ROW
BEGIN
    DECLARE v_calidad_voltaje VARCHAR(10);
    DECLARE v_calidad_corriente VARCHAR(10);
    DECLARE v_calidad_fp VARCHAR(10);
    DECLARE v_calidad_freq VARCHAR(10);
    DECLARE v_peor_calidad VARCHAR(10) DEFAULT 'NORMAL';
    DECLARE v_detalles JSON;
    
    -- Validar cada parámetro
    SET v_calidad_voltaje = sem_validar_voltaje(NEW.voltaje);
    SET v_calidad_corriente = sem_validar_corriente(NEW.corriente);
    SET v_calidad_fp = sem_validar_factor_potencia(NEW.factor_potencia);
    SET v_calidad_freq = sem_validar_frecuencia(NEW.frecuencia);
    
    -- Determinar la peor calidad
    IF v_calidad_voltaje = 'ERROR' OR v_calidad_corriente = 'ERROR' OR 
       v_calidad_fp = 'ERROR' OR v_calidad_freq = 'ERROR' THEN
        SET v_peor_calidad = 'ERROR';
    ELSEIF v_calidad_voltaje = 'ALERTA' OR v_calidad_corriente = 'ALERTA' OR 
           v_calidad_fp = 'ALERTA' OR v_calidad_freq = 'ALERTA' THEN
        SET v_peor_calidad = 'ALERTA';
    END IF;
    
    -- Crear objeto JSON con detalles de validación
    SET v_detalles = JSON_OBJECT(
        'voltaje', JSON_OBJECT('valor', NEW.voltaje, 'calidad', v_calidad_voltaje),
        'corriente', JSON_OBJECT('valor', NEW.corriente, 'calidad', v_calidad_corriente),
        'factor_potencia', JSON_OBJECT('valor', NEW.factor_potencia, 'calidad', v_calidad_fp),
        'frecuencia', JSON_OBJECT('valor', NEW.frecuencia, 'calidad', v_calidad_freq)
    );
    
    -- Actualizar la medición con la calidad y detalles
    SET NEW.calidad_lectura = v_peor_calidad;
    SET NEW.validacion_detalle = v_detalles;
    
    -- Si hay problemas, registrar en errores_medicion
    IF v_peor_calidad IN ('ALERTA', 'ERROR') THEN
        INSERT INTO sem_errores_medicion (
            shelly_id,
            timestamp_utc,
            tipo_error,
            nivel_error,
            descripcion,
            datos_error
        ) VALUES (
            NEW.shelly_id,
            NEW.timestamp_utc,
            'DATO_INVALIDO',
            v_peor_calidad,
            CASE v_peor_calidad
                WHEN 'ALERTA' THEN 'Medición fuera de rangos normales'
                ELSE 'Medición con valores inválidos'
            END,
            v_detalles
        );
    END IF;
END //

DELIMITER ;

-- Restablecer configuración
SET FOREIGN_KEY_CHECKS = 1;
COMMIT;