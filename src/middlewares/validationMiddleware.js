const { ValidationError } = require("../utils/errors");
const dateUtils = require("../utils/dateUtils");
const { DateTime } = require("luxon");

class ValidationMiddleware {
    // Mantener el método existente para validar rangos de fecha
    validateDateRangeParams(req, res, next) {
        try {
            const { start, end, period = "hour" } = req.query;

            if (!start || !end) {
                throw new ValidationError("Los parámetros start y end son requeridos");
            }

            const startDate = new Date(start);
            const endDate = new Date(end);

            if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                throw new ValidationError("Fechas inválidas");
            }

            dateUtils.validateDateRange(startDate, endDate, period);

            req.validatedDates = {
                start: startDate,
                end: endDate,
                period,
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
                throw new ValidationError("El parámetro date es requerido");
            }

            // Crear fecha en zona horaria de Santiago
            const parsedDate = DateTime.fromFormat(date, "yyyy-MM-dd", {
                zone: "America/Santiago",
            });

            if (!parsedDate.isValid) {
                throw new ValidationError("Fecha inválida");
            }

            // Obtener inicio y fin del día en hora local
            const startOfDay = parsedDate.startOf("day");
            const endOfDay = parsedDate.endOf("day");

            req.validatedDates = {
                start: startOfDay.toJSDate(),
                end: endOfDay.toJSDate(),
                date: parsedDate.toFormat("yyyy-MM-dd"),
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
                throw new ValidationError("ID de dispositivo requerido");
            }

            if (!/^[0-9a-fA-F]{12}$/.test(deviceId)) {
                throw new ValidationError("ID de dispositivo inválido");
            }

            req.validatedDeviceId = deviceId.toLowerCase();
            next();
        } catch (error) {
            next(error);
        }
    }

    validateMonthParams(req, res, next) {
        try {
            const month = req.params.month;

            if (!month) {
                throw new ValidationError("El parámetro month es requerido");
            }

            // Crear fecha en zona horaria de Santiago
            const parsedDate = DateTime.fromFormat(month, "yyyy-MM-dd", {
                zone: "America/Santiago",
            });

            if (!parsedDate.isValid) {
                throw new ValidationError("Fecha inválida, formato YYYY-MM-DD");
            }

            // Obtener inicio y fin del mes en hora local
            const startOfMonth = parsedDate.startOf("month");
            const endOfMonth = parsedDate.endOf("month");

            req.validatedDates = {
                start: startOfMonth.toJSDate(),
                end: endOfMonth.toJSDate(),
                date: parsedDate.toFormat("yyyy-MM-dd"),
            };

            next();
        } catch (error) {
            next(error);
        }
    }

    validateYearParams(req, res, next) {
        try {
            const year = parseInt(req.params.year);

            if (!year || isNaN(year)) {
                throw new ValidationError(
                    "El parámetro year debe ser un número entero"
                );
            }

            // Validar que el año sea razonable (entre 2000 y el año actual + 1)
            const currentYear = DateTime.now().setZone("America/Santiago").year;
            if (year < 2000 || year > currentYear + 1) {
                throw new ValidationError(
                    `El año debe estar entre 2000 y ${currentYear + 1}`
                );
            }

            // Crear fechas de inicio y fin del año en zona horaria de Santiago
            const startOfYear = DateTime.fromObject(
                { year, month: 1, day: 1 },
                { zone: "America/Santiago" }
            ).startOf("year");

            const endOfYear = DateTime.fromObject(
                { year, month: 12, day: 31 },
                { zone: "America/Santiago" }
            ).endOf("year");

            req.validatedDates = {
                start: startOfYear.toJSDate(),
                end: endOfYear.toJSDate(),
                year: year.toString(),
            };

            next();
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new ValidationMiddleware();