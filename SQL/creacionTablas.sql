-- Configuración inicial de la base de datos
SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";

-- Desactivar verificación de claves foráneas temporalmente
SET FOREIGN_KEY_CHECKS = 0;

-- Eliminar tablas en orden inverso para evitar problemas de dependencia
DROP TABLE IF EXISTS event_execution_log;
DROP TABLE IF EXISTS energy_price_history;
DROP TABLE IF EXISTS energy_measurement_config;
DROP TABLE IF EXISTS measurement_quality_control;
DROP TABLE IF EXISTS promedios_energia_mes;
DROP TABLE IF EXISTS promedios_energia_dia;
DROP TABLE IF EXISTS promedios_energia_hora;
DROP TABLE IF EXISTS totales_energia_mes;
DROP TABLE IF EXISTS totales_energia_dia;
DROP TABLE IF EXISTS totales_energia_hora;
DROP TABLE IF EXISTS device_status;
DROP TABLE IF EXISTS energy_meter_data;
DROP TABLE IF EXISTS energy_meter;
DROP TABLE IF EXISTS temperature;

-- Tabla de configuración del sistema con validaciones
CREATE TABLE energy_measurement_config (
    id INT PRIMARY KEY AUTO_INCREMENT,
    parameter_name VARCHAR(50) NOT NULL,
    parameter_value VARCHAR(255) NOT NULL,
    description TEXT,
    is_editable BOOLEAN DEFAULT TRUE,
    min_value DECIMAL(10,2) NULL,
    max_value DECIMAL(10,2) NULL,
    data_type ENUM('STRING', 'NUMBER', 'BOOLEAN') DEFAULT 'STRING',
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_parameter (parameter_name),
    CONSTRAINT chk_parameter_value CHECK (
        (data_type = 'NUMBER' AND CAST(parameter_value AS DECIMAL(10,2)) BETWEEN COALESCE(min_value, -999999) AND COALESCE(max_value, 999999)) OR
        (data_type = 'STRING') OR
        (data_type = 'BOOLEAN' AND parameter_value IN ('true', 'false', '0', '1'))
    )
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Tabla para historial de precios con validaciones más robustas
CREATE TABLE energy_price_history (
    id INT PRIMARY KEY AUTO_INCREMENT,
    precio_kwh DECIMAL(10,2) NOT NULL,
    fecha_inicio TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_fin TIMESTAMP NULL,
    motivo VARCHAR(255),
    usuario VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE INDEX idx_fecha_inicio (fecha_inicio),
    INDEX idx_fecha_fin (fecha_fin),
    CONSTRAINT chk_precio_positivo CHECK (precio_kwh > 0)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Tabla para almacenar los datos del medidor de energía con índices optimizados
CREATE TABLE energy_meter (
    id INT PRIMARY KEY AUTO_INCREMENT,
    fase_a_act_power FLOAT DEFAULT 0,
    fase_a_aprt_power FLOAT DEFAULT 0,
    fase_a_current FLOAT DEFAULT 0,
    fase_a_freq FLOAT DEFAULT 0,
    fase_a_pf FLOAT DEFAULT 0,
    fase_a_voltage FLOAT DEFAULT 0,
    fase_b_act_power FLOAT DEFAULT 0,
    fase_b_aprt_power FLOAT DEFAULT 0,
    fase_b_current FLOAT DEFAULT 0,
    fase_b_freq FLOAT DEFAULT 0,
    fase_b_pf FLOAT DEFAULT 0,
    fase_b_voltage FLOAT DEFAULT 0,
    fase_c_act_power FLOAT DEFAULT 0,
    fase_c_aprt_power FLOAT DEFAULT 0,
    fase_c_current FLOAT DEFAULT 0,
    fase_c_freq FLOAT DEFAULT 0,
    fase_c_pf FLOAT DEFAULT 0,
    fase_c_voltage FLOAT DEFAULT 0,
    total_act_power FLOAT DEFAULT 0,
    total_aprt_power FLOAT DEFAULT 0,
    total_current FLOAT DEFAULT 0,
    measurement_timestamp TIMESTAMP(3) NOT NULL,
    interval_seconds INT DEFAULT 10,
    reading_quality ENUM('GOOD', 'INTERPOLATED', 'SUSPECT', 'BAD') DEFAULT 'GOOD',
    readings_count INT DEFAULT 1,
    user_calibrated_phases BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_measurement_timestamp (measurement_timestamp),
    INDEX idx_created_at (created_at),
    INDEX idx_reading_quality (reading_quality)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Tabla para datos adicionales del medidor de energía
CREATE TABLE energy_meter_data (
    id INT PRIMARY KEY AUTO_INCREMENT,
    energy_meter_id INT,
    a_total_act_energy FLOAT DEFAULT 0,
    a_total_act_ret_energy FLOAT DEFAULT 0,
    b_total_act_energy FLOAT DEFAULT 0,
    b_total_act_ret_energy FLOAT DEFAULT 0,
    c_total_act_energy FLOAT DEFAULT 0,
    c_total_act_ret_energy FLOAT DEFAULT 0,
    total_act_energy FLOAT DEFAULT 0,
    total_act_ret_energy FLOAT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (energy_meter_id) REFERENCES energy_meter(id) ON DELETE SET NULL,
    INDEX idx_created_at (created_at),
    INDEX idx_energy_meter_id (energy_meter_id)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Tabla para datos de temperatura
CREATE TABLE temperature (
    id INT PRIMARY KEY AUTO_INCREMENT,
    celsius FLOAT DEFAULT 0,
    fahrenheit FLOAT DEFAULT 0,
    humidity FLOAT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Tabla de estado del dispositivo con gestión de referencias
CREATE TABLE device_status (
    id INT PRIMARY KEY AUTO_INCREMENT,
    code VARCHAR(50) UNIQUE,
    energy_meter_id INT,
    temperature_id INT,
    energy_meter_data_id INT,
    updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    cloud_connected BOOLEAN DEFAULT FALSE,
    wifi_sta_ip VARCHAR(15),
    wifi_status VARCHAR(50),
    wifi_ssid VARCHAR(100),
    wifi_rssi INT DEFAULT 0,
    sys_mac VARCHAR(12) UNIQUE,
    sys_restart_required BOOLEAN DEFAULT FALSE,
    sys_time TIME,
    sys_timestamp TIMESTAMP,
    sys_uptime INT DEFAULT 0,
    sys_ram_size INT DEFAULT 0,
    sys_ram_free INT DEFAULT 0,
    sys_fs_size INT DEFAULT 0,
    sys_fs_free INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (energy_meter_id) REFERENCES energy_meter(id) ON DELETE SET NULL,
    FOREIGN KEY (temperature_id) REFERENCES temperature(id) ON DELETE SET NULL,
    FOREIGN KEY (energy_meter_data_id) REFERENCES energy_meter_data(id) ON DELETE SET NULL,
    INDEX idx_sys_timestamp (sys_timestamp),
    INDEX idx_updated (updated),
    INDEX idx_sys_mac (sys_mac)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Tabla para registro de ejecución de eventos
CREATE TABLE event_execution_log (
    id INT PRIMARY KEY AUTO_INCREMENT,
    event_name VARCHAR(100) NOT NULL,
    execution_start TIMESTAMP(3) NOT NULL,
    execution_end TIMESTAMP(3) NULL,
    status ENUM('RUNNING', 'COMPLETED', 'ERROR') NOT NULL,
    records_processed INT DEFAULT 0,
    error_message TEXT,
    details JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_event_name (event_name),
    INDEX idx_execution_start (execution_start),
    INDEX idx_status (status),
    INDEX idx_event_status (event_name, status)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Tabla para control de calidad de mediciones
CREATE TABLE measurement_quality_control (
    id INT PRIMARY KEY AUTO_INCREMENT,
    energy_meter_id INT NOT NULL,
    start_timestamp TIMESTAMP(3) NOT NULL,
    end_timestamp TIMESTAMP(3) NOT NULL,
    expected_readings INT NOT NULL,
    actual_readings INT NOT NULL,
    missing_intervals INT DEFAULT 0,
    interpolated_readings INT DEFAULT 0,
    quality_score FLOAT NOT NULL DEFAULT 1.0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (energy_meter_id) REFERENCES energy_meter(id) ON DELETE CASCADE,
    INDEX idx_timestamp_range (start_timestamp, end_timestamp),
    INDEX idx_energy_meter_id (energy_meter_id)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Tabla para almacenar promedios por hora
CREATE TABLE promedios_energia_hora (
    id INT PRIMARY KEY AUTO_INCREMENT,
    fecha_hora DATETIME NOT NULL,
    promedio_watts FLOAT DEFAULT 0,
    min_watts FLOAT DEFAULT 0,
    max_watts FLOAT DEFAULT 0,
    kwh_consumidos FLOAT DEFAULT 0,
    costo DECIMAL(10,2) DEFAULT 0,
    expected_readings INT NOT NULL DEFAULT 360,
    actual_readings INT NOT NULL DEFAULT 0,
    quality_score FLOAT DEFAULT 1.0,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE INDEX idx_fecha_hora (fecha_hora)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Tabla para almacenar promedios por día
CREATE TABLE promedios_energia_dia (
    id INT PRIMARY KEY AUTO_INCREMENT,
    fecha DATE NOT NULL,
    promedio_watts FLOAT DEFAULT 0,
    min_watts FLOAT DEFAULT 0,
    max_watts FLOAT DEFAULT 0,
    kwh_consumidos FLOAT DEFAULT 0,
    costo DECIMAL(10,2) DEFAULT 0,
    hours_with_data INT NOT NULL DEFAULT 24,
    quality_score FLOAT DEFAULT 1.0,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE INDEX idx_fecha (fecha)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Tabla para almacenar promedios por mes
CREATE TABLE promedios_energia_mes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    fecha_mes DATE NOT NULL,
    promedio_watts FLOAT DEFAULT 0,
    min_watts FLOAT DEFAULT 0,
    max_watts FLOAT DEFAULT 0,
    kwh_consumidos FLOAT DEFAULT 0,
    costo DECIMAL(10,2) DEFAULT 0,
    days_with_data INT NOT NULL DEFAULT 0,
    quality_score FLOAT DEFAULT 1.0,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE INDEX idx_fecha_mes (fecha_mes)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Tabla para almacenar totales por hora
CREATE TABLE totales_energia_hora (
    id INT PRIMARY KEY AUTO_INCREMENT,
    fecha_hora DATETIME NOT NULL,
    total_watts_hora FLOAT DEFAULT 0,
    total_kwh FLOAT DEFAULT 0,
    costo_total DECIMAL(10,2) DEFAULT 0,
    readings_in_period INT NOT NULL DEFAULT 0,
    quality_score FLOAT DEFAULT 1.0,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE INDEX idx_fecha_hora (fecha_hora)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Tabla para almacenar totales por día
CREATE TABLE totales_energia_dia (
    id INT PRIMARY KEY AUTO_INCREMENT,
    fecha DATE NOT NULL,
    total_watts_dia FLOAT DEFAULT 0,
    total_kwh FLOAT DEFAULT 0,
    costo_total DECIMAL(10,2) DEFAULT 0,
    hours_with_data INT NOT NULL DEFAULT 0,
    quality_score FLOAT DEFAULT 1.0,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE INDEX idx_fecha (fecha)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Tabla para almacenar totales por mes
CREATE TABLE totales_energia_mes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    anio INT NOT NULL,
    mes INT NOT NULL,
    total_watts_mes FLOAT DEFAULT 0,
    total_kwh FLOAT DEFAULT 0,
    costo_total DECIMAL(10,2) DEFAULT 0,
    days_with_data INT NOT NULL DEFAULT 0,
    quality_score FLOAT DEFAULT 1.0,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE INDEX idx_anio_mes (anio, mes)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Trigger para actualizar energy_measurement_config cuando se inserta un nuevo precio
DELIMITER //

CREATE TRIGGER trg_energy_price_history_insert 
AFTER INSERT ON energy_price_history
FOR EACH ROW
BEGIN
    IF NEW.precio_kwh > 0 THEN
        -- Actualizar el precio en la tabla de configuración
        UPDATE energy_measurement_config
        SET parameter_value = CAST(NEW.precio_kwh AS CHAR)
        WHERE parameter_name = 'precio_kwh';

        -- Actualizar la fecha_fin del registro anterior usando una consulta separada
        SET @prev_id = (
            SELECT id 
            FROM energy_price_history 
            WHERE id != NEW.id 
            AND fecha_fin IS NULL 
            ORDER BY fecha_inicio DESC 
            LIMIT 1
        );

        IF @prev_id IS NOT NULL THEN
            UPDATE energy_price_history
            SET fecha_fin = NEW.fecha_inicio
            WHERE id = @prev_id;
        END IF;
    ELSE
        SIGNAL SQLSTATE '45000' 
        SET MESSAGE_TEXT = 'El precio del kWh debe ser mayor que cero';
    END IF;
END//

DELIMITER ;

DELIMITER //
CREATE TRIGGER trg_update_execution_end
BEFORE UPDATE ON event_execution_log
FOR EACH ROW
BEGIN
    IF NEW.status IN ('COMPLETED', 'ERROR') AND OLD.status = 'RUNNING' THEN
        SET NEW.execution_end = CURRENT_TIMESTAMP(3);
    END IF;
END//
DELIMITER ;

-- Insertar configuración inicial
INSERT INTO energy_measurement_config 
(parameter_name, parameter_value, description) 
VALUES
('precio_kwh', '151.85', 'Precio del kWh en CLP'),
('intervalo_medicion', '10', 'Intervalo esperado entre mediciones en segundos'),
('max_desviacion_intervalo', '2', 'Máxima desviación permitida del intervalo en segundos'),
('umbral_calidad', '0.8', 'Umbral mínimo de calidad para considerar período válido');

-- Insertar el precio inicial en el historial
INSERT INTO energy_price_history (precio_kwh, motivo, usuario)
VALUES (151.85, 'Configuración inicial del sistema', 'system');

-- Reactivar verificación de claves foráneas
SET FOREIGN_KEY_CHECKS = 1;

COMMIT;