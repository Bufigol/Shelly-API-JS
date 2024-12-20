-- Índices para sem_auditoria_detallada
CREATE INDEX idx_auditoria_fecha ON sem_auditoria_detallada (fecha_operacion);
CREATE INDEX idx_auditoria_tabla ON sem_auditoria_detallada (tabla_afectada);
CREATE INDEX idx_auditoria_tipo ON sem_auditoria_detallada (tipo_operacion);

-- Índices para sem_configuracion
CREATE INDEX idx_tipo_parametro ON sem_configuracion (tipo_parametro_id);
CREATE INDEX idx_configuracion_validez ON sem_configuracion (valido_desde, valido_hasta, activo);

-- Índices para sem_control_calidad
CREATE INDEX idx_calidad_dispositivo ON sem_control_calidad (shelly_id);
CREATE INDEX idx_calidad_estado ON sem_control_calidad (estado_validacion);
CREATE INDEX idx_calidad_periodo ON sem_control_calidad (inicio_periodo, fin_periodo);

-- Índices para sem_dispositivos
CREATE INDEX idx_dispositivo_activo ON sem_dispositivos (activo);
CREATE INDEX idx_dispositivo_grupo ON sem_dispositivos (grupo_id);

-- Índices para sem_estado_dispositivo
CREATE INDEX idx_estado_dispositivo ON sem_estado_dispositivo (shelly_id);
CREATE INDEX idx_estado_conexion ON sem_estado_dispositivo (estado_conexion);

-- Índices para sem_grupo_promedios
CREATE INDEX idx_grupo_periodo ON sem_grupo_promedios (grupo_id, periodo_tipo);
CREATE INDEX idx_periodo_completo ON sem_grupo_promedios (periodo_inicio, periodo_fin, periodo_tipo);

-- Índices para sem_grupo_totales
CREATE INDEX idx_grupo_periodo ON sem_grupo_totales (grupo_id, periodo_tipo);
CREATE INDEX idx_periodo_completo ON sem_grupo_totales (periodo_inicio, periodo_fin, periodo_tipo);

-- Índices para sem_historial_grupo_dispositivo
CREATE INDEX idx_historial_dispositivo ON sem_historial_grupo_dispositivo (shelly_id);
CREATE INDEX idx_grupo_anterior ON sem_historial_grupo_dispositivo (grupo_anterior_id);
CREATE INDEX idx_grupo_nuevo ON sem_historial_grupo_dispositivo (grupo_nuevo_id);
CREATE INDEX idx_historial_fecha ON sem_historial_grupo_dispositivo (fecha_cambio);
CREATE INDEX idx_registro_auditoria ON sem_historial_grupo_dispositivo (registro_auditoria_id);

-- Índices para sem_mediciones
CREATE INDEX idx_mediciones_dispositivo ON sem_mediciones (shelly_id);
CREATE INDEX idx_mediciones_timestamp ON sem_mediciones (timestamp_local);
CREATE INDEX idx_mediciones_calidad ON sem_mediciones (calidad_lectura);
CREATE INDEX idx_mediciones_completo ON sem_mediciones (shelly_id, timestamp_local, calidad_lectura);

-- Índices para sem_promedios_dia
CREATE INDEX idx_promedios_dia_dispositivo ON sem_promedios_dia (shelly_id);
CREATE INDEX idx_fecha_local ON sem_promedios_dia (fecha_local);
CREATE INDEX idx_calidad ON sem_promedios_dia (calidad_datos);

-- Índices para sem_promedios_hora
CREATE INDEX idx_promedios_hora_dispositivo ON sem_promedios_hora (shelly_id);
CREATE INDEX idx_hora_local ON sem_promedios_hora (hora_local);
CREATE INDEX idx_calidad ON sem_promedios_hora (calidad_datos);

-- Índices para sem_promedios_mes
CREATE INDEX idx_promedios_mes_dispositivo ON sem_promedios_mes (shelly_id);
CREATE INDEX idx_año_mes ON sem_promedios_mes (angio, mes);
CREATE INDEX idx_calidad ON sem_promedios_mes (calidad_datos);

-- Índices para sem_registro_auditoria
CREATE INDEX idx_auditoria_dispositivo ON sem_registro_auditoria (shelly_id);
CREATE INDEX idx_auditoria_grupo ON sem_registro_auditoria (grupo_id);
CREATE INDEX idx_auditoria_timestamp ON sem_registro_auditoria (fecha_evento);
CREATE INDEX idx_auditoria_tipo_evento ON sem_registro_auditoria (tipo_evento_id);

-- Índices para sem_totales_dia
CREATE INDEX idx_totales_dia_dispositivo ON sem_totales_dia (shelly_id);
CREATE INDEX idx_fecha_local ON sem_totales_dia (fecha_local);

-- Índices para sem_totales_hora
CREATE INDEX idx_totales_hora_dispositivo ON sem_totales_hora (shelly_id);
CREATE INDEX idx_hora_local ON sem_totales_hora (hora_local);
CREATE INDEX idx_calidad ON sem_totales_hora (calidad_datos);
CREATE INDEX idx_totales_hora_completo ON sem_totales_hora (shelly_id, hora_local, energia_activa_total);

-- Índices para sem_totales_mes
CREATE INDEX idx_totales_mes_dispositivo ON sem_totales_mes (shelly_id);
CREATE INDEX idx_año_mes ON sem_totales_mes (año, mes);