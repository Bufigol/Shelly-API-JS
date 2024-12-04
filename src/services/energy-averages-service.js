// services/energy-averages-service.js
const path = require('path');
const schedule = require('node-schedule');
const databaseService = require('./database-service');

class EnergyAveragesService {
    constructor() {
        this.jobs = {};
        this.QUALITY_THRESHOLD = 0.8; // 80% de lecturas válidas requeridas
        this.EXPECTED_READINGS_PER_HOUR = 360; // Para intervalos de 10 segundos
    }

    wattsToKwh(watts, seconds) {
        // Conversión precisa usando segundos
        return (watts * seconds) / (3600 * 1000); // 3600 segundos en una hora, 1000W en 1kW
    }

    async calculateHourlyAverages() {
        const conn = await databaseService.pool.getConnection();
        try {
            console.log('📊 Calculando promedios por hora:', new Date().toLocaleString());
            
            await conn.beginTransaction();

            // Consulta mejorada que considera la calidad de las lecturas
            const query = `
                WITH HourlyStats AS (
                    SELECT 
                        DATE_FORMAT(em.measurement_timestamp, '%Y-%m-%d %H:00:00') as hora,
                        COUNT(*) as actual_readings,
                        AVG(CASE WHEN em.reading_quality = 'GOOD' THEN em.total_act_power ELSE NULL END) as promedio_watts,
                        MIN(CASE WHEN em.reading_quality = 'GOOD' THEN em.total_act_power ELSE NULL END) as min_watts,
                        MAX(CASE WHEN em.reading_quality = 'GOOD' THEN em.total_act_power ELSE NULL END) as max_watts,
                        COUNT(CASE WHEN em.reading_quality = 'GOOD' THEN 1 ELSE NULL END) as good_readings
                    FROM energy_meter em
                    WHERE em.measurement_timestamp >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
                    GROUP BY DATE_FORMAT(em.measurement_timestamp, '%Y-%m-%d %H:00:00')
                )
                SELECT 
                    hora,
                    promedio_watts,
                    min_watts,
                    max_watts,
                    actual_readings,
                    good_readings,
                    (good_readings / ?) as quality_score
                FROM HourlyStats
                HAVING quality_score >= ?
                ORDER BY hora DESC
                LIMIT 1
            `;

            const [rows] = await conn.query(query, [this.EXPECTED_READINGS_PER_HOUR, this.QUALITY_THRESHOLD]);

            for (const row of rows) {
                // Calculamos kWh considerando lecturas válidas
                const secondsInHour = 3600;
                const kwh = this.wattsToKwh(row.promedio_watts, secondsInHour);
                const costo = this.calculateCost(kwh);

                // Insertamos o actualizamos el promedio
                await conn.query(
                    `INSERT INTO promedios_energia_hora 
                    (fecha_hora, promedio_watts, min_watts, max_watts, kwh_consumidos, costo, 
                     expected_readings, actual_readings, quality_score) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE 
                    promedio_watts = VALUES(promedio_watts),
                    min_watts = VALUES(min_watts),
                    max_watts = VALUES(max_watts),
                    kwh_consumidos = VALUES(kwh_consumidos),
                    costo = VALUES(costo),
                    actual_readings = VALUES(actual_readings),
                    quality_score = VALUES(quality_score)`,
                    [
                        row.hora,
                        row.promedio_watts,
                        row.min_watts,
                        row.max_watts,
                        kwh,
                        costo,
                        this.EXPECTED_READINGS_PER_HOUR,
                        row.actual_readings,
                        row.quality_score
                    ]
                );
            }

            await conn.commit();
            console.log('✅ Promedios por hora actualizados');
        } catch (error) {
            await conn.rollback();
            console.error('❌ Error al calcular promedios por hora:', error);
        } finally {
            conn.release();
        }
    }

    async calculateDailyAverages() {
        const conn = await databaseService.pool.getConnection();
        try {
            console.log('📊 Calculando promedios por día:', new Date().toLocaleString());
            
            await conn.beginTransaction();

            const query = `
                WITH DailyStats AS (
                    SELECT 
                        DATE(em.measurement_timestamp) as fecha,
                        COUNT(DISTINCT HOUR(em.measurement_timestamp)) as hours_with_data,
                        AVG(CASE WHEN em.reading_quality = 'GOOD' THEN em.total_act_power ELSE NULL END) as promedio_watts,
                        MIN(CASE WHEN em.reading_quality = 'GOOD' THEN em.total_act_power ELSE NULL END) as min_watts,
                        MAX(CASE WHEN em.reading_quality = 'GOOD' THEN em.total_act_power ELSE NULL END) as max_watts,
                        COUNT(*) as actual_readings,
                        COUNT(CASE WHEN em.reading_quality = 'GOOD' THEN 1 ELSE NULL END) as good_readings
                    FROM energy_meter em
                    WHERE em.measurement_timestamp >= DATE_SUB(CURDATE(), INTERVAL 1 DAY)
                    GROUP BY DATE(em.measurement_timestamp)
                )
                SELECT 
                    fecha,
                    promedio_watts,
                    min_watts,
                    max_watts,
                    hours_with_data,
                    actual_readings,
                    good_readings,
                    (good_readings / (? * 24)) as quality_score
                FROM DailyStats
                HAVING quality_score >= ?
                ORDER BY fecha DESC
                LIMIT 1
            `;

            const [rows] = await conn.query(query, [this.EXPECTED_READINGS_PER_HOUR, this.QUALITY_THRESHOLD]);

            for (const row of rows) {
                const secondsInDay = 86400;
                const kwh = this.wattsToKwh(row.promedio_watts, secondsInDay);
                const costo = this.calculateCost(kwh);

                await conn.query(
                    `INSERT INTO promedios_energia_dia 
                    (fecha, promedio_watts, min_watts, max_watts, kwh_consumidos, costo, 
                     hours_with_data, quality_score) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE 
                    promedio_watts = VALUES(promedio_watts),
                    min_watts = VALUES(min_watts),
                    max_watts = VALUES(max_watts),
                    kwh_consumidos = VALUES(kwh_consumidos),
                    costo = VALUES(costo),
                    hours_with_data = VALUES(hours_with_data),
                    quality_score = VALUES(quality_score)`,
                    [
                        row.fecha,
                        row.promedio_watts,
                        row.min_watts,
                        row.max_watts,
                        kwh,
                        costo,
                        row.hours_with_data,
                        row.quality_score
                    ]
                );
            }

            await conn.commit();
            console.log('✅ Promedios por día actualizados');
        } catch (error) {
            await conn.rollback();
            console.error('❌ Error al calcular promedios por día:', error);
        } finally {
            conn.release();
        }
    }

