// services/total-energy-service.js
const schedule = require('node-schedule');
const databaseService = require('./database-service');

class TotalEnergyService {
    constructor() {
        this.jobs = {};
        this.QUALITY_THRESHOLD = 0.8; // 80% de lecturas válidas requeridas
        this.EXPECTED_READINGS_PER_HOUR = 360; // Para intervalos de 10 segundos
    }

    async calculateHourlyTotal() {
        const conn = await databaseService.pool.getConnection();
        try {
            console.log('📊 Calculando total de energía por hora:', new Date().toLocaleString());
            await conn.beginTransaction();

            const query = `
                WITH HourlyData AS (
                    SELECT 
                        DATE_FORMAT(ds.sys_timestamp, '%Y-%m-%d %H:00:00') as fecha_hora,
                        COUNT(*) as actual_readings,
                        COUNT(CASE WHEN em.reading_quality = 'GOOD' THEN 1 END) as good_readings,
                        AVG(CASE WHEN em.reading_quality = 'GOOD' THEN em.total_act_power END) as watts_promedio,
                        MAX(emd.total_act_energy) as energia_final,
                        MIN(emd.total_act_energy) as energia_inicial
                    FROM device_status ds
                    JOIN energy_meter em ON ds.em0_id = em.id
                    JOIN energy_meter_data emd ON ds.emdata0_id = emd.id
                    WHERE ds.sys_timestamp >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
                    GROUP BY DATE_FORMAT(ds.sys_timestamp, '%Y-%m-%d %H:00:00')
                )
                SELECT 
                    fecha_hora,
                    watts_promedio as total_watts_hora,
                    (energia_final - energia_inicial) as total_kwh,
                    actual_readings,
                    good_readings,
                    (good_readings / ?) as quality_score
                FROM HourlyData
                WHERE energia_inicial IS NOT NULL
                  AND energia_final IS NOT NULL
                  AND good_readings / ? >= ?
            `;

            const [rows] = await conn.query(query, [
                this.EXPECTED_READINGS_PER_HOUR,
                this.EXPECTED_READINGS_PER_HOUR,
                this.QUALITY_THRESHOLD
            ]);

            for (const row of rows) {
                const costo_total = this.calculateCost(row.total_kwh);

                await conn.query(
                    `INSERT INTO totales_energia_hora 
                    (fecha_hora, total_watts_hora, total_kwh, costo_total, 
                     readings_in_period, quality_score) 
                    VALUES (?, ?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE 
                    total_watts_hora = VALUES(total_watts_hora),
                    total_kwh = VALUES(total_kwh),
                    costo_total = VALUES(costo_total),
                    readings_in_period = VALUES(readings_in_period),
                    quality_score = VALUES(quality_score)`,
                    [
                        row.fecha_hora,
                        row.total_watts_hora,
                        row.total_kwh,
                        costo_total,
                        row.actual_readings,
                        row.quality_score
                    ]
                );
            }

            await conn.commit();
            console.log('✅ Totales por hora actualizados');
        } catch (error) {
            await conn.rollback();
            console.error('❌ Error al calcular totales por hora:', error);
        } finally {
            conn.release();
        }
    }

    async calculateDailyTotal() {
        const conn = await databaseService.pool.getConnection();
        try {
            console.log('📊 Calculando total de energía por día:', new Date().toLocaleString());
            await conn.beginTransaction();

            const query = `
                WITH DailyData AS (
                    SELECT 
                        DATE(ds.sys_timestamp) as fecha,
                        COUNT(DISTINCT HOUR(ds.sys_timestamp)) as hours_with_data,
                        COUNT(*) as actual_readings,
                        COUNT(CASE WHEN em.reading_quality = 'GOOD' THEN 1 END) as good_readings,
                        AVG(CASE WHEN em.reading_quality = 'GOOD' THEN em.total_act_power END) as watts_promedio,
                        MAX(emd.total_act_energy) as energia_final,
                        MIN(emd.total_act_energy) as energia_inicial
                    FROM device_status ds
                    JOIN energy_meter em ON ds.em0_id = em.id
                    JOIN energy_meter_data emd ON ds.emdata0_id = emd.id
                    WHERE ds.sys_timestamp >= DATE_SUB(CURDATE(), INTERVAL 1 DAY)
                    GROUP BY DATE(ds.sys_timestamp)
                )
                SELECT 
                    fecha,
                    watts_promedio as total_watts_dia,
                    (energia_final - energia_inicial) as total_kwh,
                    hours_with_data,
                    good_readings,
                    (hours_with_data / 24) as quality_score
                FROM DailyData
                WHERE energia_inicial IS NOT NULL
                  AND energia_final IS NOT NULL
                  AND hours_with_data / 24 >= ?
            `;

            const [rows] = await conn.query(query, [this.QUALITY_THRESHOLD]);

            for (const row of rows) {
                const costo_total = this.calculateCost(row.total_kwh);

                await conn.query(
                    `INSERT INTO totales_energia_dia 
                    (fecha, total_watts_dia, total_kwh, costo_total, 
                     hours_with_data, quality_score) 
                    VALUES (?, ?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE 
                    total_watts_dia = VALUES(total_watts_dia),
                    total_kwh = VALUES(total_kwh),
                    costo_total = VALUES(costo_total),
                    hours_with_data = VALUES(hours_with_data),
                    quality_score = VALUES(quality_score)`,
                    [
                        row.fecha,
                        row.total_watts_dia,
                        row.total_kwh,
                        costo_total,
                        row.hours_with_data,
                        row.quality_score
                    ]
                );
            }

            await conn.commit();
            console.log('✅ Totales por día actualizados');
        } catch (error) {
            await conn.rollback();
            console.error('❌ Error al calcular totales por día:', error);
        } finally {
            conn.release();
        }
    }

