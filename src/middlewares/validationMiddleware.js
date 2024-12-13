const { ValidationError } = require('../utils/errors');
const dateUtils = require('../utils/dateUtils');

class ValidationMiddleware {
    // Mantener el método existente para validar rangos de fecha
    validateDateRangeParams(req, res, next) {
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

            dateUtils.validateDateRange(startDate, endDate, period);

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

    // Nuevo método para validar una única fecha
    validateDateParams(req, res, next) {
        try {
            const date = req.params.date;

            if (!date) {
                throw new ValidationError('El parámetro date es requerido');
            }

            const parsedDate = new Date(date);
            if (isNaN(parsedDate.getTime())) {
                throw new ValidationError('Fecha inválida');
            }

            // Obtener el rango del día completo
            const startOfDay = new Date(parsedDate);
            startOfDay.setHours(0, 0, 0, 0);

            const endOfDay = new Date(parsedDate);
            endOfDay.setHours(23, 59, 59, 999);

            // Si es el día actual, usar la hora actual como fin
            const now = new Date();
            if (endOfDay > now) {
                endOfDay.setTime(now.getTime());
            }

            req.validatedDates = {
                start: startOfDay,
                end: endOfDay,
                date: parsedDate
            };

            next();
        } catch (error) {
            next(error);
        }
    }

    // Método para validar ID de dispositivo
    validateDeviceId(req, res, next) {
        try {
            const deviceId = req.params.shellyId;

            if (!deviceId) {
                throw new ValidationError('ID de dispositivo requerido');
            }

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