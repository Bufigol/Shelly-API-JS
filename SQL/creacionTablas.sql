-- Configuración inicial de la base de datos
SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";

-- Eliminar tablas si existen para asegurar una instalación limpia
DROP TABLE IF EXISTS energy_price_history;
DROP TABLE IF EXISTS measurement_quality_control;
DROP TABLE IF EXISTS promedios_energia_mes;
DROP TABLE IF EXISTS promedios_energia_dia;
DROP TABLE IF EXISTS promedios_energia_hora;
DROP TABLE IF EXISTS totales_energia_mes;
DROP TABLE IF EXISTS totales_energia_dia;
DROP TABLE IF EXISTS totales_energia_hora;
DROP TABLE IF EXISTS device_status;
DROP TABLE IF EXISTS energy_meter;
DROP TABLE IF EXISTS energy_meter_data;
DROP TABLE IF EXISTS temperature;
DROP TABLE IF EXISTS energy_measurement_config;

-- Tabla para almacenar los datos del medidor de energía
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
    INDEX idx_measurement_timestamp (measurement_timestamp)
);

-- Tabla para almacenar los datos de temperatura
CREATE TABLE temperature (
    id INT PRIMARY KEY AUTO_INCREMENT,
    celsius FLOAT DEFAULT 0,
    fahrenheit FLOAT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla para almacenar los datos adicionales del medidor de energía
CREATE TABLE energy_meter_data (
    id INT PRIMARY KEY AUTO_INCREMENT,
    a_total_act_energy FLOAT DEFAULT 0,
    a_total_act_ret_energy FLOAT DEFAULT 0,
    b_total_act_energy FLOAT DEFAULT 0,
    b_total_act_ret_energy FLOAT DEFAULT 0,
    c_total_act_energy FLOAT DEFAULT 0,
    c_total_act_ret_energy FLOAT DEFAULT 0,
    total_act_energy FLOAT DEFAULT 0,
    total_act_ret_energy FLOAT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla principal que almacena el estado del dispositivo
CREATE TABLE device_status (
    id INT PRIMARY KEY AUTO_INCREMENT,
    code VARCHAR(50),
    em0_id INT,
    temperature0_id INT,
    emdata0_id INT,
    updated TIMESTAMP,
    cloud_connected BOOLEAN DEFAULT FALSE,
    wifi_sta_ip VARCHAR(15),
    wifi_status VARCHAR(50),
    wifi_ssid VARCHAR(100),
    wifi_rssi INT DEFAULT 0,
    sys_mac VARCHAR(12),
    sys_restart_required BOOLEAN DEFAULT FALSE,
    sys_time TIME,
    sys_timestamp TIMESTAMP,
    sys_uptime INT DEFAULT 0,
    sys_ram_size INT DEFAULT 0,
    sys_ram_free INT DEFAULT 0,
    sys_fs_size INT DEFAULT 0,
    sys_fs_free INT DEFAULT 0,
    sys_cfg_rev INT DEFAULT 0,
    sys_kvs_rev INT DEFAULT 0,
    sys_schedule_rev INT DEFAULT 0,
    sys_webhook_rev INT DEFAULT 0,
    sys_reset_reason INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (em0_id) REFERENCES energy_meter(id),
    FOREIGN KEY (temperature0_id) REFERENCES temperature(id),
    FOREIGN KEY (emdata0_id) REFERENCES energy_meter_data(id),
    INDEX idx_sys_timestamp (sys_timestamp),
    INDEX idx_updated (updated)
);

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
    quality_score FLOAT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (energy_meter_id) REFERENCES energy_meter(id),
    INDEX idx_timestamp_range (start_timestamp, end_timestamp)
);

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
);

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
);

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
);

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
);

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
);

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
);

-- Tabla de configuración del sistema
CREATE TABLE energy_measurement_config (
    id INT PRIMARY KEY AUTO_INCREMENT,
    parameter_name VARCHAR(50) NOT NULL,
    parameter_value VARCHAR(255) NOT NULL,
    description TEXT,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_parameter (parameter_name)
);

-- Nueva tabla para historial de precios
CREATE TABLE energy_price_history (
    id INT PRIMARY KEY AUTO_INCREMENT,
    precio_kwh DECIMAL(10,2) NOT NULL,
    fecha_inicio TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_fin TIMESTAMP NULL,
    motivo TEXT,
    usuario VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE INDEX idx_fecha_inicio (fecha_inicio),
    INDEX idx_fecha_fin (fecha_fin)
);

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
    INDEX idx_status (status)
);

-- Trigger para act
-- Trigger para actualizar energy_measurement_config cuando se inserta un nuevo precio
DELIMITER //

CREATE TRIGGER trg_energy_price_history_insert 
AFTER INSERT ON energy_price_history
FOR EACH ROW
BEGIN
    -- Actualizar el precio en la tabla de configuración
    UPDATE energy_measurement_config
    SET parameter_value = CAST(NEW.precio_kwh AS CHAR)
    WHERE parameter_name = 'precio_kwh';

    -- Actualizar la fecha_fin del registro anterior
    UPDATE energy_price_history
    SET fecha_fin = NEW.fecha_inicio
    WHERE id != NEW.id 
    AND fecha_fin IS NULL;
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

COMMIT;