const databaseService = require('../services/database-service');

class SystemController {
    async getSystemStatus(req, res, next) {
        try {
            const status = {
                server: {
                    uptime: process.uptime(),
                    memory: process.memoryUsage(),
                    timestamp: new Date()
                },
                database: {
                    connected: await databaseService.testConnection(),
                    status: await databaseService.getDatabaseStatus()
                },
                services: {
                    energyAverages: {
                        status: 'operational',
                        lastUpdate: await databaseService.getLastCalculationTime('averages')
                    },
                    totalEnergy: {
                        status: 'operational',
                        lastUpdate: await databaseService.getLastCalculationTime('totals')
                    }
                }
            };

            res.json({ data: status });
        } catch (error) {
            next(error);
        }
    }

    async getSystemMetrics(req, res, next) {
        try {
            const { start, end } = req.validatedDates;
            const metrics = await databaseService.getSystemMetrics(start, end);
            res.json({ data: metrics });
        } catch (error) {
            next(error);
        }
    }

    async getDataQualityStats(req, res, next) {
        try {
            const { start, end } = req.validatedDates;
            const stats = await databaseService.getDataQualityStats(start, end);
            res.json({ data: stats });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new SystemController();