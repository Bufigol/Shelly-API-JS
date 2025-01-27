-- --------------------------------------------------------
-- Script de Inserción Inicial Actualizado para Base de Datos SEM
-- --------------------------------------------------------

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "-03:00";

-- --------------------------------------------------------
-- Inserción de Grupos Básicos (con manejo de duplicados)
-- --------------------------------------------------------
INSERT INTO sem_grupos (id, nombre, descripcion, activo) 
VALUES (1, 'General', 'Grupo general por defecto', TRUE)
ON DUPLICATE KEY UPDATE
    descripcion = VALUES(descripcion),
    activo = VALUES(activo);

-- --------------------------------------------------------
-- Inserción de Tipos de Parámetros del Sistema
-- --------------------------------------------------------
INSERT INTO sem_tipos_parametros (nombre, descripcion, tipo_dato, reglas_validacion) 
VALUES
('INTERVALO_RECOLECCION', 'Intervalo de recolección de datos en segundos', 'ENTERO', '{"min": 1, "max": 3600}'),
('PRECIO_KWH', 'Precio del kWh en la moneda local', 'DECIMAL', '{"min": 0, "decimales": 2}'),
('ZONA_HORARIA', 'Zona horaria por defecto', 'TEXTO', '{"patron": "^America/[A-Za-z_]+$"}'),
('UMBRAL_CALIDAD', 'Umbral de calidad de datos', 'DECIMAL', '{"min": 0, "max": 1, "decimales": 2}'),
('DIAS_RETENCION', 'Días de retención para datos detallados', 'ENTERO', '{"min": 1}'),
('VOLTAJE_NOMINAL', 'Voltaje nominal del sistema', 'ENTERO', '{"min": 100, "max": 400}'),
('MAX_DESVIACION_VOLTAJE', 'Máxima desviación permitida del voltaje nominal', 'DECIMAL', '{"min": 1, "max": 20}'),
('FACTOR_POTENCIA_MIN', 'Factor de potencia mínimo aceptable', 'DECIMAL', '{"min": 0.1, "max": 1.0}'),
('CONFIG_ALERTAS', 'Configuración de alertas', 'JSON', '{"requeridos": ["habilitado", "umbrales"]}')
ON DUPLICATE KEY UPDATE
    descripcion = VALUES(descripcion),
    tipo_dato = VALUES(tipo_dato),
    reglas_validacion = VALUES(reglas_validacion);

-- --------------------------------------------------------
-- Configuración Inicial del Sistema
-- --------------------------------------------------------
INSERT INTO sem_configuracion (tipo_parametro_id, valor, activo, valido_desde) 
SELECT 
    tp.id,
    CASE 
        WHEN tp.nombre = 'INTERVALO_RECOLECCION' THEN '10'
        WHEN tp.nombre = 'PRECIO_KWH' THEN '151.85'
        WHEN tp.nombre = 'ZONA_HORARIA' THEN 'America/Santiago'
        WHEN tp.nombre = 'UMBRAL_CALIDAD' THEN '0.8'
        WHEN tp.nombre = 'DIAS_RETENCION' THEN '90'
        WHEN tp.nombre = 'VOLTAJE_NOMINAL' THEN '220'
        WHEN tp.nombre = 'MAX_DESVIACION_VOLTAJE' THEN '10'
        WHEN tp.nombre = 'FACTOR_POTENCIA_MIN' THEN '0.93'
        WHEN tp.nombre = 'CONFIG_ALERTAS' THEN '{"habilitado": true, "umbrales": {"voltaje": 10, "corriente": 20}}'
    END,
    TRUE,
    CURRENT_TIMESTAMP
FROM sem_tipos_parametros tp
WHERE NOT EXISTS (
    SELECT 1 
    FROM sem_configuracion sc 
    WHERE sc.tipo_parametro_id = tp.id 
    AND sc.activo = TRUE
);

-- --------------------------------------------------------
-- Insertar dispositivo Shelly por defecto
-- --------------------------------------------------------
INSERT INTO sem_dispositivos (
    shelly_id,
    grupo_id,
    nombre,
    descripcion,
    ubicacion,
    direccion_mac,
    zona_horaria,
    fecha_instalacion,
    activo
) VALUES (
    'fce8c0d82d08',
    1,
    'Shelly Pro 3EM',
    'Medidor de energía trifásico',
    'Principal',
    'FC:E8:C0:D8:2D:08',
    'America/Santiago',
    CURRENT_TIMESTAMP,
    true
) ON DUPLICATE KEY UPDATE
    grupo_id = VALUES(grupo_id),
    nombre = VALUES(nombre),
    descripcion = VALUES(descripcion),
    ubicacion = VALUES(ubicacion),
    zona_horaria = VALUES(zona_horaria),
    activo = VALUES(activo),
    fecha_actualizacion = CURRENT_TIMESTAMP;

-- --------------------------------------------------------
-- Registro de Control de Calidad Inicial
-- --------------------------------------------------------
INSERT INTO sem_control_calidad (
    shelly_id,
    inicio_periodo,
    fin_periodo,
    lecturas_esperadas,
    lecturas_recibidas,
    lecturas_validas,
    lecturas_alertas,
    lecturas_error,
    lecturas_interpoladas,
    porcentaje_calidad,
    estado_validacion
)
SELECT
    d.shelly_id,
    CURRENT_TIMESTAMP,
    DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 1 HOUR),
    360, -- Para intervalos de 10 segundos
    0,
    0,
    0,
    0,
    0,
    0.00,
    'PENDIENTE'
FROM sem_dispositivos d
WHERE NOT EXISTS (
    SELECT 1 
    FROM sem_control_calidad cc 
    WHERE cc.shelly_id = d.shelly_id 
    AND cc.inicio_periodo > DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 1 HOUR)
);

COMMIT;