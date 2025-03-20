DELIMITER //

-- Función para calcular distancia entre dos puntos en metros usando la fórmula de Haversine
CREATE FUNCTION calcular_distancia_en_metros(lat1 DOUBLE, lon1 DOUBLE, lat2 DOUBLE, lon2 DOUBLE) 
RETURNS DOUBLE DETERMINISTIC
BEGIN
    DECLARE R DOUBLE DEFAULT 6371000;
    DECLARE phi1 DOUBLE;
    DECLARE phi2 DOUBLE;
    DECLARE delta_phi DOUBLE;
    DECLARE delta_lambda DOUBLE;
    DECLARE a DOUBLE;
    DECLARE c DOUBLE;
    DECLARE d DOUBLE;
    
    SET phi1 = RADIANS(lat1);
    SET phi2 = RADIANS(lat2);
    SET delta_phi = RADIANS(lat2 - lat1);
    SET delta_lambda = RADIANS(lon2 - lon1);
    
    SET a = SIN(delta_phi/2) * SIN(delta_phi/2) +
            COS(phi1) * COS(phi2) *
            SIN(delta_lambda/2) * SIN(delta_lambda/2);
    SET c = 2 * ATAN2(SQRT(a), SQRT(1-a));
    SET d = R * c;
    
    RETURN d;
END//

DELIMITER ;