// src\tests\reconexión\helpers_test.test.js
const notificationController = require('../../controllers/notificationController');
const moment = require('moment-timezone');
const {
    setTestTime,
    setWithinWorkingHours,
    setOutsideWorkingHours,
    advanceTimeByMinutes,
    advanceToNextHour
} = require('./helpers/timeHelpers'); // Asegúrate que la ruta es correcta
const {
    resetDatabaseState,
    updateChannelState,
    getChannelState,
    getTemperatureThresholds
} = require('./helpers/dbHelpers'); // Asegúrate que la ruta es correcta

// Configuración utilizará automáticamente el setup.js

describe('Pruebas de configuración y helpers', () => {
    // Variables para pruebas
    const TEST_CHANNEL_ID = '9999'; // Canal de integración (string)
    const TEST_CHANNEL_NAME = 'Canal de integración';

    describe('Helpers de Base de Datos', () => {
        test('Debe poder obtener el estado de un canal', async () => {
            const channelState = await getChannelState(TEST_CHANNEL_ID);

            // Verificar que existe y tiene las propiedades esperadas
            expect(channelState).toBeDefined();
            // Comprobar que el ID recibido (probablemente número) coincide con el ID de test (convertido a número)
            expect(channelState.channel_id).toBe(Number(TEST_CHANNEL_ID));
            expect(channelState.name).toBe(TEST_CHANNEL_NAME);
            expect(channelState.esOperativa).toBe(1); // Debería ser operativo según los datos proporcionados
        });

        test('Debe poder actualizar y restaurar el estado de un canal', async () => {
            // Usar Date.now() mockeado si existe, o el real si no
            const nowMockedOrReal = new Date(Date.now());
            // Actualizar estado del canal a offline
            await updateChannelState(TEST_CHANNEL_ID, true, nowMockedOrReal, null);

            // Verificar actualización
            let updatedState = await getChannelState(TEST_CHANNEL_ID);
            expect(updatedState.is_currently_out_of_range).toBe(1);

            // 1. Crea una fecha esperada SIN milisegundos, igual que como se guarda en BD
            const expectedTimeAtSecondLevel = new Date(nowMockedOrReal);
            expectedTimeAtSecondLevel.setMilliseconds(0); // Pone los milisegundos a cero

            // 2. Compara los timestamps a nivel de segundo. Ahora deberían ser iguales.
            //    Usamos toBe porque esperamos una coincidencia exacta al mismo nivel de precisión.
            expect(new Date(updatedState.out_of_range_since).getTime())
                .toBe(expectedTimeAtSecondLevel.getTime());

            expect(updatedState.last_alert_sent).toBeNull();

            // Restaurar estado (esto lo hará el afterEach, pero lo hacemos explícito aquí también para probar el helper)
            await resetDatabaseState();

            // Verificar restauración
            updatedState = await getChannelState(TEST_CHANNEL_ID);
            expect(updatedState.is_currently_out_of_range).toBe(0);
            expect(updatedState.out_of_range_since).toBeNull();
            expect(updatedState.last_alert_sent).toBeNull();
        });

        test('Debe poder obtener los umbrales de temperatura de un canal', async () => {
            // Canal 9999 tiene id_parametrizacion = 7 (Grupo 1 camaras de frio resto), -21.00, 15.00
            const thresholds = await getTemperatureThresholds(TEST_CHANNEL_ID);

            expect(thresholds).toBeDefined();
            expect(thresholds.minThreshold).toBe(-21.00);
            expect(thresholds.maxThreshold).toBe(15.00);

            // Probar con el otro canal (694209, parametrización 8) -> '694209' es string
            const thresholds2 = await getTemperatureThresholds('694209');
            expect(thresholds2).toBeDefined();
            expect(thresholds2.minThreshold).toBe(-1.00);
            expect(thresholds2.maxThreshold).toBe(5.00);
        });
    });

    describe('Helpers de Tiempo', () => {
        test('Debe poder establecer un momento específico del tiempo', () => {
            // Configurar para un miércoles a las 14:30
            const testDate = setTestTime({ day: 3, hour: 14, minute: 30 });

            // Verificar que la fecha se configuró correctamente
            expect(testDate).toBeInstanceOf(Date);
            expect(moment(testDate).tz(notificationController.timeZone).day()).toBe(3); // Miércoles
            expect(moment(testDate).tz(notificationController.timeZone).hour()).toBe(14);
            expect(moment(testDate).tz(notificationController.timeZone).minute()).toBe(30);

            // Verificar que Date.now() refleja la fecha mockeada
            expect(Date.now()).toBe(testDate.getTime());
        });

        test('Debe poder configurar un momento dentro del horario laboral', () => {
            // Configurar para un día entre semana dentro del horario laboral (Miércoles 11:00)
            const workingDate = setWithinWorkingHours(); // Usa defaults

            // Verificar que está dentro del horario laboral usando el método del controlador
            const isWithin = notificationController.isWithinWorkingHours(workingDate);
            expect(isWithin).toBe(true);
            expect(moment(workingDate).tz(notificationController.timeZone).day()).toBe(3); // Miércoles
            expect(moment(workingDate).tz(notificationController.timeZone).hour()).toBe(11);

            // Verificar específicamente para un sábado (Sábado 10:00)
            const saturdayWorkingDate = setWithinWorkingHours({ saturday: true });
            const isSaturdayWithin = notificationController.isWithinWorkingHours(saturdayWorkingDate);

            expect(moment(saturdayWorkingDate).tz(notificationController.timeZone).day()).toBe(6); // Sábado
            expect(moment(saturdayWorkingDate).tz(notificationController.timeZone).hour()).toBe(10);
            expect(isSaturdayWithin).toBe(true);
        });

        test('Debe poder configurar un momento fuera del horario laboral', () => {
            // Probar diversas formas de configurar momentos fuera del horario

            // 1. Domingo (Domingo 14:00 por defecto)
            const sundayDate = setOutsideWorkingHours({ sunday: true });
            expect(moment(sundayDate).tz(notificationController.timeZone).day()).toBe(0); // Domingo
            expect(notificationController.isWithinWorkingHours(sundayDate)).toBe(false);

            // 2. Noche (Martes 20:00 por defecto)
            const eveningDate = setOutsideWorkingHours({ evening: true });
            const eveningMoment = moment(eveningDate).tz(notificationController.timeZone);
            expect(eveningMoment.hour()).toBe(20);
            expect(eveningMoment.day()).toBe(2); // Martes
            expect(notificationController.isWithinWorkingHours(eveningDate)).toBe(false);

            // 3. Madrugada (Jueves 06:00 por defecto)
            const morningDate = setOutsideWorkingHours({ earlyMorning: true });
            const morningMoment = moment(morningDate).tz(notificationController.timeZone);
            expect(morningMoment.hour()).toBe(6);
            expect(morningMoment.day()).toBe(4); // Jueves
            expect(notificationController.isWithinWorkingHours(morningDate)).toBe(false);

            // 4. Sábado tarde (Sábado 16:00 por defecto)
            const saturdayEveningDate = setOutsideWorkingHours({ saturday: true });
            const saturdayMoment = moment(saturdayEveningDate).tz(notificationController.timeZone);
            expect(saturdayMoment.day()).toBe(6); // Sábado
            expect(saturdayMoment.hour()).toBe(16);
            expect(notificationController.isWithinWorkingHours(saturdayEveningDate)).toBe(false);
        });

        test('Debe poder avanzar el tiempo por minutos', () => {
            // Establecer tiempo base
            const baseTime = setTestTime({ day: 2, hour: 12, minute: 0 }); // Martes 12:00

            // Avanzar 45 minutos desde el tiempo base
            const advancedTime = advanceTimeByMinutes(45, baseTime); // <-- Pasar baseTime

            // Verificar avance usando moment para chequear las partes
            const advancedMoment = moment(advancedTime).tz(notificationController.timeZone);
            expect(advancedMoment.hour()).toBe(12); // Hora no debe cambiar
            expect(advancedMoment.minute()).toBe(45); // Minutos deben ser 45
            expect(advancedMoment.day()).toBe(2); // Día debe seguir siendo Martes

            // Verificar que Date.now() global refleja la fecha mockeada avanzada
            expect(Date.now()).toBe(advancedTime.getTime());
        });

        test('Debe poder avanzar a la siguiente hora exacta', () => {
            // Establecer tiempo base (hora no exacta)
            const baseTime = setTestTime({ day: 4, hour: 9, minute: 45 }); // Jueves 09:45

            // Avanzar a la siguiente hora desde el tiempo base
            const nextHourTime = advanceToNextHour(baseTime); // <-- Pasar baseTime

            // Verificar que avanzó a las 10:00 usando moment
            const nextHourMoment = moment(nextHourTime).tz(notificationController.timeZone);
            expect(nextHourMoment.hour()).toBe(10); // Debe ser las 10
            expect(nextHourMoment.minute()).toBe(0); // Debe ser :00
            expect(nextHourMoment.second()).toBe(0); // Debe ser :00
            expect(nextHourMoment.day()).toBe(4); // Debe seguir siendo Jueves

            // Verificar que Date.now() global refleja la fecha mockeada avanzada
            expect(Date.now()).toBe(nextHourTime.getTime());
        });
    });

    describe('Estado del NotificationController', () => {
        // Guardamos una copia limpia aquí también por si acaso setup.js tuviera problemas
        let initialBuffers;
        beforeAll(() => {
            initialBuffers = {
                temperatureAlertsByHour: JSON.parse(JSON.stringify(notificationController.temperatureAlertsByHour)),
                disconnectionAlertsByHour: JSON.parse(JSON.stringify(notificationController.disconnectionAlertsByHour)),
                tempAlertCounters: JSON.parse(JSON.stringify(notificationController.tempAlertCounters))
            };
        });

        test('Debe poder restaurar los buffers del NotificationController', async () => {
            // Obtener la clave de hora actual (según el tiempo mockeado si existe)
            const hourKey = notificationController.getHourKey(new Date(Date.now()));

            // Modificar los buffers (asegurándonos de que no estén vacíos por defecto)
            notificationController.disconnectionAlertsByHour['test_key_disconnect'] = { data: 'disconnect' };
            notificationController.temperatureAlertsByHour['test_key_temp'] = { data: 'temp' };
            notificationController.tempAlertCounters['test_counter'] = 1;

            // Añadir datos específicos para este test
            notificationController.disconnectionAlertsByHour[hourKey] = {
                [TEST_CHANNEL_ID]: [
                    { event: 'disconnected', timestamp: new Date().toISOString(), channelId: TEST_CHANNEL_ID, channelName: TEST_CHANNEL_NAME }
                ]
            };
            notificationController.temperatureAlertsByHour[hourKey] = {
                [TEST_CHANNEL_ID]: [
                    {
                        channelId: TEST_CHANNEL_ID, channelName: TEST_CHANNEL_NAME, temperature: -25,
                        timestamp: new Date().toISOString(), minThreshold: -21, maxThreshold: 15
                    }
                ]
            };

            // Verificar que los buffers tienen *algún* dato (no necesariamente solo los añadidos)
            expect(Object.keys(notificationController.disconnectionAlertsByHour).length).toBeGreaterThan(0);
            expect(Object.keys(notificationController.temperatureAlertsByHour).length).toBeGreaterThan(0);

            // Simular la acción de afterEach para los buffers DENTRO del test
            // Usamos la copia guardada en el setup.js (global.originalBuffers) o la local (initialBuffers)
            const original = global.originalBuffers || initialBuffers; // Usar la global si existe
            notificationController.temperatureAlertsByHour = JSON.parse(JSON.stringify(original.temperatureAlertsByHour));
            notificationController.disconnectionAlertsByHour = JSON.parse(JSON.stringify(original.disconnectionAlertsByHour));
            notificationController.tempAlertCounters = JSON.parse(JSON.stringify(original.tempAlertCounters));


            // Verificar que los buffers se restauraron al estado original guardado
            expect(notificationController.disconnectionAlertsByHour).toEqual(original.disconnectionAlertsByHour);
            expect(notificationController.temperatureAlertsByHour).toEqual(original.temperatureAlertsByHour);
            expect(notificationController.tempAlertCounters).toEqual(original.tempAlertCounters);
        });
    });
});