-- Desactivar verificación de claves foráneas
SET FOREIGN_KEY_CHECKS = 0;

-- Eliminar procedimientos existentes
DROP PROCEDURE IF EXISTS add_column_if_not_exists;
DROP PROCEDURE IF EXISTS drop_index_if_exists;

-- Limpiar tablas existentes
TRUNCATE TABLE promedios_energia_mes;
TRUNCATE TABLE promedios_energia_dia;
TRUNCATE TABLE promedios_energia_hora;
TRUNCATE TABLE totales_energia_mes;
TRUNCATE TABLE totales_energia_dia;
TRUNCATE TABLE totales_energia_hora;
TRUNCATE TABLE device_status;
TRUNCATE TABLE energy_meter;
TRUNCATE TABLE energy_meter_data;
TRUNCATE TABLE temperature;
TRUNCATE TABLE event_execution_log;
TRUNCATE TABLE measurement_quality_control;

-- Crear tabla de dispositivos si no existe
CREATE TABLE IF NOT EXISTS devices (
    id INT PRIMARY KEY AUTO_INCREMENT,
    mac_address VARCHAR(12) NOT NULL,
    device_code VARCHAR(50) NOT NULL,
    device_type VARCHAR(50) NOT NULL,
    friendly_name VARCHAR(100),
    location VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_mac_address (mac_address),
    UNIQUE KEY uk_device_code (device_code)
) ENGINE=InnoDB;

-- Crear tabla de registro de cambios de dispositivos
CREATE TABLE IF NOT EXISTS device_changes_log (
    id INT PRIMARY KEY AUTO_INCREMENT,
    device_id INT NOT NULL,
    change_type ENUM('LOCATION', 'NAME', 'OTHER') NOT NULL,
    previous_value VARCHAR(100),
    new_value VARCHAR(100),
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    changed_by VARCHAR(50),
    CONSTRAINT fk_dcl_device FOREIGN KEY (device_id) REFERENCES devices(id)
) ENGINE=InnoDB;

-- Crear procedimientos
DELIMITER //

CREATE PROCEDURE add_column_if_not_exists(
    IN p_table_name VARCHAR(64), 
    IN p_column_name VARCHAR(64),
    IN p_column_definition VARCHAR(128)
)
BEGIN
    DECLARE v_column_exists INT;
    
    SELECT COUNT(1) INTO v_column_exists
    FROM information_schema.columns 
    WHERE table_schema = DATABASE()
        AND table_name = p_table_name
        AND column_name = p_column_name;
    
    IF v_column_exists = 0 THEN
        SET @sql = CONCAT('ALTER TABLE ', p_table_name, 
                         ' ADD COLUMN ', p_column_name, ' ', p_column_definition);
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END //

CREATE PROCEDURE drop_index_if_exists(
    IN p_table_name VARCHAR(64),
    IN p_index_name VARCHAR(64)
)
BEGIN
    DECLARE v_index_exists INT;
    
    SELECT COUNT(1) INTO v_index_exists
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
        AND table_name = p_table_name
        AND index_name = p_index_name;

    IF v_index_exists > 0 THEN
        SET @sql = CONCAT('ALTER TABLE ', p_table_name, ' DROP INDEX ', p_index_name);
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END //

DELIMITER ;

-- Añadir columnas device_id de forma segura
CALL add_column_if_not_exists('energy_meter', 'device_id', 'INT NOT NULL');
CALL add_column_if_not_exists('energy_meter_data', 'device_id', 'INT NOT NULL');
CALL add_column_if_not_exists('temperature', 'device_id', 'INT NOT NULL');
CALL add_column_if_not_exists('promedios_energia_hora', 'device_id', 'INT NOT NULL');
CALL add_column_if_not_exists('promedios_energia_dia', 'device_id', 'INT NOT NULL');
CALL add_column_if_not_exists('promedios_energia_mes', 'device_id', 'INT NOT NULL');
CALL add_column_if_not_exists('totales_energia_hora', 'device_id', 'INT NOT NULL');
CALL add_column_if_not_exists('totales_energia_dia', 'device_id', 'INT NOT NULL');
CALL add_column_if_not_exists('totales_energia_mes', 'device_id', 'INT NOT NULL');

