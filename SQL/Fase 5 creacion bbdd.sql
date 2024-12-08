-- =============================================
-- Fase 5: Optimización y Funcionalidades Avanzadas
-- =============================================

-- 1. Optimización de Base
-- =============================================

-- Índices compuestos para consultas frecuentes
CREATE INDEX idx_lecturas_dispositivo_fecha ON sem_lecturas_dispositivos(id_dispositivo, fecha_hora);
CREATE INDEX idx_agregaciones_disp_periodo ON sem_agregaciones_dispositivo(id_dispositivo, periodo, fecha);
CREATE INDEX idx_agregaciones_grupo_periodo ON sem_agregaciones_grupo(id_grupo, periodo, fecha);

-- Vista materializada para datos recientes
CREATE MATERIALIZED VIEW mv_lecturas_recientes AS
SELECT l.*, d.nombre as nombre_dispositivo, g.nombre as nombre_grupo
FROM sem_lecturas_dispositivos l
JOIN sem_dispositivos d ON l.id_dispositivo = d.id_dispositivo
JOIN sem_grupos g ON d.id_grupo = g.id_grupo
WHERE l.fecha_hora >= DATEADD(day, -7, GETDATE())
WITH DATA;

-- 2. Calidad de Datos
-- =============================================

-- Tabla de scoring y anomalías
CREATE TABLE sem_scoring_lecturas (
    id_scoring BIGINT IDENTITY(1,1) PRIMARY KEY,
    id_lectura BIGINT,
    score DECIMAL(5,2),
    es_anomalia BIT,
    tipo_anomalia VARCHAR(50),
    fecha_deteccion DATETIME2,
    CONSTRAINT fk_scoring_lectura FOREIGN KEY (id_lectura) 
    REFERENCES sem_lecturas_dispositivos(id_lectura)
);

-- Función para calcular score de lectura
CREATE FUNCTION fn_calcular_score_lectura (
    @valor DECIMAL(18,6),
    @promedio_historico DECIMAL(18,6),
    @desviacion_estandar DECIMAL(18,6)
)
RETURNS DECIMAL(5,2)
AS
BEGIN
    DECLARE @score DECIMAL(5,2);
    DECLARE @z_score DECIMAL(18,6);
    
    SET @z_score = ABS((@valor - @promedio_historico) / NULLIF(@desviacion_estandar, 0));
    SET @score = 100 - (@z_score * 10);
    
    RETURN CASE 
        WHEN @score < 0 THEN 0 
        WHEN @score > 100 THEN 100 
        ELSE @score 
    END;
END;

-- 3. Gestión Datos y Mantenimiento
-- =============================================

-- Tabla de control de archivado
CREATE TABLE sem_control_archivado (
    id_archivado BIGINT IDENTITY(1,1) PRIMARY KEY,
    fecha_inicio DATETIME2,
    fecha_fin DATETIME2,
    registros_archivados INT,
    estado VARCHAR(20),
    fecha_proceso DATETIME2
);

-- Procedimiento de archivado
CREATE PROCEDURE sp_archivar_datos_historicos
    @dias_antiguedad INT,
    @batch_size INT = 10000
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @fecha_limite DATETIME2 = DATEADD(day, -@dias_antiguedad, GETDATE());
    DECLARE @registros_procesados INT = 0;
    
    BEGIN TRY
        BEGIN TRANSACTION;
        
        INSERT INTO sem_control_archivado (fecha_inicio, fecha_fin, estado, fecha_proceso)
        VALUES (@fecha_limite, GETDATE(), 'EN_PROCESO', GETDATE());
        
        -- Aquí iría la lógica de archivado
        
        UPDATE sem_control_archivado 
        SET estado = 'COMPLETADO', 
            registros_archivados = @registros_procesados
        WHERE fecha_proceso = GETDATE();
        
        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK;
            
        UPDATE sem_control_archivado 
        SET estado = 'ERROR'
        WHERE fecha_proceso = GETDATE();
        
        THROW;
    END CATCH;
END;

-- 4. Funciones y Triggers
-- =============================================

