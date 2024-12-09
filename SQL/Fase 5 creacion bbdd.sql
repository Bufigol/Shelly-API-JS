-- =============================================
-- Fase 5: Optimización y Funcionalidades Avanzadas
-- Versión MySQL
-- =============================================

-- 1. Optimización de Base
-- =============================================

-- Índices compuestos para consultas frecuentes
ALTER TABLE sem_mediciones 
ADD INDEX idx_mediciones_completo (shelly_id, timestamp_utc, calidad_lectura);

ALTER TABLE sem_promedios_hora
ADD INDEX idx_promedios_hora_completo (shelly_id, hora_utc, calidad_datos);

ALTER TABLE sem_totales_hora
ADD INDEX idx_totales_hora_completo (shelly_id, hora_utc, energia_activa_total);

-- Vista para datos recientes (MySQL no soporta vistas materializadas)
CREATE OR REPLACE VIEW v_lecturas_recientes AS
SELECT 
    m.*,
    d.nombre as nombre_dispositivo,
    g.nombre as nombre_grupo
FROM sem_mediciones m
JOIN sem_dispositivos d ON m.shelly_id = d.shelly_id
JOIN sem_grupos g ON d.grupo_id = g.id
WHERE m.timestamp_utc >= DATE_SUB(NOW(), INTERVAL 7 DAY);

-- 2. Calidad de Datos
-- =============================================