    async calculateMonthlyTotal() {
        const conn = await databaseService.pool.getConnection();
        try {
            console.log('📊 Calculando total de energía por mes:', new Date().toLocaleString());
            await conn.beginTransaction();

            const query = `
                WITH MonthlyData AS (
                    SELECT 
                        YEAR(ds.sys_timestamp) as anio,
                        MONTH(ds.sys_timestamp) as mes,
                        COUNT(DISTINCT DATE(ds.sys_timestamp)) as days_with_data,
                        COUNT(*) as actual_readings,
                        COUNT(CASE WHEN em.reading_quality = 'GOOD' THEN 1 END) as good_readings,
                        AVG(CASE WHEN em.reading_quality = 'GOOD' THEN em.total_act_power END) as watts_promedio,
                        MAX(emd.total_act_energy) as energia_final,
                        MIN(emd.total_act_energy) as energia_inicial
                    FROM device_status ds
                    JOIN energy_meter em ON ds.em0_id = em.id
                    JOIN energy_meter_data emd ON ds.emdata0_id = emd.id
                    WHERE ds.sys_timestamp >= DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-01'), INTERVAL 1 MONTH)
                    GROUP BY YEAR(ds.sys_timestamp), MONTH(ds.sys_timestamp)
                )
                SELECT 
                    anio,
                    mes,
                    watts_promedio as total_watts_mes,
                    (energia_final - energia_inicial) as total_kwh,
                    days_with_data,
                    good_readings,
                    (days_with_data / DAY(LAST_DAY(CONCAT(anio, '-', mes, '-01')))) as quality_score
                FROM MonthlyData
                WHERE energia_inicial IS NOT NULL
                  AND energia_final IS NOT NULL
                  AND days_with_data / DAY(LAST_DAY(CONCAT(anio, '-', mes, '-01'))) >= ?
            `;

            const [rows] = await conn.query(query, [this.QUALITY_THRESHOLD]);

            for (const row of rows) {
                const costo_total = this.calculateCost(row.total_kwh);

                await conn.query(
                    `INSERT INTO totales_energia_mes 
                    (anio, mes, total_watts_mes, total_kwh, costo_total, 
                     days_with_data, quality_score) 
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE 
                    total_watts_mes = VALUES(total_watts_mes),
                    total_kwh = VALUES(total_kwh),
                    costo_total = VALUES(costo_total),
                    days_with_data = VALUES(days_with_data),
                    quality_score = VALUES(quality_score)`,
                    [
                        row.anio,
                        row.mes,
                        row.total_watts_mes,
                        row.total_kwh,
                        costo_total,
                        row.days_with_data,
                        row.quality_score
                    ]
                );
            }

            await conn.commit();
            console.log('✅ Totales por mes actualizados');
        } catch (error) {
            await conn.rollback();
            console.error('❌ Error al calcular totales por mes:', error);
        } finally {
            conn.release();
        }
    }

    calculateCost(kwh) {
        const precioKwh = parseFloat(databaseService.measurementConfig?.precio_kwh || 203);
        return kwh * precioKwh;
    }

    startService() {
        // Cálculo inicial
        this.calculateHourlyTotal();
        this.calculateDailyTotal();
        this.calculateMonthlyTotal();

        // Programar cálculos horarios
        this.jobs.hourly = schedule.scheduleJob('0 * * * *', () => {
            this.calculateHourlyTotal();
        });

        // Programar cálculos diarios
        this.jobs.daily = schedule.scheduleJob('0 0 * * *', () => {
            this.calculateDailyTotal();
        });

        // Programar cálculos mensuales
        this.jobs.monthly = schedule.scheduleJob('0 0 1 * *', () => {
            this.calculateMonthlyTotal();
        });

        console.log('✅ Servicio de totales de energía iniciado con tareas programadas');
    }

    stopService() {
        Object.values(this.jobs).forEach(job => {
            if (job) {
                job.cancel();
            }
        });
        console.log('🛑 Servicio de totales de energía detenido');
    }
}

module.exports = new TotalEnergyService();