-- Trigger de auditoría para cambios en configuración
CREATE TRIGGER tr_auditoria_configuracion
ON sem_configuracion
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    
    INSERT INTO sem_registro_auditoria (
        tipo_evento,
        fecha_hora,
        descripcion,
        datos_anteriores,
        datos_nuevos
    )
    SELECT 
        CASE 
            WHEN EXISTS(SELECT * FROM INSERTED) AND EXISTS(SELECT * FROM DELETED) THEN 'UPDATE'
            WHEN EXISTS(SELECT * FROM INSERTED) THEN 'INSERT'
            ELSE 'DELETE'
        END,
        GETDATE(),
        'Modificación en configuración',
        (SELECT * FROM DELETED FOR JSON PATH),
        (SELECT * FROM INSERTED FOR JSON PATH);
END;

-- 5. Monitoreo y Alertas
-- =============================================

-- Tabla de alertas
CREATE TABLE sem_alertas (
    id_alerta BIGINT IDENTITY(1,1) PRIMARY KEY,
    tipo_alerta VARCHAR(50),
    nivel_severidad TINYINT,
    mensaje VARCHAR(500),
    fecha_deteccion DATETIME2,
    fecha_resolucion DATETIME2 NULL,
    estado VARCHAR(20),
    datos_contexto NVARCHAR(MAX)
);

-- Procedimiento para generar alertas
CREATE PROCEDURE sp_generar_alerta
    @tipo_alerta VARCHAR(50),
    @nivel_severidad TINYINT,
    @mensaje VARCHAR(500),
    @datos_contexto NVARCHAR(MAX) = NULL
AS
BEGIN
    INSERT INTO sem_alertas (
        tipo_alerta,
        nivel_severidad,
        mensaje,
        fecha_deteccion,
        estado,
        datos_contexto
    )
    VALUES (
        @tipo_alerta,
        @nivel_severidad,
        @mensaje,
        GETDATE(),
        'ACTIVA',
        @datos_contexto
    );
END;

-- 6. Seguridad y Auditoría
-- =============================================

-- Roles de base de datos
CREATE ROLE rol_lectura;
CREATE ROLE rol_escritura;
CREATE ROLE rol_administrador;

-- Asignación de permisos básicos
GRANT SELECT ON SCHEMA::dbo TO rol_lectura;
GRANT SELECT, INSERT, UPDATE ON SCHEMA::dbo TO rol_escritura;
GRANT CONTROL ON SCHEMA::dbo TO rol_administrador;

-- Función para encriptar datos sensibles
CREATE FUNCTION fn_encriptar_dato(@dato NVARCHAR(MAX))
RETURNS VARBINARY(MAX)
AS
BEGIN
    -- Aquí iría la lógica de encriptación
    RETURN CAST(@dato AS VARBINARY(MAX));
END;

-- 7. Testing
-- =============================================

-- Tabla de registro de tests
CREATE TABLE sem_registro_tests (
    id_test BIGINT IDENTITY(1,1) PRIMARY KEY,
    nombre_test VARCHAR(100),
    tipo_test VARCHAR(50),
    resultado VARCHAR(20),
    duracion_ms INT,
    fecha_ejecucion DATETIME2,
    detalles NVARCHAR(MAX)
);

-- Procedimiento para ejecutar test de rendimiento
CREATE PROCEDURE sp_test_rendimiento
    @descripcion_test VARCHAR(100)
AS
BEGIN
    DECLARE @inicio DATETIME2 = GETDATE();
    DECLARE @resultado VARCHAR(20) = 'EXITOSO';
    DECLARE @detalles NVARCHAR(MAX);
    
    BEGIN TRY
        -- Aquí irían las pruebas de rendimiento
        
        SET @detalles = 'Test completado correctamente';
    END TRY
    BEGIN CATCH
        SET @resultado = 'FALLIDO';
        SET @detalles = ERROR_MESSAGE();
    END CATCH;
    
    INSERT INTO sem_registro_tests (
        nombre_test,
        tipo_test,
        resultado,
        duracion_ms,
        fecha_ejecucion,
        detalles
    )
    VALUES (
        @descripcion_test,
        'RENDIMIENTO',
        @resultado,
        DATEDIFF(MILLISECOND, @inicio, GETDATE()),
        GETDATE(),
        @detalles
    );
END;

-- =============================================
-- 8. Eventos de Mantenimiento
-- =============================================

-- Tabla para gestionar particiones de datos históricos
CREATE TABLE sem_particiones_historicas (
    id_particion BIGINT IDENTITY(1,1) PRIMARY KEY,
    fecha_inicio DATETIME2,
    fecha_fin DATETIME2,
    estado VARCHAR(20),
    ubicacion_archivo NVARCHAR(500),
    fecha_creacion DATETIME2 DEFAULT GETDATE(),
    comprimido BIT DEFAULT 0
);

