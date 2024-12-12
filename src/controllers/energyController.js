const energyAveragesService = require('../services/energy-averages-service');
const totalEnergyService = require('../services/total-energy-service');
const { ValidationError } = require('../utils/errors');

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

    // Datos más recientes y estado
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
}

module.exports = new EnergyController();