-- Tabla para almacenar los datos del medidor de energía (energy meter)
CREATE TABLE energy_meter (
    id INT PRIMARY KEY AUTO_INCREMENT,
    fase_a_act_power FLOAT,
    fase_a_aprt_power FLOAT,
    fase_a_current FLOAT,
    fase_a_freq FLOAT,
    fase_a_pf FLOAT,
    fase_a_voltage FLOAT,
    fase_b_act_power FLOAT,
    fase_b_aprt_power FLOAT,
    fase_b_current FLOAT,
    fase_b_freq FLOAT,
    fase_b_pf FLOAT,
    fase_b_voltage FLOAT,
    fase_c_act_power FLOAT,
    fase_c_aprt_power FLOAT,
    fase_c_current FLOAT,
    fase_c_freq FLOAT,
    fase_c_pf FLOAT,
    fase_c_voltage FLOAT,
    total_act_power FLOAT,
    total_aprt_power FLOAT,
    total_current FLOAT,
    user_calibrated_phases BOOLEAN DEFAULT FALSE
);

-- Tabla para almacenar los datos de temperatura
CREATE TABLE temperature (
    id INT PRIMARY KEY AUTO_INCREMENT,
    celsius FLOAT,
    fahrenheit FLOAT
);

-- Tabla para almacenar los datos adicionales del medidor de energía
CREATE TABLE energy_meter_data (
    id INT PRIMARY KEY AUTO_INCREMENT,
    a_total_act_energy FLOAT,
    a_total_act_ret_energy FLOAT,
    b_total_act_energy FLOAT,
    b_total_act_ret_energy FLOAT,
    c_total_act_energy FLOAT,
    c_total_act_ret_energy FLOAT,
    total_act_energy FLOAT,
    total_act_ret_energy FLOAT
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
    wifi_rssi INT,
    sys_mac VARCHAR(12),
    sys_restart_required BOOLEAN DEFAULT FALSE,
    sys_time TIME,
    sys_timestamp TIMESTAMP,
    sys_uptime INT,
    sys_ram_size INT,
    sys_ram_free INT,
    sys_fs_size INT,
    sys_fs_free INT,
    sys_cfg_rev INT,
    sys_kvs_rev INT,
    sys_schedule_rev INT,
    sys_webhook_rev INT,
    sys_reset_reason INT,
    FOREIGN KEY (em0_id) REFERENCES energy_meter(id),
    FOREIGN KEY (temperature0_id) REFERENCES temperature(id),
    FOREIGN KEY (emdata0_id) REFERENCES energy_meter_data(id)
);
-- Tabla para almacenar promedios de consumo por hora
CREATE TABLE promedios_energia_hora (
    id INT PRIMARY KEY AUTO_INCREMENT,
    fecha_hora DATETIME NOT NULL,
    promedio_watts FLOAT,
    kwh_consumidos FLOAT,
    costo DECIMAL(10,2),
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_fecha_hora (fecha_hora)
);

-- Tabla para almacenar promedios de consumo por día
CREATE TABLE promedios_energia_dia (
    id INT PRIMARY KEY AUTO_INCREMENT,
    fecha DATE NOT NULL,
    promedio_watts FLOAT,
    kwh_consumidos FLOAT,
    costo DECIMAL(10,2),
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_fecha (fecha)
);

-- Tabla para almacenar promedios de consumo por mes
CREATE TABLE promedios_energia_mes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    fecha_mes DATE NOT NULL,  -- Solo se usará el año y mes de esta fecha
    promedio_watts FLOAT,
    kwh_consumidos FLOAT,
    costo DECIMAL(10,2),
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_fecha_mes (fecha_mes)
);

-- Tabla para almacenar totales de consumo por hora
CREATE TABLE totales_energia_hora (
    id INT PRIMARY KEY AUTO_INCREMENT,
    fecha_hora DATETIME NOT NULL,
    total_watts_hora FLOAT,
    total_kwh FLOAT,
    costo_total DECIMAL(10,2),
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY idx_fecha_hora (fecha_hora)
);