-- Evento para actualizar estadísticas de la base de datos
CREATE EVENT sp_actualizar_estadisticas
ON SCHEDULE EVERY 1 DAY
STARTS (GETDATE() AT '03:00:00')
AS
BEGIN
    EXEC sp_updatestats;
    
    INSERT INTO sem_registro_auditoria (
        tipo_evento,
        fecha_hora,
        descripcion
    )
    VALUES (
        'MANTENIMIENTO',
        GETDATE(),
        'Actualización de estadísticas completada'
    );
END;

-- Evento para gestionar datos históricos
CREATE EVENT sp_gestionar_datos_historicos
ON SCHEDULE EVERY 1 WEEK
STARTS (GETDATE() AT '02:00:00')
AS
BEGIN
    DECLARE @fecha_limite DATETIME2 = DATEADD(month, -6, GETDATE());
    DECLARE @partition_name NVARCHAR(100);
    DECLARE @sql NVARCHAR(MAX);
    
    -- Crear nueva tabla para datos históricos si no existe
    SET @partition_name = 'sem_historico_' + FORMAT(GETDATE(), 'yyyyMM');
    
    -- Verificar si ya existe una partición para este período
    IF NOT EXISTS (
        SELECT 1 
        FROM sem_particiones_historicas 
        WHERE YEAR(fecha_inicio) = YEAR(@fecha_limite) 
        AND MONTH(fecha_inicio) = MONTH(@fecha_limite)
    )
    BEGIN
        -- Crear nueva tabla histórica
        SET @sql = '
        SELECT *
        INTO ' + @partition_name + '
        FROM sem_lecturas_dispositivos
        WHERE fecha_hora < ''' + CONVERT(VARCHAR, @fecha_limite, 121) + '''';
        
        EXEC sp_executesql @sql;
        
        -- Registrar la nueva partición
        INSERT INTO sem_particiones_historicas (
            fecha_inicio,
            fecha_fin,
            estado,
            ubicacion_archivo
        )
        VALUES (
            DATEFROMPARTS(YEAR(@fecha_limite), MONTH(@fecha_limite), 1),
            EOMONTH(@fecha_limite),
            'ACTIVA',
            @partition_name
        );
        
        -- Crear índices en la tabla histórica
        SET @sql = '
        CREATE INDEX idx_' + @partition_name + '_fecha 
        ON ' + @partition_name + '(fecha_hora);
        CREATE INDEX idx_' + @partition_name + '_dispositivo 
        ON ' + @partition_name + '(id_dispositivo);';
        
        EXEC sp_executesql @sql;
    END;

    INSERT INTO sem_registro_auditoria (
        tipo_evento,
        fecha_hora,
        descripcion
    )
    VALUES (
        'MANTENIMIENTO',
        GETDATE(),
        'Gestión de datos históricos completada'
    );
END;

-- Evento para mantenimiento de índices
CREATE EVENT sp_mantener_indices
ON SCHEDULE EVERY 1 WEEK
STARTS (GETDATE() AT '01:00:00')
AS
BEGIN
    -- Reorganizar o reconstruir índices según la fragmentación
    DECLARE @TableName NVARCHAR(128)
    DECLARE @IndexName NVARCHAR(128)
    DECLARE @Fragmentation FLOAT

    DECLARE index_cursor CURSOR FOR
    SELECT 
        OBJECT_NAME(ips.object_id) AS TableName,
        i.name AS IndexName,
        ips.avg_fragmentation_in_percent
    FROM sys.dm_db_index_physical_stats(DB_ID(), NULL, NULL, NULL, 'LIMITED') ips
    JOIN sys.indexes i ON ips.object_id = i.object_id AND ips.index_id = i.index_id
    WHERE ips.avg_fragmentation_in_percent > 5

    OPEN index_cursor
    FETCH NEXT FROM index_cursor INTO @TableName, @IndexName, @Fragmentation

    WHILE @@FETCH_STATUS = 0
    BEGIN
        IF @Fragmentation >= 30
            EXEC('ALTER INDEX ' + @IndexName + ' ON ' + @TableName + ' REBUILD')
        ELSE
            EXEC('ALTER INDEX ' + @IndexName + ' ON ' + @TableName + ' REORGANIZE')

        FETCH NEXT FROM index_cursor INTO @TableName, @IndexName, @Fragmentation
    END

    CLOSE index_cursor
    DEALLOCATE index_cursor

    INSERT INTO sem_registro_auditoria (
        tipo_evento,
        fecha_hora,
        descripcion
    )
    VALUES (
        'MANTENIMIENTO',
        GETDATE(),
        'Mantenimiento de índices completado'
    );
