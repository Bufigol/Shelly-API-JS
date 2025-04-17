// src/tests/reconexión/helpers/timeHelpers.js
const moment = require('moment-timezone');
const mockNow = require('jest-mock-now');
const notificationController = require('../../../controllers/notificationController');

/**
 * Configura un momento específico del tiempo para pruebas
 * @param {Object} options - Opciones para configurar el tiempo
 * @param {number} options.day - Día de la semana (0=Domingo, 1=Lunes, ..., 6=Sábado)
 * @param {number} options.hour - Hora del día (0-23)
 * @param {number} options.minute - Minutos (0-59)
 * @param {string} options.timezone - Zona horaria (por defecto "America/Santiago")
 * @returns {Date} La fecha configurada
 */
function setTestTime(options) {
    const {
        day = 1, // Por defecto: Lunes
        hour = 10, // Por defecto: 10:00 AM
        minute = 0,
        timezone = notificationController.timeZone
    } = options;

    // Crear una fecha para la semana actual
    const now = moment().tz(timezone);
    const currentDay = now.day();

    // Ajustar al día de la semana requerido
    let daysToAdjust = day - currentDay;
    // Ajuste para asegurar que siempre vaya hacia el futuro o sea el mismo día
    // Si daysToAdjust es negativo, suma 7 para ir a la semana siguiente.
    // Si es 0, se queda en el día actual.
    if (daysToAdjust < 0) {
        daysToAdjust += 7;
    } else if (daysToAdjust === 0 && moment().tz(timezone).hour() > hour) {
        // Si es el mismo día pero la hora actual ya pasó la hora objetivo, avanza una semana
        daysToAdjust += 7;
    } else if (daysToAdjust === 0 && moment().tz(timezone).hour() === hour && moment().tz(timezone).minute() >= minute) {
        // Si es el mismo día, misma hora, pero el minuto actual ya pasó o es igual, avanza una semana
        daysToAdjust += 7;
    }


    const targetDate = moment().tz(timezone) // Empieza desde ahora para el ajuste correcto
        .add(daysToAdjust, 'days')
        .hour(hour)
        .minute(minute)
        .second(0)
        .millisecond(0);

    // Aplicar el mock
    const mockDate = new Date(targetDate.valueOf());
    mockNow(mockDate); // Establece Date.now() a este valor
    console.log(`🕒 Tiempo de prueba configurado: ${targetDate.format('dddd, YYYY-MM-DD HH:mm:ss z')}`);

    return mockDate;
}

/**
 * Configura un momento dentro del horario laboral
 * @param {Object} options - Opciones adicionales (día, minutos, etc.)
 * @returns {Date} La fecha configurada
 */
function setWithinWorkingHours(options = {}) {
    // Para L-V usar 11:00 AM (claramente dentro del horario)
    // Para sábado usar 10:00 AM (dentro del horario de sábado)
    const day = options.day || (options.saturday ? 6 : 3); // Miércoles por defecto, o sábado si se especifica
    const hour = options.hour || (day === 6 ? 10 : 11); // 11 AM para L-V, 10 AM para sábado

    const date = setTestTime({ day, hour, minute: options.minute || 0 });

    // Verificar que realmente queda dentro del horario laboral
    if (!notificationController.isWithinWorkingHours(date)) {
        console.warn(`⚠️ La fecha configurada NO está dentro del horario laboral: ${moment(date).format('dddd HH:mm')}`);
        console.warn(`   Horario L-V: ${notificationController.workingHours.weekdays.start}-${notificationController.workingHours.weekdays.end}, Sáb: ${notificationController.workingHours.saturday.start}-${notificationController.workingHours.saturday.end}`);
    }

    return date;
}

/**
 * Configura un momento fuera del horario laboral
 * @param {Object} options - Opciones adicionales (día, hora, etc.)
 * @returns {Date} La fecha configurada
 */