    async calculateMonthlyAverages() {
        const conn = await databaseService.pool.getConnection();
        try {
            console.log('📊 Calculando promedios por mes:', new Date().toLocaleString());
            
            await conn.beginTransaction();

            const query = `
                WITH MonthlyStats AS (
                    SELECT 
                        DATE_FORMAT(em.measurement_timestamp, '%Y-%m-01') as fecha_mes,
                        COUNT(DISTINCT DATE(em.measurement_timestamp)) as days_with_data,
                        AVG(CASE WHEN em.reading_quality = 'GOOD' THEN em.total_act_power ELSE NULL END) as promedio_watts,
                        MIN(CASE WHEN em.reading_quality = 'GOOD' THEN em.total_act_power ELSE NULL END) as min_watts,
                        MAX(CASE WHEN em.reading_quality = 'GOOD' THEN em.total_act_power ELSE NULL END) as max_watts,
                        COUNT(*) as actual_readings,
                        COUNT(CASE WHEN em.reading_quality = 'GOOD' THEN 1 ELSE NULL END) as good_readings
                    FROM energy_meter em
                    WHERE em.measurement_timestamp >= DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-01'), INTERVAL 1 MONTH)
                    GROUP BY DATE_FORMAT(em.measurement_timestamp, '%Y-%m-01')
                )
                SELECT 
                    fecha_mes,
                    promedio_watts,
                    min_watts,
                    max_watts,
                    days_with_data,
                    actual_readings,
                    good_readings,
                    (days_with_data / DAY(LAST_DAY(fecha_mes))) as quality_score
                FROM MonthlyStats
                HAVING quality_score >= ?
                ORDER BY fecha_mes DESC
                LIMIT 1
            `;

            const [rows] = await conn.query(query, [this.QUALITY_THRESHOLD]);

            for (const row of rows) {
                const daysInMonth = new Date(row.fecha_mes).getDate();
                const secondsInMonth = daysInMonth * 86400;
                const kwh = this.wattsToKwh(row.promedio_watts, secondsInMonth);
                const costo = this.calculateCost(kwh);

                await conn.query(
                    `INSERT INTO promedios_energia_mes 
                    (fecha_mes, promedio_watts, min_watts, max_watts, kwh_consumidos, costo, 
                     days_with_data, quality_score) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE 
                    promedio_watts = VALUES(promedio_watts),
                    min_watts = VALUES(min_watts),
                    max_watts = VALUES(max_watts),
                    kwh_consumidos = VALUES(kwh_consumidos),
                    costo = VALUES(costo),
                    days_with_data = VALUES(days_with_data),
                    quality_score = VALUES(quality_score)`,
                    [
                        row.fecha_mes,
                        row.promedio_watts,
                        row.min_watts,
                        row.max_watts,
                        kwh,
                        costo,
                        row.days_with_data,
                        row.quality_score
                    ]
                );
            }

            await conn.commit();
            console.log('✅ Promedios por mes actualizados');
        } catch (error) {
            await conn.rollback();
            console.error('❌ Error al calcular promedios por mes:', error);
        } finally {
            conn.release();
        }
    }

    calculateCost(kwh) {
        const precioKwh = parseFloat(databaseService.measurementConfig?.precio_kwh || 203);
        return kwh * precioKwh;
    }

    async updateAllAverages() {
        await this.calculateHourlyAverages();
        await this.calculateDailyAverages();
        await this.calculateMonthlyAverages();
    }

    startService() {
        // Cálculo inicial
        this.updateAllAverages();

        // Programar cálculos horarios
        this.jobs.hourly = schedule.scheduleJob('0 * * * *', () => {
            this.calculateHourlyAverages();
        });

        // Programar cálculos diarios
        this.jobs.daily = schedule.scheduleJob('0 0 * * *', () => {
            this.calculateDailyAverages();
        });

        // Programar cálculos mensuales
        this.jobs.monthly = schedule.scheduleJob('0 0 1 * *', () => {
            this.calculateMonthlyAverages();
        });

        console.log('✅ Servicio de promedios de energía iniciado con tareas programadas');
    }

    stopService() {
        Object.values(this.jobs).forEach(job => {
            if (job) {
                job.cancel();
            }
        });
        console.log('🛑 Servicio de promedios de energía detenido');
    }
}

module.exports = new EnergyAveragesService();