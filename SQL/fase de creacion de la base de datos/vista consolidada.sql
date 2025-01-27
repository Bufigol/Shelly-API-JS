-- Eliminamos la vista si existe (esto es seguro ya que solo elimina la vista, no los datos)
DROP VIEW IF EXISTS v_mediciones_consolidadas;

-- Creamos la vista consolidada
CREATE VIEW v_mediciones_consolidadas AS
SELECT 
    m.shelly_id,
    d.nombre AS nombre_dispositivo,
    g.nombre AS nombre_grupo,
    m.timestamp_utc,
    m.timestamp_local,
    
    -- Fase A
    MAX(CASE WHEN m.fase = 'A' THEN m.voltaje END) as voltaje_fase_a,
    MAX(CASE WHEN m.fase = 'A' THEN m.corriente END) as corriente_fase_a,
    MAX(CASE WHEN m.fase = 'A' THEN m.potencia_activa END) as potencia_activa_fase_a,
    MAX(CASE WHEN m.fase = 'A' THEN m.potencia_aparente END) as potencia_aparente_fase_a,
    MAX(CASE WHEN m.fase = 'A' THEN m.factor_potencia END) as factor_potencia_fase_a,
    MAX(CASE WHEN m.fase = 'A' THEN m.energia_activa END) as energia_activa_fase_a,
    MAX(CASE WHEN m.fase = 'A' THEN m.energia_reactiva END) as energia_reactiva_fase_a,
    
    -- Fase B
    MAX(CASE WHEN m.fase = 'B' THEN m.voltaje END) as voltaje_fase_b,
    MAX(CASE WHEN m.fase = 'B' THEN m.corriente END) as corriente_fase_b,
    MAX(CASE WHEN m.fase = 'B' THEN m.potencia_activa END) as potencia_activa_fase_b,
    MAX(CASE WHEN m.fase = 'B' THEN m.potencia_aparente END) as potencia_aparente_fase_b,
    MAX(CASE WHEN m.fase = 'B' THEN m.factor_potencia END) as factor_potencia_fase_b,
    MAX(CASE WHEN m.fase = 'B' THEN m.energia_activa END) as energia_activa_fase_b,
    MAX(CASE WHEN m.fase = 'B' THEN m.energia_reactiva END) as energia_reactiva_fase_b,
    
    -- Fase C
    MAX(CASE WHEN m.fase = 'C' THEN m.voltaje END) as voltaje_fase_c,
    MAX(CASE WHEN m.fase = 'C' THEN m.corriente END) as corriente_fase_c,
    MAX(CASE WHEN m.fase = 'C' THEN m.potencia_activa END) as potencia_activa_fase_c,
    MAX(CASE WHEN m.fase = 'C' THEN m.potencia_aparente END) as potencia_aparente_fase_c,
    MAX(CASE WHEN m.fase = 'C' THEN m.factor_potencia END) as factor_potencia_fase_c,
    MAX(CASE WHEN m.fase = 'C' THEN m.energia_activa END) as energia_activa_fase_c,
    MAX(CASE WHEN m.fase = 'C' THEN m.energia_reactiva END) as energia_reactiva_fase_c,
    
    -- Totales calculados
    SUM(m.potencia_activa) as potencia_activa_total,
    SUM(m.potencia_aparente) as potencia_aparente_total,
    SUM(m.energia_activa) as energia_activa_total,
    SUM(m.energia_reactiva) as energia_reactiva_total,
    
    -- Calidad y frecuencia
    m.frecuencia,
    MAX(CASE WHEN m.calidad_lectura = 'ERROR' THEN 1 ELSE 0 END) as tiene_error,
    GROUP_CONCAT(DISTINCT m.calidad_lectura) as estados_calidad

FROM sem_mediciones m
INNER JOIN sem_dispositivos d ON m.shelly_id = d.shelly_id
INNER JOIN sem_grupos g ON d.grupo_id = g.id
GROUP BY 
    m.shelly_id,
    m.timestamp_utc,
    m.timestamp_local,
    d.nombre,
    g.nombre;