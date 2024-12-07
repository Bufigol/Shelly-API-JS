-- --------------------------------------------------------
-- Sistema de Energía y Medición (SEM)
-- Script de creación de base de datos - Fase 1
-- 
-- Notas importantes:
-- 1. La clave de autenticación para la API se maneja externamente
-- 2. En la Fase 4 se implementará un procedimiento para gestión de particiones
-- --------------------------------------------------------

-- Configuración inicial de la base de datos
SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";
SET FOREIGN_KEY_CHECKS = 0;

-- --------------------------------------------------------
-- Tabla: Tipos de Parámetros del Sistema
-- Descripción: Almacena los diferentes tipos de parámetros de configuración
-- --------------------------------------------------------
CREATE TABLE sem_tipos_parametros (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(50) NOT NULL,
    descripcion TEXT,
    tipo_dato ENUM('ENTERO', 'DECIMAL', 'TEXTO', 'BOOLEANO', 'JSON') NOT NULL,
    reglas_validacion JSON,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE INDEX idx_tipo_parametro_nombre (nombre)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
COMMENT 'Catálogo de tipos de parámetros del sistema';

-- --------------------------------------------------------
-- Tabla: Configuración del Sistema
-- Descripción: Almacena los valores de configuración y su historial
-- --------------------------------------------------------
CREATE TABLE sem_configuracion (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tipo_parametro_id INT NOT NULL,
    valor TEXT NOT NULL,
    activo BOOLEAN DEFAULT TRUE,
    valido_desde TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    valido_hasta TIMESTAMP NULL,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tipo_parametro_id) REFERENCES sem_tipos_parametros(id),
    CHECK (valido_hasta IS NULL OR valido_hasta > valido_desde)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Tabla: Grupos de Dispositivos
-- Descripción: Categorización simple de dispositivos
-- --------------------------------------------------------
CREATE TABLE sem_grupos (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    activo BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE INDEX idx_grupo_nombre (nombre)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
COMMENT 'Grupos para categorización de dispositivos Shelly Pro 3 EM';

-- --------------------------------------------------------
-- Tabla: Dispositivos
-- Descripción: Registro de dispositivos Shelly Pro 3 EM instalados
-- --------------------------------------------------------
CREATE TABLE sem_dispositivos (
    shelly_id VARCHAR(12) PRIMARY KEY COMMENT 'ID único del dispositivo Shelly',
    grupo_id INT NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    ubicacion TEXT NOT NULL,
    direccion_mac VARCHAR(17) NOT NULL,
    direccion_ip VARCHAR(45) NULL,
    zona_horaria VARCHAR(50) DEFAULT 'America/Santiago',
    fecha_instalacion TIMESTAMP NOT NULL,
    activo BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (grupo_id) REFERENCES sem_grupos(id),
    UNIQUE INDEX idx_dispositivo_mac (direccion_mac),
    INDEX idx_dispositivo_grupo (grupo_id),
    INDEX idx_dispositivo_activo (activo)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
COMMENT 'Registro de dispositivos Shelly Pro 3 EM';

-- --------------------------------------------------------
-- Tabla: Tipos de Eventos
-- Descripción: Catálogo de eventos del sistema
-- --------------------------------------------------------
CREATE TABLE sem_tipos_eventos (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(50) NOT NULL,
    categoria ENUM('SISTEMA', 'CONFIGURACION', 'DISPOSITIVO', 'GRUPO', 'DATOS', 'SEGURIDAD', 'ERROR') NOT NULL,
    descripcion TEXT,
    severidad ENUM('INFORMACION', 'ADVERTENCIA', 'ERROR', 'CRITICO') NOT NULL,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE INDEX idx_tipo_evento_nombre (nombre)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
COMMENT 'Catálogo de tipos de eventos del sistema';

-- --------------------------------------------------------
-- Tabla: Registro de Auditoría
-- Descripción: Log de eventos y cambios del sistema
-- --------------------------------------------------------
CREATE TABLE sem_registro_auditoria (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tipo_evento_id INT NOT NULL,
    shelly_id VARCHAR(12) NULL,
    grupo_id INT NULL,
    usuario_id VARCHAR(100) NULL,
    fecha_evento TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    descripcion TEXT NOT NULL,
    detalles JSON,
    direccion_ip VARCHAR(45) NULL,
    fecha_creacion TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP(6),
    FOREIGN KEY (tipo_evento_id) REFERENCES sem_tipos_eventos(id),
    FOREIGN KEY (shelly_id) REFERENCES sem_dispositivos(shelly_id),
    FOREIGN KEY (grupo_id) REFERENCES sem_grupos(id),
    INDEX idx_auditoria_timestamp (fecha_evento),
    INDEX idx_auditoria_tipo_evento (tipo_evento_id),
    INDEX idx_auditoria_dispositivo (shelly_id),
    INDEX idx_auditoria_grupo (grupo_id)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Tabla: Historial de Cambios de Grupo
-- Descripción: Registro histórico de cambios de grupo de dispositivos
-- --------------------------------------------------------
CREATE TABLE sem_historial_grupo_dispositivo (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    shelly_id VARCHAR(12) NOT NULL,
    grupo_anterior_id INT NULL,
    grupo_nuevo_id INT NOT NULL,
    fecha_cambio TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    motivo TEXT,
    registro_auditoria_id BIGINT NOT NULL,
    fecha_creacion TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP(6),
    FOREIGN KEY (shelly_id) REFERENCES sem_dispositivos(shelly_id),
    FOREIGN KEY (grupo_anterior_id) REFERENCES sem_grupos(id),
    FOREIGN KEY (grupo_nuevo_id) REFERENCES sem_grupos(id),
    FOREIGN KEY (registro_auditoria_id) REFERENCES sem_registro_auditoria(id),
    INDEX idx_historial_dispositivo (shelly_id),
    INDEX idx_historial_fecha (fecha_cambio)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Inserción de datos iniciales: Tipos de eventos
-- --------------------------------------------------------
INSERT INTO sem_tipos_eventos (nombre, categoria, descripcion, severidad) VALUES
('INICIO_SISTEMA', 'SISTEMA', 'Sistema iniciado', 'INFORMACION'),
('DETENCION_SISTEMA', 'SISTEMA', 'Sistema detenido', 'INFORMACION'),
('CAMBIO_CONFIGURACION', 'CONFIGURACION', 'Cambio en configuración', 'INFORMACION'),
('ALTA_DISPOSITIVO', 'DISPOSITIVO', 'Dispositivo agregado', 'INFORMACION'),
('BAJA_DISPOSITIVO', 'DISPOSITIVO', 'Dispositivo eliminado', 'ADVERTENCIA'),
('ACTUALIZACION_DISPOSITIVO', 'DISPOSITIVO', 'Dispositivo actualizado', 'INFORMACION'),
('ALTA_GRUPO', 'GRUPO', 'Grupo agregado', 'INFORMACION'),
('BAJA_GRUPO', 'GRUPO', 'Grupo eliminado', 'ADVERTENCIA'),
('ACTUALIZACION_GRUPO', 'GRUPO', 'Grupo actualizado', 'INFORMACION'),
('ERROR_DATOS', 'ERROR', 'Error en datos', 'ERROR'),
('ERROR_SISTEMA', 'ERROR', 'Error de sistema', 'CRITICO'),
('ALERTA_SEGURIDAD', 'SEGURIDAD', 'Alerta de seguridad', 'ADVERTENCIA');

-- --------------------------------------------------------
-- Inserción de datos iniciales: Tipos de parámetros
-- --------------------------------------------------------
INSERT INTO sem_tipos_parametros (nombre, descripcion, tipo_dato, reglas_validacion) VALUES
('INTERVALO_RECOLECCION', 'Intervalo de recolección de datos en segundos', 'ENTERO', '{"min": 1, "max": 3600}'),
('PRECIO_KWH', 'Precio del kWh en la moneda local', 'DECIMAL', '{"min": 0, "decimales": 2}'),
('ZONA_HORARIA', 'Zona horaria por defecto', 'TEXTO', '{"patron": "^America/[A-Za-z_]+$"}'),
('UMBRAL_CALIDAD', 'Umbral de calidad de datos', 'DECIMAL', '{"min": 0, "max": 1, "decimales": 2}'),
('DIAS_RETENCION', 'Días de retención para datos detallados', 'ENTERO', '{"min": 1}'),
('CONFIG_ALERTAS', 'Configuración de alertas', 'JSON', '{"requeridos": ["habilitado", "umbrales"]}');

/*
NOTA: En la Fase 4 se implementará el siguiente procedimiento:
CREATE PROCEDURE sem_gestionar_particiones()
- Crear nuevas particiones futuras
- Archivar particiones antiguas
- Mantener estructura óptima de particiones
*/

SET FOREIGN_KEY_CHECKS = 1;
COMMIT;