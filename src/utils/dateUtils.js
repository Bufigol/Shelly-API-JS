const luxon = require('luxon');

class DateUtils {
    constructor() {
        this.defaultTimezone = 'America/Santiago';
    }

    /**
     * Convierte una fecha UTC a la zona horaria local
     */
    utcToLocal(utcDate, timezone = this.defaultTimezone) {
        return luxon.DateTime
            .fromJSDate(utcDate)
            .setZone(timezone);
    }

    /**
     * Convierte una fecha local a UTC
     */
    localToUtc(localDate, timezone = this.defaultTimezone) {
        return luxon.DateTime
            .fromJSDate(localDate)
            .setZone(timezone)
            .toUTC();
    }

    /**
     * Obtiene el inicio del período actual
     */
    getPeriodStart(date, period = 'hour') {
        const dt = luxon.DateTime.fromJSDate(date);
        switch (period.toLowerCase()) {
            case 'hour':
                return dt.startOf('hour');
            case 'day':
                return dt.startOf('day');
            case 'month':
                return dt.startOf('month');
            default:
                throw new Error('Período no válido');
        }
    }

    /**
     * Obtiene el fin del período actual
     */
    getPeriodEnd(date, period = 'hour') {
        const dt = luxon.DateTime.fromJSDate(date);
        switch (period.toLowerCase()) {
            case 'hour':
                return dt.endOf('hour');
            case 'day':
                return dt.endOf('day');
            case 'month':
                return dt.endOf('month');
            default:
                throw new Error('Período no válido');
        }
    }

    /**
     * Valida el rango de fechas para un período dado
     */
    validateDateRange(startDate, endDate, period = 'hour') {
        if (!startDate || !endDate) {
            throw new Error('Las fechas de inicio y fin son requeridas');
        }

        const start = luxon.DateTime.fromJSDate(startDate);
        const end = luxon.DateTime.fromJSDate(endDate);

        if (!start.isValid || !end.isValid) {
            throw new Error('Fechas inválidas');
        }

        if (end < start) {
            throw new Error('La fecha de fin debe ser posterior a la fecha de inicio');
        }

        const diff = end.diff(start);
        switch (period.toLowerCase()) {
            case 'hour':
                if (diff.as('hours') > 24) {
                    throw new Error('El rango para consultas horarias no puede exceder 24 horas');
                }
                break;
            case 'day':
                if (diff.as('days') > 31) {
                    throw new Error('El rango para consultas diarias no puede exceder 31 días');
                }
                break;
            case 'month':
                if (diff.as('months') > 12) {
                    throw new Error('El rango para consultas mensuales no puede exceder 12 meses');
                }
                break;
        }

        return true;
    }

    /**
     * Formatea una fecha según el formato especificado
     */
    formatDate(date, format = 'yyyy-MM-dd HH:mm:ss', timezone = this.defaultTimezone) {
        return luxon.DateTime
            .fromJSDate(date)
            .setZone(timezone)
            .toFormat(format);
    }
}

module.exports = new DateUtils();