function setOutsideWorkingHours(options = {}) {
    let day = options.day;
    let hour = options.hour;

    // Si no se especifica, usar valores por defecto según la estrategia:
    if (day === undefined) {
        if (options.sunday) {
            day = 0; // Domingo (siempre fuera del horario)
            hour = hour !== undefined ? hour : 14; // 2 PM por defecto
        } else if (options.evening) {
            day = 2; // Martes por defecto
            hour = hour !== undefined ? hour : 20; // 8 PM (después del horario)
        } else if (options.earlyMorning) {
            day = 4; // Jueves por defecto
            hour = hour !== undefined ? hour : 6; // 6 AM (antes del horario)
        } else if (options.saturday) {
            day = 6; // Sábado
            hour = hour !== undefined ? hour : 16; // 4 PM (después del horario de sábado)
        } else {
            // Si no se especifica ninguna estrategia, usar domingo por defecto
            day = 0;
            hour = hour !== undefined ? hour : 14;
        }
    }

    // Si después de todo esto sigue sin definirse la hora, usar 22:00
    hour = hour !== undefined ? hour : 22;

    const date = setTestTime({ day, hour, minute: options.minute || 0 });

    // Verificar que realmente queda fuera del horario laboral
    if (notificationController.isWithinWorkingHours(date)) {
        console.warn(`⚠️ La fecha configurada está DENTRO del horario laboral: ${moment(date).format('dddd HH:mm')}`);
        console.warn(`   Horario L-V: ${notificationController.workingHours.weekdays.start}-${notificationController.workingHours.weekdays.end}, Sáb: ${notificationController.workingHours.saturday.start}-${notificationController.workingHours.saturday.end}`);
    }

    return date;
}

/**
 * Avanza el tiempo un número específico de minutos desde un tiempo base.
 * Actualiza el mock global de Date.now().
 * @param {number} minutes - Minutos a avanzar.
 * @param {Date} baseTime - El tiempo base (objeto Date) desde el cual avanzar.
 * @returns {Date} La nueva fecha/hora mockeada.
 */
function advanceTimeByMinutes(minutes, baseTime) { // <-- Añadido baseTime
    if (!baseTime || !(baseTime instanceof Date)) {
        throw new Error("advanceTimeByMinutes requiere un baseTime válido (objeto Date).");
    }
    // Crear una nueva fecha basada en el tiempo base para evitar mutaciones
    const currentTime = new Date(baseTime.getTime());

    // Calcular el nuevo tiempo
    const newTime = new Date(currentTime.getTime() + minutes * 60000);

    // Aplicar el mock al tiempo global
    mockNow(newTime);
    console.log(`⏩ Tiempo avanzado ${minutes} minutos desde ${moment(baseTime).format('HH:mm:ss')} -> ${moment(newTime).format('YYYY-MM-DD HH:mm:ss')}`);
    return newTime;
}

/**
 * Avanza el tiempo a la siguiente hora exacta desde un tiempo base.
 * Actualiza el mock global de Date.now().
 * @param {Date} baseTime - El tiempo base (objeto Date) desde el cual avanzar.
 * @returns {Date} La nueva fecha/hora mockeada (inicio de la próxima hora).
 */
function advanceToNextHour(baseTime) { // <-- Añadido baseTime
    if (!baseTime || !(baseTime instanceof Date)) {
        throw new Error("advanceToNextHour requiere un baseTime válido (objeto Date).");
    }
    // Usar moment con el tiempo base para los cálculos
    const nextHourMoment = moment(baseTime) // <-- Usar baseTime
        .add(1, 'hour')
        .minute(0)
        .second(0)
        .millisecond(0);

    const newTime = nextHourMoment.toDate();

    // Aplicar el mock al tiempo global
    mockNow(newTime);
    console.log(`⏩ Tiempo avanzado a la siguiente hora desde ${moment(baseTime).format('HH:mm:ss')} -> ${moment(newTime).format('YYYY-MM-DD HH:mm:00')}`);
    return newTime;
}

module.exports = {
    setTestTime,
    setWithinWorkingHours,
    setOutsideWorkingHours,
    advanceTimeByMinutes,
    advanceToNextHour
};