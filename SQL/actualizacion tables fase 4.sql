-- Modificar sem_promedios_hora
ALTER TABLE sem_promedios_hora
    DROP COLUMN fase_a_voltaje_promedio,
    DROP COLUMN fase_a_corriente_promedio,
    DROP COLUMN fase_a_potencia_activa_promedio,
    DROP COLUMN fase_a_factor_potencia_promedio,
    DROP COLUMN fase_b_voltaje_promedio,
    DROP COLUMN fase_b_corriente_promedio,
    DROP COLUMN fase_b_potencia_activa_promedio,
    DROP COLUMN fase_b_factor_potencia_promedio,
    DROP COLUMN fase_c_voltaje_promedio,
    DROP COLUMN fase_c_corriente_promedio,
    DROP COLUMN fase_c_potencia_activa_promedio,
    DROP COLUMN fase_c_factor_potencia_promedio;

-- Modificar sem_promedios_dia
ALTER TABLE sem_promedios_dia
    DROP COLUMN fase_a_voltaje_promedio,
    DROP COLUMN fase_a_corriente_promedio,
    DROP COLUMN fase_a_potencia_promedio,
    DROP COLUMN fase_a_factor_potencia_promedio,
    DROP COLUMN fase_b_voltaje_promedio,
    DROP COLUMN fase_b_corriente_promedio,
    DROP COLUMN fase_b_potencia_promedio,
    DROP COLUMN fase_b_factor_potencia_promedio,
    DROP COLUMN fase_c_voltaje_promedio,
    DROP COLUMN fase_c_corriente_promedio,
    DROP COLUMN fase_c_potencia_promedio,
    DROP COLUMN fase_c_factor_potencia_promedio;

-- Modificar sem_promedios_mes
ALTER TABLE sem_promedios_mes
    DROP COLUMN fase_a_voltaje_promedio,
    DROP COLUMN fase_a_corriente_promedio,
    DROP COLUMN fase_a_potencia_promedio,
    DROP COLUMN fase_a_factor_potencia_promedio,
    DROP COLUMN fase_b_voltaje_promedio,
    DROP COLUMN fase_b_corriente_promedio,
    DROP COLUMN fase_b_potencia_promedio,
    DROP COLUMN fase_b_factor_potencia_promedio,
    DROP COLUMN fase_c_voltaje_promedio,
    DROP COLUMN fase_c_corriente_promedio,
    DROP COLUMN fase_c_potencia_promedio,
    DROP COLUMN fase_c_factor_potencia_promedio;

-- Modificar sem_totales_hora
ALTER TABLE sem_totales_hora
    DROP COLUMN fase_a_energia_activa,
    DROP COLUMN fase_a_energia_reactiva,
    DROP COLUMN fase_b_energia_activa,
    DROP COLUMN fase_b_energia_reactiva,
    DROP COLUMN fase_c_energia_activa,
    DROP COLUMN fase_c_energia_reactiva;

-- Modificar sem_totales_dia
ALTER TABLE sem_totales_dia
    DROP COLUMN fase_a_energia_activa,
    DROP COLUMN fase_a_energia_reactiva,
    DROP COLUMN fase_b_energia_activa,
    DROP COLUMN fase_b_energia_reactiva,
    DROP COLUMN fase_c_energia_activa,
    DROP COLUMN fase_c_energia_reactiva;

-- Modificar sem_totales_mes
ALTER TABLE sem_totales_mes
    DROP COLUMN fase_a_energia_activa,
    DROP COLUMN fase_a_energia_reactiva,
    DROP COLUMN fase_b_energia_activa,
    DROP COLUMN fase_b_energia_reactiva,
    DROP COLUMN fase_c_energia_activa,
    DROP COLUMN fase_c_energia_reactiva;