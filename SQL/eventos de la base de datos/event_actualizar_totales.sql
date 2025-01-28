DELIMITER //

CREATE EVENT `event_actualizar_totales`
ON SCHEDULE EVERY 30 MINUTE
STARTS CURRENT_TIMESTAMP
DO
BEGIN
  -- Declarar variables para la fecha y hora actual
  DECLARE v_hora_actual TIMESTAMP;
  DECLARE v_fecha_actual DATE;
  DECLARE v_anio_actual INT;
  DECLARE v_mes_actual INT;

  -- Obtener la hora y fecha actual
  SET v_hora_actual = CURRENT_TIMESTAMP;
  SET v_fecha_actual = CURRENT_DATE;
  
  -- Obtener el año y el mes para la ejecución de la función fn_process_totales_mes
  SET v_anio_actual = YEAR(v_fecha_actual);
  SET v_mes_actual = MONTH(v_fecha_actual);

  -- Llamar a la función fn_process_totales_hora
  SELECT fn_process_totales_hora(v_hora_actual);

  -- Llamar a la función fn_process_totales_dia
  SELECT fn_process_totales_dia(v_fecha_actual);
  
  -- Llamar a la función fn_process_totales_mes
  SELECT fn_process_totales_mes(v_anio_actual, v_mes_actual);
END;