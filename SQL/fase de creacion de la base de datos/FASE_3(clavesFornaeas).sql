-- Configuración
ALTER TABLE sem_configuracion
    ADD CONSTRAINT fk_configuracion_tipo_parametro
        FOREIGN KEY (tipo_parametro_id) REFERENCES sem_tipos_parametros (id);

-- Estado Dispositivo
ALTER TABLE sem_estado_dispositivo
    ADD CONSTRAINT fk_estado_dispositivo_shelly
        FOREIGN KEY (shelly_id) REFERENCES sem_dispositivos (shelly_id);

-- Grupo Promedios
ALTER TABLE sem_grupo_promedios
    ADD CONSTRAINT uk_grupo_periodo_promedios
        UNIQUE (grupo_id, periodo_tipo, periodo_inicio),
    ADD CONSTRAINT fk_grupo_promedios_grupo
        FOREIGN KEY (grupo_id) REFERENCES sem_grupos (id);

-- Grupo Totales
ALTER TABLE sem_grupo_totales
    ADD CONSTRAINT uk_grupo_periodo_totales
        UNIQUE (grupo_id, periodo_tipo, periodo_inicio),
    ADD CONSTRAINT fk_grupo_totales_grupo
        FOREIGN KEY (grupo_id) REFERENCES sem_grupos (id);

-- Historial Grupo Dispositivo
ALTER TABLE sem_historial_grupo_dispositivo
    MODIFY shelly_id varchar(12) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    ADD CONSTRAINT fk_historial_grupo_shelly
        FOREIGN KEY (shelly_id) REFERENCES sem_dispositivos (shelly_id),
    ADD CONSTRAINT fk_historial_grupo_anterior
        FOREIGN KEY (grupo_anterior_id) REFERENCES sem_grupos (id),
    ADD CONSTRAINT fk_historial_grupo_nuevo
        FOREIGN KEY (grupo_nuevo_id) REFERENCES sem_grupos (id),
    ADD CONSTRAINT fk_historial_grupo_auditoria
        FOREIGN KEY (registro_auditoria_id) REFERENCES sem_registro_auditoria (id);

-- Promedios Día
ALTER TABLE sem_promedios_dia
    ADD CONSTRAINT uk_promedios_dia_shelly_fecha
        UNIQUE (shelly_id, fecha_local),
    ADD CONSTRAINT fk_promedios_dia_shelly
        FOREIGN KEY (shelly_id) REFERENCES sem_dispositivos (shelly_id);

-- Promedios Hora
ALTER TABLE sem_promedios_hora
    ADD CONSTRAINT uk_promedios_hora_shelly_fecha
        UNIQUE (shelly_id, hora_local),
    ADD CONSTRAINT fk_promedios_hora_shelly
        FOREIGN KEY (shelly_id) REFERENCES sem_dispositivos (shelly_id);

-- Promedios Mes
ALTER TABLE sem_promedios_mes
    CHANGE COLUMN angio año INT NOT NULL,
    ADD CONSTRAINT fk_promedios_mes_shelly
        FOREIGN KEY (shelly_id) REFERENCES sem_dispositivos (shelly_id);

-- Totales Día
ALTER TABLE sem_totales_dia
    ADD CONSTRAINT uk_totales_dia_shelly_fecha
        UNIQUE (shelly_id, fecha_local),
    ADD CONSTRAINT fk_totales_dia_shelly
        FOREIGN KEY (shelly_id) REFERENCES sem_dispositivos (shelly_id);

-- Totales Hora
ALTER TABLE sem_totales_hora
    ADD CONSTRAINT uk_totales_hora_shelly_fecha
        UNIQUE (shelly_id, hora_local),
    ADD CONSTRAINT fk_totales_hora_shelly
        FOREIGN KEY (shelly_id) REFERENCES sem_dispositivos (shelly_id);

-- Totales Mes
ALTER TABLE sem_totales_mes
    ADD CONSTRAINT fk_totales_mes_shelly
        FOREIGN KEY (shelly_id) REFERENCES sem_dispositivos (shelly_id);