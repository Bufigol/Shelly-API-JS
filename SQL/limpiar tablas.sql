-- Deshabilitar verificación de claves foráneas temporalmente
SET FOREIGN_KEY_CHECKS = 0;

-- Limpiar tablas de promedios
TRUNCATE TABLE promedios_energia_hora;
TRUNCATE TABLE promedios_energia_dia;
TRUNCATE TABLE promedios_energia_mes;

-- Limpiar tablas de totales
TRUNCATE TABLE totales_energia_hora;
TRUNCATE TABLE totales_energia_dia;
TRUNCATE TABLE totales_energia_mes;

-- Limpiar tablas de medición y control
TRUNCATE TABLE event_execution_log;
TRUNCATE TABLE measurement_quality_control;
TRUNCATE TABLE energy_meter;
TRUNCATE TABLE energy_meter_data;
TRUNCATE TABLE temperature;
TRUNCATE TABLE device_status;

-- Habilitar nuevamente la verificación de claves foráneas
SET FOREIGN_KEY_CHECKS = 1;

-- Reiniciar los auto_increment
ALTER TABLE promedios_energia_hora AUTO_INCREMENT = 1;
ALTER TABLE promedios_energia_dia AUTO_INCREMENT = 1;
ALTER TABLE promedios_energia_mes AUTO_INCREMENT = 1;
ALTER TABLE totales_energia_hora AUTO_INCREMENT = 1;
ALTER TABLE totales_energia_dia AUTO_INCREMENT = 1;
ALTER TABLE totales_energia_mes AUTO_INCREMENT = 1;
ALTER TABLE event_execution_log AUTO_INCREMENT = 1;
ALTER TABLE measurement_quality_control AUTO_INCREMENT = 1;
ALTER TABLE energy_meter AUTO_INCREMENT = 1;
ALTER TABLE energy_meter_data AUTO_INCREMENT = 1;
ALTER TABLE temperature AUTO_INCREMENT = 1;
ALTER TABLE device_status AUTO_INCREMENT = 1;