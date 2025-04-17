// src/tests/test_notificaciones/escenario1.test.js

const notificationController = require('../../controllers/notificationController');
const emailService = require('../../services/email/emailService');
const { setWithinWorkingHours, advanceToNextHour, advanceTimeByMinutes } = require('../reconexión/helpers/timeHelpers');
const { getChannelState, updateChannelState } = require('../reconexión/helpers/dbHelpers');

// ID del canal operativo
const TEST_CHANNEL_ID = '9999';
const TEST_CHANNEL_NAME = 'Canal de integración';

describe('Escenario 1: Dentro del Horario Laboral', () => {
    // Espías para los métodos del emailService
    let sendDisconnectedSensorsEmailSpy;
    let sendTemperatureRangeAlertsEmailSpy;

    beforeEach(() => {
        // Configurar espías para los métodos de emailService
        sendDisconnectedSensorsEmailSpy = jest.spyOn(emailService, 'sendDisconnectedSensorsEmail')
            .mockResolvedValue(true); // Simular éxito en el envío

        sendTemperatureRangeAlertsEmailSpy = jest.spyOn(emailService, 'sendTemperatureRangeAlertsEmail')
            .mockResolvedValue(true); // Simular éxito en el envío
    });

    afterEach(() => {
        // Restaurar todos los mocks después de cada prueba
        jest.restoreAllMocks();
    });

    test('1.1: Desconexión Canal Operativo dentro del horario laboral envía alerta', async () => {
        // Verificar que el canal existe y está marcado como operativo
        const channelState = await getChannelState(TEST_CHANNEL_ID);
        expect(channelState.esOperativa).toBe(1); // Debe estar marcado como operativo

        // Configurar tiempo dentro del horario laboral (ej: miércoles 11:00 AM)
        const testTime = setWithinWorkingHours();

        // Simular evento de desconexión (isOnline = false)
        await notificationController.processConnectionStatusChange(
            TEST_CHANNEL_ID,
            TEST_CHANNEL_NAME,
            false, // isOnline = false
            false, // wasOffline = false (no estaba offline antes)
            null,  // outOfRangeSince
            null,  // lastAlertSent
            true   // isOperational = true (SÍ operativo)
        );

        // Verificar que se creó un evento en el buffer para la hora actual
        const currentHourKey = notificationController.getHourKey(testTime);
        expect(notificationController.disconnectionAlertsByHour[currentHourKey]).toBeDefined();
        expect(notificationController.disconnectionAlertsByHour[currentHourKey][TEST_CHANNEL_ID]).toBeDefined();
        expect(notificationController.disconnectionAlertsByHour[currentHourKey][TEST_CHANNEL_ID].length).toBe(1);
        expect(notificationController.disconnectionAlertsByHour[currentHourKey][TEST_CHANNEL_ID][0].event).toBe('disconnected');

        // Avanzar a la siguiente hora para simular el procesamiento
        const nextHourTime = advanceToNextHour(testTime);

        // Simular procesamiento horario
        await notificationController.processHourlyAlerts();

        // Verificar que SÍ se llamó al método de envío de correo INCLUSO EN HORARIO LABORAL
        // Las alertas de desconexión se envían siempre, independientemente del horario laboral
        expect(sendDisconnectedSensorsEmailSpy).toHaveBeenCalled();

        // Verificar argumentos de la llamada
        const emailArgs = sendDisconnectedSensorsEmailSpy.mock.calls[0][0];
        expect(emailArgs).toBeInstanceOf(Array);
        expect(emailArgs.length).toBeGreaterThan(0);

        // Verificar que el canal correcto está en los argumentos
        const channelInEmail = emailArgs.find(alert => alert.channelId === TEST_CHANNEL_ID);
        expect(channelInEmail).toBeDefined();
        expect(channelInEmail.name).toBe(TEST_CHANNEL_NAME);
        expect(channelInEmail.finalStatus).toBe('DESCONECTADO');

        // Verificar que se actualizó la BD para last_alert_sent
        const updatedState = await getChannelState(TEST_CHANNEL_ID);
        expect(updatedState.last_alert_sent).not.toBeNull();
    });

    test('1.2: Temperatura Fuera de Rango Canal Operativo dentro de horario laboral no envía alerta', async () => {
        // Verificar que el canal existe y está marcado como operativo
        const channelState = await getChannelState(TEST_CHANNEL_ID);
        expect(channelState.esOperativa).toBe(1); // Debe estar marcado como operativo

        // Configurar tiempo dentro del horario laboral (ej: miércoles 11:00 AM)
        const testTime = setWithinWorkingHours();

        // Temperatura claramente fuera de rango (usaremos -25°C, umbral mínimo es -21°C)
        const temperature = -25;

        // Definimos valores esperados para este canal basados en la documentación
        const minThreshold = -21.00;
        const maxThreshold = 15.00;

        // Simular 3 lecturas de temperatura fuera de rango
        for (let i = 0; i < 3; i++) {
            await notificationController.processTemperatureReading(
                TEST_CHANNEL_ID,           // channelId
                TEST_CHANNEL_NAME,         // channelName
                temperature,               // temperatura
                testTime.toISOString(),    // timestamp
                minThreshold,              // minThreshold
                maxThreshold,              // maxThreshold
                true                       // isOperational = true
            );
        }

        // Verificar que se incrementó el contador para este canal
        // NOTA: El contador debe haberse reseteado después de alcanzar 3 y generar una alerta
        expect(notificationController.tempAlertCounters[TEST_CHANNEL_ID]).toBeDefined();
        expect(notificationController.tempAlertCounters[TEST_CHANNEL_ID].count).toBe(0);

        // Verificar que se creó alerta en el buffer
        const currentHourKey = notificationController.getHourKey(testTime);
        expect(notificationController.temperatureAlertsByHour[currentHourKey]).toBeDefined();
        expect(notificationController.temperatureAlertsByHour[currentHourKey][TEST_CHANNEL_ID]).toBeDefined();
        expect(notificationController.temperatureAlertsByHour[currentHourKey][TEST_CHANNEL_ID].length).toBe(1);

        // Avanzar a la siguiente hora para simular el procesamiento
        const nextHourTime = advanceToNextHour(testTime);
        const nextHourKey = notificationController.getHourKey(nextHourTime);

        // Simular procesamiento horario dentro del horario laboral
        await notificationController.processHourlyAlerts();

        // Verificar que NO se llamó al método de envío de correo para temperatura
        expect(sendTemperatureRangeAlertsEmailSpy).not.toHaveBeenCalled();

        // Verificar que la alerta se movió al buffer de la siguiente hora
        expect(notificationController.temperatureAlertsByHour[nextHourKey]).toBeDefined();
        expect(notificationController.temperatureAlertsByHour[nextHourKey][TEST_CHANNEL_ID]).toBeDefined();
        expect(notificationController.temperatureAlertsByHour[nextHourKey][TEST_CHANNEL_ID].length).toBe(1);

        // Verificar detalles de la alerta movida
        const movedAlert = notificationController.temperatureAlertsByHour[nextHourKey][TEST_CHANNEL_ID][0];
        expect(movedAlert.temperature).toBe(temperature);
        expect(movedAlert.channelId).toBe(TEST_CHANNEL_ID);
    });
});