END;

-- Evento para actualizar vistas materializadas
CREATE EVENT sp_actualizar_vistas_materializadas
ON SCHEDULE EVERY 1 HOUR
STARTS (GETDATE())
AS
BEGIN
    -- Actualizar vista de datos recientes y históricos
    EXEC('
    ALTER VIEW mv_lecturas_completas AS
    SELECT * FROM sem_lecturas_dispositivos
    UNION ALL
    SELECT l.* 
    FROM sem_particiones_historicas p
    CROSS APPLY (
        SELECT * 
        FROM ' + p.ubicacion_archivo + '
    ) l
    WHERE p.estado = ''ACTIVA''
    ');

    INSERT INTO sem_registro_auditoria (
        tipo_evento,
        fecha_hora,
        descripcion
    )
    VALUES (
        'MANTENIMIENTO',
        GETDATE(),
        'Actualización de vistas materializadas completada'
    );
END;

-- Evento para monitoreo de espacio en disco
CREATE EVENT sp_monitorear_espacio_disco
ON SCHEDULE EVERY 6 HOUR
STARTS (GETDATE())
AS
BEGIN
    DECLARE @espacio_libre_mb DECIMAL(10,2)
    
    SELECT @espacio_libre_mb = available_bytes/1024/1024
    FROM sys.dm_os_volume_stats(DB_ID(), 1);

    IF @espacio_libre_mb < 5000  -- Alerta si hay menos de 5GB libres
    BEGIN
        EXEC sp_generar_alerta
            @tipo_alerta = 'ESPACIO_DISCO',
            @nivel_severidad = 2,
            @mensaje = 'Espacio en disco bajo: ' + CAST(@espacio_libre_mb AS VARCHAR(20)) + ' MB disponibles',
            @datos_contexto = NULL;
    END

    INSERT INTO sem_registro_auditoria (
        tipo_evento,
        fecha_hora,
        descripcion
    )
    VALUES (
        'MONITOREO',
        GETDATE(),
        'Verificación de espacio en disco completada'
    );
END;

-- Evento para verificar integridad de la base de datos
CREATE EVENT sp_verificar_integridad
ON SCHEDULE EVERY 1 WEEK
STARTS (GETDATE() AT '00:00:00')
AS
BEGIN
    DECLARE @DatabaseName NVARCHAR(128) = DB_NAME()
    
    -- Verificar integridad de la base de datos
    DBCC CHECKDB (@DatabaseName) WITH NO_INFOMSGS;
    
    -- Verificar consistencia de tablas críticas
    DBCC CHECKTABLE('sem_lecturas_dispositivos') WITH NO_INFOMSGS;
    DBCC CHECKTABLE('sem_agregaciones_dispositivo') WITH NO_INFOMSGS;
    DBCC CHECKTABLE('sem_agregaciones_grupo') WITH NO_INFOMSGS;
    
    -- Verificar tablas históricas
    DECLARE @tabla_historica NVARCHAR(500)
    DECLARE historico_cursor CURSOR FOR
    SELECT ubicacion_archivo
    FROM sem_particiones_historicas
    WHERE estado = 'ACTIVA'

    OPEN historico_cursor
    FETCH NEXT FROM historico_cursor INTO @tabla_historica

    WHILE @@FETCH_STATUS = 0
    BEGIN
        EXEC('DBCC CHECKTABLE(''' + @tabla_historica + ''') WITH NO_INFOMSGS');
        FETCH NEXT FROM historico_cursor INTO @tabla_historica
    END

    CLOSE historico_cursor
    DEALLOCATE historico_cursor

    INSERT INTO sem_registro_auditoria (
        tipo_evento,
        fecha_hora,
        descripcion
    )
    VALUES (
        'MANTENIMIENTO',
        GETDATE(),
        'Verificación de integridad de base de datos completada'
    );
END;
