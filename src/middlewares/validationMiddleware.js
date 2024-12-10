const { ValidationError } = require('../utils/errors');
const validationUtils = require('../utils/validationUtils');
const dateUtils = require('../utils/dateUtils');

class ValidationMiddleware {
    // Middleware para validar parámetros de fecha
    validateDateParams(req, res, next) {
        try {
            const { start, end, period = 'hour' } = req.query;

            if (!start || !end) {
                throw new ValidationError('Los parámetros start y end son requeridos');
            }

            const startDate = new Date(start);
            const endDate = new Date(end);

            if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                throw new ValidationError('Fechas inválidas');
            }

            // Validar rango de fechas
            dateUtils.validateDateRange(startDate, endDate, period);

            // Añadir fechas validadas a la request
            req.validatedDates = {
                start: startDate,
                end: endDate,
                period
            };

            next();
        } catch (error) {
            next(error);
        }
    }

    // Middleware para validar datos de medición
    validateMeasurementData(req, res, next) {
        try {
            if (!req.body || !req.body.device_status) {
                throw new ValidationError('Datos de medición inválidos');
            }

            const validatedData = validationUtils.validateElectricalMeasurement(req.body.device_status['em:0'] || {});
            
            // Añadir datos validados a la request
            req.validatedMeasurement = validatedData;
            
            next();
        } catch (error) {
            next(error);
        }
    }

    // Middleware para validar parámetros de paginación
    validatePaginationParams(req, res, next) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;

            if (page < 1) {
                throw new ValidationError('El número de página debe ser mayor a 0');
            }

            if (limit < 1 || limit > 100) {
                throw new ValidationError('El límite debe estar entre 1 y 100');
            }

            // Añadir parámetros de paginación validados a la request
            req.pagination = {
                page,
                limit,
                offset: (page - 1) * limit
            };

            next();
        } catch (error) {
            next(error);
        }
    }

    // Middleware para validar ID de dispositivo
    validateDeviceId(req, res, next) {
        try {
            const deviceId = req.params.deviceId || req.body.deviceId;

            if (!deviceId) {
                throw new ValidationError('ID de dispositivo requerido');
            }

            // Validar formato del ID (ejemplo: debe ser un string de 12 caracteres hexadecimales)
            if (!/^[0-9a-fA-F]{12}$/.test(deviceId)) {
                throw new ValidationError('ID de dispositivo inválido');
            }

            req.validatedDeviceId = deviceId.toLowerCase();
            next();
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new ValidationMiddleware();