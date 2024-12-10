-- --------------------------------------------------------
-- Sistema de Energía y Medición (SEM)
-- Fase 4 - Sistema de Alertas y Mantenimiento
-- --------------------------------------------------------

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "+00:00";

-- --------------------------------------------------------
-- TABLAS DE ALERTAS Y NOTIFICACIONES
-- --------------------------------------------------------

-- Tipos de Alertas
CREATE TABLE sem_tipos_alertas (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(50) NOT NULL UNIQUE,
    descripcion TEXT,
    nivel_severidad ENUM('BAJA', 'MEDIA', 'ALTA', 'CRITICA') NOT NULL,
    requiere_accion BOOLEAN NOT NULL DEFAULT FALSE,
    fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
COMMENT 'Catálogo de tipos de alertas del sistema';

-- Configuración de Umbrales para Alertas
CREATE TABLE sem_umbrales_alertas (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tipo_alerta_id INT NOT NULL,
    shelly_id VARCHAR(12) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT 'ID único del dispositivo Shelly',
    grupo_id INT,
    -- Umbrales específicos
    umbral_minimo DECIMAL(10,2),
    umbral_maximo DECIMAL(10,2),
    porcentaje_variacion DECIMAL(5,2),
    tiempo_validacion INT COMMENT 'Tiempo en minutos para validar la condición',
    -- Control
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tipo_alerta_id) REFERENCES sem_tipos_alertas(id),
    FOREIGN KEY (shelly_id) REFERENCES sem_dispositivos(shelly_id),
    FOREIGN KEY (grupo_id) REFERENCES sem_grupos(id),
    CONSTRAINT chk_target_scope CHECK (
        (shelly_id IS NOT NULL AND grupo_id IS NULL) OR
        (shelly_id IS NULL AND grupo_id IS NOT NULL) OR
        (shelly_id IS NULL AND grupo_id IS NULL)
    )
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
COMMENT 'Configuración de umbrales para la generación de alertas';

-- Registro de Alertas
CREATE TABLE sem_registro_alertas (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tipo_alerta_id INT NOT NULL,
    shelly_id VARCHAR(12) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT 'ID único del dispositivo Shelly',
    grupo_id INT,
    valor_detectado DECIMAL(10,2),
    mensaje TEXT NOT NULL,
    estado ENUM('ACTIVA', 'RECONOCIDA', 'RESUELTA', 'FALSA_ALARMA') NOT NULL DEFAULT 'ACTIVA',
    fecha_deteccion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_reconocimiento TIMESTAMP NULL,
    fecha_resolucion TIMESTAMP NULL,
    usuario_reconocimiento VARCHAR(50),
    usuario_resolucion VARCHAR(50),
    notas_resolucion TEXT,
    FOREIGN KEY (tipo_alerta_id) REFERENCES sem_tipos_alertas(id),
    FOREIGN KEY (shelly_id) REFERENCES sem_dispositivos(shelly_id),
    FOREIGN KEY (grupo_id) REFERENCES sem_grupos(id),
    INDEX idx_estado_fecha (estado, fecha_deteccion)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
COMMENT 'Registro histórico de alertas generadas';

-- --------------------------------------------------------
-- PROCEDIMIENTOS DE DETECCIÓN DE ALERTAS
-- --------------------------------------------------------

DELIMITER //

-- Procedimiento para detectar anomalías en voltaje
CREATE PROCEDURE sem_detectar_anomalias_voltaje()
proc_label:BEGIN
    DECLARE v_execution_id BIGINT;
    DECLARE v_error BOOLEAN DEFAULT FALSE;
    DECLARE v_tipo_evento_id INT;
    DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET v_error = TRUE;
    
    -- Obtener el ID del tipo de evento
    SELECT id INTO v_tipo_evento_id
    FROM sem_tipos_eventos
    WHERE nombre = 'DETECCION_ANOMALIAS'
    LIMIT 1;
    
    -- Registrar inicio de ejecución
    INSERT INTO sem_registro_auditoria (
        tipo_evento_id,
        descripcion,
        detalles
    ) VALUES (
        v_tipo_evento_id,
        'Inicio detección de anomalías de voltaje',
        JSON_OBJECT(
            'fecha_inicio', CURRENT_TIMESTAMP
        )
    );
    
    SET v_execution_id = LAST_INSERT_ID();

    -- Detectar voltajes fuera de rango
    INSERT INTO sem_registro_alertas (
        tipo_alerta_id,
        shelly_id,
        valor_detectado,
        mensaje
    )
    SELECT 
        ta.id,
        ph.shelly_id,
        GREATEST(
            ph.fase_a_voltaje_promedio,
            ph.fase_b_voltaje_promedio,
            ph.fase_c_voltaje_promedio
        ) as voltaje_maximo,
        CONCAT(
            'Voltaje anormal detectado. ',
            'Fase A: ', COALESCE(ph.fase_a_voltaje_promedio, 'N/A'), 'V, ',
            'Fase B: ', COALESCE(ph.fase_b_voltaje_promedio, 'N/A'), 'V, ',
            'Fase C: ', COALESCE(ph.fase_c_voltaje_promedio, 'N/A'), 'V'
        )
    FROM sem_promedios_hora ph
    CROSS JOIN sem_tipos_alertas ta
    INNER JOIN sem_umbrales_alertas ua ON ua.tipo_alerta_id = ta.id
        AND (ua.shelly_id = ph.shelly_id OR ua.shelly_id IS NULL)
    WHERE ta.nombre = 'VOLTAJE_FUERA_RANGO'
    AND ph.hora_utc >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
    AND (
        ph.fase_a_voltaje_promedio > ua.umbral_maximo OR
        ph.fase_b_voltaje_promedio > ua.umbral_maximo OR
        ph.fase_c_voltaje_promedio > ua.umbral_maximo OR
        ph.fase_a_voltaje_promedio < ua.umbral_minimo OR
        ph.fase_b_voltaje_promedio < ua.umbral_minimo OR
        ph.fase_c_voltaje_promedio < ua.umbral_minimo
    )
    AND NOT EXISTS (
        SELECT 1
        FROM sem_registro_alertas ra
        WHERE ra.shelly_id = ph.shelly_id
        AND ra.tipo_alerta_id = ta.id
        AND ra.estado = 'ACTIVA'
    );

    -- Actualizar registro de ejecución
    UPDATE sem_registro_auditoria
    SET descripcion = CONCAT(descripcion, ' - Completado'),
        detalles = JSON_SET(
            detalles,
            '$.fecha_fin', CURRENT_TIMESTAMP,
            '$.alertas_generadas', ROW_COUNT()
        )
    WHERE id = v_execution_id;

    IF v_error THEN
        UPDATE sem_registro_auditoria
        SET descripcion = CONCAT(descripcion, ' - Error'),
            detalles = JSON_SET(
                detalles,
                '$.error', TRUE,
                '$.fecha_error', CURRENT_TIMESTAMP
            )
        WHERE id = v_execution_id;
    END IF;
END //

-- Procedimiento para detectar consumos anormales
CREATE PROCEDURE sem_detectar_consumos_anormales()
proc_label:BEGIN
    DECLARE v_execution_id BIGINT;
    DECLARE v_error BOOLEAN DEFAULT FALSE;
    DECLARE v_tipo_evento_id INT;
    DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET v_error = TRUE;
    
    -- Obtener el ID del tipo de evento
    SELECT id INTO v_tipo_evento_id
    FROM sem_tipos_eventos
    WHERE nombre = 'DETECCION_ANOMALIAS'
    LIMIT 1;
    
    -- Registrar inicio de ejecución
    INSERT INTO sem_registro_auditoria (
        tipo_evento_id,
        descripcion,
        detalles
    ) VALUES (
        v_tipo_evento_id,
        'Inicio detección de consumos anormales',
        JSON_OBJECT(
            'fecha_inicio', CURRENT_TIMESTAMP
        )
    );
    
    SET v_execution_id = LAST_INSERT_ID();

    -- Detectar consumos anormales basados en histórico
    INSERT INTO sem_registro_alertas (
        tipo_alerta_id,
        shelly_id,
        valor_detectado,
        mensaje
    )
    SELECT 
        ta.id,
        ph.shelly_id,
        ph.potencia_activa_promedio,
        CONCAT(
            'Consumo anormal detectado. ',
            'Potencia actual: ', ROUND(ph.potencia_activa_promedio, 2), 'W, ',
            'Promedio histórico: ', ROUND(avg_historico.potencia_promedio, 2), 'W, ',
            'Variación: ', ROUND(((ph.potencia_activa_promedio - avg_historico.potencia_promedio) / avg_historico.potencia_promedio * 100), 2), '%'
        )
    FROM sem_promedios_hora ph
    CROSS JOIN sem_tipos_alertas ta
    INNER JOIN sem_umbrales_alertas ua ON ua.tipo_alerta_id = ta.id
        AND (ua.shelly_id = ph.shelly_id OR ua.shelly_id IS NULL)
    INNER JOIN (
        SELECT 
            shelly_id,
            AVG(potencia_activa_promedio) as potencia_promedio
        FROM sem_promedios_hora
        WHERE hora_utc BETWEEN 
            DATE_SUB(NOW(), INTERVAL 7 DAY) AND
            DATE_SUB(NOW(), INTERVAL 1 HOUR)
        GROUP BY shelly_id
    ) avg_historico ON avg_historico.shelly_id = ph.shelly_id
    WHERE ta.nombre = 'CONSUMO_ANORMAL'
    AND ph.hora_utc >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
    AND ABS(
        (ph.potencia_activa_promedio - avg_historico.potencia_promedio) / 
        avg_historico.potencia_promedio * 100
    ) > ua.porcentaje_variacion
    AND NOT EXISTS (
        SELECT 1
        FROM sem_registro_alertas ra
        WHERE ra.shelly_id = ph.shelly_id
        AND ra.tipo_alerta_id = ta.id
        AND ra.estado = 'ACTIVA'
    );

    -- Actualizar registro de ejecución
    UPDATE sem_registro_auditoria
    SET descripcion = CONCAT(descripcion, ' - Completado'),
        detalles = JSON_SET(
            detalles,
            '$.fecha_fin', CURRENT_TIMESTAMP,
            '$.alertas_generadas', ROW_COUNT()
        )
    WHERE id = v_execution_id;

    IF v_error THEN
        UPDATE sem_registro_auditoria
        SET descripcion = CONCAT(descripcion, ' - Error'),
            detalles = JSON_SET(
                detalles,
                '$.error', TRUE,
                '$.fecha_error', CURRENT_TIMESTAMP
            )
        WHERE id = v_execution_id;
    END IF;
END //

-- --------------------------------------------------------
-- EVENTOS PROGRAMADOS
-- --------------------------------------------------------

-- Evento para detección de anomalías
CREATE EVENT sem_evento_deteccion_anomalias
ON SCHEDULE EVERY 5 MINUTE
DO
BEGIN
    CALL sem_detectar_anomalias_voltaje();
    CALL sem_detectar_consumos_anormales();
END //

-- Evento para mantenimiento diario
CREATE EVENT sem_evento_mantenimiento_diario
ON SCHEDULE EVERY 1 DAY
STARTS (TIMESTAMP(CURRENT_DATE) + INTERVAL 1 DAY + INTERVAL 2 HOUR)
DO
BEGIN
    -- Limpiar alertas antiguas resueltas
    UPDATE sem_registro_alertas
    SET estado = 'RESUELTA',
        fecha_resolucion = CURRENT_TIMESTAMP,
        notas_resolucion = 'Cerrada automáticamente por el sistema'
    WHERE estado = 'ACTIVA'
    AND fecha_deteccion < DATE_SUB(NOW(), INTERVAL 7 DAY);
    
    -- Validar integridad de datos
    CALL sem_validar_integridad_datos(DATE_SUB(CURRENT_DATE, INTERVAL 1 DAY));
END //

-- Evento para cálculos frecuentes (cada 5 minutos)
CREATE EVENT sem_evento_calculos_frecuentes
ON SCHEDULE EVERY 5 MINUTE
DO
BEGIN
    DECLARE v_fecha_inicio TIMESTAMP;
    DECLARE v_fecha_fin TIMESTAMP;
    DECLARE v_hora_actual TIMESTAMP;
    DECLARE v_inicio_dia DATE;
    DECLARE v_inicio_mes DATE;
    
    -- Configurar fechas
    SET v_hora_actual = NOW();
    SET v_fecha_inicio = DATE_SUB(v_hora_actual, INTERVAL 15 MINUTE);
    SET v_fecha_fin = v_hora_actual;
    SET v_inicio_dia = DATE(v_hora_actual);
    SET v_inicio_mes = DATE_FORMAT(v_hora_actual, '%Y-%m-01');
    
    -- Calcular promedios y totales de las últimas ventanas de tiempo
    CALL sem_calcular_promedios_hora(v_fecha_inicio, v_fecha_fin);
    CALL sem_calcular_totales_grupo_hora(v_fecha_inicio, v_fecha_fin);
    
    -- Si cambió la hora, calcular la hora anterior completa
    IF MINUTE(v_hora_actual) < 5 THEN
        SET v_fecha_inicio = DATE_SUB(DATE_FORMAT(v_hora_actual, '%Y-%m-%d %H:00:00'), INTERVAL 1 HOUR);
        SET v_fecha_fin = DATE_FORMAT(v_hora_actual, '%Y-%m-%d %H:00:00');
        
        CALL sem_calcular_promedios_hora(v_fecha_inicio, v_fecha_fin);
        CALL sem_calcular_totales_grupo_hora(v_fecha_inicio, v_fecha_fin);
    END IF;
    
    -- Si es un nuevo día (primeros 5 minutos), calcular totales del día anterior
    IF HOUR(v_hora_actual) = 0 AND MINUTE(v_hora_actual) < 5 THEN
        SET v_fecha_inicio = DATE_SUB(v_inicio_dia, INTERVAL 1 DAY);
        
        CALL sem_calcular_promedios_dia(v_fecha_inicio, v_fecha_inicio);
        CALL sem_calcular_totales_dia(v_fecha_inicio, v_fecha_inicio);
        CALL sem_calcular_totales_grupo_dia(v_fecha_inicio, v_fecha_inicio);
    END IF;
    
    -- Si es un nuevo mes (primeros 5 minutos del primer día), calcular totales del mes anterior
    IF DAY(v_hora_actual) = 1 AND HOUR(v_hora_actual) = 0 AND MINUTE(v_hora_actual) < 5 THEN
        SET v_fecha_inicio = DATE_FORMAT(DATE_SUB(v_inicio_mes, INTERVAL 1 MONTH), '%Y-%m-01');
        SET v_fecha_fin = LAST_DAY(v_fecha_inicio);
        
        CALL sem_calcular_promedios_mes(v_fecha_inicio, v_fecha_fin);
        CALL sem_calcular_totales_mes(v_fecha_inicio, v_fecha_fin);
    END IF;
END //

-- Eliminar eventos anteriores que ya no son necesarios
DROP EVENT IF EXISTS sem_evento_calculos_horarios //
DROP EVENT IF EXISTS sem_evento_calculos_diarios //
DROP EVENT IF EXISTS sem_evento_calculos_mensuales //

-- Evento para validación de datos
CREATE EVENT sem_evento_validacion_datos
ON SCHEDULE EVERY 6 HOUR
DO
BEGIN
    -- Validar datos recientes
    CALL sem_validar_datos_recientes();
    
    -- Validar integridad de agregaciones
    CALL sem_validar_integridad_agregaciones(
        DATE_SUB(CURRENT_DATE, INTERVAL 1 DAY),
        CURRENT_DATE
    );
    
    -- Validar consistencia entre totales y promedios
    CALL sem_validar_consistencia_totales(
        DATE_SUB(CURRENT_DATE, INTERVAL 1 DAY),
        CURRENT_DATE
    );
END //

-- Evento para limpieza y mantenimiento semanal
CREATE EVENT sem_evento_mantenimiento_semanal
ON SCHEDULE EVERY 1 WEEK
STARTS (TIMESTAMP(DATE_ADD(DATE(DATE_FORMAT(NOW(), '%Y-%m-%d')), INTERVAL 7 - WEEKDAY(NOW()) DAY)) + INTERVAL 3 HOUR)
DO
BEGIN
    -- Limpiar registros de auditoría antiguos
    DELETE FROM sem_registro_auditoria 
    WHERE fecha_creacion < DATE_SUB(NOW(), INTERVAL 6 MONTH)
    AND tipo_evento_id NOT IN (
        SELECT id FROM sem_tipos_eventos 
        WHERE nombre IN ('ERROR_CRITICO', 'ALERTA_SEGURIDAD')
    );
    
    -- Limpiar alertas antiguas resueltas
    DELETE FROM sem_registro_alertas
    WHERE estado IN ('RESUELTA', 'FALSA_ALARMA')
    AND fecha_deteccion < DATE_SUB(NOW(), INTERVAL 6 MONTH);
    
    -- Optimizar tablas
    OPTIMIZE TABLE sem_promedios_hora, sem_promedios_dia, sem_promedios_mes,
                 sem_totales_dia, sem_grupo_totales,
                 sem_registro_alertas, sem_registro_auditoria;
END //

-- Evento para verificación de salud del sistema
CREATE EVENT sem_evento_verificacion_salud
ON SCHEDULE EVERY 15 MINUTE
DO
BEGIN
    -- Verificar dispositivos sin reportar
    INSERT INTO sem_registro_alertas (
        tipo_alerta_id,
        shelly_id,
        mensaje
    )
    SELECT 
        ta.id,
        d.shelly_id,
        CONCAT('Dispositivo sin reportar por más de ', 
               ua.tiempo_validacion, ' minutos. ',
               'Última lectura: ', 
               COALESCE(MAX(ph.hora_utc), 'Nunca'))
    FROM sem_dispositivos d
    CROSS JOIN sem_tipos_alertas ta
    INNER JOIN sem_umbrales_alertas ua 
        ON ua.tipo_alerta_id = ta.id
        AND (ua.shelly_id = d.shelly_id OR ua.shelly_id IS NULL)
    LEFT JOIN sem_promedios_hora ph 
        ON ph.shelly_id = d.shelly_id
        AND ph.hora_utc >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
    WHERE ta.nombre = 'DISPOSITIVO_OFFLINE'
    AND d.activo = TRUE
    GROUP BY d.shelly_id
    HAVING MAX(ph.hora_utc) IS NULL 
        OR MAX(ph.hora_utc) < DATE_SUB(NOW(), INTERVAL ua.tiempo_validacion MINUTE)
    AND NOT EXISTS (
        SELECT 1
        FROM sem_registro_alertas ra
        WHERE ra.shelly_id = d.shelly_id
        AND ra.tipo_alerta_id = ta.id
        AND ra.estado = 'ACTIVA'
    );
    
    -- Verificar calidad de datos
    INSERT INTO sem_registro_alertas (
        tipo_alerta_id,
        shelly_id,
        valor_detectado,
        mensaje
    )
    SELECT 
        ta.id,
        ph.shelly_id,
        ph.calidad_datos,
        CONCAT('Baja calidad de datos detectada. ',
               'Calidad: ', ROUND(ph.calidad_datos, 2), '%. ',
               'Lecturas válidas: ', ph.lecturas_validas, '/',
               ph.lecturas_esperadas)
    FROM sem_promedios_hora ph
    CROSS JOIN sem_tipos_alertas ta
    WHERE ta.nombre = 'CALIDAD_DATOS_BAJA'
    AND ph.hora_utc >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
    AND ph.calidad_datos < 90
    AND NOT EXISTS (
        SELECT 1
        FROM sem_registro_alertas ra
        WHERE ra.shelly_id = ph.shelly_id
        AND ra.tipo_alerta_id = ta.id
        AND ra.estado = 'ACTIVA'
    );
END //

DELIMITER ;




