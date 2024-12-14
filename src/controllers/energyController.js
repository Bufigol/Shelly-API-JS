const databaseService = require('../services/database-service');
const energyAveragesService = require('../services/energy-averages-service');
const totalEnergyService = require('../services/total-energy-service');
const { ValidationError } = require('../utils/errors');
const { DateTime } = require('luxon');

class EnergyController {
    // Promedios
    async getHourlyAverages(req, res, next) {
        try {
            const { start, end } = req.validatedDates;
            const data = await energyAveragesService.getHourlyAverages(start, end);
            res.json({ data, timestamp: new Date() });
        } catch (error) {
            next(error);
        }
    }

    async getDailyAverages(req, res, next) {
        try {
            const { start, end } = req.validatedDates;
            const data = await energyAveragesService.getDailyAverages(start, end);
            res.json({ data, timestamp: new Date() });
        } catch (error) {
            next(error);
        }
    }

    async getMonthlyAverages(req, res, next) {
        try {
            const { start, end } = req.validatedDates;
            const data = await energyAveragesService.getMonthlyAverages(start, end);
            res.json({ data, timestamp: new Date() });
        } catch (error) {
            next(error);
        }
    }

    // Totales
    async getHourlyTotals(req, res, next) {
        try {
            const { start, end } = req.validatedDates;
            const data = await totalEnergyService.getHourlyTotals(start, end);
            res.json({ data, timestamp: new Date() });
        } catch (error) {
            next(error);
        }
    }

    async getDailyTotals(req, res, next) {
        try {
            const { start, end } = req.validatedDates;
            const data = await totalEnergyService.getDailyTotals(start, end);
            res.json({ data, timestamp: new Date() });
        } catch (error) {
            next(error);
        }
    }

    async getMonthlyTotals(req, res, next) {
        try {
            const { start, end } = req.validatedDates;
            const data = await totalEnergyService.getMonthlyTotals(start, end);
            res.json({ data, timestamp: new Date() });
        } catch (error) {
            next(error);
        }
    }

    async getLatestData(req, res, next) {
        try {
            const totals = await totalEnergyService.getLatestAggregations();
            res.json({ data: totals, timestamp: new Date() });
        } catch (error) {
            next(error);
        }
    }

    async getExecutionStatus(req, res, next) {
        try {
            const status = await energyAveragesService.getLatestExecutionStatus();
            res.json({ data: status, timestamp: new Date() });
        } catch (error) {
            next(error);
        }
    }

    async getDailyConsumption(req, res, next) {
        try {
            const { start, end } = req.validatedDates;
    
            const query = `
                SELECT 
                    d.shelly_id,
                    d.nombre as device_name,
                    d.ubicacion as location,
                    DATE_FORMAT(
                        DATE_SUB(m.timestamp_local, 
                                INTERVAL MOD(MINUTE(m.timestamp_local), 5) MINUTE
                        ), 
                        '%Y-%m-%d %H:%i:00'
                    ) as interval_start,
                    COALESCE(ROUND(AVG(m.potencia_activa) / 1000, 3), 0) as potencia_promedio_kw,
                    COALESCE(ROUND(AVG(m.potencia_activa) * 300 / (3600 * 1000), 6), 0) as consumo_kwh
                FROM sem_mediciones m
                JOIN sem_dispositivos d ON m.shelly_id = d.shelly_id
                WHERE d.activo = 1
                    AND m.fase = 'TOTAL'
                    AND m.timestamp_local >= ?
                    AND m.timestamp_local < ?
                GROUP BY 
                    d.shelly_id,
                    d.nombre,
                    d.ubicacion,
                    DATE_FORMAT(
                        DATE_SUB(m.timestamp_local, 
                                INTERVAL MOD(MINUTE(m.timestamp_local), 5) MINUTE
                        ),
                        '%Y-%m-%d %H:%i:00'
                    )
                ORDER BY d.shelly_id, interval_start`;
    
            const [rows] = await databaseService.pool.query(query, [start, end]);
            const deviceData = this.processConsumptionData(rows);
    
            res.json({
                success: true,
                date: req.params.date,
                start: start,
                end: end,
                data: deviceData
            });
    
        } catch (error) {
            next(error);
        }
    }