-- Tabla de scoring y anomalías
CREATE TABLE sem_scoring_mediciones (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    shelly_id VARCHAR(12) NOT NULL,
    timestamp_utc TIMESTAMP(6) NOT NULL,
    score DECIMAL(5,2),
    es_anomalia BOOLEAN DEFAULT FALSE,
    tipo_anomalia VARCHAR(50),
    datos_anomalia JSON,
    fecha_deteccion TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP(6),
    FOREIGN KEY (shelly_id) REFERENCES sem_dispositivos(shelly_id),
    INDEX idx_scoring_fecha (timestamp_utc),
    INDEX idx_scoring_dispositivo (shelly_id)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Función para calcular score
DELIMITER //

CREATE FUNCTION fn_calcular_score_medicion(
    p_valor DECIMAL(18,6),
    p_promedio DECIMAL(18,6),
    p_desviacion DECIMAL(18,6)
)
RETURNS DECIMAL(5,2)
DETERMINISTIC
BEGIN
    DECLARE v_score DECIMAL(5,2);
    DECLARE v_z_score DECIMAL(18,6);
    
    IF p_desviacion = 0 OR p_desviacion IS NULL THEN
        RETURN 100;
    END IF;
    
    SET v_z_score = ABS((p_valor - p_promedio) / p_desviacion);
    SET v_score = 100 - (v_z_score * 10);
    
    RETURN GREATEST(0, LEAST(100, v_score));
END //

-- 3. Gestión Datos y Mantenimiento
-- =============================================

-- Tabla para control de archivado
CREATE TABLE sem_control_archivado (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    periodo_inicio TIMESTAMP NOT NULL,
    periodo_fin TIMESTAMP NOT NULL,
    tabla_origen VARCHAR(50) NOT NULL,
    tabla_destino VARCHAR(50) NOT NULL,
    registros_procesados INT DEFAULT 0,
    estado ENUM('PENDIENTE', 'EN_PROCESO', 'COMPLETADO', 'ERROR') NOT NULL,
    mensaje_error TEXT,
    fecha_inicio TIMESTAMP NULL,
    fecha_fin TIMESTAMP NULL,
    INDEX idx_archivado_periodo (periodo_inicio, periodo_fin),
    INDEX idx_archivado_estado (estado)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Procedimiento de archivado
DELIMITER //

CREATE PROCEDURE sp_archivar_datos_historicos(
    IN p_dias_antiguedad INT,
    IN p_batch_size INT
)
proc_label:BEGIN
    DECLARE v_fecha_limite TIMESTAMP;
    DECLARE v_tabla_destino VARCHAR(100);
    DECLARE v_error BOOLEAN DEFAULT FALSE;
    DECLARE v_control_id BIGINT;
    DECLARE v_registros_insertados INT DEFAULT 0;
    
    DECLARE CONTINUE HANDLER FOR SQLEXCEPTION
    BEGIN
        SET v_error = TRUE;
    END;
    
    SET v_fecha_limite = DATE_SUB(CURRENT_TIMESTAMP, INTERVAL p_dias_antiguedad DAY);
    SET v_tabla_destino = CONCAT('sem_historico_', DATE_FORMAT(v_fecha_limite, '%Y%m'));
    
    -- Registrar inicio del proceso
    INSERT INTO sem_control_archivado (
        periodo_inicio,
        periodo_fin,
        tabla_origen,
        tabla_destino,
        estado,
        fecha_inicio
    ) VALUES (
        v_fecha_limite,
        CURRENT_TIMESTAMP,
        'sem_mediciones',
        v_tabla_destino,
        'EN_PROCESO',
        CURRENT_TIMESTAMP
    );
    
    SET v_control_id = LAST_INSERT_ID();
    
    -- Crear tabla histórica si no existe
    SET @create_sql = CONCAT(
        'CREATE TABLE IF NOT EXISTS ', v_tabla_destino, ' LIKE sem_mediciones'
    );
    PREPARE create_stmt FROM @create_sql;
    EXECUTE create_stmt;
    DEALLOCATE PREPARE create_stmt;
    
    START TRANSACTION;
    
    -- Establecer variables para los parámetros
    SET @fecha_limite = v_fecha_limite;
    SET @batch_size = p_batch_size;
    
    -- Mover datos por lotes
    SET @insert_sql = CONCAT(
        'INSERT INTO ', v_tabla_destino, 
        ' SELECT * FROM sem_mediciones',
        ' WHERE timestamp_utc < @fecha_limite LIMIT @batch_size'
    );
    
    PREPARE insert_stmt FROM @insert_sql;
    EXECUTE insert_stmt;
    SET v_registros_insertados = ROW_COUNT();
    DEALLOCATE PREPARE insert_stmt;
    
    -- Eliminar datos originales
    SET @delete_sql = CONCAT(
        'DELETE FROM sem_mediciones WHERE timestamp_utc < @fecha_limite LIMIT @batch_size'
    );
    
    PREPARE delete_stmt FROM @delete_sql;
    EXECUTE delete_stmt;
    DEALLOCATE PREPARE delete_stmt;
    
    IF v_error THEN
        ROLLBACK;
        
        UPDATE sem_control_archivado
        SET estado = 'ERROR',
            mensaje_error = 'Error durante el proceso de archivado',
            fecha_fin = CURRENT_TIMESTAMP
        WHERE id = v_control_id;
        
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Error en el proceso de archivado';
    END IF;
    
    COMMIT;
    
    -- Actualizar control de archivado
    UPDATE sem_control_archivado
    SET estado = 'COMPLETADO',
        registros_procesados = v_registros_insertados,
        fecha_fin = CURRENT_TIMESTAMP
    WHERE id = v_control_id;
END //




-- 4. Auditoría Avanzada
-- =============================================

-- Tabla para auditoría detallada
CREATE TABLE sem_auditoria_detallada (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tipo_operacion ENUM('INSERT', 'UPDATE', 'DELETE') NOT NULL,
    tabla_afectada VARCHAR(100) NOT NULL,
    registro_id VARCHAR(100) NOT NULL,
    usuario VARCHAR(100),
    datos_anteriores JSON,
    datos_nuevos JSON,
    fecha_operacion TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP(6),
    direccion_ip VARCHAR(45),
    aplicacion VARCHAR(100),
    INDEX idx_auditoria_fecha (fecha_operacion),
    INDEX idx_auditoria_tabla (tabla_afectada),
    INDEX idx_auditoria_tipo (tipo_operacion)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Trigger de auditoría para cambios en dispositivos
DELIMITER //

CREATE TRIGGER trg_auditoria_dispositivos
AFTER INSERT ON sem_dispositivos
FOR EACH ROW
BEGIN
    INSERT INTO sem_auditoria_detallada (
        tipo_operacion,
        tabla_afectada,
        registro_id,
        datos_nuevos
    )
    VALUES (
        'INSERT',
        'sem_dispositivos',
        NEW.shelly_id,
        JSON_OBJECT(
            'shelly_id', NEW.shelly_id,
            'grupo_id', NEW.grupo_id,
            'nombre', NEW.nombre,
            'activo', NEW.activo
        )
    );
END //

-- 5. Mantenimiento Automático
-- =============================================

-- Evento para limpieza periódica
CREATE EVENT evt_limpieza_periodica
ON SCHEDULE EVERY 1 DAY
STARTS CURRENT_TIMESTAMP + INTERVAL 1 DAY
DO
BEGIN
    -- Limpiar alertas antiguas resueltas
    DELETE FROM sem_registro_alertas
    WHERE estado = 'RESUELTA'
    AND fecha_deteccion < DATE_SUB(NOW(), INTERVAL 6 MONTH);
    
    -- Limpiar auditoría antigua no crítica
    DELETE FROM sem_registro_auditoria
    WHERE fecha_creacion < DATE_SUB(NOW(), INTERVAL 6 MONTH)
    AND tipo_evento_id NOT IN (
        SELECT id FROM sem_tipos_eventos 
        WHERE severidad IN ('ERROR', 'CRITICO')
    );
    
    -- Archivar mediciones antiguas
    CALL sp_archivar_datos_historicos(90, 10000);
END //

-- 6. Monitoreo y Verificación
-- =============================================

-- Procedimiento para verificación de integridad
CREATE PROCEDURE sp_verificar_integridad()
BEGIN
    DECLARE v_error_count INT DEFAULT 0;
    
    -- Verificar referencias huérfanas
    SELECT COUNT(*) INTO v_error_count
    FROM sem_mediciones m
    LEFT JOIN sem_dispositivos d ON m.shelly_id = d.shelly_id
    WHERE d.shelly_id IS NULL;
    
    IF v_error_count > 0 THEN
        INSERT INTO sem_registro_alertas (
            tipo_alerta_id,
            mensaje,
            valor_detectado
        )
        VALUES (
            (SELECT id FROM sem_tipos_alertas WHERE nombre = 'ERROR_INTEGRIDAD'),
            'Se detectaron referencias huérfanas en mediciones',
            v_error_count
        );
    END IF;
    
    -- Verificar inconsistencias en promedios
    SELECT COUNT(*) INTO v_error_count
    FROM sem_promedios_hora ph
    WHERE ph.lecturas_recibidas > ph.lecturas_esperadas
    OR ph.calidad_datos > 100
    OR ph.calidad_datos < 0;
    
    IF v_error_count > 0 THEN
        INSERT INTO sem_registro_alertas (
            tipo_alerta_id,
            mensaje,
            valor_detectado
        )
        VALUES (
            (SELECT id FROM sem_tipos_alertas WHERE nombre = 'ERROR_INTEGRIDAD'),
            'Se detectaron inconsistencias en promedios horarios',
            v_error_count
        );
    END IF;
END //

-- 7. Optimización de índices
-- =============================================

-- Procedimiento para análisis de índices
CREATE PROCEDURE sp_analizar_indices()
BEGIN
    -- Actualizar estadísticas
    ANALYZE TABLE sem_mediciones, sem_promedios_hora, sem_totales_hora;
    
    -- Registrar tablas fragmentadas
    INSERT INTO sem_registro_auditoria (
        tipo_evento_id,
        descripcion,
        detalles
    )
    SELECT 
        (SELECT id FROM sem_tipos_eventos WHERE nombre = 'MANTENIMIENTO'),
        'Análisis de fragmentación de índices',
        JSON_OBJECT(
            'tabla', t.TABLE_NAME,
            'tamano_datos', t.DATA_LENGTH,
            'tamano_indice', t.INDEX_LENGTH
        )
    FROM information_schema.TABLES t
    WHERE t.TABLE_SCHEMA = DATABASE()
    AND t.TABLE_NAME LIKE 'sem_%';
END //

DELIMITER ;

-- 8. Datos iniciales para monitoreo
-- =============================================

-- Insertar tipos de alertas para monitoreo
INSERT INTO sem_tipos_alertas 
(nombre, descripcion, nivel_severidad, requiere_accion)
VALUES 
('ERROR_INTEGRIDAD', 'Error de integridad en datos', 'ALTA', TRUE),
('ERROR_ARCHIVADO', 'Error en proceso de archivado', 'ALTA', TRUE),
('FRAGMENTACION_ALTA', 'Alta fragmentación detectada', 'MEDIA', FALSE),
('ERROR_INCONSISTENCIA', 'Inconsistencia en datos agregados', 'ALTA', TRUE);

-- Configurar umbrales para monitoreo
INSERT INTO sem_umbrales_alertas 
(tipo_alerta_id, umbral_minimo, umbral_maximo, porcentaje_variacion)
SELECT 
    id,
    CASE 
        WHEN nombre = 'ERROR_INTEGRIDAD' THEN 0
        WHEN nombre = 'FRAGMENTACION_ALTA' THEN 30
        ELSE NULL 
    END,
    CASE 
        WHEN nombre = 'ERROR_INTEGRIDAD' THEN 0
        WHEN nombre = 'FRAGMENTACION_ALTA' THEN 100
        ELSE NULL
    END,
    CASE 
        WHEN nombre = 'ERROR_INCONSISTENCIA' THEN 5.0
        ELSE NULL
    END
FROM sem_tipos_alertas
WHERE nombre IN ('ERROR_INTEGRIDAD', 'FRAGMENTACION_ALTA', 'ERROR_INCONSISTENCIA');