-- Tabla para almacenar totales de consumo por día
CREATE TABLE totales_energia_dia (
    id INT PRIMARY KEY AUTO_INCREMENT,
    fecha DATE NOT NULL,
    total_watts_dia FLOAT,
    total_kwh FLOAT,
    costo_total DECIMAL(10,2),
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY idx_fecha (fecha)
);

-- Tabla para almacenar totales de consumo por mes
CREATE TABLE totales_energia_mes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    anio INT NOT NULL,
    mes INT NOT NULL,
    total_watts_mes FLOAT,
    total_kwh FLOAT,
    costo_total DECIMAL(10,2),
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY idx_anio_mes (anio, mes)
);
-- Índices para mejorar el rendimiento de las consultas
CREATE INDEX idx_device_status_timestamp ON device_status(sys_timestamp);
CREATE INDEX idx_device_status_updated ON device_status(updated);
CREATE INDEX idx_device_status_code ON device_status(code);
-- Modificaciones a energy_meter para incluir calidad de datos
ALTER TABLE energy_meter
ADD COLUMN measurement_timestamp TIMESTAMP(3) NOT NULL,
ADD COLUMN interval_seconds INT DEFAULT 10,
ADD COLUMN reading_quality ENUM('GOOD', 'INTERPOLATED', 'SUSPECT', 'BAD') DEFAULT 'GOOD',
ADD COLUMN readings_count INT DEFAULT 1,
ADD INDEX idx_measurement_timestamp (measurement_timestamp);

-- Nueva tabla para control de calidad de mediciones
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
    FOREIGN KEY (energy_meter_id) REFERENCES energy_meter(id),
    INDEX idx_timestamp_range (start_timestamp, end_timestamp)
);

-- Modificaciones a las tablas de promedios
ALTER TABLE promedios_energia_hora
ADD COLUMN expected_readings INT NOT NULL DEFAULT 360,
ADD COLUMN actual_readings INT NOT NULL DEFAULT 0,
ADD COLUMN min_watts FLOAT,
ADD COLUMN max_watts FLOAT,
ADD COLUMN quality_score FLOAT DEFAULT 1.0;

ALTER TABLE promedios_energia_dia
ADD COLUMN hours_with_data INT NOT NULL DEFAULT 24,
ADD COLUMN min_watts FLOAT,
ADD COLUMN max_watts FLOAT,
ADD COLUMN quality_score FLOAT DEFAULT 1.0;

ALTER TABLE promedios_energia_mes
ADD COLUMN days_with_data INT NOT NULL DEFAULT 0,
ADD COLUMN min_watts FLOAT,
ADD COLUMN max_watts FLOAT,
ADD COLUMN quality_score FLOAT DEFAULT 1.0;

-- Modificaciones a las tablas de totales
ALTER TABLE totales_energia_hora
ADD COLUMN readings_in_period INT NOT NULL DEFAULT 0,
ADD COLUMN quality_score FLOAT DEFAULT 1.0;

ALTER TABLE totales_energia_dia
ADD COLUMN hours_with_data INT NOT NULL DEFAULT 0,
ADD COLUMN quality_score FLOAT DEFAULT 1.0;

ALTER TABLE totales_energia_mes
ADD COLUMN days_with_data INT NOT NULL DEFAULT 0,
ADD COLUMN quality_score FLOAT DEFAULT 1.0;

-- Tabla de configuración del sistema
CREATE TABLE energy_measurement_config (
    id INT PRIMARY KEY AUTO_INCREMENT,
    parameter_name VARCHAR(50) NOT NULL,
    parameter_value VARCHAR(255) NOT NULL,
    description TEXT,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_parameter (parameter_name)
);

-- Insertar configuración inicial
INSERT INTO energy_measurement_config (parameter_name, parameter_value, description) VALUES
('precio_kwh', '203', 'Precio del kWh en CLP'),
('intervalo_medicion', '10', 'Intervalo esperado entre mediciones en segundos'),
('max_desviacion_intervalo', '2', 'Máxima desviación permitida del intervalo en segundos'),
('umbral_calidad', '0.8', 'Umbral mínimo de calidad para considerar período válido');