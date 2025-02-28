DELIMITER //

-- Función para determinar la calidad de temperatura según configuración
CREATE FUNCTION determinar_calidad_temperatura(p_temperatura DOUBLE) 
RETURNS VARCHAR(45) DETERMINISTIC
BEGIN
    DECLARE v_rojo_bajo_valor DOUBLE;
    DECLARE v_rojo_bajo_nombre VARCHAR(45);
    DECLARE v_amarillo_bajo_valor DOUBLE;
    DECLARE v_amarillo_bajo_nombre VARCHAR(45);
    DECLARE v_verde_valor DOUBLE;
    DECLARE v_verde_nombre VARCHAR(45);
    DECLARE v_amarillo_alto_valor DOUBLE;
    DECLARE v_amarillo_alto_nombre VARCHAR(45);
    DECLARE v_rojo_alto_valor DOUBLE;
    DECLARE v_rojo_alto_nombre VARCHAR(45);
    DECLARE v_maximo_rojo_alto DOUBLE;
    DECLARE v_fuera_rango_nombre VARCHAR(45);
    DECLARE v_calidad VARCHAR(45);
    
    -- Obtener los rangos definidos en la configuración
    SELECT CAST(valor AS DOUBLE) INTO v_rojo_bajo_valor FROM api_configuracion WHERE id_api_configuracion = 2;
    SELECT valor INTO v_rojo_bajo_nombre FROM api_configuracion WHERE id_api_configuracion = 3;
    
    SELECT CAST(valor AS DOUBLE) INTO v_amarillo_bajo_valor FROM api_configuracion WHERE id_api_configuracion = 4;
    SELECT valor INTO v_amarillo_bajo_nombre FROM api_configuracion WHERE id_api_configuracion = 5;
    
    SELECT CAST(valor AS DOUBLE) INTO v_verde_valor FROM api_configuracion WHERE id_api_configuracion = 6;
    SELECT valor INTO v_verde_nombre FROM api_configuracion WHERE id_api_configuracion = 7;
    
    SELECT CAST(valor AS DOUBLE) INTO v_amarillo_alto_valor FROM api_configuracion WHERE id_api_configuracion = 8;
    SELECT valor INTO v_amarillo_alto_nombre FROM api_configuracion WHERE id_api_configuracion = 9;
    
    SELECT CAST(valor AS DOUBLE) INTO v_rojo_alto_valor FROM api_configuracion WHERE id_api_configuracion = 10;
    SELECT valor INTO v_rojo_alto_nombre FROM api_configuracion WHERE id_api_configuracion = 11;
    
    SELECT valor INTO v_fuera_rango_nombre FROM api_configuracion WHERE id_api_configuracion = 12;
    
    SELECT CAST(valor AS DOUBLE) INTO v_maximo_rojo_alto FROM api_configuracion WHERE id_api_configuracion = 16;
    
    -- Determinar la calidad de temperatura
    IF p_temperatura < v_rojo_bajo_valor THEN
        SET v_calidad = v_rojo_bajo_nombre;
    ELSEIF p_temperatura < v_amarillo_bajo_valor THEN
        SET v_calidad = v_amarillo_bajo_nombre;
    ELSEIF p_temperatura < v_amarillo_alto_valor THEN
        SET v_calidad = v_verde_nombre;
    ELSEIF p_temperatura < v_rojo_alto_valor THEN
        SET v_calidad = v_amarillo_alto_nombre;
    ELSEIF p_temperatura <= v_maximo_rojo_alto THEN
        SET v_calidad = v_rojo_alto_nombre;
    ELSE
        SET v_calidad = v_fuera_rango_nombre;
    END IF;
    
    RETURN v_calidad;
END//

DELIMITER ;