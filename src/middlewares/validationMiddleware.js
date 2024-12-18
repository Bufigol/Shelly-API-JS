const { ValidationError } = require('../utils/errors');
const dateUtils = require('../utils/dateUtils');
const { DateTime } = require('luxon'); 

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

    validateDateParams(req, res, next) {
        try {
            const date = req.params.date;

            if (!date) {
                throw new ValidationError('El parámetro date es requerido');
            }

            // Crear fecha en zona horaria de Santiago
            const parsedDate = DateTime.fromFormat(date, 'yyyy-MM-dd', { zone: 'America/Santiago' });
            
            if (!parsedDate.isValid) {
                throw new ValidationError('Fecha inválida');
            }

            // Obtener inicio y fin del día en hora local
            const startOfDay = parsedDate.startOf('day');
            const endOfDay = parsedDate.endOf('day');

            req.validatedDates = {
                start: startOfDay.toJSDate(),
                end: endOfDay.toJSDate(),
                date: parsedDate.toFormat('yyyy-MM-dd')
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