-- Eliminar índices existentes
CALL drop_index_if_exists('promedios_energia_hora', 'idx_fecha_hora');
CALL drop_index_if_exists('promedios_energia_dia', 'idx_fecha');
CALL drop_index_if_exists('promedios_energia_mes', 'idx_fecha_mes');
CALL drop_index_if_exists('totales_energia_hora', 'idx_fecha_hora');
CALL drop_index_if_exists('totales_energia_dia', 'idx_fecha');
CALL drop_index_if_exists('totales_energia_mes', 'idx_anio_mes');

-- Añadir foreign keys y nuevos índices
ALTER TABLE energy_meter 
    ADD CONSTRAINT fk_em_device FOREIGN KEY (device_id) REFERENCES devices(id),
    ADD INDEX idx_device_timestamp (device_id, measurement_timestamp);

ALTER TABLE energy_meter_data 
    ADD CONSTRAINT fk_emd_device FOREIGN KEY (device_id) REFERENCES devices(id);

ALTER TABLE temperature 
    ADD CONSTRAINT fk_temp_device FOREIGN KEY (device_id) REFERENCES devices(id);

ALTER TABLE promedios_energia_hora 
    ADD CONSTRAINT fk_peh_device FOREIGN KEY (device_id) REFERENCES devices(id),
    ADD UNIQUE INDEX uk_device_fecha_hora (device_id, fecha_hora);

ALTER TABLE promedios_energia_dia 
    ADD CONSTRAINT fk_ped_device FOREIGN KEY (device_id) REFERENCES devices(id),
    ADD UNIQUE INDEX uk_device_fecha (device_id, fecha);

ALTER TABLE promedios_energia_mes 
    ADD CONSTRAINT fk_pem_device FOREIGN KEY (device_id) REFERENCES devices(id),
    ADD UNIQUE INDEX uk_device_fecha_mes (device_id, fecha_mes);

ALTER TABLE totales_energia_hora 
    ADD CONSTRAINT fk_teh_device FOREIGN KEY (device_id) REFERENCES devices(id),
    ADD UNIQUE INDEX uk_device_fecha_hora (device_id, fecha_hora);

ALTER TABLE totales_energia_dia 
    ADD CONSTRAINT fk_ted_device FOREIGN KEY (device_id) REFERENCES devices(id),
    ADD UNIQUE INDEX uk_device_fecha (device_id, fecha);

ALTER TABLE totales_energia_mes 
    ADD CONSTRAINT fk_tem_device FOREIGN KEY (device_id) REFERENCES devices(id),
    ADD UNIQUE INDEX uk_device_anio_mes (device_id, anio, mes);

-- Insertar dispositivo inicial según la configuración
INSERT INTO devices (mac_address, device_code, device_type, friendly_name, location)
SELECT 'fce8c0d82d08', 'shelly-141-eu', 'SHELLY_PRO_3EM', 'Medidor Principal', 'Panel Principal'
WHERE NOT EXISTS (SELECT 1 FROM devices WHERE mac_address = 'fce8c0d82d08');

-- Restablecer configuración inicial
INSERT INTO energy_measurement_config 
(parameter_name, parameter_value, description) 
VALUES
('precio_kwh', '151.85', 'Precio del kWh en CLP'),
('intervalo_medicion', '10', 'Intervalo esperado entre mediciones en segundos'),
('max_desviacion_intervalo', '2', 'Máxima desviación permitida del intervalo en segundos'),
('umbral_calidad', '0.8', 'Umbral mínimo de calidad para considerar período válido')
ON DUPLICATE KEY UPDATE
parameter_value = VALUES(parameter_value),
description = VALUES(description);

-- Insertar el precio inicial en el historial si no existe
INSERT INTO energy_price_history (precio_kwh, motivo, usuario)
SELECT 151.85, 'Configuración inicial del sistema', 'system'
WHERE NOT EXISTS (SELECT 1 FROM energy_price_history WHERE precio_kwh = 151.85 AND motivo = 'Configuración inicial del sistema');

-- Limpiar
DROP PROCEDURE IF EXISTS add_column_if_not_exists;
DROP PROCEDURE IF EXISTS drop_index_if_exists;

-- Reactivar verificación de claves foráneas
SET FOREIGN_KEY_CHECKS = 1;