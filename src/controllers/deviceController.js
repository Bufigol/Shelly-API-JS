const databaseService = require('../services/database-service');
const { DeviceError, NotFoundError } = require('../utils/errors');
const { transformUtils } = require('../utils');

class DeviceController {
    async getLatestStatus(req, res, next) {
        try {
            const status = await databaseService.getLatestStatus();
            if (!status) {
                throw new NotFoundError('No se encontró estado del dispositivo');
            }
            res.json(transformUtils.transformApiResponse(status));
        } catch (error) {
            next(error);
        }
    }

    async getStatusHistory(req, res, next) {
        try {
            const { hours = 24 } = req.query;
            const history = await databaseService.getHistory(parseInt(hours));
            res.json(transformUtils.transformApiResponse(history));
        } catch (error) {
            next(error);
        }
    }

    async insertDeviceStatus(req, res, next) {
        try {
            const result = await databaseService.insertDeviceStatus(req.validatedMeasurement);
            res.status(201).json(transformUtils.transformApiResponse(result));
        } catch (error) {
            next(error);
        }
    }

    async getDeviceConfig(req, res, next) {
        try {
            const { deviceId } = req.params;
            const config = await databaseService.getDeviceConfig(deviceId);
            if (!config) {
                throw new NotFoundError('Configuración no encontrada', deviceId);
            }
            res.json(transformUtils.transformApiResponse(config));
        } catch (error) {
            next(error);
        }
    }

    async updateDeviceConfig(req, res, next) {
        try {
            const { deviceId } = req.params;
            const result = await databaseService.updateDeviceConfig(deviceId, req.body);
            res.json(transformUtils.transformApiResponse(result));
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new DeviceController();