    async downloadDeviceData(req, res, next) {
        try {
            const { shellyId } = req.params;
            const dateParam = req.params.date;
            
            // Configurar fechas en zona horaria de Santiago
            const startOfDay = DateTime.fromFormat(dateParam, 'yyyy-MM-dd', { zone: 'America/Santiago' })
                .startOf('day');
            const endOfDay = startOfDay.plus({ days: 1 }).minus({ seconds: 1 });

            console.log('Procesando descarga:', {
                dateParam,
                startOfDay: startOfDay.toFormat('yyyy-MM-dd HH:mm:ss'),
                endOfDay: endOfDay.toFormat('yyyy-MM-dd HH:mm:ss')
            });

            // Verificar dispositivo
            const [deviceInfo] = await databaseService.pool.query(
                'SELECT nombre as device_name, ubicacion as location FROM sem_dispositivos WHERE shelly_id = ?',
                [shellyId]
            );

            if (deviceInfo.length === 0) {
                throw new ValidationError('Dispositivo no encontrado');
            }

            // Configurar respuesta
            const fileName = `${deviceInfo[0].device_name}_${deviceInfo[0].location}_${startOfDay.toFormat('yyyy-MM-dd')}.csv`;
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
            // Actualizado el encabezado para reflejar kW
            res.write('Timestamp,Potencia Promedio (kW),Consumo (kWh)\n');

            // Query principal optimizada con conversión a kW
            const query = `
                SELECT 
                    DATE_FORMAT(?, '%Y-%m-%d %H:%i:00') as interval_start,
                    COALESCE(ROUND(AVG(m.potencia_activa) / 1000, 3), 0) as potencia_promedio_kw,
                    COALESCE(ROUND(AVG(m.potencia_activa) * 300 / (3600 * 1000), 6), 0) as consumo_kwh
                FROM sem_mediciones m
                WHERE m.shelly_id = ?
                    AND m.fase = 'TOTAL'
                    AND m.timestamp_local >= ?
                    AND m.timestamp_local < ?
                GROUP BY 1`;

            // Procesar intervalos de 5 minutos
            let currentInterval = startOfDay;
            let processedIntervals = 0;

            while (currentInterval < endOfDay) {
                const intervalEnd = currentInterval.plus({ minutes: 5 });
                
                const [data] = await databaseService.pool.query(query, [
                    currentInterval.toFormat('yyyy-MM-dd HH:mm:ss'),
                    shellyId,
                    currentInterval.toFormat('yyyy-MM-dd HH:mm:ss'),
                    intervalEnd.toFormat('yyyy-MM-dd HH:mm:ss')
                ]);

                // Convertir explícitamente a números y manejar valores nulos
                const potenciaKw = Number(data[0]?.potencia_promedio_kw || 0);
                const consumo = Number(data[0]?.consumo_kwh || 0);
                
                const line = `${currentInterval.toFormat('yyyy-MM-dd HH:mm:ss')},${potenciaKw.toFixed(3)},${consumo.toFixed(6)}\n`;
                res.write(line);

                currentInterval = intervalEnd;
                processedIntervals++;

                // Log de progreso cada 60 intervalos (5 horas)
                if (processedIntervals % 60 === 0) {
                    console.log(`Progreso: ${processedIntervals} intervalos procesados`);
                }
            }

            res.end();
            console.log('Descarga completada:', fileName, `- Total intervalos: ${processedIntervals}`);

        } catch (error) {
            if (!res.headersSent) {
                next(error);
            } else {
                console.error('Error durante la descarga:', error);
                res.end();
            }
        }
    }

    processConsumptionData(rows) {
        return rows.reduce((acc, row) => {
            if (!acc[row.shelly_id]) {
                acc[row.shelly_id] = {
                    device_name: row.device_name,
                    location: row.location,
                    data: []
                };
            }
    
            acc[row.shelly_id].data.push({
                timestamp: row.interval_start,
                potencia_kw: row.potencia_promedio_kw,
                consumo_kwh: row.consumo_kwh
            });
    
            return acc;
        }, {});
    }
}

module.exports = new EnergyController();